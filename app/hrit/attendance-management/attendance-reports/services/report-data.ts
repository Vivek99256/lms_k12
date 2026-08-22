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

export const savedReports = [
  { value: 'last-month', label: 'Last Month Report' },
  { value: 'q1-2026', label: 'Q1 2026 Report' },
  { value: 'this-week', label: 'This Week Report' },
]
