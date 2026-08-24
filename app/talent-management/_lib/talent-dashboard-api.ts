'use client';

/**
 * Talent Dashboard API client.
 *
 * Ported from G2G's `services/talent/dashboard.ts` - backed by
 * GET /api/talent/dashboard and GET /api/talent/dashboard/filters
 * (hp_erp's `App\Http\Controllers\Api\TalentDashboardController`, ported here
 * as `App\Http\Controllers\api\TalentManagement\TalentDashboardController`).
 *
 * Transport adaptation: this is a real `/api/*` REST route behind the
 * `api.session` middleware (JWT validated, tenant hydrated server-side from
 * the token) - the same contract as `app/general/onboarding/_lib/onboarding-api.ts`,
 * which this file's `request()` helper mirrors. G2G's `contextParams()` sent
 * `token`/`sub_institute_id` as query params via `getLaravelContext()` +
 * `withLaravelParams()`; here the token travels as a Bearer header
 * (`createAuthHeaders`) and the tenant is resolved server-side from it, so
 * only `department_id`/`location`/`from`/`to` (plus `syear`) go on the query
 * string. Endpoint paths, field names and response shapes are otherwise kept
 * exactly as in G2G/hp_erp, with one exception: hp_erp's `talentResponse()`
 * returned `meta` as a sibling of `data`; the ported controller's `success()`
 * helper (mirroring `OnboardingApiController`) only has a `{status, message,
 * data}` envelope, so `meta` now arrives nested at `data.meta` - see the
 * doc-comment on `TalentDashboardResponse` in `talent-types.ts`.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  readString,
  type SessionContext,
} from '@/lib/erp-client';
import type {
  TalentDashboardData,
  TalentDashboardFilterData,
  TalentDashboardQuery,
} from './talent-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function requireSession(): SessionContext {
  const session = buildSessionContext();

  if (!session.token) {
    throw new Error('Your session is unavailable. Please sign in again.');
  }

  return session;
}

/** Drop empty filters so the API sees "no filter" rather than an empty string. */
function activeParams(query: TalentDashboardQuery): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => Boolean(value && value !== 'all'))
  ) as Record<string, string>;
}

async function request<T>(
  path: string,
  params: Record<string, string | undefined>,
  parse: (payload: unknown) => T
): Promise<T> {
  const session = requireSession();
  const url = new URL(`${session.baseUrl}/api/talent/${path}`);

  // `api.session` reads the tenant from the token; syear is the one value the
  // caller is allowed to steer, so the year switcher in the header keeps working.
  if (session.syear) url.searchParams.set('syear', session.syear);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  });

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      headers: createAuthHeaders(session, 'application/json'),
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const envelope = record(payload);

  if (!response.ok || String(envelope.status ?? envelope.status_code ?? '') !== '1') {
    throw new Error(
      readString(envelope.message) ||
        (response.status === 401
          ? 'Your session has expired. Sign in again to continue.'
          : `Request failed (${response.status}).`)
    );
  }

  return parse(envelope.data);
}

export const talentDashboardService = {
  /**
   * One aggregate covering recruitment, performance, onboarding, mobility and
   * offboarding - five modules in a single request on page load.
   */
  async getDashboard(query: TalentDashboardQuery = {}): Promise<{
    data: TalentDashboardData;
    meta: { from: string; to: string };
  }> {
    return request('dashboard', activeParams(query), (payload) => {
      const data = record(payload);
      const meta = record(data.meta);

      return {
        data: data as unknown as TalentDashboardData,
        meta: {
          from: readString(meta.from),
          to: readString(meta.to),
        },
      };
    });
  },

  /** Real options for the Department and Location selects. */
  async getFilters(): Promise<TalentDashboardFilterData> {
    return request('dashboard/filters', {}, (payload) => payload as unknown as TalentDashboardFilterData);
  },
};
