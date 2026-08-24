'use client';

/**
 * Competency Framework Studio API client (Framework CRUD + Studio + Role
 * Mapping Matrix + Mapping Reviews).
 *
 * Ported from G2G's `services/competency/studio.ts` — hits the Laravel
 * Competency Framework API:
 *   GET  /competency/studio/summary
 *   GET  /competency/studio/framework-structure
 *   GET  /competency/studio/proficiency-scale
 *   POST /competency/studio/proficiency-scale
 *   PUT|DELETE /competency/studio/proficiency-scale/{id}
 *   GET|PUT /competency/studio/weights
 *   GET|POST /competency/frameworks
 *   GET|PUT|DELETE /competency/frameworks/{id}
 *   POST /competency/frameworks/{id}/clone
 *   GET|POST /competency/frameworks/{id}/items
 *   DELETE /competency/frameworks/{id}/items/{itemId}
 *   GET /competency/role-mapping/roles
 *   GET /competency/role-mapping/matrix
 *   PUT|DELETE /competency/role-mapping/cell
 *   GET|POST /competency/mapping-reviews
 *   PUT /competency/mapping-reviews/{id}
 *   POST /competency/mapping-reviews/bulk-approve
 *
 * This is an exact port: every call in G2G's `hooks/use-competency-studio.ts`
 * (the only consumer) is preserved 1:1, same paths/methods/field names. Only
 * the transport changed, matching `libraries-taxonomy-api.ts` in this folder.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client';

export { buildSessionContext };
export type { SessionContext };

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

function contextParams(session: SessionContext, extra?: Record<string, string | undefined>): Record<string, string> {
  const params: Record<string, string> = {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    user_id: session.userId,
    type: 'API',
  };
  Object.entries(extra ?? {}).forEach(([key, value]) => {
    if (value !== undefined) params[key] = value;
  });
  return params;
}

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
// Types (ported from G2G's services/competency/studio.ts)
// ---------------------------------------------------------------------------

export interface StudioApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

export interface StudioPagination {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface StudioListResponse<T> extends StudioApiResponse<T> {
  pagination: StudioPagination;
}

export interface StudioMappingSummary {
  total_roles: number;
  fully_mapped: number;
  partially_mapped: number;
  not_mapped: number;
  fully_pct: number;
  partial_pct: number;
  not_pct: number;
}

export interface StudioActiveFramework {
  id: number;
  name: string;
  status: string;
  version: string;
}

export interface StudioSummary {
  active_framework: StudioActiveFramework | null;
  total_competencies: number;
  roles_mapped: number;
  total_roles: number;
  coverage_percent: number;
  last_published: string | null;
  mapping_summary: StudioMappingSummary;
}

export interface FrameworkStructureChild {
  name: string;
  count: number;
}

export interface FrameworkStructureNode {
  index: number;
  category: string;
  count: number;
  children: FrameworkStructureChild[];
}

export interface ProficiencyLevel {
  id?: number;
  level: number;
  label: string;
  name: string | null;
  description: string | null;
}

export interface ProficiencyLevelPayload {
  name: string;
  description?: string;
  level?: number;
  label?: string;
}

export interface KasaItem {
  level: number;
  descriptor: string | null;
  indicators: string | null;
}

export interface ProficiencyScale {
  levels: ProficiencyLevel[];
  kasa: {
    knowledge: KasaItem[];
    ability: KasaItem[];
    attitude: KasaItem[];
    behaviour: KasaItem[];
  };
}

export interface WeightRow {
  category: string;
  weight: number;
}

export interface FrameworkItem {
  id: number;
  competency_id: number;
  competency_name: string | null;
  category: string | null;
  sub_category: string | null;
  competency_type: string | null;
  required_proficiency: string | null;
}

export interface Framework {
  id: number;
  name: string;
  description: string | null;
  version: string;
  status: string;
  department_id: number | null;
  jobrole: string | null;
  created_at: string | null;
  updated_at: string | null;
  items?: FrameworkItem[];
}

export interface FrameworkPayload {
  name: string;
  description?: string;
  version?: string;
  status?: string;
  department_id?: string | number;
  jobrole?: string;
}

export interface RoleRow {
  /** s_user_jobrole.id, as stored in s_user_skill_jobrole.jobrole - the key
   * used for matrix/saveCell/clearCell, not a display name. */
  jobrole: string;
  /** The resolved display name - use this, never `jobrole`, in the UI. */
  jobrole_name: string;
  department: string | null;
  mapped_count: number;
}

export interface MatrixCompetency {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  sub_category: string | null;
  competency_type: string | null;
  proficiency_level: string | null;
}

export interface MatrixCell {
  id: number;
  level: number | null;
  raw: string | null;
}

export interface Matrix {
  category: string | null;
  roles: string[];
  /** roles[i] (a s_user_jobrole id) -> its display name. */
  role_names: Record<string, string>;
  competencies: MatrixCompetency[];
  cells: Record<string, Record<string, MatrixCell>>;
}

export interface MappingReview {
  id: number;
  jobrole: string;
  department: string | null;
  framework_id: number | null;
  submitted_by_name: string | null;
  status: string;
  changes_count: number;
  changes: string | null;
  note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
}

export interface ReviewCounts {
  pending: number;
  approved: number;
  rejected: number;
}

export interface ReviewListResponse extends StudioListResponse<MappingReview[]> {
  counts: ReviewCounts;
}

const FRAMEWORKS = '/competency/frameworks';
const STUDIO = '/competency/studio';
const ROLE_MAPPING = '/competency/role-mapping';
const REVIEWS = '/competency/mapping-reviews';

export const competencyStudioService = {
  /* -- read models -- */
  getSummary: (session: SessionContext) =>
    apiGet<StudioApiResponse<StudioSummary>>(session, `${STUDIO}/summary`, contextParams(session)),

  getFrameworkStructure: (session: SessionContext, search?: string) =>
    apiGet<StudioApiResponse<FrameworkStructureNode[]>>(session, `${STUDIO}/framework-structure`, contextParams(session, toStringParams({ search }))),

  getProficiencyScale: (session: SessionContext) =>
    apiGet<StudioApiResponse<ProficiencyScale>>(session, `${STUDIO}/proficiency-scale`, contextParams(session)),

  createLevel: (session: SessionContext, payload: ProficiencyLevelPayload) =>
    apiPost<StudioApiResponse<{ id: number }>>(session, `${STUDIO}/proficiency-scale`, { ...contextParams(session), ...payload }),

  updateLevel: (session: SessionContext, id: number, payload: ProficiencyLevelPayload) =>
    apiPut<StudioApiResponse<null>>(session, `${STUDIO}/proficiency-scale/${id}`, { ...contextParams(session), ...payload }),

  deleteLevel: (session: SessionContext, id: number) =>
    apiDelete<StudioApiResponse<null>>(session, `${STUDIO}/proficiency-scale/${id}`, contextParams(session)),

  getWeights: (session: SessionContext) =>
    apiGet<StudioApiResponse<WeightRow[]>>(session, `${STUDIO}/weights`, contextParams(session)),

  saveWeights: (session: SessionContext, weights: WeightRow[]) =>
    apiPut<StudioApiResponse<null>>(session, `${STUDIO}/weights`, { ...contextParams(session), weights }),

  /* -- frameworks -- */
  listFrameworks: (session: SessionContext, params?: { search?: string; status?: string; per_page?: number }) =>
    apiGet<StudioListResponse<Framework[]>>(session, FRAMEWORKS, contextParams(session, toStringParams({ per_page: 100, ...params }))),

  getFramework: (session: SessionContext, id: number) =>
    apiGet<StudioApiResponse<Framework>>(session, `${FRAMEWORKS}/${id}`, contextParams(session)),

  createFramework: (session: SessionContext, payload: FrameworkPayload) =>
    apiPost<StudioApiResponse<{ id: number }>>(session, FRAMEWORKS, { ...contextParams(session), ...payload }),

  updateFramework: (session: SessionContext, id: number, payload: FrameworkPayload) =>
    apiPut<StudioApiResponse<{ id: number }>>(session, `${FRAMEWORKS}/${id}`, { ...contextParams(session), ...payload }),

  cloneFramework: (session: SessionContext, id: number, name?: string) =>
    apiPost<StudioApiResponse<{ id: number; name: string }>>(session, `${FRAMEWORKS}/${id}/clone`, {
      ...contextParams(session),
      ...(name ? { name } : {}),
    }),

  deleteFramework: (session: SessionContext, id: number) =>
    apiDelete<StudioApiResponse<null>>(session, `${FRAMEWORKS}/${id}`, contextParams(session)),

  addFrameworkItem: (session: SessionContext, id: number, competencyId: number, requiredProficiency?: string) =>
    apiPost<StudioApiResponse<{ id: number }>>(session, `${FRAMEWORKS}/${id}/items`, {
      ...contextParams(session),
      competency_id: competencyId,
      ...(requiredProficiency ? { required_proficiency: requiredProficiency } : {}),
    }),

  removeFrameworkItem: (session: SessionContext, id: number, itemId: number) =>
    apiDelete<StudioApiResponse<null>>(session, `${FRAMEWORKS}/${id}/items/${itemId}`, contextParams(session)),

  /* -- role mapping matrix -- */
  getRoles: (session: SessionContext, params?: { search?: string; category?: string; page?: number; per_page?: number }) =>
    apiGet<StudioListResponse<RoleRow[]>>(session, `${ROLE_MAPPING}/roles`, contextParams(session, toStringParams({ ...params }))),

  getMatrix: (session: SessionContext, params: { category?: string; jobroles: string[] }) =>
    apiGet<StudioApiResponse<Matrix>>(session, `${ROLE_MAPPING}/matrix`, contextParams(session, toStringParams({
      category: params.category,
      jobroles: params.jobroles.join(','),
    }))),

  saveCell: (session: SessionContext, jobrole: string, skill: string, proficiencyLevel: string) =>
    apiPut<StudioApiResponse<{ id: number }>>(session, `${ROLE_MAPPING}/cell`, {
      ...contextParams(session),
      jobrole,
      skill,
      proficiency_level: proficiencyLevel,
    }),

  clearCell: (session: SessionContext, jobrole: string, skill: string) =>
    apiDelete<StudioApiResponse<null>>(session, `${ROLE_MAPPING}/cell`, contextParams(session, toStringParams({ jobrole, skill }))),

  /* -- mapping reviews -- */
  listReviews: (session: SessionContext, status: string) =>
    apiGet<ReviewListResponse>(session, REVIEWS, contextParams(session, toStringParams({ status }))),

  submitReview: (session: SessionContext, payload: { jobrole: string; department?: string; framework_id?: number; changes_count?: number; changes?: string }) =>
    apiPost<StudioApiResponse<{ id: number }>>(session, REVIEWS, { ...contextParams(session), ...payload }),

  reviewAction: (session: SessionContext, id: number, action: 'approve' | 'reject', note?: string) =>
    apiPut<StudioApiResponse<null>>(session, `${REVIEWS}/${id}`, { ...contextParams(session), action, ...(note ? { note } : {}) }),

  bulkApprove: (session: SessionContext, ids?: number[]) =>
    apiPost<StudioApiResponse<{ approved: number }>>(session, `${REVIEWS}/bulk-approve`, {
      ...contextParams(session),
      ...(ids && ids.length ? { ids } : {}),
    }),
};
