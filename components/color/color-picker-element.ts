/**
 * <br-color-picker>: selector de color único para toda la web (estudio 3D, formularios Liquid…).
 *
 * Atributos:
 *   kind="color" | "thread"   color libre (prenda) o hilo de bordado (busca el hilo real más cercano)
 *   free="false"              sin selector libre (p. ej. modo "stock" de color de prenda)
 *   value="#rrggbb"           color inicial
 *   label="Color de la prenda"
 *   swatches='[{"name":"Negro","hex":"#111111"}]'   cuadrícula (kind=color; por defecto, COLORES_HABITUALES)
 *   thread-palette-url="…/br-hilos.json"             paleta de hilos (kind=thread)
 *   name="contact[Color]"     crea campos ocultos para formularios (valor hex y, si es hilo, el hilo)
 * Propiedades: .value, .swatches, .threadPalette
 * Evento: "color-change" → detail { hex, name, thread? }
 */
import { contrastText, hexToRgb, hsvToRgb, normalizeHex, rgbToHex, rgbToHsv } from './color-math';
import { COLORES_HABITUALES } from './color-config';
import { DEFAULT_THREADS, loadThreadPalette, nearestThread, threadLabel, type Thread } from './threads';

export type ColorChangeDetail = { hex: string; name: string; thread?: Thread };
type Swatch = { name: string; hex: string };

const CSS = `
:host { display:block; --accent:#c2461f; --ink:#171412; --muted:#6b625c; --line:rgba(23,20,18,.15); --bg:#fbf8f3; font: inherit; color: var(--ink); }
* { box-sizing:border-box; }
.label { display:block; font-size:14px; font-weight:600; margin:0 0 8px; }
.current { display:flex; align-items:center; gap:12px; padding:10px; border:1px solid var(--line); border-radius:16px; background:var(--bg); }
.big { width:52px; height:52px; border-radius:14px; flex:none; box-shadow: inset 0 0 0 1px rgba(0,0,0,.15); }
.info { min-width:0; display:grid; gap:2px; font-size:14px; }
.info strong { font-size:15px; }
.hexline { font-family: ui-monospace, Menlo, monospace; color:var(--muted); font-size:13px; }
.thread { display:flex; align-items:center; gap:6px; font-size:13px; }
.thread i { width:16px; height:16px; border-radius:50%; display:inline-block; box-shadow: inset 0 0 0 1px rgba(0,0,0,.2); }
.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(44px, 1fr)); gap:8px; margin-top:10px; max-height:220px; overflow-y:auto; padding:3px; }
.sw { width:100%; aspect-ratio:1; min-height:44px; border-radius:12px; border:0; cursor:pointer; position:relative; box-shadow: inset 0 0 0 1px rgba(0,0,0,.18); padding:0; }
.sw[aria-pressed="true"] { outline:3px solid var(--accent); outline-offset:2px; }
.sw[aria-pressed="true"]::after { content:"✓"; position:absolute; inset:0; display:grid; place-items:center; font-weight:700; color:var(--check, #fff); }
.sw:focus-visible, button:focus-visible, input:focus-visible, summary:focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
details { margin-top:10px; border:1px solid var(--line); border-radius:16px; background:var(--bg); }
summary { cursor:pointer; list-style:none; padding:12px 14px; font-size:14px; font-weight:600; min-height:44px; display:flex; align-items:center; justify-content:space-between; }
summary::-webkit-details-marker { display:none; }
summary::after { content:"+"; font-size:18px; }
details[open] summary::after { content:"−"; }
.free { padding:0 14px 14px; display:grid; gap:12px; }
.sv { position:relative; height:170px; border-radius:12px; touch-action:none; cursor:crosshair;
  background: linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0)); }
.knob { position:absolute; width:26px; height:26px; margin:-13px 0 0 -13px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 0 1px rgba(0,0,0,.4), 0 2px 6px rgba(0,0,0,.3); pointer-events:none; }
.hue { position:relative; height:32px; border-radius:16px; touch-action:none; cursor:pointer;
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00); }
.hue .knob { top:50%; }
.hexrow { display:flex; align-items:center; gap:8px; }
.hexrow label { font-size:13px; font-weight:600; }
.hexrow input { flex:1; min-width:0; height:44px; border:1px solid var(--line); border-radius:12px; padding:0 12px; font: 15px ui-monospace, Menlo, monospace; background:#fff; color:var(--ink); }
.hexrow input[aria-invalid="true"] { border-color: var(--accent); }
.note { font-size:12px; color:var(--muted); margin:0; }
`;

// En servidor (SSR) no existe HTMLElement: la clase solo se usa en el navegador.
const Base = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

export class BrColorPicker extends Base {
  static observedAttributes = ['value', 'label', 'swatches', 'kind', 'free', 'thread-palette-url'];

  private root: ShadowRoot;
  private _value = '#1c1c1e';
  private _swatches: Swatch[] = [];
  private _threads: Thread[] = DEFAULT_THREADS;
  private hsv: [number, number, number] = [0, 0, 0.1];
  private hiddenInputs: HTMLInputElement[] = [];

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  get kind() {
    return this.getAttribute('kind') === 'thread' ? 'thread' : 'color';
  }
  get free() {
    return this.getAttribute('free') !== 'false';
  }
  get value() {
    return this._value;
  }
  set value(v: string) {
    const h = normalizeHex(v);
    if (!h || h === this._value) return;
    this._value = h;
    this.hsv = rgbToHsv(hexToRgb(h));
    this.update();
  }
  get swatches() {
    return this._swatches;
  }
  set swatches(s: Swatch[]) {
    this._swatches = Array.isArray(s) ? s : [];
    this.render();
  }
  get threadPalette() {
    return this._threads;
  }
  set threadPalette(t: Thread[]) {
    this._threads = t?.length ? t : DEFAULT_THREADS;
    this.render();
  }
  get thread(): Thread | undefined {
    return this.kind === 'thread' ? nearestThread(this._value, this._threads) : undefined;
  }

  connectedCallback() {
    const v = normalizeHex(this.getAttribute('value') ?? '');
    if (v) {
      this._value = v;
      this.hsv = rgbToHsv(hexToRgb(v));
    }
    const url = this.getAttribute('thread-palette-url');
    if (this.kind === 'thread' && url)
      loadThreadPalette(url).then((t) => {
        this.threadPalette = t;
      });
    this.setupHiddenInputs();
    this.render();
  }

  attributeChangedCallback(name: string, _old: string | null, val: string | null) {
    if (!this.isConnected) return;
    if (name === 'value' && val) this.value = val;
    else if (name === 'swatches') {
      try {
        this._swatches = JSON.parse(val || '[]');
      } catch {
        this._swatches = [];
      }
      this.render();
    } else this.render();
  }

  /** Campos ocultos en el DOM normal para que los formularios (Liquid) envíen el valor. */
  private setupHiddenInputs() {
    const name = this.getAttribute('name');
    if (!name || this.hiddenInputs.length) return;
    const mk = (n: string) => {
      const i = document.createElement('input');
      i.type = 'hidden';
      i.name = n;
      this.appendChild(i);
      return i;
    };
    this.hiddenInputs = [mk(name)];
    if (this.kind === 'thread') this.hiddenInputs.push(mk(name.replace(/\]$/, ' (hilo)]')));
  }

  private gridColors(): Swatch[] {
    if (this.kind === 'thread') return this._threads.map((t) => ({ name: threadLabel(t), hex: t.hex }));
    if (this._swatches.length) return this._swatches;
    try {
      const attr = JSON.parse(this.getAttribute('swatches') || '[]');
      return Array.isArray(attr) && attr.length ? attr : COLORES_HABITUALES;
    } catch {
      return COLORES_HABITUALES;
    }
  }

  private nameOf(hex: string) {
    if (this.kind === 'thread') return this.thread ? threadLabel(this.thread) : hex;
    return this.gridColors().find((s) => s.hex.toLowerCase() === hex)?.name ?? 'Personalizado';
  }

  private render() {
    const label = this.getAttribute('label');
    const colors = this.gridColors();
    this.root.innerHTML = `
      <style>${CSS}</style>
      ${label ? `<span class="label" id="lbl">${escapeHtml(label)}</span>` : ''}
      <div class="current" aria-live="polite">
        <span class="big"></span>
        <span class="info"><strong class="nm"></strong><span class="hexline"></span><span class="thread" hidden></span></span>
      </div>
      <div class="grid" role="group" aria-label="${escapeHtml(label || 'Colores')}">
        ${colors
          .map(
            (c) =>
              `<button type="button" class="sw" data-hex="${c.hex.toLowerCase()}" title="${escapeHtml(c.name)} · ${c.hex}" aria-label="${escapeHtml(c.name)}" style="background:${c.hex};--check:${contrastText(c.hex)}"></button>`
          )
          .join('')}
      </div>
      ${
        this.free
          ? `<details><summary>${this.kind === 'thread' ? 'Cualquier color (buscamos el hilo más parecido)' : 'Elegir cualquier color'}</summary>
          <div class="free">
            <div class="sv" role="slider" tabindex="0" aria-label="Saturación y luminosidad"><span class="knob"></span></div>
            <div class="hue" role="slider" tabindex="0" aria-label="Tono" aria-valuemin="0" aria-valuemax="360"><span class="knob"></span></div>
            <div class="hexrow"><label for="hx">Código</label><input id="hx" inputmode="text" autocomplete="off" spellcheck="false" maxlength="7" placeholder="#000000"></div>
            ${this.kind === 'thread' ? '<p class="note">El color elegido se ajusta al hilo real más cercano de nuestra carta.</p>' : ''}
          </div></details>`
          : ''
      }`;
    this.root.querySelectorAll<HTMLButtonElement>('.sw').forEach((b) =>
      b.addEventListener('click', () => this.pick(b.dataset.hex!))
    );
    if (this.free) this.bindFree();
    this.update();
  }

  private bindFree() {
    const sv = this.root.querySelector<HTMLElement>('.sv')!;
    const hue = this.root.querySelector<HTMLElement>('.hue')!;
    const hex = this.root.querySelector<HTMLInputElement>('#hx')!;
    const drag = (el: HTMLElement, fn: (x: number, y: number) => void) => {
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        fn(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
      };
      el.addEventListener('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        move(e);
        const up = () => {
          el.removeEventListener('pointermove', move);
          this.emit();
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up, { once: true });
        el.addEventListener('pointercancel', up, { once: true });
      });
    };
    const fromHsv = (live: boolean) => {
      this._value = rgbToHex(hsvToRgb(...this.hsv));
      this.update();
      if (live) this.emit(true);
    };
    drag(sv, (x, y) => {
      this.hsv = [this.hsv[0], x, 1 - y];
      fromHsv(true);
    });
    drag(hue, (x) => {
      this.hsv = [x * 360, this.hsv[1] || 0.8, this.hsv[2] || 0.8];
      fromHsv(true);
    });
    const keys = (el: HTMLElement, fn: (d: number) => void) =>
      el.addEventListener('keydown', (e) => {
        const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
        if (d) {
          e.preventDefault();
          fn(d);
          this.emit();
        }
      });
    keys(sv, (d) => {
      this.hsv = [this.hsv[0], this.hsv[1], Math.min(1, Math.max(0, this.hsv[2] + d * 0.04))];
      fromHsv(false);
    });
    keys(hue, (d) => {
      this.hsv = [(this.hsv[0] + d * 6 + 360) % 360, this.hsv[1], this.hsv[2]];
      fromHsv(false);
    });
    hex.addEventListener('input', () => {
      const h = normalizeHex(hex.value);
      hex.setAttribute('aria-invalid', String(!h && hex.value.length > 0));
      if (h && h.length === 7 && hex.value.replace('#', '').length >= 6) this.pick(h, false);
    });
    hex.addEventListener('change', () => {
      const h = normalizeHex(hex.value);
      if (h) this.pick(h);
    });
  }

  private pick(hex: string, syncHexField = true) {
    const h = normalizeHex(hex);
    if (!h) return;
    this._value = h;
    this.hsv = rgbToHsv(hexToRgb(h));
    this.update(syncHexField);
    this.emit();
  }

  private update(syncHexField = true) {
    const v = this._value;
    const r = this.root;
    const big = r.querySelector<HTMLElement>('.big');
    if (!big) return;
    big.style.background = v;
    r.querySelector('.nm')!.textContent = this.nameOf(v);
    r.querySelector('.hexline')!.textContent = v.toUpperCase();
    const th = r.querySelector<HTMLElement>('.thread')!;
    const t = this.thread;
    th.hidden = !t;
    if (t) th.innerHTML = `<i style="background:${t.hex}"></i>Se borda con: ${escapeHtml(threadLabel(t))}`;
    const target = (t?.hex ?? v).toLowerCase();
    r.querySelectorAll<HTMLButtonElement>('.sw').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hex === target)));
    const sv = r.querySelector<HTMLElement>('.sv');
    if (sv) {
      sv.style.backgroundColor = rgbToHex(hsvToRgb(this.hsv[0], 1, 1));
      const k = sv.querySelector<HTMLElement>('.knob')!;
      k.style.left = `${this.hsv[1] * 100}%`;
      k.style.top = `${(1 - this.hsv[2]) * 100}%`;
      k.style.background = v;
      const hk = r.querySelector<HTMLElement>('.hue .knob')!;
      hk.style.left = `${(this.hsv[0] / 360) * 100}%`;
      hk.style.background = rgbToHex(hsvToRgb(this.hsv[0], 1, 1));
      const hx = r.querySelector<HTMLInputElement>('#hx')!;
      if (syncHexField && this.root.activeElement !== hx) hx.value = v.toUpperCase();
    }
    if (this.hiddenInputs[0]) this.hiddenInputs[0].value = v;
    if (this.hiddenInputs[1]) this.hiddenInputs[1].value = t ? `${threadLabel(t)} (${t.hex})` : '';
  }

  private emit(live = false) {
    const detail: ColorChangeDetail & { live: boolean } = { hex: this._value, name: this.nameOf(this._value), thread: this.thread, live };
    this.dispatchEvent(new CustomEvent('color-change', { detail, bubbles: true, composed: true }));
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function defineColorPicker() {
  if (typeof window !== 'undefined' && !customElements.get('br-color-picker')) customElements.define('br-color-picker', BrColorPicker);
}
