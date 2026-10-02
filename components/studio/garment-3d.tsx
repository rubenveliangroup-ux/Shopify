'use client';

import { ContactShadows, OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Component, Suspense, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { Side } from './config';
import { createEmbroideryRelief } from './embroidery-normal';
import { GarmentGLB, type DesignLayers, type ModelInfo, type SizeRow } from './garment-glb';
import { STUDIO_LIGHTS } from './garment-material';
import type { PreviewHandle } from './garment-preview';

/**
 * Visor 3D de la prenda (chunk aparte: three.js solo se descarga al abrir el estudio).
 * Usa únicamente el GLB de la prenda; si no carga, va lento o falla, avisa con onFail y el
 * estudio pasa a la vista previa ligera 2D.
 */
export type Garment3DProps = {
  color: string;
  /** Lado que se está editando: la cámara lo muestra. */
  view: Side;
  /** Lienzos del diseño (delante/detrás) y su versión: cambia cada vez que se redibujan. */
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  version: number;
  modelUrl: string;
  /** Talla que se muestra y medidas por talla (tabla de medidas). */
  size?: string;
  sizes?: SizeRow[];
  onModelReady?: (info: ModelInfo | null) => void;
  /** Vistas delante/detrás de la prenda en la talla actual para el lienzo de edición. */
  onSilhouettes?: (s: Record<Side, string> | null) => void;
  /** El 3D no es viable (carga fallida, WebGL perdido o dispositivo lento). */
  onFail?: (reason: string) => void;
  /** Móvil / táctil: menos resolución y efectos. */
  lowPower?: boolean;
  /** false = no pasar a la vista ligera aunque vaya lento (?modo3d=3d). */
  autoLite?: boolean;
};

const CAM_Z = 3.7;
const CAM_Y = 0.12;

function canvasTexture(c: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Texturas del diseño + relieve de bordado (normal map y sombra) de cada lado. */
function useDesignLayers(front: HTMLCanvasElement, back: HTMLCanvasElement, version: number) {
  const layers = useMemo(() => {
    const make = (src: HTMLCanvasElement) => {
      const relief = createEmbroideryRelief();
      return {
        relief,
        layer: { map: canvasTexture(src, true), normalMap: canvasTexture(relief.normal, false), shadowMap: canvasTexture(relief.shadow, true) } as DesignLayers
      };
    };
    return { delante: make(front), detras: make(back) };
  }, [front, back]);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    for (const s of ['delante', 'detras'] as const) layers[s].layer.map.needsUpdate = true;
    invalidate();
    // El relieve es más caro: se rehace cuando el cliente deja de mover el diseño
    const t = setTimeout(() => {
      for (const s of ['delante', 'detras'] as const) {
        const { relief, layer } = layers[s];
        relief.update(s === 'delante' ? front : back);
        layer.normalMap.needsUpdate = true;
        layer.shadowMap.needsUpdate = true;
      }
      invalidate();
    }, 180);
    return () => clearTimeout(t);
  }, [version, layers, front, back, invalidate]);
  useEffect(
    () => () => {
      for (const s of ['delante', 'detras'] as const) for (const t of Object.values(layers[s].layer)) t.dispose();
    },
    [layers]
  );
  return useMemo(() => ({ delante: layers.delante.layer, detras: layers.detras.layer }), [layers]);
}

function Scene(props: Garment3DProps & { handleRef: { current: PreviewHandle | null }; spin: boolean; onSpinStop: () => void }) {
  const { color, front, back, version, modelUrl, size, sizes, onModelReady, onSilhouettes, onFail, lowPower, handleRef, spin, onSpinStop } = props;
  const design = useDesignLayers(front, back, version);
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <color attach="background" args={['#ece8e1']} />
      {/* Luz principal y de relleno; el HDRI de estudio lo pone GarmentGLB */}
      <StudioLights />
      <ModelBoundary key={modelUrl} onError={(e) => (onModelReady?.(null), onSilhouettes?.(null), onFail?.(e))}>
        <Suspense fallback={null}>
          <GarmentGLB
            url={modelUrl}
            color={color}
            design={design}
            size={size}
            sizes={sizes}
            onReady={(info) => (setLoaded(true), onModelReady?.(info))}
            onSilhouettes={onSilhouettes}
          />
        </Suspense>
      </ModelBoundary>
      {loaded && (
        <ContactShadows key={size} position={[0, -0.95, 0]} opacity={0.32} scale={3.4} blur={2.6} far={1.6} resolution={lowPower ? 256 : 512} frames={1} />
      )}
      <OrbitControls
        makeDefault
        onStart={onSpinStop}
        enablePan={false}
        enableDamping={!lowPower}
        minDistance={2.2}
        maxDistance={5.5}
        minPolarAngle={Math.PI * 0.3}
        maxPolarAngle={Math.PI * 0.62}
        target={[0, CAM_Y, 0]}
        autoRotate={spin}
        autoRotateSpeed={0.8}
      />
      <Snapshotter handleRef={handleRef} />
    </>
  );
}

/** Luz principal arriba a la derecha, relleno a la izquierda y contraluz (mismas que tools/render-vistas). */
function StudioLights() {
  return (
    <>
      {STUDIO_LIGHTS.hemi && <hemisphereLight args={['#ffffff', '#c9c2b6', STUDIO_LIGHTS.hemi]} />}
      {STUDIO_LIGHTS.directional.map(([p, i], k) => (
        <directionalLight key={k} position={p} intensity={i} />
      ))}
    </>
  );
}

function Snapshotter({ handleRef }: { handleRef: { current: PreviewHandle | null } }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    handleRef.current = {
      snapshot: (side) => {
        // Captura frontal o trasera sin perder el punto de vista del cliente
        const pos = camera.position.clone();
        camera.position.set(0, CAM_Y, side === 'detras' ? -CAM_Z : CAM_Z);
        camera.lookAt(0, CAM_Y, 0);
        gl.render(scene, camera);
        const url = gl.domElement.toDataURL('image/jpeg', 0.88);
        camera.position.copy(pos);
        camera.lookAt(0, CAM_Y, 0);
        gl.render(scene, camera);
        return url;
      }
    };
  }, [gl, scene, camera, handleRef]);
  return null;
}

/** Al cambiar entre delante y detrás, gira la cámara hacia ese lado. */
function CameraFacing({ back }: { back: boolean }) {
  const { camera, invalidate } = useThree();
  useEffect(() => {
    camera.position.set(0, CAM_Y, back ? -CAM_Z : CAM_Z);
    camera.lookAt(0, CAM_Y, 0);
    invalidate();
  }, [back, camera, invalidate]);
  return null;
}

/** Si se pierde el contexto WebGL (móvil sin memoria), se avisa para pasar a la vista ligera. */
function ContextGuard({ onFail }: { onFail?: (reason: string) => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const c = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onFail?.('Se perdió el contexto WebGL');
    };
    c.addEventListener('webglcontextlost', lost);
    return () => c.removeEventListener('webglcontextlost', lost);
  }, [gl, onFail]);
  return null;
}

const Garment3D = forwardRef<PreviewHandle, Garment3DProps>(function Garment3D(props, ref) {
  const handleRef = useMemo(() => ({ current: null as PreviewHandle | null }), []);
  useImperativeHandle(ref, () => ({ snapshot: (side) => handleRef.current?.snapshot(side) ?? null }), [handleRef]);
  const { view, lowPower, onFail, autoLite = true } = props;
  const [spin, setSpin] = useState(true);
  const firstView = useRef(view);
  useEffect(() => {
    if (view !== firstView.current) setSpin(false); // al cambiar de lado, se queda mirando ese lado
  }, [view]);
  // Resolución limitada: 1,5× en móvil (2× en escritorio); baja a 1× si el dispositivo no llega
  const maxDpr = lowPower ? 1.5 : 2;
  const [dpr, setDpr] = useState(Math.min(maxDpr, typeof window !== 'undefined' ? window.devicePixelRatio : 1));

  return (
    <Canvas
      dpr={dpr}
      frameloop={spin ? 'always' : 'demand'}
      camera={{ position: [0, CAM_Y, CAM_Z], fov: 35 }}
      gl={{ preserveDrawingBuffer: true, antialias: !lowPower, powerPreference: lowPower ? 'low-power' : 'default' }}
      onCreated={({ gl }) => {
        gl.toneMapping = STUDIO_LIGHTS.toneMapping;
      }}
      aria-label="Vista 3D de la prenda"
    >
      {/* Mide los FPS mientras gira: si no llega, baja la resolución y, si sigue sin llegar, vista ligera */}
      <PerformanceMonitor
        bounds={() => [22, 55]}
        onDecline={() => {
          if (dpr > 1) setDpr(1);
          else if (autoLite) onFail?.('El dispositivo no mueve el 3D con fluidez');
        }}
      />
      <Scene {...props} handleRef={handleRef} spin={spin} onSpinStop={() => setSpin(false)} />
      <CameraFacing back={view === 'detras'} />
      <ContextGuard onFail={onFail} />
    </Canvas>
  );
});
export default Garment3D;

class ModelBoundary extends Component<{ onError?: (reason: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn('[br-studio] Modelo 3D no disponible, se usa la vista ligera:', reason);
    this.props.onError?.(reason);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
