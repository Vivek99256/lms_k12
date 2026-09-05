'use client'

/**
 * THE LADDER: error, then loading, then empty, then content. Never merged.
 *
 * Ported from g2gv0's `components/domain/competency/load-state.tsx` verbatim
 * — no import needed re-pointing, `EmptyState`/`ErrorState`/`Skeleton`/`cn`
 * all already live at the same paths in this repo.
 */

import type { ReactNode } from 'react'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Turn a failure into something a person can act on.
 *
 * The status code decides; the prose only refines. `status` is optional so
 * callers that only have a string still work — they fall back to the prose
 * tests.
 */
export function describeFailure(
  message: string,
  status?: number,
): { title: string; description: string } {
  if (status === 502 || status === 504) {
    return {
      title: 'The server did not respond',
      description:
        'The request reached the gateway but the application never answered. '
        + 'Nothing was written. This is a server problem, not a problem with your data.',
    }
  }

  if (status === 422 || /ran out of room before finishing|too large for a single pass/i.test(message)) {
    return {
      title: 'The draft did not fit in one pass',
      description: message,
    }
  }

  if (status === 402 || /balance is too low|Refusing to call DeepSeek/i.test(message)) {
    return { title: 'AI credit is too low to run this', description: message }
  }

  if (status === 503 || /503|not configured/i.test(message)) {
    return {
      title: 'AI is not configured on this server',
      description:
        'The classification pass needs a server-side key. Nothing was written, '
        + 'and no task was guessed at.',
    }
  }

  if (status === 404 || (status === undefined && /API Error: 404/i.test(message))) {
    const routeMissing = /API Error: 404/i.test(message)
    return {
      title: routeMissing ? 'This screen needs a newer backend' : 'Not found',
      description: routeMissing
        ? 'These endpoints are not available on the server this app is talking to. '
          + 'Nothing is wrong with your data - the server has not been updated yet.'
        : message,
    }
  }

  return { title: 'Could not load this', description: message }
}

export function LoadState({
  error,
  rows,
  onRetry,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  rowHeight = 'h-14',
  children,
}: {
  error: string | null
  /** `null` means still loading. `[]` means genuinely empty. Never `[]` on failure. */
  rows: unknown[] | null
  onRetry: () => void
  emptyIcon: ReactNode
  emptyTitle: string
  emptyDescription: string
  rowHeight?: string
  children: ReactNode
}) {
  if (error && rows === null) {
    const { title, description } = describeFailure(error)
    return <ErrorState title={title} description={description} retry={onRetry} />
  }
  if (rows === null) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className={cn(rowHeight, 'w-full rounded-xl')} />)}
      </div>
    )
  }
  if (rows.length === 0) {
    return <EmptyState className="border-0" icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
  }
  return <>{children}</>
}
