'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { deltaE2000, hexToLab } from '../color/color-math';
import { threadLabel } from '../color/threads';
import { AVISO_3D } from './aviso';
import { unionColors, type ColorStat, type DesignAnalysis } from './embroidery-estimate';
import { fmtEur, fmtInt, formulaTierPrice, quote, round2, type EmbroideryPricing, type Quote } from './embroidery-pricing';

export type EmbroideryEstimate = {
  /** Análisis de cada parte del bordado: lados del estudio (delante/detrás) o zonas de la prenda. */
  perSide: Record<string, DesignAnalysis | null>;
  /** Puntadas estimadas con margen de seguridad (las que deciden el tramo). */
  stitches: number;
  rawStitches: number;
  /** Rango orientativo (± margen de error) alrededor de la estimación. */
  range: [number, number];
  colors: ColorStat[];
  quote: Quote;
  /** El rango alcanza otro tramo distinto del estimado. */
  mayChangeTier: boolean;
  warnings: string[];
};

const SIDE_LABELS: Record<string, string> = { delante: 'de delante', detras: 'de detrás' };

/**
 * Combina las partes del bordado (delante + detrás, o cada zona elegida): puntadas sumadas (los
 * colores ya vienen como hilos reales del hilado: dos colores con el mismo hilo son uno) y avisos.
 * `labels`: nombre de cada parte en los avisos («del pecho izquierdo»…).
 */
export function buildEstimate(
  p: EmbroideryPricing,
  perSide: Record<string, DesignAnalysis | null>,
  garmentHex?: string,
  labels: Record<string, string> = SIDE_LABELS
): EmbroideryEstimate {
  const used = Object.keys(perSide).filter((s) => perSide[s]);
  const sideLabel = (s: string) => labels[s] ?? s;
  const rawStitches = used.reduce((a, s) => a + perSide[s]!.rawStitches, 0);
  const stitches = Math.round(rawStitches * (1 + p.margenSeguridad));
  const colors = unionColors(used.map((s) => perSide[s]!.colors));
  const threadCount = Math.max(colors.length, ...used.map((s) => perSide[s]!.threadCount));
  const range: [number, number] = [Math.round(stitches * (1 - p.margenError)), Math.round(stitches * (1 + p.margenError))];
  const q = quote(p, stitches, threadCount);
  const tierOf = (n: number) => (n > p.umbralPresupuesto ? -1 : p.tramos.findIndex((t) => n <= t));
  const mayChangeTier = q.kind === 'priced' && (tierOf(range[0]) !== q.tierIndex || tierOf(range[1]) !== q.tierIndex);
  const warnings: string[] = [];
  for (const s of used) {
    const a = perSide[s]!;
    if (a.widthCm > p.bastidorAnchoCm + 0.05 || a.heightCm > p.bastidorAltoCm + 0.05)
      warnings.push(
        `El diseño ${sideLabel(s)} mide ≈ ${a.widthCm.toFixed(1)} × ${a.heightCm.toFixed(1)} cm y supera el área máxima de bordado (${p.bastidorAnchoCm} × ${p.bastidorAltoCm} cm). Redúcelo o lo bordaremos en varias partes (consúltanos).`
      );
    if (a.tooSmall)
      warnings.push(`El diseño ${sideLabel(s)} es muy pequeño (≈ ${a.widthCm.toFixed(1)} × ${a.heightCm.toFixed(1)} cm): los detalles podrían no apreciarse bordados.`);
    if (a.whiteBackgroundRemoved)
      warnings.push(`No contamos el fondo blanco de tu imagen (${sideLabel(s)}) como bordado. Si quieres ese blanco bordado, indícalo en las notas.`);
    if (a.thinLines)
      warnings.push(`El diseño ${sideLabel(s)} tiene líneas de menos de ${p.grosorMinimoMm} mm: son demasiado finas para bordar bien y tendremos que engrosarlas o simplificarlas.`);
  }
  if (garmentHex) {
    const g = hexToLab(garmentHex);
    const low = colors.filter((c) => deltaE2000(c.lab, g) < p.contrasteMinimo);
    for (const c of low)
      warnings.push(`El hilo ${c.thread ? threadLabel(c.thread) : c.hex} casi no se distingue del color de la prenda: elige otro color de hilo o de prenda si quieres que destaque.`);
  }
  return { perSide, stitches, rawStitches, range, colors, quote: q, mayChangeTier, warnings };
}

export function EmbroideryPanel({
  pricing,
  estimate,
  busy,
  calibrate,
  onRequestQuote
}: {
  pricing: EmbroideryPricing;
  estimate: EmbroideryEstimate | null;
  busy: boolean;
  calibrate: boolean;
  /** Botón «Enviar mi diseño» cuando hace falta presupuesto personalizado. */
  onRequestQuote?: () => void;
}) {
  const q = estimate?.quote ?? { kind: 'empty' as const };

  return (
    <div className="rounded-2xl bg-lino p-4 ring-1 ring-tinta/10" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Bordado: cálculo aproximado</p>
        {busy && <span className="text-xs text-tinta-500">Calculando…</span>}
      </div>

      {q.kind === 'empty' ? (
        <p className="mt-2 text-sm text-tinta-500">Sube o coloca tu diseño y calcularemos aquí el precio del bordado.</p>
      ) : (
        <>
          <p className="mt-3 text-center text-sm">
            Entre <b className="tabular-nums">{fmtInt(estimate!.range[0])}</b> y <b className="tabular-nums">{fmtInt(estimate!.range[1])}</b> puntadas
          </p>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
            <Stat label="Puntadas aprox." value={`≈ ${fmtInt(estimate!.stitches)}`} />
            <Stat
              label="Hilos"
              value={q.kind === 'too-many-colors' ? `${q.colors}/${pricing.maxColores}` : `${estimate!.colors.length}/${pricing.maxColores}`}
              warn={q.kind === 'too-many-colors'}
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
              <Row label="Precio estimado del bordado" value={fmtEur(q.total)} strong />
              {estimate!.mayChangeTier && (
                <p className="pt-1 text-xs text-tinta-500">Por el margen de error, el diseño podría quedar en el tramo de al lado.</p>
              )}
            </dl>
          )}
          {q.kind === 'too-many-colors' && (
            <p className="mt-3 rounded-xl bg-hilo-100 px-3 py-2 text-sm text-hilo-600">
              Tu diseño tiene más de {q.max} colores y bordamos como máximo {q.max}. Simplifica los colores del diseño o pídenos que te lo
              diseñemos nosotros (más abajo).
            </p>
          )}
          {q.kind === 'quote-required' && (
            <div className="mt-3 rounded-xl bg-oro-100 px-3 py-2 text-sm">
              <p>
                <b>Presupuesto personalizado.</b> Tu diseño supera las {fmtInt(Math.min(pricing.umbralPresupuesto, pricing.tramos[pricing.tramos.length - 1]))}{' '}
                puntadas: lo revisamos y te decimos el precio antes de producir.
              </p>
              {onRequestQuote && (
                <button type="button" onClick={onRequestQuote} className="btn-primary mt-2 w-full py-2.5 text-sm">
                  Enviar mi diseño para presupuesto
                </button>
              )}
            </div>
          )}

          {estimate!.warnings.map((w) => (
            <p key={w} className="mt-2 rounded-xl bg-oro-100 px-3 py-2 text-xs">⚠︎ {w}</p>
          ))}

          <p className="mt-3 rounded-xl bg-lino-100 px-3 py-2 text-xs font-medium text-tinta-700">{AVISO_3D}</p>
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

type Sample = { name: string; real: number; areaCm2: number; edgeCm: number; lineCm?: number };
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
  // Para calibrar el relleno: área de relleno, su borde y lo que suman las líneas con la constante actual
  const areaCm2 = sides.reduce((a, s) => a + s.fillAreaCm2, 0);
  const edgeCm = sides.reduce((a, s) => a + s.fillEdgeCm, 0);
  const lineCm = sides.reduce((a, s) => a + s.lineLengthCm, 0);
  const implied = (s: Sample) => (s.real - s.edgeCm * pricing.puntadasPorCmBorde - (s.lineCm ?? 0) * pricing.puntadasPorCmLinea) / s.areaCm2;
  const values = samples.map(implied).sort((a, b) => a - b);
  const median = values.length ? values[Math.floor((values.length - 1) / 2)] : null;

  return (
    <div className="mt-4 space-y-3 border-t border-dashed border-tinta/30 pt-4 text-xs">
      <p className="font-semibold uppercase tracking-wider text-hilo">Modo calibración</p>
      <p>
        Diseño actual: relleno <b>{areaCm2.toFixed(1)} cm²</b> · borde del relleno <b>{edgeCm.toFixed(1)} cm</b> · líneas{' '}
        <b>{lineCm.toFixed(1)} cm</b> · puntadas sin margen <b>{fmtInt(estimate?.rawStitches ?? 0)}</b> (con {pricing.puntadasPorCm2} pt/cm²,{' '}
        {pricing.puntadasPorCmBorde} pt/cm de borde y {pricing.puntadasPorCmLinea} pt/cm de línea).
      </p>
      <div className="flex flex-wrap gap-2">
        <input className="field !py-1.5 !text-xs" style={{ maxWidth: 160 }} placeholder="Nombre del diseño" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="field !py-1.5 !text-xs" style={{ maxWidth: 140 }} placeholder="Puntadas reales" inputMode="numeric" value={real} onChange={(e) => setReal(e.target.value)} />
        <button
          className="rounded-full border border-tinta/20 px-3 py-1.5 disabled:opacity-40"
          disabled={!areaCm2 || !Number(real)}
          onClick={() => {
            save([...samples, { name: name || `Diseño ${samples.length + 1}`, real: Number(real), areaCm2, edgeCm, lineCm }]);
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
              <th>Diseño</th><th>Reales</th><th>Relleno cm²</th><th>Líneas cm</th><th>pt/cm²</th><th />
            </tr>
          </thead>
          <tbody>
            {samples.map((s, i) => (
              <tr key={i}>
                <td>{s.name}</td>
                <td>{fmtInt(s.real)}</td>
                <td>{s.areaCm2.toFixed(1)}</td>
                <td>{(s.lineCm ?? 0).toFixed(1)}</td>
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
