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
import { trueFalseApi, type H5pTrueFalse } from '../../data/h5p-content-types';
import {
  drawTrueFalsePaper,
  isCorrectAnswer,
  newAttemptSeed,
  scoreTrueFalseAttempt,
  statementFeedback,
  trueFalseFeedback,
  type DrawnQuestion,
  type TrueFalseAnswer,
  type TrueFalseAttemptResult,
} from '@/lib/h5p/true-false';
import { H5pPageHeader, InlineBanner, LoadingState, MissingContextNotice } from '../../components/shared';

/**
 * True/false — player.
 *
 * THE PAPER IS DRAWN ONCE PER ATTEMPT, from a seed held in state, and the seed
 * is what makes a reload mid-attempt return the same ten statements rather
 * than a fresh ten. Re-drawing on render would change the questions under the
 * learner on every re-render, which on a pool type looks exactly like the
 * activity losing their answers.
 *
 * TWO WAYS TO ANSWER, AND THEY ARE A REAL PEDAGOGICAL CHOICE, not a setting to
 * skim past:
 *
 *   - INSTANT (`auto_check`): the answer is marked the moment it is chosen.
 *     The learner commits, which is the point of a recap.
 *   - ON CHECK: True and False are a selection the learner can change until
 *     they press Check. Right for a considered question.
 *
 * `confirmCheck` is honoured for the second, because an author who turned it
 * on did so for an activity with no retry, where the press is final.
 *
 * WHY `answer === null` AND NOT `!answer`. A correct answer of `false` is
 * falsy. Treating it as "unanswered" would mark every false statement wrong
 * and silently halve the class's marks — the single most likely bug in this
 * type, and the reason `lib/h5p/true-false.ts` has a test named after it.
 */

interface Attempt {
  seed: number;
  paper: DrawnQuestion[];
  answers: TrueFalseAnswer[];
  index: number;
  startedAt: number;
  finishedAt: number | null;
}

function newAttempt(item: H5pTrueFalse): Attempt {
  const seed = newAttemptSeed();

  return {
    seed,
    paper: drawTrueFalsePaper(
      (item.questions ?? []).map((question) => ({
        id: question.id,
        question_text: question.question_text,
        correct_answer: Boolean(question.correct_answer),
        feedback_correct: question.feedback_correct,
        feedback_incorrect: question.feedback_incorrect,
        explanation: question.explanation,
        media_image: question.media_image,
        media_alt: question.media_alt,
      })),
      { randomize_questions: item.randomize_questions, questions_to_ask: item.questions_to_ask },
      seed
    ),
    answers: [],
    index: 0,
    startedAt: Date.now(),
    finishedAt: null,
  };
}

/** Statements are stored as HTML, because H5P stores them so. */
function Html({ html, className }: { html: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function TrueFalsePlayerContent() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const searchParams = useSearchParams();
  const ctx: H5pContext = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );
  const contextQuery = h5pContextQuery(ctx);

  const [item, setItem] = useState<H5pTrueFalse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  /** What the learner has picked but not yet committed. Only used on-check. */
  const [selected, setSelected] = useState<boolean | null>(null);
  /** True once this statement is marked, whichever way it got there. */
  const [checked, setChecked] = useState(false);
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

    trueFalseApi
      .get(id, ctx)
      .then((data) => {
        if (!cancelled) setItem(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load this activity');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ctx, id]);

  // --- scoring -------------------------------------------------------------

  const result: TrueFalseAttemptResult | null =
    item && attempt
      ? scoreTrueFalseAttempt(attempt.paper, attempt.answers, {
          points_per_question: item.points_per_question,
          pass_percentage: item.pass_percentage,
        })
      : null;

  const finish = useCallback(
    (finished: Attempt) => {
      if (!item) return;

      const done = { ...finished, finishedAt: Date.now() };
      setAttempt(done);

      const scored = scoreTrueFalseAttempt(done.paper, done.answers, {
        points_per_question: item.points_per_question,
        pass_percentage: item.pass_percentage,
      });

      void postH5pXapiStatement({
        objectId: `true_false:${item.id}`,
        verb: 'completed',
        ctx,
        success: scored.passed,
        response: `${scored.score}/${scored.maxScore}`,
        durationSeconds: (done.finishedAt - done.startedAt) / 1000,
      });
    },
    [item, ctx]
  );

  // --- actions -------------------------------------------------------------

  const start = () => {
    if (!item) return;
    setAttempt(newAttempt(item));
    setSelected(null);
    setChecked(false);
    setShowSolution(false);
  };

  /** Record an answer and mark it. Shared by both answering modes. */
  const commit = (from: Attempt, given: boolean) => {
    if (!item) return;

    const entry = from.paper[from.index];
    const correct = isCorrectAnswer(entry.question, given);

    const answers = [...from.answers];
    answers[entry.index] = given;

    setAttempt({ ...from, answers });
    setSelected(given);
    setChecked(true);

    void postH5pXapiStatement({
      objectId: `true_false:${item.id}`,
      verb: 'answered',
      ctx,
      success: correct,
      response: given ? 'true' : 'false',
    });
  };

  const pick = (given: boolean) => {
    if (!item || !attempt || attempt.finishedAt !== null || checked) return;

    if (item.auto_check) {
      commit(attempt, given);
    } else {
      // Not committed yet — the learner may change their mind until Check.
      setSelected(given);
    }
  };

  const check = () => {
    if (!item || !attempt || selected === null || checked) return;

    if (item.confirm_check_dialog && !window.confirm('Check this answer? You will not be able to change it.')) {
      return;
    }

    commit(attempt, selected);
  };

  const advance = () => {
    if (!attempt) return;

    setSelected(null);
    setChecked(false);

    const next = { ...attempt, index: attempt.index + 1 };
    if (next.index >= next.paper.length) {
      finish(next);
    } else {
      setAttempt(next);
    }
  };

  const retry = () => {
    if (!item) return;
    if (item.confirm_retry_dialog && !window.confirm('Start again? Your answers will be cleared.')) return;
    start();
  };

  // --- render --------------------------------------------------------------

  const body = () => {
    if (!item) return null;

    const pool = item.questions ?? [];

    if (pool.length === 0) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600">This activity has no statements yet.</p>
        </div>
      );
    }

    // Finished.
    if (attempt && attempt.finishedAt !== null && result) {
      const message = trueFalseFeedback(result.percentage, item.feedback_bands);

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
              {result.passed ? 'Passed' : `Pass mark is ${item.pass_percentage}%`}
            </span>

            {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {item.enable_retry ? (
                <button
                  type="button"
                  onClick={retry}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {item.questions_to_ask > 0 && item.questions_to_ask < pool.length
                    ? 'Try a new set of statements'
                    : 'Try again'}
                </button>
              ) : null}

              {item.enable_show_solution ? (
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
      const feedback = checked && selected !== null ? statementFeedback(entry.question, selected) : null;

      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          {item.show_progress ? (
            <>
              <p className="text-xs tabular-nums text-slate-500">
                Statement {attempt.index + 1} of {attempt.paper.length}
              </p>
              <div
                className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={attempt.index}
                aria-valuemin={0}
                aria-valuemax={attempt.paper.length}
                aria-label="Statements answered"
              >
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${(attempt.index / attempt.paper.length) * 100}%` }}
                />
              </div>
            </>
          ) : null}

          {entry.question.media_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.question.media_image}
              alt={entry.question.media_alt ?? ''}
              className="mt-5 max-h-64 w-full rounded-xl object-contain ring-1 ring-slate-200"
            />
          ) : null}

          <Html
            html={entry.question.question_text}
            className="mt-5 block text-lg font-semibold leading-snug text-slate-900"
          />

          <div className="mt-5 grid grid-cols-2 gap-3" role="group" aria-label="True or false">
            {[true, false].map((value) => {
              const picked = selected === value;
              const isRight = entry.question.correct_answer === value;

              return (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => pick(value)}
                  disabled={checked}
                  aria-pressed={picked}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-4 text-sm font-semibold transition disabled:cursor-default ${
                    checked && isRight
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : checked && picked
                        ? 'border-red-300 bg-red-50 text-red-900'
                        : picked
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-800'
                          : checked
                            ? 'border-slate-200 bg-white text-slate-400'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50'
                  }`}
                >
                  {/* Marked by an icon as well as by colour — colour alone is
                      not an accessible signal. */}
                  {checked && isRight ? <Check className="h-4 w-4" /> : null}
                  {checked && picked && !isRight ? <X className="h-4 w-4" /> : null}
                  {value ? 'True' : 'False'}
                </button>
              );
            })}
          </div>

          {!checked && item.enable_check_button && !item.auto_check ? (
            <button
              type="button"
              onClick={check}
              disabled={selected === null}
              className="mt-4 inline-flex items-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
            >
              Check
            </button>
          ) : null}

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

              <button
                type="button"
                onClick={advance}
                autoFocus
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
              >
                {attempt.index + 1 >= attempt.paper.length ? 'See your result' : 'Next statement'}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    // Start screen.
    const asked = item.questions_to_ask > 0 ? Math.min(item.questions_to_ask, pool.length) : pool.length;

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
        {item.task_description ? (
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{item.task_description}</p>
        ) : null}

        <p className="mt-4 text-xs text-slate-500">
          {asked} statement{asked === 1 ? '' : 's'}
          {asked < pool.length ? ` drawn from ${pool.length}` : ''}
          {` · pass mark ${item.pass_percentage}%`}
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
          title={item?.title || 'True or false'}
          description={item?.description || undefined}
          ctx={ctx}
          backHref={`/h5p/h5p_true_false?${contextQuery}`}
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : loading ? (
          <LoadingState label="Loading activity…" />
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
 * The solution list, in the order this attempt asked them.
 *
 * Only the statements that were DRAWN appear. Showing the whole pool would
 * hand a learner the answers to questions they have not been asked yet, which
 * on a pool type is the difference between a solution and an answer key.
 */
function Solution({ attempt }: { attempt: Attempt }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900">Solution</h2>

      <ol className="mt-3 space-y-3">
        {attempt.paper.map((entry) => {
          const given = attempt.answers[entry.index] ?? null;
          const correct = isCorrectAnswer(entry.question, given);

          return (
            <li key={entry.question.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-xs font-semibold tabular-nums text-slate-400">
                  {entry.index + 1}
                </span>
                <Html
                  html={entry.question.question_text}
                  className="min-w-0 flex-1 text-sm font-medium text-slate-900"
                />
              </div>

              <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
                <Check className="h-3.5 w-3.5 shrink-0" />
                {entry.question.correct_answer ? 'True' : 'False'}
              </p>

              {given !== null && !correct ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-red-600">
                  <X className="h-3.5 w-3.5 shrink-0" />
                  You answered {given ? 'true' : 'false'}
                </p>
              ) : null}

              {given === null ? <p className="mt-1 text-xs text-slate-500">You did not answer this one.</p> : null}

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

export default function TrueFalsePlayerPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading activity…" />}>
      <TrueFalsePlayerContent />
    </Suspense>
  );
}
