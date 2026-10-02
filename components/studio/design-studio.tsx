'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ArrowIcon } from '../icons';
import { ColorPicker } from '../color/ColorPicker';
import { AVISO_COLOR_LIBRE, COLORES_HABITUALES, COLORES_STOCK, MODO_COLOR_PRENDA, type GarmentColorMode, type NamedColor } from '../color/color-config';
import { DEFAULT_THREADS, loadThreadPalette, type Thread } from '../color/threads';
import { AVISO_3D, CASILLA_3D } from './aviso';
import { garments, sides, TEXTURE_SIZE, type GarmentType, type Side } from './config';
import { DesignEditor, type EditorHandle } from './design-editor';
import { createThreadizer } from './embroidery-client';
import type { DesignAnalysis } from './embroidery-estimate';
import { createLayers, drawFlat } from './embroidery-layers';
import { buildEstimate, EmbroideryPanel, type EmbroideryEstimate } from './embroidery-panel';
import { DEFAULT_EMBROIDERY_CONFIG, type EmbroideryPricing } from './embroidery-pricing';
import type { ModelInfo, SizeRow } from './garment-glb';
import { GarmentPreview, loadImage, tintGarment, type PreviewHandle, type PreviewMode } from './garment-preview';
import { capturePlacement, describePlacements, ImagePlacement, type ImagePlacementValue } from './image-placement';
import { SendDesign } from './send-design';
import { SizeChart, type SizeChartData } from './size-chart';
import { zoneById } from './zones';

export type Attachment = { label: string; file: File };

export type CheckoutProps = {
  onClose: () => void;
  /** Archivos que se adjuntan (diseños, capturas de la vista, imágenes subidas). */
  getAttachments: () => Promise<Attachment[]>;
  /** Especificaciones legibles: se guardan como propiedades del pedido o en el brief. */
  details: [string, string][];
  prenda: GarmentType;
  ubicacion: 'pecho' | 'centro' | 'espalda' | 'no-se';
  color: string;
  /** Si existe, el envío está bloqueado y se muestra este aviso. */
  blockedReason?: string;
  /** Color de prenda elegido; `free` = modo libre (sujeto a confirmación de disponibilidad). */
  garment?: { name: string; hex: string; free: boolean };
  /** Estimación de bordado (con calculadora activa). */
  embroidery?: EmbroideryEstimate & { sizes: string };
  /** Talla elegida en el paso 1 (se preselecciona). */
  size?: string;
};

/** Lo que el cliente ya eligió arriba: precarga el formulario «Te lo diseñamos nosotros». */
export type RequestPrefill = { prenda: string; talla?: string; color: NamedColor; zonas: string[]; tamano: string };

type StudioProps = {
  /** Prendas que se ofrecen (por defecto, todas). */
  garmentIds?: GarmentType[];
  /** Sin formulario propio (`renderRequest`), el bloque «Te lo diseñamos» enlaza aquí. */
  altHref?: string;
  /** Texto con el precio de partida que se muestra junto al botón final. */
  priceNote?: string;
  ctaLabel?: string;
  /** Tallas de la prenda (variantes) y tabla de medidas. */
  sizeOptions?: { title: string; available: boolean }[];
  sizeChart?: SizeChartData;
  /** Diálogo final: en Next envía un brief; en Shopify añade al carrito. */
  renderCheckout?: (props: CheckoutProps) => React.ReactNode;
  /** «Enviar mi diseño»: manda el resumen, la vista previa y el contacto a la tienda. */
  renderSend?: (props: CheckoutProps) => React.ReactNode;
  /** Formulario «¿Prefieres que te lo diseñemos nosotros?» (camino B). */
  renderRequest?: (prefill: RequestPrefill) => React.ReactNode;
  /** Calculadora de bordado (precios y tramos). Sin ella, el estudio funciona sin precio. */
  pricing?: EmbroideryPricing;
  /** "libre" (cualquier color, sujeto a confirmación) o "stock" (solo stockColors). */
  colorMode?: GarmentColorMode;
  stockColors?: NamedColor[];
  /** URL del JSON con la carta de hilos (assets/br-hilos.json en el tema). */
  threadPaletteUrl?: string;
  /** URL del worker del cálculo de puntadas (assets/br-bordado-worker.js); sin ella, se calcula en la página. */
  workerUrl?: string;
  /**
   * GLB de la prenda, fotos para la vista ligera (delante/detrás) y medidas por talla
   * (MODELO-3D.md). Sin GLB o si el 3D no es viable, se usa la vista ligera.
   */
  model?: { url?: string; liteImages?: Partial<Record<Side, string>>; sizes?: SizeRow[] };
};

type Method = 'estudio' | 'imagen';

/** Lienzo con el diseño de un lado, a la resolución que se proyecta sobre la prenda. */
function useSideCanvas() {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TEXTURE_SIZE;
    return canvas;
  }, []);
}

const garmentLabel = (id: GarmentType) => garments.find((g) => g.id === id)?.label ?? id;
const IMAGE_CM_PER_PX = 0.04; // ≈ 0,4 mm por píxel para el cálculo: detecta líneas de 1 mm
const ZONE_LABELS = (id: string) => `del ${(zoneById(id)?.label ?? id).toLowerCase()}`;

/**
 * «Diseña tu prenda» en una sola columna:
 *  1. prenda, talla (con la tabla de medidas) y color;
 *  2. el bordado: en el estudio 3D o adjuntando una imagen y marcando zona y tamaño;
 *  3. cálculo automático (puntadas con rango, hilos y precio por tramos);
 *  4. añadir al carrito (con la casilla de vista orientativa) o enviar el diseño.
 * Debajo, el camino B: «¿Prefieres que te lo diseñemos nosotros?» (renderRequest).
 */
export function DesignStudio({
  garmentIds,
  altHref = '/personaliza',
  priceNote = 'Sudaderas desde 49,90 €',
  ctaLabel = 'Pedir mi boceto gratis',
  sizeOptions,
  sizeChart,
  renderCheckout = (p) => <SendDesign {...p} />,
  renderSend = (p) => <SendDesign {...p} />,
  renderRequest,
  pricing,
  colorMode = MODO_COLOR_PRENDA,
  stockColors = COLORES_STOCK,
  threadPaletteUrl,
  workerUrl,
  model
}: StudioProps = {}) {
  const garmentList = garmentIds ? garments.filter((g) => garmentIds.includes(g.id)) : garments;
  const editors = { delante: useRef<EditorHandle>(null), detras: useRef<EditorHandle>(null) };
  const viewer = useRef<PreviewHandle>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLFieldSetElement>(null);

  // --- Paso 1: prenda, talla y color
  const [type, setType] = useState<GarmentType>(garmentList[0]?.id ?? 'sudadera');
  const [size, setSize] = useState<string | undefined>(undefined);
  const stock = stockColors.length ? stockColors : COLORES_STOCK;
  const freeColor = colorMode !== 'stock';
  const gridColors = useMemo(
    () => (freeColor ? [...stock, ...COLORES_HABITUALES.filter((c) => !stock.some((s) => s.hex === c.hex))] : stock),
    [freeColor, stock]
  );
  const [color, setColor] = useState<NamedColor>(stock[0]);
  const inStock = stock.some((c) => c.hex.toLowerCase() === color.hex.toLowerCase());

  // --- Paso 2: cómo diseña
  const [method, setMethod] = useState<Method>('estudio');
  const [side, setSide] = useState<Side>('delante');
  const [placement, setPlacement] = useState<ImagePlacementValue>({ images: [], placed: [] });
  const [threads, setThreads] = useState<Thread[]>(DEFAULT_THREADS);
  useEffect(() => {
    loadThreadPalette(threadPaletteUrl).then(setThreads);
  }, [threadPaletteUrl]);
  const [uploads, setUploads] = useState<File[]>([]);

  // --- Paso 4
  const [accepted, setAccepted] = useState(false);
  const [ctaError, setCtaError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CheckoutProps | null>(null);
  const [sendProps, setSendProps] = useState<CheckoutProps | null>(null);

  const canvases = { delante: useSideCanvas(), detras: useSideCanvas() };
  // Diseño de cada lado sobre la prenda: referencia de colocación (plano, sin simular el hilo)
  const layers = useMemo(() => ({ delante: createLayers(1024), detras: createLayers(1024) }), []);
  const [designVersion, setDesignVersion] = useState(0);
  const threadizer = useMemo(() => createThreadizer(workerUrl), [workerUrl]);
  useEffect(() => () => threadizer.dispose(), [threadizer]);

  // --- Modelo 3D (GLB): siluetas reales para el lienzo; si no, la foto de la vista ligera
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [silhouettes, setSilhouettes] = useState<Record<Side, string> | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('cargando');
  const [liteSilhouettes, setLiteSilhouettes] = useState<Record<Side, string> | null>(null);
  useEffect(() => {
    const imgs = model?.liteImages;
    if (silhouettes || !imgs?.delante || !imgs.detras) return;
    let live = true;
    Promise.all([loadImage(imgs.delante), loadImage(imgs.detras)])
      .then(([f, b]) => {
        if (!live) return;
        setLiteSilhouettes({ delante: tintGarment(f, color.hex, 600, 'lienzo').toDataURL(), detras: tintGarment(b, color.hex, 600, 'lienzo').toDataURL() });
      })
      .catch(() => live && setLiteSilhouettes(null));
    return () => {
      live = false;
    };
  }, [model?.liteImages, color.hex, silhouettes]);
  const viewSizes = model?.sizes ?? [];
  // La talla elegida es la que se ve en 3D (si el modelo la tiene)
  const shownSize = size && viewSizes.some((r) => r.talla === size) ? size : modelInfo?.baseSize;

  // --- Cálculo de puntadas (worker), por lado del estudio o por zona de la imagen
  const [analyses, setAnalyses] = useState<Record<string, DesignAnalysis | null>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [calibrate] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('calibrar'));
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef(new Set<string>());
  const pricingRef = useRef(pricing);
  pricingRef.current = pricing;
  const threadsRef = useRef(threads);
  threadsRef.current = threads;
  const lowRes = typeof window !== 'undefined' && window.innerWidth < 768;

  /** Programa el cálculo de una parte (`key`) con el lienzo que devuelve `render`. */
  const schedule = useCallback(
    (key: string, render: () => { canvas: HTMLCanvasElement; cmPerPx: number; whiteRemoved: boolean } | null) => {
      clearTimeout(timers.current[key]);
      pending.current.add(key);
      setAnalyzing(true);
      timers.current[key] = setTimeout(async () => {
        const done = () => {
          pending.current.delete(key);
          setAnalyzing(pending.current.size > 0);
        };
        const r = render();
        if (!r) {
          setAnalyses((prev) => ({ ...prev, [key]: null }));
          return done();
        }
        const img = r.canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, r.canvas.width, r.canvas.height);
        const result = await threadizer.run(key, {
          rgba: img.data,
          w: img.width,
          h: img.height,
          cmPerPx: r.cmPerPx,
          threads: threadsRef.current,
          cfg: pricingRef.current ?? DEFAULT_EMBROIDERY_CONFIG
        });
        if (!result) return; // llegó un cambio más nuevo
        setAnalyses((prev) => ({ ...prev, [key]: result.analysis ? { ...result.analysis, whiteBackgroundRemoved: r.whiteRemoved } : null }));
        done();
      }, 220);
    },
    [threadizer]
  );

  // Estudio: cada cambio del lienzo → diseño plano en la prenda + cálculo
  const refresh = useCallback(
    (s: Side) => {
      const ed = editors[s].current;
      if (!ed) return;
      ed.renderTo(canvases[s]);
      drawFlat(layers[s], canvases[s]);
      setDesignVersion((v) => v + 1);
      schedule(s, () => editors[s].current?.renderForAnalysis(lowRes ? 0.05 : 0.04, lowRes ? 1000 : 1400) ?? null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schedule]
  );
  const refreshFront = useCallback(() => refresh('delante'), [refresh]);
  const refreshBack = useCallback(() => refresh('detras'), [refresh]);
  useEffect(() => {
    refresh('delante');
    refresh('detras');
  }, [threads, refresh]);

  // Imagen adjunta: una parte por zona, con la imagen a su ancho real
  useEffect(() => {
    const keys = new Set(placement.placed.map((p) => `zona:${p.zone}`));
    setAnalyses((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith('zona:') || keys.has(k))));
    for (const p of placement.placed) {
      const img = placement.images.find((i) => i.id === p.img);
      schedule(`zona:${p.zone}`, () => {
        if (!img?.trimmed) return null;
        const w = Math.max(20, Math.min(lowRes ? 1000 : 1400, Math.round(p.ancho / IMAGE_CM_PER_PX)));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = Math.max(1, Math.round((w * img.trimmed.height) / img.trimmed.width));
        c.getContext('2d')!.drawImage(img.trimmed, 0, 0, c.width, c.height);
        return { canvas: c, cmPerPx: p.ancho / w, whiteRemoved: img.whiteRemoved };
      });
    }
  }, [placement, threads, schedule, lowRes]);

  const onUpload = useCallback((f: File) => setUploads((u) => [...u, f].slice(-2)), []);

  // Solo cuentan las partes del método elegido
  const parts = useMemo(() => {
    const out: Record<string, DesignAnalysis | null> = {};
    for (const [k, a] of Object.entries(analyses)) if (method === 'imagen' ? k.startsWith('zona:') : !k.startsWith('zona:')) out[k] = a;
    return out;
  }, [analyses, method]);
  const estimate = useMemo(() => {
    if (!pricing || !Object.values(parts).some(Boolean)) return null;
    const labels: Record<string, string> = { delante: 'de delante', detras: 'de detrás' };
    for (const k of Object.keys(parts)) if (k.startsWith('zona:')) labels[k] = ZONE_LABELS(k.slice(5));
    return buildEstimate(pricing, parts, color.hex, labels);
  }, [pricing, parts, color.hex]);

  const zonesText = (): string => {
    if (method === 'imagen') return describePlacements(placement).join(' · ');
    return sides
      .filter((s) => !editors[s.id].current?.isEmpty())
      .map((s) => {
        const d = editors[s.id].current?.getSize();
        return `${s.label}${d ? ` (≈ ${d.w} × ${d.h} cm)` : ''}`;
      })
      .join(' · ');
  };

  /** Resumen y archivos del diseño (los mismos para el carrito y para «Enviar mi diseño»). */
  function buildCheckout(target: 'compra' | 'envio'): CheckoutProps {
    const close = () => (target === 'compra' ? setCheckout(null) : setSendProps(null));
    const q = estimate?.quote;
    const sizesText = estimate
      ? Object.keys(estimate.perSide)
          .filter((k) => estimate.perSide[k])
          .map((k) => {
            const a = estimate.perSide[k]!;
            const name = k.startsWith('zona:') ? zoneById(k.slice(5))?.label : sides.find((s) => s.id === k)?.label;
            return `${name}: ${a.widthCm.toFixed(1)} × ${a.heightCm.toFixed(1)} cm`;
          })
          .join(' · ')
      : '';
    const common = {
      onClose: close,
      size,
      prenda: type,
      color: color.name,
      garment: { name: color.name, hex: color.hex, free: freeColor && !inStock },
      embroidery: estimate ? { ...estimate, sizes: sizesText } : undefined
    };
    const tooMany =
      q?.kind === 'too-many-colors'
        ? `Tu diseño tiene más de ${q.max} colores y bordamos como máximo ${q.max}. Simplifica los colores o pídenos que te lo diseñemos (más abajo).`
        : undefined;

    if (method === 'imagen') {
      const placed = placement.placed.filter((p) => placement.images.some((i) => i.id === p.img));
      const usedSides = sides.filter((s) => placed.some((p) => zoneById(p.zone)?.side === s.id));
      return {
        ...common,
        details: [
          ['Prenda', garmentLabel(type)],
          ['Color de la prenda', `${color.name} (${color.hex.toUpperCase()})`],
          ['Cómo se diseñó', 'Imagen adjunta con zona marcada'],
          ['Zona(s) y tamaño', describePlacements(placement).join(' · ') || '—']
        ],
        ubicacion: usedSides.length === 1 && usedSides[0].id === 'detras' ? 'espalda' : 'pecho',
        blockedReason: !placement.images.length
          ? 'Sube tu imagen en el paso 2.'
          : !placed.length
            ? 'Marca en la sudadera al menos una zona para tu diseño (paso 2).'
            : tooMany,
        getAttachments: async () => {
          const out: Attachment[] = placement.images.map((i, n) => ({ label: `Imagen ${n + 1}`, file: i.file }));
          for (const s of usedSides) {
            const blob = await capturePlacement(placement, s.id, color.hex, model?.liteImages?.[s.id]);
            if (blob) out.push({ label: `Vista de colocación ${s.label.toLowerCase()}`, file: new File([blob], `colocacion-${s.id}.jpg`, { type: 'image/jpeg' }) });
          }
          return out;
        }
      };
    }

    const used = sides.filter((s) => !editors[s.id].current?.isEmpty());
    const sizeOf = (s: Side) => {
      const d = editors[s].current?.getSize();
      return d ? `≈ ${d.w} × ${d.h} cm` : '';
    };
    return {
      ...common,
      details: [
        ['Prenda', garmentLabel(type)],
        ['Color de la prenda', `${color.name} (${color.hex.toUpperCase()})`],
        ['Cómo se diseñó', 'Estudio 3D'],
        ['Bordado delante', used.some((s) => s.id === 'delante') ? `Sí (${sizeOf('delante')})` : 'No'],
        ['Bordado detrás', used.some((s) => s.id === 'detras') ? `Sí (${sizeOf('detras')})` : 'No']
      ],
      ubicacion: used.length === 1 && used[0].id === 'detras' ? 'espalda' : 'centro',
      blockedReason: !used.length ? 'Tu diseño está vacío: sube una imagen, escribe o dibuja delante o detrás.' : tooMany,
      getAttachments: async () => {
        const out: Attachment[] = [];
        for (const s of used) {
          const png = await editors[s.id].current?.exportPng();
          if (png) out.push({ label: `Diseño ${s.label.toLowerCase()}`, file: new File([png], `diseno-${s.id}.png`, { type: 'image/png' }) });
          const shot = viewer.current?.snapshot(s.id);
          if (shot) {
            const blob = await (await fetch(shot)).blob();
            out.push({ label: `Vista 3D ${s.label.toLowerCase()}`, file: new File([blob], `vista-3d-${s.id}.jpg`, { type: 'image/jpeg' }) });
          }
        }
        uploads.forEach((f, i) => out.push({ label: `Imagen original ${i + 1}`, file: f }));
        return out;
      }
    };
  }

  function addToCart() {
    if (sizeOptions?.length && !size) {
      setCtaError('Elige tu talla en el paso 1.');
      sizeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!accepted) {
      setCtaError(`Marca la casilla «${CASILLA_3D}» para continuar.`);
      return;
    }
    setCtaError(null);
    setCheckout(buildCheckout('compra'));
  }

  const prefill: RequestPrefill = {
    prenda: garmentLabel(type),
    talla: size,
    color,
    zonas: method === 'imagen' ? placement.placed.map((p) => p.zone) : [],
    tamano: zonesText()
  };

  return (
    <div className="container-page pt-8">
      {/* Cabecera */}
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">Estudio de diseño</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">Diseña tu prenda</h1>
        <p className="mt-2 text-tinta-700">Elige tu sudadera, coloca tu diseño y mira el precio aproximado del bordado al momento.</p>
        <a href="#te-lo-disenamos" className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline underline-offset-4">
          ¿Prefieres que te lo diseñemos nosotros? <span aria-hidden>↓</span>
        </a>
      </div>

      <ol className="mx-auto mt-6 max-w-2xl space-y-6">
        {/* 1. Prenda, talla y color */}
        <Step n={1} title="Elige prenda, talla y color">
          {garmentList.length > 1 ? (
            <div className="mb-5 grid grid-cols-3 gap-2" role="group" aria-label="Prenda">
              {garmentList.map((g) => (
                <Chip key={g.id} active={type === g.id} onClick={() => setType(g.id)}>{g.label}</Chip>
              ))}
            </div>
          ) : (
            <p className="mb-4 text-sm text-tinta-700">
              <b>{garmentLabel(type)}</b> oversize · corte boxy y corto, hombro caído, puños y bajo de canalé.
            </p>
          )}

          {sizeOptions && sizeOptions.length > 0 && (
            <fieldset ref={sizeRef} className="mb-5 min-w-0">
              <legend className="label">Talla</legend>
              <div className="flex flex-wrap gap-2">
                {sizeOptions.map((o) => (
                  <button
                    key={o.title}
                    type="button"
                    disabled={!o.available}
                    aria-pressed={size === o.title}
                    onClick={() => {
                      setSize(o.title);
                      setCtaError(null);
                    }}
                    className={cn(
                      'min-h-11 min-w-12 rounded-full border px-4 text-sm transition',
                      size === o.title ? 'border-tinta bg-tinta text-lino' : 'border-tinta/20 bg-lino-100 hover:border-tinta',
                      !o.available && 'line-through opacity-40'
                    )}
                  >
                    {o.title}
                  </button>
                ))}
              </div>
              {sizeChart && <SizeChart data={sizeChart} highlight={size} open />}
            </fieldset>
          )}

          <ColorPicker label="Color de la prenda" swatches={gridColors} free={freeColor} value={color.hex} onChange={(d) => setColor({ name: d.name, hex: d.hex })} />
          {freeColor && !inStock && <p className="mt-2 rounded-xl bg-oro-100 px-3 py-2 text-xs">{AVISO_COLOR_LIBRE}.</p>}
        </Step>

        {/* 2. El bordado */}
        <Step n={2} title="Diseña tu bordado">
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Cómo quieres diseñarlo">
            {([
              ['estudio', 'En el estudio 3D', 'Sube, escribe o dibuja y colócalo sobre la sudadera.'],
              ['imagen', 'Adjuntar una imagen', 'Sube tu imagen y marca dónde la quieres y su tamaño.']
            ] as const).map(([id, title, text]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={method === id}
                onClick={() => setMethod(id)}
                className={cn('rounded-2xl border p-4 text-left transition', method === id ? 'border-tinta bg-lino-100 ring-1 ring-tinta' : 'border-tinta/15 bg-lino hover:border-tinta')}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className={cn('grid h-4 w-4 place-items-center rounded-full border-2', method === id ? 'border-tinta' : 'border-tinta/30')}>
                    {method === id && <span className="h-2 w-2 rounded-full bg-tinta" />}
                  </span>
                  {title}
                </span>
                <span className="mt-1 block text-xs text-tinta-500">{text}</span>
              </button>
            ))}
          </div>

          <div className={cn('mt-5 space-y-4', method !== 'estudio' && 'hidden')}>
            <p className="rounded-2xl bg-oro-100 px-4 py-3 text-sm">{AVISO_3D}</p>
            <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Lado de la prenda">
              {sides.map((s) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={side === s.id}
                  onClick={() => setSide(s.id)}
                  className={cn('min-h-11 rounded-2xl border px-3 text-sm font-semibold transition', side === s.id ? 'border-tinta bg-tinta text-lino' : 'border-tinta/15 bg-lino-100 hover:border-tinta')}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {sides.map((s) => (
              <div key={s.id} className={cn(side !== s.id && 'hidden')}>
                <DesignEditor
                  ref={editors[s.id]}
                  side={s.id}
                  garmentColor={color.hex}
                  silhouetteUrl={(silhouettes ?? liteSilhouettes)?.[s.id]}
                  threads={threads}
                  onChange={s.id === 'delante' ? refreshFront : refreshBack}
                  onUpload={onUpload}
                />
              </div>
            ))}
            {method === 'estudio' && (
              <div>
                <p className="label">Vista 3D (referencia)</p>
                <div className="relative aspect-square max-h-[60vh] w-full overflow-hidden rounded-3xl ring-1 ring-tinta/10">
                  <GarmentPreview
                    ref={viewer}
                    color={color.hex}
                    view={side}
                    layers={layers}
                    version={designVersion}
                    modelUrl={model?.url}
                    liteImages={model?.liteImages}
                    size={shownSize}
                    sizes={viewSizes}
                    onModelReady={setModelInfo}
                    onSilhouettes={setSilhouettes}
                    onModeChange={setPreviewMode}
                  />
                  <div className="absolute left-3 top-3 flex gap-1 rounded-full bg-lino-100/90 p-1 text-xs font-medium">
                    {sides.map((s) => (
                      <button key={s.id} onClick={() => setSide(s.id)} className={cn('min-h-[2.25rem] rounded-full px-3', side === s.id && 'bg-tinta text-lino')}>
                        Ver {s.label.toLowerCase()}
                      </button>
                    ))}
                  </div>
                  <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-lino-100/90 px-3 py-1 text-xs text-tinta-700">
                    {previewMode === 'ligero' ? 'Vista previa (sin 3D)' : 'Arrastra para girar · zoom con 2 dedos'}
                    {shownSize ? ` · talla ${shownSize}` : ''}
                  </p>
                </div>
              </div>
            )}
          </div>

          {method === 'imagen' && (
            <div className="mt-5">
              <ImagePlacement value={placement} onChange={setPlacement} garmentHex={color.hex} liteImages={model?.liteImages} />
            </div>
          )}
        </Step>

        {/* 3. Cálculo */}
        <Step n={3} title="Cálculo automático">
          {pricing ? (
            <EmbroideryPanel pricing={pricing} estimate={estimate} busy={analyzing} calibrate={calibrate} onRequestQuote={() => setSendProps(buildCheckout('envio'))} />
          ) : (
            <p className="rounded-2xl bg-lino px-4 py-3 text-sm text-tinta-700">{AVISO_3D}</p>
          )}
        </Step>

        {/* 4. Carrito o envío */}
        <Step n={4} title="Añádelo al carrito o envíanos tu diseño">
          <div ref={ctaRef}>
            <ul className="mb-4 space-y-1 text-sm text-tinta-700">
              <li>{garmentLabel(type)} · talla <b>{size ?? 'sin elegir'}</b> · {color.name}</li>
              {zonesText() && <li>Bordado: {zonesText()}</li>}
              <li className="text-tinta-500">{priceNote}</li>
            </ul>
            <label className="flex items-start gap-3 rounded-2xl bg-lino px-4 py-3 text-sm ring-1 ring-tinta/10">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 accent-hilo"
                checked={accepted}
                onChange={(e) => {
                  setAccepted(e.target.checked);
                  setCtaError(null);
                }}
                required
              />
              <span>
                <b>{CASILLA_3D}</b> y que el bordado final lo hacemos a mano siguiendo mis indicaciones. *
              </span>
            </label>
            {ctaError && <p className="mt-3 rounded-xl bg-hilo-100 px-4 py-3 text-sm text-hilo-600" role="alert">{ctaError}</p>}
            <button type="button" onClick={addToCart} className="btn-primary mt-4 w-full py-4 text-base">
              {ctaLabel} <ArrowIcon className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setSendProps(buildCheckout('envio'))} className="mt-2 w-full rounded-full border border-tinta/25 py-3.5 text-sm font-semibold hover:border-tinta">
              Enviar mi diseño
            </button>
            <p className="mt-1.5 text-center text-xs text-tinta-500">«Enviar mi diseño»: te respondemos con el boceto y el precio, sin compromiso.</p>
          </div>
        </Step>
      </ol>

      {/* Camino B */}
      <section id="te-lo-disenamos" className="mx-auto mt-14 max-w-2xl scroll-mt-24 rounded-3xl bg-tinta p-6 text-lino sm:p-8">
        <p className="eyebrow !text-[#D1C4A4]">Te lo diseñamos</p>
        <h2 className="mt-2 font-display text-3xl sm:text-4xl">¿Prefieres que te lo diseñemos nosotros?</h2>
        <p className="mt-2 text-lino/80">Cuéntanos qué quieres, adjunta tus referencias y te contactamos con un presupuesto. Sin compromiso.</p>
        <div className="mt-6">
          {renderRequest ? (
            renderRequest(prefill)
          ) : (
            <a href={altHref} className="btn-primary inline-flex px-6 py-3.5">Cuéntanos tu idea <ArrowIcon className="h-4 w-4" /></a>
          )}
        </div>
      </section>

      {checkout && renderCheckout(checkout)}
      {sendProps && renderSend(sendProps)}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-3xl bg-lino-100 p-5 ring-1 ring-tinta/10 sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 font-display text-2xl">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-tinta font-sans text-sm font-semibold text-lino">{n}</span>
        {title}
      </h2>
      {children}
    </li>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn('rounded-2xl border px-3 py-2.5 text-sm font-medium transition', active ? 'border-tinta bg-tinta text-lino' : 'border-tinta/15 bg-lino-100 hover:border-tinta')}
    >
      {children}
    </button>
  );
}
