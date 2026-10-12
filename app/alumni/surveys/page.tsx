'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { alumniApi, type Pagination, type SurveyRow } from '../_lib/alumni-api';
import { SurveyForm, SurveyStatus } from '../_components/survey-bits';
import { Banner, EmptyState, LoadingBlock, PageFrame, formatDate, humanize, inputClass } from '../_components/alumni-ui';

export default function SurveysPage() {
  const [filters, setFilters] = useState({ status: '', survey_type: '', q: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: SurveyRow[]; types: { key: string; label: string }[]; pagination: Pagination } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback((signal?: AbortSignal) =>
    alumniApi.surveys({ status: filters.status || undefined, survey_type: filters.survey_type || undefined, q: filters.q || undefined, page }, signal)
      .then((r) => { setData(r); setError(''); })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : "Couldn't load surveys. Try again.");
      }), [filters, page]);
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);

  return (
    <PageFrame title="Surveys" description="Ask alumni for feedback and see the results as they come in."
      actions={<Button className="h-9" onClick={() => setCreating((v) => !v)}>{creating ? 'Close form' : 'New survey'}</Button>}>
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}
      {creating ? <SurveyForm types={data?.types ?? []} onSaved={() => { setCreating(false); setNotice('Survey saved as a draft. Publish it to start collecting responses.'); void load(); }} /> : null}

      <div className="grid gap-2 md:grid-cols-3">
        <input aria-label="Search surveys" placeholder="Search by title" className={inputClass} value={filters.q} onChange={(e) => { setFilters({ ...filters, q: e.target.value }); setPage(1); }} />
        <select aria-label="Filter by status" className={inputClass} value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}>
          <option value="">All statuses</option>{['draft', 'published', 'closed'].map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
        <select aria-label="Filter by type" className={inputClass} value={filters.survey_type} onChange={(e) => { setFilters({ ...filters, survey_type: e.target.value }); setPage(1); }}>
          <option value="">All types</option>{data?.types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {data === null ? <LoadingBlock label="Loading surveys…" /> : data.rows.length === 0 ? <EmptyState title="No surveys found" hint="Create a survey to start collecting feedback." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="px-4 py-2.5 font-medium">Survey</th><th className="px-4 py-2.5 font-medium">Audience</th><th className="px-4 py-2.5 font-medium">Closes</th><th className="px-3 py-2.5 text-right font-medium">Questions</th><th className="px-3 py-2.5 text-right font-medium">Responses</th><th className="px-4 py-2.5 font-medium">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3"><Link href={`/alumni/surveys/${s.id}`} className="font-medium text-indigo-700 hover:underline">{s.title}</Link><div className="text-xs text-slate-500">{humanize(s.survey_type)}{s.anonymous ? ' · anonymous' : ''}</div></td>
                    <td className="px-4 py-3 text-slate-700">{s.audience_label ?? 'All alumni'}</td>
                    <td className="px-4 py-3 text-slate-700">{s.closes_at ? formatDate(s.closes_at) : '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{s.question_count}</td><td className="px-3 py-3 text-right tabular-nums">{s.response_count}</td>
                    <td className="px-4 py-3"><SurveyStatus value={s.status} /></td>
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
