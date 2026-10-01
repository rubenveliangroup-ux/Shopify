import * as THREE from 'three';

/**
 * Normal map de "bordado" a partir del lienzo del diseño: las zonas con tinta se levantan
 * (relieve redondeado en los bordes) y llevan un rayado diagonal fino como las puntadas de
 * satén. Se recalcula solo cuando cambia el diseño.
 */
const SIZE = 512; // resolución del relieve (suficiente: las puntadas son un efecto de luz)
const STITCH_PERIOD = 3.2; // px del relieve entre puntadas (~4,6 mm sobre el lienzo de 74,7 cm)
const STRENGTH = 2.2;

export function createEmbroideryNormal() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  const work = document.createElement('canvas');
  work.width = work.height = SIZE;

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
    const ctx = canvas.getContext('2d')!;
    const out = ctx.createImageData(SIZE, SIZE);
    const o = out.data;
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
        const j = (y * SIZE + x) * 4;
        o[j] = ((-dx / len) * 0.5 + 0.5) * 255;
        o[j + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
        o[j + 2] = ((1 / len) * 0.5 + 0.5) * 255;
        o[j + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
    texture.needsUpdate = true;
  }

  return { texture, update };
}
