'use client'

/**
 * Shared presentation pieces for the Onboarding & Employee Lifecycle Center.
 *
 * Every label rendered here comes from the API (status_label, stage_label,
 * category_label, date_label, ...) rather than being re-derived on the client,
 * so the screen and the audit trail always read the same words.
 *
 * Adaptation: G2G re-exports `PaginationBar` and `ResultBanner` from the
 * Performance module's shared file (`components/domain/talent/performance/
 * performance-shared.tsx`) since both are domain-agnostic. Target has not
 * ported the Performance & Rewards Center yet, so there is nothing to import
 * from - both are inlined here instead (unchanged logic/markup, copied from
 * G2G's `performance-shared.tsx`) rather than duplicated across a
 * not-yet-existing module boundary.
 */

import * as React from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/g2g/select'
import type {
  ConfirmationStatus,
  DocumentStatus,
  JourneyStage,
  JourneyStatus,
  StageStatus,
  TaskStatus,
} from '../../_lib/onboarding-api'

export { StatusBadge }

/**
 * The design system's actual StatusBadge variants. NB: there is no
 * 'destructive' ('error' is the red one) and no 'info' - passing a name that is
 * not in this list makes the badge render grey with no warning.
 */
export type BadgeVariant =
  | 'default'
  | 'active'
  | 'success'
  | 'inactive'
  | 'pending'
  | 'warning'
  | 'error'
  | 'processing'
  | 'primary'

export function taskStatusVariant(status: TaskStatus): BadgeVariant {
  switch (status) {
    case 'completed':
      return 'success'
    case 'sent':
      return 'processing'
    case 'in_progress':
      return 'primary'
    case 'blocked':
      return 'error'
    default:
      return 'warning'
  }
}

export function journeyStatusVariant(status: JourneyStatus): BadgeVariant {
  switch (status) {
    case 'completed':
      return 'success'
    case 'in-progress':
      return 'processing'
    case 'on-hold':
      return 'warning'
    case 'cancelled':
      return 'error'
    default:
      return 'pending'
  }
}

export function journeyStageVariant(stage: JourneyStage): BadgeVariant {
  switch (stage) {
    case 'confirmed':
      return 'success'
    case 'probation':
      return 'warning'
    case 'exited':
      return 'error'
    case 'preboarding':
      return 'pending'
    default:
      return 'primary'
  }
}

export function documentStatusVariant(status: DocumentStatus): BadgeVariant {
  switch (status) {
    case 'verified':
      return 'success'
    case 'received':
      return 'active'
    case 'sent':
      return 'processing'
    case 'rejected':
      return 'error'
    default:
      return 'warning'
  }
}

export function confirmationVariant(status: ConfirmationStatus): BadgeVariant {
  switch (status) {
    case 'confirmed':
      return 'success'
    case 'extended':
      return 'warning'
    case 'terminated':
      return 'error'
    default:
      return 'pending'
  }
}

export function stageStatusVariant(status: StageStatus): BadgeVariant {
  switch (status) {
    case 'completed':
      return 'success'
    case 'in_progress':
      return 'processing'
    case 'skipped':
      return 'inactive'
    default:
      return 'pending'
  }
}

/** Circular initials avatar used by the task owner column and the sidebar. */
export function Initials({ value, className }: { value: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground',
        className,
      )}
    >
      {value}
    </div>
  )
}

/** Placeholder rows while a table loads, so the layout does not jump. */
export function TableSkeleton({ rows = 5, columns }: { rows?: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((__, cellIndex) => (
            <TableCell key={cellIndex} className="py-3">
              <Skeleton className="h-4 w-full max-w-[140px]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

/** Single-row message inside a table body (empty state / load failure). */
export function TableMessageRow({
  colSpan,
  title,
  description,
  action,
  tone = 'muted',
}: {
  colSpan: number
  title: string
  description?: string
  action?: React.ReactNode
  tone?: 'muted' | 'error'
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-12 text-center">
        <div className="flex flex-col items-center gap-2">
          <span className={cn('text-sm font-semibold', tone === 'error' ? 'text-destructive' : 'text-foreground')}>
            {title}
          </span>
          {description && <span className="text-xs text-muted-foreground">{description}</span>}
          {action}
        </div>
      </TableCell>
    </TableRow>
  )
}

export function InlineSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin', className)} />
}

/** 'all' is the screen's "no filter" token; the API treats it as absent. */
export const ALL = 'all'

/** Strips the 'all' sentinel so it never reaches the query string. */
export function activeFilter(value: string | undefined) {
  return !value || value === ALL ? undefined : value
}

const PER_PAGE_OPTIONS = [
  { label: '10 per page', value: '10' },
  { label: '25 per page', value: '25' },
  { label: '50 per page', value: '50' },
  { label: '100 per page', value: '100' },
]

/**
 * Server-driven pagination bar. Page numbers are windowed around the current
 * page so a 25-page result does not render 25 buttons.
 *
 * Ported from the Performance Center's `performance-shared.tsx` (see the
 * module doc comment above) - unchanged logic and markup.
 */
export function PaginationBar({
  page,
  perPage,
  total,
  lastPage,
  onPageChange,
  onPerPageChange,
}: {
  page: number
  perPage: number
  total: number
  lastPage: number
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
}) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  const pages = React.useMemo(() => {
    const window: number[] = []
    const start = Math.max(1, Math.min(page - 2, lastPage - 4))
    const end = Math.min(lastPage, start + 4)

    for (let index = start; index <= end; index += 1) {
      window.push(index)
    }

    return window
  }, [page, lastPage])

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t bg-muted/5 p-4 sm:flex-row">
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          Showing {from} to {to} of {total} entries
        </span>
        <div className="w-[130px]">
          <Select
            value={String(perPage)}
            options={PER_PAGE_OPTIONS}
            onChange={(value) => onPerPageChange(Number(value))}
            aria-label="Rows per page"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="mr-1 size-4" /> Previous
        </Button>

        {pages[0] > 1 && <span className="px-1 text-muted-foreground">…</span>}

        {pages.map((pageNumber) => (
          <Button
            key={pageNumber}
            variant={pageNumber === page ? 'default' : 'ghost'}
            size="sm"
            className={cn('h-8 w-8', pageNumber === page ? '' : 'text-muted-foreground')}
            onClick={() => onPageChange(pageNumber)}
          >
            {pageNumber}
          </Button>
        ))}

        {pages[pages.length - 1] < lastPage && <span className="px-1 text-muted-foreground">…</span>}

        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        >
          Next <ChevronRight className="ml-1 size-4" />
        </Button>
      </div>
    </div>
  )
}

/**
 * Inline banner for a mutation result, so an API guard message is never lost.
 *
 * Ported from the Performance Center's `performance-shared.tsx` - unchanged.
 */
export function ResultBanner({
  result,
  onDismiss,
}: {
  result: { ok: boolean; message: string } | null
  onDismiss: () => void
}) {
  if (!result) return null

  return (
    <div
      role="status"
      className={cn(
        'flex items-start justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm',
        result.ok
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-destructive/30 bg-destructive/10 text-destructive',
      )}
    >
      <span>{result.message}</span>
      <button type="button" onClick={onDismiss} className="text-xs font-semibold underline">
        Dismiss
      </button>
    </div>
  )
}
