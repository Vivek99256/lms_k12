'use client';

/**
 * Capability Library (Libraries & Taxonomy) API client.
 *
 * Ported from G2G's `services/competency/libraries.ts` — backs the eight
 * library tabs the competency module owns (Skill, Job Role, Job Role Task,
 * Knowledge, Ability, Attitude, Behaviour, Invisible) plus their taxonomy
 * editors and the skill taxonomy tree. Backed by the Laravel Capability
 * Library API:
 *   GET    /competency/library/meta
 *   GET    /competency/library/skill-taxonomy-tree
 *   GET    /competency/library/levels-of-responsibility
 *   GET    /competency/library/work-functions
 *   GET|POST|PUT|DELETE /competency/library/taxonomy/{type}
 *   GET|POST /competency/library/skills[/{id}]
 *   PUT|DELETE /competency/library/skills/{id}
 *   GET|POST /competency/library/jobroles[/{id}]
 *   PUT|DELETE /competency/library/jobroles/{id}
 *   GET /competency/library/jobrole-tasks[/{id}]
 *   PUT|DELETE /competency/library/jobrole-tasks/{id}
 *   GET/POST /competency/library/kasa/{type}[/{id}]
 *   PUT|DELETE /competency/library/kasa/{type}/{id}
 *   GET /competency/library/kasa/{type}/{id}/usage
 *   POST /competency/library/invisible/{id}/clone
 *   GET|POST /competency/library/invisible[/{id}]
 *   PUT|DELETE /competency/library/invisible/{id}
 *
 * NOTE: `POST /competency/library/jobrole-tasks` (create) is deliberately not
 * registered server-side — it collides with an existing route in
 * task_management.php. This screen never calls `create` for the
 * jobrole-task tab (LibraryTab.openCreate / LibraryForm submit both go
 * through the generic `create` below for every tab including jobrole-task),
 * so that IS a real gap: adding a Job Role Task from this screen will 404.
 * See the migration report for detail.
 *
 * This is an EXACT as-is migration: endpoint paths, HTTP methods, query/body
 * field names and response shapes are preserved exactly as in G2G. Only the
 * transport changed: native `fetch` + this project's `buildSessionContext()`
 * / `createAuthHeaders()` (see `lib/erp-client.ts`), same pattern as
 * `talent-management/_lib/certifications-api.ts`.
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

/** Standard Laravel context params, mirroring G2G's `withLaravelParams`. */
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

function toStringParams(input: Record<string, unknown>): Record<string, string> {
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
// Types (ported from G2G's services/competency/libraries.ts)
// ---------------------------------------------------------------------------

export interface LibraryApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

export interface LibraryPagination {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface LibraryListResponse<T> extends LibraryApiResponse<T> {
  pagination: LibraryPagination;
}

export type LibraryTabId =
  | 'skill'
  | 'jobrole'
  | 'jobrole-task'
  | 'knowledge'
  | 'ability'
  | 'attitude'
  | 'behaviour'
  | 'invisible';

export const KASA_TABS = ['knowledge', 'ability', 'attitude', 'behaviour'] as const;
export type KasaTabId = (typeof KASA_TABS)[number];

export function isKasaTab(tab: LibraryTabId): tab is KasaTabId {
  return (KASA_TABS as readonly string[]).includes(tab);
}

export const TAXONOMY_TABS: LibraryTabId[] = [
  'skill',
  'jobrole',
  'jobrole-task',
  'knowledge',
  'ability',
  'attitude',
  'behaviour',
];

const BASE = '/competency/library';

function pathFor(tab: LibraryTabId): string {
  if (isKasaTab(tab)) return `${BASE}/kasa/${tab}`;
  if (tab === 'skill') return `${BASE}/skills`;
  if (tab === 'jobrole') return `${BASE}/jobroles`;
  if (tab === 'jobrole-task') return `${BASE}/jobrole-tasks`;
  return `${BASE}/invisible`;
}

export interface LibraryRow {
  id: number;
  sub_institute_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  [column: string]: unknown;
}

export interface SkillRow extends LibraryRow {
  title: string;
  description: string | null;
  category: string | null;
  sub_category: string | null;
  department: string | null;
  proficiency_level: string | null;
  approve_status: string | null;
  competency_type: string | null;
}

export interface JobroleRow extends LibraryRow {
  jobrole: string;
  description: string | null;
  department: string | null;
  jobrole_category: string | null;
  performance_expectation: string | null;
  status: string | null;
}

export interface JobroleTaskRow extends LibraryRow {
  task: string;
  jobrole: string | null;
  critical_work_function: string | null;
  task_type: string | null;
  task_category: string | null;
}

export interface KasaRow extends LibraryRow {
  title: string;
  description: string | null;
  category: string | null;
  sub_category: string | null;
  assessment_method: string | null;
  business_link: string | null;
}

export interface InvisibleRow extends LibraryRow {
  type: string;
  title: string;
  description: string | null;
  purpose: string | null;
  when_to_use: string | null;
  benefits: string | null;
  limitations: string | null;
  example_use_case: string | null;
  tags: string | null;
  difficulty_level: string | null;
}

export interface GenericDetail {
  record: LibraryRow;
}

export interface LibraryMeta {
  departments: string[];
  sub_departments: string[];
  micro_categories: string[];
  industries: string[];
  jobroles_by_department: Record<string, { id: number; jobrole: string }[]>;
  related_skills: string[];
  job_titles: string[];
  learning_resources: string[];
  proficiency_levels: string[];
  invisible_types: string[];
  task_types: string[];
  counts: Record<LibraryTabId, number>;
}

export interface TaxonomySubCategory {
  name: string;
  total: number;
}

export interface TaxonomyCategory {
  category: string;
  total: number;
  sub_categories: TaxonomySubCategory[];
}

export interface TaxonomyTree {
  type: string;
  has_sub_level: boolean;
  categories: TaxonomyCategory[];
}

export interface SkillTaxonomyLeaf {
  id: number;
  name: string;
  department: string | null;
  proficiency_level: string | null;
  approve_status: string | null;
}

export interface SkillTaxonomyBranch {
  name: string;
  total: number;
  children: SkillTaxonomyLeaf[];
}

export interface SkillTaxonomyRoot {
  name: string;
  total: number;
  children: SkillTaxonomyBranch[];
}

export interface SkillTaxonomy {
  total_skills: number;
  total_categories: number;
  truncated: boolean;
  categories: SkillTaxonomyRoot[];
}

export interface ResponsibilityAttribute {
  code: string | null;
  name: string | null;
  overall_description: string | null;
  guidance_notes: string | null;
  description: string | null;
}

export interface ResponsibilityAttributeGroup {
  name: string;
  attributes: ResponsibilityAttribute[];
}

export interface ResponsibilityLevel {
  level: string;
  guiding_phrase: string | null;
  essence: string | null;
  guidance_notes: string | null;
  groups: ResponsibilityAttributeGroup[];
}

export interface LibraryListParams {
  search?: string;
  category?: string;
  sub_category?: string;
  department?: string;
  jobrole?: string;
  proficiency_level?: string;
  approve_status?: string;
  status?: string;
  critical_work_function?: string;
  task_type?: string;
  difficulty_level?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export type LibraryPayload = Record<string, string | number | null | undefined>;

export interface TaxonomyPayload {
  category: string;
  sub_category?: string;
  old_category?: string;
  old_sub_category?: string;
}

export const competencyLibrariesService = {
  meta: (session: SessionContext) =>
    apiGet<LibraryApiResponse<LibraryMeta>>(session, `${BASE}/meta`, contextParams(session)),

  list: <T = LibraryRow,>(session: SessionContext, tab: LibraryTabId, params?: LibraryListParams) =>
    apiGet<LibraryListResponse<T[]>>(session, pathFor(tab), contextParams(session, toStringParams({ ...params }))),

  get: <T = GenericDetail,>(session: SessionContext, tab: LibraryTabId, id: number) =>
    apiGet<LibraryApiResponse<T>>(session, `${pathFor(tab)}/${id}`, contextParams(session)),

  create: (session: SessionContext, tab: LibraryTabId, payload: LibraryPayload) =>
    apiPost<LibraryApiResponse<{ id: number }>>(session, pathFor(tab), { ...contextParams(session), ...payload }),

  update: (session: SessionContext, tab: LibraryTabId, id: number, payload: LibraryPayload) =>
    apiPut<LibraryApiResponse<{ id: number }>>(session, `${pathFor(tab)}/${id}`, { ...contextParams(session), ...payload }),

  remove: (session: SessionContext, tab: LibraryTabId, id: number) =>
    apiDelete<LibraryApiResponse<{ id: number }>>(session, `${pathFor(tab)}/${id}`, contextParams(session)),

  cloneInvisible: (session: SessionContext, id: number, title?: string) =>
    apiPost<LibraryApiResponse<{ id: number; title: string }>>(session, `${BASE}/invisible/${id}/clone`, {
      ...contextParams(session),
      ...(title ? { title } : {}),
    }),

  taxonomy: (session: SessionContext, tab: LibraryTabId) =>
    apiGet<LibraryApiResponse<TaxonomyTree>>(session, `${BASE}/taxonomy/${tab}`, contextParams(session)),

  createTaxonomy: (session: SessionContext, tab: LibraryTabId, payload: TaxonomyPayload) =>
    apiPost<LibraryApiResponse<null>>(session, `${BASE}/taxonomy/${tab}`, { ...contextParams(session), ...payload }),

  renameTaxonomy: (session: SessionContext, tab: LibraryTabId, payload: TaxonomyPayload) =>
    apiPut<LibraryApiResponse<{ affected: number }>>(session, `${BASE}/taxonomy/${tab}`, { ...contextParams(session), ...payload }),

  deleteTaxonomy: (session: SessionContext, tab: LibraryTabId, category: string, subCategory?: string) =>
    apiDelete<LibraryApiResponse<null>>(session, `${BASE}/taxonomy/${tab}`, contextParams(session, toStringParams({ category, sub_category: subCategory }))),

  workFunctions: (session: SessionContext, jobrole?: string) =>
    apiGet<LibraryApiResponse<string[]>>(session, `${BASE}/work-functions`, contextParams(session, toStringParams({ jobrole }))),

  levelsOfResponsibility: (session: SessionContext) =>
    apiGet<LibraryApiResponse<ResponsibilityLevel[]>>(session, `${BASE}/levels-of-responsibility`, contextParams(session)),

  skillTaxonomyTree: (session: SessionContext, params?: { search?: string; category?: string; department?: string }) =>
    apiGet<LibraryApiResponse<SkillTaxonomy>>(session, `${BASE}/skill-taxonomy-tree`, contextParams(session, toStringParams({ ...params }))),

  /**
   * Where a knowledge / ability / attitude / behaviour item is used — walks
   * s_skill_knowledge_ability back to the skills that reference it.
   */
  kasaUsage: <T = unknown,>(session: SessionContext, tab: KasaTabId, id: number) =>
    apiGet<LibraryApiResponse<T>>(session, `${BASE}/kasa/${tab}/${id}/usage`, contextParams(session)),
};
