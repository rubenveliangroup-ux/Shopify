// Página que usa render-vistas.mjs: render neutro (prenda blanca) delante/detrás con la misma luz y
// material que el visor 3D, con el encuadre LITE_FRAME (prenda entera; el lienzo cae en PANEL_IN_LITE).
import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { LITE_FRAME } from '@/components/studio/config';
import { applyTint, fabricMaterial, NECK_Y, STUDIO_LIGHTS, UNITS_PER_METER } from '@/components/studio/garment-material';

const S = Number(new URLSearchParams(location.search).get('s') || 1200);
const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
r.setSize(S, S);
r.setClearColor(0x000000, 0);
r.toneMapping = STUDIO_LIGHTS.toneMapping;
r.toneMappingExposure = STUDIO_LIGHTS.exposure;
document.body.appendChild(r.domElement);
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
// Mismas luces que el visor (garment-material.ts)
scene.add(new THREE.HemisphereLight('#ffffff', '#c9c2b6', STUDIO_LIGHTS.hemi));
for (const [p, i] of STUDIO_LIGHTS.directional) {
  const d = new THREE.DirectionalLight('#ffffff', i);
  d.position.set(p[0], p[1], p[2]);
  scene.add(d);
}
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'));
loader.load('/modelo.glb', (gltf) => {
  const group = new THREE.Group();
  group.position.set(0, NECK_Y, 0);
  group.scale.setScalar(UNITS_PER_METER);
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = fabricMaterial(m.material as THREE.MeshStandardMaterial);
    applyTint(mat, '#ffffff');
    m.material = mat;
  });
  group.add(gltf.scene);
  scene.add(group);
  const h = LITE_FRAME.size / 2;
  const cam = new THREE.OrthographicCamera(-h, h, h, -h, 0.01, 20);
  const out: Record<string, string> = {};
  for (const side of ['delante', 'detras']) {
    cam.position.set(0, LITE_FRAME.centerY, side === 'delante' ? 10 : -10);
    cam.lookAt(0, LITE_FRAME.centerY, 0);
    r.render(scene, cam);
    out[side] = r.domElement.toDataURL('image/png');
  }
  (window as unknown as { vistas: Record<string, string> }).vistas = out;
});
