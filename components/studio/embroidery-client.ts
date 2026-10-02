import { threadize, type ThreadizeInput, type ThreadizeResult } from './embroidery-threadize';

/**
 * Ejecuta el hilado en un Web Worker (si hay URL) y, si no se puede, en el hilo principal tras
 * ceder un instante a la interfaz. Solo vale la última petición de cada lado: las anteriores se
 * descartan (el cliente sigue moviendo el diseño).
 */
export function createThreadizer(workerUrl?: string) {
  let worker: Worker | null = null;
  if (workerUrl && typeof Worker !== 'undefined') {
    try {
      worker = new Worker(workerUrl);
    } catch (e) {
      console.warn('[br-studio] Worker del bordado no disponible, se calcula en la página:', e);
    }
  }
  let seq = 0;
  const pending = new Map<number, (r: ThreadizeResult | null) => void>();
  const latest = new Map<string, number>();
  worker?.addEventListener('message', (e: MessageEvent<{ id: number; result?: ThreadizeResult; error?: string }>) => {
    const done = pending.get(e.data.id);
    pending.delete(e.data.id);
    if (e.data.error) console.warn('[br-studio] Error en el worker del bordado:', e.data.error);
    done?.(e.data.result ?? null);
  });
  worker?.addEventListener('error', (e) => {
    console.warn('[br-studio] El worker del bordado falló; se calcula en la página.', e.message);
    worker?.terminate();
    worker = null;
    for (const [, done] of pending) done(null);
    pending.clear();
  });

  /** Resultado de la última petición de `key`, o null si llegó otra más nueva entretanto. */
  async function run(key: string, input: ThreadizeInput): Promise<ThreadizeResult | null> {
    const id = ++seq;
    latest.set(key, id);
    let result: ThreadizeResult | null;
    if (worker) {
      result = await new Promise<ThreadizeResult | null>((resolve) => {
        pending.set(id, resolve);
        worker!.postMessage({ id, input }, [input.rgba.buffer]);
      });
    } else {
      await new Promise((r) => setTimeout(r, 0));
      if (latest.get(key) !== id) return null;
      result = threadize(input);
    }
    return latest.get(key) === id ? result : null;
  }

  return { run, dispose: () => worker?.terminate() };
}
