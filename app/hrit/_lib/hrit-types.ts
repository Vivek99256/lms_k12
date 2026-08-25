/**
 * HRIT shared presentation types.
 *
 * Ported as-is from G2G:
 *  - components/domain/hrms/hrit/attendance-management/types.ts
 *  - types/leave-dashboard.ts
 *
 * Field names/shapes are unchanged; only the two source files were combined
 * into one module for the target's `_lib` convention.
 */

// ---------------------------------------------------------------------------
// From components/domain/hrms/hrit/attendance-management/types.ts
// ---------------------------------------------------------------------------

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'half-day' | 'leave'

export interface AttendanceRecord {
  id: string
  date: string
  day: string
  punchIn?: string
  punchOut?: string
  totalHours?: string
  breakTime?: string
  overtime?: string
  status: AttendanceStatus
  location?: string
}

export interface LeaveBalance {
  casual: number
  earned: number
  sick: number
  pending: number
}

export interface Event {
  id: string
  title: string
  date: string
  type: 'holiday' | 'event' | 'leave'
  description?: string
}

export interface MonthlySummary {
  present: number
  late: number
  leave: number
  absent: number
}

// ---------------------------------------------------------------------------
// From types/leave-dashboard.ts
// ---------------------------------------------------------------------------

/**
 * Leave types are institute-defined rows in hrms_leave_types, so this cannot be a
 * closed union - the API returns whatever the institute has configured.
 */
export type LeaveType = string

/**
 * Laravel's hrms_emp_leaves.status vocabulary. The API uses the snake_case
 * 'sent_back'; the design system's StatusBadge already styles the hyphenated
 * form, so leaveStatusTone() in hooks/use-leave.ts bridges the two.
 */
export type LeaveRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'sent-back'
  | 'cancelled'
  | 'approved_lwp'

/**
 * The activity feed renders three tones. Laravel also emits 'cancellation',
 * which mapActivity() collapses into 'rejection'.
 */
export type ActivityType = 'application' | 'approval' | 'rejection'

export type DashboardStatTone =
  | 'primary'
  | 'warning'
  | 'success'
  | 'destructive'
  | 'info'
  | 'muted'

export interface DashboardUser {
  id: string
  name: string
  role: string
  email: string
}

export interface DashboardStat {
  id: string
  title: string
  value: number
  suffix?: string
  percentageChange: number
  icon: 'clipboard-list' | 'clock' | 'check-circle' | 'x-circle' | 'users' | 'calendar-days'
  tone: DashboardStatTone
}

export interface LeaveRequest {
  id: string
  employeeId: string
  employee: {
    id: string
    name: string
    avatar?: string
    designation?: string
    email?: string
    mobileNumber?: string
  }
  department: string
  leaveType: LeaveType
  leaveBalanceBefore?: number
  duration: string
  session?: 'Full Day' | 'Half Day'
  appliedDate: string
  fromDate: string
  toDate: string
  status: LeaveRequestStatus
  approver?: string
  submittedDate?: string
  reason?: string
  backupEmployee?: string
  pendingTasks?: string
  handoverNotes?: string
  approvalWorkflow?: {
    stage: string
    status: LeaveRequestStatus | 'completed'
  }[]
}

export interface Holiday {
  id: string
  name: string
  date: string
  day: string
}

export interface Activity {
  id: string
  title: string
  description: string
  timestamp: string
  type: ActivityType
}

export interface LeaveTrendData {
  month: string
  requests: number
  approved: number
  rejected: number
}

export interface LeaveTypeDistribution {
  name: LeaveType
  value: number
  color: string
}

export interface DepartmentLeaveData {
  department: string
  requests: number
  approved: number
  rejected: number
}

export interface EmployeeLeave {
  id: string
  employee: string
  leaveType: LeaveType
  fromDate: string
  toDate: string
  duration: string
}

export interface LeaveBalanceSnapshot {
  id: string
  label: string
  used: number
  total: number
  tone: DashboardStatTone
}

export interface LeaveQuickAction {
  id: string
  icon: string
  label: string
  description: string
}
