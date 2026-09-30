'use client';

import { useRef, useState } from 'react';
import { ACCEPTED_FILES, MAX_FILES, MAX_FILE_MB } from '@/lib/brief-config';
import { cn } from '@/lib/utils';
import { CheckIcon, UploadIcon } from './icons';

type Errors = Record<string, string[] | undefined>;

export function BriefForm({ tipo }: { tipo: 'particular' | 'marca' }) {
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const input = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const valid = [...list].filter((f) => ACCEPTED_FILES.includes(f.type) && f.size <= MAX_FILE_MB * 1024 * 1024);
    if (valid.length < list.length) setMessage(`Algunos archivos no son válidos (PNG, JPG, WEBP, SVG o PDF, máx. ${MAX_FILE_MB} MB).`);
    else setMessage(null);
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_FILES));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    setErrors({});
    setMessage(null);
    const data = new FormData(e.currentTarget);
    data.delete('archivos');
    files.forEach((f) => data.append('archivos', f));
    try {
      const res = await fetch('/api/brief', { method: 'POST', body: data });
      const json = await res.json();
      if (json.ok) {
        setStatus('done');
        window.scrollTo({ top: (e.target as HTMLElement).getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
        return;
      }
      setErrors(json.errors ?? {});
      setMessage(json.message ?? 'Revisa los campos marcados.');
    } catch {
      setMessage('Error de conexión. Inténtalo de nuevo.');
    }
    setStatus('idle');
  }

  if (status === 'done') {
    return (
      <div className="rounded-3xl bg-bosque p-10 text-center text-lino">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-lino text-bosque"><CheckIcon className="h-7 w-7" /></span>
        <h3 className="mt-6 text-3xl">¡Recibido!</h3>
        <p className="mx-auto mt-3 max-w-md text-lino/80">
          {tipo === 'marca'
            ? 'Te enviamos propuesta y presupuesto en 24–48 h laborables. Revisa también la carpeta de spam.'
            : 'En 48 h laborables tendrás en tu email el boceto de tu prenda y el precio cerrado. Sin compromiso.'}
        </p>
      </div>
    );
  }

  const err = (k: string) => errors[k]?.[0];

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6 rounded-3xl bg-lino-100 p-6 ring-1 ring-tinta/10 sm:p-10">
      <input type="hidden" name="tipo" value={tipo} />
      {/* honeypot */}
      <input type="text" name="empresa_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <Group title={tipo === 'marca' ? '1. Vuestro proyecto' : '1. Tu idea'}>
        {tipo === 'marca' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Marca / empresa" name="marca" error={err('marca')} required />
            <Field label="Web o Instagram" name="web" error={err('web')} placeholder="opcional" />
            <Select label="¿Qué necesitáis?" name="servicio" error={err('servicio')} options={[
              ['diseno-y-produccion', 'Diseño + producción'],
              ['solo-produccion', 'Solo producción (tenemos diseño)'],
              ['coleccion', 'Colección / cápsula'],
              ['merch', 'Merch / uniformes de empresa']
            ]} />
            <Select label="Volumen aproximado" name="volumen" error={err('volumen')} options={[
              ['25-50', '25–50 uds'], ['50-150', '50–150 uds'], ['150-500', '150–500 uds'], ['500+', 'Más de 500 uds']
            ]} />
          </div>
        )}
        <div>
          <label className="label" htmlFor="idea">
            {tipo === 'marca' ? 'Cuéntanos el proyecto' : 'Describe tu idea'} <span className="text-hilo">*</span>
          </label>
          <textarea
            id="idea"
            name="idea"
            rows={5}
            required
            className={cn('field resize-y', err('idea') && 'border-hilo')}
            placeholder={tipo === 'marca'
              ? 'Tipo de prendas, estilo de la marca, colores, dónde irá el bordado, fecha de lanzamiento…'
              : 'Ej.: el dibujo que hizo mi hija de nuestro perro, en pequeño en el pecho, hilo blanco sobre sudadera negra.'}
          />
          {err('idea') && <p className="mt-1 text-xs text-hilo-600">{err('idea')}</p>}
        </div>

        <div>
          <p className="label">{tipo === 'marca' ? 'Logo, referencias o moodboard' : 'Sube tu dibujo, foto o referencia'}</p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-tinta/20 bg-lino px-6 py-8 text-center transition hover:border-hilo"
          >
            <UploadIcon className="h-7 w-7 text-hilo" />
            <span className="text-sm font-medium">Arrastra aquí o toca para elegir</span>
            <span className="text-xs text-tinta-500">PNG, JPG, WEBP, SVG o PDF · hasta {MAX_FILES} archivos de {MAX_FILE_MB} MB</span>
          </button>
          <input ref={input} type="file" name="archivos" multiple accept={ACCEPTED_FILES.join(',')} className="hidden" onChange={(e) => addFiles(e.target.files)} />
          {files.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <li key={f.name + i} className="flex items-center gap-2 rounded-full bg-lino-200 py-1 pl-3 pr-1 text-xs">
                  {f.name}
                  <button type="button" aria-label={`Quitar ${f.name}`} className="grid h-5 w-5 place-items-center rounded-full hover:bg-lino-300" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Group>

      {tipo === 'particular' && (
        <Group title="2. La prenda">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Prenda" name="prenda" error={err('prenda')} options={[
              ['sudadera', 'Sudadera (cuello redondo)'], ['hoodie', 'Sudadera con capucha'], ['camiseta', 'Camiseta'], ['otra', 'Otra / no lo sé']
            ]} />
            <Field label="Color de prenda" name="color" placeholder="Ej.: negro, crudo, verde" error={err('color')} />
            <Select label="Posición del bordado" name="ubicacion" error={err('ubicacion')} options={[
              ['pecho', 'Pecho (pequeño)'], ['centro', 'Centro (grande)'], ['espalda', 'Espalda'], ['manga', 'Manga'], ['no-se', 'Aconsejadme']
            ]} />
            <Field label="Unidades" name="cantidad" type="number" defaultValue="1" min={1} max={500} error={err('cantidad')} />
          </div>
        </Group>
      )}

      {tipo === 'marca' && (
        <Group title="2. Plazos">
          <Field label="¿Tenéis fecha límite?" name="plazo" placeholder="Ej.: lanzamiento 15 de noviembre" error={err('plazo')} />
        </Group>
      )}

      <Group title="3. Contacto">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" name="nombre" autoComplete="name" error={err('nombre')} required />
          <Field label="Email" name="email" type="email" autoComplete="email" error={err('email')} required />
          <Field label="Teléfono / WhatsApp" name="telefono" type="tel" autoComplete="tel" placeholder="opcional, para dudas rápidas" error={err('telefono')} />
        </div>
        <label className="flex items-start gap-3 text-sm text-tinta-700">
          <input type="checkbox" name="consentimiento" className="mt-0.5 h-4 w-4 accent-hilo" required />
          <span>Acepto que BR use estos datos para responder a mi solicitud. {err('consentimiento') && <span className="text-hilo-600">({err('consentimiento')})</span>}</span>
        </label>
      </Group>

      {message && <p className="rounded-xl bg-hilo-100 px-4 py-3 text-sm text-hilo-600" role="alert">{message}</p>}

      <button type="submit" disabled={status === 'sending'} className="btn-primary w-full py-4 text-base">
        {status === 'sending' ? 'Enviando…' : tipo === 'marca' ? 'Pedir propuesta y presupuesto' : 'Quiero mi boceto gratis'}
      </button>
      <p className="text-center text-xs text-tinta-500">Sin compromiso · Respondemos en 24–48 h laborables</p>
    </form>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-2 font-display text-xl">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ label, name, error, required, ...rest }: { label: string; name: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label} {required && <span className="text-hilo">*</span>}</label>
      <input id={name} name={name} required={required} className={cn('field', error && 'border-hilo')} {...rest} />
      {error && <p className="mt-1 text-xs text-hilo-600">{error}</p>}
    </div>
  );
}

function Select({ label, name, options, error }: { label: string; name: string; options: [string, string][]; error?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} className={cn('field', error && 'border-hilo')}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {error && <p className="mt-1 text-xs text-hilo-600">{error}</p>}
    </div>
  );
}
