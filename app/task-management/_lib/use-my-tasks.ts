'use client'

/**
 * State + data-fetch hook backing the My Tasks page.
 *
 * Ported from the state block at the top of G2G's `MyTasksView`
 * (`components/domain/task/my-tasks-view.tsx`) - same debounced search,
 * same group/status/priority filters, same `queueMicrotask`-deferred load -
 * pulled out into a hook (`my-tasks-api.ts` + `use-my-tasks.ts`) so
 * `my-tasks-center.tsx` stays presentational.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { myTasksApi } from './my-tasks-api'
import { resolveTaskSession, TASK_SESSION_ERROR, toMessage } from './task-session'
import type { MyTask, MyTaskGroup, MyTaskPriority, MyTaskSummary, TaskPagination, TaskStatusOption } from './task-types'

/** Fallback vocabulary before `filters.status_options` arrives from the API. */
const SYSTEM_STATUS_OPTIONS: TaskStatusOption[] = (
  [
    ['PENDING', 'Pending'],
    ['IN-PROGRESS', 'In Progress'],
    ['ON HOLD', 'On Hold'],
    ['COMPLETED', 'Completed'],
  ] as const
).map(([category, name], index) => ({ id: null, name, category, color: null, sort_order: index, is_system: true, active: true }))

const EMPTY_SUMMARY: MyTaskSummary = { due_today: 0, on_hold: 0, in_progress: 0, completed_this_month: 0 }
const EMPTY_PAGINATION: TaskPagination = { current_page: 1, last_page: 1, per_page: 20, total: 0 }

export function useMyTasks() {
  const [tasks, setTasks] = useState<MyTask[]>([])
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [pagination, setPagination] = useState(EMPTY_PAGINATION)
  const [group, setGroup] = useState<MyTaskGroup>('all')
  const [status, setStatus] = useState<string>('all')
  const [statusOptions, setStatusOptions] = useState<TaskStatusOption[]>(SYSTEM_STATUS_OPTIONS)
  const [priority, setPriority] = useState<MyTaskPriority | 'all'>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadTasks = useCallback(async () => {
    const session = resolveTaskSession()
    if (!session) {
      setError(TASK_SESSION_ERROR)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await myTasksApi.getMyTasks(session, {
        group,
        search: search || undefined,
        status: status === 'all' ? undefined : status,
        priority: priority === 'all' ? undefined : priority,
        page,
        perPage: 20,
      })
      setTasks(response.data.tasks)
      setSummary(response.data.summary)
      setPagination(response.data.pagination)
      if (response.data.filters.status_options?.length) setStatusOptions(response.data.filters.status_options)
    } catch (reason) {
      setTasks([])
      setError(toMessage(reason, 'Unable to load tasks.'))
    } finally {
      setLoading(false)
    }
  }, [group, page, priority, search, status])

  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => {
      void loadTasks()
    })
  }, [loadTasks, reloadKey])

  const refresh = useCallback(() => setReloadKey((value) => value + 1), [])

  const selectGroup = useCallback((next: MyTaskGroup) => {
    setGroup(next)
    setPage(1)
  }, [])

  const selectStatus = useCallback((next: string) => {
    setStatus(next)
    setPage(1)
  }, [])

  const selectPriority = useCallback((next: MyTaskPriority | 'all') => {
    setPriority(next)
    setPage(1)
  }, [])

  const cards = useMemo(
    () => [
      { title: 'Due Today', value: summary.due_today, subtitle: 'Requires action today', action: () => { selectGroup('today'); setStatus('all') } },
      { title: 'On Hold', value: summary.on_hold, subtitle: 'Waiting for progress', action: () => { selectGroup('all'); setStatus('ON HOLD') } },
      { title: 'In Progress', value: summary.in_progress, subtitle: 'Currently being worked', action: () => { selectGroup('all'); setStatus('IN-PROGRESS') } },
      { title: 'Completed', value: summary.completed_this_month, subtitle: 'Finished this month', action: () => { selectGroup('all'); setStatus('COMPLETED') } },
    ],
    [summary, selectGroup],
  )

  return {
    tasks,
    summary,
    cards,
    pagination,
    group,
    setGroup: selectGroup,
    status,
    setStatus: selectStatus,
    statusOptions,
    priority,
    setPriority: selectPriority,
    searchInput,
    setSearchInput,
    page,
    setPage,
    loading,
    error,
    message,
    setMessage,
    refresh,
  }
}
