'use client'

/**
 * Ported from G2G's `hooks/use-lms-dashboard.ts`. Business logic (bucketing,
 * enrolment window, calendar/upcoming-event derivation) is preserved as-is;
 * only the context resolution and service imports are adapted.
 *
 * G2G's hook also fed an "Upcoming Sessions" widget from `lmsSessionService`
 * (`/api/lms/sessions`) — that belongs to Package 2's Sessions & Calendar
 * scope, which is not part of this port and has no endpoint in the Package 1
 * contract. `upcomingSessions` is therefore always empty here until Package 2
 * wires session data through; the widget renders its real empty state
 * rather than being deleted, so it drops in cleanly once that lands.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { buildSessionContext } from '@/lib/erp-client'
import {
  lmsDashboardService,
  DashboardApiError,
  type AchievementsData,
  type AvailableCourse,
  type EnrolledCourse,
  type EnrollmentUpdateStatus,
  type LearningActivity,
  type LearningCalendarEvent,
  type LearningStreakData,
  type PeerComparisonData,
  type SkillProgressData,
  type WeeklyGoalData,
} from './dashboard-service'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** A scheduled training session — not backed by any Package 1 endpoint; see file header. */
export interface TrainingSession {
  id: number
  room_name: string | null
  venue: string | null
  trainer_name: string | null
  event_date: string | null
  from_time: string | null
  to_time: string | null
  is_registered: boolean
  session_type: string | null
}

const ENROLLMENT_WINDOW_DAYS = 60

function toDateParam(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function isSessionReady() {
  const session = buildSessionContext()
  return Boolean(session.token && session.subInstituteId && session.userId)
}

export type CourseBucket = 'in-progress' | 'not-started' | 'completed' | 'overdue'

export interface DashboardCourse extends EnrolledCourse {
  title: string
  category: string | null
  dueDate: Date | null
  bucket: CourseBucket
}

function toDashboardCourse(course: EnrolledCourse, now: Date): DashboardCourse {
  const dueDate = course.end_date ? new Date(course.end_date) : null
  const validDue = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null
  const status = course.enrollment_status

  let bucket: CourseBucket
  if (status === 'completed') {
    bucket = 'completed'
  } else if (validDue && validDue < now) {
    bucket = 'overdue'
  } else if (status === 'in-progress') {
    bucket = 'in-progress'
  } else {
    bucket = 'not-started'
  }

  return {
    ...course,
    title: course.display_name || 'Untitled course',
    category: course.subject_type || course.subject_category || null,
    dueDate: validDue,
    bucket,
  }
}

export interface LmsDashboardState {
  loading: boolean
  error: string | null
  retry: () => void

  courses: DashboardCourse[]
  skillProgress: SkillProgressData | null
  achievements: AchievementsData | null
  streak: LearningStreakData | null
  weeklyGoal: WeeklyGoalData | null
  peerComparison: PeerComparisonData | null
  activities: LearningActivity[]

  calendarMonth: Date
  setCalendarMonth: (date: Date) => void
  calendarEvents: LearningCalendarEvent[]
  calendarLoading: boolean
  calendarError: string | null

  upcomingEvents: LearningCalendarEvent[]
  upcomingSessions: TrainingSession[]

  updatingCourseId: number | null
  actionMessage: string | null
  actionError: string | null
  dismissAction: () => void
  setCourseStatus: (
    course: DashboardCourse,
    status: EnrollmentUpdateStatus,
  ) => Promise<{ ok: boolean; message: string }>
  unenroll: (course: DashboardCourse) => Promise<{ ok: boolean; message: string }>
  enroll: (course: AvailableCourse) => Promise<{ ok: boolean; message: string }>
}

export interface AvailableCoursesState {
  courses: AvailableCourse[]
  loading: boolean
  error: string | null
  search: string
  setSearch: (value: string) => void
  reload: () => void
}

export function useAvailableCourses(enabled: boolean): AvailableCoursesState {
  const [courses, setCourses] = useState<AvailableCourse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!enabled) return

    if (!isSessionReady()) {
      setError('Your session has expired. Sign in again to browse courses.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await lmsDashboardService.getAvailableCourses(buildSessionContext(), {
        search: search.trim() || undefined,
        excludeEnrolled: true,
      })
      setCourses(response.data ?? [])
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the course catalogue.'))
      setCourses([])
    } finally {
      setLoading(false)
    }
  }, [enabled, search])

  useEffect(() => {
    if (!enabled) return
    const timer = setTimeout(() => {
      void load()
    }, 250)
    return () => clearTimeout(timer)
  }, [enabled, load])

  return {
    courses,
    loading,
    error,
    search,
    setSearch,
    reload: () => void load(),
  }
}

export function useLmsDashboard(): LmsDashboardState {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [courses, setCourses] = useState<EnrolledCourse[]>([])
  const [skillProgress, setSkillProgress] = useState<SkillProgressData | null>(null)
  const [achievements, setAchievements] = useState<AchievementsData | null>(null)
  const [streak, setStreak] = useState<LearningStreakData | null>(null)
  const [weeklyGoal, setWeeklyGoal] = useState<WeeklyGoalData | null>(null)
  const [peerComparison, setPeerComparison] = useState<PeerComparisonData | null>(null)
  const [activities, setActivities] = useState<LearningActivity[]>([])

  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date())
  const [calendarEvents, setCalendarEvents] = useState<LearningCalendarEvent[]>([])
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<LearningCalendarEvent[]>([])
  // Always empty — no Package 1 endpoint backs it. See file header.
  const [upcomingSessions] = useState<TrainingSession[]>([])

  const [updatingCourseId, setUpdatingCourseId] = useState<number | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadCourses = useCallback(async () => {
    const session = buildSessionContext()
    const response = await lmsDashboardService.getEnrolledCourses(session)
    setCourses(response.data ?? [])
  }, [])

  const load = useCallback(async () => {
    if (!isSessionReady()) {
      setLoading(false)
      setCalendarLoading(false)
      setError('Your session has expired. Sign in again to load your learning dashboard.')
      return
    }

    const session = buildSessionContext()
    setLoading(true)
    setError(null)

    const today = new Date()
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)

    try {
      const [
        coursesResponse,
        progressResponse,
        achievementsResponse,
        streakResponse,
        weeklyGoalResponse,
        activityResponse,
        thisMonthEvents,
        nextMonthEvents,
      ] = await Promise.all([
        lmsDashboardService.getEnrolledCourses(session),
        lmsDashboardService.getSkillProgress(session),
        lmsDashboardService.getAchievements(session),
        lmsDashboardService.getStreak(session),
        lmsDashboardService.getWeeklyGoal(session),
        lmsDashboardService.getRecentActivity(session, 20),
        lmsDashboardService.getCalendar(session, today.getMonth() + 1, today.getFullYear()),
        lmsDashboardService.getCalendar(session, nextMonth.getMonth() + 1, nextMonth.getFullYear()),
      ])

      setCourses(coursesResponse.data ?? [])
      setSkillProgress(progressResponse.data ?? null)
      setAchievements(achievementsResponse.data ?? null)
      setStreak(streakResponse.data ?? null)
      setWeeklyGoal(weeklyGoalResponse.data ?? null)
      setActivities(activityResponse.data ?? [])

      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

      setUpcomingEvents(
        [...(thisMonthEvents.data?.events ?? []), ...(nextMonthEvents.data?.events ?? [])]
          .filter((event) => {
            if (!event.school_date) return false
            const eventDate = new Date(event.school_date)
            return !Number.isNaN(eventDate.getTime()) && eventDate >= startOfToday
          })
          .sort(
            (a, b) =>
              new Date(a.school_date as string).getTime() -
              new Date(b.school_date as string).getTime(),
          ),
      )
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load your learning dashboard.'))
      setCourses([])
      setSkillProgress(null)
      setAchievements(null)
      setStreak(null)
      setWeeklyGoal(null)
      setActivities([])
      setUpcomingEvents([])
    } finally {
      setLoading(false)
    }

    try {
      const peerResponse = await lmsDashboardService.getPeerComparison(session)
      setPeerComparison(peerResponse.data ?? null)
    } catch (peerError) {
      if (!(peerError instanceof DashboardApiError) || peerError.status !== 404) {
        console.error('[lms-dashboard] peer comparison failed', peerError)
      }
      setPeerComparison(null)
    }
  }, [])

  const loadCalendar = useCallback(async () => {
    if (!isSessionReady()) {
      setCalendarLoading(false)
      return
    }

    setCalendarLoading(true)
    setCalendarError(null)

    try {
      const response = await lmsDashboardService.getCalendar(
        buildSessionContext(),
        calendarMonth.getMonth() + 1,
        calendarMonth.getFullYear(),
      )
      setCalendarEvents(response.data?.events ?? [])
    } catch (calendarLoadError) {
      setCalendarError(toMessage(calendarLoadError, 'Failed to load the learning calendar.'))
      setCalendarEvents([])
    } finally {
      setCalendarLoading(false)
    }
  }, [calendarMonth])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  useEffect(() => {
    queueMicrotask(() => {
      void loadCalendar()
    })
  }, [loadCalendar])

  const setCourseStatus = useCallback(
    async (course: DashboardCourse, status: EnrollmentUpdateStatus) => {
      const session = buildSessionContext()
      setActionError(null)
      setActionMessage(null)

      if (!course.enrollment_id) {
        const message = 'This enrolment cannot be updated because it has no enrolment id.'
        setActionError(message)
        return { ok: false, message }
      }

      setUpdatingCourseId(course.id)

      try {
        await lmsDashboardService.updateEnrollment(session, course.enrollment_id, {
          user_id: session.userId,
          course_id: course.id,
          status,
          start_date: course.start_date,
          end_date: course.end_date,
          sub_institute_id: session.subInstituteId,
        })

        await loadCourses()

        const message =
          status === 'completed'
            ? `"${course.title}" marked as completed.`
            : `"${course.title}" moved to in progress.`
        setActionMessage(message)
        return { ok: true, message }
      } catch (updateError) {
        const message = toMessage(updateError, 'Failed to update this course.')
        setActionError(message)
        return { ok: false, message }
      } finally {
        setUpdatingCourseId(null)
      }
    },
    [loadCourses],
  )

  const unenroll = useCallback(
    async (course: DashboardCourse) => {
      const session = buildSessionContext()
      setActionError(null)
      setActionMessage(null)
      setUpdatingCourseId(course.id)

      try {
        await lmsDashboardService.unenroll(session, course.id)
        await loadCourses()

        const message = `Unenrolled from "${course.title}".`
        setActionMessage(message)
        return { ok: true, message }
      } catch (unenrollError) {
        const message = toMessage(unenrollError, 'Failed to unenrol from this course.')
        setActionError(message)
        return { ok: false, message }
      } finally {
        setUpdatingCourseId(null)
      }
    },
    [loadCourses],
  )

  const enroll = useCallback(
    async (course: AvailableCourse) => {
      const session = buildSessionContext()
      setActionError(null)
      setActionMessage(null)
      setUpdatingCourseId(course.id)

      try {
        const today = new Date()
        const due = new Date(today)
        due.setDate(due.getDate() + ENROLLMENT_WINDOW_DAYS)

        const response = await lmsDashboardService.enroll(session, {
          user_id: session.userId,
          course_id: course.id,
          status: 'enrolled',
          start_date: toDateParam(today),
          end_date: toDateParam(due),
          sub_institute_id: session.subInstituteId,
        })
        await loadCourses()

        const message = response?.requires_approval
          ? `Enrolment requested for "${course.display_name ?? 'course'}". An administrator will review it.`
          : `Enrolled in "${course.display_name ?? 'course'}".`
        setActionMessage(message)
        return { ok: true, message }
      } catch (enrollError) {
        const message = toMessage(enrollError, 'Failed to enrol in this course.')
        setActionError(message)
        return { ok: false, message }
      } finally {
        setUpdatingCourseId(null)
      }
    },
    [loadCourses],
  )

  const dismissAction = useCallback(() => {
    setActionMessage(null)
    setActionError(null)
  }, [])

  const dashboardCourses = useMemo(() => {
    const now = new Date()
    return courses.map((course) => toDashboardCourse(course, now))
  }, [courses])

  return {
    loading,
    error,
    retry: () => void load(),

    courses: dashboardCourses,
    skillProgress,
    achievements,
    streak,
    weeklyGoal,
    peerComparison,
    activities,

    calendarMonth,
    setCalendarMonth,
    calendarEvents,
    calendarLoading,
    calendarError,
    upcomingEvents,
    upcomingSessions,

    updatingCourseId,
    actionMessage,
    actionError,
    dismissAction,
    setCourseStatus,
    unenroll,
    enroll,
  }
}
