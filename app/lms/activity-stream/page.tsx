'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckSquare,
  ClipboardList,
  Clock,
  Loader2,
  RefreshCw,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  fetchActivityStream,
  type ActivitySection,
  type ActivityStreamData,
  type BucketKey,
} from '@/app/lms/data/activityStream';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

const BUCKETS: { key: BucketKey; label: string; hint: string }[] = [
  { key: 'today', label: 'Today', hint: "What's happening today" },
  { key: 'upcoming', label: 'Upcoming', hint: 'Scheduled ahead' },
  { key: 'recent', label: 'Recent', hint: 'Already passed' },
];

function SectionCard({ section }: { section: ActivitySection }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{section.label}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {section.items.length}
        </span>
      </header>
      <ul className="divide-y divide-slate-100">
        {section.items.map((item) => (
          <li key={item.key} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
              <CalendarClock className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
              {item.subtitle ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.subtitle}</p>
              ) : null}
              {item.chips.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {item.chips.map((chip, i) => (
                    <span
                      key={`${item.key}-chip-${i}`}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            {item.dateLabel || item.timeLabel ? (
              <div className="shrink-0 text-right">
                {item.dateLabel ? (
                  <p className="text-[11px] font-medium text-slate-600">{item.dateLabel}</p>
                ) : null}
                {item.timeLabel ? (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock className="size-3" />
                    {item.timeLabel}
                  </p>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ActivityStreamPage() {
  const [data, setData] = useState<ActivityStreamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [activeBucket, setActiveBucket] = useState<BucketKey>('today');

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setErrorText('');
    fetchActivityStream(signal)
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (signal?.aborted) return;
        setData(null);
        setErrorText(errorMessage(error));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  const sections = data?.buckets[activeBucket] ?? [];
  const bucketCounts = useMemo(() => {
    const counts: Record<BucketKey, number> = { today: 0, upcoming: 0, recent: 0 };
    if (data) {
      (Object.keys(counts) as BucketKey[]).forEach((key) => {
        counts[key] = data.buckets[key].reduce((sum, section) => sum + section.items.length, 0);
      });
    }
    return counts;
  }, [data]);

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1400px] space-y-5">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <ClipboardList className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                Activity Stream
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {data?.todayTitle || 'Schedules, homework, events and more across your classes.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </header>

        {errorText ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">{errorText}</div>
          </div>
        ) : null}

        {/* Bucket tabs */}
        <div className="flex flex-wrap gap-2">
          {BUCKETS.map((bucket) => {
            const active = activeBucket === bucket.key;
            return (
              <button
                key={bucket.key}
                type="button"
                onClick={() => setActiveBucket(bucket.key)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition',
                  active
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                )}
              >
                {bucket.label}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {bucketCounts[bucket.key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Feed */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-16 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Loading activity…
          </div>
        ) : sections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-3 py-16 text-center text-sm text-slate-500">
            Nothing to show in this window.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sections.map((section) => (
              <SectionCard key={section.key} section={section} />
            ))}
          </div>
        )}

        {/* Today's checklist */}
        {data && data.checklist.length > 0 ? (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <CheckSquare className="size-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-slate-900">Today&apos;s Checklist</h3>
            </header>
            <ul className="divide-y divide-slate-100">
              {data.checklist.map((task, index) => (
                <li key={`task-${index}`} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs font-medium text-slate-400">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{task.title || '-'}</span>
                  {task.status ? (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {task.status}
                    </span>
                  ) : null}
                  {task.reply ? (
                    <span className="hidden max-w-[220px] shrink-0 truncate text-xs text-slate-400 sm:block">
                      {task.reply}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
