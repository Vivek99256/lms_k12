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
 * Client for the Transportation dashboard aggregate endpoint.
 *
 * Backend:  next_lms_erp/app/Http/Controllers/api/TransportationDashboardApiController.php
 * Route:    next_lms_erp/routes/api.php → Route::post('transportation-dashboard/summary', ...)
 */
export const TRANSPORTATION_DASHBOARD_SUMMARY_PATH = '/api/transportation/dashboard/summary';

export type TransportationDashboardRequest = {
  sub_institute_id: string | number;
  syear: string | number;
  user_id: string | number;
};

export type TransportationDashboardSummary = {
  total_routes: number;
  total_vehicles: number;
  total_students_mapped: number;
  capacity_utilization: number;
};

export type VanSummaryRow = {
  vehicle_id: number;
  shift_id: number;
  vehicle_name: string;
  shift_title: string;
  student_count: number;
};

export type TransportationDashboardPayload = ApiStatusPayload & {
  context: { sub_institute_id: number; syear: number; generated_at: string };
  summary: TransportationDashboardSummary;
  van_summary: VanSummaryRow[];
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

export async function fetchTransportationDashboardSummary(
  session: FeesSession,
  request: TransportationDashboardRequest,
  signal?: AbortSignal
): Promise<TransportationDashboardPayload> {
  const response = await fetch(TRANSPORTATION_DASHBOARD_SUMMARY_PATH, {
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

  let payload: TransportationDashboardPayload;
  try {
    payload = JSON.parse(text) as TransportationDashboardPayload;
  } catch {
    throw new Error(
      `Transportation dashboard proxy returned a non-JSON response (${response.headers.get('content-type') || 'unknown content type'}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      readString(asRecord(payload).message) || `HTTP ${response.status}: Unable to load the transportation dashboard summary.`
    );
  }

  assertApiSuccess(payload, 'Unable to load the transportation dashboard summary.');

  return payload;
}
