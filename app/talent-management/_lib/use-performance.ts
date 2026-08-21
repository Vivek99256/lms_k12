'use client'

/**
 * Ported from G2G's `hooks/use-performance.ts`.
 *
 * The source hooks were already plain React hooks (`useState`/`useEffect`/
 * `useCallback`) — nothing here needed a react-query -> plain-hook rewrite.
 *
 * Transport adaptation only, following the established port pattern in
 * `app/hrit/_lib/use-payroll.ts`: G2G resolves a `LaravelContext` via
 * `useLaravelContext()` (wrapping `useAuth()`). Target's session is read
 * synchronously from storage via `buildSessionContext()` (see
 * `performance-api.ts`), so no context-resolving hook / `useAuth()` call is
 * needed — each loader just calls `buildSessionContext()` directly and bails
 * with a friendly message when `isPerformanceSessionReady()` is false, the
 * same shape `usePayrollTypes()` uses. Logic, field names, endpoint calls and
 * behavior are otherwise unchanged.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  buildSessionContext,
  isPerformanceSessionReady,
  performanceService,
  type AppraisalPayload,
  type AppraisalSummary,
  type BonusDecisionAction,
  type BonusPayload,
  type BonusSummary,
  type BoardColumn,
  type CalibrationGrid,
  type CalibrationSessionPayload,
  type CalibrationSummary,
  type CompensationPayload,
  type CompensationSummary,
  type CyclePayload,
  type DecisionAction,
  type GoalPayload,
  type GoalSummary,
  type GoalUpdatePayload,
  type LaunchPayload,
  type PerfActivityEntry,
  type PerfAppraisal,
  type PerfAttachment,
  type PerfBonus,
  type PerfCalibrationSession,
  type PerfCompensation,
  type PerfCycle,
  type PerfFilterOptions,
  type PerfGoal,
  type PerfKpi,
  type PerfNote,
  type PerfOption,
  type PerfOverview,
  type PerfPagination,
  type PerfReview,
  type PerfReviewDetail,
  type PerfSavedView,
  type PerfTab,
  type ReviewFilters,
  type ReviewStage,
  type ReviewUpdatePayload,
  type SessionContext,
  type TeamComparison,
  type TimelineCycle,
  type BulkReviewAction,
} from './performance-api'

export function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Resolves the current session, or `null` when it cannot authenticate a call. */
function resolveSession(): SessionContext | null {
  const session = buildSessionContext()
  return isPerformanceSessionReady(session) ? session : null
}

const SESSION_ERROR = 'Your session could not be resolved. Please sign in again.'

export interface MutationResult {
  ok: boolean
  message: string
}

const EMPTY_PAGINATION: PerfPagination = { page: 1, per_page: 25, total: 0, last_page: 1 }

/* ------------------------------------------------------------------ *
 * Header: KPI cards
 * ------------------------------------------------------------------ */

export function usePerformanceOverview(cycleId: string | undefined, refreshKey: number) {
  const [kpis, setKpis] = useState<PerfKpi[]>([])
  const [totals, setTotals] = useState<PerfOverview['totals'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const session = resolveSession()
    if (!session) {
      setKpis([])
      setTotals(null)
      setError(SESSION_ERROR)
      setLoading(false)
      return
    }

    try {
      const response = await performanceService.getOverview(session, cycleId)
      setKpis(response.data.kpis)
      setTotals(response.data.totals)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load performance metrics.'))
      setKpis([])
      setTotals(null)
    } finally {
      setLoading(false)
    }
  }, [cycleId])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { kpis, totals, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Header: filter options + cycles (one fetch, both consumers)
 * ------------------------------------------------------------------ */

export function usePerformanceFilters() {
  const [options, setOptions] = useState<PerfFilterOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const session = resolveSession()
    if (!session) {
      setOptions(null)
      setError(SESSION_ERROR)
      setLoading(false)
      return
    }

    try {
      const response = await performanceService.getFilters(session)
      setOptions(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load filter options.'))
      setOptions(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  /** The cycle that should be selected when the screen opens. */
  const defaultCycleId = useMemo(() => {
    if (!options?.cycles?.length) return undefined
    const active = options.cycles.find((cycle) => cycle.status === 'active')
    return (active ?? options.cycles[0]).value
  }, [options])

  return { options, defaultCycleId, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Reviews: the main table
 * ------------------------------------------------------------------ */

export function usePerformanceReviews(filters: ReviewFilters, refreshKey: number) {
  const [reviews, setReviews] = useState<PerfReview[]>([])
  const [pagination, setPagination] = useState<PerfPagination>(EMPTY_PAGINATION)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Serialising the filters keeps the effect key stable across object identity.
  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const session = resolveSession()
    if (!session) {
      setReviews([])
      setPagination(EMPTY_PAGINATION)
      setError(SESSION_ERROR)
      setLoading(false)
      return
    }

    try {
      const response = await performanceService.getReviews(session, JSON.parse(filterKey) as ReviewFilters)
      setReviews(response.data)
      setPagination(response.pagination ?? EMPTY_PAGINATION)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load employee reviews.'))
      setReviews([])
      setPagination(EMPTY_PAGINATION)
    } finally {
      setLoading(false)
    }
  }, [filterKey])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { reviews, pagination, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Reviews: the Review Board kanban
 * ------------------------------------------------------------------ */

export function usePerformanceBoard(filters: ReviewFilters, enabled: boolean, refreshKey: number) {
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)

    const session = resolveSession()
    if (!session) {
      setColumns([])
      setError(SESSION_ERROR)
      setLoading(false)
      return
    }

    try {
      const response = await performanceService.getBoard(session, JSON.parse(filterKey) as ReviewFilters)
      setColumns(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the review board.'))
      setColumns([])
    } finally {
      setLoading(false)
    }
  }, [filterKey, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { columns, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Reviews: the Cycle Timeline view
 * ------------------------------------------------------------------ */

export function usePerformanceTimeline(cycleId: string | undefined, enabled: boolean, refreshKey: number) {
  const [cycles, setCycles] = useState<TimelineCycle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)

    const session = resolveSession()
    if (!session) {
      setCycles([])
      setError(SESSION_ERROR)
      setLoading(false)
      return
    }

    try {
      // Deliberately unscoped: the timeline shows every cycle, not just the
      // one selected in the header, so the whole calendar is visible.
      const response = await performanceService.getTimeline(session)
      setCycles(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the cycle timeline.'))
      setCycles([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey, cycleId])

  return { cycles, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Employee Overview sidebar (detail + team comparison + its tab data)
 * ------------------------------------------------------------------ */

export type SidebarTab = 'overview' | 'goals' | 'reviews' | 'compensation' | 'docs' | 'activity'

export function useReviewDetail(reviewId: number | null, refreshKey: number) {
  const [detail, setDetail] = useState<PerfReviewDetail | null>(null)
  const [team, setTeam] = useState<TeamComparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!reviewId) {
      setDetail(null)
      setTeam(null)
      return
    }

    setLoading(true)
    setError(null)

    const session = resolveSession()
    if (!session) {
      setDetail(null)
      setTeam(null)
      setError(SESSION_ERROR)
      setLoading(false)
      return
    }

    try {
      const response = await performanceService.getReview(session, reviewId)
      setDetail(response.data)

      // Team Comparison needs the employee's department, which only arrives with
      // the detail - so it is a dependent second call, not a parallel one.
      if (response.data.department_id) {
        try {
          const teamResponse = await performanceService.getTeamComparison(
            session,
            String(response.data.department_id),
            String(response.data.cycle_id),
          )
          setTeam(teamResponse.data)
        } catch {
          // A missing comparison must not blank the whole panel.
          setTeam(null)
        }
      } else {
        setTeam(null)
      }
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the employee overview.'))
      setDetail(null)
      setTeam(null)
    } finally {
      setLoading(false)
    }
  }, [reviewId])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { detail, team, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Activity Feed / Comments / Notes / Attachments / Audit Trail
 * ------------------------------------------------------------------ */

export type ActivityTab = 'feed' | 'comments' | 'notes' | 'attachments' | 'audit'

export function useReviewActivity(reviewId: number | null, tab: ActivityTab, refreshKey: number) {
  const [entries, setEntries] = useState<PerfActivityEntry[]>([])
  const [notes, setNotes] = useState<PerfNote[]>([])
  const [attachments, setAttachments] = useState<PerfAttachment[]>([])
  const [counts, setCounts] = useState({ comment: 0, note: 0, attachments: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * The tab counts are shown in the tab labels themselves, so they must be
   * loaded whether or not that tab is open. This runs once per review.
   */
  const loadCounts = useCallback(async () => {
    if (!reviewId) {
      setCounts({ comment: 0, note: 0, attachments: 0 })
      return
    }

    const session = resolveSession()
    if (!session) {
      setCounts({ comment: 0, note: 0, attachments: 0 })
      return
    }

    try {
      const [noteResponse, attachmentResponse] = await Promise.all([
        performanceService.getNotes(session, reviewId),
        performanceService.getAttachments(session, reviewId),
      ])

      setCounts({
        comment: noteResponse.counts?.comment ?? 0,
        note: noteResponse.counts?.note ?? 0,
        attachments: attachmentResponse.counts?.attachments ?? 0,
      })
    } catch {
      setCounts({ comment: 0, note: 0, attachments: 0 })
    }
  }, [reviewId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const session = resolveSession()
    if (!session) {
      setEntries([])
      setNotes([])
      setAttachments([])
      setError(SESSION_ERROR)
      setLoading(false)
      return
    }

    try {
      if (tab === 'comments' || tab === 'notes') {
        if (!reviewId) {
          setNotes([])
          return
        }
        const response = await performanceService.getNotes(session, reviewId, tab === 'comments' ? 'comment' : 'note')
        setNotes(response.data)
      } else if (tab === 'attachments') {
        if (!reviewId) {
          setAttachments([])
          return
        }
        const response = await performanceService.getAttachments(session, reviewId)
        setAttachments(response.data)
      } else {
        const response = await performanceService.getActivity(session, {
          tab: tab === 'audit' ? 'audit' : 'feed',
          ...(reviewId ? { review_id: reviewId } : {}),
          per_page: 20,
        })
        setEntries(response.data)
      }
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load activity.'))
      setEntries([])
      setNotes([])
      setAttachments([])
    } finally {
      setLoading(false)
    }
  }, [reviewId, tab])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  useEffect(() => {
    queueMicrotask(() => {
      loadCounts()
    })
  }, [loadCounts, refreshKey])

  return { entries, notes, attachments, counts, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Tab data: Goals / Appraisals / Compensation / Bonus / Calibration
 * ------------------------------------------------------------------ */

export function usePerformanceGoals(
  filters: ReviewFilters & { category?: string; goal_status?: string },
  enabled: boolean,
  refreshKey: number,
) {
  const [goals, setGoals] = useState<PerfGoal[]>([])
  const [summary, setSummary] = useState<GoalSummary | null>(null)
  const [pagination, setPagination] = useState<PerfPagination>(EMPTY_PAGINATION)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)

    const session = resolveSession()
    if (!session) {
      setGoals([])
      setSummary(null)
      setPagination(EMPTY_PAGINATION)
      setError(SESSION_ERROR)
      setLoading(false)
      return
    }

    try {
      const response = await performanceService.getGoals(session, JSON.parse(filterKey))
      setGoals(response.data)
      setSummary(response.summary ?? null)
      setPagination(response.pagination ?? EMPTY_PAGINATION)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load goals.'))
      setGoals([])
      setSummary(null)
      setPagination(EMPTY_PAGINATION)
    } finally {
      setLoading(false)
    }
  }, [filterKey, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { goals, summary, pagination, loading, error, retry: load }
}

export function usePerformanceAppraisals(
  filters: ReviewFilters & { recommendation?: string },
  enabled: boolean,
  refreshKey: number,
) {
  const [appraisals, setAppraisals] = useState<PerfAppraisal[]>([])
  const [summary, setSummary] = useState<AppraisalSummary | null>(null)
  const [pagination, setPagination] = useState<PerfPagination>(EMPTY_PAGINATION)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)

    const session = resolveSession()
    if (!session) {
      setAppraisals([])
      setSummary(null)
      setPagination(EMPTY_PAGINATION)
      setError(SESSION_ERROR)
      setLoading(false)
      return
    }

    try {
      const response = await performanceService.getAppraisals(session, JSON.parse(filterKey))
      setAppraisals(response.data)
      setSummary(response.summary ?? null)
      setPagination(response.pagination ?? EMPTY_PAGINATION)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load appraisals.'))
      setAppraisals([])
      setSummary(null)
      setPagination(EMPTY_PAGINATION)
    } finally {
      setLoading(false)
    }
  }, [filterKey, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { appraisals, summary, pagination, loading, error, retry: load }
}

export function usePerformanceCompensation(
  filters: ReviewFilters & { revision_type?: string },
  enabled: boolean,
  refreshKey: number,
) {
  const [revisions, setRevisions] = useState<PerfCompensation[]>([])
  const [summary, setSummary] = useState<CompensationSummary | null>(null)
  const [pagination, setPagination] = useState<PerfPagination>(EMPTY_PAGINATION)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)

    const session = resolveSession()
    if (!session) {
      setRevisions([])
      setSummary(null)
      setPagination(EMPTY_PAGINATION)
      setError(SESSION_ERROR)
      setLoading(false)
      return
    }

    try {
      const response = await performanceService.getCompensation(session, JSON.parse(filterKey))
      setRevisions(response.data)
      setSummary(response.summary ?? null)
      setPagination(response.pagination ?? EMPTY_PAGINATION)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load compensation revisions.'))
      setRevisions([])
      setSummary(null)
      setPagination(EMPTY_PAGINATION)
    } finally {
      setLoading(false)
    }
  }, [filterKey, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { revisions, summary, pagination, loading, error, retry: load }
}

export function usePerformanceBonus(
  filters: ReviewFilters & { bonus_type?: string; payout_month?: string },
  enabled: boolean,
  refreshKey: number,
) {
  const [awards, setAwards] = useState<PerfBonus[]>([])
  const [summary, setSummary] = useState<BonusSummary | null>(null)
  const [payoutMonths, setPayoutMonths] = useState<PerfOption[]>([])
  const [pagination, setPagination] = useState<PerfPagination>(EMPTY_PAGINATION)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)

    const session = resolveSession()
    if (!session) {
      setAwards([])
      setSummary(null)
      setPayoutMonths([])
      setPagination(EMPTY_PAGINATION)
      setError(SESSION_ERROR)
      setLoading(false)
      return
    }

    try {
      const response = await performanceService.getBonus(session, JSON.parse(filterKey))
      setAwards(response.data)
      setSummary(response.summary ?? null)
      setPayoutMonths(response.payout_months ?? [])
      setPagination(response.pagination ?? EMPTY_PAGINATION)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load bonus awards.'))
      setAwards([])
      setSummary(null)
      setPayoutMonths([])
      setPagination(EMPTY_PAGINATION)
    } finally {
      setLoading(false)
    }
  }, [filterKey, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { awards, summary, payoutMonths, pagination, loading, error, retry: load }
}

export function usePerformanceCalibration(filters: ReviewFilters, enabled: boolean, refreshKey: number) {
  const [sessions, setSessions] = useState<PerfCalibrationSession[]>([])
  const [summary, setSummary] = useState<CalibrationSummary | null>(null)
  const [pagination, setPagination] = useState<PerfPagination>(EMPTY_PAGINATION)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)

    const session = resolveSession()
    if (!session) {
      setSessions([])
      setSummary(null)
      setPagination(EMPTY_PAGINATION)
      setError(SESSION_ERROR)
      setLoading(false)
      return
    }

    try {
      const response = await performanceService.getCalibrationSessions(session, JSON.parse(filterKey))
      setSessions(response.data)
      setSummary(response.summary ?? null)
      setPagination(response.pagination ?? EMPTY_PAGINATION)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load calibration sessions.'))
      setSessions([])
      setSummary(null)
      setPagination(EMPTY_PAGINATION)
    } finally {
      setLoading(false)
    }
  }, [filterKey, enabled])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { sessions, summary, pagination, loading, error, retry: load }
}

/** The calibration grid, loaded only when a session is opened. */
export function useCalibrationGrid(sessionId: number | null, refreshKey: number) {
  const [grid, setGrid] = useState<CalibrationGrid | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!sessionId) {
      setGrid(null)
      return
    }

    setLoading(true)
    setError(null)

    const session = resolveSession()
    if (!session) {
      setGrid(null)
      setError(SESSION_ERROR)
      setLoading(false)
      return
    }

    try {
      const response = await performanceService.getCalibrationGrid(session, sessionId)
      setGrid(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the calibration grid.'))
      setGrid(null)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { grid, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Saved views
 * ------------------------------------------------------------------ */

export function useSavedViews(tab: PerfTab, refreshKey: number) {
  const [views, setViews] = useState<PerfSavedView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const session = resolveSession()
    if (!session) {
      setViews([])
      setError(SESSION_ERROR)
      setLoading(false)
      return
    }

    try {
      const response = await performanceService.getSavedViews(session, tab)
      setViews(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load saved views.'))
      setViews([])
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load, refreshKey])

  return { views, loading, error, retry: load }
}

/* ------------------------------------------------------------------ *
 * Mutations
 * ------------------------------------------------------------------ *
 * One hook for every write on the screen. Each returns {ok, message} so the
 * component can surface the API's own message (including its 422 guard text,
 * e.g. "An approved appraisal cannot be edited") rather than inventing one.
 */
export function usePerformanceMutations() {
  const [saving, setSaving] = useState(false)

  const run = useCallback(
    async (operation: (session: SessionContext) => Promise<{ message?: string }>, fallback: string): Promise<MutationResult> => {
      setSaving(true)
      try {
        const session = resolveSession()
        if (!session) {
          return { ok: false, message: SESSION_ERROR }
        }
        const response = await operation(session)
        return { ok: true, message: response?.message || fallback }
      } catch (error) {
        return { ok: false, message: toMessage(error, `${fallback} failed.`) }
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  /* -- Cycles -- */
  const createCycle = useCallback(
    (payload: CyclePayload) => run((session) => performanceService.createCycle(session, payload), 'Review cycle created'),
    [run],
  )

  const updateCycle = useCallback(
    (id: number, payload: Partial<CyclePayload>) =>
      run((session) => performanceService.updateCycle(session, id, payload), 'Review cycle updated'),
    [run],
  )

  const launchCycle = useCallback(
    (id: number, payload: LaunchPayload = {}) =>
      run((session) => performanceService.launchCycle(session, id, payload), 'Review cycle launched'),
    [run],
  )

  const closeCycle = useCallback(
    (id: number, force = false) => run((session) => performanceService.closeCycle(session, id, force), 'Review cycle closed'),
    [run],
  )

  const deleteCycle = useCallback(
    (id: number) => run((session) => performanceService.deleteCycle(session, id), 'Review cycle deleted'),
    [run],
  )

  /* -- Reviews -- */
  const updateReview = useCallback(
    (id: number, payload: ReviewUpdatePayload) =>
      run((session) => performanceService.updateReview(session, id, payload), 'Review updated'),
    [run],
  )

  const advanceReview = useCallback(
    (id: number, options: { stage?: ReviewStage; rating?: number } = {}) =>
      run((session) => performanceService.advanceReview(session, id, options), 'Review stage updated'),
    [run],
  )

  const sendReminder = useCallback(
    (id: number) => run((session) => performanceService.sendReminder(session, id), 'Reminder recorded'),
    [run],
  )

  const bulkReviews = useCallback(
    (
      ids: number[],
      action: BulkReviewAction,
      options: { stage?: ReviewStage; manager_id?: number; due_date?: string } = {},
    ) => run((session) => performanceService.bulkReviews(session, ids, action, options), 'Reviews updated'),
    [run],
  )

  const deleteReview = useCallback(
    (id: number) => run((session) => performanceService.deleteReview(session, id), 'Review removed'),
    [run],
  )

  /* -- Goals -- */
  const createGoal = useCallback(
    (payload: GoalPayload) => run((session) => performanceService.createGoal(session, payload), 'Goal created'),
    [run],
  )

  const updateGoal = useCallback(
    (id: number, payload: GoalUpdatePayload) =>
      run((session) => performanceService.updateGoal(session, id, payload), 'Goal updated'),
    [run],
  )

  const deleteGoal = useCallback(
    (id: number) => run((session) => performanceService.deleteGoal(session, id), 'Goal deleted'),
    [run],
  )

  /* -- Appraisals -- */
  const createAppraisal = useCallback(
    (payload: AppraisalPayload) =>
      run((session) => performanceService.createAppraisal(session, payload), 'Appraisal created'),
    [run],
  )

  const updateAppraisal = useCallback(
    (id: number, payload: Partial<Omit<AppraisalPayload, 'user_id_target'>>) =>
      run((session) => performanceService.updateAppraisal(session, id, payload), 'Appraisal updated'),
    [run],
  )

  const decideAppraisal = useCallback(
    (id: number, action: DecisionAction, remarks?: string) =>
      run((session) => performanceService.decideAppraisal(session, id, action, remarks), 'Appraisal updated'),
    [run],
  )

  const bulkAppraisals = useCallback(
    (ids: number[], action: DecisionAction) =>
      run((session) => performanceService.bulkAppraisals(session, ids, action), 'Appraisals updated'),
    [run],
  )

  const deleteAppraisal = useCallback(
    (id: number) => run((session) => performanceService.deleteAppraisal(session, id), 'Appraisal deleted'),
    [run],
  )

  /* -- Compensation -- */
  const createCompensation = useCallback(
    (payload: CompensationPayload) =>
      run((session) => performanceService.createCompensation(session, payload), 'Compensation revision created'),
    [run],
  )

  const updateCompensation = useCallback(
    (id: number, payload: Partial<Omit<CompensationPayload, 'user_id_target'>>) =>
      run((session) => performanceService.updateCompensation(session, id, payload), 'Compensation revision updated'),
    [run],
  )

  const decideCompensation = useCallback(
    (id: number, action: DecisionAction, remarks?: string) =>
      run(
        (session) => performanceService.decideCompensation(session, id, action, remarks),
        'Compensation revision updated',
      ),
    [run],
  )

  const bulkCompensation = useCallback(
    (ids: number[], action: DecisionAction) =>
      run((session) => performanceService.bulkCompensation(session, ids, action), 'Compensation revisions updated'),
    [run],
  )

  const deleteCompensation = useCallback(
    (id: number) =>
      run((session) => performanceService.deleteCompensation(session, id), 'Compensation revision deleted'),
    [run],
  )

  /* -- Bonus -- */
  const createBonus = useCallback(
    (payload: BonusPayload) => run((session) => performanceService.createBonus(session, payload), 'Bonus award created'),
    [run],
  )

  const updateBonus = useCallback(
    (id: number, payload: Partial<Omit<BonusPayload, 'user_id_target'>>) =>
      run((session) => performanceService.updateBonus(session, id, payload), 'Bonus award updated'),
    [run],
  )

  const decideBonus = useCallback(
    (id: number, action: BonusDecisionAction, remarks?: string) =>
      run((session) => performanceService.decideBonus(session, id, action, remarks), 'Bonus award updated'),
    [run],
  )

  const bulkBonus = useCallback(
    (ids: number[], action: BonusDecisionAction) =>
      run((session) => performanceService.bulkBonus(session, ids, action), 'Bonus awards updated'),
    [run],
  )

  const deleteBonus = useCallback(
    (id: number) => run((session) => performanceService.deleteBonus(session, id), 'Bonus award deleted'),
    [run],
  )

  /* -- Calibration -- */
  const createCalibrationSession = useCallback(
    (payload: CalibrationSessionPayload) =>
      run((session) => performanceService.createCalibrationSession(session, payload), 'Calibration session created'),
    [run],
  )

  const updateCalibrationSession = useCallback(
    (id: number, payload: Partial<Omit<CalibrationSessionPayload, 'cycle_id' | 'attach_reviews'>>) =>
      run(
        (session) => performanceService.updateCalibrationSession(session, id, payload),
        'Calibration session updated',
      ),
    [run],
  )

  const calibrateRating = useCallback(
    (sessionId: number, reviewId: number, rating: number) =>
      run(
        (session) => performanceService.calibrateRatings(session, sessionId, { review_id: reviewId, rating }),
        'Rating calibrated',
      ),
    [run],
  )

  const lockCalibrationSession = useCallback(
    (id: number, options: { force?: boolean; advance?: boolean } = {}) =>
      run((session) => performanceService.lockCalibrationSession(session, id, options), 'Calibration session locked'),
    [run],
  )

  const deleteCalibrationSession = useCallback(
    (id: number) =>
      run((session) => performanceService.deleteCalibrationSession(session, id), 'Calibration session deleted'),
    [run],
  )

  /* -- Notes / attachments -- */
  const createNote = useCallback(
    (reviewId: number, body: string, noteType: 'comment' | 'note' = 'comment') =>
      run(
        (session) => performanceService.createNote(session, reviewId, { body, note_type: noteType }),
        noteType === 'note' ? 'Note added' : 'Comment added',
      ),
    [run],
  )

  const updateNote = useCallback(
    (id: number, body: string) => run((session) => performanceService.updateNote(session, id, { body }), 'Note updated'),
    [run],
  )

  const deleteNote = useCallback(
    (id: number) => run((session) => performanceService.deleteNote(session, id), 'Note deleted'),
    [run],
  )

  const uploadAttachment = useCallback(
    (reviewId: number, file: File, meta: { title?: string; document_type?: string } = {}) =>
      run((session) => performanceService.uploadAttachment(session, reviewId, file, meta), 'Attachment uploaded'),
    [run],
  )

  const deleteAttachment = useCallback(
    (id: number) => run((session) => performanceService.deleteAttachment(session, id), 'Attachment deleted'),
    [run],
  )

  /* -- Saved views -- */
  const createSavedView = useCallback(
    (payload: { name: string; tab?: PerfTab; filters?: Record<string, string>; is_shared?: boolean; is_default?: boolean }) =>
      run((session) => performanceService.createSavedView(session, payload), 'View saved'),
    [run],
  )

  const deleteSavedView = useCallback(
    (id: number) => run((session) => performanceService.deleteSavedView(session, id), 'Saved view deleted'),
    [run],
  )

  return {
    saving,
    createCycle,
    updateCycle,
    launchCycle,
    closeCycle,
    deleteCycle,
    updateReview,
    advanceReview,
    sendReminder,
    bulkReviews,
    deleteReview,
    createGoal,
    updateGoal,
    deleteGoal,
    createAppraisal,
    updateAppraisal,
    decideAppraisal,
    bulkAppraisals,
    deleteAppraisal,
    createCompensation,
    updateCompensation,
    decideCompensation,
    bulkCompensation,
    deleteCompensation,
    createBonus,
    updateBonus,
    decideBonus,
    bulkBonus,
    deleteBonus,
    createCalibrationSession,
    updateCalibrationSession,
    calibrateRating,
    lockCalibrationSession,
    deleteCalibrationSession,
    createNote,
    updateNote,
    deleteNote,
    uploadAttachment,
    deleteAttachment,
    createSavedView,
    deleteSavedView,
  }
}
