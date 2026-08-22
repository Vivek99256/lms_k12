'use client'

/**
 * Ported from G2G's `components/domain/task/projects-list-view.tsx` (the
 * list-load + archive state that lived inline in `ProjectsListView`) and the
 * project-detail load/save state that lived inline in `ProjectDrawer`.
 * Extracted into hooks here — following the established port pattern
 * (`app/talent-management/_lib/use-recruitment.ts`) — so the ported
 * `projects-center.tsx` component stays focused on markup. Behavior,
 * debounce timing and field names are unchanged from G2G.
 */

import { useCallback, useEffect, useState } from 'react'
import { resolveTaskSession, toMessage, type TaskSession } from './task-session'
import { projectsService } from './projects-api'
import type { ProjectOptions, ProjectRecord, ProjectStatus, Workstream } from './task-types'

const EMPTY_OPTIONS: ProjectOptions = { users: [], departments: [], tasks: [], categories: [], statuses: [], priorities: [] }

export function useProjects() {
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [options, setOptions] = useState<ProjectOptions>(EMPTY_OPTIONS)
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ProjectStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reload, setReload] = useState(0)

  // Debounced the same way G2G's ProjectsListView did: 300ms after the user
  // stops typing, and reset back to page 1 for the new search.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const load = useCallback(async () => {
    const session = resolveTaskSession()
    if (!session) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [records, lookup] = await Promise.all([
        projectsService.getProjectRecords(session, { search: search || undefined, status: status === 'all' ? undefined : status, page }),
        projectsService.getProjectOptions(session),
      ])
      setProjects(records.data.projects)
      setPagination(records.data.pagination)
      setOptions(lookup.data)
    } catch (reason) {
      setError(toMessage(reason, 'Unable to load projects.'))
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => { void load() })
  }, [load, reload])

  const refresh = useCallback(() => setReload((value) => value + 1), [])

  const archive = useCallback(async (project: ProjectRecord) => {
    if (!window.confirm(`Archive ${project.name}? Existing tasks will not be deleted.`)) return
    const session = resolveTaskSession()
    if (!session) { setError('Your ERP session is unavailable. Please sign in again.'); return }
    try {
      const response = await projectsService.archiveProjectRecord(session, project.id)
      setMessage(response.message)
      refresh()
    } catch (reason) {
      setError(toMessage(reason, 'Unable to archive project.'))
    }
  }, [refresh])

  return {
    projects, options, pagination,
    searchInput, setSearchInput,
    status, setStatus,
    page, setPage,
    loading, error, message, setMessage,
    archive, refresh,
  }
}

/**
 * Ported from `ProjectDrawer`'s load/save state in G2G's
 * `projects-list-view.tsx`. `open`/`projectId` gate the fetch exactly as the
 * source did (nothing loads until the drawer opens).
 */
export function useProjectDetail(projectId: string | null, open: boolean, onChanged: () => void) {
  const [project, setProject] = useState<ProjectRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [taskIds, setTaskIds] = useState<string[]>([])

  const load = useCallback(async () => {
    if (!open || !projectId) return
    const session = resolveTaskSession()
    if (!session) { setError('Your ERP session is unavailable. Please sign in again.'); return }
    setLoading(true)
    setError('')
    try {
      const response = await projectsService.getProjectRecord(session, projectId)
      setProject(response.data)
      setMembers(response.data.members?.map((member) => String(member.id)) ?? [])
      setTaskIds(response.data.task_ids ?? [])
    } catch (reason) {
      setError(toMessage(reason, 'Unable to load project.'))
    } finally {
      setLoading(false)
    }
  }, [open, projectId])

  useEffect(() => {
    // Deferred so the load's first setState lands after this render.
    queueMicrotask(() => { void load() })
  }, [load])

  const requireSession = (): TaskSession | null => {
    const session = resolveTaskSession()
    if (!session) setError('Your ERP session is unavailable. Please sign in again.')
    return session
  }

  const saveMembers = useCallback(async () => {
    if (!project) return
    const session = requireSession()
    if (!session) return
    try {
      const response = await projectsService.syncProjectMembers(session, project.id, members)
      setMessage(response.message)
      await load()
      onChanged()
    } catch (reason) {
      setError(toMessage(reason, 'Unable to update team.'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, members, load, onChanged])

  const saveTasks = useCallback(async () => {
    if (!project) return
    const session = requireSession()
    if (!session) return
    try {
      const response = await projectsService.syncProjectTasks(session, project.id, taskIds)
      setMessage(response.message)
      await load()
      onChanged()
    } catch (reason) {
      setError(toMessage(reason, 'Unable to link tasks.'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, taskIds, load, onChanged])

  const saveWorkstream = useCallback(async (
    payload: Omit<Workstream, 'id' | 'project_id'>,
    editingId: string | null,
  ) => {
    if (!project) return
    const session = requireSession()
    if (!session) return
    try {
      const response = editingId
        ? await projectsService.updateWorkstream(session, project.id, editingId, payload)
        : await projectsService.createWorkstream(session, project.id, payload)
      setMessage(response.message)
      await load()
      onChanged()
    } catch (reason) {
      setError(toMessage(reason, 'Unable to save workstream.'))
      throw reason
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, load, onChanged])

  const removeWorkstream = useCallback(async (item: Workstream) => {
    if (!project || !window.confirm(`Delete workstream ${item.name}?`)) return
    const session = requireSession()
    if (!session) return
    try {
      const response = await projectsService.deleteWorkstream(session, project.id, String(item.id))
      setMessage(response.message)
      await load()
      onChanged()
    } catch (reason) {
      setError(toMessage(reason, 'Unable to delete workstream.'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, load, onChanged])

  return {
    project, loading, error, message,
    members, setMembers, taskIds, setTaskIds,
    saveMembers, saveTasks, saveWorkstream, removeWorkstream,
  }
}
