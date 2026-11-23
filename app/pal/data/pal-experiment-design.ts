import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
} from '@/lib/erp-client';
import type { Evaluation } from '@/app/pal/data/pal-explanation-workspace';
import { addScope, type ActivityScope } from '@/app/pal/data/pal-activity-scope';
import { parseEvaluation, type ChapterConcept } from '@/app/pal/data/pal-student-creation';

/**
 * Application Lab, activity 2: Design Your Own Experiment.
 *
 *   GET  /lms/pal/application-lab/design/chapter/{chapterId}         concepts to choose from + saved work
 *   POST /lms/pal/application-lab/design/chapter/{chapterId}/save    (fresh=1 starts another)
 *   POST /lms/pal/application-lab/design/chapter/{chapterId}/submit
 *
 * Nothing is generated for the student. The chapter's concepts are listed so they can pick what the
 * experiment is about; the question, apparatus, plan, prediction and conclusion are theirs.
 */

export interface Apparatus {
  id: string;
  name: string;
  /** A real, openly licensed photograph (a Wikimedia upload address) and the credit its licence requires. */
  image: string;
  credit: string;
  /** An emoji, used when there is no photograph. */
  icon: string;
  /** What the student says it is for. */
  purpose: string;
}

export interface DesignStep {
  id: string;
  text: string;
  /** Ids of the apparatus this step uses. */
  uses: string[];
}

export type DesignPhase = 'focus' | 'apparatus' | 'plan' | 'predict' | 'conclude' | 'review';

export interface Design {
  focus: string[];
  title: string;
  question: string;
  apparatus: Apparatus[];
  variables: { change: string; measure: string; same: string };
  steps: DesignStep[];
  prediction: string;
  reason: string;
  recordPlan: string;
  safety: string;
  conclusion: string;
  improve: string;
  log: string[];
  actions: number;
  phase: DesignPhase;
}

export type DesignStatus = 'in_progress' | 'submitted' | 'evaluated';

export interface DesignRecord {
  id: number;
  status: DesignStatus;
  design: Design;
  evaluation: Evaluation | null;
}

export function emptyDesign(): Design {
  return {
    focus: [], title: '', question: '', apparatus: [], variables: { change: '', measure: '', same: '' },
    steps: [{ id: 's1', text: '', uses: [] }], prediction: '', reason: '', recordPlan: '', safety: '',
    conclusion: '', improve: '', log: [], actions: 0, phase: 'focus',
  };
}

// --- parsing ---------------------------------------------------------------------

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown) => arr(v).map((x) => readString(x)).filter((x) => x !== '');

const PHASES: DesignPhase[] = ['focus', 'apparatus', 'plan', 'predict', 'conclude', 'review'];

function parseDesign(raw: unknown): Design {
  if (!raw) return emptyDesign();
  const d = rec(raw);
  const v = rec(d.variables);
  const steps = arr(d.steps).map((s, i) => ({ id: `s${i + 1}`, text: readString(rec(s).text), uses: strs(rec(s).uses) }));
  const phase = readString(d.phase) as DesignPhase;
  return {
    focus: strs(d.focus),
    title: readString(d.title),
    question: readString(d.question),
    apparatus: arr(d.apparatus).map((a) => ({
      id: readString(rec(a).id), name: readString(rec(a).name), image: readString(rec(a).image),
      credit: readString(rec(a).credit), icon: readString(rec(a).icon), purpose: readString(rec(a).purpose),
    })),
    variables: { change: readString(v.change), measure: readString(v.measure), same: readString(v.same) },
    steps: steps.length > 0 ? steps : emptyDesign().steps,
    prediction: readString(d.prediction),
    reason: readString(d.reason),
    recordPlan: readString(d.record_plan),
    safety: readString(d.safety),
    conclusion: readString(d.conclusion),
    improve: readString(d.improve),
    log: strs(d.log),
    actions: readNumber(d.actions),
    phase: PHASES.includes(phase) ? phase : 'focus',
  };
}

function parseRecord(raw: unknown): DesignRecord | null {
  const r = rec(raw);
  if (!r.id) return null;
  const status = readString(r.status);
  return {
    id: readNumber(r.id),
    status: status === 'submitted' || status === 'evaluated' ? status : 'in_progress',
    design: parseDesign(r.creation),
    evaluation: parseEvaluation(r.evaluation),
  };
}

// --- requests ----------------------------------------------------------------------

function context() {
  const ctx = buildSessionContext();
  if (!ctx.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  return ctx;
}

const url = (base: string, chapterId: string | number, tail = '') =>
  `${base}/lms/pal/application-lab/design/chapter/${encodeURIComponent(String(chapterId))}${tail}`;

const headers = (ctx: ReturnType<typeof buildSessionContext>, contentType?: string): HeadersInit => ({
  ...createAuthHeaders(ctx, contentType),
  'X-Requested-With': 'XMLHttpRequest',
});

export async function fetchExperimentDesign(
  chapterId: string | number,
  scope: ActivityScope,
  signal?: AbortSignal
): Promise<{ concepts: ChapterConcept[]; record: DesignRecord | null }> {
  const ctx = context();
  const params = new URLSearchParams();
  appendCommonParams(params, ctx);
  if (ctx.userId) params.set('user_id', ctx.userId);
  addScope(params, scope);
  const response = await fetch(`${url(ctx.baseUrl, chapterId)}?${params.toString()}`, { headers: headers(ctx), signal });
  if (!response.ok) throw new Error('Couldn’t load your experiment. Try again.');
  const payload = rec(await response.json());
  return {
    concepts: arr(payload.concepts).map((c) => ({
      name: readString(rec(c).name), description: readString(rec(c).description), taught: rec(c).taught === true,
    })),
    record: parseRecord(payload.record),
  };
}

type Outcome = { record: DesignRecord | null; message: string | null };

const wire = (d: Design) =>
  JSON.stringify({
    focus: d.focus, title: d.title, question: d.question, apparatus: d.apparatus, variables: d.variables,
    steps: d.steps, prediction: d.prediction, reason: d.reason, record_plan: d.recordPlan, safety: d.safety,
    conclusion: d.conclusion, improve: d.improve, log: d.log, actions: d.actions, phase: d.phase,
  });

async function post(chapterId: string | number, scope: ActivityScope, tail: string, design: Design, extra: Record<string, string>, failure: string): Promise<Outcome> {
  const ctx = context();
  const body = new URLSearchParams();
  appendCommonParams(body, ctx);
  if (ctx.userId) body.set('user_id', ctx.userId);
  addScope(body, scope);
  body.set('creation_json', wire(design));
  Object.entries(extra).forEach(([k, v]) => body.set(k, v));
  const response = await fetch(url(ctx.baseUrl, chapterId, tail), {
    method: 'POST',
    headers: headers(ctx, 'application/x-www-form-urlencoded'),
    body: body.toString(),
  });
  if (!response.ok) throw new Error(failure);
  const payload = rec(await response.json());
  return {
    record: payload.ready === true ? parseRecord(payload.record) : null,
    message: payload.ready === true ? null : readString(payload.message) || failure,
  };
}

export const saveExperimentDesign = (chapterId: string | number, scope: ActivityScope, design: Design, fresh = false) =>
  post(chapterId, scope, '/save', design, fresh ? { fresh: '1' } : {}, 'Couldn’t save your work.');

export const submitExperimentDesign = (chapterId: string | number, scope: ActivityScope, design: Design) =>
  post(chapterId, scope, '/submit', design, {}, 'Couldn’t submit your work. Try again.');
