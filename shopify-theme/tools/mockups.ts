// npm run mockups -- shopify-theme/mockups/coleccion.json
// Fotos de producto de la colección con la sudadera del estudio (corte boxy del modelo 3D, mismo acabado
// que en «Diseña tu prenda»): la prenda se tiñe del color de cada producto (el que tenga, sin cambiarlo) y
// cada diseño se coloca en su zona a su tamaño real en cm, con las sombras y pliegues de la tela encima.
// Salida: WebP cuadradas listas para subir a Shopify.
//
// Formato del JSON (rutas relativas al propio JSON):
// {
//   "salida": "salida", "fondo": "#f3f1ec", "tamano": 1254,
//   "productos": [
//     { "handle": "sudadera-oversize-pulpo", "color": "#1c1c1e",
//       "vistas": [
//         { "lado": "delante", "disenos": [{ "archivo": "pulpo.png", "zona": "centro-pecho", "ancho": 22 }] },
//         { "lado": "detras", "disenos": [{ "archivo": "../marca/br-logo-crema.png", "zona": "bajo-cuello", "ancho": 8 }] }
//       ] }
//   ]
// }
// Zonas: components/studio/zones.ts (o "x"/"y" en cm desde el punto alto del cuello).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { Side } from '@/components/studio/config';
import { cmToLite, cmToLiteSize, zoneById } from '@/components/studio/zones';
// @ts-expect-error módulo JS de las herramientas
import { baseFrame, lin, tintNeutral } from './prenda-base.mjs';

type Design = { archivo: string; zona?: string; x?: number; y?: number; ancho: number };
type Spec = {
  salida?: string;
  fondo?: string;
  tamano?: number;
  productos: { handle: string; color: string; vistas: { lado: Side; disenos: Design[] }[] }[];
};

const specFile = path.resolve(process.argv[2] ?? 'shopify-theme/mockups/coleccion.json');
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8')) as Spec;
const base = path.dirname(specFile);
const outDir = path.resolve(base, spec.salida ?? 'salida');
const OUT = spec.tamano ?? 1254;
const FRAME = Math.round(OUT * 0.9); // margen alrededor de la prenda
const srgb = (v: number) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
fs.mkdirSync(outDir, { recursive: true });

const frames: Partial<Record<Side, { data: Buffer; mid: number }>> = {};
async function frame(side: Side) {
  frames[side] ??= await baseFrame(side, FRAME);
  return frames[side]!;
}

for (const p of spec.productos) {
  for (const v of p.vistas) {
    const { data: neutral, mid } = await frame(v.lado);
    const img = tintNeutral(neutral, p.color) as Buffer;
    for (const d of v.disenos) {
      const zone = d.zona ? zoneById(d.zona) : undefined;
      if (d.zona && !zone) throw new Error(`Zona desconocida: ${d.zona}`);
      if (zone && zone.side !== v.lado) throw new Error(`La zona ${d.zona} es de ${zone.side}, no de ${v.lado}`);
      const at = cmToLite(d.x ?? zone!.x, d.y ?? zone!.y);
      const w = Math.round(cmToLiteSize(d.ancho) * FRAME);
      const { data: des, info } = await sharp(path.resolve(base, d.archivo)).ensureAlpha().resize(w, null).raw().toBuffer({ resolveWithObject: true });
      const x0 = Math.round(at.u * FRAME - info.width / 2);
      const y0 = Math.round(at.v * FRAME - info.height / 2);
      for (let y = 0; y < info.height; y++)
        for (let x = 0; x < info.width; x++) {
          const X = x0 + x;
          const Y = y0 + y;
          if (X < 0 || Y < 0 || X >= FRAME || Y >= FRAME) continue;
          const j = (y * info.width + x) * 4;
          const i = (Y * FRAME + X) * 4;
          const a = (des[j + 3] / 255) * (img[i + 3] / 255); // nunca fuera de la tela
          if (a <= 0) continue;
          // Luz de la tela en ese punto (1 = tela media): los pliegues y el lavado pasan al diseño
          const shade = Math.min(1.2, Math.max(0.35, lin(neutral[i]) / mid));
          for (let k = 0; k < 3; k++) {
            const c = srgb(Math.min(1, lin(des[j + k]) * shade));
            img[i + k] = Math.round(img[i + k] * (1 - a) + c * a);
          }
        }
    }
    const garment = await sharp(img, { raw: { width: FRAME, height: FRAME, channels: 4 } }).png().toBuffer();
    const file = path.join(outDir, `${p.handle}-${v.lado}.webp`);
    const pad = Math.round((OUT - FRAME) / 2);
    await sharp({ create: { width: OUT, height: OUT, channels: 3, background: spec.fondo ?? '#f3f1ec' } })
      .composite([{ input: garment, left: pad, top: pad }])
      .webp({ quality: 82, effort: 6 })
      .toFile(file);
    console.log(`${file} · ${Math.round(fs.statSync(file).size / 1024)} KB`);
  }
}
