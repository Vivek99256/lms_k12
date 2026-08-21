'use client';

/**
 * Disciplinary Library API client (Organization Management module).
 *
 * Ported UI-wise, screen-for-screen, from G2G's
 * `components/domain/hrms/compliance-discipline/disciplinary-management*`
 * (which called `organizationService` against G2G's Laravel
 * `/settings/discliplinary_management` endpoint).
 *
 * Per explicit product decision, this port targets NEW LMS-K12 endpoints a
 * sibling backend agent is building against a NEW table (e.g.
 * `org_disciplinary_library`):
 *
 *   GET    /organization-management/disciplinary-library                                  - list + department/employee options
 *   POST   /organization-management/disciplinary-library                                   - create
 *   PUT    /organization-management/disciplinary-library/{id}                              - update
 *   DELETE /organization-management/disciplinary-library/{id}                              - delete
 *   GET    /organization-management/disciplinary-library/departments/{department}/employees - department -> employee cascade
 *
 * Transport follows this project's own pattern: native `fetch` +
 * `buildSessionContext()` / `createAuthHeaders()` (see `lib/erp-client.ts`),
 * the same `apiGet`/`apiPost`/`apiPut`/`apiDelete` shape as
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
// Low-level transport
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
  options?: { params?: Record<string, string | undefined>; body?: unknown }
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
    throw new Error(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`));
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

export interface DisciplinaryApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

export interface DisciplinaryOption {
  value: string;
  label: string;
}

/** One disciplinary incident row, as returned by the API. */
export interface DisciplinaryApiRecord {
  id: number | string;
  department_id: string | null;
  department_name: string | null;
  employee_id: string | null;
  employee_name: string | null;
  incident_datetime: string | null;
  location: string | null;
  misconduct_type: string | null;
  description: string | null;
  witness_id: string | null;
  witness_name: string | null;
  action_taken: string | null;
  remarks: string | null;
  reported_by: string | null;
  reported_by_name: string | null;
  date_of_report: string | null;
}

/** GET list response - records plus department/employee options for the form. */
export interface DisciplinaryListResponse extends DisciplinaryApiResponse<DisciplinaryApiRecord[]> {
  departments?: DisciplinaryOption[];
  employees?: DisciplinaryOption[];
}

/** Fields the Incident form sends. Mirrors IncidentFormState. */
export interface DisciplinaryPayload {
  department_id: string;
  employee_id: string;
  incident_datetime: string;
  location: string;
  misconduct_type: string;
  description: string;
  witness_id: string;
  action_taken: string;
  remarks: string;
  reported_by: string;
  date_of_report: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const disciplinaryLibraryService = {
  /** GET /organization-management/disciplinary-library */
  getRecords: (session: SessionContext) =>
    apiGet<DisciplinaryListResponse>(
      session,
      '/organization-management/disciplinary-library',
      withContextParams(session),
    ),

  /** POST /organization-management/disciplinary-library */
  createRecord: (session: SessionContext, payload: DisciplinaryPayload) =>
    apiPost<DisciplinaryApiResponse<DisciplinaryApiRecord>>(session, '/organization-management/disciplinary-library', {
      ...payload,
      ...withContextParams(session),
    }),

  /** PUT /organization-management/disciplinary-library/{id} */
  updateRecord: (session: SessionContext, id: string | number, payload: DisciplinaryPayload) =>
    apiPut<DisciplinaryApiResponse<DisciplinaryApiRecord>>(session, `/organization-management/disciplinary-library/${id}`, {
      ...payload,
      ...withContextParams(session),
    }),

  /** DELETE /organization-management/disciplinary-library/{id} */
  deleteRecord: (session: SessionContext, id: string | number) =>
    apiDelete<DisciplinaryApiResponse<{ id: string | number }>>(
      session,
      `/organization-management/disciplinary-library/${id}`,
      withContextParams(session),
    ),

  /** GET /organization-management/disciplinary-library/departments/{department}/employees */
  getEmployeesByDepartment: (session: SessionContext, department: string) =>
    apiGet<DisciplinaryApiResponse<DisciplinaryOption[]>>(
      session,
      `/organization-management/disciplinary-library/departments/${encodeURIComponent(department)}/employees`,
      withContextParams(session),
    ),
};
