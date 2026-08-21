'use client'

/**
 * Task Management > Administration hooks.
 *
 * One hook per sub-area, wrapping `administration-api.ts` with the same
 * load/save/deactivate lifecycle G2G's `tm-status-management.tsx` /
 * `tm-priority-management.tsx` / `tm-permissions.tsx` / `tm-integrations.tsx`
 * / `tm-audit-logs.tsx` each inlined with `useState` + `useEffect`. Moved out
 * to hooks here so the four routed pages can each mount only the sub-area
 * they need, per this port's "one page per Administration sub-menu item"
 * structure (source treats status + priority management as two sections of
 * one screen; permissions, integrations and audit logs are each their own
 * screen in source too).
 */

import { useCallback, useEffect, useState } from 'react'

import { resolveTaskSession, toMessage, TASK_SESSION_ERROR, type TaskSession } from './task-session'
import type { TaskStatus, TaskStatusOption, TaskPriorityOption, PermissionAbility, IntegrationStatus, TaskAuditLog, TaskPagination } from './task-types'
import {
  fetchStatuses,
  createStatusOption,
  updateStatusOption,
  deleteStatusOption,
  fetchPriorities,
  createPriorityOption,
  updatePriorityOption,
  deletePriorityOption,
  fetchPermissionsMatrix,
  fetchIntegrations,
  fetchAuditLogs,
  auditLogsExportUrl as buildAuditLogsExportUrl,
} from './administration-api'

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

export function useStatuses() {
  const [statuses, setStatuses] = useState<TaskStatusOption[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

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
      const response = await fetchStatuses(session)
      setStatuses(response.data.statuses)
    } catch (reason) {
      setError(toMessage(reason, 'Unable to load statuses.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => { void load() })
  }, [load])

  const save = useCallback(
    async (editingId: string | null, payload: { name: string; category: TaskStatus }) => {
      const session = resolveTaskSession()
      if (!session) { setError(TASK_SESSION_ERROR); return }
      setBusy(true); setError(''); setMessage('')
      try {
        const response = editingId
          ? await updateStatusOption(session, editingId, payload)
          : await createStatusOption(session, payload)
        setMessage(response.message)
        await load()
      } catch (reason) {
        setError(toMessage(reason, 'Unable to save the status.'))
      } finally {
        setBusy(false)
      }
    },
    [load],
  )

  const deactivate = useCallback(
    async (option: TaskStatusOption) => {
      if (!option.id) return
      const session = resolveTaskSession()
      if (!session) { setError(TASK_SESSION_ERROR); return }
      setBusy(true); setError(''); setMessage('')
      try {
        const response = await deleteStatusOption(session, option.id)
        setMessage(response.message)
        await load()
      } catch (reason) {
        setError(toMessage(reason, 'Unable to deactivate the status.'))
      } finally {
        setBusy(false)
      }
    },
    [load],
  )

  return { statuses, loading, busy, error, message, save, deactivate, reload: load }
}

// ---------------------------------------------------------------------------
// Priorities
// ---------------------------------------------------------------------------

export function usePriorities() {
  const [priorities, setPriorities] = useState<TaskPriorityOption[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

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
      const response = await fetchPriorities(session)
      setPriorities(response.data.priorities)
    } catch (reason) {
      setError(toMessage(reason, 'Unable to load priorities.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => { void load() })
  }, [load])

  const save = useCallback(
    async (editingId: string | null, payload: { name: string; sla_hours?: number }) => {
      const session = resolveTaskSession()
      if (!session) { setError(TASK_SESSION_ERROR); return }
      setBusy(true); setError(''); setMessage('')
      try {
        const response = editingId
          ? await updatePriorityOption(session, editingId, payload)
          : await createPriorityOption(session, payload)
        setMessage(response.message)
        await load()
      } catch (reason) {
        setError(toMessage(reason, 'Unable to save the priority.'))
      } finally {
        setBusy(false)
      }
    },
    [load],
  )

  const deactivate = useCallback(
    async (option: TaskPriorityOption) => {
      if (!option.id) return
      const session = resolveTaskSession()
      if (!session) { setError(TASK_SESSION_ERROR); return }
      setBusy(true); setError(''); setMessage('')
      try {
        const response = await deletePriorityOption(session, option.id)
        setMessage(response.message)
        await load()
      } catch (reason) {
        setError(toMessage(reason, 'Unable to deactivate the priority.'))
      } finally {
        setBusy(false)
      }
    },
    [load],
  )

  return { priorities, loading, busy, error, message, save, deactivate, reload: load }
}

// ---------------------------------------------------------------------------
// Permissions matrix
// ---------------------------------------------------------------------------

export function usePermissionsMatrix() {
  const [profiles, setProfiles] = useState<string[]>([])
  const [abilities, setAbilities] = useState<PermissionAbility[]>([])
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(async () => {
      const session = resolveTaskSession()
      if (!session) {
        if (active) { setError(TASK_SESSION_ERROR); setLoading(false) }
        return
      }
      try {
        const response = await fetchPermissionsMatrix(session)
        if (!active) return
        setProfiles(response.data.profiles)
        setAbilities(response.data.abilities)
        setNote(response.data.note)
      } catch (reason) {
        if (active) setError(toMessage(reason, 'Unable to load the permission matrix.'))
      } finally {
        if (active) setLoading(false)
      }
    })
    return () => { active = false }
  }, [])

  return { profiles, abilities, note, loading, error }
}

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(async () => {
      const session = resolveTaskSession()
      if (!session) {
        if (active) { setError(TASK_SESSION_ERROR); setLoading(false) }
        return
      }
      try {
        const response = await fetchIntegrations(session)
        if (active) setIntegrations(response.data.integrations)
      } catch (reason) {
        if (active) setError(toMessage(reason, 'Unable to load integration status.'))
      } finally {
        if (active) setLoading(false)
      }
    })
    return () => { active = false }
  }, [])

  return { integrations, loading, error }
}

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

export function useAuditLogs() {
  const [logs, setLogs] = useState<TaskAuditLog[]>([])
  const [pagination, setPagination] = useState<TaskPagination | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
      const response = await fetchAuditLogs(session, { page })
      setLogs(response.data.logs)
      setPagination(response.data.pagination)
    } catch (reason) {
      setError(toMessage(reason, 'Unable to load audit logs.'))
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => { void load() })
  }, [load])

  /** Builds the CSV export URL, or `null` when the session cannot authenticate it. */
  const exportUrl = useCallback((): string | null => {
    const session: TaskSession | null = resolveTaskSession()
    return session ? buildAuditLogsExportUrl(session) : null
  }, [])

  return { logs, pagination, page, setPage, loading, error, exportUrl }
}
