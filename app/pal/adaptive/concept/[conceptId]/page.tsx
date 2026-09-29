'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Lightbulb, Loader2 } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { QuestionPlayer } from '@/components/h5p/players';
import type { QuestionResult } from '@/components/h5p/players/types';
import { canPlay, selectedOptionId, toPlayerQuestion } from '@/lib/pal/diagnostic-answers';
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
import { FlagToggle, ProgressRing, QuestionNavigator } from '@/app/pal/_components/DiagnosticNavigator';

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
 * ONE QUESTION AT A TIME, BY DESIGN
 * ---------------------------------------------------------------------------
 * Same navigator/Previous/Next pattern as the chapter diagnostic
 * (`app/pal/_components/DiagnosticNavigator.tsx`) - `selected` still covers
 * every question in the set the moment it is answered, the navigator and
 * Previous/Next only control which one is on screen.
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
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
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
      setFlagged({});
      setCurrentIndex(0);
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

  const total = items.length;
  const current = items[currentIndex] ?? null;
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= total - 1;

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(total - 1, index)));
    },
    [total]
  );

  // Same keyboard support as the chapter diagnostic - left/right steps
  // through the set the same way Previous/Next do.
  useEffect(() => {
    if (total === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return;

      if (event.key === 'ArrowRight') goTo(currentIndex + 1);
      else if (event.key === 'ArrowLeft') goTo(currentIndex - 1);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [total, currentIndex, goTo]);

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

  const navigatorItems = items.map((question) => ({
    id: question.questionId,
    answered: selected[question.questionId] != null,
  }));

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
            <div className="flex items-center gap-3">
              <ProgressRing value={answeredCount} max={total} />
              <div>
                <p className="text-sm font-semibold text-slate-900">{answeredCount} of {total} answered</p>
                {!allAnswered && total > 0 && (
                  <p className="text-xs text-slate-500">Every question is needed to submit.</p>
                )}
              </div>
            </div>
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
        <>
          <div className="mb-4">
            <QuestionNavigator items={navigatorItems} currentIndex={currentIndex} onJump={goTo} disabled={submitting} />
          </div>

          {current && (
            <DiagnosticQuestion
              key={current.questionId}
              question={current}
              index={currentIndex + 1}
              total={total}
              selectedId={selected[current.questionId] ?? null}
              disabled={submitting}
              onSelect={(optionId) => choose(current.questionId, optionId)}
              flagged={flagged[current.questionId] ?? false}
              onToggleFlag={() =>
                setFlagged((previous) => ({ ...previous, [current.questionId]: !previous[current.questionId] }))
              }
            />
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <Button variant="outline" onClick={() => goTo(currentIndex - 1)} disabled={isFirst || submitting}>
              <ArrowLeft aria-hidden className="mr-1.5 h-4 w-4" />
              Previous
            </Button>
            <span className="text-xs font-medium tabular-nums text-slate-400">
              Question {currentIndex + 1} of {total}
            </span>
            <Button variant="outline" onClick={() => goTo(currentIndex + 1)} disabled={isLast || submitting}>
              Next
              <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </>
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
  total,
  selectedId,
  disabled,
  onSelect,
  flagged,
  onToggleFlag,
}: {
  question: DiagnosticQuestionItem;
  index: number;
  total: number;
  selectedId: string | null;
  disabled: boolean;
  onSelect: (optionId: string) => void;
  flagged: boolean;
  onToggleFlag: () => void;
}) {
  // Same payload shape as the chapter diagnostic. See `lib/pal/diagnostic-answers.ts`.
  const playable = useMemo(() => canPlay(question), [question]);

  const handleResult = useCallback(
    (result: QuestionResult) => {
      const optionId = selectedOptionId(question, result);
      if (optionId) onSelect(optionId);
    },
    [question, onSelect]
  );

  return (
    <Card data-pal-question-id={question.questionId} className="h5p-enter overflow-hidden">
      <CardContent className="pt-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold tabular-nums text-indigo-700">
              {index}
            </span>
            <span className="text-xs font-medium tabular-nums text-slate-400">of {total}</span>
            <BandChip band={question.difficulty} />
          </div>
          <FlagToggle flagged={flagged} onToggle={onToggleFlag} disabled={disabled} />
        </div>

        {playable ? (
          <QuestionPlayer
            question={toPlayerQuestion(question)}
            onResult={handleResult}
            embedded
            // Same reasoning as the chapter diagnostic: a concept
            // diagnostic measures, it does not teach mid-assessment.
            instantFeedback={false}
          />
        ) : (
          <>
            <div
              className="mb-3 text-base font-medium text-slate-900 [&_img]:max-w-full"
              dangerouslySetInnerHTML={{ __html: question.title }}
            />
            <div className="space-y-2">
              {question.options.map((option) => {
                const isSelected = selectedId === option.id;

                return (
                  <label
                    key={option.id}
                    data-pal-option-id={option.id}
                    className={cn(
                      'h5p-tappable h5p-focusable flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm transition-colors',
                      isSelected ? 'border-indigo-400 bg-indigo-50 font-semibold text-indigo-900' : 'border-slate-200',
                      disabled ? 'cursor-default' : 'cursor-pointer hover:border-slate-300 hover:bg-slate-50'
                    )}
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
                    <span
                      className="min-w-0 flex-1 [&_img]:max-w-full"
                      dangerouslySetInnerHTML={{ __html: option.answer }}
                    />
                  </label>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
