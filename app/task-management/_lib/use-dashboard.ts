'use client'

/**
 * State + data-fetch hook backing the Task Management Dashboard.
 *
 * Ported from the state block at the top of G2G's `TaskWorkspace`
 * (`components/domain/task/task-workspace.tsx`) — same debounced search,
 * same `queueMicrotask`-deferred load-on-change, same scope/status/page
 * filters — pulled out into a hook (per this port's naming convention:
 * `dashboard-api.ts` + `use-dashboard.ts`) so `task-dashboard-center.tsx`
 * stays presentational.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dashboardApi } from './dashboard-api'
import { resolveTaskSession, TASK_SESSION_ERROR, toMessage } from './task-session'
import type { TaskStatusOption, WorkspaceScope, WorkspaceTask } from './task-types'

const EMPTY_PAGINATION = { current_page: 1, last_page: 1, per_page: 25, total: 0 }
const EMPTY_SUMMARY = { active: 0, pending_review: 0, blocked_overdue: 0, completed_this_month: 0 }

export function useDashboard() {
  const [tasks, setTasks] = useState<WorkspaceTask[]>([])
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [scope, setScope] = useState<WorkspaceScope>('all')
  const [status, setStatus] = useState<string>('all')
  const [statusOptions, setStatusOptions] = useState<TaskStatusOption[]>([])
  const [pagination, setPagination] = useState(EMPTY_PAGINATION)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const load = useCallback(async () => {
    const session = resolveTaskSession()
    if (!session) {
      setError(TASK_SESSION_ERROR)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await dashboardApi.getWorkspace(session, {
        scope,
        search: search || undefined,
        status: status === 'all' ? undefined : status,
        page,
        perPage: EMPTY_PAGINATION.per_page,
      })
      setTasks(response.data.tasks)
      setSummary(response.data.summary)
      setPagination(response.data.pagination)
      setStatusOptions(response.data.filters.status_options)
    } catch (reason) {
      setError(toMessage(reason, 'Unable to load the task workspace.'))
    } finally {
      setLoading(false)
    }
  }, [page, scope, search, status])

  useEffect(() => {
    // Deferred so the load's first setState lands after this render, exactly
    // like the source component's own effect.
    queueMicrotask(() => {
      void load()
    })
  }, [load, reload])

  const refresh = useCallback(() => setReload((value) => value + 1), [])

  const selectScope = useCallback((next: WorkspaceScope) => {
    setScope(next)
    setPage(1)
  }, [])

  const selectStatus = useCallback((next: string) => {
    setStatus(next)
    setPage(1)
  }, [])

  const clearFilters = useCallback(() => {
    setScope('all')
    setStatus('all')
    setSearchInput('')
    setPage(1)
  }, [])

  const decide = useCallback(
    async (task: WorkspaceTask, decision: 'approve' | 'reject') => {
      const session = resolveTaskSession()
      if (!session) {
        setError(TASK_SESSION_ERROR)
        return
      }
      try {
        const response = await dashboardApi.decideWorkspaceTask(session, task.id, decision)
        setMessage(response.message)
        refresh()
      } catch (reason) {
        setError(toMessage(reason, 'Unable to update approval.'))
      }
    },
    [refresh],
  )

  const archive = useCallback(
    async (task: WorkspaceTask) => {
      const session = resolveTaskSession()
      if (!session) {
        setError(TASK_SESSION_ERROR)
        return
      }
      try {
        const response = await dashboardApi.archiveWorkspaceTask(session, task.id)
        setMessage(response.message)
        refresh()
      } catch (reason) {
        setError(toMessage(reason, 'Unable to archive task.'))
      }
    },
    [refresh],
  )

  const cards = useMemo(
    () => [
      { title: 'Active Tasks', value: summary.active, subtitle: 'Open work across this scope' },
      { title: 'Pending Review', value: summary.pending_review, subtitle: 'Awaiting owner approval' },
      { title: 'Blocked / Overdue', value: summary.blocked_overdue, subtitle: 'Requires attention' },
      { title: 'Completed', value: summary.completed_this_month, subtitle: 'Finished this month' },
    ],
    [summary],
  )

  return {
    tasks,
    summary,
    cards,
    scope,
    setScope: selectScope,
    status,
    setStatus: selectStatus,
    statusOptions,
    pagination,
    page,
    setPage,
    searchInput,
    setSearchInput,
    loading,
    error,
    setError,
    message,
    setMessage,
    refresh,
    clearFilters,
    decide,
    archive,
  }
}
