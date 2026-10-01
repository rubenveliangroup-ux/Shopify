/**
 * Calculadora de bordado: configuración de precios y tramos.
 *
 * ÚNICO SITIO DE CONFIGURACIÓN. En la tienda Shopify estos valores se sobrescriben
 * desde el editor de temas (sección "Estudio de diseño BR" → "Calculadora de bordado");
 * estos son los valores por defecto. Los precios que paga el cliente son los de las
 * variantes de Shopify: en modo calibración (?calibrar=1) el estudio avisa si no
 * coinciden con esta fórmula.
 */
export type EmbroideryConfig = {
  /** Puntadas por cm² de superficie bordada (relleno). Calibrar con diseños reales. */
  puntadasPorCm2: number;
  /** Puntadas extra por cm de contorno (detalle, bordes, líneas). */
  puntadasPorCmBorde: number;
  /** Margen de seguridad sobre las puntadas estimadas (0.10 = +10 %). */
  margenSeguridad: number;
  /** € por cada 1.000 puntadas. */
  costePorMil: number;
  /** Multiplicador de margen comercial sobre el coste de puntadas. */
  multiplicadorMargen: number;
  /** € fijos de montaje y digitalización, incluidos en cada tramo. */
  cuotaFija: number;
  /** € por cada color de hilo a partir del segundo. */
  precioColorAdicional: number;
  /** Agujas de la máquina: máximo de colores por diseño. */
  maxColores: number;
  /** Topes de cada tramo (puntadas), en orden. Por encima del último: presupuesto. */
  tramos: number[];
  /** Colores que cubren menos de esta fracción del diseño no cuentan. */
  umbralColor: number;
  /** Grosor mínimo bordable (mm) y tamaño mínimo (cm) para los avisos. */
  grosorMinimoMm: number;
  tamanoMinimoCm: number;
};

export const DEFAULT_EMBROIDERY_CONFIG: EmbroideryConfig = {
  puntadasPorCm2: 150, // PROVISIONAL: calibrar con diseños reales (ver shopify-theme/CALCULADORA.md)
  puntadasPorCmBorde: 5, // PROVISIONAL
  margenSeguridad: 0.1,
  costePorMil: 0.75,
  multiplicadorMargen: 1.0,
  cuotaFija: 5, // PROVISIONAL
  precioColorAdicional: 1, // PROVISIONAL
  maxColores: 12,
  tramos: [5000, 10000, 15000, 20000],
  umbralColor: 0.01,
  grosorMinimoMm: 1,
  tamanoMinimoCm: 1.5
};

/** Variante de Shopify (precio en euros) que respalda cada tramo / el color adicional. */
export type PricedVariant = { id: number; title: string; price: number; available: boolean };

export type EmbroideryPricing = EmbroideryConfig & {
  /** Variantes de "Extra de bordado", una por tramo y en el mismo orden que `tramos`. */
  tierVariants: PricedVariant[];
  /** Variante única de "Color adicional de bordado". */
  colorVariant: PricedVariant | null;
};

/** Precio de un tramo según la fórmula configurada. */
export function formulaTierPrice(cfg: EmbroideryConfig, index: number) {
  const tope = cfg.tramos[index];
  return round2((tope / 1000) * cfg.costePorMil * cfg.multiplicadorMargen + cfg.cuotaFija);
}

export type Quote =
  | { kind: 'empty' }
  | { kind: 'too-many-colors'; colors: number; max: number }
  | { kind: 'quote-required'; stitches: number; colors: number }
  | {
      kind: 'priced';
      stitches: number;
      colors: number;
      tierIndex: number;
      tierLabel: string;
      tierPrice: number;
      extraColors: number;
      colorUnitPrice: number;
      colorsPrice: number;
      total: number;
      tierVariant: PricedVariant | null;
      colorVariant: PricedVariant | null;
    };

/** Asigna tramo y precio a unas puntadas (ya con margen) y un nº de colores. */
export function quote(p: EmbroideryPricing, stitches: number, colors: number): Quote {
  if (stitches <= 0 || colors <= 0) return { kind: 'empty' };
  if (colors > p.maxColores) return { kind: 'too-many-colors', colors, max: p.maxColores };
  const tierIndex = p.tramos.findIndex((tope) => stitches <= tope);
  if (tierIndex === -1) return { kind: 'quote-required', stitches, colors };

  const tierVariant = p.tierVariants[tierIndex] ?? null;
  // El precio que se muestra es el que cobrará Shopify; la fórmula solo si no hay variante.
  const tierPrice = tierVariant ? tierVariant.price : formulaTierPrice(p, tierIndex);
  const colorUnitPrice = p.colorVariant ? p.colorVariant.price : p.precioColorAdicional;
  const extraColors = Math.max(0, colors - 1);
  const colorsPrice = round2(extraColors * colorUnitPrice);
  const desde = tierIndex === 0 ? 0 : p.tramos[tierIndex - 1] + 1;
  return {
    kind: 'priced',
    stitches,
    colors,
    tierIndex,
    tierLabel: `Tramo ${tierIndex + 1} (${fmtInt(desde)}–${fmtInt(p.tramos[tierIndex])} puntadas)`,
    tierPrice,
    extraColors,
    colorUnitPrice,
    colorsPrice,
    total: round2(tierPrice + colorsPrice),
    tierVariant,
    colorVariant: p.colorVariant
  };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const fmtInt = (n: number) => new Intl.NumberFormat('es-ES').format(Math.round(n));
export const fmtEur = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
