import { cn } from '@/lib/utils';

/**
 * Logo de BR (firma con estrella). Dos versiones con la misma forma (shopify-theme/marca/):
 * oscura para fondos claros y crema para fondos oscuros.
 */
export function Logo({ className, tone = 'oscuro' }: { className?: string; tone?: 'oscuro' | 'crema' }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/marca/br-logo-${tone}.png`} alt="BR" width={1713} height={871} className={cn('h-9 w-auto', className)} />
  );
}
