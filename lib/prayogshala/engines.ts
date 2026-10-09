/* eslint-disable @typescript-eslint/no-explicit-any -- engine params are database-supplied JSON; each engine narrows them to its own typed shape on entry. */
import { evaluate, isTrue } from './expr';

/**
 * Prayogshala lab engines: pure, config-driven simulation logic.
 *
 * A lab is a database row whose `lab_config` names an engine (`simulation.type`) and gives it
 * parameters. The engine turns (params, student state) into FACTS - numbers the rest of the lab
 * reasons over. Everything the student reads is derived from the same facts: the observation,
 * the explanation that is chosen, and which prediction counts as right. So an observation can
 * never contradict the simulation, and there is no stored "answer" to drift from it.
 *
 * Nothing here knows a chapter, a standard or a subject. A new experiment is a new config for
 * an existing engine; a genuinely new kind of simulation is a new engine added to ENGINES.
 */

// ------------------------------------------------------------------------------- shapes

export interface LabOption {
  id: string;
  label: string;
  /** Predict options: a fact expression; the option is "right" when it is true. */
  when?: string;
  /** Apply options: whether this is the right answer, and what to say about it. */
  correct?: boolean;
  feedback?: string;
}

export interface LabSteps {
  mission: { scenario: string; task: string; tags?: string[] };
  predict: { question: string; scenario?: Record<string, unknown>; options: LabOption[] };
  do: { instructions: string[]; materials?: string[]; safety?: string };
  observe: { prompt: string };
  explain: { text: string; cases?: { when: string; text: string }[] };
  concept: { text: string; points?: string[] };
  apply: { question: string; options: LabOption[] };
  reflect: { prompts: string[] };
}

export interface LabConfig {
  version: number;
  simulation: { type: string; params: Record<string, unknown> };
  steps: LabSteps;
  outcomes?: string[];
  teacher_script?: string[];
  particle_view?: boolean;
}

export interface EngineResult {
  /** Numbers every expression in the config is evaluated over. */
  facts: Record<string, number>;
  /** What the student reads in the Observe step. */
  observation: string;
  warnings: string[];
  /** Calculator-style engines list their working here. */
  outputs: { id: string; label: string; unit: string; text: string; primary: boolean }[];
}

export interface Engine<S> {
  id: string;
  /** True when the engine has a real particle-level model to show. */
  supportsParticleView: boolean;
  initialState(params: any): S;
  /** The state for the predict scenario: the defaults overridden by `override`. */
  scenarioState(params: any, override: Record<string, unknown> | undefined): S;
  evaluate(params: any, state: S): EngineResult;
}

// ------------------------------------------------------------------------------- helpers

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Replace {name} with the matching value in `values`; unknown names are left visible. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (whole, key: string) => (key in values ? values[key] : whole));
}

// --------------------------------------------------------------------------- calculator

export interface CalculatorVariable {
  id: string;
  label: string;
  unit: string;
  kind?: 'measured' | 'assumed';
  min: number;
  max: number;
  step: number;
  default: number;
}
export interface CalculatorOutput {
  id: string;
  label: string;
  unit: string;
  formula: string;
  decimals?: number;
  primary?: boolean;
}
export interface CalculatorParams {
  variables: CalculatorVariable[];
  outputs: CalculatorOutput[];
  warnings?: { when: string; text: string }[];
  observation_template?: string;
}
export type CalculatorState = { values: Record<string, number> };

export const calculatorEngine: Engine<CalculatorState> = {
  id: 'calculator',
  supportsParticleView: false,
  initialState(params: CalculatorParams) {
    return { values: Object.fromEntries(params.variables.map((v) => [v.id, v.default])) };
  },
  scenarioState(params, override) {
    const base = this.initialState(params);
    const given = (override ?? {}) as Record<string, number>;
    return { values: { ...base.values, ...given } };
  },
  evaluate(params: CalculatorParams, state) {
    const scope: Record<string, number> = { ...state.values };
    const text: Record<string, string> = {};
    for (const v of params.variables) text[v.id] = formatNumber(state.values[v.id] ?? v.default, v.step < 1 ? 2 : 0).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    const outputs: EngineResult['outputs'] = [];
    for (const o of params.outputs) {
      const value = evaluate(o.formula, scope);
      if (value === null) {
        text[o.id] = '?';
        outputs.push({ id: o.id, label: o.label, unit: o.unit, text: '?', primary: !!o.primary });
        continue;
      }
      scope[o.id] = value;
      text[o.id] = formatNumber(value, o.decimals ?? 0);
      outputs.push({ id: o.id, label: o.label, unit: o.unit, text: text[o.id], primary: !!o.primary });
    }
    const warnings = (params.warnings ?? []).filter((w) => isTrue(w.when, scope)).map((w) => w.text);
    return {
      facts: scope,
      observation: fillTemplate(params.observation_template ?? '', text),
      warnings,
      outputs,
    };
  },
};

// --------------------------------------------------------------------------- relevance

export interface RelevanceParams {
  subject: string;
  details: { id: string; label: string }[];
  questions: { id: string; text: string; relevant: string[] }[];
  default_question: string;
  observation_template?: string;
}
export type RelevanceState = { question: string; kept: string[] };

export const relevanceEngine: Engine<RelevanceState> = {
  id: 'relevance',
  supportsParticleView: false,
  initialState(params: RelevanceParams) {
    return { question: params.default_question ?? params.questions[0]?.id, kept: [] };
  },
  scenarioState(params, override) {
    const base = this.initialState(params);
    const o = (override ?? {}) as Partial<RelevanceState>;
    return { question: o.question ?? base.question, kept: o.kept ?? base.kept };
  },
  evaluate(params: RelevanceParams, state) {
    const question = params.questions.find((q) => q.id === state.question) ?? params.questions[0];
    const relevant = new Set(question?.relevant ?? []);
    const kept = new Set(state.kept);
    const facts: Record<string, number> = {};
    for (const d of params.details) {
      facts[`rel_${d.id}`] = relevant.has(d.id) ? 1 : 0;
      facts[`kept_${d.id}`] = kept.has(d.id) ? 1 : 0;
    }
    const missed = [...relevant].filter((id) => !kept.has(id)).length;
    const extra = [...kept].filter((id) => !relevant.has(id)).length;
    facts.kept = kept.size;
    facts.missed = missed;
    facts.extra = extra;
    // Only "complete" once the student has actually built a model.
    facts.complete = kept.size > 0 && missed === 0 && extra === 0 ? 1 : 0;
    const observation = fillTemplate(params.observation_template ?? '', {
      question: question?.text ?? '',
      kept: String(kept.size),
      missed: String(missed),
      extra: String(extra),
    });
    return { facts, observation, warnings: [], outputs: [] };
  },
};

// ----------------------------------------------------------------------------- osmosis

export interface OsmosisParams {
  specimens: { id: string; label: string; has_wall: boolean; measure: 'mass' | 'volume' }[];
  solutions: { id: string; label: string; solute_pct: number }[];
  cell_solute_pct: number;
  max_minutes: number;
  full_change_pct: number;
  default_specimen: string;
  default_solution: string;
  model_note?: string;
  observation_template?: string;
}
export type OsmosisState = { specimen: string; solution: string; minutes: number };

/** The direction of net water movement, from the two solute levels alone. */
export function osmosisDirection(cellPct: number, solutionPct: number): 'swell' | 'shrink' | 'nochange' {
  if (solutionPct < cellPct) return 'swell';
  if (solutionPct > cellPct) return 'shrink';
  return 'nochange';
}

export const osmosisEngine: Engine<OsmosisState> = {
  id: 'osmosis',
  supportsParticleView: true,
  initialState(params: OsmosisParams) {
    return { specimen: params.default_specimen, solution: params.default_solution, minutes: 0 };
  },
  scenarioState(params, override) {
    const base = this.initialState(params);
    const o = (override ?? {}) as Partial<OsmosisState>;
    return { specimen: o.specimen ?? base.specimen, solution: o.solution ?? base.solution, minutes: o.minutes ?? base.minutes };
  },
  evaluate(params: OsmosisParams, state) {
    const specimen = params.specimens.find((s) => s.id === state.specimen) ?? params.specimens[0];
    const solution = params.solutions.find((s) => s.id === state.solution) ?? params.solutions[0];
    const direction = osmosisDirection(params.cell_solute_pct, solution.solute_pct);
    const progress = Math.max(0, Math.min(1, state.minutes / params.max_minutes));
    const strength = Math.min(1, Math.abs(solution.solute_pct - params.cell_solute_pct) / 20);
    const sign = direction === 'swell' ? 1 : direction === 'shrink' ? -1 : 0;
    const changePct = sign * progress * strength * params.full_change_pct || 0; // `|| 0` turns -0 into 0
    const facts: Record<string, number> = {
      swell: direction === 'swell' ? 1 : 0,
      shrink: direction === 'shrink' ? 1 : 0,
      nochange: direction === 'nochange' ? 1 : 0,
      change_pct: changePct,
      progress,
      has_wall: specimen.has_wall ? 1 : 0,
    };

    let outcome: string;
    if (state.minutes === 0) {
      outcome = 'nothing has happened yet - move the time slider.';
    } else if (direction === 'nochange') {
      outcome = 'no net movement of water, so there is no change in size.';
    } else {
      const sizeWord = specimen.measure === 'mass' ? 'mass' : 'volume';
      const amount = `${changePct > 0 ? '+' : ''}${formatNumber(changePct, 1)}% ${sizeWord} (model value)`;
      if (direction === 'swell') {
        outcome = specimen.has_wall
          ? `water moves in, so it swells (${amount}); the cell wall stops it stretching without limit.`
          : `water moves in, so it swells (${amount}).`;
      } else {
        outcome = specimen.has_wall && specimen.measure === 'volume'
          ? `water moves out and the contents pull away from the wall, but the wall holds the original outline (${amount}).`
          : specimen.has_wall
            ? `water moves out, so it shrinks (${amount}).`
            : `water moves out, so the cell shrivels (${amount}).`;
      }
    }
    const observation = fillTemplate(params.observation_template ?? '{outcome_text}', {
      specimen: specimen.label,
      solution: solution.label,
      minutes: String(Math.round(state.minutes)),
      outcome_text: outcome,
    });
    return { facts, observation, warnings: [], outputs: [] };
  },
};

// ------------------------------------------------------------------------------ registry

export const ENGINES: Record<string, Engine<any>> = {
  [calculatorEngine.id]: calculatorEngine,
  [relevanceEngine.id]: relevanceEngine,
  [osmosisEngine.id]: osmosisEngine,
};

export function getEngine(type: string): Engine<any> | null {
  return ENGINES[type] ?? null;
}

// ----------------------------------------------------------------- reading the lab config

/** The explanation to show: the first case whose condition holds, else the default text. */
export function pickExplanation(explain: LabSteps['explain'], facts: Record<string, number>): string {
  const hit = (explain.cases ?? []).find((c) => isTrue(c.when, facts));
  return hit ? hit.text : explain.text;
}

/** Predict options that are right, evaluated over the engine's own facts for the scenario. */
export function correctPredictionIds(config: LabConfig): string[] {
  const engine = getEngine(config.simulation.type);
  if (!engine) return [];
  const facts = engine.evaluate(config.simulation.params, engine.scenarioState(config.simulation.params, config.steps.predict.scenario)).facts;
  return config.steps.predict.options.filter((o) => isTrue(o.when, facts)).map((o) => o.id);
}
