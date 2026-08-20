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
 * Client for the Library dashboard aggregate endpoint.
 *
 * Backend:  next_lms_erp/app/Http/Controllers/api/LibraryDashboardApiController.php
 * Route:    next_lms_erp/routes/api.php → Route::post('library-dashboard/summary', ...)
 */
export const LIBRARY_DASHBOARD_SUMMARY_PATH = '/api/library/dashboard/summary';

export type LibraryDashboardRequest = {
  sub_institute_id: string | number;
  syear: string | number;
  user_id: string | number;
};

export type LibraryDashboardSummary = {
  total_titles: number;
  total_items: number;
  currently_issued: number;
  overdue: number;
};

export type MaterialTypeRow = {
  material_type: string;
  total: number;
};

export type RecentIssueRow = {
  id: number;
  student_name: string;
  book_title: string;
  issued_date: string;
  due_date: string;
  return_date: string | null;
};

export type LibraryDashboardPayload = ApiStatusPayload & {
  context: { sub_institute_id: number; syear: number; generated_at: string };
  summary: LibraryDashboardSummary;
  items_by_material_type: MaterialTypeRow[];
  recent_issues: RecentIssueRow[];
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

export async function fetchLibraryDashboardSummary(
  session: FeesSession,
  request: LibraryDashboardRequest,
  signal?: AbortSignal
): Promise<LibraryDashboardPayload> {
  const response = await fetch(LIBRARY_DASHBOARD_SUMMARY_PATH, {
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

  let payload: LibraryDashboardPayload;
  try {
    payload = JSON.parse(text) as LibraryDashboardPayload;
  } catch {
    throw new Error(
      `Library dashboard proxy returned a non-JSON response (${response.headers.get('content-type') || 'unknown content type'}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      readString(asRecord(payload).message) || `HTTP ${response.status}: Unable to load the library dashboard summary.`
    );
  }

  assertApiSuccess(payload, 'Unable to load the library dashboard summary.');

  return payload;
}
