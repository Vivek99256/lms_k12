'use client'

/**
 * Ported from G2G's `components/domain/task/tm-audit-logs.tsx`.
 *
 * Reads the real task_management_audit_logs trail that TaskAuditService writes
 * on every task change (status, edits, approvals, archives, deadline moves).
 * The export button downloads the same trail as CSV, server-streamed.
 *
 * Adaptation: `taskService` + `getLaravelContext()` -> `useAuditLogs()`
 * (`../../../_lib/use-administration.ts`); `exportUrl()` resolves the session
 * itself (no-op when unresolvable) rather than the component re-checking
 * `isLaravelContextReady`.
 */

import { useState } from 'react'
import { Download, ScrollText, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { SearchInput } from '@/components/ui/search-input'
import { PageFrame, PageHeader, InlineMessage } from '../../../_components/task-shared'
import { useAuditLogs } from '../../../_lib/use-administration'

/** Human labels for the event slugs the audit service records. */
const EVENT_LABELS: Record<string, string> = {
  status_changed: 'Status changed',
  workspace_updated: 'Task edited',
  legacy_updated: 'Task edited',
  legacy_deleted: 'Task deleted',
  archived: 'Task archived',
  approved: 'Approved',
  rejected: 'Sent back for rework',
  deadline_extended: 'Deadline extended',
}

export function AuditLogsCenter() {
  const { logs, pagination, page, setPage, loading, error, exportUrl } = useAuditLogs()
  const [search, setSearch] = useState('')

  // The API filters by task/event/date; free-text narrowing over the loaded
  // page happens here, which is what an admin scanning a screen expects.
  const visible = search
    ? logs.filter((log) =>
        [log.task_title, log.actor, log.event]
          .some((field) => field?.toLowerCase().includes(search.toLowerCase())))
    : logs

  const handleExport = () => {
    const href = exportUrl()
    if (!href) return
    const link = document.createElement('a')
    link.href = href
    link.rel = 'noopener'
    link.click()
  }

  return (
    <PageFrame>
      <PageHeader
        title="Audit logs"
        description="Every task change, who made it, and what it looked like before."
        action={
          <Button variant="outline" onClick={handleExport} disabled={logs.length === 0}>
            <Download className="mr-2 size-4" /> Export CSV
          </Button>
        }
      />

      <div className="max-w-sm">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter by task, person, or event…"
          icon={<Search className="size-4" />}
        />
      </div>

      {error && <InlineMessage type="error" text={error} />}
      {loading && <div className="flex h-40 items-center justify-center"><Spinner /></div>}

      {!loading && !error && visible.length === 0 && (
        <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground">
          <ScrollText className="size-6" />
          {logs.length === 0
            ? 'No audit entries yet. They accumulate as tasks are changed.'
            : 'Nothing on this page matches the filter.'}
        </div>
      )}

      {!loading && visible.length > 0 && (
        <Card>
          <CardContent className="divide-y p-0">
            {visible.map((log) => (
              <div key={log.id} className="flex flex-wrap items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {EVENT_LABELS[log.event] ?? log.event}
                    <span className="text-muted-foreground"> — {log.task_title ?? `Task #${log.task_id}`}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {log.actor ?? 'System'} · {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                  </p>
                  {log.before && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Before: {Object.entries(log.before)
                        .filter(([, value]) => value !== null && value !== undefined)
                        .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`)
                        .join(' · ') || '—'}
                    </p>
                  )}
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">#{log.task_id}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span>{pagination.total} entries</span>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <span>Page {pagination.current_page} of {pagination.last_page}</span>
            <Button variant="outline" size="sm" disabled={page >= pagination.last_page} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </div>
      )}
    </PageFrame>
  )
}
