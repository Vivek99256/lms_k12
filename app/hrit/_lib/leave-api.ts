'use client';

/**
 * HRIT Leave Management API client.
 *
 * Ported from G2G's `services/hrms/leave.ts` — backed by the Laravel
 * `/api/leave/*` endpoints (App\Http\Controllers\Api\Leave). Endpoint paths,
 * HTTP methods, query params and response shapes are kept exactly as in G2G.
 * Only the transport changed: native `fetch` + this project's
 * `buildSessionContext()` / `createAuthHeaders()` (see `lib/erp-client.ts`)
 * instead of G2G's `apiClient` + `LaravelContext`.
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
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options?: { params?: Record<string, string | undefined>; body?: unknown }
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
    throw new Error(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`));
  }

  return payload as T;
}

const apiGet = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'GET', path, { params });
const apiPost = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'POST', path, { body });
const apiPut = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'PUT', path, { body });
const apiPatch = <T,>(session: SessionContext, path: string, body: unknown) =>
  request<T>(session, 'PATCH', path, { body });
const apiDelete = <T,>(session: SessionContext, path: string, params?: Record<string, string | undefined>) =>
  request<T>(session, 'DELETE', path, { params });

/** Standard Laravel context params, mirroring G2G's `withLaravelParams`. */
function withContextParams(session: SessionContext, extra?: Record<string, string | undefined>) {
  return {
    token: session.token,
    sub_institute_id: session.subInstituteId,
    syear: session.syear,
    financial_year: session.syear,
    user_id: session.userId,
    type: 'API',
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Types (unchanged from G2G)
// ---------------------------------------------------------------------------

/** Every /api/leave endpoint replies with this envelope. */
export interface LeaveApiResponse<T> {
  status: number
  message: string
  year?: number
  data: T
}

export type LeaveStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'sent_back'
  | 'cancelled'
  | 'approved_lwp'

export interface LeaveOption {
  value: string
  label: string
}

export interface LeaveEmployeeOption extends LeaveOption {
  employee_no?: string | null
  department_id?: string | null
  department?: string | null
}

export interface LeaveTypeOption extends LeaveOption {
  code?: string | null
}

export interface LeaveOptionsData {
  departments: LeaveOption[]
  employees: LeaveEmployeeOption[]
  leave_types: LeaveTypeOption[]
  statuses: LeaveOption[]
}

export interface LeaveActivityItem {
  id: number
  type: 'application' | 'approval' | 'rejection' | 'cancellation'
  title: string
  description: string
  timestamp: string | null
  from_date: string | null
  to_date: string | null
}

export interface LeaveDashboardData {
  total_requests: number
  pending_requests: number
  approved_requests: number
  rejected_requests: number
  cancelled_requests: number
  on_leave_today: number
  available_balance: number
  recent_activity: LeaveActivityItem[]
}

export interface LeaveTrendPoint {
  period: string
  month: string
  requests: number
  approved: number
  rejected: number
}

export interface LeaveDepartmentSummaryRow {
  department_id: number
  department: string
  requests: number
  approved: number
  rejected: number
  pending: number
}

export interface LeaveTypeDistributionRow {
  leave_type_id: number
  leave_type: string
  leave_count: number
  full_day_count: number
  half_day_count: number
}

export interface LeaveHolidayRow {
  id: number
  holiday_name: string
  description?: string | null
  from_date: string | null
  to_date: string | null
  day: string | null
  applicable_year: string | null
  day_type: string | null
  department_ids: number[]
  department_names: string[]
}

export interface LeaveUpcomingHoliday {
  id: number
  name: string
  from_date: string | null
  to_date: string | null
  day: string | null
  day_type: string | null
  department: string | null
}

export interface LeaveBalanceRow {
  leave_type: string
  total: number
  used: number
  remaining: number
}

export interface LeaveBalancesData {
  leave_types: LeaveBalanceRow[]
  overall: { total: number; used: number; remaining: number }
}

export interface LeaveRequestRow {
  id: number
  employee_id: number
  employee_no: string | null
  employee_name: string
  designation: string | null
  email: string | null
  mobile: string | null
  avatar: string | null
  department_id: number
  department: string
  leave_type_id: number
  leave_type: string
  leave_type_code: string | null
  day_type: string | null
  slot: string | null
  session: 'Full Day' | 'Half Day'
  days: number
  duration: string
  from_date: string | null
  to_date: string | null
  status: string
  reason: string | null
  hod_comment: string | null
  hod_comment_date: string | null
  hr_remarks: string | null
  hr_remark_date: string | null
  approver: string | null
  submitted_date: string | null
  updated_date: string | null
}

export interface LeaveRequestComment {
  author: string
  role: string
  body: string
  timestamp: string | null
}

export interface LeaveRequestTimelineEntry {
  stage: string
  status: string
  actor: string | null
  timestamp: string | null
}

export interface LeaveRequestDetail extends LeaveRequestRow {
  balances: LeaveBalanceRow[]
  comments: LeaveRequestComment[]
  timeline: LeaveRequestTimelineEntry[]
}

export interface LeavePagination {
  page: number
  per_page: number
  total: number
  last_page: number
}

export interface LeaveRequestListResponse extends LeaveApiResponse<LeaveRequestRow[]> {
  pagination: LeavePagination
}

export interface LeaveRequestFilters {
  search?: string
  status?: string[]
  departmentId?: string
  leaveTypeId?: string
  employeeId?: string
  fromDate?: string
  toDate?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  page?: number
  perPage?: number
}

export interface LeaveApplyPayload {
  leaveTypeId: string
  dayType: 'full' | 'half'
  fromDate: string
  toDate?: string
  slot?: string
  comment: string
  employeeId?: string
  departmentId?: string
}

export interface LeaveTypeAllocation {
  department_id: number
  department: string
  value: number
}

export interface LeaveTypeConfig {
  id: number
  leave_type_id: string | null
  leave_type: string
  sort_order: number
  carry_forward: boolean
  status: number
  annual_quota: number | null
  annual_quota_varies: boolean
  allocations: LeaveTypeAllocation[]
}

export interface LeaveTypePayload {
  id?: number
  leaveType: string
  sortOrder?: number
  status?: boolean
  carryForward?: boolean
  annualQuota?: string | number | null
  departmentId?: string
}

export interface HolidayPayload {
  holidayName: string
  description?: string
  fromDate: string
  toDate?: string
  dayType?: 'full' | 'half'
  departmentIds?: string[]
}

export interface LeaveWeekday {
  day: string
  label: string
  day_type: 'full' | 'half' | 'weekend'
}

export interface LeaveWorkflowSettings {
  id: number
  reporting_manager_enabled: boolean
  department_head_enabled: boolean
  hr_enabled: boolean
  multi_level_enabled: boolean
  multi_level_count: number
  escalation_enabled: boolean
  escalation_time: number
  escalation_unit: 'hours' | 'days'
  escalate_to: 'department-head' | 'hr' | 'admin'
}

export interface LeaveRolePermission {
  id: number
  role_name: string
  scope: 'Self' | 'Team' | 'Department' | 'Organization'
  approve_leave: boolean
  view_reports: boolean
  configure_settings: boolean
  bulk_operations: boolean
  escalation_rights: boolean
  user_management: boolean
  status: boolean
  sort_order: number
}

export interface LeaveReportSummaryRow {
  leave_type_id: number
  leave_type: string
  leave_type_code: string | null
  total: number
  approved: number
  pending: number
  rejected: number
  cancelled: number
  sent_back: number
  days: number
}

export interface LeaveReportSummaryData {
  rows: LeaveReportSummaryRow[]
  totals: {
    total: number
    approved: number
    pending: number
    rejected: number
    cancelled: number
    sent_back: number
    days: number
  }
  department_breakdown: { department: string; total: number; percentage: number }[]
}

export interface LeaveRegisterRow {
  id: number
  employee_id: number
  employee_no: string | null
  employee_name: string
  department: string
  leave_type: string
  from_date: string | null
  to_date: string | null
  days: number
  duration: string
  status: string
  reason: string | null
  approver: string | null
  submitted_date: string | null
}

export interface LeaveBalanceReportData {
  leave_types: string[]
  rows: {
    employee_id: number
    employee_no: string | null
    employee_name: string
    department: string
    balances: Record<string, { total: number; used: number; remaining: number }>
  }[]
}

export interface LeaveReportFilters {
  fromDate?: string
  toDate?: string
  departmentId?: string
  employeeId?: string
  leaveTypeId?: string
  status?: string[]
  employeeStatus?: 'active' | 'inactive' | 'all'
  limit?: number
}

/** Drops 'all' / '0' / empty so Laravel's filled() checks skip the param. */
function leaveFilter(value?: string | number | null) {
  if (value === undefined || value === null) return undefined
  const normalized = String(value).trim()
  return normalized === '' || normalized === '0' || normalized === 'all' ? undefined : normalized
}

/** Repeatable params go out as `key[0]=a&key[1]=b`, which Laravel reads as an array. */
function leaveListParams(key: string, values?: string[]) {
  if (!values?.length) return {}

  return values.reduce<Record<string, string>>((params, value, index) => {
    const normalized = leaveFilter(value)
    if (normalized) params[`${key}[${index}]`] = normalized
    return params
  }, {})
}

function optionalParam(key: string, value?: string | null) {
  const normalized = leaveFilter(value)
  return normalized ? { [key]: normalized } : {}
}

function leaveReportParams(session: SessionContext, filters?: LeaveReportFilters) {
  return withContextParams(session, {
    ...optionalParam('from_date', filters?.fromDate),
    ...optionalParam('to_date', filters?.toDate),
    ...optionalParam('department_id[0]', filters?.departmentId),
    ...optionalParam('employee_id[0]', filters?.employeeId),
    ...optionalParam('leave_type_id[0]', filters?.leaveTypeId),
    ...leaveListParams('status', filters?.status),
    ...(filters?.employeeStatus ? { employee_status: filters.employeeStatus } : {}),
    ...(filters?.limit ? { limit: String(filters.limit) } : {}),
  })
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const leaveService = {
  // Dashboard
  getDashboard: (session: SessionContext, departmentId?: string) =>
    apiGet<LeaveApiResponse<LeaveDashboardData>>(
      session,
      '/leave/dashboard',
      withContextParams(session, optionalParam('department_id', departmentId)),
    ),
  getTrend: (session: SessionContext, departmentId?: string) =>
    apiGet<LeaveApiResponse<LeaveTrendPoint[]>>(
      session,
      '/leave/trend',
      withContextParams(session, optionalParam('department_id', departmentId)),
    ),
  getDepartmentSummary: (session: SessionContext) =>
    apiGet<LeaveApiResponse<LeaveDepartmentSummaryRow[]>>(
      session,
      '/leave/department-summary',
      withContextParams(session),
    ),
  getTypeDistribution: (session: SessionContext, departmentId?: string) =>
    apiGet<LeaveApiResponse<LeaveTypeDistributionRow[]>>(
      session,
      '/leave/type-distribution',
      withContextParams(session, optionalParam('department_id', departmentId)),
    ),
  getUpcomingHolidays: (session: SessionContext, limit = 5) =>
    apiGet<LeaveApiResponse<LeaveUpcomingHoliday[]>>(
      session,
      '/leave/holidays/upcoming',
      withContextParams(session, { limit: String(limit) }),
    ),

  // Shared lookups
  getOptions: (session: SessionContext, departmentId?: string) =>
    apiGet<LeaveApiResponse<LeaveOptionsData>>(
      session,
      '/leave/options',
      withContextParams(session, optionalParam('department_id', departmentId)),
    ),
  getBalances: (session: SessionContext, employeeId?: string) =>
    apiGet<LeaveApiResponse<LeaveBalancesData>>(
      session,
      '/leave/balances',
      withContextParams(session, optionalParam('employee_id', employeeId)),
    ),

  // Leave requests
  getRequests: (session: SessionContext, filters?: LeaveRequestFilters) =>
    apiGet<LeaveRequestListResponse>(
      session,
      '/leave/requests',
      withContextParams(session, {
        ...(filters?.search ? { search: filters.search } : {}),
        ...leaveListParams('status', filters?.status),
        ...optionalParam('department_id[0]', filters?.departmentId),
        ...optionalParam('leave_type_id[0]', filters?.leaveTypeId),
        ...optionalParam('employee_id[0]', filters?.employeeId),
        ...optionalParam('from_date', filters?.fromDate),
        ...optionalParam('to_date', filters?.toDate),
        ...(filters?.sortBy ? { sort_by: filters.sortBy } : {}),
        ...(filters?.sortDir ? { sort_dir: filters.sortDir } : {}),
        page: String(filters?.page ?? 1),
        per_page: String(filters?.perPage ?? 10),
      }),
    ),
  getRequest: (session: SessionContext, id: number | string) =>
    apiGet<LeaveApiResponse<LeaveRequestDetail>>(
      session,
      `/leave/requests/${id}`,
      withContextParams(session),
    ),
  applyLeave: (session: SessionContext, payload: LeaveApplyPayload) =>
    apiPost<LeaveApiResponse<{ id: number }>>(session, '/leave/requests', {
      ...withContextParams(session),
      leave_type_id: payload.leaveTypeId,
      day_type: payload.dayType,
      from_date: payload.fromDate,
      to_date: payload.dayType === 'half' ? payload.fromDate : payload.toDate,
      ...(payload.dayType === 'half' && payload.slot ? { slot: payload.slot } : {}),
      comment: payload.comment,
      ...optionalParam('employee_id', payload.employeeId),
      ...optionalParam('department_id', payload.departmentId),
    }),
  decideRequest: (
    session: SessionContext,
    id: number | string,
    payload: { status: LeaveStatus; hodComment?: string; hrRemarks?: string },
  ) =>
    apiPost<LeaveApiResponse<null> & { updated_count: number }>(
      session,
      `/leave/requests/${id}/decision`,
      {
        ...withContextParams(session),
        status: payload.status,
        ...(payload.hodComment ? { hod_comment: payload.hodComment } : {}),
        ...(payload.hrRemarks ? { hr_remarks: payload.hrRemarks } : {}),
      },
    ),
  bulkDecideRequests: (
    session: SessionContext,
    payload: { ids: (number | string)[]; status: LeaveStatus; hodComment?: string; hrRemarks?: string },
  ) =>
    apiPost<LeaveApiResponse<null> & { updated_count: number }>(
      session,
      '/leave/requests/bulk-decision',
      {
        ...withContextParams(session),
        ids: payload.ids.map((id) => Number(id)),
        status: payload.status,
        // Keyed by id because Laravel writes each remark against its own record.
        ...(payload.hodComment
          ? { hod_comment: Object.fromEntries(payload.ids.map((id) => [id, payload.hodComment])) }
          : {}),
        ...(payload.hrRemarks
          ? { hr_remarks: Object.fromEntries(payload.ids.map((id) => [id, payload.hrRemarks])) }
          : {}),
      },
    ),
  withdrawRequest: (session: SessionContext, id: number | string) =>
    apiDelete<LeaveApiResponse<null>>(session, `/leave/requests/${id}`, withContextParams(session)),

  // Reports
  getReportSummary: (session: SessionContext, filters?: LeaveReportFilters) =>
    apiGet<LeaveApiResponse<LeaveReportSummaryData>>(
      session,
      '/leave/reports/summary',
      leaveReportParams(session, filters),
    ),
  getReportRegister: (session: SessionContext, filters?: LeaveReportFilters) =>
    apiGet<LeaveApiResponse<LeaveRegisterRow[]>>(
      session,
      '/leave/reports/register',
      leaveReportParams(session, filters),
    ),
  getReportBalance: (session: SessionContext, filters?: LeaveReportFilters) =>
    apiGet<LeaveApiResponse<LeaveBalanceReportData>>(
      session,
      '/leave/reports/balance',
      leaveReportParams(session, filters),
    ),

  // Configuration - leave types
  getLeaveTypes: (session: SessionContext) =>
    apiGet<LeaveApiResponse<LeaveTypeConfig[]>>(session, '/leave/leave-types', withContextParams(session)),
  saveLeaveType: (session: SessionContext, payload: LeaveTypePayload) => {
    const quota = payload.annualQuota
    // 'Unlimited' and friends are not a number - only send a real quota.
    const hasQuota =
      quota !== undefined && quota !== null && String(quota).trim() !== '' && Number.isFinite(Number(quota))

    const body = {
      ...withContextParams(session),
      leave_type: payload.leaveType,
      sort_order: payload.sortOrder ?? 0,
      status: payload.status === false ? 0 : 1,
      carry_forward: payload.carryForward ? 1 : 0,
      ...(hasQuota ? { annual_quota: Number(quota) } : {}),
      ...optionalParam('department_id', payload.departmentId),
    }

    return payload.id
      ? apiPut<LeaveApiResponse<{ id: number }>>(session, `/leave/leave-types/${payload.id}`, body)
      : apiPost<LeaveApiResponse<{ id: number }>>(session, '/leave/leave-types', body)
  },
  toggleLeaveTypeStatus: (session: SessionContext, id: number | string, status: boolean) =>
    apiPatch<LeaveApiResponse<{ id: number; status: number }>>(
      session,
      `/leave/leave-types/${id}/status`,
      { ...withContextParams(session), status: status ? 1 : 0 },
    ),
  deleteLeaveType: (session: SessionContext, id: number | string) =>
    apiDelete<LeaveApiResponse<null>>(session, `/leave/leave-types/${id}`, withContextParams(session)),

  // Configuration - holidays
  getHolidays: (session: SessionContext, params?: { calendarYear?: string; departmentId?: string }) =>
    apiGet<LeaveApiResponse<LeaveHolidayRow[]>>(
      session,
      '/leave/holidays',
      withContextParams(session, {
        ...optionalParam('calendar_year', params?.calendarYear),
        ...optionalParam('department_id', params?.departmentId),
      }),
    ),
  saveHoliday: (session: SessionContext, payload: HolidayPayload, id?: number | string) => {
    const body = {
      ...withContextParams(session),
      holiday_name: payload.holidayName,
      description: payload.description ?? '',
      from_date: payload.fromDate,
      to_date: payload.toDate ?? payload.fromDate,
      day_type: payload.dayType ?? 'full',
      department: payload.departmentIds ?? [],
    }

    return id
      ? apiPut<LeaveApiResponse<{ id: number }>>(session, `/leave/holidays/${id}`, body)
      : apiPost<LeaveApiResponse<{ id: number }>>(session, '/leave/holidays', body)
  },
  deleteHoliday: (session: SessionContext, id: number | string) =>
    apiDelete<LeaveApiResponse<null>>(session, `/leave/holidays/${id}`, withContextParams(session)),

  // Configuration - weekly off pattern
  getWeekdays: (session: SessionContext) =>
    apiGet<LeaveApiResponse<LeaveWeekday[]>>(session, '/leave/weekdays', withContextParams(session)),
  saveWeekdays: (session: SessionContext, weekdays: Record<string, string>) =>
    apiPost<LeaveApiResponse<null>>(session, '/leave/weekdays', {
      ...withContextParams(session),
      ...weekdays,
    }),

  // Configuration - approval workflow and role access
  getWorkflow: (session: SessionContext) =>
    apiGet<LeaveApiResponse<LeaveWorkflowSettings>>(session, '/leave/workflow', withContextParams(session)),
  saveWorkflow: (session: SessionContext, settings: Omit<LeaveWorkflowSettings, 'id'>) =>
    apiPut<LeaveApiResponse<LeaveWorkflowSettings>>(session, '/leave/workflow', {
      ...withContextParams(session),
      reporting_manager_enabled: settings.reporting_manager_enabled ? 1 : 0,
      department_head_enabled: settings.department_head_enabled ? 1 : 0,
      hr_enabled: settings.hr_enabled ? 1 : 0,
      multi_level_enabled: settings.multi_level_enabled ? 1 : 0,
      multi_level_count: settings.multi_level_count,
      escalation_enabled: settings.escalation_enabled ? 1 : 0,
      escalation_time: settings.escalation_time,
      escalation_unit: settings.escalation_unit,
      escalate_to: settings.escalate_to,
    }),
  getRoles: (session: SessionContext) =>
    apiGet<LeaveApiResponse<LeaveRolePermission[]>>(session, '/leave/roles', withContextParams(session)),
  saveRoles: (session: SessionContext, roles: LeaveRolePermission[]) =>
    apiPut<LeaveApiResponse<LeaveRolePermission[]>>(session, '/leave/roles', {
      ...withContextParams(session),
      roles: roles.map((role) => ({
        id: role.id,
        role_name: role.role_name,
        scope: role.scope,
        approve_leave: role.approve_leave ? 1 : 0,
        view_reports: role.view_reports ? 1 : 0,
        configure_settings: role.configure_settings ? 1 : 0,
        bulk_operations: role.bulk_operations ? 1 : 0,
        escalation_rights: role.escalation_rights ? 1 : 0,
        user_management: role.user_management ? 1 : 0,
        status: role.status ? 1 : 0,
        sort_order: role.sort_order,
      })),
    }),
}
