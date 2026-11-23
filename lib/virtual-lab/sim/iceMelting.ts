import type { LabConfig, LabEvent, LabSimulation, LabSnapshot } from '../types';

/**
 * Simulation for the ice-melting mission: "Does temperature affect how fast ice melts?"
 * Pure TypeScript with a JSON-able world, like the dissolving lab, so it can be saved, resumed and tested.
 *
 * Units: lab units. The bench top is y = 0. Mass in grams, temperature in degrees C, time in seconds.
 *
 * The student sets up a fair test with their own hands: each beaker goes in its own place (cool or warm),
 * one identical ice cube goes into each beaker, and each thermometer stands in the same place as its
 * beaker. Pressing start melts the cubes. How fast depends only on the temperature of the place the beaker
 * is in: dm/dt = -k * T * m^(2/3) (a cube loses mass through its surface, so a smaller cube loses it more
 * slowly). All numbers are SIMULATED and the screens say so.
 */

export const COOL_TEMP_C = 10;
export const WARM_TEMP_C = 32;
export const ROOM_TEMP_C = 22;
export const ICE_MASS_G = 20;
/** Chosen so a 20 g cube takes about 4 minutes in the cool place and about 75 s in the warm place. */
export const MELT_K = 0.003393;
const GONE_G = 0.2;
const TABLE_X = 1.55;
const TABLE_Z = 0.75;
const BEAKER = { r: 0.17, inner: 0.16, h: 0.42, floor: 0.02 };

interface IceObj {
  id: string;
  kind: string;
  label: string;
  info: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  tilt: number;
  home: [number, number];
  zone: string | null;
  capacityMl: number;
  waterMl: number;
  tempC: number;
  sugarG: number;
  /** Ice cube: grams left, and the beaker it is in. */
  mass: number;
  inBeaker: string | null;
  /** Thermometer: what it shows now, and the place it is meant to stand in. */
  reading: number;
  expectZone: string | null;
}

export interface IceTrial {
  beakerId: string;
  env: 'cool' | 'warm' | null;
  envTempC: number | null;
  startedAt: number | null;
  meltSeconds: number | null;
  doneAt: number | null;
}

export interface IceWorld {
  time: number;
  objects: Record<string, IceObj>;
  order: string[];
  held: string | null;
  holdOffset: [number, number];
  flow: null;
  started: boolean;
  trials: Record<string, IceTrial>;
  sw: { running: boolean; elapsed: number; everStarted: boolean };
  stir: Record<string, { intensity: number }>;
  dissolvedG: Record<string, number>;
  crystals: never[];
  therm: { reading: number };
  stats: {
    wrong: Record<string, number>;
    grabs: Record<string, number>;
    placedOk: Record<string, boolean>;
    firstTrySetup: boolean | null;
    clicks: Record<string, number>;
  };
  warnings: { id: string; text: string; until: number }[];
  good: { id: string; text: string; until: number }[];
  info: { label: string; text: string } | null;
  events: LabEvent[];
  zones: LabConfig['zones'];
  /** Real seconds, so messages fade even while the simulation is paused or not started. */
  clock: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

function emit(w: IceWorld, type: string, obj?: string, data?: LabEvent['data']) {
  w.events.push({ t: round1(w.time), type, obj, data });
  if (w.events.length > 200) w.events.splice(0, w.events.length - 200);
}

function warn(w: IceWorld, id: string, text: string, seconds = 8) {
  w.stats.wrong[id] = (w.stats.wrong[id] ?? 0) + 1;
  const existing = w.warnings.find((x) => x.id === id);
  if (existing) existing.until = w.clock + seconds;
  else w.warnings.push({ id, text, until: w.clock + seconds });
  w.good = w.good.filter((g) => g.id !== id);
}

function good(w: IceWorld, id: string, text: string, seconds = 5) {
  w.warnings = w.warnings.filter((x) => x.id !== id);
  const existing = w.good.find((g) => g.id === id);
  if (existing) existing.until = w.clock + seconds;
  else w.good.push({ id, text, until: w.clock + seconds });
}

const zoneTemp = (zone: string | null) => (zone === 'cool' ? COOL_TEMP_C : zone === 'warm' ? WARM_TEMP_C : ROOM_TEMP_C);

function zoneAt(w: IceWorld, x: number, z: number): string | null {
  for (const zn of w.zones) {
    if (Math.hypot(x - zn.position[0], z - zn.position[1]) <= zn.radius) return zn.id;
  }
  return null;
}

const objs = (w: IceWorld, kind: string) => w.order.map((id) => w.objects[id]).filter((o) => o.kind === kind);

export function createIceWorld(config: LabConfig): IceWorld {
  const objects: Record<string, IceObj> = {};
  const order: string[] = [];
  const trials: Record<string, IceTrial> = {};

  for (const spec of config.objects) {
    const p = spec.props ?? {};
    objects[spec.id] = {
      id: spec.id,
      kind: spec.kind,
      label: spec.label,
      info: spec.info ?? '',
      x: spec.position[0],
      y: 0,
      z: spec.position[1],
      yaw: spec.yaw ?? 0,
      tilt: 0,
      home: [spec.position[0], spec.position[1]],
      zone: null,
      capacityMl: Number(p.capacityMl ?? 0),
      waterMl: 0,
      tempC: ROOM_TEMP_C,
      sugarG: 0,
      mass: spec.kind === 'ice_cube' ? ICE_MASS_G : 0,
      inBeaker: null,
      reading: ROOM_TEMP_C,
      expectZone: typeof p.expectZone === 'string' ? p.expectZone : null,
    };
    order.push(spec.id);
    if (spec.kind === 'beaker') {
      trials[spec.id] = { beakerId: spec.id, env: null, envTempC: null, startedAt: null, meltSeconds: null, doneAt: null };
    }
  }

  return {
    time: 0, objects, order, held: null, holdOffset: [0, 0], flow: null, started: false, trials,
    sw: { running: false, elapsed: 0, everStarted: false },
    stir: {}, dissolvedG: {}, crystals: [], therm: { reading: ROOM_TEMP_C },
    stats: { wrong: {}, grabs: {}, placedOk: {}, firstTrySetup: null, clicks: {} },
    warnings: [], good: [], info: null, events: [], zones: config.zones, clock: 0,
  };
}

// --- interaction -------------------------------------------------------------------

/** An ice cube in a beaker rests on the bottom: its y is the height of its underside. */
function cubeY(): number {
  return BEAKER.floor + 0.004;
}

export function grab(w: IceWorld, id: string): boolean {
  const o = w.objects[id];
  if (!o || o.kind === 'stopwatch' || w.held || w.started) return false;
  w.held = id;
  o.tilt = 0;
  if (o.kind === 'ice_cube') o.inBeaker = null;
  w.stats.grabs[id] = (w.stats.grabs[id] ?? 0) + 1;
  emit(w, 'grab', id);
  return true;
}

export function moveHeld(w: IceWorld, x: number, z: number): void {
  if (!w.held) return;
  const o = w.objects[w.held];
  const nx = clamp(x, -TABLE_X, TABLE_X);
  const nz = clamp(z, -TABLE_Z, TABLE_Z);
  const dx = nx - o.x;
  const dz = nz - o.z;
  o.x = nx;
  o.z = nz;
  if (o.kind === 'beaker') {
    // An ice cube in the beaker travels with it.
    for (const c of objs(w, 'ice_cube')) {
      if (c.inBeaker === o.id) {
        c.x += dx;
        c.z += dz;
      }
    }
  }
}

export function setTilt(): void {}

export function rotateHeld(w: IceWorld, deg: number): void {
  if (!w.held) return;
  const o = w.objects[w.held];
  o.yaw = (((o.yaw + deg) % 360) + 360) % 360;
}

const expectedBeakerZone = (beaker: IceObj) => (beaker.id === 'beakerA' ? 'cool' : beaker.id === 'beakerB' ? 'warm' : null);
const placeName = (zone: string | null) => (zone === 'cool' ? 'the cool place' : zone === 'warm' ? 'the warm place' : 'its place');

export function release(w: IceWorld): void {
  if (!w.held) return;
  const o = w.objects[w.held];
  w.held = null;
  o.tilt = 0;

  if (o.kind === 'beaker') {
    o.y = 0;
    o.zone = zoneAt(w, o.x, o.z);
    const want = expectedBeakerZone(o);
    const name = o.label;
    if (o.zone === null) {
      warn(w, `beaker_${o.id}`, `${name} is not in either place yet. Put it in ${placeName(want)}.`);
    } else if (want && o.zone !== want) {
      warn(w, `beaker_${o.id}`, `${name} belongs in ${placeName(want)}, not ${placeName(o.zone)}.`);
    } else {
      good(w, `beaker_${o.id}`, `${name} is in ${placeName(o.zone)}. Correct!`);
      w.stats.placedOk[o.id] = true;
    }
    // keep the cubes with it and keep beakers from overlapping
    for (const other of objs(w, 'beaker')) {
      if (other.id === o.id) continue;
      const min = BEAKER.r * 2 + 0.03;
      const dx = o.x - other.x;
      const dz = o.z - other.z;
      const d = Math.hypot(dx, dz) || 0.001;
      if (d < min) {
        const push = (min - d) / d;
        const ox = o.x;
        const oz = o.z;
        o.x = clamp(o.x + dx * push, -TABLE_X, TABLE_X);
        o.z = clamp(o.z + dz * push, -TABLE_Z, TABLE_Z);
        for (const c of objs(w, 'ice_cube')) if (c.inBeaker === o.id) { c.x += o.x - ox; c.z += o.z - oz; }
      }
    }
    o.zone = zoneAt(w, o.x, o.z);
  } else if (o.kind === 'ice_cube') {
    let target: IceObj | null = null;
    for (const b of objs(w, 'beaker')) {
      if (Math.hypot(o.x - b.x, o.z - b.z) < BEAKER.inner * 0.9) target = b;
    }
    const taken = target ? objs(w, 'ice_cube').some((c) => c.id !== o.id && c.inBeaker === target!.id) : false;
    if (target && !taken) {
      o.inBeaker = target.id;
      o.x = target.x;
      o.z = target.z;
      o.y = cubeY();
      good(w, `ice_${o.id}`, `An ice cube is in ${target.label}.`);
      w.stats.placedOk[o.id] = true;
    } else if (target && taken) {
      o.inBeaker = null;
      o.y = 0;
      o.x = target.x + BEAKER.r + 0.12;
      warn(w, `ice_${o.id}`, `${target.label} already has an ice cube. Each beaker gets one.`);
    } else {
      o.inBeaker = null;
      o.y = 0;
      warn(w, `ice_${o.id}`, 'The ice cube is on the bench. Drop it into a beaker.');
    }
  } else if (o.kind === 'ice_thermometer') {
    o.y = 0;
    o.zone = zoneAt(w, o.x, o.z);
    if (o.zone === null) {
      warn(w, `thermo_${o.id}`, `${o.label} is not in either place. Stand it in ${placeName(o.expectZone)}.`);
    } else if (o.expectZone && o.zone !== o.expectZone) {
      warn(w, `thermo_${o.id}`, `${o.label} should be in ${placeName(o.expectZone)}, next to its beaker.`);
    } else {
      good(w, `thermo_${o.id}`, `${o.label} is in ${placeName(o.zone)}. Correct!`);
      w.stats.placedOk[o.id] = true;
    }
  } else {
    o.y = 0;
  }
  emit(w, 'release', o.id, { zone: o.zone, inBeaker: o.inBeaker });
}

export function click(w: IceWorld, id: string): void {
  const o = w.objects[id];
  if (!o) return;
  w.stats.clicks[id] = (w.stats.clicks[id] ?? 0) + 1;
  if (o.info) w.info = { label: o.label, text: o.info };
  if (o.kind === 'stopwatch' && w.started) {
    w.sw.running = !w.sw.running;
    emit(w, 'stopwatch', id, { running: w.sw.running, elapsed: round1(w.sw.elapsed) });
  }
}

function setupMissing(w: IceWorld): string | null {
  const a = w.objects.beakerA;
  const b = w.objects.beakerB;
  if (!a || !b) return null;
  if (a.zone !== 'cool') return 'Drag Beaker A into the cool place (the blue circle).';
  if (b.zone !== 'warm') return 'Drag Beaker B into the warm place (the orange circle).';
  const cubes = objs(w, 'ice_cube');
  if (!cubes.some((c) => c.inBeaker === 'beakerA')) return 'Drop an ice cube into Beaker A.';
  if (!cubes.some((c) => c.inBeaker === 'beakerB')) return 'Drop an ice cube into Beaker B.';
  const ta = w.objects.thermoA;
  const tb = w.objects.thermoB;
  if (ta && ta.zone !== 'cool') return 'Stand Thermometer A in the cool place, next to Beaker A.';
  if (tb && tb.zone !== 'warm') return 'Stand Thermometer B in the warm place, next to Beaker B.';
  return null;
}

export function act(w: IceWorld, action: string): void {
  if (action === 'close_info') {
    w.info = null;
  } else if (action === 'stopwatch_reset') {
    w.sw.running = false;
    w.sw.elapsed = 0;
    emit(w, 'stopwatch_reset');
  } else if (action === 'start' && !w.started && setupMissing(w) === null) {
    w.started = true;
    w.sw = { running: true, elapsed: 0, everStarted: true };
    const wrong = Object.values(w.stats.wrong).reduce((n, v) => n + v, 0);
    w.stats.firstTrySetup = wrong === 0;
    for (const id of Object.keys(w.trials)) {
      const b = w.objects[id];
      const t = w.trials[id];
      t.env = b.zone === 'cool' ? 'cool' : b.zone === 'warm' ? 'warm' : null;
      t.envTempC = zoneTemp(b.zone);
      t.startedAt = w.time;
    }
    emit(w, 'start', undefined, { firstTry: w.stats.firstTrySetup });
  }
}

// --- stepping --------------------------------------------------------------------------

export function step(w: IceWorld, dt: number, realDt: number): void {
  w.clock += realDt;
  w.warnings = w.warnings.filter((x) => x.until > w.clock);
  w.good = w.good.filter((x) => x.until > w.clock);

  // A held object lifts off the bench.
  if (w.held) {
    const o = w.objects[w.held];
    const target = o.kind === 'ice_cube' ? 0.6 : 0.4;
    o.y += (target - o.y) * (1 - Math.exp(-realDt / 0.07));
  }

  // Thermometers always read the place they stand in.
  for (const t of objs(w, 'ice_thermometer')) {
    const goal = w.held === t.id ? ROOM_TEMP_C : zoneTemp(t.zone);
    t.reading += (goal - t.reading) * (1 - Math.exp(-realDt / 1.5));
  }

  if (!w.started) return;

  let remaining = dt;
  while (remaining > 1e-6) {
    const d = Math.min(0.1, remaining);
    remaining -= d;
    w.time += d;
    if (w.sw.running) w.sw.elapsed += d;

    for (const c of objs(w, 'ice_cube')) {
      if (c.mass <= 0 || !c.inBeaker) continue;
      const b = w.objects[c.inBeaker];
      const temp = zoneTemp(b.zone);
      if (temp <= 0) continue;
      const lost = Math.min(c.mass, MELT_K * temp * Math.pow(c.mass, 2 / 3) * d);
      c.mass -= lost;
      b.waterMl += lost;
      c.y = cubeY();
      if (c.mass < GONE_G) {
        b.waterMl += c.mass;
        c.mass = 0;
        const t = w.trials[b.id];
        if (t && t.doneAt === null) {
          t.doneAt = w.time;
          t.meltSeconds = round1(w.time - (t.startedAt ?? 0));
          emit(w, 'melted', b.id, { seconds: t.meltSeconds, tempC: t.envTempC });
        }
      }
    }
  }
  const everyoneDone = Object.values(w.trials).every((t) => t.doneAt !== null);
  if (everyoneDone && w.sw.running) {
    // The student keeps the stopwatch; it stops by itself once there is nothing left to time.
    w.sw.running = false;
  }
}

// --- reading the world -----------------------------------------------------------------

export function snapshot(w: IceWorld, config: LabConfig): LabSnapshot {
  const a = w.objects.beakerA;
  const b = w.objects.beakerB;
  const cubes = objs(w, 'ice_cube');
  const missing = setupMissing(w);
  const setupReady = missing === null;
  const done = Object.values(w.trials).every((t) => t.doneAt !== null) && w.started;
  const readsOk = objs(w, 'ice_thermometer').length > 0 && objs(w, 'ice_thermometer').every((t) => t.zone !== null && Math.abs(t.reading - zoneTemp(t.zone)) < 0.6);
  const melting = cubes.some((c) => w.started && c.mass < ICE_MASS_G - 1);

  const tasksDone: Record<string, boolean> = { start: w.started, read: w.started && readsOk, watch: melting, melted: done };
  const next = config.tasks.find((t) => !tasksDone[t.id]) ?? null;

  const readouts: LabSnapshot['readouts'] = [];
  for (const t of objs(w, 'ice_thermometer')) {
    readouts.push({ id: t.id, label: t.label, value: `${(Math.round(t.reading * 2) / 2).toFixed(1)} °C` });
  }
  for (const c of cubes) {
    readouts.push({ id: c.id, label: c.label, value: c.mass <= 0 ? 'melted' : `${Math.round((c.mass / ICE_MASS_G) * 100)}% left` });
  }

  let hint: string | null;
  if (!w.started) hint = missing ?? 'Everything is in place. Press “Start the experiment”.';
  else hint = next ? next.hint : 'Both ice cubes have melted. Go on to your results.';

  const results: LabSnapshot['results'] = done
    ? (() => {
        const ta = w.trials.beakerA;
        const tb = w.trials.beakerB;
        const reading = (id: string) => `${(Math.round((w.objects[id]?.reading ?? 0) * 2) / 2).toFixed(1)} °C`;
        const wrongTotal = Object.values(w.stats.wrong).reduce((n, v) => n + v, 0);
        return {
          columns: ['Beaker A', 'Beaker B'],
          rows: [
            { label: 'Where it was', values: [ta.env === 'cool' ? 'Cool place' : 'Warm place', tb.env === 'warm' ? 'Warm place' : 'Cool place'] },
            { label: 'Thermometer reading', values: [reading('thermoA'), reading('thermoB')] },
            { label: 'Time for the ice to melt completely', values: [`${ta.meltSeconds ?? '–'} s`, `${tb.meltSeconds ?? '–'} s`] },
          ],
          checks: [
            { id: 'ice', ok: true, text: 'Both beakers had an identical ice cube (same size, same starting temperature).' },
            { id: 'temp', ok: Math.abs((ta.envTempC ?? 0) - (tb.envTempC ?? 0)) >= 10, text: 'The two places had clearly different temperatures. That is the one thing you changed.' },
            { id: 'start', ok: true, text: 'Both ice cubes started melting at the same moment.' },
            { id: 'setup', ok: wrongTotal === 0, text: 'You put every beaker, ice cube and thermometer in the right place the first time.' },
          ],
          note: config.simulatedNote ?? 'These numbers come from a simulation. They are not real-world measurements.',
        };
      })()
    : null;

  void a;
  void b;
  return {
    time: w.time,
    held: w.held,
    heldLabel: w.held ? w.objects[w.held].label : null,
    tilt: 0,
    heldCanTilt: false,
    tasksDone,
    nextTask: next?.id ?? null,
    readouts,
    hint,
    warnings: w.warnings.map((x) => x.text),
    good: w.good.map((x) => x.text),
    info: w.info,
    started: w.started,
    startable: setupReady && !w.started,
    stopwatch: { running: w.sw.running, elapsed: w.sw.elapsed },
    trials: w.trials,
    stats: w.stats as unknown as Record<string, unknown>,
    setupReady,
    comparable: done,
    results,
  };
}

export function drainEvents(w: IceWorld): LabEvent[] {
  const out = w.events;
  w.events = [];
  return out;
}

/** Rebuild a saved world on top of a fresh one, ignoring anything malformed. */
export function restoreIceWorld(config: LabConfig, saved: unknown): IceWorld {
  const fresh = createIceWorld(config);
  if (!saved || typeof saved !== 'object') return fresh;
  const s = saved as Partial<IceWorld>;
  try {
    for (const id of Object.keys(fresh.objects)) {
      const o = (s.objects as Record<string, Partial<IceObj>> | undefined)?.[id];
      if (o) Object.assign(fresh.objects[id], o, { tilt: 0 });
    }
    if (s.trials) for (const id of Object.keys(fresh.trials)) if (s.trials[id]) Object.assign(fresh.trials[id], s.trials[id]);
    if (s.stats) fresh.stats = { ...fresh.stats, ...s.stats };
    if (s.sw) fresh.sw = { ...fresh.sw, ...s.sw };
    if (typeof s.time === 'number') fresh.time = s.time;
    if (typeof s.started === 'boolean') fresh.started = s.started;
  } catch {
    return createIceWorld(config);
  }
  fresh.held = null;
  return fresh;
}

export function createIceMeltingSimulation(config: LabConfig): LabSimulation<IceWorld> {
  return {
    create: () => createIceWorld(config),
    step,
    grab,
    release,
    moveHeld,
    setTilt: () => setTilt(),
    rotateHeld,
    click,
    act,
    snapshot: (w) => snapshot(w, config),
    objects: (w) => w.objects,
    restore: (c, saved) => restoreIceWorld(c, saved),
    drainEvents,
  };
}
