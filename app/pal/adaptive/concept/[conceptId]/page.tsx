'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Lightbulb, Loader2 } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  fetchAdaptiveQuestions,
  submitAdaptiveAnswer,
  type AdaptiveQuestionSet,
  type ConceptDiagnosticResult,
  type DiagnosticQuestionItem,
} from '@/app/pal/data/pal-diagnostic';
import { BandChip, bandLabel } from '@/app/pal/_components/BandMeter';
import {
  CompletedBadge,
  CompletedConceptPanel,
  ReadOnlyBadge,
  useConceptCompletion,
} from '@/app/pal/_components/CompletionState';
import { COMPLETED_THROUGH_CHECK, JourneyRail, stagesBefore } from '@/app/pal/_components/JourneyRail';
import { PalRailSection, PalWorkspace } from '@/app/pal/_components/PalWorkspace';

/**
 * Stage 2 - the concept diagnostic.
 *
 * Journey: chapter diagnostic -> its result -> CONCEPT DIAGNOSTIC -> its result
 * -> plan -> learn -> practice -> feedback -> check -> mastery -> recall.
 *
 * Five questions (AdaptiveLearningService::DEFAULT_LIMIT, which the server
 * also enforces as a ceiling), answered without correctness being revealed,
 * then an explicit Submit that leads to the concept diagnostic result. It is a
 * diagnosis, not practice: Feedback and "more questions" belong after Practice,
 * which the engine serves once the learner has been through Plan and Learn.
 *
 * ---------------------------------------------------------------------------
 * WHY SUBMIT STILL POSTS ONE ANSWER AT A TIME
 * ---------------------------------------------------------------------------
 * AdaptiveLearningService records each answer and re-derives the next
 * difficulty from the history INCLUDING that answer, storing per-answer
 * provenance (`rule_fired`). Submit therefore posts the answers in order rather
 * than as one batch, and remembers which ones landed so a retry after a failure
 * never records the same answer twice.
 *
 * ---------------------------------------------------------------------------
 * A COMPLETED CONCEPT NEVER LOADS A QUESTION SET
 * ---------------------------------------------------------------------------
 * Completion is resolved BEFORE the questions are asked for, not after. A
 * concept that has been cleared to hard and signed off renders its mastery and
 * stops there - no set is fetched, so there is no answer this screen could
 * record even if a control were left behind by accident. See
 * app/pal/data/pal-completion.ts for the rule itself.
 */

export default function AdaptivePracticePage() {
  return (
    <Suspense fallback={<Centered>Loading practice…</Centered>}>
      <AdaptivePracticeView />
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

function AdaptivePracticeView() {
  const params = useParams();
  const router = useRouter();
  const conceptId = String(params?.conceptId ?? '');

  const [set, setSet] = useState<AdaptiveQuestionSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Question ids the server has already recorded, so a retried Submit posts
  // only the ones that did not land.
  const recorded = useRef<Set<string>>(new Set());

  // Answered first, and the question set is never requested until it says no.
  const {
    result: completedResult,
    completed,
    loading: checkingCompletion,
  } = useConceptCompletion(conceptId);

  const load = useCallback(() => {
    const controller = new AbortController();
    // Every setState is deferred, including the loading/error reset: calling
    // them in the effect body triggers a cascading render, which is what
    // react-hooks/set-state-in-effect flags. Same convention as app/pal/eso/*.
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      setSubmitError(null);
      setSelected({});
      recorded.current = new Set();
      fetchAdaptiveQuestions(conceptId, undefined, controller.signal)
        .then(setSet)
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'Practice could not be loaded.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [conceptId]);

  // Gated rather than aborted: fetching a set for a completed concept and then
  // throwing it away would still have consumed the learner's question stock.
  useEffect(() => {
    if (checkingCompletion || completed) return;
    return load();
  }, [load, checkingCompletion, completed]);

  const items = useMemo(() => set?.items ?? [], [set]);
  const answeredCount = items.filter((question) => selected[question.questionId]).length;
  const allAnswered = items.length > 0 && answeredCount >= items.length;
  const resultHref = `/pal/adaptive/concept/${conceptId}/result${
    set?.chapterId ? `?chapterId=${set.chapterId}` : ''
  }`;

  const choose = useCallback(
    (questionId: string, optionId: string) => {
      if (submitting) return;
      setSelected((previous) => ({ ...previous, [questionId]: optionId }));
    },
    [submitting]
  );

  const submit = useCallback(async () => {
    if (!allAnswered || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      for (const question of items) {
        if (recorded.current.has(question.questionId)) continue;
        await submitAdaptiveAnswer({
          conceptId,
          questionId: question.questionId,
          answerMasterId: selected[question.questionId],
        });
        recorded.current.add(question.questionId);
      }
      router.push(resultHref);
    } catch (reason: unknown) {
      setSubmitError(
        reason instanceof Error ? reason.message : 'Your answers could not be submitted. Try again.'
      );
      setSubmitting(false);
    }
  }, [allAnswered, submitting, items, conceptId, selected, router, resultHref]);

  if (checkingCompletion) return <Centered>Loading this concept…</Centered>;

  // Read-only from here down: mastery information and a way back, nothing else.
  if (completed && completedResult) {
    return <CompletedConceptView result={completedResult} chapterId={completedResult.chapterId} />;
  }

  if (loading) return <Centered>Loading the concept diagnostic…</Centered>;

  if (error && !set) {
    return (
      <div className="mx-auto w-full space-y-5 p-4 sm:p-6">
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm text-rose-800">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>Try again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PalWorkspace
      eyebrow="Concept diagnostic"
      title={set?.conceptName || 'Concept diagnostic'}
      description="Answer every question, then submit to see where you stand on this concept."
      backHref={`/pal/adaptive/chapter/${set?.chapterId ?? ''}`}
      backLabel="All concepts"
      actions={set?.difficulty ? <BandChip band={set.difficulty} /> : undefined}
      rail={
        <>
          <PalRailSection title="This set">
            <div className="flex items-baseline justify-between gap-3 py-1">
              <span className="text-sm text-slate-600">Answered</span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">
                {answeredCount} of {items.length}
              </span>
            </div>
            {items.length > 0 && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{ width: `${(answeredCount / items.length) * 100}%` }}
                  role="progressbar"
                  aria-valuenow={answeredCount}
                  aria-valuemin={0}
                  aria-valuemax={items.length}
                  aria-label="Questions answered"
                />
              </div>
            )}
          </PalRailSection>

          <PalRailSection title="Your journey">
            <JourneyRail current="adaptive" completed={stagesBefore('adaptive')} orientation="vertical" />
          </PalRailSection>
        </>
      }
    >

      {set?.rationale?.trim() && (
        <Card className="mb-4 border-indigo-200 bg-indigo-50">
          <CardContent className="flex items-start gap-2.5 pt-5">
            <Lightbulb aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
            <p className="text-sm text-indigo-900">{set.rationale}</p>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-slate-600">
              There are no more questions available for this concept right now.
            </p>
            <Link href={resultHref} className={cn(buttonVariants(), 'mt-4')}>
              See where you stand
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((question, index) => (
            <DiagnosticQuestion
              key={question.questionId}
              question={question}
              index={index + 1}
              selectedId={selected[question.questionId] ?? null}
              disabled={submitting}
              onSelect={(optionId) => choose(question.questionId, optionId)}
            />
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-6 border-t border-slate-200 pt-5">
          {submitError && (
            <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {submitError}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {allAnswered
                ? `All ${items.length} answered. Submit when you are ready.`
                : `${answeredCount} of ${items.length} answered. Answer every question to submit.`}
            </p>
            <Button onClick={() => void submit()} disabled={!allAnswered || submitting}>
              {submitting && <Loader2 aria-hidden className="mr-1.5 h-4 w-4 animate-spin" />}
              {submitting ? 'Submitting…' : 'Submit'}
              {!submitting && <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </PalWorkspace>
  );
}

/**
 * A completed concept, in full.
 *
 * Mastery information and the two navigation routes out - no question set, no
 * lesson link, no "practise again", no control that could write anything. The
 * rail carries context only, and the journey shows the concept closed out.
 */
function CompletedConceptView({
  result,
  chapterId,
}: {
  result: ConceptDiagnosticResult;
  chapterId: string;
}) {
  // The highest rung actually cleared, not the one the rule aims at - a
  // concept with no hard questions written completes without it, and saying
  // "Hard" there would claim evidence that does not exist.
  const cleared = result.ladder.bandsCleared.map((band) => band.toLowerCase());
  const topCleared = ['hard', 'medium', 'easy'].find((band) => cleared.includes(band));

  return (
    <PalWorkspace
      eyebrow="Concept mastery"
      title={result.conceptName || 'Concept'}
      description="This concept is completed. Everything below is a record of how you got there."
      backHref={chapterId ? `/pal/adaptive/chapter/${chapterId}` : '/pal'}
      backLabel={chapterId ? 'All concepts' : 'Back to subjects'}
      actions={
        <>
          <CompletedBadge />
          <ReadOnlyBadge />
        </>
      }
      rail={
        <>
          <PalRailSection title="Where you finished">
            <div className="flex items-baseline justify-between gap-3 py-1">
              <span className="text-sm text-slate-600">Accuracy</span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">
                {Math.round(result.accuracy)}%
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-1">
              <span className="text-sm text-slate-600">Correct</span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">
                {result.correct} of {result.attempted}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-1">
              <span className="text-sm text-slate-600">Top level cleared</span>
              <span className="text-sm font-semibold text-slate-900">
                {topCleared ? bandLabel(topCleared) : 'None recorded'}
              </span>
            </div>
          </PalRailSection>

          <PalRailSection title="Your journey">
            <JourneyRail
              current="mastery"
              completed={COMPLETED_THROUGH_CHECK}
              bypassed={['intervention']}
              orientation="vertical"
            />
          </PalRailSection>
        </>
      }
    >
      <CompletedConceptPanel result={result} />

      {chapterId && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
          <Link
            href={`/pal/adaptive/chapter/${chapterId}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            All concepts
          </Link>
          <Link
            href={`/pal/mastery/chapter/${chapterId}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            Chapter mastery
            <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
      )}
    </PalWorkspace>
  );
}

/** One question. The choice can be changed until Submit; correctness is never shown here. */
function DiagnosticQuestion({
  question,
  index,
  selectedId,
  disabled,
  onSelect,
}: {
  question: DiagnosticQuestionItem;
  index: number;
  selectedId: string | null;
  disabled: boolean;
  onSelect: (optionId: string) => void;
}) {
  return (
    <Card data-pal-question-id={question.questionId}>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold tabular-nums text-slate-600">
            {index}
          </span>
          <div
            className="min-w-0 flex-1 text-sm font-medium text-slate-900 [&_img]:max-w-full"
            dangerouslySetInnerHTML={{ __html: question.title }}
          />
          <BandChip band={question.difficulty} className="shrink-0" />
        </div>

        <div className="space-y-1.5 pl-9">
          {question.options.map((option, optionIndex) => {
            const isSelected = selectedId === option.id;

            return (
              <label
                key={option.id}
                data-pal-option-id={option.id}
                className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  isSelected ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'
                } ${disabled ? 'cursor-default' : 'cursor-pointer hover:border-slate-300 hover:bg-slate-50'}`}
              >
                <input
                  type="radio"
                  name={`concept-diagnostic-${question.questionId}`}
                  value={option.id}
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => onSelect(option.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600"
                />
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-[11px] font-semibold text-slate-600">
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                <span
                  className="min-w-0 flex-1 [&_img]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: option.answer }}
                />
              </label>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
