export type QA = { q: string; a: string };

export function Faq({ items, id }: { items: QA[]; id?: string }) {
  return (
    <div id={id} className="divide-y divide-tinta/10 border-y border-tinta/10">
      {items.map((it) => (
        <details key={it.q} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left font-medium [&::-webkit-details-marker]:hidden">
            {it.q}
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-tinta/20 transition group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-tinta-700">{it.a}</p>
        </details>
      ))}
    </div>
  );
}

export function faqJsonLd(items: QA[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } }))
  };
}
