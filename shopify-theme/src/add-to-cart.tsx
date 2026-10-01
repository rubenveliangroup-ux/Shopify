import { useEffect, useState } from 'react';
import { CloseIcon } from '@/components/icons';
import type { CheckoutProps } from '@/components/studio/design-studio';
import { cn } from '@/lib/utils';

export type ShopifyVariant = { id: number; title: string; available: boolean };

type Props = CheckoutProps & {
  variants: ShopifyVariant[];
  price: string;
  cartAddUrl: string;
};

/**
 * Añade la prenda personalizada al carrito de Shopify con el diseño adjunto.
 * Usa un formulario multipart a /cart/add (método oficial de Shopify para subir
 * archivos como propiedades de la línea): archivos y especificaciones quedan en el pedido.
 */
export function ShopifyAddToCart({ onClose, getAttachments, details, blockedReason, variants, price, cartAddUrl }: Props) {
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
      details.filter(([k]) => k !== 'Prenda').forEach(([k, v]) => field(`properties[${k}]`, v));
      if (notes.trim()) field('properties[Notas]', notes.trim().slice(0, 500));
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
              <p className="mt-2 text-xs text-tinta-500">Corte oversize: si prefieres un ajuste más clásico, elige una talla menos.</p>
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

            <ul className="mt-5 space-y-1 text-xs text-tinta-700">
              <li>✓ Tus archivos y especificaciones se adjuntan al pedido.</li>
              <li>✓ Antes de bordar te enviamos el boceto por email para que lo apruebes.</li>
            </ul>

            {error && <p className="mt-4 rounded-xl bg-hilo-100 px-4 py-3 text-sm text-hilo-600" role="alert">{error}</p>}

            <button type="button" onClick={submit} disabled={sending} className="btn-primary mt-6 w-full py-4 text-base">
              {sending ? 'Añadiendo…' : `Añadir al carrito · ${price}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
