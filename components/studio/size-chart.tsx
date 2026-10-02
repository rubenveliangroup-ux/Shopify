'use client';

/** Medidas por talla (cm, prenda plana). Fuente única: snippet br-medidas.liquid del tema. */
export type SizeChartData = {
  nota?: string;
  imagen?: string | null;
  filas: { talla: string; largo: number; pecho: number; bajo: number; manga: number }[];
};

/** Tabla de medidas desplegable junto al selector de talla. */
export function SizeChart({ data, highlight }: { data: SizeChartData; highlight?: string }) {
  if (!data?.filas?.length) return null;
  return (
    <details className="group mt-3 rounded-2xl border border-tinta/15 bg-lino">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        Ver medidas (cm)
        <span className="text-lg transition group-open:rotate-45" aria-hidden>+</span>
      </summary>
      <div className="px-4 pb-4">
        <div className="overflow-x-auto rounded-xl border border-tinta/10" role="region" aria-label="Tabla de medidas" tabIndex={0}>
          <table className="w-full min-w-[340px] border-collapse text-center text-sm tabular-nums">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-tinta-500">
                <th className="px-2 py-2">Talla</th>
                <th className="px-2 py-2">Largo total</th>
                <th className="px-2 py-2">Ancho pecho</th>
                <th className="px-2 py-2">Bajo relajado</th>
                <th className="px-2 py-2">Largo manga</th>
              </tr>
            </thead>
            <tbody>
              {data.filas.map((f) => (
                <tr key={f.talla} className={f.talla === highlight ? 'bg-hilo-100 font-semibold' : 'border-t border-tinta/10'}>
                  <th className="px-2 py-2">{f.talla}</th>
                  <td className="px-2 py-2">{f.largo}</td>
                  <td className="px-2 py-2">{f.pecho}</td>
                  <td className="px-2 py-2">{f.bajo}</td>
                  <td className="px-2 py-2">{f.manga}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.nota && <p className="mt-2 text-xs text-tinta-500">{data.nota}</p>}
        {data.imagen && (
          <a
            href={data.imagen}
            target="_blank"
            rel="noopener"
            aria-label="Ampliar el dibujo de cómo se mide"
            className="relative mx-auto mt-3 block max-w-[280px] overflow-hidden rounded-xl bg-white"
            style={{ touchAction: 'pinch-zoom' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- se usa también en el tema de Shopify, sin next/image */}
            <img src={data.imagen} alt="Cómo se mide cada talla (prenda en plano)" className="block h-auto w-full" loading="lazy" width={992} height={1016} />
            <span className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2.5 py-1 text-xs text-white">Toca para ampliar</span>
          </a>
        )}
      </div>
    </details>
  );
}
