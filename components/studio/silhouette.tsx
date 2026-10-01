import { EDITOR_SIZE, PANEL, TORSO_PROFILE, type Side } from './config';

const S = EDITOR_SIZE;
const toX = (x: number) => S / 2 + (x / PANEL.size) * S;
const toY = (y: number) => ((PANEL.centerY + PANEL.size / 2 - y) / PANEL.size) * S;

/** Contorno del torso proyectado (mismo perfil que la malla 3D, vista frontal). */
const outline = (() => {
  const pts = TORSO_PROFILE.filter(([r]) => r > 0);
  const right = [...pts].reverse().map(([r, y]) => `${toX(r).toFixed(1)},${toY(y).toFixed(1)}`);
  const left = pts.map(([r, y]) => `${toX(-r).toFixed(1)},${toY(y).toFixed(1)}`);
  return `M${right.join(' L')} L${left.join(' L')} Z`;
})();

/**
 * Silueta de la prenda detrás del lienzo de edición: lo que el cliente coloca aquí
 * cae en el mismo sitio de la sudadera 3D.
 */
export function GarmentSilhouette({ color, side }: { color: string; side: Side }) {
  const neckTop = toY(0.74);
  const neckDepth = side === 'delante' ? 34 : 12;
  const neckHalf = (0.21 / PANEL.size) * S;
  const hem = toY(-0.7);
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <path d={outline} fill={color} stroke="rgba(0,0,0,.18)" strokeWidth="2" />
      {/* Cuello */}
      <path
        d={`M${S / 2 - neckHalf},${neckTop} Q${S / 2},${neckTop + neckDepth * 2} ${S / 2 + neckHalf},${neckTop}`}
        fill="rgba(0,0,0,.18)"
        stroke="rgba(0,0,0,.25)"
        strokeWidth="2"
      />
      {/* Canalé del bajo */}
      <line x1={toX(-0.61)} x2={toX(0.61)} y1={hem} y2={hem} stroke="rgba(0,0,0,.2)" strokeWidth="2" strokeDasharray="6 5" />
      <text x={14} y={26} textAnchor="start" fontSize="15" fill="rgba(0,0,0,.35)" style={{ fontFamily: 'sans-serif' }}>
        {side === 'delante' ? 'DELANTE' : 'DETRÁS'}
      </text>
    </svg>
  );
}
