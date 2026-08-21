'use client'

/**
 * Task Management > Administration API client.
 *
 * Ported from G2G's `services/task/index.ts` — the `getAuditLogs`,
 * `auditLogsExportUrl`, `getPermissionsMatrix`, `getIntegrations`,
 * `getStatusOptions`/`createStatusOption`/`updateStatusOption`/
 * `deleteStatusOption` and `getPriorityOptions`/`createPriorityOption`/
 * `updatePriorityOption`/`deletePriorityOption` slice of `taskService`.
 * Endpoint paths, query/body params and response shapes are kept exactly as
 * in G2G. Only the transport changed: this repo's `taskApiGet/Post/Put/Delete`
 * (`./task-session.ts`, backed by `buildSessionContext()` /
 * `createAuthHeaders()`) instead of G2G's `apiClient` + `LaravelContext`.
 *
 * `auditLogsExportUrl` is not a fetch call in source (it's a CSV download
 * href, built via `buildApiUrl` and handed to a synthetic `<a>` click) — it
 * is ported the same way here, building the URL by the same rule
 * `taskRequest` in `task-session.ts` uses internally
 * (`${session.baseUrl}/api${path}?${query}`).
 */

import {
  taskApiGet,
  taskApiPost,
  taskApiPut,
  taskApiDelete,
  toTaskParams,
  toTaskBody,
  type TaskSession,
} from './task-session'
import type {
  TaskStatus,
  TaskAuditLog,
  TaskPagination,
  PermissionAbility,
  IntegrationStatus,
  TaskStatusOption,
  TaskPriorityOption,
} from './task-types'

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

export interface AuditLogsResponse {
  status: 1
  message: string
  data: { logs: TaskAuditLog[]; pagination: TaskPagination }
}

export function fetchAuditLogs(
  session: TaskSession,
  params: { taskId?: string; event?: string; from?: string; to?: string; page?: number } = {},
): Promise<AuditLogsResponse> {
  return taskApiGet<AuditLogsResponse>(
    session,
    '/task-management/audit-logs',
    toTaskParams(session, {
      task_id: params.taskId,
      event: params.event,
      from: params.from,
      to: params.to,
      page: String(params.page ?? 1),
    }),
  )
}

/** CSV export href — a download, so it has to be a URL, not a fetch. */
export function auditLogsExportUrl(session: TaskSession): string {
  const search = new URLSearchParams(toTaskParams(session))
  return `${session.baseUrl}/api/task-management/audit-logs/export?${search.toString()}`
}

// ---------------------------------------------------------------------------
// Permissions matrix
// ---------------------------------------------------------------------------

export interface PermissionsMatrixResponse {
  status: 1
  message: string
  data: { profiles: string[]; abilities: PermissionAbility[]; note: string }
}

export function fetchPermissionsMatrix(session: TaskSession): Promise<PermissionsMatrixResponse> {
  return taskApiGet<PermissionsMatrixResponse>(session, '/task-management/permissions', toTaskParams(session))
}

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

export interface IntegrationsResponse {
  status: 1
  message: string
  data: { integrations: IntegrationStatus[] }
}

export function fetchIntegrations(session: TaskSession): Promise<IntegrationsResponse> {
  return taskApiGet<IntegrationsResponse>(session, '/task-management/integrations', toTaskParams(session))
}

// ---------------------------------------------------------------------------
// Status options
// ---------------------------------------------------------------------------

export interface StatusOptionsResponse {
  status: 1
  message: string
  data: { statuses: TaskStatusOption[]; categories: TaskStatus[] }
}

export function fetchStatuses(session: TaskSession): Promise<StatusOptionsResponse> {
  return taskApiGet<StatusOptionsResponse>(session, '/task-management/statuses', toTaskParams(session))
}

export function createStatusOption(
  session: TaskSession,
  payload: { name: string; category: TaskStatus; color?: string; sort_order?: number },
): Promise<{ status: 1; message: string; data: { id: string } }> {
  return taskApiPost(session, '/task-management/statuses', toTaskBody(session, payload))
}

export function updateStatusOption(
  session: TaskSession,
  id: string,
  payload: { name: string; category: TaskStatus; color?: string; sort_order?: number; active?: boolean },
): Promise<{ status: 1; message: string }> {
  return taskApiPut(session, `/task-management/statuses/${id}`, toTaskBody(session, payload))
}

export function deleteStatusOption(session: TaskSession, id: string): Promise<{ status: 1; message: string }> {
  return taskApiDelete(session, `/task-management/statuses/${id}`, toTaskParams(session))
}

// ---------------------------------------------------------------------------
// Priority options
// ---------------------------------------------------------------------------

export interface PriorityOptionsResponse {
  status: 1
  message: string
  data: { priorities: TaskPriorityOption[] }
}

export function fetchPriorities(session: TaskSession): Promise<PriorityOptionsResponse> {
  return taskApiGet<PriorityOptionsResponse>(session, '/task-management/priorities', toTaskParams(session))
}

export function createPriorityOption(
  session: TaskSession,
  payload: { name: string; sort_order?: number; sla_hours?: number },
): Promise<{ status: 1; message: string; data: { id: string } }> {
  return taskApiPost(session, '/task-management/priorities', toTaskBody(session, payload))
}

export function updatePriorityOption(
  session: TaskSession,
  id: string,
  payload: { name: string; sort_order?: number; sla_hours?: number; active?: boolean },
): Promise<{ status: 1; message: string }> {
  return taskApiPut(session, `/task-management/priorities/${id}`, toTaskBody(session, payload))
}

export function deletePriorityOption(session: TaskSession, id: string): Promise<{ status: 1; message: string }> {
  return taskApiDelete(session, `/task-management/priorities/${id}`, toTaskParams(session))
}
