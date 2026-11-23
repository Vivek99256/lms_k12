import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
} from '@/lib/erp-client';
import type { LabEvent, LabStageId } from '@/lib/virtual-lab/types';

/**
 * Persistence for the 3D Virtual Lab (Application Lab).
 *
 *   GET  /lms/pal/virtual-lab/chapter/{chapterId}/{labId}
 *   POST /lms/pal/virtual-lab/chapter/{chapterId}/{labId}/save
 *   POST /lms/pal/virtual-lab/chapter/{chapterId}/{labId}/submit
 *
 * One record per student, chapter and lab. It holds everything needed to
 * resume exactly where the student stopped: the stage, the prediction, the
 * saved state of the 3D world (where every object is, how much water and sugar
 * is in each beaker, the trial records), the interaction log, the notebook, the
 * answers and the conclusion. The model answer lives on the server only.
 */

export interface LabNotebook {
  /** Rows of the measurement table the student fills in themselves. */
  table: string[][];
  observationA: string;
  observationB: string;
  comparison: string;
  /** A small JPEG data URL of the student's own drawing, or null. */
  diagram: string | null;
}

export interface LabProgress {
  stage: LabStageId;
  prediction: { choice: string | null; reason: string };
  /** Saved state of the 3D world. Opaque to this file. */
  world: unknown;
  log: LabEvent[];
  notebook: LabNotebook;
  answers: Record<string, string | string[]>;
  conclusion: string;
}

export type LabStatus = 'in_progress' | 'submitted' | 'evaluated';

export interface LabEvaluation {
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
  experimentChecks: { id: string; ok: boolean; text: string }[];
  prediction: { choice: string; outcome: 'matched' | 'different' | 'unknown' } | null;
}

export interface LabRecord {
  id: number;
  status: LabStatus;
  progress: LabProgress | null;
  evaluation: LabEvaluation | null;
  submittedAt: string | null;
}

export function emptyNotebook(columns = 3, rows = 4): LabNotebook {
  return {
    table: Array.from({ length: rows }, () => Array.from({ length: columns }, () => '')),
    observationA: '',
    observationB: '',
    comparison: '',
    diagram: null,
  };
}

export function emptyProgress(): LabProgress {
  return {
    stage: 'intro',
    prediction: { choice: null, reason: '' },
    world: null,
    log: [],
    notebook: emptyNotebook(),
    answers: {},
    conclusion: '',
  };
}

// --- parsing -------------------------------------------------------------------

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown) => arr(v).map((x) => readString(x)).filter((x) => x !== '');

function parseProgress(raw: unknown): LabProgress | null {
  const r = rec(raw);
  if (!r.stage) return null;
  const base = emptyProgress();
  const nb = rec(r.notebook);
  const pred = rec(r.prediction);
  const answers: Record<string, string | string[]> = {};
  Object.entries(rec(r.answers)).forEach(([k, v]) => {
    answers[k] = Array.isArray(v) ? strs(v) : readString(v);
  });
  const table = arr(nb.table).map((row) => arr(row).map((c) => readString(c)));
  return {
    stage: (readString(r.stage) as LabStageId) || 'intro',
    prediction: { choice: readString(pred.choice) || null, reason: readString(pred.reason) },
    world: r.world ?? null,
    log: arr(r.log).map((e) => rec(e) as unknown as LabEvent),
    notebook: {
      table: table.length > 0 ? table : base.notebook.table,
      observationA: readString(nb.observationA),
      observationB: readString(nb.observationB),
      comparison: readString(nb.comparison),
      diagram: readString(nb.diagram) || null,
    },
    answers,
    conclusion: readString(r.conclusion),
  };
}

function parseEvaluation(raw: unknown): LabEvaluation | null {
  const e = rec(raw);
  if (!Array.isArray(e.criteria)) return null;
  const p = rec(e.prediction);
  return {
    scorePercent: readNumber(e.score_percent),
    pointsAwarded: readNumber(e.points_awarded),
    maxPoints: readNumber(e.max_points),
    criteria: arr(e.criteria).map((c) => {
      const row = rec(c);
      return {
        criterion: readString(row.criterion),
        pointsAwarded: readNumber(row.points_awarded),
        maxPoints: readNumber(row.max_points),
        comment: readString(row.comment),
      };
    }),
    wentWell: strs(e.went_well),
    incorrectOrUnclear: strs(e.incorrect_or_unclear),
    misconceptions: strs(e.misconceptions),
    improvements: strs(e.improvements),
    feedback: readString(e.feedback),
    nextAction: readString(e.next_action),
    evidenceStatement: readString(e.evidence_statement),
    experimentChecks: arr(e.experiment_checks).map((c) => {
      const row = rec(c);
      return { id: readString(row.id), ok: row.ok === true, text: readString(row.text) };
    }),
    prediction: p.choice
      ? {
          choice: readString(p.choice),
          outcome: (['matched', 'different'].includes(readString(p.outcome)) ? readString(p.outcome) : 'unknown') as
            | 'matched'
            | 'different'
            | 'unknown',
        }
      : null,
  };
}

function parseRecord(raw: unknown): LabRecord | null {
  const r = rec(raw);
  if (!r.id) return null;
  const status = readString(r.status);
  return {
    id: readNumber(r.id),
    status: status === 'submitted' || status === 'evaluated' ? status : 'in_progress',
    progress: parseProgress(r.progress),
    evaluation: parseEvaluation(r.evaluation),
    submittedAt: readString(r.submitted_at) || null,
  };
}

// --- requests ---------------------------------------------------------------------

function ctxOrThrow() {
  const ctx = buildSessionContext();
  if (!ctx.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  return ctx;
}

const url = (base: string, chapterId: string | number, labId: string, tail = '') =>
  `${base}/lms/pal/virtual-lab/chapter/${encodeURIComponent(String(chapterId))}/${encodeURIComponent(labId)}${tail}`;

const headers = (ctx: ReturnType<typeof buildSessionContext>, contentType?: string): HeadersInit => ({
  ...createAuthHeaders(ctx, contentType),
  'X-Requested-With': 'XMLHttpRequest',
});

export async function fetchVirtualLab(
  chapterId: string | number,
  labId: string,
  signal?: AbortSignal
): Promise<{ persisted: boolean; record: LabRecord | null }> {
  const ctx = ctxOrThrow();
  const params = new URLSearchParams();
  appendCommonParams(params, ctx);
  if (ctx.userId) params.set('user_id', ctx.userId);

  const response = await fetch(`${url(ctx.baseUrl, chapterId, labId)}?${params.toString()}`, {
    headers: headers(ctx),
    signal,
  });
  if (!response.ok) throw new Error('Couldn’t load your lab. Try again.');
  const payload = rec(await response.json());
  return { persisted: payload.persisted === true, record: parseRecord(payload.record) };
}

async function post(
  chapterId: string | number,
  labId: string,
  tail: string,
  progress: LabProgress,
  failure: string,
  keepalive = false
): Promise<{ record: LabRecord | null; message: string | null }> {
  const ctx = ctxOrThrow();
  const body = new URLSearchParams();
  appendCommonParams(body, ctx);
  if (ctx.userId) body.set('user_id', ctx.userId);
  body.set('progress_json', JSON.stringify(progress));

  const response = await fetch(url(ctx.baseUrl, chapterId, labId, tail), {
    method: 'POST',
    headers: headers(ctx, 'application/x-www-form-urlencoded'),
    body: body.toString(),
    keepalive: keepalive && body.toString().length < 60000,
  });
  if (!response.ok) throw new Error(failure);
  const payload = rec(await response.json());
  return {
    record: payload.ready === true ? parseRecord(payload.record) : null,
    message: payload.ready === true ? null : readString(payload.message) || failure,
  };
}

export const saveVirtualLab = (chapterId: string | number, labId: string, progress: LabProgress, keepalive = false) =>
  post(chapterId, labId, '/save', progress, 'Couldn’t save your lab.', keepalive);

export const submitVirtualLab = (chapterId: string | number, labId: string, progress: LabProgress) =>
  post(chapterId, labId, '/submit', progress, 'Couldn’t submit your lab. Try again.');

// --- browser copy, used only when the server has no storage yet --------------------

function localKey(chapterId: string | number, labId: string): string {
  let user = '';
  try {
    user = buildSessionContext().userId ?? '';
  } catch {
    user = '';
  }
  return `pal_virtual_lab_${user}_${chapterId}_${labId}`;
}

export function loadLocalLab(chapterId: string | number, labId: string): LabProgress | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(localKey(chapterId, labId));
    return raw ? parseProgress(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveLocalLab(chapterId: string | number, labId: string, progress: LabProgress): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(localKey(chapterId, labId), JSON.stringify(progress));
  } catch {
    // Storage can be full or blocked; the server copy is the real one.
  }
}
