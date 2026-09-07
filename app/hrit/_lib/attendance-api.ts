'use client';

/**
 * HRIT Attendance + Compliance API client.
 *
 * Ported from G2G's `services/hrms/index.ts` (attendance + compliance parts).
 * Endpoint paths, HTTP methods, query params and response shapes are kept
 * exactly as in G2G. The only change is the transport: G2G's `apiClient` /
 * `webClient` (backed by `LaravelContext`) are replaced with native `fetch`
 * plus this project's `buildSessionContext()` / `createAuthHeaders()` /
 * `appendCommonParams()` (see `lib/erp-client.ts`).
 *
 * `apiClient` calls below hit `${baseUrl}/api/...` (REST, `/api/*`).
 * `webClient` calls hit `${baseUrl}/...` (legacy Laravel web routes).
 *
 * G2G's `services/hrms/index.ts` also re-exports `./leave`, `./payroll` and
 * `./employee` — those are ported separately as `leave-api.ts`, `payroll-api.ts`,
 * and (employee, an undocumented extra dependency pulled in by the barrel
 * export) the `getEmployeeProfile` helper at the bottom of this file.
 */

import {
  appendCommonParams,
  buildSessionContext,
  createAuthHeaders,
  readString,
  type ApiEnvelope,
  type SessionContext,
} from '@/lib/erp-client';

export { buildSessionContext };
export type { SessionContext };

// ---------------------------------------------------------------------------
// Low-level transport
// ---------------------------------------------------------------------------

function messageFrom(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const message = (payload as ApiEnvelope).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

async function request<T>(
  session: SessionContext,
  base: 'api' | 'web',
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options?: { params?: Record<string, string | undefined>; body?: unknown; form?: FormData }
): Promise<T> {
  const search = new URLSearchParams();
  Object.entries(options?.params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, value);
  });

  const prefix = base === 'api' ? '/api' : '';
  const url = `${session.baseUrl}${prefix}${path}${search.toString() ? `?${search.toString()}` : ''}`;

  const isForm = Boolean(options?.form);
  const response = await fetch(url, {
    method,
    cache: 'no-store',
    headers: createAuthHeaders(session, isForm ? undefined : 'application/json'),
    body: isForm ? options?.form : options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw new Error(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`));
  }

  return payload as T;
}

const apiGet = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'api', 'GET', path, { params });
const apiPost = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'api', 'POST', path, { body });
const apiPatch = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'api', 'PATCH', path, { body });

const webGet = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'web', 'GET', path, { params });

/** Standard Laravel context params, mirroring G2G's `withLaravelParams`. */
function withContextParams(session: SessionContext, extra?: Record<string, string | undefined>) {
  const params: Record<string, string | undefined> = {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    financial_year: session.syear,
    user_id: session.userId,
    type: 'API',
    ...extra,
  };
  return params;
}

// ---------------------------------------------------------------------------
// Types (unchanged from G2G)
// ---------------------------------------------------------------------------

export interface AttendanceRecord {
  id: string
  userId: string
  date: string
  checkIn?: string
  checkOut?: string
  status: 'present' | 'absent' | 'late' | 'half_day'
}

export interface ComplianceItem {
  id: string
  title: string
  category: string
  dueDate?: string
  status: 'compliant' | 'non_compliant' | 'pending'
  assignedTo?: string
}

export interface AttendanceKpiResponse {
  present_today: string
  leave_utilization: string
  active_employees: number
}

export interface AttendanceWeeklyPunch {
  employee_id: number | string
  day: string
  type: 'present' | 'absent' | 'incomplete' | string
  time: string | null
}

export interface AttendanceWeeklyResponse {
  date_range: {
    start: string
    end: string
  }
  department_filter: number | string
  labels: string[]
  present: number[]
  absent: number[]
  late: number[]
  punch_times: Record<string, AttendanceWeeklyPunch[]>
}

export interface AttendanceWeeklyParams {
  fromDate?: string
  toDate?: string
  departmentId?: string
  employeeId?: string
}

export interface AttendanceOption {
  value: string
  label: string
}

export interface LaravelAttendanceEntry {
  id: number | string
  user_id: number | string
  employee_no?: string | null
  employee_name?: string | null
  department?: string | null
  day: string
  punchin_time?: string | null
  punchout_time?: string | null
  timestamp_diff?: string | null
  status?: number | string | null
  attendance_status?: string | null
  status_label?: string | null
  type?: string | null
  ipaddress_in?: string | null
  ipaddress_out?: string | null
}

/** One calendar day of the requested range, as resolved by Laravel. */
export interface LaravelAttendanceCalendarDay {
  date: string
  day_name?: string
  /** null when the API has no status for that date - render nothing. */
  status: 'present' | 'late' | 'absent' | 'leave' | null
  is_working_day?: boolean
  is_holiday?: boolean
  holiday_name?: string | null
  leave_type?: string | null
  day_type?: string | null
  punchin_time?: string | null
  punchout_time?: string | null
  timestamp_diff?: string | null
}

export interface MyAttendanceResponse {
  status?: number | string
  status_code?: number | string
  message?: string
  fromDate?: string
  toDate?: string
  daysInMonth?: number
  workingDays?: number
  holidays?: number
  presentDays?: number
  lateDays?: number
  leaveDays?: number
  absentDays?: number
  percentege?: number
  calendar?: LaravelAttendanceCalendarDay[]
  attendanceData?: LaravelAttendanceEntry[]
}

export interface AttendanceReportIndexResponse {
  employee_id?: string | number | null
  department_id?: string | number | null
  from_date_formatted?: string
  to_date_formatted?: string
  departments?: Record<string, string> | string[] | AttendanceOption[]
}

export interface AttendanceEmployeeOption {
  id: number | string
  employee_no?: string | null
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
}

export interface AttendanceEmployeesResponse {
  employees?: AttendanceEmployeeOption[]
  department_id?: string | number | null
  employee_id?: string | number | null
}

export interface DepartmentAttendanceEmployee {
  user_id: number | string
  employee_no?: string | null
  full_name?: string | null
  user_profile?: string | null
  department?: string | null
  department_id?: string | null
  total_att_day?: number | string | null
  total_ab_day?: number | string | null
  total_holidays?: number | string | null
  half_day?: number | string | null
  late?: number | string | null
  weekday_off?: number | string | null
  totalDays?: number | string | null
  workingDays?: number | string | null
}

export interface DepartmentAttendanceReportResponse {
  status_code?: number | string
  message?: string
  empData?: DepartmentAttendanceEmployee[]
}

export interface EarlyGoingUser {
  employee_no?: string | null
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  department_id?: number | string | null
}

export interface EarlyGoingAttendanceEntry extends LaravelAttendanceEntry {
  atten_id?: number | string
  expected_time?: string | null
  is_late?: number | string | null
  get_user?: EarlyGoingUser | null
  getUser?: EarlyGoingUser | null
}

export interface EarlyGoingAttendanceReportResponse {
  employees?: unknown
  date_formatted?: string
  hrmsList?: EarlyGoingAttendanceEntry[]
  departments?: Record<string, string> | string[] | AttendanceOption[]
}

export interface AttendanceReportParams {
  fromDate: string
  toDate: string
  departmentId?: string
  employeeId?: string
}

export interface DayDetailEntry {
  user_id: number | string
  employee_no?: string | null
  full_name?: string | null
  department?: string | null
  department_id?: number | string | null
  punchin_time?: string | null
  punchout_time?: string | null
  timestamp_diff?: string | null
  expected_out?: string | null
  status: 'present' | 'late' | 'absent' | 'early-going' | 'leave'
}

export interface DayDetailResponse {
  status?: number | string
  message?: string
  date?: string
  department_id?: string | number | null
  employee_id?: string | number | null
  employees?: DayDetailEntry[]
}

export interface LatestActivityDateResponse {
  status?: number | string
  message?: string
  /** null when there is no recorded attendance at all in scope. */
  date?: string | null
}

export interface AttendancePunchResponse {
  status?: number | string
  status_code?: number | string
  message?: string
  attendanceData?: LaravelAttendanceEntry
}

export interface EmployeeSkill {
  jobrole_skill_id: number
  jobrole: string
  skill: string
  skill_id: number
  title?: string
  category?: string
  sub_category?: string
  description?: string
  proficiency_level?: string
  knowledge?: string[]
  ability?: string[]
  behaviour?: string[]
  attitude?: string[]
}

export interface EmployeeProfileResponse {
  id: number
  name: string
  email: string
  jobrole: string
  department: string
  skills: EmployeeSkill[]
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Helpers (unchanged logic from G2G)
// ---------------------------------------------------------------------------

/** 'all' means "no filter" - the param is omitted so Laravel's filled() check skips it. */
function activeFilter(value?: string) {
  return value && value !== 'all' && value !== '0' ? value : undefined
}

function attendanceParams(session: SessionContext, params?: AttendanceWeeklyParams) {
  const departmentId = activeFilter(params?.departmentId)
  const employeeId = activeFilter(params?.employeeId)

  return withContextParams(session, {
    ...(params?.fromDate ? { from_date: params.fromDate } : {}),
    ...(params?.toDate ? { to_date: params.toDate } : {}),
    ...(departmentId ? { department_id: departmentId } : {}),
    ...(employeeId ? { employee_id: employeeId } : {}),
  })
}

async function ensureAttendanceSuccess(request: Promise<AttendancePunchResponse>) {
  const response = await request
  const status = response.status ?? response.status_code
  if (String(status) === '0') {
    throw new Error(response.message || 'Attendance request failed')
  }
  return response
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const hrmsService = {
  // Attendance
  getAttendanceRecords: (session: SessionContext, params?: { userId?: string; startDate?: string; endDate?: string }) =>
    apiGet<AttendanceRecord[]>(session, '/attendance', params as Record<string, string>),
  checkIn: (session: SessionContext, userId: string) =>
    apiPost<AttendanceRecord>(session, '/attendance/check-in', { userId }),
  checkOut: (session: SessionContext, userId: string) =>
    apiPost<AttendanceRecord>(session, '/attendance/check-out', { userId }),
  /** /api/attendance/kpi - the employee filter is only honoured by this route. */
  getAttendanceKpis: (session: SessionContext, params?: Pick<AttendanceWeeklyParams, 'departmentId' | 'employeeId'>) =>
    apiGet<AttendanceKpiResponse>(session, '/attendance/kpi', attendanceParams(session, params)),
  /** /api/attendance/weekly-summary - as above, /attendance-weekly ignores employee_id. */
  getAttendanceWeeklySummary: (session: SessionContext, params?: AttendanceWeeklyParams) =>
    apiGet<AttendanceWeeklyResponse>(session, '/attendance/weekly-summary', attendanceParams(session, params)),
  /** Departments are scoped to the caller's sub_institute by this route. */
  getAttendanceReportIndex: (session: SessionContext) =>
    apiGet<AttendanceReportIndexResponse>(session, '/attendance/report-filters', withContextParams(session)),
  /** Omitting department_id (or passing 'all') lists every active employee of the institute. */
  getAttendanceEmployees: (session: SessionContext, departmentId?: string) =>
    apiGet<AttendanceEmployeesResponse>(session, '/attendance/employees', {
      ...withContextParams(session),
      ...(activeFilter(departmentId) ? { department_id: activeFilter(departmentId) as string } : {}),
    }),
  getDepartmentAttendanceReport: (session: SessionContext, params: AttendanceReportParams) =>
    webGet<DepartmentAttendanceReportResponse>(session, '/departmentwise-attendance-report/create', withContextParams(session, {
      from_date: params.fromDate,
      to_date: params.toDate,
      ...(params.departmentId && params.departmentId !== 'all' ? { 'department_id[]': params.departmentId } : { department_id: '0' }),
      ...(params.employeeId && params.employeeId !== 'all' ? { emp_id: params.employeeId, employee_id: params.employeeId } : {}),
    })),
  getEarlyGoingAttendanceReport: (session: SessionContext, params: { date: string; departmentId?: string; employeeId?: string }) =>
    webGet<EarlyGoingAttendanceReportResponse>(session, '/show-early-going-hrms-attendance-report', withContextParams(session, {
      date: params.date,
      ...(params.departmentId && params.departmentId !== 'all' ? { 'department_id[]': params.departmentId } : { department_id: '0' }),
      ...(params.employeeId && params.employeeId !== 'all' ? { 'emp_id[]': params.employeeId } : { emp_id: '0' }),
    })),
  /**
   * /api/attendance/day-detail - every active employee in scope for a single
   * date (LEFT JOIN, so absent/on-time-present employees are included, not
   * just early leavers like getEarlyGoingAttendanceReport above).
   */
  getAttendanceDayDetail: (session: SessionContext, params: { date: string; departmentId?: string; employeeId?: string }) =>
    apiGet<DayDetailResponse>(session, '/attendance/day-detail', {
      ...withContextParams(session),
      date: params.date,
      ...(activeFilter(params.departmentId) ? { department_id: activeFilter(params.departmentId) as string } : {}),
      ...(activeFilter(params.employeeId) ? { employee_id: activeFilter(params.employeeId) as string } : {}),
    }),
  /**
   * /api/attendance/latest-activity-date - the most recent date with a real
   * recorded punch, used to steer users away from a "today" (or, with
   * fromDate/toDate, any applied date range's own end date) that has no
   * data yet rather than silently showing an all-absent snapshot with no
   * explanation.
   */
  getLatestActivityDate: (session: SessionContext, params?: { departmentId?: string; fromDate?: string; toDate?: string }) =>
    apiGet<LatestActivityDateResponse>(session, '/attendance/latest-activity-date', {
      ...withContextParams(session),
      ...(activeFilter(params?.departmentId) ? { department_id: activeFilter(params?.departmentId) as string } : {}),
      ...(params?.fromDate ? { from_date: params.fromDate } : {}),
      ...(params?.toDate ? { to_date: params.toDate } : {}),
    }),
  /**
   * /api/attendance/my-attendance returns the punch rows for the window plus
   * the resolved day by day calendar. The legacy GET /hrms-attendance
   * (formType=MyAttendance) only ever answers for the current day.
   *
   * `userId` overrides the caller's own id (the default `user_id` param from
   * withContextParams) with a specific employee's - used for the Attendance
   * Report's per-employee day-wise drill-down, where an admin views someone
   * else's calendar rather than their own. The backend only scopes by
   * sub_institute_id (see AttendanceTrackingApiController::myAttendance),
   * the same institute-wide access every other Attendance Report endpoint
   * already grants an authenticated admin caller.
   */
  getMyAttendance: (session: SessionContext, params?: { fromDate?: string; toDate?: string; userId?: string }) =>
    apiGet<MyAttendanceResponse>(session, '/attendance/my-attendance', withContextParams(session, {
      ...(params?.fromDate ? { from_date: params.fromDate } : {}),
      ...(params?.toDate ? { to_date: params.toDate } : {}),
      ...(params?.userId ? { user_id: params.userId } : {}),
    })),
  punchAttendanceIn: (session: SessionContext, data: { date: string; time: string }) =>
    ensureAttendanceSuccess(apiPost<AttendancePunchResponse>(session, '/attendance/punch-in', {
      ...withContextParams(session),
      employee: session.userId,
      indate: data.date,
      intime: data.time,
    })),
  punchAttendanceOut: (session: SessionContext, data: { date: string; time: string }) =>
    ensureAttendanceSuccess(apiPost<AttendancePunchResponse>(session, '/attendance/punch-out', {
      ...withContextParams(session),
      employee: session.userId,
      outdate: data.date,
      outtime: data.time,
    })),

  // Leave - see leave-api.ts for the Leave Management module endpoints.
  // Payroll - see payroll-api.ts for the Payroll module endpoints.

  // Compliance
  getComplianceItems: (session: SessionContext, params?: { category?: string; status?: string }) =>
    apiGet<ComplianceItem[]>(session, '/compliance', params as Record<string, string>),
  updateComplianceStatus: (session: SessionContext, id: string, status: string) =>
    apiPatch<ComplianceItem>(session, `/compliance/${id}`, { status }),
}

/**
 * Employee module (`services/hrms/employee.ts` in G2G) — pulled in by G2G's
 * `services/hrms/index.ts` barrel export (`export * from './employee'`), not
 * separately called out in the migration plan. Ported here since it travels
 * with the rest of `services/hrms`. Legacy web route (`webClient`), not `/api/*`.
 */
export const employeeService = {
  getEmployeeProfile: (session: SessionContext, orgType?: string, userProfileName?: string) =>
    webGet<EmployeeProfileResponse>(session, '/user/add_user', withContextParams(session, {
      org_type: orgType ?? '',
      ...(userProfileName ? { user_profile_name: userProfileName } : {}),
    })),
}

export { readString };
