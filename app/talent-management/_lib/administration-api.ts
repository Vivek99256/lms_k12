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
    throw new Error(messageFrom(payload, "Couldn't complete that request. Try again."))
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

// ---------------------------------------------------------------------------
// Governance (Templates, Permissions, Integrations, Configuration, Audit)
// Backed by AdminGovernanceController - see routes/talent_management.php.
// ---------------------------------------------------------------------------

export interface GovPagination {
  total: number
  per_page: number
  current_page: number
  last_page: number
}

export interface AdminOverview {
  active_workflows: number
  templates: number
  user_roles: number
  integrations: number
  audit_events_30d: number
}

export interface AdminTemplate {
  id: string
  name: string
  category: string
  module: string | null
  status: 'Active' | 'Draft' | 'Archived'
  version: string
  description: string | null
  body: string | null
  lastUpdated: string
}

export interface AdminTemplateInput {
  name: string
  category: string
  module?: string | null
  status?: string
  version?: string
  description?: string | null
  body?: string | null
}

export interface AdminRole {
  id: string
  role: string
  description: string | null
  users: number
  hrAccess: boolean
  areas: Record<string, 'Manage' | 'None'>
}

export interface AdminIntegration {
  id: string
  name: string
  category: string
  status: 'Connected' | 'Disconnected' | 'Error'
  description: string | null
  lastSync: string | null
  lastSyncNote: string | null
  /** oauth = connect on the provider's own site, smtp = mail server form, builtin = always on, unavailable = no connector yet */
  kind: 'oauth' | 'smtp' | 'builtin' | 'unavailable'
  account: string | null
  providerLabel: string | null
  setupRequired: boolean
}

export interface SmtpInput {
  host: string
  port: number
  username: string
  password: string
  encryption: 'tls' | 'ssl' | 'none'
}

/** An API error that kept the server's JSON body, e.g. `setup_required` on Connect. */
export type ApiFailure = Error & {
  payload?: { setup_required?: boolean; can_setup?: boolean; scope?: 'platform' | 'school'; provider?: string; provider_label?: string; redirect_uri?: string; console_url?: string }
}

export interface AdminSetting {
  key: string
  group: string
  label: string
  type: 'number' | 'boolean' | 'select' | 'text'
  options: string[] | null
  help: string
  value: number | boolean | string
  isDefault: boolean
}

export interface AdminAuditEvent {
  id: string
  actor: string
  module: string
  action: string
  entityType: string | null
  entity: string | null
  details: string | null
  when: string
}

interface GovEnvelope<T> {
  status: number
  data: T
  message?: string
  pagination?: GovPagination
  [extra: string]: unknown
}

async function apiSend<T>(
  session: SessionContext,
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown
): Promise<GovEnvelope<T>> {
  const response = await fetch(`${session.baseUrl}/api${path}`, {
    method,
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const payload = (await response.json().catch(() => ({}))) as unknown
  if (!response.ok) {
    const failure: ApiFailure = new Error(messageFrom(payload, "Couldn't complete that request. Try again."))
    failure.payload = payload as ApiFailure['payload']
    throw failure
  }
  return payload as GovEnvelope<T>
}

export const GovernanceService = {
  overview: (s: SessionContext) => apiGet<GovEnvelope<AdminOverview>>(s, '/talent/admin/overview'),

  templates: (s: SessionContext, p?: { page?: number; category?: string; status?: string; search?: string }) =>
    apiGet<GovEnvelope<AdminTemplate[]> & { categories: string[] }>(s, '/talent/admin/templates', {
      page: p?.page ? String(p.page) : undefined,
      category: p?.category,
      status: p?.status,
      search: p?.search,
    }),
  createTemplate: (s: SessionContext, input: AdminTemplateInput) => apiSend<{ id: number }>(s, 'POST', '/talent/admin/templates', input),
  updateTemplate: (s: SessionContext, id: string, input: Partial<AdminTemplateInput>) => apiSend<{ id: number }>(s, 'PUT', `/talent/admin/templates/${id}`, input),
  deleteTemplate: (s: SessionContext, id: string) => apiSend<{ id: number }>(s, 'DELETE', `/talent/admin/templates/${id}`),

  permissions: (s: SessionContext) => apiGet<GovEnvelope<AdminRole[]> & { keywords: string[] }>(s, '/talent/admin/permissions'),

  integrations: (s: SessionContext, category?: string) =>
    apiGet<GovEnvelope<AdminIntegration[]> & { categories: string[] }>(s, '/talent/admin/integrations', { category }),
  /** OAuth providers return `{ url }` to send the browser to; SMTP connects directly. A 422 carries the reason. */
  connectIntegration: (s: SessionContext, id: string, body?: { return_url?: string } & Partial<SmtpInput>) =>
    apiSend<{ url?: string; id?: number }>(s, 'POST', `/talent/admin/integrations/${id}/connect`, body ?? {}),
  /** Super Admin only: register the platform's OAuth app for a provider once, so schools just click Connect. */
  saveOauthApp: (s: SessionContext, provider: string, clientId: string, clientSecret: string) =>
    apiSend<{ provider: string }>(s, 'PUT', `/talent/admin/integrations/oauth-apps/${provider}`, { client_id: clientId, client_secret: clientSecret }),
  /** Creates and removes a throwaway event to prove a connected Google Calendar still works. */
  testIntegration: (s: SessionContext, id: string) => apiSend<{ ok: boolean }>(s, 'POST', `/talent/admin/integrations/${id}/test`),
  disconnectIntegration: (s: SessionContext, id: string) => apiSend<{ id: number }>(s, 'POST', `/talent/admin/integrations/${id}/disconnect`),

  settings: (s: SessionContext) => apiGet<GovEnvelope<AdminSetting[]>>(s, '/talent/admin/settings'),
  saveSettings: (s: SessionContext, values: Record<string, unknown>) =>
    apiSend<{ changed: number }>(s, 'PUT', '/talent/admin/settings', { values }),

  audit: (s: SessionContext, p?: { page?: number; module?: string; action?: string; search?: string }) =>
    apiGet<GovEnvelope<AdminAuditEvent[]> & { summary: Record<string, number>; modules: string[] }>(s, '/talent/admin/audit', {
      page: p?.page ? String(p.page) : undefined,
      module: p?.module,
      action: p?.action,
      search: p?.search,
    }),
}
