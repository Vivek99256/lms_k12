'use client';

/**
 * Employee (Competency) Profile Center API client.
 *
 * Ported from G2G's `services/competency/employee-profiles.ts`,
 * `services/competency/kasba-rating.ts`, and — for the employee picker only —
 * the `fetchEmployeeList` export of `services/organization/employee-profile-service.ts`
 * (that file's `/user/add_user` employee-edit calls are unrelated to this
 * screen and were intentionally left out). This is an EXACT as-is migration:
 * endpoint paths, HTTP methods, query/body field names and response shapes
 * are preserved exactly as in G2G. Only the transport changed: native
 * `fetch` + this project's `buildSessionContext()` / `createAuthHeaders()`
 * (see `lib/erp-client.ts`) instead of G2G's `apiClient` + `LaravelContext`,
 * following the same adaptation shape as
 * `app/talent-management/_lib/recruitment-api.ts`.
 *
 * G2G's `withLaravelParams(context, extra)` (common tenant/session params
 * merged into the query for GET/DELETE, and into the body for POST/PUT) is
 * reproduced here as `contextParams(session, extra)`, matching
 * `recruitment-api.ts`'s helper of the same name/shape. G2G's richer
 * `LaravelContext` also carried `organization_id`/`org_type`/`profile_id`;
 * this repo's `SessionContext` has no equivalent fields, so — matching
 * `recruitment-api.ts`/`onboarding-api.ts`'s own adaptation note — those are
 * simply omitted.
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
// Low-level transport (mirrors recruitment-api.ts's `request`/`ApiError`)
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

/** Mirrors G2G's `withLaravelParams` — common tenant/session params merged with `extra`. */
function contextParams(session: SessionContext, extra?: Record<string, string | undefined>): Record<string, string> {
  const params: Record<string, string> = {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    type: 'API',
  };
  Object.entries(extra ?? {}).forEach(([key, value]) => {
    if (value !== undefined) params[key] = value;
  });
  return params;
}

// ---------------------------------------------------------------------------
// Types — ported unchanged from services/competency/employee-profiles.ts
// ---------------------------------------------------------------------------

export interface CompetencyApiResponse<T> {
  status?: number | string;
  status_code?: number | string;
  message?: string;
  data: T;
}

export interface EmployeeCompetencyItem {
  skill_id: number;
  matrix_id: number;
  name: string;
  description: string;
  required: number;
  current: number;
  interest_level: number;
  knowledge: number;
  ability: number;
  gap: number;
  date: string;
  assessor: string;
}

export interface EmployeeCompetencyCategory {
  category: string;
  items: EmployeeCompetencyItem[];
}

export interface EmployeeProfileData {
  employee: {
    id: string;
    name: string;
    initials: string;
    emp_id: string;
    role: string;
    department: string;
    location: string;
    joined: string;
    reports_to: string;
    experience: string;
    type: string;
  };
  metrics: {
    latest_assessment: string;
    latest_cycle: string;
    overall_score: number;
  };
  competencies: EmployeeCompetencyCategory[];
}

export interface AvailableSkill {
  id: number;
  title: string;
  category: string | null;
  description: string | null;
}

export interface EmployeeCertification {
  id: number;
  name: string;
  issuing_body: string | null;
  credential_id: string | null;
  status: string;
  issued_date: string | null;
  expiry_date: string | null;
}

export interface EmployeeDevelopmentPlan {
  id: number;
  title: string;
  status: string;
  progress: number;
  start_date: string | null;
  due_date: string | null;
}

export interface EmployeeEvidence {
  id: number;
  title: string;
  evidence_type: string;
  description: string | null;
  link: string | null;
  status: string;
  competency_id: number | null;
  competency_name: string | null;
  date: string | null;
}

export interface CareerRole {
  jobrole: string;
  department: string | null;
  description: string | null;
  required_skills: number;
}

export interface CareerPathData {
  current: { jobrole: string; department: string | null; description: string | null; job_level: string | null } | null;
  next_roles: CareerRole[];
  path_source: string;
}

export interface SkillHistoryData {
  skill: {
    name: string;
    category: string | null;
    description: string | null;
    current_level: number;
    interest_level: number;
    knowledge: number;
    ability: number;
    assessor: string;
    created_at: string;
    updated_at: string;
  };
  timeline: Array<{
    action: string;
    level: number;
    date: string;
    by: string;
  }>;
}

export const employeeProfileService = {
  getEmployeeProfile: (session: SessionContext, userId: string) =>
    apiGet<CompetencyApiResponse<EmployeeProfileData>>(
      session,
      `/competency/employee-profiles/${userId}`,
      contextParams(session),
    ),

  getAvailableSkills: (session: SessionContext, userId: string) =>
    apiGet<CompetencyApiResponse<AvailableSkill[]>>(
      session,
      `/competency/employee-profiles/${userId}/available-skills`,
      contextParams(session),
    ),

  addSkill: (session: SessionContext, userId: string, payload: { skill_id: number; skill_level: number }) =>
    apiPost<CompetencyApiResponse<{ id: number }>>(
      session,
      `/competency/employee-profiles/${userId}/skills`,
      { ...contextParams(session), ...payload },
    ),

  updateSkill: (session: SessionContext, userId: string, matrixId: number, payload: { skill_level: number }) =>
    apiPut<CompetencyApiResponse<null>>(
      session,
      `/competency/employee-profiles/${userId}/skills/${matrixId}`,
      { ...contextParams(session), ...payload },
    ),

  getSkillHistory: (session: SessionContext, userId: string, skillId: number) =>
    apiGet<CompetencyApiResponse<SkillHistoryData>>(
      session,
      `/competency/employee-profiles/${userId}/skills/${skillId}/history`,
      contextParams(session),
    ),

  /* -- Employee-scoped lists (Certifications / Development Plans tabs) -- */
  getCertifications: (session: SessionContext, userId: string) =>
    apiGet<CompetencyApiResponse<EmployeeCertification[]>>(
      session,
      `/competency/employee-profiles/${userId}/certifications`,
      contextParams(session),
    ),

  getDevelopmentPlans: (session: SessionContext, userId: string) =>
    apiGet<CompetencyApiResponse<EmployeeDevelopmentPlan[]>>(
      session,
      `/competency/employee-profiles/${userId}/development-plans`,
      contextParams(session),
    ),

  getEvidence: (session: SessionContext, userId: string) =>
    apiGet<CompetencyApiResponse<EmployeeEvidence[]>>(
      session,
      `/competency/employee-profiles/${userId}/evidence`,
      contextParams(session),
    ),

  addEvidence: (session: SessionContext, userId: string, payload: { title: string; evidence_type?: string; description?: string; link?: string; competency_id?: number; status?: string }) =>
    apiPost<CompetencyApiResponse<{ id: number }>>(
      session,
      `/competency/employee-profiles/${userId}/evidence`,
      { ...contextParams(session), ...payload },
    ),

  deleteEvidence: (session: SessionContext, userId: string, evidenceId: number) =>
    apiDelete<CompetencyApiResponse<null>>(
      session,
      `/competency/employee-profiles/${userId}/evidence/${evidenceId}`,
      contextParams(session),
    ),

  getCareerPath: (session: SessionContext, userId: string) =>
    apiGet<CompetencyApiResponse<CareerPathData>>(
      session,
      `/competency/employee-profiles/${userId}/career-path`,
      contextParams(session),
    ),

  /* -- Private notes -- */
  getNotes: (session: SessionContext, userId: string) =>
    apiGet<CompetencyApiResponse<{ note: string; updated_at: string | null }>>(
      session,
      `/competency/employee-profiles/${userId}/notes`,
      contextParams(session),
    ),

  saveNotes: (session: SessionContext, userId: string, note: string) =>
    apiPut<CompetencyApiResponse<null>>(
      session,
      `/competency/employee-profiles/${userId}/notes`,
      { ...contextParams(session), note },
    ),

  /* -- Quick actions: reuse the existing competency-domain create endpoints,
        scoped to this employee via user_id. -- */
  requestReassessment: (
    session: SessionContext,
    payload: { title: string; user_id: string; jobrole?: string; due_date?: string },
  ) =>
    apiPost<CompetencyApiResponse<{ id: number }>>(session, '/competency/assessments', {
      ...contextParams(session),
      status: 'open',
      ...payload,
    }),

  assignDevelopmentPlan: (
    session: SessionContext,
    payload: { title: string; user_id: string; jobrole?: string; competency_id?: number; due_date?: string },
  ) =>
    apiPost<CompetencyApiResponse<{ id: number }>>(session, '/competency/development-plans', {
      ...contextParams(session),
      status: 'active',
      ...payload,
    }),

  addCertification: (
    session: SessionContext,
    payload: { name: string; user_id: string; jobrole?: string; issuing_body?: string; issued_date?: string; expiry_date?: string },
  ) =>
    apiPost<CompetencyApiResponse<{ id: number }>>(session, '/competency/certifications', {
      ...contextParams(session),
      status: 'valid',
      ...payload,
    }),
};

// ---------------------------------------------------------------------------
// KASBA rating — ported unchanged from services/competency/kasba-rating.ts
// ---------------------------------------------------------------------------

export interface RatableItem {
  kasba_item_id: number;
  kasba_type: string;
  item_label: string | null;
  weight: number | null;
  competency_id: number | null;
  competency_name: string | null;
  required_proficiency: string | number | null;
  is_mandatory: number | boolean;
  /** null means UNRATED, which is not the same as a rating of zero. */
  rating: number | null;
  note: string | null;
  rated_at: string | null;
}

export interface RatableItemsResult {
  user_id: number;
  jobrole_id: number | null;
  items: RatableItem[];
  rated: number;
  total: number;
  /** True for a normal empty — no job role, or a role with nothing mapped. */
  empty_is_expected: boolean;
  empty_reason: string | null;
  rating_range: { min: number; max: number };
}

export const kasbaRatingService = {
  /**
   * What this person can be rated on, with any rating they already have.
   *
   * An unrated item comes back with `rating: null` rather than being absent,
   * so the screen shows it as a blank to fill instead of silently omitting it.
   */
  async listFor(userId: number, session: SessionContext): Promise<RatableItemsResult> {
    const res = await apiGet<{
      status: number;
      data: Omit<RatableItemsResult, 'empty_is_expected' | 'empty_reason' | 'rating_range'>;
      empty_is_expected: boolean;
      empty_reason: string | null;
      rating_range: { min: number; max: number };
    }>(
      session,
      '/competency/kasba-rating',
      contextParams(session, { user_id: String(userId) }),
    );

    return {
      ...res.data,
      empty_is_expected: res.empty_is_expected,
      empty_reason: res.empty_reason,
      rating_range: res.rating_range ?? { min: 1, max: 5 },
    };
  },

  /** ONE ITEM PER CALL, deliberately — see G2G source comment (partial-success bulk writes are the failure mode this project has hit before). */
  async save(
    input: { user_id: number; kasba_item_id: number; rating: number; note?: string | null },
    session: SessionContext,
  ): Promise<void> {
    await apiPost(session, '/competency/kasba-rating', {
      ...contextParams(session),
      user_id: input.user_id,
      kasba_item_id: input.kasba_item_id,
      rating: input.rating,
      note: input.note ?? null,
    });
  },

  /** Remove a rating. NOT the same as rating it zero — it returns it to unrated. */
  async remove(
    input: { user_id: number; kasba_item_id: number },
    session: SessionContext,
  ): Promise<void> {
    await apiDelete(session, '/competency/kasba-rating', contextParams(session, {
      user_id: String(input.user_id),
      kasba_item_id: String(input.kasba_item_id),
    }));
  },
};

// ---------------------------------------------------------------------------
// Employee picker — ported unchanged from
// services/organization/employee-profile-service.ts's `fetchEmployeeList`
// only (its `/user/add_user` employee-edit calls are a different, unrelated
// screen and were left out).
// ---------------------------------------------------------------------------

export interface EmployeeListItem {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  jobtitle_id: number | null;
  jobrole: string | null;
}

export async function fetchEmployeeList(
  session: SessionContext,
  q?: string,
): Promise<{
  employees: EmployeeListItem[];
  shown: number;
  total: number;
  truncated: boolean;
  empty_reason: string | null;
}> {
  const res = await apiGet<{
    status: number;
    data: { employees: EmployeeListItem[]; shown: number; total: number };
    truncated: boolean;
    empty_reason: string | null;
  }>(
    session,
    '/competency/employee-profiles',
    contextParams(session, q ? { q } : {}),
  );

  return {
    ...res.data,
    truncated: res.truncated,
    empty_reason: res.empty_reason,
  };
}
