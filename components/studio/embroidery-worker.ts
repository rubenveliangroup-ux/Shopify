/// <reference lib="webworker" />
/**
 * Web Worker del hilado del diseño (assets/br-bordado-worker.js en el tema): el análisis y las
 * texturas del bordado se calculan aquí para no bloquear la interfaz mientras el cliente edita.
 */
import { threadize, type ThreadizeInput } from './embroidery-threadize';

self.onmessage = (e: MessageEvent<{ id: number; input: ThreadizeInput }>) => {
  const { id, input } = e.data;
  try {
    const result = threadize(input);
    const m = result.maps;
    const transfer = m ? [m.color.buffer, m.normal.buffer, m.aniso.buffer, m.shade.buffer] : [];
    (self as unknown as Worker).postMessage({ id, result }, transfer as Transferable[]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
