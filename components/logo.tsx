import { cn } from '@/lib/utils';

/** Placeholder tipográfico hasta tener el logotipo definitivo (sustituir por SVG). */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-baseline gap-2', className)}>
      <span className="font-display text-2xl font-semibold tracking-tight">BR</span>
      <span className="hidden text-[10px] font-semibold uppercase tracking-[0.25em] text-tinta-500 sm:inline">
        Estudio de bordado
      </span>
    </span>
  );
}
