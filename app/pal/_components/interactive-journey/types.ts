/**
 * Shared types for the Interactive Learning Journey — a 7-step, learning-first
 * replacement for the flat "Interactive activities" H5P launch, additive to
 * the existing PAL Learn page (see generate.ts, classify.ts, JourneyPlayer.tsx).
 *
 * A recipe is DATA: which generic visual component a concept uses, and the
 * numeric parameters for each step. Nothing here — or anywhere in this
 * feature — branches on a concept id. `classify.ts` picks a component from
 * the concept's own real name/chapter name; `generate.ts` builds the recipe
 * from the concept's own real data (name, chapter, authored description when
 * one exists). See those two files for the actual dynamic pipeline.
 */

export type VisualComponentName = 'BarModel' | 'FractionBar' | 'GeometryCanvas' | 'NumberLine';

/**
 * How a visual component behaves at a given step. Every visual component
 * supports all five — this is what makes one component reusable across
 * several steps instead of needing a step-specific component:
 *
 *  - 'reveal'  — step-by-step, student-paced reveal toward a fixed target
 *                (Hook, Visual — first and second exposure).
 *  - 'explore' — free manipulation with no target, for noticing the pattern
 *                (Explore).
 *  - 'summary' — the relationship already fully resolved and labelled, no
 *                interaction — pairs with the Explain step's rule text so
 *                Explain reads as "receive the explanation", not a third
 *                blank-slate reveal of the same numbers (Explain).
 *  - 'animate' — auto-plays a fresh worked example without requiring input
 *                (Animate).
 *  - 'guided'  — student sets the value themselves toward a stated target,
 *                self-checked, not server-graded (Guided interaction).
 *
 * `onComplete` fires once per mode's own notion of "engaged with this":
 * reveal/animate fire when fully revealed; guided fires the first time the
 * student checks their answer (regardless of right/wrong — the gate is
 * attempting the task, not getting it right); explore and summary never
 * fire it (there is nothing to gate — Continue is always available).
 */
export type VisualMode = 'reveal' | 'explore' | 'summary' | 'animate' | 'guided';

export interface BarModelParams {
  /** The whole amount the percentage is taken of, e.g. a price in rupees. */
  whole: number;
  percent: number;
  unit?: string;
}

export interface FractionBarParams {
  numerator: number;
  denominator: number;
  /** Present only for a comparison ("which is larger?") framing. */
  compareNumerator?: number;
  compareDenominator?: number;
}

export interface GeometryCanvasParams {
  width: number;
  height: number;
  unit?: string;
}

/**
 * The universal fallback visual — a single value moving on a number line by
 * some change, landing on a result. Generic enough to illustrate integers
 * (signed movement), decimals (precise position), sequences (repeated
 * steps), and anything else that isn't a fraction/percentage/area concept,
 * without pretending to be a bespoke visual for any of them.
 */
export interface NumberLineParams {
  start: number;
  change: number;
  unit?: string;
}

export type VisualParamsFor<K extends VisualComponentName> = K extends 'BarModel'
  ? BarModelParams
  : K extends 'FractionBar'
    ? FractionBarParams
    : K extends 'GeometryCanvas'
      ? GeometryCanvasParams
      : NumberLineParams;

export interface JourneyStepContent<K extends VisualComponentName> {
  /** Authored copy shown above the visual — never hardcoded in a component. */
  prompt: string;
  params: VisualParamsFor<K>;
}

/**
 * One concept's whole journey, minus Practice — Practice is generic by
 * design (it plays whatever the existing adaptive-practice endpoints serve
 * for this conceptId), so it needs no recipe content at all.
 */
export interface JourneyRecipe<K extends VisualComponentName = VisualComponentName> {
  conceptId: number;
  component: K;
  hook: JourneyStepContent<K> & { scenario: string };
  visual: JourneyStepContent<K>;
  explore: JourneyStepContent<K>;
  explain: { rule: string; params: VisualParamsFor<K> };
  animate: JourneyStepContent<K>;
  /** `target` is what the student is asked to reach — self-checked in place. */
  guided: JourneyStepContent<K> & { target: Partial<VisualParamsFor<K>> };
}

export interface VisualComponentProps<K extends VisualComponentName> {
  params: VisualParamsFor<K>;
  mode: VisualMode;
  /** 'guided' mode only — what the student's own value is checked against. */
  target?: Partial<VisualParamsFor<K>>;
  /** Fired once per full run of 'reveal'/'animate'; never fires in 'explore'/'guided'. */
  onComplete?: () => void;
}
