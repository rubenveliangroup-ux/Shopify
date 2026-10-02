// npm run test:3d — comprueba que 1 px del editor = CM_PER_PX cm sobre la sudadera real
// (assets/br-sudadera.glb) en todas las tallas, delante y detrás, con un diseño de tamaño conocido.
import fs from 'node:fs';
import * as THREE from 'three';
import { CM_PER_PX, CM_PER_UNIT, EDITOR_SIZE, PANEL } from '@/components/studio/config';
import { applySize, projectDesigns, type SizeRow } from '@/components/studio/garment-glb';
import { NECK_Y, PANEL_Y, UNITS_PER_METER } from '@/components/studio/garment-material';
// @ts-expect-error módulo JS de las herramientas
import { createIO } from './glb-io.mjs';
// @ts-expect-error módulo JS de las herramientas
import { readMedidas } from './glb-utils.mjs';

const GLB = process.argv[2] ?? 'shopify-theme/assets/br-sudadera.glb';
const DESIGN_CM = 20; // cuadrado de 20 × 20 cm
const medidas = readMedidas() as Record<string, Omit<SizeRow, 'talla'>>;

const io = await createIO();
const doc = await io.read(GLB);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const marks = doc.getRoot().listScenes()[0].getExtras().br;
const g = new THREE.BufferGeometry();
g.setAttribute('position', new THREE.BufferAttribute(prim.getAttribute('POSITION').getArray().slice(), 3));
g.setAttribute('_br_zona', new THREE.BufferAttribute(prim.getAttribute('_BR_ZONA').getArray().slice(), 2));
g.setIndex(new THREE.BufferAttribute(prim.getIndices().getArray().slice(), 1));
const mesh = new THREE.Mesh(g);
const group = new THREE.Group();
group.position.set(0, NECK_Y, 0);
group.scale.setScalar(UNITS_PER_METER);
group.add(mesh);
const model = { mesh, basePos: Float32Array.from(g.attributes.position.array as Float32Array), zones: g.attributes._br_zona as THREE.BufferAttribute, marks };
const base = { talla: marks.tallaBase, ...medidas[marks.tallaBase] };

// El diseño: cuadrado centrado en el lienzo a la altura del pecho (20 cm bajo el hombro)
const sidePx = DESIGN_CM / CM_PER_PX;
const centerYScene = NECK_Y - (20 / 100) * UNITS_PER_METER;
const cv = 0.5 + (centerYScene - PANEL_Y) / PANEL.size; // v del centro (v crece hacia arriba)
const half = sidePx / EDITOR_SIZE / 2;

let fails = 0;
console.log(`Diseño de ${DESIGN_CM} × ${DESIGN_CM} cm (${sidePx.toFixed(1)} px en el editor, ${CM_PER_PX.toFixed(4)} cm/px)\n`);
for (const [talla, row] of Object.entries(medidas)) {
  applySize(model, base, { talla, ...row });
  group.updateMatrixWorld(true);
  for (const [side, geo] of Object.entries(projectDesigns(mesh))) {
    // Posición exacta (en la tela) de un punto del lienzo: se busca el triángulo del decal que lo
    // contiene en UV y se interpola. El decal solo cubre tela que mira al lado proyectado.
    const at = (u: number, v: number) => uvToWorld(geo, u, v);
    const L = at(0.5 - half, cv);
    const R = at(0.5 + half, cv);
    const T = at(0.5, cv + half);
    const B = at(0.5, cv - half);
    if (!L || !R || !T || !B) {
      fails++;
      console.log(`${talla} ${side}: el diseño cae fuera de la tela`);
      continue;
    }
    const dir = side === 'delante' ? 1 : -1;
    const w = (R.x - L.x) * dir * CM_PER_UNIT; // bastidor visto de frente
    const h = (T.y - B.y) * CM_PER_UNIT;
    let arc = 0;
    let prev = L;
    for (let k = 1; k <= 40; k++) {
      const q = at(0.5 - half + (2 * half * k) / 40, cv);
      if (q) (arc += q.distanceTo(prev)), (prev = q);
    }
    arc *= CM_PER_UNIT;
    const err = Math.max(Math.abs(w - DESIGN_CM), Math.abs(h - DESIGN_CM));
    const ok = err < 0.05; // < 0,5 mm
    if (!ok) fails++;
    console.log(`${talla.padEnd(3)} ${side.padEnd(7)} de frente ${w.toFixed(2)} × ${h.toFixed(2)} cm · siguiendo la tela ${arc.toFixed(2)} cm de ancho  ${ok ? 'OK' : 'FALLA'}`);
  }
}
console.log(fails ? `\n${fails} fallos` : '\npx→cm correcto en todas las tallas (diferencia de frente < 0,5 mm)');
process.exit(fails ? 1 : 0);

function uvToWorld(geo: THREE.BufferGeometry, u: number, v: number): THREE.Vector3 | null {
  const p = geo.attributes.position;
  const t = geo.attributes.uv;
  let best: THREE.Vector3 | null = null;
  for (let i = 0; i < p.count; i += 3) {
    const [u0, v0, u1, v1, u2, v2] = [t.getX(i), t.getY(i), t.getX(i + 1), t.getY(i + 1), t.getX(i + 2), t.getY(i + 2)];
    const d = (v1 - v2) * (u0 - u2) + (u2 - u1) * (v0 - v2);
    if (Math.abs(d) < 1e-12) continue;
    const a = ((v1 - v2) * (u - u2) + (u2 - u1) * (v - v2)) / d;
    const b = ((v2 - v0) * (u - u2) + (u0 - u2) * (v - v2)) / d;
    const c = 1 - a - b;
    if (a < -1e-6 || b < -1e-6 || c < -1e-6) continue;
    const q = new THREE.Vector3(
      a * p.getX(i) + b * p.getX(i + 1) + c * p.getX(i + 2),
      a * p.getY(i) + b * p.getY(i + 1) + c * p.getY(i + 2),
      a * p.getZ(i) + b * p.getZ(i + 1) + c * p.getZ(i + 2)
    );
    // Si hay varias capas (bolsillo sobre el cuerpo), la de fuera
    if (!best || Math.abs(q.z) > Math.abs(best.z)) best = q;
  }
  return best;
}
