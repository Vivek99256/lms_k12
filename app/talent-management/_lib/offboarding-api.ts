'use client';

/**
 * Talent Management -> Offboarding Center API client.
 *
 * Ported from G2G's `services/talent/offboarding.ts` — the ACTIVE
 * implementation backed by Laravel's `/api/offboarding/*` routes
 * (`App\Http\Controllers\Api\Offboarding\OffboardingController`). G2G has a
 * second, dead Offboarding implementation (`offboarding-center-v1.tsx` +
 * `hooks/use-offboarding.ts` + `services/talent/offboarding-service.ts` +
 * `types/talent-offboarding.ts`, hitting `/talent/offboarding/*`) that is not
 * imported anywhere and was NOT ported — confirmed dead, per the same
 * `Api\Talent\OffboardingCaseController` / `OffboardingClearanceController` /
 * `ExitInterviewController` trio being dead on the backend.
 *
 * Transport adaptation only, same shape as `app/hrit/_lib/payroll-api.ts`:
 * G2G resolves a `LaravelContext` via `useAuth()` and sends
 * `sub_institute_id` / `syear` / `user_id` / `token` as query/body params on
 * every call (`withLaravelParams`). The ported target controller
 * (`App\Http\Controllers\api\TalentManagement\Offboarding\OffboardingController`)
 * instead mirrors `OnboardingApiController`'s auth pattern — tenant and actor
 * come from the session hydrated by the `api.session` middleware from the
 * bearer token, never from request input — so this client only needs to send
 * `Authorization: Bearer <token>` and does not resend the Laravel-context
 * params G2G used to append. Endpoint paths, HTTP methods, field names and
 * response envelopes (`{ status, message, data }`, plus a sibling
 * `pagination` on the cases list) are otherwise unchanged from G2G.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type SessionContext,
} from '@/lib/erp-client';

export { buildSessionContext };
export type { SessionContext };

// ---------------------------------------------------------------------------
// Low-level transport
// ---------------------------------------------------------------------------

function messageFrom(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

async function apiRequest<T>(
  session: SessionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${session.baseUrl}/api${path}`;

  const response = await fetch(url, {
    method,
    cache: 'no-store',
    headers: createAuthHeaders(session, body === undefined ? undefined : 'application/json'),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw new Error(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`));
  }

  return payload as T;
}

function toQuery(params: Record<string, string | number | undefined | null> = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** True once a session has the bare minimum an offboarding call needs to not 401. */
export function isOffboardingSessionReady(session: SessionContext): boolean {
  return Boolean(session.token);
}

// ---------------------------------------------------------------------------
// Types (unchanged from G2G's services/talent/offboarding.ts)
// ---------------------------------------------------------------------------

export interface OffbResponse<T> {
  status: number
  message: string
  data: T
}

export interface OffbPagination {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface OffbListResponse<T> extends OffbResponse<T> {
  pagination: OffbPagination
}

export interface ClearanceTask {
  id: string
  department: string
  item: string
  status: 'Pending' | 'Cleared' | 'N/A'
}

export interface DocumentItem {
  id: string
  title: string
  fileName: string | null
  status: 'Pending' | 'Submitted' | 'Verified' | 'Rejected'
  isMandatory: boolean
}

export interface CaseComment {
  id: string
  comment: string
  timestamp: string
  author: string
  initials: string
}

export interface ActivityLogItem {
  id: string
  action: string
  description: string
  timestamp: string
  actor: string
}

export interface ExitCase {
  id: string
  caseId: string
  employee: {
    name: string
    id: string
    initials: string
    title: string
    manager: string
    manager_id?: string | null
    doj: string
    email?: string
    location?: string
  }
  department: string
  department_id?: string | null
  location: string
  exitReason: string
  exitType: 'voluntary' | 'involuntary'
  status: 'Resignation Submitted' | 'Notice Period' | 'Clearance' | 'Exit Interview' | 'Awaiting F&F' | 'Closed'
  owner: string
  updatedOn: string
  noticeDate?: string | null
  lastWorkingDay: string
  clearance_tasks?: ClearanceTask[]
  documents?: DocumentItem[]
  comments?: CaseComment[]
  activity_log?: ActivityLogItem[]
  exit_interview_done?: boolean
  exit_interview_date?: string | null
  exit_interview_notes?: string
}

export interface OffbKPI {
  id: string
  title: string
  value: string
  subtitle: string
  icon: 'door-open' | 'log-out' | 'calendar' | 'shield' | 'users' | 'check-circle'
}

export interface OffbOverview {
  kpis: OffbKPI[]
  totals: {
    total_exits: number
    resignations: number
    notice_period: number
    clearance_pending: number
    exit_interviews: number
    closed: number
  }
}

export interface OffbFilterOption {
  value: string
  label: string
}

export interface EmployeeOption extends OffbFilterOption {
  employee_no: string | null
  department_id: string | null
  joined_date: string | null
}

export interface OffbFilterOptions {
  departments: OffbFilterOption[]
  employees: EmployeeOption[]
  reasons: OffbFilterOption[]
  exit_types: OffbFilterOption[]
  owners: OffbFilterOption[]
}

export interface CaseFilters {
  department_id?: string
  status?: string
  exit_reason?: string
  exit_type?: string
  search?: string
  page?: number
  per_page?: number
  sort_by?: string
  sort_dir?: string
}

export interface CasePayload {
  employee_id: number
  exit_type: 'voluntary' | 'involuntary'
  exit_reason: string
  notice_date: string
  last_working_day: string
  manager_id?: number
  location?: string
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const offboardingService = {
  getOverview: (session: SessionContext, departmentId?: string) =>
    apiRequest<OffbResponse<OffbOverview>>(
      session,
      'GET',
      `/offboarding/overview${toQuery({ department_id: departmentId })}`
    ),

  getFilters: (session: SessionContext) =>
    apiRequest<OffbResponse<OffbFilterOptions>>(session, 'GET', '/offboarding/filters'),

  getCases: (session: SessionContext, filters?: CaseFilters) =>
    apiRequest<OffbListResponse<ExitCase[]>>(
      session,
      'GET',
      `/offboarding/cases${toQuery(filters as Record<string, string | number | undefined>)}`
    ),

  getCase: (session: SessionContext, id: string) =>
    apiRequest<OffbResponse<ExitCase>>(session, 'GET', `/offboarding/cases/${id}`),

  createCase: (session: SessionContext, payload: CasePayload) =>
    apiRequest<OffbResponse<{ id: number }>>(session, 'POST', '/offboarding/cases', payload),

  updateCase: (session: SessionContext, id: string, payload: Partial<CasePayload> & { status?: string }) =>
    apiRequest<OffbResponse<ExitCase>>(session, 'PUT', `/offboarding/cases/${id}`, payload),

  updateStatus: (session: SessionContext, id: string, status: string) =>
    apiRequest<OffbResponse<ExitCase>>(session, 'POST', `/offboarding/cases/${id}/status`, { status }),

  updateClearance: (session: SessionContext, id: string, tasks: ClearanceTask[]) =>
    apiRequest<OffbResponse<ClearanceTask[]>>(session, 'POST', `/offboarding/cases/${id}/clearance`, { tasks }),

  updateDocuments: (session: SessionContext, id: string, documents: DocumentItem[]) =>
    apiRequest<OffbResponse<DocumentItem[]>>(session, 'POST', `/offboarding/cases/${id}/documents`, { documents }),

  addComment: (session: SessionContext, id: string, comment: string) =>
    apiRequest<OffbResponse<CaseComment[]>>(session, 'POST', `/offboarding/cases/${id}/comments`, { comment }),

  updateExitInterview: (
    session: SessionContext,
    id: string,
    payload: { exit_interview_done: boolean; exit_interview_date?: string | null; exit_interview_notes?: string }
  ) => apiRequest<OffbResponse<ExitCase>>(session, 'POST', `/offboarding/cases/${id}/exit-interview`, payload),

  withdrawCase: (session: SessionContext, id: string) =>
    apiRequest<OffbResponse<{ id: number }>>(session, 'DELETE', `/offboarding/cases/${id}`),
};
