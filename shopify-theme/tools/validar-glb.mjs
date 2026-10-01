// Revisa si un GLB sirve para el estudio de diseño (requisitos en shopify-theme/MODELO-3D.md).
//   node shopify-theme/tools/validar-glb.mjs sudadera.glb [--talla-base M]
// Sale con código 1 si algo obligatorio falla.
import fs from 'node:fs';
import { getBounds } from '@gltf-transform/core';
import sharp from 'sharp';
import { createIO, kb, mb } from './glb-io.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Uso: node shopify-theme/tools/validar-glb.mjs archivo.glb [--talla-base M]');
  process.exit(2);
}
const tallaBase = (process.argv.includes('--talla-base') ? process.argv[process.argv.indexOf('--talla-base') + 1] : 'M').toUpperCase();

// Medidas por talla: la misma fuente que la tienda (snippets/br-medidas.liquid)
const liquid = fs.readFileSync(new URL('../snippets/br-medidas.liquid', import.meta.url), 'utf8');
const medidas = Object.fromEntries(
  /medidas\s*=\s*'([^']+)'/.exec(liquid)[1].split(';').map((r) => {
    const [t, largo, pecho, bajo, manga] = r.split(',');
    return [t.trim(), { largo: +largo, pecho: +pecho, bajo: +bajo, manga: +manga }];
  })
);
const base = medidas[tallaBase];

const results = [];
const ok = (msg) => results.push(['OK', msg]);
const warn = (msg) => results.push(['AVISO', msg]);
const fail = (msg) => results.push(['FALLA', msg]);

const io = await createIO();
const bytes = fs.statSync(file).size;
const doc = await io.read(file);
const root = doc.getRoot();
const scene = root.getDefaultScene() ?? root.listScenes()[0];

// --- Peso
bytes <= 5 * 1024 * 1024 ? ok(`Peso ${mb(bytes)} (objetivo < 5 MB)`) : warn(`Peso ${mb(bytes)}: optimízalo con optimizar-glb.mjs (objetivo < 5 MB)`);

// --- Mallas y atributos
const nodes = [];
scene.traverse((n) => n.getMesh() && nodes.push(n));
if (!nodes.length) fail('No hay mallas');
let tris = 0;
const sinUV = [];
const sinNormal = [];
for (const n of nodes) {
  for (const p of n.getMesh().listPrimitives()) {
    const count = p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount();
    tris += count / 3;
    if (!p.getAttribute('TEXCOORD_0')) sinUV.push(n.getName());
    if (!p.getAttribute('NORMAL')) sinNormal.push(n.getName());
  }
}
const names = nodes.map((n) => n.getName() || '(sin nombre)');
ok(`${nodes.length} mallas, ${Math.round(tris).toLocaleString('es-ES')} triángulos: ${names.join(', ')}`);
if (tris < 5000) fail(`Muy pocos triángulos (${Math.round(tris)}): no puede tener caída ni pliegues; parece un modelo de cajas`);
else if (tris > 200000) warn(`Muchos triángulos (${Math.round(tris)}): en móvil irá lento; objetivo 30.000–120.000`);
sinUV.length ? fail(`Sin UVs: ${[...new Set(sinUV)].join(', ')}`) : ok('Todas las mallas tienen UVs');
sinNormal.length ? warn(`Sin normales (se calcularán, peor sombreado): ${[...new Set(sinNormal)].join(', ')}`) : ok('Todas las mallas tienen normales');

const body = nodes.find((n) => /^(body|cuerpo|torso)/i.test(n.getName()));
body ? ok(`Cuerpo identificado: "${body.getName()}"`) : warn('No hay malla llamada "Cuerpo"/"Body": se usará la más grande para los bordados');
const bodyNode =
  body ??
  nodes.reduce((a, b) => {
    const v = (n) => {
      const { min, max } = getBounds(n);
      return (max[0] - min[0]) * (max[1] - min[1]) * (max[2] - min[2]);
    };
    return v(a) >= v(b) ? a : b;
  });

// --- Escala y orientación (glTF: metros, Y arriba, delante hacia +Z)
const sb = getBounds(scene);
const dim = [0, 1, 2].map((i) => sb.max[i] - sb.min[i]);
const cm = (m) => (m * 100).toFixed(1);
ok(`Caja total: ${cm(dim[0])} × ${cm(dim[1])} × ${cm(dim[2])} cm (ancho × alto × fondo)`);
if (dim[1] < 0.4 || dim[1] > 1.3) fail(`Alto de ${cm(dim[1])} cm: no está en metros o no tiene Y hacia arriba`);
if (dim[2] > dim[1]) fail('Es más profundo que alto: parece Z hacia arriba (glTF usa Y)');

const bb = getBounds(bodyNode);
const largo = (bb.max[1] - bb.min[1]) * 100;
const worldVerts = worldPositions(bodyNode);
const chestY = bb.max[1] - (bb.max[1] - bb.min[1]) * 0.33;
const halfHull = halfHullPerimeterAt(worldVerts, chestY, 0.015) * 100;
const tol = (a, b) => Math.abs(a - b) / b;
if (base) {
  const line = `largo ${largo.toFixed(1)} cm (talla ${tallaBase}: ${base.largo}), pecho plano ≈ ${halfHull.toFixed(1)} cm (talla ${tallaBase}: ${base.pecho})`;
  tol(largo, base.largo) <= 0.08 && tol(halfHull, base.pecho) <= 0.1 ? ok(`Medidas: ${line}`) : fail(`Medidas fuera de tolerancia (8 % largo, 10 % pecho): ${line}`);
}

// Normales hacia fuera (si apuntan hacia dentro, la luz y el relieve salen al revés)
{
  const nrm = [];
  const w = bodyNode.getWorldMatrix();
  for (const p of bodyNode.getMesh().listPrimitives()) {
    const a = p.getAttribute('NORMAL');
    if (!a) continue;
    const v = [0, 0, 0];
    for (let i = 0; i < a.getCount(); i++) {
      a.getElement(i, v);
      nrm.push([w[0] * v[0] + w[4] * v[1] + w[8] * v[2], w[1] * v[0] + w[5] * v[1] + w[9] * v[2], w[2] * v[0] + w[6] * v[1] + w[10] * v[2]]);
    }
  }
  if (nrm.length === worldVerts.length) {
    const c = [(bb.min[0] + bb.max[0]) / 2, 0, (bb.min[2] + bb.max[2]) / 2];
    let out = 0;
    worldVerts.forEach((v, i) => (out += (v[0] - c[0]) * nrm[i][0] + (v[2] - c[2]) * nrm[i][2] > 0 ? 1 : 0));
    const r = out / nrm.length;
    r >= 0.6 ? ok(`Normales del cuerpo hacia fuera (${(r * 100).toFixed(0)} %)`) : fail(`Normales del cuerpo hacia dentro (${(r * 100).toFixed(0)} % hacia fuera): dales la vuelta en el programa 3D`);
  }
}

// Delante = +Z: el bolsillo canguro queda delante y la capucha detrás
const center = (n) => {
  const { min, max } = getBounds(n);
  return (min[2] + max[2]) / 2;
};
const bz = (bb.min[2] + bb.max[2]) / 2;
const pocket = nodes.find((n) => /pocket|bolsillo/i.test(n.getName()));
const hood = nodes.find((n) => /hood|capucha/i.test(n.getName()));
if (pocket) center(pocket) > bz ? ok('Orientación: el bolsillo está delante (+Z)') : fail('Orientación: el bolsillo está detrás; el delantero debe mirar a +Z');
else if (hood) center(hood) < bz ? ok('Orientación: la capucha cae detrás (−Z)') : fail('Orientación: la capucha está delante; el delantero debe mirar a +Z');
else warn('No se puede comprobar hacia dónde mira (nombra "Bolsillo" y "Capucha")');

// --- UVs: solapes y fuera de 0–1 (por material, sin cordones ni herretes)
const groups = new Map();
for (const n of nodes) {
  if (/cord|herrete|aglet/i.test(n.getName())) continue;
  for (const p of n.getMesh().listPrimitives()) {
    const uv = p.getAttribute('TEXCOORD_0');
    if (!uv) continue;
    const key = p.getMaterial()?.getName() || 'material';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
}
for (const [mat, prims] of groups) {
  const r = uvOverlap(prims, 1024);
  const msg = `UVs "${mat}": ${(r.used * 100).toFixed(0)} % de la textura usada, solape ${(r.overlap * 100).toFixed(2)} %, fuera de 0–1 ${(r.outside * 100).toFixed(1)} %`;
  r.overlap > 0.01 || r.outside > 0.01 ? fail(msg) : ok(msg);
}

// --- Materiales y texturas (tejido PBR, mapa base claro y neutro para teñir por multiplicación)
for (const m of root.listMaterials()) {
  const bc = m.getBaseColorTexture();
  const nt = m.getNormalTexture();
  const mr = m.getMetallicRoughnessTexture();
  const f = m.getBaseColorFactor();
  const parts = [`"${m.getName() || 'material'}"`, bc ? 'color ✓' : 'color ✗', nt ? 'normal ✓' : 'normal ✗', mr ? 'rugosidad ✓' : 'rugosidad (valor fijo)', `metal ${m.getMetallicFactor()}`];
  nt ? ok(`Material ${parts.join(', ')}`) : warn(`Material ${parts.join(', ')}: sin normal map no se ve la felpa`);
  if (m.getMetallicFactor() > 0.05) warn(`Material "${m.getName()}": el algodón no es metálico (metallicFactor 0)`);
  if (bc) {
    const img = bc.getImage();
    const { data, info } = await sharp(Buffer.from(img)).resize(64, 64, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let l = 0;
    let sat = 0;
    for (let i = 0; i < data.length; i += 3) {
      const [r, g, b] = [data[i] * f[0], data[i + 1] * f[1], data[i + 2] * f[2]];
      l += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      sat += (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    }
    const n = data.length / 3;
    l /= n;
    sat /= n;
    const desc = `luminancia media ${(l * 100).toFixed(0)} %, saturación ${(sat * 100).toFixed(0)} %`;
    l >= 0.55 && sat <= 0.08
      ? ok(`Color base de "${m.getName()}" claro y neutro (${desc}): se tiñe bien`)
      : fail(`Color base de "${m.getName()}" (${desc}): debe ser blanco/gris claro neutro con las sombras horneadas; si es oscuro o de color, el teñido no da el color elegido`);
  } else {
    const l = 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
    if (l < 0.5) fail(`Material "${m.getName()}" sin textura y color base oscuro: el teñido no funcionará`);
  }
}
for (const t of root.listTextures()) {
  const s = t.getSize();
  const size = t.getImage()?.byteLength ?? 0;
  const msg = `Textura "${t.getName() || t.getURI() || 'sin nombre'}" ${s ? `${s[0]}×${s[1]}` : '(KTX2)'} ${t.getMimeType()} ${kb(size)}`;
  s && Math.max(...s) > 2048 ? warn(`${msg}: máximo 2K (lo reduce optimizar-glb.mjs)`) : ok(msg);
}
if (!root.listTextures().length) fail('Sin texturas: falta el tejido PBR (color, normal, rugosidad)');

// --- Tallas
const morphNames = new Set();
for (const m of root.listMeshes()) for (const n of m.getExtras()?.targetNames ?? []) morphNames.add(String(n).toUpperCase());
const tallas = Object.keys(medidas);
const conMorph = tallas.filter((t) => morphNames.has(t));
conMorph.length
  ? ok(`Tallas por morph targets: ${conMorph.join(', ')}${conMorph.length < tallas.length ? ` (faltan ${tallas.filter((t) => !morphNames.has(t)).join(', ')})` : ''}`)
  : warn(`Sin morph targets por talla: el estudio escalará desde la talla ${tallaBase} (ancho por pecho, alto por largo)`);
const ext = root.listExtensionsUsed().map((e) => e.extensionName);
if (ext.length) ok(`Extensiones: ${ext.join(', ')}`);

// --- Informe
const pad = { OK: '  OK  ', AVISO: ' AVISO', FALLA: ' FALLA' };
console.log(`\nRevisión de ${file}\n`);
for (const [k, m] of results) console.log(`[${pad[k]}] ${m}`);
const fails = results.filter(([k]) => k === 'FALLA').length;
console.log(fails ? `\n✗ ${fails} requisito(s) sin cumplir: no usar en la tienda.\n` : '\n✓ Apto para el estudio.\n');
process.exit(fails ? 1 : 0);

// ---------- utilidades
function worldPositions(node) {
  const m = node.getWorldMatrix();
  const out = [];
  for (const p of node.getMesh().listPrimitives()) {
    const pos = p.getAttribute('POSITION');
    const v = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v);
      out.push([
        m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
        m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
        m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]
      ]);
    }
  }
  return out;
}

/** Medio perímetro de la envolvente convexa del corte horizontal ≈ medida "pecho en plano". */
function halfHullPerimeterAt(verts, y, band) {
  const pts = verts.filter((v) => Math.abs(v[1] - y) < band).map((v) => [v[0], v[2]]);
  if (pts.length < 3) return 0;
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  let per = 0;
  for (let i = 0; i < hull.length; i++) per += Math.hypot(hull[(i + 1) % hull.length][0] - hull[i][0], hull[(i + 1) % hull.length][1] - hull[i][1]);
  return per / 2;
}

/** Rasteriza los triángulos UV: % de píxeles cubiertos más de una vez y % fuera de 0–1. */
function uvOverlap(prims, S) {
  const grid = new Uint8Array(S * S);
  let outside = 0;
  let total = 0;
  for (const p of prims) {
    const uv = p.getAttribute('TEXCOORD_0');
    const idx = p.getIndices();
    const n = idx ? idx.getCount() : uv.getCount();
    const a = [0, 0];
    const tri = [[], [], []];
    for (let i = 0; i < n; i += 3) {
      for (let k = 0; k < 3; k++) {
        uv.getElement(idx ? idx.getScalar(i + k) : i + k, a);
        tri[k] = [a[0] * S, a[1] * S];
        total++;
        if (a[0] < -0.001 || a[0] > 1.001 || a[1] < -0.001 || a[1] > 1.001) outside++;
      }
      raster(tri, grid, S);
    }
  }
  let used = 0;
  let over = 0;
  for (const g of grid) {
    if (g) used++;
    if (g > 1) over++;
  }
  return { used: used / (S * S), overlap: used ? over / used : 0, outside: total ? outside / total : 0 };
}

function raster([p0, p1, p2], grid, S) {
  const area = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
  if (Math.abs(area) < 1e-9) return;
  const minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])));
  const maxX = Math.min(S - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
  const minY = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1])));
  const maxY = Math.min(S - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
  const s = Math.sign(area);
  const edge = (a, b, x, y) => ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) * s;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      // Regla de borde estricta en dos lados: los triángulos vecinos no se cuentan dos veces
      const w0 = edge(p1, p2, cx, cy);
      const w1 = edge(p2, p0, cx, cy);
      const w2 = edge(p0, p1, cx, cy);
      if (w0 >= 0 && w1 >= 0 && w2 >= 0 && (w0 > 0 || w1 > 0) && (w1 > 0 || w2 > 0) && (w0 > 0 || w2 > 0)) {
        const i = y * S + x;
        if (grid[i] < 255) grid[i]++;
      }
    }
  }
}
