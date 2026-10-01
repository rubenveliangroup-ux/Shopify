// npm run test:3d — prueba: 1 px del editor = CM_PER_PX cm sobre la prenda GLB, en todas las tallas y en ambos lados.
import * as THREE from 'three';
import { CM_PER_PX, CM_PER_UNIT, EDITOR_SIZE } from '@/components/studio/config';
import { NECK_Y, PANEL_Y, projectDesigns } from '@/components/studio/garment-glb';
const M = { largo: 64, pecho: 65 };
const tallas = { XS: [58, 61], S: [61, 63], M: [64, 65], L: [67, 67], XL: [70, 70], XXL: [73, 73] } as const;
// Cuerpo elíptico de talla M en metros → unidades de escena, como prepareModel
const g = new THREE.CylinderGeometry(1, 1, 0.64, 160, 80, true);
g.scale(0.28, 1, 0.12);
let fails = 0;
for (const [t, [largo, pecho]] of Object.entries(tallas)) {
  const anchor = new THREE.Group();
  anchor.position.set(0, NECK_Y, 0);
  const sizeG = new THREE.Group();
  sizeG.scale.set(pecho / M.pecho, largo / M.largo, pecho / M.pecho);
  const root = new THREE.Group();
  root.scale.setScalar(100 / CM_PER_UNIT);
  root.position.set(0, -0.32 * (100 / CM_PER_UNIT), 0);
  const body = new THREE.Mesh(g);
  anchor.add(sizeG); sizeG.add(root); root.add(body);
  anchor.updateWorldMatrix(true, true);
  for (const [side, geo] of Object.entries(projectDesigns(body))) {
    const p = geo.attributes.position, uv = geo.attributes.uv;
    // Regresión lineal x(u) e y(v): pendiente en cm por ancho de lienzo → cm por px
    const fit = (a: number[], b: number[]) => { const n = a.length, ma = a.reduce((s, x) => s + x) / n, mb = b.reduce((s, x) => s + x) / n; let num = 0, den = 0; for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); den += (a[i] - ma) ** 2; } return { slope: num / den, at: (x: number) => mb + (num / den) * (x - ma) }; };
    const us = [], vs = [], xs = [], ys = [];
    for (let i = 0; i < p.count; i++) { us.push(uv.getX(i)); vs.push(uv.getY(i)); xs.push(p.getX(i)); ys.push(p.getY(i)); }
    const fx = fit(us, xs), fy = fit(vs, ys);
    const cmPerPxX = Math.abs(fx.slope) * CM_PER_UNIT / EDITOR_SIZE;
    const cmPerPxY = fy.slope * CM_PER_UNIT / EDITOR_SIZE;
    const centerY = fy.at(0.5);
    const dirOk = side === 'delante' ? fx.slope > 0 : fx.slope < 0; // detrás: visto desde atrás
    const ok = Math.abs(cmPerPxX - CM_PER_PX) < 1e-4 && Math.abs(cmPerPxY - CM_PER_PX) < 1e-4 && Math.abs(centerY - PANEL_Y) < 1e-4 && dirOk;
    if (!ok) fails++;
    console.log(`${t.padEnd(3)} ${side.padEnd(7)} cm/px x ${cmPerPxX.toFixed(5)} y ${cmPerPxY.toFixed(5)} (esperado ${CM_PER_PX.toFixed(5)})  centro y ${centerY.toFixed(4)}  ${ok ? 'OK' : 'FALLA'}`);
  }
}
console.log(fails ? `${fails} fallos` : 'px→cm exacto en todas las tallas');
process.exit(fails ? 1 : 0);
