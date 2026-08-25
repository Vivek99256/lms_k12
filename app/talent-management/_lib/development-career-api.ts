'use client';

/**
 * Development & Career Path Workspace API client.
 *
 * Ported from G2G's `services/competency/development-career.ts` — backed
 * directly by the additive Laravel development-plan / career-path / learning
 * endpoints (token + sub_institute_id via `withLaravelParams`, JSON envelope
 * `{status,message,data}`). This is an EXACT as-is migration: endpoint paths,
 * HTTP methods, query/body field names and response shapes are preserved
 * exactly as in G2G. Only the transport changed: native `fetch` +
 * `buildSessionContext()` / `createAuthHeaders()` (see `lib/erp-client.ts`)
 * instead of G2G's `apiClient` + `LaravelContext`, following the same
 * adaptation shape as `app/talent-management/_lib/recruitment-api.ts`.
 *
 * G2G's `withLaravelParams(context, extra)` (which also carried
 * `organization_id`/`org_type`/`profile_id` from G2G's richer
 * `LaravelContext`) becomes the local `contextParams()` below; this repo's
 * `SessionContext` has no equivalent fields, so those three are omitted,
 * matching `recruitment-api.ts`'s own adaptation note.
 *
 *   Development plans
 *     GET    /competency/development-plans                       - list (+ filters/sort/paging)
 *     GET    /competency/development-plans/metrics               - the 5 KPI cards
 *     GET    /competency/development-plans/owners                - "Plan Owner: All" options
 *     GET    /competency/employee-options                        - employee picker
 *     POST   /competency/development-plans                       - create (existing route)
 *     GET/PUT/DELETE /competency/development-plans/{id}          - detail / edit / delete
 *     GET    /competency/development-plans/{id}/gaps             - Competency Gaps tab
 *     GET    /competency/development-plans/{id}/history          - Notes & History tab
 *     GET/POST /competency/development-plans/{id}/actions        - Actions tab
 *     PUT/DELETE /competency/development-plans/{id}/actions/{aid}
 *
 *   Career paths
 *     GET/POST /competency/career-paths                          - list / create
 *     GET/PUT/DELETE /competency/career-paths/{id}
 *     GET    /competency/career-paths/explorer                   - Career Path Explorer
 *     GET    /competency/career-paths/role-options                - step picker
 *
 *   Learning assignments (lms_assignments rows tagged source='competency')
 *     GET/POST /competency/learning-assignments
 *     PUT/DELETE /competency/learning-assignments/{id}
 *     GET    /competency/learning-assignments/courses            - course picker
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client';

export { buildSessionContext };
export type { SessionContext };

/* ------------------------------------------------------------------ *
 * Low-level transport (mirrors recruitment-api.ts verbatim)
 * ------------------------------------------------------------------ */

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
const apiPost = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'POST', path, { body });
const apiPut = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'PUT', path, { body });
const apiDelete = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'DELETE', path, { params });

/**
 * Standard Laravel context params, mirroring G2G's `withLaravelParams`.
 * See header note: `organization_id`/`org_type`/`profile_id` are omitted —
 * this repo's `SessionContext` carries no equivalent fields.
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

/** Serialise a mixed param bag into the string map apiGet/apiDelete expect, dropping blanks and 'all'. */
function toStringParams(input: Record<string, string | number | undefined | null>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized === '' || normalized === 'all') continue;
    out[key] = normalized;
  }
  return out;
}

/** Laravel reads focus_areas as a comma-separated string; arrays are joined here. */
function serializePayload(payload: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    out[key] = Array.isArray(value) ? value.join(',') : value;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Types (kept inline, per migration instructions — do not touch
 * talent-types.ts, which a sibling port may be editing concurrently)
 * ------------------------------------------------------------------ */

export interface DevCareerApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

export interface DevCareerPagination {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface DevCareerListResponse<T> extends DevCareerApiResponse<T> {
  pagination: DevCareerPagination;
}

/* -- Development plans -- */

/** s_competency_development_plans.status - the raw values the API filters on. */
export type PlanStatus = 'active' | 'completed' | 'overdue' | 'on_hold';

export interface DevelopmentPlan {
  id: number;
  title: string;
  user_id: number | null;
  employee_name: string | null;
  employee_initials: string | null;
  employee_no: string | null;
  jobrole: string | null;
  department_id: number | null;
  department: string | null;
  status: string;
  /** Display label derived server-side: active -> "In Progress", etc. */
  status_label: string;
  progress: number;
  start_date: string | null;
  due_date: string | null;
  start_date_label: string | null;
  due_date_label: string | null;
  approver_id: number | null;
  owner_name: string | null;
  owner_initials: string | null;
  approval_status: string | null;
  competency_id: number | null;
  framework_id: number | null;
  career_path_id: number | null;
  completed_at: string | null;
}

export interface PlanMilestone {
  id: number;
  title: string;
  status: string;
  due_date: string | null;
}

export interface DevelopmentPlanDetail extends DevelopmentPlan {
  objective: string | null;
  focus_areas: string[];
  career_path: { id: number; name: string; status: string } | null;
  next_milestone: PlanMilestone | null;
  action_counts: { total: number; completed: number };
}

export type PlanSortField = 'title' | 'status' | 'progress' | 'due_date' | 'created_at';

export interface DevelopmentPlanListParams {
  search?: string;
  status?: string;
  department_id?: string;
  approver_id?: string;
  jobrole?: string;
  career_path_id?: string;
  /** Drill-through from a competency's detail panel. */
  competency_id?: string;
  /** Command Center drilldown: only plans awaiting approval. */
  pending_approval?: string;
  sort?: PlanSortField;
  direction?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface DevelopmentPlanPayload {
  title: string;
  objective?: string;
  focus_areas?: string[];
  /** The employee the plan is FOR. Distinct from the context user_id (the actor). */
  user_id_target?: number | string;
  jobrole?: string;
  department_id?: number | string;
  approver_id?: number | string;
  career_path_id?: number | string;
  competency_id?: number | string;
  framework_id?: number | string;
  status?: PlanStatus;
  progress?: number;
  start_date?: string;
  due_date?: string;
}

export interface PlanMetrics {
  active_plans: number;
  active_plans_delta: number;
  in_progress: number;
  in_progress_percent: number;
  completed: number;
  completed_delta: number;
  career_paths: number;
  career_paths_delta: number;
  learning_assigned: number;
  learning_delta: number;
  total_plans: number;
  overdue: number;
  on_hold: number;
  pending_approval: number;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface EmployeeOption {
  id: number;
  name: string;
  initials: string;
  employee_no: string | null;
  jobrole: string | null;
  jobrole_id: number | null;
  department_id: number | null;
}

/* -- Plan detail tabs -- */

export interface PlanGapItem {
  competency_id: number | null;
  name: string;
  category: string | null;
  required: number;
  current: number;
  gap: number;
  is_focus: boolean;
  last_assessed: string | null;
}

export interface PlanGaps {
  jobrole: string | null;
  items: PlanGapItem[];
  summary: { total: number; met: number; gaps: number; met_percent: number };
}

export type PlanActionType = 'milestone' | 'training' | 'mentoring' | 'project' | 'reading' | 'other';
export type PlanActionStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface PlanAction {
  id: number;
  title: string;
  description: string | null;
  action_type: string;
  status: string;
  competency_id: number | null;
  competency_name: string | null;
  owner_id: number | null;
  owner_name: string | null;
  due_date: string | null;
  due_date_label: string | null;
  completed_at: string | null;
  sequence: number;
}

export interface PlanActionPayload {
  title: string;
  description?: string;
  action_type?: PlanActionType;
  status?: PlanActionStatus;
  competency_id?: number;
  owner_id?: number;
  due_date?: string;
  sequence?: number;
}

export interface PlanHistoryEntry {
  id: number;
  action: string;
  description: string | null;
  by: string;
  date: string | null;
}

/* -- Career paths -- */

export interface CareerPathSummary {
  id: number;
  name: string;
  description: string | null;
  department_id: number | null;
  department: string | null;
  job_family: string | null;
  status: string;
  step_count: number;
  roles: string[];
  linked_plans: number;
  created_at: string | null;
}

export interface CareerPathStep {
  id?: number;
  jobrole: string;
  jobrole_id: number | null;
  job_level: string | null;
  step_order: number;
  step_type: string;
  description: string | null;
}

export interface CareerPathDetail {
  id: number;
  name: string;
  description: string | null;
  department_id: number | null;
  department: string | null;
  job_family: string | null;
  status: string;
  steps: CareerPathStep[];
}

export interface CareerPathPayload {
  name: string;
  description?: string;
  department_id?: number | string;
  department?: string;
  job_family?: string;
  status?: 'draft' | 'active' | 'archived';
  steps?: Array<{ jobrole: string; jobrole_id?: number | null; job_level?: string | null; step_type?: string }>;
}

export interface ExplorerNode extends CareerPathStep {
  is_current: boolean;
  /** Readiness: share of the role's required proficiency the employee holds. */
  match_percent: number | null;
  required_skills: number;
}

export interface ExplorerLateralRole {
  jobrole: string;
  jobrole_id: number;
  job_level: string | null;
  match_percent: number | null;
}

export interface CareerExplorer {
  career_path_id: number | null;
  name: string;
  current_role: string | null;
  employee_id: number | null;
  /** career_path | career_journey | related | department | none */
  source: string;
  nodes: ExplorerNode[];
  lateral_roles: ExplorerLateralRole[];
}

export interface RoleOption {
  id: number;
  jobrole: string;
  job_level: string | null;
  department: string | null;
  department_id: number | null;
}

/* -- Learning assignments -- */

export type LearningStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Overdue';
export type LearningType = 'Mandatory' | 'Optional' | 'Recommended';

export interface LearningAssignment {
  id: number;
  user_id: number;
  employee_name: string | null;
  employee_initials: string | null;
  course_id: number;
  course_name: string | null;
  course_type: string | null;
  course_category: string | null;
  assignment_type: string;
  status: string;
  progress: number;
  approval_status: string;
  due_date: string | null;
  due_date_label: string | null;
  assigned_by: string | null;
  assigned_on: string | null;
  development_plan_id: number | null;
  plan_title: string | null;
  competency_id: number | null;
  competency_name: string | null;
}

export interface LearningAssignmentListParams {
  search?: string;
  status?: string;
  assignment_type?: string;
  development_plan_id?: string;
  employee_id?: string;
  /** Drill-through from a competency's detail panel. */
  competency_id?: string;
  page?: number;
  per_page?: number;
}

export interface LearningAssignmentPayload {
  course_id: number;
  user_ids: number[];
  assignment_type?: LearningType;
  status?: LearningStatus;
  due_date?: string;
  development_plan_id?: number;
  competency_id?: number;
}

export interface CourseOption {
  id: number;
  name: string;
  type: string | null;
  category: string | null;
}

/* ------------------------------------------------------------------ *
 * Service
 * ------------------------------------------------------------------ */

export const developmentCareerService = {
  /* -- Development plans -- */
  listPlans: (session: SessionContext, params?: DevelopmentPlanListParams) =>
    apiGet<DevCareerListResponse<DevelopmentPlan[]>>(
      session,
      '/competency/development-plans',
      contextParams(session, toStringParams({ ...params })),
    ),

  getMetrics: (session: SessionContext) =>
    apiGet<DevCareerApiResponse<PlanMetrics>>(
      session,
      '/competency/development-plans/metrics',
      contextParams(session),
    ),

  getOwners: (session: SessionContext) =>
    apiGet<DevCareerApiResponse<FilterOption[]>>(
      session,
      '/competency/development-plans/owners',
      contextParams(session),
    ),

  getEmployees: (session: SessionContext, search?: string) =>
    apiGet<DevCareerApiResponse<EmployeeOption[]>>(
      session,
      '/competency/employee-options',
      contextParams(session, toStringParams({ search })),
    ),

  getPlan: (session: SessionContext, id: number) =>
    apiGet<DevCareerApiResponse<DevelopmentPlanDetail>>(
      session,
      `/competency/development-plans/${id}`,
      contextParams(session),
    ),

  createPlan: (session: SessionContext, payload: DevelopmentPlanPayload) =>
    apiPost<DevCareerApiResponse<{ id: number }>>(session, '/competency/development-plans', {
      ...contextParams(session),
      ...serializePayload(payload),
    }),

  updatePlan: (session: SessionContext, id: number, payload: Partial<DevelopmentPlanPayload>) =>
    apiPut<DevCareerApiResponse<{ id: number }>>(session, `/competency/development-plans/${id}`, {
      ...contextParams(session),
      ...serializePayload(payload),
    }),

  deletePlan: (session: SessionContext, id: number) =>
    apiDelete<DevCareerApiResponse<null>>(
      session,
      `/competency/development-plans/${id}`,
      contextParams(session),
    ),

  /* -- Plan detail tabs -- */
  getGaps: (session: SessionContext, id: number) =>
    apiGet<DevCareerApiResponse<PlanGaps>>(
      session,
      `/competency/development-plans/${id}/gaps`,
      contextParams(session),
    ),

  getActions: (session: SessionContext, id: number) =>
    apiGet<DevCareerApiResponse<PlanAction[]>>(
      session,
      `/competency/development-plans/${id}/actions`,
      contextParams(session),
    ),

  createAction: (session: SessionContext, id: number, payload: PlanActionPayload) =>
    apiPost<DevCareerApiResponse<{ id: number; plan_progress: number | null }>>(
      session,
      `/competency/development-plans/${id}/actions`,
      { ...contextParams(session), ...serializePayload(payload) },
    ),

  updateAction: (session: SessionContext, id: number, actionId: number, payload: Partial<PlanActionPayload>) =>
    apiPut<DevCareerApiResponse<{ id: number; plan_progress: number | null }>>(
      session,
      `/competency/development-plans/${id}/actions/${actionId}`,
      { ...contextParams(session), ...serializePayload(payload) },
    ),

  deleteAction: (session: SessionContext, id: number, actionId: number) =>
    apiDelete<DevCareerApiResponse<{ plan_progress: number | null }>>(
      session,
      `/competency/development-plans/${id}/actions/${actionId}`,
      contextParams(session),
    ),

  getHistory: (session: SessionContext, id: number) =>
    apiGet<DevCareerApiResponse<PlanHistoryEntry[]>>(
      session,
      `/competency/development-plans/${id}/history`,
      contextParams(session),
    ),

  /* -- Career paths -- */
  listCareerPaths: (session: SessionContext, params?: { search?: string; status?: string; page?: number; per_page?: number }) =>
    apiGet<DevCareerListResponse<CareerPathSummary[]>>(
      session,
      '/competency/career-paths',
      contextParams(session, toStringParams({ ...params })),
    ),

  getCareerPath: (session: SessionContext, id: number) =>
    apiGet<DevCareerApiResponse<CareerPathDetail>>(
      session,
      `/competency/career-paths/${id}`,
      contextParams(session),
    ),

  createCareerPath: (session: SessionContext, payload: CareerPathPayload) =>
    apiPost<DevCareerApiResponse<{ id: number }>>(session, '/competency/career-paths', {
      ...contextParams(session),
      ...payload,
    }),

  updateCareerPath: (session: SessionContext, id: number, payload: Partial<CareerPathPayload>) =>
    apiPut<DevCareerApiResponse<{ id: number }>>(session, `/competency/career-paths/${id}`, {
      ...contextParams(session),
      ...payload,
    }),

  deleteCareerPath: (session: SessionContext, id: number) =>
    apiDelete<DevCareerApiResponse<null>>(
      session,
      `/competency/career-paths/${id}`,
      contextParams(session),
    ),

  getExplorer: (session: SessionContext, params?: { plan_id?: number; career_path_id?: number; employee_id?: number }) =>
    apiGet<DevCareerApiResponse<CareerExplorer>>(
      session,
      '/competency/career-paths/explorer',
      contextParams(session, toStringParams({ ...params })),
    ),

  getRoleOptions: (session: SessionContext, search?: string) =>
    apiGet<DevCareerApiResponse<RoleOption[]>>(
      session,
      '/competency/career-paths/role-options',
      contextParams(session, toStringParams({ search })),
    ),

  /* -- Learning assignments -- */
  listLearning: (session: SessionContext, params?: LearningAssignmentListParams) =>
    apiGet<DevCareerListResponse<LearningAssignment[]>>(
      session,
      '/competency/learning-assignments',
      contextParams(session, toStringParams({ ...params })),
    ),

  assignLearning: (session: SessionContext, payload: LearningAssignmentPayload) =>
    apiPost<DevCareerApiResponse<{ assigned: number }>>(session, '/competency/learning-assignments', {
      ...contextParams(session),
      ...payload,
    }),

  updateLearning: (
    session: SessionContext,
    id: number,
    payload: { status?: LearningStatus; progress?: number; due_date?: string; assignment_type?: LearningType },
  ) =>
    apiPut<DevCareerApiResponse<{ id: number }>>(session, `/competency/learning-assignments/${id}`, {
      ...contextParams(session),
      ...payload,
    }),

  deleteLearning: (session: SessionContext, id: number) =>
    apiDelete<DevCareerApiResponse<null>>(
      session,
      `/competency/learning-assignments/${id}`,
      contextParams(session),
    ),

  getCourses: (session: SessionContext, search?: string) =>
    apiGet<DevCareerApiResponse<CourseOption[]>>(
      session,
      '/competency/learning-assignments/courses',
      contextParams(session, toStringParams({ search })),
    ),
};

/* ------------------------------------------------------------------ *
 * Command Center filters (departments dropdown)
 *
 * G2G's `useWorkspaceLookups` (hooks/use-development-career.ts) also calls
 * `competencyCommandCenterService.getFilters` from
 * `services/competency/command-center.ts` for the "Department" filter
 * options. That service is out of scope for this port (owned by the
 * Competency Command Center screen), so only the one endpoint + shape this
 * screen actually consumes is mirrored here.
 * ------------------------------------------------------------------ */

export interface CompetencyFilterOption {
  value: string;
  label: string;
}

export interface CompetencyFilterOptions {
  departments: CompetencyFilterOption[];
  jobroles: CompetencyFilterOption[];
  locations: CompetencyFilterOption[];
  business_units: CompetencyFilterOption[];
  job_families: CompetencyFilterOption[];
}

export const competencyCommandCenterService = {
  getFilters: (session: SessionContext) =>
    apiGet<DevCareerApiResponse<CompetencyFilterOptions>>(
      session,
      '/competency/command-center/filters',
      contextParams(session),
    ),
};
