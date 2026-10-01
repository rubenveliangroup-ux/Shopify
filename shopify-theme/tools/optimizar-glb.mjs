// Optimiza el GLB de la prenda para la web e informa del peso antes y después.
//   node shopify-theme/tools/optimizar-glb.mjs entrada.glb salida.glb [--meshopt] [--ktx2] [--max 2048]
// Por defecto: limpia, suelda vértices, texturas a 2K en WebP y geometría con Draco.
//   --meshopt  geometría con Meshopt (el decodificador va dentro de br-studio.js; no descarga nada)
//   --ktx2     texturas KTX2/Basis (necesita "toktx" de KTX-Software instalado en el equipo)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dedup, draco, meshopt, prune, quantize, textureCompress, weld } from '@gltf-transform/functions';
import sharp from 'sharp';
import { createIO, kb, mb } from './glb-io.mjs';

const [input, output] = process.argv.slice(2).filter((a) => !a.startsWith('--') && !/^\d+$/.test(a));
if (!input || !output) {
  console.error('Uso: node shopify-theme/tools/optimizar-glb.mjs entrada.glb salida.glb [--meshopt] [--ktx2] [--max 2048]');
  process.exit(2);
}
const flag = (f) => process.argv.includes(f);
const maxSize = flag('--max') ? Number(process.argv[process.argv.indexOf('--max') + 1]) : 2048;

const io = await createIO();
const before = fs.statSync(input).size;
const doc = await io.read(input);

const textures = () =>
  doc
    .getRoot()
    .listTextures()
    .map((t) => `${t.getName() || t.getURI() || 'textura'} ${t.getSize()?.join('×') ?? ''} ${t.getMimeType()} ${kb(t.getImage()?.byteLength ?? 0)}`);
console.log(`Antes: ${mb(before)}`);
for (const t of textures()) console.log(`  · ${t}`);

await doc.transform(dedup(), prune(), weld());

if (flag('--ktx2')) {
  // Se reduce a 2K y luego se pasa a KTX2 con la CLI oficial (usa toktx)
  await doc.transform(textureCompress({ encoder: sharp, resize: [maxSize, maxSize], targetFormat: 'png' }));
  const tmp = path.join(os.tmpdir(), `br-glb-${Date.now()}.glb`);
  await io.write(tmp, doc);
  const tmp2 = tmp.replace('.glb', '-ktx2.glb');
  // Normales y rugosidad en UASTC (sin artefactos); color en ETC1S (más ligero)
  execFileSync('npx', ['-y', '@gltf-transform/cli@4', 'uastc', tmp, tmp2, '--slots', '{normalTexture,metallicRoughnessTexture,occlusionTexture}', '--level', '2', '--zstd', '18'], { stdio: 'inherit' });
  execFileSync('npx', ['-y', '@gltf-transform/cli@4', 'etc1s', tmp2, tmp2, '--slots', 'baseColorTexture', '--quality', '200'], { stdio: 'inherit' });
  const again = await io.read(tmp2);
  await compressGeometry(again);
  await io.write(output, again);
} else {
  await doc.transform(textureCompress({ encoder: sharp, resize: [maxSize, maxSize], targetFormat: 'webp', quality: 88 }));
  await compressGeometry(doc);
  await io.write(output, doc);
}

const after = fs.statSync(output).size;
const out = await io.read(output);
console.log(`Después: ${mb(after)} (${(100 - (after / before) * 100).toFixed(0)} % menos)`);
for (const t of out.getRoot().listTextures()) console.log(`  · ${t.getName() || 'textura'} ${t.getSize()?.join('×') ?? '(KTX2)'} ${t.getMimeType()} ${kb(t.getImage()?.byteLength ?? 0)}`);
if (after > 5 * 1024 * 1024) console.log('⚠ Sigue por encima de 5 MB: prueba --max 1024 o --ktx2.');

async function compressGeometry(d) {
  if (flag('--meshopt')) await d.transform(quantize(), meshopt({ encoder: (await import('meshoptimizer')).MeshoptEncoder, level: 'medium' }));
  else await d.transform(draco({ method: 'edgebreaker', quantizePosition: 14, quantizeTexcoord: 12, quantizeNormal: 10 }));
}
