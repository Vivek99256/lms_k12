'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, CircleDashed, Loader2, Target, TrendingUp, XCircle } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  fetchChapterDiagnosticResult,
  type ChapterDiagnosticResult,
  type DiagnosticConceptBreakdown,
  type DiagnosticQuestionResult,
} from '@/app/pal/data/pal-diagnostic';
import { BandRow, LevelBadge, StrengthBadge, bandLabel } from '@/app/pal/_components/BandMeter';
import { JourneyRail, stagesBefore } from '@/app/pal/_components/JourneyRail';
import { PalRailSection, PalRailStat, PalWorkspace } from '@/app/pal/_components/PalWorkspace';

/**
 * Stage 2 - the diagnostic result.
 *
 * Everything here is computed by DiagnosticService::result() from the learner's
 * own stored answers. It is a pure read, so a refresh, a new device or a login
 * a week later all show exactly the same thing - and this page never recomputes
 * or second-guesses the server's scoring.
 *
 * The result is also the input to Adaptive Learning, which is why the primary
 * action leads there rather than back to the chapter list.
 */

export default function DiagnosticResultPage() {
  return (
    <Suspense fallback={<Centered>Loading your result…</Centered>}>
      <DiagnosticResultView />
    </Suspense>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
      <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
      {children}
    </div>
  );
}

function DiagnosticResultView() {
  const params = useParams();
  const router = useRouter();
  const attemptId = String(params?.attemptId ?? '');

  const [result, setResult] = useState<ChapterDiagnosticResult | null>(null);
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
      fetchChapterDiagnosticResult(attemptId, controller.signal)
        .then(setResult)
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'The result could not be loaded.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [attemptId]);

  useEffect(() => load(), [load]);

  if (loading) return <Centered>Loading your result…</Centered>;

  if (error || !result) {
    return (
      <div className="mx-auto w-full space-y-5 p-4 sm:p-6">
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-rose-800">{error ?? 'This result could not be found.'}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load}>Try again</Button>
              <Link href="/pal" className={buttonVariants({ size: 'sm' })}>Back to subjects</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const answered = result.correct + result.incorrect;

  return (
    <PalWorkspace
      title="Chapter diagnostic result"
      description="This is your starting point for this chapter, not a grade."
      backHref="/pal"
      backLabel="Back to subjects"
      rail={
        <>
          <PalRailSection title="How it went">
            <PalRailStat label="Correct" value={result.correct} tone="positive" />
            <PalRailStat label="Incorrect" value={result.incorrect} />
            {result.unanswered > 0 && (
              <PalRailStat label="Unanswered" value={result.unanswered} tone="warning" />
            )}
            <PalRailStat label="Questions" value={result.totalQuestions} />
          </PalRailSection>

          {(result.strengths.length > 0 || result.weaknesses.length > 0) && (
            <PalRailSection title="Concepts">
              <PalRailStat label="Strong" value={result.strengths.length} tone="positive" />
              <PalRailStat
                label="Need work"
                value={result.weaknesses.length}
                tone={result.weaknesses.length > 0 ? 'warning' : 'default'}
              />
            </PalRailSection>
          )}

          <PalRailSection title="Your journey">
            <JourneyRail current="adaptive" completed={stagesBefore('adaptive')} orientation="vertical" />
          </PalRailSection>
        </>
      }
    >

      {/* Headline. The percentage and the level say the same thing two ways,
          because a level alone is vague and a percentage alone invites it to be
          read as a mark out of a hundred. */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums text-slate-900">
                  {Math.round(result.percentage)}%
                </span>
                <LevelBadge level={result.level} />
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {result.correct} correct of {result.totalQuestions}
                {result.unanswered > 0 && ` · ${result.unanswered} not answered`}
              </p>
            </div>

            <div className="flex gap-2">
              <Stat label="Correct" value={result.correct} tone="positive" />
              <Stat label="Incorrect" value={result.incorrect} />
              {result.unanswered > 0 && <Stat label="Skipped" value={result.unanswered} />}
            </div>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${Math.max(0, Math.min(100, result.percentage))}%` }}
              role="progressbar"
              aria-valuenow={Math.round(result.percentage)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Overall chapter diagnostic score"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp aria-hidden className="h-4 w-4 text-slate-500" />
              How you did at each level
            </CardTitle>
            <CardDescription>
              Five questions were served at each level where the chapter had them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.difficultyBreakdown.map((band) => (
              <BandRow
                key={band.band}
                band={band.band}
                correct={band.correct}
                served={band.served}
                percentage={band.percentage}
                unanswered={band.unanswered}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target aria-hidden className="h-4 w-4 text-slate-500" />
              What to work on next
            </CardTitle>
            <CardDescription>
              {result.recommendedDifficulty
                ? `Your concept diagnostic will start at ${bandLabel(result.recommendedDifficulty)}.`
                : 'Your concept diagnostic will start at the level that fits this result.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result.weaknesses.length === 0 ? (
              <p className="text-sm text-slate-600">
                Nothing stood out as weak in this chapter. The concept diagnostic will confirm it.
              </p>
            ) : (
              <ul className="space-y-2">
                {result.weaknesses.slice(0, 5).map((concept, index) => (
                  <ConceptRow key={`${concept.conceptId}-${index}`} concept={concept} />
                ))}
              </ul>
            )}

            {result.strengths.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Already strong
                </p>
                <ul className="space-y-2">
                  {result.strengths.slice(0, 3).map((concept, index) => (
                    <ConceptRow key={`${concept.conceptId}-strong-${index}`} concept={concept} />
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {result.conceptBreakdown.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Every concept this paper touched</CardTitle>
            <CardDescription>
              {result.conceptBreakdown.some((concept) => !concept.conceptExact)
                ? 'Concepts marked “via chapter” were matched at chapter level, because those questions carry no concept tag.'
                : 'Each question was matched to the concept it tests.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {result.conceptBreakdown.map((concept, index) => (
                <li key={`${concept.conceptId}-all-${index}`} className="py-2">
                  <ConceptRow concept={concept} showExactness />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {result.questionResults.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Question by question</CardTitle>
            <CardDescription>
              Every question on this paper, in the order you saw it — correct, incorrect or
              unanswered.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {result.questionResults.map((question) => (
                <QuestionResultRow key={question.questionId} question={question} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
        <Link href={`/pal/diagnostic/chapter/${result.chapterId}/history`} className={buttonVariants({ variant: 'outline' })}>Previous attempts</Link>

        <Button onClick={() => router.push(`/pal/adaptive/chapter/${result.chapterId}`)}>
          Start concept diagnostic
          <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
        </Button>
      </div>

      {answered === 0 && (
        <p className="mt-4 text-center text-sm text-slate-500">
          No questions were answered on this attempt, so there is nothing to build a plan from yet.
        </p>
      )}
    </PalWorkspace>
  );
}

function QuestionResultRow({ question }: { question: DiagnosticQuestionResult }) {
  const verdict =
    question.isCorrect === true
      ? { Icon: CheckCircle2, className: 'text-emerald-600', label: 'Correct' }
      : question.isCorrect === false
        ? { Icon: XCircle, className: 'text-rose-600', label: 'Incorrect' }
        : { Icon: CircleDashed, className: 'text-slate-400', label: 'Unanswered' };

  return (
    <li className="flex items-start gap-3 py-2.5">
      <verdict.Icon aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${verdict.className}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tabular-nums text-slate-500">
            Q{question.sequence}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600">
            {question.difficulty}
          </span>
          {question.conceptName && (
            <span className="text-[11px] text-slate-400">{question.conceptName}</span>
          )}
        </div>
        <p
          className="mt-1 text-sm text-slate-800 [&_img]:max-w-full"
          dangerouslySetInnerHTML={{ __html: question.title }}
        />
      </div>
      <span className={`shrink-0 text-xs font-semibold ${verdict.className}`}>{verdict.label}</span>
    </li>
  );
}

function ConceptRow({
  concept,
  showExactness = false,
}: {
  concept: DiagnosticConceptBreakdown;
  showExactness?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-800">{concept.name}</p>
        {showExactness && !concept.conceptExact && (
          <p className="text-[11px] text-slate-400">via chapter</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs tabular-nums text-slate-500">
          {concept.correct}/{concept.served}
        </span>
        <StrengthBadge band={concept.band} />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'positive' }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2 text-center">
      <p
        className={`text-lg font-semibold tabular-nums ${
          tone === 'positive' ? 'text-emerald-700' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
