import { useEffect, useState } from 'react';
import { CloseIcon } from '@/components/icons';
import { AVISO_COLOR_LIBRE } from '@/components/color/color-config';
import { threadLabel } from '@/components/color/threads';
import { submitContactForm, uploadViaCart } from '@/components/forms/upload-via-cart';
import type { CheckoutProps } from '@/components/studio/design-studio';
import { fmtEur, fmtInt } from '@/components/studio/embroidery-pricing';
import type { ShopifyVariant } from './add-to-cart';
import { SENT_KEY } from './design-request';

export type SendConfig = {
  /** id del formulario de contacto oculto de la sección ({% form 'contact' %}). */
  formId: string;
  /** Variante del producto técnico «br-subida-archivos» (0 €, oculto). */
  uploadVariantId?: number | null;
  root?: string;
};

type Props = CheckoutProps & { variants: ShopifyVariant[]; send: SendConfig };

/**
 * «Enviar mi diseño»: manda a la tienda el resumen completo (prenda, talla, color, hilos,
 * puntadas, precio estimado), las imágenes del diseño y de la vista previa y los datos de
 * contacto. Archivos → CDN de Shopify (vía carrito); mensaje → formulario de contacto de Shopify.
 */
export function ShopifySendDesign({ onClose, getAttachments, details, embroidery, garment, variants, send, size, blockedReason }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [talla, setTalla] = useState(size ?? '');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const q = embroidery?.quote;
  const summary: [string, string][] = [
    ...details,
    ['Talla', talla || 'Sin elegir'],
    ...(garment?.free ? ([['Aviso', AVISO_COLOR_LIBRE]] as [string, string][]) : []),
    ...(embroidery
      ? ([
          ['Colores de hilo', `${embroidery.colors.length}: ${embroidery.colors.map((c) => (c.thread ? `${threadLabel(c.thread)} ${c.hex}` : c.hex)).join(', ')}`],
          ['Puntadas estimadas', `≈ ${fmtInt(embroidery.stitches)} (entre ${fmtInt(embroidery.range[0])} y ${fmtInt(embroidery.range[1])})`],
          ['Tamaño del bordado', embroidery.sizes],
          [
            'Precio estimado del bordado',
            q?.kind === 'priced' ? `${fmtEur(q.total)} (${q.tierLabel})` : q?.kind === 'quote-required' ? 'Presupuesto personalizado' : '—'
          ]
        ] as [string, string][])
      : [])
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return setError('Acepta la política de privacidad para enviarnos tu diseño.');
    const form = document.getElementById(send.formId) as HTMLFormElement | null;
    if (!form) return setError('No se encuentra el formulario de envío. Recarga la página.');
    setError(null);
    try {
      setStatus('Preparando las imágenes…');
      const files = await getAttachments();
      let links = '';
      if (files.length && send.uploadVariantId) {
        setStatus('Subiendo tu diseño…');
        try {
          const up = await uploadViaCart(files, { variantId: send.uploadVariantId, root: send.root });
          links = up.map((u) => `${u.label}: ${u.url}`).join('\n');
        } catch (err) {
          console.warn('[br-studio] subida fallida', err);
          links = '(No se pudieron adjuntar las imágenes: el cliente las enviará por email.)';
        }
      }
      setStatus('Enviando…');
      const body = [
        'NUEVO DISEÑO DESDE «DISEÑA TU PRENDA»',
        '',
        ...summary.map(([k, v]) => `${k}: ${v}`),
        ...(notes.trim() ? ['', `Notas del cliente: ${notes.trim()}`] : []),
        '',
        'Archivos (diseño y vista previa):',
        links || '(sin archivos)',
        '',
        'Cálculo aproximado. El precio final se confirma tras digitalizar el diseño.'
      ].join('\n');
      try {
        sessionStorage.setItem(SENT_KEY, 'diseno');
      } catch {
        /* sin almacenamiento: se verá la confirmación genérica */
      }
      submitContactForm(form, {
        'contact[name]': name.trim(),
        'contact[email]': email.trim(),
        'contact[phone]': phone.trim(),
        'contact[Tipo de solicitud]': 'Enviar mi diseño (hecho en el estudio)',
        'contact[body]': body
      });
    } catch (err) {
      console.error('[br-studio]', err);
      setStatus(null);
      setError('No hemos podido enviarlo. Inténtalo de nuevo o escríbenos por email.');
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-end sm:place-items-center" role="dialog" aria-modal="true" aria-label="Enviar mi diseño">
      <button aria-label="Cerrar" className="absolute inset-0 bg-tinta/40 backdrop-blur-[2px]" onClick={onClose} />
      <form onSubmit={submit} className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-lino-100 p-6 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-8">
        <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-4 top-4 rounded-full p-2 hover:bg-lino-200">
          <CloseIcon className="h-5 w-5" />
        </button>
        <h2 className="font-display text-3xl">Enviar mi diseño</h2>
        <p className="mt-1 text-sm text-tinta-700">Te respondemos con el boceto y el precio. Sin compromiso.</p>

        {blockedReason?.startsWith('Tu diseño está vacío') ? (
          <p className="mt-5 rounded-xl bg-oro-100 px-4 py-3 text-sm">{blockedReason}</p>
        ) : (
          <>
            <details className="group mt-4 rounded-2xl bg-lino px-4 py-3 text-sm" open={typeof window !== 'undefined' && window.innerWidth >= 640}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
                <span>
                  Resumen de tu diseño
                  {q?.kind === 'priced' && <span className="ml-2 font-normal text-tinta-700">· {fmtEur(q.total)} de bordado</span>}
                </span>
                <span className="text-lg transition group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <dl className="mt-1 grid gap-y-2 sm:grid-cols-[auto_1fr] sm:gap-x-4 sm:gap-y-1">
                {summary.map(([k, v]) => (
                  <div key={k} className="sm:contents">
                    <dt className="text-xs text-tinta-500 sm:text-sm">{k}</dt>
                    <dd className="text-tinta">{v}</dd>
                  </div>
                ))}
              </dl>
            </details>
            <p className="mt-2 text-xs text-tinta-500">Adjuntamos tu diseño y la imagen de la vista previa.</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="br-s-name">Nombre *</label>
                <input id="br-s-name" className="field" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="br-s-email">Email *</label>
                <input id="br-s-email" className="field" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="br-s-phone">Teléfono (opcional)</label>
                <input id="br-s-phone" className="field" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="br-s-size">Talla</label>
                <select id="br-s-size" className="field" value={talla} onChange={(e) => setTalla(e.target.value)}>
                  <option value="">Aún no lo sé</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.title}>{v.title}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="br-s-notes">Notas (opcional)</label>
                <textarea id="br-s-notes" className="field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Unidades, fecha límite, dudas…" />
              </div>
            </div>
            <label className="mt-4 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-hilo" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                He leído la <a href="/policies/privacy-policy" target="_blank" rel="noopener" className="underline">política de privacidad</a> y acepto que
                usemos mis datos para responder a esta solicitud.
              </span>
            </label>

            {error && <p className="mt-4 rounded-xl bg-hilo-100 px-4 py-3 text-sm text-hilo-600" role="alert">{error}</p>}
            <button type="submit" disabled={!!status} className="btn-primary mt-6 w-full py-4 text-base">
              {status ?? 'Enviar mi diseño'}
            </button>
            <p className="mt-3 text-center text-xs text-tinta-500">Cálculo aproximado. El precio final se confirma tras digitalizar el diseño.</p>
          </>
        )}
      </form>
    </div>
  );
}
