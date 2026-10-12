'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, EyeOff, ExternalLink, Mail, MapPin, Phone, Search } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { alumniApi, type DirectoryFilters, type DirectoryOptions, type DirectoryRow, type Pagination } from '../_lib/alumni-api';
import { Banner, EmptyState, LoadingBlock, PageFrame, Panel, humanize, inputClass } from '../_components/alumni-ui';

const PER_PAGE = 24;

export default function AlumniDirectoryPage() {
  const [filters, setFilters] = useState<DirectoryFilters>({ page: 1, per_page: PER_PAGE });
  const [text, setText] = useState({ q: '', company: '', job_role: '', skill: '', higher_education: '' });
  const [meta, setMeta] = useState<DirectoryOptions | null>(null);
  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    alumniApi.directoryOptions(controller.signal).then(setMeta).catch(() => undefined);
    return () => controller.abort();
  }, []);

  // Debounce the free-text boxes so each keystroke doesn't query the database.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => {
        const next = { ...current };
        let changed = false;
        (Object.keys(text) as (keyof typeof text)[]).forEach((key) => {
          const value = text[key].trim() || undefined;
          if (next[key] !== value) {
            next[key] = value;
            changed = true;
          }
        });
        return changed ? { ...next, page: 1 } : current;
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    const controller = new AbortController();
    alumniApi
      .directory(filters, controller.signal)
      .then((result) => {
        setRows(result.rows);
        setPagination(result.pagination);
        setError('');
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : "Couldn't load the directory. Try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters]);

  const setFilter = (key: keyof DirectoryFilters, value: string) => {
    setLoading(true);
    setFilters((current) => ({ ...current, [key]: value || undefined, page: 1 }));
  };

  const select = (key: keyof DirectoryFilters, label: string, options: (string | number)[]) => (
    <select aria-label={label} className={inputClass} value={(filters[key] as string | undefined) ?? ''} onChange={(event) => setFilter(key, event.target.value)}>
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={String(option)} value={String(option)}>{String(option)}</option>
      ))}
    </select>
  );
  const box = (key: keyof typeof text, label: string) => (
    <input
      aria-label={label}
      placeholder={label}
      className={inputClass}
      value={text[key]}
      onChange={(event) => {
        setLoading(true);
        setText({ ...text, [key]: event.target.value });
      }}
    />
  );

  return (
    <PageFrame title="Alumni directory" description="Find verified and active alumni. Each person's privacy choices decide which details you can see and search on.">
      <Panel>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              aria-label="Search the directory"
              placeholder="Search by name or Alumni ID"
              className={cn(inputClass, 'pl-9')}
              value={text.q}
              onChange={(event) => {
                setLoading(true);
                setText({ ...text, q: event.target.value });
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
            {select('batch', 'All batches', meta?.batches ?? [])}
            {select('passing_year', 'All passing years', meta?.passing_years ?? [])}
            {select('country', 'All countries', meta?.countries ?? [])}
            {select('city', 'All cities', meta?.cities ?? [])}
            {select('industry', 'All industries', meta?.industries ?? [])}
            {box('company', 'Company')}
            {box('job_role', 'Job role')}
            {box('skill', 'Skill')}
            {box('higher_education', 'Higher education')}
          </div>
        </div>
      </Panel>

      {error ? <Banner>{error}</Banner> : null}

      {loading && rows.length === 0 ? (
        <LoadingBlock label="Loading the directory…" />
      ) : rows.length === 0 && !error ? (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <EmptyState title="No alumni match" hint="Only verified and active alumni are listed, and filters only match details their owners have shared." />
        </section>
      ) : (
        <ul className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-3', loading && 'opacity-60')} aria-busy={loading}>
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700" aria-hidden>
                  {row.full_name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <Link href={`/alumni/profile/${row.id}`} className="block truncate font-medium text-indigo-700 hover:underline">{row.full_name}</Link>
                  <p className="font-mono text-xs text-slate-500">{row.alumni_code}</p>
                  <p className="text-xs text-slate-500">{[row.batch ? `Batch ${row.batch}` : null, row.passing_year ? `Passed ${row.passing_year}` : null, row.course].filter(Boolean).join(' · ')}</p>
                </div>
              </div>

              {row.current_company || row.current_job_title ? (
                <p className="text-sm text-slate-800">
                  {[row.current_job_title, row.current_company].filter(Boolean).join(' at ')}
                  {row.current_industry ? <span className="text-slate-500"> · {row.current_industry}</span> : null}
                </p>
              ) : null}
              {row.city || row.country ? (
                <p className="flex items-center gap-1.5 text-sm text-slate-600"><MapPin className="size-3.5" aria-hidden />{[row.city, row.state, row.country].filter(Boolean).join(', ')}</p>
              ) : null}
              {row.education.length > 0 ? (
                <p className="text-sm text-slate-600">{row.education.map((e) => [e.qualification, e.institution].filter(Boolean).join(', ')).join(' · ')}</p>
              ) : null}
              {row.skills.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5" aria-label="Skills">
                  {row.skills.map((s) => (
                    <li key={s.skill} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{s.skill} <span className="text-slate-500">· {humanize(s.level)}</span></li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-auto space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
                {row.email ? <p className="flex items-center gap-1.5"><Mail className="size-3.5" aria-hidden />{row.email}</p> : null}
                {row.mobile ? <p className="flex items-center gap-1.5"><Phone className="size-3.5" aria-hidden />{row.mobile}</p> : null}
                {row.linkedin_url ? (
                  <p className="flex items-center gap-1.5"><ExternalLink className="size-3.5" aria-hidden />
                    <a href={row.linkedin_url} target="_blank" rel="noopener noreferrer" className="truncate text-indigo-700 hover:underline">LinkedIn profile</a>
                  </p>
                ) : null}
                {row.hidden.length > 0 ? (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500"><EyeOff className="size-3.5" aria-hidden />Some details are hidden by this alumnus&apos;s privacy settings.</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {pagination && pagination.total > 0 ? (
        <nav className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600" aria-label="Pagination">
          <span>{pagination.total.toLocaleString('en-IN')} alumni</span>
          <div className="flex items-center gap-1">
            <button type="button" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))} disabled={pagination.page <= 1 || loading}
              onClick={() => { setLoading(true); setFilters((c) => ({ ...c, page: (c.page ?? 1) - 1 })); }}>
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </button>
            <span className="px-2 tabular-nums">Page {pagination.page} of {pagination.last_page}</span>
            <button type="button" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))} disabled={pagination.page >= pagination.last_page || loading}
              onClick={() => { setLoading(true); setFilters((c) => ({ ...c, page: (c.page ?? 1) + 1 })); }}>
              Next <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </nav>
      ) : null}
    </PageFrame>
  );
}
