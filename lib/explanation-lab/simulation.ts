/**
 * Cause-and-effect readouts for the Explanation Lab's simulation workspace.
 *
 * The generated challenge describes each output as
 *   baseline + sum(weight * ((value - min) / (max - min)) ^ exponent)
 * clamped to the output's own range. The student sees only the result, so the
 * relationship has to be discovered by changing the controls.
 */

export interface SimVariable {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface SimOutput {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  baseline: number;
  terms: { var: string; weight: number; exponent: number }[];
}

export interface SimModel {
  variables: SimVariable[];
  outputs: SimOutput[];
}

export function initialValues(model: SimModel): Record<string, number> {
  return Object.fromEntries(model.variables.map((v) => [v.id, v.default]));
}

export function computeOutputs(model: SimModel, values: Record<string, number>): Record<string, number> {
  const byId = new Map(model.variables.map((v) => [v.id, v]));
  const result: Record<string, number> = {};
  for (const out of model.outputs) {
    let total = out.baseline;
    for (const term of out.terms) {
      const v = byId.get(term.var);
      if (!v) continue;
      const raw = values[term.var] ?? v.default;
      const unit = Math.max(0, Math.min(1, (raw - v.min) / (v.max - v.min)));
      total += term.weight * Math.pow(unit, term.exponent);
    }
    result[out.id] = Math.max(out.min, Math.min(out.max, total));
  }
  return result;
}
