'use client';

/**
 * Talent Management - Mobility & Succession API client.
 *
 * Ported from G2G's `services/talent/mobility.ts` — backed by the Laravel
 * `/api/mobility/*` REST routes (App\Http\Controllers\api\TalentManagement\
 * Mobility\*). These are session-based (`session()->get('sub_institute_id')` /
 * `session()->get('syear')`), not token-only routes, but the request still
 * carries the same context params G2G always sent
 * (`token`/`sub_institute_id`/`syear`/`user_id`/`type=API`) so both transports
 * are satisfied. Endpoint paths, HTTP methods, query params/body fields and
 * response shapes are kept exactly as in G2G. Only the transport changed:
 * native `fetch` + this project's `buildSessionContext()` / `createAuthHeaders()`
 * (see `lib/erp-client.ts`) instead of G2G's `apiClient` + `LaravelContext`.
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

/** Standard Laravel context params, mirroring G2G's `withLaravelParams`/`contextParams`. */
function withContextParams(session: SessionContext, extra?: Record<string, string | undefined>) {
  return {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    financial_year: session.syear,
    user_id: session.userId,
    type: 'API',
    ...extra,
  };
}

/** True once a session has the bare minimum a mobility call needs to not 401. */
export function isMobilitySessionReady(session: SessionContext): boolean {
  return Boolean(session.token && session.subInstituteId);
}

// ---------------------------------------------------------------------------
// Types (unchanged from G2G's services/talent/mobility.ts)
// ---------------------------------------------------------------------------

export interface MobilityJob {
  id: number
  job_id: string
  title: string
  department_id: number | null
  department: string | null
  location: string
  grade: string
  job_type: string
  posted_on: string
  deadline: string | null
  hiring_manager_id: number | null
  hiring_manager_name: string | null
  current_incumbent: string | null
  vacancies: number
  relocation_required: string
  description: string | null
  status: 'Open' | 'In Review' | 'Closed'
  applications_count?: number
}

export interface MobilityApplication {
  id: number
  job_posting_id: number
  user_id: number
  applied_on: string
  status: 'Applied' | 'Screening' | 'Interviewing' | 'Offered' | 'Rejected' | 'Closed'
  remarks: string | null
  job?: MobilityJob
  applicant?: {
    id: number
    name: string
    employee_no: string | null
    email: string | null
    initials: string
    department: string | null
    designation: string | null
    image: string | null
  } | null
}

export interface MobilityTransfer {
  id: number
  user_id: number
  from_department_id: number | null
  from_department: string | null
  to_department_id: number
  to_department: string | null
  from_jobrole: string | null
  to_jobrole: string
  effective_date: string
  status: 'Pending' | 'Approved' | 'Completed' | 'Cancelled'
  remarks: string | null
  employee?: {
    id: number
    name: string
    employee_no: string | null
    initials: string
    department: string | null
    designation: string | null
    image: string | null
  } | null
}

export interface MobilityPromotion {
  id: number
  user_id: number
  current_grade: string | null
  proposed_grade: string
  current_designation: string | null
  proposed_designation: string
  effective_date: string
  status: 'Pending' | 'Approved' | 'Completed' | 'Cancelled'
  remarks: string | null
  employee?: {
    id: number
    name: string
    employee_no: string | null
    initials: string
    department: string | null
    designation: string | null
    image: string | null
  } | null
}

export interface MobilitySuccessionPlan {
  id: number
  critical_jobrole_id: number
  critical_jobrole_name: string
  successor_user_id: number
  readiness: 'Ready Now' | 'Ready in 1-2 Years' | 'Ready in 2+ Years'
  emergency_successor: boolean
  status: 'Active' | 'Inactive'
  successor?: {
    id: number
    name: string
    employee_no: string | null
    initials: string
    department: string | null
    designation: string | null
    image: string | null
  } | null
}

export interface MobilityTalentPool {
  id: number
  name: string
  description: string | null
  status: 'Active' | 'Inactive'
  members_count?: number
}

export interface TalentPoolMember {
  id: number
  pool_id: number
  user_id: number
  added_on: string
  user_details?: {
    id: number
    name: string
    employee_no: string | null
    initials: string
    department: string | null
    designation: string | null
    image: string | null
  } | null
}

export interface MobilityOverviewData {
  kpis: {
    open_jobs: number
    applications: number
    in_review: number
    transfers_in_progress: number
    promotions_in_progress: number
    critical_roles: number
  }
  charts: {
    movement_summary: {
      transfers: number
      promotions: number
      lateral_moves: number
    }
    succession_coverage: {
      ready_now: number
      ready_1_2_years: number
      ready_2_plus_years: number
      no_successor: number
    }
    top_departments: {
      department: string
      count: number
    }[]
  }
}

export interface MobilityFiltersData {
  departments: { value: string; label: string }[]
  employees: { value: string; label: string }[]
  jobroles: { value: string; label: string }[]
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const mobilityService = {
  getOverview: (session: SessionContext) =>
    apiGet<{ status: number; data: MobilityOverviewData }>(session, '/mobility/overview', withContextParams(session)),

  getFilters: (session: SessionContext) =>
    apiGet<{ status: number; data: MobilityFiltersData }>(session, '/mobility/filters', withContextParams(session)),

  getJobs: (session: SessionContext, filters?: Record<string, string>) =>
    apiGet<{ status: number; data: MobilityJob[]; total: number }>(
      session,
      '/mobility/jobs',
      withContextParams(session, filters),
    ),
  createJob: (session: SessionContext, data: Partial<MobilityJob>) =>
    apiPost<{ status: number; data: MobilityJob }>(session, '/mobility/jobs', {
      ...withContextParams(session),
      ...data,
    }),
  updateJob: (session: SessionContext, id: number, data: Partial<MobilityJob>) =>
    apiPut<{ status: number; data: MobilityJob }>(session, `/mobility/jobs/${id}`, {
      ...withContextParams(session),
      ...data,
    }),
  deleteJob: (session: SessionContext, id: number) =>
    apiDelete<{ status: number }>(session, `/mobility/jobs/${id}`, withContextParams(session)),

  getApplications: (session: SessionContext, filters?: Record<string, string>) =>
    apiGet<{ status: number; data: MobilityApplication[]; total: number }>(
      session,
      '/mobility/applications',
      withContextParams(session, filters),
    ),
  createApplication: (session: SessionContext, data: { job_posting_id: number; user_id?: number; remarks?: string }) =>
    apiPost<{ status: number; data: MobilityApplication }>(session, '/mobility/applications', {
      ...withContextParams(session),
      ...data,
    }),
  updateApplication: (session: SessionContext, id: number, data: { status: string; remarks?: string }) =>
    apiPut<{ status: number; data: MobilityApplication }>(session, `/mobility/applications/${id}`, {
      ...withContextParams(session),
      ...data,
    }),

  getTransfers: (session: SessionContext, filters?: Record<string, string>) =>
    apiGet<{ status: number; data: MobilityTransfer[]; total: number }>(
      session,
      '/mobility/transfers',
      withContextParams(session, filters),
    ),
  createTransfer: (session: SessionContext, data: Partial<MobilityTransfer>) =>
    apiPost<{ status: number; data: MobilityTransfer }>(session, '/mobility/transfers', {
      ...withContextParams(session),
      ...data,
    }),
  updateTransfer: (session: SessionContext, id: number, data: { status: string; remarks?: string }) =>
    apiPut<{ status: number; data: MobilityTransfer }>(session, `/mobility/transfers/${id}`, {
      ...withContextParams(session),
      ...data,
    }),

  getPromotions: (session: SessionContext, filters?: Record<string, string>) =>
    apiGet<{ status: number; data: MobilityPromotion[]; total: number }>(
      session,
      '/mobility/promotions',
      withContextParams(session, filters),
    ),
  createPromotion: (session: SessionContext, data: Partial<MobilityPromotion>) =>
    apiPost<{ status: number; data: MobilityPromotion }>(session, '/mobility/promotions', {
      ...withContextParams(session),
      ...data,
    }),
  updatePromotion: (session: SessionContext, id: number, data: { status: string; remarks?: string }) =>
    apiPut<{ status: number; data: MobilityPromotion }>(session, `/mobility/promotions/${id}`, {
      ...withContextParams(session),
      ...data,
    }),

  getSuccessions: (session: SessionContext, filters?: Record<string, string>) =>
    apiGet<{ status: number; data: MobilitySuccessionPlan[]; total: number }>(
      session,
      '/mobility/successions',
      withContextParams(session, filters),
    ),
  createSuccession: (session: SessionContext, data: Partial<MobilitySuccessionPlan>) =>
    apiPost<{ status: number; data: MobilitySuccessionPlan }>(session, '/mobility/successions', {
      ...withContextParams(session),
      ...data,
    }),
  updateSuccession: (session: SessionContext, id: number, data: Partial<MobilitySuccessionPlan>) =>
    apiPut<{ status: number; data: MobilitySuccessionPlan }>(session, `/mobility/successions/${id}`, {
      ...withContextParams(session),
      ...data,
    }),
  deleteSuccession: (session: SessionContext, id: number) =>
    apiDelete<{ status: number }>(session, `/mobility/successions/${id}`, withContextParams(session)),

  getPools: (session: SessionContext, filters?: Record<string, string>) =>
    apiGet<{ status: number; data: MobilityTalentPool[]; total: number }>(
      session,
      '/mobility/pools',
      withContextParams(session, filters),
    ),
  createPool: (session: SessionContext, data: Partial<MobilityTalentPool>) =>
    apiPost<{ status: number; data: MobilityTalentPool }>(session, '/mobility/pools', {
      ...withContextParams(session),
      ...data,
    }),
  getPoolMembers: (session: SessionContext, poolId: number) =>
    apiGet<{ status: number; data: TalentPoolMember[] }>(session, `/mobility/pools/${poolId}/members`, withContextParams(session)),
  addPoolMember: (session: SessionContext, poolId: number, userId: number) =>
    apiPost<{ status: number; data: TalentPoolMember }>(session, `/mobility/pools/${poolId}/members`, {
      ...withContextParams(session),
      user_id: userId,
    }),
  removePoolMember: (session: SessionContext, poolId: number, userId: number) =>
    apiDelete<{ status: number }>(session, `/mobility/pools/${poolId}/members/${userId}`, withContextParams(session)),
}
