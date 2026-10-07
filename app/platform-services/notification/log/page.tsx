'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchNotificationLog, PlatformApiError, type NotificationLogRow } from '@/lib/platform/client';
import type { PageMeta } from '@/lib/platform/types';

import { Card, ErrorState, formatWhen, LoadingState, Pager, Pill, PlainShell, RefreshButton, SampleBadge } from '../../_components/shell';

/**
 * Platform services -> Delivery log.
 *
 * What the notification service actually did with each message. `skipped` means
 * it was not sent, and the reason is shown: a channel switched off, or no
 * provider configured. Nothing here is recorded as sent unless it was.
 */

const TONE = { queued: 'gray', sent: 'green', failed: 'red', skipped: 'amber' } as const;
const PER_PAGE = 25;

export default function NotificationLogPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<NotificationLogRow[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await fetchNotificationLog({ status: status || undefined, page, per_page: PER_PAGE });
      setRows(result.rows);
      setMeta(result.meta);
    } catch (reason) {
      setError(reason instanceof PlatformApiError ? reason.message : 'The delivery log could not be loaded.');
    }
  }, [status, page]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  return (
    <PlainShell
      title="Delivery log"
      description="Every notification the platform tried to send, with the result and the reason when it was not sent."
      actions={
        <>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by status"
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            <option value="sent">Sent</option>
            <option value="skipped">Skipped</option>
            <option value="failed">Failed</option>
            <option value="queued">Queued</option>
          </select>
          <RefreshButton onClick={() => void load()} busy={rows === null && !error} />
        </>
      }
    >
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : rows === null ? (
        <LoadingState label="Loading delivery log" />
      ) : rows.length === 0 ? (
        <Card className="p-6 text-sm text-slate-600">No notifications match.</Card>
      ) : (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Event</th>
                  <th className="px-3 py-2">Channel</th>
                  <th className="px-3 py-2">Recipient</th>
                  <th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2">Tries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatWhen(row.created_at)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.event_key}</td>
                    <td className="px-3 py-2">{row.channel}</td>
                    <td className="px-3 py-2">
                      {row.recipient} <SampleBadge show={Boolean(Number(row.is_sample))} />
                    </td>
                    <td className="px-3 py-2">
                      <Pill tone={TONE[row.status]}>{row.status}</Pill>
                      {row.last_error && <p className="mt-1 max-w-sm text-xs text-slate-500">{row.last_error}</p>}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{row.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {meta && <Pager page={page} perPage={PER_PAGE} total={meta.total} onPage={setPage} />}
        </>
      )}
    </PlainShell>
  );
}
