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
 * Client for the Admissions dashboard aggregate endpoint.
 *
 * Backend:  next_lms_erp/app/Http/Controllers/api/AdmissionsDashboardApiController.php
 * Route:    next_lms_erp/routes/api.php → Route::post('admissions-dashboard/summary', ...)
 *
 * Same shape as fetchFeesDashboardSummary (app/fees/_lib/fees-dashboard-api.ts):
 * the browser calls this Next.js proxy route rather than Laravel directly, to
 * avoid CORS and keep the Laravel base URL server-side.
 *
 * `getFeesSession`/`FeesSession` (from app/fees/_lib/fees-api.ts) are the
 * shared, module-agnostic session helpers already reused by Students, Library
 * and other non-fees screens — the "fees" prefix is historical, not a scope
 * limit.
 */
export const ADMISSIONS_DASHBOARD_SUMMARY_PATH = '/api/admissions/dashboard/summary';

export type AdmissionsDashboardRequest = {
  sub_institute_id: string | number;
  syear: string | number;
  user_id: string | number;
};

export type AdmissionsDashboardContext = {
  sub_institute_id: number;
  syear: number;
  generated_at: string;
};

export type AdmissionsDashboardSummary = {
  total_enquiries: number;
  total_applications: number;
  total_registrations: number;
  conversion_rate: number;
};

export type StatusCountRow = {
  status: string;
  total: number;
};

export type StandardCountRow = {
  admission_standard: number;
  total: number;
};

export type RecentEnquiryRow = {
  id: number;
  enquiry_no: number;
  student_name: string;
  admission_standard: number | null;
  source_of_enquiry: string | null;
  created_on: string;
};

export type AdmissionsDashboardPayload = ApiStatusPayload & {
  context: AdmissionsDashboardContext;
  summary: AdmissionsDashboardSummary;
  registrations_by_status: StatusCountRow[];
  enquiries_by_standard: StandardCountRow[];
  recent_enquiries: RecentEnquiryRow[];
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

export async function fetchAdmissionsDashboardSummary(
  session: FeesSession,
  request: AdmissionsDashboardRequest,
  signal?: AbortSignal
): Promise<AdmissionsDashboardPayload> {
  const response = await fetch(ADMISSIONS_DASHBOARD_SUMMARY_PATH, {
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

  let payload: AdmissionsDashboardPayload;
  try {
    payload = JSON.parse(text) as AdmissionsDashboardPayload;
  } catch {
    throw new Error(
      `Admissions dashboard proxy returned a non-JSON response (${response.headers.get('content-type') || 'unknown content type'}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      readString(asRecord(payload).message) || `HTTP ${response.status}: Unable to load the admissions dashboard summary.`
    );
  }

  assertApiSuccess(payload, 'Unable to load the admissions dashboard summary.');

  return payload;
}
