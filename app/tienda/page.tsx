import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid } from '@/components/product-card';
import { getProducts, type SortKey } from '@/lib/shopify';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Colección bordada',
  description: 'Sudaderas oversize y prendas premium con bordado de diseño propio. Envío a toda España.'
};

const sorts: { slug: string; label: string; sortKey: SortKey; reverse?: boolean }[] = [
  { slug: 'destacados', label: 'Destacados', sortKey: 'BEST_SELLING' },
  { slug: 'novedades', label: 'Novedades', sortKey: 'CREATED_AT', reverse: true },
  { slug: 'precio-asc', label: 'Precio ↑', sortKey: 'PRICE' },
  { slug: 'precio-desc', label: 'Precio ↓', sortKey: 'PRICE', reverse: true }
];

export default async function ShopPage({ searchParams }: { searchParams: { orden?: string } }) {
  const sort = sorts.find((s) => s.slug === searchParams.orden) ?? sorts[0];
  const products = await getProducts({ sortKey: sort.sortKey, reverse: sort.reverse });

  return (
    <div className="container-page pt-12">
      <p className="eyebrow">Colección</p>
      <h1 className="mt-3 text-4xl sm:text-5xl">Prendas bordadas</h1>
      <p className="mt-3 max-w-xl text-tinta-700">
        Diseños propios del estudio, bordados sobre prendas premium. ¿Quieres el tuyo?{' '}
        <Link href="/personaliza" className="font-semibold text-hilo underline underline-offset-4">Créalo aquí</Link>.
      </p>

      <div className="mt-10 flex items-center justify-between gap-4 border-b border-tinta/10 pb-4">
        <p className="text-sm text-tinta-500">{products.length} productos</p>
        <nav className="flex gap-1 overflow-x-auto" aria-label="Ordenar">
          {sorts.map((s) => (
            <Link
              key={s.slug}
              href={s.slug === 'destacados' ? '/tienda' : `/tienda?orden=${s.slug}`}
              scroll={false}
              className={cn('whitespace-nowrap rounded-full px-3 py-1.5 text-sm', s === sort ? 'bg-tinta text-lino' : 'hover:bg-lino-200')}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-10"><ProductGrid products={products} priorityCount={4} /></div>
    </div>
  );
}
