import type { Config } from 'tailwindcss';
import base from '../tailwind.config';

/**
 * Tailwind para el estudio incrustado en el tema de Shopify:
 * - sin preflight (no tocar los estilos del tema)
 * - todas las utilidades limitadas a #br-studio para no chocar con Horizon
 */
const config: Config = {
  ...base,
  content: ['./components/studio/**/*.tsx', './components/icons.tsx', './shopify-theme/src/**/*.tsx'],
  important: '#br-studio',
  corePlugins: { preflight: false }
};

export default config;
