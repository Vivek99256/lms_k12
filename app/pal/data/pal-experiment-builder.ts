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
import { emptyDesign } from '@/lib/experiment-builder/engine';
import type { BuilderDesign, BuilderPhase, Settings } from '@/lib/experiment-builder/types';

/**
 * Application Lab, Design Your Own Experiment as a virtual lab (the experiment builder).
 *
 *   GET  /lms/pal/application-lab/builder/chapter/{chapterId}         concepts + saved work
 *   POST /lms/pal/application-lab/builder/chapter/{chapterId}/save    (fresh=1 starts another)
 *   POST /lms/pal/application-lab/builder/chapter/{chapterId}/submit
 *
 * The browser runs the simulation; the server recomputes every result from the settings, works out whether
 * the test was fair and marks the reasoning. The marker's key is never sent here.
 */

export type BuilderStatus = 'in_progress' | 'submitted' | 'evaluated';

export interface BuilderRecord {
  id: number;
  status: BuilderStatus;
  design: BuilderDesign;
  evaluation: Evaluation | null;
}

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown) => arr(v).map((x) => readString(x)).filter((x) => x !== '');

const PHASES: BuilderPhase[] = ['challenge', 'question', 'design', 'variables', 'run', 'interpret', 'review'];

function parseDesign(raw: unknown, modelId: string): BuilderDesign {
  const d = rec(raw);
  if (!d.modelId) return emptyDesign(modelId);
  const base = emptyDesign(readString(d.modelId), [], readNumber(d.specVersion));
  const i = rec(d.interpretation);
  const trials = arr(d.trials).map((t, k) => {
    const props: Settings = {};
    Object.entries(rec(rec(t).props)).forEach(([key, value]) => {
      props[key] = readString(value);
    });
    const seconds = rec(t).seconds;
    return {
      id: `t${k + 1}`, label: `Trial ${k + 1}`, props,
      seconds: typeof seconds === 'number' ? seconds : null,
      ran: rec(t).ran === true,
      recorded: typeof rec(t).recorded === 'number' ? (rec(t).recorded as number) : null,
    };
  });
  const phase = readString(d.phase) as BuilderPhase;
  return {
    ...base,
    recording: d.recording === true,
    autoBench: d.autoBench === true,
    focus: strs(d.focus),
    question: readString(d.question),
    iv: readString(d.iv),
    dv: readString(d.dv),
    controls: strs(d.controls),
    prediction: readString(d.prediction),
    reason: readString(d.reason),
    bench: arr(d.bench).map((b) => ({ item: readString(rec(b).item), x: readNumber(rec(b).x), y: readNumber(rec(b).y) })),
    trials: trials.length > 0 ? trials : base.trials,
    interpretation: {
      seen: readString(i.seen), claim: readString(i.claim), evidence: readString(i.evidence),
      reasoning: readString(i.reasoning), limits: readString(i.limits),
    },
    hints: arr(d.hints).map((h) => ({
      phase: (PHASES.includes(readString(rec(h).phase) as BuilderPhase) ? readString(rec(h).phase) : 'design') as BuilderPhase,
      topic: readString(rec(h).topic), level: readNumber(rec(h).level),
    })),
    log: strs(d.log),
    actions: readNumber(d.actions),
    phase: PHASES.includes(phase) ? phase : 'challenge',
  };
}

function parseRecord(raw: unknown, modelId: string): BuilderRecord | null {
  const r = rec(raw);
  if (!r.id) return null;
  const status = readString(r.status);
  return {
    id: readNumber(r.id),
    status: status === 'submitted' || status === 'evaluated' ? status : 'in_progress',
    design: parseDesign(r.creation, modelId),
    evaluation: parseEvaluation(r.evaluation),
  };
}

function context() {
  const ctx = buildSessionContext();
  if (!ctx.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  return ctx;
}

const url = (base: string, chapterId: string | number, tail = '') =>
  `${base}/lms/pal/application-lab/builder/chapter/${encodeURIComponent(String(chapterId))}${tail}`;

const headers = (ctx: ReturnType<typeof buildSessionContext>, contentType?: string): HeadersInit => ({
  ...createAuthHeaders(ctx, contentType),
  'X-Requested-With': 'XMLHttpRequest',
});

export async function fetchExperimentBuilder(
  chapterId: string | number,
  modelId: string,
  scope: ActivityScope,
  signal?: AbortSignal
): Promise<{ concepts: ChapterConcept[]; record: BuilderRecord | null }> {
  const ctx = context();
  const params = new URLSearchParams();
  appendCommonParams(params, ctx);
  if (ctx.userId) params.set('user_id', ctx.userId);
  addScope(params, scope);
  const response = await fetch(`${url(ctx.baseUrl, chapterId)}?${params.toString()}`, { headers: headers(ctx), signal });
  if (!response.ok) throw new Error('Couldn’t load your experiment lab. Try again.');
  const payload = rec(await response.json());
  return {
    concepts: arr(payload.concepts).map((c) => ({
      name: readString(rec(c).name), description: readString(rec(c).description), taught: rec(c).taught === true,
    })),
    record: parseRecord(payload.record, modelId),
  };
}

type Outcome = { record: BuilderRecord | null; message: string | null };

const wire = (d: BuilderDesign) =>
  JSON.stringify({
    modelId: d.modelId, specVersion: d.specVersion, recording: d.recording, autoBench: d.autoBench, focus: d.focus, question: d.question, iv: d.iv, dv: d.dv, controls: d.controls,
    prediction: d.prediction, reason: d.reason, bench: d.bench, trials: d.trials, interpretation: d.interpretation,
    hints: d.hints, log: d.log, actions: d.actions, phase: d.phase,
  });

async function post(chapterId: string | number, scope: ActivityScope, tail: string, design: BuilderDesign, extra: Record<string, string>, failure: string): Promise<Outcome> {
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
    record: payload.ready === true ? parseRecord(payload.record, design.modelId) : null,
    message: payload.ready === true ? null : readString(payload.message) || failure,
  };
}

export const saveExperimentBuilder = (chapterId: string | number, scope: ActivityScope, design: BuilderDesign, fresh = false) =>
  post(chapterId, scope, '/save', design, fresh ? { fresh: '1' } : {}, 'Couldn’t save your work.');

export const submitExperimentBuilder = (chapterId: string | number, scope: ActivityScope, design: BuilderDesign) =>
  post(chapterId, scope, '/submit', design, {}, 'Couldn’t submit your work. Try again.');
