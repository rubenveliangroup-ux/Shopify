'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ArrowIcon, CheckIcon, UploadIcon } from '../icons';
import { fabricColors } from './config';

export type OwnDesignData = {
  files: File[];
  lado: 'Delante' | 'Detrás' | 'Delante y detrás';
  posicionDelante: string;
  posicionDetras: string;
  tamano: string;
  color: string;
  hilos: string;
  especificaciones: string;
};

const MAX_FILES = 4;
const MAX_MB = 10;
const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,application/pdf';

const frontPositions = ['Pecho izquierdo', 'Pecho derecho', 'Centro del pecho', 'Grande centrado', 'Parte baja'];
const backPositions = ['Bajo el cuello', 'Centro de la espalda', 'Grande en toda la espalda', 'Parte baja'];

/**
 * Para quien ya tiene su diseño: sube los archivos y describe cómo quiere el bordado.
 * Todo viaja al pedido (Shopify) o al brief (web headless).
 */
export function OwnDesignForm({
  defaultColor,
  ctaLabel,
  onSubmit
}: {
  defaultColor: string;
  ctaLabel: string;
  onSubmit: (data: OwnDesignData) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [lado, setLado] = useState<OwnDesignData['lado']>('Delante');
  const [posDelante, setPosDelante] = useState(frontPositions[0]);
  const [posDetras, setPosDetras] = useState(backPositions[1]);
  const [otraDelante, setOtraDelante] = useState('');
  const [otraDetras, setOtraDetras] = useState('');
  const [tamano, setTamano] = useState('');
  const [color, setColor] = useState(defaultColor);
  const [hilos, setHilos] = useState('');
  const [specs, setSpecs] = useState('');
  const [error, setError] = useState<string | null>(null);

  const front = lado !== 'Detrás';
  const back = lado !== 'Delante';

  function addFiles(list: FileList | null) {
    if (!list) return;
    const ok = [...list].filter((f) => f.size <= MAX_MB * 1024 * 1024);
    setError(ok.length < list.length ? `Algún archivo supera ${MAX_MB} MB.` : null);
    setFiles((prev) => [...prev, ...ok].slice(0, MAX_FILES));
  }

  function submit() {
    if (!files.length) {
      setError('Sube al menos un archivo con tu diseño.');
      return;
    }
    onSubmit({
      files,
      lado,
      posicionDelante: front ? (posDelante === 'Otra' ? otraDelante || 'Otra (ver especificaciones)' : posDelante) : '',
      posicionDetras: back ? (posDetras === 'Otra' ? otraDetras || 'Otra (ver especificaciones)' : posDetras) : '',
      tamano: tamano.trim(),
      color,
      hilos: hilos.trim(),
      especificaciones: specs.trim().slice(0, 1000)
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-10">
      <div className="space-y-7 rounded-3xl bg-lino-100 p-6 ring-1 ring-tinta/10 sm:p-8">
        {/* Archivos */}
        <div>
          <p className="font-display text-xl">1. Tu diseño</p>
          <p className="mt-1 text-sm text-tinta-500">Logo, ilustración, foto o boceto. Si tienes vector (SVG, PDF), mejor.</p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            className="mt-3 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-tinta/20 bg-lino px-6 py-8 text-center transition hover:border-hilo"
          >
            <UploadIcon className="h-7 w-7 text-hilo" />
            <span className="text-sm font-medium">Arrastra aquí o toca para elegir</span>
            <span className="text-xs text-tinta-500">PNG, JPG, WEBP, SVG o PDF · hasta {MAX_FILES} archivos de {MAX_MB} MB</span>
          </button>
          <input
            ref={input}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          {files.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <li key={f.name + i} className="flex items-center gap-2 rounded-full bg-lino-200 py-1 pl-3 pr-1 text-xs">
                  {f.name}
                  <button
                    type="button"
                    aria-label={`Quitar ${f.name}`}
                    className="grid h-5 w-5 place-items-center rounded-full hover:bg-lino-300"
                    onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Dónde */}
        <div>
          <p className="font-display text-xl">2. Dónde lo bordamos</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(['Delante', 'Detrás', 'Delante y detrás'] as const).map((l) => (
              <Chip key={l} active={lado === l} onClick={() => setLado(l)}>{l}</Chip>
            ))}
          </div>

          {front && (
            <PositionPicker
              title="Posición delante"
              options={frontPositions}
              value={posDelante}
              onChange={setPosDelante}
              other={otraDelante}
              onOther={setOtraDelante}
            />
          )}
          {back && (
            <PositionPicker
              title="Posición detrás"
              options={backPositions}
              value={posDetras}
              onChange={setPosDetras}
              other={otraDetras}
              onOther={setOtraDetras}
            />
          )}

          <div className="mt-4">
            <label className="label" htmlFor="own-size">Tamaño aproximado</label>
            <input
              id="own-size"
              value={tamano}
              onChange={(e) => setTamano(e.target.value)}
              className="field"
              placeholder="Ej.: 9 cm de ancho delante y 28 cm detrás"
            />
          </div>
        </div>

        {/* Colores */}
        <div>
          <p className="font-display text-xl">3. Colores</p>
          <p className="label mt-3">Color de la prenda: {color}</p>
          <div className="flex flex-wrap gap-2">
            {fabricColors.map((c) => (
              <button
                key={c.hex}
                type="button"
                aria-label={c.name}
                title={c.name}
                onClick={() => setColor(c.name)}
                className={cn('h-9 w-9 rounded-full ring-1 ring-tinta/20', color === c.name && 'ring-2 ring-hilo ring-offset-2 ring-offset-lino')}
                style={{ background: c.hex }}
              />
            ))}
          </div>
          <div className="mt-4">
            <label className="label" htmlFor="own-threads">Colores de hilo</label>
            <input
              id="own-threads"
              value={hilos}
              onChange={(e) => setHilos(e.target.value)}
              className="field"
              placeholder="Ej.: como en el archivo / blanco y dorado / Pantone 186 C"
            />
          </div>
        </div>

        {/* Especificaciones */}
        <div>
          <p className="font-display text-xl">4. Especificaciones</p>
          <textarea
            rows={4}
            value={specs}
            onChange={(e) => setSpecs(e.target.value)}
            className="field mt-3"
            placeholder="Todo lo que quieras indicarnos: texto exacto, tipografía, qué partes van bordadas, si es un regalo, fecha límite…"
          />
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-3xl bg-lino-100 p-6 ring-1 ring-tinta/10">
          <p className="font-display text-2xl">Así funciona</p>
          <ul className="mt-4 space-y-2 text-sm text-tinta-700">
            {[
              'Adjuntamos tus archivos y especificaciones al pedido',
              'Preparamos el boceto bordable y te lo enviamos para aprobar',
              'No bordamos nada hasta que nos das el OK'
            ].map((t) => (
              <li key={t} className="flex gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-bosque" />{t}</li>
            ))}
          </ul>
          {error && <p className="mt-4 rounded-xl bg-hilo-100 px-4 py-3 text-sm text-hilo-600" role="alert">{error}</p>}
          <button type="button" onClick={submit} className="btn-primary mt-6 w-full py-4 text-base">
            {ctaLabel} <ArrowIcon className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </div>
  );
}

function PositionPicker({
  title,
  options,
  value,
  onChange,
  other,
  onOther
}: {
  title: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  other: string;
  onOther: (v: string) => void;
}) {
  return (
    <div className="mt-4">
      <p className="label">{title}</p>
      <div className="flex flex-wrap gap-2">
        {[...options, 'Otra'].map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={cn('rounded-full border px-3.5 py-1.5 text-sm transition', value === o ? 'border-tinta bg-tinta text-lino' : 'border-tinta/20 hover:border-tinta')}
          >
            {o}
          </button>
        ))}
      </div>
      {value === 'Otra' && (
        <input value={other} onChange={(e) => onOther(e.target.value)} className="field mt-2" placeholder="Describe dónde lo quieres" />
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('rounded-2xl border px-3 py-2.5 text-sm font-medium transition', active ? 'border-tinta bg-tinta text-lino' : 'border-tinta/15 bg-lino hover:border-tinta')}
    >
      {children}
    </button>
  );
}
