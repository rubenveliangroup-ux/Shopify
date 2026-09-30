import { FREE_SHIPPING_THRESHOLD } from '@/lib/utils';
import { site } from '@/lib/site';

const items = [
  `Envío gratis a partir de ${FREE_SHIPPING_THRESHOLD} €`,
  `Bordado en nuestro taller · producción en ${site.productionDays} días`,
  'Boceto digital gratis antes de bordar',
  'Pago seguro · Devolución 30 días en colección'
];

export function AnnouncementBar() {
  return (
    <div className="overflow-hidden bg-tinta text-lino">
      <div className="flex w-max animate-marquee gap-12 py-2 text-xs tracking-wide motion-reduce:animate-none">
        {[...items, ...items].map((t, i) => (
          <span key={i} className="flex items-center gap-12 whitespace-nowrap" aria-hidden={i >= items.length}>
            {t} <span className="text-oro">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
