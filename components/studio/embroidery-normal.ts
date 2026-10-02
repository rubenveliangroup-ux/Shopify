/**
 * Relieve de "bordado" a partir del lienzo del diseño, sin depender de three.js (lo usan el visor 3D
 * y la vista previa ligera 2D):
 *  - normal map: las zonas con tinta se levantan (cúpula redondeada en los bordes) y llevan un
 *    rayado diagonal fino como las puntadas de satén;
 *  - sombra: el hilo levanta ~1 mm sobre la tela y proyecta una sombra suave abajo a la derecha;
 *  - luz: sombreado de las puntadas para la vista 2D (sin 3D).
 * Se recalcula solo cuando cambia el diseño.
 */
const SIZE = 512; // resolución del relieve (suficiente: las puntadas son un efecto de luz)
const STITCH_PERIOD = 3.2; // px del relieve entre puntadas (~4,6 mm sobre el lienzo de 74,7 cm)
const STRENGTH = 2.2;

export type EmbroideryRelief = {
  /** Normal map (RGB) del relieve. */
  normal: HTMLCanvasElement;
  /** Sombra de contacto (negro con alfa) para dibujar debajo del diseño. */
  shadow: HTMLCanvasElement;
  /** Luces y sombras de las puntadas (gris con alfa, para fusionar en 2D con "overlay"). */
  shade: HTMLCanvasElement;
  update: (source: HTMLCanvasElement) => void;
};

export function createEmbroideryRelief(): EmbroideryRelief {
  const make = () => {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    return c;
  };
  const normal = make();
  const shadow = make();
  const shade = make();
  const work = make();

  function update(source: HTMLCanvasElement) {
    const wctx = work.getContext('2d', { willReadFrequently: true })!;
    wctx.clearRect(0, 0, SIZE, SIZE);
    // Alfa difuminado = cúpula del relleno; el desenfoque redondea los bordes
    wctx.filter = 'blur(2px)';
    wctx.drawImage(source, 0, 0, SIZE, SIZE);
    wctx.filter = 'none';
    const a = wctx.getImageData(0, 0, SIZE, SIZE).data;
    const h = new Float32Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const i = y * SIZE + x;
        const m = a[i * 4 + 3] / 255;
        if (m === 0) continue;
        const stitch = 0.5 + 0.5 * Math.sin(((x + y) / STITCH_PERIOD) * Math.PI);
        h[i] = m * (0.75 + 0.25 * stitch);
      }
    }
    const nctx = normal.getContext('2d')!;
    const sctx = shade.getContext('2d')!;
    const out = nctx.createImageData(SIZE, SIZE);
    const lit = sctx.createImageData(SIZE, SIZE);
    const o = out.data;
    const l = lit.data;
    for (let y = 0; y < SIZE; y++) {
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(SIZE - 1, y + 1);
      for (let x = 0; x < SIZE; x++) {
        const x0 = Math.max(0, x - 1);
        const x1 = Math.min(SIZE - 1, x + 1);
        const dx = (h[y * SIZE + x1] - h[y * SIZE + x0]) * STRENGTH;
        // El lienzo crece hacia abajo y la textura hacia arriba (flipY): se invierte dy
        const dy = (h[y0 * SIZE + x] - h[y1 * SIZE + x]) * STRENGTH;
        const len = Math.hypot(dx, dy, 1);
        const nx = -dx / len;
        const ny = -dy / len;
        const nz = 1 / len;
        const j = (y * SIZE + x) * 4;
        o[j] = (nx * 0.5 + 0.5) * 255;
        o[j + 1] = (ny * 0.5 + 0.5) * 255;
        o[j + 2] = (nz * 0.5 + 0.5) * 255;
        o[j + 3] = 255;
        // Luz de arriba a la izquierda: >128 aclara, <128 oscurece (modo "overlay")
        const diff = (-nx * 0.55 + ny * 0.55 + nz * 0.63 - 0.63) * 2.2;
        l[j] = l[j + 1] = l[j + 2] = Math.max(0, Math.min(255, 128 + diff * 128));
        l[j + 3] = a[j + 3];
      }
    }
    nctx.putImageData(out, 0, 0);
    sctx.putImageData(lit, 0, 0);
    // Sombra: silueta del diseño desplazada y difuminada
    const shctx = shadow.getContext('2d')!;
    shctx.clearRect(0, 0, SIZE, SIZE);
    shctx.filter = 'blur(2.5px) brightness(0)';
    shctx.globalAlpha = 0.55;
    shctx.drawImage(source, 1.5, 2.5, SIZE, SIZE);
    shctx.globalAlpha = 1;
    shctx.filter = 'none';
  }

  return { normal, shadow, shade, update };
}
