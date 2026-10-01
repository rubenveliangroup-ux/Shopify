'use client';

import { useEffect, useState } from 'react';
import { CheckIcon, CloseIcon } from '../icons';
import type { CheckoutProps } from './design-studio';

export function SendDesign({ onClose, getAttachments, details, prenda, ubicacion, color, blockedReason }: CheckoutProps) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    setMessage(null);
    const form = new FormData(e.currentTarget);
    const notas = String(form.get('notas') ?? '').trim();
    const tallas = String(form.get('tallas') ?? '').trim();
    form.delete('notas');
    form.delete('tallas');
    form.set('tipo', 'particular');
    form.set('prenda', prenda);
    form.set('color', color);
    form.set('ubicacion', ubicacion);
    form.set(
      'idea',
      [
        'Enviado desde el estudio online.',
        ...details.map(([k, v]) => `${k}: ${v}`),
        tallas && `Tallas: ${tallas}`,
        notas && `Notas: ${notas}`
      ]
        .filter(Boolean)
        .join('\n')
    );
    (await getAttachments()).forEach(({ file }) => form.append('archivos', file, file.name));

    try {
      const res = await fetch('/api/brief', { method: 'POST', body: form });
      const json = await res.json();
      if (json.ok) {
        setStatus('done');
        return;
      }
      const first = json.errors && Object.values(json.errors as Record<string, string[]>)[0]?.[0];
      setMessage(first ?? json.message ?? 'Revisa los datos.');
    } catch {
      setMessage('Error de conexión. Inténtalo de nuevo.');
    }
    setStatus('idle');
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center" role="dialog" aria-modal="true" aria-label="Enviar diseño">
      <button aria-label="Cerrar" className="absolute inset-0 bg-tinta/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-lino-100 p-6 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-8">
        <button onClick={onClose} aria-label="Cerrar" className="absolute right-4 top-4 rounded-full p-2 hover:bg-lino-200">
          <CloseIcon className="h-5 w-5" />
        </button>

        {status === 'done' ? (
          <div className="py-6 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-bosque text-lino"><CheckIcon className="h-7 w-7" /></span>
            <h2 className="mt-5 text-3xl">¡Diseño recibido!</h2>
            <p className="mx-auto mt-3 max-w-sm text-tinta-700">
              En 48 h laborables te enviamos el boceto bordable y el precio cerrado. Revisa también la carpeta de spam.
            </p>
            <button onClick={onClose} className="btn-dark mt-6">Seguir diseñando</button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <h2 className="text-3xl">Pide tu boceto gratis</h2>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {details.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-tinta-500">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {blockedReason && <p className="rounded-xl bg-oro-100 px-4 py-3 text-sm">{blockedReason}</p>}
            <input type="text" name="empresa_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="sd-nombre">Nombre *</label>
                <input id="sd-nombre" name="nombre" required autoComplete="name" className="field" />
              </div>
              <div>
                <label className="label" htmlFor="sd-email">Email *</label>
                <input id="sd-email" name="email" type="email" required autoComplete="email" className="field" />
              </div>
              <div>
                <label className="label" htmlFor="sd-cantidad">Unidades</label>
                <input id="sd-cantidad" name="cantidad" type="number" min={1} max={500} defaultValue={1} className="field" />
              </div>
              <div>
                <label className="label" htmlFor="sd-tallas">Talla(s)</label>
                <input id="sd-tallas" name="tallas" placeholder="Ej.: M, o 2 S + 1 L" className="field" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="sd-tel">Teléfono / WhatsApp</label>
              <input id="sd-tel" name="telefono" type="tel" autoComplete="tel" placeholder="opcional" className="field" />
            </div>
            <div>
              <label className="label" htmlFor="sd-notas">Notas para el estudio</label>
              <textarea id="sd-notas" name="notas" rows={3} className="field" placeholder="Algo que debamos saber: colores exactos, es un regalo, fecha límite…" />
            </div>
            <label className="flex items-start gap-3 text-sm text-tinta-700">
              <input type="checkbox" name="consentimiento" required className="mt-0.5 h-4 w-4 accent-hilo" />
              Acepto que BR use estos datos y mi diseño para responder a mi solicitud.
            </label>
            {message && <p className="rounded-xl bg-hilo-100 px-4 py-3 text-sm text-hilo-600" role="alert">{message}</p>}
            <button type="submit" disabled={status === 'sending' || Boolean(blockedReason)} className="btn-primary w-full py-4 text-base">
              {status === 'sending' ? 'Enviando…' : 'Enviar mi diseño'}
            </button>
            <p className="text-center text-xs text-tinta-500">Adjuntamos tus archivos y especificaciones.</p>
          </form>
        )}
      </div>
    </div>
  );
}
