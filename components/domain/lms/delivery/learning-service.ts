/**
 * My Learning Service — the course player.
 *
 * Ported from G2G's `services/lms/learning.ts`. Preserves the original
 * request/response contracts — only the HTTP client plumbing and endpoint
 * paths are adapted to `lib/erp-client.ts`'s convention.
 *
 * Endpoint paths per the Package 1 contract (all under `api/g2g-lms/my-learning/*`):
 *   GET    courses
 *   GET    courses/{courseId}
 *   GET    assessments
 *   POST   progress
 *   POST   courses/{courseId}/complete
 *   GET    notes            POST notes
 *   PUT    notes/{id}       DELETE notes/{id}
 *   POST   chapters
 *   PUT    chapters/{id}    DELETE chapters/{id}
 *   POST   content
 *   PUT    content/{id}     DELETE content/{id}
 *   GET    certificates     POST certificates
 *   GET    certificates/verify/{code}
 *   GET    certificates/{id}/download
 *   POST   certificates/{id}/reissue
 *   GET    discussions      POST discussions
 *   POST   discussions/{id}/replies
 *   DELETE discussions/{id}
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

function withAuth(session: SessionContext, profileName?: string, extra: Record<string, unknown> = {}) {
  return {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    user_id: session.userId,
    type: 'API',
    ...(profileName ? { user_profile_name: profileName } : {}),
    ...extra,
  }
}

/** Builds a URL's query object combining common context + optional profile name. */
function queryParams(session: SessionContext, profileName?: string, extra?: Record<string, string | number | undefined>) {
  return withCommon(session, {
    ...(profileName ? { user_profile_name: profileName } : {}),
    ...extra,
  })
}

/* ------------------------------------------------------------------ *
 * Types (verbatim from G2G's services/lms/learning.ts)
 * ------------------------------------------------------------------ */

export interface LearningApiResponse<T> {
  status: boolean
  message?: string
  data: T
}

export type ContentStatus = 'not-started' | 'in-progress' | 'completed'

export interface LearningContent {
  id: number
  chapter_id: number | null
  title: string | null
  description: string | null
  filename: string | null
  file_type: string | null
  file_size: string | null
  url: string | null
  content_category: string | null
  sort_order: number | null
  show_hide: number | null
  status: ContentStatus
  last_position_seconds: number | null
  time_spent_seconds: number
  completed_at: string | null
  is_locked: boolean
}

export interface LearningChapter {
  id: number
  chapter_name: string | null
  chapter_desc: string | null
  standard_id: number | null
  subject_id: number | null
  sort_order: number | null
  show_hide: number | null
  content: LearningContent[]
  total_content: number
  completed_content: number
}

export interface LearningCourseSummary {
  id: number
  display_name: string | null
  display_image: string | null
  subject_category: string | null
  subject_type: string | null
  standard_id: number | null
  standard_name: string | null
  enrollment_id: number | null
  enrollment_status: string | null
  start_date: string | null
  end_date: string | null
  total_content: number
  completed_content: number
  progress_percent: number
}

export interface LearningEnrollment {
  id: number
  status: string | null
  start_date: string | null
  end_date: string | null
}

export interface LearningCourseDetail {
  course: {
    id: number
    display_name: string | null
    display_image: string | null
    subject_category: string | null
    subject_type: string | null
    subject_code: string | null
    short_name: string | null
    jobrole: string | null
    standard_id: number | null
    standard_name: string | null
  }
  enrollment: LearningEnrollment | null
  chapters: LearningChapter[]
  total_content: number
  completed_content: number
  progress_percent: number
  time_spent_seconds: number
  content_categories: string[]
}

export interface CompleteCourseResult {
  marked_complete: boolean
  total_content: number
  completed_content: number
  progress_percent: number
  certificate_available: boolean
}

export interface SaveProgressPayload {
  course_id: number
  content_id: number
  chapter_id?: number | null
  status: ContentStatus
  last_position_seconds?: number | null
  time_spent_delta?: number
}

export interface SaveProgressResult {
  content_id: number
  status: ContentStatus
  total_content: number
  completed_content: number
  progress_percent: number
}

export interface LearningAttempt {
  id: number
  question_paper_id: number
  total_right: number | null
  total_wrong: number | null
  obtain_marks: number | null
  start_time: string | null
  created_at: string | null
}

export interface LearningAssessment {
  id: number
  paper_name: string | null
  paper_desc: string | null
  total_ques: number | null
  total_marks: number | null
  time_allowed: number | null
  timelimit_enable: number | null
  attempt_allowed: string | null
  open_date: string | null
  close_date: string | null
  exam_type: string | null
  show_hide: number | null
  attempts: LearningAttempt[]
  attempt_count: number
  best_score: number | null
  last_attempt_at: string | null
  status: 'not-started' | 'completed'
}

export interface LearningNote {
  id: number
  course_id: number
  chapter_id: number | null
  content_id: number | null
  note: string
  timestamp_seconds: number | null
  content_title: string | null
  created_at: string | null
  updated_at: string | null
}

export interface CreateNotePayload {
  course_id: number
  chapter_id?: number | null
  content_id?: number | null
  note: string
  timestamp_seconds?: number | null
}

export interface ChapterPayload {
  subject_id?: number
  chapter_name: string
  chapter_desc?: string | null
  sort_order?: number | null
}

export interface ContentPayload {
  chapter_id?: number
  title: string
  description?: string | null
  filename?: string | null
  file_type?: string | null
  content_category?: string | null
  sort_order?: number | null
}

const BASE = 'api/g2g-lms/my-learning'

export const lmsLearningService = {
  /** GET api/g2g-lms/my-learning/courses - enrolled courses with real progress %. */
  getMyCourses: (session: SessionContext = buildSessionContext()) =>
    apiGet<LearningApiResponse<LearningCourseSummary[]>>(session, `${BASE}/courses`, queryParams(session)),

  /** GET api/g2g-lms/my-learning/courses/{id} - chapters, content and my progress. */
  getCourse: (session: SessionContext = buildSessionContext(), courseId: number) =>
    apiGet<LearningApiResponse<LearningCourseDetail>>(session, `${BASE}/courses/${courseId}`, queryParams(session)),

  /** POST api/g2g-lms/my-learning/progress - upsert progress on one lesson. */
  saveProgress: (session: SessionContext = buildSessionContext(), payload: SaveProgressPayload) =>
    apiPost<LearningApiResponse<SaveProgressResult>>(session, `${BASE}/progress`, withAuth(session, undefined, payload)),

  /**
   * POST api/g2g-lms/my-learning/courses/{id}/complete - the learner declares
   * themselves finished.
   */
  completeCourse: (session: SessionContext = buildSessionContext(), courseId: number) =>
    apiPost<LearningApiResponse<CompleteCourseResult>>(session, `${BASE}/courses/${courseId}/complete`, withAuth(session)),

  /** GET api/g2g-lms/my-learning/assessments - this course's papers + my attempts. */
  getAssessments: (session: SessionContext = buildSessionContext(), courseId: number) =>
    apiGet<LearningApiResponse<LearningAssessment[]>>(session, `${BASE}/assessments`, queryParams(session, undefined, { course_id: String(courseId) })),

  getNotes: (session: SessionContext = buildSessionContext(), courseId: number) =>
    apiGet<LearningApiResponse<LearningNote[]>>(session, `${BASE}/notes`, queryParams(session, undefined, { course_id: String(courseId) })),

  createNote: (session: SessionContext = buildSessionContext(), payload: CreateNotePayload) =>
    apiPost<LearningApiResponse<LearningNote>>(session, `${BASE}/notes`, withAuth(session, undefined, payload)),

  updateNote: (session: SessionContext = buildSessionContext(), id: number, note: string, timestampSeconds?: number | null) =>
    apiPut<LearningApiResponse<LearningNote>>(session, `${BASE}/notes/${id}`, withAuth(session, undefined, {
      note,
      timestamp_seconds: timestampSeconds ?? null,
    })),

  deleteNote: (session: SessionContext = buildSessionContext(), id: number) =>
    apiDelete<LearningApiResponse<{ id: number }>>(session, `${BASE}/notes/${id}`, queryParams(session)),

  /* Authoring - admin/HR only, enforced server-side too. */

  createChapter: (session: SessionContext = buildSessionContext(), payload: ChapterPayload, profileName?: string) =>
    apiPost<LearningApiResponse<unknown>>(session, `${BASE}/chapters`, withAuth(session, profileName, payload)),

  updateChapter: (session: SessionContext = buildSessionContext(), id: number, payload: ChapterPayload, profileName?: string) =>
    apiPut<LearningApiResponse<unknown>>(session, `${BASE}/chapters/${id}`, withAuth(session, profileName, payload)),

  deleteChapter: (session: SessionContext = buildSessionContext(), id: number, profileName?: string) =>
    apiDelete<LearningApiResponse<{ id: number }>>(session, `${BASE}/chapters/${id}`, queryParams(session, profileName)),

  createContent: (session: SessionContext = buildSessionContext(), payload: ContentPayload, profileName?: string) =>
    apiPost<LearningApiResponse<unknown>>(session, `${BASE}/content`, withAuth(session, profileName, payload)),

  updateContent: (session: SessionContext = buildSessionContext(), id: number, payload: ContentPayload, profileName?: string) =>
    apiPut<LearningApiResponse<unknown>>(session, `${BASE}/content/${id}`, withAuth(session, profileName, payload)),

  deleteContent: (session: SessionContext = buildSessionContext(), id: number, profileName?: string) =>
    apiDelete<LearningApiResponse<{ id: number }>>(session, `${BASE}/content/${id}`, queryParams(session, profileName)),
}

/* ─── Certificates ─────────────────────────────────────────────────────────── */

export type CertificateExpiryState = 'active' | 'expiring' | 'expired'

export interface LearningCertificate {
  user_id: number
  learner_name: string | null
  employee_no: string | null
  days_to_expiry: number | null
  id: number
  course_id: number
  skill_id: number | null
  certificate_number: string
  course_title: string | null
  name: string | null
  description: string | null
  tags: string[] | null
  verification_code: string | null
  supersedes: number | null
  superseded_by: number | null
  reissued_at: string | null
  issued_at: string | null
  expires_at: string | null
  status: string
  display_image: string | null
  subject_category: string | null
  skill_title: string | null
  expiry_state: CertificateExpiryState
}

export interface CertificateVerification {
  valid: boolean
  message: string
  certificate_number: string | null
  name: string | null
  course_title: string | null
  learner_name: string | null
  issued_at: string | null
  expires_at: string | null
  is_expired: boolean
  is_superseded: boolean
}

/* ─── Discussions ──────────────────────────────────────────────────────────── */

export interface DiscussionReply {
  id: number
  discussion_id: number
  user_id: number
  message: string
  is_instructor: boolean | number
  author_name: string | null
  created_at: string | null
}

export interface Discussion {
  id: number
  course_id: number
  chapter_id: number | null
  content_id: number | null
  user_id: number
  title: string | null
  message: string
  is_instructor: boolean
  is_resolved: boolean
  author_name: string | null
  content_title: string | null
  created_at: string | null
  replies: DiscussionReply[]
  reply_count: number
}

export interface CreateDiscussionPayload {
  course_id: number
  chapter_id?: number | null
  content_id?: number | null
  title?: string | null
  message: string
}

export interface CertificateQuery {
  scope?: 'mine' | 'all'
  search?: string
  courseId?: number
  profileName?: string
}

export interface CertificateListResponse {
  status: boolean
  data: LearningCertificate[]
  meta: { scope: 'mine' | 'all'; warning_days: number }
}

export const lmsCertificateService = {
  /** GET api/g2g-lms/my-learning/certificates */
  list: (session: SessionContext = buildSessionContext(), query: CertificateQuery = {}) =>
    apiGet<CertificateListResponse>(session, `${BASE}/certificates`, queryParams(session, query.profileName, {
      ...(query.scope ? { scope: query.scope } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.courseId ? { course_id: String(query.courseId) } : {}),
    })),

  /** POST api/g2g-lms/my-learning/certificates - idempotent; 422 until every lesson is done. */
  issue: (session: SessionContext = buildSessionContext(), courseId: number) =>
    apiPost<LearningApiResponse<LearningCertificate>>(session, `${BASE}/certificates`, withAuth(session, undefined, { course_id: courseId })),

  /**
   * Absolute URL for the rendered PDF - returned as a URL rather than
   * fetched, so the browser can navigate to it directly.
   */
  downloadUrl: (session: SessionContext = buildSessionContext(), certificateId: number) => {
    const url = new URL(apiUrl(`${BASE}/certificates/${certificateId}/download`, session))
    const params = queryParams(session)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
    })
    // The download navigation carries no Authorization header, so the token rides in the query string.
    url.searchParams.set('token', session.token)
    return url.toString()
  },

  /**
   * GET api/g2g-lms/my-learning/certificates/verify/{code} - public by
   * design, so no session context is sent.
   */
  verify: (code: string) =>
    fetch(`${(buildSessionContext().baseUrl).replace(/\/$/, '')}/${BASE}/certificates/verify/${encodeURIComponent(code)}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    }).then((response) => response.json()) as Promise<
      LearningApiResponse<Omit<CertificateVerification, 'valid' | 'message'>> & {
        valid: boolean
        message: string
      }
    >,

  /**
   * POST api/g2g-lms/my-learning/certificates/{id}/reissue - admin/HR only.
   */
  reissue: (session: SessionContext = buildSessionContext(), certificateId: number, profileName?: string) =>
    apiPost<LearningApiResponse<LearningCertificate>>(session, `${BASE}/certificates/${certificateId}/reissue`, withAuth(session, profileName)),
}

export const lmsDiscussionService = {
  list: (session: SessionContext = buildSessionContext(), courseId: number) =>
    apiGet<LearningApiResponse<Discussion[]>>(session, `${BASE}/discussions`, queryParams(session, undefined, { course_id: String(courseId) })),

  create: (session: SessionContext = buildSessionContext(), payload: CreateDiscussionPayload, profileName?: string) =>
    apiPost<LearningApiResponse<Discussion>>(session, `${BASE}/discussions`, withAuth(session, profileName, payload)),

  reply: (session: SessionContext = buildSessionContext(), discussionId: number, message: string, profileName?: string) =>
    apiPost<LearningApiResponse<DiscussionReply>>(session, `${BASE}/discussions/${discussionId}/replies`, withAuth(session, profileName, { message })),

  remove: (session: SessionContext = buildSessionContext(), discussionId: number, profileName?: string) =>
    apiDelete<LearningApiResponse<{ id: number }>>(session, `${BASE}/discussions/${discussionId}`, queryParams(session, profileName)),
}
