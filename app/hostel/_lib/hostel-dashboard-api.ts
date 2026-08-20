'use client';

import {
  asRecord,
  assertApiSuccess,
  getApiBaseUrl,
  readString,
  type ApiStatusPayload,
  type FeesSession,
} from '@/app/fees/_lib/fees-api';

/**
 * Client for the Hostel dashboard aggregate endpoint.
 *
 * Backend:  next_lms_erp/app/Http/Controllers/api/HostelDashboardApiController.php
 * Route:    next_lms_erp/routes/api.php → Route::post('hostel-dashboard/summary', ...)
 */
export const HOSTEL_DASHBOARD_SUMMARY_PATH = '/api/hostel/dashboard/summary';

export type HostelDashboardRequest = {
  sub_institute_id: string | number;
  syear: string | number;
  user_id: string | number;
};

export type HostelDashboardSummary = {
  total_hostels: number;
  total_rooms: number;
  total_allocations: number;
  occupancy_rate: number;
};

export type HostelCountRow = {
  hostel_id: number;
  hostel_name: string;
  total: number;
};

export type CategoryCountRow = {
  category: string;
  total: number;
};

export type HostelDashboardPayload = ApiStatusPayload & {
  context: { sub_institute_id: number; syear: number; generated_at: string };
  summary: HostelDashboardSummary;
  allocations_by_hostel: HostelCountRow[];
  allocations_by_category: CategoryCountRow[];
};

function buildDashboardProxyHeaders(session: FeesSession) {
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/json');
  headers.set('X-Requested-With', 'XMLHttpRequest');
  headers.set('x-laravel-base-url', getApiBaseUrl(session));
  if (session.token) headers.set('x-laravel-token', session.token);
  if (session.subInstituteId) headers.set('x-sub-institute-id', session.subInstituteId);
  if (session.academicYearId) headers.set('x-academic-year-id', session.academicYearId);
  if (session.userId) headers.set('x-user-id', session.userId);
  return headers;
}

export async function fetchHostelDashboardSummary(
  session: FeesSession,
  request: HostelDashboardRequest,
  signal?: AbortSignal
): Promise<HostelDashboardPayload> {
  const response = await fetch(HOSTEL_DASHBOARD_SUMMARY_PATH, {
    method: 'POST',
    signal,
    headers: buildDashboardProxyHeaders(session),
    cache: 'no-store',
    credentials: 'include',
    body: JSON.stringify({
      type: 'JSON',
      sub_institute_id: request.sub_institute_id,
      syear: request.syear,
      user_id: request.user_id,
    }),
  });

  const text = await response.text();

  let payload: HostelDashboardPayload;
  try {
    payload = JSON.parse(text) as HostelDashboardPayload;
  } catch {
    throw new Error(
      `Hostel dashboard proxy returned a non-JSON response (${response.headers.get('content-type') || 'unknown content type'}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      readString(asRecord(payload).message) || `HTTP ${response.status}: Unable to load the hostel dashboard summary.`
    );
  }

  assertApiSuccess(payload, 'Unable to load the hostel dashboard summary.');

  return payload;
}
