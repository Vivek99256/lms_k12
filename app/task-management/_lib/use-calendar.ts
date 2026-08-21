'use client'

/**
 * Ported from G2G's `task-calendar-view.tsx`, which fetched/reschedule
 * directly inline (no separate hook existed in G2G — this file factors that
 * logic out only because this project's ported pages follow a
 * component/hook split, per `use-recruitment.ts` /
 * `app/hrit/_lib/use-payroll.ts`). Behaviour is unchanged: `load()` fetches
 * `getWorkspace` for the visible month's calendar range (Monday-start weeks,
 * `perPage: 100`), and `reschedule()` calls `updateTaskSchedule` with only
 * `due_date`, then re-runs `load()` — same sequence as G2G's `reschedule`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'

import { resolveTaskSession, toMessage, TASK_SESSION_ERROR } from './task-session'
import { calendarService } from './calendar-api'
import type { WorkspaceTask } from './task-types'

export function useCalendar(month: Date) {
  const [tasks, setTasks] = useState<WorkspaceTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [rescheduling, setRescheduling] = useState(false)

  const range = useMemo(
    () => ({
      from: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
      to: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
    }),
    [month],
  )

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
      const response = await calendarService.getWorkspace(session, {
        from: format(range.from, 'yyyy-MM-dd'),
        to: format(range.to, 'yyyy-MM-dd'),
        perPage: 100,
      })
      setTasks(response.data.tasks)
    } catch (reason) {
      setError(toMessage(reason, 'Unable to load calendar tasks.'))
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const reschedule = useCallback(
    async (taskId: string, dueDate: string) => {
      const session = resolveTaskSession()
      if (!session) {
        setError(TASK_SESSION_ERROR)
        return null
      }
      setRescheduling(true)
      setError('')
      setMessage('')
      try {
        const response = await calendarService.updateTaskSchedule(session, taskId, { due_date: dueDate })
        setMessage(response.message)
        await load()
        return response.data.schedule.due_date
      } catch (reason) {
        setError(toMessage(reason, 'Unable to reschedule this task.'))
        return null
      } finally {
        setRescheduling(false)
      }
    },
    [load],
  )

  return { tasks, loading, error, message, rescheduling, reschedule, refresh: load }
}
