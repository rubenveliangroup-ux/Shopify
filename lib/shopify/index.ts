import 'server-only';
import { cookies } from 'next/headers';
import { fallbackProducts } from './fallback';
import {
  addToCartMutation,
  createCartMutation,
  getCartQuery,
  getCollectionProductsQuery,
  getProductQuery,
  getProductsQuery,
  getRecommendationsQuery,
  removeFromCartMutation,
  updateCartMutation
} from './queries';
import type { Cart, Collection, Connection, Image, Product } from './types';

const domain = process.env.SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/$/, '');
const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const apiVersion = process.env.SHOPIFY_API_VERSION ?? '2025-07';
const endpoint = domain ? `https://${domain}/api/${apiVersion}/graphql.json` : '';

export const TAGS = { products: 'products', collections: 'collections', cart: 'cart' } as const;
export const CART_COOKIE = 'br_cart';

export const isShopifyConfigured = Boolean(domain && token);

type FetchOptions = {
  query: string;
  variables?: Record<string, unknown>;
  tags?: string[];
  cache?: RequestCache;
};

export async function shopifyFetch<T>({ query, variables, tags, cache = 'force-cache' }: FetchOptions): Promise<T> {
  if (!isShopifyConfigured) throw new Error('Shopify Storefront API no configurada');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token!
    },
    body: JSON.stringify({ query, variables }),
    cache,
    ...(tags && { next: { tags } })
  });

  const body = await res.json();
  if (!res.ok || body.errors) {
    throw new Error(`Shopify ${res.status}: ${JSON.stringify(body.errors ?? body)}`);
  }
  return body.data as T;
}

/** Lecturas de catálogo: si Shopify falla, servimos el snapshot para no romper la tienda. */
async function withFallback<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error('[shopify] usando catálogo de respaldo:', (e as Error).message);
    return fallback();
  }
}

const flatten = <T>(c: Connection<T>) => c.edges.map((e) => e.node);

type RawProduct = Omit<Product, 'images' | 'variants' | 'options'> & {
  options: { id: string; name: string; optionValues: { name: string }[] }[];
  images: Connection<Image>;
  variants: Connection<Product['variants'][number]>;
};

const reshapeProduct = (p: RawProduct): Product => ({
  ...p,
  options: p.options.map((o) => ({ id: o.id, name: o.name, values: o.optionValues.map((v) => v.name) })),
  images: flatten(p.images),
  variants: flatten(p.variants)
});

// ---------- Catálogo ----------

export type SortKey = 'BEST_SELLING' | 'CREATED_AT' | 'PRICE' | 'RELEVANCE';

export async function getProducts({
  first = 48,
  sortKey = 'BEST_SELLING',
  reverse = false,
  query
}: { first?: number; sortKey?: SortKey; reverse?: boolean; query?: string } = {}): Promise<Product[]> {
  return withFallback(
    async () => {
      const data = await shopifyFetch<{ products: Connection<RawProduct> }>({
        query: getProductsQuery,
        variables: { first, sortKey, reverse, query },
        tags: [TAGS.products]
      });
      return flatten(data.products).map(reshapeProduct);
    },
    () => {
      const q = query?.toLowerCase();
      const list = q ? fallbackProducts.filter((p) => p.title.toLowerCase().includes(q)) : fallbackProducts;
      return list.slice(0, first);
    }
  );
}

export async function getProduct(handle: string): Promise<Product | undefined> {
  return withFallback(
    async () => {
      const data = await shopifyFetch<{ product: RawProduct | null }>({
        query: getProductQuery,
        variables: { handle },
        tags: [TAGS.products]
      });
      return data.product ? reshapeProduct(data.product) : undefined;
    },
    () => fallbackProducts.find((p) => p.handle === handle)
  );
}

export async function getRecommendations(product: Product): Promise<Product[]> {
  return withFallback(
    async () => {
      const data = await shopifyFetch<{ productRecommendations: RawProduct[] }>({
        query: getRecommendationsQuery,
        variables: { productId: product.id },
        tags: [TAGS.products]
      });
      return data.productRecommendations.map(reshapeProduct);
    },
    () => fallbackProducts.filter((p) => p.handle !== product.handle)
  ).then((list) => list.filter((p) => p.handle !== product.handle).slice(0, 4));
}

export async function getCollection(
  handle: string,
  first = 24
): Promise<{ collection: Collection; products: Product[] } | undefined> {
  return withFallback(
    async () => {
      const data = await shopifyFetch<{
        collection: (Collection & { products: Connection<RawProduct> }) | null;
      }>({ query: getCollectionProductsQuery, variables: { handle, first }, tags: [TAGS.collections] });
      if (!data.collection) return undefined;
      const { products, ...collection } = data.collection;
      return { collection, products: flatten(products).map(reshapeProduct) };
    },
    () => undefined
  );
}

// ---------- Carrito (sin fallback: siempre contra Shopify) ----------

type RawCart = Omit<Cart, 'lines'> & { lines: Connection<Cart['lines'][number]> };
const reshapeCart = (c: RawCart): Cart => ({ ...c, lines: flatten(c.lines) });

export async function getCart(): Promise<Cart | undefined> {
  const cartId = cookies().get(CART_COOKIE)?.value;
  if (!cartId || !isShopifyConfigured) return undefined;
  try {
    const data = await shopifyFetch<{ cart: RawCart | null }>({
      query: getCartQuery,
      variables: { cartId },
      tags: [TAGS.cart],
      cache: 'no-store'
    });
    return data.cart ? reshapeCart(data.cart) : undefined;
  } catch (e) {
    console.error('[shopify] getCart', e);
    return undefined;
  }
}

export type LineInput = {
  merchandiseId: string;
  quantity: number;
  attributes?: { key: string; value: string }[];
};

type Payload = { cart: RawCart | null; userErrors: { message: string }[] };

function unwrap(p: Payload): Cart {
  if (p.userErrors.length) throw new Error(p.userErrors.map((e) => e.message).join(', '));
  if (!p.cart) throw new Error('Carrito no disponible');
  return reshapeCart(p.cart);
}

export async function createCart(lines: LineInput[]) {
  const d = await shopifyFetch<{ cartCreate: Payload }>({
    query: createCartMutation,
    variables: { lines },
    cache: 'no-store'
  });
  return unwrap(d.cartCreate);
}

export async function addToCart(cartId: string, lines: LineInput[]) {
  const d = await shopifyFetch<{ cartLinesAdd: Payload }>({
    query: addToCartMutation,
    variables: { cartId, lines },
    cache: 'no-store'
  });
  return unwrap(d.cartLinesAdd);
}

export async function updateCart(cartId: string, lines: { id: string; quantity: number }[]) {
  const d = await shopifyFetch<{ cartLinesUpdate: Payload }>({
    query: updateCartMutation,
    variables: { cartId, lines },
    cache: 'no-store'
  });
  return unwrap(d.cartLinesUpdate);
}

export async function removeFromCart(cartId: string, lineIds: string[]) {
  const d = await shopifyFetch<{ cartLinesRemove: Payload }>({
    query: removeFromCartMutation,
    variables: { cartId, lineIds },
    cache: 'no-store'
  });
  return unwrap(d.cartLinesRemove);
}
