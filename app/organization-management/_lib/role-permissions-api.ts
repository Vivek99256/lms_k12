'use client';

/**
 * Role & Permissions API client.
 *
 * Ported from G2G's `services/navigation/menu-rights.ts` (`menuRightsService`)
 * - the authoritative service `hooks/use-role-permissions.ts` actually calls
 * (NOT `services/organization/role-permissions.ts`, an unused parallel
 * implementation in G2G).
 *
 * Backend wiring change (explicit product decision, see the migration brief):
 * this does NOT expect a `tblmenumaster_g2g` / `tblgroupwise_rights_g2g`
 * backend. It calls new LMS-K12 endpoints under
 * `/organization-management/role-permissions/...` that a sibling backend
 * effort is wiring to reuse LMS-K12's EXISTING role/rights tables
 * (tbluserprofilemaster, tblgroupwise_rights, tblindividual_rights) while
 * exposing the SAME response shapes `menu-rights.ts` expects:
 *
 *   GET  /organization-management/role-permissions/roles
 *   GET  /organization-management/role-permissions/roles/{id}/rights
 *   POST /organization-management/role-permissions/roles/{id}/rights
 *   POST /organization-management/role-permissions/roles
 *
 * Only the transport changed: native `fetch` + this project's
 * `buildSessionContext()` / `createAuthHeaders()` (see `lib/erp-client.ts`)
 * instead of G2G's `webClient` + `LaravelContext` / `withLaravelParams`.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client';
import type {
  CreateRoleResponse,
  MenuRightPayload,
  MenuRightsResponse,
  RoleProfile,
  RoleProfilesResponse,
  SaveRightsResponse,
} from './organization-types';

export { buildSessionContext };
export type { SessionContext };
export type {
  CreateRoleResponse,
  MenuRightPayload,
  MenuRightsResponse,
  RoleProfile,
  RoleProfilesResponse,
  SaveRightsResponse,
};

// ---------------------------------------------------------------------------
// Low-level transport
// ---------------------------------------------------------------------------

function messageFrom(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const message = (payload as ApiEnvelope).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

async function request<T>(
  session: SessionContext,
  method: 'GET' | 'POST',
  path: string,
  options?: { params?: Record<string, string | undefined>; body?: unknown }
): Promise<T> {
  const search = new URLSearchParams();
  Object.entries(options?.params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, value);
  });

  const url = `${session.baseUrl}/api${path}${search.toString() ? `?${search.toString()}` : ''}`;

  const response = await fetch(url, {
    method,
    cache: 'no-store',
    headers: createAuthHeaders(session, 'application/json'),
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw new Error(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`));
  }

  return payload as T;
}

/** Standard context params, mirroring G2G's `withLaravelParams`. */
function withContextParams(session: SessionContext, extra?: Record<string, string | undefined>) {
  return {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    user_id: session.userId,
    type: 'API',
    ...extra,
  };
}

export function isRolePermissionsSessionReady(session: SessionContext): boolean {
  return Boolean(session.token && session.subInstituteId);
}

// ---------------------------------------------------------------------------
// Service - mirrors G2G's `menuRightsService`
// ---------------------------------------------------------------------------

export const menuRightsService = {
  getRoles: (session: SessionContext) =>
    request<RoleProfilesResponse>(session, 'GET', '/organization-management/role-permissions/roles', {
      params: withContextParams(session),
    }),

  /** `profileId` is the role being edited, which is not the caller's own profile. */
  getRights: (session: SessionContext, profileId: string) =>
    request<MenuRightsResponse>(
      session,
      'GET',
      `/organization-management/role-permissions/roles/${profileId}/rights`,
      { params: withContextParams(session) }
    ),

  saveRights: (session: SessionContext, profileId: string, rights: MenuRightPayload[]) =>
    request<SaveRightsResponse>(
      session,
      'POST',
      `/organization-management/role-permissions/roles/${profileId}/rights`,
      { params: withContextParams(session), body: { rights } }
    ),

  createRole: (session: SessionContext, role: { name: string; description?: string }) =>
    request<CreateRoleResponse>(session, 'POST', '/organization-management/role-permissions/roles', {
      params: withContextParams(session),
      body: { name: role.name, description: role.description ?? '' },
    }),
};
