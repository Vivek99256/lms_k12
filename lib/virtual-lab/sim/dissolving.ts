import type { LabConfig, LabEvent, LabSimulation, LabSnapshot } from '../types';

/**
 * Simulation for the dissolving lab. Pure TypeScript (no three.js): the world
 * is plain JSON so it can be saved, resumed and unit tested.
 *
 * Units: lab units. The table top is y = 0. A beaker is 0.42 high. Volumes are
 * in mL, sugar in grams, temperatures in degrees C, time in seconds.
 *
 * The model is deliberately simple but consistent, and it is NOT scripted:
 *  - every sugar crystal is a particle that falls, sinks and settles;
 *  - a settled crystal in water loses mass at a rate that depends on the water
 *    temperature, on how hard the spoon is stirring that beaker, and on how
 *    crowded the pile is (dm/dt = -k m^(2/3), surface-area limited);
 *  - sugar that never reaches water never dissolves;
 *  - stirring is measured from the actual circular motion of the spoon tip.
 */

export const ROOM_TEMP_C = 22;
/** Dissolving rate constant at 20 C (per second, on m^(2/3) in grams). */
export const K20 = 0.0131;
/** Rate roughly doubles for every 20 C. */
export const TEMP_DOUBLING_C = 20;
export const STIR_GAIN = 3;
export const CRYSTAL_MASS_G = 0.1;
const GRAVITY = 14;
const TABLE_X = 1.55;
const TABLE_Z = 0.75;
const HOLD_Y = 0.4;
/** Pourable containers are lifted higher so the tilted spout clears a beaker rim. */
const POUR_HOLD_Y = 0.8;

type Kind = 'beaker' | 'cylinder' | 'jug' | 'sugar_jar' | 'spoon' | 'thermometer' | 'stopwatch';

interface Geom {
  r: number;
  inner: number;
  h: number;
  floor: number;
  innerH: number;
  spout?: [number, number];
  accepts?: ('water' | 'sugar')[];
}

export const GEOM: Record<string, Geom> = {
  beaker: { r: 0.17, inner: 0.16, h: 0.42, floor: 0.02, innerH: 0.38, accepts: ['water', 'sugar'] },
  cylinder: { r: 0.07, inner: 0.062, h: 0.62, floor: 0.02, innerH: 0.56, spout: [0.07, 0.62], accepts: ['water'] },
  jug: { r: 0.2, inner: 0.19, h: 0.5, floor: 0.02, innerH: 0.44, spout: [0.2, 0.5], accepts: ['water'] },
  sugar_jar: { r: 0.17, inner: 0.16, h: 0.42, floor: 0.02, innerH: 0.38, spout: [0.17, 0.42], accepts: [] },
};

const isContainer = (kind: string) => kind in GEOM;
const isTool = (kind: string) => kind === 'spoon' || kind === 'thermometer';
const holdsWater = (kind: string) => kind === 'beaker' || kind === 'cylinder' || kind === 'jug';

export interface ObjState {
  id: string;
  kind: Kind | string;
  label: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  tilt: number;
  home: [number, number];
  restingIn: string | null;
  zone: string | null;
  capacityMl: number;
  waterMl: number;
  tempC: number;
  sugarG: number;
}

export interface Crystal {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  m: number;
  s: 'air' | 'sinking' | 'settled' | 'table' | 'gone';
  b: string | null;
}

export interface Trial {
  beakerId: string;
  sugarG: number;
  firstSugarAt: number | null;
  lastSugarAt: number | null;
  startedAt: number | null;
  waterMl: number | null;
  tempC: number | null;
  stirSeconds: number;
  stirIntensitySum: number;
  doneAt: number | null;
  dissolveSeconds: number | null;
}

interface StirState {
  prev: number | null;
  omega: number;
  intensity: number;
}

export interface DissolveWorld {
  time: number;
  rng: number;
  objects: Record<string, ObjState>;
  order: string[];
  crystals: Crystal[];
  dissolvedG: Record<string, number>;
  stir: Record<string, StirState>;
  trials: Record<string, Trial>;
  therm: { reading: number; inId: string | null; exposure: number };
  sw: { running: boolean; elapsed: number; everStarted: boolean };
  held: string | null;
  holdOffset: [number, number];
  flow: { kind: 'water' | 'sugar'; from: [number, number, number]; to: [number, number, number] } | null;
  stats: {
    peakCylinderMl: number;
    spilledMl: number;
    spilledSugarG: number;
    checkedTempC: Record<string, number>;
    waterAddedMl: Record<string, number>;
    sugarLandedG: Record<string, number>;
    stirSecondsTotal: Record<string, number>;
    grabs: Record<string, number>;
    dryDrops: number;
  };
  warnings: { id: string; text: string; until: number }[];
  events: LabEvent[];
  spillClock: number;
  carry: number;
  zones: LabConfig['zones'];
  seq: number;
}

// --- small helpers -----------------------------------------------------------

function rand(w: DissolveWorld): number {
  // mulberry32: deterministic, and its state is saved with the world.
  w.rng = (w.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(w.rng ^ (w.rng >>> 15), 1 | w.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

function emit(w: DissolveWorld, type: string, obj?: string, data?: LabEvent['data']) {
  w.events.push({ t: round1(w.time), type, obj, data });
  if (w.events.length > 200) w.events.splice(0, w.events.length - 200);
}

function warn(w: DissolveWorld, id: string, text: string, seconds = 7) {
  const existing = w.warnings.find((x) => x.id === id);
  if (existing) existing.until = w.time + seconds;
  else w.warnings.push({ id, text, until: w.time + seconds });
}

export function dissolveRate(tempC: number, stirIntensity: number): number {
  return K20 * Math.pow(2, (tempC - 20) / TEMP_DOUBLING_C) * (1 + STIR_GAIN * clamp(stirIntensity, 0, 1));
}

export function waterLevelY(o: ObjState): number {
  const g = GEOM[o.kind];
  if (!g || o.capacityMl <= 0) return o.y;
  return o.y + g.floor + clamp(o.waterMl / o.capacityMl, 0, 1) * g.innerH;
}

function spoutWorld(o: ObjState): [number, number, number] {
  const g = GEOM[o.kind];
  const [sx, sy] = g.spout ?? [g.r, g.h];
  const th = (o.tilt * Math.PI) / 180;
  const xr = sx * Math.cos(th) + sy * Math.sin(th);
  const yr = -sx * Math.sin(th) + sy * Math.cos(th);
  const yaw = (o.yaw * Math.PI) / 180;
  return [o.x + xr * Math.cos(yaw), o.y + yr, o.z - xr * Math.sin(yaw)];
}

// --- creation ----------------------------------------------------------------

export function createDissolveWorld(config: LabConfig): DissolveWorld {
  const objects: Record<string, ObjState> = {};
  const order: string[] = [];
  const trials: Record<string, Trial> = {};
  const stats: DissolveWorld['stats'] = {
    peakCylinderMl: 0,
    spilledMl: 0,
    spilledSugarG: 0,
    checkedTempC: {},
    waterAddedMl: {},
    sugarLandedG: {},
    stirSecondsTotal: {},
    grabs: {},
    dryDrops: 0,
  };

  for (const spec of config.objects) {
    const p = spec.props ?? {};
    objects[spec.id] = {
      id: spec.id,
      kind: spec.kind,
      label: spec.label,
      x: spec.position[0],
      y: 0,
      z: spec.position[1],
      yaw: spec.yaw ?? 0,
      tilt: 0,
      home: [spec.position[0], spec.position[1]],
      restingIn: null,
      zone: null,
      capacityMl: Number(p.capacityMl ?? 0),
      waterMl: Number(p.waterMl ?? 0),
      tempC: Number(p.tempC ?? ROOM_TEMP_C),
      sugarG: Number(p.sugarG ?? 0),
    };
    order.push(spec.id);
    if (spec.kind === 'beaker') {
      trials[spec.id] = {
        beakerId: spec.id,
        sugarG: 0,
        firstSugarAt: null,
        lastSugarAt: null,
        startedAt: null,
        waterMl: null,
        tempC: null,
        stirSeconds: 0,
        stirIntensitySum: 0,
        doneAt: null,
        dissolveSeconds: null,
      };
    }
  }

  return {
    time: 0,
    rng: 1234567,
    objects,
    order,
    crystals: [],
    dissolvedG: {},
    stir: {},
    trials,
    therm: { reading: ROOM_TEMP_C, inId: null, exposure: 0 },
    sw: { running: false, elapsed: 0, everStarted: false },
    held: null,
    holdOffset: [0, 0],
    flow: null,
    stats,
    warnings: [],
    events: [],
    spillClock: 0,
    carry: 0,
    zones: config.zones,
    seq: 0,
  };
}

// --- interaction ---------------------------------------------------------------

function containersWithWater(w: DissolveWorld): ObjState[] {
  return w.order.map((id) => w.objects[id]).filter((o) => holdsWater(o.kind));
}

/** The container (if any) that a tool tip at (x, z) is directly above. */
function containerUnder(w: DissolveWorld, x: number, z: number, exclude?: string): ObjState | null {
  let best: ObjState | null = null;
  let bestD = Infinity;
  for (const c of containersWithWater(w)) {
    if (c.id === exclude) continue;
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < GEOM[c.kind].inner * 0.85 && d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

export function grab(w: DissolveWorld, id: string): boolean {
  const o = w.objects[id];
  if (!o || o.kind === 'stopwatch' || w.held) return false;
  w.held = id;
  o.restingIn = null;
  o.tilt = 0;
  w.stats.grabs[id] = (w.stats.grabs[id] ?? 0) + 1;
  emit(w, 'grab', id);
  return true;
}

export function moveHeld(w: DissolveWorld, x: number, z: number): void {
  if (!w.held) return;
  const o = w.objects[w.held];
  const nx = clamp(x, -TABLE_X, TABLE_X);
  const nz = clamp(z, -TABLE_Z, TABLE_Z);
  const dx = nx - o.x;
  const dz = nz - o.z;
  o.x = nx;
  o.z = nz;

  if (isContainer(o.kind) && (dx !== 0 || dz !== 0)) {
    // Whatever is resting or settling inside travels with the container.
    for (const other of Object.values(w.objects)) {
      if (other.restingIn === o.id) {
        other.x += dx;
        other.z += dz;
      }
    }
    for (const c of w.crystals) {
      if (c.b === o.id && (c.s === 'settled' || c.s === 'sinking')) {
        c.x += dx;
        c.z += dz;
      }
    }
  }
}

export function setTilt(w: DissolveWorld, deg: number): void {
  if (!w.held) return;
  const o = w.objects[w.held];
  if (GEOM[o.kind]?.spout) o.tilt = clamp(deg, 0, 110);
}

export function rotateHeld(w: DissolveWorld, deg: number): void {
  if (!w.held) return;
  const o = w.objects[w.held];
  o.yaw = (((o.yaw + deg) % 360) + 360) % 360;
}

function separate(w: DissolveWorld, o: ObjState): void {
  if (!isContainer(o.kind)) return;
  for (let pass = 0; pass < 4; pass++) {
    for (const other of Object.values(w.objects)) {
      if (other.id === o.id || !isContainer(other.kind)) continue;
      const min = GEOM[o.kind].r + GEOM[other.kind].r + 0.02;
      const dx = o.x - other.x;
      const dz = o.z - other.z;
      const d = Math.hypot(dx, dz) || 0.001;
      if (d < min) {
        const push = (min - d) / d;
        o.x = clamp(o.x + dx * push, -TABLE_X, TABLE_X);
        o.z = clamp(o.z + dz * push, -TABLE_Z, TABLE_Z);
      }
    }
  }
}

export function release(w: DissolveWorld): void {
  if (!w.held) return;
  const o = w.objects[w.held];
  w.held = null;
  o.tilt = 0;
  w.flow = null;

  if (isTool(o.kind)) {
    const c = containerUnder(w, o.x, o.z);
    if (c) {
      o.restingIn = c.id;
      o.x = c.x + clamp(o.x - c.x, -GEOM[c.kind].inner * 0.5, GEOM[c.kind].inner * 0.5);
      o.z = c.z + clamp(o.z - c.z, -GEOM[c.kind].inner * 0.5, GEOM[c.kind].inner * 0.5);
      o.y = c.y + GEOM[c.kind].floor + 0.03;
    } else {
      o.y = 0;
    }
  } else {
    o.y = 0;
    separate(w, o);
    o.zone = null;
    if (o.kind === 'beaker') {
      for (const z of w.zones) {
        if (z.accepts.includes('beaker') && Math.hypot(o.x - z.position[0], o.z - z.position[1]) < z.radius) {
          o.x = z.position[0];
          o.z = z.position[1];
          o.zone = z.id;
          break;
        }
      }
    }
  }
  emit(w, 'release', o.id, { zone: o.zone, restingIn: o.restingIn });
}

export function click(w: DissolveWorld, id: string): void {
  const o = w.objects[id];
  if (!o || o.kind !== 'stopwatch') return;
  w.sw.running = !w.sw.running;
  if (w.sw.running) w.sw.everStarted = true;
  emit(w, 'stopwatch', id, { running: w.sw.running, elapsed: round1(w.sw.elapsed) });
}

export function resetStopwatch(w: DissolveWorld): void {
  w.sw.running = false;
  w.sw.elapsed = 0;
  emit(w, 'stopwatch_reset');
}

// --- stepping ------------------------------------------------------------------

function holdTargetY(w: DissolveWorld, o: ObjState): number {
  if (isTool(o.kind)) {
    const c = containerUnder(w, o.x, o.z);
    if (c) return c.y + GEOM[c.kind].floor + 0.04;
    return 0.55;
  }
  return GEOM[o.kind]?.spout ? POUR_HOLD_Y : HOLD_Y;
}

function mixWater(target: ObjState, source: ObjState, dv: number): void {
  const total = target.waterMl + dv;
  if (total <= 0) return;
  target.tempC = (target.waterMl * target.tempC + dv * source.tempC) / total;
  target.waterMl = total;
}

function findTarget(w: DissolveWorld, src: ObjState, spout: [number, number, number], what: 'water' | 'sugar') {
  let best: ObjState | null = null;
  let bestD = Infinity;
  for (const c of Object.values(w.objects)) {
    const g = GEOM[c.kind];
    if (!g || c.id === src.id || !g.accepts?.includes(what)) continue;
    const d = Math.hypot(spout[0] - c.x, spout[2] - c.z);
    if (d < g.inner * 0.9 && spout[1] > c.y + g.h * 0.45 && d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

function pour(w: DissolveWorld, src: ObjState, dt: number): void {
  const g = GEOM[src.kind];
  if (!g?.spout) return;
  const isSugar = src.kind === 'sugar_jar';
  const amount = isSugar ? src.sugarG : src.waterMl;
  const fill = isSugar ? src.sugarG / 120 : src.waterMl / Math.max(1, src.capacityMl);
  const threshold = (isSugar ? 80 : 75) - 45 * clamp(fill, 0, 1);
  if (amount <= 0 || src.tilt <= threshold) {
    w.flow = null;
    return;
  }

  const open = clamp((src.tilt - threshold) / 25, 0, 1);
  const spout = spoutWorld(src);

  if (!isSugar) {
    const want = 28 * open * dt;
    const target = findTarget(w, src, spout, 'water');
    const dv = Math.min(want, src.waterMl);
    if (target) {
      const room = Math.max(0, target.capacityMl - target.waterMl);
      const taken = Math.min(dv, room);
      src.waterMl -= dv;
      mixWater(target, src, taken);
      w.stats.waterAddedMl[target.id] = (w.stats.waterAddedMl[target.id] ?? 0) + taken;
      if (taken < dv) {
        w.stats.spilledMl += dv - taken;
        warn(w, 'overflow', `${target.label} is full. The extra water ran onto the table.`);
      }
      w.flow = { kind: 'water', from: spout, to: [target.x, waterLevelY(target), target.z] };
    } else {
      src.waterMl -= dv;
      w.stats.spilledMl += dv;
      w.flow = { kind: 'water', from: spout, to: [spout[0], 0, spout[2]] };
      w.spillClock += dt;
      if (w.spillClock > 0.4) {
        warn(w, 'spill_water', 'Water is spilling onto the table. Hold the spout over a beaker or the cylinder.');
        w.spillClock = 0;
      }
    }
    if (src.waterMl < 0.01) src.waterMl = 0;
    return;
  }

  // Sugar leaves the jar as real crystals.
  const grams = Math.min(1.6 * open * dt, src.sugarG);
  const total = w.carry + grams / CRYSTAL_MASS_G;
  const made = Math.floor(total);
  w.carry = total - made;

  for (let i = 0; i < made; i++) {
    w.crystals.push({
      x: spout[0] + (rand(w) - 0.5) * 0.03,
      y: spout[1],
      z: spout[2] + (rand(w) - 0.5) * 0.03,
      vx: (rand(w) - 0.5) * 0.08,
      vy: -0.2,
      vz: (rand(w) - 0.5) * 0.08,
      m: CRYSTAL_MASS_G * (0.8 + rand(w) * 0.4),
      s: 'air',
      b: null,
    });
  }
  src.sugarG = Math.max(0, src.sugarG - made * CRYSTAL_MASS_G);
  if (src.sugarG < 0.05) src.sugarG = 0;
  w.flow = made > 0 || grams > 0 ? { kind: 'sugar', from: spout, to: [spout[0], Math.max(0, spout[1] - 0.6), spout[2]] } : null;
}

function stepCrystals(w: DissolveWorld, dt: number): void {
  const beakers = Object.values(w.objects).filter((o) => o.kind === 'beaker');
  for (const c of w.crystals) {
    if (c.s === 'air') {
      c.vy -= GRAVITY * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;

      let landed = false;
      for (const b of beakers) {
        const g = GEOM.beaker;
        const d = Math.hypot(c.x - b.x, c.z - b.z);
        if (c.y < b.y + g.h) {
          if (d < g.inner) {
            c.b = b.id;
            const level = waterLevelY(b);
            if (b.waterMl > 1 && c.y <= level) {
              c.s = 'sinking';
              c.vx = c.vz = 0;
              c.vy = -0.32;
              markSugarIn(w, b, c);
            } else if (c.y <= b.y + g.floor + 0.01) {
              c.s = 'settled';
              c.y = b.y + g.floor + 0.012 + rand(w) * 0.01;
              markSugarIn(w, b, c);
              w.stats.dryDrops += 1;
              warn(w, 'dry_sugar', 'That sugar landed in an empty beaker, so nothing can dissolve it. It needs water.');
            }
            landed = true;
          } else if (d < g.r + 0.01) {
            // Hit the glass wall from above: bounce it off the rim.
            c.vx = (c.x - b.x) * 0.8;
            c.vz = (c.z - b.z) * 0.8;
            c.y = b.y + g.h + 0.01;
          }
        }
        if (landed) break;
      }
      if (!landed && c.y <= 0) {
        c.s = 'table';
        c.y = 0.005;
        w.stats.spilledSugarG += c.m;
        warn(w, 'spill_sugar', 'Sugar fell onto the table. Hold the container directly above the beaker.');
      }
    } else if (c.s === 'sinking' && c.b) {
      const b = w.objects[c.b];
      c.y += c.vy * dt;
      const floorY = b.y + GEOM.beaker.floor + 0.012 + ((c.m * 997) % 1) * 0.012;
      const lim = GEOM.beaker.inner * 0.9;
      const dx = c.x - b.x;
      const dz = c.z - b.z;
      const dd = Math.hypot(dx, dz);
      if (dd > lim) {
        c.x = b.x + (dx / dd) * lim;
        c.z = b.z + (dz / dd) * lim;
      }
      if (c.y <= floorY) {
        c.y = floorY;
        c.s = 'settled';
      }
    }
  }
}

function markSugarIn(w: DissolveWorld, b: ObjState, c: Crystal): void {
  const t = w.trials[b.id];
  w.stats.sugarLandedG[b.id] = (w.stats.sugarLandedG[b.id] ?? 0) + c.m;
  t.sugarG += c.m;
  if (t.firstSugarAt === null) {
    t.firstSugarAt = w.time;
    emit(w, 'sugar_added', b.id, { waterMl: Math.round(b.waterMl), tempC: round1(b.tempC) });
  }
  t.lastSugarAt = w.time;
  t.doneAt = null;
  t.dissolveSeconds = null;
}

function stepStirring(w: DissolveWorld, dt: number, realDt: number): void {
  const spoon = Object.values(w.objects).find((o) => o.kind === 'spoon');
  for (const c of containersWithWater(w)) {
    const s = (w.stir[c.id] ??= { prev: null, omega: 0, intensity: 0 });
    const g = GEOM[c.kind];
    let active = false;
    if (spoon && w.held === spoon.id && c.waterMl > 10) {
      const dist = Math.hypot(spoon.x - c.x, spoon.z - c.z);
      const inWater = dist < g.inner * 0.92 && spoon.y < waterLevelY(c) - 0.005;
      if (inWater && dist > 0.02) {
        active = true;
        const ang = Math.atan2(spoon.z - c.z, spoon.x - c.x);
        if (s.prev !== null && realDt > 0) {
          let d = ang - s.prev;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          s.omega = s.omega * 0.85 + (d / realDt) * 0.15;
        }
        s.prev = ang;
      }
    }
    if (!active) {
      s.prev = null;
      s.omega *= Math.exp(-realDt / 0.15);
    }
    const target = active ? clamp(Math.abs(s.omega) / 4.5, 0, 1) : 0;
    const tau = active ? 0.3 : 0.9;
    s.intensity += (target - s.intensity) * (1 - Math.exp(-realDt / tau));
    if (s.intensity < 0.001) s.intensity = 0;

    if (c.kind === 'beaker') {
      const t = w.trials[c.id];
      if (s.intensity > 0.15) {
        w.stats.stirSecondsTotal[c.id] = (w.stats.stirSecondsTotal[c.id] ?? 0) + dt;
        if (t.firstSugarAt !== null && t.doneAt === null) {
          t.stirSeconds += dt;
          t.stirIntensitySum += s.intensity * dt;
        }
      }
    }
  }
}

function stepThermometer(w: DissolveWorld, dt: number, realDt: number): void {
  const th = Object.values(w.objects).find((o) => o.kind === 'thermometer');
  if (!th) return;
  let inside: ObjState | null = null;
  const c = w.held === th.id ? containerUnder(w, th.x, th.z) : th.restingIn ? w.objects[th.restingIn] : null;
  if (c && c.waterMl > 10 && th.y < waterLevelY(c) - 0.005) inside = c;

  if (inside) {
    if (w.therm.inId !== inside.id) {
      w.therm.inId = inside.id;
      w.therm.exposure = 0;
    }
    w.therm.exposure += realDt;
    w.therm.reading += (inside.tempC - w.therm.reading) * (1 - Math.exp(-realDt / 1.4));
    if (w.therm.exposure > 2.5 && Math.abs(w.therm.reading - inside.tempC) < 0.6) {
      const v = Math.round(w.therm.reading * 2) / 2;
      if (w.stats.checkedTempC[inside.id] !== v) {
        w.stats.checkedTempC[inside.id] = v;
        emit(w, 'temp_read', inside.id, { tempC: v });
      }
    }
  } else {
    w.therm.inId = null;
    w.therm.exposure = 0;
    w.therm.reading += (ROOM_TEMP_C - w.therm.reading) * (1 - Math.exp(-realDt / 10));
  }
  void dt;
}

function stepDissolving(w: DissolveWorld, dt: number): void {
  for (const c of w.crystals) {
    if (c.s !== 'settled' || !c.b) continue;
    const b = w.objects[c.b];
    if (b.waterMl <= 5) continue;
    const t = w.trials[b.id];
    if (t.startedAt === null) {
      t.startedAt = w.time;
      t.waterMl = Math.round(b.waterMl);
      t.tempC = round1(b.tempC);
      emit(w, 'dissolving_started', b.id, { tempC: t.tempC, waterMl: t.waterMl });
    }
  }

  const settledCount: Record<string, number> = {};
  for (const c of w.crystals) if (c.s === 'settled' && c.b) settledCount[c.b] = (settledCount[c.b] ?? 0) + 1;

  for (const c of w.crystals) {
    if (c.s !== 'settled' || !c.b) continue;
    const b = w.objects[c.b];
    if (b.waterMl <= 5) continue;
    const intensity = w.stir[b.id]?.intensity ?? 0;
    const crowd = 1 / (1 + (settledCount[b.id] ?? 0) / 60);
    // Saturation: a solution cannot take more than it can hold.
    const capacityG = b.waterMl * (1.8 + 0.01 * (b.tempC - 20));
    if ((w.dissolvedG[b.id] ?? 0) >= capacityG) continue;

    const k = dissolveRate(b.tempC, intensity) * crowd;
    const loss = k * Math.pow(Math.max(c.m, 1e-6), 2 / 3) * dt;
    const taken = Math.min(c.m, loss);
    c.m -= taken;
    w.dissolvedG[b.id] = (w.dissolvedG[b.id] ?? 0) + taken;
    if (c.m < 0.002) {
      w.dissolvedG[b.id] += c.m;
      c.m = 0;
      c.s = 'gone';
    }
  }

  if (w.crystals.length > 400 && w.crystals.some((c) => c.s === 'gone')) {
    w.crystals = w.crystals.filter((c) => c.s !== 'gone');
  }

  // Trials finish when the last crystal in that beaker is gone.
  for (const id of Object.keys(w.trials)) {
    const t = w.trials[id];
    const b = w.objects[id];
    if (t.firstSugarAt === null || t.startedAt === null || t.doneAt !== null || b.waterMl <= 5) continue;
    const pending = w.crystals.some((c) => c.s === 'air' || (c.b === id && (c.s === 'sinking' || c.s === 'settled')));
    if (!pending && w.time - (t.lastSugarAt ?? 0) > 0.5) {
      t.doneAt = w.time;
      t.dissolveSeconds = round1(w.time - t.startedAt);
      emit(w, 'dissolved', id, { seconds: t.dissolveSeconds, tempC: t.tempC });
    }
  }
}

function stepFairWarnings(w: DissolveWorld): void {
  const beakers = Object.keys(w.trials);
  if (beakers.length !== 2) return;
  const [a, b] = beakers.map((id) => w.trials[id]);
  if (a.sugarG > 0.3 && b.sugarG > 0.3) {
    if (Math.abs(a.sugarG - b.sugarG) > 1.5) {
      warn(w, 'unequal_sugar', 'The two beakers have different amounts of sugar, so this is not a fair test.', 4);
    }
  }
}

export function step(w: DissolveWorld, dt: number, realDt: number): void {
  const h = Math.min(dt, 0.05);
  let remaining = dt;
  // Sub-step so fast-forward stays stable.
  while (remaining > 1e-6) {
    const d = Math.min(h, remaining);
    remaining -= d;
    w.time += d;

    if (w.sw.running) w.sw.elapsed += d;

    for (const c of containersWithWater(w)) {
      if (c.waterMl > 0) c.tempC += (ROOM_TEMP_C - c.tempC) * (d / 900);
    }
    if (w.held) {
      const o = w.objects[w.held];
      const ty = holdTargetY(w, o);
      o.y += (ty - o.y) * (1 - Math.exp(-realDt / 0.07));
      if (GEOM[o.kind]?.spout) pour(w, o, d);
    } else {
      w.flow = null;
    }
    stepCrystals(w, d);
    stepStirring(w, d, realDt * (d / Math.max(dt, 1e-9)));
    stepDissolving(w, d);
  }
  stepThermometer(w, dt, realDt);
  stepFairWarnings(w);

  const cyl = Object.values(w.objects).find((o) => o.kind === 'cylinder');
  if (cyl) w.stats.peakCylinderMl = Math.max(w.stats.peakCylinderMl, cyl.waterMl);
  w.warnings = w.warnings.filter((x) => x.until > w.time);
}

// --- reading the world -----------------------------------------------------------

export interface FairTest {
  ready: boolean;
  checks: { id: string; ok: boolean; text: string }[];
  fair: boolean;
}

/** Objective checks over the two trials. Used on screen and repeated on the server. */
export function assessFairTest(trials: Trial[]): FairTest {
  const done = trials.filter((t) => t.doneAt !== null && t.tempC !== null && t.waterMl !== null);
  if (done.length < 2) return { ready: false, checks: [], fair: false };
  const [a, b] = done;
  const checks = [
    { id: 'temp', ok: Math.abs((a.tempC ?? 0) - (b.tempC ?? 0)) >= 15, text: 'The two beakers had clearly different water temperatures (the variable you change).' },
    { id: 'water', ok: Math.abs((a.waterMl ?? 0) - (b.waterMl ?? 0)) <= 15, text: 'Both beakers had about the same amount of water.' },
    { id: 'sugar', ok: Math.abs(a.sugarG - b.sugarG) <= 1.5, text: 'Both beakers got about the same amount of sugar.' },
    {
      id: 'stir',
      ok:
        Math.max(a.stirSeconds, b.stirSeconds) <= 0.01 ||
        (Math.min(a.stirSeconds, b.stirSeconds) > 0 &&
          Math.abs(a.stirIntensitySum / Math.max(a.stirSeconds, 1e-6) - b.stirIntensitySum / Math.max(b.stirSeconds, 1e-6)) < 0.35 &&
          Math.min(a.stirSeconds, b.stirSeconds) / Math.max(a.stirSeconds, b.stirSeconds) >= 0.5),
      text: 'Both beakers were stirred in a similar way (or neither was).',
    },
  ];
  return { ready: true, checks, fair: checks.every((c) => c.ok) };
}

function tasks(w: DissolveWorld): Record<string, boolean> {
  const beakers = Object.keys(w.trials).map((id) => w.objects[id]);
  const both = (fn: (o: ObjState) => boolean) => beakers.length >= 2 && beakers.every(fn);
  return {
    measure: w.stats.peakCylinderMl >= 40,
    waterBoth: both((b) => b.waterMl >= 60),
    tempBoth: both((b) => w.stats.checkedTempC[b.id] !== undefined),
    sugarBoth: both((b) => (w.stats.sugarLandedG[b.id] ?? 0) >= 2),
    stopwatch: w.sw.everStarted,
    stirBoth: both((b) => (w.stats.stirSecondsTotal[b.id] ?? 0) >= 4),
    observe: both((b) => w.trials[b.id].doneAt !== null),
  };
}

export function snapshot(w: DissolveWorld, config: LabConfig): LabSnapshot {
  const done = tasks(w);
  const next = config.tasks.find((t) => !done[t.id]) ?? null;
  const held = w.held ? w.objects[w.held] : null;

  const readouts: LabSnapshot['readouts'] = [];
  for (const o of w.order.map((id) => w.objects[id])) {
    if (o.kind === 'beaker' || o.kind === 'cylinder') {
      readouts.push({ id: o.id, label: o.label, value: `${Math.round(o.waterMl)} mL` });
    } else if (o.kind === 'sugar_jar') {
      readouts.push({ id: o.id, label: o.label, value: `${Math.round(o.sugarG * 10) / 10} g left` });
    }
  }
  const therm = w.objects.thermometer;
  if (therm) {
    const inside = w.therm.inId ? w.objects[w.therm.inId] : null;
    readouts.push({
      id: 'thermometer',
      label: inside ? `Thermometer in ${inside.label}` : 'Thermometer',
      value: `${(Math.round(w.therm.reading * 2) / 2).toFixed(1)} °C`,
    });
  }

  let hint: string | null = next ? next.hint : 'You have finished the experiment. Go on to compare your results.';
  if (held && GEOM[held.kind]?.spout && held.tilt === 0) {
    hint = 'Hold it over a container, then tilt it: scroll the mouse wheel or use the Tilt slider.';
  } else if (held && isTool(held.kind)) {
    hint = held.kind === 'spoon' ? 'Lower the spoon into a beaker and move it round in circles.' : 'Lower the thermometer into the water and wait for the reading to settle.';
  }

  const beakers = Object.keys(w.trials).map((id) => w.objects[id]);
  const setupReady = beakers.length >= 2 && beakers.every((b) => b.zone !== null) && new Set(beakers.map((b) => b.zone)).size === beakers.length;

  const cmp = assessFairTest(Object.values(w.trials));
  return {
    time: w.time,
    held: w.held,
    heldLabel: held?.label ?? null,
    tilt: held?.tilt ?? 0,
    heldCanTilt: !!held && !!GEOM[held.kind]?.spout,
    tasksDone: done,
    nextTask: next?.id ?? null,
    readouts,
    hint,
    warnings: w.warnings.map((x) => x.text),
    stopwatch: { running: w.sw.running, elapsed: w.sw.elapsed },
    trials: w.trials,
    stats: w.stats as unknown as Record<string, unknown>,
    setupReady,
    comparable: cmp.ready,
  };
}

export function drainEvents(w: DissolveWorld): LabEvent[] {
  const out = w.events;
  w.events = [];
  return out;
}

/** Rebuild a saved world on top of a fresh one, ignoring anything malformed. */
export function restoreDissolveWorld(config: LabConfig, saved: unknown): DissolveWorld {
  const fresh = createDissolveWorld(config);
  if (!saved || typeof saved !== 'object') return fresh;
  const s = saved as Partial<DissolveWorld>;
  try {
    for (const id of Object.keys(fresh.objects)) {
      const o = (s.objects as Record<string, Partial<ObjState>> | undefined)?.[id];
      if (o) Object.assign(fresh.objects[id], o, { tilt: 0 });
    }
    if (Array.isArray(s.crystals)) fresh.crystals = s.crystals.slice(0, 600) as Crystal[];
    if (s.trials) for (const id of Object.keys(fresh.trials)) if (s.trials[id]) Object.assign(fresh.trials[id], s.trials[id]);
    if (s.dissolvedG) fresh.dissolvedG = s.dissolvedG;
    if (s.stats) fresh.stats = { ...fresh.stats, ...s.stats };
    if (s.sw) fresh.sw = { ...fresh.sw, ...s.sw, running: false };
    if (typeof s.time === 'number') fresh.time = s.time;
    if (typeof s.rng === 'number') fresh.rng = s.rng;
    if (s.therm) fresh.therm = { ...fresh.therm, ...s.therm, inId: null, exposure: 0 };
  } catch {
    return createDissolveWorld(config);
  }
  fresh.held = null;
  return fresh;
}

export function createDissolvingSimulation(config: LabConfig): LabSimulation<DissolveWorld> {
  return {
    create: () => createDissolveWorld(config),
    step,
    grab,
    release,
    moveHeld,
    setTilt,
    rotateHeld,
    click,
    act: (w, action) => {
      if (action === 'stopwatch_reset') resetStopwatch(w);
    },
    snapshot: (w) => snapshot(w, config),
    objects: (w) => w.objects,
    restore: (c, saved) => restoreDissolveWorld(c, saved),
    drainEvents,
  };
}
