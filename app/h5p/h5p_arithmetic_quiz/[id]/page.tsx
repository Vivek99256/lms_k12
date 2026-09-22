'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Clock } from 'lucide-react';
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
import { H5pPageHeader, InlineBanner, MissingContextNotice } from '../../components/shared';
import {
  PlayerSkeleton,
  PrimaryAction,
  ProgressRail,
  ResultScreen,
  RetryAction,
  StartScreen,
  StreakBadge,
  Verdict,
  deriveAchievements,
  encouragement,
} from '../../components/game';
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

  /**
   * The run of correct answers, and the best run this attempt.
   *
   * A fluency drill is the one type where a streak is not decoration: it is
   * the thing the drill is actually training, and a learner watching it climb
   * answers faster than one watching a question counter.
   */
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  /**
   * The previous finished attempt's percentage, and whether the one just
   * finished beat it.
   *
   * `improved` is worked out in `finish` and stored, rather than compared on
   * the result screen: by then `lastPercentage` has already been overwritten
   * with this attempt's score, and the comparison would be against itself.
   */
  const [lastPercentage, setLastPercentage] = useState<number | null>(null);
  const [improved, setImproved] = useState(false);
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

      setImproved(lastPercentage !== null && scored.percentage > lastPercentage);
      setLastPercentage(scored.percentage);

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
    [quiz, ctx, lastPercentage]
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
    setStreak(0);
    setBestStreak(0);
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

    const run = correct ? streak + 1 : 0;
    setStreak(run);
    if (run > bestStreak) setBestStreak(run);

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
        <ResultScreen
          score={result.score}
          maxScore={result.maxScore}
          percentage={result.percentage}
          passed={result.passed}
          passLabel={`Pass mark is ${quiz.pass_percentage}%`}
          summary={
            <>
              {result.correctCount} of {result.questionCount} correct
              {result.answeredCount < result.questionCount
                ? ` · ${result.questionCount - result.answeredCount} not reached`
                : ''}
            </>
          }
          message={message}
          facts={[
            { icon: 'gauge', label: 'Score', value: `${Math.round(result.percentage)}%` },
            ...(quiz.enable_timer
              ? [{ icon: 'timer' as const, label: 'Time', value: formatClock(elapsedSeconds) }]
              : []),
            ...(bestStreak >= 2
              ? [{ icon: 'zap' as const, label: 'Best run', value: `${bestStreak} in a row` }]
              : []),
          ]}
          achievements={deriveAchievements({
            percentage: result.percentage,
            passed: result.passed,
            bestStreak,
            improvedOnLast: improved,
            firstTry: attemptCount <= 1,
          })}
          actions={
            canRetry ? (
              <RetryAction onClick={start} label="Try a new set of questions" />
            ) : attemptsExhausted ? (
              <p className="text-xs text-[color:var(--h5p-ink-faint)]">
                You have used all {quiz.max_attempts} attempts on this quiz.
              </p>
            ) : null
          }
        />
      );
    }

    // In progress.
    if (attempt) {
      const question = attempt.questions[attempt.index];
      return (
        <div className="h5p-surface h5p-stage p-6 sm:p-10">
          <div className="flex items-center justify-between gap-3 text-xs text-[color:var(--h5p-ink-muted)]">
            <span className="font-medium tabular-nums">
              Question {attempt.index + 1} of {attempt.questions.length}
            </span>
            {quiz.enable_timer ? (
              <span
                className="inline-flex items-center gap-1.5 font-medium tabular-nums"
                // The clock turns urgent in the last ten seconds. It is also
                // announced by the verdict region, so the colour is a nudge
                // rather than the only warning.
                style={
                  remaining !== null && remaining <= 10
                    ? { color: 'var(--h5p-danger)', fontWeight: 700 }
                    : undefined
                }
              >
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {remaining !== null ? formatClock(remaining) : formatClock(elapsedSeconds)}
              </span>
            ) : null}
          </div>

          <ProgressRail
            value={attempt.index}
            max={attempt.questions.length}
            label="Questions answered"
            className="mt-2"
          />

          <div className="mt-3 flex justify-center">
            <StreakBadge streak={streak} best={bestStreak} />
          </div>

          <form
            className="mt-6 flex flex-col items-center gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitAnswer();
            }}
          >
            {/* Keyed on the question so each new prompt animates in. Without
                the key React reuses the node, the text swaps silently, and a
                drill that changes nothing visible reads as a frozen page. */}
            <p
              key={attempt.index}
              className="h5p-enter-scale font-mono text-4xl tabular-nums text-[color:var(--h5p-ink)] sm:text-5xl"
            >
              {question.prompt} =
            </p>

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

            <PrimaryAction type="submit" disabled={entry.trim() === ''}>
              Answer
            </PrimaryAction>
          </form>

          {lastCorrect !== null ? (
            // The previous question's result, announced politely so a screen
            // reader reads it without interrupting the new question.
            <div className="mt-6 flex justify-center">
              <Verdict correct={lastCorrect} message={encouragement(lastCorrect, attempt.index)} />
            </div>
          ) : null}
        </div>
      );
    }

    // Start screen.
    return (
      <StartScreen
        title={quiz.title}
        description={quiz.intro_text}
        actionLabel="Start quiz"
        facts={[
          { icon: 'target', label: 'Questions', value: quiz.max_questions },
          ...(quiz.time_limit_seconds > 0
            ? [{ icon: 'timer' as const, label: 'Time limit', value: formatClock(quiz.time_limit_seconds) }]
            : []),
          { icon: 'gauge', label: 'Pass mark', value: `${quiz.pass_percentage}%` },
        ]}
        onStart={start}
        footer={
          lastPercentage !== null ? (
            <p className="text-xs text-[color:var(--h5p-ink-faint)]">
              Your last attempt: {Math.round(lastPercentage)}%. Beat it.
            </p>
          ) : null
        }
      />
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
          <PlayerSkeleton lines={1} label="Loading quiz" />
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
    <Suspense fallback={<PlayerSkeleton lines={1} label="Loading quiz" />}>
      <ArithmeticQuizPlayerContent />
    </Suspense>
  );
}
