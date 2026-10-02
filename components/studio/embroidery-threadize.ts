/**
 * «Hilado» del diseño: convierte la imagen del cliente en lo que de verdad se puede bordar y
 * de ahí salen a la vez la ESTIMACIÓN de puntadas y las TEXTURAS del bordado en 3D.
 * Sin DOM: se ejecuta en un Web Worker (embroidery-worker.ts) para no bloquear la interfaz.
 *
 * 1. Colores: k-means en Lab (semilla fija), fusión de tonos parecidos, sin halos de suavizado
 *    ni colores residuales → cada color se asigna al HILO real más cercano de la carta.
 *    Dos colores con el mismo hilo son uno. Máximo `maxColores` hilos en la vista.
 * 2. Limpieza: filtro de moda (quita degradados y bordes dentados) e islas de menos de 2 mm²
 *    (detalles que no se pueden bordar) pasan al color vecino.
 * 3. Relleno o línea: con la transformada de distancia, las zonas más estrechas que
 *    `anchoMaxLineaMm` son líneas (satén); el resto, relleno (tatami) con remate en el borde.
 * 4. Puntadas = relleno cm² × PUNTADAS_POR_CM2 + borde de rellenos cm × puntadasPorCmBorde
 *    + longitud de líneas cm × PUNTADAS_POR_CM_LINEA.
 * 5. Texturas: color de hilo, relieve (normal map), dirección de la puntada (anisotropía del
 *    brillo) y sombreado para la vista 2D.
 */
import { labToHex, rgbToLab, type Lab } from '../color/color-math';
import { nearestThread, type Thread } from '../color/threads';
import type { EmbroideryConfig } from './embroidery-pricing';

export type { Lab };
/** Hilo usado en el diseño y su superficie. */
export type ColorStat = { hex: string; lab: Lab; areaCm2: number; share: number; thread?: Thread };

export type DesignAnalysis = {
  areaCm2: number;
  /** Superficie que se borda como relleno y su contorno. */
  fillAreaCm2: number;
  fillEdgeCm: number;
  /** Longitud total de las zonas que se bordan como línea (satén). */
  lineLengthCm: number;
  /** Contorno total (compatibilidad con el modo calibración). */
  edgeCm: number;
  widthCm: number;
  heightCm: number;
  colors: ColorStat[];
  /** Hilos distintos antes de limitar a `maxColores` (para el aviso). */
  threadCount: number;
  /** Puntadas sin margen de seguridad. */
  rawStitches: number;
  thinLines: boolean;
  tooSmall: boolean;
  whiteBackgroundRemoved?: boolean;
};

export type ThreadizeInput = {
  rgba: Uint8ClampedArray;
  w: number;
  h: number;
  cmPerPx: number;
  threads: Thread[];
  cfg: EmbroideryConfig;
  /** Generar texturas (si no, solo la estimación). */
  maps: boolean;
};

export type ThreadMaps = {
  w: number;
  h: number;
  /** Color del hilo (RGBA, alfa del diseño). */
  color: Uint8ClampedArray;
  /** Normal map en espacio tangente (RGB). */
  normal: Uint8ClampedArray;
  /** Anisotropía: RG = dirección de la puntada, B = intensidad (convención de three.js). */
  aniso: Uint8ClampedArray;
  /** Luces/sombras del relieve en gris con alfa, para fundir en «overlay» en 2D. */
  shade: Uint8ClampedArray;
};

export type ThreadizeResult = { analysis: DesignAnalysis | null; maps: ThreadMaps | null };

const K = 16;
const MERGE_DELTA_E = 18;
const MAX_SAMPLES = 24000;
const ALPHA_MIN = 128;
const MIN_DETAIL_CM2 = 0.2;
const MIN_ISLAND_CM2 = 0.02; // 2 mm²: menos que esto no se puede bordar como detalle
/** Aspecto de la puntada (mm). */
const ROW_MM = 0.8; // separación visual entre filas del relleno
const STITCH_MM = 4; // largo de puntada del tatami
const SATIN_BAND_MM = 1.1; // remate en satén del borde de los rellenos
const EDGE_SOFT_MM = 0.5; // redondeo del canto del hilo

export function threadize(input: ThreadizeInput): ThreadizeResult {
  const { rgba: data, w, h, cmPerPx, cfg } = input;
  const n = w * h;
  const pxArea = cmPerPx * cmPerPx;
  const mmPerPx = cmPerPx * 10;

  // ---------------------------------------------------------------- 1. máscara
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
  if (!covered) return { analysis: null, maps: null };

  // ---------------------------------------------------------------- 2. colores → hilos
  const { centroids, label: clusterLabel } = clusterColors(data, mask, w, h, pxArea, cfg);
  const threads = input.threads;
  const threadOf = centroids.map((c) => (threads.length ? nearestThread(labToHex(c), threads) : null));
  // Clusters con el mismo hilo → una sola ranura
  const slotKey = centroids.map((c, i) => (threadOf[i] ? `${threadOf[i]!.code}|${threadOf[i]!.hex}` : labToHex(c)));
  const keys = [...new Set(slotKey)];
  const slotOfCluster = slotKey.map((k) => keys.indexOf(k));
  let label: Int16Array = new Int16Array(n).fill(-1);
  for (let i = 0; i < n; i++) if (clusterLabel[i] >= 0) label[i] = slotOfCluster[clusterLabel[i]];
  let slotHex = keys.map((k, s) => {
    const ci = slotOfCluster.indexOf(s);
    return threadOf[ci] ? threadOf[ci]!.hex : labToHex(centroids[ci]);
  });
  let slotThread = keys.map((_, s) => threadOf[slotOfCluster.indexOf(s)] ?? undefined);
  const threadCount = keys.length;

  // Más hilos que agujas: la vista usa los `maxColores` más usados (el aviso lo da el panel)
  if (keys.length > cfg.maxColores) {
    const area = new Float64Array(keys.length);
    for (let i = 0; i < n; i++) if (label[i] >= 0) area[label[i]]++;
    const order = [...area.keys()].sort((a, b) => area[b] - area[a]);
    const keep = order.slice(0, cfg.maxColores);
    const labs = slotHex.map((hx) => hexLab(hx));
    const remap = keys.map((_, s) => (keep.includes(s) ? keep.indexOf(s) : keep.indexOf(keep.reduce((b, k) => (dist2(labs[k], labs[s]) < dist2(labs[b], labs[s]) ? k : b), keep[0]))));
    for (let i = 0; i < n; i++) if (label[i] >= 0) label[i] = remap[label[i]];
    slotHex = keep.map((s) => slotHex[s]);
    slotThread = keep.map((s) => slotThread[s]);
  }

  // ---------------------------------------------------------------- 3. limpieza
  label = modeFilter(label, w, h);
  label = removeIslands(label, w, h, Math.max(2, MIN_ISLAND_CM2 / pxArea));
  let used = 0;
  for (let i = 0; i < n; i++) if (label[i] >= 0) used++;
  if (!used) return { analysis: null, maps: null };

  // ---------------------------------------------------------------- 4. relleno / línea
  const dist = distanceToRegionEdge(label, w, h);
  const halfLinePx = cfg.anchoMaxLineaMm / 10 / 2 / cmPerPx;
  const fill = fillMask(label, dist, w, h, halfLinePx);
  let fillPx = 0, fillEdgePx = 0, linePx = 0, ridgePx = 0, ridgeDist = 0, thinRidgePx = 0;
  const halfMinPx = cfg.grosorMinimoMm / 10 / 2 / cmPerPx;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = label[i];
      if (l < 0) continue;
      if (fill[i]) {
        fillPx++;
        if (!fill[i - 1] || !fill[i + 1] || !fill[i - w] || !fill[i + w] || label[i - 1] !== l || label[i + 1] !== l || label[i - w] !== l || label[i + w] !== l) fillEdgePx++;
        continue;
      }
      // Línea: su cresta (centro del trazo) da el grosor medio
      linePx++;
      const v = dist[i];
      if (v >= dist[i - 1] && v >= dist[i + 1] && v >= dist[i - w] && v >= dist[i + w]) {
        ridgePx++;
        ridgeDist += v;
        if (halfMinPx >= 0.75 && v <= halfMinPx) thinRidgePx++;
      }
    }
  const areaCm2 = used * pxArea;
  const fillAreaCm2 = fillPx * pxArea;
  // El borde en píxeles (vecindad 4) se queda ≈ 10 % corto en curvas y diagonales
  const fillEdgeCm = fillEdgePx * cmPerPx * 1.1;
  // Longitud de las líneas = área ÷ grosor medio (robusto con trazos de grosor par o impar)
  const meanWidthPx = ridgePx ? (2 * ridgeDist) / ridgePx : 1;
  const lineLengthCm = linePx ? (linePx / Math.max(1, meanWidthPx)) * cmPerPx : 0;
  const rawStitches = fillAreaCm2 * cfg.puntadasPorCm2 + fillEdgeCm * cfg.puntadasPorCmBorde + lineLengthCm * cfg.puntadasPorCmLinea;
  const thinCm = thinRidgePx * cmPerPx;

  // Superficie por hilo
  const area = new Float64Array(slotHex.length);
  for (let i = 0; i < n; i++) if (label[i] >= 0) area[label[i]]++;
  const colors: ColorStat[] = slotHex
    .map((hex, s) => ({ hex, lab: hexLab(hex), areaCm2: area[s] * pxArea, share: area[s] / used, thread: slotThread[s] }))
    .filter((c) => c.areaCm2 > 0)
    .sort((a, b) => b.share - a.share);

  const widthCm = (maxX - minX + 1) * cmPerPx;
  const heightCm = (maxY - minY + 1) * cmPerPx;
  const analysis: DesignAnalysis = {
    areaCm2,
    fillAreaCm2,
    fillEdgeCm,
    lineLengthCm,
    edgeCm: fillEdgeCm + lineLengthCm * 2,
    widthCm,
    heightCm,
    colors,
    threadCount,
    rawStitches,
    thinLines: thinCm > 0.8 && thinRidgePx / Math.max(1, ridgePx) > 0.04,
    tooSmall: Math.min(widthCm, heightCm) < cfg.tamanoMinimoCm
  };
  if (!input.maps) return { analysis, maps: null };

  // ---------------------------------------------------------------- 5. texturas
  return { analysis, maps: buildMaps(data, label, dist, fill, slotHex, w, h, mmPerPx) };
}

// ------------------------------------------------------------------ colores

function clusterColors(data: Uint8ClampedArray, mask: Uint8Array, w: number, h: number, pxArea: number, cfg: EmbroideryConfig) {
  const n = w * h;
  let covered = 0;
  for (let i = 0; i < n; i++) covered += mask[i];
  const stride = Math.max(1, Math.floor(covered / MAX_SAMPLES));
  const samples: Lab[] = [];
  for (let i = 0, seen = 0; i < n; i++) {
    if (!mask[i]) continue;
    if (seen++ % stride === 0) samples.push(rgbToLab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]));
  }
  let centroids = kmeans(samples, Math.min(K, samples.length));
  const cache = new Int16Array(32768).fill(-1);
  const assign = (cents: Lab[], c: Int16Array, i: number) => {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let v = c[key];
    if (v < 0) c[key] = v = nearest(cents, rgbToLab(r, g, b));
    return v;
  };
  let counts = new Float64Array(centroids.length);
  for (let i = 0; i < n; i++) if (mask[i]) counts[assign(centroids, cache, i)]++;
  ({ centroids, counts } = mergeClose(centroids, counts, MERGE_DELTA_E));

  const label = new Int16Array(n).fill(-1);
  const cache2 = new Int16Array(32768).fill(-1);
  counts = new Float64Array(centroids.length);
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    const c = assign(centroids, cache2, i);
    label[i] = c;
    counts[c]++;
  }

  // Colores de transición (halos de suavizado/JPG): franjas sin interior que son mezcla de otros
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
    for (let a = 0; a < anchors.length; a++) for (let b = a + 1; b < anchors.length; b++) if (segmentDist(c, anchors[a], anchors[b]) < 22) return true;
    return false;
  });
  const total = counts.reduce((a, b) => a + b, 0);
  const keep = centroids.map((_, i) => !fringe[i] && (counts[i] / total >= cfg.umbralColor || counts[i] * pxArea >= MIN_DETAIL_CM2));
  if (!keep.some(Boolean)) keep[counts.indexOf(Math.max(...counts))] = true;
  const kept = centroids.filter((_, i) => keep[i]);
  const to = centroids.map((c, i) => (keep[i] ? kept.indexOf(c) : nearest(kept, c)));
  for (let i = 0; i < n; i++) if (label[i] >= 0) label[i] = to[label[i]];
  return { centroids: kept, label };
}

// ------------------------------------------------------------------ limpieza

/** Moda 3×3: cada píxel toma el color mayoritario de su entorno (quita dientes y degradados). */
function modeFilter(label: Int16Array, w: number, h: number) {
  const out = new Int16Array(label);
  const cnt = new Map<number, number>();
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (label[i] < 0) continue;
      cnt.clear();
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const l = label[i + dy * w + dx];
          if (l >= 0) cnt.set(l, (cnt.get(l) ?? 0) + 1);
        }
      let best = label[i], bc = 0;
      for (const [l, c] of cnt) if (c > bc) [best, bc] = [l, c];
      if (bc >= 5) out[i] = best;
    }
  return out;
}

/** Islas de un color más pequeñas que `minPx` pasan al color vecino más frecuente (o desaparecen). */
function removeIslands(label: Int16Array, w: number, h: number, minPx: number) {
  const n = w * h;
  const comp = new Int32Array(n).fill(-1);
  const stack: number[] = [];
  const pixels: number[] = [];
  let id = 0;
  for (let s = 0; s < n; s++) {
    if (label[s] < 0 || comp[s] >= 0) continue;
    const l = label[s];
    pixels.length = 0;
    stack.push(s);
    comp[s] = id;
    const neigh = new Map<number, number>();
    while (stack.length) {
      const i = stack.pop()!;
      pixels.push(i);
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= n) continue;
        if (label[j] === l) {
          if (comp[j] < 0) {
            comp[j] = id;
            stack.push(j);
          }
        } else neigh.set(label[j], (neigh.get(label[j]) ?? 0) + 1);
      }
    }
    if (pixels.length < minPx) {
      let to = -1, tc = 0;
      for (const [k, c] of neigh) if (c > tc) [to, tc] = [k, c];
      for (const i of pixels) label[i] = to;
    }
    id++;
  }
  return label;
}

// ------------------------------------------------------------------ geometría

/** Distancia (px) de cada píxel al borde de su zona de color (chamfer 3-4). */
function distanceToRegionEdge(label: Int16Array, w: number, h: number) {
  const n = w * h;
  const d = new Float32Array(n);
  const INF = 1e9;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const l = label[i];
      if (l < 0) continue;
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 || label[i - 1] !== l || label[i + 1] !== l || label[i - w] !== l || label[i + w] !== l;
      d[i] = edge ? 0.5 : INF;
    }
  chamfer(d, label, w, h);
  return d;
}

/** Dos pasadas de chamfer limitadas a píxeles del mismo color. */
function chamfer(d: Float32Array, label: Int16Array, w: number, h: number) {
  const D1 = 1, D2 = Math.SQRT2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const l = label[i];
      if (l < 0 || d[i] <= 0.5) continue;
      let v = d[i];
      if (x > 0 && label[i - 1] === l) v = Math.min(v, d[i - 1] + D1);
      if (y > 0) {
        if (label[i - w] === l) v = Math.min(v, d[i - w] + D1);
        if (x > 0 && label[i - w - 1] === l) v = Math.min(v, d[i - w - 1] + D2);
        if (x < w - 1 && label[i - w + 1] === l) v = Math.min(v, d[i - w + 1] + D2);
      }
      d[i] = v;
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      const l = label[i];
      if (l < 0 || d[i] <= 0.5) continue;
      let v = d[i];
      if (x < w - 1 && label[i + 1] === l) v = Math.min(v, d[i + 1] + D1);
      if (y < h - 1) {
        if (label[i + w] === l) v = Math.min(v, d[i + w] + D1);
        if (x < w - 1 && label[i + w + 1] === l) v = Math.min(v, d[i + w + 1] + D2);
        if (x > 0 && label[i + w - 1] === l) v = Math.min(v, d[i + w - 1] + D2);
      }
      d[i] = v;
    }
}

/** Relleno = píxeles a menos de `half` de un núcleo con grosor > 2·half (apertura morfológica). */
function fillMask(label: Int16Array, dist: Float32Array, w: number, h: number, half: number) {
  const n = w * h;
  const d2 = new Float32Array(n);
  for (let i = 0; i < n; i++) if (label[i] >= 0) d2[i] = dist[i] > half ? 0.5 : 1e9;
  chamfer(d2, label, w, h);
  const fill = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (label[i] >= 0 && d2[i] <= half + 1.5) fill[i] = 1;
  return fill;
}

// ------------------------------------------------------------------ texturas

function buildMaps(src: Uint8ClampedArray, label: Int16Array, dist: Float32Array, fill: Uint8Array, slotHex: string[], w: number, h: number, mmPerPx: number): ThreadMaps {
  const n = w * h;
  const rgb = slotHex.map((hx) => [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)]);
  const color = new Uint8ClampedArray(n * 4);
  const height = new Float32Array(n);
  const dirX = new Float32Array(n);
  const dirY = new Float32Array(n);
  const rowPx = Math.max(1.6, ROW_MM / mmPerPx);
  const stitchPx = STITCH_MM / mmPerPx;
  const bandPx = SATIN_BAND_MM / mmPerPx;
  const softPx = Math.max(1, EDGE_SOFT_MM / mmPerPx);

  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const l = label[i];
      if (l < 0) continue;
      const c = rgb[l];
      color[i * 4] = c[0];
      color[i * 4 + 1] = c[1];
      color[i * 4 + 2] = c[2];
      color[i * 4 + 3] = Math.max(src[i * 4 + 3], 200);

      const v = dist[i];
      const satin = !fill[i] || v <= bandPx;
      let ux: number, uy: number;
      if (satin) {
        // Satén: el hilo cruza la columna → dirección del gradiente de la distancia
        const gx = (x < w - 1 && label[i + 1] === l ? dist[i + 1] : v) - (x > 0 && label[i - 1] === l ? dist[i - 1] : v);
        const gy = (y < h - 1 && label[i + w] === l ? dist[i + w] : v) - (y > 0 && label[i - w] === l ? dist[i - w] : v);
        const g = Math.hypot(gx, gy) || 1;
        ux = gx / g;
        uy = gy / g;
        if (!gx && !gy) (ux = 1), (uy = 0);
      } else {
        // Relleno: ángulo constante por color (como al picar), 45° + 60° por cada hilo
        const a = ((45 + 60 * l) * Math.PI) / 180;
        ux = Math.cos(a);
        uy = Math.sin(a);
      }
      dirX[i] = ux;
      dirY[i] = uy;
      // Altura: canto redondeado + textura de puntada
      const dome = Math.sqrt(Math.min(1, v / softPx));
      let tex: number;
      if (satin) {
        const along = -x * uy + y * ux; // a lo largo de la columna: hilos uno al lado de otro
        tex = 0.9 + 0.1 * Math.cos((2 * Math.PI * along) / 1.6);
        height[i] = dome * 1.15 * tex;
      } else {
        const u = x * ux + y * uy; // a lo largo del hilo
        const vv = -x * uy + y * ux; // entre filas
        const row = Math.floor(vv / rowPx);
        const phase = (((u + row * stitchPx * 0.33) % stitchPx) + stitchPx) % stitchPx;
        const groove = phase < 1 ? 0.75 : 1; // las puntadas del tatami dejan un pequeño hueco
        tex = (0.88 + 0.12 * Math.cos((2 * Math.PI * vv) / rowPx)) * groove;
        height[i] = dome * tex;
      }
    }

  // Oclusión fina de las puntadas en el propio color (se ve también sin luz rasante)
  for (let i = 0; i < n; i++) {
    if (label[i] < 0) continue;
    const k = 0.8 + 0.2 * Math.min(1, height[i]);
    color[i * 4] *= k;
    color[i * 4 + 1] *= k;
    color[i * 4 + 2] *= k;
  }

  const normal = new Uint8ClampedArray(n * 4);
  const aniso = new Uint8ClampedArray(n * 4);
  const shade = new Uint8ClampedArray(n * 4);
  const STRENGTH = 2.6;
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const j = i * 4;
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(w - 1, x + 1);
      const dx = (height[y * w + x1] - height[y * w + x0]) * STRENGTH;
      // La imagen crece hacia abajo y la textura hacia arriba: se invierte dy
      const dy = (height[y0 * w + x] - height[y1 * w + x]) * STRENGTH;
      const len = Math.hypot(dx, dy, 1);
      const nx = -dx / len, ny = -dy / len, nz = 1 / len;
      normal[j] = (nx * 0.5 + 0.5) * 255;
      normal[j + 1] = (ny * 0.5 + 0.5) * 255;
      normal[j + 2] = (nz * 0.5 + 0.5) * 255;
      normal[j + 3] = 255;
      if (label[i] < 0) {
        aniso[j] = 128;
        aniso[j + 1] = 128;
        continue;
      }
      // Dirección en espacio tangente (x a la derecha, y hacia arriba)
      aniso[j] = (dirX[i] * 0.5 + 0.5) * 255;
      aniso[j + 1] = (-dirY[i] * 0.5 + 0.5) * 255;
      aniso[j + 2] = 255;
      aniso[j + 3] = 255;
      // Luz de arriba a la izquierda para la vista 2D (>128 aclara, <128 oscurece)
      const lit = (-nx * 0.5 + ny * 0.5 + nz * 0.7 - 0.7) * 2.4 + (height[i] - 0.95) * 0.6;
      shade[j] = shade[j + 1] = shade[j + 2] = Math.max(0, Math.min(255, 128 + lit * 128));
      shade[j + 3] = color[j + 3];
    }
  }
  return { w, h, color, normal, aniso, shade };
}

// ------------------------------------------------------------------ utilidades de color

function hexLab(hex: string): Lab {
  return rgbToLab(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
}

function kmeans(points: Lab[], k: number): Lab[] {
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
