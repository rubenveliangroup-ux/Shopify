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
