/**
 * assets/br-formularios.js — subida del diseño en «Cuéntanos tu proyecto».
 * Valida los archivos (formato y 15 MB), los sube al CDN de Shopify vía carrito y envía el
 * formulario de contacto con los enlaces. Si la subida falla, envía igual y lo indica.
 */
import { submitContactForm, uploadViaCart, validateFile } from '@/components/forms/upload-via-cart';

const MAX_FILES = 3;

function init() {
  const cfgEl = document.getElementById('br-brand-upload');
  if (!cfgEl) return;
  const cfg = JSON.parse(cfgEl.textContent || '{}') as { variantId: number | null; root: string; formId: string };
  const form = document.getElementById(cfg.formId) as HTMLFormElement | null;
  const input = form?.querySelector<HTMLInputElement>('[data-br-upload]');
  const err = document.getElementById('bb-file-err');
  const btn = form?.querySelector<HTMLButtonElement>('[data-br-submit]');
  if (!form || !input || !err || !btn) return;

  const showError = (msg: string | null) => {
    err.textContent = msg ?? '';
    err.hidden = !msg;
    input.setAttribute('aria-invalid', String(!!msg));
  };
  const check = () => {
    const files = Array.from(input.files ?? []);
    if (files.length > MAX_FILES) return `Puedes adjuntar hasta ${MAX_FILES} archivos. Si tienes más, envíanos un enlace (WeTransfer, Drive…) en el mensaje.`;
    for (const f of files) {
      const e = validateFile(f);
      if (e) return e;
    }
    return null;
  };
  input.addEventListener('change', () => showError(check()));

  let sending = false;
  form.addEventListener('submit', async (e) => {
    const files = Array.from(input.files ?? []);
    if (!files.length || sending) return; // sin archivos: envío normal del formulario
    e.preventDefault();
    const problem = check();
    if (problem) {
      showError(problem);
      input.focus();
      return;
    }
    if (!form.reportValidity()) return;
    sending = true;
    btn.disabled = true;
    btn.textContent = 'Subiendo tu diseño…';
    let note: string;
    try {
      if (!cfg.variantId) throw new Error('Falta el producto técnico de subida');
      const up = await uploadViaCart(
        files.map((file, i) => ({ label: `Diseño del cliente ${i + 1}`, file })),
        { variantId: cfg.variantId, root: cfg.root }
      );
      note = up.map((u) => `${u.name}: ${u.url}`).join('\n');
    } catch (error) {
      console.warn('[br-formularios] subida fallida', error);
      note = `(No se pudieron adjuntar: ${files.map((f) => f.name).join(', ')}. El cliente los enviará por email.)`;
    }
    btn.textContent = 'Enviando…';
    input.disabled = true; // el archivo en sí no viaja en el formulario de contacto
    submitContactForm(form, { 'contact[Archivos del diseño]': note });
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
