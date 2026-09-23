'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, Lightbulb, Loader2, XCircle } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  fetchAdaptiveQuestions,
  fetchConceptResult,
  submitAdaptiveAnswer,
  type AdaptiveAnswerOutcome,
  type AdaptiveQuestionSet,
  type ConceptDiagnosticResult,
  type DiagnosticQuestionItem,
} from '@/app/pal/data/pal-diagnostic';
import { isConceptCompleted, signalsFromConceptResult } from '@/app/pal/data/pal-completion';
import { BandChip, BandRow, bandLabel } from '@/app/pal/_components/BandMeter';
import {
  CompletedBadge,
  CompletedConceptPanel,
  ReadOnlyBadge,
  useConceptCompletion,
} from '@/app/pal/_components/CompletionState';
import { COMPLETED_THROUGH_CHECK, JourneyRail, stagesBefore } from '@/app/pal/_components/JourneyRail';
import { PalRailSection, PalWorkspace } from '@/app/pal/_components/PalWorkspace';

/**
 * Stages 3 and 4 - five adaptive questions, then the concept result.
 *
 * ---------------------------------------------------------------------------
 * WHY ANSWERS POST ONE AT A TIME
 * ---------------------------------------------------------------------------
 * AdaptiveLearningService records each answer as it arrives and re-derives the
 * next difficulty from the history INCLUDING that answer. Batching all five at
 * the end would collapse five decisions into one and lose the per-answer
 * provenance (`rule_fired`) the engine stores.
 *
 * It also means a learner who closes the tab half way keeps what they did.
 *
 * Unlike the diagnostic, practice DOES reveal correctness - the server returns
 * it, along with `answer_master.feedback`, which is the misconception text and
 * the whole point of practising rather than being tested. The client still
 * never asserts correctness; it only displays what came back.
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

interface AnsweredState {
  selectedId: string;
  outcome: AdaptiveAnswerOutcome;
}

function AdaptivePracticeView() {
  const params = useParams();
  const router = useRouter();
  const conceptId = String(params?.conceptId ?? '');

  const [set, setSet] = useState<AdaptiveQuestionSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answered, setAnswered] = useState<Record<string, AnsweredState>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [result, setResult] = useState<ConceptDiagnosticResult | null>(null);
  const [showingResult, setShowingResult] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      setAnswered({});
      setShowingResult(false);
      fetchAdaptiveQuestions(conceptId, 5, controller.signal)
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

  const answer = useCallback(
    async (question: DiagnosticQuestionItem, optionId: string) => {
      if (answered[question.questionId] || pending) return;

      setPending(question.questionId);
      setError(null);

      try {
        const outcome = await submitAdaptiveAnswer({
          conceptId,
          questionId: question.questionId,
          answerMasterId: optionId,
        });
        setAnswered((previous) => ({
          ...previous,
          [question.questionId]: { selectedId: optionId, outcome },
        }));
      } catch (reason: unknown) {
        setError(reason instanceof Error ? reason.message : 'That answer could not be recorded.');
      } finally {
        setPending(null);
      }
    },
    [answered, pending, conceptId]
  );

  const finish = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      setResult(await fetchConceptResult(conceptId));
      setShowingResult(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'The result could not be loaded.');
    } finally {
      setSubmitting(false);
    }
  }, [conceptId]);

  if (checkingCompletion) return <Centered>Loading this concept…</Centered>;

  // Read-only from here down: mastery information and a way back, nothing else.
  if (completed && completedResult) {
    return <CompletedConceptView result={completedResult} chapterId={completedResult.chapterId} />;
  }

  if (loading) return <Centered>Loading practice…</Centered>;

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

  const items = set?.items ?? [];
  const answeredCount = Object.keys(answered).length;
  const allAnswered = items.length > 0 && answeredCount >= items.length;

  if (showingResult && result) {
    // The set that was just submitted may be the one that finished the
    // concept. It closes straight into the completed view rather than offering
    // a "practise again" the concept is no longer open to.
    if (isConceptCompleted(signalsFromConceptResult(result))) {
      return <CompletedConceptView result={result} chapterId={result.chapterId || set?.chapterId || ''} />;
    }

    return (
      <ConceptResultView
        result={result}
        chapterId={set?.chapterId ?? ''}
        onBack={() => router.push(`/pal/adaptive/chapter/${set?.chapterId ?? ''}`)}
      />
    );
  }

  return (
    <PalWorkspace
      eyebrow="Concept diagnostic"
      title={set?.conceptName || 'Practice'}
      description="Five questions, chosen from how your chapter diagnostic went."
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

      {/* Above the questions on purpose. When an answer POST failed this used
          to render below the whole set, so a learner scrolled past it, saw
          nothing recorded, and found Submit inert. */}
      {error && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
          <p className="text-sm text-rose-800">{error}</p>
          <Button variant="outline" size="sm" onClick={load}>Reload the set</Button>
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-slate-600">
              There are no more questions available for this concept right now.
            </p>
            <Button className="mt-4" onClick={() => void finish()}>See where you stand</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((question, index) => (
            <PracticeQuestion
              key={question.questionId}
              question={question}
              index={index + 1}
              state={answered[question.questionId] ?? null}
              pending={pending === question.questionId}
              disabled={Boolean(pending)}
              onSelect={(optionId) => void answer(question, optionId)}
            />
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
          <p className="text-sm text-slate-600">
            {allAnswered
              ? `All ${items.length} answered.`
              : 'Answer each question to see how you did.'}
          </p>
          {/* Deliberately NOT disabled on zero answers. It used to be, which
              meant a learner whose answers had silently failed to record found
              a dead button and no explanation. Submitting with nothing answered
              is a legitimate outcome - the concept result reports `untested`
              rather than pretending. */}
          <Button onClick={() => void finish()} disabled={submitting}>
            {submitting && <Loader2 aria-hidden className="mr-1.5 h-4 w-4 animate-spin" />}
            Submit concept diagnostic
            <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
          </Button>
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

function PracticeQuestion({
  question,
  index,
  state,
  pending,
  disabled,
  onSelect,
}: {
  question: DiagnosticQuestionItem;
  index: number;
  state: AnsweredState | null;
  pending: boolean;
  disabled: boolean;
  onSelect: (optionId: string) => void;
}) {
  const done = state !== null;

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
            const isSelected = state?.selectedId === option.id;
            const isCorrectOne = done && state?.outcome.correctAnswerId === option.id;
            const isWrongPick = isSelected && done && !state.outcome.isCorrect;

            return (
              <label
                key={option.id}
                data-pal-option-id={option.id}
                className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  isCorrectOne
                    ? 'border-emerald-300 bg-emerald-50'
                    : isWrongPick
                      ? 'border-rose-300 bg-rose-50'
                      : isSelected
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-slate-200'
                } ${done || disabled ? 'cursor-default' : 'cursor-pointer hover:border-slate-300 hover:bg-slate-50'}`}
              >
                <input
                  type="radio"
                  name={`practice-${question.questionId}`}
                  value={option.id}
                  checked={isSelected}
                  disabled={done || disabled}
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
                {isCorrectOne && <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
                {isWrongPick && <XCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
              </label>
            );
          })}
        </div>

        {pending && (
          <p className="mt-3 pl-9 text-xs text-slate-500">
            <Loader2 aria-hidden className="mr-1 inline h-3 w-3 animate-spin" />
            Recording your answer…
          </p>
        )}

        {done && (
          <div className="mt-3 pl-9">
            <p
              className={`text-xs font-semibold ${
                state.outcome.isCorrect ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {state.outcome.isCorrect ? 'Correct' : 'Not quite'}
            </p>
            {/* answer_master.feedback - the authored misconception text. Shown
                only when there is one; never invented. */}
            {state.outcome.feedback && (
              <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                {state.outcome.feedback}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Stage 4 - the Concept Diagnostic Result. */
function ConceptResultView({
  result,
  chapterId,
  onBack,
}: {
  result: ConceptDiagnosticResult;
  chapterId: string;
  onBack: () => void;
}) {
  const understandingCopy: Record<string, string> = {
    mastered: 'You have shown this at every level available.',
    strong: 'You are getting these right consistently.',
    developing: 'You are getting there — some are landing, some are not.',
    weak: 'This one needs more work before moving on.',
    untested: 'Not enough answers yet to say.',
  };

  return (
    <PalWorkspace
      eyebrow="Concept result"
      title={result.conceptName}
      description={understandingCopy[result.understanding] ?? ''}
      backHref={`/pal/adaptive/chapter/${chapterId}`}
      backLabel="All concepts"
      actions={result.currentDifficulty ? <BandChip band={result.currentDifficulty} /> : undefined}
      rail={
        <>
          <PalRailSection title="How it went">
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
              <span className="text-sm text-slate-600">Understanding</span>
              <span className="text-sm font-semibold capitalize text-slate-900">
                {result.understanding}
              </span>
            </div>
          </PalRailSection>

          <PalRailSection title="Your journey">
            {/* Practice, not plan. This screen is the record of a practice set
                that has just been submitted; pinning it to Plan put the
                learner two stages behind where they actually were, and hid
                the Feedback stage they are about to be handed to. */}
            <JourneyRail
              current="practice"
              completed={stagesBefore('practice')}
              orientation="vertical"
            />
          </PalRailSection>
        </>
      }
    >
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums text-slate-900">
                  {Math.round(result.accuracy)}%
                </span>
                {result.currentDifficulty && <BandChip band={result.currentDifficulty} />}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {result.correct} correct of {result.attempted} answered
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-500">Understanding</p>
              <p className="text-sm font-semibold capitalize text-slate-900">{result.understanding}</p>
            </div>
          </div>

          <p className="mt-3 text-sm text-slate-600">
            {understandingCopy[result.understanding] ?? ''}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Level by level</CardTitle>
            <CardDescription>
              {result.ladder.bandsUnavailable.length > 0
                ? `This concept has no ${result.ladder.bandsUnavailable.join(' or ')} questions.`
                : 'All three levels are available for this concept.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(['easy', 'medium', 'hard'] as const).map((band) => {
              const stats = result.byDifficulty[band];
              const stock = result.availability[band] ?? 0;
              return (
                <BandRow
                  key={band}
                  band={band}
                  correct={stats?.correct ?? 0}
                  served={stock === 0 ? 0 : (stats?.attempted ?? 0)}
                  percentage={stats?.accuracy ?? 0}
                />
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progress to mastery</CardTitle>
            <CardDescription>{result.ladder.reason}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${
                  result.ladder.mastered ? 'bg-emerald-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, result.ladder.progressPct))}%` }}
                role="progressbar"
                aria-valuenow={Math.round(result.ladder.progressPct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progress to mastery"
              />
            </div>

            <ul className="space-y-1.5">
              {result.ladder.bandsRequired.map((band) => {
                const cleared = result.ladder.bandsCleared.includes(band);
                return (
                  <li key={band} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      {cleared ? (
                        <CheckCircle2 aria-hidden className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <span aria-hidden className="h-4 w-4 rounded-full border border-slate-300" />
                      )}
                      <span className="text-slate-700">{bandLabel(band)}</span>
                    </span>
                    <span className={cleared ? 'text-xs text-emerald-700' : 'text-xs text-slate-500'}>
                      {cleared ? 'Cleared' : 'Not yet'}
                    </span>
                  </li>
                );
              })}
            </ul>

            {result.needsRemediation && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Your plan will start this concept with learning material rather than more questions.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* The engine's decision is no longer rendered here - it is rendered on
          the Feedback page, which is where the learner is about to be. Showing
          it on both would mean pressing the same engine-chosen button on two
          consecutive screens.

          What stays is the handoff, carrying the engine's own sentence, so the
          primary action on this screen is still visibly the engine's. */}
      <Card className="mt-4 border-indigo-200 bg-indigo-50" data-pal-next-action={result.next?.action ?? 'none'}>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ArrowRight aria-hidden className="h-4 w-4" />
                Before you move on
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {result.next?.reason ??
                  'Have a look at what this set showed before you carry on.'}
              </p>
            </div>

            <Link
              href={`/pal/feedback/concept/${result.conceptId}?chapterId=${
                result.chapterId || chapterId
              }&published=${result.evidencePublished}`}
              className={cn(buttonVariants(), 'shrink-0')}
            >
              See what this means
              <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
        <Button variant="outline" onClick={onBack}>All concepts</Button>

        <div className="flex gap-2">
          <Link
            href={`/pal/mastery/chapter/${result.chapterId || chapterId}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            My mastery
          </Link>
          <Link
            href={`/pal/plan/chapter/${result.chapterId || chapterId}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            View my plan
            <ArrowRight aria-hidden className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
      </div>
    </PalWorkspace>
  );
}
