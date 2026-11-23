'use client';

/* eslint-disable react-hooks/immutability, react-hooks/refs -- this file drives an imperative three.js scene graph from useFrame; mutating refs and scene objects every frame is the intended pattern. */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

import type { LabKit } from '../kits/types';
import type { LabConfig, LabSimulation } from '../types';

/**
 * The reusable 3D laboratory: a table seen from a first-person camera, objects
 * the student can pick up with the mouse or a finger, and a loop that steps the
 * lab's simulation. Everything lab-specific arrives through `config`, `sim` and
 * `kit`; nothing here knows about sugar or water.
 *
 *  - Drag an object to carry it. It lifts off the table while held.
 *  - Mouse wheel (or the Tilt slider, or the arrow keys) tilts what you hold;
 *    with nothing held the wheel zooms.
 *  - Q / E turn the held object.
 *  - Drag the empty room to look around.
 *  - A short click on a clickable object (the stopwatch) presses it.
 */

export interface LabSceneHandle {
  zoom(delta: number): void;
  resetView(): void;
}

interface Props<W> {
  config: LabConfig;
  sim: LabSimulation<W>;
  kit: LabKit;
  getWorld: () => W;
  paused: boolean;
  speed: number;
  interactive: boolean;
}

const HOLD_PLANE_Y = 0.4;
const TARGET = new THREE.Vector3(0, 0.2, 0.05);

interface Cam {
  yaw: number;
  pitch: number;
  zoom: number;
}

function Rig({ cam }: { cam: React.MutableRefObject<Cam> }) {
  const { camera, size } = useThree();
  const current = useRef({ yaw: 0, pitch: 0.5, zoom: 1 });

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt / 0.09);
    const c = current.current;
    c.yaw += (cam.current.yaw - c.yaw) * k;
    c.pitch += (cam.current.pitch - c.pitch) * k;
    c.zoom += (cam.current.zoom - c.zoom) * k;
    // Narrow screens need to stand further back to keep the whole bench in view.
    const aspect = size.width / Math.max(1, size.height);
    const base = aspect < 1.2 ? 3.9 : aspect < 1.6 ? 3.1 : 2.55;
    const dist = base * c.zoom;
    camera.position.set(
      TARGET.x + dist * Math.sin(c.yaw) * Math.cos(c.pitch),
      TARGET.y + dist * Math.sin(c.pitch),
      TARGET.z + dist * Math.cos(c.yaw) * Math.cos(c.pitch)
    );
    camera.lookAt(TARGET);
  });
  return null;
}

function Stepper<W>({
  sim,
  getWorld,
  paused,
  speed,
}: {
  sim: LabSimulation<W>;
  getWorld: () => W;
  paused: boolean;
  speed: number;
}) {
  const state = useRef({ paused, speed });
  state.current = { paused, speed };
  useFrame((_, delta) => {
    if (state.current.paused) return;
    const real = Math.min(delta, 0.05);
    sim.step(getWorld(), real * state.current.speed, real);
  });
  return null;
}

function Zones({ config }: { config: LabConfig }) {
  return (
    <group>
      {config.zones.map((z, i) => (
        <group key={z.id} position={[z.position[0], 0.004, z.position[1]]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[z.radius, 40]} />
            <meshStandardMaterial color={i === 0 ? '#38bdf8' : '#fb923c'} transparent opacity={0.35} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
            <ringGeometry args={[z.radius - 0.015, z.radius, 40]} />
            <meshBasicMaterial color={i === 0 ? '#0284c7' : '#ea580c'} />
          </mesh>
          <Html position={[0, 0.01, z.radius + 0.1]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            <div
              style={{
                whiteSpace: 'nowrap',
                fontSize: 10,
                fontWeight: 700,
                color: '#0f172a',
                background: 'rgba(255,255,255,.8)',
                padding: '0 6px',
                borderRadius: 4,
              }}
            >
              {z.label}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

function Pose<W>({
  id,
  sim,
  getWorld,
  Renderer,
  onDown,
}: {
  id: string;
  sim: LabSimulation<W>;
  getWorld: () => W;
  Renderer: React.ComponentType<{ id: string; getWorld: () => unknown }>;
  onDown: (event: ThreeEvent<PointerEvent>, id: string) => void;
}) {
  const outer = useRef<THREE.Group>(null!);
  const inner = useRef<THREE.Group>(null!);
  const gl = useThree((s) => s.gl);

  useFrame(() => {
    const o = sim.objects(getWorld())[id];
    if (!o) return;
    outer.current.position.set(o.x, o.y, o.z);
    outer.current.rotation.y = (o.yaw * Math.PI) / 180;
    inner.current.rotation.z = (-o.tilt * Math.PI) / 180;
  });

  return (
    <group
      ref={outer}
      onPointerDown={(e) => onDown(e, id)}
      onPointerOver={() => (gl.domElement.style.cursor = 'grab')}
      onPointerOut={() => (gl.domElement.style.cursor = 'auto')}
    >
      <group ref={inner}>
        <Renderer id={id} getWorld={getWorld as () => unknown} />
      </group>
    </group>
  );
}

function Controls<W>({
  config,
  sim,
  kit,
  getWorld,
  interactive,
  cam,
}: {
  config: LabConfig;
  sim: LabSimulation<W>;
  kit: LabKit;
  getWorld: () => W;
  interactive: boolean;
  cam: React.MutableRefObject<Cam>;
}) {
  const { camera, gl } = useThree();
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -HOLD_PLANE_Y), []);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const drag = useRef<{
    mode: 'object' | 'click' | 'orbit';
    id?: string;
    ox: number;
    oz: number;
    sx: number;
    sy: number;
    moved: number;
    lx: number;
    ly: number;
  } | null>(null);
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;

  const pointOnPlane = useCallback(
    (clientX: number, clientY: number): THREE.Vector3 | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(plane, hit);
    },
    [camera, gl, plane, ray, hit]
  );

  const onMove = useCallback(
    (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      d.moved += Math.abs(e.clientX - d.lx) + Math.abs(e.clientY - d.ly);
      if (d.mode === 'object' && d.id) {
        const p = pointOnPlane(e.clientX, e.clientY);
        if (p) sim.moveHeld(getWorld(), p.x + d.ox, p.z + d.oz);
      } else if (d.mode === 'orbit') {
        cam.current.yaw = Math.max(-0.5, Math.min(0.5, cam.current.yaw - (e.clientX - d.lx) * 0.004));
        cam.current.pitch = Math.max(0.28, Math.min(0.85, cam.current.pitch + (e.clientY - d.ly) * 0.003));
      }
      d.lx = e.clientX;
      d.ly = e.clientY;
    },
    [cam, getWorld, pointOnPlane, sim]
  );

  const onUp = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    gl.domElement.style.cursor = 'auto';
    if (!d) return;
    if (d.mode === 'object') {
      sim.release(getWorld());
      // A tap that did not move anything is a click: the student asks what the object is.
      if (d.id && d.moved < 6) sim.click(getWorld(), d.id);
    }
    if (d.mode === 'click' && d.id && d.moved < 8) sim.click(getWorld(), d.id);
  }, [getWorld, gl, onMove, sim]);

  const begin = useCallback(
    (mode: 'object' | 'click' | 'orbit', e: PointerEvent, id?: string, ox = 0, oz = 0) => {
      drag.current = { mode, id, ox, oz, sx: e.clientX, sy: e.clientY, moved: 0, lx: e.clientX, ly: e.clientY };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [onMove, onUp]
  );

  const onObjectDown = useCallback(
    (event: ThreeEvent<PointerEvent>, id: string) => {
      if (!interactiveRef.current || drag.current) return;
      event.stopPropagation();
      const w = getWorld();
      const o = sim.objects(w)[id];
      if (!o) return;
      if (o.kind === 'stopwatch') {
        begin('click', event.nativeEvent, id);
        return;
      }
      if (!sim.grab(w, id)) return;
      const p = pointOnPlane(event.nativeEvent.clientX, event.nativeEvent.clientY);
      begin('object', event.nativeEvent, id, p ? o.x - p.x : 0, p ? o.z - p.z : 0);
      gl.domElement.style.cursor = 'grabbing';
    },
    [begin, getWorld, gl, pointOnPlane, sim]
  );

  const onRoomDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (drag.current) return;
      begin('orbit', event.nativeEvent);
    },
    [begin]
  );

  // Wheel and keyboard.
  useEffect(() => {
    const el = gl.domElement;
    const heldTilt = () => {
      const w = getWorld();
      const id = sim.snapshot(w).held;
      return id ? { id, tilt: sim.objects(w)[id].tilt } : null;
    };
    const onWheel = (e: WheelEvent) => {
      if (!interactiveRef.current) return;
      e.preventDefault();
      const held = heldTilt();
      if (held) sim.setTilt(getWorld(), held.tilt + (e.deltaY > 0 ? -4 : 4));
      else cam.current.zoom = Math.max(0.55, Math.min(1.3, cam.current.zoom + e.deltaY * 0.0008));
    };
    const onKey = (e: KeyboardEvent) => {
      if (!interactiveRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const key = e.key.toLowerCase();
      const w = getWorld();
      if (key === 'q') sim.rotateHeld(w, -12);
      else if (key === 'e') sim.rotateHeld(w, 12);
      else if (key === 'arrowup' || key === 'arrowdown') {
        const held = heldTilt();
        if (held) {
          e.preventDefault();
          sim.setTilt(w, held.tilt + (key === 'arrowup' ? 5 : -5));
        }
      } else if (key === 's') {
        const watch = Object.entries(sim.objects(w)).find(([, o]) => o.kind === 'stopwatch');
        if (watch) sim.click(w, watch[0]);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, [cam, getWorld, gl, sim]);

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    },
    [onMove, onUp]
  );

  // Development-only handle for browser QA: where an object is on screen, and the live world.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const target = window as unknown as { __virtualLab?: unknown };
    target.__virtualLab = {
      world: () => getWorld(),
      /** Runs the simulation forward without waiting (browser QA only). */
      advance: (seconds: number) => {
        for (let t = 0; t < seconds; t += 0.1) sim.step(getWorld(), 0.1, 0.1);
      },
      project: (id: string, dy = 0.15) => {
        const o = sim.objects(getWorld())[id];
        if (!o) return null;
        const v = new THREE.Vector3(o.x, o.y + dy, o.z).project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
      },
      projectPoint: (x: number, y: number, z: number) => {
        const v = new THREE.Vector3(x, y, z).project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
      },
    };
    return () => {
      delete target.__virtualLab;
    };
  }, [camera, getWorld, gl, sim]);

  const ids = useMemo(() => config.objects.map((o) => ({ id: o.id, kind: o.kind })), [config]);

  return (
    <>
      <group onPointerDown={onRoomDown}>{kit.Environment ? <kit.Environment /> : null}</group>
      <Zones config={config} />
      {ids.map(({ id, kind }) => {
        const Renderer = kit.objects[kind];
        return Renderer ? <Pose key={id} id={id} sim={sim} getWorld={getWorld} Renderer={Renderer} onDown={onObjectDown} /> : null;
      })}
      {kit.Effects ? <kit.Effects getWorld={getWorld as () => unknown} /> : null}
    </>
  );
}

function LabSceneInner<W>(props: Props<W>, ref: React.Ref<LabSceneHandle>) {
  const { config, sim, kit, getWorld, paused, speed, interactive } = props;
  const cam = useRef<Cam>({ yaw: 0, pitch: 0.5, zoom: 1 });

  useImperativeHandle(
    ref,
    () => ({
      zoom: (delta) => {
        cam.current.zoom = Math.max(0.55, Math.min(1.3, cam.current.zoom + delta));
      },
      resetView: () => {
        cam.current = { yaw: 0, pitch: 0.5, zoom: 1 };
      },
    }),
    []
  );

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ fov: 46, near: 0.1, far: 40, position: [0, 1.3, 2.6] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ touchAction: 'none', background: '#dbe7ee' }}
    >
      <color attach="background" args={['#dbe7ee']} />
      <hemisphereLight args={['#ffffff', '#9fb3bf', 0.85]} />
      <directionalLight
        position={[2.5, 4.5, 3]}
        intensity={1.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-2.2}
        shadow-camera-right={2.2}
        shadow-camera-top={2.2}
        shadow-camera-bottom={-2.2}
        shadow-bias={-0.0005}
      />
      <pointLight position={[-2, 2, 1.5]} intensity={0.6} color="#fff4e0" />
      <Rig cam={cam} />
      <Stepper sim={sim} getWorld={getWorld} paused={paused} speed={speed} />
      <Controls config={config} sim={sim} kit={kit} getWorld={getWorld} interactive={interactive} cam={cam} />
    </Canvas>
  );
}

export const LabScene = forwardRef(LabSceneInner) as <W>(
  props: Props<W> & { ref?: React.Ref<LabSceneHandle> }
) => React.ReactElement;
