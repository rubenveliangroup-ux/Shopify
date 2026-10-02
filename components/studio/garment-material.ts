import * as THREE from 'three';
import { CM_PER_UNIT, PANEL_Y } from './config';

// Material y encuadre de la prenda 3D, sin React: los usan el visor y tools/render-vistas.mjs.

/** Altura del cuello (punto alto del hombro) y centro del lienzo, en unidades de escena. */
export const NECK_Y = 0.79;
export { PANEL_Y };
export const UNITS_PER_METER = 100 / CM_PER_UNIT;
/** Iluminación de estudio: intensidad del HDRI y luces [posición, intensidad] (visor y render-vistas). */
// Con tone mapping Khronos PBR Neutral (pensado para que un producto conserve su color), la luz que
// recibe la tela de frente suma ≈ 1: el color que se ve es el elegido.
export const STUDIO_LIGHTS = {
  toneMapping: THREE.NeutralToneMapping,
  env: 0.4,
  hemi: 0.15,
  directional: [
    [[2.2, 3.2, 4], 0.75],
    [[-3, 1.2, 2], 0.25],
    [[0, 2, -4], 0.35]
  ] as [[number, number, number], number][]
};

/**
 * Felpa de algodón mate: mapa base neutro del modelo × color elegido, normal map del modelo para
 * pliegues y grano, brillo aterciopelado (sheen) en lugar de reflejos de plástico y un lavado sutil
 * (variación de tono de baja frecuencia en el espacio del objeto, sin costuras de UV).
 */
export function fabricMaterial(src: THREE.MeshStandardMaterial) {
  const m = new THREE.MeshPhysicalMaterial({
    map: src.map,
    normalMap: src.normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.93,
    metalness: 0,
    specularIntensity: 0.25,
    sheen: 0.6,
    sheenRoughness: 0.8,
    side: THREE.DoubleSide, // prenda hueca: se ve el interior por el cuello, los puños y el bajo
    envMapIntensity: STUDIO_LIGHTS.env
  });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBrPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBrPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vBrPos;
float brHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float brNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(brHash(i), brHash(i + vec3(1,0,0)), f.x), mix(brHash(i + vec3(0,1,0)), brHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(brHash(i + vec3(0,0,1)), brHash(i + vec3(1,0,1)), f.x), mix(brHash(i + vec3(0,1,1)), brHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
// Lavado: manchas suaves (~10 cm) y vetas finas; ±6 % de tono
float brWash = (brNoise(vBrPos * 9.0) - 0.5) * 0.09 + (brNoise(vBrPos * 34.0) - 0.5) * 0.035;
diffuseColor.rgb *= 1.0 + brWash;`
      );
  };
  return m;
}

/** Color elegido en el material. Los muy oscuros se levantan un poco (la felpa negra refleja ~3 %) y el sheen los define. */
export function applyTint(m: THREE.MeshPhysicalMaterial, hex: string) {
  const c = new THREE.Color(hex); // en lineal
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const floor = 0.012;
  if (lum < floor) c.lerp(new THREE.Color(floor, floor, floor), 1 - lum / floor);
  m.color.copy(c);
  // Sheen algo más visible en colores oscuros (como la felpa real) para que no se pierdan los pliegues
  const dark = 1 - Math.min(1, lum * 3);
  m.sheen = 0.15 + 0.3 * dark;
  m.sheenColor.copy(c).lerp(new THREE.Color(1, 1, 1), 0.2 + 0.15 * dark);
}

