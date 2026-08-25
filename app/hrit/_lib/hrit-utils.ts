/**
 * HRIT presentation helpers.
 *
 * Ported as-is from G2G:
 *  - lib/greeting.ts (getGreeting / getGreetingPeriod)
 *  - lib/chart-colors.ts (chart color tokens)
 *  - lib/leave-management-data.ts (quickActions, date formatters — minus the
 *    `LeaveQuickAction` type import, which now comes from `./hrit-types`)
 *
 * Combined into one module for the target's `_lib` convention; logic unchanged.
 */

import type { LeaveQuickAction } from './hrit-types'

// ---------------------------------------------------------------------------
// From lib/greeting.ts
// ---------------------------------------------------------------------------

export type GreetingPeriod = 'Morning' | 'Afternoon' | 'Evening' | 'Night'

export function getGreetingPeriod(): GreetingPeriod {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Morning'
  if (hour >= 12 && hour < 17) return 'Afternoon'
  if (hour >= 17 && hour < 21) return 'Evening'
  return 'Night'
}

export function getGreeting(name: string): string {
  const period = getGreetingPeriod()
  return `Good ${period}, ${name}! 👋`
}

// ---------------------------------------------------------------------------
// From lib/chart-colors.ts
// ---------------------------------------------------------------------------

export const chartStatusColors = {
  primary: 'var(--chart-blue)',
  success: 'var(--chart-green)',
  warning: 'var(--chart-yellow)',
  danger: 'var(--chart-red)',
  secondary: 'var(--chart-indigo)',
  muted: 'var(--muted-foreground)',
  brand: 'var(--brand-navy-light)',
  accent: 'var(--surface-muted)',
} as const

export const leaveChartColors = {
  requests: 'var(--chart-blue)',
  approved: 'var(--chart-green)',
  rejected: 'var(--chart-red)',
} as const

export const attendanceChartColors = {
  present: 'var(--chart-blue)',
  late: 'var(--chart-yellow)',
  earlyGoing: 'var(--chart-teal)',
  absent: 'var(--chart-red)',
  onTime: 'var(--chart-green)',
  overtime: 'var(--chart-indigo)',
} as const

export const taskChartColors = {
  completed: 'var(--chart-green)',
  inProgress: 'var(--chart-blue)',
  overdue: 'var(--chart-red)',
  pending: 'var(--chart-indigo)',
  blocked: 'var(--chart-yellow)',
} as const

export function getChartColor(token: string): string {
  const colorMap: Record<string, string> = {
    primary: 'var(--chart-blue)',
    success: 'var(--chart-green)',
    warning: 'var(--chart-yellow)',
    danger: 'var(--chart-red)',
    secondary: 'var(--chart-indigo)',
    brand: 'var(--brand-navy-light)',
    accent: 'var(--surface-muted)',
  }
  return colorMap[token] || 'var(--muted-foreground)'
}

// ---------------------------------------------------------------------------
// From lib/leave-management-data.ts
// ---------------------------------------------------------------------------

/**
 * Leave Management presentation helpers.
 *
 * All leave data comes from the Laravel /api/leave/* endpoints via
 * `./leave-api.ts`. What remains here is the navigation-only quick action
 * list plus the date formatters the dashboard cards share.
 */

export const quickActions: LeaveQuickAction[] = [
  { id: 'apply', icon: 'calendar-plus', label: 'Apply Leave', description: 'Request time off from work' },
  { id: 'requests', icon: 'clipboard-list', label: 'My Requests', description: 'View your leave history' },
  { id: 'balance', icon: 'calendar-days', label: 'Leave Balance', description: 'Check your remaining leaves' },
  { id: 'reports', icon: 'chart-bar', label: 'Leave Reports', description: 'View team analytics' },
]

/** Guards against the empty / malformed dates the API can return for open ranges. */
function parseDate(dateString: string): Date | null {
  if (!dateString) return null
  const parsed = new Date(dateString.includes('T') ? dateString : `${dateString}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const formatDate = (dateString: string): string => {
  const parsed = parseDate(dateString)
  if (!parsed) return '—'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed)
}

export const formatDateShort = (dateString: string): string => {
  const parsed = parseDate(dateString)
  if (!parsed) return '—'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(parsed)
}

export const getCurrentDate = (): string =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date())
