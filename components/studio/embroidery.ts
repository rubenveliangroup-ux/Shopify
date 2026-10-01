/**
 * Simula el aspecto del bordado sobre la textura: puntadas diagonales de satén,
 * luces/sombras del hilo y un ligero relieve en los bordes. Solo afecta a píxeles
 * con diseño (source-atop), el fondo sigue transparente.
 */
let pattern: HTMLCanvasElement | null = null;

function stitchPattern() {
  if (pattern) return pattern;
  const p = document.createElement('canvas');
  p.width = p.height = 12;
  const ctx = p.getContext('2d')!;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(-3, 12); ctx.lineTo(12, -3);
  ctx.moveTo(3, 15); ctx.lineTo(15, 3);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.moveTo(-1, 14); ctx.lineTo(14, -1);
  ctx.stroke();
  pattern = p;
  return p;
}

export function applyEmbroidery(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;

  // Sombra de relieve: copia desplazada y oscurecida por detrás
  const relief = document.createElement('canvas');
  relief.width = w;
  relief.height = h;
  const r = relief.getContext('2d')!;
  r.drawImage(canvas, 0, 0);
  r.globalCompositeOperation = 'source-in';
  r.fillStyle = 'rgba(0,0,0,0.45)';
  r.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.drawImage(relief, w * 0.003, h * 0.004);
  ctx.restore();

  // Puntadas
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = ctx.createPattern(stitchPattern(), 'repeat')!;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
