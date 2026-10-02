// Prepara el GLB de la sudadera (p. ej. exportado de Meshy) para el estudio 3D:
//   node shopify-theme/tools/preparar-prenda.mjs entrada.glb salida.glb [--talla-base M]
// 1. Escala a metros calibrando con la tabla de medidas (largo HPS→bajo de la talla base) y
//    deja el punto alto del hombro (HPS) en el origen, Y arriba, delantero hacia +Z.
// 2. Material mate de algodón: sin metal, rugosidad fija, sin mapa metal/rugosidad.
// 3. Color base NEUTRO y claro para teñir por multiplicación: desatura, normaliza la luminosidad,
//    quita motas y parches de luz horneada y conserva solo el grano fino de la tela.
// 4. Normal map suavizado (quita el ruido de alta frecuencia sin perder pliegues).
// 5. Guarda en extras.br las marcas de zonas (bajo, canalé, mangas) para cambiar de talla.
// Después: npm run glb:optimizar -- salida.glb salida-web.glb
import fs from 'node:fs';
import sharp from 'sharp';
import { createIO } from './glb-io.mjs';
import { readMedidas, rasterizeUV } from './glb-utils.mjs';

const args = process.argv.slice(2);
const [input, output] = args.filter((a) => !a.startsWith('--') && !/^[A-Z]{1,3}$/.test(a));
if (!input || !output) {
  console.error('Uso: node shopify-theme/tools/preparar-prenda.mjs entrada.glb salida.glb [--talla-base M]');
  process.exit(2);
}
const tallaBase = (args.includes('--talla-base') ? args[args.indexOf('--talla-base') + 1] : 'M').toUpperCase();
const medidas = readMedidas();
const base = medidas[tallaBase];
const TEX = 1024; // tamaño final de las texturas (1K: la base es casi lisa y el normal va suavizado)

const io = await createIO();
const doc = await io.read(input);
const root = doc.getRoot();
const meshes = root.listMeshes();
if (meshes.length !== 1 || meshes[0].listPrimitives().length !== 1) throw new Error('Se espera una sola malla con una primitiva (exportación de Meshy)');
const prim = meshes[0].listPrimitives()[0];
for (const n of root.listNodes()) if (n.getMesh()) {
  if (n.getRotation().some((v, i) => (i < 3 ? v : v - 1) !== 0) || n.getScale().some((v) => v !== 1)) throw new Error('El nodo tiene rotación/escala: aplícalas antes de exportar');
  n.setName('Cuerpo');
}
meshes[0].setName('Cuerpo');

// ---------- 1. Marcas y escala
const posA = prim.getAttribute('POSITION');
const norA = prim.getAttribute('NORMAL');
const P = [];
for (let i = 0; i < posA.getCount(); i++) P.push(posA.getElement(i, [0, 0, 0]));
const min = [0, 1, 2].map((k) => Math.min(...P.map((p) => p[k])));
const max = [0, 1, 2].map((k) => Math.max(...P.map((p) => p[k])));
const W = (max[0] - min[0]) / 2;
const cx = (max[0] + min[0]) / 2;
const Ht = max[1] - min[1];

// HPS: barriendo |x| hacia fuera, el borde de la capucha es donde la altura máxima cae de golpe
let hpsY = null;
let hoodHalf = null;
const tops = [];
for (let a = 0.1 * W; a < 0.7 * W; a += 0.025 * W) {
  const ys = P.filter((p) => Math.abs(p[0] - cx) >= a && Math.abs(p[0] - cx) < a + 0.025 * W).map((p) => p[1]);
  const top = Math.max(...ys);
  // Caída de más del 8 % del alto en dos franjas = fin de la capucha
  if (tops.length >= 2 && tops[tops.length - 2] - top > 0.08 * Ht) {
    hpsY = top;
    hoodHalf = a;
    break;
  }
  tops.push(top);
}
if (hpsY === null) throw new Error('No encuentro el hombro junto a la capucha (HPS)');
const hemY = Math.min(...P.filter((p) => Math.abs(p[0] - cx) < 0.3 * W).map((p) => p[1]));
const s = base.largo / 100 / (hpsY - hemY);
// Centro en profundidad del cuerpo a media altura
const mid = P.filter((p) => Math.abs(p[0] - cx) < 0.2 * W && Math.abs(p[1] - (hpsY + hemY) / 2) < 0.03 * Ht).map((p) => p[2]);
const cz = (Math.min(...mid) + Math.max(...mid)) / 2;

// Normales hacia fuera. La malla de Meshy tiene grosor (capa exterior + interior a ~5 mm), así que
// solo cuenta la capa más exterior: en cada celda del delantero, el vértice con mayor z.
const cells = new Map();
for (let i = 0; i < P.length; i++) {
  const p = P[i];
  if (Math.abs(p[0] - cx) > 0.25 * W || p[2] < cz) continue;
  const k = `${Math.round(p[0] / 0.02)},${Math.round(p[1] / 0.02)}`;
  if (!cells.has(k) || P[cells.get(k)][2] < p[2]) cells.set(k, i);
}
let outward = 0;
for (const i of cells.values()) outward += norA.getElement(i, [0, 0, 0])[2] > 0 ? 1 : -1;
const flip = outward < 0;
for (let i = 0; i < P.length; i++) {
  const p = P[i];
  posA.setElement(i, [(p[0] - cx) * s, (p[1] - hpsY) * s, (p[2] - cz) * s]);
  if (flip) {
    const n = norA.getElement(i, [0, 0, 0]);
    norA.setElement(i, [-n[0], -n[1], -n[2]]);
  }
}
if (flip) {
  const idx = prim.getIndices();
  for (let i = 0; i < idx.getCount(); i += 3) {
    const b = idx.getScalar(i + 1);
    idx.setScalar(i + 1, idx.getScalar(i + 2));
    idx.setScalar(i + 2, b);
  }
}
const Q = [];
for (let i = 0; i < posA.getCount(); i++) Q.push(posA.getElement(i, [0, 0, 0]));

// Medio ancho del cuerpo cerca del bajo (las mangas cuelgan a los lados): hueco en x
const hem = -base.largo / 100;
const ribTop = hem + 0.07; // canalé del bajo ≈ 7 cm

// Pecho en plano = medio contorno del cuerpo 2,5 cm bajo la sisa. La sisa es la altura más alta
// en la que el corte horizontal ya separa el cuerpo de las dos mangas (3 contornos cerrados).
const idxA = prim.getIndices();
// Los vértices están partidos en las costuras UV: se sueldan por posición para seguir los contornos
const weldId = new Map();
const welded = Q.map((p) => {
  const k = p.map((v) => Math.round(v * 1e5)).join(',');
  if (!weldId.has(k)) weldId.set(k, weldId.size);
  return weldId.get(k);
});
const TRI = [];
for (let i = 0; i < idxA.getCount(); i += 3) TRI.push([idxA.getScalar(i), idxA.getScalar(i + 1), idxA.getScalar(i + 2)]);
let armpitY = null;
for (let y = -0.08; y > hem + 0.1; y -= 0.005) {
  const loops = sliceLoops(Q, TRI, y).filter((l) => l.length > 20);
  if (loops.length >= 3 && loops.some((l) => encloses(l, 0, 0))) {
    armpitY = y;
    break;
  }
}
if (armpitY === null) throw new Error('No encuentro la sisa (el corte nunca separa cuerpo y mangas)');
const bodyLoop = (y) => sliceLoops(Q, TRI, y).find((l) => encloses(l, 0, 0));
// Pecho en plano = medio contorno del cuerpo 2,5 cm bajo la sisa (la tabla mide de axila a axila)
const chestY = armpitY - 0.025;
const chestRaw = halfHull(bodyLoop(chestY));
const kxz = base.pecho / chestRaw; // calibra ancho y fondo de todo el modelo
for (let i = 0; i < Q.length; i++) {
  Q[i] = [Q[i][0] * kxz, Q[i][1], Q[i][2] * kxz];
  posA.setElement(i, Q[i]);
}
const chest = halfHull(bodyLoop(chestY));
// Mangas. Más abajo de la sisa Meshy fusiona las mangas con los costados y no se separan por
// conectividad: se usa el ancho del cuerpo en la vista frontal. Por debajo de la sisa la manga cuelga
// a partir de ~0,62 × medio ancho del pecho; por encima, la copa empieza en la costura del hombro caído.
const bodyHalf = Math.max(...bodyLoop(chestY).map((p) => Math.abs(p[0])));
const cuffY = Math.min(...Q.map((p) => p[1]));
const sisa = armpitY;
const sleeveW = new Float32Array(Q.length);
Q.forEach((p, i) => {
  const t = smoothstep(sisa + 0.04, sisa - 0.04, p[1]); // 0 arriba (hombro), 1 abajo
  const x0 = 0.88 * bodyHalf * (1 - t) + 0.66 * bodyHalf * t;
  sleeveW[i] = smoothstep(x0 - 0.02, x0 + 0.02, Math.abs(p[0]));
});
const shoulderY = Math.max(...Q.filter((p, i) => sleeveW[i] > 0.5).map((p) => p[1]));
const torsoPts = (y) => Q.filter((p, i) => Math.abs(p[1] - y) < 0.006 && sleeveW[i] < 0.5);
// Canalé del bajo: peso 1 en el canalé y transición de 4 cm por encima (la tela cae abultada)
const ribW = new Float32Array(Q.length);
Q.forEach((p, i) => (ribW[i] = (1 - sleeveW[i]) * smoothstep(ribTop + 0.04, ribTop, p[1])));
// Bajo relajado de la tabla: se estrecha el canalé (el modelo lo trae más ancho)
const hemRaw = halfHull(torsoPts(hem + 0.02));
let hemWidth = hemRaw;
for (let it = 0; it < 4 && Math.abs(hemWidth - base.bajo) > 0.2; it++) {
  const kB = base.bajo / hemWidth;
  for (let i = 0; i < Q.length; i++) {
    const f = 1 + ribW[i] * (kB - 1);
    Q[i] = [Q[i][0] * f, Q[i][1], Q[i][2] * f];
    posA.setElement(i, Q[i]);
  }
  hemWidth = halfHull(torsoPts(hem + 0.02));
}
const zona = new Float32Array(Q.length * 2);
for (let i = 0; i < Q.length; i++) {
  zona[i * 2] = sleeveW[i];
  zona[i * 2 + 1] = ribW[i];
}
prim.setAttribute('_BR_ZONA', doc.createAccessor('br-zona').setType('VEC2').setArray(zona).setBuffer(root.listBuffers()[0]));

// ---------- 2-4. Material y texturas
const mat = prim.getMaterial();
mat.setName('Felpa').setMetallicFactor(0).setRoughnessFactor(0.92).setDoubleSided(true);
const mr = mat.getMetallicRoughnessTexture();
mat.setMetallicRoughnessTexture(null);
if (mr && !root.listMaterials().some((m) => m.getMetallicRoughnessTexture() === mr)) mr.dispose();

const mask = rasterizeUV([prim], 2048, 2); // islas UV (+2 px de margen)
const bc = mat.getBaseColorTexture();
const nt = mat.getNormalTexture();
const before = { base: bc.getImage().byteLength, normal: nt.getImage().byteLength };

{
  const { data, info } = await sharp(Buffer.from(bc.getImage())).resize(2048, 2048).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const N = info.width * info.height;
  const L = new Float32Array(N);
  for (let i = 0; i < N; i++) L[i] = (0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2]) / 255;
  // Quita motas: pixeles mucho más claros que su entorno se sustituyen por el entorno
  const env = maskedBlur(L, mask, info.width, 6);
  for (let i = 0; i < N; i++) if (mask[i] && L[i] > env[i] * 1.25) L[i] = env[i];
  // Grano = detalle local respecto a la media cercana (elimina parches y luz horneada)
  const local = maskedBlur(L, mask, info.width, 3);
  const out = Buffer.alloc(N);
  const TARGET = 0.93; // base clara: blanco × base ≈ blanco roto, no gris
  const AMP = 0.45; // cuánto grano se conserva
  for (let i = 0; i < N; i++) {
    const d = mask[i] && local[i] > 0.01 ? L[i] / local[i] - 1 : 0;
    const g = Math.max(-0.06, Math.min(0.06, d * AMP));
    out[i] = Math.round(255 * Math.min(1, TARGET * (1 + g)));
  }
  const img = await sharp(out, { raw: { width: info.width, height: info.height, channels: 1 } }).resize(TEX, TEX).toColourspace('srgb').png().toBuffer();
  bc.setImage(img).setMimeType('image/png').setName('felpa-base-neutra');
}
{
  const { data, info } = await sharp(Buffer.from(nt.getImage())).resize(2048, 2048).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const N = info.width * info.height;
  const X = new Float32Array(N);
  const Y = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    X[i] = data[i * 3] / 127.5 - 1;
    Y[i] = data[i * 3 + 1] / 127.5 - 1;
  }
  const bx = maskedBlur(X, mask, info.width, 2.5);
  const by = maskedBlur(Y, mask, info.width, 2.5);
  const STRENGTH = 0.55;
  const out = Buffer.alloc(N * 3);
  for (let i = 0; i < N; i++) {
    let x = mask[i] ? bx[i] * STRENGTH : 0;
    let y = mask[i] ? by[i] * STRENGTH : 0;
    const l = Math.hypot(x, y);
    if (l > 0.6) (x *= 0.6 / l), (y *= 0.6 / l);
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    out[i * 3] = Math.round((x * 0.5 + 0.5) * 255);
    out[i * 3 + 1] = Math.round((y * 0.5 + 0.5) * 255);
    out[i * 3 + 2] = Math.round((z * 0.5 + 0.5) * 255);
  }
  const img = await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } }).resize(TEX, TEX).png().toBuffer();
  nt.setImage(img).setMimeType('image/png').setName('felpa-normal');
}

// ---------- 5. Marcas para las tallas (metros, origen en el HPS)
const scene = root.getDefaultScene() ?? root.listScenes()[0];
scene.setExtras({
  ...scene.getExtras(),
  tallaBase: tallaBase,
  br: {
    version: 1,
    tallaBase,
    bajoY: +hem.toFixed(4),
    canaleArribaY: +ribTop.toFixed(4),
    hombroY: +shoulderY.toFixed(4),
    punoY: +cuffY.toFixed(4),
    sisaY: +sisa.toFixed(4),
    pechoY: +chestY.toFixed(4),
    cuerpoMedioAncho: +bodyHalf.toFixed(4),
    bajoModeloCm: +hemWidth.toFixed(1)
  }
});

await io.write(output, doc);
const r2 = (n) => (n * 100).toFixed(1);
console.log(`Escala ×${s.toFixed(4)} (HPS→bajo = ${base.largo} cm, talla ${tallaBase})${flip ? ' · normales y caras invertidas hacia fuera' : ''}`);
console.log(`Marcas: bajo ${r2(hem)} cm, canalé desde ${r2(ribTop)} cm, sisa ${r2(sisa)} cm, costura del hombro ${r2(shoulderY)} cm, puño ${r2(cuffY)} cm`);
console.log(`Pecho en plano (2,5 cm bajo la sisa, ${r2(chestY)} cm): ${chestRaw.toFixed(1)} cm en el modelo → ${chest.toFixed(1)} cm tras calibrar ×${kxz.toFixed(3)} en ancho y fondo (tabla ${base.pecho} cm)`);
console.log(`Bajo de canalé: ${hemRaw.toFixed(1)} cm en el modelo → ${hemWidth.toFixed(1)} cm (tabla, bajo relajado: ${base.bajo} cm)`);
console.log(`Vértices de manga: ${sleeveW.filter((w) => w > 0.5).length} de ${Q.length} · de canalé: ${ribW.filter((w) => w > 0.5).length}`);
console.log(`Texturas: base ${(before.base / 1024).toFixed(0)} KB → neutra ${(bc.getImage().byteLength / 1024).toFixed(0)} KB · normal ${(before.normal / 1024).toFixed(0)} KB → ${(nt.getImage().byteLength / 1024).toFixed(0)} KB · mapa metal/rugosidad eliminado`);
console.log(`Escrito ${output} (${(fs.statSync(output).size / 1024 / 1024).toFixed(2)} MB). Ahora: npm run glb:optimizar -- ${output} <salida-web.glb>`);

// ---------- utilidades
/** Desenfoque gaussiano separable que solo mezcla píxeles dentro de las islas UV. */
function maskedBlur(src, m, S, sigma) {
  const r = Math.ceil(sigma * 2.5);
  const k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)));
  const a = new Float32Array(S * S);
  const w = new Float32Array(S * S);
  const a2 = new Float32Array(S * S);
  const w2 = new Float32Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let s1 = 0;
      let s2 = 0;
      for (let j = -r; j <= r; j++) {
        const xx = x + j;
        if (xx < 0 || xx >= S) continue;
        const i = y * S + xx;
        if (!m[i]) continue;
        s1 += src[i] * k[j + r];
        s2 += k[j + r];
      }
      a[y * S + x] = s1;
      w[y * S + x] = s2;
    }
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let s1 = 0;
      let s2 = 0;
      for (let j = -r; j <= r; j++) {
        const yy = y + j;
        if (yy < 0 || yy >= S) continue;
        s1 += a[yy * S + x] * k[j + r];
        s2 += w[yy * S + x] * k[j + r];
      }
      a2[y * S + x] = s2 ? s1 / s2 : src[y * S + x];
      w2[y * S + x] = s2;
    }
  return a2;
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Corte horizontal de la malla a la altura y: contornos cerrados (puntos x,z) por conectividad. */
function sliceLoops(V, tris, y, W8 = welded) {
  const parent = new Map();
  const find = (k) => {
    while (parent.get(k) !== k) {
      parent.set(k, parent.get(parent.get(k)));
      k = parent.get(k);
    }
    return k;
  };
  const pt = new Map();
  const segs = [];
  for (const t of tris) {
    const keys = [];
    for (let a = 0; a < 3; a++) {
      const i = t[a];
      const j = t[(a + 1) % 3];
      const A = V[i];
      const B = V[j];
      if ((A[1] - y) * (B[1] - y) >= 0) continue;
      const wi = W8[i];
      const wj = W8[j];
      const k = wi < wj ? `${wi}_${wj}` : `${wj}_${wi}`;
      if (!pt.has(k)) {
        const u = (y - A[1]) / (B[1] - A[1]);
        pt.set(k, [A[0] + u * (B[0] - A[0]), y, A[2] + u * (B[2] - A[2])]);
        parent.set(k, k);
      }
      keys.push(k);
    }
    if (keys.length === 2) segs.push(keys);
  }
  for (const [a, b] of segs) parent.set(find(a), find(b));
  const groups = new Map();
  for (const k of pt.keys()) {
    const r = find(k);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(pt.get(k));
  }
  return [...groups.values()];
}

/** ¿El contorno rodea el punto (x,z)? Comprueba que hay puntos del contorno en los cuatro cuadrantes. */
function encloses(loop, x, z) {
  const q = [0, 0, 0, 0];
  for (const p of loop) q[(p[0] > x ? 1 : 0) + (p[2] > z ? 2 : 0)]++;
  return q.every((n) => n > 2);
}

function halfHull(pts3) {
  const pts = pts3.map((p) => [p[0], p[2]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return 0;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const p of pts) {
    while (lo.length >= 2 && cross(lo.at(-2), lo.at(-1), p) <= 0) lo.pop();
    lo.push(p);
  }
  const up = [];
  for (const p of [...pts].reverse()) {
    while (up.length >= 2 && cross(up.at(-2), up.at(-1), p) <= 0) up.pop();
    up.push(p);
  }
  const h = [...lo.slice(0, -1), ...up.slice(0, -1)];
  let per = 0;
  for (let i = 0; i < h.length; i++) per += Math.hypot(h[(i + 1) % h.length][0] - h[i][0], h[(i + 1) % h.length][1] - h[i][1]);
  return (per / 2) * 100;
}
