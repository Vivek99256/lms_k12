/**
 * Virtual Lab Engine: the shapes a lab is described with.
 *
 * A lab is DATA (LabConfig: objects, zones, tasks, questions, rubric) plus one
 * simulation (LabSimulation: how the objects behave). The 3D scene, the drag /
 * tilt / rotate controls, the stage flow, the notebook and the persistence are
 * shared by every lab. A new experiment (electricity, magnetism ...) is a new
 * config, a new simulation and renderers for any new object kinds.
 */

export type LabStageId =
  | 'intro'
  | 'predict'
  | 'setup'
  | 'perform'
  | 'compare'
  | 'notebook'
  | 'assess'
  | 'feedback';

export const LAB_STAGES: { id: LabStageId; label: string }[] = [
  { id: 'intro', label: 'Mission' },
  { id: 'predict', label: 'Predict' },
  { id: 'setup', label: 'Set up' },
  { id: 'perform', label: 'Experiment' },
  { id: 'compare', label: 'Compare' },
  { id: 'notebook', label: 'Notebook' },
  { id: 'assess', label: 'Questions' },
  { id: 'feedback', label: 'Feedback' },
];

export interface LabObjectSpec {
  id: string;
  /** Selects the 3D renderer and the simulation behaviour. */
  kind: string;
  label: string;
  /** Start position on the table: [x, z]. */
  position: [number, number];
  yaw?: number;
  /** Kind specific numbers/strings: temperatures, volumes, capacities. */
  props?: Record<string, number | string>;
  /** What the student reads when they click the object to find out what it is for. */
  info?: string;
}

export interface LabZone {
  id: string;
  label: string;
  position: [number, number];
  radius: number;
  accepts: string[];
}

export interface LabTask {
  id: string;
  label: string;
  /** Shown as a contextual hint while this is the next task still to do. */
  hint: string;
}

export interface LabQuestion {
  id: string;
  /** 'what' / 'how' / 'why' questions are what the assessment contrasts. */
  skill: 'what' | 'how' | 'why' | 'variable' | 'evidence';
  type: 'text' | 'choice' | 'multi';
  prompt: string;
  options?: { id: string; label: string }[];
}

export interface LabConfig {
  id: string;
  title: string;
  subtitle: string;
  scenario: string;
  mission: string;
  objectives: string[];
  /** Chapters this lab belongs to (exact), and name keywords as a fallback. */
  chapterIds: number[];
  chapterKeywords: string[];
  simulationId: string;
  objects: LabObjectSpec[];
  zones: LabZone[];
  prediction: { prompt: string; options: { id: string; label: string }[]; /** The student must also say why. */ reasonRequired?: boolean };
  /** Chapter concepts this lab assesses. A lab is offered when the student's scope touches one of them. */
  concepts?: string[];
  /** A "start the experiment" button in the experiment stage (the simulation's act() receives the action). */
  startAction?: { label: string; action: string };
  /** What the set-up panel says to do (when the lab is more than placing beakers). */
  setupText?: string;
  conclusionPrompt: string;
  observationPlaceholder: string;
  diagramPrompt: string;
  /** Shown beside any numbers the simulation produced. */
  simulatedNote?: string;
  tasks: LabTask[];
  /** Columns (first is the row label) and row labels of the measurement table the student fills in. */
  notebookColumns: string[];
  notebookRows: string[];
  questions: LabQuestion[];
  vocabulary: string[];
  estimatedMinutes: number;
}

/** One event worth keeping in the saved interaction log. */
export interface LabEvent {
  t: number;
  type: string;
  obj?: string;
  data?: Record<string, number | string | boolean | null>;
}

/** What the UI needs, cheap to copy and safe to JSON. */
export interface LabSnapshot {
  time: number;
  held: string | null;
  heldLabel: string | null;
  tilt: number;
  heldCanTilt: boolean;
  tasksDone: Record<string, boolean>;
  nextTask: string | null;
  readouts: { id: string; label: string; value: string }[];
  hint: string | null;
  warnings: string[];
  stopwatch: { running: boolean; elapsed: number };
  trials: Record<string, unknown>;
  stats: Record<string, unknown>;
  setupReady: boolean;
  /** Something the student clicked on, to read what it is for. */
  info?: { label: string; text: string } | null;
  /** The experiment has been started. */
  started?: boolean;
  /** Everything is in place to press the start button. */
  startable?: boolean;
  /** Recent confirmations ("placed correctly") to show beside the warnings. */
  good?: string[];
  /** What the experiment recorded, ready to show side by side. */
  results?: {
    columns: string[];
    rows: { label: string; values: string[] }[];
    checks: { id: string; ok: boolean; text: string }[];
    note?: string;
  } | null;
  /** Both runs finished: the compare stage can show real results. */
  comparable: boolean;
}

/** The behaviour of one lab's world. W is a plain JSON-able object so it can be saved and resumed. */
export interface LabSimulation<W> {
  create(config: LabConfig): W;
  /** dt = simulated seconds (speed applied), realDt = wall seconds (for pointer-derived motion). */
  step(world: W, dt: number, realDt: number): void;
  grab(world: W, id: string): boolean;
  release(world: W): void;
  moveHeld(world: W, x: number, z: number): void;
  setTilt(world: W, degrees: number): void;
  rotateHeld(world: W, degrees: number): void;
  click(world: W, id: string): void;
  /** Named one-off actions the HUD can trigger (for example resetting the stopwatch). */
  act(world: W, action: string): void;
  snapshot(world: W): LabSnapshot;
  /** Every object with the pose the scene draws it at. */
  objects(world: W): Record<string, { kind: string; label: string; x: number; y: number; z: number; yaw: number; tilt: number }>;
  /** Rebuild a saved world (resume). Malformed input yields a fresh world. */
  restore(config: LabConfig, saved: unknown): W;
  /** Drain the events recorded since the last call. */
  drainEvents(world: W): LabEvent[];
}
