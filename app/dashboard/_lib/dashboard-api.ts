'use client';

import { asRecord, assertApiSuccess, getApiBaseUrl, getFeesSession, readString, type ApiStatusPayload, type FeesSession } from '@/app/fees/_lib/fees-api';

/** Session reader is shared with the Fees dashboard — it is generic (reads localStorage/sessionStorage), not fees-specific. */
export type DashboardSession = FeesSession;
export const getDashboardSession = getFeesSession;

function buildDashboardProxyHeaders(session: DashboardSession) {
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/json');
  headers.set('X-Requested-With', 'XMLHttpRequest');
  headers.set('x-laravel-base-url', getApiBaseUrl(session));
  if (session.token) headers.set('x-laravel-token', session.token);
  if (session.subInstituteId) headers.set('x-sub-institute-id', session.subInstituteId);
  if (session.academicYearId) headers.set('x-academic-year-id', session.academicYearId);
  if (session.userId) headers.set('x-user-id', session.userId);
  if (session.termId) headers.set('x-term-id', session.termId);
  return headers;
}

async function postDashboardProxy<T extends ApiStatusPayload>(path: string, session: DashboardSession, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    signal,
    headers: buildDashboardProxyHeaders(session),
    cache: 'no-store',
    credentials: 'include',
    body: JSON.stringify({}),
  });

  const text = await response.text();
  let payload: T;
  try {
    payload = JSON.parse(text) as T;
  } catch {
    throw new Error(`Dashboard proxy returned a non-JSON response (${response.headers.get('content-type') || 'unknown content type'}).`);
  }

  if (!response.ok) {
    throw new Error(readString(asRecord(payload).message) || `HTTP ${response.status}: Unable to load the dashboard.`);
  }

  assertApiSuccess(payload, 'Unable to load the dashboard.');
  return payload;
}

/**
 * Same as `postDashboardProxy`, but calls Laravel directly from the browser
 * instead of routing through the Next.js server (`/api/dashboard/*`). Used
 * where the Vercel serverless function can't reach the Laravel host but the
 * browser can, since the backend already answers CORS preflights for this origin.
 */
async function postDashboardDirect<T extends ApiStatusPayload>(laravelPath: string, session: DashboardSession, signal?: AbortSignal): Promise<T> {
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/json');
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (session.token) headers.set('Authorization', `Bearer ${session.token}`);

  const response = await fetch(`${getApiBaseUrl(session)}${laravelPath}`, {
    method: 'POST',
    signal,
    headers,
    cache: 'no-store',
    body: JSON.stringify({
      type: 'JSON',
      sub_institute_id: session.subInstituteId,
      syear: session.academicYearId,
      user_id: session.userId,
      term_id: session.termId,
    }),
  });

  const text = await response.text();
  let payload: T;
  try {
    payload = JSON.parse(text) as T;
  } catch {
    throw new Error(`Admin dashboard request returned a non-JSON response (${response.headers.get('content-type') || 'unknown content type'}).`);
  }

  if (!response.ok) {
    throw new Error(readString(asRecord(payload).message) || `HTTP ${response.status}: Unable to load the dashboard.`);
  }

  assertApiSuccess(payload, 'Unable to load the dashboard.');
  return payload;
}

export type AdminDashboardSummary = ApiStatusPayload & {
  summary: {
    total_students: number;
    total_staff: number;
    total_classes: number;
    fees_collected_today: number;
    admissions_this_year: number;
    homework_today: number;
    circulars_today: number;
    pending_parent_communications: number;
  };
  upcoming_birthdays: Array<{ student_name: string; standard_name: string; division_name: string; dob: string }>;
  recent_fee_receipts: Array<{ receipt_no: string; amount: number; receiptdate: string; student_name: string }>;
  fee_collection_trend: Array<{ date: string; label: string; amount: number }>;
  students_by_class: Array<{ standard_id: number; standard_name: string; students: number }>;
};

export type TeacherDashboardSummary = ApiStatusPayload & {
  summary: {
    total_classes: number;
    total_students: number;
    total_subjects: number;
    homework_to_review: number;
    assignments_to_grade: number;
  };
  my_classes: Array<{ standard_id: number; standard_name: string; division_id: number; division_name: string }>;
  my_subjects: Array<{ id: number; subject_name: string; short_name: string; subject_type: string }>;
  assignments_to_grade: Array<{ id: number; title: string; standard_id: number; division_id: number; subject_id: number; student_submitted_date: string | null }>;
  recent_circulars: Array<{ id: number; title: string; date_: string; standard_id: number; division_id: number | null }>;
  students_by_class: Array<{ label: string; students: number }>;
};

export type TeacherTimetableSummary = ApiStatusPayload & {
  timetable: Array<{
    week_day: string;
    period_id: number;
    period_title: string;
    start_time: string;
    end_time: string;
    subject_id: number;
    subject_name: string;
    standard_id: number;
    standard_name: string;
    division_id: number;
    division_name: string;
  }>;
};

export type TeacherFeeDuesSummary = ApiStatusPayload & {
  summary: {
    total_due_students: number;
    total_due_amount: number;
  };
  students: Array<{
    student_id: number;
    student_name: string;
    enrollment_no: string | null;
    standard_name: string;
    division_name: string;
    total_fee: number;
    paid_amount: number;
    due_amount: number;
  }>;
};

export type StudentDashboardSummary = ApiStatusPayload & {
  summary: {
    total_subjects: number;
    pending_homework: number;
    pending_assignments: number;
  };
  enrollment: { syear: number; standard_id: number; standard_name: string; section_id: number; section_name: string } | null;
  my_subjects: Array<{ id: number; subject_name: string; short_name: string; subject_type: string }>;
  pending_homework: Array<{ id: number; title: string; subject_id: number; date: string; submission_date: string | null }>;
  pending_assignments: Array<{ id: number; title: string; subject_id: number; submission_date: string | null }>;
  recent_circulars: Array<{ id: number; title: string; date_: string }>;
  task_status: Array<{ label: string; value: number }>;
  achievements: unknown[];
};

export function fetchAdminDashboard(session: DashboardSession, signal?: AbortSignal) {
  return postDashboardDirect<AdminDashboardSummary>('/api/admin-dashboard/summary', session, signal);
}

export function fetchTeacherDashboard(session: DashboardSession, signal?: AbortSignal) {
  return postDashboardProxy<TeacherDashboardSummary>('/api/dashboard/teacher', session, signal);
}

export function fetchStudentDashboard(session: DashboardSession, signal?: AbortSignal) {
  return postDashboardProxy<StudentDashboardSummary>('/api/dashboard/student', session, signal);
}

export function fetchTeacherFeeDues(session: DashboardSession, signal?: AbortSignal) {
  return postDashboardProxy<TeacherFeeDuesSummary>('/api/dashboard/teacher-fee-dues', session, signal);
}

export function fetchTeacherTimetable(session: DashboardSession, signal?: AbortSignal) {
  return postDashboardProxy<TeacherTimetableSummary>('/api/dashboard/teacher-timetable', session, signal);
}

/**
 * Self-service "My ID card" — the rendered card is server-generated HTML
 * (same Laravel template-filling logic as the admin teacher_icard tool,
 * see student\TeacherIcardApiController::buildTeacherCardHtml()), so the
 * payload is just that HTML string plus which template/grid it used.
 */
export type MyIcardSummary = ApiStatusPayload & {
  html: string;
  template: string;
  row: number;
  column: number;
};

export function fetchMyIcard(session: DashboardSession, signal?: AbortSignal) {
  return postDashboardProxy<MyIcardSummary>('/api/dashboard/teacher-icard', session, signal);
}
