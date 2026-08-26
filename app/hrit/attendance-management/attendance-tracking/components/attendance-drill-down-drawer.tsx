'use client'

import * as React from 'react'
import { Sheet, SheetHeader, SheetTitle, SheetDescription, SheetContent } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/g2g/select'
import { Button } from '@/components/ui/button'
import { X, TrendingUp, TrendingDown, Clock, Eye, ArrowLeft } from 'lucide-react'

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'early-going', label: 'Early Going' },
  { value: 'absent', label: 'Absent' },
  { value: 'leave', label: 'Leave' },
]

export interface DrillDownRecord {
  id: string
  date: string
  /** The employee's real backend user id - needed to drill further into their day-wise calendar (see resolveEmployeeCalendar). Distinct from `id`, which may be a synthetic/grouped key. */
  userId?: string
  employee?: string
  employeeId?: string
  department?: string
  punchIn?: string
  punchOut?: string
  expectedIn?: string
  expectedOut?: string
  workingHours?: string
  lateBy?: string
  earlyBy?: string
  /** Single-day punch status - present only for a one-day snapshot row (see presentDays etc. below for a period-total row). */
  status?: 'present' | 'late' | 'absent' | 'early-going' | 'leave'
  attendancePercentage?: number
  present?: number
  absent?: number
  late?: number
  earlyGoing?: number
  totalEmployees?: number
  /**
   * Present/Absent/Late DAY COUNTS across the applied date range, for a
   * department-wide roster row - mutually exclusive with `status`/`punchIn`/
   * `punchOut` (a single-day snapshot row). Distinct field names from the
   * record-level `present`/`absent`/`late` above (period totals for the
   * summary cards) since a row can't reuse those without colliding.
   */
  presentDays?: number
  absentDays?: number
  lateDays?: number
  workingDays?: number
}

/** One calendar date's punch/status detail, for the per-employee day-wise drill-down. */
export interface DayWiseAttendanceRecord {
  id: string
  date: string
  dayName: string
  punchIn: string
  punchOut: string
  workingHours: string
  status: 'present' | 'late' | 'absent' | 'early-going' | 'leave' | null
}

export interface AttendanceDrillDownDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: DrillDownRecord | null
  recentRecords: DrillDownRecord[]
  /** True while a fuller record set (e.g. the full department roster) is still being fetched. */
  loading?: boolean
  /**
   * Only relevant for a period-total roster (see DrillDownRecord's
   * presentDays etc.) - resolves one employee's day-by-day punch/status
   * calendar for the applied date range, so a summary row like "Present
   * Days: 16" can be drilled into to see exactly which dates those were.
   */
  resolveEmployeeCalendar?: (row: DrillDownRecord) => Promise<DayWiseAttendanceRecord[]>
}

function getStatusBadgeTone(status: string) {
  switch (status) {
    case 'present': return 'success'
    case 'late': return 'warning'
    case 'early-going': return 'warning'
    case 'absent': return 'destructive'
    case 'leave': return 'secondary'
    default: return 'secondary'
  }
}

/** Same thresholds as AttendanceGroupedTable's getAttendanceBadge, for a consistent Attendance % badge everywhere. */
function getAttendanceBadgeTone(percentage: number) {
  if (percentage >= 90) return 'success' as const
  if (percentage >= 75) return 'success' as const
  if (percentage >= 60) return 'warning' as const
  return 'destructive' as const
}

export function AttendanceDrillDownDrawer({
  open,
  onOpenChange,
  record,
  recentRecords,
  loading,
  resolveEmployeeCalendar,
}: AttendanceDrillDownDrawerProps) {
  const [statusFilter, setStatusFilter] = React.useState('all')
  // Which employee (if any) the roster table has been drilled into, and
  // that employee's resolved day-wise calendar. Local to this drawer, not
  // page.tsx, since it's a pure view-state layer on top of the already-
  // loaded roster - only the resolver function itself needs page.tsx.
  const [dayWiseEmployee, setDayWiseEmployee] = React.useState<DrillDownRecord | null>(null)
  const [dayWiseRecords, setDayWiseRecords] = React.useState<DayWiseAttendanceRecord[]>([])
  const [dayWiseLoading, setDayWiseLoading] = React.useState(false)

  // Reset the filter and any day-wise drill-down whenever a different row is
  // opened, so state left on from a previous department/employee doesn't
  // silently carry over.
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: filter/drill-down reset on record change */
  React.useEffect(() => {
    setStatusFilter('all')
    setDayWiseEmployee(null)
    setDayWiseRecords([])
  }, [record?.id])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleViewEmployeeCalendar = async (row: DrillDownRecord) => {
    if (!resolveEmployeeCalendar) return
    setDayWiseEmployee(row)
    setDayWiseLoading(true)
    try {
      setDayWiseRecords(await resolveEmployeeCalendar(row))
    } catch {
      setDayWiseRecords([])
    } finally {
      setDayWiseLoading(false)
    }
  }

  if (!record) return null

  const showEmployeeColumns = recentRecords.some((r) => r.employee)
  const hasEmployeeId = recentRecords.some((r) => r.employeeId)
  // Department-wide "View" rows carry period-total day counts, not a single
  // day's punch/status - see the resolveDepartmentRoster comment in
  // page.tsx for why. Detected per row (rather than assumed from
  // showEmployeeColumns) so the older single-employee/date drill-downs,
  // which still use punchIn/punchOut/status rows, are unaffected.
  const isRangeSummary = recentRecords.some((r) => r.presentDays !== undefined)
  const filteredRecords = isRangeSummary || statusFilter === 'all'
    ? recentRecords
    : recentRecords.filter((r) => r.status === statusFilter)

  /**
   * A status filter turning up nothing is usually correct, not broken - the
   * summary cards above are totals for the whole report period, while this
   * table is one specific day, so e.g. "Late: 34" for a 3-person department
   * over a month can easily land on zero for any single day. Naming that
   * explicitly here (instead of a bare "no match") is what stops that from
   * reading as a bug every time.
   */
  function emptyStateMessage(): string {
    if (recentRecords.length === 0) return 'No recent records'
    if (isRangeSummary || statusFilter === 'all') return 'No employees match this status.'

    const label = STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.label ?? statusFilter
    const periodTotal: Record<string, number | undefined> = {
      present: record?.present,
      late: record?.late,
      'early-going': record?.earlyGoing,
      absent: record?.absent,
    }
    const total = periodTotal[statusFilter]

    if (total && total > 0) {
      return `No one was ${label.toLowerCase()} on ${recentRecords[0]?.date ?? 'this date'} - the ${total} ${label.toLowerCase()} total above is for the whole selected report period, not just this day.`
    }
    return `No employees were ${label.toLowerCase()} on ${recentRecords[0]?.date ?? 'this date'}.`
  }

  // CSS Grid, not a <table> - a native <table>'s position:sticky on th/td is
  // both spec-limited (broken under the border-collapse Tailwind's preflight
  // sets by default) and, even after working around that, was still found to
  // under-report its true scrollHeight near the scroll boundary, leaving the
  // sticky header visually overlapping the last couple of rows. Grid items
  // have no such quirks, so the header and body share one grid + one set of
  // column widths, guaranteeing alignment without any of the above.
  const columns: { key: string; label: string; width: number }[] = isRangeSummary
    ? [
        ...(showEmployeeColumns ? [{ key: 'employee', label: 'Employee', width: 200 }] : []),
        ...(hasEmployeeId ? [{ key: 'employeeId', label: 'Employee ID', width: 110 }] : []),
        { key: 'presentDays', label: 'Present Days', width: 110 },
        { key: 'absentDays', label: 'Absent Days', width: 110 },
        { key: 'lateDays', label: 'Late Days', width: 100 },
        { key: 'workingDays', label: 'Working Days', width: 110 },
        { key: 'attendancePercentage', label: 'Attendance %', width: 120 },
        ...(resolveEmployeeCalendar ? [{ key: 'actions', label: 'Actions', width: 90 }] : []),
      ]
    : [
        ...(showEmployeeColumns ? [{ key: 'employee', label: 'Employee', width: 200 }] : []),
        ...(hasEmployeeId ? [{ key: 'employeeId', label: 'Employee ID', width: 110 }] : []),
        // Date is already shown once above ("Showing status for ...") when every
        // row is the same single day - repeating it per row just wastes width.
        ...(!showEmployeeColumns ? [{ key: 'date', label: 'Date', width: 110 }] : []),
        { key: 'punchIn', label: 'Punch In', width: 100 },
        { key: 'punchOut', label: 'Punch Out', width: 100 },
        { key: 'workingHours', label: 'Working Hours', width: 120 },
        { key: 'status', label: 'Status', width: 110 },
      ]
  const gridTemplateColumns = columns.map((c) => `${c.width}px`).join(' ')
  const gridMinWidth = columns.reduce((sum, c) => sum + c.width, 0)

  function renderCell(key: string, r: DrillDownRecord) {
    switch (key) {
      case 'employee': return r.employee?.trim() || '--'
      case 'employeeId': return r.employeeId?.trim() || '--'
      case 'date': return r.date
      case 'punchIn': return r.punchIn ?? '--'
      case 'punchOut': return r.punchOut ?? '--'
      case 'workingHours': return r.workingHours ?? '--'
      case 'presentDays': return r.presentDays ?? '--'
      case 'absentDays': return r.absentDays ?? '--'
      case 'lateDays': return r.lateDays ?? '--'
      case 'workingDays': return r.workingDays ?? '--'
      case 'attendancePercentage':
        return r.attendancePercentage === undefined ? '--' : (
          <Badge variant={getAttendanceBadgeTone(r.attendancePercentage)}>{r.attendancePercentage}%</Badge>
        )
      case 'status':
        return r.status ? (
          <Badge variant={getStatusBadgeTone(r.status)} className="capitalize">
            {r.status.replace('-', ' ')}
          </Badge>
        ) : '--'
      case 'actions':
        return (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            aria-label={`View day-wise attendance for ${r.employee}`}
            onClick={() => handleViewEmployeeCalendar(r)}
          >
            <Eye className="size-4" />
          </Button>
        )
      default: return null
    }
  }

  const dayWiseColumns: { key: string; label: string; width: number }[] = [
    { key: 'date', label: 'Date', width: 120 },
    { key: 'dayName', label: 'Day', width: 110 },
    { key: 'punchIn', label: 'Punch In', width: 100 },
    { key: 'punchOut', label: 'Punch Out', width: 100 },
    { key: 'workingHours', label: 'Working Hours', width: 120 },
    { key: 'status', label: 'Status', width: 110 },
  ]
  const dayWiseGridTemplateColumns = dayWiseColumns.map((c) => `${c.width}px`).join(' ')
  const dayWiseGridMinWidth = dayWiseColumns.reduce((sum, c) => sum + c.width, 0)

  function renderDayWiseCell(key: string, r: DayWiseAttendanceRecord) {
    switch (key) {
      case 'date': return r.date
      case 'dayName': return r.dayName
      case 'punchIn': return r.punchIn
      case 'punchOut': return r.punchOut
      case 'workingHours': return r.workingHours
      case 'status':
        return r.status ? (
          <Badge variant={getStatusBadgeTone(r.status)} className="capitalize">
            {r.status.replace('-', ' ')}
          </Badge>
        ) : '--'
      default: return null
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Height stays the base variant's full viewport height (inset-y-0 +
          h-full) - only width shrinks to fit. The base variant's w-3/4 is a
          fixed fraction of the viewport regardless of content, so a narrow
          table (few columns, one row) still opened a wide panel with blank
          space to its right. w-fit sizes the panel to its widest actual
          content (the summary cards or the roster grid, whichever is wider)
          instead, still capped by max-w-5xl for a genuinely wide roster and
          never shrinking below min-w so the header/cards always have
          breathing room. */}
      <SheetContent className="w-fit min-w-[420px] max-w-[95vw] sm:max-w-5xl p-0 flex flex-col gap-0 border-l border-border/80">
        <SheetHeader className="flex flex-row items-start justify-between gap-4 p-6 pb-0 space-y-0 text-left">
          <div>
            <SheetTitle className="text-lg font-semibold">
              {record.department || record.employee || 'Report Details'}
            </SheetTitle>
            {record.employee && (
              <SheetDescription className="mt-1">
                {record.employeeId ? `${record.employeeId} • ` : ''}{record.department || ''}
              </SheetDescription>
            )}
          </div>
          {/* <button
            onClick={() => onOpenChange(false)}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </button> */}
        </SheetHeader>

        <div className="flex-1 min-h-0 p-6 flex flex-col gap-6 mt-0">
          {record.attendancePercentage !== undefined && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                {isRangeSummary
                  ? 'Totals for the selected report period - the table below breaks these down per employee for the same period.'
                  : "Totals for the selected report period - the table below is a single day's snapshot, so its statuses won't necessarily add up to these."}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Attendance %</CardTitle>
                    <TrendingUp className="size-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{record.attendancePercentage}%</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Present</CardTitle>
                    <TrendingUp className="size-4 text-success" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-success">{record.present ?? 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Late</CardTitle>
                    <Clock className="size-4 text-warning" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-warning">{record.late ?? 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Early Going</CardTitle>
                    <TrendingDown className="size-4 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{record.earlyGoing ?? 0}</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/*
            The whole "Employee Attendance" card scrolls as one unit (not a
            div wrapped specifically around the <table> markup), so the
            title/caption scroll away with the rows while the column header
            stays sticky within this same box.

            !overflow-auto: Card's base styles set overflow-hidden (for its
            rounded corners) - the ! forces both axes to actually scroll
            regardless of Tailwind's generated class order.

            This Card has to be the ONLY overflow container between here and
            the sticky <th> cells below. Any intermediate div with its own
            overflow-x-auto - including the shared Table component's
            built-in wrapper, which is why a raw <table> is used instead -
            silently becomes the sticky positioning's reference frame
            instead of this Card, per the CSS rule that promotes overflow-y
            to auto whenever overflow-x is set to anything but visible; since
            that inner div never itself scrolls, the header would never
            visibly stick.
          */}
          <Card className="flex flex-col max-h-[460px] !overflow-auto">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                {dayWiseEmployee ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-2 mb-1 h-7 gap-1 px-2 text-xs text-muted-foreground"
                      onClick={() => setDayWiseEmployee(null)}
                    >
                      <ArrowLeft className="size-3.5" />
                      Back to employee list
                    </Button>
                    <CardTitle className="text-sm font-medium">
                      {dayWiseEmployee.employee?.trim() || 'Employee'} - Day-wise Attendance
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {dayWiseEmployee.date} - each date that contributed to the Present/Absent/Late counts above
                    </p>
                  </>
                ) : (
                  <>
                    <CardTitle className="text-sm font-medium">
                      {showEmployeeColumns ? 'Employee Attendance' : 'Recent Attendance Records'}
                    </CardTitle>
                    {recentRecords[0]?.date && (
                      <p className="text-xs text-muted-foreground">
                        {isRangeSummary
                          ? `Present/Absent/Late day counts for ${recentRecords[0].date}`
                          : (
                            <>
                              Showing status for {recentRecords[0].date}
                              {recentRecords.length > 0 && recentRecords.every((r) => r.status === 'absent') &&
                                ' - no punches recorded for anyone on this date yet.'}
                            </>
                          )}
                      </p>
                    )}
                  </>
                )}
              </div>
              {!dayWiseEmployee && !isRangeSummary && showEmployeeColumns && recentRecords.length > 0 && (
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={STATUS_FILTER_OPTIONS}
                  className="w-40 shrink-0"
                  aria-label="Filter by status"
                />
              )}
            </CardHeader>
            <CardContent>
              {dayWiseEmployee ? (
                dayWiseRecords.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {dayWiseLoading ? 'Loading day-wise attendance…' : 'No attendance records for this period.'}
                  </p>
                ) : (
                  <div
                    role="table"
                    className="grid rounded-md border border-border text-sm"
                    style={{ gridTemplateColumns: dayWiseGridTemplateColumns, minWidth: dayWiseGridMinWidth }}
                  >
                    <div role="row" className="contents">
                      {dayWiseColumns.map((c) => (
                        <div
                          key={c.key}
                          role="columnheader"
                          className="sticky top-0 z-10 flex h-10 items-center border-b border-border bg-card px-2 text-xs font-medium text-foreground"
                        >
                          {c.label}
                        </div>
                      ))}
                    </div>
                    {dayWiseRecords.map((r) => (
                      <div key={r.id} role="row" className="contents">
                        {dayWiseColumns.map((c) => (
                          <div
                            key={c.key}
                            role="cell"
                            className="flex items-center border-b border-border px-2 py-2"
                          >
                            {renderDayWiseCell(c.key, r)}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )
              ) : filteredRecords.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {loading ? 'Loading attendance records…' : emptyStateMessage()}
                </p>
              ) : (
                <div
                  role="table"
                  className="grid rounded-md border border-border text-sm"
                  style={{ gridTemplateColumns, minWidth: gridMinWidth }}
                >
                  <div role="row" className="contents">
                    {columns.map((c) => (
                      <div
                        key={c.key}
                        role="columnheader"
                        className="sticky top-0 z-10 flex h-10 items-center border-b border-border bg-card px-2 text-xs font-medium text-foreground"
                      >
                        {c.label}
                      </div>
                    ))}
                  </div>
                  {filteredRecords.map((r) => (
                    <div key={r.id} role="row" className="contents">
                      {columns.map((c) => (
                        <div
                          key={c.key}
                          role="cell"
                          className="flex items-center border-b border-border px-2 py-2"
                        >
                          {renderCell(c.key, r)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  )
}
