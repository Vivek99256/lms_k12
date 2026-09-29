'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { fetchConceptResult, type ConceptDiagnosticResult } from '@/app/pal/data/pal-diagnostic';
import { BAND_ORDER, BandChip, BandRow } from '@/app/pal/_components/BandMeter';
import { JourneyRail, stagesBefore } from '@/app/pal/_components/JourneyRail';
import { PalRailSection, PalRailStat, PalWorkspace } from '@/app/pal/_components/PalWorkspace';
import { ScoreRing } from '@/app/pal/_components/DiagnosticNavigator';
import { AnswerReviewButton } from '@/app/pal/_components/AnswerReview';

/**
 * Stage 2b - the concept diagnostic result.
 *
 * Sits between the concept diagnostic and the Plan. It reports where the
 * learner stands on this one concept and sends them to the Plan, which is
 * where that standing turns into what to learn first. No "more questions" and
 * no Feedback here: those belong after Practice.
 *
 * fetchConceptResult() closes out the set server-side (publishes the answers
 * to the mastery ledger); the server documents that as idempotent, so a
 * refresh of this screen is safe.
 */
export default function ConceptDiagnosticResultPage() {
  return (
    <Suspense fallback={<Centered>Loading your result…</Centered>}>
      <ConceptDiagnosticResultView />
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

const HEADLINE: Record<string, string> = {
  mastered: 'You have already mastered this concept',
  strong: 'You know this concept well',
  developing: 'You are partly there',
  weak: 'This concept needs work',
  untested: 'Not enough answers to judge yet',
};

interface AttemptScope {
  attempted: number;
  correct: number;
  accuracy: number;
  byDifficulty: ConceptDiagnosticResult['byDifficulty'];
  questionResults: ConceptDiagnosticResult['questionResults'];
  /** True once `setSize` actually narrowed the view to less than the full lifetime history. */
  scoped: boolean;
}

/**
 * Scopes a lifetime `ConceptDiagnosticResult` down to just this attempt.
 *
 * Adaptive practice has no discrete "attempt" record server-side --
 * `pal_adaptive_response` is one open-ended, per-answer ledger, and
 * `conceptResult()` (correctly, for mastery tracking) reports standing
 * across every row ever written for this concept, not just the set the
 * learner just finished. `setSize` -- the number of questions THIS set
 * served, put on the URL by the taking screen right before it navigates
 * here -- is what recovers "just this attempt" on the frontend without a
 * backend change: `questionResults` is already chronological
 * (`ORDER BY id` in `AdaptiveLearningService::questionResults()`), `submit()`
 * posts this set's answers immediately before the navigation, so they land
 * as the newest rows -- the last `setSize` of them.
 *
 * Sliced by POSITION, not by question id, on purpose: a "recycled" set can
 * legitimately re-serve a question the learner already answered before (see
 * `AdaptiveLearningService::questions()`'s own doc comment on that), and
 * matching by id would then pull in that OLDER row too and double-count it.
 */
function scopeToAttempt(result: ConceptDiagnosticResult, setSize: number | null): AttemptScope {
  const total = result.questionResults.length;
  const size = setSize !== null && setSize > 0 && setSize <= total ? setSize : total;
  const scoped = size < total;
  const questionResults = scoped ? result.questionResults.slice(-size) : result.questionResults;

  if (!scoped) {
    return {
      attempted: result.attempted,
      correct: result.correct,
      accuracy: result.accuracy,
      byDifficulty: result.byDifficulty,
      questionResults,
      scoped: false,
    };
  }

  const byDifficulty: ConceptDiagnosticResult['byDifficulty'] = {};
  let correct = 0;

  for (const question of questionResults) {
    if (question.isCorrect === true) correct += 1;

    const band = byDifficulty[question.difficulty] ?? { attempted: 0, correct: 0, accuracy: 0 };
    band.attempted += 1;
    if (question.isCorrect === true) band.correct += 1;
    byDifficulty[question.difficulty] = band;
  }

  Object.values(byDifficulty).forEach((band) => {
    band.accuracy = band.attempted > 0 ? Math.round((band.correct / band.attempted) * 10000) / 100 : 0;
  });

  return {
    attempted: size,
    correct,
    accuracy: size > 0 ? Math.round((correct / size) * 10000) / 100 : 0,
    byDifficulty,
    questionResults,
    scoped: true,
  };
}

function ConceptDiagnosticResultView() {
  const params = useParams();
  const searchParams = useSearchParams();
  const conceptId = String(params?.conceptId ?? '');
  const chapterHint = searchParams.get('chapterId') ?? '';
  // Set by the taking screen right before it navigates here -- see
  // `scopeToAttempt`'s own doc comment for why this exists at all.
  const setSizeParam = searchParams.get('setSize');
  const setSize = setSizeParam !== null ? parseInt(setSizeParam, 10) : null;

  const [result, setResult] = useState<ConceptDiagnosticResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      fetchConceptResult(conceptId, controller.signal)
        .then(setResult)
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'Your result could not be loaded.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });
    return () => controller.abort();
  }, [conceptId]);

  useEffect(() => load(), [load]);

  if (loading) return <Centered>Loading your result…</Centered>;

  if (error || !result) {
    return (
      <div className="mx-auto w-full space-y-5 p-4 sm:p-6">
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-rose-800">{error ?? 'Your result could not be loaded.'}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={load}>
                Try again
              </Button>
              <Link href="/pal" className={buttonVariants({ size: 'sm' })}>
                Back to subjects
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const chapterId = result.chapterId || chapterHint;
  const planHref = chapterId ? `/pal/plan/chapter/${chapterId}` : '/pal';
  const conceptsHref = chapterId ? `/pal/adaptive/chapter/${chapterId}` : '/pal';
  const scope = scopeToAttempt(result, setSize);
  const bands = BAND_ORDER.filter((band) => (scope.byDifficulty[band]?.attempted ?? 0) > 0);
  const headline = HEADLINE[result.understanding] ?? 'Here is where you stand';

  const rail = (
    <>
      <PalRailSection title={scope.scoped ? 'This attempt' : 'Your result so far'}>
        <PalRailStat label="Correct" value={`${scope.correct} of ${scope.attempted}`} />
        <PalRailStat
          label="Accuracy"
          value={`${Math.round(scope.accuracy)}%`}
          tone={result.needsRemediation ? 'warning' : scope.accuracy >= 70 ? 'positive' : 'default'}
        />
        {result.currentDifficulty && (
          <PalRailStat label="Level" value={<BandChip band={result.currentDifficulty} />} />
        )}
      </PalRailSection>

      <PalRailSection title="Your journey">
        <JourneyRail current="adaptive" completed={stagesBefore('adaptive')} orientation="vertical" />
      </PalRailSection>
    </>
  );

  return (
    <PalWorkspace
      eyebrow="Concept diagnostic result"
      title={result.conceptName || 'Concept'}
      description="Where you stand on this concept. Your plan uses it to decide what you learn first."
      backHref={conceptsHref}
      backLabel="All concepts"
      rail={rail}
    >
      <Card className="overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-5">
            <ScoreRing percentage={scope.accuracy} />
            <div className="flex-1">
              <p className="text-xl font-semibold text-slate-900">{headline}</p>
              <p className="mt-1 text-sm text-slate-600">
                You got <span className="font-semibold text-slate-900">{scope.correct}</span> of{' '}
                <span className="font-semibold text-slate-900">{scope.attempted}</span> right on this
                concept{scope.scoped ? '' : ', across every attempt so far'}.
              </p>
            </div>
            <AnswerReviewButton results={scope.questionResults} />
          </div>

          {bands.length > 0 && (
            <div className="mt-4 space-y-4">
              {bands.map((band, index) => {
                const stats = scope.byDifficulty[band];
                return (
                  <div
                    key={band}
                    className="h5p-enter h5p-stagger"
                    style={{ '--h5p-stagger': `${index * 60}ms` } as React.CSSProperties}
                  >
                    <BandRow
                      band={band}
                      correct={stats.correct}
                      served={stats.attempted}
                      percentage={stats.accuracy}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {result.rationale && (
            <p className="mt-4 flex items-start gap-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
              <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
              <span>{result.rationale}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {result.misconception && (
        <Card className="mt-4 border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              A mix-up to clear up
            </p>
            <p className="mt-2 flex items-start gap-2 text-sm font-medium text-slate-900">
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>{result.misconception.description || result.misconception.tag}</span>
            </p>
            {result.misconception.correctiveAction && (
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-medium">Your plan will cover: </span>
                {result.misconception.correctiveAction}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
        <Link href={conceptsHref} className={buttonVariants({ variant: 'outline' })}>
          <ArrowLeft aria-hidden className="mr-1.5 h-4 w-4" />
          Diagnose another concept
        </Link>
        <Link href={planHref} className={buttonVariants()}>
          Go to my plan
          <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
        </Link>
      </div>
    </PalWorkspace>
  );
}
