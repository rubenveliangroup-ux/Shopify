import type { Product } from './types';

/**
 * Snapshot del catálogo real (septiembre 2026). Solo se usa si la Storefront API
 * no está configurada o no responde (build en CI sin red, desarrollo offline).
 * Nunca sustituye al carrito: las mutaciones siempre van contra Shopify.
 */
const CDN = 'https://cdn.shopify.com/s/files/1/1081/3882/4025/files/';

const seed: [id: string, variantId: string, handle: string, title: string, img: string, story: string][] = [
  ['16609989427545', '59423023726937', 'sudadera-oversize-torre-de-hercules', 'Sudadera oversize Torre de Hércules', 'ChatGPT_Image_14_sept_2026_20_24_09.png?v=1789410282', 'El faro romano más antiguo en funcionamiento, bordado puntada a puntada.'],
  ['16610001355097', '59423057379673', 'sudadera-oversize-pulpo', 'Sudadera oversize Pulpo', 'ChatGPT_Image_14_sept_2026_20_29_48.png?v=1789410606', 'Un clásico de feria convertido en pieza de streetwear.'],
  ['16610005975385', '59423062720857', 'sudadera-oversize-islas-cies', 'Sudadera oversize Islas Ciés', 'ChatGPTImage10sept2026_21_37_07.png?v=1789405987', 'Arena blanca y Atlántico en relieve de hilo.'],
  ['16610019246425', '59423086117209', 'sudadera-oversize-horreo', 'Sudadera oversize Hórreo', 'ChatGPTImage10sept2026_21_43_23.png?v=1789406150', 'Arquitectura popular gallega, reinterpretada en bordado.'],
  ['16610057683289', '59423288197465', 'sudadera-oversize-catedral-de-santiago', 'Sudadera oversize Catedral de Santiago', 'ChatGPT_Image_14_sept_2026_20_22_10.png?v=1789410154', 'La fachada del Obradoiro, a la altura del pecho.'],
  ['16610197406041', '59425403699545', 'sudadera-oversize-bo-camino', 'Sudadera oversize Bo camiño', 'ChatGPTImage14sept2026_20_33_04.png?v=1789410823', 'Para quien lleva el Camino puesto.']
];

export const fallbackProducts: Product[] = seed.map(([id, variantId, handle, title, img, story]) => {
  const price = { amount: '49.9', currencyCode: 'EUR' };
  const image = { url: CDN + img, altText: title, width: 1024, height: 1024 };
  return {
    id: `gid://shopify/Product/${id}`,
    handle,
    title,
    description: story,
    descriptionHtml: `<p>${story}</p>`,
    productType: 'Sudadera',
    tags: ['galicia'],
    availableForSale: true,
    options: [{ id: 'opt', name: 'Title', values: ['Default Title'] }],
    priceRange: { minVariantPrice: price, maxVariantPrice: price },
    compareAtPriceRange: { maxVariantPrice: { amount: '0', currencyCode: 'EUR' } },
    featuredImage: image,
    images: [image],
    variants: [
      {
        id: `gid://shopify/ProductVariant/${variantId}`,
        title: 'Default Title',
        availableForSale: true,
        selectedOptions: [{ name: 'Title', value: 'Default Title' }],
        price,
        compareAtPrice: null
      }
    ],
    seo: { title: null, description: null },
    updatedAt: '2026-09-30T15:00:59Z'
  };
});
