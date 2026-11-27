import { appendCommonParams, buildSessionContext, createAuthHeaders, readNumber, readString } from '@/lib/erp-client';
import type { LabSpec } from '@/lib/experiment-builder/spec';

/**
 * Lab Studio (teachers and admins only): prepare, preview and approve the virtual labs students use.
 *
 *   GET  /lms/pal/lab-studio/chapter/{chapterId}   versions + the chapter's concepts
 *   GET  /lms/pal/lab-studio/lab?id=… | ?key=…     one version with its checks, expected results and key
 *   POST /lms/pal/lab-studio/validate              check a specification (nothing saved)
 *   POST /lms/pal/lab-studio/generate              AI draft, saved as a DRAFT
 *   POST /lms/pal/lab-studio/save                  edit = a NEW draft version
 *   POST /lms/pal/lab-studio/approve/{id}  ·  reject/{id}
 *
 * The server refuses students with 403 on every one of these.
 */

export type LabStatus = 'draft' | 'approved' | 'retired' | 'rejected';

export interface Validation {
  errors: string[];
  warnings: string[];
  stats: { combinations?: number; min?: number | null; max?: number | null; clamped?: number };
}

export interface LabVersionRow {
  id: number | null;
  labKey: string;
  version: number;
  status: LabStatus;
  source: 'builtin' | 'ai' | 'teacher';
  title: string;
  approvedAt: string | null;
  rejectReason: string | null;
  /** The concepts this lab is mapped to, and whether it opens for a concept scope or only for the whole chapter. */
  concepts: string[];
  scopeLevel: 'concepts' | 'chapter';
}

export interface PreviewSetting {
  key: string;
  label: string;
  item: string;
  default: string;
  options: { value: string; label: string; result: number }[];
  keyEffect: string | null;
  keyDirection: string | null;
  keyFrom: string | null;
  keyTo: string | null;
}

export interface LabPreview {
  unit: string;
  measure: string;
  baseline: number;
  settings: PreviewSetting[];
  smallest: { value: number; settings: Record<string, string> } | null;
  largest: { value: number; settings: Record<string, string> } | null;
  conceptFocus: string;
}

/** The full specification, including the marker's key; only a teacher ever receives this. */
export type FullSpec = LabSpec & { marker?: { expected: { setting: string; effect: string; direction: string; from?: string; to?: string }[]; concept_focus: string } };

export interface LabDetail {
  id: number | null;
  labKey: string;
  version: number;
  status: LabStatus;
  source: string;
  spec: FullSpec;
  validation: Validation;
  preview: LabPreview | null;
  rejectReason: string | null;
}

export interface StudioIndex {
  storageReady: boolean;
  chapter: { id: number; name: string; subject: string; standard: string; concepts: { name: string; description: string }[] };
  versions: LabVersionRow[];
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown) => arr(v).map((x) => readString(x)).filter((x) => x !== '');

function context() {
  const ctx = buildSessionContext();
  if (!ctx.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  return ctx;
}

const base = (ctx: ReturnType<typeof buildSessionContext>) => `${ctx.baseUrl}/lms/pal/lab-studio`;
const headers = (ctx: ReturnType<typeof buildSessionContext>, contentType?: string): HeadersInit => ({ ...createAuthHeaders(ctx, contentType), 'X-Requested-With': 'XMLHttpRequest' });

async function get(path: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const ctx = context();
  const q = new URLSearchParams();
  appendCommonParams(q, ctx);
  if (ctx.userId) q.set('user_id', ctx.userId);
  Object.entries(params).forEach(([k, v]) => q.set(k, v));
  const response = await fetch(`${base(ctx)}${path}?${q.toString()}`, { headers: headers(ctx) });
  const payload = rec(await response.json().catch(() => ({})));
  if (!response.ok) throw new Error(response.status === 403 ? 'Only teachers and admins can prepare labs.' : readString(payload.message) || 'Something went wrong. Try again.');
  return payload;
}

async function post(path: string, fields: Record<string, string>): Promise<Record<string, unknown>> {
  const ctx = context();
  const body = new URLSearchParams();
  appendCommonParams(body, ctx);
  if (ctx.userId) body.set('user_id', ctx.userId);
  Object.entries(fields).forEach(([k, v]) => body.set(k, v));
  const response = await fetch(`${base(ctx)}${path}`, { method: 'POST', headers: headers(ctx, 'application/x-www-form-urlencoded'), body: body.toString() });
  const payload = rec(await response.json().catch(() => ({})));
  if (!response.ok) {
    const errors = strs(payload.errors);
    throw new Error([readString(payload.message) || 'Something went wrong. Try again.', ...errors].join(' '));
  }
  return payload;
}

function parseValidation(raw: unknown): Validation {
  const v = rec(raw);
  const s = rec(v.stats);
  return {
    errors: strs(v.errors),
    warnings: strs(v.warnings),
    stats: { combinations: typeof s.combinations === 'number' ? s.combinations : undefined, min: typeof s.min === 'number' ? s.min : null, max: typeof s.max === 'number' ? s.max : null, clamped: typeof s.clamped === 'number' ? s.clamped : undefined },
  };
}

function parsePreview(raw: unknown): LabPreview | null {
  const p = rec(raw);
  if (!Array.isArray(p.settings)) return null;
  const extreme = (e: unknown) => {
    const x = rec(e);
    if (typeof x.value !== 'number') return null;
    const settings: Record<string, string> = {};
    Object.entries(rec(x.settings)).forEach(([k, v]) => {
      settings[k] = readString(v);
    });
    return { value: x.value, settings };
  };
  return {
    unit: readString(p.unit), measure: readString(p.measure), baseline: readNumber(p.baseline),
    settings: arr(p.settings).map((s) => {
      const r = rec(s);
      return {
        key: readString(r.key), label: readString(r.label), item: readString(r.item), default: readString(r.default),
        options: arr(r.options).map((o) => ({ value: readString(rec(o).value), label: readString(rec(o).label), result: readNumber(rec(o).result) })),
        keyEffect: readString(r.key_effect) || null, keyDirection: readString(r.key_direction) || null,
        keyFrom: readString(r.key_from) || null, keyTo: readString(r.key_to) || null,
      };
    }),
    smallest: extreme(p.smallest), largest: extreme(p.largest), conceptFocus: readString(p.concept_focus),
  };
}

function parseDetail(raw: unknown): LabDetail {
  const l = rec(raw);
  return {
    id: typeof l.id === 'number' ? l.id : null,
    labKey: readString(l.lab_key), version: readNumber(l.version), status: readString(l.status) as LabStatus, source: readString(l.source),
    spec: l.spec as FullSpec, validation: parseValidation(l.validation), preview: parsePreview(l.preview), rejectReason: readString(l.reject_reason) || null,
  };
}

export async function fetchStudioIndex(chapterId: string | number): Promise<StudioIndex> {
  const p = await get(`/chapter/${encodeURIComponent(String(chapterId))}`);
  const c = rec(p.chapter);
  return {
    storageReady: p.storage_ready === true,
    chapter: {
      id: readNumber(c.id), name: readString(c.name), subject: readString(c.subject), standard: readString(c.standard),
      concepts: arr(c.concepts).map((x) => ({ name: readString(rec(x).name), description: readString(rec(x).description) })),
    },
    versions: arr(p.versions).map((v) => {
      const r = rec(v);
      return {
        id: typeof r.id === 'number' ? r.id : null, labKey: readString(r.lab_key), version: readNumber(r.version), status: readString(r.status) as LabStatus,
        source: readString(r.source) as LabVersionRow['source'], title: readString(r.title), approvedAt: readString(r.approved_at) || null, rejectReason: readString(r.reject_reason) || null,
        concepts: strs(r.concepts), scopeLevel: r.scope_level === 'chapter' ? 'chapter' : 'concepts',
      };
    }),
  };
}

export async function fetchStudioLab(ref: { id: number } | { key: string }): Promise<LabDetail> {
  const p = await get('/lab', 'id' in ref ? { id: String(ref.id) } : { key: ref.key });
  return parseDetail(p.lab);
}

export async function checkSpecText(specJson: string): Promise<{ validation: Validation; preview: LabPreview | null }> {
  const p = await post('/validate', { spec_json: specJson });
  return { validation: parseValidation(p.validation), preview: parsePreview(p.preview) };
}

/** An AI draft for the concepts the teacher chose (or the whole chapter), saved as a DRAFT. */
export async function generateLab(chapterId: number, note: string, concepts: string[] = [], level: 'concepts' | 'chapter' = 'concepts'): Promise<LabDetail> {
  const ctx = context();
  const body = new URLSearchParams();
  appendCommonParams(body, ctx);
  if (ctx.userId) body.set('user_id', ctx.userId);
  body.set('chapter_id', String(chapterId));
  body.set('note', note);
  body.set('level', level);
  concepts.forEach((c) => body.append('concepts[]', c));
  const response = await fetch(`${base(ctx)}/generate`, { method: 'POST', headers: headers(ctx, 'application/x-www-form-urlencoded'), body: body.toString() });
  const payload = rec(await response.json().catch(() => ({})));
  if (!response.ok) throw new Error(readString(payload.message) || 'Something went wrong. Try again.');
  const p = payload;
  return parseDetail(p.lab);
}

export async function saveSpecText(specJson: string): Promise<LabDetail> {
  const p = await post('/save', { spec_json: specJson });
  return parseDetail(p.lab);
}

export async function approveLab(id: number): Promise<LabDetail> {
  const p = await post(`/approve/${id}`, {});
  return parseDetail(p.lab);
}

export async function rejectLab(id: number, reason: string): Promise<void> {
  await post(`/reject/${id}`, { reason });
}
