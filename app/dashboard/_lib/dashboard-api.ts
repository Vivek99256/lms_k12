'use client';

import { asRecord, assertApiSuccess, getApiBaseUrl, getFeesSession, readString, type ApiStatusPayload, type FeesSession } from '@/app/fees/_lib/fees-api';

/** Session reader is shared with the Fees dashboard — it is generic (reads localStorage/sessionStorage), not fees-specific. */
export type DashboardSession = FeesSession;
export const getDashboardSession = getFeesSession;

/**
 * A 401 from these endpoints means the stored session is gone or invalid
 * (expired token, or storage cleared by a sign-out/inactivity-timeout in
 * another tab) — distinct from a regular failure, so callers can sign the
 * user out instead of showing a raw backend message behind a "Try again"
 * button that can never succeed (it re-reads the same empty session).
 */
export class DashboardAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DashboardAuthError';
  }
}

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
    const message = readString(asRecord(payload).message) || "We couldn't load the dashboard. Please try again.";
    if (response.status === 401) throw new DashboardAuthError(message);
    throw new Error(message);
  }

  assertApiSuccess(payload, "We couldn't load the dashboard. Please try again.");
  return payload;
}

/**
 * Same as `postDashboardProxy`, but calls Laravel directly from the browser
 * instead of routing through the Next.js server (`/api/dashboard/*`). Used
 * where the Vercel serverless function can't reach the Laravel host but the
 * browser can, since the backend already answers CORS preflights for this origin.
 */
async function postDashboardDirect<T extends ApiStatusPayload>(laravelPath: string, session: DashboardSession, signal?: AbortSignal, extra?: Record<string, string>): Promise<T> {
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
      ...extra,
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
    const message = readString(asRecord(payload).message) || "We couldn't load the dashboard. Please try again.";
    if (response.status === 401) throw new DashboardAuthError(message);
    throw new Error(message);
  }

  assertApiSuccess(payload, "We couldn't load the dashboard. Please try again.");
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
  /** `id` is only present on backends running the grouped receipt query; older responses omit it. */
  recent_fee_receipts: Array<{ id?: number; receipt_no: string; amount: number; receiptdate: string; student_name: string }>;
  fee_collection_trend: Array<{ date: string; label: string; amount: number }>;
  students_by_class: Array<{ standard_id: number; standard_name: string; students: number }>;
  /*
   * The three fields below were added to RoleDashboardApiController::adminSummary later
   * than the rest. A backend that predates them omits them, so they are optional and the
   * widgets that read them stay hidden rather than showing zeros nobody recorded.
   */
  attendance_today?: { present: number; absent: number; not_marked: number; total_students: number };
  /** `rate` is null for a day with no attendance marked (a holiday is not a 0% day). */
  attendance_trend?: Array<{ date: string; label: string; present: number; absent: number; rate: number | null }>;
  recent_activity?: Array<{
    type: 'circular' | 'admission_enquiry';
    id: number;
    title: string;
    detail: string | null;
    occurred_at: string | null;
  }>;
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

/**
 * Role workspace — Principal, Clerk, Librarian, Store Keeper, Exam Department, Trustee, Peon …
 * The server decides which role the caller is and which widgets they get; a widget it cannot
 * compute comes back as null and is shown as "no data", never as a made-up figure.
 */
export type WorkspaceListItem = { id: number; title: string; detail?: string | null; date?: string | null; done?: boolean };

export type RoleWorkspaceWidgets = {
  students_total?: number | null;
  staff_total?: number | null;
  attendance_today?: { present: number; absent: number; not_marked: number; total_students: number } | null;
  attendance_trend?: Array<{ date: string; label: string; present: number; absent: number; rate: number | null }> | null;
  staff_on_leave_today?: number | null;
  leaves_pending?: number | null;
  my_leaves_pending?: number | null;
  fees_today?: number | null;
  fee_trend?: Array<{ date: string; label: string; amount: number }> | null;
  recent_fee_receipts?: Array<{ id: number; receipt_no: string; amount: number; date: string | null; student_name: string }> | null;
  admissions_year?: number | null;
  recent_enquiries?: WorkspaceListItem[] | null;
  parent_msgs_pending?: number | null;
  recent_parent_messages?: WorkspaceListItem[] | null;
  recent_circulars?: WorkspaceListItem[] | null;
  visitors_today?: { total: number; inside: number } | null;
  complaints?: { total: number; open: number } | null;
  tasks_pending_all?: number | null;
  tasks_pending_me?: { count: number; items: WorkspaceListItem[] } | null;
  inward_month?: number | null;
  outward_month?: number | null;
  petty_cash_month?: number | null;
  requisitions?: { pending: number; approved: number; rejected: number; on_hold: number } | null;
  recent_requisitions?: WorkspaceListItem[] | null;
  po_status?: { awaiting: number; decided: number } | null;
  items_total?: number | null;
  vendors_total?: number | null;
  purchases_month?: { count: number; amount: number } | null;
  upcoming_exams?: { count: number; items: WorkspaceListItem[] } | null;
  exam_evaluation?: { batches: number; sheets: number; evaluated: number; approved: number } | null;
  students_by_class?: Array<{ standard_id: number; standard_name: string; students: number | string }> | null;
  fees_period?: { amount: number; previous: number; label: string } | null;
  admissions_period?: { count: number; previous: number; label: string } | null;
  visitors_period?: { count: number; previous: number; label: string } | null;
  absent_today?: { date: string | null; total: number; items: Array<{ id: number; name: string; class_name: string; phone: string | null }> } | null;
  staff_on_leave_list?: { total: number; items: Array<{ id: number; name: string; until: string }> } | null;
  birthdays?: { students: Array<{ id: number; name: string; in_days: number; date: string }>; staff: Array<{ id: number; name: string; in_days: number; date: string }>; student_total: number; staff_total: number } | null;
  upcoming_events?: Array<{ id: string; title: string; date: string; kind: string }> | null;
  followups_due?: { total: number; items: Array<{ id: number; name: string; detail: string | null; phone: string | null; date: string }> } | null;
  pending_approvals?: { leaves: number; requisitions: number; purchase_orders: number; total: number } | null;
  library_overdue?: { total: number; items: Array<{ id: number; title: string; detail: string; days: number; date: string }> } | null;
  stock_reorder?: { total: number; items: Array<{ id: number; title: string; recorded: number; reorder_at: number }> } | null;
  exam_results?: { exam: string | null; rows: Array<{ standard_name: string; students: number; average: number; best: number }> } | null;
  chronic_absentees?: { days: number; threshold: number; total: number; items: Array<{ id: number; name: string; class_name: string; absences: number; phone: string | null }> } | null;
  substitutes_needed?: { teachers: number; periods: number; uncovered: number; items: Array<{ id: number; title: string; detail: string }> } | null;
  parent_msg_age?: { total: number; oldest_days: number | null; lt3: number; d3_7: number; gt7: number } | null;
  task_aging?: { total: number; oldest_days: number | null; le7: number; d8_30: number; gt30: number } | null;
  homework_rate?: { days: number; total: number; overall: number | null; rows: Array<{ standard_name: string; total: number; done: number; rate: number | null }> } | null;
  strength_changes?: { joined_month: number; joined_year: number; left_year: number; tc_year: number } | null;
  transport_summary?: { students: number; buses: number; over_capacity: number; top: Array<{ id: number; title: string; students: number; capacity: number; fill: number | null }> } | null;
  hostel_summary?: { hostels: number; rooms: number; rooms_in_use: number; residents: number } | null;
  class_attendance?: { date: string | null; rows: Array<{ standard_id: number; standard_name: string; present: number; absent: number; rate: number | null }> } | null;
  gender_split?: { Male: number; Female: number; 'Not recorded': number } | null;
  admission_funnel?: { enquiries: number; registered: number; admitted: number } | null;
  fees_month?: { this_month: number; last_month_same_days: number; month_label: string; last_month_label: string } | null;
};

export type RoleWorkspaceSummary = ApiStatusPayload & {
  role: string;
  label: string;
  profile_name: string;
  period: WorkspacePeriod;
  can_see_fees: boolean;
  can_find_student: boolean;
  standard_id: number;
  standards: Array<{ id: number; name: string }>;
  widgets: RoleWorkspaceWidgets;
};

export type WorkspacePeriod = 'today' | 'week' | 'month' | 'year';

export function fetchRoleWorkspace(session: DashboardSession, signal?: AbortSignal, period: WorkspacePeriod = 'today', standardId = 0) {
  return postDashboardDirect<RoleWorkspaceSummary>('/api/role-workspace/summary', session, signal, { period, standard_id: String(standardId) });
}

/** Collected vs outstanding and payment modes. Refused by the server for roles without fee access. */
export type WorkspaceFees = ApiStatusPayload & {
  summary: {
    collected_amount: number; demand_amount: number; outstanding_amount: number; collection_rate: number; receipts_count: number; fine_amount: number; discount_amount: number;
  } | null;
  payment_mode_mix: Array<{ payment_mode: string; receipts: number; amount: number }>;
};

export function fetchWorkspaceFees(session: DashboardSession, signal?: AbortSignal) {
  return postDashboardDirect<WorkspaceFees>('/api/role-workspace/fees', session, signal);
}

/** Front-office student lookup: name or admission number in, class and a parent's number out. */
export type FoundStudent = { id: number; name: string; enrollment_no: string | null; class_name: string; phone: string | null };

export function fetchFindStudent(session: DashboardSession, q: string, signal?: AbortSignal) {
  return postDashboardDirect<ApiStatusPayload & { items: FoundStudent[] }>('/api/role-workspace/find-student', session, signal, { q });
}
