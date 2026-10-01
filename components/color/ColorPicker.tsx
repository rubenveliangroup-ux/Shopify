'use client';

import { createElement, useEffect, useRef } from 'react';
import { defineColorPicker, type BrColorPicker, type ColorChangeDetail } from './color-picker-element';
import type { NamedColor } from './color-config';
import type { Thread } from './threads';

defineColorPicker();

type Props = {
  value: string;
  onChange: (d: ColorChangeDetail & { live?: boolean }) => void;
  kind?: 'color' | 'thread';
  /** Permitir color libre (rueda/degradado + hex). En modo "stock" de prenda: false. */
  free?: boolean;
  swatches?: NamedColor[];
  threads?: Thread[];
  label?: string;
  className?: string;
};

/** Envoltorio React del Web Component <br-color-picker> (un único componente en toda la web). */
export function ColorPicker({ value, onChange, kind = 'color', free = true, swatches, threads, label, className }: Props) {
  const ref = useRef<BrColorPicker>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = (e: Event) => cb.current((e as CustomEvent).detail);
    el.addEventListener('color-change', h);
    return () => el.removeEventListener('color-change', h);
  }, []);
  useEffect(() => {
    if (ref.current && swatches) ref.current.swatches = swatches;
  }, [swatches]);
  useEffect(() => {
    if (ref.current && threads) ref.current.threadPalette = threads;
  }, [threads]);
  useEffect(() => {
    if (ref.current) ref.current.value = value;
  }, [value]);

  return createElement('br-color-picker', { ref, kind, free: String(free), label, value, class: className });
}
