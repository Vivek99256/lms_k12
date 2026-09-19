'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, Clock, Loader2 } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { fetchRecallQueue, type RecallItem, type RecallQueue } from '@/app/pal/data/pal-diagnostic';
import { JourneyRail } from '@/app/pal/_components/JourneyRail';

/**
 * Stage 11 - recall.
 *
 * ---------------------------------------------------------------------------
 * THIS PAGE SCHEDULES NOTHING
 * ---------------------------------------------------------------------------
 * The retention ladder belongs to EsoPolicyService: it sets next_review_at when
 * it grants mastery, moves the rung on every passed retrieval check, and resets
 * it to zero on a failed one. This screen reports that state and hands the
 * learner into the engine to actually sit the check. Nothing here computes a
 * date, and nothing here decides whether a concept is still retained.
 *
 * The ladder is 2, 7, 30, 60 then 180 days, so the rung is shown as a position
 * rather than a raw integer - "review 3 of 5" is something a learner can read,
 * `retention_stage: 2` is not.
 */

/** RETENTION_LADDER_DAYS in EsoPolicyService. Presentation only. */
const LADDER_DAYS = [2, 7, 30, 60, 180];

export default function RecallPage() {
  return (
    <Suspense fallback={<Centered>Loading your reviews…</Centered>}>
      <RecallView />
    </Suspense>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
      <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
      {children}
    </div>
  );
}

function RecallView() {
  const searchParams = useSearchParams();
  const chapterId = searchParams.get('chapterId') ?? undefined;

  const [queue, setQueue] = useState<RecallQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      fetchRecallQueue(chapterId, controller.signal)
        .then(setQueue)
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'Your reviews could not be loaded.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [chapterId]);

  useEffect(() => load(), [load]);

  if (loading) return <Centered>Loading your reviews…</Centered>;

  if (error || !queue) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-rose-800">{error ?? 'Nothing could be loaded.'}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load}>Try again</Button>
              <Link href="/pal" className={buttonVariants({ size: 'sm' })}>Back to subjects</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const backHref = chapterId ? `/pal/mastery/chapter/${chapterId}` : '/pal';

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <Link href={backHref} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2 text-slate-600')}>
          <ArrowLeft aria-hidden className="mr-1.5 h-4 w-4" />
          {chapterId ? 'Back to mastery' : 'Back to subjects'}
        </Link>
      </div>

      <header className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">Recall</h1>
        <p className="mt-1 text-sm text-slate-600">
          Short checks on things you have already mastered, spaced further apart each time you pass.
        </p>
      </header>

      <JourneyRail
        current="recall"
        completed={['diagnostic', 'adaptive', 'plan', 'learn', 'practice', 'check', 'mastery']}
        className="mb-5"
      />

      {queue.counts.totalTracked === 0 ? (
        // Not an error and not an empty list - nothing has been mastered yet,
        // so there is genuinely nothing to bring back. Said plainly.
        <EmptyState
          icon={<CalendarClock aria-hidden className="h-8 w-8" />}
          title="No reviews scheduled yet"
          description="Reviews appear once you have mastered a concept. The first one comes back two days later, then a week, then a month."
          action={
            <Link href={chapterId ? `/pal/plan/chapter/${chapterId}` : '/pal'} className={buttonVariants()}>
              {chapterId ? 'Back to my plan' : 'Back to subjects'}
            </Link>
          }
        />
      ) : (
        <>
          {queue.due.length > 0 ? (
            <Card className="mb-4 border-sky-200 bg-sky-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-sky-900">
                  <Clock aria-hidden className="h-4 w-4" />
                  Due now
                </CardTitle>
                <CardDescription className="text-sky-800">
                  {queue.due.length} concept{queue.due.length === 1 ? '' : 's'} ready for a quick check.
                  Each one takes a few questions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {queue.due.map((item) => (
                    <RecallRow key={item.nodeId} item={item} due />
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-4 border-emerald-200 bg-emerald-50">
              <CardContent className="flex items-start gap-2.5 pt-5">
                <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p className="text-sm text-emerald-900">
                  Nothing due right now. {queue.counts.upcoming > 0
                    ? 'Your next review is listed below.'
                    : 'You are all caught up.'}
                </p>
              </CardContent>
            </Card>
          )}

          {queue.upcoming.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Coming up</CardTitle>
                <CardDescription>
                  Nothing to do yet — these come back on their own.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {queue.upcoming.map((item) => (
                    <RecallRow key={item.nodeId} item={item} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function RecallRow({ item, due = false }: { item: RecallItem; due?: boolean }) {
  const rung = Math.min(item.retentionStage, LADDER_DAYS.length - 1);
  const interval = LADDER_DAYS[rung];

  return (
    <li
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5',
        due ? 'border-sky-200 bg-white' : 'border-slate-200 bg-white'
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{item.conceptName}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {item.chapterName && <span>{item.chapterName} · </span>}
          {/* The rung as a position, not a raw integer. */}
          Review {rung + 1} of {LADDER_DAYS.length}
          <span className="text-slate-400"> · {interval}-day interval</span>
          {item.status === 'retained' && <span className="text-emerald-700"> · held so far</span>}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {!due && item.daysUntil !== null && (
          <span className="text-xs tabular-nums text-slate-500">
            in {item.daysUntil} day{item.daysUntil === 1 ? '' : 's'}
          </span>
        )}

        {due ? (
          <Link href={`/pal/eso?conceptId=${item.conceptId}`} className={buttonVariants({ size: 'sm' })}>
            Start review
            <ArrowRight aria-hidden className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        ) : (
          <Link
            href={`/pal/eso?conceptId=${item.conceptId}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Open
          </Link>
        )}
      </div>
    </li>
  );
}
