'use client'

export interface EarlyGoingRecord {
  id: string
  employee: string
  employeeId: string
  department: string
  date: string
  punchIn: string
  punchOut: string
  expectedOut: string
  earlyBy: string
  earlyByMin: number
  status: 'present' | 'late' | 'absent'
}

/**
 * Report rows, department/employee options and KPIs all come live from
 * `hrmsService` (`@/app/hrit/_lib/attendance-api`) — see
 * `attendance-reports/page.tsx`. There is no `/api/attendance/*` concept of a
 * "saved report" preset in the Laravel backend, so `savedReports` stays a
 * local UI preset list until one exists.
 */
export const savedReports = [
  { value: 'last-month', label: 'Last Month Report' },
  { value: 'q1-2026', label: 'Q1 2026 Report' },
  { value: 'this-week', label: 'This Week Report' },
]
