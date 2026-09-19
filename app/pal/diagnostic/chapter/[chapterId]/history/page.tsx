'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, History, Loader2 } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  fetchChapterDiagnosticHistory,
  type DiagnosticHistoryEntry,
} from '@/app/pal/data/pal-diagnostic';
import { LevelBadge } from '@/app/pal/_components/BandMeter';

/**
 * Every submitted diagnostic for one chapter, newest first.
 *
 * Retaking is allowed, so a learner needs to see whether they are moving. The
 * delta against the previous attempt is computed here from two stored
 * percentages - there is no "improvement" field on the server and inventing one
 * would be a second version of a number already in the rows.
 */

export default function DiagnosticHistoryPage() {
  return (
    <Suspense fallback={<Centered>Loading your attempts…</Centered>}>
      <DiagnosticHistoryView />
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

function DiagnosticHistoryView() {
  const params = useParams();
  const chapterId = String(params?.chapterId ?? '');

  const [chapterName, setChapterName] = useState('');
  const [attempts, setAttempts] = useState<DiagnosticHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const controller = new AbortController();
    // Every setState is deferred, including the loading/error reset: calling
    // them in the effect body triggers a cascading render, which is what
    // react-hooks/set-state-in-effect flags. Same convention as app/pal/eso/*.
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      fetchChapterDiagnosticHistory(chapterId, controller.signal)
        .then((data) => {
          setChapterName(data.chapterName);
          setAttempts(data.attempts);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'History could not be loaded.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [chapterId]);

  useEffect(() => load(), [load]);

  if (loading) return <Centered>Loading your attempts…</Centered>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <Link href="/pal" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2 text-slate-600')}>
          <ArrowLeft aria-hidden className="mr-1.5 h-4 w-4" />
          Back to subjects
        </Link>
      </div>

      <header className="mb-5">
        <h1 className="text-lg font-semibold text-slate-900">Diagnostic attempts</h1>
        {chapterName && <p className="mt-1 text-sm text-slate-600">{chapterName}</p>}
      </header>

      {error && (
        <Card className="mb-4 border-rose-200 bg-rose-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-rose-800">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>Try again</Button>
          </CardContent>
        </Card>
      )}

      {attempts.length === 0 && !error ? (
        <EmptyState
          icon={<History aria-hidden className="h-8 w-8" />}
          title="No attempts yet"
          description="Once you submit a diagnostic for this chapter it will appear here."
          action={
            <Link href={`/pal/diagnostic/chapter/${chapterId}`} className={buttonVariants()}>Take the diagnostic</Link>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{attempts.length} attempts</CardTitle>
            <CardDescription>Most recent first.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {attempts.map((attempt, index) => {
                // attempts are newest first, so the "previous" one is the next
                // row down.
                const previous = attempts[index + 1];
                const delta = previous ? attempt.percentage - previous.percentage : null;

                return (
                  <li key={attempt.attemptId} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-slate-900">
                          {Math.round(attempt.percentage)}%
                        </span>
                        <LevelBadge level={attempt.level} />
                        {delta !== null && Math.abs(delta) >= 0.5 && (
                          <span
                            className={`text-[11px] font-semibold tabular-nums ${
                              delta > 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {delta > 0 ? '+' : ''}
                            {Math.round(delta)} pts
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {attempt.correct}/{attempt.totalQuestions} correct
                        {attempt.unanswered > 0 && ` · ${attempt.unanswered} skipped`}
                        {attempt.submittedAt && ` · ${formatDate(attempt.submittedAt)}`}
                      </p>
                    </div>

                    <Link href={`/pal/diagnostic/result/${attempt.attemptId}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>View</Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="mt-5 flex justify-end">
        <Link href={`/pal/diagnostic/chapter/${chapterId}`} className={buttonVariants({ variant: 'outline' })}>Retake diagnostic</Link>
      </div>
    </div>
  );
}

/** Laravel hands back "YYYY-MM-DD HH:MM:SS"; Safari will not parse that as-is. */
function formatDate(value: string): string {
  const parsed = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
