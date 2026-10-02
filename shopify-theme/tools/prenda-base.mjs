// Prenda base de las fotos de producto (mockups.ts): las mismas fotos de la vista ligera del estudio
// (assets/br-prenda-*.webp, render neutro del modelo 3D con el encuadre LITE_FRAME), con el mismo
// color y acabado que en el estudio. Se tiñen con la misma fórmula que tintGarment (garment-preview.tsx).
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(new URL('../..', import.meta.url).pathname);

export const lin = (v) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const srgb = (v) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

/** Foto neutra de un lado (SIZE × SIZE, RGBA) y la luz media de la tela (lineal). */
export async function baseFrame(side, SIZE) {
  const data = await sharp(path.join(root, `shopify-theme/assets/br-prenda-${side}.webp`)).ensureAlpha().resize(SIZE, SIZE).raw().toBuffer();
  const vals = [];
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 250) vals.push(lin(data[i]));
  vals.sort((a, b) => a - b);
  return { data, mid: vals[Math.floor(vals.length / 2)] };
}

/** Tiñe la foto neutra de un color (misma fórmula que tintGarment en garment-preview.tsx). */
export function tintNeutral(buf, hex) {
  const out = Buffer.from(buf);
  const n = parseInt(hex.replace('#', ''), 16);
  const t = [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
  const lum = 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2];
  const dark = 1 - Math.min(1, lum * 3);
  for (let i = 0; i < out.length; i += 4) {
    if (!out[i + 3]) continue;
    const s = lin(out[i]) / 0.86;
    const sheen = dark * 0.035 * Math.max(0, s - 0.6);
    for (let k = 0; k < 3; k++) out[i + k] = Math.min(255, srgb(Math.min(1, Math.max(t[k], 0.012) * s + sheen)));
  }
  return out;
}
