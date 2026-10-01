export type GarmentType = 'sudadera' | 'hoodie' | 'camiseta';
export type Placement = 'pecho' | 'centro' | 'espalda';

export const garments: { id: GarmentType; label: string }[] = [
  { id: 'sudadera', label: 'Sudadera' },
  { id: 'hoodie', label: 'Con capucha' },
  { id: 'camiseta', label: 'Camiseta' }
];

export const fabricColors = [
  { name: 'Negro', hex: '#1c1c1e' },
  { name: 'Crudo', hex: '#ece5d6' },
  { name: 'Gris jaspeado', hex: '#9b9b9d' },
  { name: 'Azul marino', hex: '#1f2a44' },
  { name: 'Verde bosque', hex: '#2f4a3a' },
  { name: 'Arena', hex: '#cdb898' },
  { name: 'Burdeos', hex: '#5b1f2b' }
];

/** Colores de hilo disponibles: limitarlos acerca el diseño a lo que realmente se puede bordar. */
export const threadColors = [
  '#ffffff', '#111111', '#c2461f', '#e8b53a', '#b98a3e', '#2f6b4f',
  '#1e3a5f', '#6aa6d8', '#d9849b', '#7a3e8e', '#8b5a2b', '#a8a8a8'
];

export const placements: { id: Placement; label: string; hint: string }[] = [
  { id: 'pecho', label: 'Pecho', hint: 'Pequeño, lado del corazón' },
  { id: 'centro', label: 'Centro', hint: 'Grande, delantero' },
  { id: 'espalda', label: 'Espalda', hint: 'Grande, trasero' }
];

/** Tamaño base del bordado (unidades de escena ≈ metros) y posición sobre el torso. */
export const placementTransform: Record<Placement, { pos: [number, number, number]; rot: [number, number, number]; size: number }> = {
  pecho: { pos: [0.24, 0.3, 0.31], rot: [0, 0, 0], size: 0.26 },
  centro: { pos: [0, 0.12, 0.34], rot: [0, 0, 0], size: 0.62 },
  espalda: { pos: [0, 0.14, -0.34], rot: [0, Math.PI, 0], size: 0.7 }
};

export const EDITOR_SIZE = 600; // px internos del lienzo de edición
export const TEXTURE_SIZE = 1024; // px de la textura que se proyecta en 3D
