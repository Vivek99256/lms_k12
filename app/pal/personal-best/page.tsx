'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Award,
  ChevronUp,
  Flame,
  Loader2,
  RefreshCw,
  Sparkles,
  Star,
  Target,
  Timer,
  TrendingUp,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  fetchPersonalBestSummary,
} from '@/app/pal/data/pal-pb-api';
import type {
  PbFluencyEvent,
  PbNotificationEvent,
  PbSessionEvent,
  PbStreakEvent,
} from '@/app/pal/data/pal-pb';
import type { PbApiMasteryRecord } from '@/app/pal/data/pal-pb-types';

type Tab = 'overview' | 'fluency' | 'streak' | 'mastery' | 'session';

const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <Sparkles className="h-4 w-4" /> },
  { key: 'fluency', label: 'Fluency', icon: <Target className="h-4 w-4" /> },
  { key: 'streak', label: 'Streak', icon: <Flame className="h-4 w-4" /> },
  { key: 'mastery', label: 'Mastery', icon: <Star className="h-4 w-4" /> },
  { key: 'session', label: 'Session', icon: <Timer className="h-4 w-4" /> },
];

export default function PalPersonalBestPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [data, setData] = useState<{
    summary: {
      fluencyCount: number;
      bestFluency: number;
      streakCurrent: number;
      streakLongest: number;
      masteryCount: number;
      bestMastery: number;
      sessionCount: number;
      bestSession: number;
    };
    fluency: PbFluencyEvent[];
    streak: PbStreakEvent[];
    mastery: PbApiMasteryRecord[];
    session: PbSessionEvent[];
    notifications: PbNotificationEvent[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPersonalBestSummary(signal);
      setData(result);
    } catch (reason) {
      if (signal?.aborted) return;
      setError(reason instanceof Error ? reason.message : 'Unable to load personal best data.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch loader, matches repo PAL pages
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const hasAnyData =
    (data?.fluency.length ?? 0) > 0 ||
    (data?.streak.length ?? 0) > 0 ||
    (data?.mastery.length ?? 0) > 0 ||
    (data?.session.length ?? 0) > 0;

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1200px] space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Personal Best</h1>
              <p className="text-sm text-slate-500">Your progress, your records, your improvement.</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            onClick={() => router.push('/pal')}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Back to PAL
          </Button>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => load()} className="border-rose-200 text-rose-700 hover:bg-rose-100">
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading personal best...
          </div>
        ) : !hasAnyData ? (
          <EmptyState onRetry={() => load()} />
        ) : (
          <>
            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    activeTab === tab.key
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Overview */}
            {activeTab === 'overview' && (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard label="Fluency records" value={data?.fluency.length ?? 0} sub={`Best: ${Math.round((data?.summary.bestFluency ?? 0) * 100)}%`} icon={<Target className="h-5 w-5" />} tone="indigo" />
                  <SummaryCard label="Current streak" value={data?.summary.streakCurrent ?? 0} sub={`Longest: ${data?.summary.streakLongest ?? 0}`} icon={<Flame className="h-5 w-5" />} tone="amber" />
                  <SummaryCard label="Mastery records" value={data?.mastery.length ?? 0} sub={`Best: ${Math.round(data?.summary.bestMastery ?? 0)}%`} icon={<Star className="h-5 w-5" />} tone="emerald" />
                  <SummaryCard label="Session records" value={data?.session.length ?? 0} sub={`Best: ${Math.round(data?.summary.bestSession ?? 0)}`} icon={<Timer className="h-5 w-5" />} tone="rose" />
                </div>

                {data?.notifications.length ? (
                  <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-5 py-4">
                      <h2 className="text-base font-semibold text-slate-900">Recent Personal Bests</h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                       {data.notifications.slice(0, 5).map((n, index) => (
                         <div key={index} className="flex items-start gap-3 px-5 py-3">
                           <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                           <div>
                             <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                             <p className="text-xs text-slate-600">{n.message}</p>
                           </div>
                         </div>
                       ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}

            {/* Fluency */}
            {activeTab === 'fluency' && (
              <RecordsTable
                title="Fluency Records"
                columns={['Concept', 'Best Fluency', 'Previous Best', 'Improvement', 'Achieved']}
                rows={
                  data?.fluency.map((f) => ({
                    key: f.conceptId,
                    cells: [
                      f.conceptName,
                       `${(f.newBest * 100).toFixed(0)}%`,
                      `${(f.previousBest * 100).toFixed(0)}%`,
                      <span key="imp" className="inline-flex items-center gap-1 text-emerald-700">
                        <TrendingUp className="h-3.5 w-3.5" />
                        +{(f.absoluteImprovement * 100).toFixed(0)}%
                      </span>,
                      new Date(f.achievedAt).toLocaleDateString(),
                    ],
                  })) ?? []
                }
                empty={!data?.fluency.length ? 'No fluency records yet. Complete a quiz to create your first fluency personal best.' : undefined}
              />
            )}

            {/* Streak */}
            {activeTab === 'streak' && (
              <RecordsTable
                title="Streak Records"
                columns={['Current Streak', 'Longest Streak', 'Longest Streak Date', 'Last Activity']}
                rows={
                   data?.streak.map((s, idx) => ({
                     key: String(idx),
                     cells: [
                       <span key="cs" className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                         <Flame className="h-4 w-4" />
                         {s.newLongest} days
                       </span>,
                       <span key="ls" className="inline-flex items-center gap-1 text-indigo-700 font-semibold">
                         <Award className="h-4 w-4" />
                         {s.newLongest} days
                       </span>,
                       new Date(s.achievedAt).toLocaleDateString(),
                       new Date(s.achievedAt).toLocaleDateString(),
                     ],
                   })) ?? []
                }
                empty={!data?.streak.length ? 'No streak records yet. Keep learning to build your streak.' : undefined}
              />
            )}

            {/* Mastery */}
            {activeTab === 'mastery' && (
              <RecordsTable
                title="Mastery Records"
                columns={['Concept', 'Mastery', 'Sessions', 'Fastest', 'Mountain/Sky', 'Achieved']}
                rows={
                  data?.mastery.map((m) => ({
                    key: m.concept,
                    cells: [
                      <div key="c" className="flex flex-col">
                        <span className="font-medium text-slate-900">{m.concept}</span>
                        {m.conceptId && <span className="text-[11px] text-slate-500">{m.conceptId}</span>}
                      </div>,
                      <div key="bar" className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
      className={`h-full rounded-full ${m.masteryResult >= 70 ? 'bg-emerald-500' : m.masteryResult >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
      style={{ width: `${Math.min(100, m.masteryResult)}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-slate-600">{m.masteryResult}%</span>
                      </div>,
                      String(m.masterySessionCount ?? '—'),
                      m.fastestMastery ? `${m.fastestMastery}s` : '—',
                      m.mountainSkyConcept ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <ChevronUp className="h-3 w-3" />
                          Mountain/Sky
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      ),
                      new Date(m.achievedAt).toLocaleDateString(),
                    ],
                  })) ?? []
                }
                empty={!data?.mastery.length ? 'No mastery records yet. Complete quizzes to build your mastery profile.' : undefined}
              />
            )}

            {/* Session */}
            {activeTab === 'session' && (
              <RecordsTable
                title="Session Records"
                columns={['Record Type', 'Previous', 'New', 'Improvement', 'Session Start', 'Session End', 'Achieved']}
                rows={
                  data?.session.map((s) => ({
                    key: `${s.recordType}-${s.achievedAt}`,
                    cells: [
                      <span key="rt" className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                        {s.recordType.replace(/_/g, ' ')}
                      </span>,
                      String(Math.round(s.previousValue)),
                      String(Math.round(s.newValue)),
                      <span key="imp" className="text-emerald-700">
                        +{Math.round(s.newValue - s.previousValue)}
                      </span>,
                      s.sessionStart ? new Date(s.sessionStart).toLocaleString() : '—',
                      s.sessionEnd ? new Date(s.sessionEnd).toLocaleString() : '—',
                      new Date(s.achievedAt).toLocaleDateString(),
                    ],
                  })) ?? []
                }
                empty={!data?.session.length ? 'No session records yet. Complete a quiz to track your session performance.' : undefined}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  icon: ReactNode;
  tone: 'indigo' | 'amber' | 'emerald' | 'rose';
}) {
  const toneStyles: Record<typeof tone, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <article className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneStyles[tone]}`}>{icon}</div>
      <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-[11px] text-slate-400">{sub}</div>
    </article>
  );
}

function RecordsTable({
  title,
  columns,
  rows,
  empty,
}: {
  title: string;
  columns: string[];
  rows: { key: string; cells: ReactNode[] }[];
  empty?: string;
}) {
  if (!rows.length && empty) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-sm font-medium text-slate-700">{empty}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              {columns.map((col) => (
                <th key={col} className="px-5 py-3 font-semibold">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.key} className="hover:bg-slate-50/60">
                {row.cells.map((cell, idx) => (
                  <td key={idx} className="px-5 py-3 text-slate-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <Award className="h-6 w-6" />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-900">Your Personal Best journey starts here.</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
        Complete PAL quizzes and learning activities to build your fluency, streak, mastery, and session records.
        Every new record becomes a Personal Best.
      </p>
      <Button variant="outline" size="sm" className="mt-4 border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh
      </Button>
    </div>
  );
}
