import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default:
          'border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300',
        active:
          'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400',
        success:
          'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400',
        inactive:
          'border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400',
        pending:
          'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-400',
        warning:
          'border border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800/60 dark:bg-orange-950/40 dark:text-orange-400',
        error:
          'border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-400',
        processing:
          'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-400',
        primary:
          'border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-400',
      },
      size: {
        sm: 'text-[11px] px-2 py-0.5',
        default: 'text-xs px-2.5 py-0.5',
        lg: 'text-sm px-3 py-1',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

const dotColors: Record<string, string> = {
  active: 'bg-emerald-500',
  success: 'bg-emerald-500',
  pending: 'bg-amber-500',
  warning: 'bg-orange-500',
  error: 'bg-rose-500',
  processing: 'bg-blue-500',
  primary: 'bg-indigo-500',
  inactive: 'bg-slate-400',
  default: 'bg-slate-400',
}

interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  icon?: React.ReactNode
  status?: string
  label?: string
}

/**
 * Maps common status strings to variant values.
 * For domain-specific statuses, use a helper function that returns the appropriate variant.
 */
const statusVariantMap: Record<string, VariantProps<typeof statusBadgeVariants>['variant']> = {
  Active: 'active',
  active: 'active',
  Enabled: 'active',
  enabled: 'active',
  Published: 'active',
  published: 'active',
  Approved: 'active',
  approved: 'active',
  Complete: 'active',
  complete: 'active',
  Completed: 'active',
  completed: 'active',
  Verified: 'active',
  verified: 'active',
  Confirmed: 'active',
  confirmed: 'active',
  Inactive: 'inactive',
  inactive: 'inactive',
  Disabled: 'inactive',
  disabled: 'inactive',
  Archived: 'inactive',
  archived: 'inactive',
  Deleted: 'inactive',
  deleted: 'inactive',
  Pending: 'pending',
  pending: 'pending',
  PENDING: 'pending',
  Draft: 'pending',
  draft: 'pending',
  'On Leave': 'pending',
  'on-leave': 'pending',
  OnHold: 'warning',
  'on-hold': 'warning',
  'On Hold': 'warning',
  'ON HOLD': 'warning',
  Processing: 'processing',
  processing: 'processing',
  Submitted: 'pending',
  submitted: 'pending',
  AwaitingReview: 'pending',
  'awaiting-review': 'pending',
  AwaitingApproval: 'pending',
  'awaiting-approval': 'pending',
  Rejected: 'error',
  rejected: 'error',
  Failed: 'error',
  failed: 'error',
  Error: 'error',
  error: 'error',
  Cancelled: 'error',
  cancelled: 'error',
  Expired: 'error',
  expired: 'error',
  InProgress: 'processing',
  'in-progress': 'processing',
  'IN-PROGRESS': 'processing',
  'In Progress': 'processing',
  in_progress: 'processing',
  Ongoing: 'processing',
  ongoing: 'processing',
  Scheduled: 'processing',
  scheduled: 'processing',
  review: 'pending',
  blocked: 'error',
  BLOCKED: 'error',
  COMPLETED: 'active',
  PLANNING: 'inactive',
  'AT RISK': 'error',
  UPCOMING: 'processing',
  ARCHIVED: 'inactive',
  present: 'active',
  late: 'pending',
  absent: 'error',
  'half-day': 'pending',
  leave: 'default',
  'early-going': 'warning',
  'Early Going': 'warning',
  Live: 'active',
  live: 'active',
  'Coming Soon': 'processing',
  'coming-soon': 'processing',
  Planned: 'inactive',
  planned: 'inactive',
  Pilot: 'processing',
  pilot: 'processing',
  'sent-back': 'processing',
  'Verbal Warning': 'default',
  'Written Warning': 'warning',
  Suspension: 'error',
  'Training Assigned': 'processing',
  'Final Warning': 'error',
  'Escalated to HR': 'error',
  Upcoming: 'processing',
  'Due Soon': 'warning',
  Overdue: 'error',
  'Not Applicable': 'inactive',
  'Pending Verification': 'pending',
}

const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ className, variant, status, label, size, icon, children, ...props }, ref) => {
    const activeVariant = status ? (statusVariantMap[status] || variant || 'default') : (variant || 'default')
    const dot = dotColors[activeVariant as string] || 'bg-slate-400'

    return (
      <div
        ref={ref}
        className={cn(statusBadgeVariants({ variant: activeVariant, size, className }))}
        {...props}
      >
        {icon ? <span>{icon}</span> : <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dot)} />}
        {children || label || (status ? status.replace(/-/g, ' ') : null)}
      </div>
    )
  },
)
StatusBadge.displayName = 'StatusBadge'

export { StatusBadge, statusBadgeVariants, statusVariantMap }
