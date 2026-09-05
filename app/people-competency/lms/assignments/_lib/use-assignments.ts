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
    return true
  })

  return {
    loading,
    error,
    assignments: filteredAssignments,
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
