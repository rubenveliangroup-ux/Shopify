'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Product } from '@/lib/shopify/types';
import { cn, formatMoney } from '@/lib/utils';
import { useCart } from '../cart/cart-context';

const isDefault = (p: Product) =>
  p.options.length === 1 && p.options[0].values.length === 1 && p.options[0].values[0] === 'Default Title';

export function ProductForm({ product }: { product: Product }) {
  const { add, error } = useCart();
  const [adding, setAdding] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const firstAvailable = product.variants.find((v) => v.availableForSale) ?? product.variants[0];
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(firstAvailable?.selectedOptions.map((o) => [o.name, o.value]) ?? [])
  );

  const variant = useMemo(
    () => product.variants.find((v) => v.selectedOptions.every((o) => selected[o.name] === o.value)),
    [product.variants, selected]
  );

  // Barra fija de compra en móvil cuando el botón principal sale de pantalla.
  useEffect(() => {
    const el = buttonRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const isAvailable = (name: string, value: string) =>
    product.variants.some(
      (v) =>
        v.availableForSale &&
        v.selectedOptions.every((o) => (o.name === name ? o.value === value : selected[o.name] === o.value))
    );

  const price = variant?.price ?? product.priceRange.minVariantPrice;
  const compare = variant?.compareAtPrice;
  const available = Boolean(variant?.availableForSale);

  async function onAdd() {
    if (!variant) return;
    setAdding(true);
    await add({ merchandiseId: variant.id, quantity: 1 });
    setAdding(false);
  }

  const cta = !variant ? 'Elige una opción' : available ? 'Añadir al carrito' : 'Agotado temporalmente';

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <p className="text-2xl font-semibold">{formatMoney(price.amount, price.currencyCode)}</p>
        {compare && Number(compare.amount) > Number(price.amount) && (
          <p className="text-lg text-tinta-300 line-through">{formatMoney(compare.amount, compare.currencyCode)}</p>
        )}
        <p className="text-xs text-tinta-500">IVA incluido</p>
      </div>

      {!isDefault(product) &&
        product.options.map((option) => (
          <fieldset key={option.id} className="mt-6">
            <legend className="mb-2 text-sm font-medium">
              {option.name}: <span className="text-tinta-500">{selected[option.name]}</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const active = selected[option.name] === value;
                const ok = isAvailable(option.name, value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelected((s) => ({ ...s, [option.name]: value }))}
                    className={cn(
                      'min-w-12 rounded-full border px-4 py-2 text-sm transition',
                      active ? 'border-tinta bg-tinta text-lino' : 'border-tinta/20 hover:border-tinta',
                      !ok && 'text-tinta-300 line-through decoration-1'
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

      <button ref={buttonRef} onClick={onAdd} disabled={!available || adding} className="btn-primary mt-8 w-full py-4 text-base">
        {adding ? 'Añadiendo…' : cta}
      </button>
      {error && <p className="mt-2 text-sm text-hilo-600" role="alert">{error}</p>}

      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 border-t border-tinta/10 bg-lino-100/95 px-4 py-3 backdrop-blur transition-transform duration-300 lg:hidden',
          showSticky ? 'translate-y-0' : 'translate-y-full'
        )}
        aria-hidden={!showSticky}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{product.title}</p>
            <p className="text-sm font-semibold">{formatMoney(price.amount, price.currencyCode)}</p>
          </div>
          <button onClick={onAdd} disabled={!available || adding} tabIndex={showSticky ? 0 : -1} className="btn-primary px-5">
            {adding ? '…' : available ? 'Añadir' : 'Agotado'}
          </button>
        </div>
      </div>
    </div>
  );
}
