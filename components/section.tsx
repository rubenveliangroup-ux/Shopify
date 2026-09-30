import { cn } from '@/lib/utils';

export function SectionHeading({ eyebrow, title, text, className, align = 'left' }: {
  eyebrow?: string; title: React.ReactNode; text?: React.ReactNode; className?: string; align?: 'left' | 'center';
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mt-3 text-3xl leading-[1.1] sm:text-4xl lg:text-5xl">{title}</h2>
      {text && <p className="mt-4 text-base leading-relaxed text-tinta-700">{text}</p>}
    </div>
  );
}
