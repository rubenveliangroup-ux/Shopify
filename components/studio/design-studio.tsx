'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';
import { ArrowIcon, CheckIcon } from '../icons';
import { fabricColors, garments, sides, TEXTURE_SIZE, type GarmentType, type Side } from './config';
import { DesignEditor, type EditorHandle } from './design-editor';
import { applyEmbroidery } from './embroidery';
import { analyzeDesign, type DesignAnalysis } from './embroidery-estimate';
import { buildEstimate, EmbroideryPanel, type EmbroideryEstimate } from './embroidery-panel';
import type { EmbroideryPricing } from './embroidery-pricing';
import { Garment3D, type Garment3DHandle } from './garment-3d';
import { OwnDesignForm, type OwnDesignData } from './own-design-form';
import { SendDesign } from './send-design';

export type Attachment = { label: string; file: File };

export type CheckoutProps = {
  onClose: () => void;
  /** Archivos que se adjuntan (diseños, capturas 3D, imágenes originales). */
  getAttachments: () => Promise<Attachment[]>;
  /** Especificaciones legibles: se guardan como propiedades del pedido o en el brief. */
  details: [string, string][];
  prenda: GarmentType;
  ubicacion: 'pecho' | 'centro' | 'espalda' | 'no-se';
  color: string;
  /** Si existe, el envío está bloqueado y se muestra este aviso. */
  blockedReason?: string;
  /** Estimación de bordado (solo diseños hechos en el estudio y con calculadora activa). */
  embroidery?: EmbroideryEstimate & { sizes: string };
};

type StudioProps = {
  /** Prendas que se ofrecen (por defecto, todas). */
  garmentIds?: GarmentType[];
  /** Enlace "¿Prefieres que lo diseñemos nosotros?" */
  altHref?: string;
  /** Texto con el precio de partida que se muestra junto al CTA. */
  priceNote?: string;
  ctaLabel?: string;
  /** Ventajas listadas sobre el botón final. */
  highlights?: string[];
  /** Diálogo final: en Next envía un brief; en Shopify añade al carrito. */
  renderCheckout?: (props: CheckoutProps) => React.ReactNode;
  /** Calculadora de bordado (precios y tramos). Sin ella, el estudio funciona como antes. */
  pricing?: EmbroideryPricing;
};

type Mode = 'disenar' | 'enviar';

function useSideTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TEXTURE_SIZE;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { canvas, texture };
  }, []);
}

const garmentLabel = (id: GarmentType) => garments.find((g) => g.id === id)?.label ?? id;

export function DesignStudio({
  garmentIds,
  altHref = '/personaliza',
  priceNote = 'Sudaderas desde 49,90 €',
  ctaLabel = 'Pedir mi boceto gratis',
  highlights = ['Te enviamos el boceto bordable y el precio en 48 h', 'No bordamos nada hasta que lo apruebas'],
  renderCheckout = (p) => <SendDesign {...p} />,
  pricing
}: StudioProps = {}) {
  const garmentList = garmentIds ? garments.filter((g) => garmentIds.includes(g.id)) : garments;
  const editors = { delante: useRef<EditorHandle>(null), detras: useRef<EditorHandle>(null) };
  const viewer = useRef<Garment3DHandle>(null);

  const [mode, setMode] = useState<Mode>('disenar');
  const [side, setSide] = useState<Side>('delante');
  const [type, setType] = useState<GarmentType>(garmentList[0]?.id ?? 'sudadera');
  const [color, setColor] = useState(fabricColors[0]);
  const [embroidery, setEmbroidery] = useState(true);
  const [uploads, setUploads] = useState<File[]>([]);
  const [checkout, setCheckout] = useState<CheckoutProps | null>(null);
  const [mobileTab, setMobileTab] = useState<'diseno' | 'prenda'>('diseno');

  const textures = { delante: useSideTexture(), detras: useSideTexture() };

  // --- Calculadora de bordado: análisis por lado con espera tras cada cambio
  const [analyses, setAnalyses] = useState<Record<Side, DesignAnalysis | null>>({ delante: null, detras: null });
  const [analyzing, setAnalyzing] = useState(false);
  const [calibrate] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('calibrar'));
  const timers = useRef<Partial<Record<Side, ReturnType<typeof setTimeout>>>>({});
  const pending = useRef(new Set<Side>());
  const pricingRef = useRef(pricing);
  pricingRef.current = pricing;
  const scheduleAnalysis = useCallback(
    (s: Side) => {
      const cfg = pricingRef.current;
      if (!cfg) return;
      clearTimeout(timers.current[s]);
      pending.current.add(s);
      setAnalyzing(true);
      timers.current[s] = setTimeout(() => {
        const r = editors[s].current?.renderForAnalysis(0.05, 900); // ≈ 0,5 mm por píxel
        const base = r ? analyzeDesign(r.canvas, r.cmPerPx, cfg) : null;
        const a = base && r ? { ...base, whiteBackgroundRemoved: r.whiteRemoved } : null;
        setAnalyses((prev) => ({ ...prev, [s]: a }));
        pending.current.delete(s);
        setAnalyzing(pending.current.size > 0);
      }, 450);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const estimate = useMemo(
    () => (pricing && (analyses.delante || analyses.detras) ? buildEstimate(pricing, analyses) : null),
    [pricing, analyses]
  );

  const embroideryRef = useRef(embroidery);
  embroideryRef.current = embroidery;

  const refresh = useCallback(
    (s: Side) => {
      const ed = editors[s].current;
      const { canvas, texture } = textures[s];
      if (!ed) return;
      ed.renderTo(canvas);
      if (embroideryRef.current) applyEmbroidery(canvas);
      texture.needsUpdate = true;
      scheduleAnalysis(s);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const refreshFront = useCallback(() => refresh('delante'), [refresh]);
  const refreshBack = useCallback(() => refresh('detras'), [refresh]);

  useEffect(() => {
    refresh('delante');
    refresh('detras');
  }, [embroidery, refresh]);
  useEffect(
    () => () => {
      textures.delante.texture.dispose();
      textures.detras.texture.dispose();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const onUpload = useCallback((f: File) => setUploads((u) => [...u, f].slice(-2)), []);

  /** Diseño hecho en el estudio → checkout */
  function openStudioCheckout() {
    const used = sides.filter((s) => !editors[s.id].current?.isEmpty());
    const sizeOf = (s: Side) => {
      const d = editors[s].current?.getSize();
      return d ? `≈ ${d.w} × ${d.h} cm` : '';
    };
    const details: [string, string][] = [
      ['Prenda', garmentLabel(type)],
      ['Color de la prenda', color.name],
      ['Bordado delante', used.some((s) => s.id === 'delante') ? `Sí (${sizeOf('delante')})` : 'No'],
      ['Bordado detrás', used.some((s) => s.id === 'detras') ? `Sí (${sizeOf('detras')})` : 'No']
    ];
    const q = estimate?.quote;
    setCheckout({
      onClose: () => setCheckout(null),
      details,
      prenda: type,
      color: color.name,
      ubicacion: used.length === 1 && used[0].id === 'detras' ? 'espalda' : 'centro',
      blockedReason: !used.length
        ? 'Tu diseño está vacío: sube una imagen, escribe o dibuja delante o detrás.'
        : q?.kind === 'too-many-colors'
          ? `Tu diseño tiene más de ${q.max} colores y bordamos como máximo ${q.max}. Simplifica los colores o envíanos tu diseño para revisarlo.`
          : undefined,
      embroidery: estimate
        ? {
            ...estimate,
            sizes: sides
              .filter((s) => estimate.perSide[s.id])
              .map((s) => `${s.label}: ${estimate.perSide[s.id]!.widthCm.toFixed(1)} × ${estimate.perSide[s.id]!.heightCm.toFixed(1)} cm`)
              .join(' · ')
          }
        : undefined,
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
    });
  }

  /** Diseño propio enviado con especificaciones → checkout */
  function openOwnDesignCheckout(d: OwnDesignData) {
    const details: [string, string][] = [
      ['Prenda', garmentLabel(type)],
      ['Color de la prenda', d.color],
      ['Lado', d.lado],
      ...(d.posicionDelante ? ([['Posición delante', d.posicionDelante]] as [string, string][]) : []),
      ...(d.posicionDetras ? ([['Posición detrás', d.posicionDetras]] as [string, string][]) : []),
      ...(d.tamano ? ([['Tamaño', d.tamano]] as [string, string][]) : []),
      ...(d.hilos ? ([['Colores de hilo', d.hilos]] as [string, string][]) : []),
      ...(d.especificaciones ? ([['Especificaciones', d.especificaciones]] as [string, string][]) : [])
    ];
    setCheckout({
      onClose: () => setCheckout(null),
      details,
      prenda: type,
      color: d.color,
      ubicacion: d.lado === 'Detrás' ? 'espalda' : d.lado === 'Delante' ? 'pecho' : 'no-se',
      getAttachments: async () => d.files.map((f, i) => ({ label: `Diseño del cliente ${i + 1}`, file: f }))
    });
  }

  const garmentOptions = (
    <div className="space-y-6">
      {garmentList.length > 1 && (
        <Option title="Prenda">
          <div className="grid grid-cols-3 gap-2">
            {garmentList.map((g) => (
              <Chip key={g.id} active={type === g.id} onClick={() => setType(g.id)}>{g.label}</Chip>
            ))}
          </div>
        </Option>
      )}

      <Option title={`Color de la prenda: ${color.name}`}>
        <div className="flex flex-wrap gap-2">
          {fabricColors.map((c) => (
            <button
              key={c.hex}
              aria-label={c.name}
              title={c.name}
              onClick={() => setColor(c)}
              className={cn('h-9 w-9 rounded-full ring-1 ring-tinta/20', color.hex === c.hex && 'ring-2 ring-hilo ring-offset-2 ring-offset-lino')}
              style={{ background: c.hex }}
            />
          ))}
        </div>
      </Option>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-lino-100 px-4 py-3 ring-1 ring-tinta/10">
        <span>
          <span className="block text-sm font-medium">Efecto bordado</span>
          <span className="block text-xs text-tinta-500">Simula puntadas y relieve del hilo</span>
        </span>
        <input type="checkbox" checked={embroidery} onChange={(e) => setEmbroidery(e.target.checked)} className="h-5 w-5 accent-hilo" />
      </label>
    </div>
  );

  const sideTabs = (
    <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Lado de la prenda">
      {sides.map((s) => (
        <button
          key={s.id}
          role="tab"
          aria-selected={side === s.id}
          onClick={() => setSide(s.id)}
          className={cn(
            'rounded-2xl border px-3 py-2.5 text-sm font-semibold transition',
            side === s.id ? 'border-tinta bg-tinta text-lino' : 'border-tinta/15 bg-lino-100 hover:border-tinta'
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="container-page pt-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Estudio de diseño</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">Diseña tu prenda</h1>
          <p className="mt-2 max-w-xl text-tinta-700">
            Crea tu diseño delante y detrás, colócalo donde quieras y míralo en 3D. O envíanos tu diseño con tus especificaciones.
          </p>
        </div>
        <a href={altHref} className="text-sm underline underline-offset-4">¿Prefieres que lo diseñemos nosotros?</a>
      </div>

      {/* Modo: diseñar aquí o enviar diseño propio */}
      <div className="mt-6 inline-grid w-full grid-cols-2 rounded-full bg-lino-200 p-1 text-sm font-medium sm:w-auto">
        {([
          ['disenar', 'Diséñalo aquí'],
          ['enviar', 'Envíanos tu diseño']
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setMode(id)} className={cn('rounded-full px-5 py-2', mode === id && 'bg-lino-100 shadow')}>
            {label}
          </button>
        ))}
      </div>

      <div className={cn('mt-6 grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-10', mode !== 'disenar' && 'hidden')}>
        {/* Vista 3D: arriba en móvil, a la derecha en escritorio */}
        <div className="lg:order-2">
          <div className="sticky top-20 z-10 space-y-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pb-2">
            <div className="relative aspect-square max-h-[46vh] w-full overflow-hidden rounded-3xl ring-1 ring-tinta/10 lg:aspect-[4/3] lg:max-h-[56vh]">
              <Garment3D ref={viewer} type={type} color={color.hex} view={side} front={textures.delante.texture} back={textures.detras.texture} />
              <div className="absolute left-3 top-3 flex gap-1 rounded-full bg-lino-100/90 p-1 text-xs font-medium">
                {sides.map((s) => (
                  <button key={s.id} onClick={() => setSide(s.id)} className={cn('rounded-full px-3 py-1', side === s.id && 'bg-tinta text-lino')}>
                    Ver {s.label.toLowerCase()}
                  </button>
                ))}
              </div>
              <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-lino-100/90 px-3 py-1 text-xs text-tinta-700">
                Arrastra para girar · zoom con 2 dedos
              </p>
            </div>
            <div className="hidden space-y-4 rounded-3xl bg-lino-100 p-5 ring-1 ring-tinta/10 lg:block">
              {pricing && <EmbroideryPanel pricing={pricing} estimate={estimate} busy={analyzing} calibrate={calibrate} />}
              <CtaBlock onClick={openStudioCheckout} items={[...highlights, priceNote]} label={ctaLabel} />
            </div>
          </div>
        </div>

        {/* Panel de edición */}
        <div className="lg:order-1">
          <div className="mb-4 grid grid-cols-2 rounded-full bg-lino-200 p-1 text-sm font-medium lg:hidden">
            {(['diseno', 'prenda'] as const).map((t) => (
              <button key={t} onClick={() => setMobileTab(t)} className={cn('rounded-full py-2', mobileTab === t && 'bg-lino-100 shadow')}>
                {t === 'diseno' ? '1. Tu diseño' : '2. La prenda'}
              </button>
            ))}
          </div>

          <div className={cn(mobileTab !== 'diseno' && 'hidden lg:block')}>
            <div className="mb-4">{sideTabs}</div>
            {sides.map((s) => (
              <div key={s.id} className={cn(side !== s.id && 'hidden')}>
                <DesignEditor
                  ref={editors[s.id]}
                  side={s.id}
                  garmentColor={color.hex}
                  onChange={s.id === 'delante' ? refreshFront : refreshBack}
                  onUpload={onUpload}
                />
              </div>
            ))}
          </div>
          <div className={cn('lg:mt-10', mobileTab !== 'prenda' && 'hidden lg:block')}>{garmentOptions}</div>

          <div className="mt-8 space-y-4 rounded-3xl bg-lino-100 p-5 ring-1 ring-tinta/10 lg:hidden">
            {pricing && <EmbroideryPanel pricing={pricing} estimate={estimate} busy={analyzing} calibrate={calibrate} />}
            <CtaBlock onClick={openStudioCheckout} items={[...highlights, priceNote]} label={ctaLabel} />
          </div>
        </div>
      </div>

      {mode === 'enviar' && (
        <div className="mt-6">
          <OwnDesignForm defaultColor={color.name} ctaLabel={ctaLabel} onSubmit={openOwnDesignCheckout} />
        </div>
      )}

      {checkout && renderCheckout(checkout)}
    </div>
  );
}

function CtaBlock({ onClick, items, label }: { onClick: () => void; items: string[]; label: string }) {
  return (
    <div>
      <ul className="mb-4 space-y-1.5 text-sm text-tinta-700">
        {items.map((t) => (
          <li key={t} className="flex items-center gap-2"><CheckIcon className="h-4 w-4 shrink-0 text-bosque" />{t}</li>
        ))}
      </ul>
      <button onClick={onClick} className="btn-primary w-full py-4 text-base">
        {label} <ArrowIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function Option({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label">{title}</p>
      {children}
    </div>
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
