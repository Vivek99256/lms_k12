'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { alumniApi, type BatchGroup, type BatchRow, type BatchStats } from '../_lib/alumni-api';
import { Banner, EmptyState, LoadingBlock, PageFrame } from '../_components/alumni-ui';

const GROUPS: { key: BatchGroup; label: string; filter?: string }[] = [
  { key: 'batch', label: 'Batch', filter: 'batch' },
  { key: 'passing_year', label: 'Passing year', filter: 'passing_year' },
  { key: 'admission_year', label: 'Admission year', filter: 'admission_year' },
  { key: 'course', label: 'Course', filter: 'course' },
  { key: 'department', label: 'Department', filter: 'department' },
  { key: 'campus', label: 'Campus', filter: 'campus' },
];

const COLUMNS: { key: keyof Omit<BatchRow, 'batch_key'>; label: string }[] = [
  { key: 'total', label: 'Total' },
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'registered', label: 'Registered' },
  { key: 'pending_verification', label: 'Pending' },
  { key: 'verified', label: 'Verified' },
  { key: 'active', label: 'Active' },
  { key: 'higher_education', label: 'Higher education' },
  { key: 'employed', label: 'Employed' },
  { key: 'entrepreneurs', label: 'Entrepreneurs' },
  { key: 'job_seeking', label: 'Seeking work' },
  { key: 'abroad', label: 'Abroad' },
];

export default function AlumniBatchesPage() {
  const [groupBy, setGroupBy] = useState<BatchGroup>('batch');
  const [data, setData] = useState<BatchStats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    alumniApi
      .batches(groupBy, controller.signal)
      .then((result) => {
        setData(result);
        setError('');
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : "Couldn't load batch statistics. Try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [groupBy]);

  const group = GROUPS.find((g) => g.key === groupBy)!;

  return (
    <PageFrame
      title="Batches"
      description="Alumni counts for every batch, passing year, course, department or campus."
      actions={
        <label className="flex items-center gap-2 text-sm text-slate-700">
          Group by
          <select
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={groupBy}
            onChange={(event) => {
              setLoading(true);
              setGroupBy(event.target.value as BatchGroup);
            }}
          >
            {GROUPS.map((g) => (
              <option key={g.key} value={g.key}>{g.label}</option>
            ))}
          </select>
        </label>
      }
    >
      {error ? <Banner>{error}</Banner> : null}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading && !data ? (
          <LoadingBlock label="Loading batches…" />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState title={`No alumni have a ${group.label.toLowerCase()} recorded yet`} hint="Add alumni or convert students, then their batches appear here." />
        ) : (
          <div className={loading ? 'overflow-x-auto opacity-60' : 'overflow-x-auto'} aria-busy={loading}>
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">{group.label}</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} scope="col" className="px-3 py-2.5 text-right font-medium">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((row) => (
                  <tr key={String(row.batch_key)} className="hover:bg-slate-50">
                    <th scope="row" className="px-4 py-3 text-left font-medium">
                      {group.filter ? (
                        <Link href={`/alumni/list?${group.filter}=${encodeURIComponent(String(row.batch_key))}`} className="text-indigo-700 hover:underline">
                          {String(row.batch_key)}
                        </Link>
                      ) : (
                        String(row.batch_key)
                      )}
                    </th>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className="px-3 py-3 text-right tabular-nums text-slate-700">{row[c.key].toLocaleString('en-IN')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50 font-medium text-slate-900">
                <tr>
                  <th scope="row" className="px-4 py-3 text-left">All</th>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="px-3 py-3 text-right tabular-nums">{data.totals[c.key].toLocaleString('en-IN')}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
      {data ? <p className="text-xs text-slate-500">“Abroad” counts alumni whose country is not {data.home_country}.</p> : null}
    </PageFrame>
  );
}
