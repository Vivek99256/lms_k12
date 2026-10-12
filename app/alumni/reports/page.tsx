'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { alumniApi, type Pagination, type ReportInfo, type ReportResult } from '../_lib/alumni-api';
import { AudienceFilters, type AudienceValue } from '../_components/audience';
import { Banner, EmptyState, FormField, LoadingBlock, MetricTile, PageFrame, humanize, inputClass } from '../_components/alumni-ui';

type Filters = Record<string, string>;

const EVENT_STATUSES = ['draft', 'published', 'completed', 'cancelled'];
const DONATION_STATUSES = ['pledged', 'pending_verification', 'verified', 'rejected', 'cancelled', 'partially_refunded', 'refunded'];
const ALUMNI_FILTER_KEYS = ['batch', 'passing_year_from', 'passing_year_to', 'country', 'city', 'industry', 'company', 'skill'];

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportInfo[] | null>(null);
  const [key, setKey] = useState('');
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    alumniApi.reports(controller.signal).then((r) => { setReports(r); setKey((k) => k || r[0]?.key || ''); }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : "Couldn't load the reports. Try again.");
    });
    return () => controller.abort();
  }, []);

  const current = useMemo(() => reports?.find((r) => r.key === key) ?? null, [reports, key]);
  // only the filters this report understands are sent, so a leftover filter from another report cannot narrow it silently
  const active = useMemo(() => {
    const out: Filters = {};
    for (const k of current?.filters ?? []) if (filters[k]) out[k] = filters[k];
    return out;
  }, [current, filters]);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    alumniApi.report(key, { ...active, page }, controller.signal).then((r) => { setResult(r); setError(''); }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : "Couldn't load the report. Try again.");
    });
    return () => controller.abort();
  }, [key, active, page]);

  const pick = (next: string) => { setKey(next); setFilters({}); setPage(1); setResult(null); setError(''); };
  const change = (next: Filters) => { setFilters(next); setPage(1); };
  const set = (k: string, v: string) => change({ ...filters, [k]: v });

  const download = useCallback(async (format: 'csv' | 'xlsx') => {
    setBusy(true); setError('');
    try { await alumniApi.exportReport(key, active, format); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Couldn't prepare the file. Try again."); }
    finally { setBusy(false); }
  }, [key, active]);

  const filterKeys = current?.filters ?? [];
  const usesAudience = filterKeys.some((k) => ALUMNI_FILTER_KEYS.includes(k));

  return (
    <PageFrame title="Reports" description="Pick a report, narrow it down, and download exactly what you see. Fields that alumni keep private are left out.">
      {error ? <Banner>{error}</Banner> : null}
      {reports === null ? <LoadingBlock label="Loading reports…" /> : (
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <nav aria-label="Reports" className="space-y-1">
            {reports.map((r) => (
              <button key={r.key} type="button" aria-current={r.key === key ? 'page' : undefined} onClick={() => pick(r.key)}
                className={cn('w-full rounded-md border px-3 py-2 text-left text-sm', r.key === key ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                <span className="font-medium">{r.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{r.description}</span>
              </button>
            ))}
          </nav>

          <div className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-label="Filters">
              {usesAudience ? <AudienceFilters value={filters as AudienceValue} onChange={(v) => change({ ...filters, ...Object.fromEntries(ALUMNI_FILTER_KEYS.map((k) => [k, v[k] ?? ''])) })} /> : null}
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                {filterKeys.includes('status') && key === 'event' ? <StatusSelect label="Status" value={filters.status ?? ''} options={EVENT_STATUSES} onChange={(v) => set('status', v)} /> : null}
                {filterKeys.includes('status') && key === 'donation' ? <StatusSelect label="Status" value={filters.status ?? ''} options={DONATION_STATUSES} onChange={(v) => set('status', v)} /> : null}
                {filterKeys.includes('from') ? <FormField label="From"><input className={inputClass} type="date" value={filters.from ?? ''} onChange={(e) => set('from', e.target.value)} /></FormField> : null}
                {filterKeys.includes('to') ? <FormField label="To"><input className={inputClass} type="date" value={filters.to ?? ''} onChange={(e) => set('to', e.target.value)} /></FormField> : null}
                {filterKeys.includes('institution') ? <FormField label="Institution"><input className={inputClass} value={filters.institution ?? ''} onChange={(e) => set('institution', e.target.value)} /></FormField> : null}
                {filterKeys.includes('qualification') ? <FormField label="Qualification"><input className={inputClass} value={filters.qualification ?? ''} onChange={(e) => set('qualification', e.target.value)} /></FormField> : null}
                {filterKeys.includes('current_only') ? (
                  <label className="flex items-center gap-2 pt-6 text-sm text-slate-700"><input type="checkbox" checked={filters.current_only === '1'} onChange={(e) => set('current_only', e.target.checked ? '1' : '')} /> Current jobs only</label>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" className="h-9" onClick={() => change({})} disabled={Object.keys(active).length === 0}>Clear filters</Button>
                <Button className="h-9" disabled={busy || !result} onClick={() => void download('csv')}>Download CSV</Button>
                <Button variant="outline" className="h-9" disabled={busy || !result} onClick={() => void download('xlsx')}>Download Excel</Button>
              </div>
            </section>

            {!result ? <LoadingBlock label="Running the report…" /> : (
              <>
                <div className="grid gap-3 md:grid-cols-4">
                  {result.summary.map((s) => <MetricTile key={s.label} label={s.label} value={typeof s.value === 'number' ? s.value.toLocaleString('en-IN') : s.value} />)}
                </div>
                <ReportTable result={result} onPage={setPage} />
                <p className="text-xs text-slate-500">Generated {result.generated_at}. Downloads include every matching row, up to 20,000.</p>
              </>
            )}
          </div>
        </div>
      )}
    </PageFrame>
  );
}

function StatusSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <FormField label={label}>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Any</option>{options.map((o) => <option key={o} value={o}>{humanize(o)}</option>)}
      </select>
    </FormField>
  );
}

function ReportTable({ result, onPage }: { result: ReportResult; onPage: (page: number) => void }) {
  const p: Pagination = result.pagination;
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {result.rows.length === 0 ? <EmptyState title="Nothing matches" hint="Try removing a filter." /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>{result.columns.map((c) => <th key={c.key} className="px-4 py-2.5 font-medium">{c.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  {result.columns.map((c) => {
                    const v = r[c.key];
                    return <td key={c.key} className="px-4 py-2.5 text-slate-700">{v === null || v === undefined || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString('en-IN') : String(v)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {p.last_page > 1 ? (
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
          <Button variant="outline" size="sm" disabled={p.page <= 1} onClick={() => onPage(p.page - 1)}>Previous</Button>
          <span className="tabular-nums">Page {p.page} of {p.last_page}</span>
          <Button variant="outline" size="sm" disabled={p.page >= p.last_page} onClick={() => onPage(p.page + 1)}>Next</Button>
        </div>
      ) : null}
    </section>
  );
}
