'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, RotateCcw, X } from 'lucide-react';
import {
  h5pContextQuery,
  hasH5pContext,
  postH5pXapiStatement,
  readH5pContext,
  type H5pContext,
} from '../../data/h5p';
import { singleChoiceSetApi, type H5pSingleChoiceSet } from '../../data/h5p-content-types';
import {
  answerFeedback,
  correctOption,
  isCorrectChoice,
  newAttemptSeed,
  plainText,
  prepareSingleChoicePaper,
  scoreSingleChoiceAttempt,
  singleChoiceFeedback,
  type PreparedQuestion,
  type SingleChoiceAnswer,
  type SingleChoiceAttemptResult,
} from '@/lib/h5p/single-choice-set';
import { H5pPageHeader, InlineBanner, LoadingState, MissingContextNotice } from '../../components/shared';

/**
 * Single choice set — player.
 *
 * ONE QUESTION AT A TIME, AND THE ANSWER IS THE SUBMIT. That rhythm is the
 * type: choosing an option marks it immediately, shows the feedback, and moves
 * on. A page of questions with a submit button at the bottom is a Multiple
 * Choice activity, which this ERP already has.
 *
 * THE PAPER IS BUILT ONCE PER ATTEMPT, from a seed held in state. Re-deriving
 * it on render would reshuffle the options under the learner's cursor on every
 * re-render, which is the single most obvious way to break a shuffled type —
 * and it would break it in a way that looks like the learner misclicking.
 *
 * AUTO-CONTINUE IS AN EFFECT, NOT A TIMER HANDLE PASSED AROUND. The effect
 * owns the timeout and cancels it on cleanup, so the timer cannot outlive the
 * question it belongs to: advancing (by the learner or by the timer) clears
 * `chosen`, the effect re-runs, and the pending timeout is cancelled by React
 * before the new one is set. Two advances firing — the learner's press and the
 * timer — would skip a question, and a learner who skipped a question they
 * never saw has no way to tell that is what happened.
 *
 * EVERY ANSWER EMITS AN xAPI `answered` STATEMENT AS IT HAPPENS, so an
 * abandoned attempt still produces evidence of the questions that were
 * reached. The `completed` statement carries the score and the duration.
 */

interface Attempt {
  seed: number;
  paper: PreparedQuestion[];
  answers: SingleChoiceAnswer[];
  index: number;
  startedAt: number;
  finishedAt: number | null;
}

function newAttempt(set: H5pSingleChoiceSet): Attempt {
  const seed = newAttemptSeed();

  return {
    seed,
    paper: prepareSingleChoicePaper(
      (set.questions ?? []).map((question) => ({
        id: question.id,
        question_text: question.question_text,
        feedback_correct: question.feedback_correct,
        feedback_incorrect: question.feedback_incorrect,
        explanation: question.explanation,
        options: (question.options ?? []).map((option) => ({
          id: option.id,
          option_text: option.option_text,
          is_correct: Boolean(option.is_correct),
          feedback: option.feedback,
        })),
      })),
      { randomize_questions: set.randomize_questions, randomize_answers: set.randomize_answers },
      seed
    ),
    answers: [],
    index: 0,
    startedAt: Date.now(),
    finishedAt: null,
  };
}

/** Question and option text are stored as HTML, because H5P stores them so. */
function Html({ html, className }: { html: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function SingleChoiceSetPlayerContent() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const searchParams = useSearchParams();
  const ctx: H5pContext = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );
  const contextQuery = h5pContextQuery(ctx);

  const [set, setSet] = useState<H5pSingleChoiceSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [showSolution, setShowSolution] = useState(false);

  // --- load ----------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    if (!hasH5pContext(ctx) || !id) {
      queueMicrotask(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    singleChoiceSetApi
      .get(id, ctx)
      .then((data) => {
        if (!cancelled) setSet(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load this set');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ctx, id]);

  // --- scoring -------------------------------------------------------------

  const result: SingleChoiceAttemptResult | null =
    set && attempt
      ? scoreSingleChoiceAttempt(attempt.paper, attempt.answers, {
          points_per_question: set.points_per_question,
          pass_percentage: set.pass_percentage,
        })
      : null;

  const finish = useCallback(
    (finished: Attempt) => {
      if (!set) return;

      const done = { ...finished, finishedAt: Date.now() };
      setAttempt(done);

      const scored = scoreSingleChoiceAttempt(done.paper, done.answers, {
        points_per_question: set.points_per_question,
        pass_percentage: set.pass_percentage,
      });

      void postH5pXapiStatement({
        objectId: `single_choice_set:${set.id}`,
        verb: 'completed',
        ctx,
        success: scored.passed,
        response: `${scored.score}/${scored.maxScore}`,
        durationSeconds: (done.finishedAt - done.startedAt) / 1000,
      });
    },
    [set, ctx]
  );

  // --- actions -------------------------------------------------------------

  const start = () => {
    if (!set) return;
    setAttempt(newAttempt(set));
    setChosen(null);
    setShowSolution(false);
  };

  const advance = useCallback(
    (from: Attempt) => {
      // Clearing `chosen` is also what cancels a pending auto-advance: the
      // effect below re-runs and React runs its cleanup first.
      setChosen(null);

      const next = { ...from, index: from.index + 1 };
      if (next.index >= next.paper.length) {
        finish(next);
      } else {
        setAttempt(next);
      }
    },
    [finish]
  );

  /**
   * Auto-continue.
   *
   * Written as an effect rather than a `setTimeout` fired from the click
   * handler so the timeout has an owner with a cleanup: it cannot fire into an
   * unmounted tree, and it cannot fire for a question the learner has already
   * moved past.
   */
  useEffect(() => {
    if (!set || !set.auto_continue) return;
    if (!attempt || attempt.finishedAt !== null || chosen === null) return;

    const entry = attempt.paper[attempt.index];
    const correct = isCorrectChoice(entry.question, chosen);
    const pause = Math.max(0, correct ? set.timeout_correct_ms : set.timeout_wrong_ms);

    const timer = window.setTimeout(() => advance(attempt), pause);

    return () => window.clearTimeout(timer);
  }, [set, attempt, chosen, advance]);

  const choose = (optionId: number) => {
    if (!set || !attempt || attempt.finishedAt !== null || chosen !== null) return;

    const entry = attempt.paper[attempt.index];
    const correct = isCorrectChoice(entry.question, optionId);

    const answers = [...attempt.answers];
    answers[entry.index] = optionId;

    const answered = { ...attempt, answers };
    setAttempt(answered);
    setChosen(optionId);

    const option = entry.options.find((o) => o.id === optionId);
    void postH5pXapiStatement({
      objectId: `single_choice_set:${set.id}`,
      verb: 'answered',
      ctx,
      success: correct,
      response: plainText(option?.option_text ?? ''),
    });

    // The auto-advance, if there is one, is set up by the effect above once
    // `chosen` lands — not from here, so the timeout always has a cleanup.
  };

  // --- render --------------------------------------------------------------

  const body = () => {
    if (!set) return null;

    const questions = set.questions ?? [];

    if (questions.length === 0) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600">This set has no questions yet.</p>
        </div>
      );
    }

    // Finished.
    if (attempt && attempt.finishedAt !== null && result) {
      const message = singleChoiceFeedback(result.percentage, set.feedback_bands);

      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Finished</p>
            <p className="mt-2 text-4xl font-semibold tabular-nums text-slate-900">
              {result.score}
              <span className="text-2xl text-slate-400"> / {result.maxScore}</span>
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {result.correctCount} of {result.questionCount} correct
              {result.answeredCount < result.questionCount
                ? ` · ${result.questionCount - result.answeredCount} not answered`
                : ''}
            </p>

            <span
              className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                result.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {result.passed ? 'Passed' : `Pass mark is ${set.pass_percentage}%`}
            </span>

            {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {set.enable_retry ? (
                <button
                  type="button"
                  onClick={start}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Try again
                </button>
              ) : null}

              {set.enable_show_solution ? (
                <button
                  type="button"
                  onClick={() => setShowSolution((on) => !on)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  aria-expanded={showSolution}
                >
                  {showSolution ? 'Hide solution' : 'Show solution'}
                </button>
              ) : null}
            </div>
          </div>

          {showSolution ? <Solution attempt={attempt} /> : null}
        </div>
      );
    }

    // In progress.
    if (attempt) {
      const entry = attempt.paper[attempt.index];
      const feedback = chosen !== null ? answerFeedback(entry.question, chosen) : null;

      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          {set.show_progress ? (
            <>
              <p className="text-xs tabular-nums text-slate-500">
                Question {attempt.index + 1} of {attempt.paper.length}
              </p>
              <div
                className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={attempt.index}
                aria-valuemin={0}
                aria-valuemax={attempt.paper.length}
                aria-label="Questions answered"
              >
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${(attempt.index / attempt.paper.length) * 100}%` }}
                />
              </div>
            </>
          ) : null}

          <Html
            html={entry.question.question_text}
            className="mt-5 block text-lg font-semibold leading-snug text-slate-900"
          />

          <div className="mt-5 space-y-2" role="group" aria-label="Answers">
            {entry.options.map((option) => {
              const picked = chosen === option.id;
              const reveal = chosen !== null;
              const isRight = option.is_correct;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => choose(option.id)}
                  disabled={reveal}
                  className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition disabled:cursor-default ${
                    reveal && isRight
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : picked
                        ? 'border-red-300 bg-red-50 text-red-900'
                        : reveal
                          ? 'border-slate-200 bg-white text-slate-500'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/50'
                  }`}
                >
                  <span className="mt-0.5 h-4 w-4 shrink-0">
                    {/* Right and wrong are marked by an icon as well as by
                        colour — colour alone is not an accessible signal. */}
                    {reveal && isRight ? <Check className="h-4 w-4" /> : null}
                    {reveal && picked && !isRight ? <X className="h-4 w-4" /> : null}
                  </span>
                  <Html html={option.option_text} className="min-w-0 flex-1" />
                </button>
              );
            })}
          </div>

          {feedback ? (
            <div aria-live="polite" className="mt-5">
              <p
                className={`flex items-center gap-1.5 text-sm font-medium ${
                  feedback.correct ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {feedback.correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                {feedback.correct ? 'Correct' : 'Not quite'}
              </p>
              {feedback.message ? <p className="mt-1 text-sm text-slate-700">{feedback.message}</p> : null}

              {!set.auto_continue ? (
                <button
                  type="button"
                  onClick={() => advance(attempt)}
                  autoFocus
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  {attempt.index + 1 >= attempt.paper.length ? 'See your result' : 'Next question'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    }

    // Start screen.
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{set.title}</h2>
        {set.task_description ? (
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{set.task_description}</p>
        ) : null}

        <p className="mt-4 text-xs text-slate-500">
          {questions.length} question{questions.length === 1 ? '' : 's'}
          {` · pass mark ${set.pass_percentage}%`}
        </p>

        <button
          type="button"
          onClick={start}
          className="mt-6 inline-flex items-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Start
        </button>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <H5pPageHeader
          title={set?.title || 'Single choice set'}
          description={set?.description || undefined}
          ctx={ctx}
          backHref={`/h5p/h5p_single_choice_set?${contextQuery}`}
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : loading ? (
          <LoadingState label="Loading set…" />
        ) : error ? (
          <InlineBanner kind="error" message={error} />
        ) : (
          body()
        )}
      </div>
    </div>
  );
}

/**
 * The solution list, in the order the learner was asked.
 *
 * Shows what they picked beside what was right, because "the answer was B" is
 * far less useful than "you picked C, and here is why B". The explanation is
 * shown whichever way they answered — it explains the question, not the
 * attempt.
 */
function Solution({ attempt }: { attempt: Attempt }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900">Solution</h2>

      <ol className="mt-3 space-y-3">
        {attempt.paper.map((entry) => {
          const given = attempt.answers[entry.index] ?? null;
          const picked = entry.options.find((option) => option.id === given) ?? null;
          const right = correctOption(entry.question);
          const correct = picked?.is_correct === true;

          return (
            <li key={entry.question.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-xs font-semibold tabular-nums text-slate-400">
                  {entry.index + 1}
                </span>
                <Html html={entry.question.question_text} className="min-w-0 flex-1 text-sm font-medium text-slate-900" />
              </div>

              <p className="mt-2 flex items-start gap-1.5 text-xs text-emerald-700">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <Html html={right?.option_text ?? '—'} className="min-w-0" />
              </p>

              {picked && !correct ? (
                <p className="mt-1 flex items-start gap-1.5 text-xs text-red-600">
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0">
                    You picked <Html html={picked.option_text} />
                  </span>
                </p>
              ) : null}

              {!picked ? <p className="mt-1 text-xs text-slate-500">You did not answer this one.</p> : null}

              {entry.question.explanation ? (
                <p className="mt-2 text-xs text-slate-600">{entry.question.explanation}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function SingleChoiceSetPlayerPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading set…" />}>
      <SingleChoiceSetPlayerContent />
    </Suspense>
  );
}
