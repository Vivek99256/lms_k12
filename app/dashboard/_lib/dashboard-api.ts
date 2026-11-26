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
async function postDashboardDirect<T extends ApiStatusPayload>(laravelPath: string, session: DashboardSession, signal?: AbortSignal, extra?: Record<string, unknown>): Promise<T> {
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

/** Something worth a teacher's or a student's attention, taken from their own classes or record. */
export type InsightItem = { id: string; title: string; why: string; next: string; severity: string; chips: string[]; phone: string | null };

/** A signal the system noticed for this role, with what a stakeholder asks of it. */
export type SignalItem = {
  id: string; title: string; topic: string; source: string; severity: 'critical' | 'high' | 'medium' | 'low' | string; confidence: number; raised: string;
  affected: number | null; total: number | null; unit: string | null; evidence: number; why: string | null;
  recommendation: { title: string; status: string; urgency: string } | null;
  decision: { status: string; by: string | null; date: string; note: string | null } | null;
  outcome: { result: string; feedback: string | null } | null;
  follow_up: { task_id: number; owner: string | null; due: string | null; status: string } | null;
};

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
  my_classes?: { classes: number; students: number; items: Array<{ label: string; students: number }> } | null;
  today_schedule?: { total: number; items: Array<{ id: number; title: string; detail: string; time: string | null }> } | null;
  attendance_pending?: { total: number; items: Array<{ label: string }> } | null;
  homework_pending?: { total: number; students: number } | null;
  assignments_to_grade?: { count: number; items: WorkspaceListItem[] } | null;
  support_students?: { total: number; items: InsightItem[] } | null;
  teaching_impact?: { homework: { current: { rate: number | null; n: number }; previous: { rate: number | null; n: number } }; attendance: { current: number | null; previous: number | null } } | null;
  class_mastery?: { learners: number; bands: Record<string, number>; hardest: Array<{ concept: string; mastery: number; students: number }> } | null;
  class_circulars?: WorkspaceListItem[] | null;
  my_work?: { homework: number; assignments: number; total: number; overdue: number; items: Array<{ id: string; title: string; detail: string; date: string | null; overdue: boolean }> } | null;
  my_exams?: { count: number; items: WorkspaceListItem[] } | null;
  my_mastery?: { total: number; mastered: number; needs_work: number; in_progress: number; items: Array<{ concept: string; mastery: number; attempts: number; correct: number }> } | null;
  my_next?: { kind: string; title: string; detail: string } | null;
  my_streak?: { current: number; longest: number; active_days: number; last_active: string | null; badges: Array<{ name: string; date: string }>; badge_total: number } | null;
  my_insights?: { total: number; items: InsightItem[] } | null;
  payroll?: {
    latest: { label: string; paid: number; deducted: number; staff: number };
    previous: { label: string; paid: number } | null;
    active_staff: number;
    coverage_pct: number | null;
    months: Array<{ label: string; paid: number }>;
    caution: string | null;
  } | null;
  year_compare?: { previous_syear: number; items: Array<{ label: string; unit: 'count' | 'rupees'; current: number; previous: number }>; caution: string | null } | null;
  health?: Array<{ key: string; label: string; unit: string; value: number | null; target: number | null; status: 'good' | 'watch' | 'act' | 'no_target' | 'no_data' | string; detail: string }> | null;
  decisions_for_me?: { total: number; urgent: number; items: Array<{ id: string; title: string; why: string | null; impact: string | null; urgency: string; priority: string; confidence: number }> } | null;
  management_delivery?: { total: number; open: number; overdue: number; done: number; delivered_rate: number | null; items: Array<{ id: number; title: string; owner: string; due: string; days_late: number }>; by_owner: Array<{ owner: string; overdue: number }> } | null;
  data_trust?: { total: number; items: Array<{ id: string; title: string; severity: string; source: string }> } | null;
  signals?: { total: number; by_severity: Record<string, number>; items: SignalItem[] } | null;
  intelligence_loop?: { signals: number; recommendations: number; awaiting_decision: number; decided: number; improved: number; partial: number; worsened: number } | null;
  progress?: Array<{ key: string; label: string; value: number; detail: string }> | null;
  history?: Array<{ id: string; kind: 'decision' | 'task' | 'badge'; title: string; detail: string; status: string; result: string | null; date: string }> | null;
  chronic_absentees?: { days: number; threshold: number; total: number; items: Array<{ id: number; name: string; class_name: string; absences: number; phone: string | null }> } | null;
  substitutes_needed?: { teachers: number; periods: number; uncovered: number; items: Array<{ id: number; title: string; detail: string }> } | null;
  parent_msg_age?: { total: number; oldest_days: number | null; lt3: number; d3_7: number; gt7: number } | null;
  task_aging?: { total: number; oldest_days: number | null; not_late: number; late_7: number; late_30: number; late_over: number } | null;
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
  can_assign_followup: boolean;
  can_set_targets: boolean;
  can_decide: boolean;
  /** Subjects this role has related figures for; a click opens a section only for these. */
  explore_topics?: string[];
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

/** Staff to hand a follow-up to (name search, this school's active accounts). */
export type StaffMatch = { id: number; name: string; role: string | null };

export function searchStaff(session: DashboardSession, q: string, signal?: AbortSignal) {
  return postDashboardDirect<ApiStatusPayload & { items: StaffMatch[] }>('/api/role-workspace/staff-search', session, signal, { q });
}

/** Turn a signal into a Task Management task for a named person. Refused by the server for roles that may not assign. */
export function createFollowUp(session: DashboardSession, input: { signalId: string; assigneeId: number; dueDays: number; note?: string }) {
  return postDashboardDirect<ApiStatusPayload & { task_id: number; owner: string; due: string }>('/api/role-workspace/follow-up', session, undefined, {
    signal_id: input.signalId, assignee_id: String(input.assigneeId), due_days: String(input.dueDays), note: input.note ?? '',
  });
}

/** Set one of the school's targets. Refused by the server for roles that do not own the school's goals. */
export function setTarget(session: DashboardSession, metric: string, value: number) {
  return postDashboardDirect<ApiStatusPayload & { metric: string; value: number }>('/api/role-workspace/targets', session, undefined, { metric, value: String(value) });
}

/* ---- "Tell the dashboard what you want": widgets the user asked the assistant to add ---- */

/** A chart from the fixed catalog (metric + dim), or a new figure the assistant described from the school data (query + how). */
export type CustomWidgetSpec = { metric?: string; dim?: string; query?: unknown; how?: string; unit?: 'count' | 'rupees' | 'percent'; chart: 'number' | 'bar' | 'line' | 'donut'; title: string; order?: string; limit?: number };
export type CustomWidgetData = { rows: Array<{ label: string; value: number }>; unit: 'count' | 'rupees' | 'percent'; number: { value: number; label: string } | null; as_of: string | null; note?: string };
/** A ready-made figure from the dashboard's own library, in one of five plain views. */
export type LibrarySpec = { library: string; only: string | null; title: string };
export type LibraryView =
  | { kind: 'number'; value: number | null; unit: 'count' | 'rupees' | 'percent'; note: string | null }
  | { kind: 'facts'; items: Array<{ label: string; value: number; unit: 'count' | 'rupees' | 'percent' }>; caution?: string | null }
  | { kind: 'list'; total: number; items: Array<{ title: string; sub: string | null; tag: string | null }>; empty_note?: string | null }
  | { kind: 'bars'; unit: 'count' | 'rupees' | 'percent'; rows: Array<{ label: string; value: number }>; as_of?: string | null }
  | { kind: 'series'; unit: 'count' | 'rupees' | 'percent'; rows: Array<{ label: string; value: number }> };
export type CustomWidget =
  | { id: number; spec: CustomWidgetSpec; data?: CustomWidgetData | null }
  | { id: number; spec: LibrarySpec; data?: { view: LibraryView | null } | null };
export const isLibraryWidget = (w: CustomWidget): w is Extract<CustomWidget, { spec: LibrarySpec }> => 'library' in w.spec;
export type AssistantApplied = { type: 'show' | 'hide' | 'add_widget' | 'remove_widget'; text: string; panel_id?: string; widget_id?: number; spec?: CustomWidgetSpec | LibrarySpec };
export type AssistantReply = ApiStatusPayload & { reply: string; applied: AssistantApplied[]; ui: Array<{ type: 'show' | 'hide'; id: string }>; widgets: CustomWidget[]; understood_by: 'assistant' | 'keywords' };

/** The other figures of one subject, and the subjects that usually follow it ("more like this"). */
export type RelatedResponse = ApiStatusPayload & {
  topic: string; label: string; title: string;
  items: Array<{ key: string; title: string; about: string; view: LibraryView; more?: boolean }>;
  next: Array<{ id: string; label: string }>;
};

export function fetchRelated(session: DashboardSession, topic: string, signal?: AbortSignal) {
  // "entry:<figure>|seen=a,b" asks for the figures that follow one particular figure, leaving out those already on screen (a, b);
  // anything else is a subject.
  let body: Record<string, unknown> = { topic };
  if (topic.startsWith('entry:')) {
    const [entry, seen] = topic.slice(6).split('|seen=');
    body = { entry, seen: seen ? seen.split(',') : [] };
  }
  return postDashboardDirect<RelatedResponse>('/api/role-workspace/related', session, signal, body);
}

export function fetchCustomWidgets(session: DashboardSession, signal?: AbortSignal) {
  return postDashboardDirect<ApiStatusPayload & { widgets: CustomWidget[]; catalog: Record<string, { label: string }>; max: number }>('/api/role-workspace/custom-widgets', session, signal);
}

export function removeCustomWidget(session: DashboardSession, id: number) {
  return postDashboardDirect<ApiStatusPayload & { widgets: CustomWidget[] }>('/api/role-workspace/custom-widgets/remove', session, undefined, { id });
}

/** Send what the user typed, with the panels they can see, and get back what was done. The server checks every action. */
export function askDashboardAssistant(session: DashboardSession, message: string, panels: Array<{ id: string; label: string; visible: boolean }>, history: Array<{ role: 'user' | 'assistant'; text: string }>) {
  return postDashboardDirect<AssistantReply>('/api/role-workspace/assistant', session, undefined, { message, panels, history });
}

/**
 * Record a decision on a recommendation, through the Enterprise Brain's own endpoint — the one path that creates a
 * decision. The Brain checks the caller's permission itself, so a role it does not allow gets a refusal here.
 */
export async function decideRecommendation(session: DashboardSession, id: string, status: 'approved' | 'rejected' | 'deferred', rationale: string) {
  const response = await fetch(`${getApiBaseUrl(session)}/api/brain/${encodeURIComponent(session.subInstituteId)}/recommendations/${encodeURIComponent(id)}/decide`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}) },
    body: JSON.stringify({ status, rationale }),
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string; errors?: Record<string, string[]>; decisionId?: string };
  if (!response.ok) {
    if (response.status === 403 || body.error === 'brain_forbidden') throw new Error('Your role is not allowed to record decisions in the Enterprise Brain.');
    if (response.status === 422) throw new Error(Object.values(body.errors ?? {}).flat()[0] ?? 'Please give a short reason for the decision.');
    throw new Error("The decision could not be recorded. Please try again.");
  }
  return body;
}
