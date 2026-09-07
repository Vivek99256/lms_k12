/**
 * Sessions & Calendar service.
 *
 * Ported from G2G's `services/lms/sessions.ts`
 * (`App\Http\Controllers\Api\LmsSessionController`). Business logic, params
 * and response shapes are preserved as-is; only the HTTP plumbing is
 * adapted to this project's `lib/erp-client.ts` (`buildSessionContext` /
 * `createAuthHeaders`) instead of G2G's `lib/laravel-context.ts` +
 * `services/core` `apiClient`.
 *
 * Backed by the new `App\Http\Controllers\G2gLms\SessionsCalendarController`
 * (next_lms_erp), reachable at `api/g2g-lms/sessions-calendar/*`:
 *
 *   G2G original                          -> This project
 *   GET    /lms/sessions                   -> GET    api/g2g-lms/sessions-calendar
 *   GET    /lms/sessions/stats             -> GET    api/g2g-lms/sessions-calendar/stats
 *   GET    /lms/sessions/deadlines         -> GET    api/g2g-lms/sessions-calendar/deadlines
 *   GET    /lms/sessions/{id}/attendees    -> GET    api/g2g-lms/sessions-calendar/{id}/attendees
 *   POST   /lms/sessions                   -> POST   api/g2g-lms/sessions-calendar
 *   PUT    /lms/sessions/{id}              -> PUT    api/g2g-lms/sessions-calendar/{id}
 *   DELETE /lms/sessions/{id}              -> DELETE api/g2g-lms/sessions-calendar/{id}
 *   POST   /lms/sessions/{id}/register     -> POST   api/g2g-lms/sessions-calendar/{id}/register
 *   DELETE /lms/sessions/{id}/register     -> DELETE api/g2g-lms/sessions-calendar/{id}/register
 *
 * The UI components for this screen live under
 * `components/domain/lms/sessions/` (mirroring G2G's own
 * `components/domain/lms/sessions/` folder name 1:1); only this service
 * file lives in a sibling `sessions-calendar/` folder, to match the export
 * path Package 0 already wired into `services/g2g-lms.ts`.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type SessionContext,
} from '@/lib/erp-client'

export interface SessionApiResponse<T> {
  status: boolean
  message?: string
  data: T
}

export type SessionType = 'virtual' | 'classroom'
export type SeatStatus = 'open' | 'almost-full' | 'full' | 'closed'
export type RegistrationStatus = 'registered' | 'attended' | 'cancelled' | 'no-show'

export interface TrainingSession {
  id: number
  room_name: string | null
  session_type: SessionType | null
  description: string | null
  notes: string | null
  trainer_name: string | null
  trainer_email: string | null
  venue: string | null
  /** Null means uncapped — seat status then stays 'open'. */
  seats_total: number | null
  event_date: string | null
  from_time: string | null
  to_time: string | null
  url: string | null
  status: string | null
  subject_id: number | null
  standard_id: number | null
  registered_count: number
  seats_available: number | null
  seat_status: SeatStatus
  is_past: boolean
  is_registered: boolean
  my_registration_status: RegistrationStatus | null
}

export interface SessionStats {
  upcoming_sessions: number
  total_registrations: number
  open_sessions: number
  full_sessions: number
  sessions_this_month: number
}

export interface SessionAttendee {
  id: number
  user_id: number
  learner_name: string
  employee_no: string | null
  email: string | null
  status: RegistrationStatus
  registered_at: string | null
}

export interface SessionListResponse {
  status: boolean
  data: TrainingSession[]
  meta: { from: string; to: string }
}

/** Fields the session form writes. Times are H:i; the API rejects to <= from. */
export interface SessionPayload {
  room_name: string
  session_type: SessionType
  description?: string | null
  notes?: string | null
  trainer_name?: string | null
  trainer_email?: string | null
  venue?: string | null
  seats_total?: number | null
  event_date: string
  from_time: string
  to_time: string
  url?: string | null
  subject_id?: number | null
}

/**
 * A whole-day marker drawn in the calendar's day header.
 *
 * Neither source carries a time — a course deadline is an end_date and a
 * calendar event is a school_date — so these never occupy an hour slot.
 * `learner_name` is only set for course deadlines, and only populated when an
 * admin is viewing (a learner sees just their own).
 */
export interface CalendarDeadline {
  date: string
  title: string | null
  user_id: number | null
  learner_name: string | null
  kind: 'course-deadline' | 'event'
}

function apiUrl(path: string, session: SessionContext): string {
  const base = session.baseUrl.replace(/\/$/, '')
  return `${base}/api/g2g-lms/sessions-calendar${path}`
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
    throw new Error(message)
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

async function apiWrite<T>(
  session: SessionContext,
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: object,
): Promise<T> {
  const response = await fetch(apiUrl(path, session), {
    method,
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify(withAuth(session, body)),
  })

  return parseOrThrow<T>(response)
}

export const lmsSessionsCalendarService = {
  /** GET sessions-calendar — sessions in a date window, with my registration state. */
  list: (session: SessionContext, from: string, to: string, search?: string) =>
    apiGet<SessionListResponse>(session, '', { from, to, ...(search ? { search } : {}) }),

  /** GET sessions-calendar/stats */
  stats: (session: SessionContext) =>
    apiGet<SessionApiResponse<SessionStats>>(session, '/stats'),

  /** GET sessions-calendar/deadlines — whole-day markers to overlay on the grid. */
  deadlines: (session: SessionContext, from: string, to: string) =>
    apiGet<SessionApiResponse<CalendarDeadline[]>>(session, '/deadlines', { from, to }),

  /** GET sessions-calendar/{id}/attendees */
  attendees: (session: SessionContext, sessionId: number) =>
    apiGet<SessionApiResponse<SessionAttendee[]>>(session, `/${sessionId}/attendees`),

  create: (session: SessionContext, payload: SessionPayload) =>
    apiWrite<SessionApiResponse<TrainingSession>>(session, 'POST', '', payload),

  update: (session: SessionContext, id: number, payload: SessionPayload) =>
    apiWrite<SessionApiResponse<TrainingSession>>(session, 'PUT', `/${id}`, payload),

  remove: (session: SessionContext, id: number) =>
    apiWrite<SessionApiResponse<{ id: number }>>(session, 'DELETE', `/${id}`),

  /**
   * POST sessions-calendar/{id}/register — take a seat.
   * Omit learnerId to register yourself; passing one is an admin action.
   */
  register: (session: SessionContext, id: number, learnerId?: number) =>
    apiWrite<SessionApiResponse<unknown>>(session, 'POST', `/${id}/register`, {
      ...(learnerId ? { learner_id: learnerId } : {}),
    }),

  /** DELETE sessions-calendar/{id}/register — give up a seat. */
  cancelRegistration: (session: SessionContext, id: number, learnerId?: number) =>
    apiWrite<SessionApiResponse<{ id: number }>>(session, 'DELETE', `/${id}/register`, {
      ...(learnerId ? { learner_id: learnerId } : {}),
    }),
}

export { buildSessionContext }
export type { SessionContext }
