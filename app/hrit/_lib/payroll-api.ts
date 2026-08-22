'use client';

/**
 * HRIT Payroll API client.
 *
 * Ported from G2G's `services/hrms/payroll.ts` — backed by the legacy Laravel
 * payroll routes registered in `routes/hrms.php`
 * (App\Http\Controllers\Payroll\PayrollController). These are legacy web
 * routes, not `/api/*` REST routes (G2G reached them via `webClient`), so
 * every call here hits `${session.baseUrl}${path}` with no `/api` prefix.
 * Endpoint paths, HTTP methods, query params/form fields and response shapes
 * are kept exactly as in G2G. Only the transport changed: native `fetch` +
 * this project's `buildSessionContext()` / `createAuthHeaders()`
 * (see `lib/erp-client.ts`) instead of G2G's `webClient` + `LaravelContext`.
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

async function webRequest<T>(
  session: SessionContext,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown | FormData
): Promise<T> {
  const url = `${session.baseUrl}${path}`;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  const response = await fetch(url, {
    method,
    cache: 'no-store',
    headers: createAuthHeaders(session, isForm || body === undefined ? undefined : 'application/json'),
    body: isForm ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw new Error(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`));
  }

  return payload as T;
}

const webGet = <T,>(session: SessionContext, pathWithQuery: string) => webRequest<T>(session, 'GET', pathWithQuery);
const webPost = <T,>(session: SessionContext, path: string, body: unknown) => webRequest<T>(session, 'POST', path, body);
const webPostForm = <T,>(session: SessionContext, path: string, form: FormData) => webRequest<T>(session, 'POST', path, form);

/**
 * REST `/api/*` GET - only `organizationService.getDepartmentsManagement`
 * (below) needs this; every other payroll endpoint is a legacy web route.
 */
async function apiGet<T>(session: SessionContext, path: string, params: Record<string, string | undefined> = {}): Promise<T> {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, value);
  });
  const url = `${session.baseUrl}/api${path}${search.toString() ? `?${search.toString()}` : ''}`;
  const response = await fetch(url, { method: 'GET', cache: 'no-store', headers: createAuthHeaders(session) });
  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
    throw new Error(messageFrom(payload, `API Error: ${response.status} ${response.statusText}`));
  }
  return payload as T;
}

/** True once a session has the bare minimum a payroll call needs to not 401. */
export function isPayrollSessionReady(session: SessionContext): boolean {
  return Boolean(session.token && session.subInstituteId);
}

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

/** A payroll_types row exactly as PayrollController@payrollType returns it. */
export interface LaravelPayrollType {
  id: number | string
  /** 1 = Earning, 2 = Deduction */
  payroll_type: number | string | null
  payroll_name: string | null
  /** 1 = Flat, 2 = Percentage */
  amount_type: number | string | null
  /** 1 = Active, 0 = Inactive */
  status: number | string | null
  sort_order: number | string | null
  sub_institute_id: number | string | null
  /**
   * Holds the flat amount *and* the percentage - payroll_types has a single
   * column for both, selected by amount_type.
   */
  payroll_percentage: number | string | null
  /** char(1): '1' when the component is pro-rated by attended days. */
  day_count: number | string | null
  created_by?: number | string | null
  updated_by?: number | string | null
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

/** GET /payroll-type - is_mobile() wraps the collection in a `data` key. */
export interface PayrollTypeListResponse {
  data?: LaravelPayrollType[]
}

/** payrollStore and payrollDestroy both answer with this envelope. */
export interface PayrollStatusResponse {
  status_code?: number | string
  status?: number | string
  message?: string
}

export type PayrollTypeKind = 'Earning' | 'Deduction'
export type PayrollAmountType = 'Flat' | 'Percentage'
export type PayrollTypeStatus = 'Active' | 'Inactive'

/** The row shape the Payroll Type screen renders. */
export interface PayrollTypeRow {
  id: number
  srNo: number
  kind: PayrollTypeKind
  name: string
  amountType: PayrollAmountType
  /** null when the backend has no value - rendered as a dash, never as 0. */
  amountOrPercentage: number | null
  dayCount: boolean
  status: PayrollTypeStatus
  sortOrder: number | null
}

/**
 * payrollStore overwrites every column from the request, so a save always sends
 * the complete row - a partial payload would blank the omitted fields.
 */
export interface PayrollTypePayload {
  /** Present = update (Laravel branches on `$request->id > 0`), absent = create. */
  id?: number | null
  kind: PayrollTypeKind
  name: string
  amountType: PayrollAmountType
  amountOrPercentage: string
  dayCount: boolean
  status: PayrollTypeStatus
  sortOrder?: string
}

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Laravel stores these as ints, tinyints and char(1) - compare as strings. */
function isFlag(value: number | string | null | undefined): boolean {
  return String(value ?? '') === '1'
}

/**
 * Maps one Laravel row onto the view model. `srNo` is positional, matching the
 * legacy screen: payroll_types has no display-index column of its own.
 */
export function normalizePayrollType(item: LaravelPayrollType, index: number): PayrollTypeRow {
  return {
    id: Number(item.id),
    srNo: index + 1,
    kind: isFlag(item.payroll_type) ? 'Earning' : 'Deduction',
    name: item.payroll_name ?? '',
    amountType: isFlag(item.amount_type) ? 'Flat' : 'Percentage',
    amountOrPercentage: toNullableNumber(item.payroll_percentage),
    dayCount: isFlag(item.day_count),
    status: isFlag(item.status) ? 'Active' : 'Inactive',
    sortOrder: toNullableNumber(item.sort_order),
  }
}

/** Rebuilds a save payload from an existing row, for row actions like the status toggle. */
export function payrollTypeToPayload(row: PayrollTypeRow): PayrollTypePayload {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    amountType: row.amountType,
    amountOrPercentage: row.amountOrPercentage === null ? '' : String(row.amountOrPercentage),
    dayCount: row.dayCount,
    status: row.status,
    sortOrder: row.sortOrder === null ? '' : String(row.sortOrder),
  }
}

/* ------------------------------------------------------------------ *
 * Shared shapes across the payroll screens
 * ------------------------------------------------------------------ */

/** One row of the employeeDetails() helper (app/Helpers/helpers.php). */
export interface LaravelPayrollEmployee {
  id: number | string
  employee_no?: string | null
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  gender?: string | null
  department?: string | null
  department_id?: number | string | null
  user_profile?: string | null
  status?: number | string | null
  pf_deduction?: string | null
  pt_deduction?: string | null
  join_year?: string | number | null
}

/**
 * Departments for the payroll filters and the department employee picker.
 *
 * Ported from G2G's `services/organization` (`getDepartmentsManagement`,
 * `getEmployeesByDepartment`) - not part of the payroll controller, but every
 * payroll screen's department/employee pickers depend on it, so it is added
 * here rather than a separate organization API module.
 */
export interface LaravelDepartment {
  id: number
  department: string
  parent_id?: number | null
  status?: number | null
}

export interface DepartmentsManagementResponse {
  main_departments: LaravelDepartment[]
  sub_departments: Record<string, LaravelDepartment[]>
}

/**
 * Laravel serialises an empty keyed Collection as `[]` and a populated one as an
 * object, so every "map" the payroll controller returns has to be narrowed
 * before use.
 */
export function toRecord<V>(value: Record<string, V> | unknown[] | null | undefined): Record<string, V> {
  if (!value || Array.isArray(value)) return {}
  return value
}

/**
 * `->where()` on a Collection preserves the original keys, so several payroll
 * responses arrive as objects where an array is expected.
 */
export function toList<T>(value: T[] | Record<string, T> | null | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : Object.values(value)
}

/**
 * Builds a query string carrying the Laravel context plus scalars and PHP-style
 * `name[0]`, `name[1]` array params. URLSearchParams via webClient.get cannot
 * express the array form, so these endpoints take a pre-built query string.
 */
function payrollQuery(
  session: SessionContext,
  params: Record<string, string | number | undefined | null> = {},
  arrays: Record<string, Array<string | number>> = {},
) {
  const search = new URLSearchParams(
    Object.fromEntries(
      Object.entries(withContextParams(session)).filter(([, v]) => v !== undefined) as [string, string][]
    )
  )

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })

  Object.entries(arrays).forEach(([key, values]) => {
    values.forEach((value, index) => search.append(`${key}[${index}]`, String(value)))
  })

  return search.toString()
}

/* ------------------------------------------------------------------ *
 * Salary Structure - /employee-salary-structure
 * ------------------------------------------------------------------ */

export interface SalaryStructureQuery {
  year: string
  /** '1' active, '0' inactive; omitted means the controller's default of active. */
  employeeStatus?: string
  employeeIds?: Array<string | number>
  departmentIds?: Array<string | number>
}

export interface SalaryStructureResponse {
  employees?: LaravelPayrollEmployee[]
  employeeLists?: LaravelPayrollEmployee[]
  payrollTypes?: LaravelPayrollType[]
  /** employee_id -> { payroll_type_id: amount } */
  employeeSalaryStructures?: Record<string, Record<string, number | string>> | unknown[]
  emp_status?: number | string
}

export interface SalaryStructureSavePayload {
  year: string
  payrollTypes: LaravelPayrollType[]
  employees: Array<{
    employeeId: number | string
    gender: string
    /** payroll_type_id (as string) -> amount */
    values: Record<string, number>
  }>
}

/* ------------------------------------------------------------------ *
 * Payroll Deduction - /payroll-deduction
 * ------------------------------------------------------------------ */

export interface PayrollDeductionQuery {
  /** The payroll type id, not the 1/2 category - see getPayrollDeductions. */
  payrollTypeId: string | number
  /** Three-letter month as produced by Helpers::getMonths() - 'Apr', 'May', ... */
  month: string
  year: string
}

export interface PayrollDeductionOption {
  id: number | string
  payroll_name: string
}

export interface PayrollDeductionResponse {
  selMonth?: string
  selYear?: string | number
  selDeduction?: string | number
  selType?: string | number
  all_emp?: LaravelPayrollEmployee[]
  /** employee_id -> saved amount for the queried month/year/payroll type. */
  deductionArr?: Record<string, number | string> | unknown[]
  /** '1' (earnings) and '2' (deductions) -> the active payroll types in each. */
  payrollTypes?: Record<string, PayrollDeductionOption[]> | unknown[]
  months?: string[]
  years?: Array<number | string>
}

export interface PayrollDeductionSavePayload {
  payrollTypeId: string | number
  month: string
  year: string
  amounts: Array<{ employeeId: number | string; amount: number | string }>
}

/* ------------------------------------------------------------------ *
 * Monthly Payroll - /monthly-payroll/*
 * ------------------------------------------------------------------ */

export interface MonthlyPayrollQuery {
  month: string
  year: string
  /** Non-admin profiles are narrowed to their subordinates by employeeDetails(). */
  userProfileName?: string
  employeeIds?: Array<string | number>
  departmentIds?: Array<string | number>
}

/** A previously saved employee_monthly_salary_data row. */
export interface MonthlyPayrollSavedRow {
  id: number | string
  month?: string | null
  year?: number | string | null
  employee_id?: number | string | null
  total_deduction?: number | string | null
  total_payment?: number | string | null
  received_by?: string | null
  total_day?: number | string | null
  employee_salary_data?: string | null
}

export interface MonthlyPayrollEmployee extends LaravelPayrollEmployee {
  /** Attended days: from the saved row when present, else attendance-derived. */
  totalDay?: number | string | null
  json?: string | null
  monthlyData?: MonthlyPayrollSavedRow | null
}

export interface MonthlyPayrollCreateResponse {
  /** payroll_type_id -> name, plus the total_deduction/total_payment/received_by labels. */
  header?: Record<string, string> | unknown[]
  employeeDetails?: MonthlyPayrollEmployee[]
  months?: string[]
  years?: Record<string, string> | unknown[]
  selYear?: string | number
  selMonth?: string
  status?: number | string
  message?: string
}

export interface MonthlyBreakdownQuery {
  employeeId: number | string
  totalDay: number | string
  month: string
  year: string
}

export interface MonthlySalaryBreakdownResponse {
  /** payroll_type_id -> amount, plus total_deduction and total_payment. */
  salaryData?: Record<string, number | string>
  totalDay?: number | string
  allowanceTypes?: Array<Record<string, string>>
  deductionTypes?: Array<Record<string, string>>
  /** getEmpMonthlyData returns its array raw, so this stays `status_code`. */
  status_code?: number | string
  message?: string
}

export interface MonthlyPayrollSaveRow {
  employeeId: number | string
  totalDay: number | string
  totalDeduction: number | string
  totalPayment: number | string
  receivedBy: string
  /** payroll_type_id -> amount; stored verbatim as employee_salary_data. */
  payrollHead: Record<string, number>
}

export interface MonthlyPayrollSavePayload {
  month: string
  year: string
  rows: MonthlyPayrollSaveRow[]
}

/* ------------------------------------------------------------------ *
 * Form 16 - /form16-report
 * ------------------------------------------------------------------ */

export interface Form16Query {
  year: string
  departmentId: string | number
  employeeId: string | number
  allowanceIds?: Array<string | number>
  deductionIds?: Array<string | number>
}

export interface Form16SchoolDetail {
  SchoolName?: string | null
  Address?: string | null
  City?: string | null
  State?: string | null
  Zipcode?: string | null
  pan_no?: string | null
  tan_no?: string | null
  [key: string]: unknown
}

export interface Form16EmployeeDetail {
  id?: number | string
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  employee_no?: string | null
  pan_no?: string | null
  join_year?: string | number | null
  [key: string]: unknown
}

export interface Form16ReportResponse {
  payrollTypes?: LaravelPayrollType[] | Record<string, LaravelPayrollType>
  allowance?: LaravelPayrollType[] | Record<string, LaravelPayrollType>
  deduction?: LaravelPayrollType[] | Record<string, LaravelPayrollType>
  /** null when the employee has no structure for the year - see `message`. */
  get_employee_salary?: { employee_salary_data?: string | null } | null
  get_school_detail?: Form16SchoolDetail | null
  get_employee_detail?: Form16EmployeeDetail | null
  from_date?: string
  to_date?: string
  department_name?: { department_name?: string | null } | null
  year?: string | number
  employee_id?: string | number
  department_id?: string | number
  selected_allowances?: Array<string | number>
  selected_deductions?: Array<string | number>
  status?: number | string
  message?: string
}

/* ------------------------------------------------------------------ *
 * Salary Certificate - /hrms-salary-certificate*
 * ------------------------------------------------------------------ */

export interface SalaryCertificateIndexResponse {
  employee_id?: string | number | null
  /** '1' -> 'Jan' ... '12' -> 'Dec' */
  month_ids?: Record<string, string>
  departments?: Record<string, string> | unknown[]
  years?: Array<number | string>
  year?: string | number
  /** Earning heads only - the controller filters payroll_type = 1. */
  payrollTypes?: LaravelPayrollType[]
}

export interface SalaryCertificateQuery {
  departmentId: string | number
  employeeId: string | number
  year: string
  monthIds: Array<string | number>
  payrollTypeIds: Array<string | number>
  reason?: string
}

export interface SalaryCertificateReportResponse {
  pdfName?: string
  employees?: LaravelPayrollEmployee[]
  employee_id?: string | number
  department_id?: string | number
  year?: string | number
  selMonths?: Array<string | number>
  payroll_type_ids?: Array<string | number>
  reason?: string | null
  departments?: Record<string, string> | unknown[]
  department_name?: { department_name?: string | null } | null
  payrollTypes?: LaravelPayrollType[]
  month_ids?: Record<string, string>
  years?: Array<number | string>
  status?: number | string
  message?: string
}

/**
 * These controller actions authenticate off the request body, so the context
 * travels in the FormData rather than the query string.
 */
function payrollFormData(session: SessionContext, fields: Record<string, string> = {}) {
  const formData = new FormData()
  formData.append('type', 'API')
  formData.append('token', session.token)
  formData.append('sub_institute_id', session.subInstituteId)
  formData.append('user_id', session.userId)

  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value)
  })

  return formData
}

/**
 * payrollStore/payrollDestroy answer 200 with status_code 0 on failure, so a
 * non-throwing fetch is not enough to call it a success.
 */
async function ensurePayrollSuccess(request: Promise<PayrollStatusResponse>, fallback: string) {
  const response = await request
  const status = response.status_code ?? response.status

  if (String(status) === '0') {
    throw new Error(response.message || fallback)
  }

  return { message: response.message || fallback }
}

export const payrollService = {
  /**
   * Returns every non-soft-deleted payroll type for the tenant. The legacy
   * `status=1` query param is deliberately omitted: payrollType() ignores it and
   * always returns active and inactive rows, which is what the screen filters on.
   */
  getPayrollTypes: (session: SessionContext) =>
    webGet<PayrollTypeListResponse>(session, `/payroll-type?${payrollQuery(session)}`),

  /** Upsert - Laravel treats a positive `id` as an update of that row. */
  savePayrollType: (session: SessionContext, payload: PayrollTypePayload) =>
    ensurePayrollSuccess(
      webPostForm<PayrollStatusResponse>(
        session,
        '/payroll-type/store',
        payrollFormData(session, {
          payroll_type: payload.kind === 'Earning' ? '1' : '2',
          payroll_name: payload.name,
          amount_type: payload.amountType === 'Flat' ? '1' : '2',
          payroll_percentage: payload.amountOrPercentage,
          status: payload.status === 'Active' ? '1' : '0',
          day_count: payload.dayCount ? '1' : '0',
          ...(payload.sortOrder ? { sort_order: payload.sortOrder } : {}),
          ...(payload.id ? { id: String(payload.id) } : {}),
        }),
      ),
      payload.id ? 'Payroll type updated successfully.' : 'Payroll type added successfully.',
    ),

  /** Soft delete - the controller stamps deleted_at/deleted_by, it does not purge. */
  deletePayrollType: (session: SessionContext, id: number | string) =>
    ensurePayrollSuccess(
      webPostForm<PayrollStatusResponse>(
        session,
        `/payroll-type/destroy/${id}`,
        payrollFormData(session),
      ),
      'Payroll type deleted successfully.',
    ),

  /* ---------------- Salary Structure ---------------- */

  /**
   * GET /employee-salary-structure - PayrollController@employeeSalaryStructure.
   * `employeeLists` is the full picker list, `employees` the filtered result and
   * `employeeSalaryStructures` the saved amounts keyed by employee then payroll type.
   */
  getSalaryStructure: (session: SessionContext, params: SalaryStructureQuery) =>
    webGet<SalaryStructureResponse>(
      session,
      `/employee-salary-structure?${payrollQuery(
        session,
        { syear: params.year, emp_status: params.employeeStatus },
        { employee_id: params.employeeIds ?? [], department_id: params.departmentIds ?? [] },
      )}`,
    ),

  /**
   * POST /employee-salary-structure/store.
   *
   * The controller reads `emp[employeeId][0]` as the gender and
   * `emp[employeeId][payrollTypeId][0..3]` as [id, amount, name, payroll_type];
   * it re-derives PF/PT from the payroll type config, so the name and type parts
   * are load-bearing, not decoration.
   */
  saveSalaryStructure: (session: SessionContext, payload: SalaryStructureSavePayload) => {
    const formData = payrollFormData(session, { syear: payload.year })

    payload.employees.forEach((employee) => {
      formData.append(`emp[${employee.employeeId}][0]`, employee.gender ?? '')

      payload.payrollTypes.forEach((payrollType) => {
        const key = `emp[${employee.employeeId}][${payrollType.id}]`
        formData.append(`${key}[0]`, String(payrollType.id))
        formData.append(`${key}[1]`, String(employee.values[String(payrollType.id)] ?? 0))
        formData.append(`${key}[2]`, payrollType.payroll_name ?? '')
        formData.append(`${key}[3]`, String(payrollType.payroll_type ?? ''))
      })
    })

    return ensurePayrollSuccess(
      webPostForm<PayrollStatusResponse>(session, '/employee-salary-structure/store', formData),
      'Salary structure saved successfully.',
    )
  },

  /**
   * POST /rollover-employee-salary-structure/store - copies each selected
   * employee's structure from `year` into year + 1. This action answers with a
   * plain `status` key rather than `status_code`.
   */
  rolloverSalaryStructure: (
    session: SessionContext,
    params: { year: string; employeeIds?: Array<string | number>; departmentIds?: Array<string | number> },
  ) =>
    ensurePayrollSuccess(
      webPostForm<PayrollStatusResponse>(
        session,
        `/rollover-employee-salary-structure/store?${payrollQuery(
          session,
          { year: params.year },
          { employee_id: params.employeeIds ?? [], department_id: params.departmentIds ?? [] },
        )}`,
        new FormData(),
      ),
      'Salary structures rolled over successfully.',
    ),

  /* ---------------- Payroll Deduction ---------------- */

  /**
   * GET /payroll-deduction - PayrollController@payrollDeduction.
   *
   * The controller's saved-amount lookup (`checkArr['deduction_type']`) is built
   * from `$request->payroll_type`, not `$request->deduction_type` - the latter
   * only ever lands in the unused `selDeduction` response field. So the payroll
   * type *id* must be sent as `payroll_type` here, or previously saved amounts
   * never match and the Amount column always starts blank.
   */
  getPayrollDeductions: (session: SessionContext, params: PayrollDeductionQuery) =>
    webGet<PayrollDeductionResponse>(
      session,
      `/payroll-deduction?${payrollQuery(session, {
        status: '1',
        submit: 'Search',
        payroll_type: params.payrollTypeId,
        month: params.month,
        year: params.year,
      })}`,
    ),

  /**
   * POST /payroll-deduction/store.
   *
   * The controller writes `deduction_type` from the request's `payroll_type`, so
   * this must carry the payroll type *id* for the row to be found again by
   * getPayrollDeductions and by the Monthly Payroll calculation. (The legacy
   * screen sent the 1/2 category here, which is why its saved amounts never
   * reappeared.) `deductAmt` is iterated without a null guard server side, so at
   * least one entry is always sent.
   */
  savePayrollDeductions: (session: SessionContext, payload: PayrollDeductionSavePayload) => {
    const formData = payrollFormData(session, {
      payroll_type: String(payload.payrollTypeId),
      deduction_type_id: String(payload.payrollTypeId),
      month: payload.month,
      year: payload.year,
    })

    payload.amounts.forEach((entry) => {
      formData.append(`deductAmt[${entry.employeeId}]`, String(entry.amount))
    })

    return ensurePayrollSuccess(
      webPostForm<PayrollStatusResponse>(session, '/payroll-deduction/store', formData),
      'Deduction amounts saved successfully.',
    )
  },

  /* ---------------- Monthly Payroll ---------------- */

  /**
   * GET /monthly-payroll/create - PayrollController@monthlyPayrollCreate.
   * Returns each employee with their already-saved `monthlyData` row (if any)
   * and the attendance-derived `totalDay` when nothing is saved yet.
   */
  getMonthlyPayroll: (session: SessionContext, params: MonthlyPayrollQuery) =>
    webGet<MonthlyPayrollCreateResponse>(
      session,
      `/monthly-payroll/create?${payrollQuery(
        session,
        {
          month: params.month,
          year: params.year,
          user_profile_name: params.userProfileName,
        },
        { emp_id: params.employeeIds ?? [], department_id: params.departmentIds ?? [] },
      )}`,
    ),

  /**
   * GET /getMonthlyData - recomputes one employee's payslip lines for a given
   * number of attended days. Returns `status_code: 0` (not `status`) when the
   * employee has no salary structure for the year.
   */
  getMonthlySalaryBreakdown: (session: SessionContext, params: MonthlyBreakdownQuery) =>
    webGet<MonthlySalaryBreakdownResponse>(
      session,
      `/getMonthlyData?${payrollQuery(session, {
        emp_id: params.employeeId,
        totalDay: params.totalDay,
        month: params.month,
        year: params.year,
      })}`,
    ),

  /**
   * POST /monthly-payroll-store.
   *
   * The controller INSERTs unconditionally - it has no upsert - so only rows
   * without an existing monthlyData record may be submitted, otherwise the month
   * gets duplicate payslips.
   */
  saveMonthlyPayroll: (session: SessionContext, payload: MonthlyPayrollSavePayload) =>
    ensurePayrollSuccess(
      webPost<PayrollStatusResponse>(session, '/monthly-payroll-store', {
        ...withContextParams(session),
        month: payload.month,
        year: payload.year,
        payrollVal: Object.fromEntries(
          payload.rows.map((row) => [
            String(row.employeeId),
            {
              total_day: row.totalDay,
              total_deduction: row.totalDeduction,
              total_payment: row.totalPayment,
              received_by: row.receivedBy,
              payrollHead: row.payrollHead,
            },
          ]),
        ),
      }),
      'Monthly payroll saved successfully.',
    ),

  /**
   * POST /monthly-payroll-delete/{month}.
   *
   * `deleteId` entries must be `"<employee_monthly_salary_data.id>###<employee_id>"`.
   * Sending a bare employee id (as the legacy screen did) makes the controller
   * treat it as the salary-data row id and delete an unrelated payslip.
   */
  deleteMonthlyPayroll: (
    session: SessionContext,
    params: { month: string; year: string; entries: Array<{ dataId: number | string; employeeId: number | string }> },
  ) =>
    ensurePayrollSuccess(
      webPostForm<PayrollStatusResponse>(
        session,
        `/monthly-payroll-delete/${params.month}?${payrollQuery(
          session,
          { month: params.month, year: params.year },
          { deleteId: params.entries.map((entry) => `${entry.dataId}###${entry.employeeId}`) },
        )}`,
        new FormData(),
      ),
      'Payroll record deleted successfully.',
    ),

  /* ---------------- Form 16 ---------------- */

  /**
   * POST /form16-report - PayrollController@form16Report.
   *
   * GET /form16 (the index that would supply the allowance/deduction pickers)
   * calls an undefined `jwtToken()` helper and fatals under `type=API`, so the
   * pickers are fed from GET /payroll-type instead and only the report call is
   * used here.
   */
  getForm16Report: (session: SessionContext, params: Form16Query) =>
    webPostForm<Form16ReportResponse>(
      session,
      `/form16-report?${payrollQuery(
        session,
        {
          syear: params.year,
          year: params.year,
          department_id: params.departmentId,
          emp_id: params.employeeId,
        },
        { allowance: params.allowanceIds ?? [], deduction: params.deductionIds ?? [] },
      )}`,
      new FormData(),
    ),

  /* ---------------- Salary Certificate ---------------- */

  /** GET /hrms-salary-certificate - departments, years, months and earning heads. */
  getSalaryCertificateOptions: (session: SessionContext) =>
    webGet<SalaryCertificateIndexResponse>(
      session,
      `/hrms-salary-certificate?${payrollQuery(session)}`,
    ),

  /**
   * POST /hrms-salary-certificate-report - renders the certificate HTML and
   * upserts it into hrms_salary_certificate. The PDF is then streamed by
   * salaryCertificatePdfUrl().
   */
  generateSalaryCertificate: (session: SessionContext, params: SalaryCertificateQuery) =>
    webPostForm<SalaryCertificateReportResponse>(
      session,
      `/hrms-salary-certificate-report?${payrollQuery(
        session,
        {
          department_id: params.departmentId,
          employee_id: params.employeeId,
          year: params.year,
          reason: params.reason,
        },
        { month_id: params.monthIds, payroll_type_id: params.payrollTypeIds },
      )}`,
      new FormData(),
    ),

  /* ---------------- Departments / employees (organizationService) ---------------- */

  /** GET /api/departments-management - scoped to the caller's sub_institute. */
  getDepartmentsManagement: (session: SessionContext) =>
    apiGet<DepartmentsManagementResponse>(session, '/departments-management', {
      sub_institute_id: session.subInstituteId,
      ...(session.token ? { type: 'api', token: session.token } : {}),
    }),

  /**
   * GET /table_data - the generic tbluser lookup the Form 16 and Salary
   * Certificate employee pickers use. The token is required: tbluser holds
   * credentials, so this route 401s for an anonymous caller regardless of
   * tenant. sub_institute_id is still sent for older backends, but the server
   * derives the tenant from the token.
   */
   getEmployeesByDepartment: (session: SessionContext, departmentId: string) =>
     webGet<LaravelPayrollEmployee[]>(
       session,
       `/table_data?${new URLSearchParams({
         table: 'tbluser',
         token: session.token,
         'filters[sub_institute_id]': session.subInstituteId,
         'filters[department_id]': departmentId,
         'filters[status]': '1',
         'order_by[column]': 'first_name',
         'order_by[direction]': 'asc',
       }).toString()}`,
     ),
}

/**
 * GET /salary-certificate-pdf-download streams a PDF attachment rather than
 * JSON, so it is opened directly instead of going through the fetch client.
 */
export function salaryCertificatePdfUrl(
  session: SessionContext,
  params: { employeeId: string | number; year: string | number },
) {
  const query = payrollQuery(session, { employee_id: params.employeeId, year: params.year })
  return `${session.baseUrl}/salary-certificate-pdf-download?${query}`
}

/**
 * GET /monthly-payroll-report/pdf/{id}/{month}/{year} - the payslip Laravel
 * generates and files under the employee's staff documents on save.
 */
export function monthlyPayslipPdfUrl(
  session: SessionContext,
  params: { employeeId: string | number; month: string; year: string | number },
) {
  const query = payrollQuery(session)
  return `${session.baseUrl}/monthly-payroll-report/pdf/${params.employeeId}/${params.month}/${params.year}?${query}`
}
