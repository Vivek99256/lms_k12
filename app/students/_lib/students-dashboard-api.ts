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
 * Client for the Students dashboard aggregate endpoint.
 *
 * Backend:  next_lms_erp/app/Http/Controllers/api/StudentsDashboardApiController.php
 * Route:    next_lms_erp/routes/api.php → Route::post('students-dashboard/summary', ...)
 *
 * Same shape as fetchFeesDashboardSummary (app/fees/_lib/fees-dashboard-api.ts).
 */
export const STUDENTS_DASHBOARD_SUMMARY_PATH = '/api/students/dashboard/summary';

export type StudentsDashboardRequest = {
  sub_institute_id: string | number;
  syear: string | number;
  user_id: string | number;
};

export type StudentsDashboardContext = {
  sub_institute_id: number;
  syear: number;
  generated_at: string;
};

export type StudentsDashboardSummary = {
  total_students: number;
  inactive_this_year: number;
  total_classes: number;
};

export type GenderCountRow = {
  gender: string;
  total: number;
};

export type DropReasonRow = {
  reason: string;
  total: number;
};

export type StudentsByClassRow = {
  standard_id: number;
  standard_name: string;
  students: number;
};

export type RecentEnrollmentRow = {
  student_id: number;
  student_name: string;
  standard_name: string;
  division_name: string | null;
  created_on: string;
};

export type StudentsDashboardPayload = ApiStatusPayload & {
  context: StudentsDashboardContext;
  summary: StudentsDashboardSummary;
  gender_breakdown: GenderCountRow[];
  drop_reasons: DropReasonRow[];
  students_by_class: StudentsByClassRow[];
  recent_enrollments: RecentEnrollmentRow[];
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

export async function fetchStudentsDashboardSummary(
  session: FeesSession,
  request: StudentsDashboardRequest,
  signal?: AbortSignal
): Promise<StudentsDashboardPayload> {
  const response = await fetch(STUDENTS_DASHBOARD_SUMMARY_PATH, {
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

  let payload: StudentsDashboardPayload;
  try {
    payload = JSON.parse(text) as StudentsDashboardPayload;
  } catch {
    throw new Error(
      `Students dashboard proxy returned a non-JSON response (${response.headers.get('content-type') || 'unknown content type'}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      readString(asRecord(payload).message) || `HTTP ${response.status}: Unable to load the students dashboard summary.`
    );
  }

  assertApiSuccess(payload, 'Unable to load the students dashboard summary.');

  return payload;
}
