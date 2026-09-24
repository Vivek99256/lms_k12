'use client';

import { asRecord, getApiBaseUrl, readString } from '@/app/fees/_lib/fees-api';
import type { DashboardSession } from '@/app/dashboard/_lib/dashboard-api';

/**
 * Per-user dashboard customisation — which widgets the signed-in user has
 * hidden on one dashboard. Backed by Laravel's
 * UserDashboardPreferenceApiController, which takes the owner from the JWT
 * (never from this request), so one user's choices never change what any
 * other user sees.
 */

export type DashboardWidgetGroup = 'kpi' | 'chart' | 'panel';

export type DashboardWidget = {
  /** Stable id stored server-side, e.g. "kpi.total_staff". Lowercase letters, digits, "." "_" "-". */
  id: string;
  label: string;
  group: DashboardWidgetGroup;
};

/**
 * Builds a storable id from arbitrary parts — use it whenever part of an id
 * comes from data (a backend metric key, a label), e.g.
 * `toWidgetId('kpi', metric.key)` -> "kpi.total-requests". Output matches the
 * server's pattern: lowercase [a-z0-9._-], starting alphanumeric, max 100.
 */
export function toWidgetId(...parts: Array<string | number>): string {
  return parts
    .map((part) =>
      String(part)
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^[-_]+|[-_]+$/g, ''),
    )
    .filter(Boolean)
    .join('.')
    .slice(0, 100);
}

async function requestDashboardPreferences(
  method: 'GET' | 'PUT',
  dashboardKey: string,
  session: DashboardSession,
  body?: { hidden_widgets: string[] },
  signal?: AbortSignal,
): Promise<string[]> {
  const url = new URL(`${getApiBaseUrl(session)}/api/dashboard-preferences/${encodeURIComponent(dashboardKey)}`);
  // Same year/term the dashboards send, so ApiSessionHydrator resolves the
  // session identically for both calls.
  if (session.academicYearId) url.searchParams.set('syear', session.academicYearId);
  if (session.termId) url.searchParams.set('term_id', session.termId);

  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (body) headers.set('Content-Type', 'application/json');
  if (session.token) headers.set('Authorization', `Bearer ${session.token}`);

  // Called directly from the browser, like the admin dashboard summary
  // (see postDashboardDirect) — no cookies, the bearer token is the identity.
  const response = await fetch(url, {
    method,
    signal,
    headers,
    cache: 'no-store',
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload: Record<string, unknown>;
  try {
    payload = asRecord(JSON.parse(text));
  } catch {
    throw new Error(`Dashboard preferences returned a non-JSON response (${response.headers.get('content-type') || 'unknown content type'}).`);
  }

  if (!response.ok) {
    throw new Error(readString(payload.message) || `HTTP ${response.status}: Unable to ${method === 'GET' ? 'load' : 'save'} your dashboard layout.`);
  }

  const hidden = payload.hidden_widgets;
  return Array.isArray(hidden) ? hidden.filter((id): id is string => typeof id === 'string') : [];
}

export function fetchDashboardPreferences(dashboardKey: string, session: DashboardSession, signal?: AbortSignal) {
  return requestDashboardPreferences('GET', dashboardKey, session, undefined, signal);
}

export function saveDashboardPreferences(dashboardKey: string, hiddenWidgets: string[], session: DashboardSession) {
  return requestDashboardPreferences('PUT', dashboardKey, session, { hidden_widgets: hiddenWidgets });
}
