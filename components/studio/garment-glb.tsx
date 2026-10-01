'use client';

import { useLoader, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CM_PER_UNIT, EDITOR_SIZE, PANEL, type Side } from './config';

/**
 * Sudadera desde un GLB profesional (ver shopify-theme/MODELO-3D.md).
 *
 * Unidades: la escena usa 1 u = CM_PER_UNIT cm, igual que el modelo procedural, así que el lienzo
 * de edición (PANEL.size u = 74,7 cm) cae con su tamaño real sobre la prenda y la conversión
 * px→cm (CM_PER_PX) no cambia. Los bordados se calculan en coordenadas de mundo después de
 * aplicar la talla: un logo de 10 cm mide 10 cm en cualquier talla.
 */

export type SizeRow = { talla: string; largo: number; pecho: number; bajo: number; manga: number };
export type ModelInfo = { sizesByMorph: boolean; baseSize: string };

/** Altura del cuello (punto alto del hombro) y centro del lienzo, en unidades de escena. */
export const NECK_Y = 0.79;
export const PANEL_Y = PANEL.centerY + 0.05;
const UNITS_PER_METER = 100 / CM_PER_UNIT;
/** Decodificadores que solo se descargan si el GLB los usa (Meshopt va incluido en el JS). */
const DRACO_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
const BASIS_PATH = `https://cdn.jsdelivr.net/npm/three@0.${THREE.REVISION}.0/examples/jsm/libs/basis/`;
/** Mallas que no se tiñen (herretes, etiquetas). */
const NO_TINT = /herrete|aglet|etiqueta|label|no_?tint|sin_?tinte/i;
const LAYER_SILHOUETTE = 1;
const TO_SRGB = Uint8Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
});

type Props = {
  url: string;
  color: string;
  front: THREE.Texture;
  back: THREE.Texture;
  frontNormal: THREE.Texture;
  backNormal: THREE.Texture;
  size?: string;
  sizes?: SizeRow[];
  onReady?: (info: ModelInfo) => void;
  onSilhouettes?: (s: Record<Side, string> | null) => void;
};

export function GarmentGLB({ url, color, front, back, frontNormal, backNormal, size, sizes, onReady, onSilhouettes }: Props) {
  const gl = useThree((s) => s.gl);
  const scene3 = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    const l = loader as GLTFLoader;
    l.setMeshoptDecoder(MeshoptDecoder);
    l.setDRACOLoader(new DRACOLoader().setDecoderPath(DRACO_PATH));
    l.setKTX2Loader(new KTX2Loader().setTranscoderPath(BASIS_PATH).detectSupport(gl));
  }) as GLTF;

  const model = useMemo(() => prepareModel(gltf), [gltf]);
  const base = sizes?.find((r) => r.talla === model.baseSize);
  const target = sizes?.find((r) => r.talla === size) ?? base;

  // Iluminación de estudio (HDRI generado en el navegador: no descarga nada)
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const prev = scene3.environment;
    scene3.environment = env;
    return () => {
      scene3.environment = prev;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene3]);

  // Teñido por multiplicación: color × mapa base neutro del modelo (conserva sombras y pliegues)
  useEffect(() => {
    for (const m of model.tintable) m.color.set(color);
    invalidate();
  }, [color, model, invalidate]);

  // Talla: morph targets con el nombre de la talla o, si no hay, escala desde la talla base
  const scale = useMemo<[number, number, number]>(() => {
    if (model.morphMeshes.length || !base || !target) return [1, 1, 1];
    const sx = target.pecho / base.pecho;
    return [sx, target.largo / base.largo, sx];
  }, [model, base, target]);
  useEffect(() => {
    const key = size ?? model.baseSize;
    for (const mesh of model.morphMeshes) {
      const dict = mesh.morphTargetDictionary!;
      const infl = mesh.morphTargetInfluences!;
      for (const [name, i] of Object.entries(dict)) infl[i] = name.toUpperCase() === key.toUpperCase() ? 1 : 0;
    }
  }, [size, model]);

  // Bordados proyectados en coordenadas de mundo (no heredan la escala de talla)
  const anchor = useRef<THREE.Group>(null);
  const decals = useMemo(() => ({ delante: new THREE.Mesh(), detras: new THREE.Mesh() }), []);
  const decalMats = useMemo(
    () => ({
      delante: embroideryMaterial(front, frontNormal),
      detras: embroideryMaterial(back, backNormal)
    }),
    [front, back, frontNormal, backNormal]
  );
  useEffect(() => {
    decals.delante.material = decalMats.delante;
    decals.detras.material = decalMats.detras;
  }, [decals, decalMats]);

  useEffect(() => {
    if (!anchor.current) return;
    anchor.current.updateWorldMatrix(true, true);
    const target = bakedMesh(model.body);
    const geo = projectDesigns(target);
    for (const s of ['delante', 'detras'] as const) {
      decals[s].geometry.dispose();
      decals[s].geometry = geo[s];
    }
    if (target !== model.body) target.geometry.dispose();
    invalidate();
  }, [model, scale, size, decals, invalidate]);

  useEffect(() => {
    onReady?.({ sizesByMorph: model.morphMeshes.length > 0, baseSize: model.baseSize });
  }, [model, onReady]);

  // Silueta real de la prenda para el lienzo de edición (misma proyección que los bordados)
  useEffect(() => {
    if (!onSilhouettes) return;
    const t = setTimeout(() => onSilhouettes(renderSilhouettes(gl, scene3)), 120);
    return () => clearTimeout(t);
  }, [gl, scene3, color, scale, size, model, onSilhouettes]);
  useEffect(() => () => onSilhouettes?.(null), [onSilhouettes]);

  return (
    <>
      <group position={[0, NECK_Y, 0]}>
        <group ref={anchor} scale={scale}>
          <primitive object={model.root} />
        </group>
      </group>
      <primitive object={decals.delante} />
      <primitive object={decals.detras} />
    </>
  );
}

/**
 * Proyecta los lienzos delante/detrás sobre el cuerpo (con su matriz de mundo ya actualizada).
 * Cada lienzo es un cuadrado de PANEL.size u centrado en (0, PANEL_Y): 1 px del editor mide
 * siempre CM_PER_PX cm sobre la prenda, sea cual sea la talla.
 */
export function projectDesigns(target: THREE.Mesh): Record<Side, THREE.BufferGeometry> {
  const box = new THREE.Box3().setFromObject(target);
  const margin = 0.1;
  const zMid = (box.min.z + box.max.z) / 2;
  const w = PANEL.size;
  const frontDepth = box.max.z + margin - zMid;
  const backDepth = zMid - (box.min.z - margin);
  const geo = {
    delante: new DecalGeometry(target, new THREE.Vector3(0, PANEL_Y, zMid + frontDepth / 2), new THREE.Euler(0, 0, 0), new THREE.Vector3(w, w, frontDepth)),
    detras: new DecalGeometry(target, new THREE.Vector3(0, PANEL_Y, zMid - backDepth / 2), new THREE.Euler(0, Math.PI, 0), new THREE.Vector3(w, w, backDepth))
  };
  lift(geo.delante, 0.002); // ~1 mm hacia fuera: la prenda no tapa el bordado
  lift(geo.detras, -0.002);
  return geo;
}

/** Desplaza el bordado hacia el lado desde el que se proyecta (no depende de las normales del GLB). */
function lift(g: THREE.BufferGeometry, dz: number) {
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + dz);
  p.needsUpdate = true;
}

function embroideryMaterial(map: THREE.Texture, normalMap: THREE.Texture) {
  return new THREE.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    transparent: true,
    roughness: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    depthWrite: false
  } as THREE.MeshStandardMaterialParameters);
}

type Prepared = {
  root: THREE.Object3D;
  body: THREE.Mesh;
  tintable: THREE.MeshStandardMaterial[];
  morphMeshes: THREE.Mesh[];
  baseSize: string;
};

/** Valida lo mínimo, pasa a unidades de escena y deja el cuello en el origen. */
function prepareModel(gltf: GLTF): Prepared {
  const root = gltf.scene.clone(true);
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  if (!meshes.length) throw new Error('El GLB no tiene mallas');
  if (meshes.some((m) => !m.geometry.attributes.uv)) throw new Error('El GLB no tiene UVs: no se puede proyectar el bordado ni el tejido');
  for (const m of meshes) if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();

  root.scale.setScalar(UNITS_PER_METER);
  root.updateWorldMatrix(true, true);
  const all = new THREE.Box3().setFromObject(root);
  const heightCm = ((all.max.y - all.min.y) * CM_PER_UNIT);
  if (heightCm < 40 || heightCm > 160) throw new Error(`Escala u orientación incorrecta: el modelo mide ${heightCm.toFixed(0)} cm de alto (¿no está en metros o en Y-arriba?)`);

  const body =
    meshes.find((m) => /^(body|cuerpo|torso)/i.test(m.name)) ??
    meshes.reduce((a, b) => (volume(a) >= volume(b) ? a : b));
  const bodyBox = new THREE.Box3().setFromObject(body);
  // Ancla opcional en el GLB ("ancla_cuello"); si no, lo alto del cuerpo en el centro
  let neck = new THREE.Vector3((bodyBox.min.x + bodyBox.max.x) / 2, bodyBox.max.y, (bodyBox.min.z + bodyBox.max.z) / 2);
  const anchorNode = root.getObjectByProperty('name', 'ancla_cuello') ?? root.getObjectByProperty('name', 'neck_anchor');
  if (anchorNode) neck = anchorNode.getWorldPosition(new THREE.Vector3()).setZ(neck.z);
  root.position.sub(neck);

  const tintable: THREE.MeshStandardMaterial[] = [];
  const morphMeshes: THREE.Mesh[] = [];
  for (const m of meshes) {
    m.castShadow = true;
    m.layers.enable(LAYER_SILHOUETTE);
    const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((mat) => {
      const c = (mat as THREE.MeshStandardMaterial).clone();
      c.side = THREE.DoubleSide; // maniquí invisible: se ve el interior por el cuello y los bajos
      c.envMapIntensity = 1;
      if (!NO_TINT.test(m.name) && !NO_TINT.test(mat.name)) tintable.push(c);
      return c;
    });
    m.material = Array.isArray(m.material) ? mats : mats[0];
    if (m.morphTargetDictionary && Object.keys(m.morphTargetDictionary).length) morphMeshes.push(m);
  }
  const extras = (gltf.scene.userData ?? {}) as { tallaBase?: string };
  return { root, body, tintable, morphMeshes, baseSize: (extras.tallaBase ?? 'M').toUpperCase() };
}

function volume(m: THREE.Mesh) {
  const s = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
  return s.x * s.y * s.z;
}

/** DecalGeometry ignora los morph targets: se proyecta sobre una copia con la talla aplicada. */
function bakedMesh(mesh: THREE.Mesh): THREE.Mesh {
  const infl = mesh.morphTargetInfluences;
  const morphs = mesh.geometry.morphAttributes.position;
  if (!infl || !morphs || !infl.some((v) => v > 0)) return mesh;
  const g = mesh.geometry.clone();
  const pos = g.attributes.position as THREE.BufferAttribute;
  const relative = g.morphTargetsRelative;
  for (let t = 0; t < morphs.length; t++) {
    const w = infl[t];
    if (!w) continue;
    const d = morphs[t];
    for (let i = 0; i < pos.count; i++) {
      for (let k = 0; k < 3; k++) {
        const base = pos.getComponent(i, k);
        const v = d.getComponent(i, k);
        pos.setComponent(i, k, relative ? base + w * v : base + w * (v - base));
      }
    }
  }
  g.computeVertexNormals();
  const out = new THREE.Mesh(g);
  out.matrixWorld.copy(mesh.matrixWorld);
  return out;
}

/** Vista ortográfica delante/detrás exactamente del tamaño del lienzo (PANEL), con fondo transparente. */
function renderSilhouettes(gl: THREE.WebGLRenderer, scene: THREE.Scene): Record<Side, string> {
  const h = PANEL.size / 2;
  const cam = new THREE.OrthographicCamera(-h, h, h, -h, 0.01, 20);
  cam.layers.set(LAYER_SILHOUETTE);
  const S = EDITOR_SIZE;
  const rt = new THREE.WebGLRenderTarget(S, S, { samples: 4 });
  const px = new Uint8Array(S * S * 4);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const bg = scene.background;
  const clear = gl.getClearColor(new THREE.Color());
  const clearAlpha = gl.getClearAlpha();
  const prevTarget = gl.getRenderTarget();
  scene.background = null;
  gl.setClearColor(0x000000, 0);
  const out = {} as Record<Side, string>;
  for (const side of ['delante', 'detras'] as const) {
    const z = side === 'delante' ? 10 : -10;
    cam.position.set(0, PANEL_Y, z);
    cam.lookAt(0, PANEL_Y, 0);
    gl.setRenderTarget(rt);
    gl.clear();
    gl.render(scene, cam);
    gl.readRenderTargetPixels(rt, 0, 0, S, S, px);
    // El render target queda en lineal: se pasa a sRGB y se da la vuelta (WebGL lee de abajo arriba)
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      const src = (S - 1 - y) * S * 4;
      const dst = y * S * 4;
      for (let i = 0; i < S * 4; i += 4) {
        img.data[dst + i] = TO_SRGB[px[src + i]];
        img.data[dst + i + 1] = TO_SRGB[px[src + i + 1]];
        img.data[dst + i + 2] = TO_SRGB[px[src + i + 2]];
        img.data[dst + i + 3] = px[src + i + 3];
      }
    }
    ctx.putImageData(img, 0, 0);
    out[side] = canvas.toDataURL('image/png');
  }
  gl.setRenderTarget(prevTarget);
  scene.background = bg;
  gl.setClearColor(clear, clearAlpha);
  rt.dispose();
  return out;
}
