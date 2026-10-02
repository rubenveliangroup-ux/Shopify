// Empaqueta el estudio de diseño para el tema de Shopify:
//   assets/br-studio.js  (React + Fabric + interfaz; módulo ES)
//   assets/br-studio-*.js (chunks: el visor 3D con three.js solo se descarga al abrir el estudio)
//   assets/br-studio.css (Tailwind limitado a #br-studio)
//   assets/br-color-picker.js (selector de color para páginas Liquid)
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

// Los chunks llevan hash: se borran los de compilaciones anteriores
const ASSETS = 'shopify-theme/assets/';
for (const f of fs.readdirSync(ASSETS)) if (/^br-studio-[A-Z0-9]+\.js$/.test(f)) fs.unlinkSync(ASSETS + f);

const result = await build({
  entryPoints: { 'br-studio': 'shopify-theme/src/entry.tsx' },
  bundle: true,
  minify: true,
  format: 'esm',
  splitting: true,
  chunkNames: 'br-studio-[hash]',
  target: ['es2020'],
  jsx: 'automatic',
  outdir: 'shopify-theme/assets',
  metafile: true,
  // drei los importa bajo demanda para vídeo y visión artificial; el estudio no los usa
  external: ['hls.js', '@mediapipe/tasks-vision'],
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.NEXT_PUBLIC_SITE_URL': '""',
    'process.env.NEXT_PUBLIC_WHATSAPP': '""'
  },
  legalComments: 'none',
  logLevel: 'info'
});
for (const [file, out] of Object.entries(result.metafile.outputs)) {
  const three = Object.keys(out.inputs).some((i) => i.includes('node_modules/three/'));
  console.log(`  ${file.replace(ASSETS, '')}: ${(out.bytes / 1024).toFixed(0)} KB${three ? ' (visor 3D)' : ''}`);
}

// Selector de color suelto (páginas Liquid sin el estudio)
await build({
  entryPoints: ['shopify-theme/src/color-picker-entry.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  outfile: 'shopify-theme/assets/br-color-picker.js',
  legalComments: 'none',
  logLevel: 'info'
});

execSync(
  'npx tailwindcss -c shopify-theme/tailwind.config.ts -i shopify-theme/src/studio.css -o shopify-theme/assets/br-studio.css --minify',
  { stdio: 'inherit' }
);
