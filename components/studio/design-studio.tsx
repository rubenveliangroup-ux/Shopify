'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';
import { ArrowIcon, CheckIcon } from '../icons';
import { fabricColors, garments, placements, TEXTURE_SIZE, type GarmentType, type Placement } from './config';
import { DesignEditor, type EditorHandle } from './design-editor';
import { applyEmbroidery } from './embroidery';
import { Garment3D, type Garment3DHandle } from './garment-3d';
import { SendDesign } from './send-design';

export function DesignStudio() {
  const editor = useRef<EditorHandle>(null);
  const viewer = useRef<Garment3DHandle>(null);

  const [type, setType] = useState<GarmentType>('sudadera');
  const [color, setColor] = useState(fabricColors[0]);
  const [placement, setPlacement] = useState<Placement>('centro');
  const [scale, setScale] = useState(1);
  const [embroidery, setEmbroidery] = useState(true);
  const [uploads, setUploads] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [mobileTab, setMobileTab] = useState<'diseno' | 'prenda'>('diseno');

  // Canvas de textura que se proyecta sobre la prenda 3D
  const { texCanvas, texture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = TEXTURE_SIZE;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { texCanvas: c, texture: t };
  }, []);

  const embroideryRef = useRef(embroidery);
  embroideryRef.current = embroidery;

  const refreshTexture = useCallback(() => {
    if (!editor.current) return;
    editor.current.renderTo(texCanvas);
    if (embroideryRef.current) applyEmbroidery(texCanvas);
    texture.needsUpdate = true;
  }, [texCanvas, texture]);

  useEffect(refreshTexture, [embroidery, refreshTexture]);
  useEffect(() => () => texture.dispose(), [texture]);

  const optionsPanel = (
    <div className="space-y-6">
      <Option title="Prenda">
        <div className="grid grid-cols-3 gap-2">
          {garments.map((g) => (
            <Chip key={g.id} active={type === g.id} onClick={() => setType(g.id)}>{g.label}</Chip>
          ))}
        </div>
      </Option>

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

      <Option title="Posición del bordado">
        <div className="grid grid-cols-3 gap-2">
          {placements.map((p) => (
            <Chip key={p.id} active={placement === p.id} onClick={() => setPlacement(p.id)}>
              {p.label}
              <span className="block text-[10px] font-normal opacity-70">{p.hint}</span>
            </Chip>
          ))}
        </div>
      </Option>

      <Option title={`Tamaño: ${Math.round(scale * 100)}%`}>
        <input type="range" min={0.5} max={1.3} step={0.05} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-full accent-hilo" />
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

  return (
    <div className="container-page pt-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Estudio de diseño</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">Diseña tu prenda</h1>
          <p className="mt-2 max-w-xl text-tinta-700">Sube tu dibujo o foto, escribe o dibuja a mano y míralo sobre la prenda en 3D. Nosotros lo convertimos en bordado.</p>
        </div>
        <Link href="/personaliza" className="text-sm underline underline-offset-4">¿Prefieres que lo diseñemos nosotros?</Link>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-10">
        {/* Vista 3D: arriba en móvil, a la derecha en escritorio */}
        <div className="lg:order-2">
          <div className="sticky top-20 z-10 space-y-4">
            <div className="relative aspect-square max-h-[46vh] w-full overflow-hidden rounded-3xl ring-1 ring-tinta/10 lg:aspect-[4/3.4] lg:max-h-none">
              <Garment3D ref={viewer} type={type} color={color.hex} placement={placement} scale={scale} texture={texture} />
              <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-lino-100/90 px-3 py-1 text-xs text-tinta-700">
                Arrastra para girar · zoom con 2 dedos
              </p>
            </div>
            <div className="hidden rounded-3xl bg-lino-100 p-5 ring-1 ring-tinta/10 lg:block">
              <CtaBlock onSend={() => setSending(true)} />
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
            <DesignEditor
              ref={editor}
              background={color.hex}
              onChange={refreshTexture}
              onUpload={(f) => setUploads((u) => [...u, f].slice(-2))}
            />
          </div>
          <div className={cn('lg:mt-10', mobileTab !== 'prenda' && 'hidden lg:block')}>
            {optionsPanel}
          </div>

          <div className="mt-8 rounded-3xl bg-lino-100 p-5 ring-1 ring-tinta/10 lg:hidden">
            <CtaBlock onSend={() => setSending(true)} />
          </div>
        </div>
      </div>

      {sending && (
        <SendDesign
          onClose={() => setSending(false)}
          getFiles={async () => {
            const files: File[] = [];
            const png = await editor.current?.exportPng();
            if (png) files.push(new File([png], 'diseno.png', { type: 'image/png' }));
            const shot = viewer.current?.snapshot();
            if (shot) {
              const blob = await (await fetch(shot)).blob();
              files.push(new File([blob], 'vista-3d.jpg', { type: 'image/jpeg' }));
            }
            return [...files, ...uploads];
          }}
          isEmpty={() => editor.current?.isEmpty() ?? true}
          summary={{
            prenda: type,
            color: color.name,
            ubicacion: placement,
            tamano: `${Math.round(scale * 100)}%`
          }}
        />
      )}
    </div>
  );
}

function CtaBlock({ onSend }: { onSend: () => void }) {
  return (
    <div>
      <ul className="mb-4 space-y-1.5 text-sm text-tinta-700">
        {['Te enviamos el boceto bordable y el precio en 48 h', 'Sin compromiso: no producimos hasta que lo apruebas', 'Sudaderas desde 49,90 €'].map((t) => (
          <li key={t} className="flex items-center gap-2"><CheckIcon className="h-4 w-4 shrink-0 text-bosque" />{t}</li>
        ))}
      </ul>
      <button onClick={onSend} className="btn-primary w-full py-4 text-base">
        Pedir mi boceto gratis <ArrowIcon className="h-4 w-4" />
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
