'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Brain, CalendarCheck, ClipboardList, Eye, RefreshCw, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { friendlyError } from '@/lib/user-messages';
import {
  fetchMyEngagementActivity,
  type EngagementEvent,
  type EngagementSummary,
} from '@/app/engagement/activity/_data/engagementActivity';

/**
 * Engagement -> My Activity.
 *
 * Real per-student engagement history, read from `lms_student_engagement`
 * (added 2026-10-10): content viewed, practice sessions, homework submitted —
 * each row a genuine recorded action, not a mock. Alongside it, the three
 * signals `EngagementReportService` has always computed live (attendance,
 * homework completion, assignment progress), on the same screen because they
 * answer the same question ("how engaged is this learner?") from different
 * real sources.
 */

function errorMessage(error: unknown): string {
  return friendlyError(error, "We couldn't load your engagement activity. Please try again.");
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} aria-hidden />;
}

function RatePill({ label, percent }: { label: string; percent: number | null }) {
  const tone =
    percent === null
      ? 'bg-slate-100 text-slate-400'
      : percent >= 75
        ? 'bg-emerald-50 text-emerald-700'
        : percent >= 40
          ? 'bg-amber-50 text-amber-700'
          : 'bg-rose-50 text-rose-700';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn('mt-2 inline-flex rounded-full px-2.5 py-1 text-lg font-bold', tone)}>
        {percent === null ? 'No data' : `${Math.round(percent)}%`}
      </p>
    </div>
  );
}

const ACTIVITY_META: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  content_view: { label: 'Content viewed', icon: Eye, tone: 'bg-indigo-50 text-indigo-600' },
  practice: { label: 'Practice session', icon: Brain, tone: 'bg-violet-50 text-violet-600' },
  quiz: { label: 'Quiz attempted', icon: ClipboardList, tone: 'bg-sky-50 text-sky-600' },
  homework_submit: { label: 'Homework submitted', icon: BookOpen, tone: 'bg-emerald-50 text-emerald-600' },
};

function metaFor(activityType: string) {
  return (
    ACTIVITY_META[activityType] ?? {
      label: activityType.replace(/_/g, ' ') || 'Activity',
      icon: CalendarCheck,
      tone: 'bg-slate-100 text-slate-600',
    }
  );
}

function timeAgo(occurredAt: string): string {
  const date = new Date(occurredAt.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return occurredAt;

  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hours ago`;
  if (minutes < 43200) return `${Math.round(minutes / 1440)} days ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function EventRow({ event }: { event: EngagementEvent }) {
  const meta = metaFor(event.activityType);
  const Icon = meta.icon;

  const detail: string[] = [];
  if (event.timeSpentSeconds > 0) detail.push(`${event.timeSpentSeconds}s spent`);
  if (event.interactionCount > 0) detail.push(`${event.interactionCount} question${event.interactionCount === 1 ? '' : 's'}`);
  const total = event.metadata.total;
  const correct = event.metadata.correct;
  if (typeof total === 'number' && typeof correct === 'number') detail.push(`${correct}/${total} correct`);

  return (
    <li className="flex items-start gap-3 px-5 py-4">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', meta.tone)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
          <p className="shrink-0 text-xs text-slate-400">{timeAgo(event.occurredAt)}</p>
        </div>
        {detail.length > 0 ? <p className="mt-0.5 text-xs text-slate-500">{detail.join(' · ')}</p> : null}
      </div>
    </li>
  );
}

export default function EngagementActivityPage() {
  const [summary, setSummary] = useState<EngagementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setErrorText('');

    fetchMyEngagementActivity({ daysBack: 30, limit: 30, signal })
      .then((result) => {
        if (signal?.aborted) return;
        setSummary(result);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (signal?.aborted) return;
        setSummary(null);
        setErrorText(errorMessage(error));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Activity</h1>
          <p className="mt-1 text-sm text-slate-500">
            What you&apos;ve done in the last {summary?.windowDays ?? 30} days — content viewed, practice done,
            homework submitted.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </header>

      {errorText ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorText}</div>
      ) : null}

      {loading && !summary ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : null}

      {summary ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <RatePill label="Attendance" percent={summary.attendancePercent} />
            <RatePill label="Homework completed" percent={summary.homeworkPercent} />
            <RatePill label="Assignments" percent={summary.assignmentsPercent} />
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {summary.activityLog.totalEvents} event{summary.activityLog.totalEvents === 1 ? '' : 's'} recorded
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.activityLog.byType).map(([type, count]) => (
                  <span
                    key={type}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                  >
                    {metaFor(type).label}: {count}
                  </span>
                ))}
              </div>
            </header>

            {summary.activityLog.hasData ? (
              <ul className="divide-y divide-slate-100">
                {summary.activityLog.recent.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ul>
            ) : (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                No recorded activity yet. Viewing suggested content, practising a chapter or submitting homework will
                show up here.
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
