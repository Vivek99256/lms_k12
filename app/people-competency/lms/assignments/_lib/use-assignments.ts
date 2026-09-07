'use client'

/**
 * Ported from G2G's `hooks/use-assignments.ts`. Logic and shape are
 * unchanged; only the session source is adapted — G2G resolved
 * `LaravelContext` from `useAuth()` + `getLaravelContext`, this project
 * resolves `SessionContext` from `lib/erp-client`'s `buildSessionContext()`
 * (localStorage-backed, the same pattern
 * `components/domain/organization/department-management/organization-service.ts`
 * uses).
 */

import { useCallback, useEffect, useState } from 'react'

import { buildSessionContext, type SessionContext } from '@/lib/erp-client'
import {
  lmsAssignmentsService,
  type LmsAssignment,
  type AssignmentStats,
} from '@/components/domain/lms/assignments/assignments-service'

export interface AssignmentFilters {
  search: string
  assignmentType: string
  learningType: string
  status: string
  department: string
  dueDate: string
  assignedBy: string
  quickFilter: string
}

const DEFAULT_FILTERS: AssignmentFilters = {
  search: '',
  assignmentType: 'All',
  learningType: 'All',
  status: 'All',
  department: 'All',
  dueDate: '',
  assignedBy: 'All',
  quickFilter: '',
}

export interface UseAssignmentsReturn {
  loading: boolean
  error: string | null
  assignments: LmsAssignment[]
  /** Change one assignment's status, from the row menu. */
  changeStatus: (id: number, status: string) => Promise<{ ok: boolean }>
  /**
   * The values the three previously-hardcoded filters can actually offer.
   *
   * Derived from the loaded rows rather than fetched, so the dropdown can
   * never present a value that would return an empty list.
   */
  departmentOptions: string[]
  assignedByOptions: string[]
  learningTypeOptions: string[]
  stats: AssignmentStats | null
  filters: AssignmentFilters
  selectedIds: string[]
  activeTab: string

  setActiveTab: (tab: string) => void
  setSelectedIds: (ids: string[]) => void
  setFilter: <K extends keyof AssignmentFilters>(key: K, value: AssignmentFilters[K]) => void
  applyFilters: () => void
  resetFilters: () => void
  setQuickFilter: (filter: string) => void

  handleBulkUpdate: (status: string) => Promise<void>
  handleSearch: (term: string) => void
  retry: () => void
}

/** A session with no token yet cannot call the API. */
function isSessionReady(session: SessionContext): boolean {
  return Boolean(session.token && session.subInstituteId && session.userId)
}

export function useAssignments(): UseAssignmentsReturn {
  const resolveSession = useCallback(() => buildSessionContext(), [])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<LmsAssignment[]>([])
  const [stats, setStats] = useState<AssignmentStats | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState('queue')
  const [filters, setFilters] = useState<AssignmentFilters>({ ...DEFAULT_FILTERS })

  const load = useCallback(async (searchTerm?: string) => {
    const session = resolveSession()

    if (!isSessionReady(session)) {
      setLoading(false)
      setError('Your session has expired. Sign in again to load assignments.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [assignmentsResponse, statsResponse] = await Promise.all([
        lmsAssignmentsService.getAssignments(session, {
          ...(searchTerm ? { search: searchTerm } : {}),
        }),
        lmsAssignmentsService.getStats(session),
      ])

      setAssignments(assignmentsResponse?.data ?? [])
      setStats(statsResponse?.data ?? null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load assignments'
      setError(message)
      console.error('[useAssignments] load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [resolveSession])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const handleSearch = useCallback(
    (term: string) => {
      setFilters((prev) => ({ ...prev, search: term }))
      void load(term)
    },
    [load],
  )

  const handleBulkUpdate = useCallback(
    async (status: string) => {
      if (selectedIds.length === 0) return

      const session = resolveSession()
      if (!isSessionReady(session)) return

      try {
        const actualIds = selectedIds
          .map((idx) => assignments[Number(idx)]?.id)
          .filter((id): id is number => id != null)

        if (actualIds.length === 0) return

        await lmsAssignmentsService.bulkUpdateStatus(session, actualIds, status)
        setSelectedIds([])
        await load()
      } catch (err) {
        console.error('[useAssignments] bulk update failed:', err)
      }
    },
    [selectedIds, assignments, resolveSession, load],
  )

  const setFilter = useCallback(
    <K extends keyof AssignmentFilters>(key: K, value: AssignmentFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const applyFilters = useCallback(() => {
    void load(filters.search)
  }, [filters.search, load])

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS })
    void load()
  }, [load])

  const setQuickFilter = useCallback(
    (filter: string) => {
      setFilters((prev) => ({
        ...prev,
        quickFilter: prev.quickFilter === filter ? '' : filter,
        status: prev.quickFilter === filter ? 'All' : filter,
      }))
      void load()
    },
    [load],
  )

  const retry = useCallback(() => {
    void load()
  }, [load])

  /**
   * Change ONE assignment's status.
   *
   * `lmsAssignmentsService.updateStatus` wrapped POST assignments/{id}/status
   * and had zero callers, so the only way to change a single assignment was
   * to tick its checkbox and use a bulk action — and the row menu that should
   * have done it had no onClick at all.
   */
  const changeStatus = useCallback(
    async (id: number, status: string) => {
      const session = resolveSession()
      if (!isSessionReady(session)) return { ok: false as const }

      try {
        await lmsAssignmentsService.updateStatus(session, id, status)
        await load()
        return { ok: true as const }
      } catch (err) {
        console.error('[useAssignments] status change failed:', err)
        return { ok: false as const }
      }
    },
    [resolveSession, load],
  )

  // Client-side filtering for sidebar filters
  /*
   * The Department and Assigned By dropdowns each offered exactly one option,
   * `[{label:'All'}]`, hardcoded in the component - so a working filter sat
   * behind an input that could never express anything but "All".
   *
   * Derived from the rows actually loaded rather than fetched separately: the
   * list is what the filter narrows, so offering a value that is not in it
   * would produce a guaranteed-empty result.
   */
  const distinct = (pick: (a: LmsAssignment) => string | null | undefined) =>
    Array.from(new Set(assignments.map(pick).filter((v): v is string => Boolean(v && v.trim()))))
      .sort((a, b) => a.localeCompare(b))

  const departmentOptions = distinct((a) => a.department)
  const assignedByOptions = distinct((a) => a.assigned_by)
  const learningTypeOptions = distinct((a) => a.assignment_type)

  const filteredAssignments = assignments.filter((a) => {
    if (filters.assignmentType !== 'All' && a.assignment_type !== filters.assignmentType)
      return false
    if (filters.status !== 'All' && a.status !== filters.status) return false
    if (filters.quickFilter) {
      if (filters.quickFilter === 'Overdue' && a.status !== 'Overdue') return false
      if (filters.quickFilter === 'In Progress' && a.status !== 'In Progress') return false
      if (filters.quickFilter === 'Completed' && a.status !== 'Completed') return false
      if (filters.quickFilter === 'Not Started' && a.status !== 'Not Started') return false
      if (
        filters.quickFilter === 'Due Today' &&
        a.due_date &&
        new Date(a.due_date).toDateString() !== new Date().toDateString()
      )
        return false
      if (filters.quickFilter === 'Due This Week') {
        const today = new Date()
        const weekEnd = new Date(today)
        weekEnd.setDate(today.getDate() + (7 - today.getDay()))
        if (!a.due_date || new Date(a.due_date) > weekEnd || new Date(a.due_date) < today)
          return false
      }
    }
    if (filters.assignedBy !== 'All' && a.assigned_by !== filters.assignedBy) return false

    /*
     * ── THREE FILTERS THAT WERE COLLECTED AND NEVER READ ────────────────
     *
     * `learningType`, `department` and `dueDate` were bound to controls in the
     * sidebar, stored in state, and referenced NOWHERE in this predicate. A
     * user could set all three, press the prominent "Apply Filters" button,
     * and watch the list refetch identically — half that sidebar did nothing.
     */
    if (filters.learningType !== 'All' && a.assignment_type !== filters.learningType) return false

    if (filters.department !== 'All' && (a.department ?? '') !== filters.department) return false

    if (filters.dueDate) {
      // Everything due ON OR BEFORE the chosen date. A learner chasing
      // deadlines wants "what is due by Friday", not "what is due exactly on
      // Friday" - and an assignment with no due date is never overdue.
      if (!a.due_date) return false
      if (new Date(a.due_date) > new Date(filters.dueDate)) return false
    }

    return true
  })

  return {
    loading,
    error,
    assignments: filteredAssignments,
    changeStatus,
    departmentOptions,
    assignedByOptions,
    learningTypeOptions,
    stats,
    filters,
    selectedIds,
    activeTab,

    setActiveTab,
    setSelectedIds,
    setFilter,
    applyFilters,
    resetFilters,
    setQuickFilter,

    handleBulkUpdate,
    handleSearch,
    retry,
  }
}
