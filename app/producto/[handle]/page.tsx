import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Faq } from '@/components/faq';
import { ArrowIcon, NeedleIcon, ShieldIcon, TruckIcon } from '@/components/icons';
import { ProductGrid } from '@/components/product-card';
import { Gallery } from '@/components/product/gallery';
import { ProductForm } from '@/components/product/product-form';
import { getProduct, getProducts, getRecommendations } from '@/lib/shopify';
import { site } from '@/lib/site';
import { FREE_SHIPPING_THRESHOLD, siteUrl } from '@/lib/utils';

export const revalidate = 3600;

export async function generateStaticParams() {
  const products = await getProducts({ first: 100 });
  return products.map((p) => ({ handle: p.handle }));
}

export async function generateMetadata({ params }: { params: { handle: string } }): Promise<Metadata> {
  const product = await getProduct(params.handle);
  if (!product) return {};
  const description = product.seo.description || product.description || `${product.title} — bordado premium de ${site.fullName}.`;
  return {
    title: product.seo.title || product.title,
    description,
    alternates: { canonical: `/producto/${product.handle}` },
    openGraph: product.featuredImage
      ? { images: [{ url: product.featuredImage.url, width: product.featuredImage.width, height: product.featuredImage.height }] }
      : undefined
  };
}

const details = [
  { q: 'Detalles del bordado', a: 'Bordado directo sobre la prenda con hilos de alta resistencia. Cada pieza se produce en nuestro taller y puede presentar ligeras variaciones que la hacen única.' },
  { q: 'Prenda y tallaje', a: 'Sudadera de corte oversize y gramaje alto. Si prefieres un ajuste más clásico, elige una talla menos de la habitual.' },
  { q: 'Envíos y devoluciones', a: `Envío a toda España con seguimiento. Gratis a partir de ${FREE_SHIPPING_THRESHOLD} €. Devoluciones en 30 días para prendas de colección.` },
  { q: 'Cuidados', a: 'Lavar del revés a 30 °C. No usar secadora. Planchar por el reverso, nunca sobre el bordado.' }
];

export default async function ProductPage({ params }: { params: { handle: string } }) {
  const product = await getProduct(params.handle);
  if (!product) notFound();
  const recommendations = await getRecommendations(product);
  const images = product.images.length ? product.images : product.featuredImage ? [product.featuredImage] : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    image: images.map((i) => i.url),
    brand: { '@type': 'Brand', name: site.name },
    offers: {
      '@type': 'AggregateOffer',
      url: `${siteUrl}/producto/${product.handle}`,
      priceCurrency: product.priceRange.minVariantPrice.currencyCode,
      lowPrice: product.priceRange.minVariantPrice.amount,
      highPrice: product.priceRange.maxVariantPrice.amount,
      availability: product.availableForSale ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
    }
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container-page pt-6">
        <nav aria-label="Migas" className="text-xs text-tinta-500">
          <Link href="/" className="hover:underline">Inicio</Link> / <Link href="/tienda" className="hover:underline">Colección</Link> / <span className="text-tinta">{product.title}</span>
        </nav>

        <div className="mt-6 grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
          <Gallery images={images} title={product.title} />

          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="eyebrow flex items-center gap-2"><NeedleIcon className="h-4 w-4 text-hilo" /> Bordado en taller</p>
            <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">{product.title}</h1>
            {product.description && <p className="mt-4 leading-relaxed text-tinta-700">{product.description}</p>}

            <div className="mt-8"><ProductForm product={product} /></div>

            <ul className="mt-6 space-y-2.5 text-sm">
              <li className="flex items-center gap-3"><TruckIcon className="h-5 w-5 text-bosque" /> Envío gratis a partir de {FREE_SHIPPING_THRESHOLD} €</li>
              <li className="flex items-center gap-3"><ShieldIcon className="h-5 w-5 text-bosque" /> Devolución 30 días · Pago seguro</li>
              <li className="flex items-center gap-3"><NeedleIcon className="h-5 w-5 text-bosque" /> Producción en {site.productionDays} días laborables</li>
            </ul>

            <Link href="/disena" className="mt-8 flex items-center justify-between gap-4 rounded-2xl bg-bosque-100 p-5 transition hover:bg-bosque/15">
              <div>
                <p className="font-semibold text-bosque">¿La quieres con tu propio diseño?</p>
                <p className="text-sm text-tinta-700">Boceto gratis en 48 h, desde 1 unidad.</p>
              </div>
              <ArrowIcon className="h-5 w-5 shrink-0 text-bosque" />
            </Link>

            <div className="mt-8"><Faq items={details} /></div>
          </div>
        </div>

        {recommendations.length > 0 && (
          <section className="mt-24">
            <h2 className="text-3xl">También te puede gustar</h2>
            <div className="mt-8"><ProductGrid products={recommendations} /></div>
          </section>
        )}
      </div>
    </>
  );
}
