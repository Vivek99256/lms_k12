'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { alumniApi, type AuditDetail, type AuditRow, type Pagination } from '../_lib/alumni-api';
import { Banner, EmptyState, FormField, LoadingBlock, PageFrame, Panel, humanize, inputClass } from '../_components/alumni-ui';

type Data = { rows: AuditRow[]; components: string[]; actions: string[]; pagination: Pagination };

export default function AuditPage() {
  const [filters, setFilters] = useState({ component: '', action: '', q: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    alumniApi.audit({ component: filters.component || undefined, action: filters.action || undefined, q: filters.q || undefined, from: filters.from || undefined, to: filters.to || undefined, page }, controller.signal)
      .then((r) => { setData(r); setError(''); })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : "Couldn't load the audit log. Try again.");
      });
    return () => controller.abort();
  }, [filters, page]);

  const set = (key: keyof typeof filters, value: string) => { setFilters({ ...filters, [key]: value }); setPage(1); };

  return (
    <PageFrame title="Audit log" description="A read-only record of who did what in the alumni module. Entries cannot be edited or deleted here.">
      {error ? <Banner>{error}</Banner> : null}
      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5" aria-label="Filters">
        <FormField label="Screen"><select className={inputClass} value={filters.component} onChange={(e) => set('component', e.target.value)}><option value="">All</option>{data?.components.map((c) => <option key={c} value={c}>{c.replace('alumni.', '')}</option>)}</select></FormField>
        <FormField label="Action"><select className={inputClass} value={filters.action} onChange={(e) => set('action', e.target.value)}><option value="">All</option>{data?.actions.map((a) => <option key={a} value={a}>{humanize(a)}</option>)}</select></FormField>
        <FormField label="Person or record"><input className={inputClass} placeholder="Name or id" value={filters.q} onChange={(e) => set('q', e.target.value)} /></FormField>
        <FormField label="From"><input className={inputClass} type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} /></FormField>
        <FormField label="To"><input className={inputClass} type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} /></FormField>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {data === null ? <LoadingBlock label="Loading the audit log…" /> : data.rows.length === 0 ? <EmptyState title="No entries" hint="Nothing matches these filters." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="px-4 py-2.5 font-medium">When</th><th className="px-4 py-2.5 font-medium">Who</th><th className="px-4 py-2.5 font-medium">Screen</th><th className="px-4 py-2.5 font-medium">Action</th><th className="px-4 py-2.5 font-medium">Record</th><th className="px-4 py-2.5"><span className="sr-only">Details</span></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((r) => (
                  <tr key={r.id} className={cn('hover:bg-slate-50', open === r.id && 'bg-indigo-50/50')}>
                    <td className="px-4 py-2.5 text-slate-600">{r.created_at}</td>
                    <td className="px-4 py-2.5 text-slate-800">{r.actor_name ?? (r.actor_user_id ? `User ${r.actor_user_id}` : 'System')}</td>
                    <td className="px-4 py-2.5 text-slate-700">{(r.component ?? '').replace('alumni.', '')}</td>
                    <td className="px-4 py-2.5 text-slate-700">{humanize(r.action)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.entity_type ? `${humanize(r.entity_type.replace('alumni_', ''))}${r.entity_id ? ` #${r.entity_id}` : ''}` : '—'}</td>
                    <td className="px-4 py-2.5 text-right"><Button size="sm" variant="outline" aria-label={`Details of entry ${r.id}`} onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Hide' : 'Details'}</Button></td>
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
      {open !== null && data?.rows.some((r) => r.id === open) ? <Entry key={open} id={open} /> : null}   {/* never show an entry that the current filters no longer list */}
    </PageFrame>
  );
}

function Entry({ id }: { id: number }) {
  const [d, setD] = useState<AuditDetail | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    alumniApi.auditEntry(id, controller.signal).then(setD).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : "Couldn't load the entry. Try again.");
    });
    return () => controller.abort();
  }, [id]);
  if (!d) return error ? <Banner>{error}</Banner> : <LoadingBlock />;
  const block = (title: string, value: Record<string, unknown> | null) => value ? (
    <div><h3 className="mb-1 text-sm font-semibold text-slate-800">{title}</h3><pre className="max-h-64 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(value, null, 2)}</pre></div>
  ) : null;
  return (
    <Panel title={`Entry ${d.id}: ${humanize(d.action)}`}>
      <div className="space-y-3 text-sm">
        <p className="text-slate-600">{d.created_at} · {d.actor_name ?? 'System'}{d.ip ? ` · from ${d.ip}` : ''}</p>
        {block('Before', d.before)}{block('After', d.after)}
        {!d.before && !d.after ? <p className="text-slate-500">No further detail was recorded.</p> : null}
      </div>
    </Panel>
  );
}
