'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, CircleDot, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buildSessionContext } from '@/lib/erp-client';
import {
  defaultLearnerId,
  fetchLearningPath,
  type LearningPath,
  type LearningPathChapter,
} from '@/app/pal/data/pal-eso';

/**
 * Learning Path — PAL loop step 4, the Personal Learning Plan.
 *
 * The loop has always decided a sequence; until now the only way to see it was
 * one chapter at a time, because studentDashboard() resolved the whole ordering
 * and returned just the current chapter. This screen shows the plan.
 *
 * It decides nothing. Every status, the current position and the reason for it
 * come from EsoPolicyService::learningPath() — this renders them.
 */
export default function LearningPathPage() {
  return (
    <Suspense fallback={<Centered><Loader2 className="h-5 w-5 animate-spin" /></Centered>}>
      <LearningPathView />
    </Suspense>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60vh] items-center justify-center text-slate-500">{children}</div>;
}

function LearningPathView() {
  const [path, setPath] = useState<LearningPath | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const learnerId = defaultLearnerId();

  // The academic year comes from the session, never from the system clock:
  // the plan is scoped to an enrolment, and a school year is not the calendar
  // year. Same resolution StudentDashboard uses, so both screens agree on
  // which year a student is being shown.
  const syear = buildSessionContext().syear;

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');

      if (!learnerId || !syear) {
        // Said plainly rather than guessed at. Defaulting the year here would
        // silently show a plan for the wrong enrolment.
        setError('Your session is missing academic year information. Please sign in again.');
        setPath(null);
        setLoading(false);
        return;
      }

      try {
        setPath(await fetchLearningPath(learnerId, syear, signal));
      } catch (caught) {
        if ((caught as Error)?.name === 'AbortError') return;
        setError(caught instanceof Error ? caught.message : 'Could not load the learning path.');
        setPath(null);
      } finally {
        setLoading(false);
      }
    },
    [learnerId, syear]
  );

  useEffect(() => {
    const controller = new AbortController();
    // Deferred to a microtask so setLoading/setError inside load() don't fire
    // synchronously within the effect body — same convention as
    // app/dashboard/StudentDashboard.tsx and app/pal/eso/page.tsx.
    queueMicrotask(() => {
      void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  if (loading) {
    return (
      <Centered>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your plan…
      </Centered>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base text-amber-900">Your plan could not be loaded</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-amber-800">{error}</p>
            <Button variant="outline" onClick={() => void load()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Enrolled, but nothing has been prepared for adaptive learning yet. Said
  // plainly rather than shown as an empty list, which would read as a bug.
  if (!path || path.noContent || path.chapters.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No learning path yet</CardTitle>
            <CardDescription>
              None of your chapters have been prepared for adaptive learning yet. When they are, your plan will
              appear here.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Your learning path</h1>
        <p className="text-sm text-slate-600">
          {path.completedChapters} of {path.chapterCount} chapters complete
        </p>
      </header>

      {path.current ? <CurrentStep path={path} /> : null}

      {path.pathComplete ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader className="flex flex-row items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-base text-emerald-900">
              Every chapter on your path is complete
            </CardTitle>
          </CardHeader>
        </Card>
      ) : null}

      <ol className="space-y-3">
        {path.chapters.map((chapter) => (
          <li key={chapter.chapterId}>
            <ChapterRow chapter={chapter} isCurrent={path.current?.chapterId === chapter.chapterId} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Where the student is now, and why.
 *
 * `ruleFired` is shown deliberately: the engine picked this step for a stated
 * reason, and a plan that shows a sequence without saying why the next thing is
 * next is a list, not a plan.
 */
function CurrentStep({ path }: { path: LearningPath }) {
  const current = path.current!;
  const chapter = path.chapters.find((c) => c.chapterId === current.chapterId);
  const concept = chapter?.concepts.find((c) => c.conceptId === current.conceptId);

  return (
    <Card className="border-indigo-200 bg-indigo-50/60">
      <CardHeader className="pb-3">
        <CardDescription className="text-indigo-700">Next up</CardDescription>
        <CardTitle className="text-lg text-indigo-950">
          {concept?.name ?? 'Your next concept'}
        </CardTitle>
        {chapter ? (
          <p className="text-sm text-indigo-800">
            {chapter.subjectName ? `${chapter.subjectName} · ` : ''}
            {chapter.chapterName}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {current.ruleFired ? (
          <p className="text-xs text-indigo-700">Chosen by: {current.ruleFired}</p>
        ) : null}
        {/* This project's Button has no `asChild`, so the link wraps it. */}
        <Link href={`/pal/eso?conceptId=${current.conceptId}`}>
          <Button>
            Continue <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function ChapterRow({ chapter, isCurrent }: { chapter: LearningPathChapter; isCurrent: boolean }) {
  const Icon =
    chapter.status === 'complete' ? CheckCircle2 : chapter.status === 'in_progress' ? CircleDot : Circle;

  const iconTone =
    chapter.status === 'complete'
      ? 'text-emerald-600'
      : chapter.status === 'in_progress'
        ? 'text-indigo-600'
        : 'text-slate-300';

  return (
    <div
      className={`rounded-xl border bg-white p-4 ${
        isCurrent ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconTone}`} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900">{chapter.chapterName}</span>
            {chapter.subjectName ? (
              <Badge variant="outline" className="text-xs font-normal">
                {chapter.subjectName}
              </Badge>
            ) : null}
          </div>

          <p className="mt-0.5 text-xs text-slate-500">
            {chapter.masteredCount} of {chapter.conceptCount} concepts mastered
          </p>

          <ul className="mt-2 flex flex-wrap gap-1.5">
            {chapter.concepts.map((concept) => (
              <li key={concept.conceptId}>
                <span
                  title={concept.status}
                  className={`inline-block rounded-full border px-2 py-0.5 text-xs ${
                    concept.mastered
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : concept.status === 'locked'
                        ? 'border-slate-200 bg-slate-50 text-slate-400'
                        : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {concept.name}
                  {/* Mastered but due for re-verification. Shown rather than
                      hidden, so "mastered" keeps one meaning. */}
                  {concept.stale ? ' ·  review due' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
