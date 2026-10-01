import { useEffect, useState } from 'react';
import { CloseIcon } from '@/components/icons';
import type { CheckoutProps } from '@/components/studio/design-studio';
import { AVISO_COLOR_LIBRE } from '@/components/color/color-config';
import { threadLabel } from '@/components/color/threads';
import { fmtEur, fmtInt } from '@/components/studio/embroidery-pricing';
import { SizeChart, type SizeChartData } from '@/components/studio/size-chart';
import { cn } from '@/lib/utils';

export type ShopifyVariant = { id: number; title: string; available: boolean };

type Props = CheckoutProps & {
  variants: ShopifyVariant[];
  price: string;
  /** Precio de la prenda en euros (para sumar el extra de bordado). */
  priceValue: number;
  cartAddUrl: string;
  cartUrl: string;
  sizeChart?: SizeChartData;
};

type Line = { id: number; quantity: number; properties: Record<string, string>; files?: { label: string; file: File }[] };

/** Intenta añadir todas las líneas en una sola llamada (multipart a /cart/add.js). */
async function addAll(cartAddUrl: string, lines: Line[]) {
  const fd = new FormData();
  lines.forEach((l, i) => {
    fd.append(`items[${i}][id]`, String(l.id));
    fd.append(`items[${i}][quantity]`, String(l.quantity));
    Object.entries(l.properties).forEach(([k, v]) => fd.append(`items[${i}][properties][${k}]`, v));
    l.files?.forEach(({ label, file }) => fd.append(`items[${i}][properties][${label}]`, file, file.name));
  });
  const res = await fetch(`${cartAddUrl}.js`, { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`cart/add ${res.status}: ${await res.text().catch(() => '')}`);
}

/**
 * Añade la prenda personalizada al carrito de Shopify con el diseño adjunto.
 * Usa un formulario multipart a /cart/add (método oficial de Shopify para subir
 * archivos como propiedades de la línea): archivos y especificaciones quedan en el pedido.
 */
export function ShopifyAddToCart({ onClose, getAttachments, details, blockedReason, embroidery, garment, variants, price, priceValue, cartAddUrl, cartUrl, sizeChart }: Props) {
  const q = embroidery?.quote;
  const extra = q?.kind === 'priced' ? q.total : 0;
  const unitTotal = priceValue + extra;
  const [variantId, setVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
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

  async function submit() {
    if (!variantId) {
      setError('Elige tu talla');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const attachments = await getAttachments();

      // Datos de la estimación: propiedades privadas (prefijo _), ocultas en el checkout y visibles en el pedido
      const est: Record<string, string> = {};
      if (embroidery && q) {
        est['_Puntadas estimadas'] = `${fmtInt(embroidery.stitches)} (incluye +${Math.round((embroidery.stitches / Math.max(1, embroidery.rawStitches) - 1) * 100)} % de margen; sin margen ${fmtInt(embroidery.rawStitches)})`;
        est['_Colores de hilo'] = `${embroidery.colors.length}: ${embroidery.colors.map((c) => (c.thread ? `${threadLabel(c.thread)} ${c.hex}` : c.hex)).join(', ')}`;
        est['_Tamaño del bordado'] = embroidery.sizes;
        est['_Tramo'] = q.kind === 'priced' ? q.tierLabel : 'Sujeto a presupuesto (no se ha cobrado el extra)';
        if (q.kind === 'priced') est['_Extra de bordado'] = `${fmtEur(q.total)} por unidad`;
      }

      const mainProps: Record<string, string> = Object.fromEntries(details.filter(([k]) => k !== 'Prenda'));
      if (notes.trim()) mainProps['Notas'] = notes.trim().slice(0, 500);
      // Color de prenda libre: aviso visible en carrito y pedido + hex exacto (privado)
      if (garment?.free) {
        mainProps['Aviso'] = AVISO_COLOR_LIBRE;
        est['_Color prenda (hex)'] = garment.hex.toUpperCase();
      }
      const ref = { '_Prenda vinculada': `Sudadera personalizada · talla ${variants.find((v) => v.id === variantId)?.title ?? ''}` };

      const lines: Line[] = [{ id: variantId, quantity, properties: { ...mainProps, ...est }, files: attachments }];
      if (q?.kind === 'priced' && q.tierVariant) lines.push({ id: q.tierVariant.id, quantity, properties: { ...est, ...ref } });
      if (q?.kind === 'priced' && q.colorVariant && q.extraColors > 0)
        lines.push({ id: q.colorVariant.id, quantity: q.extraColors * quantity, properties: { _Colores: String(embroidery!.colors.length), ...ref } });

      try {
        await addAll(cartAddUrl, lines);
        window.location.href = cartUrl;
        return;
      } catch (e) {
        // Plan B: extras sin archivos por AJAX y la prenda con el formulario de siempre
        console.warn('[br-studio] añadido combinado rechazado, uso plan B', e);
        if (lines.length > 1) {
          const res = await fetch(`${cartAddUrl}.js`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ items: lines.slice(1).map(({ id, quantity, properties }) => ({ id, quantity, properties })) })
          });
          if (!res.ok) throw new Error(`extras ${res.status}`);
        }
      }

      const form = document.createElement('form');
      form.method = 'post';
      form.action = cartAddUrl;
      form.enctype = 'multipart/form-data';
      form.style.display = 'none';

      const field = (name: string, value: string) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      };

      field('id', String(variantId));
      field('quantity', String(quantity));
      Object.entries({ ...mainProps, ...est }).forEach(([k, v]) => field(`properties[${k}]`, v));
      attachments.forEach(({ label, file }) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.name = `properties[${label}]`;
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit(); // Shopify redirige al carrito
    } catch (e) {
      console.error('[br-studio]', e);
      setError('No hemos podido añadirlo. Inténtalo de nuevo.');
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-end sm:place-items-center" role="dialog" aria-modal="true" aria-label="Añadir al carrito">
      <button aria-label="Cerrar" className="absolute inset-0 bg-tinta/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-lino-100 p-6 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-8">
        <button onClick={onClose} aria-label="Cerrar" className="absolute right-4 top-4 rounded-full p-2 hover:bg-lino-200">
          <CloseIcon className="h-5 w-5" />
        </button>

        <h2 className="font-display text-3xl">Tu prenda personalizada</h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {details.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-tinta-500">{k}</dt>
              <dd className="text-tinta">{v}</dd>
            </div>
          ))}
        </dl>

        {garment?.free && <p className="mt-4 rounded-xl bg-oro-100 px-4 py-3 text-sm">{AVISO_COLOR_LIBRE}.</p>}

        {blockedReason ? (
          <p className="mt-5 rounded-xl bg-oro-100 px-4 py-3 text-sm">{blockedReason}</p>
        ) : (
          <>
            <fieldset className="mt-6">
              <legend className="label">Talla *</legend>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    disabled={!v.available}
                    aria-pressed={variantId === v.id}
                    onClick={() => {
                      setVariantId(v.id);
                      setError(null);
                    }}
                    className={cn(
                      'min-w-12 rounded-full border px-4 py-2 text-sm transition',
                      variantId === v.id ? 'border-tinta bg-tinta text-lino' : 'border-tinta/20 hover:border-tinta',
                      !v.available && 'line-through opacity-40'
                    )}
                  >
                    {v.title}
                  </button>
                ))}
              </div>
              {sizeChart ? (
                <SizeChart data={sizeChart} highlight={variants.find((v) => v.id === variantId)?.title} />
              ) : (
                <p className="mt-2 text-xs text-tinta-500">Corte oversize: si prefieres un ajuste más clásico, elige una talla menos.</p>
              )}
            </fieldset>

            <div className="mt-5 flex items-center gap-4">
              <span className="label mb-0">Unidades</span>
              <div className="flex items-center rounded-full border border-tinta/15">
                <button type="button" aria-label="Quitar una" className="px-3 py-1.5" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
                <span className="w-8 text-center text-sm tabular-nums">{quantity}</span>
                <button type="button" aria-label="Añadir una" className="px-3 py-1.5" onClick={() => setQuantity((q) => Math.min(50, q + 1))}>+</button>
              </div>
            </div>

            <div className="mt-5">
              <label className="label" htmlFor="br-notas">Notas para el estudio (opcional)</label>
              <textarea
                id="br-notas"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="field"
                placeholder="Es un regalo, fecha límite…"
              />
            </div>

            {q && q.kind !== 'empty' && (
              <dl className="mt-5 space-y-1 rounded-2xl bg-lino px-4 py-3 text-sm">
                <div className="flex justify-between"><dt>Sudadera personalizada</dt><dd>{price}</dd></div>
                {q.kind === 'priced' ? (
                  <>
                    <div className="flex justify-between"><dt>Bordado · {q.tierLabel}</dt><dd>{fmtEur(q.tierPrice)}</dd></div>
                    {q.extraColors > 0 && (
                      <div className="flex justify-between"><dt>{q.extraColors} color(es) adicional(es)</dt><dd>{fmtEur(q.colorsPrice)}</dd></div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-between"><dt>Bordado</dt><dd>Sujeto a presupuesto</dd></div>
                )}
                <div className="flex justify-between border-t border-tinta/10 pt-1 font-semibold">
                  <dt>Total{quantity > 1 ? ` (${quantity} uds.)` : ''}</dt>
                  <dd>{fmtEur(unitTotal * quantity)}</dd>
                </div>
                <p className="pt-1 text-xs text-tinta-500">
                  {q.kind === 'priced'
                    ? 'Estimación sujeta a revisión antes de producir. Si el diseño necesita otro tramo, te avisaremos antes de empezar.'
                    : 'Ahora solo pagas la prenda. Te enviaremos el presupuesto del bordado antes de producir.'}
                </p>
              </dl>
            )}

            <ul className="mt-5 space-y-1 text-xs text-tinta-700">
              <li>✓ Tus archivos y especificaciones se adjuntan al pedido.</li>
              <li>✓ Antes de bordar te enviamos el boceto por email para que lo apruebes.</li>
            </ul>

            {error && <p className="mt-4 rounded-xl bg-hilo-100 px-4 py-3 text-sm text-hilo-600" role="alert">{error}</p>}

            <button type="button" onClick={submit} disabled={sending} className="btn-primary mt-6 w-full py-4 text-base">
              {sending
                ? 'Añadiendo…'
                : q?.kind === 'quote-required'
                  ? `Enviar para presupuesto · ${price}`
                  : `Añadir al carrito · ${extra ? fmtEur(unitTotal * quantity) : price}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
