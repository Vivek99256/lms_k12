'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { alumniApi, type EventRow, type Pagination } from '../_lib/alumni-api';
import { EventForm, EventStatus } from '../_components/event-bits';
import { Banner, EmptyState, LoadingBlock, PageFrame, formatDate, humanize, inputClass } from '../_components/alumni-ui';

export default function EventsPage() {
  const [filters, setFilters] = useState({ status: '', event_type: '', q: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: EventRow[]; types: { key: string; label: string }[]; pagination: Pagination } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback((signal?: AbortSignal) =>
    alumniApi.events({ status: filters.status || undefined, event_type: filters.event_type || undefined, q: filters.q || undefined, page }, signal)
      .then((r) => { setData(r); setError(''); })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : "Couldn't load events. Try again.");
      }), [filters, page]);
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  return (
    <PageFrame title="Events" description="Plan reunions and talks, take registrations within capacity, and record who actually came."
      actions={<Button className="h-9" onClick={() => setCreating((v) => !v)}>{creating ? 'Close form' : 'New event'}</Button>}>
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}
      {creating ? <EventForm types={data?.types ?? []} onSaved={() => { setCreating(false); setNotice('Event saved as a draft. Publish it when it is ready.'); void load(); }} /> : null}

      <div className="grid gap-2 md:grid-cols-3">
        <input aria-label="Search events" placeholder="Search by name or venue" className={inputClass} value={filters.q} onChange={(e) => { setFilters({ ...filters, q: e.target.value }); setPage(1); }} />
        <select aria-label="Filter by status" className={inputClass} value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}>
          <option value="">All statuses</option>{['draft', 'published', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
        <select aria-label="Filter by type" className={inputClass} value={filters.event_type} onChange={(e) => { setFilters({ ...filters, event_type: e.target.value }); setPage(1); }}>
          <option value="">All types</option>{data?.types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {data === null ? <LoadingBlock label="Loading events…" /> : data.rows.length === 0 ? <EmptyState title="No events found" hint="Create an event to start taking registrations." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="px-4 py-2.5 font-medium">Event</th><th className="px-4 py-2.5 font-medium">Date</th><th className="px-4 py-2.5 font-medium">Venue</th><th className="px-4 py-2.5 font-medium">Seats</th><th className="px-4 py-2.5 font-medium">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3"><Link href={`/alumni/events/${e.id}`} className="font-medium text-indigo-700 hover:underline">{e.name}</Link><div className="text-xs text-slate-500">{humanize(e.event_type)}</div></td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(e.event_date)}{e.start_time ? ` · ${e.start_time}` : ''}</td>
                    <td className="px-4 py-3 text-slate-700">{e.mode === 'online' ? 'Online' : e.venue ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{e.seats_used}{e.capacity ? ` / ${e.capacity}` : ''}</td>
                    <td className="px-4 py-3"><EventStatus value={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.pagination.last_page > 1 ? (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            <Button variant="outline" size="sm" disabled={data.pagination.page <= 1} onClick={() => setPage(data.pagination.page - 1)}>Previous</Button>
            <span className="tabular-nums">Page {data.pagination.page} of {data.pagination.last_page}</span>
            <Button variant="outline" size="sm" disabled={data.pagination.page >= data.pagination.last_page} onClick={() => setPage(data.pagination.page + 1)}>Next</Button>
          </div>
        ) : null}
      </section>
    </PageFrame>
  );
}
