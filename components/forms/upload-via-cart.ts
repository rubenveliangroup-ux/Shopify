/**
 * Subida de archivos con lo que Shopify ya trae, sin servicios externos.
 *
 * El formulario de contacto de Shopify no acepta archivos, pero el carrito sí: un archivo enviado
 * como propiedad de una línea (/cart/add.js multipart) se guarda en el CDN de Shopify y la
 * respuesta devuelve su URL. Se añade un producto técnico oculto de 0 € («br-subida-archivos»)
 * con los archivos, se lee la URL y se quita la línea al momento. Las URL van luego en el
 * mensaje del formulario de contacto, que llega al email de la tienda.
 */
export const MAX_FILE_MB = 15;
export const ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.ai,.eps,.psd,.tif,.tiff,.heic';
const EXT = /\.(png|jpe?g|webp|gif|svg|pdf|ai|eps|psd|tiff?|heic)$/i;

/** Mensaje de error claro, o null si el archivo vale. */
export function validateFile(f: File): string | null {
  if (!EXT.test(f.name)) return `«${f.name}» no es un formato admitido. Usa imagen (PNG, JPG, WEBP, SVG…), PDF o vectorial (AI, EPS).`;
  if (f.size > MAX_FILE_MB * 1024 * 1024)
    return `«${f.name}» pesa ${(f.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${MAX_FILE_MB} MB. Comprímelo o envíanoslo por email.`;
  if (!f.size) return `«${f.name}» está vacío.`;
  return null;
}

export type Uploaded = { label: string; name: string; url: string };

export async function uploadViaCart(files: { label: string; file: File }[], opts: { variantId: number; root?: string }): Promise<Uploaded[]> {
  if (!files.length) return [];
  const root = (opts.root ?? '/').replace(/\/?$/, '/');
  const fd = new FormData();
  fd.append('items[0][id]', String(opts.variantId));
  fd.append('items[0][quantity]', '1');
  fd.append('items[0][properties][_br_subida]', String(Date.now()));
  files.forEach(({ label, file }) => fd.append(`items[0][properties][${label}]`, file, file.name));
  const res = await fetch(`${root}cart/add.js`, { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`No se pudo subir (${res.status})`);
  const data = (await res.json()) as { items?: { key: string; properties?: Record<string, string> }[]; key?: string; properties?: Record<string, string> };
  const line = data.items?.[0] ?? (data as { key: string; properties?: Record<string, string> });
  // Se quita la línea técnica del carrito (no se compra nunca)
  await fetch(`${root}cart/change.js`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ id: line.key, quantity: 0 })
  }).catch(() => undefined);
  const props = line.properties ?? {};
  const out = files.map(({ label, file }) => ({ label, name: file.name, url: absolute(String(props[label] ?? '')) }));
  if (out.some((u) => !/^https?:\/\//.test(u.url))) throw new Error('Shopify no devolvió la dirección del archivo');
  return out;
}

const absolute = (u: string) => (u.startsWith('//') ? `https:${u}` : u);

/**
 * Envía el formulario de contacto de Shopify (creado con {% form 'contact' %}) rellenando
 * campos ocultos. Es un envío normal (no AJAX): así funciona la protección anti-spam de Shopify
 * y, al volver, la página muestra la confirmación.
 */
export function submitContactForm(form: HTMLFormElement, fields: Record<string, string>) {
  form.querySelectorAll('[data-br-dyn]').forEach((n) => n.remove());
  for (const [k, v] of Object.entries(fields)) {
    const input = document.createElement('textarea');
    input.name = k;
    input.value = v;
    input.hidden = true;
    input.setAttribute('data-br-dyn', '');
    form.appendChild(input);
  }
  form.submit();
}
