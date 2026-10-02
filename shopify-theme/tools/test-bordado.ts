// npm run test:bordado — diseños de tamaño conocido por el hilado + estimación del bordado.
import { DEFAULT_THREADS } from '@/components/color/threads';
import { threadize } from '@/components/studio/embroidery-threadize';
import { DEFAULT_EMBROIDERY_CONFIG as cfg, fmtInt, quote } from '@/components/studio/embroidery-pricing';

const CM_PER_PX = 0.04; // 0,4 mm por píxel, como en el estudio (escritorio)
type Px = [number, number, number, number];
function design(wCm: number, hCm: number, paint: (xCm: number, yCm: number) => Px | null) {
  const w = Math.round(wCm / CM_PER_PX) + 2;
  const h = Math.round(hCm / CM_PER_PX) + 2;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = paint((x - 1 + 0.5) * CM_PER_PX, (y - 1 + 0.5) * CM_PER_PX);
      if (p) rgba.set(p, (y * w + x) * 4);
    }
  return { rgba, w, h };
}
const RED: Px = [200, 16, 46, 255];
const GOLD: Px = [242, 183, 5, 255];
const NAVY: Px = [27, 42, 74, 255];

const cases: { name: string; expect: string; d: ReturnType<typeof design> }[] = [
  {
    name: 'Círculo relleno Ø 10 cm, 1 color',
    expect: 'relleno π·5² = 78,5 cm², borde 31,4 cm, sin líneas → 78,5×150 + 31,4×5 = 11.938',
    d: design(10, 10, (x, y) => (Math.hypot(x - 5, y - 5) <= 5 ? RED : null))
  },
  {
    name: 'Marco de 10 × 5 cm con trazo de 2 mm, 1 color',
    expect: 'línea ≈ 29,6 cm de recorrido (por el centro del trazo) → ≈ 29,6×25 = 740',
    d: design(10, 5, (x, y) => (x < 0.2 || x > 9.8 || y < 0.2 || y > 4.8 ? NAVY : null))
  },
  {
    name: 'Logo 8 × 8 cm: cuadrado rojo con círculo amarillo de Ø 4 cm y texto fino (líneas de 1,5 mm)',
    expect: 'relleno ≈ 64 cm² − líneas, 2-3 hilos; mezcla de relleno y línea',
    d: design(8, 8, (x, y) => {
      if (Math.hypot(x - 4, y - 4) <= 2) return GOLD;
      if (y > 6.5 && y < 6.65 && x > 1 && x < 7) return NAVY; // línea fina dentro del rojo
      return RED;
    })
  },
  {
    name: 'Degradado (foto) 10 × 10 cm',
    expect: 'se reduce a hilos de la carta (máx. 12) y avisa si hay más',
    d: design(10, 10, (x, y) => [Math.round(25.5 * x), Math.round(25.5 * y), 128, 255])
  }
];

for (const c of cases) {
  const t0 = performance.now();
  const r = threadize({ ...c.d, cmPerPx: CM_PER_PX, threads: DEFAULT_THREADS, cfg, maps: true });
  const ms = performance.now() - t0;
  const a = r.analysis!;
  const stitches = Math.round(a.rawStitches * (1 + cfg.margenSeguridad));
  const q = quote({ ...cfg, tierVariants: [], colorVariant: null }, stitches, a.threadCount);
  console.log(`\n▸ ${c.name}  (${c.d.w}×${c.d.h} px, ${ms.toFixed(0)} ms)`);
  console.log(`  esperado: ${c.expect}`);
  console.log(
    `  medido: relleno ${a.fillAreaCm2.toFixed(1)} cm² · borde ${a.fillEdgeCm.toFixed(1)} cm · líneas ${a.lineLengthCm.toFixed(1)} cm · ${a.widthCm.toFixed(1)}×${a.heightCm.toFixed(1)} cm`
  );
  console.log(
    `  hilos: ${a.threadCount} (${a.colors.map((x) => x.thread?.code ?? x.hex).join(', ')}) · puntadas sin margen ${fmtInt(a.rawStitches)} · con margen ${fmtInt(stitches)} · rango ${fmtInt(stitches * (1 - cfg.margenError))}–${fmtInt(stitches * (1 + cfg.margenError))}`
  );
  console.log(`  precio: ${q.kind === 'priced' ? `${q.tierLabel} · ${q.total.toFixed(2)} €` : q.kind}${a.thinLines ? ' · aviso líneas finas' : ''}`);
}
