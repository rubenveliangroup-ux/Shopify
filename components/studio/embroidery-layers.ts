import type { ThreadMaps } from './embroidery-threadize';

/**
 * Capas del bordado de un lado, del tamaño del lienzo completo (PANEL) para proyectarlas sobre
 * la prenda: color del hilo, relieve (normal map), dirección de la puntada (anisotropía), sombra
 * de contacto y sombreado para la vista 2D. Las rellena el resultado del hilado (en su posición).
 */
export type DesignLayers = {
  color: HTMLCanvasElement;
  normal: HTMLCanvasElement;
  aniso: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
  shade: HTMLCanvasElement;
};

/** Dónde cae la imagen analizada dentro del lienzo, en fracciones del lienzo (0–1). */
export type Placement = { x: number; y: number; w: number; h: number };

const FLAT_NORMAL = 'rgb(128,128,255)';

export function createLayers(size: number): DesignLayers {
  const make = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  };
  const l = { color: make(), normal: make(), aniso: make(), shadow: make(), shade: make() };
  clearLayers(l);
  return l;
}

export function clearLayers(l: DesignLayers) {
  for (const c of Object.values(l)) c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
  const n = l.normal.getContext('2d')!;
  n.fillStyle = FLAT_NORMAL;
  n.fillRect(0, 0, l.normal.width, l.normal.height);
}

const toCanvas = (data: Uint8ClampedArray, w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  return c;
};

/** Pinta el resultado del hilado en su sitio. */
export function drawThreadMaps(l: DesignLayers, maps: ThreadMaps, at: Placement) {
  clearLayers(l);
  const S = l.color.width;
  const [x, y, w, h] = [at.x * S, at.y * S, at.w * S, at.h * S];
  const draw = (target: HTMLCanvasElement, src: HTMLCanvasElement, smooth = true) => {
    const ctx = target.getContext('2d')!;
    ctx.imageSmoothingEnabled = smooth;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, x, y, w, h);
  };
  const color = toCanvas(maps.color, maps.w, maps.h);
  draw(l.color, color);
  draw(l.normal, toCanvas(maps.normal, maps.w, maps.h));
  draw(l.aniso, toCanvas(maps.aniso, maps.w, maps.h));
  draw(l.shade, toCanvas(maps.shade, maps.w, maps.h));
  drawShadow(l);
}

/** Sin efecto bordado: el diseño tal cual, plano. */
export function drawFlat(l: DesignLayers, design: HTMLCanvasElement) {
  clearLayers(l);
  l.color.getContext('2d')!.drawImage(design, 0, 0, l.color.width, l.color.height);
}

/** Sombra de contacto: el hilo levanta ~1 mm y oscurece la tela alrededor, algo más abajo. */
function drawShadow(l: DesignLayers) {
  const S = l.shadow.width;
  const ctx = l.shadow.getContext('2d')!;
  ctx.clearRect(0, 0, S, S);
  ctx.filter = `blur(${Math.max(1.5, S / 600)}px) brightness(0)`;
  ctx.globalAlpha = 0.5;
  ctx.drawImage(l.color, S / 1200, S / 700);
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
}
