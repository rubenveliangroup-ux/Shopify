// Utilidades compartidas por las herramientas del modelo 3D.
import fs from 'node:fs';

/** Medidas por talla desde la fuente única de la tienda (snippets/br-medidas.liquid). */
export function readMedidas() {
  const local = new URL('../snippets/br-medidas.liquid', import.meta.url);
  const file = fs.existsSync(local) ? local : 'shopify-theme/snippets/br-medidas.liquid'; // empaquetado: desde la raíz
  const liquid = fs.readFileSync(file, 'utf8');
  return Object.fromEntries(
    /medidas\s*=\s*'([^']+)'/.exec(liquid)[1].split(';').map((r) => {
      const [t, largo, pecho, bajo, manga] = r.split(',');
      return [t.trim(), { largo: +largo, pecho: +pecho, bajo: +bajo, manga: +manga }];
    })
  );
}

/** Rasteriza los triángulos UV en una cuadrícula S×S (cuenta de coberturas por píxel); `pad` dilata la máscara. */
export function rasterizeUV(prims, S, pad = 0) {
  const grid = new Uint8Array(S * S);
  for (const p of prims) {
    const uv = p.getAttribute('TEXCOORD_0');
    const idx = p.getIndices();
    const n = idx ? idx.getCount() : uv.getCount();
    const a = [0, 0];
    const tri = [[], [], []];
    for (let i = 0; i < n; i += 3) {
      for (let k = 0; k < 3; k++) {
        uv.getElement(idx ? idx.getScalar(i + k) : i + k, a);
        tri[k] = [a[0] * S, a[1] * S];
      }
      raster(tri, grid, S);
    }
  }
  if (!pad) return grid;
  const out = new Uint8Array(grid);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (!grid[y * S + x]) continue;
      for (let j = -pad; j <= pad; j++)
        for (let i = -pad; i <= pad; i++) {
          const xx = x + i;
          const yy = y + j;
          if (xx >= 0 && yy >= 0 && xx < S && yy < S && !out[yy * S + xx]) out[yy * S + xx] = 1;
        }
    }
  return out;
}

function raster([p0, p1, p2], grid, S) {
  const area = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
  if (Math.abs(area) < 1e-9) return;
  const minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])));
  const maxX = Math.min(S - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
  const minY = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1])));
  const maxY = Math.min(S - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
  const s = Math.sign(area);
  const edge = (a, b, x, y) => ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) * s;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      // Regla de borde estricta en dos lados: los triángulos vecinos no se cuentan dos veces
      const w0 = edge(p1, p2, cx, cy);
      const w1 = edge(p2, p0, cx, cy);
      const w2 = edge(p0, p1, cx, cy);
      if (w0 >= 0 && w1 >= 0 && w2 >= 0 && (w0 > 0 || w1 > 0) && (w1 > 0 || w2 > 0) && (w0 > 0 || w2 > 0)) {
        const i = y * S + x;
        if (grid[i] < 255) grid[i]++;
      }
    }
  }
}
