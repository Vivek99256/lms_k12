import { evaluate } from './expr';
import { correctPredictionIds, getEngine, type LabConfig } from './engines';

/**
 * Client-side check of a lab_config before it is run.
 *
 * The backend (SimulationConfigValidator) already refuses structurally bad configs and unknown
 * identifiers at write time. This is the second gate and can do what only the engines can: run
 * the simulation at its starting state and confirm that the lab is internally consistent -
 * the engine exists, the steps are present, every condition names a value the engine really
 * produces, at least one Predict option is right for the scenario, and exactly one Apply
 * option is right. A config that fails is not run; the student sees why instead of a lab that
 * could contradict itself.
 */

const STEP_KEYS = ['mission', 'predict', 'do', 'observe', 'explain', 'concept', 'apply', 'reflect'] as const;

function unknownNames(expr: string | undefined, known: Set<string>): string[] {
  if (!expr) return [];
  return [...new Set(expr.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [])].filter((name) => !known.has(name));
}

/** Problems with the lab, in plain words. An empty list means it is safe to run. */
export function validateLabConfig(lab: unknown): string[] {
  const problems: string[] = [];
  const config = lab as Partial<LabConfig> | null;
  if (!config || typeof config !== 'object' || !config.simulation || typeof config.simulation.type !== 'string') {
    return ['The activity has no simulation.'];
  }
  const engine = getEngine(config.simulation.type);
  if (!engine) return [`This version of the LMS has no "${config.simulation.type}" simulation.`];

  const steps = config.steps;
  if (!steps || STEP_KEYS.some((key) => !steps[key])) {
    return ['The eight-step flow is incomplete.'];
  }

  let facts: Record<string, number>;
  try {
    const params = config.simulation.params;
    facts = engine.evaluate(params, engine.initialState(params)).facts;
    engine.evaluate(params, engine.scenarioState(params, steps.predict.scenario));
  } catch {
    return ['The simulation settings could not be read.'];
  }
  const known = new Set(Object.keys(facts));

  for (const option of steps.predict.options ?? []) {
    const bad = unknownNames(option.when, known);
    if (bad.length) problems.push(`Predict option "${option.label}" uses unknown value(s): ${bad.join(', ')}.`);
  }
  for (const c of steps.explain.cases ?? []) {
    const bad = unknownNames(c.when, known);
    if (bad.length) problems.push(`An explanation condition uses unknown value(s): ${bad.join(', ')}.`);
  }
  if (correctPredictionIds(config as LabConfig).length === 0) {
    problems.push('No Predict option is right for the starting scenario.');
  }
  const applyCorrect = (steps.apply.options ?? []).filter((o) => o.correct === true).length;
  if (applyCorrect !== 1) problems.push('The Apply question must have exactly one right answer.');

  if (config.simulation.type === 'variable_model') {
    const visual = (config.simulation.params as { visual?: { bind?: Record<string, unknown> } }).visual;
    for (const [key, raw] of Object.entries(visual?.bind ?? {})) {
      if (typeof raw === 'string' && evaluate(raw, facts) === null) problems.push(`The picture setting "${key}" cannot be calculated.`);
    }
  }

  return problems;
}
