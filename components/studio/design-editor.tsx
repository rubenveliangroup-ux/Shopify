'use client';

import { Canvas, FabricImage, IText, PencilBrush, type FabricObject } from 'fabric';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { UploadIcon } from '../icons';
import { EDITOR_SIZE, threadColors } from './config';

export type EditorHandle = {
  /** Renderiza el diseño (sin controles) sobre un canvas del tamaño pedido. */
  renderTo: (target: HTMLCanvasElement) => void;
  exportPng: () => Promise<Blob | null>;
  isEmpty: () => boolean;
};

type Props = {
  background: string;
  onChange: () => void;
  onUpload: (file: File) => void;
};

const STORAGE_KEY = 'br-studio-design';

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

export const DesignEditor = forwardRef<EditorHandle, Props>(function DesignEditor({ background, onChange, onUpload }, ref) {
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
  const [color, setColor] = useState(threadColors[0]);
  const [brush, setBrush] = useState(8);
  const [selected, setSelected] = useState<FabricObject | null>(null);
  const [count, setCount] = useState(0);
  const [canUndo, setCanUndo] = useState(false);

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
  }, []);

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
    c.on('selection:created', (e) => setSelected(e.selected?.[0] ?? null));
    c.on('selection:updated', (e) => setSelected(e.selected?.[0] ?? null));
    c.on('selection:cleared', () => setSelected(null));

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
  }, [snapshot]);

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
    isEmpty: () => (fc.current?.getObjects().length ?? 0) === 0
  }));

  function add(obj: FabricObject) {
    const c = fc.current!;
    setMode('select');
    c.add(obj);
    c.centerObject(obj);
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
    const max = EDITOR_SIZE * 0.7;
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
        className="relative mt-4 aspect-square w-full overflow-hidden rounded-2xl ring-1 ring-tinta/10"
        style={{ background }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) addImage(f);
        }}
      >
        <div className="pointer-events-none absolute inset-3 rounded-xl border border-dashed border-white/40 mix-blend-difference" />
        <div ref={host} className="absolute inset-0" />
        {count === 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-8 text-center">
            <p className="text-sm text-white/70 mix-blend-difference">
              Arrastra aquí tu dibujo o foto,
              <br />
              escribe un texto o dibuja a mano
            </p>
          </div>
        )}
      </div>

      {/* Color de hilo */}
      <div className="mt-4">
        <p className="label">Color de hilo {mode === 'draw' ? '(pincel)' : selected ? '(selección)' : ''}</p>
        <div className="flex flex-wrap gap-2">
          {threadColors.map((c) => (
            <button
              key={c}
              aria-label={`Hilo ${c}`}
              onClick={() => applyColor(c)}
              className={cn('h-8 w-8 rounded-full ring-1 ring-tinta/20 transition', color === c && 'ring-2 ring-hilo ring-offset-2 ring-offset-lino')}
              style={{ background: c }}
            />
          ))}
        </div>
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
