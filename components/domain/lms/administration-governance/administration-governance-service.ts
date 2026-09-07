/**
 * Administration & Governance — service.
 *
 * Ported from g2gv0's `services/lms/governance.ts` (`lmsGovernanceService`).
 * Business logic, payload shapes and query params are unchanged; only the
 * transport changed, to match this repo's convention (see
 * components/domain/organization/department-management/organization-service.ts):
 * `buildSessionContext()` + `createAuthHeaders()` from `@/lib/erp-client`
 * instead of g2gv0's `apiClient` + `laravel-context`.
 *
 * Endpoint mapping (g2gv0 → lms_k12), base path dropped, sub-paths kept 1:1:
 *   /lms/governance/kpis              → api/g2g-lms/administration-governance/kpis
 *   /lms/governance/system-health     → .../system-health
 *   /lms/governance/users             → .../users
 *   /lms/governance/users/:id         → .../users/:id
 *   /lms/governance/users/import      → .../users/import
 *   /lms/governance/roles             → .../roles
 *   /lms/governance/roles/:id         → .../roles/:id
 *   /lms/governance/permissions       → .../permissions
 *   /lms/governance/trainers          → .../trainers
 *   /lms/governance/trainers/:id      → .../trainers/:id
 *   /lms/governance/vendors           → .../vendors
 *   /lms/governance/vendors/:id       → .../vendors/:id
 *   /lms/governance/integrations      → .../integrations
 *   /lms/governance/integrations/:id  → .../integrations/:id
 *   /lms/governance/audit-logs        → .../audit-logs
 *
 * The departments filter g2gv0 sourced from `lmsCatalogService.getFilterOptions`
 * has no package-4 equivalent; this repo already has a departments list under
 * Organization (`organizationService.getDepartmentsManagement`), reused here
 * instead of inventing new backend scope.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type SessionContext,
} from '@/lib/erp-client'
import type {
  AuditLog,
  AuditQuery,
  GovernanceKpis,
  GovernancePaginatedResponse,
  GovernanceResponse,
  GovernanceRole,
  GovernanceUser,
  HealthCheck,
  Integration,
  IntegrationPayload,
  PermissionRow,
  PermissionUpdate,
  RolePayload,
  Trainer,
  TrainerPayload,
  UserPayload,
  UserQuery,
  Vendor,
  VendorPayload,
} from './types'

const BASE = '/g2g-lms/administration-governance'

function apiUrl(path: string, session: SessionContext): string {
  const base = session.baseUrl.replace(/\/$/, '')
  return `${base}/api${BASE}${path}`
}

function withAuthParams(session: SessionContext, extra: Record<string, string | undefined> = {}) {
  const params: Record<string, string> = {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    user_id: session.userId,
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== '') params[key] = value
  }
  return params
}

async function apiGet<T>(
  session: SessionContext,
  path: string,
  searchParams?: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(apiUrl(path, session))
  for (const [key, value] of Object.entries(withAuthParams(session, searchParams))) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: createAuthHeaders(session),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`API Error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`)
  }

  return response.json()
}

async function apiSend<T>(
  session: SessionContext,
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(apiUrl(path, session), {
    method,
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: JSON.stringify({ ...withAuthParams(session), ...(body ?? {}) }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`API Error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`)
  }

  return response.json()
}

async function apiPostForm<T>(session: SessionContext, path: string, form: FormData): Promise<T> {
  const response = await fetch(apiUrl(path, session), {
    method: 'POST',
    cache: 'no-store',
    headers: createAuthHeaders(session),
    body: form,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`API Error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`)
  }

  return response.json()
}

/** Drop empty values — the API treats '' as a supplied filter. */
function clean(extra: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(extra).filter(([, value]) => value !== undefined && value !== ''),
  ) as Record<string, string>
}

export const lmsAdministrationGovernanceService = {
  session: buildSessionContext,

  kpis: (session: SessionContext) =>
    apiGet<GovernanceResponse<GovernanceKpis>>(session, '/kpis'),

  systemHealth: (session: SessionContext) =>
    apiGet<GovernanceResponse<HealthCheck[]>>(session, '/system-health'),

  /* Users */

  users: (session: SessionContext, query: UserQuery = {}) =>
    apiGet<GovernancePaginatedResponse<GovernanceUser>>(
      session,
      '/users',
      clean({
        page: String(query.page ?? 1),
        per_page: String(query.perPage ?? 10),
        search: query.search,
        status: query.status,
        profile_id: query.profileId ? String(query.profileId) : undefined,
        department_id: query.departmentId ? String(query.departmentId) : undefined,
        sort_by: query.sortBy ?? 'name',
        sort_dir: query.sortDir ?? 'asc',
      }),
    ),

  createUser: (session: SessionContext, payload: UserPayload) =>
    apiSend<GovernanceResponse<{ id: number }>>(session, 'POST', '/users', { ...payload }),

  updateUser: (session: SessionContext, id: number, payload: UserPayload) =>
    apiSend<GovernanceResponse<null>>(session, 'PUT', `/users/${id}`, { ...payload }),

  /** Soft delete — enrolments, progress and certificates still reference them. */
  deleteUser: (session: SessionContext, id: number) =>
    apiSend<GovernanceResponse<null>>(session, 'DELETE', `/users/${id}`),

  importUsers: (session: SessionContext, file: File, userProfileId: number) => {
    const form = new FormData()
    for (const [key, value] of Object.entries(withAuthParams(session))) form.append(key, value)
    form.append('user_profile_id', String(userProfileId))
    form.append('file', file)
    return apiPostForm<GovernanceResponse<{ imported: number; skipped: number }> & { errors?: string[] }>(
      session,
      '/users/import',
      form,
    )
  },

  /* Roles */

  roles: (session: SessionContext) =>
    apiGet<GovernanceResponse<GovernanceRole[]>>(session, '/roles'),

  createRole: (session: SessionContext, payload: RolePayload) =>
    apiSend<GovernanceResponse<{ id: number }>>(session, 'POST', '/roles', { ...payload }),

  updateRole: (session: SessionContext, id: number, payload: RolePayload) =>
    apiSend<GovernanceResponse<null>>(session, 'PUT', `/roles/${id}`, { ...payload }),

  deleteRole: (session: SessionContext, id: number) =>
    apiSend<GovernanceResponse<null>>(session, 'DELETE', `/roles/${id}`),

  /* Permission matrix */

  permissions: (session: SessionContext, profileId: number) =>
    apiGet<GovernanceResponse<PermissionRow[]>>(session, '/permissions', {
      profile_id: String(profileId),
    }),

  /** Whole-set save, applied in a transaction server-side. */
  savePermissions: (session: SessionContext, profileId: number, permissions: PermissionUpdate[]) =>
    apiSend<GovernanceResponse<{ saved: number }>>(session, 'POST', '/permissions', {
      profile_id: profileId,
      permissions,
    }),

  /* Trainers */

  trainers: (session: SessionContext, search?: string) =>
    apiGet<GovernanceResponse<Trainer[]>>(session, '/trainers', clean({ search })),

  createTrainer: (session: SessionContext, payload: TrainerPayload) =>
    apiSend<GovernanceResponse<Trainer>>(session, 'POST', '/trainers', { ...payload }),

  updateTrainer: (session: SessionContext, id: number, payload: TrainerPayload) =>
    apiSend<GovernanceResponse<Trainer>>(session, 'PUT', `/trainers/${id}`, { ...payload }),

  deleteTrainer: (session: SessionContext, id: number) =>
    apiSend<GovernanceResponse<null>>(session, 'DELETE', `/trainers/${id}`),

  /* Vendors */

  vendors: (session: SessionContext, search?: string) =>
    apiGet<GovernanceResponse<Vendor[]>>(session, '/vendors', clean({ search })),

  createVendor: (session: SessionContext, payload: VendorPayload) =>
    apiSend<GovernanceResponse<Vendor>>(session, 'POST', '/vendors', { ...payload }),

  updateVendor: (session: SessionContext, id: number, payload: VendorPayload) =>
    apiSend<GovernanceResponse<Vendor>>(session, 'PUT', `/vendors/${id}`, { ...payload }),

  deleteVendor: (session: SessionContext, id: number) =>
    apiSend<GovernanceResponse<null>>(session, 'DELETE', `/vendors/${id}`),

  /* Integrations */

  integrations: (session: SessionContext) =>
    apiGet<GovernanceResponse<Integration[]>>(session, '/integrations'),

  createIntegration: (session: SessionContext, payload: IntegrationPayload) =>
    apiSend<GovernanceResponse<Integration>>(session, 'POST', '/integrations', { ...payload }),

  updateIntegration: (session: SessionContext, id: number, payload: IntegrationPayload) =>
    apiSend<GovernanceResponse<Integration>>(session, 'PUT', `/integrations/${id}`, { ...payload }),

  deleteIntegration: (session: SessionContext, id: number) =>
    apiSend<GovernanceResponse<null>>(session, 'DELETE', `/integrations/${id}`),

  /* Audit */

  auditLogs: (session: SessionContext, query: AuditQuery = {}) =>
    apiGet<GovernancePaginatedResponse<AuditLog>>(
      session,
      '/audit-logs',
      clean({
        page: String(query.page ?? 1),
        per_page: String(query.perPage ?? 20),
        search: query.search,
        action: query.action,
        entity_type: query.entityType,
        from: query.from,
        to: query.to,
      }),
    ),
}

export type {
  AuditLog,
  AuditQuery,
  ContractState,
  GovernanceDepartment,
  GovernanceKpis,
  GovernancePaginatedResponse,
  GovernanceResponse,
  GovernanceRole,
  GovernanceUser,
  HealthCheck,
  HealthStatus,
  Integration,
  IntegrationPayload,
  IntegrationStatus,
  PermissionRow,
  PermissionUpdate,
  RolePayload,
  Trainer,
  TrainerPayload,
  TrainerType,
  UserPayload,
  UserQuery,
  Vendor,
  VendorPayload,
} from './types'
