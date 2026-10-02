'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { UploadIcon } from '../icons';
import { sides, type Side } from './config';
import { removeWhiteBackground } from './embroidery-estimate';
import { loadImage, tintGarment } from './garment-preview';
import { cmToLite, cmToLiteSize, ZONES, zoneById } from './zones';

/** Imagen subida, ya recortada a su contenido (sin fondo blanco ni márgenes transparentes). */
export type PlacedImage = { id: string; file: File; name: string; trimmed: HTMLCanvasElement | null; preview: string; whiteRemoved: boolean };
/** Una zona elegida: qué imagen va y a qué ancho (cm). */
export type Placement = { zone: string; img: string; ancho: number };
export type ImagePlacementValue = { images: PlacedImage[]; placed: Placement[] };

const MAX_IMAGES = 3;
const MAX_MB = 15;

/** Alto en cm de una imagen colocada a `ancho` cm. */
export const altoCm = (img: PlacedImage | undefined, ancho: number) =>
  img?.trimmed ? (ancho * img.trimmed.height) / img.trimmed.width : null;

/** Texto «Pecho izquierdo (9 × 6 cm)» de cada zona elegida. */
export function describePlacements(v: ImagePlacementValue) {
  return v.placed.map((p) => {
    const alto = altoCm(v.images.find((i) => i.id === p.img), p.ancho);
    return `${zoneById(p.zone)?.label ?? p.zone} (${p.ancho} × ${alto ? alto.toFixed(1) : '?'} cm)`;
  });
}

/** Carga una imagen y la recorta a su contenido; null si el navegador no la puede leer (PDF, HEIC…). */
async function prepare(file: File): Promise<PlacedImage> {
  const url = URL.createObjectURL(file);
  const base = { id: `${file.name}-${file.size}-${Date.now()}`, file, name: file.name };
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const whiteRemoved = removeWhiteBackground(c);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (d[(y * c.width + x) * 4 + 3] > 128) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
    if (x1 < 0) return { ...base, trimmed: null, preview: url, whiteRemoved };
    const t = document.createElement('canvas');
    t.width = x1 - x0 + 1;
    t.height = y1 - y0 + 1;
    t.getContext('2d')!.drawImage(c, x0, y0, t.width, t.height, 0, 0, t.width, t.height);
    return { ...base, trimmed: t, preview: t.toDataURL('image/png'), whiteRemoved };
  } catch {
    return { ...base, trimmed: null, preview: '', whiteRemoved: false };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Opción «Adjuntar imagen»: el cliente sube su imagen, marca sobre la sudadera las zonas donde la
 * quiere (pecho, espalda, mangas…) y el ancho aproximado en cm. La vista es una referencia de
 * colocación sobre la misma foto de la prenda que el estudio, a escala real.
 */
export function ImagePlacement({
  value,
  onChange,
  garmentHex,
  liteImages
}: {
  value: ImagePlacementValue;
  onChange: (v: ImagePlacementValue) => void;
  garmentHex: string;
  liteImages?: Partial<Record<Side, string>>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [side, setSide] = useState<Side>('delante');
  const [error, setError] = useState<string | null>(null);
  const [garments, setGarments] = useState<Partial<Record<Side, string>>>({});

  // Foto de la prenda teñida del color elegido (la misma que la vista ligera del estudio)
  useEffect(() => {
    let live = true;
    for (const s of ['delante', 'detras'] as const) {
      const url = liteImages?.[s];
      if (!url) continue;
      loadImage(url)
        .then((img) => live && setGarments((g) => ({ ...g, [s]: tintGarment(img, garmentHex, 700).toDataURL() })))
        .catch(() => undefined);
    }
    return () => {
      live = false;
    };
  }, [liteImages, garmentHex]);

  async function add(list: FileList | null) {
    if (!list?.length) return;
    const errs: string[] = [];
    const ok = [...list].filter((f) => {
      if (!/^image\//.test(f.type) && !/\.(png|jpe?g|webp|gif|svg|heic)$/i.test(f.name)) return errs.push(`«${f.name}» no es una imagen (PNG, JPG, WEBP o SVG).`), false;
      if (f.size > MAX_MB * 1024 * 1024) return errs.push(`«${f.name}» pesa ${(f.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${MAX_MB} MB.`), false;
      return true;
    });
    const room = MAX_IMAGES - value.images.length;
    if (ok.length > room) errs.push(`Puedes subir hasta ${MAX_IMAGES} imágenes.`);
    const prepared = await Promise.all(ok.slice(0, Math.max(0, room)).map(prepare));
    for (const p of prepared) if (!p.trimmed) errs.push(`No podemos leer «${p.name}» en el navegador para calcular el precio. Guárdala como PNG o JPG, o pídenos que te lo diseñemos (más abajo).`);
    setError(errs.join(' ') || null);
    const images = [...value.images, ...prepared.filter((p) => p.trimmed)];
    // Primera imagen: se propone el centro del pecho
    const placed = value.placed.length || !images.length ? value.placed : [{ zone: 'centro-pecho', img: images[0].id, ancho: zoneById('centro-pecho')!.ancho }];
    onChange({ images, placed });
    if (input.current) input.current.value = '';
  }

  const toggle = (zone: string) => {
    const on = value.placed.some((p) => p.zone === zone);
    const z = zoneById(zone)!;
    onChange({
      ...value,
      placed: on ? value.placed.filter((p) => p.zone !== zone) : [...value.placed, { zone, img: value.images[0]?.id ?? '', ancho: z.ancho }]
    });
  };
  const update = (zone: string, patch: Partial<Placement>) =>
    onChange({ ...value, placed: value.placed.map((p) => (p.zone === zone ? { ...p, ...patch } : p)) });
  const removeImage = (id: string) => {
    const images = value.images.filter((i) => i.id !== id);
    onChange({ images, placed: images.length ? value.placed.map((p) => (p.img === id ? { ...p, img: images[0].id } : p)) : [] });
  };

  const zonesHere = ZONES.filter((z) => z.side === side);
  const byId = useMemo(() => new Map(value.images.map((i) => [i.id, i])), [value.images]);

  return (
    <div className="space-y-5">
      {/* Imágenes */}
      <div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-tinta/20 bg-lino px-4 py-6 text-center transition hover:border-hilo"
        >
          <UploadIcon className="h-7 w-7 text-hilo" />
          <span className="text-sm font-semibold">{value.images.length ? 'Añadir otra imagen' : 'Sube tu imagen'}</span>
          <span className="text-xs text-tinta-500">PNG, JPG, WEBP o SVG · hasta {MAX_IMAGES} imágenes de {MAX_MB} MB · desde la galería o el ordenador</span>
        </button>
        <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
        {error && <p className="mt-2 rounded-xl bg-hilo-100 px-3 py-2 text-sm text-hilo-600" role="alert">{error}</p>}
        {value.images.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {value.images.map((i, n) => (
              <li key={i.id} className="flex items-center gap-2 rounded-full bg-lino-100 py-1 pl-1 pr-3 text-xs ring-1 ring-tinta/10">
                {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (dataURL) */}
                <img src={i.preview} alt="" className="h-8 w-8 rounded-full bg-white object-contain" />
                <span className="max-w-[9rem] truncate">Imagen {n + 1}: {i.name}</span>
                <button type="button" onClick={() => removeImage(i.id)} aria-label={`Quitar ${i.name}`} className="text-base leading-none text-tinta-500">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {value.images.length > 0 && (
        <>
          {/* Sudadera con las zonas */}
          <div>
            <div className="mb-2 grid grid-cols-2 gap-1 rounded-full bg-lino-200 p-1 text-sm font-medium" role="group" aria-label="Lado de la prenda">
              {sides.map((s) => (
                <button key={s.id} type="button" onClick={() => setSide(s.id)} aria-pressed={side === s.id} className={cn('rounded-full py-2', side === s.id && 'bg-lino-100 shadow')}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl bg-[#ece8e1] ring-1 ring-tinta/10">
              {/* eslint-disable-next-line @next/next/no-img-element -- foto teñida en el navegador */}
              {garments[side] && <img src={garments[side]} alt={`Sudadera, ${side === 'delante' ? 'delante' : 'detrás'}`} className="absolute inset-0 h-full w-full" />}
              {value.placed
                .filter((p) => zoneById(p.zone)?.side === side)
                .map((p) => {
                  const z = zoneById(p.zone)!;
                  const img = byId.get(p.img);
                  if (!img?.trimmed) return null;
                  const at = cmToLite(z.x, z.y);
                  const w = cmToLiteSize(p.ancho);
                  const h = w * (img.trimmed.height / img.trimmed.width);
                  return (
                    // eslint-disable-next-line @next/next/no-img-element -- diseño del cliente (dataURL)
                    <img
                      key={p.zone}
                      src={img.preview}
                      alt=""
                      className="pointer-events-none absolute"
                      style={{ left: `${(at.u - w / 2) * 100}%`, top: `${(at.v - h / 2) * 100}%`, width: `${w * 100}%` }}
                    />
                  );
                })}
              {zonesHere.map((z) => {
                const at = cmToLite(z.x, z.y);
                const on = value.placed.some((p) => p.zone === z.id);
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => toggle(z.id)}
                    aria-pressed={on}
                    title={z.label}
                    aria-label={`${on ? 'Quitar' : 'Poner'} el diseño en ${z.label.toLowerCase()}`}
                    className={cn(
                      'absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-xs font-bold shadow ring-2 ring-white/90 transition',
                      on ? 'bg-hilo text-white' : 'bg-white/85 text-tinta hover:bg-white'
                    )}
                    style={{ left: `${at.u * 100}%`, top: `${at.v * 100}%` }}
                  >
                    {on ? '✓' : '+'}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-center text-xs text-tinta-500">Toca los círculos o elige las zonas en la lista. Vista orientativa a escala real (talla M).</p>
          </div>

          {/* Zonas y tamaños */}
          <fieldset className="min-w-0">
            <legend className="label">Zonas ({side === 'delante' ? 'delante y mangas' : 'detrás'})</legend>
            <div className="flex flex-wrap gap-2">
              {zonesHere.map((z) => {
                const on = value.placed.some((p) => p.zone === z.id);
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => toggle(z.id)}
                    aria-pressed={on}
                    className={cn('rounded-full border px-3.5 py-2 text-sm transition', on ? 'border-tinta bg-tinta text-lino' : 'border-tinta/20 bg-lino-100 hover:border-tinta')}
                  >
                    {z.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {value.placed.length > 0 && (
            <ul className="space-y-2">
              {value.placed.map((p) => {
                const z = zoneById(p.zone)!;
                const img = byId.get(p.img);
                const alto = altoCm(img, p.ancho);
                return (
                  <li key={p.zone} className="rounded-2xl bg-lino-100 p-3 ring-1 ring-tinta/10">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{z.label}</p>
                      <button type="button" onClick={() => toggle(p.zone)} className="text-xs text-tinta-500 underline">Quitar</button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {value.images.length > 1 && (
                        <select className="field !w-auto !py-2 text-sm" value={p.img} onChange={(e) => update(p.zone, { img: e.target.value })} aria-label={`Imagen para ${z.label}`}>
                          {value.images.map((i, n) => (
                            <option key={i.id} value={i.id}>Imagen {n + 1}</option>
                          ))}
                        </select>
                      )}
                      <label className="flex items-center gap-2 text-sm">
                        Ancho
                        <span className="flex items-center rounded-full border border-tinta/20 bg-lino">
                          <button type="button" className="px-3 py-1.5" aria-label="Más estrecho" onClick={() => update(p.zone, { ancho: Math.max(3, p.ancho - 1) })}>−</button>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={3}
                            max={z.max}
                            step={0.5}
                            value={p.ancho}
                            onChange={(e) => {
                              const n = Number(e.target.value.replace(',', '.'));
                              if (Number.isFinite(n) && n > 0) update(p.zone, { ancho: Math.min(z.max, n) });
                            }}
                            className="w-12 bg-transparent text-center tabular-nums outline-none"
                            aria-label={`Ancho en cm para ${z.label}`}
                          />
                          <button type="button" className="px-3 py-1.5" aria-label="Más ancho" onClick={() => update(p.zone, { ancho: Math.min(z.max, p.ancho + 1) })}>+</button>
                        </span>
                        cm
                      </label>
                      {alto !== null && <span className="text-xs text-tinta-500">≈ {alto.toFixed(1)} cm de alto</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/** Captura de la colocación de un lado (prenda teñida + imágenes) para adjuntarla al pedido. */
export async function capturePlacement(v: ImagePlacementValue, side: Side, garmentHex: string, liteUrl?: string): Promise<Blob | null> {
  const S = 900;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ece8e1';
  ctx.fillRect(0, 0, S, S);
  if (liteUrl) ctx.drawImage(tintGarment(await loadImage(liteUrl), garmentHex, S), 0, 0);
  for (const p of v.placed) {
    const z = zoneById(p.zone);
    const img = v.images.find((i) => i.id === p.img);
    if (!z || z.side !== side || !img?.trimmed) continue;
    const at = cmToLite(z.x, z.y);
    const w = cmToLiteSize(p.ancho) * S;
    const h = w * (img.trimmed.height / img.trimmed.width);
    ctx.drawImage(img.trimmed, at.u * S - w / 2, at.v * S - h / 2, w, h);
  }
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
}
