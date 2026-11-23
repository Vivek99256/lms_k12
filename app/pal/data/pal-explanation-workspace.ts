import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
} from '@/lib/erp-client';
import type { SimModel } from '@/lib/explanation-lab/simulation';
import { addScope, type ActivityScope } from '@/app/pal/data/pal-activity-scope';

/**
 * Explanation Lab (journey step 6): a generated interactive demonstration, the
 * student's own explanation of it, and marking.
 *
 *   GET  /lms/pal/explanation-lab/chapter/{chapterId}
 *   POST /lms/pal/explanation-lab/chapter/{chapterId}/generate   (fresh=1 for a new one)
 *   POST /lms/pal/explanation-lab/chapter/{chapterId}/save
 *   POST /lms/pal/explanation-lab/chapter/{chapterId}/submit
 *
 * The answer key is kept on the server and is never part of what arrives here.
 */

export type ExplanationFormat = 'board' | 'simulation';

export interface BoardSpec {
  items: { id: string; label: string }[];
  zones: { id: string; label: string }[];
  allowArrows: boolean;
  allowLabels: boolean;
  allowDrawing: boolean;
}

export interface Challenge {
  title: string;
  format: ExplanationFormat;
  conceptFocus: string[];
  brief: string;
  goal: string;
  board: BoardSpec | null;
  simulation: SimModel | null;
  reflectionPrompts: { id: string; prompt: string }[];
}

export interface Workspace {
  placements: { id: string; x: number; y: number; zone: string | null }[];
  extras: { id: string; text: string; x: number; y: number }[];
  arrows: { from: string; to: string; label: string }[];
  ink: string | null;
  trials: { values: Record<string, number>; note: string }[];
  answers: Record<string, string>;
  log: string[];
  actions: number;
  phase: 'intro' | 'work' | 'explain' | 'review';
}

export interface Evaluation {
  scorePercent: number;
  pointsAwarded: number;
  maxPoints: number;
  criteria: { criterion: string; pointsAwarded: number; maxPoints: number; comment: string }[];
  wentWell: string[];
  incorrectOrUnclear: string[];
  misconceptions: string[];
  improvements: string[];
  feedback: string;
  nextAction: string;
  evidenceStatement: string;
  evidence: string[];
}

export type RecordStatus = 'in_progress' | 'submitted' | 'evaluated';

export interface LabRecord {
  id: number;
  status: RecordStatus;
  challenge: Challenge;
  workspace: Workspace;
  evaluation: Evaluation | null;
}

export function emptyWorkspace(): Workspace {
  return { placements: [], extras: [], arrows: [], ink: null, trials: [], answers: {}, log: [], actions: 0, phase: 'intro' };
}

// --- parsing ---------------------------------------------------------------------

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown) => arr(v).map((x) => readString(x)).filter((x) => x !== '');

function parseChallenge(raw: unknown): Challenge | null {
  const c = rec(raw);
  const format = readString(c.format) === 'simulation' ? 'simulation' : 'board';
  if (!c.title) return null;

  const b = rec(c.board);
  const s = rec(c.simulation);
  return {
    title: readString(c.title),
    format,
    conceptFocus: strs(c.concept_focus),
    brief: readString(c.brief),
    goal: readString(c.goal),
    board:
      format === 'board'
        ? {
            items: arr(b.items).map((i) => ({ id: readString(rec(i).id), label: readString(rec(i).label) })),
            zones: arr(b.zones).map((z) => ({ id: readString(rec(z).id), label: readString(rec(z).label) })),
            allowArrows: b.allow_arrows !== false,
            allowLabels: b.allow_labels !== false,
            allowDrawing: b.allow_drawing !== false,
          }
        : null,
    simulation:
      format === 'simulation'
        ? {
            variables: arr(s.variables).map((v) => {
              const r = rec(v);
              return {
                id: readString(r.id), label: readString(r.label), unit: readString(r.unit),
                min: readNumber(r.min), max: readNumber(r.max), step: readNumber(r.step) || 1, default: readNumber(r.default),
              };
            }),
            outputs: arr(s.outputs).map((o) => {
              const r = rec(o);
              return {
                id: readString(r.id), label: readString(r.label), unit: readString(r.unit),
                min: readNumber(r.min), max: readNumber(r.max), baseline: readNumber(r.baseline),
                terms: arr(r.terms).map((t) => ({
                  var: readString(rec(t).var), weight: readNumber(rec(t).weight), exponent: readNumber(rec(t).exponent) || 1,
                })),
              };
            }),
          }
        : null,
    reflectionPrompts: arr(c.reflection_prompts).map((p, i) => ({
      id: readString(rec(p).id) || `r${i + 1}`,
      prompt: readString(rec(p).prompt),
    })),
  };
}

function parseWorkspace(raw: unknown): Workspace {
  const w = rec(raw);
  const base = emptyWorkspace();
  if (!raw) return base;
  const answers: Record<string, string> = {};
  Object.entries(rec(w.answers)).forEach(([k, v]) => {
    answers[k] = readString(v);
  });
  const phase = readString(w.phase);
  return {
    placements: arr(w.placements).map((p) => ({
      id: readString(rec(p).id), x: readNumber(rec(p).x), y: readNumber(rec(p).y), zone: readString(rec(p).zone) || null,
    })),
    extras: arr(w.extras).map((e) => ({
      id: readString(rec(e).id), text: readString(rec(e).text), x: readNumber(rec(e).x), y: readNumber(rec(e).y),
    })),
    arrows: arr(w.arrows).map((a) => ({
      from: readString(rec(a).from), to: readString(rec(a).to), label: readString(rec(a).label),
    })),
    ink: readString(w.ink) || null,
    trials: arr(w.trials).map((t) => {
      const values: Record<string, number> = {};
      Object.entries(rec(rec(t).values)).forEach(([k, v]) => {
        values[k] = readNumber(v);
      });
      return { values, note: readString(rec(t).note) };
    }),
    answers,
    log: strs(w.log),
    actions: readNumber(w.actions),
    phase: phase === 'work' || phase === 'explain' || phase === 'review' ? phase : 'intro',
  };
}

function parseEvaluation(raw: unknown): Evaluation | null {
  const e = rec(raw);
  if (!Array.isArray(e.criteria)) return null;
  return {
    scorePercent: readNumber(e.score_percent),
    pointsAwarded: readNumber(e.points_awarded),
    maxPoints: readNumber(e.max_points),
    criteria: arr(e.criteria).map((c) => ({
      criterion: readString(rec(c).criterion), pointsAwarded: readNumber(rec(c).points_awarded),
      maxPoints: readNumber(rec(c).max_points), comment: readString(rec(c).comment),
    })),
    wentWell: strs(e.went_well),
    incorrectOrUnclear: strs(e.incorrect_or_unclear),
    misconceptions: strs(e.misconceptions),
    improvements: strs(e.improvements),
    feedback: readString(e.feedback),
    nextAction: readString(e.next_action),
    evidenceStatement: readString(e.evidence_statement),
    evidence: strs(e.evidence),
  };
}

function parseRecord(raw: unknown): LabRecord | null {
  const r = rec(raw);
  if (!r.id) return null;
  const challenge = parseChallenge(r.challenge);
  if (!challenge) return null;
  const status = readString(r.status);
  return {
    id: readNumber(r.id),
    status: status === 'submitted' || status === 'evaluated' ? status : 'in_progress',
    challenge,
    workspace: parseWorkspace(r.workspace),
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
  `${base}/lms/pal/explanation-lab/chapter/${encodeURIComponent(String(chapterId))}${tail}`;

const headers = (ctx: ReturnType<typeof buildSessionContext>, contentType?: string): HeadersInit => ({
  ...createAuthHeaders(ctx, contentType),
  'X-Requested-With': 'XMLHttpRequest',
});

export async function fetchExplanationLab(chapterId: string | number, scope: ActivityScope, signal?: AbortSignal): Promise<LabRecord | null> {
  const ctx = context();
  const params = new URLSearchParams();
  appendCommonParams(params, ctx);
  if (ctx.userId) params.set('user_id', ctx.userId);
  addScope(params, scope);
  const response = await fetch(`${url(ctx.baseUrl, chapterId)}?${params.toString()}`, { headers: headers(ctx), signal });
  if (!response.ok) throw new Error('Couldn’t load your Explanation Lab. Try again.');
  return parseRecord(rec(await response.json()).record);
}

type Outcome = { record: LabRecord | null; message: string | null };

async function post(
  chapterId: string | number,
  scope: ActivityScope,
  tail: string,
  extra: Record<string, string>,
  failure: string,
  signal?: AbortSignal
): Promise<Outcome> {
  const ctx = context();
  const body = new URLSearchParams();
  appendCommonParams(body, ctx);
  if (ctx.userId) body.set('user_id', ctx.userId);
  addScope(body, scope);
  Object.entries(extra).forEach(([k, v]) => body.set(k, v));
  const response = await fetch(url(ctx.baseUrl, chapterId, tail), {
    method: 'POST',
    headers: headers(ctx, 'application/x-www-form-urlencoded'),
    body: body.toString(),
    signal,
  });
  if (!response.ok) throw new Error(failure);
  const payload = rec(await response.json());
  return {
    record: payload.ready === true ? parseRecord(payload.record) : null,
    message: payload.ready === true ? null : readString(payload.message) || failure,
  };
}

const wire = (w: Workspace) =>
  JSON.stringify({
    placements: w.placements, extras: w.extras, arrows: w.arrows, ink: w.ink, trials: w.trials,
    answers: w.answers, log: w.log, actions: w.actions, phase: w.phase,
  });

export const generateExplanationLab = (chapterId: string | number, scope: ActivityScope, fresh: boolean, signal?: AbortSignal) =>
  post(chapterId, scope, '/generate', fresh ? { fresh: '1' } : {}, 'Couldn’t build your challenge. Try again.', signal);

export const saveExplanationLab = (chapterId: string | number, scope: ActivityScope, workspace: Workspace) =>
  post(chapterId, scope, '/save', { workspace_json: wire(workspace) }, 'Couldn’t save your work.');

export const submitExplanationLab = (chapterId: string | number, scope: ActivityScope, workspace: Workspace) =>
  post(chapterId, scope, '/submit', { workspace_json: wire(workspace) }, 'Couldn’t submit your work. Try again.');
