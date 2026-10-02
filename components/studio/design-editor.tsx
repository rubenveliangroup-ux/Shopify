'use client';

import { Canvas, FabricImage, IText, PencilBrush, Point, type FabricObject } from 'fabric';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { UploadIcon } from '../icons';
import { ColorPicker } from '../color/ColorPicker';
import { DEFAULT_THREADS, type Thread } from '../color/threads';
import { CM_PER_PX, EDITOR_SIZE, type Side } from './config';
import { removeWhiteBackground } from './embroidery-estimate';
import { GarmentSilhouette } from './silhouette';

export type EditorHandle = {
  /** Renderiza el diseño (sin controles) sobre un canvas del tamaño pedido. */
  renderTo: (target: HTMLCanvasElement) => void;
  exportPng: () => Promise<Blob | null>;
  isEmpty: () => boolean;
  /** Medidas aproximadas (cm) del conjunto del diseño, o null si está vacío. */
  getSize: () => { w: number; h: number } | null;
  /**
   * Diseño recortado a su contenido, a resolución de análisis (≈ cmPerPx por píxel),
   * con el fondo blanco de las imágenes subidas eliminado. Para la calculadora de bordado.
   */
  renderForAnalysis: (cmPerPx: number, maxPx: number) => { canvas: HTMLCanvasElement; cmPerPx: number; whiteRemoved: boolean } | null;
};

type Props = {
  side: Side;
  garmentColor: string;
  /** Vista real de la prenda (render del GLB a la escala del lienzo); si no hay, silueta dibujada. */
  silhouetteUrl?: string;
  /** Carta de hilos: los colores del diseño se ajustan al hilo real más cercano. */
  threads?: Thread[];
  onChange: () => void;
  onUpload: (file: File) => void;
};


const fonts = [
  { label: 'Serif', cssVar: '--font-display', weight: '600' },
  { label: 'Sans', cssVar: '--font-sans', weight: '700' },
  { label: 'Script', cssVar: '--font-script', weight: '400' },
  { label: 'Bold', cssVar: '--font-bold', weight: '400' }
];

function resolveFont(cssVar: string, scope?: Element | null) {
  const v = getComputedStyle(scope ?? document.documentElement).getPropertyValue(cssVar).trim();
  return v || 'sans-serif';
}

export const DesignEditor = forwardRef<EditorHandle, Props>(function DesignEditor({ side, garmentColor, silhouetteUrl, threads = DEFAULT_THREADS, onChange, onUpload }, ref) {
  const STORAGE_KEY = `br-studio-${side}`;
  const host = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const fc = useRef<Canvas | null>(null);
  const history = useRef<string[]>([]);
  const restoring = useRef(false);
  // Exportar llama a renderCanvas, que emite 'after:render': evitamos el bucle.
  const exporting = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'select' | 'draw'>('select');
  const [color, setColor] = useState(threads[0]?.hex ?? '#ffffff'); // hilo aplicado
  const [pickerValue, setPickerValue] = useState(color); // color que elige el cliente
  const [brush, setBrush] = useState(8);
  const [selected, setSelected] = useState<FabricObject | null>(null);
  const [count, setCount] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [dims, setDims] = useState<string | null>(null);

  const snapshot = useCallback(() => {
    const c = fc.current;
    if (!c || restoring.current) return;
    const json = JSON.stringify(c.toObject());
    history.current.push(json);
    if (history.current.length > 40) history.current.shift();
    setCanUndo(history.current.length > 1);
    setCount(c.getObjects().length);
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      /* almacenamiento lleno o bloqueado: no es crítico */
    }
  }, [STORAGE_KEY]);

  useEffect(() => {
    // Fabric manipula el DOM del canvas: lo creamos fuera de React para evitar conflictos.
    const el = document.createElement('canvas');
    host.current!.appendChild(el);
    const c = new Canvas(el, {
      width: EDITOR_SIZE,
      height: EDITOR_SIZE,
      preserveObjectStacking: true,
      selectionColor: 'rgba(194,70,31,0.08)',
      selectionBorderColor: '#c2461f'
    });
    c.setDimensions({ width: '100%', height: '100%' }, { cssOnly: true });
    fc.current = c;

    // Estilo de controles acorde a la marca
    FabricImage.ownDefaults.cornerColor = '#c2461f';
    IText.ownDefaults.cornerColor = '#c2461f';

    let frame = 0;
    const notify = () => {
      if (exporting.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => onChangeRef.current());
    };
    c.on('after:render', notify);
    c.on('object:added', snapshot);
    c.on('object:modified', snapshot);
    c.on('object:removed', snapshot);
    const measure = () => {
      const o = c.getActiveObject();
      setDims(o ? `${Math.round(o.getScaledWidth() * CM_PER_PX)} × ${Math.round(o.getScaledHeight() * CM_PER_PX)} cm` : null);
    };
    c.on('selection:created', (e) => {
      setSelected(e.selected?.[0] ?? null);
      measure();
    });
    c.on('selection:updated', (e) => {
      setSelected(e.selected?.[0] ?? null);
      measure();
    });
    c.on('selection:cleared', () => {
      setSelected(null);
      setDims(null);
    });
    c.on('object:scaling', measure);
    c.on('object:modified', measure);

    // Recuperar el último diseño de este navegador
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    if (saved) {
      restoring.current = true;
      c.loadFromJSON(saved)
        .then(() => {
          c.renderAll();
          restoring.current = false;
          snapshot();
        })
        .catch(() => {
          restoring.current = false;
          snapshot();
        });
    } else {
      snapshot();
    }

    const onKey = (e: KeyboardEvent) => {
      const active = c.getActiveObject();
      if (!active || (active instanceof IText && active.isEditing)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        c.remove(...c.getActiveObjects());
        c.discardActiveObject();
        c.requestRenderAll();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(frame);
      fc.current = null;
      const wrapper = c.wrapperEl;
      c.dispose().finally(() => {
        wrapper?.remove();
        el.remove();
      });
    };
  }, [snapshot, STORAGE_KEY]);

  // Modo dibujo
  useEffect(() => {
    const c = fc.current;
    if (!c) return;
    c.isDrawingMode = mode === 'draw';
    if (mode === 'draw') {
      const b = new PencilBrush(c);
      b.color = color;
      b.width = brush;
      b.decimate = 2;
      c.freeDrawingBrush = b;
    }
  }, [mode, color, brush]);

  useImperativeHandle(ref, () => ({
    renderTo(target) {
      const c = fc.current;
      const ctx = target.getContext('2d');
      if (!c || !ctx) return;
      ctx.clearRect(0, 0, target.width, target.height);
      exporting.current = true;
      let out: HTMLCanvasElement;
      try {
        out = c.toCanvasElement(target.width / EDITOR_SIZE);
      } finally {
        exporting.current = false;
      }
      ctx.drawImage(out, 0, 0, target.width, target.height);
    },
    async exportPng() {
      const c = fc.current;
      if (!c) return null;
      c.discardActiveObject();
      exporting.current = true;
      let url: string;
      try {
        url = c.toDataURL({ format: 'png', multiplier: 2 });
      } finally {
        exporting.current = false;
      }
      return (await fetch(url)).blob();
    },
    isEmpty: () => (fc.current?.getObjects().length ?? 0) === 0,
    renderForAnalysis(targetCmPerPx, maxPx) {
      const c = fc.current;
      const objs = c?.getObjects() ?? [];
      if (!c || !objs.length) return null;
      const rects = objs.map((o) => o.getBoundingRect());
      const left = Math.min(...rects.map((r) => r.left));
      const top = Math.min(...rects.map((r) => r.top));
      const w = Math.max(...rects.map((r) => r.left + r.width)) - left;
      const h = Math.max(...rects.map((r) => r.top + r.height)) - top;
      if (w <= 0 || h <= 0) return null;
      // px del editor → px de análisis
      let scale = CM_PER_PX / targetCmPerPx;
      if (Math.max(w, h) * scale > maxPx) scale = maxPx / Math.max(w, h);
      const out = document.createElement('canvas');
      out.width = Math.ceil(w * scale) + 2;
      out.height = Math.ceil(h * scale) + 2;
      const ctx = out.getContext('2d', { willReadFrequently: true })!;
      let whiteRemoved = false;
      exporting.current = true;
      try {
        objs.forEach((o, i) => {
          if (!o.visible) return;
          const oc = o.toCanvasElement({ multiplier: scale });
          if (o instanceof FabricImage && removeWhiteBackground(oc)) whiteRemoved = true;
          ctx.drawImage(oc, (rects[i].left - left) * scale + 1, (rects[i].top - top) * scale + 1);
        });
      } finally {
        exporting.current = false;
      }
      return { canvas: out, cmPerPx: CM_PER_PX / scale, whiteRemoved };
    },
    getSize() {
      const objs = fc.current?.getObjects() ?? [];
      if (!objs.length) return null;
      const rects = objs.map((o) => o.getBoundingRect());
      const l = Math.min(...rects.map((r) => r.left));
      const t = Math.min(...rects.map((r) => r.top));
      const r = Math.max(...rects.map((x) => x.left + x.width));
      const b = Math.max(...rects.map((x) => x.top + x.height));
      return { w: Math.round((r - l) * CM_PER_PX), h: Math.round((b - t) * CM_PER_PX) };
    }
  }));

  function add(obj: FabricObject) {
    const c = fc.current!;
    setMode('select');
    c.add(obj);
    // Por defecto, a la altura del pecho y centrado
    obj.setPositionByOrigin(new Point(EDITOR_SIZE / 2, EDITOR_SIZE * 0.36), 'center', 'center');
    obj.setCoords();
    c.setActiveObject(obj);
    c.requestRenderAll();
  }

  async function addImage(file: File) {
    if (!file.type.startsWith('image/')) return;
    onUpload(file);
    const url = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.readAsDataURL(file);
    });
    const img = await FabricImage.fromURL(url);
    const max = EDITOR_SIZE * 0.28;
    img.scale(Math.min(max / img.width, max / img.height, 1));
    add(img);
  }

  async function addText() {
    const f = fonts[0];
    const family = resolveFont(f.cssVar, host.current);
    await document.fonts.load(`${f.weight} 48px ${family}`).catch(() => {});
    add(new IText('Tu texto', { fontFamily: family, fontWeight: f.weight, fontSize: 72, fill: color, textAlign: 'center' }));
  }

  function applyColor(c: string) {
    setColor(c);
    const canvas = fc.current;
    const obj = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    if (obj instanceof IText) obj.set('fill', c);
    else if (obj.type === 'path') obj.set('stroke', c);
    else return;
    canvas.requestRenderAll();
    snapshot();
  }

  async function applyFont(cssVar: string, weight: string) {
    const canvas = fc.current;
    const obj = canvas?.getActiveObject();
    if (!canvas || !(obj instanceof IText)) return;
    const family = resolveFont(cssVar, host.current);
    await document.fonts.load(`${weight} 48px ${family}`).catch(() => {});
    obj.set({ fontFamily: family, fontWeight: weight });
    obj.initDimensions?.();
    canvas.requestRenderAll();
    snapshot();
  }

  function removeSelected() {
    const c = fc.current!;
    c.remove(...c.getActiveObjects());
    c.discardActiveObject();
    c.requestRenderAll();
  }

  async function undo() {
    const c = fc.current;
    if (!c || history.current.length < 2) return;
    history.current.pop();
    const prev = history.current[history.current.length - 1];
    restoring.current = true;
    await c.loadFromJSON(prev);
    c.renderAll();
    restoring.current = false;
    setCanUndo(history.current.length > 1);
    setCount(c.getObjects().length);
  }

  function clearAll() {
    const c = fc.current!;
    restoring.current = true;
    c.remove(...c.getObjects());
    restoring.current = false;
    c.discardActiveObject();
    c.requestRenderAll();
    snapshot();
  }

  const isText = selected instanceof IText;

  return (
    <div>
      {/* Herramientas principales */}
      <div className="grid grid-cols-3 gap-2">
        <ToolButton onClick={() => fileInput.current?.click()} icon={<UploadIcon className="h-5 w-5" />} label="Subir imagen" />
        <ToolButton onClick={addText} icon={<span className="font-display text-lg leading-none">Aa</span>} label="Texto" />
        <ToolButton
          active={mode === 'draw'}
          onClick={() => setMode((m) => (m === 'draw' ? 'select' : 'draw'))}
          icon={<span className="text-lg leading-none">✎</span>}
          label={mode === 'draw' ? 'Dibujando…' : 'Dibujar'}
        />
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) addImage(f);
          e.target.value = '';
        }}
      />

      {/* Lienzo */}
      <div
        className="relative mt-4 aspect-square w-full overflow-hidden rounded-2xl bg-lino-200 ring-1 ring-tinta/10"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) addImage(f);
        }}
      >
        {silhouetteUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- imagen generada en el navegador (data URL) */}
            <img src={silhouetteUrl} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
            <span className="pointer-events-none absolute left-3.5 top-2 text-[15px] text-black/35">{side === 'delante' ? 'DELANTE' : 'DETRÁS'}</span>
          </>
        ) : (
          <GarmentSilhouette color={garmentColor} side={side} />
        )}
        <div ref={host} className="absolute inset-0" />
        {count === 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-8 text-center">
            <p className="rounded-xl bg-lino-100/85 px-4 py-3 text-sm text-tinta-700">
              Arrastra aquí tu dibujo o foto,
              <br />
              escribe un texto o dibuja a mano.
              <br />
              <span className="text-xs text-tinta-500">Muévelo y escálalo donde quieras de la prenda.</span>
            </p>
          </div>
        )}
      </div>

      <p className="mt-2 h-5 text-xs text-tinta-500">
        {dims ? <>Tamaño de la selección: <strong className="text-tinta">≈ {dims}</strong> (talla M)</> : 'Selecciona un elemento para moverlo, girarlo o cambiar su tamaño.'}
      </p>

      {/* Color de hilo: cualquier color, ajustado al hilo real más cercano */}
      <div className="mt-4">
        <ColorPicker
          kind="thread"
          label={`Color de hilo ${mode === 'draw' ? '(pincel)' : selected ? '(selección)' : '(texto y dibujo)'}`}
          threads={threads}
          value={pickerValue}
          onChange={(d) => {
            setPickerValue(d.hex);
            if (!d.live) applyColor(d.thread?.hex ?? d.hex); // al soltar: se aplica el hilo real
          }}
        />
      </div>

      {mode === 'draw' && (
        <label className="mt-4 block">
          <span className="label">Grosor del trazo: {brush}px</span>
          <input type="range" min={2} max={30} value={brush} onChange={(e) => setBrush(Number(e.target.value))} className="w-full accent-hilo" />
        </label>
      )}

      {isText && (
        <div className="mt-4">
          <p className="label">Tipografía</p>
          <div className="flex flex-wrap gap-2">
            {fonts.map((f) => (
              <button
                key={f.label}
                onClick={() => applyFont(f.cssVar, f.weight)}
                className="rounded-full border border-tinta/20 px-4 py-1.5 text-sm hover:border-tinta"
                style={{ fontFamily: `var(${f.cssVar})`, fontWeight: Number(f.weight) }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-tinta-500">Doble clic sobre el texto para editarlo.</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <button
          onClick={() => {
            const c = fc.current;
            const o = c?.getActiveObject();
            if (!c || !o) return;
            c.centerObjectH(o);
            o.setCoords();
            c.requestRenderAll();
            snapshot();
          }}
          disabled={!selected}
          className="rounded-full border border-tinta/15 px-4 py-1.5 disabled:opacity-40"
        >
          ↔ Centrar
        </button>
        <button onClick={undo} disabled={!canUndo} className="rounded-full border border-tinta/15 px-4 py-1.5 disabled:opacity-40">↶ Deshacer</button>
        <button onClick={removeSelected} disabled={!selected} className="rounded-full border border-tinta/15 px-4 py-1.5 disabled:opacity-40">Eliminar selección</button>
        <button onClick={clearAll} disabled={count === 0} className="rounded-full border border-tinta/15 px-4 py-1.5 disabled:opacity-40">Empezar de cero</button>
      </div>
    </div>
  );
});

function ToolButton({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-medium transition',
        active ? 'border-hilo bg-hilo text-white' : 'border-tinta/15 bg-lino-100 hover:border-tinta'
      )}
    >
      {icon}
      {label}
    </button>
  );
}
