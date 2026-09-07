'use client'

import * as React from 'react'
import { EnhancedAttendanceFilters } from '@/app/hrit/attendance-management/_shared/enhanced-attendance-filters'
import { AttendanceReportTable } from './components/AttendanceReportTable'
import { savedReports, type EarlyGoingRecord } from './services/report-data'
import { useAuth } from '@/contexts/AuthContext'
import { useLeaveOptions } from '@/app/hrit/_lib/use-leave'
import {
  hrmsService,
  buildSessionContext,
  type AttendanceEmployeeOption,
  type AttendanceKpiResponse,
  type AttendanceOption,
  type AttendanceWeeklyResponse,
  type DepartmentAttendanceEmployee,
  type DayDetailEntry,
  type LaravelAttendanceCalendarDay,
  type SessionContext,
} from '@/app/hrit/_lib/attendance-api'
import type { DrillDownRecord, DayWiseAttendanceRecord } from '@/app/hrit/attendance-management/attendance-tracking/components/attendance-drill-down-drawer'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'
import type { Column } from '@/components/ui/data-table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { AttendanceTabs } from '@/app/hrit/attendance-management/_shared/attendance-tabs'
import {
  AttendanceKPICards,
  type AttendanceKPICard,
  getEnhancedSummaryCards,
} from '@/app/hrit/attendance-management/_shared/attendance-kpi-cards'
import { AttendanceTrendChart } from '@/app/hrit/attendance-management/_shared/attendance-trend-chart'
import { AttendanceDonutChart} from '@/app/hrit/attendance-management/_shared/attendance-donut-chart'
import { AttendanceHighlights } from '@/app/hrit/attendance-management/_shared/attendance-highlights'
import {
  AttendanceGroupedTable,
  type GroupedRecord,
} from '@/app/hrit/attendance-management/_shared/attendance-grouped-table'


type ViewTab = { id: ViewTabId; label: string }
type ViewTabId = 'table-focus' | 'trend-focus' | 'daily-details'

/**
 * The filter set the report data is currently loaded for. Dropdown selections
 * stay in draft state until Apply commits them here, so a department/employee
 * change does not refetch until the user asks for it.
 */
type AppliedFilters = {
  from: string
  to: string
  department: string
  employee: string
}

type AttendanceTrendData = {
  label: string
  present: number
  late: number
  earlyGoing: number
  absent: number
}

type AttendanceDistributionData = {
  present: number
  late: number
  earlyGoing: number
  absent: number
}

type AttendanceHighlightsData = {
  highestAttendanceDept: string
  highestAbsenteeismDept: string
  highestEarlyGoingDept: string
}

function getApiDepartmentId(department: string) {
  return /^\d+$/.test(department) ? department : undefined
}

/** 'all' (or anything non-numeric) means no employee filter. */
function getApiEmployeeId(employee: string) {
  return /^\d+$/.test(employee) ? employee : undefined
}

type TrendMode = 'today' | 'week' | 'month' | 'custom'

/**
 * Relabels a weekly-summary day entry for the active quick filter - "Mon" for
 * This Week, "Aug 1" for This Month/Custom - falling back to the raw label
 * unchanged if it isn't a parseable date (e.g. the backend already sends a
 * short weekday name).
 */
function formatTrendLabel(rawLabel: string, mode: TrendMode) {
  const parsed = new Date(rawLabel.length <= 10 ? `${rawLabel}T00:00:00` : rawLabel)
  if (Number.isNaN(parsed.getTime())) return rawLabel
  if (mode === 'week') return parsed.toLocaleDateString('en-US', { weekday: 'short' })
  return parsed.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

/**
 * Maps the weekly-summary endpoint's per-day arrays to trend points for This
 * Week / This Month / Custom, scoped to the applied department/employee/
 * date-range filters (`getAttendanceWeeklySummary` is already called with
 * those same filter params). Each day's Attendance %/Late %/Absent % is
 * computed against that SAME day's own present+late+absent total, not an
 * externally-sourced headcount - an earlier version of this code divided by
 * a headcount from a different endpoint and produced nonsensical numbers
 * (percentages over 1000%) when the two endpoints' populations didn't
 * match. `earlyGoing` stays 0: `/attendance/weekly-summary` does not return
 * a per-day early-going count.
 */
function computeDayTrend(response: AttendanceWeeklyResponse | null, mode: TrendMode): AttendanceTrendData[] {
  if (!response) return []

  return response.labels.map((label, index) => {
    const present = response.present[index] ?? 0
    const late = response.late[index] ?? 0
    const absent = response.absent[index] ?? 0
    const dayTotal = present + late + absent

    return {
      label: formatTrendLabel(label, mode),
      present: dayTotal > 0 ? Math.round((present / dayTotal) * 100) : 0,
      late: dayTotal > 0 ? Math.round((late / dayTotal) * 100) : 0,
      earlyGoing: 0,
      absent: dayTotal > 0 ? Math.round((absent / dayTotal) * 100) : 0,
    }
  })
}

/** Extracts the 24h hour from a display time like "09:15 AM"; null if unparsable/blank. */
function parsePunchHour(display?: string): number | null {
  if (!display || display === '--') return null
  const match = display.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!match) return null

  let hour = Number(match[1])
  const period = match[3].toUpperCase()
  if (period === 'PM' && hour !== 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0
  return hour
}

/**
 * For Today: builds an hourly cumulative "% of employees punched in by this
 * hour" curve from the early-going report's per-employee punch-in times
 * (already fetched for the selected date/department/employee filters).
 * Late/Absent/Early Going have no well-defined per-hour value from this data
 * so they stay flat at 0 - only the Present line is meaningful hour-by-hour.
 */
function computeHourlyTrend(records: EarlyGoingRecord[], totalEmployees: number): AttendanceTrendData[] {
  if (totalEmployees <= 0) return []

  const punchHours = records
    .map((record) => parsePunchHour(record.punchIn))
    .filter((hour): hour is number => hour !== null)
    .sort((a, b) => a - b)

  if (punchHours.length === 0) return []

  const startHour = Math.min(...punchHours)
  const endHour = Math.max(...punchHours)

  return Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i).map((hour) => {
    const cumulativePresent = punchHours.filter((h) => h <= hour).length
    const period = hour < 12 ? 'AM' : 'PM'
    const displayHour = hour % 12 === 0 ? 12 : hour % 12

    return {
      label: `${displayHour} ${period}`,
      present: Math.round((cumulativePresent / totalEmployees) * 100),
      late: 0,
      earlyGoing: 0,
      absent: 0,
    }
  })
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatName(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(' ') || '--'
}

function optionsFromDepartments(value?: Record<string, string> | string[] | AttendanceOption[]) {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (typeof item === 'string') return { value: String(index), label: item }
      return item
    })
  }
  return Object.entries(value).map(([id, label]) => ({ value: id, label }))
}

function optionsFromEmployees(value?: AttendanceEmployeeOption[]) {
  return (value ?? []).map((employee) => {
    const name = formatName([employee.first_name, employee.middle_name, employee.last_name])
    const employeeNo = employee.employee_no ? ` (${employee.employee_no})` : ''
    return { value: String(employee.id), label: `${name}${employeeNo}` }
  })
}

function formatTime(value?: string | null) {
  if (!value) return '--'
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function minutesBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return 0
  const startDate = new Date(start.includes('T') ? start : start.replace(' ', 'T'))
  const endDate = new Date(end.includes('T') ? end : end.replace(' ', 'T'))
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0
  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000))
}

function formatMinutes(totalMinutes: number) {
  if (totalMinutes <= 0) return '--'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

/**
 * Prefers the backend's own timestamp_diff (a TIME column, e.g. "08:30:00")
 * when present, but that column isn't reliably populated by every
 * punch-in/out code path in this codebase - falls back to computing the
 * duration directly from punchin_time/punchout_time so Working Hours still
 * shows whenever both punches actually exist for that calendar day.
 */
function calendarWorkingHours(day: LaravelAttendanceCalendarDay): string {
  const diffMatch = day.timestamp_diff?.match(/^(\d{1,2}):(\d{2})/)
  if (diffMatch) {
    const hours = Number(diffMatch[1])
    const minutes = Number(diffMatch[2])
    if (hours > 0 || minutes > 0) return formatMinutes(hours * 60 + minutes)
  }
  if (day.punchin_time && day.punchout_time) {
    const minutes = minutesBetween(day.punchin_time, day.punchout_time)
    if (minutes > 0) return formatMinutes(minutes)
  }
  return '--'
}

/**
 * The single-day views (Daily Details, department "View") can only ever
 * show one date's punches, but the applied date range's own end date is
 * often the wrong one to pick - a "this month" range whose second half
 * hasn't happened yet, or simply a fresh institute where "today" has
 * nothing recorded, both leave the single-day view blank even though the
 * range as a whole (and its own aggregate totals) has real attendance.
 * Resolves the latest date that actually has a punch, first within the
 * applied range, then - if the range itself has nothing - across all time,
 * so the report only ever falls back to `to` when there is truly no
 * attendance recorded anywhere in scope.
 */
async function resolveEffectiveDayDetailDate(
  context: SessionContext,
  params: { departmentId?: string; from: string; to: string },
): Promise<string> {
  try {
    const withinRange = await hrmsService.getLatestActivityDate(context, {
      departmentId: params.departmentId,
      fromDate: params.from,
      toDate: params.to,
    })
    if (withinRange.date) return withinRange.date

    const anyTime = await hrmsService.getLatestActivityDate(context, { departmentId: params.departmentId })
    if (anyTime.date) return anyTime.date
  } catch {
    // Non-critical - fall through to the applied range's own end date.
  }
  return params.to || params.from
}

function mapDayDetailRecord(entry: DayDetailEntry, date: string): EarlyGoingRecord {
  const expectedOut = entry.expected_out ?? undefined
  const earlyByMin =
    entry.status === 'early-going' && expectedOut && entry.punchout_time
      ? minutesBetween(entry.punchout_time, `${date} ${expectedOut}`)
      : 0

  return {
    id: String(entry.user_id),
    employee: entry.full_name ?? '--',
    employeeId: entry.employee_no ?? String(entry.user_id),
    department: entry.department ?? '--',
    date,
    punchIn: formatTime(entry.punchin_time),
    punchOut: formatTime(entry.punchout_time),
    expectedOut: expectedOut ?? '--',
    earlyBy: formatMinutes(earlyByMin),
    earlyByMin,
    status: entry.status,
  }
}

const statusDisplay: Record<EarlyGoingRecord['status'], { variant: 'active' | 'pending' | 'error' | 'default'; label: string }> = {
  present: { variant: 'active', label: 'Present' },
  late: { variant: 'pending', label: 'Late' },
  'early-going': { variant: 'pending', label: 'Early Going' },
  absent: { variant: 'error', label: 'Absent' },
  leave: { variant: 'default', label: 'On Leave' },
}

function matchesSearch(record: EarlyGoingRecord, search: string) {
  if (!search) return true
  const query = search.toLowerCase()
  return [record.employee, record.employeeId, record.department, record.date].some((value) =>
    value.toLowerCase().includes(query),
  )
}

const viewTabs: ViewTab[] = [
  { id: 'table-focus', label: 'Table Focus' },
  { id: 'trend-focus', label: 'Trend Focus' },
  { id: 'daily-details', label: 'Daily Details' },
]

function getEarlyGoingColumns(onView: (record: EarlyGoingRecord) => void): Column<EarlyGoingRecord>[] {
  return [
    { id: 'id', header: '#' },
    { id: 'employee', header: 'Employee' },
    { id: 'employeeId', header: 'Employee ID' },
    { id: 'department', header: 'Department' },
    { id: 'date', header: 'Date' },
    { id: 'punchIn', header: 'Punch In' },
    { id: 'punchOut', header: 'Punch Out' },
    { id: 'expectedOut', header: 'Expected Out' },
    { id: 'earlyBy', header: 'Early By' },
    { id: 'earlyByMin', header: 'Early By (Min)' },
    {
      id: 'status',
      header: 'Status',
      render: (value) => (
        <StatusBadge
          variant={statusDisplay[value as EarlyGoingRecord['status']].variant}
          className="h-6 px-2.5 text-xs font-semibold"
        >
          {statusDisplay[value as EarlyGoingRecord['status']].label}
        </StatusBadge>
      ),
    },
    {
      id: 'actions' as keyof EarlyGoingRecord,
      header: 'Actions',
      render: (_, row) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label={`View details for ${row.employee}`}
          onClick={() => onView(row)}
        >
          <Eye className="size-4" />
        </Button>
      ),
    },
  ]
}

function AttendanceReportsPage() {
  const { user } = useAuth()
  const initialDate = React.useMemo(() => {
    const date = new Date()
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }, [])
  const [viewMode, setViewMode] = React.useState<ViewTabId>('table-focus')
  const [dateRange, setDateRange] = React.useState({ from: initialDate, to: initialDate })
  const [groupBy, setGroupBy] = React.useState('organization')
  const [department, setDepartment] = React.useState('all')
  const [employee, setEmployee] = React.useState('all')
  const [quickFilter, setQuickFilter] = React.useState('custom')
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [viewRecord, setViewRecord] = React.useState<EarlyGoingRecord | null>(null)
  const [apiLoading, setApiLoading] = React.useState(false)
  const [apiError, setApiError] = React.useState<string | null>(null)
  const [attendanceKpis, setAttendanceKpis] = React.useState<AttendanceKpiResponse | null>(null)
  const [weeklySummary, setWeeklySummary] = React.useState<AttendanceWeeklyResponse | null>(null)
  // /attendance/report-filters intermittently fails to authenticate in this
  // environment - see reportFilterDepartments below for the working fallback.
  const [reportFilterDepartments, setReportFilterDepartments] = React.useState<AttendanceOption[]>([])
  const { options: leaveOptions } = useLeaveOptions()
  const [employeeOptions, setEmployeeOptions] = React.useState<AttendanceOption[]>([])
  const [employeesLoading, setEmployeesLoading] = React.useState(false)
  const [departmentReport, setDepartmentReport] = React.useState<DepartmentAttendanceEmployee[]>([])
  // The department_id every filtered call (KPIs, weekly summary, day-detail,
  // department-wise report) actually matches against comes straight from
  // departmentReport's own hrms_departments join (department_id is a
  // GROUP_CONCAT of that employee's department id(s), normally a single
  // value). Deriving the dropdown from THIS - once it has loaded, on the
  // initial unfiltered "all departments" fetch - guarantees the value the
  // user picks is in the same id space every other endpoint expects.
  // /attendance/report-filters and the Leave module's department list stay
  // as fallbacks for the brief window before the first fetch resolves, but
  // both have been observed to use a different id space than
  // hrms_departments, which silently filters everything down to "no data
  // found" once applied.
  const departmentOptionsFromReport = React.useMemo<AttendanceOption[]>(() => {
    const byId = new Map<string, string>()
    departmentReport.forEach((record) => {
      const id = record.department_id ? String(record.department_id).split(',')[0].trim() : ''
      if (id && record.department) byId.set(id, record.department)
    })
    return Array.from(byId.entries()).map(([value, label]) => ({ value, label }))
  }, [departmentReport])
  const departmentOptions = React.useMemo<AttendanceOption[]>(() => {
    if (departmentOptionsFromReport.length > 0) return departmentOptionsFromReport
    if (reportFilterDepartments.length > 0) return reportFilterDepartments
    return (leaveOptions?.departments ?? []).map((department) => ({
      value: department.value,
      label: department.label,
    }))
  }, [departmentOptionsFromReport, reportFilterDepartments, leaveOptions])
  const [earlyGoingRows, setEarlyGoingRows] = React.useState<EarlyGoingRecord[]>([])
  const [appliedFilters, setAppliedFilters] = React.useState<AppliedFilters>(() => ({
    from: initialDate,
    to: initialDate,
    department: 'all',
    employee: 'all',
  }))
  const pageSize = 10
  const [latestActivityNote, setLatestActivityNote] = React.useState<string | null>(null)

  const formatDate = (date: Date) => {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: reset date range based on quick filter */
  React.useEffect(() => {
    const today = new Date()
    switch (quickFilter) {
      case 'today':
        const todayStr = formatDate(today)
        setDateRange({ from: todayStr, to: todayStr })
        break
      case 'week': {
        const day = today.getDay()
        const diff = today.getDate() - day
        const start = new Date(today)
        start.setDate(diff)
        const end = new Date(start)
        end.setDate(end.getDate() + 6)
        setDateRange({ from: formatDate(start), to: formatDate(end) })
        break
      }
      case 'month': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1)
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        setDateRange({ from: formatDate(start), to: formatDate(end) })
        break
      }
      case 'custom':
      default:
        break
    }
  }, [quickFilter])
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: pagination reset on filter change */
  React.useEffect(() => {
    setPage(1)
  }, [appliedFilters, groupBy, search])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDateRangeChange = (range: { from: string; to: string }) => {
    setDateRange(range)
    setQuickFilter('custom')
    setLatestActivityNote(null)
  }

  // Employees are scoped to the department, so a department change invalidates
  // whatever employee was picked. Fall back to "All Employees".
  const handleDepartmentChange = (value: string) => {
    setDepartment(value)
    setEmployee('all')
  }

  const handleReset = () => {
    const today = formatDate(new Date())
    setDateRange({ from: today, to: today })
    setGroupBy('organization')
    setDepartment('all')
    setEmployee('all')
    setQuickFilter('custom')
    setSearch('')
    setPage(1)
    setAppliedFilters({ from: today, to: today, department: 'all', employee: 'all' })
    setLatestActivityNote(null)
  }

  // API rows only - the report never falls back to sample data.
  const earlyGoingData = React.useMemo(
    () => earlyGoingRows.filter((record) => matchesSearch(record, search)),
    [earlyGoingRows, search],
  )

  // "Apply" is what commits the draft filters and triggers the refetch.
  const handleSearchClick = () => {
    setAppliedFilters({
      from: dateRange.from,
      to: dateRange.to,
      department,
      employee,
    })
    setPage(1)
  }

  // Every active employee in a department, with their Present/Absent/Late
  // DAY COUNTS across the whole applied date range (the "View" action's
  // full roster, see AttendanceGroupedTable's resolveRecentRecords) - not
  // scoped to appliedFilters.employee, since the point of this drill-down is
  // to show the whole department regardless of which single employee (if
  // any) the report is currently filtered to.
  //
  // This deliberately reuses departmentReport (already loaded for the
  // Table Focus summary, no extra fetch needed) rather than a single day's
  // punch snapshot: a single day's Punch In/Out can never agree with the
  // period-total KPI cards shown above it in the drawer (e.g. "Late: 34"
  // for a department is a whole-range total; picking any one day to show
  // punches for will usually show 0 late that day, which read as broken
  // even though both numbers were individually correct) - showing the same
  // period-total day counts per employee here instead means the roster
  // always sums to exactly what the cards above it already say.
  const resolveDepartmentRoster = React.useCallback(
    async (record: GroupedRecord): Promise<DrillDownRecord[]> => {
      if (!record.departmentId) return record.recentRecords ?? []

      const departmentIds = record.departmentId.split(',').map((id) => id.trim()).filter(Boolean)

      return departmentReport
        .filter((emp) => departmentIds.includes(String(emp.department_id ?? '').split(',')[0].trim()))
        .map((emp) => {
          const workingDays = toNumber(emp.workingDays)
          const presentDays = toNumber(emp.total_att_day)
          const absentDays = toNumber(emp.total_ab_day)
          const lateDays = toNumber(emp.late)

          return {
            id: String(emp.user_id),
            userId: String(emp.user_id),
            date: `${appliedFilters.from} to ${appliedFilters.to}`,
            employee: emp.full_name ?? '--',
            employeeId: emp.employee_no ?? String(emp.user_id),
            department: emp.department ?? '--',
            presentDays,
            absentDays,
            lateDays,
            workingDays,
            attendancePercentage: workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0,
          }
        })
    },
    [departmentReport, appliedFilters],
  )

  // Drills one employee's period-total row (Present Days: 16, etc.) down
  // into the actual dates behind it - reuses /api/attendance/my-attendance
  // (AttendanceTrackingApiController::myAttendance), which already builds a
  // full day-by-day calendar with punch/status per date, just normally used
  // for an employee's own self-service view rather than an admin looking up
  // someone else's.
  const resolveEmployeeCalendar = React.useCallback(
    async (row: DrillDownRecord): Promise<DayWiseAttendanceRecord[]> => {
      if (!row.userId) return []

      const context = buildSessionContext()
      const response = await hrmsService.getMyAttendance(context, {
        userId: row.userId,
        fromDate: appliedFilters.from,
        toDate: appliedFilters.to,
      })

      return (response.calendar ?? []).map((day) => ({
        id: day.date,
        date: day.date,
        dayName: day.day_name ?? '--',
        punchIn: formatTime(day.punchin_time),
        punchOut: formatTime(day.punchout_time),
        workingHours: calendarWorkingHours(day),
        status: day.status,
      }))
    },
    [appliedFilters],
  )

  const handleExport = () => {
    console.log('Export clicked')
  }

  const handlePrint = () => {
    console.log('Print clicked')
  }

  const handleSavedReportChange = (value: string) => {
    console.log('Saved report:', value)
  }

  React.useEffect(() => {
    let cancelled = false

    async function loadReportOptions() {
      try {
        const context = buildSessionContext()
        const response = await hrmsService.getAttendanceReportIndex(context)
        if (cancelled) return

        const options = optionsFromDepartments(response.departments)
        if (options.length === 0) {
          // Request succeeded but returned no department list - was previously
          // swallowed silently, leaving the dropdown empty with no clue why.
          console.warn('[attendance-reports] /attendance/report-filters returned no departments:', response)
        }
        setReportFilterDepartments(options)
      } catch (error) {
        // console.warn, not console.error: this endpoint is known-broken
        // server-side (Class "App\Models\HRMS\hrmsDepartmentModel" not
        // found) and is already handled - departmentOptions falls back to
        // the Leave module's department list above, so this isn't a
        // functional failure. console.error would trip Next's dev-mode
        // error overlay for an already-handled, expected failure.
        console.warn('[attendance-reports] /attendance/report-filters failed (falling back to Leave module departments):', error)
        if (!cancelled) {
          setReportFilterDepartments([])
        }
      }
    }

    loadReportOptions()

    return () => {
      cancelled = true
    }
  }, [user])

  React.useEffect(() => {
    let cancelled = false

    // Employee options track the *draft* department so the dropdown narrows
    // as soon as a department is picked, before Apply is pressed.
    async function loadEmployees() {
      setEmployeesLoading(true)

      try {
        const context = buildSessionContext()
        const response = await hrmsService.getAttendanceEmployees(context, department)
        if (!cancelled) {
          setEmployeeOptions(optionsFromEmployees(response.employees))
        }
      } catch {
        if (!cancelled) {
          setEmployeeOptions([])
        }
      } finally {
        if (!cancelled) {
          setEmployeesLoading(false)
        }
      }
    }

    loadEmployees()

    return () => {
      cancelled = true
    }
  }, [department, user])

  React.useEffect(() => {
    let cancelled = false

    async function loadAttendanceReports() {
      setApiLoading(true)
      setApiError(null)

      try {
        const context = buildSessionContext()
        const departmentId = getApiDepartmentId(appliedFilters.department)
        const employeeId = getApiEmployeeId(appliedFilters.employee)
        const reportDate = await resolveEffectiveDayDetailDate(context, {
          departmentId,
          from: appliedFilters.from,
          to: appliedFilters.to,
        })
        if (cancelled) return
        setLatestActivityNote(
          reportDate !== (appliedFilters.to || appliedFilters.from)
            ? `${appliedFilters.to || appliedFilters.from} has no recorded attendance, so Daily Details and "View" below are showing the most recent date that does: ${reportDate}.`
            : null,
        )
        const [kpis, weekly, departmentSummary, dayDetail] = await Promise.all([
          hrmsService.getAttendanceKpis(context, { departmentId, employeeId }),
          hrmsService.getAttendanceWeeklySummary(context, {
            fromDate: appliedFilters.from,
            toDate: appliedFilters.to,
            departmentId,
            employeeId,
          }),
          hrmsService.getDepartmentAttendanceReport(context, {
            fromDate: appliedFilters.from,
            toDate: appliedFilters.to,
            departmentId: departmentId ?? 'all',
            employeeId: employeeId ?? 'all',
          }),
          hrmsService.getAttendanceDayDetail(context, {
            date: reportDate,
            departmentId: departmentId ?? 'all',
            employeeId: employeeId ?? 'all',
          }),
        ])

        if (!cancelled) {
          setAttendanceKpis(kpis)
          setWeeklySummary(weekly)
          setDepartmentReport(departmentSummary.empData ?? [])
          setEarlyGoingRows((dayDetail.employees ?? []).map((entry) => mapDayDetailRecord(entry, reportDate)))
        }
      } catch (error) {
        if (!cancelled) {
          setApiError(error instanceof Error ? error.message : 'Failed to load attendance reports.')
          setAttendanceKpis(null)
          setWeeklySummary(null)
          setDepartmentReport([])
          setEarlyGoingRows([])
        }
      } finally {
        if (!cancelled) {
          setApiLoading(false)
        }
      }
    }

    loadAttendanceReports()

    return () => {
      cancelled = true
    }
  }, [appliedFilters, user])

  const groupedTableData = React.useMemo((): GroupedRecord[] => {
    if (departmentReport.length > 0) {
      if (groupBy === 'organization' || groupBy === 'date') {
        const deptMap = new Map<string, { employees: number; present: number; absent: number; late: number; earlyGoing: number; workingDays: number; departmentIds: Set<string> }>()
        departmentReport.forEach((record) => {
          const dept = record.department || '--'
          if (!deptMap.has(dept)) {
            deptMap.set(dept, { employees: 0, present: 0, absent: 0, late: 0, earlyGoing: 0, workingDays: 0, departmentIds: new Set() })
          }
          const entry = deptMap.get(dept)!
          entry.employees += 1
          entry.present += toNumber(record.total_att_day)
          entry.absent += toNumber(record.total_ab_day)
          entry.late += toNumber(record.late)
          entry.earlyGoing += 0
          entry.workingDays += toNumber(record.workingDays)
          // A sub_institute can have more than one hrms_departments row
          // sharing the same display name (duplicate data entry) - this
          // table groups by name, so it needs every id that name maps to,
          // not just one, or the "View" roster comes up short of this
          // row's own employee count.
          String(record.department_id ?? '')
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
            .forEach((id) => entry.departmentIds.add(id))
        })

        return Array.from(deptMap.entries()).map(([dept, vals]) => ({
          id: `${groupBy}-${dept}`,
          date: groupBy === 'date' ? `${appliedFilters.from} to ${appliedFilters.to}` : undefined,
          department: dept,
          departmentId: Array.from(vals.departmentIds).join(','),
          employees: vals.employees,
          present: vals.present,
          absent: vals.absent,
          late: vals.late,
          earlyGoing: vals.earlyGoing,
          attendancePercentage: vals.workingDays > 0 ? Math.round((vals.present / vals.workingDays) * 100) : 0,
          // Preview only - View fetches the full roster on demand via
          // resolveRecentRecords (organization grouping) since this dataset
          // is scoped to the report's single reporting date, not the range.
          recentRecords: earlyGoingData.filter((record) => record.department === dept).slice(0, 3),
        }))
      }

      return departmentReport.map((record) => {
        const workingDays = toNumber(record.workingDays)
        const present = toNumber(record.total_att_day)
        const late = toNumber(record.late)
        const absent = toNumber(record.total_ab_day)

        return {
          id: String(record.user_id),
          employee: record.full_name ?? '--',
          employeeId: record.employee_no ?? String(record.user_id),
          department: record.department ?? '--',
          date: `${appliedFilters.from} to ${appliedFilters.to}`,
          punchIn: '--',
          punchOut: '--',
          expectedIn: '--',
          expectedOut: '--',
          workingHours: `${present}/${workingDays || 0} days`,
          lateBy: late ? `${late} days` : '--',
          earlyBy: '--',
          present,
          absent,
          late,
          status: absent > present ? 'absent' : late > 0 ? 'late' : 'present',
          attendancePercentage: workingDays > 0 ? Math.round((present / workingDays) * 100) : 0,
          recentRecords: earlyGoingData.filter((item) => item.employeeId === record.employee_no || item.id === String(record.user_id)).slice(0, 5),
        }
      })
    }

    const dataSource = earlyGoingData
    switch (groupBy) {
      case 'organization': {
        const deptMap = new Map<string, { employees: number; present: number; absent: number; late: number; earlyGoing: number }>()
        dataSource.forEach((d) => {
          if (!deptMap.has(d.department)) {
            deptMap.set(d.department, { employees: 0, present: 0, absent: 0, late: 0, earlyGoing: 0 })
          }
          const entry = deptMap.get(d.department)!
          if (d.status === 'present') entry.present += 1
          if (d.status === 'absent') entry.absent += 1
          if (d.status === 'late') entry.late += 1
          if (d.earlyByMin > 0) entry.earlyGoing += 1
        })
        return Array.from(deptMap.entries()).map(([dept, vals]) => ({
          id: dept,
          department: dept,
          employees: vals.present + vals.absent + vals.late,
          present: vals.present,
          absent: vals.absent,
          late: vals.late,
          earlyGoing: vals.earlyGoing,
          attendancePercentage: vals.employees > 0 ? Math.round((vals.present / vals.employees) * 100) : 0,
          recentRecords: dataSource.filter((r) => r.department === dept).slice(-3),
        }))
      }
      case 'department':
        const deptMap = new Map<string, { employees: number; present: number; absent: number; late: number; earlyGoing: number }>()
        dataSource.forEach((d) => {
          if (!deptMap.has(d.department)) {
            deptMap.set(d.department, { employees: 0, present: 0, absent: 0, late: 0, earlyGoing: 0 })
          }
          const entry = deptMap.get(d.department)!
          entry.employees += 1
          if (d.status === 'present') entry.present += 1
          if (d.status === 'absent') entry.absent += 1
          if (d.status === 'late') entry.late += 1
          if (d.earlyByMin > 0) entry.earlyGoing += 1
        })
        return Array.from(deptMap.entries()).map(([dept, vals]) => ({
          id: dept,
          department: dept,
          employees: vals.employees,
          present: vals.present,
          absent: vals.absent,
          late: vals.late,
          earlyGoing: vals.earlyGoing,
          attendancePercentage: Math.round((vals.present / vals.employees) * 100),
          recentRecords: dataSource.filter((r) => r.department === dept).slice(-3),
        }))
      default:
        return dataSource.map((d) => ({
          id: d.id,
          employee: d.employee,
          employeeId: d.employeeId,
          department: d.department,
          date: d.date,
          punchIn: d.punchIn,
          punchOut: d.punchOut,
          earlyBy: d.earlyBy,
          earlyByMin: d.earlyByMin,
          status: d.status,
          recentRecords: dataSource.filter((r) => r.employee === d.employee).slice(-5),
        }))
    }
  }, [appliedFilters, departmentReport, earlyGoingData, groupBy])

  /**
   * Single source of truth for Total Employees, Present, Absent, Late and
   * Early Going, shared by the KPI cards, the distribution donut and the
   * trend line, so the three can never disagree with each other OR with the
   * Table Focus summary table below - all four are now built from the exact
   * same `departmentReport` rows Table Focus's own grouped table sums, using
   * the exact same formula it already uses per row
   * (`attendancePercentage: present / workingDays * 100`, see
   * `groupedTableData` above). `total_att_day` / `total_ab_day` / `late` are
   * DAY counts summed across every employee in the filtered range (e.g.
   * "179 absent-days across 7 employees this month"), not a single day's
   * headcount - `totalSlots` (the working-day-slot sum) is their correct
   * percentage denominator, not `totalEmployees`. Trying to normalise them
   * back down to a headcount (an earlier version of this code divided by an
   * average working-day count) produced nonsense whenever absent-days
   * happened to be close to a small department's working-day count - that
   * bug is what this rewrite replaces.
   *
   * `attendanceKpis.active_employees` (org-wide, ignores filters) is only
   * used as a last-resort fallback before the department report has loaded.
   *
   * `/attendance/weekly-summary` is deliberately NOT used here (KPI cards /
   * donut) - its response scale didn't match this filtered population
   * (dividing it by this population's headcount produced percentages over
   * 1000%) and there is no way to verify its intended meaning without
   * backend access. It's still used for the Attendance Trend line chart
   * below (`trendData`), plotted as-is with no extra scaling, since that's
   * the only endpoint offering real day-by-day granularity and this page's
   * trend chart is expected to keep that shape.
   */
  const attendanceAggregates = React.useMemo(() => {
    const earlyGoingCount = new Set(
      earlyGoingData.filter((record) => record.earlyByMin > 0).map((record) => record.employeeId),
    ).size

    if (departmentReport.length > 0) {
      const totalEmployees = departmentReport.length
      const presentCount = departmentReport.reduce((sum, record) => sum + toNumber(record.total_att_day), 0)
      const absentCount = departmentReport.reduce((sum, record) => sum + toNumber(record.total_ab_day), 0)
      const lateCount = departmentReport.reduce((sum, record) => sum + toNumber(record.late), 0)
      const totalSlots =
        departmentReport.reduce((sum, record) => sum + toNumber(record.workingDays), 0) ||
        presentCount + absentCount ||
        1

      return { totalEmployees, presentCount, absentCount, lateCount, earlyGoingCount, totalSlots }
    }

    // Fallback before the department report has loaded: derive from the
    // day-detail report, which is a full-roster LEFT JOIN carrying a real
    // per-employee status (present/late/early-going/absent/leave). This IS a
    // single-day snapshot, so totalSlots === totalEmployees here.
    const presentCount = earlyGoingData.filter((record) => record.status === 'present').length
    const absentCount = earlyGoingData.filter((record) => record.status === 'absent').length
    const lateCount = earlyGoingData.filter((record) => record.status === 'late').length
    const totalEmployees = earlyGoingData.length || attendanceKpis?.active_employees || 0

    return { totalEmployees, presentCount, absentCount, lateCount, earlyGoingCount, totalSlots: totalEmployees || 1 }
  }, [departmentReport, earlyGoingData, attendanceKpis])

  const distributionData = React.useMemo(
    (): AttendanceDistributionData => ({
      present: attendanceAggregates.presentCount,
      late: attendanceAggregates.lateCount,
      earlyGoing: attendanceAggregates.earlyGoingCount,
      absent: attendanceAggregates.absentCount,
    }),
    [attendanceAggregates],
  )

  const trendData = React.useMemo((): AttendanceTrendData[] => {
    if (quickFilter === 'today') {
      return computeHourlyTrend(earlyGoingData, attendanceAggregates.totalEmployees)
    }
    const mode: TrendMode = quickFilter === 'week' || quickFilter === 'month' ? quickFilter : 'custom'
    return computeDayTrend(weeklySummary, mode)
  }, [quickFilter, earlyGoingData, attendanceAggregates.totalEmployees, weeklySummary])

  const highlightsData = React.useMemo((): AttendanceHighlightsData => {
    const dataSource = earlyGoingData
    const deptCounts = new Map<string, { present: number; absent: number; early: number; total: number }>()
    dataSource.forEach((r) => {
      const dept = r.department
      if (!deptCounts.has(dept)) deptCounts.set(dept, { present: 0, absent: 0, early: 0, total: 0 })
      const entry = deptCounts.get(dept)!
      entry.total += 1
      if (r.status === 'present') entry.present += 1
      if (r.status === 'absent') entry.absent += 1
      if (r.earlyByMin > 0) entry.early += 1
    })

    let bestDept = '', worstDept = '', earlyDept = ''
    let bestPct = 0, worstPct = 100, earlyCnt = 0
    deptCounts.forEach((vals, dept) => {
      const pct = (vals.present / vals.total) * 100
      if (pct > bestPct) { bestPct = pct; bestDept = dept }
      if (pct < worstPct) { worstPct = pct; worstDept = dept }
      if (vals.early > earlyCnt) { earlyCnt = vals.early; earlyDept = dept }
    })

    return {
      highestAttendanceDept: bestDept,
      highestAbsenteeismDept: worstDept,
      highestEarlyGoingDept: earlyDept,
    }
  }, [earlyGoingData])

  const enhancedCards = React.useMemo<AttendanceKPICard[]>(() => {
    const { totalEmployees, presentCount, absentCount, lateCount, earlyGoingCount, totalSlots } = attendanceAggregates
    if (totalEmployees === 0) return []

    // All four percentages divide by totalSlots (the same working-day-slot
    // total Table Focus's own per-row `attendancePercentage` uses), not
    // totalEmployees - see the attendanceAggregates comment above for why.
    // Late % and Early Going % are independent subsets of Present, not a
    // competing partition, so they are not expected to sum to 100 with the
    // other two.
    return getEnhancedSummaryCards({
      totalEmployees,
      attendancePercentage: Math.round((presentCount / totalSlots) * 100),
      latePercentage: Math.round((lateCount / totalSlots) * 100),
      earlyGoingPercentage: Math.round((earlyGoingCount / totalSlots) * 100),
      absentPercentage: Math.round((absentCount / totalSlots) * 100),
    })
  }, [attendanceAggregates])

  const renderDailyDetails = () => {
    const data = earlyGoingData.slice((page - 1) * pageSize, page * pageSize)
    const total = earlyGoingData.length
    const columns = getEarlyGoingColumns(setViewRecord)

    return (
      <div className="flex flex-col gap-6">
        <AttendanceKPICards cards={enhancedCards} />
        <AttendanceReportTable
          columns={columns}
          data={data}
          searchValue={search}
          onSearchChange={setSearch}
          isLoading={apiLoading}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        />
      </div>
    )
  }

  const renderTrendFocus = () => (
    <div className="flex flex-col gap-6">
      <AttendanceKPICards cards={enhancedCards} />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <AttendanceTrendChart data={trendData} />
        <div className="flex flex-col gap-6">
          {/* No totalOverride: present/late/earlyGoing/absent are all
              day-counts here (see attendanceAggregates), so the chart's own
              segment sum - not Total Employees, a different unit (headcount)
              - is the correct "Total" to show at the centre. */}
          <AttendanceDonutChart data={distributionData} />
          <AttendanceHighlights data={highlightsData} />
        </div>
      </div>
    </div>
  )

  const renderTableFocus = () => (
    <div className="flex flex-col gap-6">
      <AttendanceKPICards cards={enhancedCards} />
      <AttendanceGroupedTable
        records={groupedTableData}
        groupBy={groupBy}
        searchValue={search}
        onSearchChange={setSearch}
        resolveRecentRecords={resolveDepartmentRoster}
        resolveEmployeeCalendar={resolveEmployeeCalendar}
        className="sm:col-span-2"
      />
    </div>
  )

  const renderContent = () => {
    switch (viewMode) {
      case 'table-focus':
        return renderTableFocus()
      case 'trend-focus':
        return renderTrendFocus()
      case 'daily-details':
        return renderDailyDetails()
      default:
        return renderTableFocus()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-balance text-xl font-bold tracking-tight text-foreground lg:text-3xl">
            Attendance Report
          </h1>
          <p className="max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground">
            View and analyze attendance data with detailed reports.
          </p>
        </div>
      </div>

      <EnhancedAttendanceFilters
        dateRange={dateRange}
        groupBy={groupBy}
        department={department}
        employee={employee}
        quickFilter={quickFilter}
        departments={departmentOptions}
        employees={employeeOptions}
        employeesLoading={employeesLoading}
        savedReports={savedReports}
        onDateRangeChange={handleDateRangeChange}
        onGroupByChange={setGroupBy}
        onDepartmentChange={handleDepartmentChange}
        onEmployeeChange={setEmployee}
        onQuickFilterChange={setQuickFilter}
        onSavedReportChange={handleSavedReportChange}
        onReset={handleReset}
        onSearch={handleSearchClick}
      />

      <AttendanceTabs
        tabs={viewTabs}
        active={viewMode}
        onChange={(id: string) => setViewMode(id as ViewTabId)}
      />

      {latestActivityNote && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
          {latestActivityNote}
        </div>
      )}

      {apiError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
          {apiError}
        </div>
      )}

      {apiLoading && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-muted-foreground">
          Loading attendance data...
        </div>
      )}

      {renderContent()}

      <Dialog open={!!viewRecord} onOpenChange={(open) => !open && setViewRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewRecord?.employee}</DialogTitle>
            <DialogDescription>{viewRecord?.employeeId} • {viewRecord?.department}</DialogDescription>
          </DialogHeader>
          {viewRecord && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium text-foreground">{viewRecord.date}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <StatusBadge
                  variant={statusDisplay[viewRecord.status].variant}
                  className="mt-0.5 h-6 px-2.5 text-xs font-semibold"
                >
                  {statusDisplay[viewRecord.status].label}
                </StatusBadge>
              </div>
              <div>
                <p className="text-muted-foreground">Punch In</p>
                <p className="font-medium text-foreground">{viewRecord.punchIn}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Punch Out</p>
                <p className="font-medium text-foreground">{viewRecord.punchOut}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Expected Out</p>
                <p className="font-medium text-foreground">{viewRecord.expectedOut}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Early By</p>
                <p className="font-medium text-foreground">
                  {viewRecord.earlyBy}
                  {viewRecord.earlyByMin > 0 ? ` (${viewRecord.earlyByMin} min)` : ''}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AttendanceReportsPage
