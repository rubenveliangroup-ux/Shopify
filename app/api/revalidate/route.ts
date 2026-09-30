import { createHmac, timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { TAGS } from '@/lib/shopify';

/**
 * Webhook de Shopify (products/*, collections/*) -> invalida la caché ISR.
 * Configurar en Shopify Admin > Configuración > Notificaciones > Webhooks,
 * apuntando a https://<dominio>/api/revalidate. El secreto es la clave de firma
 * de webhooks que muestra Shopify en esa misma pantalla.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SHOPIFY_REVALIDATION_SECRET;
  const raw = await req.text();
  const hmac = req.headers.get('x-shopify-hmac-sha256') ?? '';

  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 500 });
  const digest = createHmac('sha256', secret).update(raw, 'utf8').digest('base64');
  const valid =
    digest.length === hmac.length && timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
  if (!valid) return NextResponse.json({ error: 'invalid signature' }, { status: 401 });

  const topic = req.headers.get('x-shopify-topic') ?? '';
  if (topic.startsWith('collections/')) revalidateTag(TAGS.collections);
  if (topic.startsWith('products/')) {
    revalidateTag(TAGS.products);
    revalidateTag(TAGS.collections);
  }
  return NextResponse.json({ revalidated: true, topic, now: Date.now() });
}
