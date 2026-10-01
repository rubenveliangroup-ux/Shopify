import { createRoot } from 'react-dom/client';
import { parseColorList, type GarmentColorMode } from '@/components/color/color-config';
import { DesignStudio } from '@/components/studio/design-studio';
import type { SizeChartData } from '@/components/studio/size-chart';
import { DEFAULT_EMBROIDERY_CONFIG, type EmbroideryConfig, type EmbroideryPricing, type PricedVariant } from '@/components/studio/embroidery-pricing';
import { ShopifyAddToCart, type ShopifyVariant } from './add-to-cart';

type Config = {
  variants: ShopifyVariant[];
  price: string;
  priceValue: number;
  cartAddUrl: string;
  cartUrl: string;
  altHref: string;
  /** Color de prenda: "libre" o "stock" + lista de stock ("Negro #1c1c1e" por línea). */
  colorMode?: string;
  stockColors?: string;
  /** URL de assets/br-hilos.json (carta de hilos editable). */
  threadPaletteUrl?: string;
  /** GLB de la sudadera (ajuste del tema o modelo 3D del producto). Vacío = modelo básico. */
  modelUrl?: string;
  /** Tabla de medidas (snippet br-medidas.liquid). */
  sizeChart?: SizeChartData;
  /** Ajustes de la calculadora (editor de temas) + variantes de los productos de extra. */
  embroidery?: Partial<Record<keyof EmbroideryConfig, unknown>> & {
    enabled?: boolean;
    tramosTexto?: string;
    tierVariants?: PricedVariant[];
    colorVariant?: PricedVariant | null;
  };
};

function pricingFrom(c: Config['embroidery']): EmbroideryPricing | undefined {
  if (!c || c.enabled === false) return undefined;
  // Admite números o texto con coma decimal ("0,75") desde el editor de temas
  const num = (v: unknown, d: number) => {
    const n = typeof v === 'string' ? Number(v.trim().replace(',', '.')) : v;
    return typeof n === 'number' && Number.isFinite(n) && (typeof v !== 'string' || v.trim() !== '') ? n : d;
  };
  const D = DEFAULT_EMBROIDERY_CONFIG;
  const tramos = (c.tramosTexto ?? '')
    .split(/[,;\s]+/)
    .map((t) => Number(t.replace(/\./g, '')))
    .filter((n) => n > 0);
  const pricing: EmbroideryPricing = {
    puntadasPorCm2: num(c.puntadasPorCm2, D.puntadasPorCm2),
    puntadasPorCmBorde: num(c.puntadasPorCmBorde, D.puntadasPorCmBorde),
    margenSeguridad: num(c.margenSeguridad, D.margenSeguridad),
    costePorMil: num(c.costePorMil, D.costePorMil),
    multiplicadorMargen: num(c.multiplicadorMargen, D.multiplicadorMargen),
    cuotaFija: num(c.cuotaFija, D.cuotaFija),
    precioColorAdicional: num(c.precioColorAdicional, D.precioColorAdicional),
    maxColores: num(c.maxColores, D.maxColores),
    tramos: tramos.length ? tramos : D.tramos,
    umbralColor: num(c.umbralColor, D.umbralColor),
    grosorMinimoMm: num(c.grosorMinimoMm, D.grosorMinimoMm),
    tamanoMinimoCm: num(c.tamanoMinimoCm, D.tamanoMinimoCm),
    tierVariants: c.tierVariants ?? [],
    colorVariant: c.colorVariant ?? null
  };
  // Sin los productos de extra conectados (una variante por tramo + color adicional) no se
  // muestra precio, porque no se podría cobrar. Excepción: el modo calibración (?calibrar=1).
  const calibrating = new URLSearchParams(window.location.search).has('calibrar');
  const ready = pricing.tierVariants.length >= pricing.tramos.length && pricing.colorVariant !== null;
  if (!ready && !calibrating) {
    console.warn('[br-studio] Calculadora desactivada: conecta "Extra de bordado" (una variante por tramo) y "Color adicional de bordado" en el editor de temas.');
    return undefined;
  }
  return pricing;
}

function mount() {
  const root = document.getElementById('br-studio');
  const data = document.getElementById('br-studio-config');
  if (!root || !data) return;
  const config = JSON.parse(data.textContent || '{}') as Config;

  if (!config.variants?.length) {
    root.innerHTML = '<p style="padding:2rem;text-align:center">Configura el producto personalizable en el editor de temas.</p>';
    return;
  }

  createRoot(root).render(
    <DesignStudio
      garmentIds={['sudadera']}
      altHref={config.altHref}
      priceNote={`Sudadera personalizada: ${config.price} + bordado`}
      ctaLabel="Elegir talla y añadir al carrito"
      highlights={['Te enviamos el boceto para aprobar antes de bordar', `Producción en 7–10 días laborables`]}
      pricing={pricingFrom(config.embroidery)}
      colorMode={(config.colorMode === 'stock' ? 'stock' : 'libre') as GarmentColorMode}
      stockColors={parseColorList(config.stockColors)}
      threadPaletteUrl={config.threadPaletteUrl}
      model={{ url: config.modelUrl || undefined, sizes: config.sizeChart?.filas }}
      renderCheckout={(p) => (
        <ShopifyAddToCart
          {...p}
          variants={config.variants}
          price={config.price}
          priceValue={config.priceValue}
          cartAddUrl={config.cartAddUrl}
          cartUrl={config.cartUrl || '/cart'}
          sizeChart={config.sizeChart}
        />
      )}
    />
  );
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
