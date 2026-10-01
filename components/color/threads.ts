/**
 * Paleta de hilos de bordado.
 *
 * En la tienda, la paleta real se lee de `assets/br-hilos.json` del tema (editable desde
 * «Editar código», sin recompilar). Esta lista es la paleta por defecto/de respaldo:
 * tonos habituales de hilo de poliéster con códigos propios «BR-xxx», provisionales.
 * Sustitúyela por la carta de hilos real (mismo formato: código, nombre, hex).
 */
import { deltaE2000, hexToLab, normalizeHex, type Lab } from './color-math';

export type Thread = { code: string; name: string; hex: string };

export const DEFAULT_THREADS: Thread[] = [
  { code: 'BR-001', name: 'Blanco óptico', hex: '#ffffff' },
  { code: 'BR-002', name: 'Blanco roto', hex: '#f3eee2' },
  { code: 'BR-003', name: 'Crudo', hex: '#e6dcc6' },
  { code: 'BR-004', name: 'Arena', hex: '#cdb894' },
  { code: 'BR-005', name: 'Camel', hex: '#b08350' },
  { code: 'BR-006', name: 'Marrón chocolate', hex: '#5a3a26' },
  { code: 'BR-007', name: 'Negro', hex: '#111111' },
  { code: 'BR-008', name: 'Gris marengo', hex: '#3d3f43' },
  { code: 'BR-009', name: 'Gris medio', hex: '#8a8c8e' },
  { code: 'BR-010', name: 'Gris perla', hex: '#c9cacb' },
  { code: 'BR-011', name: 'Amarillo limón', hex: '#f4e04d' },
  { code: 'BR-012', name: 'Amarillo oro', hex: '#f2b705' },
  { code: 'BR-013', name: 'Mostaza', hex: '#c99a2e' },
  { code: 'BR-014', name: 'Oro viejo', hex: '#b98a3e' },
  { code: 'BR-015', name: 'Naranja', hex: '#f07c1f' },
  { code: 'BR-016', name: 'Teja', hex: '#c2461f' },
  { code: 'BR-017', name: 'Rojo', hex: '#c8102e' },
  { code: 'BR-018', name: 'Granate', hex: '#7a1f2b' },
  { code: 'BR-019', name: 'Rosa palo', hex: '#e8b4b8' },
  { code: 'BR-020', name: 'Rosa chicle', hex: '#e8589c' },
  { code: 'BR-021', name: 'Fucsia', hex: '#c4167c' },
  { code: 'BR-022', name: 'Lila', hex: '#b39ddb' },
  { code: 'BR-023', name: 'Morado', hex: '#5e2b7e' },
  { code: 'BR-024', name: 'Azul cielo', hex: '#8ec5e8' },
  { code: 'BR-025', name: 'Azul celeste', hex: '#4a90c8' },
  { code: 'BR-026', name: 'Azul royal', hex: '#1f4fa3' },
  { code: 'BR-027', name: 'Azul marino', hex: '#1b2a4a' },
  { code: 'BR-028', name: 'Turquesa', hex: '#1fa6a0' },
  { code: 'BR-029', name: 'Verde menta', hex: '#9ed9b5' },
  { code: 'BR-030', name: 'Verde hierba', hex: '#3f9b3a' },
  { code: 'BR-031', name: 'Verde botella', hex: '#1e5a3a' },
  { code: 'BR-032', name: 'Verde oliva', hex: '#6b6b2e' },
  { code: 'BR-033', name: 'Caqui', hex: '#8b7d55' },
  { code: 'BR-034', name: 'Plata (metalizado)', hex: '#b8bcc0' },
  { code: 'BR-035', name: 'Oro (metalizado)', hex: '#c9a54a' }
];

type ThreadLab = Thread & { lab: Lab };
const cache = new WeakMap<Thread[], ThreadLab[]>();
const withLab = (palette: Thread[]) => {
  let v = cache.get(palette);
  if (!v) cache.set(palette, (v = palette.map((t) => ({ ...t, lab: hexToLab(t.hex) }))));
  return v;
};

/** Hilo real más cercano (CIEDE2000) a un color cualquiera. */
export function nearestThread(hex: string, palette: Thread[] = DEFAULT_THREADS): Thread {
  const lab = hexToLab(hex);
  let best = withLab(palette)[0], bd = Infinity;
  for (const t of withLab(palette)) {
    const d = deltaE2000(lab, t.lab);
    if (d < bd) [bd, best] = [d, t];
  }
  return { code: best.code, name: best.name, hex: best.hex };
}

/** Valida una paleta cargada desde JSON; si no es válida devuelve la de respaldo. */
export function parseThreadPalette(data: unknown): Thread[] {
  if (!Array.isArray(data)) return DEFAULT_THREADS;
  const out = data
    .map((t) => {
      const hex = normalizeHex(String((t as Thread)?.hex ?? ''));
      return hex ? { code: String((t as Thread).code ?? ''), name: String((t as Thread).name ?? hex), hex } : null;
    })
    .filter((t): t is Thread => t !== null);
  return out.length ? out : DEFAULT_THREADS;
}

let loaded: Promise<Thread[]> | null = null;
/** Carga (una vez) la paleta del tema; si falla, usa la de respaldo. */
export function loadThreadPalette(url?: string | null): Promise<Thread[]> {
  if (!url) return Promise.resolve(DEFAULT_THREADS);
  loaded ??= fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then(parseThreadPalette)
    .catch(() => DEFAULT_THREADS);
  return loaded;
}

export const threadLabel = (t: Thread) => `${t.code ? t.code + ' ' : ''}${t.name}`;
