// Genera las fotos de la vista ligera (sin 3D) a partir del GLB optimizado:
//   node shopify-theme/tools/render-vistas.mjs sudadera-web.glb shopify-theme/assets
// Escribe br-prenda-delante.webp y br-prenda-detras.webp: la prenda en blanco neutro con la luz del
// visor, con el encuadre LITE_FRAME de config.ts (el diseño cae a su tamaño real en PANEL_IN_LITE) y con el
// blanco normalizado para teñir por multiplicación. Necesita Playwright con Chromium.
import { build } from 'esbuild';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import sharp from 'sharp';

const [glb, outDir = 'shopify-theme/assets'] = process.argv.slice(2);
if (!glb) {
  console.error('Uso: node shopify-theme/tools/render-vistas.mjs modelo.glb [carpeta-salida]');
  process.exit(2);
}
const { chromium } = await import('playwright');
const root = path.resolve(new URL('../..', import.meta.url).pathname);
const res = await build({
  entryPoints: [path.join(root, 'shopify-theme/tools/render-vistas-page.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  alias: { '@': root },
  logLevel: 'error'
});
const js = res.outputFiles[0].text;
const draco = path.join(root, 'node_modules/three/examples/jsm/libs/draco/gltf/');
const server = http
  .createServer((q, r) => {
    const u = q.url.split('?')[0];
    if (u === '/') return r.end('<!doctype html><body style="margin:0"><script src="/p.js"></script>');
    if (u === '/p.js') return r.end(js);
    if (u === '/modelo.glb') return r.end(fs.readFileSync(glb));
    if (u.startsWith('/draco/')) return r.end(fs.readFileSync(draco + u.slice(7)));
    r.writeHead(404).end();
  })
  .listen(0);
const port = server.address().port;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
page.on('pageerror', (e) => console.error(e.message));
await page.goto(`http://localhost:${port}/?s=1200`);
await page.waitForFunction(() => window.vistas, null, { timeout: 180000 });
const vistas = await page.evaluate(() => window.vistas);
await browser.close();
server.close();

// Blanco de referencia: el percentil 85 de la tela pasa a 0,86 en lineal (lo que espera tintGarment)
const lin = (v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : Math.pow((v / 255 + 0.055) / 1.055, 2.4));
const srgb = (v) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
for (const [side, url] of Object.entries(vistas)) {
  const { data, info } = await sharp(Buffer.from(url.split(',')[1], 'base64')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ls = [];
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 250) ls.push(lin((data[i] + data[i + 1] + data[i + 2]) / 3));
  ls.sort((a, b) => a - b);
  const k = 0.86 / ls[Math.floor(ls.length * 0.85)];
  for (let i = 0; i < data.length; i += 4) {
    // Gris neutro (la tinta la pone el color elegido) y blanco normalizado
    const g = Math.min(255, Math.round(srgb(Math.min(1, lin((data[i] + data[i + 1] + data[i + 2]) / 3) * k))));
    data[i] = data[i + 1] = data[i + 2] = g;
  }
  const file = path.join(outDir, `br-prenda-${side}.webp`);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 86, alphaQuality: 90 }).toFile(file);
  console.log(`${file}: ${(fs.statSync(file).size / 1024).toFixed(0)} KB (blanco ×${k.toFixed(2)})`);
}
