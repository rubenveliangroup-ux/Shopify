/// <reference lib="webworker" />
/**
 * Web Worker del hilado del diseño (assets/br-bordado-worker.js en el tema): la estimación de
 * puntadas se calcula aquí para no bloquear la interfaz mientras el cliente edita.
 */
import { threadize, type ThreadizeInput } from './embroidery-threadize';

self.onmessage = (e: MessageEvent<{ id: number; input: ThreadizeInput }>) => {
  const { id, input } = e.data;
  try {
    (self as unknown as Worker).postMessage({ id, result: threadize(input) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
