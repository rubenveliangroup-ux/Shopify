'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { hexToLab } from '../color/color-math';
import { nearestThread, threadLabel, type Thread } from '../color/threads';
import type { Side } from './config';
import { unionColors, type ColorStat, type DesignAnalysis } from './embroidery-estimate';
import { fmtEur, fmtInt, formulaTierPrice, quote, round2, type EmbroideryPricing, type Quote } from './embroidery-pricing';

export type EmbroideryEstimate = {
  perSide: Record<Side, DesignAnalysis | null>;
  /** Puntadas estimadas con margen de seguridad (las que deciden el tramo). */
  stitches: number;
  rawStitches: number;
  colors: ColorStat[];
  quote: Quote;
  warnings: string[];
};

const sideLabel: Record<Side, string> = { delante: 'delante', detras: 'detrás' };

/** Asigna a cada color su hilo real más cercano; dos colores con el mismo hilo cuentan como uno. */
export function mapToThreads(colors: ColorStat[], threads: Thread[]): ColorStat[] {
  const byThread = new Map<string, ColorStat>();
  for (const c of colors) {
    const t = nearestThread(c.hex, threads);
    const key = `${t.code}|${t.hex}`;
    const prev = byThread.get(key);
    if (prev) {
      prev.areaCm2 += c.areaCm2;
      prev.share += c.share;
    } else byThread.set(key, { hex: t.hex, lab: hexToLab(t.hex), areaCm2: c.areaCm2, share: c.share, thread: t });
  }
  return [...byThread.values()].sort((a, b) => b.share - a.share);
}

/** Combina delante + detrás: puntadas sumadas y paleta de hilos común. */
export function buildEstimate(p: EmbroideryPricing, perSide: Record<Side, DesignAnalysis | null>, threads?: Thread[]): EmbroideryEstimate {
  const used = (Object.keys(perSide) as Side[]).filter((s) => perSide[s]);
  const rawStitches = used.reduce((a, s) => a + perSide[s]!.rawStitches, 0);
  const stitches = Math.round(rawStitches * (1 + p.margenSeguridad));
  const union = unionColors(used.map((s) => perSide[s]!.colors));
  const colors = threads?.length ? mapToThreads(union, threads) : union;
  const warnings: string[] = [];
  for (const s of used) {
    const a = perSide[s]!;
    if (a.tooSmall)
      warnings.push(`El diseño de ${sideLabel[s]} es muy pequeño (≈ ${a.widthCm.toFixed(1)} × ${a.heightCm.toFixed(1)} cm): los detalles podrían no apreciarse bordados.`);
    if (a.whiteBackgroundRemoved)
      warnings.push(`No contamos el fondo blanco de tu imagen (${sideLabel[s]}) como bordado. Si quieres ese blanco bordado, indícalo en las notas.`);
    if (a.thinLines)
      warnings.push(`El diseño de ${sideLabel[s]} tiene líneas de menos de ${p.grosorMinimoMm} mm: son demasiado finas para bordar y tendremos que engrosarlas o simplificarlas.`);
  }
  return { perSide, stitches, rawStitches, colors, quote: quote(p, stitches, colors.length), warnings };
}

export function EmbroideryPanel({
  pricing,
  estimate,
  busy,
  calibrate
}: {
  pricing: EmbroideryPricing;
  estimate: EmbroideryEstimate | null;
  busy: boolean;
  calibrate: boolean;
}) {
  const q = estimate?.quote ?? { kind: 'empty' as const };

  return (
    <div className="rounded-2xl bg-lino p-4 ring-1 ring-tinta/10" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Extra de bordado</p>
        {busy && <span className="text-xs text-tinta-500">Calculando…</span>}
      </div>

      {q.kind === 'empty' ? (
        <p className="mt-2 text-sm text-tinta-500">Sube o coloca tu diseño y calcularemos aquí el precio del bordado.</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Puntadas aprox." value={`≈ ${fmtInt(estimate!.stitches)}`} />
            <Stat
              label="Hilos"
              value={estimate!.colors.length > pricing.maxColores ? `+${pricing.maxColores}` : `${estimate!.colors.length}/${pricing.maxColores}`}
              warn={estimate!.colors.length > pricing.maxColores}
            />
            <Stat label="Tramo" value={q.kind === 'priced' ? String(q.tierIndex + 1) : '—'} />
          </dl>

          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Colores detectados">
            {estimate!.colors.map((c) => (
              <span
                key={c.hex}
                title={`${c.thread ? threadLabel(c.thread) + ' · ' : ''}${c.hex} · ${(c.share * 100).toFixed(0)} %`}
                className="h-6 w-6 rounded-full ring-1 ring-tinta/20"
                style={{ background: c.hex }}
              />
            ))}
          </div>

          {q.kind === 'priced' && (
            <dl className="mt-3 space-y-1 border-t border-tinta/10 pt-3 text-sm">
              <Row label={q.tierLabel} value={fmtEur(q.tierPrice)} />
              <Row
                label={q.extraColors ? `${q.extraColors} color${q.extraColors > 1 ? 'es' : ''} adicional${q.extraColors > 1 ? 'es' : ''} × ${fmtEur(q.colorUnitPrice)}` : 'Colores adicionales'}
                value={fmtEur(q.colorsPrice)}
              />
              <Row label="Extra de bordado" value={fmtEur(q.total)} strong />
            </dl>
          )}
          {q.kind === 'too-many-colors' && (
            <p className="mt-3 rounded-xl bg-hilo-100 px-3 py-2 text-sm text-hilo-600">
              Tu diseño tiene más de {q.max} colores y nuestra máquina borda como máximo {q.max}. Simplifica los colores del diseño (o usa
              «Envíanos tu diseño» y lo vemos contigo).
            </p>
          )}
          {q.kind === 'quote-required' && (
            <p className="mt-3 rounded-xl bg-oro-100 px-3 py-2 text-sm">
              Diseño sujeto a presupuesto: supera las {fmtInt(pricing.tramos[pricing.tramos.length - 1])} puntadas. Puedes enviarnos la consulta
              sin pagar el extra y te diremos el precio antes de producir.
            </p>
          )}

          {estimate!.warnings.map((w) => (
            <p key={w} className="mt-2 rounded-xl bg-oro-100 px-3 py-2 text-xs">⚠︎ {w}</p>
          ))}

          <p className="mt-3 text-xs text-tinta-500">
            Estimación sujeta a revisión antes de producir. Si el diseño necesita otro tramo, te avisaremos antes de empezar.
          </p>
        </>
      )}

      {calibrate && <Calibration pricing={pricing} estimate={estimate} />}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn('rounded-xl bg-lino-100 px-2 py-2', warn && 'bg-hilo-100 text-hilo-600')}>
      <dd className="text-base font-semibold tabular-nums">{value}</dd>
      <dt className="text-[11px] text-tinta-500">{label}</dt>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-3', strong && 'border-t border-tinta/10 pt-1 font-semibold')}>
      <dt className={cn(!strong && 'text-tinta-700')}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

// ------------------------------------------------------------------ calibración

type Sample = { name: string; real: number; areaCm2: number; edgeCm: number };
const CAL_KEY = 'br-calibracion-bordado';

/**
 * Modo calibración (?calibrar=1): coloca un diseño real al tamaño real con el que se bordó,
 * escribe las puntadas que dio el software de picaje y guárdalo. Con 3-4 muestras, la
 * mediana de «puntadas por cm²» es el valor a poner en la configuración.
 */
function Calibration({ pricing, estimate }: { pricing: EmbroideryPricing; estimate: EmbroideryEstimate | null }) {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [name, setName] = useState('');
  const [real, setReal] = useState('');

  useEffect(() => {
    try {
      setSamples(JSON.parse(localStorage.getItem(CAL_KEY) || '[]'));
    } catch {
      setSamples([]);
    }
  }, []);
  const save = (s: Sample[]) => {
    setSamples(s);
    try {
      localStorage.setItem(CAL_KEY, JSON.stringify(s));
    } catch {
      /* sin almacenamiento: la tabla solo dura esta sesión */
    }
  };

  const sides = estimate ? (Object.values(estimate.perSide).filter(Boolean) as DesignAnalysis[]) : [];
  const areaCm2 = sides.reduce((a, s) => a + s.areaCm2, 0);
  const edgeCm = sides.reduce((a, s) => a + s.edgeCm, 0);
  const implied = (s: Sample) => (s.real - s.edgeCm * pricing.puntadasPorCmBorde) / s.areaCm2;
  const values = samples.map(implied).sort((a, b) => a - b);
  const median = values.length ? values[Math.floor((values.length - 1) / 2)] : null;

  return (
    <div className="mt-4 space-y-3 border-t border-dashed border-tinta/30 pt-4 text-xs">
      <p className="font-semibold uppercase tracking-wider text-hilo">Modo calibración</p>
      <p>
        Diseño actual: área bordada <b>{areaCm2.toFixed(1)} cm²</b> · contorno <b>{edgeCm.toFixed(1)} cm</b> · puntadas sin margen{' '}
        <b>{fmtInt(estimate?.rawStitches ?? 0)}</b> (con {pricing.puntadasPorCm2} pt/cm² y {pricing.puntadasPorCmBorde} pt/cm de borde).
      </p>
      <div className="flex flex-wrap gap-2">
        <input className="field !py-1.5 !text-xs" style={{ maxWidth: 160 }} placeholder="Nombre del diseño" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="field !py-1.5 !text-xs" style={{ maxWidth: 140 }} placeholder="Puntadas reales" inputMode="numeric" value={real} onChange={(e) => setReal(e.target.value)} />
        <button
          className="rounded-full border border-tinta/20 px-3 py-1.5 disabled:opacity-40"
          disabled={!areaCm2 || !Number(real)}
          onClick={() => {
            save([...samples, { name: name || `Diseño ${samples.length + 1}`, real: Number(real), areaCm2, edgeCm }]);
            setName('');
            setReal('');
          }}
        >
          Guardar muestra
        </button>
      </div>
      {samples.length > 0 && (
        <table className="w-full text-left">
          <thead>
            <tr className="text-tinta-500">
              <th>Diseño</th><th>Reales</th><th>cm²</th><th>pt/cm²</th><th />
            </tr>
          </thead>
          <tbody>
            {samples.map((s, i) => (
              <tr key={i}>
                <td>{s.name}</td>
                <td>{fmtInt(s.real)}</td>
                <td>{s.areaCm2.toFixed(1)}</td>
                <td>{implied(s).toFixed(0)}</td>
                <td><button onClick={() => save(samples.filter((_, j) => j !== i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {median !== null && (
        <p className="rounded-lg bg-bosque-100 px-3 py-2 text-bosque">
          Valor sugerido: <b>puntadasPorCm2 = {Math.round(median)}</b> (mediana de {samples.length} muestras). Cámbialo en el editor de temas →
          «Estudio de diseño BR» → «Puntadas por cm²».
        </p>
      )}

      <p className="font-semibold">Precios por tramo (fórmula vs. variante de Shopify)</p>
      <table className="w-full text-left">
        <tbody>
          {pricing.tramos.map((tope, i) => {
            const f = formulaTierPrice(pricing, i);
            const v = pricing.tierVariants[i];
            const ok = v && round2(v.price) === f;
            return (
              <tr key={tope} className={cn(!ok && 'text-hilo-600')}>
                <td>Hasta {fmtInt(tope)}</td>
                <td>{fmtEur(f)}</td>
                <td>{v ? fmtEur(v.price) : 'sin variante'}</td>
                <td>{ok ? '✓' : '≠ ajustar en Shopify'}</td>
              </tr>
            );
          })}
          <tr className={cn(pricing.colorVariant?.price !== pricing.precioColorAdicional && 'text-hilo-600')}>
            <td>Color adicional</td>
            <td>{fmtEur(pricing.precioColorAdicional)}</td>
            <td>{pricing.colorVariant ? fmtEur(pricing.colorVariant.price) : 'sin producto'}</td>
            <td>{pricing.colorVariant?.price === pricing.precioColorAdicional ? '✓' : '≠ ajustar en Shopify'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
