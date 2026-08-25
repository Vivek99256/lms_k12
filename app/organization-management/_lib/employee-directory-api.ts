'use client';

/**
 * Employee Directory API client.
 *
 * Ported from G2G's inline fetch in `components/domain/organization/
 * employee-directory.tsx` (list) and `services/organization/
 * employee-profile-service.ts` (profile drawer tabs: personal info, upload
 * doc, jobrole skill/tasks, LOR, competency rating, expected competency).
 *
 * Backend wiring change (explicit product decision, see the migration
 * brief): G2G calls `/user/add_user` (list + profile get/update),
 * `/user/user_document/{id}` (upload), `/competency/employee-profiles/{id}`
 * (competency), and an external HP KABA service
 * (`resolveHpApiBaseUrl()/get-kaba`). This project instead calls new
 * LMS-K12 endpoints under `/organization-management/employee-directory/...`
 * that a sibling backend effort is wiring to reuse LMS-K12's existing staff
 * tables while returning the SAME response shapes G2G's screens expect:
 *
 *   GET    /organization-management/employee-directory                (list)
 *   GET    /organization-management/employee-directory/{id}           (profile - personal info, docs, skills, tasks, LOR)
 *   PUT    /organization-management/employee-directory/{id}           (update personal info)
 *   DELETE /organization-management/employee-directory/{id}
 *   POST   /organization-management/employee-directory/{id}/documents (upload doc)
 *   GET    /organization-management/employee-directory/analytics/kpis
 *   GET    /organization-management/employee-directory/analytics/growth
 *   GET    /organization-management/employee-directory/analytics/growth-stacked
 *   GET    /organization-management/employee-directory/analytics/departments-distribution
 *   GET    /organization-management/employee-directory/analytics/job-roles-distribution
 *   GET    /organization-management/employee-directory/analytics/lifecycle
 *   GET    /organization-management/employee-directory/analytics/attrition
 *   GET    /organization-management/employee-directory/analytics/skills-matrix
 *
 * The competency-rating tab's job-role KABA lookup
 * (`fetchJobRoleKaba`, G2G's external HP service call) and the standalone
 * competency-profile call (`fetchCompetencyProfile`,
 * `/competency/employee-profiles/{id}`) are kept as their own functions
 * below, pointed at the same `/organization-management/employee-directory`
 * prefix (`.../{id}/competency-profile`, `.../{id}/jobrole-kaba`) rather than
 * G2G's external HP host, per the same "reuse the new prefix" instruction.
 *
 * Only the transport changed: native `fetch` + this project's
 * `buildSessionContext()` / `createAuthHeaders()` (see `lib/erp-client.ts`)
 * instead of G2G's `webClient`/`apiClient` + `LaravelContext`.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client';
import type { Employee, EmployeeProfileFullResponse, ReferenceData } from './organization-types';

export { buildSessionContext };
export type { SessionContext };
export type { Employee, EmployeeProfileFullResponse, ReferenceData };

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
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
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
const apiPost = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'POST', path, { body });
const apiPut = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'PUT', path, { body });
const apiPostForm = <T,>(session: SessionContext, path: string, form: FormData) =>
  request<T>(session, 'POST', path, { form });

/** Standard context params, mirroring G2G's `withLaravelParams`. */
function withContextParams(session: SessionContext, extra?: Record<string, string | undefined>) {
  return {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    user_id: session.userId,
    type: 'API',
    ...extra,
  };
}

export function isEmployeeDirectorySessionReady(session: SessionContext): boolean {
  return Boolean(session.token && session.subInstituteId);
}

// ---------------------------------------------------------------------------
// Reference data / create / status - backend counterpart added alongside
// `EmployeeDirectoryController::referenceData()/create()/{id}/invite`; ported
// per the migration brief against G2G's `services/organization/
// employee-directory.ts` (`employeeDirectoryService.referenceData/create/
// setStatus`).
// ---------------------------------------------------------------------------

export interface ReferenceDataResponse {
  status_code?: number | string;
  message?: string;
  data?: ReferenceData;
}

export interface CreateEmployeeResponse {
  status_code?: number | string;
  message?: string;
  data?: Record<string, any>;
  invite_sent?: boolean;
}

export interface StatusResponse {
  status_code?: number | string;
  message?: string;
}

// ---------------------------------------------------------------------------
// List (main directory screen)
// ---------------------------------------------------------------------------

export interface EmployeeListPagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface EmployeeListResponse {
  status_code?: number | string;
  status?: number | string;
  message?: string;
  data?: unknown;
  departments?: Array<{ id: number | string; department: string }>;
  jobroleList?: Array<{ id: number | string; jobrole: string }>;
  pagination?: EmployeeListPagination;
}

/** Filter values the directory screen's Department/Job Role/Status dropdowns send to the API. */
export interface EmployeeListFilters {
  department_id?: string;
  jobrole_id?: string;
  /** '1' (Active) | '0' (Inactive) - already converted from the UI's 'active'/'inactive'. */
  active_status?: string;
  search?: string;
  /** 1-based page number; sent together with per_page to opt into backend pagination. */
  page?: string;
  per_page?: string;
}

/** `tbluser.status` (0/1, or already a string) -> the 'Active'/'Inactive' string the ported UI expects. */
function normalizeEmployeeStatus(status: unknown): string {
  if (typeof status === 'string' && status.trim()) return status;
  return Number(status) === 1 ? 'Active' : 'Inactive';
}

/** Raw list row -> the `Employee` shape the directory table renders. */
export function normalizeEmployeeListItem(item: any): Employee {
  return {
    id: item.id || 0,
    full_name: item.full_name || 'N/A',
    email: item.email || 'N/A',
    mobile: item.mobile || 'N/A',
    department_name: item.department_name || 'N/A',
    jobRole: item.jobrole || 'N/A',
    designation: item.designation || 'N/A',
    address: item.address || 'N/A',
    image: item.image?.trim ? (item.image?.trim() ? item.image : '') : item.image || '',
    occupation: item.occupation || 'N/A',
    // Backend `tbluser.status` is a raw 0/1 integer; the ported UI (badges,
    // status filter) expects the G2G-style 'Active'/'Inactive' string.
    status: normalizeEmployeeStatus(item.status),
    // Raw 0/1 alongside the normalized 'Active'/'Inactive' label above - the
    // row action menu (Suspend/Restore Access) needs the actual 0/1 to send
    // back to `setStatus()`, not the display string.
    status_code: item.status !== undefined && item.status !== null && item.status !== '' ? Number(item.status) : null,
    lastActivity: item.last_activity || 'Unknown',
    join_Date: item.join_date || 'Unknown',
    profile_name: item.profile_name || 'Unknown',
    skills: item.skills || [],
  };
}

export const EmployeeDirectoryService = {
  list: (session: SessionContext, filters?: EmployeeListFilters) =>
    apiGet<EmployeeListResponse>(
      session,
      '/organization-management/employee-directory',
      withContextParams(session, {
        department_id: filters?.department_id || undefined,
        jobrole_id: filters?.jobrole_id || undefined,
        active_status: filters?.active_status || undefined,
        search: filters?.search || undefined,
        page: filters?.page || undefined,
        per_page: filters?.per_page || undefined,
      })
    ),

  get: (session: SessionContext, id: string | number) =>
    apiGet<EmployeeProfileFullResponse>(
      session,
      `/organization-management/employee-directory/${id}`,
      withContextParams(session)
    ),

  /** GET `/organization-management/employee-directory/reference-data` - option lists + defaults for the Add Employee flow. */
  referenceData: (session: SessionContext) =>
    apiGet<ReferenceDataResponse>(
      session,
      '/organization-management/employee-directory/reference-data',
      withContextParams(session)
    ),

  /** POST `/organization-management/employee-directory/create` - onboards a new employee and (best-effort) sends their invite. */
  create: (session: SessionContext, payload: Record<string, any>) =>
    apiPost<CreateEmployeeResponse>(session, '/organization-management/employee-directory/create', payload),

  /** PATCH `/organization-management/employee-directory/{id}/status` - Suspend/Restore Access; `status`: 1 = active, 0 = suspended. */
  setStatus: (session: SessionContext, id: string | number, status: 0 | 1) =>
    request<StatusResponse>(session, 'PATCH', `/organization-management/employee-directory/${id}/status`, {
      body: { status },
    }),

  update: (session: SessionContext, id: string | number, payload: Record<string, any>) =>
    apiPut<{ status?: string | number; message?: string }>(
      session,
      `/organization-management/employee-directory/${id}`,
      payload
    ),

  uploadDocument: (session: SessionContext, id: string | number, formData: FormData) =>
    apiPostForm<{ status?: string | number; message?: string }>(
      session,
      `/organization-management/employee-directory/${id}/documents`,
      formData
    ),

  competencyProfile: (session: SessionContext, id: string | number) =>
    apiGet<any>(session, `/organization-management/employee-directory/${id}/competency-profile`, withContextParams(session)),

  jobRoleKaba: (session: SessionContext, jobRoleId: string | number) =>
    apiGet<unknown>(session, '/organization-management/employee-directory/analytics/skills-matrix', {
      type: 'jobrole',
      type_id: String(jobRoleId),
    }),

  /**
   * KNOWN ISSUE (2026-08-25 migration audit): this call 422s in practice.
   * `PUT .../{id}/skills/{matrixId}` (`EmployeeDirectoryController::
   * updateSkillRating`) validates `proficiency_level` as `required|integer|
   * min:0|max:5` against `s_skill_matrix`, but the `matrixId` this screen
   * actually has on hand comes from `mapKabaRatings()` in
   * `employee-directory-sheets.tsx`, whose ids are read out of the
   * `.../{id}/competency-profile` payload (job-role-derived KASBA items) -
   * not `s_skill_matrix` rows. There is a *working* item-level rating
   * endpoint (`POST /competency/kasba-rating`, `KasbaRatingController::
   * store`, wired below as `rateKasbaItem()`), but it validates against its
   * own `competency_kasba_item` table, which the competency-profile payload's
   * ids also do not line up with 1:1 - so neither call can be safely swapped
   * in as a drop-in fix without a backend change reconciling the two id
   * spaces. Left in place; do not remove without confirming the id mismatch
   * is resolved.
   */
  updateSkillRating: (session: SessionContext, id: string | number, matrixId: number | string, level: number) =>
    apiPut<any>(
      session,
      `/organization-management/employee-directory/${id}/skills/${matrixId}`,
      { proficiency_level: level }
    ),

  /**
   * POST `/competency/kasba-rating` (`KasbaRatingController::store`) - rates
   * ONE KASBA item (1-5; the backend rejects 0, since "unrated" and "rated
   * 0" are deliberately distinct there) for one employee. This is the
   * "direct-item KASBA rating" endpoint referenced in `updateSkillRating`'s
   * docblock above - genuinely a different, working write path, not the
   * broken `.../skills/{matrixId}` one. `kasbaType` isn't sent - the backend
   * validates `kasba_item_id`/`user_id`/`rating` only and doesn't take a
   * category - but it's kept in the signature so a caller working from
   * `CompetencyRatingTab`'s `(category, id, level)` shape can pass it through
   * without reshaping its call site.
   */
  rateKasbaItem: (
    session: SessionContext,
    employeeId: string | number,
    kasbaType: string,
    itemId: number | string,
    level: number
  ) =>
    apiPost<StatusResponse & { data?: { kasba_item_id: number; user_id: number } }>(session, '/competency/kasba-rating', {
      user_id: employeeId,
      kasba_item_id: itemId,
      rating: level,
    }),

  kpis: (session: SessionContext) =>
    apiGet<any>(session, '/organization-management/employee-directory/analytics/kpis', withContextParams(session)),
  growth: (session: SessionContext) =>
    apiGet<any>(session, '/organization-management/employee-directory/analytics/growth', withContextParams(session)),
  growthStacked: (session: SessionContext) =>
    apiGet<any>(session, '/organization-management/employee-directory/analytics/growth-stacked', withContextParams(session)),
  departmentsDistribution: (session: SessionContext) =>
    apiGet<any>(session, '/organization-management/employee-directory/analytics/departments-distribution', withContextParams(session)),
  jobRolesDistribution: (session: SessionContext) =>
    apiGet<any>(session, '/organization-management/employee-directory/analytics/job-roles-distribution', withContextParams(session)),
  lifecycle: (session: SessionContext) =>
    apiGet<any>(session, '/organization-management/employee-directory/analytics/lifecycle', withContextParams(session)),
  attrition: (session: SessionContext) =>
    apiGet<any>(session, '/organization-management/employee-directory/analytics/attrition', withContextParams(session)),
  skillsMatrix: (session: SessionContext) =>
    apiGet<any>(session, '/organization-management/employee-directory/analytics/skills-matrix', withContextParams(session)),
};

// ---------------------------------------------------------------------------
// Profile drawer - ported from G2G's `employee-profile-service.ts`
// ---------------------------------------------------------------------------

export async function fetchEmployeeProfile(
  id: string | number,
  session?: SessionContext
): Promise<EmployeeProfileFullResponse> {
  const ctx = session ?? buildSessionContext();
  return EmployeeDirectoryService.get(ctx, id);
}

export async function updateEmployeeProfile(
  id: string | number,
  payload: Record<string, any>,
  session?: SessionContext
): Promise<{ status?: string | number; message?: string }> {
  const ctx = session ?? buildSessionContext();
  return EmployeeDirectoryService.update(ctx, id, payload);
}

export async function uploadEmployeeDocument(
  id: string | number,
  formData: FormData,
  session?: SessionContext
): Promise<{ status?: string | number; message?: string }> {
  const ctx = session ?? buildSessionContext();
  return EmployeeDirectoryService.uploadDocument(ctx, id, formData);
}

export async function fetchCompetencyProfile(id: string | number, session?: SessionContext): Promise<any> {
  const ctx = session ?? buildSessionContext();
  return EmployeeDirectoryService.competencyProfile(ctx, id);
}

/**
 * Gets the competency matrix assigned to a job role. G2G calls an external HP
 * KABA service directly (`resolveHpApiBaseUrl()/get-kaba`); this project
 * calls the new `/organization-management/employee-directory/analytics/
 * skills-matrix` endpoint instead, per the migration brief's "point analytics
 * calls at this prefix" instruction.
 */
export async function fetchJobRoleKaba(jobRoleId: string | number, session?: SessionContext): Promise<unknown> {
  const ctx = session ?? buildSessionContext();
  return EmployeeDirectoryService.jobRoleKaba(ctx, jobRoleId);
}

export async function updateSkillRating(
  id: string | number,
  matrixId: number | string,
  level: number,
  session?: SessionContext
): Promise<any> {
  const ctx = session ?? buildSessionContext();
  return EmployeeDirectoryService.updateSkillRating(ctx, id, matrixId, level);
}
