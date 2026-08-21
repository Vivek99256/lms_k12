'use client'

/**
 * Ported as-is from G2G's `hooks/use-leave.ts` (783 lines). All state logic,
 * effect wiring, and return shapes are unchanged.
 *
 * The only change is how the Laravel context is resolved: G2G rebuilt a
 * `LaravelContext` per call from `useAuth().user` via `getLaravelContext()`.
 * This project's `buildSessionContext()` (see `./leave-api.ts` /
 * `lib/erp-client.ts`) already reads live session/local storage on every call
 * with no arguments needed, so `resolveSession()` below is the direct
 * equivalent of G2G's `useLaravelContext()` - same "rebuilt per call, not
 * React state" behavior, just without needing `useAuth()` in the loop.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  buildSessionContext,
  leaveService,
  type HolidayPayload,
  type LeaveApplyPayload,
  type LeaveBalancesData,
  type LeaveDashboardData,
  type LeaveDepartmentSummaryRow,
  type LeaveHolidayRow,
  type LeaveOptionsData,
  type LeaveBalanceReportData,
  type LeaveRegisterRow,
  type LeaveReportFilters,
  type LeaveReportSummaryData,
  type LeaveRequestDetail,
  type LeaveRequestFilters,
  type LeaveRequestRow,
  type LeaveRolePermission,
  type LeaveStatus,
  type LeaveTrendPoint,
  type LeaveTypeConfig,
  type LeaveTypeDistributionRow,
  type LeaveTypePayload,
  type LeaveUpcomingHoliday,
  type LeaveWeekday,
  type LeaveWorkflowSettings,
} from './leave-api'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** The session context is rebuilt per call - it reads live storage, not React state. */
function useLeaveSession() {
  return useCallback(() => buildSessionContext(), [])
}

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

export interface LeaveDashboardState {
  loading: boolean
  processingRequestId: string | null
  error: string | null
  actionError: string | null
  summary: LeaveDashboardData | null
  trend: LeaveTrendPoint[]
  departments: LeaveDepartmentSummaryRow[]
  leaveTypes: LeaveTypeDistributionRow[]
  holidays: LeaveUpcomingHoliday[]
  balances: LeaveBalancesData | null
  pending: LeaveRequestRow[]
  recent: LeaveRequestRow[]
  upcoming: LeaveRequestRow[]
  retry: () => void
  decide: (id: number | string, status: 'approved' | 'rejected') => Promise<{ ok: boolean; message: string }>
}

export function useLeaveDashboard(departmentId?: string): LeaveDashboardState {
  const resolveSession = useLeaveSession()
  const [loading, setLoading] = useState(true)
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [summary, setSummary] = useState<LeaveDashboardData | null>(null)
  const [trend, setTrend] = useState<LeaveTrendPoint[]>([])
  const [departments, setDepartments] = useState<LeaveDepartmentSummaryRow[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeDistributionRow[]>([])
  const [holidays, setHolidays] = useState<LeaveUpcomingHoliday[]>([])
  const [balances, setBalances] = useState<LeaveBalancesData | null>(null)
  const [pending, setPending] = useState<LeaveRequestRow[]>([])
  const [recent, setRecent] = useState<LeaveRequestRow[]>([])
  const [upcoming, setUpcoming] = useState<LeaveRequestRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const session = resolveSession()
      const today = new Date().toISOString().slice(0, 10)

      const [
        summaryResponse,
        trendResponse,
        departmentResponse,
        typeResponse,
        holidayResponse,
        balanceResponse,
        pendingResponse,
        recentResponse,
        upcomingResponse,
      ] = await Promise.all([
        leaveService.getDashboard(session, departmentId),
        leaveService.getTrend(session, departmentId),
        leaveService.getDepartmentSummary(session),
        leaveService.getTypeDistribution(session, departmentId),
        leaveService.getUpcomingHolidays(session, 5),
        leaveService.getBalances(session),
        leaveService.getRequests(session, {
          status: ['pending'],
          departmentId,
          perPage: 5,
          sortBy: 'submittedDate',
          sortDir: 'desc',
        }),
        leaveService.getRequests(session, {
          departmentId,
          perPage: 10,
          sortBy: 'submittedDate',
          sortDir: 'desc',
        }),
        leaveService.getRequests(session, {
          status: ['approved'],
          departmentId,
          fromDate: today,
          perPage: 5,
          sortBy: 'fromDate',
          sortDir: 'asc',
        }),
      ])

      setSummary(summaryResponse.data)
      setTrend(trendResponse.data ?? [])
      setDepartments(departmentResponse.data ?? [])
      setLeaveTypes(typeResponse.data ?? [])
      setHolidays(holidayResponse.data ?? [])
      setBalances(balanceResponse.data)
      setPending(pendingResponse.data ?? [])
      setRecent(recentResponse.data ?? [])
      setUpcoming(upcomingResponse.data ?? [])
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the leave dashboard.'))
      setSummary(null)
      setTrend([])
      setDepartments([])
      setLeaveTypes([])
      setHolidays([])
      setBalances(null)
      setPending([])
      setRecent([])
      setUpcoming([])
    } finally {
      setLoading(false)
    }
  }, [departmentId, resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const decide = useCallback(
    async (id: number | string, status: 'approved' | 'rejected') => {
      setProcessingRequestId(String(id))
      setActionError(null)

      try {
        const response = await leaveService.decideRequest(resolveSession(), id, { status })
        // Reload every dashboard endpoint so counts, lists, balances and activity
        // all reflect the decision returned by Laravel.
        await load()
        return { ok: true, message: response.message }
      } catch (decisionError) {
        const message = toMessage(decisionError, 'Failed to update the leave request.')
        setActionError(message)
        return { ok: false, message }
      } finally {
        setProcessingRequestId(null)
      }
    },
    [load, resolveSession],
  )

  return {
    loading,
    processingRequestId,
    error,
    actionError,
    summary,
    trend,
    departments,
    leaveTypes,
    holidays,
    balances,
    pending,
    recent,
    upcoming,
    retry: load,
    decide,
  }
}

/* ------------------------------------------------------------------ *
 * Shared dropdown options
 * ------------------------------------------------------------------ */

export function useLeaveOptions(departmentId?: string) {
  const resolveSession = useLeaveSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<LeaveOptionsData | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await leaveService.getOptions(resolveSession(), departmentId)
      setOptions(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load leave options.'))
      setOptions(null)
    } finally {
      setLoading(false)
    }
  }, [departmentId, resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  return { loading, error, options, retry: load }
}

/* ------------------------------------------------------------------ *
 * Leave requests
 * ------------------------------------------------------------------ */

export function useLeaveRequests(filters: LeaveRequestFilters) {
  const resolveSession = useLeaveSession()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [requests, setRequests] = useState<LeaveRequestRow[]>([])
  const [total, setTotal] = useState(0)
  const [lastPage, setLastPage] = useState(1)

  // Serialised so the effect only refires when a filter value actually changes.
  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await leaveService.getRequests(resolveSession(), JSON.parse(filterKey))
      setRequests(response.data ?? [])
      setTotal(response.pagination?.total ?? 0)
      setLastPage(response.pagination?.last_page ?? 1)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load leave requests.'))
      setRequests([])
      setTotal(0)
      setLastPage(1)
    } finally {
      setLoading(false)
    }
  }, [filterKey, resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const applyLeave = useCallback(
    async (payload: LeaveApplyPayload) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await leaveService.applyLeave(resolveSession(), payload)
        setActionMessage(response.message)
        await load()
        return { ok: true as const, message: response.message }
      } catch (submitError) {
        const message = toMessage(submitError, 'Failed to submit the leave request.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, resolveSession],
  )

  const decide = useCallback(
    async (id: number | string, status: LeaveStatus, remarks?: { hodComment?: string; hrRemarks?: string }) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await leaveService.decideRequest(resolveSession(), id, { status, ...remarks })
        setActionMessage(response.message)
        await load()
        return { ok: true as const, message: response.message }
      } catch (decisionError) {
        const message = toMessage(decisionError, 'Failed to update the leave request.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, resolveSession],
  )

  const bulkDecide = useCallback(
    async (ids: (number | string)[], status: LeaveStatus, remarks?: { hodComment?: string; hrRemarks?: string }) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await leaveService.bulkDecideRequests(resolveSession(), { ids, status, ...remarks })
        setActionMessage(response.message)
        await load()
        return { ok: true as const, message: response.message }
      } catch (decisionError) {
        const message = toMessage(decisionError, 'Failed to update the selected leave requests.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load, resolveSession],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    requests,
    total,
    lastPage,
    applyLeave,
    decide,
    bulkDecide,
    retry: load,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
  }
}

/** Detail drawer - fetched on demand so the list stays light. */
export function useLeaveRequestDetail(id: number | string | null) {
  const resolveSession = useLeaveSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<LeaveRequestDetail | null>(null)

  const load = useCallback(async () => {
    if (!id) {
      setDetail(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await leaveService.getRequest(resolveSession(), id)
      setDetail(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the leave request.'))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [id, resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  return { loading, error, detail, retry: load }
}

/* ------------------------------------------------------------------ *
 * Reports
 * ------------------------------------------------------------------ */

export function useLeaveReports(filters: LeaveReportFilters) {
  const resolveSession = useLeaveSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<LeaveReportSummaryData | null>(null)
  const [register, setRegister] = useState<LeaveRegisterRow[]>([])
  const [balance, setBalance] = useState<LeaveBalanceReportData | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const session = resolveSession()
      const parsed = JSON.parse(filterKey) as LeaveReportFilters

      const [summaryResponse, registerResponse, balanceResponse] = await Promise.all([
        leaveService.getReportSummary(session, parsed),
        leaveService.getReportRegister(session, { ...parsed, limit: 1000 }),
        leaveService.getReportBalance(session, parsed),
      ])

      setSummary(summaryResponse.data)
      setRegister(registerResponse.data ?? [])
      setBalance(balanceResponse.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the leave report.'))
      setSummary(null)
      setRegister([])
      setBalance(null)
    } finally {
      setLoading(false)
    }
  }, [filterKey, resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  return { loading, error, summary, register, balance, retry: load }
}

/* ------------------------------------------------------------------ *
 * Configuration - leave types
 * ------------------------------------------------------------------ */

export function useLeaveTypes() {
  const resolveSession = useLeaveSession()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeConfig[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await leaveService.getLeaveTypes(resolveSession())
      setLeaveTypes(response.data ?? [])
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load leave types.'))
      setLeaveTypes([])
    } finally {
      setLoading(false)
    }
  }, [resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const run = useCallback(
    async (action: () => Promise<{ message: string }>, fallback: string) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await action()
        setActionMessage(response.message)
        await load()
        return { ok: true as const, message: response.message }
      } catch (actionError) {
        const message = toMessage(actionError, fallback)
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    leaveTypes,
    retry: load,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
    save: (payload: LeaveTypePayload) =>
      run(() => leaveService.saveLeaveType(resolveSession(), payload), 'Failed to save the leave type.'),
    toggleStatus: (id: number | string, status: boolean) =>
      run(
        () => leaveService.toggleLeaveTypeStatus(resolveSession(), id, status),
        'Failed to change the leave type status.',
      ),
    remove: (id: number | string) =>
      run(() => leaveService.deleteLeaveType(resolveSession(), id), 'Failed to delete the leave type.'),
  }
}

/* ------------------------------------------------------------------ *
 * Configuration - holidays and weekly off
 * ------------------------------------------------------------------ */

export function useHolidays(calendarYear?: string) {
  const resolveSession = useLeaveSession()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [holidays, setHolidays] = useState<LeaveHolidayRow[]>([])
  const [weekdays, setWeekdays] = useState<LeaveWeekday[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const session = resolveSession()
      const [holidayResponse, weekdayResponse] = await Promise.all([
        leaveService.getHolidays(session, { calendarYear }),
        leaveService.getWeekdays(session),
      ])

      setHolidays(holidayResponse.data ?? [])
      setWeekdays(weekdayResponse.data ?? [])
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load holidays.'))
      setHolidays([])
      setWeekdays([])
    } finally {
      setLoading(false)
    }
  }, [calendarYear, resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const run = useCallback(
    async (action: () => Promise<{ message: string }>, fallback: string) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await action()
        setActionMessage(response.message)
        await load()
        return { ok: true as const, message: response.message }
      } catch (actionError) {
        const message = toMessage(actionError, fallback)
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [load],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    holidays,
    weekdays,
    retry: load,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
    save: (payload: HolidayPayload, id?: number | string) =>
      run(() => leaveService.saveHoliday(resolveSession(), payload, id), 'Failed to save the holiday.'),
    remove: (id: number | string) =>
      run(() => leaveService.deleteHoliday(resolveSession(), id), 'Failed to delete the holiday.'),
    saveWeekdays: (pattern: Record<string, string>) =>
      run(() => leaveService.saveWeekdays(resolveSession(), pattern), 'Failed to save the weekly off pattern.'),
  }
}

/* ------------------------------------------------------------------ *
 * Configuration - approval workflow and roles
 * ------------------------------------------------------------------ */

export function useLeaveWorkflow() {
  const resolveSession = useLeaveSession()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [workflow, setWorkflow] = useState<LeaveWorkflowSettings | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await leaveService.getWorkflow(resolveSession())
      setWorkflow(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the approval workflow.'))
      setWorkflow(null)
    } finally {
      setLoading(false)
    }
  }, [resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const save = useCallback(
    async (settings: Omit<LeaveWorkflowSettings, 'id'>) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await leaveService.saveWorkflow(resolveSession(), settings)
        setWorkflow(response.data)
        setActionMessage(response.message)
        return { ok: true as const, message: response.message }
      } catch (saveError) {
        const message = toMessage(saveError, 'Failed to save the approval workflow.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [resolveSession],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    workflow,
    save,
    retry: load,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
  }
}

export function useLeaveRoles() {
  const resolveSession = useLeaveSession()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [roles, setRoles] = useState<LeaveRolePermission[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await leaveService.getRoles(resolveSession())
      setRoles(response.data ?? [])
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load role permissions.'))
      setRoles([])
    } finally {
      setLoading(false)
    }
  }, [resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const save = useCallback(
    async (next: LeaveRolePermission[]) => {
      setProcessing(true)
      setError(null)
      setActionMessage(null)

      try {
        const response = await leaveService.saveRoles(resolveSession(), next)
        setRoles(response.data ?? next)
        setActionMessage(response.message)
        return { ok: true as const, message: response.message }
      } catch (saveError) {
        const message = toMessage(saveError, 'Failed to save role permissions.')
        setError(message)
        return { ok: false as const, message }
      } finally {
        setProcessing(false)
      }
    },
    [resolveSession],
  )

  return {
    loading,
    processing,
    error,
    actionMessage,
    roles,
    setRoles,
    save,
    retry: load,
    clearMessages: () => {
      setError(null)
      setActionMessage(null)
    },
  }
}

/* ------------------------------------------------------------------ *
 * Presentation helpers shared by the Leave screens
 * ------------------------------------------------------------------ */

/** Laravel's status vocabulary, mapped to the labels the design system shows. */
export const LEAVE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  sent_back: 'Sent Back',
  cancelled: 'Cancelled',
  approved_lwp: 'Approved LWP',
}

export function leaveStatusLabel(status: string) {
  return LEAVE_STATUS_LABELS[status] ?? status
}

/** StatusBadge understands the hyphenated form the design system already uses. */
export function leaveStatusTone(status: string) {
  return status === 'sent_back' ? 'sent-back' : status
}

export function useLeaveTypeOptions(options: LeaveOptionsData | null) {
  return useMemo(
    () => (options?.leave_types ?? []).map((type) => ({ value: type.value, label: type.label })),
    [options],
  )
}

export function useDepartmentOptions(options: LeaveOptionsData | null) {
  return useMemo(
    () => (options?.departments ?? []).map((department) => ({ value: department.value, label: department.label })),
    [options],
  )
}
