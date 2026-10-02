/**
 * Diseño de un lado, del tamaño del lienzo completo (PANEL), listo para proyectarlo sobre la prenda
 * (3D) o dibujarlo sobre la foto (vista ligera). Es una referencia de colocación: el diseño tal cual,
 * plano, sin simular el hilo.
 */
export type DesignLayers = { color: HTMLCanvasElement };

/** Dónde cae la imagen analizada dentro del lienzo, en fracciones del lienzo (0–1). */
export type Placement = { x: number; y: number; w: number; h: number };

export function createLayers(size: number): DesignLayers {
  const color = document.createElement('canvas');
  color.width = color.height = size;
  return { color };
}

export function clearLayers(l: DesignLayers) {
  l.color.getContext('2d')!.clearRect(0, 0, l.color.width, l.color.height);
}

/** El diseño tal cual, plano. */
export function drawFlat(l: DesignLayers, design: HTMLCanvasElement) {
  clearLayers(l);
  l.color.getContext('2d')!.drawImage(design, 0, 0, l.color.width, l.color.height);
}
