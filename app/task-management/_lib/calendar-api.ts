'use client'

/**
 * Task Calendar API client.
 *
 * Ported from G2G's `services/task/index.ts` (`taskService.getWorkspace`,
 * `taskService.getWorkspaceTask`, `taskService.updateTaskSchedule`) — the same
 * `/task-management/workspace` endpoints the Task Calendar screen
 * (`task-calendar-view.tsx`) calls to fetch tasks in a visible date range and
 * to drag/reschedule a task's due date. Endpoint paths, query/body field
 * names and response shapes are preserved exactly as in G2G; only the
 * transport changed to this module's shared `taskApiGet`/`taskApiPut` +
 * `TaskSession` (`_lib/task-session.ts`) instead of G2G's `apiClient` +
 * `LaravelContext`.
 */

import {
  taskApiGet,
  taskApiPut,
  toTaskParams,
  toTaskBody,
  type TaskSession,
} from './task-session'
import type { WorkspaceResponse, WorkspaceScope, WorkspaceTask } from './task-types'

export interface WorkspaceQuery {
  scope?: WorkspaceScope
  search?: string
  status?: string
  priority?: string
  projectId?: string
  assigneeId?: string
  from?: string
  to?: string
  page?: number
  perPage?: number
}

export interface TaskScheduleUpdate {
  planned_start_date?: string
  due_date?: string
  estimated_hours?: number
  remaining_hours?: number
}

export interface TaskScheduleResponse {
  status: 1
  message: string
  data: {
    schedule: {
      task_id: string
      planned_start_date: string | null
      due_date: string | null
      estimated_hours: number | null
      actual_hours: number | null
      remaining_hours: number | null
    }
  }
}

export const calendarService = {
  getWorkspace: (session: TaskSession, params: WorkspaceQuery = {}) =>
    taskApiGet<WorkspaceResponse>(
      session,
      '/task-management/workspace',
      toTaskParams(session, {
        scope: params.scope ?? 'all',
        search: params.search,
        status: params.status,
        priority: params.priority,
        project_id: params.projectId,
        assignee_id: params.assigneeId,
        from: params.from,
        to: params.to,
        page: String(params.page ?? 1),
        per_page: String(params.perPage ?? 50),
      }),
    ),

  getWorkspaceTask: (session: TaskSession, id: string) =>
    taskApiGet<{ status: 1; message: string; data: WorkspaceTask }>(
      session,
      `/task-management/workspace/${id}`,
      toTaskParams(session),
    ),

  /**
   * Move a task's dates without touching the rest of it. Only the keys sent
   * are changed, which is what lets the Calendar reschedule by due date alone.
   */
  updateTaskSchedule: (session: TaskSession, id: string, payload: TaskScheduleUpdate) =>
    taskApiPut<TaskScheduleResponse>(
      session,
      `/task-management/workspace/${id}/schedule`,
      toTaskBody(session, payload),
    ),
}
