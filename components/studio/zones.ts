import { CM_PER_UNIT, LITE_FRAME, type Side } from './config';

/**
 * Zonas de bordado de la sudadera, en cm reales (talla M) medidos desde el punto alto del cuello:
 * `x` hacia la derecha de la foto (el pecho izquierdo de quien la lleva cae a la derecha), `y` hacia abajo.
 * Una sola fuente: «Diseña tu prenda» (opción «adjuntar imagen»), el formulario «Te lo diseñamos» y
 * las fotos de producto (tools/mockups.ts). `ancho` = tamaño propuesto; `max` = ancho máximo razonable.
 */
export type Zone = { id: string; label: string; side: Side; x: number; y: number; ancho: number; max: number };

export const ZONES: Zone[] = [
  { id: 'pecho-izquierdo', label: 'Pecho izquierdo', side: 'delante', x: 10, y: 17, ancho: 9, max: 12 },
  { id: 'pecho-derecho', label: 'Pecho derecho', side: 'delante', x: -10, y: 17, ancho: 9, max: 12 },
  { id: 'centro-pecho', label: 'Centro del pecho', side: 'delante', x: 0, y: 19, ancho: 22, max: 30 },
  { id: 'grande-delante', label: 'Grande delante', side: 'delante', x: 0, y: 27, ancho: 30, max: 34 },
  { id: 'manga-izquierda', label: 'Manga izquierda', side: 'delante', x: 34, y: 32, ancho: 7, max: 9 },
  { id: 'manga-derecha', label: 'Manga derecha', side: 'delante', x: -34, y: 32, ancho: 7, max: 9 },
  // Detrás, la capucha cae hasta ~14 cm bajo el cuello: las zonas empiezan debajo
  { id: 'bajo-capucha', label: 'Espalda alta (bajo la capucha)', side: 'detras', x: 0, y: 19, ancho: 10, max: 16 },
  { id: 'centro-espalda', label: 'Centro de la espalda', side: 'detras', x: 0, y: 30, ancho: 26, max: 32 },
  { id: 'grande-espalda', label: 'Grande en la espalda', side: 'detras', x: 0, y: 33, ancho: 32, max: 36 }
];

/** Punto alto del cuello en la escena (unidades) y encuadre de las fotos de la vista ligera. */
const NECK_Y = 0.79;
const FRAME_CM = LITE_FRAME.size * CM_PER_UNIT;
const NECK_IN_FRAME = (LITE_FRAME.centerY + LITE_FRAME.size / 2 - NECK_Y) / LITE_FRAME.size;

/** Posición de un punto (cm desde el cuello) en la foto de la vista ligera, en fracciones 0–1. */
export function cmToLite(x: number, y: number) {
  return { u: 0.5 + x / FRAME_CM, v: NECK_IN_FRAME + y / FRAME_CM };
}
/** Centímetros → fracción del ancho de la foto de la vista ligera. */
export const cmToLiteSize = (cm: number) => cm / FRAME_CM;
export const zoneById = (id: string) => ZONES.find((z) => z.id === id);
