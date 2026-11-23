import type { ExperimentModel, ItemDef, ItemGroup, MeasureDef, Settings, Visual } from './types';

/**
 * Lab specifications, in the browser.
 *
 * A specification is data: the equipment, their settings, what is measured and how the result responds to the
 * settings. This file turns one into an ExperimentModel and evaluates its result model. The evaluator is the twin of
 * the server's LabSpecEvaluator; both are tested against the same vectors, because the server recomputes every
 * result and replaces any the browser got wrong.
 *
 *   result = clamp( base × Π term(settings), min, max )
 *   terms: lookup · power · exp · linear · interp (bounded) · rule      Nothing is random; identical settings give an identical result.
 */

export type SpecTerm =
  | { type: 'lookup'; setting: string; table: Record<string, number>; default?: number }
  | { type: 'power'; setting: string; per?: string; ref: number; exp: number }
  | { type: 'exp'; setting: string; ref: number; k: number }
  | { type: 'linear'; setting: string; ref: number; slope: number; floor?: number }
  | { type: 'interp'; setting: string; points: [number, number][] }
  | { type: 'rule'; when: { setting: string; eq?: string; in?: string[] }[]; multiply: number };

/** The part of a lab specification the browser needs. The marker's key is never sent to it. */
export interface LabSpec {
  schema: number;
  lab_key: string;
  title: string;
  subject: string;
  chapter_ids: number[];
  concepts: string[];
  scenario: string;
  outcomes: string[];
  visual: Visual;
  essential_groups: ItemGroup[];
  irrelevant: string[];
  items: ItemDef[];
  measures: MeasureDef[];
  model: { base: number; terms: SpecTerm[]; min?: number; max?: number };
}

/** The number an option of a setting stands for, or null. */
export function optionNumber(spec: Pick<LabSpec, 'items'>, setting: string, value: string): number | null {
  for (const item of spec.items) {
    for (const p of item.props) {
      if (p.key !== setting) continue;
      const o = p.options.find((x) => String(x.value) === value);
      if (!o) return null;
      if (typeof o.num === 'number') return o.num;
      const n = Number(value);
      return value !== '' && Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

export function evaluateTerm(spec: Pick<LabSpec, 'items'>, term: SpecTerm, s: Settings): number {
  if (term.type === 'rule') {
    for (const c of term.when) {
      const v = s[c.setting] ?? '';
      if (c.eq !== undefined && String(c.eq) !== v) return 1;
      if (c.in !== undefined && !c.in.map(String).includes(v)) return 1;
    }
    return term.multiply;
  }
  const value = s[term.setting] ?? '';
  if (term.type === 'lookup') return term.table[value] ?? term.default ?? 1;

  let x = optionNumber(spec, term.setting, value);
  if (x === null) return 1;
  switch (term.type) {
    case 'power': {
      if (term.per) {
        const y = optionNumber(spec, term.per, s[term.per] ?? '');
        if (y === null || y === 0) return 1;
        x = x / y;
      }
      return Math.pow(x / (term.ref || 1), term.exp);
    }
    case 'exp':
      return Math.exp(term.k * (x - term.ref));
    case 'linear':
      return Math.max(term.floor ?? 0.05, 1 + term.slope * (x - term.ref));
    case 'interp': {
      const pts = [...term.points].sort((a, b) => a[0] - b[0]);
      if (pts.length === 0) return 1;
      if (x <= pts[0][0]) return pts[0][1];
      for (let i = 1; i < pts.length; i++) {
        if (x <= pts[i][0]) {
          const f = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0] || 1);
          return pts[i - 1][1] + f * (pts[i][1] - pts[i - 1][1]);
        }
      }
      return pts[pts.length - 1][1];
    }
  }
}

/** The measured value for effective settings (unrounded). */
export function evaluateSpec(spec: Pick<LabSpec, 'items' | 'model'>, s: Settings): number {
  let v = spec.model.base;
  for (const t of spec.model.terms) v *= evaluateTerm(spec, t, s);
  if (spec.model.min !== undefined) v = Math.max(spec.model.min, v);
  if (spec.model.max !== undefined) v = Math.min(spec.model.max, v);
  return v;
}

/** An ExperimentModel for a specification. `version` is the version of the specification the server served. */
export function specToModel(spec: LabSpec, version: number): ExperimentModel {
  const exponent = spec.visual.exponent;
  return {
    id: spec.lab_key,
    version,
    title: spec.title,
    chapterIds: spec.chapter_ids,
    concepts: spec.concepts,
    scenario: spec.scenario,
    outcomes: spec.outcomes,
    items: spec.items,
    measures: spec.measures,
    essentialGroups: spec.essential_groups,
    irrelevant: spec.irrelevant,
    visual: spec.visual,
    seconds: (p) => evaluateSpec(spec, p),
    remaining: (f) => Math.pow(Math.max(0, 1 - f), exponent),
  };
}
