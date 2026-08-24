'use client';

/**
 * Competency Command Center API client.
 *
 * Ported from G2G's `services/competency/command-center.ts` — backed by the
 * Laravel `/api/competency/*` endpoints:
 *   GET  /competency/command-center          - full dashboard payload
 *   GET  /competency/command-center/filters  - the five filter dropdowns
 *   POST /competency/{competencies|frameworks|assessments|certifications|development-plans|role-map}
 *        - Quick Create dialog targets
 *
 * This is an EXACT as-is migration: endpoint paths, HTTP methods, query/body
 * field names and response shapes are preserved exactly as in G2G, per the
 * same rule already applied to `certifications-api.ts`. Only the transport
 * changed: native `fetch` + this project's `buildSessionContext()` /
 * `createAuthHeaders()` (see `lib/erp-client.ts`) instead of G2G's
 * `apiClient` + `LaravelContext`.
 *
 * Confirmed live per the migration brief: `GET /competency/command-center`
 * and `GET /competency/command-center/filters`. The Quick Create dialog's
 * POST targets (`/competency/competencies`, `/competency/frameworks`,
 * `/competency/assessments`, `/competency/development-plans`,
 * `/competency/role-map`) were NOT separately confirmed for this migration —
 * `/competency/certifications` is confirmed elsewhere (see
 * `talent-management/_lib/certifications-api.ts`). Ported unchanged per the
 * verbatim-port instruction; flagged in the migration report.
 *
 * TS types are kept inline here (rather than a shared types file), matching
 * `certifications-api.ts` convention.
 */

import {
  buildSessionContext,
  createAuthHeaders,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client';

export { buildSessionContext };
export type { SessionContext };

// ---------------------------------------------------------------------------
// Low-level transport (copied verbatim from certifications-api.ts)
// ---------------------------------------------------------------------------

/** Laravel replies with {message, errors} on 4xx — mirrors G2G's `ApiError`. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function messageFrom(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const message = (payload as ApiEnvelope).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

async function request<T>(
  session: SessionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options?: { params?: Record<string, string | undefined>; body?: unknown },
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
    const errors = payload && typeof payload === 'object' && 'errors' in (payload as Record<string, unknown>)
      ? (payload as { errors?: Record<string, string[]> }).errors
      : undefined;
    throw new ApiError(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`), response.status, errors);
  }

  return payload as T;
}

const apiGet = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'GET', path, { params });
const apiPost = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'POST', path, { body });

/**
 * Standard Laravel context params, mirroring G2G's `withLaravelParams`.
 * Adaptation from G2G: `withLaravelParams` also sent `organization_id`,
 * `org_type` and `profile_id`, sourced from G2G's richer `LaravelContext`.
 * This repo's `SessionContext` carries no equivalent fields, so those three
 * are omitted here — same adaptation as `certifications-api.ts`.
 */
function contextParams(session: SessionContext, extra?: Record<string, string | undefined>): Record<string, string> {
  const params: Record<string, string> = {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    financial_year: session.syear,
    user_id: session.userId,
    type: 'API',
  };
  Object.entries(extra ?? {}).forEach(([key, value]) => {
    if (value !== undefined) params[key] = value;
  });
  return params;
}

/** Drops 'all' / '0' / empty so Laravel's filled() checks skip the param. */
function competencyFilter(value?: string | null) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized === '' || normalized === '0' || normalized === 'all' ? undefined : normalized;
}

function optionalParam(key: string, value?: string | null): Record<string, string> {
  const normalized = competencyFilter(value);
  return normalized ? { [key]: normalized } : {};
}

// ---------------------------------------------------------------------------
// Types (ported from G2G's services/competency/command-center.ts)
// ---------------------------------------------------------------------------

/** Every /api/competency/* endpoint replies with this envelope. */
export interface CompetencyApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

export interface CommandCenterSummaryTile {
  key: string;
  label: string;
  value: number;
  desc: string;
  total?: number;
}

export interface CommandCenterProgressRing {
  key: string;
  title: string;
  percent: number;
  current: number;
  total: number;
  sub: string;
}

export interface CommandCenterWorkQueue {
  key: string;
  label: string;
  count: number;
}

export interface CommandCenterActivity {
  id: number;
  user: string;
  action: string;
  time: string;
  timestamp: string | null;
}

export interface CommandCenterCycle {
  id: number;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  range_label: string | null;
}

export interface CommandCenterCalendar {
  cycle: CommandCenterCycle | null;
  upcoming_count: number;
}

export interface CommandCenterData {
  summary: CommandCenterSummaryTile[];
  progress: CommandCenterProgressRing[];
  work_queues: CommandCenterWorkQueue[];
  recent_activity: CommandCenterActivity[];
  assessment_calendar: CommandCenterCalendar;
}

export interface CompetencyFilterOption {
  value: string;
  label: string;
}

export interface CompetencyFilterOptions {
  departments: CompetencyFilterOption[];
  jobroles: CompetencyFilterOption[];
  locations: CompetencyFilterOption[];
  business_units: CompetencyFilterOption[];
  job_families: CompetencyFilterOption[];
}

export interface CompetencyFilters {
  department_id?: string;
  jobrole?: string;
  location?: string;
  business_unit?: string;
  job_family?: string;
}

export type QuickCreateKind =
  | 'competency'
  | 'framework'
  | 'assessment'
  | 'certification'
  | 'development-plan'
  /** M-03: role→competency requirements. */
  | 'role-map';

export interface CreateResult {
  id: number;
}

function filterParams(filters?: CompetencyFilters): Record<string, string> {
  if (!filters) return {};
  return {
    ...optionalParam('department_id', filters.department_id),
    ...optionalParam('jobrole', filters.jobrole),
    ...optionalParam('location', filters.location),
    ...optionalParam('business_unit', filters.business_unit),
    ...optionalParam('job_family', filters.job_family),
  };
}

const CREATE_ENDPOINTS: Record<QuickCreateKind, string> = {
  competency: '/competency/competencies',
  'role-map': '/competency/role-map',
  framework: '/competency/frameworks',
  assessment: '/competency/assessments',
  certification: '/competency/certifications',
  'development-plan': '/competency/development-plans',
};

export const competencyCommandCenterService = {
  getCommandCenter: (session: SessionContext, filters?: CompetencyFilters) =>
    apiGet<CompetencyApiResponse<CommandCenterData>>(
      session,
      '/competency/command-center',
      contextParams(session, filterParams(filters)),
    ),

  getFilters: (session: SessionContext) =>
    apiGet<CompetencyApiResponse<CompetencyFilterOptions>>(
      session,
      '/competency/command-center/filters',
      contextParams(session),
    ),

  create: (session: SessionContext, kind: QuickCreateKind, payload: Record<string, unknown>) =>
    apiPost<CompetencyApiResponse<CreateResult>>(session, CREATE_ENDPOINTS[kind], {
      ...contextParams(session),
      ...payload,
    }),
};
