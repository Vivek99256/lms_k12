/**
 * Experiment builder: a reusable engine for "Design Your Own Experiment".
 *
 * Nothing here is an experiment. A MODEL describes a family of things a student could investigate
 * (what equipment exists, which settings each piece has, and how the world responds to those settings).
 * The student decides what to investigate, builds the bench, chooses what to change, measure and keep the
 * same, runs as many trials as they like, and interprets what the simulation shows for THEIR set-up.
 *
 * Adding an experiment means adding a model; the bench, trials, hints, saving and marking are shared.
 */

export type ItemGroup = 'container' | 'material' | 'location' | 'tool' | 'instrument' | 'other';

/** Drawing hints an option can carry, so the stage shows what the student chose. Only these words are accepted from a spec. */
export interface Vis {
  /** Multiplies the size of the material. */
  scale?: number;
  /** The look of the container. */
  tone?: 'clear' | 'cream' | 'grey' | 'brown' | 'green' | 'blue' | 'red';
  /** How warm the surroundings look, in degrees. */
  heat?: number;
  grains?: 'fine' | 'coarse' | 'lump';
  /** How fast it is stirred, 0 to 1. */
  spin?: number;
  /** A cover is on. */
  cover?: boolean;
}

export interface PropOption {
  value: string;
  label: string;
  /** The number the option stands for in a formula (else its value read as a number). */
  num?: number;
  vis?: Vis;
}

/** A setting on a piece of equipment, e.g. the temperature of the water. */
export interface PropDef {
  key: string;
  label: string;
  options: PropOption[];
  /** The value used until the student chooses one. */
  default: string;
  /** The value when the piece that owns this setting is not on the bench. */
  absent?: string;
}

/** What an instrument on the bench shows while a trial runs. */
export type Reads = { kind: 'clock' } | { kind: 'setting'; setting: string; unit?: string };

export interface ItemDef {
  id: string;
  name: string;
  /** The drawing (a name from the icon library). */
  icon: string;
  group: ItemGroup;
  /** What it is, in a few words (never what to do with it). */
  about: string;
  props: PropDef[];
  reads?: Reads;
}

/** What the student can measure, and the instrument needed to measure it. */
export interface MeasureDef {
  id: string;
  label: string;
  unit: string;
  instrument: string;
  decimals?: number;
}

export type VisualKind = 'shrink' | 'dissolve' | 'grow' | 'dial';

export interface Visual {
  kind: VisualKind;
  emoji: string;
  /** The material follows (1 - f)^exponent as the change goes from start to finish. */
  exponent: number;
}

/**
 * A lab as the browser runs it: built from an approved lab specification (see spec.ts). Nothing here is about a
 * particular chapter; adding an experiment means adding a validated specification on the server.
 */
export interface ExperimentModel {
  /** The lab's key, and the version of the specification it was built from. */
  id: string;
  version: number;
  title: string;
  chapterIds: number[];
  /** Concept names (as in the chapter) this lab can assess. */
  concepts: string[];
  /** The real-life problem the student is given. It states a need, never a method or a set-up. */
  scenario: string;
  /** What a good answer will have to do, stated as outcomes (no steps). */
  outcomes: string[];
  items: ItemDef[];
  measures: MeasureDef[];
  /** Items that must be on the bench before anything can run (by group). */
  essentialGroups: ItemGroup[];
  /** Items on the shelf that have nothing to do with this investigation. Placing them is a poor choice, not an error. */
  irrelevant: string[];
  visual: Visual;
  /** The measured value for the given effective settings (deterministic). */
  seconds: (p: Settings) => number;
  /** The fraction of the material left at fraction f of the way through (1 at the start, 0 at the end). */
  remaining: (f: number) => number;
}

export type Settings = Record<string, string>;

export interface BenchItem {
  item: string;
  x: number;
  y: number;
}

export interface Trial {
  id: string;
  label: string;
  /** The value chosen for every setting of the items on the bench when this trial was run or planned. */
  props: Settings;
  /** The time the stopwatch showed, once the trial has been run with one. */
  seconds: number | null;
  /** True once the trial has been run, even if nothing could be measured. */
  ran: boolean;
  /** The reading the student wrote down from the instrument, if any. */
  recorded: number | null;
}

export interface Interpretation {
  seen: string;
  claim: string;
  evidence: string;
  reasoning: string;
  limits: string;
}

/** The six stages: Brief, Question, Bench (design), Variables, Run, Analyse (interpret, then review and submit). */
export type BuilderPhase = 'challenge' | 'question' | 'design' | 'variables' | 'run' | 'interpret' | 'review';

export interface HintUsed {
  phase: BuilderPhase;
  topic: string;
  level: number;
}

export interface BuilderDesign {
  modelId: string;
  /** The version of the lab specification this design was run on. */
  specVersion: number;
  /** The student must write down readings before interpreting them. */
  recording: boolean;
  /** The lab provides its equipment (the bench is built from the specification); the student does not choose it. */
  autoBench: boolean;
  focus: string[];
  question: string;
  /** The setting the student says they change (a property key), the measure, and what they say they keep the same. */
  iv: string;
  dv: string;
  controls: string[];
  prediction: string;
  reason: string;
  bench: BenchItem[];
  trials: Trial[];
  interpretation: Interpretation;
  hints: HintUsed[];
  log: string[];
  actions: number;
  phase: BuilderPhase;
}

/** What the engine can tell about a design, with no model and no guessing. Used for hints and (again, on the server) for marking. */
export interface DesignFacts {
  placed: string[];
  missingGroups: ItemGroup[];
  otherItems: number;
  ran: number;
  measured: number;
  /** Setting keys whose value differs between run trials. */
  changed: string[];
  /** Settings that differ but the student did not name as the one they change. */
  unfair: string[];
  /** Controls the student named that did differ between run trials. */
  brokenControls: string[];
  fair: boolean;
  repeats: number;
  ivClaimed: boolean;
  dvClaimed: boolean;
  dvInstrumentPlaced: boolean;
  /** Run trials with a measurement, and how many of those the student wrote down correctly (within 5 %). */
  recorded: number;
  recordedRight: number;
}
