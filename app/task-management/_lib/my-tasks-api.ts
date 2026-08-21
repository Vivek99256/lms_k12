'use client'

/**
 * Task Management > My Tasks data layer.
 *
 * Ported from the subset of G2G's `services/task/index.ts` that
 * `my-tasks-view.tsx`, `my-task-details-drawer.tsx` and `create-task-modal.tsx`
 * call: `getMyTasks`, `getMyTask`, `updateMyTaskStatus`, `getDeadlineExtensions`,
 * `requestDeadlineExtension`, `decideDeadlineExtension`, `getStatusOptions`,
 * `getAssignmentUsers`, `getAssignmentDirectory`, `getJobRoleTasks`,
 * `getJobRoleTaskSuggestions`, `getSupervisor`, `getUserSkills`,
 * `getProjectRecords`, `getProjectRecord`, `attachTaskToProject`,
 * `createDependency`, `createLegacyTask`, `updateLegacyTask`,
 * `deleteLegacyTask`, `uploadBulkTasks`, `generateTaskDetails`.
 *
 * Most of these hit Laravel's token/sub_institute_id/syear-scoped
 * `/task-management/*` (and a few `/api`-only legacy) routes via this
 * module's shared `taskApiGet/Post/Put/Patch/Delete(Form)` transport
 * (`_lib/task-session.ts`).
 *
 * A handful of routes are pre-`/task-management` legacy endpoints G2G calls
 * through its bare-host `webClient` instead of its `/api`-prefixed
 * `apiClient` — `/table_data`, `/search_data`, `/getSupervisor`,
 * `/user/add_user/:id/edit`, `/task`, `/gemini_chat`. `taskApiGet/Post/...`
 * always send `${baseUrl}/api${path}`, so those go through the small
 * `legacyGet/legacyPostForm` helpers below instead - a raw `fetch` against
 * `${session.baseUrl}${path}` (no `/api`), the same pattern
 * `app/talent-management/recruitment/components/job-posting-form.tsx` uses
 * for its own `/table_data` calls. `/jobroles-by-department` is registered
 * under Laravel's `/api` group (see `routes/api.php`), and the source app
 * calls it through its `/api`-prefixed client too, so it goes through
 * `taskApiGet`, not `legacyGet`.
 */

import {
  createAuthHeaders,
  TaskApiError,
  taskApiGet,
  taskApiPatch,
  taskApiPost,
  taskApiPostForm,
  taskApiPut,
  toTaskBody,
  toTaskParams,
  type TaskSession,
} from './task-session'
import type {
  DeadlineExtension,
  DependencyType,
  MyTaskDetailResponse,
  MyTaskPriority,
  MyTasksQuery,
  MyTasksResponse,
  ProjectRecord,
  TaskPagination,
  TaskStatus,
  TaskStatusOption,
  WorkspaceResponse,
} from './task-types'

/* ------------------------------------------------------------------ *
 * Legacy (bare-host, non-`/api`) transport
 * ------------------------------------------------------------------ */

function legacyMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const message = (payload as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}

async function legacyGet<T>(session: TaskSession, path: string, params: Record<string, string | undefined>): Promise<T> {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, value)
  })
  const url = `${session.baseUrl}${path}${search.toString() ? `?${search.toString()}` : ''}`
  const response = await fetch(url, { headers: createAuthHeaders(session), cache: 'no-store' })
  const payload = (await response.json().catch(() => ({}))) as unknown
  if (!response.ok) throw new TaskApiError(legacyMessage(payload, `API Error: ${response.status} ${response.statusText}`), response.status)
  return payload as T
}

async function legacyPostForm<T>(session: TaskSession, path: string, form: FormData): Promise<T> {
  const response = await fetch(`${session.baseUrl}${path}`, {
    method: 'POST',
    headers: createAuthHeaders(session),
    body: form,
  })
  const payload = (await response.json().catch(() => ({}))) as unknown
  if (!response.ok) throw new TaskApiError(legacyMessage(payload, `API Error: ${response.status} ${response.statusText}`), response.status)
  return payload as T
}

async function legacyPost<T>(session: TaskSession, path: string, body: unknown): Promise<T> {
  const response = await fetch(`${session.baseUrl}${path}`, {
    method: 'POST',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify(body),
  })
  const payload = (await response.json().catch(() => ({}))) as unknown
  if (!response.ok) throw new TaskApiError(legacyMessage(payload, `API Error: ${response.status} ${response.statusText}`), response.status)
  return payload as T
}

/** `readLaravelSession()?.org_type` in G2G - this repo's `SessionContext` does not carry it. */
function readOrgType(): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = localStorage.getItem('userData') ?? sessionStorage.getItem('userData') ?? '{}'
    const parsed = JSON.parse(raw) as unknown
    const record = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
    return typeof record.org_type === 'string' ? record.org_type : ''
  } catch {
    return ''
  }
}

/* ------------------------------------------------------------------ *
 * Types for the legacy payload shapes (mirrors `services/task/index.ts`)
 * ------------------------------------------------------------------ */

export interface JobRoleTask {
  id: string
  task_title: string
  task_description: string
}

export interface LegacyTaskCreatePayload {
  title: string
  description: string
  assigneeIds: string[]
  observerId: string
  priority: 'High' | 'Medium' | 'Low'
  repeatDays: string
  dueDate: string
  skillIds: string[]
  skillNames: string[]
  kra: string
  kpa: string
  observationPoint: string
  attachment?: File | null
  departmentId?: string
  idempotencyKey?: string
}

export interface LegacyTaskUpdatePayload {
  title: string
  description: string
  assigneeId: string
  observerId: string
  priority: string
  dueDate: string
  status: string
}

export type BulkUploadResult = {
  status_code: string | number
  message: string
  imported?: number
  skipped_count?: number
  skipped_details?: Array<{
    row?: number
    task_title?: string
    assigned_to?: string
    department?: string
    job_role?: string
    reason?: string
  }>
}

export const myTasksApi = {
  getMyTasks: (session: TaskSession, query: MyTasksQuery = {}) =>
    taskApiGet<MyTasksResponse>(
      session,
      '/task-management/my-tasks',
      toTaskParams(session, {
        group: query.group,
        search: query.search,
        status: query.status,
        priority: query.priority,
        page: String(query.page ?? 1),
        per_page: String(query.perPage ?? 20),
      }),
    ),

  getMyTask: (session: TaskSession, id: string) =>
    taskApiGet<MyTaskDetailResponse>(session, `/task-management/my-tasks/${id}`, toTaskParams(session)),

  updateMyTaskStatus: (session: TaskSession, id: string, status: string, remarks: string) =>
    taskApiPatch<{ status: 1; message: string; data: { id: string; status: TaskStatus; status_label: string | null; remarks: string } }>(
      session,
      `/task-management/my-tasks/${id}/status`,
      toTaskBody(session, { status, remarks }),
    ),

  getDeadlineExtensions: (session: TaskSession, taskId: string) =>
    taskApiGet<{ status: 1; message: string; data: { extensions: DeadlineExtension[] } }>(
      session,
      '/task-management/deadline-extensions',
      toTaskParams(session, { task_id: taskId }),
    ),

  requestDeadlineExtension: (session: TaskSession, payload: { taskId: string; requestedDate: string; reason: string }) =>
    taskApiPost<{ status: 1; message: string; data: { id: string } }>(
      session,
      '/task-management/deadline-extensions',
      toTaskBody(session, { task_id: payload.taskId, requested_date: payload.requestedDate, reason: payload.reason }),
    ),

  decideDeadlineExtension: (session: TaskSession, id: string, decision: 'approve' | 'reject', remarks = '') =>
    taskApiPatch<{ status: 1; message: string }>(
      session,
      `/task-management/deadline-extensions/${id}/decision`,
      toTaskBody(session, { decision, remarks }),
    ),

  getStatusOptions: (session: TaskSession) =>
    taskApiGet<{ status: 1; message: string; data: { statuses: TaskStatusOption[]; categories: TaskStatus[] } }>(
      session,
      '/task-management/statuses',
      toTaskParams(session),
    ),

  /** Legacy CRUD (the drawer's edit/reassign, and My Tasks' create flow). */
  updateLegacyTask: (session: TaskSession, id: string, payload: LegacyTaskUpdatePayload) => {
    const form = new FormData()
    form.append('task_title', payload.title)
    form.append('task_description', payload.description)
    form.append('TASK_ALLOCATED_TO', payload.assigneeId)
    form.append('manageby', payload.observerId)
    form.append('selType', payload.priority)
    form.append('TASK_DATE', payload.dueDate)
    form.append('status', payload.status)
    form.set('_method', 'PUT')
    const query = new URLSearchParams(toTaskParams(session)).toString()
    return legacyPostForm<{ status_code: string | number; message: string }>(session, `/task/${id}?${query}`, form)
  },

  deleteLegacyTask: (session: TaskSession, id: string) => {
    const params = toTaskParams(session)
    const query = new URLSearchParams(params).toString()
    return fetch(`${session.baseUrl}/task/${id}?${query}`, { method: 'DELETE', headers: createAuthHeaders(session) })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as { status_code: string | number; message: string }
        if (!response.ok) throw new TaskApiError(legacyMessage(payload, `API Error: ${response.status}`), response.status)
        return payload
      })
  },

  createLegacyTask: (session: TaskSession, payload: LegacyTaskCreatePayload) => {
    const form = new FormData()
    const allocatedTo = payload.assigneeIds.length ? payload.assigneeIds.join(',') : (payload.departmentId ?? '')
    form.append('TASK_ALLOCATED_TO', allocatedTo)
    form.append('task_title', payload.title)
    form.append('task_description', payload.description)
    form.append('skill_id', payload.skillIds.join(','))
    form.append('skills', payload.skillNames.join(','))
    form.append('manageby', payload.observerId)
    form.append('observation_point', payload.observationPoint)
    form.append('KRA', payload.kra)
    form.append('KPA', payload.kpa)
    form.append('selType', payload.priority)
    form.append('repeat_days', payload.repeatDays)
    form.append('repeat_until', payload.dueDate)
    if (payload.attachment) form.append('TASK_ATTACHMENT', payload.attachment)
    if (payload.idempotencyKey) form.append('idempotency_key', payload.idempotencyKey)
    const query = new URLSearchParams({
      type: 'API',
      token: session.token,
      sub_institute_id: session.subInstituteId,
      syear: session.syear,
      user_id: session.userId,
      formType: 'multiUser',
    }).toString()
    return legacyPostForm<{
      status_code?: string | number
      message: string
      task_id?: string | number
      taskId?: string | number
      id?: string | number
      task_ids?: Array<string | number>
      replayed?: boolean
      data?: { task_id?: string | number; taskId?: string | number; id?: string | number }
    }>(session, `/task?${query}`, form)
  },

  uploadBulkTasks: (session: TaskSession, file: File) => {
    const form = new FormData()
    form.append('csv_file', file)
    // Required by `BulkTaskController::import` (`if ($request->input('formType')
    // !== 'BulkTask') { ... }`) - G2G's `services/task/index.ts` always sends
    // it too; dropped during the initial port, which made every bulk upload
    // fail with "Invalid formType. Use BulkTask".
    form.append('formType', 'BulkTask')
    return taskApiPostForm<BulkUploadResult>(session, '/bulk-task/import', form)
  },

  generateTaskDetails: (session: TaskSession, prompt: string) =>
    legacyPost<
      Array<{
        task_description?: string
        repeat_once_in_every?: string
        repeat_until_date?: string
        observation_point?: string
        kras?: string
        kpis?: string
        task_type?: 'High' | 'Medium' | 'Low'
        skill_required?: string[]
      }>
    >(session, '/gemini_chat', { prompt }),

  /** Legacy assignment lookups (job roles by department, active users). */
  getAssignmentDirectory: (session: TaskSession) =>
    taskApiGet<{
      data?: Record<
        string,
        Array<{
          id: number | string
          jobrole: string
          department_id: number | string
          employees?: Array<{ id: number | string; first_name: string; middle_name?: string; last_name?: string }>
        }>
      >
    }>(session, '/jobroles-by-department', { sub_institute_id: session.subInstituteId }),

  getAssignmentUsers: (session: TaskSession) =>
    legacyGet<
      Array<{
        id: number | string
        first_name: string
        middle_name?: string
        last_name?: string
        department_id?: number | string
        allocated_standards?: number | string
      }>
    >(session, '/table_data', {
      table: 'tbluser',
      'filters[status]': '1',
      'filters[sub_institute_id]': session.subInstituteId,
      token: session.token,
    }),

  getSupervisor: (session: TaskSession, userId: string) =>
    legacyGet<{ status_code: number; message: string; data?: { id: number | string; name: string } }>(session, '/getSupervisor', {
      user_id: userId,
      sub_institute_id: session.subInstituteId,
    }),

  getUserSkills: (session: TaskSession, userId: string) =>
    taskApiGet<{ data?: Array<{ id?: number; skill_id?: number; name?: string; skill?: string; skill_name?: string }> }>(
      session,
      `/user-skills/${userId}`,
      toTaskParams(session),
    ),

  getJobRoleTaskSuggestions: (session: TaskSession, userId: string) =>
    legacyGet<{ jobroleTasks?: Array<{ task?: string; task_title?: string }> }>(session, `/user/add_user/${userId}/edit`, {
      type: 'API',
      token: session.token,
      sub_institute_id: session.subInstituteId,
      org_type: readOrgType(),
      syear: session.syear,
    }),

  /**
   * The catalogue tasks defined for one job role, keyed by role NAME (not
   * id) - `s_user_jobrole_task.jobrole` stores the role's name.
   */
  getJobRoleTasks: async (session: TaskSession, jobRoleName: string): Promise<{ status: number; message: string; data: JobRoleTask[] }> => {
    const payload = await legacyGet<unknown>(session, '/table_data', {
      table: 's_user_jobrole_task',
      'filters[jobrole]': jobRoleName,
      token: session.token,
    })
    const records: Array<Record<string, unknown>> = Array.isArray(payload) ? payload : []
    const data = records
      .filter((record) => record.task != null)
      .map((record) => ({ id: String(record.id ?? ''), task_title: String(record.task ?? ''), task_description: '' }))
    return { status: 200, message: 'OK', data }
  },

  /** Best-effort: promotes a typed title into the role's task-catalogue library. */
  saveJobRoleTaskToLibrary: (session: TaskSession, payload: { task: string; jobrole: string; task_type: string }) =>
    taskApiPost<{ status: number; message: string }>(session, '/competency/library/jobrole-tasks', toTaskBody(session, payload)),

  /* Project delivery: optional project/workstream/dependency linking from
     the create flow. */
  getProjectRecords: (session: TaskSession, params: { search?: string; perPage?: number } = {}) =>
    taskApiGet<{ status: 1; message: string; data: { projects: ProjectRecord[]; pagination: TaskPagination } }>(
      session,
      '/task-management/projects',
      toTaskParams(session, { search: params.search, per_page: String(params.perPage ?? 100) }),
    ),

  getProjectRecord: (session: TaskSession, id: string) =>
    taskApiGet<{ status: 1; message: string; data: ProjectRecord }>(session, `/task-management/projects/${id}`, toTaskParams(session)),

  attachTaskToProject: (session: TaskSession, projectId: string, taskId: string, workstreamId?: string) =>
    taskApiPost<{ status: 1; message: string; data: { project_id: string; task_id: string; workstream_id: string | null } }>(
      session,
      `/task-management/projects/${projectId}/tasks`,
      toTaskBody(session, { task_id: taskId, workstream_id: workstreamId }),
    ),

  createDependency: (
    session: TaskSession,
    payload: {
      predecessor_task_id: string
      successor_task_id: string
      dependency_type: DependencyType
      lag_days: number
      notes?: string
      project_id?: string
      workstream_id?: string
    },
  ) => taskApiPost<{ status: 1; message: string; data: { id: string } }>(session, '/task-management/dependencies', toTaskBody(session, payload)),

  /** Used by the create flow to list a project's current tasks (for "Waits for"). */
  getWorkspace: (session: TaskSession, params: { perPage?: number } = {}) =>
    taskApiGet<WorkspaceResponse>(session, '/task-management/workspace', toTaskParams(session, { scope: 'all', per_page: String(params.perPage ?? 100) })),

  /** Legacy update, kept for parity with `updateLegacyTask` above (task edit form). */
  updateWorkspaceTask: (
    session: TaskSession,
    id: string,
    payload: { title: string; description?: string; assignee_id: string; owner_id: string; status: TaskStatus; priority: MyTaskPriority; due_date?: string; remarks?: string },
  ) => taskApiPut<{ status: 1; message: string }>(session, `/task-management/workspace/${id}`, toTaskBody(session, payload)),
}
