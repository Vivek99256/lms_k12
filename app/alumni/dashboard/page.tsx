'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { alumniApi, type AlumniDashboard, type CountRow } from '../_lib/alumni-api';
import { AlumniStatusBadge, Banner, EmptyState, LoadingBlock, MetricTile, PageFrame, Panel, STATUS_LABEL, formatDate } from '../_components/alumni-ui';

const INDIGO = '#4f46e5';

function CountChart({ rows, empty }: { rows: CountRow[]; empty: string }) {
  if (rows.length === 0) return <EmptyState title={empty} />;
  const data = rows.map((row) => ({ label: row.label, total: Number(row.total) }));
  return (
    <div className="h-64" role="img" aria-label={`Bar chart: ${data.map((d) => `${d.label} ${d.total}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
          <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12, fill: '#475569' }} />
          <Tooltip cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="total" name="Alumni" fill={INDIGO} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AlumniDashboardPage() {
  const [data, setData] = useState<AlumniDashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    alumniApi
      .dashboard(controller.signal)
      .then(setData)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof Error ? reason.message : "Couldn't load the dashboard. Try again.");
      });
    return () => controller.abort();
  }, []);

  if (error) return <PageFrame title="Alumni dashboard"><Banner>{error}</Banner></PageFrame>;
  if (!data) return <PageFrame title="Alumni dashboard"><LoadingBlock label="Loading dashboard…" /></PageFrame>;

  const t = data.totals;

  return (
    <PageFrame title="Alumni dashboard" description="Live figures for your institute's alumni records.">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricTile label="Total alumni" value={t.total} />
        <MetricTile label="New in 30 days" value={t.new_last_30_days} />
        <MetricTile label="Verified" value={t.verified} />
        <MetricTile label="Active" value={t.active} />
        <MetricTile label="Pending verification" value={t.pending_verification} />
        <MetricTile label="Average profile completion" value={`${t.average_profile_completion}%`} />
        <MetricTile label="Employed" value={t.employed} />
        <MetricTile label="Entrepreneurs" value={t.entrepreneurs} />
        <MetricTile label="Job seeking" value={t.job_seeking} />
        <MetricTile label="With higher education" value={t.with_higher_education} />
        <MetricTile label="With career details" value={t.with_career_data} />
      </div>

      {data.engagement && Object.values(data.engagement).some((v) => v !== null) ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {data.engagement.average_score !== null ? <MetricTile label="Average engagement score" value={data.engagement.average_score} hint="Out of 100" /> : null}
          {data.engagement.active_mentors !== null ? <MetricTile label="Active mentors" value={data.engagement.active_mentors} /> : null}
          {data.engagement.open_mentorship_requests !== null ? <MetricTile label="Open mentoring requests" value={data.engagement.open_mentorship_requests} /> : null}
          {data.engagement.guest_speakers !== null ? <MetricTile label="Guest speakers" value={data.engagement.guest_speakers} /> : null}
          {data.engagement.published_opportunities !== null ? <MetricTile label="Live opportunities" value={data.engagement.published_opportunities} /> : null}
          {data.engagement.pending_opportunities !== null ? <MetricTile label="Opportunities to approve" value={data.engagement.pending_opportunities} /> : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Alumni by batch"><CountChart rows={data.by_batch} empty="No batch data yet" /></Panel>
        <Panel title="Alumni by passing year"><CountChart rows={data.by_passing_year} empty="No passing years recorded yet" /></Panel>
        <Panel title="Alumni by country"><CountChart rows={data.by_country} empty="No locations recorded yet" /></Panel>
        <Panel title="Alumni by city"><CountChart rows={data.by_city} empty="No cities recorded yet" /></Panel>
        <Panel title="Alumni by industry"><CountChart rows={data.by_industry} empty="No career data yet" /></Panel>
        <Panel title="Alumni by company"><CountChart rows={data.by_company} empty="No career data yet" /></Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recent registrations">
          {data.recent_registrations.length === 0 ? (
            <EmptyState title="No alumni yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recent_registrations.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <Link href={`/alumni/profile/${row.id}`} className="font-medium text-indigo-700 hover:underline">{row.full_name}</Link>
                    <p className="text-xs text-slate-500">{row.alumni_code} · {formatDate(row.created_at)}</p>
                  </div>
                  <AlumniStatusBadge status={row.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          title="Pending approvals"
          actions={t.pending_verification > 0 ? <Link href="/alumni/pending_verification" className="text-sm font-medium text-indigo-700 hover:underline">Review all</Link> : null}
        >
          {data.pending_approvals.length === 0 ? (
            <EmptyState title="Nothing is waiting for review" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.pending_approvals.map((row) => (
                <li key={row.id} className="py-2.5 text-sm">
                  <Link href={`/alumni/profile/${row.id}`} className="font-medium text-indigo-700 hover:underline">{row.full_name}</Link>
                  <p className="text-xs text-slate-500">{row.alumni_code} · registered {formatDate(row.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Status breakdown">
        <ul className="flex flex-wrap gap-3 text-sm text-slate-700">
          {Object.entries(data.by_status).map(([status, total]) => (
            <li key={status} className="rounded-md bg-slate-50 px-3 py-1.5">
              {STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status}: <span className="font-semibold tabular-nums">{Number(total).toLocaleString('en-IN')}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </PageFrame>
  );
}
