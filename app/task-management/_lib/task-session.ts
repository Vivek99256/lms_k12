'use client'

/**
 * Task Management session + transport helpers.
 *
 * Backed by Laravel's `/task-management/*` module (token + sub_institute_id
 * scoped, JSON envelope `{status, message, data}`), plus a handful of legacy
 * routes the source app still calls directly: `/task` (legacy CRUD via
 * multipart form), `/bulk-task/import`, `/get-employee-tasks`,
 * `/jobrole-task-description`, and `/user-rejected-tasks-courses` (the
 * Task Management -> LMS hand-off). See G2G's `services/task/index.ts` for
 * the endpoint-level detail that a later stage's `task-api.ts` will port
 * against these types.
 *
 * Follows the established port pattern (`app/talent-management/_lib/*-api.ts`,
 * `app/hrit/_lib/payroll-api.ts`): native `fetch` + this project's shared
 * `buildSessionContext()` / `createAuthHeaders()` (`lib/erp-client.ts`)
 * instead of G2G's `apiClient` + `LaravelContext`. Unlike talent-management
 * (whose recruitment/performance/onboarding sub-areas each carry their own
 * local transport helpers because they target different backends), Task
 * Management is one cohesive module against one backend, so its transport
 * helpers are centralised here for the later `task-api.ts` to import once.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client'

export type TaskSession = SessionContext

export { buildSessionContext, createAuthHeaders }
export type { ApiEnvelope, SessionContext }

/** Resolves the current session the same way every other G2G-ported module does. */
export function getTaskSession(): TaskSession {
  return buildSessionContext()
}

/** True once a session has the bare minimum a task-management call needs to not 401. */
export function isTaskSessionReady(session: TaskSession): boolean {
  return Boolean(session.token && session.subInstituteId)
}

function messageFrom(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const message = (payload as ApiEnvelope).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}

/** Laravel replies with {message, errors} on 4xx — mirrors G2G's `ApiError` / the recruitment port's. */
export class TaskApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'TaskApiError'
  }
}

/**
 * Low-level JSON transport. Sends auth headers, parses the response body as
 * JSON (never throws on a non-JSON body — falls back to `{}` so a blank 500
 * page still surfaces a readable error), and throws `TaskApiError` on a
 * non-2xx response.
 */
async function taskRequest<T>(
  session: TaskSession,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options?: {
    params?: Record<string, string | undefined>
    body?: unknown
    form?: FormData
    headers?: Record<string, string>
  },
): Promise<T> {
  const search = new URLSearchParams()
  Object.entries(options?.params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, value)
  })

  const url = `${session.baseUrl}/api${path}${search.toString() ? `?${search.toString()}` : ''}`
  const isForm = Boolean(options?.form)

  const response = await fetch(url, {
    method,
    cache: 'no-store',
    headers: {
      ...createAuthHeaders(session, isForm ? undefined : 'application/json'),
      ...options?.headers,
    },
    body: isForm ? options?.form : options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const payload = (await response.json().catch(() => ({}))) as unknown
  if (!response.ok) {
    const errors =
      payload && typeof payload === 'object' && 'errors' in (payload as Record<string, unknown>)
        ? (payload as { errors?: Record<string, string[]> }).errors
        : undefined
    throw new TaskApiError(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`), response.status, errors)
  }

  return payload as T
}

export const taskApiGet = <T,>(session: TaskSession, path: string, params?: Record<string, string | undefined>) =>
  taskRequest<T>(session, 'GET', path, { params })

export const taskApiPost = <T,>(session: TaskSession, path: string, body?: unknown) =>
  taskRequest<T>(session, 'POST', path, { body })

export const taskApiPut = <T,>(session: TaskSession, path: string, body?: unknown) =>
  taskRequest<T>(session, 'PUT', path, { body })

export const taskApiPatch = <T,>(session: TaskSession, path: string, body?: unknown) =>
  taskRequest<T>(session, 'PATCH', path, { body })

export const taskApiDelete = <T,>(session: TaskSession, path: string, params?: Record<string, string | undefined>) =>
  taskRequest<T>(session, 'DELETE', path, { params })

/** Multipart create — for the legacy `/task`, `/bulk-task/import` form-encoded routes. */
export const taskApiPostForm = <T,>(session: TaskSession, path: string, form: FormData) =>
  taskRequest<T>(session, 'POST', path, { form })

/** Multipart update — spoofed PUT via `_method`, sent as POST (matches G2G's `apiClient.putForm`). */
export const taskApiPutForm = <T,>(session: TaskSession, path: string, form: FormData) => {
  form.set('_method', 'PUT')
  return taskRequest<T>(session, 'POST', path, { form })
}

/**
 * Standard Laravel context params every `/task-management/*` call sends,
 * mirroring G2G's `LaravelContext` (`token`, `sub_institute_id`, `syear`).
 * Drops undefined extras so an unset filter is absent rather than sent as
 * the literal "undefined".
 */
export function withTaskContextParams(
  session: TaskSession,
  extra?: Record<string, string | undefined>,
): Record<string, string> {
  const params: Record<string, string> = {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    user_id: session.userId,
    type: 'API',
  }
  Object.entries(extra ?? {}).forEach(([key, value]) => {
    if (value !== undefined) params[key] = value
  })
  return params
}

/**
 * Query params must be strings. Drops null / undefined / '' so an unset
 * filter is absent rather than sent as the literal "undefined". Always
 * includes the standard context params.
 */
export function toTaskParams(session: TaskSession, input: object = {}): Record<string, string> {
  const merged: Record<string, unknown> = { ...withTaskContextParams(session), ...input }
  const params: Record<string, string> = {}

  for (const [key, value] of Object.entries(merged)) {
    if (value === null || value === undefined || value === '') continue
    params[key] = typeof value === 'string' ? value : String(value)
  }

  return params
}

/** Same trimming for JSON bodies, but `null` is kept — it clears a column. */
export function toTaskBody(session: TaskSession, input: object = {}): Record<string, unknown> {
  const body: Record<string, unknown> = { ...withTaskContextParams(session) }

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue
    body[key] = value
  }

  return body
}

export type ApiStatusPayload = {
  status?: string | number
  status_code?: string | number
  message?: string
}

/** Reads a `{status:1}` / `{status_code:1}` / `{status:"SUCCESS"}` envelope's status as 0 or 1. */
export function readApiStatus(payload: ApiStatusPayload): number {
  const rawStatus = payload.status ?? payload.status_code
  const normalized = String(rawStatus ?? '').toUpperCase()
  const numeric = Number(normalized)

  if (Number.isFinite(numeric) && normalized !== '') return numeric
  if (normalized === 'SUCCESS') return 1

  return normalized === '1' ? 1 : 0
}

/** Throws when a `{status, message}` envelope did not report success. */
export function assertApiSuccess(payload: ApiStatusPayload, fallbackMessage: string) {
  if (payload.status !== undefined || payload.status_code !== undefined) {
    if (readApiStatus(payload) !== 1) {
      throw new Error(payload.message || fallbackMessage)
    }
  }
}

export function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export const TASK_SESSION_ERROR = 'Your session could not be resolved. Please sign in again.'

/** Resolves the current session, or `null` when it cannot authenticate a call. */
export function resolveTaskSession(): TaskSession | null {
  const session = getTaskSession()
  return isTaskSessionReady(session) ? session : null
}
