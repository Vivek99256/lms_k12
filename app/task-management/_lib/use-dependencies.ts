'use client'

/**
 * Ported from G2G's `components/domain/task/dependencies-view.tsx` — the
 * `load()` / create / delete dependency state, plus the project ->
 * workstream lookup effect that feeds the "Create Dependency" modal.
 * Extracted into hooks here (see `use-projects.ts` for the same pattern) so
 * `dependencies-center.tsx` stays focused on markup and the React Flow graph
 * wiring. Behavior and field names are unchanged from G2G.
 */

import { useCallback, useEffect, useState } from 'react'
import { resolveTaskSession, toMessage } from './task-session'
import { dependenciesService } from './dependencies-api'
import type { DependenciesResponse, DependencyType, TaskDependency, DependencyNode, Workstream } from './task-types'

export const EMPTY_DEPENDENCIES_DATA: DependenciesResponse['data'] = {
  dependencies: [], tasks: [], milestones: [],
  summary: { total: 0, blocking: 0, at_risk: 0, on_track: 0, milestones: 0, critical_path: 0 },
  options: { types: ['FS', 'SS', 'FF', 'SF'], projects: [], tasks: [], users: [] },
}

export function useDependencies() {
  const [data, setData] = useState<DependenciesResponse['data']>(EMPTY_DEPENDENCIES_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)

  const load = useCallback(async () => {
    const session = resolveTaskSession()
    if (!session) { setError('Your ERP session is unavailable. Please sign in again.'); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const response = await dependenciesService.getDependencies(session)
      const uniqueTasks: DependencyNode[] = Array.from(new Map(response.data.tasks.map((task) => [task.id, task])).values())
      const uniqueDependencies: TaskDependency[] = Array.from(
        new Map(response.data.dependencies.map((dependency) => [dependency.id, dependency])).values(),
      )
      setData({ ...response.data, tasks: uniqueTasks, dependencies: uniqueDependencies })
    } catch (reason) {
      setError(toMessage(reason, 'Unable to load dependencies.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    // `reload` is the manual refetch trigger the mutation handlers bump.
    queueMicrotask(() => { void load() })
  }, [load, reload])

  const refresh = useCallback(() => setReload((value) => value + 1), [])

  const createDependency = useCallback(async (payload: {
    predecessorTaskId: string
    successorTaskId: string
    dependencyType: DependencyType
    lagDays: number
    notes: string
    projectId: string
    workstreamId: string
  }) => {
    const session = resolveTaskSession()
    if (!session) { setError('Your ERP session is unavailable. Please sign in again.'); throw new Error('No session') }
    const response = await dependenciesService.createDependency(session, {
      predecessor_task_id: payload.predecessorTaskId,
      successor_task_id: payload.successorTaskId,
      dependency_type: payload.dependencyType,
      lag_days: payload.lagDays,
      notes: payload.notes || undefined,
      project_id: payload.projectId || undefined,
      workstream_id: payload.workstreamId || undefined,
    })
    setMessage(response.message)
    refresh()
    return response
  }, [refresh])

  const deleteDependency = useCallback(async (id: string) => {
    const session = resolveTaskSession()
    if (!session) { setError('Your ERP session is unavailable. Please sign in again.'); return }
    try {
      const response = await dependenciesService.deleteDependency(session, id)
      setMessage(response.message)
      refresh()
    } catch (reason) {
      setError(toMessage(reason, 'Unable to delete dependency.'))
    }
  }, [refresh])

  return { data, loading, error, setError, message, setMessage, refresh, createDependency, deleteDependency }
}

/**
 * Loads the workstreams for the project currently selected in the "Create
 * Dependency" modal — same derived-effect shape as G2G's `DependenciesView`
 * (reset on an empty selection, cancel-safe against unmount / a fast second
 * selection via the `active` flag).
 */
export function useProjectWorkstreams(selectedProjectId: string) {
  const [workstreams, setWorkstreams] = useState<Workstream[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    // Deferred so every setState (including the resets) lands after this
    // render rather than cascading out of the effect body.
    queueMicrotask(() => {
      if (!active) return
      if (!selectedProjectId) { setWorkstreams([]); setError(''); return }
      const session = resolveTaskSession()
      if (!session) { setError('Session unavailable.'); return }
      setLoading(true)
      setError('')
      dependenciesService.getWorkstreams(session, selectedProjectId)
        .then((response) => { if (active) setWorkstreams(response.data ?? []) })
        .catch((reason) => { if (active) setError(toMessage(reason, 'Unable to load workstreams.')) })
        .finally(() => { if (active) setLoading(false) })
    })
    return () => { active = false }
  }, [selectedProjectId])

  return { workstreams, loading, error }
}
