'use client'

/**
 * Talent Management "Administration & Governance" API client.
 *
 * Ported from G2G's `services/talent/admin-service.ts` — backed by
 * `App\Http\Controllers\Api\Talent\AdminWorkflowController` in the source
 * Laravel app, registered at `GET /api/talent/admin/workflows`.
 *
 * Endpoint paths, query params and response shapes are kept exactly as in
 * G2G. Only the transport changed: native `fetch` + this project's
 * `buildSessionContext()` / `createAuthHeaders()` (see `lib/erp-client.ts`)
 * instead of G2G's `apiClient` + `LaravelContext` (`getLaravelContext()` /
 * `withLaravelParams()`).
 *
 * G2G's `getWorkflowById` (`GET /talent/admin/workflows/{id}`) is ported too,
 * unchanged, even though the source Laravel route only ever registered
 * `index` — the source frontend calls it exactly like this, so the shape is
 * preserved as-is. See `AdminWorkflowController::show` in the target backend
 * for the same "ported but unrouted" note.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client'
import type {
  AdminWorkflowDetailResponse,
  AdminWorkflowsResponse,
  Workflow,
  WorkflowApprover,
  WorkflowStage,
} from './talent-types'

export { buildSessionContext }
export type { SessionContext }
export type {
  AdminWorkflowDetailResponse,
  AdminWorkflowsResponse,
  Workflow,
  WorkflowApprover,
  WorkflowStage,
}

// ---------------------------------------------------------------------------
// Low-level transport
// ---------------------------------------------------------------------------

function messageFrom(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const message = (payload as ApiEnvelope).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}

async function apiGet<T>(
  session: SessionContext,
  path: string,
  params?: Record<string, string | undefined>
): Promise<T> {
  const search = new URLSearchParams()
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, value)
  })

  const url = `${session.baseUrl}/api${path}${search.toString() ? `?${search.toString()}` : ''}`
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: createAuthHeaders(session),
  })

  const payload = (await response.json().catch(() => ({}))) as unknown
  if (!response.ok) {
    throw new Error(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`))
  }

  return payload as T
}

/** True once a session has the bare minimum an administration call needs to not 401. */
export function isAdministrationSessionReady(session: SessionContext): boolean {
  return Boolean(session.token && session.subInstituteId)
}

// ---------------------------------------------------------------------------
// Service - mirrors G2G's `AdminService`
// ---------------------------------------------------------------------------

export const AdminService = {
  getWorkflows: (
    session: SessionContext,
    params?: { page?: number; module?: string; search?: string }
  ): Promise<AdminWorkflowsResponse> =>
    apiGet(session, '/talent/admin/workflows', {
      page: params?.page !== undefined ? String(params.page) : undefined,
      module: params?.module,
      search: params?.search,
    }),

  getWorkflowById: (session: SessionContext, id: string): Promise<AdminWorkflowDetailResponse> =>
    apiGet(session, `/talent/admin/workflows/${id}`),
}
