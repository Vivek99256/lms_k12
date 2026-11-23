'use client';

import { useMemo, useRef, type ComponentType } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

import { ICE_MASS_G, type IceWorld } from '../../sim/iceMelting';
import { Beaker, LabRoom, Stopwatch, Tag } from '../dissolving/kit';
import type { LabKit, LabObjectRendererProps } from '../types';

/**
 * 3D pieces for the ice-melting mission: the beakers and stopwatch are shared with the dissolving lab;
 * the ice cube and the two thermometers are new. Everything reads the simulation each frame and decides nothing.
 */

const world = (get: () => unknown) => get() as IceWorld;

function LabelledBeaker(props: LabObjectRendererProps) {
  const o = world(props.getWorld).objects[props.id];
  return (
    <group>
      <Beaker {...props} />
      <Tag text={o?.label ?? ''} y={0.6} dark />
    </group>
  );
}

function IceCube({ id, getWorld }: LabObjectRendererProps) {
  const cube = useRef<THREE.Mesh>(null!);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#d9f3ff',
        transparent: true,
        opacity: 0.78,
        roughness: 0.12,
        clearcoat: 1,
        emissive: '#bfeaff',
        emissiveIntensity: 0.12,
      }),
    []
  );

  useFrame(() => {
    const o = world(getWorld).objects[id];
    if (!o) return;
    const s = Math.cbrt(Math.max(o.mass, 0) / ICE_MASS_G);
    cube.current.visible = o.mass > 0.05;
    cube.current.scale.setScalar(Math.max(s, 0.01));
    cube.current.position.y = 0.07 * Math.max(s, 0.01);
  });

  return (
    <group>
      <mesh ref={cube} material={material} castShadow>
        <boxGeometry args={[0.14, 0.14, 0.14]} />
      </mesh>
      <Tag text={world(getWorld).objects[id]?.label ?? ''} y={0.26} />
    </group>
  );
}

function IceThermometer({ id, getWorld }: LabObjectRendererProps) {
  const merc = useRef<THREE.Mesh>(null!);
  const label = useRef<HTMLSpanElement>(null);

  useFrame(() => {
    const o = world(getWorld).objects[id];
    if (!o) return;
    const reading = Math.max(0, Math.min(40, o.reading));
    const h = 0.04 + (reading / 40) * 0.5;
    merc.current.scale.set(1, h, 1);
    merc.current.position.y = 0.05 + h / 2;
    if (label.current) label.current.textContent = `${(Math.round(reading * 2) / 2).toFixed(1)} °C`;
  });

  return (
    <group>
      <mesh position={[0, 0.36, 0]} castShadow>
        <cylinderGeometry args={[0.016, 0.016, 0.72, 12]} />
        <meshPhysicalMaterial color="#e9f4fa" transparent opacity={0.4} roughness={0.05} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <sphereGeometry args={[0.026, 14, 10]} />
        <meshStandardMaterial color="#e11d2e" />
      </mesh>
      <mesh ref={merc}>
        <cylinderGeometry args={[0.006, 0.006, 1, 8]} />
        <meshStandardMaterial color="#e11d2e" />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[0.018, 0.05 + ((i * 5) / 40) * 0.5, 0]}>
          <boxGeometry args={[0.012, 0.003, 0.003]} />
          <meshBasicMaterial color="#334155" />
        </mesh>
      ))}
      <Html position={[0, 0.84, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 6, background: 'rgba(15,23,42,.88)', color: '#fff' }}>
          <span style={{ opacity: 0.7, marginRight: 4 }}>{world(getWorld).objects[id]?.label}</span>
          <span ref={label} />
        </div>
      </Html>
    </group>
  );
}

/**
 * The bench, with a frosted slab under the cool place and a heat lamp hanging above the warm place.
 * Both are kept low or out of the way: nothing tall stands between the camera and the objects, so
 * nothing can hide a beaker or block a click on it.
 */
function IceEnvironment() {
  return (
    <group>
      <LabRoom />
      {/* cool place: a thin frosted slab with a pale rim, flush with the bench */}
      <mesh position={[-0.85, 0.006, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.52, 48]} />
        <meshPhysicalMaterial color="#d8f1ff" transparent opacity={0.55} roughness={0.25} />
      </mesh>
      {/* warm place: a lamp high at the back, pointing down at the orange circle */}
      <group position={[0.85, 0, -0.55]}>
        <mesh position={[0, 1.35, 0]}>
          <coneGeometry args={[0.1, 0.12, 20, 1, true]} />
          <meshStandardMaterial color="#334155" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 1.27, 0]}>
          <sphereGeometry args={[0.035, 14, 10]} />
          <meshBasicMaterial color="#ffb347" />
        </mesh>
        <pointLight position={[0, 1.2, 0.5]} intensity={0.7} distance={2.6} color="#ff9d3a" />
      </group>
    </group>
  );
}

const OBJECTS: Record<string, ComponentType<LabObjectRendererProps>> = {
  beaker: LabelledBeaker,
  ice_cube: IceCube,
  ice_thermometer: IceThermometer,
  stopwatch: Stopwatch,
};

export const iceMeltingKit: LabKit = {
  objects: OBJECTS,
  Environment: IceEnvironment,
};
