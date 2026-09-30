import { NextResponse } from 'next/server';
import { getCart } from '@/lib/shopify';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cart = await getCart();
  return NextResponse.json({ cart: cart ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}
