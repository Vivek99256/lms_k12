/**
 * Learning Assignments & Enrollment service.
 *
 * Ported from G2G's `services/lms/assignment.ts`
 * (`App\Http\Controllers\lms\assignment\assignmentController`). Business
 * logic, params and response shapes are preserved as-is; only the HTTP
 * plumbing is adapted to this project's `lib/erp-client.ts`
 * (`buildSessionContext` / `createAuthHeaders`) instead of G2G's
 * `lib/laravel-context.ts` + `services/core` `apiClient`.
 *
 * Backed by the new `App\Http\Controllers\G2gLms\AssignmentsController`
 * (next_lms_erp), reachable at `api/g2g-lms/assignments/*`:
 *
 *   G2G original                         -> This project
 *   GET  /lmsAssignment                   -> GET    api/g2g-lms/assignments
 *   GET  /lmsAssignment/stats             -> GET    api/g2g-lms/assignments/stats
 *   POST /lmsAssignment                   -> POST   api/g2g-lms/assignments
 *   POST /lmsAssignment/updateStatus/{id} -> POST   api/g2g-lms/assignments/{id}/status
 *   POST /lmsAssignment/bulkUpdateStatus  -> POST   api/g2g-lms/assignments/bulk-status
 *   POST /lmsAssignment/request           -> POST   api/g2g-lms/assignments/request
 *   POST /lmsAssignment/review/{id}       -> POST   api/g2g-lms/assignments/{id}/review
 *   POST /lmsAssignment/bulkReview        -> POST   api/g2g-lms/assignments/bulk-review
 *   GET  /lmsAssignment/enrollments       -> GET    api/g2g-lms/assignments/enrollments
 *   GET  /lmsAssignment/learners          -> GET    api/g2g-lms/assignments/learners
 *   POST /lmsAssignment/import            -> POST   api/g2g-lms/assignments/import
 *
 * `courses()` is new here (not a 1:1 port): the Assign Learning dialog in
 * G2G searched courses via the separate Learning Catalog service
 * (`lmsCatalogService.getCourses`, Package 1's screen, not built yet at the
 * time this file was written). To keep this package self-contained and not
 * depend on a sibling package landing first, the backend Assignments
 * controller exposes a small `GET .../assignments/courses` picker endpoint
 * scoped to just what this dialog needs (search + status), backed by the
 * same `sub_std_map` table Learning Catalog will eventually own.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type SessionContext,
} from '@/lib/erp-client'

/* ------------------------------------------------------------------ *
 * Response envelope + data shapes (unchanged from G2G)
 * ------------------------------------------------------------------ */

export interface AssignmentApiResponse<T> {
  status: boolean
  message?: string
  data: T
}

export interface LmsAssignment {
  id: number
  learner_name: string
  initials: string
  course_name: string
  type: string
  assignment_type: string
  due_date: string | null
  status: string
  progress: number
  assigned_by: string
  assigned_on: string
}

export interface AssignmentStats {
  total_assigned: number
  in_progress: number
  completed: number
  overdue: number
  pending_approval: number
}

export interface CreateAssignmentPayload {
  user_ids: number[]
  course_id: number
  assignment_type: string
  due_date?: string
}

export interface AssignmentLearner {
  id: number
  employee_no: string | null
  email: string | null
  name: string
}

export interface ImportRowError {
  line: number
  message: string
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: ImportRowError[]
}

export type ApprovalStatus = 'approved' | 'pending' | 'rejected'

/** A learner-initiated enrolment from lms_course_enroll — not an assignment. */
export interface CourseEnrollment {
  id: number
  course_id: number
  user_id: number
  learner_name: string
  employee_no: string | null
  course_name: string | null
  type: string | null
  status: string | null
  start_date: string | null
  end_date: string | null
  enrolled_on: string | null
  initials: string
}

export interface ReviewResult {
  affected: number
  skipped: number
}

/** Picker-scoped course shape returned by GET assignments/courses. */
export interface AssignmentCourseOption {
  id: number
  display_name: string | null
  subject_code: string | null
  subject_type: string | null
}

/* ------------------------------------------------------------------ *
 * HTTP plumbing
 * ------------------------------------------------------------------ */

function apiUrl(path: string, session: SessionContext): string {
  const base = session.baseUrl.replace(/\/$/, '')
  return `${base}/api/g2g-lms/assignments${path}`
}

function withAuth(session: SessionContext, extra?: object) {
  return {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    user_id: session.userId,
    type: 'API',
    ...extra,
  }
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    let message = `API Error: ${response.status} ${response.statusText}`
    try {
      const parsed = text ? JSON.parse(text) : null
      if (parsed?.message) message = parsed.message
    } catch {
      // fall through to the raw text
    }
    const error = new Error(message) as Error & { data?: unknown }
    try {
      error.data = text ? JSON.parse(text) : undefined
    } catch {
      // no JSON body
    }
    throw error
  }
  return response.json()
}

async function apiGet<T>(
  session: SessionContext,
  path: string,
  searchParams?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(apiUrl(path, session))
  const params = withAuth(session, searchParams as Record<string, unknown>)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: createAuthHeaders(session),
  })

  return parseOrThrow<T>(response)
}

async function apiPost<T>(
  session: SessionContext,
  path: string,
  body: object,
): Promise<T> {
  const response = await fetch(apiUrl(path, session), {
    method: 'POST',
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify(withAuth(session, body)),
  })

  return parseOrThrow<T>(response)
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

  return parseOrThrow<T>(response)
}

/* ------------------------------------------------------------------ *
 * Service
 * ------------------------------------------------------------------ */

export const lmsAssignmentsService = {
  /** GET assignments — list all assignments for this tenant. */
  getAssignments: (session: SessionContext, filters?: { search?: string }) =>
    apiGet<AssignmentApiResponse<LmsAssignment[]>>(session, '', {
      ...(filters?.search ? { search: filters.search } : {}),
    }),

  /** GET assignments/stats — KPI stats for this tenant. */
  getStats: (session: SessionContext) =>
    apiGet<AssignmentApiResponse<AssignmentStats>>(session, '/stats'),

  /** POST assignments — assign courses to users. */
  createAssignments: (session: SessionContext, payload: CreateAssignmentPayload) =>
    apiPost<AssignmentApiResponse<unknown>>(session, '', payload),

  /** POST assignments/{id}/status — update a single assignment. */
  updateStatus: (session: SessionContext, id: number, status: string) =>
    apiPost<AssignmentApiResponse<unknown>>(session, `/${id}/status`, { status }),

  /** POST assignments/bulk-status — batch status update. */
  bulkUpdateStatus: (session: SessionContext, ids: number[], status: string) =>
    apiPost<AssignmentApiResponse<unknown>>(session, '/bulk-status', { ids, status }),

  /** GET assignments/learners — learners in this tenant, for the picker. */
  searchLearners: (session: SessionContext, search: string) =>
    apiGet<AssignmentApiResponse<AssignmentLearner[]>>(session, '/learners', {
      ...(search ? { search } : {}),
      limit: '50',
    }),

  /** GET assignments/courses — course picker for the Assign Learning dialog. */
  searchCourses: (session: SessionContext, search: string) =>
    apiGet<AssignmentApiResponse<AssignmentCourseOption[]>>(session, '/courses', {
      ...(search ? { search } : {}),
      limit: '20',
      status: '1',
    }),

  /**
   * POST assignments/import — bulk-create from a CSV.
   *
   * Strict by default: if any row fails, nothing is written and every
   * failing line is reported. Pass skipInvalid to import the good rows
   * regardless.
   */
  importCsv: (session: SessionContext, file: File, skipInvalid: boolean) => {
    const form = new FormData()
    const auth = withAuth(session)
    Object.entries(auth).forEach(([key, value]) => form.append(key, String(value)))
    form.append('file', file)
    form.append('skip_invalid', skipInvalid ? '1' : '0')

    return apiPostForm<AssignmentApiResponse<ImportResult>>(session, '/import', form)
  },

  /**
   * GET assignments?approval_status=pending — the approval queue.
   * The default list returns approved rows only, so a pending request
   * never shows up as an active assignment.
   */
  getPending: (session: SessionContext) =>
    apiGet<AssignmentApiResponse<LmsAssignment[]>>(session, '', {
      approval_status: 'pending',
    }),

  /** POST assignments/{id}/review — approve or reject one request. */
  review: (
    session: SessionContext,
    id: number,
    decision: 'approved' | 'rejected',
    note?: string,
  ) =>
    apiPost<AssignmentApiResponse<unknown>>(session, `/${id}/review`, {
      decision,
      ...(note ? { review_note: note } : {}),
    }),

  /** POST assignments/bulk-review — decide on several at once. */
  bulkReview: (session: SessionContext, ids: number[], decision: 'approved' | 'rejected') =>
    apiPost<AssignmentApiResponse<ReviewResult>>(session, '/bulk-review', { ids, decision }),

  /** GET assignments/enrollments — learner-initiated enrolments. */
  getEnrollments: (session: SessionContext, search?: string) =>
    apiGet<AssignmentApiResponse<CourseEnrollment[]>>(session, '/enrollments', {
      ...(search ? { search } : {}),
      limit: '200',
    }),
}

export { buildSessionContext }
export type { SessionContext }
