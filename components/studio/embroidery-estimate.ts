/**
 * Estimación de puntadas y colores de un diseño, en el navegador.
 * No genera el archivo de bordado: solo da una cifra orientativa para fijar precio.
 *
 * Entrada: el diseño ya recortado a su contenido (fondo transparente) y la escala cm/px real.
 * 1. Píxeles cubiertos = alfa ≥ 50 % (el fondo blanco de las fotos se quita antes, en el editor).
 * 2. Colores: k-means en espacio Lab (semilla fija → resultado estable), fusión de tonos
 *    parecidos (ΔE < MERGE_DELTA_E), descarte de halos de suavizado y de colores < umbral
 *    (p. ej. 1 %) salvo que sean un detalle visible (≥ 0,2 cm²).
 * 3. Puntadas ≈ área_cm² × puntadasPorCm2 + contorno_cm × puntadasPorCmBorde.
 * 4. Avisos: diseño demasiado pequeño y líneas más finas que el mínimo bordable.
 */
import type { EmbroideryConfig } from './embroidery-pricing';

export type Lab = [number, number, number];
export type ColorStat = { hex: string; lab: Lab; areaCm2: number; share: number };

export type DesignAnalysis = {
  areaCm2: number;
  edgeCm: number;
  widthCm: number;
  heightCm: number;
  colors: ColorStat[];
  /** Puntadas sin margen de seguridad. */
  rawStitches: number;
  thinLines: boolean;
  tooSmall: boolean;
  /** Se quitó el fondo blanco de alguna imagen subida (no se cuenta como bordado). */
  whiteBackgroundRemoved?: boolean;
};

const K = 16; // clusters iniciales
const MERGE_DELTA_E = 18; // tonos más cercanos que esto se consideran el mismo hilo
const MAX_SAMPLES = 24000;
const ALPHA_MIN = 128;
const MIN_DETAIL_CM2 = 0.2; // un color por debajo del umbral cuenta si ocupa al menos esto

export function analyzeDesign(canvas: HTMLCanvasElement, cmPerPx: number, cfg: EmbroideryConfig): DesignAnalysis | null {
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || !w || !h) return null;
  const data = ctx.getImageData(0, 0, w, h).data;
  const n = w * h;

  // --- Máscara de píxeles cubiertos y caja contenedora
  const mask = new Uint8Array(n);
  let covered = 0;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let i = 0; i < n; i++) {
    if (data[i * 4 + 3] >= ALPHA_MIN) {
      mask[i] = 1;
      covered++;
      const x = i % w, y = (i / w) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!covered) return null;
  const pxArea = cmPerPx * cmPerPx;

  // --- Colores: k-means sobre una muestra (paso fijo → determinista)
  const stride = Math.max(1, Math.floor(covered / MAX_SAMPLES));
  const samples: Lab[] = [];
  for (let i = 0, seen = 0; i < n; i++) {
    if (!mask[i]) continue;
    if (seen++ % stride === 0) samples.push(rgbToLab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]));
  }
  let centroids = kmeans(samples, Math.min(K, samples.length));

  // Asignación de todos los píxeles (caché por color reducido a 5 bits/canal)
  const cache = new Int16Array(32768).fill(-1);
  const assign = (r: number, g: number, b: number) => {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let c = cache[key];
    if (c < 0) {
      c = nearest(centroids, rgbToLab(r, g, b));
      cache[key] = c;
    }
    return c;
  };
  let counts = new Float64Array(centroids.length);
  for (let i = 0; i < n; i++) if (mask[i]) counts[assign(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])]++;

  // Fusión de tonos muy parecidos (aglomerativa, ponderada por área)
  ({ centroids, counts } = mergeClose(centroids, counts, MERGE_DELTA_E));

  // Etiqueta definitiva de cada píxel con la paleta fusionada
  const label = new Int8Array(n).fill(-1);
  const cache2 = new Int16Array(32768).fill(-1);
  counts = new Float64Array(centroids.length);
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let c = cache2[key];
    if (c < 0) cache2[key] = c = nearest(centroids, rgbToLab(r, g, b));
    label[i] = c;
    counts[c]++;
  }

  // Colores "de transición" (halos de suavizado y artefactos JPG): franjas finas sin
  // interior (ningún píxel con un entorno de ±2 px del mismo color) cuyo tono es una
  // mezcla de otros dos colores del diseño o del blanco. No son un hilo distinto.
  const R = 2;
  const interior = new Float64Array(centroids.length);
  for (let y = R; y < h - R; y++)
    for (let x = R; x < w - R; x++) {
      const i = y * w + x;
      const c = label[i];
      if (c < 0) continue;
      let ok = true;
      for (let dy = -R; dy <= R && ok; dy++) for (let dx = -R; dx <= R; dx++) if (label[i + dy * w + dx] !== c) { ok = false; break; }
      if (ok) interior[c]++;
    }
  const solid = centroids.map((_, i) => interior[i] / counts[i] >= 0.05);
  const WHITE: Lab = [100, 0, 0];
  const fringe = centroids.map((c, i) => {
    if (solid[i]) return false;
    const anchors = [...centroids.filter((_, j) => j !== i && solid[j]), WHITE];
    for (let a = 0; a < anchors.length; a++)
      for (let b = a + 1; b < anchors.length; b++) if (segmentDist(c, anchors[a], anchors[b]) < 22) return true;
    return false;
  });

  // Descarta colores de transición o con muy poca superficie; su área pasa al color más cercano
  const total = counts.reduce((a, b) => a + b, 0);
  // < umbral (≈1 %) se ignora, salvo detalles visibles (≥ 0,2 cm²: unos ojos, una línea fina de color)
  const keep = centroids.map((_, i) => !fringe[i] && (counts[i] / total >= cfg.umbralColor || counts[i] * pxArea >= MIN_DETAIL_CM2));
  if (!keep.some(Boolean)) keep[counts.indexOf(Math.max(...counts))] = true;
  const kept = centroids.filter((_, i) => keep[i]);
  const keptCounts = new Float64Array(kept.length);
  centroids.forEach((c, i) => {
    keptCounts[keep[i] ? kept.indexOf(c) : nearest(kept, c)] += counts[i];
  });

  const colors: ColorStat[] = kept
    .map((lab, i) => ({ lab, hex: labToHex(lab), areaCm2: keptCounts[i] * pxArea, share: keptCounts[i] / total }))
    .sort((a, b) => b.share - a.share);

  // --- Contorno (píxeles cubiertos con algún vecino libre)
  let edgePx = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !mask[i - 1] || !mask[i + 1] || !mask[i - w] || !mask[i + w]) edgePx++;
    }
  }

  const areaCm2 = covered * pxArea;
  const edgeCm = edgePx * cmPerPx;
  const widthCm = (maxX - minX + 1) * cmPerPx;
  const heightCm = (maxY - minY + 1) * cmPerPx;

  return {
    areaCm2,
    edgeCm,
    widthCm,
    heightCm,
    colors,
    rawStitches: areaCm2 * cfg.puntadasPorCm2 + edgeCm * cfg.puntadasPorCmBorde,
    thinLines: hasThinLines(mask, w, h, cmPerPx, cfg.grosorMinimoMm),
    tooSmall: Math.min(widthCm, heightCm) < cfg.tamanoMinimoCm
  };
}

/** Une los colores de varios lados (delante + detrás) en una sola paleta de hilos. */
export function unionColors(lists: ColorStat[][]): ColorStat[] {
  const out: ColorStat[] = [];
  for (const c of lists.flat()) {
    const same = out.find((o) => deltaE(o.lab, c.lab) < MERGE_DELTA_E);
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

// ---------------------------------------------------------------- utilidades

/** ¿Hay trazos más finos que el mínimo bordable? (transformada de distancia + crestas) */
function hasThinLines(mask: Uint8Array, w: number, h: number, cmPerPx: number, minMm: number) {
  const INF = 1e9;
  const dist = new Float32Array(w * h);
  for (let i = 0; i < dist.length; i++) dist[i] = mask[i] ? INF : 0;
  const D1 = 1, D2 = Math.SQRT2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!dist[i]) continue;
      let v = dist[i];
      if (x > 0) v = Math.min(v, dist[i - 1] + D1);
      if (y > 0) {
        v = Math.min(v, dist[i - w] + D1);
        if (x > 0) v = Math.min(v, dist[i - w - 1] + D2);
        if (x < w - 1) v = Math.min(v, dist[i - w + 1] + D2);
      }
      dist[i] = x === 0 || y === 0 || x === w - 1 || y === h - 1 ? Math.min(v, 1) : v;
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!dist[i]) continue;
      let v = dist[i];
      if (x < w - 1) v = Math.min(v, dist[i + 1] + D1);
      if (y < h - 1) {
        v = Math.min(v, dist[i + w] + D1);
        if (x < w - 1) v = Math.min(v, dist[i + w + 1] + D2);
        if (x > 0) v = Math.min(v, dist[i + w - 1] + D2);
      }
      dist[i] = v;
    }
  // Cresta = centro del trazo; su distancia al borde es medio grosor
  const halfMinPx = minMm / 10 / 2 / cmPerPx;
  if (halfMinPx < 0.75) return false; // la resolución no permite distinguirlo
  let ridge = 0, thin = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = dist[i];
      if (!v) continue;
      if (v >= dist[i - 1] && v >= dist[i + 1] && v >= dist[i - w] && v >= dist[i + w]) {
        ridge++;
        if (v <= halfMinPx) thin++;
      }
    }
  const thinCm = thin * cmPerPx;
  return thinCm > 0.8 && thin / Math.max(1, ridge) > 0.04;
}

function kmeans(points: Lab[], k: number): Lab[] {
  // Inicialización k-means++ con generador pseudoaleatorio de semilla fija
  let seed = 1234567;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const cents: Lab[] = [points[Math.floor(rand() * points.length)]];
  const d2 = new Float64Array(points.length).fill(Infinity);
  while (cents.length < k) {
    const last = cents[cents.length - 1];
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      d2[i] = Math.min(d2[i], dist2(points[i], last));
      sum += d2[i];
    }
    if (sum === 0) break;
    let r = rand() * sum;
    let idx = 0;
    while (idx < points.length - 1 && (r -= d2[idx]) > 0) idx++;
    cents.push(points[idx]);
  }
  for (let iter = 0; iter < 10; iter++) {
    const acc = cents.map(() => [0, 0, 0, 0]);
    for (const p of points) {
      const a = acc[nearest(cents, p)];
      a[0] += p[0];
      a[1] += p[1];
      a[2] += p[2];
      a[3]++;
    }
    let moved = false;
    acc.forEach((a, i) => {
      if (!a[3]) return;
      const c: Lab = [a[0] / a[3], a[1] / a[3], a[2] / a[3]];
      if (dist2(c, cents[i]) > 0.25) moved = true;
      cents[i] = c;
    });
    if (!moved) break;
  }
  return cents;
}

function mergeClose(cents: Lab[], counts: Float64Array, threshold: number) {
  const c = cents.map((x) => [...x] as Lab);
  const n = Array.from(counts);
  for (;;) {
    let best = Infinity, bi = -1, bj = -1;
    for (let i = 0; i < c.length; i++)
      for (let j = i + 1; j < c.length; j++) {
        if (!n[i] || !n[j]) continue;
        const d = deltaE(c[i], c[j]);
        if (d < best) [best, bi, bj] = [d, i, j];
      }
    if (bi < 0 || best >= threshold) break;
    const t = n[bi] + n[bj];
    c[bi] = [0, 1, 2].map((k) => (c[bi][k] * n[bi] + c[bj][k] * n[bj]) / t) as Lab;
    n[bi] = t;
    n[bj] = 0;
  }
  const idx = n.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
  return { centroids: idx.map((i) => c[i]), counts: Float64Array.from(idx.map((i) => n[i])) };
}

/** Distancia (ΔE) de p al segmento a-b en Lab: ¿es p una mezcla de a y b? */
function segmentDist(p: Lab, a: Lab, b: Lab) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  if (!len) return deltaE(p, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / len));
  return deltaE(p, [a[0] + t * ab[0], a[1] + t * ab[1], a[2] + t * ab[2]]);
}

const dist2 = (a: Lab, b: Lab) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
export const deltaE = (a: Lab, b: Lab) => Math.sqrt(dist2(a, b));

function nearest(cents: Lab[], p: Lab) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < cents.length; i++) {
    const d = dist2(cents[i], p);
    if (d < bd) [bd, best] = [d, i];
  }
  return best;
}

function rgbToLab(r: number, g: number, b: number): Lab {
  const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function labToHex([L, a, b]: Lab) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const lin = [X * 3.2406 - Y * 1.5372 - Z * 0.4986, -X * 0.9689 + Y * 1.8758 + Z * 0.0415, X * 0.0557 - Y * 0.204 + Z * 1.057];
  return (
    '#' +
    lin
      .map((v) => {
        const s = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
        return Math.round(Math.min(1, Math.max(0, s)) * 255).toString(16).padStart(2, '0');
      })
      .join('')
  );
}
