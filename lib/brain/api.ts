'use client';

import { API_BASE_URL } from '@/app/components/utils/api_url';

/**
 * Where the Enterprise Brain API lives.
 *
 * THIS IS NOT ALWAYS THE LMS API HOST, AND THAT IS THE POINT. The LMS front end
 * talks to whichever deployment NEXT_PUBLIC_API_BASE_URL_DEV names, and the
 * Brain route table (`/api/brain/*`, mounted by next_lms_erp's
 * RouteServiceProvider) only exists where the Brain backend has been deployed.
 * Pointing Brain requests at a host without those routes is what produced
 * "Brain request failed 404" — the LMS host answered, it simply had no such
 * route. NEXT_PUBLIC_BRAIN_API_BASE_URL names the host that does; it falls back
 * to the LMS host for deployments where the two are the same.
 */
export const BRAIN_API_BASE_URL: string =
  (process.env.NEXT_PUBLIC_BRAIN_API_BASE_URL || '').trim().replace(/\/$/, '') || API_BASE_URL;

export interface BrainSession {
  tenantId: string;
  token: string;
  userId: string;
}

export class BrainApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly payload: unknown;

  constructor(message: string, status: number, url: string, payload: unknown) {
    super(message);
    this.name = 'BrainApiError';
    this.status = status;
    this.url = url;
    this.payload = payload;
  }
}

/** The Brain has no login of its own: it reuses the LMS session verbatim. */
export function getBrainSession(): BrainSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}');
    const token = String(userData.user_token || userData.token || '');
    const tenantId = String(userData.sub_institute_id ?? menuContext.sub_institute_id ?? '');
    const userId = String(userData.id ?? menuContext.user_id ?? '');

    if (!token || !tenantId) return null;
    return { token, tenantId, userId };
  } catch {
    return null;
  }
}

export function getBrainTenantId(): string {
  return getBrainSession()?.tenantId ?? '';
}

export async function brainFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getBrainSession();
  if (!session) {
    throw new BrainApiError('Brain session is unavailable. Please sign in again.', 401, path, null);
  }

  const url = `${BRAIN_API_BASE_URL}/api/brain${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
        ...(init?.headers || {}),
      },
    });
  } catch (cause) {
    throw new BrainApiError(
      `Could not reach the Brain API at ${BRAIN_API_BASE_URL}. ${cause instanceof Error ? cause.message : ''}`.trim(),
      0,
      url,
      null,
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as Record<string, unknown>)?.message ?? (data as Record<string, unknown>)?.error;
    throw new BrainApiError(
      typeof detail === 'string' ? describe(detail, res.status, url) : `Brain request failed with ${res.status} (${url})`,
      res.status,
      url,
      data,
    );
  }

  return data as T;
}

/** Turns the API's machine codes into something an administrator can act on. */
function describe(code: string, status: number, url: string): string {
  switch (code) {
    case 'brain_unauthenticated':
      return 'Not signed in to the Brain — the LMS session carried no token.';
    case 'brain_invalid_token':
      return `The LMS session token was rejected by the Brain API at ${BRAIN_API_BASE_URL}. Its JWT secret must match the host that issued this login.`;
    case 'brain_token_expired':
      return 'The LMS session has expired. Please sign in again.';
    case 'brain_tenant_mismatch':
      return 'This Brain workspace belongs to another organization.';
    case 'brain_forbidden':
      return 'Your LMS role does not grant this Brain permission.';
    case 'brain_schema_missing':
      return 'The Brain store for this screen has not been provisioned in this database.';
    default:
      return `${code} (${status} — ${url})`;
  }
}

/** Prefixes a Brain path with the tenant taken from the LMS session. */
export function tenantPath(path: string) {
  const session = getBrainSession();
  if (!session) throw new BrainApiError('Brain session is unavailable. Please sign in again.', 401, path, null);
  return `/${session.tenantId}${path}`;
}

export function withQuery(path: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/* ------------------------------------------------------------------ shapes */

export type BrainRow = Record<string, unknown>;

export interface BrainMetric {
  key: string;
  label: string;
  value: number;
  available: boolean;
  table?: string;
}

export interface BrainPanel {
  key: string;
  title: string;
  table: string;
  available: boolean;
  count: number;
  columns: Array<{ key: string; label: string }>;
  rows: BrainRow[];
}

export interface BrainBreakdown {
  key: string;
  title: string;
  available: boolean;
  data: Array<{ label: string; value: number }>;
}

export interface BrainSeries {
  key: string;
  title: string;
  available: boolean;
  points: Array<{ label: string; value: number; at: string }>;
}

export interface BrainScreenPayload {
  screen: string;
  title: string;
  section: string;
  sectionLabel: string;
  description: string;
  tenantId: string;
  metrics: BrainMetric[];
  panels: BrainPanel[];
  breakdowns: BrainBreakdown[];
  series: BrainSeries[];
}

export interface BrainSectionPayload {
  section: string;
  label: string;
  tenantId: string;
  screens: Array<{ key: string; title: string; description: string; metrics: BrainMetric[] }>;
}

export function fetchScreen(screen: string, search?: string) {
  return brainFetch<BrainScreenPayload>(withQuery(tenantPath(`/screens/${screen}`), { q: search }));
}

export function fetchSection(section: string) {
  return brainFetch<BrainSectionPayload>(tenantPath(`/sections/${section}`));
}
