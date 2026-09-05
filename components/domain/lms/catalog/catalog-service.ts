/**
 * Learning Catalog Service
 *
 * Ported from G2G's `services/lms/catalog.ts`. Preserves the original
 * request/response contracts — only the HTTP client plumbing and endpoint
 * paths are adapted to `lib/erp-client.ts`'s convention.
 *
 * Endpoint paths per the Package 1 contract (all under `api/g2g-lms/learning-catalog/*`):
 *   GET    kpis
 *   GET    filters
 *   POST   bulk
 *   GET    courses/{id}/audience/preview
 *   POST   courses/{id}/audience
 *   GET    courses
 *   POST   courses
 *   GET    courses/{id}
 *   PUT    courses/{id}
 *   DELETE courses/{id}
 *
 * `audience/preview` and `audience` are in the contract table but have no
 * G2G source counterpart in `services/lms/catalog.ts` (they are not called
 * by any ported screen) — included here as typed stubs so the contract is
 * fully represented and available to later packages, but unused by this
 * port's UI.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type SessionContext,
} from '@/lib/erp-client'

/* ------------------------------------------------------------------ *
 * HTTP plumbing
 * ------------------------------------------------------------------ */

function apiUrl(path: string, session: SessionContext): string {
  const base = session.baseUrl.replace(/\/$/, '')
  return `${base}/${path.replace(/^\//, '')}`
}

async function apiGet<T>(
  session: SessionContext,
  path: string,
  searchParams?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(apiUrl(path, session))
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: createAuthHeaders(session),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`API Error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`)
  }

  return response.json()
}

async function apiPost<T>(
  session: SessionContext,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(apiUrl(path, session), {
    method: 'POST',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`API Error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`)
  }

  return response.json()
}

async function apiPostForm<T>(
  session: SessionContext,
  path: string,
  form: FormData,
): Promise<T> {
  const response = await fetch(apiUrl(path, session), {
    method: 'POST',
    cache: 'no-store',
    headers: createAuthHeaders(session),
    body: form,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`API Error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`)
  }

  return response.json()
}

async function apiPut<T>(
  session: SessionContext,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(apiUrl(path, session), {
    method: 'PUT',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`API Error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`)
  }

  return response.json()
}

async function apiDelete<T>(
  session: SessionContext,
  path: string,
  searchParams?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(apiUrl(path, session))
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`API Error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`)
  }

  return response.json()
}

function withCommon(session: SessionContext, extra?: Record<string, string | number | undefined>) {
  return {
    type: 'API',
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    ...extra,
  }
}

function withAuth(session: SessionContext, extra: Record<string, unknown> = {}) {
  return {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    user_id: session.userId,
    type: 'API',
    ...extra,
  }
}

/* ------------------------------------------------------------------ *
 * Types (verbatim from G2G's services/lms/catalog.ts)
 * ------------------------------------------------------------------ */

export interface CatalogApiResponse<T> {
  status: boolean
  message?: string
  data: T
}

export interface CatalogListMeta {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface CatalogListResponse {
  status: boolean
  data: CatalogCourse[]
  meta: CatalogListMeta
}

export interface CatalogCourse {
  id: number
  display_name: string | null
  display_image: string | null
  subject_category: string | null
  subject_type: string | null
  subject_code: string | null
  short_name: string | null
  jobrole: string | null
  proficiency: string | null
  sort_order: number | null
  certificate_validity_months: number | null
  status: number
  standard_id: number | null
  standard_name: string | null
  created_at: string | null
  updated_at: string | null
  learners: number
  completed_learners: number
  completion_rate: number
}

export interface CatalogCourseDetail extends CatalogCourse {
  subject_id: number | null
  allow_grades: string | null
  allow_content: string | null
  elective_subject: string | null
  add_content: string | null
  content_quantity: number | null
  chapter_count: number
}

export interface CatalogKpis {
  total_courses: number
  active_courses: number
  inactive_courses: number
  categories: number
  total_learners: number
  total_enrolments: number
  avg_completion_rate: number
}

export interface CatalogDepartment {
  id: number
  department: string
}

export interface CatalogJobRole {
  id: number
  jobrole: string
  department_id: number | null
}

export interface CatalogFilterOptions {
  categories: string[]
  subject_types: string[]
  jobroles: string[]
  job_roles: CatalogJobRole[]
  departments: CatalogDepartment[]
  languages: string[]
  certificate_templates: { value: string; label: string }[]
}

export type CatalogSortBy =
  | 'title'
  | 'category'
  | 'type'
  | 'status'
  | 'learners'
  | 'completion'
  | 'updated_at'

export type CatalogSortDir = 'asc' | 'desc'

export interface CatalogFilters {
  search?: string
  category?: string
  subjectType?: string
  status?: number
  jobrole?: string
  sortBy?: CatalogSortBy
  sortDir?: CatalogSortDir
  page?: number
  perPage?: number
}

export interface CourseUpdatePayload {
  display_name: string
  standard_id: number
  subject_category?: string | null
  subject_code?: string | null
  subject_type?: string | null
  short_name?: string | null
  jobrole?: string | null
  proficiency?: string | null
  sort_order?: number | null
  certificate_validity_months?: number | null
  status: number
}

export interface CourseCreatePayload extends CourseUpdatePayload {
  display_image?: File | null
}

export type CatalogBulkAction = 'activate' | 'deactivate' | 'delete'

export interface CatalogBulkResult {
  affected: number
  ids: number[]
  skipped: number
}

export interface AudiencePreviewResult {
  count: number
  sample: { id: number; name: string }[]
}

export interface AudienceAssignPayload {
  standard_ids?: number[]
  jobrole?: string | null
  department_ids?: number[]
}

function params(session: SessionContext, extra?: Record<string, string | number | undefined>) {
  return withCommon(session, extra)
}

/** Only send filter params that are actually set - Laravel treats '' as a value. */
function listParams(session: SessionContext, filters: CatalogFilters) {
  const extra: Record<string, string | number | undefined> = {
    page: String(filters.page ?? 1),
    per_page: String(filters.perPage ?? 10),
    sort_by: filters.sortBy ?? 'updated_at',
    sort_dir: filters.sortDir ?? 'desc',
  }

  if (filters.search?.trim()) extra.search = filters.search.trim()
  if (filters.category) extra.category = filters.category
  if (filters.subjectType) extra.subject_type = filters.subjectType
  if (filters.jobrole) extra.jobrole = filters.jobrole
  if (filters.status !== undefined) extra.status = String(filters.status)

  return params(session, extra)
}

const BASE = 'api/g2g-lms/learning-catalog'

export const lmsCatalogService = {
  /** GET api/g2g-lms/learning-catalog/courses */
  getCourses: (session: SessionContext = buildSessionContext(), filters: CatalogFilters = {}) =>
    apiGet<CatalogListResponse>(session, `${BASE}/courses`, listParams(session, filters)),

  /** GET api/g2g-lms/learning-catalog/kpis */
  getKpis: (session: SessionContext = buildSessionContext()) =>
    apiGet<CatalogApiResponse<CatalogKpis>>(session, `${BASE}/kpis`, params(session)),

  /** GET api/g2g-lms/learning-catalog/filters */
  getFilterOptions: (session: SessionContext = buildSessionContext()) =>
    apiGet<CatalogApiResponse<CatalogFilterOptions>>(session, `${BASE}/filters`, params(session)),

  /** GET api/g2g-lms/learning-catalog/courses/{id} */
  getCourse: (session: SessionContext = buildSessionContext(), id: number) =>
    apiGet<CatalogApiResponse<CatalogCourseDetail>>(session, `${BASE}/courses/${id}`, params(session)),

  /** PUT api/g2g-lms/learning-catalog/courses/{id} */
  updateCourse: (session: SessionContext = buildSessionContext(), id: number, payload: CourseUpdatePayload) =>
    apiPut<CatalogApiResponse<CatalogCourse>>(session, `${BASE}/courses/${id}`, withAuth(session, payload)),

  /** DELETE api/g2g-lms/learning-catalog/courses/{id} - soft delete, scoped to the tenant. */
  deleteCourse: (session: SessionContext = buildSessionContext(), id: number) =>
    apiDelete<CatalogApiResponse<{ id: number }>>(session, `${BASE}/courses/${id}`, params(session, { user_id: session.userId })),

  /** POST api/g2g-lms/learning-catalog/bulk */
  bulkAction: (session: SessionContext = buildSessionContext(), action: CatalogBulkAction, ids: number[]) =>
    apiPost<CatalogApiResponse<CatalogBulkResult>>(session, `${BASE}/bulk`, withAuth(session, { action, ids })),

  /**
   * POST api/g2g-lms/learning-catalog/courses
   *
   * Multipart so the cover image can ride along.
   */
  createCourse: (session: SessionContext = buildSessionContext(), payload: CourseCreatePayload) => {
    const form = new FormData()

    Object.entries(withAuth(session)).forEach(([key, value]) => {
      form.append(key, String(value))
    })

    form.append('display_name', payload.display_name)
    form.append('standard_id', String(payload.standard_id))
    form.append('status', String(payload.status))
    form.append('sort_order', String(payload.sort_order ?? 1))
    if (payload.certificate_validity_months) {
      form.append('certificate_validity_months', String(payload.certificate_validity_months))
    }
    form.append('subject_category', payload.subject_category ?? '')
    form.append('subject_code', payload.subject_code ?? '')
    form.append('subject_type', payload.subject_type ?? '')
    form.append('short_name', payload.short_name ?? '')
    form.append('jobrole', payload.jobrole ?? '')

    if (payload.display_image) {
      form.append('display_image', payload.display_image)
    }

    return apiPostForm<CatalogApiResponse<CatalogCourse> & { course_id: number }>(
      session,
      `${BASE}/courses`,
      form,
    )
  },

  /**
   * GET api/g2g-lms/learning-catalog/courses/{id}/audience/preview
   * In the given contract but not called by any ported screen; see file header.
   */
  previewAudience: (session: SessionContext = buildSessionContext(), id: number, filters: AudienceAssignPayload = {}) =>
    apiGet<CatalogApiResponse<AudiencePreviewResult>>(session, `${BASE}/courses/${id}/audience/preview`, params(session, filters as Record<string, string | number | undefined>)),

  /**
   * POST api/g2g-lms/learning-catalog/courses/{id}/audience
   * In the given contract but not called by any ported screen; see file header.
   */
  assignAudience: (session: SessionContext = buildSessionContext(), id: number, payload: AudienceAssignPayload) =>
    apiPost<CatalogApiResponse<{ affected: number }>>(session, `${BASE}/courses/${id}/audience`, withAuth(session, payload)),
}
