// Empaqueta el estudio de diseño para el tema de Shopify:
//   assets/br-studio.js  (React + three.js + Fabric, IIFE minificado)
//   assets/br-studio.css (Tailwind limitado a #br-studio)
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

execSync(
  'npx tailwindcss -c shopify-theme/tailwind.config.ts -i shopify-theme/src/studio.css -o shopify-theme/assets/br-studio.css --minify',
  { stdio: 'inherit' }
);
