'use client'

/**
 * Task Management > Dependencies & Workstreams API client.
 *
 * Ported from G2G's `services/task/index.ts` (the dependency + workstream
 * slice of `taskService` — `getDependencies`, `createDependency`,
 * `deleteDependency`, and `getWorkstreams`, which G2G derives from
 * `getProjectRecord(...).data.workstreams`) against this project's
 * `/task-management/*` Laravel routes. Endpoint paths, HTTP methods and
 * payload shapes are unchanged; only the transport is ported —
 * `taskApiGet/Post/Delete(session, path, ...)` from `./task-session` instead
 * of G2G's `apiClient` + `LaravelContext`.
 */

import { taskApiDelete, taskApiGet, taskApiPost, toTaskBody, toTaskParams, type TaskSession } from './task-session'
import type { DependenciesResponse, DependencyType, TaskStatus, Workstream } from './task-types'
import { projectsService } from './projects-api'

export const dependenciesService = {
  getDependencies: (
    session: TaskSession,
    params: { projectId?: string; assigneeId?: string; status?: TaskStatus } = {},
  ) =>
    taskApiGet<DependenciesResponse>(
      session,
      '/task-management/dependencies',
      toTaskParams(session, {
        project_id: params.projectId,
        assignee_id: params.assigneeId,
        status: params.status,
      }),
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
  ) =>
    taskApiPost<{ status: 1; message: string; data: { id: string } }>(
      session,
      '/task-management/dependencies',
      toTaskBody(session, payload),
    ),

  deleteDependency: (session: TaskSession, id: string) =>
    taskApiDelete<{ status: 1; message: string }>(session, `/task-management/dependencies/${id}`, toTaskParams(session)),

  /** A project's workstreams, read off its full record — same derivation G2G uses. */
  getWorkstreams: (session: TaskSession, projectId: string) =>
    projectsService.getProjectRecord(session, projectId).then((response) => ({
      ...response,
      data: (response.data.workstreams ?? []) as Workstream[],
    })),
}
