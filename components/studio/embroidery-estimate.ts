/**
 * Utilidades del diseño en el navegador. El análisis (colores → hilos, relleno/línea y
 * puntadas) está en embroidery-threadize.ts y se ejecuta en un worker.
 */
import { deltaE, type ColorStat, type DesignAnalysis } from './embroidery-threadize';

export type { ColorStat, DesignAnalysis };
export { deltaE };

const ALPHA_MIN = 128;
const MERGE_DELTA_E = 18;

/** Une los colores de varios lados (delante + detrás) en una sola paleta de hilos. */
export function unionColors(lists: ColorStat[][]): ColorStat[] {
  const out: ColorStat[] = [];
  for (const c of lists.flat()) {
    const same = out.find((o) => (o.thread && c.thread ? o.thread.code === c.thread.code && o.hex === c.hex : deltaE(o.lab, c.lab) < MERGE_DELTA_E));
    if (same) same.areaCm2 += c.areaCm2;
    else out.push({ ...c });
  }
  return out;
}

/**
 * Quita el fondo blanco de una imagen subida: rellena desde los bordes por los píxeles
 * casi blancos (o transparentes) y los vuelve transparentes. El blanco encerrado dentro
 * del dibujo (p. ej. el hueco de una «O» en un logo sobre blanco) se conserva y cuenta
 * como hilo blanco: la estimación peca ligeramente por exceso.
 */
export function removeWhiteBackground(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const passable = (i: number) => d[i * 4 + 3] < ALPHA_MIN || (d[i * 4] > 235 && d[i * 4 + 1] > 235 && d[i * 4 + 2] > 235);
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!seen[i] && passable(i)) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  let removed = 0;
  while (stack.length) {
    const i = stack.pop()!;
    if (d[i * 4 + 3] >= ALPHA_MIN) removed++;
    d[i * 4 + 3] = 0;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  if (removed) ctx.putImageData(img, 0, 0);
  // Solo cuenta como «fondo» si es una parte apreciable de la imagen (no unos píxeles sueltos)
  return removed > w * h * 0.02;
}
