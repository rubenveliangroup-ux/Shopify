import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/lib/shopify/types';
import { formatMoney } from '@/lib/utils';

export function ProductCard({ product, priority }: { product: Product; priority?: boolean }) {
  const { featuredImage: img, images } = product;
  const hover = images[1];
  const price = product.priceRange.minVariantPrice;
  const compare = product.compareAtPriceRange.maxVariantPrice;
  const onSale = Number(compare.amount) > Number(price.amount);

  return (
    <Link href={`/producto/${product.handle}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-lino-200">
        {img && (
          <Image
            src={img.url}
            alt={img.altText ?? product.title}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition duration-700 group-hover:scale-[1.04]"
          />
        )}
        {hover && (
          <Image src={hover.url} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover opacity-0 transition duration-500 group-hover:opacity-100" />
        )}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {!product.availableForSale && <Badge className="bg-tinta text-lino">Bajo pedido</Badge>}
          {onSale && <Badge className="bg-hilo text-white">Oferta</Badge>}
        </div>
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <h3 className="font-sans text-sm font-medium leading-snug group-hover:underline group-hover:underline-offset-4">
          {product.title}
        </h3>
        <p className="shrink-0 text-sm">
          {onSale && <span className="mr-1.5 text-tinta-300 line-through">{formatMoney(compare.amount, compare.currencyCode)}</span>}
          <span className="font-semibold">{formatMoney(price.amount, price.currencyCode)}</span>
        </p>
      </div>
      <p className="mt-0.5 text-xs text-tinta-500">Bordado · Algodón premium</p>
    </Link>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>{children}</span>;
}

export function ProductGrid({ products, priorityCount = 0 }: { products: Product[]; priorityCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}
