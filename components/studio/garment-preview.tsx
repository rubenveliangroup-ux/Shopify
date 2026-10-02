'use client';

import { Component, Suspense, forwardRef, lazy, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { PANEL_IN_LITE, type Side } from './config';
import { createEmbroideryRelief, type EmbroideryRelief } from './embroidery-normal';
import type { ModelInfo, SizeRow } from './garment-glb';

/**
 * Vista previa de la prenda. Decide entre:
 *  - 3D (GLB): se descarga en un chunk aparte, solo en el estudio y después de cargar la página;
 *  - ligera 2D: foto de la prenda (render del mismo modelo) teñida del color elegido con el diseño
 *    encima. Se usa si no hay WebGL, el dispositivo es muy justo, la carga falla o el 3D va a tirones.
 * Forzar un modo para probar: ?modo3d=ligero o ?modo3d=3d.
 */
export type PreviewHandle = { snapshot: (side: Side) => string | null };
export type PreviewMode = 'cargando' | '3d' | 'ligero';

const Garment3D = lazy(() => import('./garment-3d'));

type Props = {
  color: string;
  view: Side;
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  version: number;
  modelUrl?: string;
  /** Fotos (render neutro, blanco) delante/detrás con el encuadre LITE_FRAME (config.ts). */
  liteImages?: Partial<Record<Side, string>>;
  size?: string;
  sizes?: SizeRow[];
  onModelReady?: (info: ModelInfo | null) => void;
  onSilhouettes?: (s: Record<Side, string> | null) => void;
  onModeChange?: (mode: PreviewMode, reason?: string) => void;
};

const param = () => (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('modo3d'));

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Motivo para no intentar el 3D en este dispositivo (null = se intenta). */
function liteReason(modelUrl?: string): string | null {
  if (param() === 'ligero') return 'forzado con ?modo3d=ligero';
  if (!modelUrl) return 'no hay modelo 3D configurado';
  if (!webglAvailable()) return 'el navegador no tiene WebGL';
  if (param() === '3d') return null;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return 'modo de ahorro de datos';
  if ((nav.deviceMemory ?? 8) <= 2 || (nav.hardwareConcurrency ?? 8) <= 2) return 'dispositivo con poca memoria';
  return null;
}

/** Espera a que cargue el resto de la página (y a un hueco libre) antes de pedir el 3D. */
function afterPageLoad(cb: () => void) {
  let cancelled = false;
  const run = () => {
    const idle = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(() => !cancelled && cb(), { timeout: 1500 });
    else setTimeout(() => !cancelled && cb(), 200);
  };
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener('load', run);
  };
}

const lowPowerDevice = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 768);

export const GarmentPreview = forwardRef<PreviewHandle, Props>(function GarmentPreview(props, ref) {
  const { modelUrl, onModeChange, onModelReady, onSilhouettes } = props;
  const [mode, setMode] = useState<PreviewMode>('cargando');
  const [reason, setReason] = useState<string | undefined>();
  const inner = useRef<PreviewHandle>(null);
  useImperativeHandle(ref, () => ({ snapshot: (s) => inner.current?.snapshot(s) ?? null }), []);

  const goLite = (why: string) => {
    setReason(why);
    setMode('ligero');
  };
  useEffect(() => {
    const why = liteReason(modelUrl);
    if (why) {
      goLite(why);
      return;
    }
    setMode('cargando');
    return afterPageLoad(() => setMode('3d'));
  }, [modelUrl]);
  useEffect(() => {
    onModeChange?.(mode, reason);
    if (mode === 'ligero') (onModelReady?.(null), onSilhouettes?.(null));
    if (mode === 'ligero' && reason) console.info('[br-studio] Vista ligera:', reason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, reason]);

  const [ready3d, setReady3d] = useState(false);
  if (mode === 'ligero' || !modelUrl) return <LitePreview ref={inner} {...props} />;
  return (
    <div className="relative h-full w-full">
      {mode === '3d' && (
        <ChunkBoundary onError={(e) => goLite(`no se pudo cargar el visor 3D (${e})`)}>
          <Suspense fallback={null}>
            <Garment3D
              ref={inner}
              {...props}
              modelUrl={modelUrl}
              lowPower={lowPowerDevice()}
              autoLite={param() !== '3d'}
              onModelReady={(info) => (setReady3d(!!info), onModelReady?.(info))}
              onFail={goLite}
            />
          </Suspense>
        </ChunkBoundary>
      )}
      {!ready3d && <Loading />}
    </div>
  );
});

function Loading() {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-sm text-tinta-700">
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-tinta/15 border-t-tinta" aria-hidden />
        Cargando vista 3D…
      </div>
    </div>
  );
}

class ChunkBoundary extends Component<{ onError: (reason: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error instanceof Error ? error.message : String(error));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// ---------------------------------------------------------------- vista ligera 2D

const images = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(url: string) {
  if (!images.has(url))
    images.set(
      url,
      new Promise((res, rej) => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => res(i);
        i.onerror = () => rej(new Error(`No se pudo cargar ${url}`));
        i.src = url;
      })
    );
  return images.get(url)!;
}

/**
 * Tiñe el render neutro (blanco) de la prenda: color × luz por multiplicación, más un brillo
 * aterciopelado en colores oscuros para que no se pierdan los pliegues (como hace el sheen en 3D).
 */
export function tintGarment(img: HTMLImageElement, hex: string, size: number, crop?: 'lienzo'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  if (crop === 'lienzo') {
    // Solo la zona del lienzo de edición (mismo encuadre que el editor)
    const W = img.naturalWidth;
    ctx.drawImage(img, PANEL_IN_LITE.x * W, PANEL_IN_LITE.y * W, PANEL_IN_LITE.size * W, PANEL_IN_LITE.size * W, 0, 0, size, size);
  } else ctx.drawImage(img, 0, 0, size, size);
  const d = ctx.getImageData(0, 0, size, size);
  const p = d.data;
  const n = parseInt(hex.replace('#', ''), 16);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const srgb = (v: number) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  const t = [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
  const lum = 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2];
  const dark = 1 - Math.min(1, lum * 3);
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const s = lin(p[i]) / 0.86; // el render neutro tiene el blanco de la tela en ~0,86 lineal
    const sheen = dark * 0.035 * Math.max(0, s - 0.6);
    for (let k = 0; k < 3; k++) p[i + k] = Math.min(255, srgb(Math.min(1, Math.max(t[k], 0.012) * s + sheen)));
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

const LITE_SIZE = 900;

const LitePreview = forwardRef<PreviewHandle, Props>(function LitePreview({ color, view, front, back, version, liteImages }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const relief = useRef<Record<Side, EmbroideryRelief> | null>(null);
  const [garments, setGarments] = useState<Partial<Record<Side, HTMLImageElement>>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    for (const s of ['delante', 'detras'] as const) {
      const url = liteImages?.[s];
      if (!url) continue;
      loadImage(url)
        .then((img) => live && setGarments((g) => ({ ...g, [s]: img })))
        .catch(() => live && setFailed(true));
    }
    return () => {
      live = false;
    };
  }, [liteImages]);

  const draw = (side: Side, target: HTMLCanvasElement) => {
    const ctx = target.getContext('2d')!;
    const S = target.width;
    ctx.clearRect(0, 0, S, S);
    const g = garments[side];
    if (g) ctx.drawImage(tintGarment(g, color, S), 0, 0);
    // El diseño ocupa el rectángulo del lienzo dentro de la foto: mismo tamaño real que en 3D
    const design = side === 'delante' ? front : back;
    const r = relief.current?.[side];
    const x = PANEL_IN_LITE.x * S;
    const y = PANEL_IN_LITE.y * S;
    const w = PANEL_IN_LITE.size * S;
    if (r) ctx.drawImage(r.shadow, x, y, w, w);
    ctx.drawImage(design, x, y, w, w);
    if (r) {
      // Luces y sombras de las puntadas solo sobre el diseño
      const tmp = document.createElement('canvas');
      tmp.width = tmp.height = Math.round(w);
      const t = tmp.getContext('2d')!;
      t.drawImage(design, 0, 0, w, w);
      t.globalCompositeOperation = 'overlay';
      t.drawImage(r.shade, 0, 0, w, w);
      t.globalCompositeOperation = 'destination-in';
      t.drawImage(design, 0, 0, w, w);
      ctx.drawImage(tmp, x, y);
    }
  };

  useEffect(() => {
    if (!relief.current) relief.current = { delante: createEmbroideryRelief(), detras: createEmbroideryRelief() };
    relief.current.delante.update(front);
    relief.current.detras.update(back);
    if (canvas.current) draw(view, canvas.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, color, view, garments, front, back]);

  useImperativeHandle(ref, () => ({
    snapshot: (side) => {
      const c = document.createElement('canvas');
      c.width = c.height = LITE_SIZE;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ece8e1';
      ctx.fillRect(0, 0, LITE_SIZE, LITE_SIZE);
      const layer = document.createElement('canvas');
      layer.width = layer.height = LITE_SIZE;
      draw(side, layer);
      ctx.drawImage(layer, 0, 0);
      return c.toDataURL('image/jpeg', 0.88);
    }
  }));

  return (
    <div className="relative h-full w-full bg-[#ece8e1]">
      <canvas ref={canvas} width={LITE_SIZE} height={LITE_SIZE} className="absolute inset-0 m-auto h-full max-h-full w-auto max-w-full" aria-label="Vista previa de la prenda" />
      {failed && <p className="absolute inset-x-0 top-1/2 text-center text-sm text-tinta-500">No se pudo cargar la imagen de la prenda.</p>}
    </div>
  );
});
