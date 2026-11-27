import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  readNumber,
  readString,
} from '@/lib/erp-client';
import type { Evaluation } from '@/app/pal/data/pal-explanation-workspace';
import { addScope, type ActivityScope } from '@/app/pal/data/pal-activity-scope';

/**
 * Application Lab, activity 2: the student creates their own demonstration.
 *
 *   GET  /lms/pal/application-lab/creation/chapter/{chapterId}         concepts to choose from + saved work
 *   POST /lms/pal/application-lab/creation/chapter/{chapterId}/save    (fresh=1 starts another)
 *   POST /lms/pal/application-lab/creation/chapter/{chapterId}/submit
 *
 * Nothing is generated for the student here. The chapter's concepts are listed
 * so they can pick one; everything else is theirs.
 */

export type Shape = 'box' | 'circle' | 'pill' | 'diamond';
export type PartSize = 's' | 'm' | 'l';
export type Scene = 'plain' | 'grass' | 'water' | 'sky' | 'bench' | 'space' | 'road';

export const SCENES: { id: Scene; label: string; css: string }[] = [
  { id: 'plain', label: 'Plain', css: 'linear-gradient(#ffffff, #ffffff)' },
  { id: 'grass', label: 'Grass', css: 'linear-gradient(#dbeafe 0%, #dbeafe 55%, #86efac 55%, #4ade80 100%)' },
  { id: 'water', label: 'Water', css: 'linear-gradient(#e0f2fe 0%, #e0f2fe 30%, #7dd3fc 30%, #0ea5e9 100%)' },
  { id: 'sky', label: 'Sky', css: 'linear-gradient(#bae6fd, #f0f9ff)' },
  { id: 'bench', label: 'Lab bench', css: 'linear-gradient(#f1f5f9 0%, #f1f5f9 62%, #cbd5e1 62%, #94a3b8 100%)' },
  { id: 'space', label: 'Space', css: 'linear-gradient(#0f172a, #1e1b4b)' },
  { id: 'road', label: 'Road', css: 'linear-gradient(#bfdbfe 0%, #bfdbfe 50%, #94a3b8 50%, #64748b 100%)' },
];

export const SIZE_SCALE: Record<PartSize, number> = { s: 0.75, m: 1, l: 1.5 };

export const SHAPE_COLOURS = ['#bae6fd', '#bbf7d0', '#fde68a', '#fecaca', '#e9d5ff', '#e2e8f0'];

export interface Part {
  id: string;
  text: string;
  shape: Shape;
  color: string;
  /** A picture (emoji) of the thing the student named, or '' to show a shape instead. */
  icon: string;
  /** A real, openly licensed photograph (a Wikimedia upload address), and the credit its licence requires. */
  image: string;
  credit: string;
  size: PartSize;
  /** The thing this is, kept the same from step to step so it can be animated moving between them. */
  origin: string;
  kind: 'part' | 'note';
  x: number;
  y: number;
}

export interface Frame {
  id: string;
  title: string;
  caption: string;
  scene: Scene;
  components: Part[];
  arrows: { from: string; to: string; label: string }[];
  ink: string | null;
}

export interface Creation {
  /** The concepts (from the chosen scope) this activity shows. */
  focus: string[];
  title: string;
  frames: Frame[];
  answers: Record<string, string>;
  log: string[];
  actions: number;
  phase: 'focus' | 'build' | 'explain' | 'review';
}

export interface ChapterConcept {
  name: string;
  description: string;
  taught: boolean;
}

export type CreationStatus = 'in_progress' | 'submitted' | 'evaluated';

export interface CreationRecord {
  id: number;
  status: CreationStatus;
  creation: Creation;
  evaluation: Evaluation | null;
}

export const CREATION_PROMPTS = [
  { id: 'c1', prompt: 'What did you create?' },
  { id: 'c2', prompt: 'Why did you design it this way?' },
  { id: 'c3', prompt: 'What does it show about the concept you chose?' },
  { id: 'c4', prompt: 'What did you learn from the chapter?' },
  { id: 'c5', prompt: 'How could someone use your activity to understand the concept?' },
];

export function emptyFrame(n = 1): Frame {
  return { id: `f${n}`, title: '', caption: '', scene: 'plain', components: [], arrows: [], ink: null };
}

export function emptyCreation(): Creation {
  return { focus: [], title: '', frames: [emptyFrame()], answers: {}, log: [], actions: 0, phase: 'focus' };
}

// --- parsing ---------------------------------------------------------------------

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown) => arr(v).map((x) => readString(x)).filter((x) => x !== '');

function parseCreation(raw: unknown): Creation {
  if (!raw) return emptyCreation();
  const c = rec(raw);
  const answers: Record<string, string> = {};
  Object.entries(rec(c.answers)).forEach(([k, v]) => {
    answers[k] = readString(v);
  });
  const frames = arr(c.frames).map((f, i): Frame => {
    const r = rec(f);
    return {
      id: readString(r.id) || `f${i + 1}`,
      title: readString(r.title),
      caption: readString(r.caption),
      scene: (SCENES.find((x) => x.id === readString(r.scene))?.id ?? 'plain') as Scene,
      components: arr(r.components).map((p): Part => {
        const q = rec(p);
        const shape = readString(q.shape);
        return {
          id: readString(q.id),
          text: readString(q.text),
          shape: shape === 'circle' || shape === 'pill' || shape === 'diamond' ? shape : 'box',
          color: readString(q.color) || SHAPE_COLOURS[0],
          icon: readString(q.icon),
          image: readString(q.image),
          credit: readString(q.credit),
          size: readString(q.size) === 's' ? 's' : readString(q.size) === 'l' ? 'l' : 'm',
          origin: readString(q.origin) || readString(q.id),
          kind: readString(q.kind) === 'note' ? 'note' : 'part',
          x: readNumber(q.x),
          y: readNumber(q.y),
        };
      }),
      arrows: arr(r.arrows).map((a) => ({ from: readString(rec(a).from), to: readString(rec(a).to), label: readString(rec(a).label) })),
      ink: readString(r.ink) || null,
    };
  });
  const phase = readString(c.phase);
  return {
    focus: strs(c.focus),
    title: readString(c.title),
    frames: frames.length > 0 ? frames : [emptyFrame()],
    answers,
    log: strs(c.log),
    actions: readNumber(c.actions),
    phase: phase === 'build' || phase === 'explain' || phase === 'review' ? phase : 'focus',
  };
}

export function parseEvaluation(raw: unknown): Evaluation | null {
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

function parseRecord(raw: unknown): CreationRecord | null {
  const r = rec(raw);
  if (!r.id) return null;
  const status = readString(r.status);
  return {
    id: readNumber(r.id),
    status: status === 'submitted' || status === 'evaluated' ? status : 'in_progress',
    creation: parseCreation(r.creation),
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
  `${base}/lms/pal/application-lab/creation/chapter/${encodeURIComponent(String(chapterId))}${tail}`;

const headers = (ctx: ReturnType<typeof buildSessionContext>, contentType?: string): HeadersInit => ({
  ...createAuthHeaders(ctx, contentType),
  'X-Requested-With': 'XMLHttpRequest',
});

export async function fetchStudentCreation(
  chapterId: string | number,
  scope: ActivityScope,
  signal?: AbortSignal
): Promise<{ concepts: ChapterConcept[]; record: CreationRecord | null }> {
  const ctx = context();
  const params = new URLSearchParams();
  appendCommonParams(params, ctx);
  if (ctx.userId) params.set('user_id', ctx.userId);
  addScope(params, scope);
  const response = await fetch(`${url(ctx.baseUrl, chapterId)}?${params.toString()}`, { headers: headers(ctx), signal });
  if (!response.ok) throw new Error('Couldn’t load your activity. Try again.');
  const payload = rec(await response.json());
  return {
    concepts: arr(payload.concepts).map((c) => ({
      name: readString(rec(c).name), description: readString(rec(c).description), taught: rec(c).taught === true,
    })),
    record: parseRecord(payload.record),
  };
}

type Outcome = { record: CreationRecord | null; message: string | null };

const wire = (c: Creation) =>
  JSON.stringify({ focus: c.focus, title: c.title, frames: c.frames, answers: c.answers, log: c.log, actions: c.actions, phase: c.phase });

async function post(chapterId: string | number, scope: ActivityScope, tail: string, creation: Creation, extra: Record<string, string>, failure: string): Promise<Outcome> {
  const ctx = context();
  const body = new URLSearchParams();
  appendCommonParams(body, ctx);
  if (ctx.userId) body.set('user_id', ctx.userId);
  addScope(body, scope);
  body.set('creation_json', wire(creation));
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

export const saveStudentCreation = (chapterId: string | number, scope: ActivityScope, creation: Creation, fresh = false) =>
  post(chapterId, scope, '/save', creation, fresh ? { fresh: '1' } : {}, 'Couldn’t save your work.');

export const submitStudentCreation = (chapterId: string | number, scope: ActivityScope, creation: Creation) =>
  post(chapterId, scope, '/submit', creation, {}, 'Couldn’t submit your work. Try again.');

// --- real pictures for what the student typed ------------------------------------------

export interface PictureHit {
  url: string;
  credit: string;
  title: string;
}

/** Openly licensed photographs of a word, with their credit. Empty when none were found or the service was busy. */
export async function searchPictures(query: string, signal?: AbortSignal): Promise<PictureHit[]> {
  const ctx = context();
  const params = new URLSearchParams();
  appendCommonParams(params, ctx);
  if (ctx.userId) params.set('user_id', ctx.userId);
  params.set('q', query);
  const response = await fetch(`${ctx.baseUrl}/lms/pal/application-lab/pictures?${params.toString()}`, { headers: headers(ctx), signal });
  if (!response.ok) return [];
  const payload = rec(await response.json());
  return arr(payload.pictures)
    .map((p) => ({ url: readString(rec(p).url), credit: readString(rec(p).credit), title: readString(rec(p).title) }))
    .filter((p) => /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(p.url));
}
