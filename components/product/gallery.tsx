'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { Image as Img } from '@/lib/shopify/types';
import { cn } from '@/lib/utils';

export function Gallery({ images, title }: { images: Img[]; title: string }) {
  const [active, setActive] = useState(0);
  const current = images[active];

  return (
    <div className="flex flex-col-reverse gap-3 lg:flex-row">
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto lg:flex-col" role="tablist" aria-label="Imágenes">
          {images.map((img, i) => (
            <button
              key={img.url}
              role="tab"
              aria-selected={i === active}
              aria-label={`Imagen ${i + 1}`}
              onClick={() => setActive(i)}
              className={cn(
                'relative h-20 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-lino-200',
                i === active ? 'border-tinta' : 'border-transparent opacity-70 hover:opacity-100'
              )}
            >
              <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
      <div className="relative aspect-[4/5] flex-1 overflow-hidden rounded-3xl bg-lino-200">
        {current && (
          <Image
            src={current.url}
            alt={current.altText ?? title}
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover"
          />
        )}
      </div>
    </div>
  );
}
