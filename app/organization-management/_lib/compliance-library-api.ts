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
 * It targets NEW LMS-K12 endpoints a sibling backend agent is building against
 * NEW tables (e.g. `org_compliance_library`):
 *
 *   GET    /organization-management/compliance-library        - list + employee options for the "Assigned Employee" dropdown
 *   POST   /organization-management/compliance-library         - create (multipart - optional attachment file)
 *   PUT    /organization-management/compliance-library/{id}    - update (multipart, spoofed PUT via `_method`)
 *   DELETE /organization-management/compliance-library/{id}    - delete
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
    throw new Error(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`));
  }

  return payload as T;
}

const apiGet = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'GET', path, { params });
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
// Envelopes
// ---------------------------------------------------------------------------

export interface ComplianceApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

/** One compliance library row, as returned by the API. */
export interface ComplianceApiRecord {
  id: number | string;
  name: string;
  description: string | null;
  department: string | null;
  assigned_to: string | null;
  due_date: string | null;
  frequency: string | null;
  custom_date: string | null;
  attachment_name: string | null;
  attachment_url: string | null;
}

export interface ComplianceEmployeeOption {
  value: string;
  label: string;
}

export interface ComplianceDepartmentOption {
  value: string;
  label: string;
}

/** GET list response - records plus the department/employee options for the create/update form. */
export interface ComplianceListResponse extends ComplianceApiResponse<ComplianceApiRecord[]> {
  departments?: ComplianceDepartmentOption[];
  employees?: ComplianceEmployeeOption[];
}

/** Fields the create/update form sends (mirrors ComplianceFormState, minus the file itself). */
export interface CompliancePayload {
  name: string;
  description: string;
  department: string;
  assigned_to: string;
  due_date: string;
  frequency: string;
  custom_date: string;
  /** Set only when replacing/clearing the attachment on an update. */
  remove_attachment?: boolean;
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

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const complianceLibraryService = {
  /** GET /organization-management/compliance-library */
  getRecords: (session: SessionContext) =>
    apiGet<ComplianceListResponse>(
      session,
      '/organization-management/compliance-library',
      withContextParams(session),
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
};
