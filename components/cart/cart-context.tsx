'use client';

import { createContext, useCallback, useContext, useEffect, useState, useTransition } from 'react';
import type { Cart } from '@/lib/shopify/types';
import { addItem, updateItemQuantity } from './actions';
import { CartDrawer } from './cart-drawer';

type Ctx = {
  cart: Cart | null;
  open: boolean;
  pending: boolean;
  error: string | null;
  setOpen: (v: boolean) => void;
  add: (input: { merchandiseId: string; quantity?: number; note?: string }) => Promise<boolean>;
  setQuantity: (lineId: string, quantity: number) => void;
};

const CartContext = createContext<Ctx | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart fuera de CartProvider');
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Las páginas son estáticas (ISR); el carrito se hidrata en cliente.
  useEffect(() => {
    fetch('/api/cart')
      .then((r) => r.json())
      .then((d) => setCart(d.cart))
      .catch(() => {});
  }, []);

  const add: Ctx['add'] = useCallback(async (input) => {
    setError(null);
    const res = await addItem(input);
    if (!res.ok) {
      setError(res.message);
      return false;
    }
    setCart(res.cart);
    setOpen(true);
    return true;
  }, []);

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    setError(null);
    // Optimista: la UI responde al instante; el servidor confirma.
    setCart((c) =>
      c && {
        ...c,
        lines: c.lines
          .map((l) => (l.id === lineId ? { ...l, quantity } : l))
          .filter((l) => l.quantity > 0)
      }
    );
    startTransition(async () => {
      const res = await updateItemQuantity(lineId, quantity);
      if (res.ok) setCart(res.cart);
      else setError(res.message);
    });
  }, []);

  return (
    <CartContext.Provider value={{ cart, open, pending, error, setOpen, add, setQuantity }}>
      {children}
      <CartDrawer />
    </CartContext.Provider>
  );
}
