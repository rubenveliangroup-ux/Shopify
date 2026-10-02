'use client';

import { useLoader, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EDITOR_SIZE, PANEL, type Side } from './config';
import { applyTint, fabricMaterial, NECK_Y, PANEL_Y, UNITS_PER_METER } from './garment-material';

export { NECK_Y, PANEL_Y } from './garment-material';

/**
 * Sudadera desde el GLB preparado (shopify-theme/MODELO-3D.md, tools/preparar-prenda.mjs).
 *
 * Unidades: la escena usa 1 u = CM_PER_UNIT cm, así que el lienzo de edición (PANEL.size u = 74,7 cm)
 * cae con su tamaño real sobre la prenda y la conversión px→cm (CM_PER_PX) no cambia. Los bordados
 * se proyectan en coordenadas de mundo después de aplicar la talla: 10 cm miden 10 cm en todas.
 */

export type SizeRow = { talla: string; largo: number; pecho: number; bajo: number; manga: number };
export type ModelInfo = { baseSize: string; sizesByZone: boolean };
export type DesignLayers = { map: THREE.Texture; normalMap: THREE.Texture; shadowMap: THREE.Texture };

/** Marcas que escribe preparar-prenda.mjs en extras.br (metros, origen en el punto alto del hombro). */
type Landmarks = { tallaBase: string; bajoY: number; canaleArribaY: number; hombroY: number };

/** Decodificador Draco (solo se descarga si el GLB lo usa; Meshopt va incluido en el JS). */
const DRACO_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
const LAYER_SILHOUETTE = 1;
const TO_SRGB = Uint8Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
});

type Props = {
  url: string;
  color: string;
  design: Record<Side, DesignLayers>;
  size?: string;
  sizes?: SizeRow[];
  onReady?: (info: ModelInfo) => void;
  onSilhouettes?: (s: Record<Side, string> | null) => void;
};

export function GarmentGLB({ url, color, design, size, sizes, onReady, onSilhouettes }: Props) {
  const gl = useThree((s) => s.gl);
  const scene3 = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    const l = loader as GLTFLoader;
    l.setMeshoptDecoder(MeshoptDecoder);
    l.setDRACOLoader(new DRACOLoader().setDecoderPath(DRACO_PATH));
  }) as GLTF;

  const model = useMemo(() => prepareModel(gltf), [gltf]);
  const base = sizes?.find((r) => r.talla === model.baseSize);
  const target = sizes?.find((r) => r.talla === size) ?? base;

  // HDRI de estudio suave (generado en el navegador: no descarga nada)
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const prev = scene3.environment;
    scene3.environment = env;
    invalidate();
    return () => {
      scene3.environment = prev;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene3, invalidate]);

  // Teñido por multiplicación sobre el mapa base neutro (conserva grano, sombras y pliegues)
  useEffect(() => {
    applyTint(model.material, color);
    invalidate();
  }, [color, model, invalidate]);

  // Talla: escalado no uniforme por zonas (largo, pecho, bajo y manga) desde la talla base
  useEffect(() => {
    if (base && target) applySize(model, base, target);
    invalidate();
  }, [model, base, target, invalidate]);

  // Bordados: diseño + relieve + sombra de contacto, proyectados delante y detrás
  const decals = useMemo(() => {
    const make = (layers: DesignLayers) => {
      const shadow = new THREE.Mesh(undefined, shadowMaterial(layers.shadowMap));
      const thread = new THREE.Mesh(undefined, embroideryMaterial(layers.map, layers.normalMap));
      shadow.renderOrder = 1;
      thread.renderOrder = 2;
      return { shadow, thread };
    };
    return { delante: make(design.delante), detras: make(design.detras) };
  }, [design]);
  useEffect(() => {
    model.mesh.updateWorldMatrix(true, false);
    const geo = projectDesigns(model.mesh);
    for (const s of ['delante', 'detras'] as const) {
      decals[s].thread.geometry.dispose();
      decals[s].thread.geometry = geo[s];
      decals[s].shadow.geometry = geo[s];
    }
    invalidate();
  }, [model, target, decals, invalidate]);
  useEffect(
    () => () => {
      for (const s of ['delante', 'detras'] as const) {
        (decals[s].thread.material as THREE.Material).dispose();
        (decals[s].shadow.material as THREE.Material).dispose();
      }
    },
    [decals]
  );

  useEffect(() => {
    onReady?.({ baseSize: model.baseSize, sizesByZone: !!model.zones });
  }, [model, onReady]);

  // Silueta real de la prenda (talla y color actuales) para el lienzo de edición
  useEffect(() => {
    if (!onSilhouettes) return;
    const t = setTimeout(() => onSilhouettes(renderSilhouettes(gl, scene3)), 150);
    return () => clearTimeout(t);
  }, [gl, scene3, color, target, model, onSilhouettes]);
  useEffect(() => () => onSilhouettes?.(null), [onSilhouettes]);

  return (
    <>
      <group position={[0, NECK_Y, 0]} scale={UNITS_PER_METER}>
        <primitive object={model.root} />
      </group>
      <primitive object={decals.delante.shadow} />
      <primitive object={decals.delante.thread} />
      <primitive object={decals.detras.shadow} />
      <primitive object={decals.detras.thread} />
    </>
  );
}

// ---------------------------------------------------------------- modelo

type Prepared = {
  root: THREE.Object3D;
  mesh: THREE.Mesh;
  material: THREE.MeshPhysicalMaterial;
  baseSize: string;
  /** Posiciones de la talla base y pesos por zona (manga, canalé) para cambiar de talla. */
  basePos: Float32Array;
  zones: THREE.BufferAttribute | null;
  marks: Landmarks | null;
};

/** Valida lo mínimo y prepara material y geometría. El GLB viene en metros con el HPS en el origen. */
function prepareModel(gltf: GLTF): Prepared {
  const root = gltf.scene.clone(true);
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  if (meshes.length !== 1) throw new Error(`Se espera una malla y el GLB tiene ${meshes.length}: prepáralo con tools/preparar-prenda.mjs`);
  const mesh = meshes[0];
  const extras = (gltf.scene.userData ?? {}) as { br?: Landmarks };
  if (!extras.br) throw new Error('El GLB no está preparado (faltan las marcas extras.br): usa tools/preparar-prenda.mjs');
  if (!mesh.geometry.attributes.uv) throw new Error('El GLB no tiene UVs');
  const box = new THREE.Box3().setFromObject(root);
  const heightCm = (box.max.y - box.min.y) * 100;
  if (heightCm < 50 || heightCm > 160) throw new Error(`Escala incorrecta: el modelo mide ${heightCm.toFixed(0)} cm de alto`);

  // La geometría se clona: se deforma por talla sin tocar la caché del cargador
  mesh.geometry = mesh.geometry.clone();
  mesh.layers.enable(LAYER_SILHOUETTE);
  const src = mesh.material as THREE.MeshStandardMaterial;
  const material = fabricMaterial(src);
  mesh.material = material;
  const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
  return {
    root,
    mesh,
    material,
    baseSize: (extras.br.tallaBase ?? 'M').toUpperCase(),
    basePos: Float32Array.from(pos.array as Float32Array),
    zones: (mesh.geometry.attributes._br_zona as THREE.BufferAttribute) ?? null,
    marks: extras.br
  };
}

/**
 * Talla por zonas: largo (alto del cuerpo bajo el hombro), pecho (ancho y fondo de toda la prenda),
 * bajo (ancho del canalé del bajo) y manga (largo desde la costura del hombro). La capucha se queda
 * igual de alta. Pesos por vértice en el atributo _BR_ZONA (x = manga, y = canalé).
 */
export function applySize(model: Pick<Prepared, 'mesh' | 'basePos' | 'zones' | 'marks'>, base: SizeRow, target: SizeRow) {
  const pos = model.mesh.geometry.attributes.position as THREE.BufferAttribute;
  const b = model.basePos;
  const rL = target.largo / base.largo;
  const rC = target.pecho / base.pecho;
  const rB = target.bajo / base.bajo / rC;
  const rS = target.manga / base.manga;
  const z = model.zones;
  const hy = model.marks?.hombroY ?? -0.07;
  for (let i = 0; i < pos.count; i++) {
    const x = b[i * 3];
    const y = b[i * 3 + 1];
    const zz = b[i * 3 + 2];
    const sleeve = z ? z.getX(i) : 0;
    const rib = z ? z.getY(i) : 0;
    const yBody = y < 0 ? y * rL : y;
    const ySleeve = y < hy ? hy * rL + (y - hy) * rS : yBody;
    const k = rC * (1 + rib * (rB - 1));
    pos.setXYZ(i, x * k, yBody + (ySleeve - yBody) * sleeve, zz * k);
  }
  pos.needsUpdate = true;
  model.mesh.geometry.computeBoundingBox();
  model.mesh.geometry.computeBoundingSphere();
}

// ---------------------------------------------------------------- bordado

/**
 * Proyecta los lienzos delante/detrás sobre la prenda (con su matriz de mundo ya actualizada).
 * Cada lienzo es un cuadrado de PANEL.size u centrado en (0, PANEL_Y): 1 px del editor mide
 * siempre CM_PER_PX cm sobre la prenda, sea cual sea la talla. Solo recibe bordado la tela que
 * mira hacia el lado proyectado (no el interior de la capucha ni la cara oculta de las mangas).
 */
export function projectDesigns(target: THREE.Mesh): Record<Side, THREE.BufferGeometry> {
  const box = new THREE.Box3().setFromObject(target);
  const margin = 0.1;
  const zMid = (box.min.z + box.max.z) / 2;
  const w = PANEL.size;
  const frontDepth = box.max.z + margin - zMid;
  const backDepth = zMid - (box.min.z - margin);
  const front = facing(target, 1);
  const back = facing(target, -1);
  const geo = {
    delante: new DecalGeometry(front, new THREE.Vector3(0, PANEL_Y, zMid + frontDepth / 2), new THREE.Euler(0, 0, 0), new THREE.Vector3(w, w, frontDepth)),
    detras: new DecalGeometry(back, new THREE.Vector3(0, PANEL_Y, zMid - backDepth / 2), new THREE.Euler(0, Math.PI, 0), new THREE.Vector3(w, w, backDepth))
  };
  front.geometry.dispose();
  back.geometry.dispose();
  lift(geo.delante, 0.003); // ~1 mm hacia fuera: la prenda no tapa el bordado
  lift(geo.detras, -0.003);
  return geo;
}

/** Copia de la malla (en coordenadas de mundo) con solo los triángulos que miran hacia ±Z. */
function facing(mesh: THREE.Mesh, dir: 1 | -1): THREE.Mesh {
  const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  g.applyMatrix4(mesh.matrixWorld);
  const p = g.attributes.position as THREE.BufferAttribute;
  const keep: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    const n = b.sub(a).cross(c.sub(a)).normalize();
    if (n.z * dir > 0.15) for (let k = 0; k < 9; k++) keep.push((p.array as Float32Array)[i * 3 + k]);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
  out.computeVertexNormals();
  g.dispose();
  return new THREE.Mesh(out);
}

/** Desplaza el bordado hacia el lado desde el que se proyecta (no depende de las normales del GLB). */
function lift(g: THREE.BufferGeometry, dz: number) {
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + dz);
  p.needsUpdate = true;
}

/** Hilo: algo más satinado que la felpa, con el relieve de las puntadas, sin perder saturación. */
function embroideryMaterial(map: THREE.Texture, normalMap: THREE.Texture) {
  return new THREE.MeshPhysicalMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(1.2, 1.2),
    transparent: true,
    roughness: 0.6,
    metalness: 0,
    specularIntensity: 0.3,
    envMapIntensity: 0.35,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    depthWrite: false
  });
}

/** Sombra de contacto del hilo sobre la tela. */
function shadowMaterial(map: THREE.Texture) {
  return new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    depthWrite: false
  });
}

// ---------------------------------------------------------------- siluetas

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
