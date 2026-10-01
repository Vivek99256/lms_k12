'use client';

/**
 * Compliance Library API client (Organization Management module).
 *
 * Ported UI-wise, screen-for-screen, from G2G's
 * `components/domain/hrms/compliance-discipline/compliance-library-management*`
 * (which called `organizationService` against G2G's Laravel
 * `/settings/institute_detail?formName=complaince_library` endpoint and
 * LMS-K12's pre-existing, unrelated `master_compliance` table).
 *
 * Per explicit product decision, this port does NOT point at either of those.
 * It targets the LMS-K12 Compliance Management System backend
 * (`App\Http\Controllers\api\OrganizationManagement\Compliance\*`):
 *
 *   GET    /organization-management/compliance-library              - list + department/employee/category/template options
 *   POST   /organization-management/compliance-library               - create (multipart - optional attachment file)
 *   GET    /organization-management/compliance-library/dashboard     - KPIs + status/department/category distribution
 *   GET    /organization-management/compliance-library/calendar      - due dates for a given month
 *   GET    /organization-management/compliance-library/my            - records assigned to the logged-in user
 *   GET    /organization-management/compliance-library/overdue       - overdue records with days_overdue
 *   GET    /organization-management/compliance-library/{id}          - detail: record + evidence + activity + cycle history
 *   PUT    /organization-management/compliance-library/{id}          - update (multipart, spoofed PUT via `_method`)
 *   DELETE /organization-management/compliance-library/{id}          - delete
 *   POST   /organization-management/compliance-library/{id}/complete - mark completed, generates next recurring cycle
 *   GET    /organization-management/compliance-library/{id}/evidence - list evidence documents
 *   POST   /organization-management/compliance-library/{id}/evidence - upload an evidence document (multipart)
 *   POST   /organization-management/compliance-library/evidence/{evidenceId}/verify
 *   POST   /organization-management/compliance-library/evidence/{evidenceId}/reject
 *   DELETE /organization-management/compliance-library/evidence/{evidenceId}
 *   GET/POST/PUT/DELETE /organization-management/compliance-library/categories[/{id}]
 *   GET/POST/PUT/DELETE /organization-management/compliance-library/templates[/{id}]
 *   POST   /organization-management/compliance-library/templates/{id}/duplicate
 *
 * Transport follows this project's own pattern: native `fetch` +
 * `buildSessionContext()` / `createAuthHeaders()` (see `lib/erp-client.ts`),
 * the same low-level `request`/`apiGet`/`apiPost`/`apiPut`/`apiDelete`/
 * `apiPostForm`/`apiPutForm` shape as
 * `app/talent-management/_lib/onboarding-api.ts`. No react-query/SWR/axios.
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
// Low-level transport (mirrors app/talent-management/_lib/onboarding-api.ts)
// ---------------------------------------------------------------------------

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
  options?: { params?: Record<string, string | undefined>; body?: unknown; form?: FormData }
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
    headers: createAuthHeaders(session, isForm ? undefined : 'application/json'),
    body: isForm ? options?.form : options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw new Error(messageFrom(payload, "Couldn't complete that request. Try again."));
  }

  return payload as T;
}

const apiGet = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'GET', path, { params });
const apiPost = <T,>(session: SessionContext, path: string, body?: unknown) =>
  request<T>(session, 'POST', path, { body });
const apiPut = <T,>(session: SessionContext, path: string, body?: unknown) =>
  request<T>(session, 'PUT', path, { body });
const apiPostForm = <T,>(session: SessionContext, path: string, form: FormData) =>
  request<T>(session, 'POST', path, { form });
/** Multipart update - spoofed PUT via `_method`, same pattern as onboarding-api.ts. */
const apiPutForm = <T,>(session: SessionContext, path: string, form: FormData) => {
  form.set('_method', 'PUT');
  return request<T>(session, 'POST', path, { form });
};
const apiDelete = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'DELETE', path, { params });

/** Standard context params every call carries, mirroring the other ported modules. */
function withContextParams(session: SessionContext, extra?: Record<string, string | undefined>) {
  return {
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    user_id: session.userId,
    type: 'API',
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Envelopes / types
// ---------------------------------------------------------------------------

export interface ComplianceApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

export type ComplianceStatus =
  | 'Upcoming'
  | 'Due Soon'
  | 'In Progress'
  | 'Pending Verification'
  | 'Completed'
  | 'Overdue'
  | 'Expired'
  | 'Not Applicable';

export type CompliancePriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type ComplianceFrequency =
  | 'One-Time'
  | 'Daily'
  | 'Weekly'
  | 'Monthly'
  | 'Quarterly'
  | 'Half-Yearly'
  | 'Yearly'
  | 'Custom';

/** One compliance library row, as returned by the API. */
export interface ComplianceApiRecord {
  id: number | string;
  name: string;
  description: string | null;
  category_id: number | null;
  category_name: string | null;
  department: string | null;
  department_id: number | null;
  assigned_to: string | null;
  assigned_user?: string | null;
  due_date: string | null;
  next_due_date: string | null;
  frequency: ComplianceFrequency | string | null;
  custom_date: string | null;
  priority: CompliancePriority | string | null;
  status: ComplianceStatus | string | null;
  derived_status: ComplianceStatus | string | null;
  completed_at: string | null;
  parent_compliance_id: number | null;
  evidence_count: number | null;
  attachment_name: string | null;
  attachment_url: string | null;
  days_overdue?: number | null;
}

export interface ComplianceEmployeeOption {
  value: string;
  label: string;
  department_id?: number | null;
}

export interface ComplianceDepartmentOption {
  value: string;
  label: string;
  name?: string;
}

export interface ComplianceCategoryOption {
  value: string;
  label: string;
}

export interface ComplianceTemplateOption {
  id: number;
  name: string;
  description: string | null;
  category_id: number | null;
  default_frequency: ComplianceFrequency | string | null;
  default_custom_frequency_details: string | null;
  default_priority: CompliancePriority | string | null;
}

/** GET list response - records plus the department/employee/category/template options for the create/update form. */
export interface ComplianceListResponse extends ComplianceApiResponse<ComplianceApiRecord[]> {
  departments?: ComplianceDepartmentOption[];
  employees?: ComplianceEmployeeOption[];
  categories?: ComplianceCategoryOption[];
  templates?: ComplianceTemplateOption[];
  pagination?: { current_page: number; per_page: number; total: number; last_page: number };
}

/** Fields the create/update form sends (mirrors ComplianceFormState, minus the file itself). */
export interface CompliancePayload {
  name: string;
  description: string;
  category_id?: string;
  department: string;
  department_id?: string;
  assigned_to: string;
  due_date: string;
  frequency: string;
  custom_date: string;
  priority?: string;
  status?: string;
}

export interface ComplianceFilters {
  search?: string;
  category_id?: string;
  department_id?: string;
  status?: string;
  priority?: string;
  frequency?: string;
  assigned_to?: string;
  due_date_from?: string;
  due_date_to?: string;
  page?: string;
  per_page?: string;
}

/**
 * Maps this file's `CompliancePayload` field names to the backend's
 * `org_compliance_library` column names / `StoreComplianceLibraryRequest`
 * validation keys (`due_date` -> `duedate`, `custom_date` ->
 * `custom_frequency_details`) - the UI/type layer keeps the more readable
 * names, only the wire payload is remapped here.
 */
function toBackendPayload(payload: CompliancePayload): Record<string, unknown> {
  const { due_date, custom_date, ...rest } = payload;
  return {
    ...rest,
    duedate: due_date,
    custom_frequency_details: custom_date,
  };
}

export interface ComplianceEvidenceRecord {
  id: number;
  compliance_id: number;
  file_name: string | null;
  file_url: string | null;
  document_type: string | null;
  description: string | null;
  expiry_date: string | null;
  verification_status: 'Pending Verification' | 'Verified' | 'Rejected';
  rejection_reason: string | null;
  uploaded_by_name?: string | null;
  verified_by_name?: string | null;
  verified_at: string | null;
  created_at: string | null;
}

export interface ComplianceActivityEntry {
  action: string;
  actor_name: string | null;
  created_at: string;
  details: string | null;
}

export interface ComplianceCycleEntry {
  id: number;
  due_date: string | null;
  status: string;
  is_current: boolean;
}

export interface ComplianceDetailResponse {
  record: ComplianceApiRecord;
  evidence: ComplianceEvidenceRecord[];
  activity: ComplianceActivityEntry[];
  cycles: ComplianceCycleEntry[];
}

export interface ComplianceDashboardResponse {
  kpis: {
    total: number;
    upcoming: number;
    due_this_month: number;
    due_soon: number;
    overdue: number;
    completed: number;
    critical: number;
    pending_verification: number;
    pending_evidence_verification: number;
  };
  status_distribution: Record<string, number>;
  department_distribution: { label: string; value: number }[];
  category_distribution: { label: string; value: number }[];
}

export interface ComplianceCalendarEvent {
  id: number;
  name: string;
  due_date: string | null;
  status: string;
  priority: string | null;
  category_name: string | null;
  assigned_user: string | null;
}

export interface ComplianceMyResponse {
  records: ComplianceApiRecord[];
  summary: { total: number; upcoming: number; due_soon: number; overdue: number; completed: number };
}

export interface ComplianceCategoryRecord {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
  status: boolean;
  is_global: boolean;
}

export interface ComplianceTemplateRecord extends ComplianceTemplateOption {
  category_name: string | null;
  sort_order: number;
  status: boolean;
  is_global: boolean;
}

function filterParams(filters?: ComplianceFilters): Record<string, string | undefined> {
  if (!filters) return {};
  return {
    search: filters.search,
    category_id: filters.category_id,
    department_id: filters.department_id,
    status: filters.status,
    priority: filters.priority,
    frequency: filters.frequency,
    assigned_to: filters.assigned_to,
    due_date_from: filters.due_date_from,
    due_date_to: filters.due_date_to,
    page: filters.page,
    per_page: filters.per_page,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const complianceLibraryService = {
  /** GET /organization-management/compliance-library */
  getRecords: (session: SessionContext, filters?: ComplianceFilters) =>
    apiGet<ComplianceListResponse>(
      session,
      '/organization-management/compliance-library',
      withContextParams(session, filterParams(filters)),
    ),

  /** GET /organization-management/compliance-library/{id} */
  getDetail: (session: SessionContext, id: string | number) =>
    apiGet<ComplianceApiResponse<ComplianceDetailResponse>>(
      session,
      `/organization-management/compliance-library/${id}`,
      withContextParams(session),
    ),

  /** GET /organization-management/compliance-library/dashboard */
  getDashboard: (session: SessionContext) =>
    apiGet<ComplianceApiResponse<ComplianceDashboardResponse>>(
      session,
      '/organization-management/compliance-library/dashboard',
      withContextParams(session),
    ),

  /** GET /organization-management/compliance-library/calendar */
  getCalendar: (session: SessionContext, year: number, month: number) =>
    apiGet<ComplianceApiResponse<ComplianceCalendarEvent[]>>(
      session,
      '/organization-management/compliance-library/calendar',
      withContextParams(session, { year: String(year), month: String(month) }),
    ),

  /** GET /organization-management/compliance-library/my */
  getMy: (session: SessionContext, filters?: ComplianceFilters) =>
    apiGet<ComplianceApiResponse<ComplianceMyResponse>>(
      session,
      '/organization-management/compliance-library/my',
      withContextParams(session, filterParams(filters)),
    ),

  /** GET /organization-management/compliance-library/overdue */
  getOverdue: (session: SessionContext, filters?: ComplianceFilters) =>
    apiGet<ComplianceApiResponse<ComplianceApiRecord[]>>(
      session,
      '/organization-management/compliance-library/overdue',
      withContextParams(session, filterParams(filters)),
    ),

  /** POST /organization-management/compliance-library (multipart - optional attachment) */
  createRecord: (session: SessionContext, payload: CompliancePayload, attachment?: File) => {
    const form = new FormData();
    Object.entries({ ...toBackendPayload(payload), ...withContextParams(session) }).forEach(([key, value]) => {
      if (value !== undefined && value !== null) form.set(key, String(value));
    });
    if (attachment) form.set('attachment', attachment);
    return apiPostForm<ComplianceApiResponse<ComplianceApiRecord>>(
      session,
      '/organization-management/compliance-library',
      form,
    );
  },

  /** PUT /organization-management/compliance-library/{id} (multipart, spoofed PUT) */
  updateRecord: (
    session: SessionContext,
    id: string | number,
    payload: CompliancePayload,
    attachment?: File,
  ) => {
    const form = new FormData();
    Object.entries({ ...toBackendPayload(payload), ...withContextParams(session) }).forEach(([key, value]) => {
      if (value !== undefined && value !== null) form.set(key, String(value));
    });
    if (attachment) form.set('attachment', attachment);
    return apiPutForm<ComplianceApiResponse<ComplianceApiRecord>>(
      session,
      `/organization-management/compliance-library/${id}`,
      form,
    );
  },

  /** DELETE /organization-management/compliance-library/{id} */
  deleteRecord: (session: SessionContext, id: string | number) =>
    apiDelete<ComplianceApiResponse<{ id: string | number }>>(
      session,
      `/organization-management/compliance-library/${id}`,
      withContextParams(session),
    ),

  /** POST /organization-management/compliance-library/{id}/complete */
  completeRecord: (session: SessionContext, id: string | number, note?: string, completionDate?: string) =>
    apiPost<ComplianceApiResponse<{ record: ComplianceApiRecord; next_cycle: ComplianceApiRecord | null }>>(
      session,
      `/organization-management/compliance-library/${id}/complete`,
      { completion_note: note || undefined, completion_date: completionDate || undefined },
    ),

  /** GET .../{id}/evidence */
  getEvidence: (session: SessionContext, id: string | number) =>
    apiGet<ComplianceApiResponse<ComplianceEvidenceRecord[]>>(
      session,
      `/organization-management/compliance-library/${id}/evidence`,
      withContextParams(session),
    ),

  /** POST .../{id}/evidence (multipart) */
  uploadEvidence: (
    session: SessionContext,
    id: string | number,
    file: File,
    meta?: { document_type?: string; description?: string; expiry_date?: string },
  ) => {
    const form = new FormData();
    form.set('file', file);
    if (meta?.document_type) form.set('document_type', meta.document_type);
    if (meta?.description) form.set('description', meta.description);
    if (meta?.expiry_date) form.set('expiry_date', meta.expiry_date);
    Object.entries(withContextParams(session)).forEach(([key, value]) => {
      if (value !== undefined) form.set(key, String(value));
    });
    return apiPostForm<ComplianceApiResponse<ComplianceEvidenceRecord>>(
      session,
      `/organization-management/compliance-library/${id}/evidence`,
      form,
    );
  },

  /** POST .../evidence/{evidenceId}/verify */
  verifyEvidence: (session: SessionContext, evidenceId: string | number) =>
    apiPost<ComplianceApiResponse<ComplianceEvidenceRecord>>(
      session,
      `/organization-management/compliance-library/evidence/${evidenceId}/verify`,
      withContextParams(session),
    ),

  /** POST .../evidence/{evidenceId}/reject */
  rejectEvidence: (session: SessionContext, evidenceId: string | number, reason: string) =>
    apiPost<ComplianceApiResponse<ComplianceEvidenceRecord>>(
      session,
      `/organization-management/compliance-library/evidence/${evidenceId}/reject`,
      { ...withContextParams(session), rejection_reason: reason },
    ),

  /** DELETE .../evidence/{evidenceId} */
  deleteEvidence: (session: SessionContext, evidenceId: string | number) =>
    apiDelete<ComplianceApiResponse<{ id: number }>>(
      session,
      `/organization-management/compliance-library/evidence/${evidenceId}`,
      withContextParams(session),
    ),

  // -- Categories -----------------------------------------------------------

  getCategories: (session: SessionContext) =>
    apiGet<ComplianceApiResponse<ComplianceCategoryRecord[]>>(
      session,
      '/organization-management/compliance-library/categories',
      withContextParams(session, { include_inactive: 'true' }),
    ),

  createCategory: (session: SessionContext, data: { name: string; description?: string; sort_order?: number }) =>
    apiPost<ComplianceApiResponse<ComplianceCategoryRecord>>(
      session,
      '/organization-management/compliance-library/categories',
      { ...withContextParams(session), ...data },
    ),

  updateCategory: (session: SessionContext, id: number, data: Partial<{ name: string; description: string; sort_order: number; status: boolean }>) =>
    apiPut<ComplianceApiResponse<ComplianceCategoryRecord>>(
      session,
      `/organization-management/compliance-library/categories/${id}`,
      { ...withContextParams(session), ...data },
    ),

  deleteCategory: (session: SessionContext, id: number) =>
    apiDelete<ComplianceApiResponse<{ id: number }>>(
      session,
      `/organization-management/compliance-library/categories/${id}`,
      withContextParams(session),
    ),

  // -- Templates --------------------------------------------------------------

  getTemplates: (session: SessionContext) =>
    apiGet<ComplianceApiResponse<ComplianceTemplateRecord[]>>(
      session,
      '/organization-management/compliance-library/templates',
      withContextParams(session, { include_inactive: 'true' }),
    ),

  createTemplate: (session: SessionContext, data: Record<string, unknown>) =>
    apiPost<ComplianceApiResponse<ComplianceTemplateRecord>>(
      session,
      '/organization-management/compliance-library/templates',
      { ...withContextParams(session), ...data },
    ),

  updateTemplate: (session: SessionContext, id: number, data: Record<string, unknown>) =>
    apiPut<ComplianceApiResponse<ComplianceTemplateRecord>>(
      session,
      `/organization-management/compliance-library/templates/${id}`,
      { ...withContextParams(session), ...data },
    ),

  duplicateTemplate: (session: SessionContext, id: number) =>
    apiPost<ComplianceApiResponse<ComplianceTemplateRecord>>(
      session,
      `/organization-management/compliance-library/templates/${id}/duplicate`,
      withContextParams(session),
    ),

  deleteTemplate: (session: SessionContext, id: number) =>
    apiDelete<ComplianceApiResponse<{ id: number }>>(
      session,
      `/organization-management/compliance-library/templates/${id}`,
      withContextParams(session),
    ),
};
