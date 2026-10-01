'use client';

import { ContactShadows, Decal, OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { PANEL, TORSO_DEPTH, TORSO_PROFILE, type GarmentType, type Side } from './config';

export type Garment3DHandle = { snapshot: (side: Side) => string | null };

type Props = {
  type: GarmentType;
  color: string;
  /** Lado que se está editando: la cámara lo muestra. */
  view: Side;
  front: THREE.CanvasTexture;
  back: THREE.CanvasTexture;
};

const DEPTH = TORSO_DEPTH;

function useKnitBump() {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    for (let x = 0; x < 64; x++) {
      const v = 128 + Math.sin((x / 64) * Math.PI * 16) * 60;
      for (let y = 0; y < 64; y++) {
        const n = v + (Math.random() - 0.5) * 30;
        ctx.fillStyle = `rgb(${n},${n},${n})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(24, 24);
    return t;
  }, []);
}

function Garment({ type, color, front, back }: Omit<Props, 'view'>) {
  const knit = useKnitBump();
  const torso = useMemo(() => {
    const g = new THREE.LatheGeometry(TORSO_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 96);
    g.scale(1, 1, DEPTH);
    g.computeVertexNormals();
    return g;
  }, []);

  const fabric = useMemo(
    () => new THREE.MeshStandardMaterial({ color, roughness: 0.95, bumpMap: knit, bumpScale: 0.12 }),
    [color, knit]
  );
  const rib = useMemo(() => {
    const c = new THREE.Color(color).multiplyScalar(0.85);
    return new THREE.MeshStandardMaterial({ color: c, roughness: 1, bumpMap: knit, bumpScale: 0.5 });
  }, [color, knit]);

  const long = type !== 'camiseta';
  const sleeveLen = long ? 1.15 : 0.38;

  return (
    <group position={[0, 0.05, 0]}>
      <mesh geometry={torso} material={fabric} castShadow>
        {/* Cada lienzo cubre todo el panel del torso: el cliente coloca el diseño donde quiera */}
        <Decal position={[0, PANEL.centerY, 0.2]} rotation={[0, 0, 0]} scale={[PANEL.size, PANEL.size, 0.42]}>
          <DecalMaterial map={front} />
        </Decal>
        <Decal position={[0, PANEL.centerY, -0.2]} rotation={[0, Math.PI, 0]} scale={[PANEL.size, PANEL.size, 0.42]}>
          <DecalMaterial map={back} />
        </Decal>
      </mesh>

      {/* Cuello */}
      <mesh position={[0, 0.735, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, DEPTH * 1.6, 1]} material={rib}>
        <torusGeometry args={[0.21, 0.035, 16, 48]} />
      </mesh>

      {/* Bajo con canalé (no en camiseta) */}
      {long && (
        <mesh position={[0, -0.82, 0]} scale={[1, 1, DEPTH]} material={rib}>
          <cylinderGeometry args={[0.61, 0.6, 0.1, 64, 1, true]} />
        </mesh>
      )}

      {/* Mangas */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.6, 0.52, 0]} rotation={[0, 0, side * (long ? 0.42 : 0.9)]}>
          <mesh position={[0, -sleeveLen / 2, 0]} material={fabric} castShadow>
            <cylinderGeometry args={[long ? 0.18 : 0.21, long ? 0.13 : 0.19, sleeveLen, 40, 1, !long]} />
          </mesh>
          <mesh position={[0, 0, 0]} material={fabric}>
            <sphereGeometry args={[long ? 0.18 : 0.21, 32, 16]} />
          </mesh>
          {long && (
            <mesh position={[0, -sleeveLen - 0.05, 0]} material={rib}>
              <cylinderGeometry args={[0.13, 0.125, 0.12, 32]} />
            </mesh>
          )}
        </group>
      ))}

      {/* Capucha + cordones + bolsillo canguro */}
      {type === 'hoodie' && (
        <>
          <mesh position={[0, 0.82, -0.16]} rotation={[-0.35, 0, 0]} scale={[1, 1.05, 0.9]} material={fabric}>
            <sphereGeometry args={[0.32, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          </mesh>
          {[-0.07, 0.07].map((x) => (
            <mesh key={x} position={[x, 0.55, 0.33]} rotation={[0.18, 0, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.32, 8]} />
              <meshStandardMaterial color="#eeeeee" roughness={0.8} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

function DecalMaterial({ map }: { map: THREE.CanvasTexture }) {
  return (
    <meshStandardMaterial
      map={map}
      bumpMap={map}
      bumpScale={2}
      transparent
      roughness={0.55}
      polygonOffset
      polygonOffsetFactor={-4}
      depthWrite={false}
    />
  );
}

function Snapshotter({ handleRef }: { handleRef: React.MutableRefObject<Garment3DHandle | null> }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    handleRef.current = {
      snapshot: (side) => {
        // Captura frontal o trasera sin perder el punto de vista del cliente
        const pos = camera.position.clone();
        camera.position.set(0, 0.1, side === 'detras' ? -4.2 : 4.2);
        camera.lookAt(0, 0, 0);
        gl.render(scene, camera);
        const url = gl.domElement.toDataURL('image/jpeg', 0.88);
        camera.position.copy(pos);
        camera.lookAt(0, 0, 0);
        gl.render(scene, camera);
        return url;
      }
    };
  }, [gl, scene, camera, handleRef]);
  return null;
}

export const Garment3D = forwardRef<Garment3DHandle, Props>(function Garment3D(props, ref) {
  const handleRef = useMemo(() => ({ current: null as Garment3DHandle | null }), []);
  useImperativeHandle(ref, () => ({ snapshot: (side) => handleRef.current?.snapshot(side) ?? null }), [handleRef]);
  const { view, ...garment } = props;
  const back = view === 'detras';
  const [spin, setSpin] = useState(true);
  const firstView = useRef(view);
  useEffect(() => {
    if (view !== firstView.current) setSpin(false); // al cambiar de lado, se queda mirando ese lado
  }, [view]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 0.1, 4.2], fov: 35 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      aria-label="Vista 3D de la prenda"
    >
      <color attach="background" args={['#ede6da']} />
      <hemisphereLight args={['#ffffff', '#b9ad9a', 1.2]} />
      <directionalLight position={[2.5, 3, 4]} intensity={1.6} castShadow />
      <directionalLight position={[-3, 1, -3]} intensity={0.6} />
      <Garment {...garment} />
      <ContactShadows position={[0, -1.05, 0]} opacity={0.35} scale={4} blur={2.4} far={2} />
      <OrbitControls
        makeDefault
        onStart={() => setSpin(false)}
        enablePan={false}
        minDistance={2.2}
        maxDistance={5.5}
        minPolarAngle={Math.PI * 0.3}
        maxPolarAngle={Math.PI * 0.62}
        autoRotate={spin}
        autoRotateSpeed={0.8}
      />
      <CameraFacing back={back} />
      <Snapshotter handleRef={handleRef} />
    </Canvas>
  );
});

/** Al cambiar entre delante y detrás, gira la cámara hacia ese lado. */
function CameraFacing({ back }: { back: boolean }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 0.1, back ? -4.2 : 4.2);
    camera.lookAt(0, 0, 0);
  }, [back, camera]);
  return null;
}
