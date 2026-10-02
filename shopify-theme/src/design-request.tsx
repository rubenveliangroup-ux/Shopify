import { useEffect, useRef, useState } from 'react';
import { submitContactForm, uploadViaCart, validateFile } from '@/components/forms/upload-via-cart';
import type { RequestPrefill } from '@/components/studio/design-studio';
import { ZONES } from '@/components/studio/zones';
import { cn } from '@/lib/utils';
import type { SendConfig } from './send-design';

const MAX_FILES = 6;
const REF_EXT = /\.(png|jpe?g|webp|gif|svg|heic|pdf)$/i;
/** Marca que lee la confirmación tras volver del envío (br-design-studio.liquid). */
export const SENT_KEY = 'br-envio';

type Props = { prefill: RequestPrefill; sizes: string[]; send: SendConfig };

/**
 * Camino B: «¿Prefieres que te lo diseñemos nosotros?». Sin cálculo de precio (se presupuesta a
 * mano). Mismo sistema que «Enviar mi diseño» y «Cuéntanos tu proyecto»: archivos al CDN de
 * Shopify a través del carrito y mensaje por el formulario de contacto nativo (llega al email de la tienda).
 */
export function ShopifyDesignRequest({ prefill, sizes, send }: Props) {
  // Precargados con lo elegido arriba hasta que el cliente los cambia
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [prenda, setPrenda] = useState(prefill.prenda);
  const [talla, setTalla] = useState(prefill.talla ?? '');
  const [color, setColor] = useState(`${prefill.color.name} (${prefill.color.hex.toUpperCase()})`);
  const [zonas, setZonas] = useState<string[]>(prefill.zonas);
  const [tamano, setTamano] = useState(prefill.tamano);
  useEffect(() => {
    if (!touched.prenda) setPrenda(prefill.prenda);
    if (!touched.talla) setTalla(prefill.talla ?? '');
    if (!touched.color) setColor(`${prefill.color.name} (${prefill.color.hex.toUpperCase()})`);
    if (!touched.zonas) setZonas(prefill.zonas);
    if (!touched.tamano) setTamano(prefill.tamano);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill.prenda, prefill.talla, prefill.color.hex, prefill.color.name, prefill.zonas.join(), prefill.tamano]);
  const touch = (k: string) => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  const [idea, setIdea] = useState('');
  const [links, setLinks] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [cantidad, setCantidad] = useState('');
  const [fecha, setFecha] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [honey, setHoney] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fakeDone, setFakeDone] = useState(false);
  const shownAt = useRef(Date.now());
  const fileInput = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const errs: string[] = [];
    const ok = [...list].filter((f) => {
      if (!REF_EXT.test(f.name)) return errs.push(`«${f.name}» no es una imagen ni un PDF.`), false;
      const e = validateFile(f);
      return e ? (errs.push(e), false) : true;
    });
    const next = [...files, ...ok];
    if (next.length > MAX_FILES) errs.push(`Puedes adjuntar hasta ${MAX_FILES} archivos.`);
    setFiles(next.slice(0, MAX_FILES));
    setFileError(errs.join(' ') || null);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!idea.trim()) return setError('Cuéntanos tu idea en «Descripción de la idea».');
    if (!name.trim()) return setError('Escribe tu nombre.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Revisa tu email: lo necesitamos para enviarte el presupuesto.');
    if (!consent) return setError('Acepta la política de privacidad para enviarnos tu solicitud.');
    // Anti-spam sin molestar: campo trampa invisible y envío demasiado rápido para una persona
    if (honey || Date.now() - shownAt.current < 3000) {
      setFakeDone(true);
      return;
    }
    const form = document.getElementById(send.formId) as HTMLFormElement | null;
    if (!form) return setError('No se encuentra el formulario de envío. Recarga la página.');
    setError(null);
    try {
      let adjuntos = '(sin archivos)';
      if (files.length && send.uploadVariantId) {
        setStatus('Subiendo tus referencias…');
        try {
          const up = await uploadViaCart(
            files.map((f, i) => ({ label: `Referencia ${i + 1}`, file: f })),
            { variantId: send.uploadVariantId, root: send.root }
          );
          adjuntos = up.map((u) => `${u.label} (${u.name}): ${u.url}`).join('\n');
        } catch (err) {
          console.warn('[br-studio] subida fallida', err);
          adjuntos = `(No se pudieron adjuntar ${files.length} archivo(s): ${files.map((f) => f.name).join(', ')}. Pedírselos al cliente por email.)`;
        }
      } else if (files.length) {
        adjuntos = `(${files.length} archivo(s) sin subir: ${files.map((f) => f.name).join(', ')}. Pedírselos al cliente.)`;
      }
      setStatus('Enviando…');
      const zonaLabels = zonas.map((id) => ZONES.find((z) => z.id === id)?.label ?? id);
      const body = [
        'NUEVA SOLICITUD: «¿PREFIERES QUE TE LO DISEÑEMOS NOSOTROS?»',
        '',
        `Prenda: ${prenda || '—'}`,
        `Talla: ${talla || 'Sin elegir'}`,
        `Color: ${color || '—'}`,
        `Zona(s): ${zonaLabels.join(', ') || 'Sin indicar'}`,
        `Tamaño aproximado: ${tamano.trim() || 'Sin indicar'}`,
        `Cantidad aproximada: ${cantidad.trim() || 'Sin indicar'}`,
        `Fecha deseada: ${fecha || 'Sin indicar'}`,
        '',
        'Idea y especificaciones:',
        idea.trim(),
        '',
        'Enlaces de referencia:',
        links.trim() || '(ninguno)',
        '',
        'Archivos de referencia:',
        adjuntos,
        '',
        'Sin precio calculado: presupuestar a mano.'
      ].join('\n');
      try {
        sessionStorage.setItem(SENT_KEY, 'encargo');
      } catch {
        /* sin almacenamiento: se verá la confirmación genérica */
      }
      submitContactForm(form, {
        'contact[name]': name.trim(),
        'contact[email]': email.trim(),
        'contact[phone]': phone.trim(),
        'contact[Tipo de solicitud]': 'Te lo diseñamos nosotros (sin precio: presupuestar)',
        'contact[body]': body
      });
    } catch (err) {
      console.error('[br-studio]', err);
      setStatus(null);
      setError('No hemos podido enviarlo. Inténtalo de nuevo o escríbenos por email.');
    }
  }

  if (fakeDone)
    return <p className="rounded-2xl bg-lino-100 px-4 py-3 text-tinta" role="status">Hemos recibido tu solicitud, te contactaremos para darte un presupuesto.</p>;

  const lbl = 'mb-1.5 block text-sm font-medium text-lino/85';
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 [&_.field]:text-tinta" noValidate>
      <div>
        <label className={lbl} htmlFor="tl-prenda">Prenda</label>
        <input id="tl-prenda" className="field" value={prenda} onChange={(e) => (touch('prenda'), setPrenda(e.target.value))} />
      </div>
      <div>
        <label className={lbl} htmlFor="tl-talla">Talla</label>
        <select id="tl-talla" className="field" value={talla} onChange={(e) => (touch('talla'), setTalla(e.target.value))}>
          <option value="">Aún no lo sé</option>
          {sizes.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className={lbl} htmlFor="tl-color">Color de la prenda</label>
        <input id="tl-color" className="field" value={color} onChange={(e) => (touch('color'), setColor(e.target.value))} />
      </div>

      <fieldset className="min-w-0 sm:col-span-2">
        <legend className={lbl}>Zona(s) donde quieres el diseño (opcional)</legend>
        <div className="flex flex-wrap gap-2">
          {ZONES.map((z) => {
            const on = zonas.includes(z.id);
            return (
              <button
                key={z.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  touch('zonas');
                  setZonas((list) => (on ? list.filter((x) => x !== z.id) : [...list, z.id]));
                }}
                className={cn('rounded-full border px-3 py-1.5 text-sm transition', on ? 'border-[#D1C4A4] bg-[#D1C4A4] text-tinta' : 'border-lino/30 hover:border-lino')}
              >
                {z.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <label className={lbl} htmlFor="tl-tamano">Tamaño aproximado en cm (opcional)</label>
        <input id="tl-tamano" className="field" placeholder="Ej.: 10 cm de ancho en el pecho" value={tamano} onChange={(e) => (touch('tamano'), setTamano(e.target.value))} />
      </div>

      <div className="sm:col-span-2">
        <label className={lbl} htmlFor="tl-idea">Descripción de la idea y especificaciones *</label>
        <textarea
          id="tl-idea"
          className="field"
          rows={5}
          required
          maxLength={3000}
          value={idea}
          onChange={(e) => (setIdea(e.target.value), setError(null))}
          placeholder="Qué quieres bordar, estilo, colores, textos, para quién es…"
        />
      </div>

      <div className="sm:col-span-2">
        <span className={lbl}>Referencias (opcional)</span>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex w-full flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-lino/30 px-4 py-5 text-center transition hover:border-lino"
        >
          <span className="text-sm font-semibold">Adjuntar imágenes o PDF</span>
          <span className="text-xs text-lino/70">Desde la galería o el ordenador · hasta {MAX_FILES} archivos de 15 MB</span>
        </button>
        <input ref={fileInput} type="file" multiple accept="image/*,application/pdf,.pdf" className="hidden" onChange={(e) => addFiles(e.target.files)} />
        {fileError && <p className="mt-2 rounded-xl bg-hilo-100 px-3 py-2 text-sm text-hilo-600" role="alert">{fileError}</p>}
        {files.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-xl bg-lino/10 px-3 py-2">
                <span className="truncate">{f.name} · {(f.size / 1024 / 1024).toFixed(1)} MB</span>
                <button type="button" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} aria-label={`Quitar ${f.name}`} className="text-lg leading-none">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="sm:col-span-2">
        <label className={lbl} htmlFor="tl-links">Enlaces de referencia (opcional)</label>
        <textarea id="tl-links" className="field" rows={2} value={links} onChange={(e) => setLinks(e.target.value)} placeholder="Pinterest, Instagram… (uno por línea)" />
      </div>

      <div>
        <label className={lbl} htmlFor="tl-cantidad">Cantidad aproximada (opcional)</label>
        <input id="tl-cantidad" className="field" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Ej.: 1, 10, 50" />
      </div>
      <div>
        <label className={lbl} htmlFor="tl-fecha">Fecha deseada (opcional)</label>
        <input id="tl-fecha" className="field" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>

      <div className="sm:col-span-2">
        <label className={lbl} htmlFor="tl-name">Nombre *</label>
        <input id="tl-name" className="field" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className={lbl} htmlFor="tl-email">Email *</label>
        <input id="tl-email" className="field" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className={lbl} htmlFor="tl-phone">Teléfono (opcional)</label>
        <input id="tl-phone" className="field" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      {/* Trampa para robots: invisible para las personas */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="tl-web">Tu web</label>
        <input id="tl-web" tabIndex={-1} autoComplete="off" value={honey} onChange={(e) => setHoney(e.target.value)} />
      </div>

      <label className="flex items-start gap-3 text-sm sm:col-span-2">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-hilo" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          He leído la <a href="/policies/privacy-policy" target="_blank" rel="noopener" className="underline">política de privacidad</a> y acepto que uséis
          mis datos para responder a esta solicitud. *
        </span>
      </label>

      {error && <p className="rounded-xl bg-hilo-100 px-4 py-3 text-sm text-hilo-600 sm:col-span-2" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={!!status}
        className="min-h-[52px] rounded-full bg-[#D1C4A4] px-6 text-base font-semibold text-tinta transition hover:bg-[#ddd2b6] disabled:opacity-60 sm:col-span-2"
      >
        {status ?? 'Enviar mi solicitud'}
      </button>
      <p className="text-xs text-lino/70 sm:col-span-2">Te respondemos por email con una propuesta y el presupuesto. No calculamos precio aquí: lo preparamos a mano.</p>
    </form>
  );
}
