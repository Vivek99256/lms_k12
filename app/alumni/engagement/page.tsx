'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  alumniApi, AlumniApiError, type ActivityRow, type EngagementOverview, type LeaderboardRow, type Pagination,
} from '../_lib/alumni-api';
import { AlumniPicker, type Picked } from '../_components/entity-picker';
import { Banner, EmptyState, FormField, LoadingBlock, MetricTile, PageFrame, Panel, ProgressBar, formatDate, inputClass } from '../_components/alumni-ui';

const LEVEL_TONE: Record<string, string> = {
  highly_active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  active: 'bg-blue-50 text-blue-800 ring-blue-200',
  occasional: 'bg-amber-50 text-amber-800 ring-amber-200',
  dormant: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export default function AlumniEngagementPage() {
  const [overview, setOverview] = useState<EngagementOverview | null>(null);
  const [board, setBoard] = useState<LeaderboardRow[] | null>(null);
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const [alumnus, setAlumnus] = useState<Picked | null>(null);
  const [type, setType] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [points, setPoints] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const loadSummary = useCallback((signal?: AbortSignal) => {
    return Promise.all([alumniApi.engagementOverview(signal), alumniApi.engagementLeaderboard(signal)])
      .then(([o, b]) => {
        setOverview(o);
        setBoard(b);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : "Couldn't load engagement. Try again.");
      });
  }, []);

  const loadActivities = useCallback((signal?: AbortSignal) => {
    return alumniApi
      .engagementActivities({ type: typeFilter || undefined, page }, signal)
      .then((result) => {
        setRows(result.rows);
        setPagination(result.pagination);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : "Couldn't load activity. Try again.");
      });
  }, [typeFilter, page]);

  useEffect(() => {
    const controller = new AbortController();
    void loadSummary(controller.signal);
    return () => controller.abort();
  }, [loadSummary]);

  useEffect(() => {
    const controller = new AbortController();
    void loadActivities(controller.signal);
    return () => controller.abort();
  }, [loadActivities]);

  async function record(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setError('');
    setNotice('');
    const missing: Record<string, string[]> = {};
    if (!alumnus) missing.alumni_id = ['Choose an alumnus.'];
    if (!type) missing.type = ['Choose the type of engagement.'];
    if (!title.trim()) missing.title = ['Describe what happened.'];
    if (Object.keys(missing).length) {
      setErrors(missing);
      setBusy(false);
      return;
    }
    try {
      const result = await alumniApi.recordEngagement({
        alumni_id: alumnus!.id, type, title: title.trim(), occurred_on: date || undefined, points: points ? Number(points) : undefined,
      });
      setNotice(`Recorded for ${alumnus!.label}. Their engagement score is now ${result.data.score}.`);
      setAlumnus(null);
      setType('');
      setTitle('');
      setDate('');
      setPoints('');
      await Promise.all([loadSummary(), loadActivities()]);
    } catch (reason) {
      if (reason instanceof AlumniApiError) {
        setErrors(reason.fieldErrors);
        setError(reason.message);
      } else {
        setError("Couldn't record the engagement. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: ActivityRow) {
    if (!window.confirm(`Remove “${row.title}” for ${row.full_name}? Their score will go down by ${row.points}.`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await alumniApi.deleteEngagement(row.id);
      setNotice('Entry removed.');
      await Promise.all([loadSummary(), loadActivities()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't remove the entry. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const label = (key: string) => overview?.types.find((t) => t.key === key)?.label ?? key;

  return (
    <PageFrame title="Engagement" description={`How actively alumni take part. Scores count the last ${overview?.window_months ?? 24} months and are capped at 100.`}>
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <Banner>{error}</Banner> : null}

      {overview ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricTile label="Engaged alumni" value={overview.summary.engaged_alumni} />
          <MetricTile label="Activities in window" value={overview.summary.activities} />
          <MetricTile label="Guest speakers" value={overview.summary.guest_speakers} />
          <MetricTile label="Active mentors" value={overview.summary.active_mentors} hint="Manage them under Mentorship" />
        </div>
      ) : null}

      <Panel title="Record an engagement">
        <form onSubmit={record} className="grid gap-4 md:grid-cols-3" noValidate>
          <AlumniPicker value={alumnus} onChange={setAlumnus} error={errors.alumni_id?.[0]} />
          <FormField label="Type" required error={errors.type?.[0]} hint={type ? `Worth ${overview?.types.find((t) => t.key === type)?.points ?? 0} points unless you change it.` : undefined}>
            <select className={inputClass} value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">Select</option>
              {overview?.types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </FormField>
          <FormField label="What happened" required error={errors.title?.[0]}>
            <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="For example: Guest lecture on cloud careers" />
          </FormField>
          <FormField label="Date" error={errors.occurred_on?.[0]} hint="Leave empty for today.">
            <input className={inputClass} type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setDate(event.target.value)} />
          </FormField>
          <FormField label="Points" error={errors.points?.[0]} hint="Leave empty to use the standard points.">
            <input className={inputClass} type="number" min={0} max={100} value={points} onChange={(event) => setPoints(event.target.value)} />
          </FormField>
          <div className="flex items-end"><Button type="submit" className="h-9" disabled={busy}>Record engagement</Button></div>
        </form>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Most engaged alumni">
          {board === null ? <LoadingBlock /> : board.length === 0 ? (
            <EmptyState title="No engagement recorded yet" hint="Completed mentoring sessions, shared opportunities and entries you record appear here." />
          ) : (
            <ol className="divide-y divide-slate-100">
              {board.map((row, index) => (
                <li key={row.alumni_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-right tabular-nums text-slate-500">{index + 1}</span>
                    <div>
                      <Link href={`/alumni/profile/${row.alumni_id}`} className="font-medium text-indigo-700 hover:underline">{row.full_name}</Link>
                      <p className="text-xs text-slate-500">{row.alumni_code}{row.batch ? ` · ${row.batch}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ProgressBar percent={row.score} />
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${LEVEL_TONE[row.level] ?? LEVEL_TONE.dormant}`}>{row.level_label}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Points for each type">
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {overview?.types.map((t) => (
              <li key={t.key} className="flex justify-between border-b border-slate-100 py-1"><span className="text-slate-700">{t.label}</span><span className="tabular-nums text-slate-900">+{t.points}</span></li>
            ))}
          </ul>
          {overview ? <p className="mt-3 text-xs text-slate-500">Highly active from {overview.levels.highly_active}, active from {overview.levels.active}, occasional from {overview.levels.occasional}.</p> : null}
        </Panel>
      </div>

      <Panel
        title="Activity log"
        actions={
          <select aria-label="Filter by type" className={inputClass + ' h-8 w-52 text-xs'} value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }}>
            <option value="">All types</option>
            {overview?.types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        }
      >
        {rows === null ? <LoadingBlock /> : rows.length === 0 ? (
          <EmptyState title="No activity" hint="Nothing has been recorded for this filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="py-2 pr-4 font-medium">Date</th><th className="py-2 pr-4 font-medium">Alumnus</th><th className="py-2 pr-4 font-medium">Type</th><th className="py-2 pr-4 font-medium">What happened</th><th className="py-2 pr-4 text-right font-medium">Points</th><th className="py-2"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2.5 pr-4 text-slate-600">{formatDate(row.occurred_at)}</td>
                    <td className="py-2.5 pr-4"><Link href={`/alumni/profile/${row.alumni_id}`} className="text-indigo-700 hover:underline">{row.full_name}</Link></td>
                    <td className="py-2.5 pr-4 text-slate-700">{label(row.activity_type)}</td>
                    <td className="py-2.5 pr-4 text-slate-700">{row.title}{row.ref_type ? <span className="ml-2 text-xs text-slate-500">(automatic)</span> : null}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">+{row.points}</td>
                    <td className="py-2.5 text-right">
                      {row.ref_type ? null : (
                        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${row.title}`} disabled={busy} onClick={() => remove(row)}><Trash2 className="size-4" aria-hidden /></Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pagination && pagination.last_page > 1 ? (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm text-slate-600">
            <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>Previous</Button>
            <span className="tabular-nums">Page {pagination.page} of {pagination.last_page}</span>
            <Button variant="outline" size="sm" disabled={pagination.page >= pagination.last_page} onClick={() => setPage(pagination.page + 1)}>Next</Button>
          </div>
        ) : null}
      </Panel>
    </PageFrame>
  );
}
