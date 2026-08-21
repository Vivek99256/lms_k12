'use client'

/**
 * Task Management > Projects & Workstreams API client.
 *
 * Ported from G2G's `services/task/index.ts` (the project + workstream slice
 * of `taskService` — `getProjectOptions`, `getProjectRecords`,
 * `getProjectRecord`, `createProjectRecord`, `updateProjectRecord`,
 * `archiveProjectRecord`, `syncProjectMembers`, `syncProjectTasks`,
 * `createWorkstream`, `updateWorkstream`, `deleteWorkstream`) against this
 * project's `/task-management/*` Laravel routes. Endpoint paths, HTTP
 * methods and payload shapes are unchanged; only the transport is ported —
 * `taskApiGet/Post/Put/Patch/Delete(session, path, ...)` from
 * `./task-session` instead of G2G's `apiClient` + `LaravelContext`.
 */

import {
  taskApiDelete,
  taskApiGet,
  taskApiPatch,
  taskApiPost,
  taskApiPut,
  toTaskBody,
  toTaskParams,
  type TaskSession,
} from './task-session'
import type {
  ProjectOptions,
  ProjectPayload,
  ProjectRecord,
  ProjectStatus,
  TaskPagination,
  Workstream,
} from './task-types'

export interface ProjectOptionsResponse {
  status: 1
  message: string
  data: ProjectOptions
}

export interface ProjectRecordsResponse {
  status: 1
  message: string
  data: { projects: ProjectRecord[]; pagination: TaskPagination }
}

export interface ProjectRecordResponse {
  status: 1
  message: string
  data: ProjectRecord
}

export interface WorkstreamResponse {
  status: 1
  message: string
  data: Workstream
}

export const projectsService = {
  getProjectOptions: (session: TaskSession) =>
    taskApiGet<ProjectOptionsResponse>(session, '/task-management/projects/options', toTaskParams(session)),

  // `perPage` exists for callers that need the whole list at once, such as a
  // project picker, rather than the 12-per-page project board.
  getProjectRecords: (
    session: TaskSession,
    params: { search?: string; status?: ProjectStatus; page?: number; perPage?: number } = {},
  ) =>
    taskApiGet<ProjectRecordsResponse>(
      session,
      '/task-management/projects',
      toTaskParams(session, {
        search: params.search,
        status: params.status,
        page: String(params.page ?? 1),
        per_page: String(params.perPage ?? 12),
      }),
    ),

  getProjectRecord: (session: TaskSession, id: string) =>
    taskApiGet<ProjectRecordResponse>(session, `/task-management/projects/${id}`, toTaskParams(session)),

  createProjectRecord: (session: TaskSession, payload: ProjectPayload) =>
    taskApiPost<ProjectRecordResponse>(session, '/task-management/projects', toTaskBody(session, payload)),

  updateProjectRecord: (session: TaskSession, id: string, payload: ProjectPayload) =>
    taskApiPut<ProjectRecordResponse>(session, `/task-management/projects/${id}`, toTaskBody(session, payload)),

  archiveProjectRecord: (session: TaskSession, id: string) =>
    taskApiPatch<{ status: 1; message: string }>(
      session,
      `/task-management/projects/${id}/archive`,
      toTaskBody(session),
    ),

  syncProjectMembers: (session: TaskSession, id: string, memberIds: string[]) =>
    taskApiPut<{ status: 1; message: string; data: ProjectRecord['members'] }>(
      session,
      `/task-management/projects/${id}/members`,
      toTaskBody(session, { member_ids: memberIds }),
    ),

  syncProjectTasks: (session: TaskSession, id: string, taskIds: string[]) =>
    taskApiPut<{ status: 1; message: string }>(
      session,
      `/task-management/projects/${id}/tasks`,
      toTaskBody(session, { task_ids: taskIds }),
    ),

  createWorkstream: (session: TaskSession, projectId: string, payload: Omit<Workstream, 'id' | 'project_id'>) =>
    taskApiPost<WorkstreamResponse>(
      session,
      `/task-management/projects/${projectId}/workstreams`,
      toTaskBody(session, payload),
    ),

  updateWorkstream: (
    session: TaskSession,
    projectId: string,
    workstreamId: string,
    payload: Omit<Workstream, 'id' | 'project_id'>,
  ) =>
    taskApiPut<WorkstreamResponse>(
      session,
      `/task-management/projects/${projectId}/workstreams/${workstreamId}`,
      toTaskBody(session, payload),
    ),

  deleteWorkstream: (session: TaskSession, projectId: string, workstreamId: string) =>
    taskApiDelete<{ status: 1; message: string }>(
      session,
      `/task-management/projects/${projectId}/workstreams/${workstreamId}`,
      toTaskParams(session),
    ),
}
