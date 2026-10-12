'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Plus, Search, UserCheck } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { alumniApi, AlumniApiError, type AlumniMeta, type AlumniRow, type AlumniStatus, type ListFilters, type Pagination } from '../_lib/alumni-api';
import {
  AlumniStatusBadge, Banner, EmptyState, LoadingBlock, PageFrame, Panel, ProgressBar, STATUS_LABEL, humanize, inputClass,
} from '../_components/alumni-ui';

const PER_PAGE = 25;
// Filters a link (for example from the Batches page) may pre-set.
const URL_FILTERS = ['status', 'batch', 'passing_year', 'admission_year', 'course', 'department', 'campus', 'country', 'city', 'industry', 'employment_status'] as const;

const COLUMNS: { key: string; label: string; sortable?: string }[] = [
  { key: 'alumni_code', label: 'Alumni ID', sortable: 'alumni_code' },
  { key: 'full_name', label: 'Name', sortable: 'full_name' },
  { key: 'batch', label: 'Batch', sortable: 'batch' },
  { key: 'location', label: 'Location', sortable: 'city' },
  { key: 'work', label: 'Current work', sortable: 'current_company' },
  { key: 'status', label: 'Status', sortable: 'status' },
  { key: 'profile_completion', label: 'Profile', sortable: 'profile_completion' },
];

export default function AlumniListPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<PageFrame title="Alumni"><LoadingBlock label="Loading alumni…" /></PageFrame>}>
      <AlumniList />
    </Suspense>
  );
}

function AlumniList() {
  const params = useSearchParams();
  const [filters, setFilters] = useState<ListFilters>(() => {
    const initial: ListFilters = { sort: 'created_at', dir: 'desc', page: 1, per_page: PER_PAGE };
    URL_FILTERS.forEach((key) => {
      const value = params.get(key);
      if (value) (initial as Record<string, unknown>)[key] = value;
    });
    return initial;
  });
  const [search, setSearch] = useState(() => params.get('q') ?? '');   // so a link with ?q= shows its search and the debounce does not wipe it
  const [meta, setMeta] = useState<AlumniMeta | null>(null);
  const [rows, setRows] = useState<AlumniRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<AlumniStatus | ''>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    alumniApi.meta(controller.signal).then(setMeta).catch(() => undefined);
    return () => controller.abort();
  }, []);

  // Debounce typing so every keystroke doesn't hit the database.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => (current.q === (search || undefined) ? current : { ...current, q: search || undefined, page: 1 }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    alumniApi
      .list(filters, controller.signal)
      .then((result) => {
        setRows(result.rows);
        setPagination(result.pagination);
        setSelected(new Set());   // a selection belongs to the page it was made on
        setError('');
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : "Couldn't load alumni. Try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters]);

  const setFilter = (key: keyof ListFilters, value: string) => {
    setLoading(true);
    setFilters((current) => ({ ...current, [key]: value || undefined, page: 1 }));
  };

  const toggleSort = (column: string) => {
    setLoading(true);
    setFilters((current) => ({ ...current, sort: column, dir: current.sort === column && current.dir === 'asc' ? 'desc' : 'asc', page: 1 }));
  };

  const activeFilterCount = [...URL_FILTERS].filter((key) => filters[key as keyof ListFilters]).length;
  const hasFilters = activeFilterCount > 0 || Boolean(filters.q);
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  async function applyBulkStatus() {
    if (!bulkStatus || selected.size === 0) return;
    if (!window.confirm(`Change ${selected.size} alumni to “${STATUS_LABEL[bulkStatus]}”?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await alumniApi.bulkStatus([...selected], bulkStatus);
      setNotice(`${result.data.updated} alumni changed to ${STATUS_LABEL[bulkStatus].toLowerCase()}.`);
      setBulkStatus('');
      setLoading(true);
      setFilters((current) => ({ ...current }));   // reload the page of results
    } catch (reason) {
      setError(reason instanceof AlumniApiError ? reason.message : "Couldn't change the status. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function exportFile(format: 'csv' | 'xlsx', onlySelected: boolean) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const name = await alumniApi.exportAlumni(filters, format, onlySelected ? [...selected] : undefined);
      setNotice(`Downloaded ${name}. Details an alumnus has made private are left blank.`);
    } catch (reason) {
      setError(reason instanceof AlumniApiError ? reason.message : "Couldn't export. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const select = (key: keyof ListFilters, label: string, options: (string | number)[], format?: (v: string) => string) => (
    <select aria-label={label} className={inputClass} value={(filters[key] as string | undefined) ?? ''} onChange={(event) => setFilter(key, event.target.value)}>
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={String(option)} value={String(option)}>{format ? format(String(option)) : String(option)}</option>
      ))}
    </select>
  );

  return (
    <PageFrame
      title="Alumni"
      description="Search, filter and manage every alumni record for your institute."
      actions={
        <>
          <Button variant="outline" className="h-9" disabled={busy || rows.length === 0} onClick={() => exportFile('csv', false)}>
            <Download className="size-4" aria-hidden /> Export CSV
          </Button>
          <Button variant="outline" className="h-9" disabled={busy || rows.length === 0} onClick={() => exportFile('xlsx', false)}>
            <Download className="size-4" aria-hidden /> Export Excel
          </Button>
          <Link href="/alumni/conversion" className={cn(buttonVariants({ variant: 'outline' }), 'h-9')}>
            <UserCheck className="size-4" aria-hidden /> Convert students
          </Link>
          <Link href="/alumni/add" className={cn(buttonVariants(), 'h-9')}>
            <Plus className="size-4" aria-hidden /> Add alumni
          </Link>
        </>
      }
    >
      <Panel>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(event) => { setLoading(true); setSearch(event.target.value); }}
              placeholder="Search by name, Alumni ID, email, mobile, GR or enrollment number"
              aria-label="Search alumni"
              className={cn(inputClass, 'pl-9')}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
            {select('status', 'All statuses', meta?.statuses ?? [], (v) => STATUS_LABEL[v as AlumniStatus] ?? v)}
            {select('batch', 'All batches', meta?.batches ?? [])}
            {select('passing_year', 'All passing years', meta?.passing_years ?? [])}
            {select('country', 'All countries', meta?.countries ?? [])}
            {select('city', 'All cities', meta?.cities ?? [])}
            {select('industry', 'All industries', meta?.industries ?? [])}
            {select('employment_status', 'All employment', meta?.employment_statuses ?? [], humanize)}
          </div>
          {hasFilters ? (
            <button
              type="button"
              className="text-sm font-medium text-indigo-700 hover:underline"
              onClick={() => {
                setSearch('');
                setLoading(true);
                setFilters({ sort: filters.sort, dir: filters.dir, page: 1, per_page: PER_PAGE });
              }}
            >
              Clear all filters
            </button>
          ) : null}
        </div>
      </Panel>

      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm" role="region" aria-label="Bulk actions">
          <span className="font-medium text-indigo-900">{selected.size} selected</span>
          <select aria-label="Bulk change status" className={cn(inputClass, 'w-52')} value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as AlumniStatus | '')}>
            <option value="">Change status to…</option>
            {(Object.keys(STATUS_LABEL) as AlumniStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <Button className="h-9" disabled={!bulkStatus || busy} onClick={applyBulkStatus}>Apply</Button>
          <Button variant="outline" className="h-9" disabled={busy} onClick={() => exportFile('csv', true)}>Export selected</Button>
          <Button variant="ghost" className="h-9" onClick={() => setSelected(new Set())}>Clear selection</Button>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading && rows.length === 0 ? (
          <LoadingBlock label="Loading alumni…" />
        ) : rows.length === 0 && !error ? (
          <EmptyState
            title={hasFilters ? 'No alumni match these filters' : 'No alumni yet'}
            hint={hasFilters ? 'Try removing a filter or searching for something else.' : 'Add an alumnus, or convert students who have left the institute.'}
            action={hasFilters ? undefined : <Link href="/alumni/add" className={cn(buttonVariants(), 'mt-2 h-9')}>Add alumni</Link>}
          />
        ) : (
          <div className={cn('overflow-x-auto', loading && 'opacity-60')} aria-busy={loading}>
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="w-10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      checked={allSelected}
                      onChange={(event) => setSelected(event.target.checked ? new Set(rows.map((row) => row.id)) : new Set())}
                    />
                  </th>
                  {COLUMNS.map((column) => {
                    const active = column.sortable && filters.sort === column.sortable;
                    return (
                      <th key={column.key} scope="col" className="px-4 py-2.5 font-medium" aria-sort={active ? (filters.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                        {column.sortable ? (
                          <button type="button" className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-slate-800" onClick={() => toggleSort(column.sortable!)}>
                            {column.label}
                            {active ? filters.dir === 'asc' ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden /> : null}
                          </button>
                        ) : (
                          column.label
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className={cn('hover:bg-slate-50', selected.has(row.id) && 'bg-indigo-50/50')}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.full_name}`}
                        checked={selected.has(row.id)}
                        onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(row.id); else next.delete(row.id); return next; })}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.alumni_code}</td>
                    <td className="px-4 py-3">
                      <Link href={`/alumni/profile/${row.id}`} className="font-medium text-indigo-700 hover:underline">{row.full_name}</Link>
                      <div className="text-xs text-slate-500">{row.email || row.mobile || 'No contact details'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.batch || '—'}
                      {row.passing_year ? <div className="text-xs text-slate-500">Passed {row.passing_year}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{[row.city, row.country].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.current_company || humanize(row.employment_status) || '—'}
                      {row.current_job_title ? <div className="text-xs text-slate-500">{row.current_job_title}</div> : null}
                    </td>
                    <td className="px-4 py-3"><AlumniStatusBadge status={row.status} /></td>
                    <td className="px-4 py-3"><ProgressBar percent={row.profile_completion} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.total > 0 ? (
          <nav className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-600" aria-label="Pagination">
            <span>
              Showing {((pagination.page - 1) * pagination.per_page + 1).toLocaleString('en-IN')}–
              {Math.min(pagination.page * pagination.per_page, pagination.total).toLocaleString('en-IN')} of {pagination.total.toLocaleString('en-IN')}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))} disabled={pagination.page <= 1 || loading}
                onClick={() => { setLoading(true); setFilters((current) => ({ ...current, page: (current.page ?? 1) - 1 })); }}>
                <ChevronLeft className="size-4" aria-hidden /> Previous
              </button>
              <span className="px-2 tabular-nums">Page {pagination.page} of {pagination.last_page}</span>
              <button type="button" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))} disabled={pagination.page >= pagination.last_page || loading}
                onClick={() => { setLoading(true); setFilters((current) => ({ ...current, page: (current.page ?? 1) + 1 })); }}>
                Next <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          </nav>
        ) : null}
      </section>
    </PageFrame>
  );
}
