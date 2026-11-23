'use client';

/* eslint-disable react-hooks/immutability -- this file drives an imperative three.js scene graph from useFrame; mutating refs and scene objects every frame is the intended pattern. */

import { useMemo, useRef, type ComponentType } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

import { GEOM, type DissolveWorld } from '../../sim/dissolving';
import type { LabKit, LabObjectRendererProps } from '../types';

/**
 * 3D renderers for the dissolving lab: one component per object kind, plus the
 * effects that belong to the whole experiment (falling sugar, dissolved
 * particles, the water stream). All of them READ the simulation each frame;
 * none of them decides anything.
 */

type W = DissolveWorld;
const world = (get: () => unknown) => get() as W;

const glass = () =>
  new THREE.MeshPhysicalMaterial({
    color: '#d6ecf7',
    transparent: true,
    opacity: 0.2,
    roughness: 0.04,
    metalness: 0,
    clearcoat: 1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

const waterMaterial = () =>
  new THREE.MeshPhysicalMaterial({
    color: '#6db9e8',
    transparent: true,
    opacity: 0.55,
    roughness: 0.08,
    clearcoat: 0.6,
    depthWrite: false,
  });

function Tag({ text, y, dark = false }: { text: string; y: number; dark?: boolean }) {
  return (
    <Html position={[0, y, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <div
        style={{
          whiteSpace: 'nowrap',
          fontSize: 11,
          fontWeight: 600,
          padding: '1px 7px',
          borderRadius: 999,
          background: dark ? 'rgba(15,23,42,.85)' : 'rgba(255,255,255,.9)',
          color: dark ? '#fff' : '#0f172a',
          boxShadow: '0 1px 3px rgba(0,0,0,.25)',
        }}
      >
        {text}
      </div>
    </Html>
  );
}

/** A graduated, open glass vessel with a water column that follows the simulation. */
function Vessel({
  id,
  getWorld,
  kind,
  ticks,
  tickEvery,
  swirl = true,
  tint = '#6db9e8',
}: LabObjectRendererProps & {
  kind: 'beaker' | 'cylinder' | 'jug';
  ticks: number;
  tickEvery: number;
  swirl?: boolean;
  tint?: string;
}) {
  const g = GEOM[kind];
  const waterRef = useRef<THREE.Group>(null!);
  const waterMesh = useRef<THREE.Mesh>(null!);
  const surface = useRef<THREE.Mesh>(null!);
  const arms = useRef<THREE.Group>(null!);

  const wall = useMemo(() => {
    const pts = [
      [0, 0],
      [g.r - 0.012, 0],
      [g.r, 0.012],
      [g.r, g.h],
      [g.r + 0.008, g.h + 0.008],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 40);
  }, [g]);
  const glassMat = useMemo(() => glass(), []);
  const waterMat = useMemo(() => {
    const m = waterMaterial();
    m.color = new THREE.Color(tint);
    return m;
  }, [tint]);

  useFrame((_, dt) => {
    const w = world(getWorld);
    const o = w.objects[id];
    if (!o) return;
    const frac = Math.max(0, Math.min(1, o.waterMl / Math.max(1, o.capacityMl)));
    const level = frac * g.innerH;
    waterRef.current.visible = level > 0.003;
    // The surface stays level while a jug tilts.
    waterRef.current.rotation.z = kind === 'jug' ? (o.tilt * Math.PI) / 180 : 0;
    waterMesh.current.scale.set(1, Math.max(level, 0.001), 1);
    waterMesh.current.position.y = g.floor + level / 2;
    surface.current.position.y = g.floor + level;
    const intensity = w.stir[id]?.intensity ?? 0;
    if (arms.current) {
      arms.current.visible = swirl && intensity > 0.04;
      arms.current.position.y = g.floor + level - 0.004;
      arms.current.rotation.y += dt * (2 + intensity * 9);
    }
  });

  return (
    <group>
      <mesh geometry={wall} material={glassMat} castShadow />
      <group ref={waterRef}>
        <mesh ref={waterMesh} material={waterMat}>
          <cylinderGeometry args={[g.inner, g.inner, 1, 40, 1]} />
        </mesh>
        <mesh ref={surface} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[g.inner, 40]} />
          <meshStandardMaterial color="#bfe6fb" transparent opacity={0.55} depthWrite={false} />
        </mesh>
        {swirl ? (
          <group ref={arms}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]} position={[0, 0, 0]}>
                <boxGeometry args={[g.inner * 1.7, 0.004, 0.006]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.45} />
              </mesh>
            ))}
          </group>
        ) : null}
      </group>
      {Array.from({ length: ticks }, (_, i) => {
        const y = g.floor + ((i + 1) / ticks) * g.innerH;
        const major = ((i + 1) * tickEvery) % (tickEvery * (ticks > 6 ? 5 : 2)) === 0;
        return (
          <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[g.r + 0.0008, major ? 0.0028 : 0.0014, 4, 40]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={major ? 0.9 : 0.55} />
          </mesh>
        );
      })}
    </group>
  );
}

const Beaker = (p: LabObjectRendererProps) => <Vessel {...p} kind="beaker" ticks={5} tickEvery={50} />;
const Cylinder = (p: LabObjectRendererProps) => <Vessel {...p} kind="cylinder" ticks={10} tickEvery={10} swirl={false} />;

function Jug({ id, getWorld }: LabObjectRendererProps) {
  const g = GEOM.jug;
  return (
    <group>
      <Vessel id={id} getWorld={getWorld} kind="jug" ticks={0} tickEvery={100} swirl={false} />
      {/* handle and spout lip */}
      <mesh position={[-g.r - 0.01, g.h * 0.55, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.11, 0.014, 8, 20, Math.PI]} />
        <meshStandardMaterial color="#e6eef5" roughness={0.3} />
      </mesh>
      <mesh position={[g.r + 0.03, g.h - 0.01, 0]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[0.1, 0.012, 0.09]} />
        <meshStandardMaterial color="#e6eef5" roughness={0.3} />
      </mesh>
      <Tag text={world(getWorld).objects[id]?.label ?? ''} y={g.h + 0.18} />
    </group>
  );
}

function SugarJar({ id, getWorld }: LabObjectRendererProps) {
  const g = GEOM.sugar_jar;
  const pile = useRef<THREE.Mesh>(null!);
  const mat = useMemo(() => glass(), []);
  const wall = useMemo(() => {
    const pts = [
      [0, 0],
      [g.r - 0.01, 0],
      [g.r, 0.012],
      [g.r, g.h],
      [g.r + 0.01, g.h + 0.01],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 36);
  }, [g]);

  useFrame(() => {
    const o = world(getWorld).objects[id];
    if (!o || !pile.current) return;
    const h = Math.max(0.001, Math.min(1, o.sugarG / 120) * (g.innerH * 0.95));
    pile.current.visible = o.sugarG > 0.05;
    pile.current.scale.set(1, h, 1);
    pile.current.position.y = g.floor + h / 2;
  });

  return (
    <group>
      <mesh geometry={wall} material={mat} castShadow />
      <mesh ref={pile}>
        <cylinderGeometry args={[g.inner, g.inner, 1, 28]} />
        <meshStandardMaterial color="#f7f5ee" roughness={0.95} />
      </mesh>
      <mesh position={[0, g.h * 0.45, g.r + 0.002]}>
        <planeGeometry args={[0.2, 0.12]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <Tag text={world(getWorld).objects[id]?.label ?? ''} y={g.h + 0.15} />
    </group>
  );
}

function Spoon({ id, getWorld }: LabObjectRendererProps) {
  return (
    <group rotation={[0, 0, 0.1]}>
      <mesh position={[0, 0.36, 0]} castShadow>
        <cylinderGeometry args={[0.011, 0.011, 0.66, 10]} />
        <meshStandardMaterial color="#cfd6dc" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.03, 0]} scale={[1.1, 0.6, 0.45]} castShadow>
        <sphereGeometry args={[0.045, 16, 12]} />
        <meshStandardMaterial color="#cfd6dc" metalness={0.85} roughness={0.25} />
      </mesh>
      <Tag text={world(getWorld).objects[id]?.label ?? ''} y={0.78} />
    </group>
  );
}

function Thermometer({ id, getWorld }: LabObjectRendererProps) {
  const merc = useRef<THREE.Mesh>(null!);
  const label = useRef<HTMLDivElement>(null);

  useFrame(() => {
    const w = world(getWorld);
    const reading = Math.max(0, Math.min(70, w.therm.reading));
    const h = 0.04 + (reading / 70) * 0.5;
    merc.current.scale.set(1, h, 1);
    merc.current.position.y = 0.05 + h / 2;
    if (label.current) label.current.textContent = `${(Math.round(reading * 2) / 2).toFixed(1)} °C`;
  });

  return (
    <group>
      <mesh position={[0, 0.36, 0]} castShadow>
        <cylinderGeometry args={[0.014, 0.014, 0.72, 12]} />
        <meshPhysicalMaterial color="#e9f4fa" transparent opacity={0.35} roughness={0.05} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <sphereGeometry args={[0.024, 14, 10]} />
        <meshStandardMaterial color="#e11d2e" />
      </mesh>
      <mesh ref={merc}>
        <cylinderGeometry args={[0.0055, 0.0055, 1, 8]} />
        <meshStandardMaterial color="#e11d2e" />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[0.015, 0.05 + ((i * 10) / 70) * 0.5, 0]}>
          <boxGeometry args={[0.012, 0.003, 0.003]} />
          <meshBasicMaterial color="#334155" />
        </mesh>
      ))}
      <Html position={[0, 0.82, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            whiteSpace: 'nowrap',
            fontSize: 11,
            fontWeight: 700,
            padding: '1px 7px',
            borderRadius: 6,
            background: 'rgba(15,23,42,.88)',
            color: '#fff',
          }}
        >
          <span style={{ opacity: 0.7, marginRight: 4 }}>{world(getWorld).objects[id]?.label}</span>
          <span ref={label} />
        </div>
      </Html>
    </group>
  );
}

function Stopwatch({ id, getWorld }: LabObjectRendererProps) {
  const face = useRef<HTMLDivElement>(null);
  const ring = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    const w = world(getWorld);
    const t = w.sw.elapsed;
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    if (face.current) face.current.textContent = `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
    (ring.current.material as THREE.MeshStandardMaterial).color.set(w.sw.running ? '#22c55e' : '#94a3b8');
  });

  return (
    <group>
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.06, 32]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} />
      </mesh>
      <mesh ref={ring} position={[0, 0.061, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.115, 32]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[0, 0.075, -0.1]}>
        <cylinderGeometry args={[0.02, 0.02, 0.04, 12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.7} />
      </mesh>
      <Html position={[0, 0.08, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            width: 74,
            textAlign: 'center',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 14,
            fontWeight: 700,
            color: '#a7f3d0',
            background: '#0f172a',
            borderRadius: 6,
            padding: '2px 0',
          }}
        >
          <div ref={face}>00:00.0</div>
          <div style={{ fontSize: 8, color: '#94a3b8', fontWeight: 500 }}>click to start / stop</div>
        </div>
      </Html>
      <Tag text={world(getWorld).objects[id]?.label ?? ''} y={0.2} />
    </group>
  );
}

// --- experiment-wide effects -----------------------------------------------------

const MAX_CRYSTALS = 700;

function Crystals({ getWorld }: { getWorld: () => unknown }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const w = world(getWorld);
    let n = 0;
    for (const c of w.crystals) {
      if (c.s === 'gone' || n >= MAX_CRYSTALS) continue;
      const s = Math.cbrt(c.m / 0.1);
      dummy.position.set(c.x, c.y, c.z);
      dummy.rotation.set(n * 1.7, n * 2.3, n * 0.9);
      dummy.scale.setScalar(Math.max(0.15, s));
      dummy.updateMatrix();
      mesh.current.setMatrixAt(n++, dummy.matrix);
    }
    mesh.current.count = n;
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_CRYSTALS]} frustumCulled={false} castShadow>
      <boxGeometry args={[0.02, 0.02, 0.02]} />
      <meshStandardMaterial color="#ffffff" roughness={0.25} emissive="#ffffff" emissiveIntensity={0.18} />
    </instancedMesh>
  );
}

const N_DISSOLVED = 320;

function DissolvedCloud({ id, getWorld }: { id: string; getWorld: () => unknown }) {
  const group = useRef<THREE.Group>(null!);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_DISSOLVED * 3), 3));
    return g;
  }, []);
  const seeds = useMemo(
    () =>
      Array.from({ length: N_DISSOLVED }, (_, i) => {
        const r = (k: number) => {
          const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
          return x - Math.floor(x);
        };
        return { u: r(1), v: r(2), w: r(3), a: r(4), b: r(5), s: 0, born: false };
      }),
    []
  );
  const clock = useRef(0);

  useFrame((_, dt) => {
    const w = world(getWorld);
    const b = w.objects[id];
    if (!b) return;
    clock.current += dt;
    group.current.position.set(b.x, b.y, b.z);
    const g = GEOM.beaker;
    const level = (Math.max(0, Math.min(1, b.waterMl / b.capacityMl)) * g.innerH);
    const want = Math.min(N_DISSOLVED, Math.floor((w.dissolvedG[id] ?? 0) / 0.015));
    const intensity = w.stir[id]?.intensity ?? 0;
    const rate = 0.03 * Math.pow(2, (b.tempC - 20) / 20) + 0.22 * intensity;
    const swirl = clock.current * intensity * 2.2;
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute;

    for (let i = 0; i < N_DISSOLVED; i++) {
      const p = seeds[i];
      if (i >= want) {
        p.born = false;
        continue;
      }
      if (!p.born) {
        p.born = true;
        p.s = 0;
      }
      p.s = Math.min(1, p.s + rate * dt);
      const e = p.s * p.s * (3 - 2 * p.s);
      const ox = (p.a - 0.5) * 0.2;
      const oz = (p.b - 0.5) * 0.2;
      const oy = g.floor + 0.02;
      const rr = (g.inner - 0.01) * Math.sqrt(p.u);
      const th = p.v * Math.PI * 2 + swirl * e;
      const hx = Math.cos(th) * rr;
      const hz = Math.sin(th) * rr;
      const hy = g.floor + 0.01 + p.w * Math.max(0.02, level - 0.02);
      const j = Math.sin(clock.current * 1.3 + i) * 0.004 * e;
      attr.setXYZ(i, ox + (hx - ox) * e + j, oy + (hy - oy) * e, oz + (hz - oz) * e - j);
    }
    geometry.setDrawRange(0, want);
    attr.needsUpdate = true;
    group.current.visible = want > 0 && b.waterMl > 5;
  });

  return (
    <group ref={group}>
      <points geometry={geometry} frustumCulled={false}>
        <pointsMaterial color="#ffffff" size={0.016} transparent opacity={0.85} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  );
}

function Stream({ getWorld }: { getWorld: () => unknown }) {
  const mesh = useRef<THREE.Mesh>(null!);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const mid = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const f = world(getWorld).flow;
    mesh.current.visible = !!f && f.kind === 'water';
    if (!f || f.kind !== 'water') return;
    dir.set(f.to[0] - f.from[0], f.to[1] - f.from[1], f.to[2] - f.from[2]);
    const len = Math.max(0.01, dir.length());
    mid.set((f.from[0] + f.to[0]) / 2, (f.from[1] + f.to[1]) / 2, (f.from[2] + f.to[2]) / 2);
    mesh.current.position.copy(mid);
    mesh.current.quaternion.setFromUnitVectors(up, dir.normalize());
    mesh.current.scale.set(1, len, 1);
  });

  return (
    <mesh ref={mesh} visible={false}>
      <cylinderGeometry args={[0.012, 0.009, 1, 8]} />
      <meshStandardMaterial color="#8fd0f5" transparent opacity={0.75} />
    </mesh>
  );
}

function Effects({ getWorld }: { getWorld: () => unknown }) {
  const ids = useMemo(() => Object.keys(world(getWorld).trials), [getWorld]);
  return (
    <group>
      <Crystals getWorld={getWorld} />
      {ids.map((id) => (
        <DissolvedCloud key={id} id={id} getWorld={getWorld} />
      ))}
      <Stream getWorld={getWorld} />
    </group>
  );
}

// --- the room -----------------------------------------------------------------------

function Decor() {
  return (
    <group position={[0, 0, 0]}>
      {/* test tube rack */}
      <group position={[-1.38, 0, 0.5]}>
        <mesh position={[0, 0.03, 0]} castShadow>
          <boxGeometry args={[0.42, 0.06, 0.14]} />
          <meshStandardMaterial color="#b9835a" />
        </mesh>
        {[-0.15, -0.05, 0.05, 0.15].map((x, i) => (
          <mesh key={i} position={[x, 0.17, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.22, 10]} />
            <meshPhysicalMaterial color={['#a5d8ff', '#ffd6a5', '#d0f4de', '#e9d5ff'][i]} transparent opacity={0.6} />
          </mesh>
        ))}
      </group>
      {/* safety goggles */}
      <group position={[-1.38, 0.035, 0.1]}>
        {[-0.05, 0.05].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.04, 0.008, 6, 16]} />
            <meshStandardMaterial color="#2563eb" />
          </mesh>
        ))}
      </group>
      {/* conical flask */}
      <mesh position={[1.42, 0.12, -0.62]} castShadow>
        <coneGeometry args={[0.1, 0.24, 20, 1, true]} />
        <meshPhysicalMaterial color="#cfe9f5" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Environment() {
  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.95, 0]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#cbd5dc" roughness={0.9} />
      </mesh>
      {/* back wall */}
      <mesh position={[0, 1.2, -2.2]} receiveShadow>
        <planeGeometry args={[14, 4.5]} />
        <meshStandardMaterial color="#e8f1f5" roughness={1} />
      </mesh>
      {/* window glow */}
      <mesh position={[-2.2, 1.5, -2.18]}>
        <planeGeometry args={[1.8, 1.4]} />
        <meshBasicMaterial color="#e0f2fe" />
      </mesh>
      {/* shelf with bottles */}
      <mesh position={[1.9, 1.15, -2.05]}>
        <boxGeometry args={[2.2, 0.05, 0.3]} />
        <meshStandardMaterial color="#9a6b43" />
      </mesh>
      {[-0.8, -0.45, -0.1, 0.25, 0.6, 0.9].map((x, i) => (
        <mesh key={i} position={[1.9 + x, 1.34, -2.05]}>
          <cylinderGeometry args={[0.07, 0.07, 0.3, 14]} />
          <meshStandardMaterial color={['#fca5a5', '#fde68a', '#86efac', '#93c5fd', '#c4b5fd', '#fdba74'][i]} />
        </mesh>
      ))}
      {/* lab bench */}
      <mesh position={[0, -0.045, 0]} receiveShadow castShadow>
        <boxGeometry args={[3.5, 0.09, 1.75]} />
        <meshStandardMaterial color="#f1f5f7" roughness={0.45} />
      </mesh>
      <mesh position={[0, -0.095, 0]}>
        <boxGeometry args={[3.56, 0.02, 1.81]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {[-1.65, 1.65].flatMap((x) =>
        [-0.8, 0.8].map((z) => (
          <mesh key={`${x}${z}`} position={[x, -0.52, z]}>
            <boxGeometry args={[0.1, 0.85, 0.1]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
        ))
      )}
      <Decor />
    </group>
  );
}

const OBJECTS: Record<string, ComponentType<LabObjectRendererProps>> = {
  beaker: Beaker,
  cylinder: Cylinder,
  jug: Jug,
  sugar_jar: SugarJar,
  spoon: Spoon,
  thermometer: Thermometer,
  stopwatch: Stopwatch,
};

export const dissolvingKit: LabKit = {
  objects: OBJECTS,
  Effects,
  Environment,
};

/** Shared with other labs that need the same bench, beakers, labels and stopwatch. */
export { Beaker, Stopwatch, Tag, Environment as LabRoom };
