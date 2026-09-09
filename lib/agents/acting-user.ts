import type { ActingUser } from './types';

/**
 * Who is calling, and what Laravel says they may do.
 *
 * SERVER ONLY. Both halves of this file exist so that the engine never has to
 * trust a request body for identity or rights.
 *
 * IDENTITY comes from the same session headers the Fees proxies already forward
 * (see app/api/fees/reports/_lib/fees-report-proxy.ts): the browser sets them
 * from its stored LMS session, the route reads them here, and the run log stores
 * them. There is no "agent" user; a run is always recorded against the person
 * whose token made the request.
 *
 * RIGHTS are asked of Laravel's /api/permissions with that same bearer token —
 * the endpoint app/hooks/usePermission.ts already reads. The hook is advisory
 * (it decides whether a button *looks* available); this call is the enforcement,
 * and it FAILS CLOSED: a missing token, a network error, an unregistered module
 * key or a malformed reply all answer "denied", with the reason kept for the log.
 */

export interface RequestSession extends ActingUser {
  baseUrl: string;
  token: string;
}

function header(request: Request, name: string): string {
  return request.headers.get(name)?.trim() || '';
}

function defaultBaseUrl(): string {
  const production = (process.env.NEXT_PUBLIC_API_BASE_URL_PROD || '').trim().replace(/\/$/, '');
  const development = (process.env.NEXT_PUBLIC_API_BASE_URL_DEV || '').trim().replace(/\/$/, '');
  return process.env.NODE_ENV === 'production' ? production || development : development || production;
}

export function readRequestSession(request: Request): RequestSession {
  return {
    baseUrl: (header(request, 'x-laravel-base-url') || defaultBaseUrl()).replace(/\/$/, ''),
    token: header(request, 'x-laravel-token'),
    tenant_id: header(request, 'x-sub-institute-id'),
    user_id: header(request, 'x-user-id'),
    user_name: header(request, 'x-user-name'),
    profile_id: header(request, 'x-user-profile-id'),
    profile_name: header(request, 'x-user-profile-name'),
  };
}

/** The identity the engine records, stripped of the credentials it must never store. */
export function actingUserOf(session: RequestSession): ActingUser {
  return {
    tenant_id: session.tenant_id,
    user_id: session.user_id,
    user_name: session.user_name,
    profile_id: session.profile_id,
    profile_name: session.profile_name,
  };
}

export type PermissionAction = 'view' | 'create' | 'update' | 'delete';

export interface Authorization {
  allowed: boolean;
  /** Why not, in a sentence the run log and the UI can both show. */
  reason: string | null;
}

export type Authorizer = (moduleKey: string, action: PermissionAction) => Promise<Authorization>;

/**
 * Build the authorizer for one request. Returned as a function so the engine can
 * be handed a stub in tests and a Laravel-backed one in the routes.
 */
export function laravelAuthorizer(session: RequestSession): Authorizer {
  return async (moduleKey, action) => {
    if (!session.token) return { allowed: false, reason: 'Your session has no token. Sign in again.' };
    if (!session.baseUrl) return { allowed: false, reason: 'The LMS API base URL is not configured.' };

    const url = `${session.baseUrl}/api/permissions?modules=${encodeURIComponent(moduleKey)}`;
    let body: Record<string, unknown> | null = null;
    let status = 0;
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${session.token}` },
        cache: 'no-store',
      });
      status = response.status;
      body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    } catch (error) {
      return { allowed: false, reason: `Permission lookup failed: ${error instanceof Error ? error.message : 'network error'}.` };
    }

    if (!body || body.status_code !== 1) {
      const message = typeof body?.message === 'string' ? body.message : `Permission lookup failed (${status}).`;
      return { allowed: false, reason: message };
    }

    const data = (body.data ?? {}) as Record<string, Record<string, unknown>>;
    const flags = data[moduleKey];
    if (!flags || typeof flags !== 'object') {
      return { allowed: false, reason: `No rights are defined for ${moduleKey}. Ask an administrator to register it.` };
    }
    if (flags[action] !== true) {
      return { allowed: false, reason: `Your role does not have ${action} rights for ${moduleKey}.` };
    }
    return { allowed: true, reason: null };
  };
}
