'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { FREE_SHIPPING_THRESHOLD, cn, formatMoney } from '@/lib/utils';
import { BagIcon, CloseIcon, ShieldIcon } from '../icons';
import { useCart } from './cart-context';

export function CartDrawer() {
  const { cart, open, setOpen, setQuantity, pending, error } = useCart();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, setOpen]);

  if (!open) return null;

  const lines = cart?.lines ?? [];
  const subtotal = Number(cart?.cost.subtotalAmount.amount ?? 0);
  const currency = cart?.cost.subtotalAmount.currencyCode ?? 'EUR';
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Carrito">
      <button aria-label="Cerrar carrito" className="absolute inset-0 bg-tinta/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <div ref={panel} tabIndex={-1} className="absolute right-0 top-0 flex h-full w-full max-w-md animate-slide-in flex-col bg-lino-100 shadow-2xl outline-none">
        <div className="flex items-center justify-between border-b border-tinta/10 px-5 py-4">
          <p className="font-display text-xl">Tu carrito</p>
          <button onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded-full p-2 hover:bg-lino-200">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {lines.length > 0 && (
          <div className="border-b border-tinta/10 px-5 py-3">
            <p className="text-sm">
              {remaining > 0 ? (
                <>Te faltan <strong>{formatMoney(remaining, currency)}</strong> para el <strong>envío gratis</strong></>
              ) : (
                <>🎉 Tienes <strong>envío gratis</strong></>
              )}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-lino-300">
              <div className="h-full rounded-full bg-bosque transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className={cn('flex-1 overflow-y-auto px-5', pending && 'opacity-70')}>
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <BagIcon className="h-10 w-10 text-tinta-300" />
              <p className="font-display text-lg">Aún no hay nada bordado aquí</p>
              <Link href="/tienda" onClick={() => setOpen(false)} className="btn-dark">Ver la colección</Link>
              <Link href="/disena" onClick={() => setOpen(false)} className="text-sm underline underline-offset-4">o crea tu propio diseño</Link>
            </div>
          ) : (
            <ul className="divide-y divide-tinta/10">
              {lines.map((line) => {
                const img = line.merchandise.product.featuredImage;
                const opts = line.merchandise.selectedOptions.filter((o) => o.value !== 'Default Title');
                return (
                  <li key={line.id} className="flex gap-4 py-5">
                    <Link href={`/producto/${line.merchandise.product.handle}`} onClick={() => setOpen(false)} className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-lino-200">
                      {img && <Image src={img.url} alt={img.altText ?? ''} fill sizes="80px" className="object-cover" />}
                    </Link>
                    <div className="flex flex-1 flex-col">
                      <div className="flex justify-between gap-3">
                        <p className="text-sm font-medium leading-snug">{line.merchandise.product.title}</p>
                        <p className="text-sm font-semibold">{formatMoney(line.cost.totalAmount.amount, line.cost.totalAmount.currencyCode)}</p>
                      </div>
                      {opts.length > 0 && <p className="mt-0.5 text-xs text-tinta-500">{opts.map((o) => o.value).join(' / ')}</p>}
                      {line.attributes.map((a) => (
                        <p key={a.key} className="mt-0.5 text-xs text-tinta-500">{a.key}: {a.value}</p>
                      ))}
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div className="flex items-center rounded-full border border-tinta/15">
                          <button aria-label="Quitar uno" className="px-3 py-1" onClick={() => setQuantity(line.id, line.quantity - 1)}>−</button>
                          <span className="w-6 text-center text-sm tabular-nums">{line.quantity}</span>
                          <button aria-label="Añadir uno" className="px-3 py-1" onClick={() => setQuantity(line.id, line.quantity + 1)}>+</button>
                        </div>
                        <button className="text-xs text-tinta-500 underline underline-offset-4" onClick={() => setQuantity(line.id, 0)}>Eliminar</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {lines.length > 0 && cart && (
          <div className="border-t border-tinta/10 bg-lino px-5 py-5">
            {error && <p className="mb-3 text-sm text-hilo-600">{error}</p>}
            <div className="flex justify-between text-base">
              <span>Subtotal</span>
              <span className="font-semibold">{formatMoney(cart.cost.subtotalAmount.amount, currency)}</span>
            </div>
            <p className="mt-1 text-xs text-tinta-500">Impuestos incluidos. Envío calculado en el checkout.</p>
            <a href={cart.checkoutUrl} className="btn-primary mt-4 w-full py-4 text-base">
              Finalizar compra
            </a>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-tinta-500">
              <ShieldIcon className="h-4 w-4" /> Pago 100% seguro con Shopify Checkout
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
