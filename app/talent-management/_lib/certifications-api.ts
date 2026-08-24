'use client';

/**
 * Certification & Compliance Center API client.
 *
 * Ported from G2G's `services/competency/certifications.ts` — backed by the
 * Laravel competency certification API:
 *   GET    /competency/certifications                        - list (+ filters/sort/pagination)
 *   GET    /competency/certifications/metrics                - the five KPI cards
 *   GET    /competency/certifications/filters                - filter select options
 *   GET    /competency/certifications/export                 - every filtered row, uncapped
 *   POST   /competency/certifications/bulk                   - bulk verify/reject/status/revoke/delete
 *   POST   /competency/certifications                        - create
 *   GET    /competency/certifications/{id}                   - Overview tab
 *   PUT    /competency/certifications/{id}                   - edit / update status / verify / revoke
 *   DELETE /competency/certifications/{id}                   - soft delete
 *   POST   /competency/certifications/{id}/notes             - append a note
 *   GET    /competency/certifications/{id}/compliance        - Compliance tab
 *   GET    /competency/certifications/{id}/requirements      - Requirements tab
 *   GET    /competency/certifications/{id}/history           - History tab
 *   GET|POST /competency/certifications/{id}/documents       - Documents tab
 *   DELETE /competency/certifications/{id}/documents/{docId}
 *   GET|POST|PUT|DELETE /competency/certification-requirements[/{id}]
 *   GET    /competency/employee-options                      - employee picker
 *
 * This is an EXACT as-is migration: endpoint paths, HTTP methods, query/body
 * field names and response shapes are preserved exactly as in G2G, per the
 * same rule already applied to `recruitment-api.ts`. Only the transport
 * changed: native `fetch` + this project's `buildSessionContext()` /
 * `createAuthHeaders()` (see `lib/erp-client.ts`) instead of G2G's
 * `apiClient` + `LaravelContext`.
 *
 * TS types are kept inline here (rather than in `talent-types.ts`) per the
 * migration instructions, to avoid a concurrent-edit collision with sibling
 * screens being ported at the same time.
 *
 * Adaptation from G2G: `withLaravelParams` also sent `organization_id`,
 * `org_type` and `profile_id`, sourced from G2G's richer `LaravelContext`.
 * This repo's `SessionContext` (lib/erp-client.ts) carries no equivalent
 * fields, so those three are omitted here — same adaptation as
 * `recruitment-api.ts`'s `contextParams`.
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
// Low-level transport (copied verbatim from recruitment-api.ts)
// ---------------------------------------------------------------------------

/** Laravel replies with {message, errors} on 4xx — mirrors G2G's `ApiError`. */
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
  options?: { params?: Record<string, string | undefined>; body?: unknown; form?: FormData; headers?: Record<string, string> },
): Promise<T> {
  const search = new URLSearchParams();
  Object.entries(options?.params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, value);
  });

  const url = `${session.baseUrl}/api${path}${search.toString() ? `?${search.toString()}` : ''}`;

  const isForm = Boolean(options?.form);
  const response = await fetch(url, {
    method,
    cache: 'no-store',
    headers: {
      ...createAuthHeaders(session, isForm ? undefined : 'application/json'),
      ...options?.headers,
    },
    body: isForm ? options?.form : options?.body !== undefined ? JSON.stringify(options.body) : undefined,
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
const apiPost = <T,>(session: SessionContext, path: string, body: unknown, headers?: Record<string, string>) =>
  request<T>(session, 'POST', path, { body, headers });
const apiPut = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'PUT', path, { body });
const apiDelete = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'DELETE', path, { params });
/** Multipart create. */
const apiPostForm = <T,>(session: SessionContext, path: string, form: FormData) =>
  request<T>(session, 'POST', path, { form });

/**
 * Standard Laravel context params, mirroring G2G's `withLaravelParams`.
 * See the adaptation note in the header comment.
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
// Types (ported from G2G's services/competency/certifications.ts)
// ---------------------------------------------------------------------------

export interface CertificationApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

export interface CertificationPagination {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface CertificationListResponse<T> extends CertificationApiResponse<T> {
  pagination: CertificationPagination;
}

/** valid | expiring | expired | revoked */
export type CertificationStatus = 'valid' | 'expiring' | 'expired' | 'revoked';
/** pending | verified | rejected */
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
/** compliant | expiring | non_compliant */
export type ComplianceKey = 'compliant' | 'expiring' | 'non_compliant';

/** A certification row as returned by list / export / show. */
export interface CertificationItem {
  id: number;
  name: string;
  user_id: number | null;
  employee_name: string | null;
  employee_initials: string | null;
  employee_no: string | null;
  department_id: number | null;
  department: string | null;
  jobrole: string | null;
  issuing_body: string | null;
  certification_type: string | null;
  credential_id: string | null;
  competency_id: number | null;
  requirement_id: number | null;
  status: CertificationStatus | string;
  status_label: string;
  compliance: string;
  compliance_key: ComplianceKey;
  compliance_reason: string;
  verification_status: VerificationStatus | null;
  issued_date: string | null;
  expiry_date: string | null;
  issued_date_label: string | null;
  expiry_date_label: string | null;
  days_to_expiry: number | null;
  notes: string | null;
  created_at: string | null;
}

export interface CertificationEmployee {
  id: number;
  name: string;
  initials: string;
  employee_no: string | null;
  email: string | null;
  jobrole: string | null;
  department: string | null;
}

/** show() returns the list row plus the panel-only joins. */
export interface CertificationDetail extends CertificationItem {
  employee: CertificationEmployee | null;
  requirement: { id: number; name: string } | null;
  competency: string | null;
}

export interface CertificationMetrics {
  total: number;
  compliant_employees: number;
  employees_evaluated: number;
  compliant_percent: number;
  expiring_soon: number;
  expiring_window_days: number;
  expired: number;
  pending_verification: number;
  revoked: number;
  verified: number;
  requirements: number;
}

export interface CertificationFilterOption {
  value: string;
  label: string;
}

export interface CertificationFilterOptions {
  departments: CertificationFilterOption[];
  certification_types: CertificationFilterOption[];
  issuing_bodies: CertificationFilterOption[];
  jobroles: CertificationFilterOption[];
  statuses: CertificationFilterOption[];
  compliance: CertificationFilterOption[];
  expiry_windows: CertificationFilterOption[];
  verification: CertificationFilterOption[];
}

export interface CertificationRequirement {
  id: number;
  name: string;
  certification_type: string | null;
  issuing_body: string | null;
  description: string | null;
  department_id: number | null;
  department?: string | null;
  jobrole: string | null;
  competency_id: number | null;
  is_mandatory: boolean;
  validity_months: number | null;
  renewal_reminder_days: number | null;
  grace_period_days: number | null;
  status: string;
  scope: string;
  holders?: number;
  created_at?: string | null;
}

/** A requirement as seen from a credential's Requirements tab. */
export interface CertificationRequirementMatch extends CertificationRequirement {
  is_met: boolean;
  held_certification_id: number | null;
  held_status: string;
  held_expiry: string | null;
  is_current: boolean;
}

export interface RequirementSummary {
  total: number;
  met: number;
  unmet: number;
  mandatory: number;
  met_percent: number;
}

export interface CertificationCompliance {
  compliance: string;
  compliance_key: ComplianceKey;
  reason: string;
  days_to_expiry: number | null;
  validity_percent: number | null;
  issued_date: string | null;
  expiry_date: string | null;
  verification_status: VerificationStatus | null;
  verified_at: string | null;
  verified_by: string | null;
  requirement: CertificationRequirement | null;
  is_required: boolean;
  window_days: number;
  holder: {
    total: number;
    compliant: number;
    expiring: number;
    non_compliant: number;
    is_compliant: boolean;
    missing: string[];
  } | null;
}

export interface CertificationHistoryEntry {
  id: number;
  action: string;
  description: string | null;
  by: string;
  date: string | null;
  at: string | null;
}

export interface CertificationAuditEntry {
  label: string;
  by: string;
  date: string | null;
}

export interface CertificationDocument {
  id: number;
  title: string;
  evidence_type: string | null;
  description: string | null;
  link: string | null;
  file_name: string | null;
  file_url: string | null;
  url: string | null;
  status: string;
  uploaded_by: string | null;
  uploaded_on: string | null;
}

export type CertificationSortField = 'name' | 'status' | 'issued_date' | 'expiry_date' | 'created_at';

export interface CertificationListParams {
  search?: string;
  status?: string;
  compliance?: string;
  expiry_window?: string;
  department_id?: string;
  jobrole?: string;
  certification_type?: string;
  /** Drill-through from a competency's detail panel. */
  competency_id?: string;
  issuing_body?: string;
  verification_status?: string;
  /** the "My Certifications" tab - plain user_id is the context actor */
  user_id_filter?: string | number;
  issued_from?: string;
  issued_to?: string;
  expiry_from?: string;
  expiry_to?: string;
  sort?: CertificationSortField;
  direction?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface CertificationPayload {
  name: string;
  /**
   * The employee who holds the credential. Named _target because plain
   * `user_id` is the Laravel CONTEXT ACTOR on every /competency/* call - sending
   * the holder as `user_id` would let an update reassign the credential to
   * whoever performed it.
   */
  user_id_target?: number | null;
  competency_id?: number | null;
  requirement_id?: number | null;
  issuing_body?: string;
  certification_type?: string;
  credential_id?: string;
  department_id?: number | null;
  jobrole?: string;
  status?: string;
  verification_status?: string;
  issued_date?: string;
  expiry_date?: string;
  notes?: string;
}

export interface CertificationRequirementPayload {
  name: string;
  certification_type?: string;
  issuing_body?: string;
  description?: string;
  department_id?: number | null;
  jobrole?: string;
  competency_id?: number | null;
  is_mandatory?: boolean;
  validity_months?: number | null;
  renewal_reminder_days?: number | null;
  grace_period_days?: number | null;
  status?: string;
}

export type BulkCertificationAction = 'verify' | 'reject' | 'update_status' | 'revoke' | 'delete';

const BASE = '/competency/certifications';
const REQUIREMENTS = '/competency/certification-requirements';

export const certificationService = {
  list: (session: SessionContext, params?: CertificationListParams) =>
    apiGet<CertificationListResponse<CertificationItem[]>>(
      session,
      BASE,
      contextParams(session, toStringParams({ ...params })),
    ),

  /** Every row matching the current filters, for the Export button. */
  exportRows: (session: SessionContext, params?: CertificationListParams) =>
    apiGet<CertificationApiResponse<CertificationItem[]>>(
      session,
      `${BASE}/export`,
      contextParams(session, toStringParams({ ...params })),
    ),

  metrics: (session: SessionContext) =>
    apiGet<CertificationApiResponse<CertificationMetrics>>(session, `${BASE}/metrics`, contextParams(session)),

  filterOptions: (session: SessionContext) =>
    apiGet<CertificationApiResponse<CertificationFilterOptions>>(session, `${BASE}/filters`, contextParams(session)),

  get: (session: SessionContext, id: number) =>
    apiGet<CertificationApiResponse<CertificationDetail>>(session, `${BASE}/${id}`, contextParams(session)),

  create: (session: SessionContext, payload: CertificationPayload) =>
    apiPost<CertificationApiResponse<{ id: number }>>(session, BASE, {
      ...contextParams(session),
      ...payload,
    }),

  update: (session: SessionContext, id: number, payload: Partial<CertificationPayload>) =>
    apiPut<CertificationApiResponse<{ id: number }>>(session, `${BASE}/${id}`, {
      ...contextParams(session),
      ...payload,
    }),

  remove: (session: SessionContext, id: number) =>
    apiDelete<CertificationApiResponse<null>>(session, `${BASE}/${id}`, contextParams(session)),

  bulk: (
    session: SessionContext,
    action: BulkCertificationAction,
    ids: number[],
    status?: string,
  ) =>
    apiPost<CertificationApiResponse<{ affected: number }>>(session, `${BASE}/bulk`, {
      ...contextParams(session),
      action,
      ids,
      ...(status ? { status } : {}),
    }),

  addNote: (session: SessionContext, id: number, note: string) =>
    apiPost<CertificationApiResponse<{ notes: string }>>(session, `${BASE}/${id}/notes`, {
      ...contextParams(session),
      note,
    }),

  compliance: (session: SessionContext, id: number) =>
    apiGet<CertificationApiResponse<CertificationCompliance>>(session, `${BASE}/${id}/compliance`, contextParams(session)),

  requirementsFor: (session: SessionContext, id: number) =>
    apiGet<
      CertificationApiResponse<CertificationRequirementMatch[]> & { summary: RequirementSummary }
    >(session, `${BASE}/${id}/requirements`, contextParams(session)),

  history: (session: SessionContext, id: number) =>
    apiGet<
      CertificationApiResponse<CertificationHistoryEntry[]> & { audit: CertificationAuditEntry[] }
    >(session, `${BASE}/${id}/history`, contextParams(session)),

  documents: (session: SessionContext, id: number) =>
    apiGet<CertificationApiResponse<CertificationDocument[]>>(session, `${BASE}/${id}/documents`, contextParams(session)),

  /**
   * Attach a document. Sent as multipart so the same call covers an uploaded
   * file and an external link; the session context travels in the query
   * string because `apiPostForm` does not merge body params (matches G2G's
   * `apiClient.postForm` behaviour exactly).
   */
  addDocument: (
    session: SessionContext,
    id: number,
    payload: { title: string; description?: string; link?: string; file?: File | null },
  ) => {
    const form = new FormData();
    form.append('title', payload.title);
    if (payload.description) form.append('description', payload.description);
    if (payload.link) form.append('link', payload.link);
    if (payload.file) form.append('file', payload.file);

    return apiPostForm<CertificationApiResponse<{ id: number }>>(
      session,
      `${BASE}/${id}/documents?${new URLSearchParams(contextParams(session)).toString()}`,
      form,
    );
  },

  removeDocument: (session: SessionContext, id: number, documentId: number) =>
    apiDelete<CertificationApiResponse<null>>(session, `${BASE}/${id}/documents/${documentId}`, contextParams(session)),

  /* ------------------------- requirements master ------------------------- */

  listRequirements: (
    session: SessionContext,
    params?: { search?: string; status?: string; department_id?: string; jobrole?: string; per_page?: number },
  ) =>
    apiGet<CertificationListResponse<CertificationRequirement[]>>(
      session,
      REQUIREMENTS,
      contextParams(session, toStringParams({ ...params })),
    ),

  createRequirement: (session: SessionContext, payload: CertificationRequirementPayload) =>
    apiPost<CertificationApiResponse<{ id: number }>>(session, REQUIREMENTS, {
      ...contextParams(session),
      ...payload,
    }),

  updateRequirement: (
    session: SessionContext,
    id: number,
    payload: Partial<CertificationRequirementPayload>,
  ) =>
    apiPut<CertificationApiResponse<{ id: number }>>(session, `${REQUIREMENTS}/${id}`, {
      ...contextParams(session),
      ...payload,
    }),

  removeRequirement: (session: SessionContext, id: number) =>
    apiDelete<CertificationApiResponse<null>>(session, `${REQUIREMENTS}/${id}`, contextParams(session)),

  /** Employee picker, shared with the Development & Career workspace. */
  employeeOptions: (session: SessionContext, search?: string) =>
    apiGet<
      CertificationApiResponse<
        { id: number; name: string; initials: string; employee_no: string | null; jobrole: string | null; department_id: number | null }[]
      >
    >(session, '/competency/employee-options', contextParams(session, toStringParams({ search }))),

  /**
   * Real department list for the "Add Certification Requirement" dialog.
   *
   * Not part of the original G2G port: G2G derived `filters().departments`
   * only from departments already present on existing certification rows,
   * so on a fresh tenant the Department dropdown had nothing to show. This
   * hits a new endpoint (`CertificationRequirementController::departmentOptions`)
   * that lists every real department instead.
   */
  departmentOptions: (session: SessionContext) =>
    apiGet<CertificationApiResponse<{ value: string; label: string }[]>>(
      session,
      `${REQUIREMENTS}/department-options`,
      contextParams(session),
    ),

  /**
   * Job roles for one department — reused from the Development & Career
   * workspace's existing `career-paths/role-options` endpoint
   * (`CareerPathController::roleOptions`) rather than duplicated here.
   */
  roleOptionsByDepartment: (session: SessionContext, departmentId: string) =>
    apiGet<
      CertificationApiResponse<
        { id: number; jobrole: string; job_level: string | null; department: string | null; department_id: number | null }[]
      >
    >(session, '/competency/career-paths/role-options', contextParams(session, { department_id: departmentId })),
};
