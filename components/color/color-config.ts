/**
 * Configuración de color de la prenda (valores por defecto).
 * En la tienda se cambia desde el editor de temas → sección «Estudio de diseño BR».
 */
export type NamedColor = { name: string; hex: string };

/** "libre": cualquier color (sujeto a confirmación) · "stock": solo COLORES_STOCK. */
export type GarmentColorMode = 'libre' | 'stock';
export const MODO_COLOR_PRENDA: GarmentColorMode = 'libre';

/** Colores de prenda disponibles en modo "stock" (y sugeridos arriba en modo "libre"). */
export const COLORES_STOCK: NamedColor[] = [
  { name: 'Negro', hex: '#1c1c1e' },
  { name: 'Crudo', hex: '#ece5d6' },
  { name: 'Gris jaspeado', hex: '#9b9b9d' },
  { name: 'Azul marino', hex: '#1f2a44' },
  { name: 'Verde bosque', hex: '#2f4a3a' },
  { name: 'Arena', hex: '#cdb898' },
  { name: 'Burdeos', hex: '#5b1f2b' }
];

/** Colores habituales de prenda que se ofrecen en la cuadrícula en modo "libre". */
export const COLORES_HABITUALES: NamedColor[] = [
  ...COLORES_STOCK,
  { name: 'Blanco', hex: '#f7f7f5' },
  { name: 'Gris marengo', hex: '#3b3d42' },
  { name: 'Azul cielo', hex: '#a9c7e3' },
  { name: 'Azul royal', hex: '#2a4fa0' },
  { name: 'Verde salvia', hex: '#a3b49a' },
  { name: 'Verde oliva', hex: '#5f6236' },
  { name: 'Lila', hex: '#c7b4d9' },
  { name: 'Rosa palo', hex: '#ecc6c4' },
  { name: 'Rojo', hex: '#b3202a' },
  { name: 'Teja', hex: '#b5532f' },
  { name: 'Mostaza', hex: '#d1a136' },
  { name: 'Marrón', hex: '#5d4231' }
];

export const AVISO_COLOR_LIBRE = 'Color sujeto a confirmación de disponibilidad';

/** Nombre legible de un color: el de la lista si coincide, si no "Personalizado". */
export function colorName(hex: string, lists: NamedColor[][] = [COLORES_HABITUALES]) {
  const h = hex.toLowerCase();
  for (const l of lists) {
    const c = l.find((x) => x.hex.toLowerCase() === h);
    if (c) return c.name;
  }
  return 'Personalizado';
}

/** Lee la lista de stock desde texto ("Negro #1c1c1e" por línea). */
export function parseColorList(text: string | undefined | null): NamedColor[] {
  if (!text) return [];
  return text
    .split(/\n|;/)
    .map((line) => {
      const m = line.trim().match(/^(.*?)[\s:,]*#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\s*$/);
      if (!m) return null;
      const raw = m[2].length === 3 ? m[2].split('').map((c) => c + c).join('') : m[2];
      return { name: m[1].trim() || `#${raw}`, hex: `#${raw.toLowerCase()}` };
    })
    .filter((c): c is NamedColor => c !== null);
}

/** Colores de referencia para dar un nombre aproximado a cualquier color libre. */
const NOMBRES_REFERENCIA: NamedColor[] = [
  ...COLORES_HABITUALES,
  { name: 'Negro', hex: '#000000' },
  { name: 'Blanco', hex: '#ffffff' },
  { name: 'Gris', hex: '#808080' },
  { name: 'Gris claro', hex: '#c8c8c8' },
  { name: 'Rojo', hex: '#e02020' },
  { name: 'Naranja', hex: '#f07c1f' },
  { name: 'Amarillo', hex: '#f5d020' },
  { name: 'Verde', hex: '#2e9a44' },
  { name: 'Verde lima', hex: '#9acd32' },
  { name: 'Turquesa', hex: '#20b2aa' },
  { name: 'Azul', hex: '#1f5fbf' },
  { name: 'Azul claro', hex: '#7fb3e6' },
  { name: 'Morado', hex: '#6a2c91' },
  { name: 'Rosa', hex: '#e8589c' },
  { name: 'Fucsia', hex: '#c4167c' },
  { name: 'Beige', hex: '#e3d3b5' },
  { name: 'Marrón claro', hex: '#9a6b45' }
];

/** Nombre aproximado de cualquier color («≈ Burdeos»), por cercanía en Lab. */
export function approxColorName(hex: string): string {
  const exact = colorName(hex, [COLORES_HABITUALES]);
  if (exact !== 'Personalizado') return exact;
  const lab = (h: string) => {
    const n = parseInt(h.replace('#', ''), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    const x = (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047;
    const y = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
    const z = (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883;
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  };
  const p = lab(hex);
  let best = NOMBRES_REFERENCIA[0];
  let bd = Infinity;
  for (const c of NOMBRES_REFERENCIA) {
    const q = lab(c.hex);
    const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
    if (d < bd) [bd, best] = [d, c];
  }
  return `≈ ${best.name}`;
}
