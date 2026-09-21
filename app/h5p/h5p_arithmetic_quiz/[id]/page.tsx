'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Check, Clock, RotateCcw, X } from 'lucide-react';
import {
  h5pContextQuery,
  hasH5pContext,
  postH5pXapiStatement,
  readH5pContext,
  type H5pContext,
} from '../../data/h5p';
import { arithmeticQuizApi, type H5pArithmeticQuiz } from '../../data/h5p-content-types';
import {
  arithmeticFeedback,
  generateArithmeticPaper,
  newQuizSeed,
  scoreArithmeticAttempt,
  type ArithmeticAttemptResult,
  type ArithmeticQuestion,
} from '@/lib/h5p/arithmetic-quiz';
import { H5pPageHeader, InlineBanner, LoadingState, MissingContextNotice } from '../../components/shared';
import { Input } from '@/components/ui/input';

/**
 * Arithmetic quiz — player.
 *
 * ONE QUESTION AT A TIME, AND THE ANSWER SUBMITS ON ENTER. A fluency drill is
 * measured in seconds per question; a form of twenty boxes with a submit
 * button at the bottom measures something else entirely.
 *
 * THE PAPER IS DRAWN ONCE PER ATTEMPT, from a seed held in state. Re-deriving
 * it on every render would give the learner a different question each time
 * React re-rendered, which is the single most obvious way to break this type.
 *
 * THE TIMER, WHEN THERE IS ONE, ENDS THE ATTEMPT AND SCORES WHAT WAS DONE.
 * Unanswered questions count against the total — see `scoreArithmeticAttempt`.
 * A timed-out attempt reporting full marks on the part that was reached would
 * be worse than useless in a report.
 */

interface Attempt {
  seed: number;
  questions: ArithmeticQuestion[];
  answers: Array<number | null>;
  index: number;
  startedAt: number;
  finishedAt: number | null;
}

function newAttempt(quiz: H5pArithmeticQuiz): Attempt {
  const seed = newQuizSeed();
  return {
    seed,
    questions: generateArithmeticPaper(
      {
        operations: quiz.operations ?? ['addition'],
        difficulty_level: quiz.difficulty_level,
        max_questions: quiz.max_questions,
      },
      seed
    ),
    answers: [],
    index: 0,
    startedAt: Date.now(),
    finishedAt: null,
  };
}

function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function ArithmeticQuizPlayerContent() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const searchParams = useSearchParams();
  const ctx: H5pContext = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );
  const contextQuery = h5pContextQuery(ctx);

  const [quiz, setQuiz] = useState<H5pArithmeticQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [entry, setEntry] = useState('');
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  // The live clock. Written by the interval rather than seeded at render:
  // Date.now() during render is impure and drifts with every re-render,
  // which is exactly the number that must not reach a reported duration.
  const [now, setNow] = useState(0);
  const answerRef = useRef<HTMLInputElement>(null);

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

    arithmeticQuizApi
      .get(id, ctx)
      .then((data) => {
        if (!cancelled) setQuiz(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load quiz');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ctx, id]);

  // --- the clock -----------------------------------------------------------

  // `now` is 0 until the first tick, so the clock reads from the attempt
  // start rather than from 1970 for the first half second.
  const elapsedSeconds = attempt
    ? ((attempt.finishedAt ?? Math.max(now, attempt.startedAt)) - attempt.startedAt) / 1000
    : 0;
  const limit = quiz?.time_limit_seconds ?? 0;
  const remaining = limit > 0 ? Math.max(0, limit - elapsedSeconds) : null;

  // --- finishing -----------------------------------------------------------

  const result: ArithmeticAttemptResult | null =
    quiz && attempt
      ? scoreArithmeticAttempt(attempt.questions, attempt.answers, {
          points_per_question: quiz.points_per_question,
          pass_percentage: quiz.pass_percentage,
        })
      : null;

  const finish = useCallback(
    (finished: Attempt) => {
      if (!quiz) return;
      const done = { ...finished, finishedAt: Date.now() };
      setAttempt(done);
      setAttemptCount((n) => n + 1);

      const scored = scoreArithmeticAttempt(done.questions, done.answers, {
        points_per_question: quiz.points_per_question,
        pass_percentage: quiz.pass_percentage,
      });

      // The completion statement. `answered` statements are sent per question
      // as they are answered, so a partial attempt still produces evidence.
      void postH5pXapiStatement({
        objectId: `arithmetic_quiz:${quiz.id}`,
        verb: 'completed',
        ctx,
        success: scored.passed,
        response: `${scored.score}/${scored.maxScore}`,
        durationSeconds: (done.finishedAt - done.startedAt) / 1000,
      });
    },
    [quiz, ctx]
  );

  // One interval drives both the displayed clock and the time limit.
  // Enforcing the limit from a separate effect reacting to derived state
  // would be a setState inside an effect body; here it is a callback from
  // an external system, which is what an effect is for.
  useEffect(() => {
    if (!attempt || attempt.finishedAt !== null) return;

    const tick = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (limit > 0 && at - attempt.startedAt >= limit * 1000) finish(attempt);
    }, 500);

    return () => window.clearInterval(tick);
  }, [attempt, limit, finish]);


  // --- actions -------------------------------------------------------------

  const start = () => {
    if (!quiz) return;
    setAttempt(newAttempt(quiz));
    setEntry('');
    setLastCorrect(null);
    setNow(Date.now());
    queueMicrotask(() => answerRef.current?.focus());
  };

  const submitAnswer = () => {
    if (!quiz || !attempt || attempt.finishedAt !== null) return;

    const trimmed = entry.trim();
    if (trimmed === '') return;

    const given = Number(trimmed);
    if (!Number.isFinite(given)) return;

    const question = attempt.questions[attempt.index];
    const correct = given === question.answer;

    const answers = [...attempt.answers];
    answers[attempt.index] = given;

    void postH5pXapiStatement({
      objectId: `arithmetic_quiz:${quiz.id}`,
      verb: 'answered',
      ctx,
      success: correct,
      response: `${question.prompt} = ${given}`,
    });

    setLastCorrect(correct);
    setEntry('');

    const next = { ...attempt, answers, index: attempt.index + 1 };
    if (next.index >= next.questions.length) {
      finish(next);
    } else {
      setAttempt(next);
      queueMicrotask(() => answerRef.current?.focus());
    }
  };

  // --- render --------------------------------------------------------------

  const attemptsExhausted =
    quiz !== null && quiz.max_attempts > 0 && attemptCount >= quiz.max_attempts;
  const canRetry = quiz !== null && quiz.enable_retry && !attemptsExhausted;

  const body = () => {
    if (!quiz) return null;

    // Finished.
    if (attempt && attempt.finishedAt !== null && result) {
      const message = arithmeticFeedback(result.percentage, quiz.feedback_bands);
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Finished</p>
          <p className="mt-2 text-4xl font-semibold tabular-nums text-slate-900">
            {result.score}
            <span className="text-2xl text-slate-400"> / {result.maxScore}</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {result.correctCount} of {result.questionCount} correct
            {result.answeredCount < result.questionCount
              ? ` · ${result.questionCount - result.answeredCount} not reached`
              : ''}
            {quiz.enable_timer ? ` · ${formatClock(elapsedSeconds)}` : ''}
          </p>

          <span
            className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              result.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {result.passed ? 'Passed' : `Pass mark is ${quiz.pass_percentage}%`}
          </span>

          {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}

          {canRetry ? (
            <button
              type="button"
              onClick={start}
              className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Try a new set of questions
            </button>
          ) : attemptsExhausted ? (
            <p className="mt-6 text-xs text-slate-500">
              You have used all {quiz.max_attempts} attempts on this quiz.
            </p>
          ) : null}
        </div>
      );
    }

    // In progress.
    if (attempt) {
      const question = attempt.questions[attempt.index];
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="tabular-nums">
              Question {attempt.index + 1} of {attempt.questions.length}
            </span>
            {quiz.enable_timer ? (
              <span
                className={`inline-flex items-center gap-1.5 tabular-nums ${
                  remaining !== null && remaining <= 10 ? 'font-semibold text-red-600' : ''
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                {remaining !== null ? formatClock(remaining) : formatClock(elapsedSeconds)}
              </span>
            ) : null}
          </div>

          <div
            className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={attempt.index}
            aria-valuemin={0}
            aria-valuemax={attempt.questions.length}
            aria-label="Questions answered"
          >
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${(attempt.index / attempt.questions.length) * 100}%` }}
            />
          </div>

          <form
            className="mt-8 flex flex-col items-center gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitAnswer();
            }}
          >
            <p className="font-mono text-4xl tabular-nums text-slate-900 sm:text-5xl">{question.prompt} =</p>

            <label className="sr-only" htmlFor="arithmetic-answer">
              Your answer to {question.prompt}
            </label>
            <Input
              id="arithmetic-answer"
              ref={answerRef}
              // `inputMode` gives a phone the number pad without `type=number`,
              // whose spinner arrows and scroll-to-change behaviour are wrong
              // for a drill answered from the keyboard.
              inputMode="numeric"
              autoComplete="off"
              value={entry}
              onChange={(e) => setEntry(e.target.value.replace(/[^0-9-]/g, ''))}
              className="h-14 w-40 text-center font-mono text-2xl tabular-nums"
              autoFocus
            />

            <button
              type="submit"
              disabled={entry.trim() === ''}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
            >
              Answer
            </button>
          </form>

          {lastCorrect !== null ? (
            // The previous question's result, announced politely so a screen
            // reader reads it without interrupting the new question.
            <p
              aria-live="polite"
              className={`mt-6 flex items-center justify-center gap-1.5 text-sm ${
                lastCorrect ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {lastCorrect ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              {lastCorrect ? 'Correct' : 'Not quite'}
            </p>
          ) : null}
        </div>
      );
    }

    // Start screen.
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{quiz.title}</h2>
        {quiz.intro_text ? <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{quiz.intro_text}</p> : null}

        <p className="mt-4 text-xs text-slate-500">
          {quiz.max_questions} questions
          {quiz.time_limit_seconds > 0 ? ` · ${formatClock(quiz.time_limit_seconds)}` : ''}
          {` · pass mark ${quiz.pass_percentage}%`}
        </p>

        <button
          type="button"
          onClick={start}
          className="mt-6 inline-flex items-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Start quiz
        </button>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <H5pPageHeader
          title={quiz?.title || 'Arithmetic quiz'}
          description={quiz?.description || undefined}
          ctx={ctx}
          backHref={`/h5p/h5p_arithmetic_quiz?${contextQuery}`}
        />

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : loading ? (
          <LoadingState label="Loading quiz…" />
        ) : error ? (
          <InlineBanner kind="error" message={error} />
        ) : (
          body()
        )}
      </div>
    </div>
  );
}

export default function ArithmeticQuizPlayerPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading quiz…" />}>
      <ArithmeticQuizPlayerContent />
    </Suspense>
  );
}
