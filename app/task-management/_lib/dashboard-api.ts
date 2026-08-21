'use client'

/**
 * Task Management > Dashboard data layer.
 *
 * Ported from the subset of G2G's `services/task/index.ts` that
 * `components/domain/task/task-workspace.tsx` calls: `getWorkspace`,
 * `decideWorkspaceTask`, `archiveWorkspaceTask`. All three hit Laravel's
 * `/task-management/workspace*` routes (token + sub_institute_id + syear
 * scoped, `{status, message, data}` envelope) via this module's shared
 * `taskApiGet/Patch/Delete` transport (`_lib/task-session.ts`) instead of
 * G2G's `apiClient` + `LaravelContext`.
 */

import {
  taskApiDelete,
  taskApiGet,
  taskApiPatch,
  toTaskBody,
  toTaskParams,
  type TaskSession,
} from './task-session'
import type { WorkspaceResponse, WorkspaceScope } from './task-types'

export interface WorkspaceQuery {
  scope?: WorkspaceScope
  search?: string
  /** A system category or a tenant's custom status label. */
  status?: string
  priority?: string
  projectId?: string
  assigneeId?: string
  from?: string
  to?: string
  page?: number
  perPage?: number
}

export const dashboardApi = {
  getWorkspace: (session: TaskSession, query: WorkspaceQuery = {}) =>
    taskApiGet<WorkspaceResponse>(
      session,
      '/task-management/workspace',
      toTaskParams(session, {
        scope: query.scope ?? 'all',
        search: query.search,
        status: query.status,
        priority: query.priority,
        project_id: query.projectId,
        assignee_id: query.assigneeId,
        from: query.from,
        to: query.to,
        page: String(query.page ?? 1),
        per_page: String(query.perPage ?? 25),
      }),
    ),

  decideWorkspaceTask: (session: TaskSession, id: string, decision: 'approve' | 'reject', remarks = '') =>
    taskApiPatch<{ status: 1; message: string }>(
      session,
      `/task-management/workspace/${id}/approval`,
      toTaskBody(session, { decision, remarks }),
    ),

  archiveWorkspaceTask: (session: TaskSession, id: string) =>
    taskApiDelete<{ status: 1; message: string }>(
      session,
      `/task-management/workspace/${id}`,
      toTaskParams(session),
    ),
}
