/**
 * A small, honest model of osmosis for the "From diffusion to osmosis" slide.
 *
 * Two chambers share a membrane that has a few pores. Water molecules (small) and solute particles (large) move at random in their
 * chamber. A water molecule that reaches a pore may pass through it; a solute particle is larger than a pore and can never cross.
 * Nothing here "pushes" water to the concentrated side: the net movement appears because the dilute side has more water molecules
 * meeting the pores, so more cross from that side than come back. When the water on both sides is equal, the two crossings balance:
 * molecules keep moving, but there is no net movement.
 *
 * NO REACT HERE. The state is plain data and `advance` is deterministic for a seed, so every rule can be tested with node:test.
 */

export const SCENE = { width: 150, height: 60, left: 4, right: 146, top: 6, bottom: 54, membrane: 75 } as const;
/** Centres of the pores in the membrane (scene y) and the half-height of each opening. */
export const PORES = [9, 15.5, 22, 28.5, 35, 41.5, 48] as const;
export const PORE_HALF = 1.9;
export const WATER_R = 1.1;
export const SOLUTE_R = 2.4;

export type Side = 'left' | 'right';
export type Kind = 'water' | 'solute';

export interface Particle {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Crossings {
  /** Water that passed dilute to concentrated, and back, since the state was made. */
  toRight: number;
  toLeft: number;
}

export interface OsmosisState {
  particles: Particle[];
  seed: number;
  crossings: Crossings;
  /** Simulated seconds. */
  time: number;
}

export type Mode = 'initial' | 'equilibrium';

/** Water molecules and solute particles in each chamber for a starting mode. */
export const START: Record<Mode, { water: [number, number]; solute: [number, number] }> = {
  // The left chamber is the dilute one: more water, little solute. The right one is concentrated: less water, much solute.
  initial: { water: [120, 60], solute: [4, 14] },
  // The same solute (it cannot cross) with the water spread equally: what the left side lost, the right side gained.
  equilibrium: { water: [90, 90], solute: [4, 14] },
};

/** mulberry32: small, fast and the same sequence for the same seed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPEED = { water: 28, solute: 10 } as const;

function place(random: () => number, kind: Kind, side: Side, id: number): Particle {
  const r = kind === 'water' ? WATER_R : SOLUTE_R;
  const x0 = side === 'left' ? SCENE.left + r : SCENE.membrane + 2 + r;
  const x1 = side === 'left' ? SCENE.membrane - 2 - r : SCENE.right - r;
  const angle = random() * Math.PI * 2;

  return {
    id,
    kind,
    x: x0 + random() * (x1 - x0),
    y: SCENE.top + r + random() * (SCENE.bottom - SCENE.top - 2 * r),
    vx: Math.cos(angle) * SPEED[kind],
    vy: Math.sin(angle) * SPEED[kind],
  };
}

/** A fresh state for a mode. The same seed always gives the same picture, so Reset really restores it. */
export function createState(mode: Mode, seed = 7): OsmosisState {
  const random = rng(seed);
  const particles: Particle[] = [];
  let id = 0;
  for (const side of ['left', 'right'] as const) {
    const index = side === 'left' ? 0 : 1;
    for (let i = 0; i < START[mode].solute[index]; i++) particles.push(place(random, 'solute', side, id++));
    for (let i = 0; i < START[mode].water[index]; i++) particles.push(place(random, 'water', side, id++));
  }

  return { particles, seed: seed + 1000003, crossings: { toRight: 0, toLeft: 0 }, time: 0 };
}

export function sideOf(p: Pick<Particle, 'x'>): Side {
  return p.x < SCENE.membrane ? 'left' : 'right';
}

export function countOn(state: OsmosisState, kind: Kind, side: Side): number {
  return state.particles.filter((p) => p.kind === kind && sideOf(p) === side).length;
}

/** Is a water molecule at height `y` lined up with a pore opening? */
export function atPore(y: number): boolean {
  return PORES.some((pore) => Math.abs(y - pore) <= PORE_HALF - WATER_R);
}

/**
 * Move every particle for `dt` seconds (a long step is split into small ones). Particles bounce off the walls and off the membrane,
 * except a water molecule at a pore, which passes. Each pass is counted.
 */
export function advance(state: OsmosisState, dt: number): OsmosisState {
  const steps = Math.max(1, Math.ceil(dt / 0.05));
  const h = dt / steps;
  const random = rng(state.seed);
  const crossings = { ...state.crossings };
  const particles = state.particles.map((p) => ({ ...p }));

  for (let s = 0; s < steps; s++) {
    for (const p of particles) {
      const r = p.kind === 'water' ? WATER_R : SOLUTE_R;
      // Brownian jostling: a small random push each step, then the speed is brought back to the usual one for that kind.
      p.vx += (random() - 0.5) * 22 * h * 10;
      p.vy += (random() - 0.5) * 22 * h * 10;
      const speed = Math.hypot(p.vx, p.vy) || 1;
      p.vx = (p.vx / speed) * SPEED[p.kind];
      p.vy = (p.vy / speed) * SPEED[p.kind];

      const before = sideOf(p);
      let nx = p.x + p.vx * h;
      let ny = p.y + p.vy * h;

      if (ny < SCENE.top + r) { ny = SCENE.top + r; p.vy = Math.abs(p.vy); }
      if (ny > SCENE.bottom - r) { ny = SCENE.bottom - r; p.vy = -Math.abs(p.vy); }
      if (nx < SCENE.left + r) { nx = SCENE.left + r; p.vx = Math.abs(p.vx); }
      if (nx > SCENE.right - r) { nx = SCENE.right - r; p.vx = -Math.abs(p.vx); }

      const after = nx < SCENE.membrane ? 'left' : 'right';
      if (after !== before) {
        if (p.kind === 'water' && atPore(ny)) {
          if (before === 'left') crossings.toRight++;
          else crossings.toLeft++;
        } else {
          // The membrane stops it: a solute particle always, a water molecule that missed a pore.
          nx = p.x;
          p.vx = -p.vx;
        }
      }
      p.x = nx;
      p.y = ny;
    }
  }

  return { particles, seed: Math.floor(random() * 4294967296), crossings, time: state.time + dt };
}

/**
 * What a student predicts and what the model says. Water goes from the side with more water (dilute) to the side with less
 * (concentrated), so "dilute-to-concentrated" is right.
 */
export type Direction = 'dilute-to-concentrated' | 'concentrated-to-dilute';

export const RIGHT_ANSWER: Direction = 'dilute-to-concentrated';

export function predictionFeedback(choice: Direction): { correct: boolean; message: string } {
  if (choice === RIGHT_ANSWER) {
    return {
      correct: true,
      message:
        'Yes. The dilute side has more water molecules reaching the pores, so more cross to the concentrated side than come back. The solute cannot cross, so water is what moves.',
    };
  }

  return {
    correct: false,
    message:
      'Not quite. Water crosses both ways, but the concentrated side has less water meeting the pores, so fewer cross from it. Overall, water moves from the dilute side to the concentrated side. Try again.',
  };
}

/** The scene step a hotspot index stands for. */
export type LabStep = 'dilute' | 'membrane' | 'concentrated' | 'equilibrium';
export const STEPS: readonly LabStep[] = ['dilute', 'membrane', 'concentrated', 'equilibrium'];

/** Which starting state a step shows: the last step is the balanced one, the others the start. */
export function modeFor(step: LabStep | null): Mode {
  return step === 'equilibrium' ? 'equilibrium' : 'initial';
}
