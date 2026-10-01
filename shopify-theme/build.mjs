// Empaqueta el estudio de diseño para el tema de Shopify:
//   assets/br-studio.js  (React + three.js + Fabric, IIFE minificado)
//   assets/br-studio.css (Tailwind limitado a #br-studio)
//   assets/br-color-picker.js (selector de color para páginas Liquid)
import { build } from 'esbuild';
import { execSync } from 'node:child_process';

await build({
  entryPoints: ['shopify-theme/src/entry.tsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  jsx: 'automatic',
  outfile: 'shopify-theme/assets/br-studio.js',
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.NEXT_PUBLIC_SITE_URL': '""',
    'process.env.NEXT_PUBLIC_WHATSAPP': '""'
  },
  legalComments: 'none',
  logLevel: 'info'
});

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
