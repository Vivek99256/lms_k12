'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, X } from 'lucide-react';
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
import { H5pPageHeader, InlineBanner, MissingContextNotice } from '../../components/shared';
import {
  PlayerSkeleton,
  PrimaryAction,
  ProgressRail,
  ResultScreen,
  RetryAction,
  SecondaryAction,
  StartScreen,
  StreakBadge,
  Verdict,
  deriveAchievements,
  encouragement,
} from '../../components/game';

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

  /**
   * The run of correct answers, and the longest run this attempt.
   *
   * Held in state rather than derived from `attempt.answers`, because the
   * answers are indexed by their position in the pool while a streak is about
   * the order they were ASKED in. Deriving it would mean re-walking the paper
   * on every render to recover an ordering the commit already knew.
   */
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  /** How many attempts have been finished, for the "passed first time" badge. */
  const [attemptCount, setAttemptCount] = useState(0);

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
      setAttemptCount((n) => n + 1);

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
    setStreak(0);
    setBestStreak(0);
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

    const run = correct ? streak + 1 : 0;
    setStreak(run);
    if (run > bestStreak) setBestStreak(run);

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
        <div className="h5p-surface p-8 text-center">
          <p className="text-sm text-[color:var(--h5p-ink-muted)]">This activity has no statements yet.</p>
        </div>
      );
    }

    // Finished.
    if (attempt && attempt.finishedAt !== null && result) {
      const message = trueFalseFeedback(result.percentage, item.feedback_bands);

      return (
        <ResultScreen
          score={result.score}
          maxScore={result.maxScore}
          percentage={result.percentage}
          passed={result.passed}
          passLabel={`Pass mark is ${item.pass_percentage}%`}
          summary={
            <>
              {result.correctCount} of {result.questionCount} correct
              {result.answeredCount < result.questionCount
                ? ` · ${result.questionCount - result.answeredCount} not answered`
                : ''}
            </>
          }
          message={message}
          facts={[
            { icon: 'gauge', label: 'Score', value: `${Math.round(result.percentage)}%` },
            ...(bestStreak >= 2
              ? [{ icon: 'zap' as const, label: 'Best run', value: `${bestStreak} in a row` }]
              : []),
          ]}
          achievements={deriveAchievements({
            percentage: result.percentage,
            passed: result.passed,
            bestStreak,
            firstTry: attemptCount <= 1,
          })}
          actions={
            <>
              {item.enable_retry ? (
                <RetryAction
                  onClick={retry}
                  label={
                    item.questions_to_ask > 0 && item.questions_to_ask < pool.length
                      ? 'Try a new set of statements'
                      : 'Try again'
                  }
                />
              ) : null}

              {item.enable_show_solution ? (
                <SecondaryAction onClick={() => setShowSolution((on) => !on)} ariaExpanded={showSolution}>
                  {showSolution ? 'Hide solution' : 'Show solution'}
                </SecondaryAction>
              ) : null}
            </>
          }
        >
          {showSolution ? <Solution attempt={attempt} /> : null}
        </ResultScreen>
      );
    }

    // In progress.
    if (attempt) {
      const entry = attempt.paper[attempt.index];
      const feedback = checked && selected !== null ? statementFeedback(entry.question, selected) : null;

      return (
        <div className="h5p-surface h5p-stage p-5 sm:p-8">
          {item.show_progress ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium tabular-nums text-[color:var(--h5p-ink-muted)]">
                  Statement {attempt.index + 1} of {attempt.paper.length}
                </p>
                <StreakBadge streak={streak} best={bestStreak} />
              </div>
              <ProgressRail
                value={attempt.index}
                max={attempt.paper.length}
                label="Statements answered"
                className="mt-2"
              />
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

              // The state classes are mutually exclusive and resolved in
              // h5p.css. What the player decides is WHICH state this is.
              const state = checked
                ? isRight
                  ? 'is-correct'
                  : picked
                    ? 'is-wrong'
                    : 'is-dimmed'
                : picked
                  ? 'is-picked'
                  : '';

              return (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => pick(value)}
                  disabled={checked}
                  aria-pressed={picked}
                  className={`h5p-option h5p-tappable h5p-focusable h5p-target items-center justify-center py-5 text-base font-semibold ${state}`}
                >
                  {/* Marked by an icon as well as by colour — colour alone is
                      not an accessible signal. */}
                  {checked && isRight ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                  {checked && picked && !isRight ? <X className="h-4 w-4" aria-hidden="true" /> : null}
                  {value ? 'True' : 'False'}
                </button>
              );
            })}
          </div>

          {!checked && item.enable_check_button && !item.auto_check ? (
            <PrimaryAction onClick={check} disabled={selected === null} className="mt-4">
              Check
            </PrimaryAction>
          ) : null}

          {feedback ? (
            <div className="mt-5">
              <Verdict
                correct={feedback.correct}
                message={feedback.message || encouragement(feedback.correct, attempt.index)}
              />

              <PrimaryAction onClick={advance} className="mt-4" autoFocus>
                {attempt.index + 1 >= attempt.paper.length ? 'See your result' : 'Next statement'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </PrimaryAction>
            </div>
          ) : null}
        </div>
      );
    }

    // Start screen.
    const asked = item.questions_to_ask > 0 ? Math.min(item.questions_to_ask, pool.length) : pool.length;

    return (
      <StartScreen
        title={item.title}
        description={item.task_description}
        facts={[
          {
            icon: 'target',
            label: 'Statements',
            value: asked < pool.length ? `${asked} of ${pool.length}` : String(asked),
          },
          { icon: 'gauge', label: 'Pass mark', value: `${item.pass_percentage}%` },
        ]}
        onStart={start}
      />
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
          <PlayerSkeleton lines={2} label="Loading activity" />
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
    <Suspense fallback={<PlayerSkeleton lines={2} label="Loading activity" />}>
      <TrueFalsePlayerContent />
    </Suspense>
  );
}
