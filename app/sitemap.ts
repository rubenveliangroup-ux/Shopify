import type { MetadataRoute } from 'next';
import { getProducts } from '@/lib/shopify';
import { siteUrl } from '@/lib/utils';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts({ first: 250 });
  const pages = ['', '/tienda', '/disena', '/personaliza', '/marcas'].map((p) => ({ url: `${siteUrl}${p}`, lastModified: new Date() }));
  return [...pages, ...products.map((p) => ({ url: `${siteUrl}/producto/${p.handle}`, lastModified: new Date(p.updatedAt) }))];
}
