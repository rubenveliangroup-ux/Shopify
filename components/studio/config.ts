export type GarmentType = 'sudadera' | 'hoodie' | 'camiseta';

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

export type Side = 'delante' | 'detras';
export const sides: { id: Side; label: string }[] = [
  { id: 'delante', label: 'Delante' },
  { id: 'detras', label: 'Detrás' }
];

/** Perfil del torso (radio, altura) en unidades de escena; lo comparten el modelo 3D y la silueta 2D. */
export const TORSO_PROFILE: [number, number][] = [
  [0.0, -0.78], [0.6, -0.78], [0.63, -0.6], [0.65, -0.2], [0.67, 0.2], [0.68, 0.45],
  [0.62, 0.58], [0.48, 0.67], [0.3, 0.72], [0.2, 0.74], [0.0, 0.74]
];
export const TORSO_DEPTH = 0.5;

/** Zona del torso que cubre cada lienzo (cuadrado, unidades de escena). */
export const PANEL = { centerY: -0.02, size: 1.66 };
/** Escala aproximada: 1,36 u de ancho de pecho ≈ 61 cm (talla M). */
export const CM_PER_UNIT = 45;
export const EDITOR_SIZE = 600; // px internos del lienzo de edición
export const TEXTURE_SIZE = 1024; // px de la textura que se proyecta en 3D
export const CM_PER_PX = (PANEL.size * CM_PER_UNIT) / EDITOR_SIZE;
