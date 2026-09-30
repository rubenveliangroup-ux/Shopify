'use server';

import { cookies } from 'next/headers';
import {
  CART_COOKIE,
  addToCart,
  createCart,
  removeFromCart,
  updateCart,
  type LineInput
} from '@/lib/shopify';
import type { Cart } from '@/lib/shopify/types';

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 30
};

export type CartResult = { ok: true; cart: Cart } | { ok: false; message: string };

export async function addItem(input: {
  merchandiseId: string;
  quantity?: number;
  note?: string;
}): Promise<CartResult> {
  if (!input.merchandiseId) return { ok: false, message: 'Selecciona una opción' };
  const quantity = Math.max(1, Math.min(50, Math.floor(input.quantity ?? 1)));
  const note = input.note?.trim().slice(0, 250);
  const line: LineInput = {
    merchandiseId: input.merchandiseId,
    quantity,
    attributes: note ? [{ key: 'Personalización', value: note }] : []
  };

  try {
    const cartId = cookies().get(CART_COOKIE)?.value;
    let cart: Cart | undefined;
    if (cartId) {
      // Un carrito caducado o ya pagado falla: en ese caso creamos uno nuevo.
      cart = await addToCart(cartId, [line]).catch(() => undefined);
    }
    cart ??= await createCart([line]);
    cookies().set(CART_COOKIE, cart.id, cookieOpts);
    return { ok: true, cart };
  } catch (e) {
    console.error('[cart] addItem', e);
    return { ok: false, message: 'No hemos podido añadirlo. Inténtalo de nuevo.' };
  }
}

export async function updateItemQuantity(lineId: string, quantity: number): Promise<CartResult> {
  const cartId = cookies().get(CART_COOKIE)?.value;
  if (!cartId) return { ok: false, message: 'Carrito no encontrado' };
  try {
    const cart =
      quantity <= 0
        ? await removeFromCart(cartId, [lineId])
        : await updateCart(cartId, [{ id: lineId, quantity: Math.min(50, quantity) }]);
    return { ok: true, cart };
  } catch (e) {
    console.error('[cart] update', e);
    return { ok: false, message: 'No hemos podido actualizar el carrito.' };
  }
}
