'use client'

/**
 * Ported from G2G's `hooks/use-sessions.ts`. Logic and shape are unchanged;
 * only the session source is adapted — G2G resolved `LaravelContext` from
 * `useAuth()` + `getLaravelContext`, this project resolves `SessionContext`
 * from `lib/erp-client`'s `buildSessionContext()`. G2G's service calls also
 * took an optional `profileName` (from `user.profileName`, which has no
 * equivalent in this project's auth shim) purely to echo it back as
 * `user_profile_name` in the request body; the backend never trusted that
 * value for anything security-sensitive (the acting user and their role are
 * always re-resolved from the session token), so it is dropped here rather
 * than invented.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, endOfWeek, format, startOfWeek } from 'date-fns'

import { buildSessionContext, type SessionContext } from '@/lib/erp-client'
import {
  lmsSessionsCalendarService,
  type CalendarDeadline,
  type SessionAttendee,
  type SessionPayload,
  type SessionStats,
  type TrainingSession,
} from '@/components/domain/lms/sessions-calendar/sessions-calendar-service'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function isSessionReady(session: SessionContext): boolean {
  return Boolean(session.token && session.subInstituteId && session.userId)
}

const DATE = 'yyyy-MM-dd'

export interface SessionsState {
  sessions: TrainingSession[]
  /** Whole-day markers (course deadlines, org events) for the visible week. */
  deadlines: CalendarDeadline[]
  stats: SessionStats | null
  loading: boolean
  error: string | null
  reload: () => void

  /** Monday-anchored week the calendar grid is showing. */
  weekStart: Date
  weekDays: Date[]
  goToWeek: (offsetWeeks: number) => void
  goToToday: () => void

  search: string
  setSearch: (value: string) => void

  saving: boolean
  message: string | null
  actionError: string | null
  dismiss: () => void

  createSession: (payload: SessionPayload) => Promise<{ ok: boolean; message: string }>
  updateSession: (id: number, payload: SessionPayload) => Promise<{ ok: boolean; message: string }>
  removeSession: (id: number) => Promise<{ ok: boolean; message: string }>
  register: (id: number, learnerId?: number) => Promise<{ ok: boolean; message: string }>
  cancelRegistration: (id: number, learnerId?: number) => Promise<{ ok: boolean; message: string }>

  attendees: SessionAttendee[]
  attendeesLoading: boolean
  loadAttendees: (sessionId: number) => void
}

export function useSessions(): SessionsState {
  const resolveSession = useCallback(() => buildSessionContext(), [])

  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [deadlines, setDeadlines] = useState<CalendarDeadline[]>([])
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [attendees, setAttendees] = useState<SessionAttendee[]>([])
  const [attendeesLoading, setAttendeesLoading] = useState(false)

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  )

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async () => {
    const session = resolveSession()

    if (!isSessionReady(session)) {
      setLoading(false)
      setError('Your session has expired. Sign in again to view the schedule.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const from = format(weekStart, DATE)
      const to = format(endOfWeek(weekStart, { weekStartsOn: 1 }), DATE)

      const [listResponse, statsResponse, deadlineResult] = await Promise.all([
        lmsSessionsCalendarService.list(session, from, to, debouncedSearch || undefined),
        lmsSessionsCalendarService.stats(session),
        lmsSessionsCalendarService.deadlines(session, from, to).catch(() => null),
      ])

      setSessions(listResponse.data ?? [])
      setStats(statsResponse.data ?? null)
      setDeadlines(deadlineResult?.data ?? [])
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the session schedule.'))
      setSessions([])
      setDeadlines([])
    } finally {
      setLoading(false)
    }
  }, [resolveSession, weekStart, debouncedSearch])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  /** Shared wrapper: run a write, refresh, surface the outcome. */
  const run = useCallback(
    async (operation: () => Promise<string>, fallback: string) => {
      setSaving(true)
      setActionError(null)
      setMessage(null)

      try {
        const ok = await operation()
        await load()
        setMessage(ok)
        return { ok: true, message: ok }
      } catch (writeError) {
        const failure = toMessage(writeError, fallback)
        setActionError(failure)
        return { ok: false, message: failure }
      } finally {
        setSaving(false)
      }
    },
    [load],
  )

  const createSession = useCallback(
    (payload: SessionPayload) =>
      run(async () => {
        await lmsSessionsCalendarService.create(resolveSession(), payload)
        return `"${payload.room_name}" scheduled.`
      }, 'Failed to schedule the session.'),
    [run, resolveSession],
  )

  const updateSession = useCallback(
    (id: number, payload: SessionPayload) =>
      run(async () => {
        await lmsSessionsCalendarService.update(resolveSession(), id, payload)
        return `"${payload.room_name}" updated.`
      }, 'Failed to update the session.'),
    [run, resolveSession],
  )

  const removeSession = useCallback(
    (id: number) =>
      run(async () => {
        await lmsSessionsCalendarService.remove(resolveSession(), id)
        return 'Session cancelled.'
      }, 'Failed to cancel the session.'),
    [run, resolveSession],
  )

  const register = useCallback(
    (id: number, learnerId?: number) =>
      run(async () => {
        await lmsSessionsCalendarService.register(resolveSession(), id, learnerId)
        return learnerId ? 'Learner registered.' : 'You are registered for this session.'
      }, 'Failed to register.'),
    [run, resolveSession],
  )

  const cancelRegistration = useCallback(
    (id: number, learnerId?: number) =>
      run(async () => {
        await lmsSessionsCalendarService.cancelRegistration(resolveSession(), id, learnerId)
        return 'Registration cancelled.'
      }, 'Failed to cancel the registration.'),
    [run, resolveSession],
  )

  const loadAttendees = useCallback(
    (sessionId: number) => {
      const session = resolveSession()
      setAttendeesLoading(true)
      lmsSessionsCalendarService
        .attendees(session, sessionId)
        .then((response) => setAttendees(response.data ?? []))
        .catch(() => setAttendees([]))
        .finally(() => setAttendeesLoading(false))
    },
    [resolveSession],
  )

  return {
    sessions,
    deadlines,
    stats,
    loading,
    error,
    reload: () => void load(),

    weekStart,
    weekDays,
    goToWeek: (offsetWeeks: number) => setWeekStart((current) => addDays(current, offsetWeeks * 7)),
    goToToday: () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })),

    search,
    setSearch,

    saving,
    message,
    actionError,
    dismiss: () => {
      setMessage(null)
      setActionError(null)
    },

    createSession,
    updateSession,
    removeSession,
    register,
    cancelRegistration,

    attendees,
    attendeesLoading,
    loadAttendees,
  }
}
