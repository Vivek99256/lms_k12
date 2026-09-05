/**
 * LMS Learning Dashboard Service
 *
 * Ported from G2G's `services/lms/dashboard.ts`. Preserves the original
 * request/response contracts (param names, response envelope, business
 * logic) — only the HTTP client plumbing and endpoint paths are adapted to
 * this codebase's `lib/erp-client.ts` convention (see
 * `components/domain/organization/department-management/organization-service.ts`
 * for the established pattern this file follows).
 *
 * Endpoint paths per the Package 1 contract (all under `api/g2g-lms/learning-dashboard/*`):
 *   GET  enrolled-courses
 *   GET  available-courses
 *   POST enroll
 *   GET  skill-progress
 *   GET  streak
 *   GET  weekly-goal
 *   GET  achievements
 *   GET  peer-comparison
 *   GET  calendar
 *   GET  recent-activity
 *
 * `updateEnrollment` (PUT) and `unenroll` (DELETE) are NOT in the given
 * contract table — only `enroll` (POST) is listed. G2G's dashboard widgets
 * (My Learning) still need to move a course to in-progress/completed and to
 * unenroll, so these two calls extend the contracted `enroll` resource with
 * the same REST verbs G2G's own backend used (PUT/DELETE on the enrolment
 * resource, keyed by enrollment id / course id respectively). Flagged as a
 * deviation in the migration report — confirm with the backend agent.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type SessionContext,
} from '@/lib/erp-client'

/* ------------------------------------------------------------------ *
 * HTTP plumbing (mirrors organization-service.ts's convention)
 * ------------------------------------------------------------------ */

/** Thrown-shape guard used by the hook to treat a 404 peer-comparison as empty. */
export class DashboardApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

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
    throw new DashboardApiError(
      `API Error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`,
      response.status,
    )
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
 * Types (verbatim from G2G's services/lms/dashboard.ts)
 * ------------------------------------------------------------------ */

export interface LmsApiResponse<T> {
  status: boolean
  message?: string
  data: T
}

export type EnrollmentStatus = 'enrolled' | 'in-progress' | 'completed'
export type EnrollmentUpdateStatus = Extract<EnrollmentStatus, 'in-progress' | 'completed'>

export interface EnrolledCourse {
  id: number
  enrollment_id: number | null
  subject_id: number | null
  standard_id: number | null
  display_name: string | null
  display_image: string | null
  subject_category: string | null
  subject_type: string | null
  subject_code: string | null
  standard_name: string | null
  jobrole: string | null
  proficiency: string | null
  enrollment_status: EnrollmentStatus | null
  start_date: string | null
  end_date: string | null
  enrolled_at: string | null
}

export interface AvailableCourse {
  id: number
  display_name: string | null
  display_image: string | null
  subject_type: string | null
  subject_category: string | null
  jobrole: string | null
  proficiency: string | null
  standard_id: number | null
  standard_name: string | null
  is_enrolled: boolean
}

export interface AvailableCoursesFilters {
  search?: string
  excludeEnrolled?: boolean
  limit?: number
}

export interface EnrollPayload {
  user_id: string | number
  course_id: number
  status: EnrollmentStatus
  start_date?: string | null
  end_date?: string | null
  sub_institute_id?: string | number | null
}

export interface EnrollmentUpdatePayload {
  user_id: string | number
  course_id: number
  status: EnrollmentUpdateStatus
  start_date?: string | null
  end_date?: string | null
  sub_institute_id: string | number
}

export interface EnrollmentMutationResponse {
  message: string
  data: unknown
  requires_approval?: boolean
}

export type ProficiencyLevel = 'Beginner' | 'Intermediate' | 'Advanced'

export interface SkillProgressItem {
  skill_name: string
  sub_category: string | null
  progress_percentage: number
  proficiency_level: ProficiencyLevel
  courses_completed: number
  total_courses: number
  status: 'in-progress' | 'completed'
}

export interface SkillProgressOverall {
  overall_progress_percentage: number
  total_skills: number
  skills_in_progress: number
  average_progress: number
}

export interface SkillProgressData {
  skill_progress: SkillProgressItem[]
  overall: SkillProgressOverall
}

export interface LearningCalendarEvent {
  title: string | null
  description: string | null
  current_datetime: string | null
  school_date: string | null
  priority: string | null
  event_type: string | null
  standard: string | null
}

export interface LearningCalendarData {
  month: string | number
  year: string | number
  events: LearningCalendarEvent[]
}

export interface LearningAchievement {
  title: string
  description: string
  earned: boolean
  earned_date: string | null
  progress: string
}

export interface AchievementsData {
  achievements: LearningAchievement[]
  overall_progress: number
}

export interface LearningStreakData {
  current_streak: number
  goal: number
  progress_percentage: number
  best_streak: number
  days_to_go: number
}

export interface WeeklyGoalData {
  current_hours: number
  goal_hours: number
  remaining_hours: number
  progress_percentage: number
  week_start: string
  week_end: string
}

export interface PeerComparisonData {
  rank: number
  total_peers: number
  your_progress: number
  peer_average: number
  percentile: number
  message: string
}

export type LearningActivityType =
  | 'course_completed'
  | 'course_enrolled'
  | 'deadline_due'
  | 'session_upcoming'

export type LearningActivityTone = 'success' | 'primary' | 'warning' | 'neutral'

export interface LearningActivity {
  id: string
  text: string
  time: string
  type: LearningActivityType | string
  tone: LearningActivityTone | string
  timestamp: string | null
}

/* ------------------------------------------------------------------ *
 * Service
 * ------------------------------------------------------------------ */

const BASE = 'api/g2g-lms/learning-dashboard'

export const lmsDashboardService = {
  /**
   * GET api/g2g-lms/learning-dashboard/enrolled-courses
   *
   * Unlike the other endpoints below, the backend reads `user_id` from the
   * request itself (not the session) here — an administrator may be looking
   * at somebody else's enrolments — so it must be sent explicitly.
   */
  getEnrolledCourses: (session: SessionContext = buildSessionContext()) =>
    apiGet<LmsApiResponse<EnrolledCourse[]>>(session, `${BASE}/enrolled-courses`, withCommon(session, { user_id: session.userId })),

  /** GET api/g2g-lms/learning-dashboard/available-courses (see user_id note above) */
  getAvailableCourses: (session: SessionContext = buildSessionContext(), filters: AvailableCoursesFilters = {}) =>
    apiGet<LmsApiResponse<AvailableCourse[]>>(
      session,
      `${BASE}/available-courses`,
      withCommon(session, {
        user_id: session.userId,
        ...(filters.search ? { search: filters.search } : {}),
        exclude_enrolled: filters.excludeEnrolled === false ? '0' : '1',
        limit: String(filters.limit ?? 50),
      }),
    ),

  /** POST api/g2g-lms/learning-dashboard/enroll */
  enroll: (session: SessionContext = buildSessionContext(), payload: EnrollPayload) =>
    apiPost<EnrollmentMutationResponse>(session, `${BASE}/enroll`, withAuth(session, payload)),

  /**
   * DELETE api/g2g-lms/learning-dashboard/enroll/{courseId} - unenrol.
   * NOT in the given contract table; extends the contracted `enroll`
   * resource with the DELETE verb G2G's own backend used. See file header.
   */
  unenroll: (session: SessionContext = buildSessionContext(), courseId: number) =>
    apiDelete<EnrollmentMutationResponse>(session, `${BASE}/enroll/${courseId}`, withCommon(session, { user_id: session.userId })),

  /**
   * PUT api/g2g-lms/learning-dashboard/enroll/{enrollmentId} - move an
   * enrolment between 'in-progress' and 'completed'. NOT in the given
   * contract table; see file header.
   */
  updateEnrollment: (
    session: SessionContext = buildSessionContext(),
    enrollmentId: number,
    payload: EnrollmentUpdatePayload,
  ) =>
    apiPut<EnrollmentMutationResponse>(session, `${BASE}/enroll/${enrollmentId}`, withAuth(session, payload)),

  /** GET api/g2g-lms/learning-dashboard/skill-progress */
  getSkillProgress: (session: SessionContext = buildSessionContext()) =>
    apiGet<LmsApiResponse<SkillProgressData>>(session, `${BASE}/skill-progress`, withCommon(session)),

  /** GET api/g2g-lms/learning-dashboard/calendar */
  getCalendar: (session: SessionContext = buildSessionContext(), month: number, year: number) =>
    apiGet<LmsApiResponse<LearningCalendarData>>(
      session,
      `${BASE}/calendar`,
      withCommon(session, { month: String(month), year: String(year) }),
    ),

  /** GET api/g2g-lms/learning-dashboard/achievements */
  getAchievements: (session: SessionContext = buildSessionContext()) =>
    apiGet<LmsApiResponse<AchievementsData>>(session, `${BASE}/achievements`, withCommon(session)),

  /** GET api/g2g-lms/learning-dashboard/streak */
  getStreak: (session: SessionContext = buildSessionContext()) =>
    apiGet<LmsApiResponse<LearningStreakData>>(session, `${BASE}/streak`, withCommon(session)),

  /** GET api/g2g-lms/learning-dashboard/weekly-goal */
  getWeeklyGoal: (session: SessionContext = buildSessionContext()) =>
    apiGet<LmsApiResponse<WeeklyGoalData>>(session, `${BASE}/weekly-goal`, withCommon(session)),

  /**
   * GET api/g2g-lms/learning-dashboard/peer-comparison - answers 404 when no
   * peer has any progress yet; callers treat that as empty.
   */
  getPeerComparison: (session: SessionContext = buildSessionContext()) =>
    apiGet<LmsApiResponse<PeerComparisonData>>(session, `${BASE}/peer-comparison`, withCommon(session)),

  /** GET api/g2g-lms/learning-dashboard/recent-activity */
  getRecentActivity: (session: SessionContext = buildSessionContext(), limit = 8) =>
    apiGet<LmsApiResponse<LearningActivity[]>>(
      session,
      `${BASE}/recent-activity`,
      withCommon(session, { limit: String(limit) }),
    ),
}
