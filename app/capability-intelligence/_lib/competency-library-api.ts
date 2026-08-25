'use client';

/**
 * Competency Library API client.
 *
 * Ported from G2G's `services/competency/library.ts` — backed by the
 * modern Laravel `CompetencyLibraryCrudController` (`/competency-library/*`,
 * NOT the legacy `skill_library/*` routes):
 *   GET    /competency-library/competency-list  - paginated list (+ filters/sort)
 *   GET    /competency-library/competency/{id}   - single competency
 *   POST   /competency-library/competency        - create
 *   PUT    /competency-library/competency/{id}    - update
 *   DELETE /competency-library/competency/{id}    - soft delete
 *
 * This is an EXACT as-is migration of these five endpoints: paths, methods,
 * field names and response shapes are preserved exactly as in G2G, same
 * transport pattern as `certifications-api.ts` / `command-center-api.ts`.
 *
 * UPDATE (this session) — `getDetail`, `exportRows`, `importRows`, `clone`
 * and `archive` are now confirmed-live and ported below, backed by
 * `CompetencyLibraryCrudController::detail/exportRows/importRows/clone/archive`
 * (`GET .../competency/{id}/detail`, `GET .../competency-export`,
 * `POST .../competency-import`, `POST .../competency/{id}/clone`,
 * `PUT .../competency/{id}/archive` — all registered in
 * `routes/competency_management.php` under the `competency-library` prefix).
 * The import response shape is `{ imported, skipped, details: [{row, name,
 * reason}] }` (confirmed from the controller), NOT G2G's `{created, skipped,
 * errors}` shape — `CompetencyImportResult` below matches the backend.
 *
 * The framework picker (`GET /competency/frameworks`), the KASBA item
 * composer (`competencyLibrariesService.list` per dimension) and the
 * taxonomy manager (`useTaxonomy('skill')`) are wired in the screen from
 * `framework-studio-api.ts` / `libraries-taxonomy-api.ts` respectively — both
 * already ported for the sibling Capability Library / Framework screens, so
 * not duplicated here. The approval workflow (`useApprovalTrail`,
 * `useSubmitForApproval`) lives in `competency-extras-api.ts` /
 * `use-competency-extras.ts`, extended with a `subject_type='competency'`
 * trail lookup for this screen.
 *
 * TS types are kept inline here (not a shared types file), matching
 * `certifications-api.ts` / `command-center-api.ts` convention.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client';

export { buildSessionContext };
export type { SessionContext };

// ---------------------------------------------------------------------------
// Low-level transport (copied verbatim from certifications-api.ts)
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function messageFrom(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const message = (payload as ApiEnvelope).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

async function request<T>(
  session: SessionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options?: { params?: Record<string, string | undefined>; body?: unknown },
): Promise<T> {
  const search = new URLSearchParams();
  Object.entries(options?.params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, value);
  });

  const url = `${session.baseUrl}/api${path}${search.toString() ? `?${search.toString()}` : ''}`;

  const response = await fetch(url, {
    method,
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    const errors = payload && typeof payload === 'object' && 'errors' in (payload as Record<string, unknown>)
      ? (payload as { errors?: Record<string, string[]> }).errors
      : undefined;
    throw new ApiError(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`), response.status, errors);
  }

  return payload as T;
}

const apiGet = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'GET', path, { params });
const apiPost = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'POST', path, { body });
const apiPut = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'PUT', path, { body });
const apiDelete = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'DELETE', path, { params });

/**
 * Standard Laravel context params, mirroring G2G's `withLaravelParams`.
 * See the adaptation note in `certifications-api.ts` for why
 * `organization_id` / `org_type` / `profile_id` are omitted.
 */
function contextParams(session: SessionContext, extra?: Record<string, string | undefined>): Record<string, string> {
  const params: Record<string, string> = {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    financial_year: session.syear,
    user_id: session.userId,
    type: 'API',
  };
  Object.entries(extra ?? {}).forEach(([key, value]) => {
    if (value !== undefined) params[key] = value;
  });
  return params;
}

/** Serialise a mixed param bag into the string map, dropping blanks — same as G2G's `toStringParams`. */
function toStringParams(input: Record<string, string | number | undefined | null>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized === '') continue;
    out[key] = normalized;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Types (ported from G2G's services/competency/library.ts)
// ---------------------------------------------------------------------------

export interface CompetencyLibraryApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

export interface CompetencyLibraryPagination {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface CompetencyLibraryListResponse<T> extends CompetencyLibraryApiResponse<T> {
  pagination: CompetencyLibraryPagination;
}

/** One capability item in a competency's composition (present on show()). */
export interface CompetencyKasbaItem {
  kasba_type: 'skill' | 'knowledge' | 'ability' | 'attitude' | 'behaviour';
  item_id: number | null;
  item_label: string | null;
  weight: number | string | null;
}

/** A competency row as returned by the list / show endpoints. */
export interface CompetencyLibraryItem {
  id: number;
  name: string;
  description: string | null;
  /** The competency's own taxonomy: which framework it is filed under. */
  framework_id?: number | null;
  /** The KASBA composition, present on the single-record show() response. */
  items?: CompetencyKasbaItem[];
  category: string | null;
  sub_category: string | null;
  competency_type: string | null;
  proficiency_level: string | null;
  department: string | null;
  department_id: number | null;
  /** s_users_skills.status - Active | Inactive */
  status: string | null;
  /** s_users_skills.approve_status - Approved | Pending | Cancelled | Rejected */
  approve_status: string | null;
  owner: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by?: number | null;
  /** Detail columns, present only on the single-record show() response. */
  job_titles?: string | null;
  related_skills?: string | null;
  learning_resources?: string | null;
  bussiness_links?: string | null;
  assesment_method?: string | null;
  certification_qualifications?: string | null;
  experience_project?: string | null;
  sop_practice_link?: string | null;
  custom_tags?: string | null;
}

export type CompetencySortField =
  | 'title'
  | 'category'
  | 'competency_type'
  | 'approve_status'
  | 'updated_at'
  | 'created_at';

export interface CompetencyLibraryListParams {
  search?: string;
  category?: string;
  competency_type?: string;
  /** filters on approve_status: Approved | Pending | Cancelled | Rejected */
  status?: string;
  sort?: CompetencySortField;
  direction?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface CompetencyKasbaItemInput {
  kasba_type: 'knowledge' | 'ability' | 'skill' | 'behaviour' | 'attitude';
  item_id?: number | null;
  item_label?: string | null;
  weight?: number;
}

export interface CompetencyLibraryPayload {
  name: string;
  code?: string;
  framework_id?: number | null;
  items?: CompetencyKasbaItemInput[];
  description?: string;
  category?: string;
  sub_category?: string;
  competency_type?: string;
  proficiency_level?: string;
  department?: string;
  department_id?: string | number;
  status?: string;
  bussiness_links?: string;
  learning_resources?: string;
  assesment_method?: string;
  certification_qualifications?: string;
  experience_project?: string;
  sop_practice_link?: string;
  related_skills?: string;
  custom_tags?: string;
}

/* -- Detail panel (Proficiency / Associations / Attachments / History tabs) -- */
export interface CompetencyDetailLevel {
  level: number;
  label: string;
  name: string | null;
  description: string | null;
}
export interface CompetencyAssociationRole {
  jobrole: string;
  proficiency_level: string | null;
}
export interface CompetencyAssociationFramework {
  id: number;
  name: string;
  status: string;
  required_proficiency: string | null;
}
export interface CompetencyAttachment {
  type: string;
  value: string;
}
export interface CompetencyHistoryEntry {
  action: string;
  by: string;
  date: string;
}
/** The Overview tab's Summary block - where this competency is actually in use. */
export interface CompetencySummary {
  description: string | null;
  category: string | null;
  sub_category: string | null;
  competency_type: string | null;
  status: string | null;
  role_count: number;
  framework_count: number;
  rated_employees: number;
  plan_count: number;
  certification_count: number;
  assessment_count: number;
  learning_count: number;
  evidence_count: number;
}

/** A row of the Overview tab's "Top Associated Roles" block. */
export interface CompetencyTopRole {
  jobrole: string;
  proficiency_level: string | null;
  department: string | null;
}

export interface CompetencyDetail {
  summary: CompetencySummary;
  top_roles: CompetencyTopRole[];
  proficiency: { scale_label: string | null; scope: string; levels: CompetencyDetailLevel[] };
  associations: {
    roles: CompetencyAssociationRole[];
    frameworks: CompetencyAssociationFramework[];
    role_count: number;
    framework_count: number;
  };
  /** Backend returns [] unconditionally — no free-text attachment columns exist on `competency`. */
  attachments: CompetencyAttachment[];
  history: CompetencyHistoryEntry[];
}

/** One row of a parsed import file. */
export interface CompetencyImportRow {
  name: string;
  description?: string;
  category?: string;
  sub_category?: string;
  competency_type?: string;
  proficiency_level?: string;
}

/**
 * CONFIRMED exact backend shape (`CompetencyLibraryCrudController::importRows`):
 * `{ imported, skipped, details: [{row, name, reason}] }` — NOT G2G's
 * `{created, skipped, errors}`.
 */
export interface CompetencyImportResult {
  imported: number;
  skipped: number;
  details: { row: number; name: string; reason: string }[];
}

const BASE = '/competency-library';

/**
 * `CompetencyLibraryListParams` carries `sort`/`direction` (matching G2G's
 * own param names), but `CompetencyLibraryCrudController::index/exportRows`
 * read `sort_by`/`sort_dir` (confirmed by reading the controller). Renamed
 * here, at the transport boundary, rather than in the params type or the
 * screen — the screen's own vocabulary (and G2G's) is `sort`/`direction`;
 * only the query string this backend expects differs.
 */
function sortParams({ sort, direction, ...rest }: CompetencyLibraryListParams) {
  return { ...rest, sort_by: sort, sort_dir: direction };
}

export const competencyLibraryService = {
  list: (session: SessionContext, params?: CompetencyLibraryListParams) =>
    apiGet<CompetencyLibraryListResponse<CompetencyLibraryItem[]>>(
      session,
      `${BASE}/competency-list`,
      contextParams(session, toStringParams(sortParams({ ...params }))),
    ),

  get: (session: SessionContext, id: number) =>
    apiGet<CompetencyLibraryApiResponse<CompetencyLibraryItem>>(
      session,
      `${BASE}/competency/${id}`,
      contextParams(session),
    ),

  create: (session: SessionContext, payload: CompetencyLibraryPayload) =>
    apiPost<CompetencyLibraryApiResponse<{ id: number }>>(session, `${BASE}/competency`, {
      ...contextParams(session),
      ...payload,
    }),

  update: (session: SessionContext, id: number, payload: CompetencyLibraryPayload) =>
    apiPut<CompetencyLibraryApiResponse<{ id: number }>>(session, `${BASE}/competency/${id}`, {
      ...contextParams(session),
      ...payload,
    }),

  remove: (session: SessionContext, id: number) =>
    apiDelete<CompetencyLibraryApiResponse<null>>(session, `${BASE}/competency/${id}`, contextParams(session)),

  getDetail: (session: SessionContext, id: number) =>
    apiGet<CompetencyLibraryApiResponse<CompetencyDetail>>(session, `${BASE}/competency/${id}/detail`, contextParams(session)),

  /** Every row matching the current filters, for "Export Library" (no pagination). */
  exportRows: (session: SessionContext, params?: CompetencyLibraryListParams) =>
    apiGet<CompetencyLibraryApiResponse<CompetencyLibraryItem[]>>(
      session,
      `${BASE}/competency-export`,
      contextParams(session, toStringParams(sortParams({ ...params }))),
    ),

  /** Bulk-create from a file parsed in the browser ("Import Competencies"). */
  importRows: (session: SessionContext, rows: CompetencyImportRow[]) =>
    apiPost<CompetencyLibraryApiResponse<CompetencyImportResult>>(session, `${BASE}/competency-import`, {
      ...contextParams(session),
      rows,
    }),

  /** Duplicate a competency as a new draft library entry. */
  clone: (session: SessionContext, id: number, name?: string) =>
    apiPost<CompetencyLibraryApiResponse<{ id: number; name: string }>>(session, `${BASE}/competency/${id}/clone`, {
      ...contextParams(session),
      ...(name ? { name } : {}),
    }),

  /**
   * Archive (approve_status = Cancelled) or restore. Not a delete: the
   * competency stays referenced by role mappings, frameworks and assessments.
   */
  archive: (session: SessionContext, id: number, restore = false) =>
    apiPut<CompetencyLibraryApiResponse<{ id: number; approve_status: string }>>(session, `${BASE}/competency/${id}/archive`, {
      ...contextParams(session),
      restore,
    }),
};
