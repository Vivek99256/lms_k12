import {
  buildSessionContext,
  createAuthHeaders,
  normalizeApiStatus,
  readNumber,
  readString,
  type SessionContext,
} from '@/lib/erp-client';

/**
 * LMS → Leader Board Master data layer (leaderboard\lbMasterController, `lb_master`).
 *
 *   GET    /lms/lb_master?type=API&sub_institute_id           → list
 *   POST   /lms/lb_master     (type=API)                      → create → {status,message}
 *   POST   /lms/lb_master/{id} (type=API, _method=PUT)        → update → {status,message}
 *   DELETE /lms/lb_master/{id}?type=API                       → delete → {status,message}
 *
 * Admin config of points per (grade, standard, module). Dedup is on
 * (sub_institute_id, grade_id, standard_id, module_name). `per_value` is only
 * saved on CREATE (and only relevant for exampass/examfail); update ignores it.
 * getData/store/update now read sub_institute_id from the request (headless fallback).
 */

function requireSession(): SessionContext {
  const session = buildSessionContext();
  if (!session.baseUrl) throw new Error('Session data is missing. Please sign in again.');
  return session;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function readJson(res: Response, fallback: string): Promise<unknown> {
  const text = (await res.text()).trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${fallback} (HTTP ${res.status}).`);
  }
}

// ---------------------------------------------------------------------------
// Options (mirror the Laravel add_lbmaster Blade)
// ---------------------------------------------------------------------------

export const MODULE_OPTIONS = [
  { value: 'login', label: 'Login' },
  { value: 'exampass', label: 'Exam Passed' },
  { value: 'examfail', label: 'Exam Failed' },
  { value: 'homework', label: 'Homework' },
];

/** Modules where `per_value` (percentage) applies. */
export const PER_VALUE_MODULES = ['exampass', 'examfail'];

/** FontAwesome unicode values stored by Laravel → friendly labels (FA font isn't loaded here). */
export const ICON_OPTIONS = [
  { value: 'xf091', label: 'Trophy' },
  { value: 'xf005', label: 'Star' },
  { value: 'xf089', label: 'Half Star' },
  { value: 'xf118', label: 'Good' },
  { value: 'xf164', label: 'Thumbs Up' },
  { value: 'xf165', label: 'Thumbs Down' },
  { value: 'xf11a', label: 'Bad' },
];

export function moduleLabel(value: string): string {
  return MODULE_OPTIONS.find((m) => m.value === value)?.label ?? value;
}
export function iconLabel(value: string): string {
  return ICON_OPTIONS.find((i) => i.value === value)?.label ?? value;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LbMasterRow {
  id: string;
  gradeId: string;
  standardId: string;
  academicSection: string;
  standard: string;
  moduleName: string;
  perValue: number;
  description: string;
  points: number;
  icon: string;
  status: string;
}

export interface LbMasterInput {
  gradeId: string;
  standardId: string;
  moduleName: string;
  perValue: string;
  description: string;
  points: string;
  icon: string;
  showHide: boolean;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function fetchLbMasters(signal?: AbortSignal): Promise<LbMasterRow[]> {
  const session = requireSession();

  const url = new URL(`${session.baseUrl}/lms/lb_master`);
  url.searchParams.set('type', 'API');
  url.searchParams.set('sub_institute_id', session.subInstituteId);
  url.searchParams.set('syear', session.syear);

  const res = await fetch(url.toString(), {
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to load the leader board master.`);
  const raw = toRecord(await readJson(res, 'Failed to load the leader board master'));

  return toArray(raw.data).map((entry) => {
    const r = toRecord(entry);
    return {
      id: readString(r.id),
      gradeId: readString(r.grade_id),
      standardId: readString(r.standard_id),
      academicSection: readString(r.title),
      standard: readString(r.name),
      moduleName: readString(r.module_name),
      perValue: readNumber(r.per_value),
      description: readString(r.description),
      points: readNumber(r.points),
      icon: readString(r.icon),
      status: readString(r.status),
    };
  });
}

// ---------------------------------------------------------------------------
// Create / Update / Delete
// ---------------------------------------------------------------------------

function buildBody(session: SessionContext, input: LbMasterInput): URLSearchParams {
  const body = new URLSearchParams();
  body.set('type', 'API');
  body.set('sub_institute_id', session.subInstituteId);
  body.set('grade', input.gradeId);
  body.set('standard', input.standardId);
  body.set('module_name', input.moduleName);
  body.set('description', input.description);
  body.set('points', input.points || '0');
  body.set('icon', input.icon);
  if (input.showHide) body.set('show_hide', '1'); // maps to `status`
  // per_value applies to exampass/examfail on both create AND update (backend now
  // persists it on update too). Other modules omit it → backend defaults to 0.
  if (PER_VALUE_MODULES.includes(input.moduleName)) {
    body.set('per_value', input.perValue || '0');
  }
  return body;
}

export async function saveLbMaster(input: LbMasterInput, id?: string): Promise<string> {
  const session = requireSession();
  const isUpdate = !!id;
  const body = buildBody(session, input);
  if (isUpdate) body.set('_method', 'PUT');

  const target = isUpdate
    ? `${session.baseUrl}/lms/lb_master/${encodeURIComponent(id)}`
    : `${session.baseUrl}/lms/lb_master`;

  const res = await fetch(target, {
    method: 'POST',
    headers: {
      ...createAuthHeaders(session, 'application/x-www-form-urlencoded'),
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to save.`);
  const raw = toRecord(await readJson(res, 'Failed to save'));
  // status 0 = "Leader board Master Already Exist" (dedup) → surface as error.
  if (normalizeApiStatus(raw) === '0') throw new Error(readString(raw.message) || 'Already exists for this class/module.');
  return readString(raw.message) || (isUpdate ? 'Updated.' : 'Saved.');
}

export async function deleteLbMaster(id: string): Promise<string> {
  const session = requireSession();
  const url = new URL(`${session.baseUrl}/lms/lb_master/${encodeURIComponent(id)}`);
  url.searchParams.set('type', 'API');

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: { ...createAuthHeaders(session), 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Unable to delete.`);
  const raw = toRecord(await readJson(res, 'Failed to delete'));
  return readString(raw.message) || 'Deleted.';
}
