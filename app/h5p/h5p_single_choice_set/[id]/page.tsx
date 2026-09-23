'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, X } from 'lucide-react';
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
import type { QuestionResult as PlayerQuestionResult } from '@/components/h5p/players/types';
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

/**
 * A row supplied by the caller instead of fetched by id.
 *
 * This is what makes the player embeddable. The route below still loads by id
 * from the URL, but a caller that already HAS the row -- the question bank
 * library, which builds one in memory from a bank question and never saves it
 * -- hands it over directly and skips the fetch entirely. `embedded` drops the
 * page header, because an embedding surface has its own.
 *
 * Nothing downstream of here knows the difference: the row shape is identical,
 * so scoring, feedback, solutions and xAPI behave exactly as they do for a
 * saved activity.
 */
export interface PreloadedSingleChoiceSet {
  item: H5pSingleChoiceSet;
  ctx: H5pContext;
  embedded?: boolean;
  /**
   * Fired once, where this player already reports completion over xAPI.
   *
   * It is how a module other than the H5P library uses this player: PAL needs
   * the score to advance its state machine and homework needs it to record an
   * attempt. The player still persists nothing itself -- the caller decides.
   */
  onResult?: (result: PlayerQuestionResult) => void;
}

function SingleChoiceSetPlayerContent({ preloaded }: { preloaded?: PreloadedSingleChoiceSet }) {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const searchParams = useSearchParams();
  const routeCtx: H5pContext = useMemo(
    () => readH5pContext(new URLSearchParams(searchParams?.toString())),
    [searchParams]
  );
  const ctx = preloaded?.ctx ?? routeCtx;
  const contextQuery = h5pContextQuery(ctx);

  const [fetchedSet, setFetchedSet] = useState<H5pSingleChoiceSet | null>(null);
  const [loading, setLoading] = useState(!preloaded);
  const [error, setError] = useState('');

  // Derived rather than copied into state: a preloaded row can change between
  // renders (the library previews a different question), and state seeded once
  // would keep showing the first one.
  const set = preloaded?.item ?? fetchedSet;

  // Seeded straight from `preloaded`, not the derived `set` above, and only
  // in the lazy initializer -- never from an effect. A caller that embeds
  // this player hands the row over synchronously (it is built in memory, not
  // fetched), so there is no async gap where `attempt` would need to catch up
  // after the first render; an effect that called `setAttempt` here would
  // just be a same-tick second render for no benefit. This is what skips this
  // type's own intro card for an embedded caller that already drew its own
  // "Question X of Y" chrome around it -- PAL, the question bank quiz, the
  // library's live preview. The standalone `/h5p/h5p_single_choice_set/[id]`
  // route (no `preloaded`) still starts on the intro, which is the one place
  // a library preview of "N questions, pass mark X%" is the point.
  const [attempt, setAttempt] = useState<Attempt | null>(() =>
    preloaded?.embedded && preloaded.item ? newAttempt(preloaded.item) : null
  );
  const [chosen, setChosen] = useState<number | null>(null);
  const [showSolution, setShowSolution] = useState(false);

  /**
   * The run of correct answers, and the longest run this attempt reached.
   *
   * State rather than a derivation of `attempt.answers`, because answers are
   * indexed by their position in the SET while a streak is about the order the
   * questions were ASKED in — an ordering the shuffle has already thrown away
   * by the time the answers array is read back.
   */
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);

  // --- load ----------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    // The caller supplied the row; there is nothing to fetch and no id to
    // fetch it by.
    if (preloaded) return;
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
        if (!cancelled) setFetchedSet(data);
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
  }, [ctx, id, preloaded]);

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
      setAttemptCount((n) => n + 1);

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

      preloaded?.onResult?.({
        questionId: Number(set.id),
        score: scored.score,
        maxScore: scored.maxScore,
        correct: scored.passed,
        durationSeconds: (done.finishedAt - done.startedAt) / 1000,
        response: `${scored.score}/${scored.maxScore}`,
        choiceIds: chosenSourceOptionIds(done),
      });
    },
    [set, ctx, preloaded]
  );

  // --- actions -------------------------------------------------------------

  const start = () => {
    if (!set) return;
    setAttempt(newAttempt(set));
    setChosen(null);
    setShowSolution(false);
    setStreak(0);
    setBestStreak(0);
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

    const run = correct ? streak + 1 : 0;
    setStreak(run);
    if (run > bestStreak) setBestStreak(run);

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
        <div className="h5p-surface p-8 text-center">
          <p className="text-sm text-[color:var(--h5p-ink-muted)]">This set has no questions yet.</p>
        </div>
      );
    }

    // Finished.
    if (attempt && attempt.finishedAt !== null && result) {
      const message = singleChoiceFeedback(result.percentage, set.feedback_bands);

      return (
        <ResultScreen
          score={result.score}
          maxScore={result.maxScore}
          percentage={result.percentage}
          passed={result.passed}
          passLabel={`Pass mark is ${set.pass_percentage}%`}
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
              {set.enable_retry ? <RetryAction onClick={start} /> : null}

              {set.enable_show_solution ? (
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
      const feedback = chosen !== null ? answerFeedback(entry.question, chosen) : null;

      return (
        // No `h5p-surface` (border, shadow, its own rounded card) when
        // embedded -- PAL and the question bank quiz already draw ONE
        // bordered container around the whole run; a bordered, shadowed box
        // for every question inside it would nest a card inside a card,
        // exactly the "small widget" look a full assessment layout is not
        // supposed to have. The standalone route keeps it, where this IS the
        // only surface on the page.
        <div
          className={`h5p-stage ${
            preloaded?.embedded ? 'p-4 sm:p-5' : 'h5p-surface p-5 sm:p-8'
          }`}
        >
          {/*
            An embedded caller (PAL, the question bank quiz) already draws its
            own overall "Question X of N" counter and progress bar around
            every question in its run. This set's own counter is almost
            always "Question 1 of 1" in that context, because a bank question
            is built as a one-item set -- a second, smaller, contradicting
            progress readout right next to the caller's real one. Shown only
            for a genuine standalone multi-question set (not embedded).
          */}
          {!preloaded?.embedded && set.show_progress ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium tabular-nums text-[color:var(--h5p-ink-muted)]">
                  Question {attempt.index + 1} of {attempt.paper.length}
                </p>
                <StreakBadge streak={streak} best={bestStreak} />
              </div>
              <ProgressRail
                value={attempt.index}
                max={attempt.paper.length}
                label="Questions answered"
                className="mt-2"
              />
            </>
          ) : null}

          {/*
            The `mt-5` above the question text is there to clear the progress
            block above it -- with nothing rendered there (embedded), it would
            just be dead space between the box's own top padding and the
            question, which is exactly the "too much gap" this is fixing.
          */}
          <Html
            html={entry.question.question_text}
            className={`block text-lg font-semibold leading-snug text-[color:var(--h5p-ink)] ${
              !preloaded?.embedded && set.show_progress ? 'mt-5' : ''
            }`}
          />

          <div className="mt-5 space-y-2.5" role="group" aria-label="Answers">
            {entry.options.map((option, optionIndex) => {
              const picked = chosen === option.id;
              const reveal = chosen !== null;
              const isRight = option.is_correct;

              // Which state this option is in. The colours for each live in
              // h5p.css; nothing here names one.
              const state = reveal ? (isRight ? 'is-correct' : picked ? 'is-wrong' : 'is-dimmed') : '';

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => choose(option.id)}
                  disabled={reveal}
                  style={{ '--h5p-stagger': `${Math.min(optionIndex, 5) * 45}ms` } as CSSProperties}
                  className={`h5p-option h5p-tappable h5p-focusable h5p-target h5p-enter h5p-stagger ${state}`}
                >
                  {/* The marker is a letter until the question is marked and a
                      tick or a cross afterwards, so right and wrong are carried
                      by shape as well as by colour. */}
                  <span className="h5p-option__marker" aria-hidden="true">
                    {reveal && isRight ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : reveal && picked ? (
                      <X className="h-3.5 w-3.5" />
                    ) : (
                      String.fromCharCode(65 + optionIndex)
                    )}
                  </span>
                  <Html html={option.option_text} className="min-w-0 flex-1" />
                </button>
              );
            })}
          </div>

          {feedback ? (
            <div className="mt-5">
              <Verdict
                correct={feedback.correct}
                message={feedback.message || encouragement(feedback.correct, attempt.index)}
              />

              {!set.auto_continue ? (
                <PrimaryAction onClick={() => advance(attempt)} className="mt-4" autoFocus>
                  {attempt.index + 1 >= attempt.paper.length ? 'See your result' : 'Next question'}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </PrimaryAction>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    }

    // Start screen.
    return (
      <StartScreen
        title={set.title}
        description={set.task_description}
        facts={[
          { icon: 'target', label: 'Questions', value: questions.length },
          { icon: 'gauge', label: 'Pass mark', value: `${set.pass_percentage}%` },
        ]}
        onStart={start}
      />
    );
  };

  // The standalone content route reads best at a constrained, article-like
  // width. An embedded caller (PAL, the question bank quiz) has already
  // chosen its own width -- a full assessment layout, in PAL's case -- and
  // capping this player to `max-w-2xl` inside it would put a small centred
  // box back in the middle of a page that caller deliberately made wide.
  return (
    <div className={preloaded?.embedded ? '' : 'p-4 sm:p-6'}>
      <div className={preloaded?.embedded ? '' : 'mx-auto max-w-2xl'}>
        {preloaded?.embedded ? null : (
        <H5pPageHeader
          title={set?.title || 'Single choice set'}
          description={set?.description || undefined}
          ctx={ctx}
          backHref={`/h5p/h5p_single_choice_set?${contextQuery}`}
        />
        )}

        {!hasH5pContext(ctx) ? (
          <MissingContextNotice />
        ) : loading ? (
          <PlayerSkeleton label="Loading set" />
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

/**
 * The player as a component, for a caller that already holds the row.
 *
 * The Suspense boundary stays, because the body still calls `useSearchParams`
 * even when it does not read it -- hooks cannot be conditional, and an
 * unwrapped `useSearchParams` opts the whole embedding route into client-side
 * rendering.
 */
/**
 * The `answer_master` rows this attempt actually chose, in paper order.
 *
 * WHY IT IS RESOLVED HERE AND NOT IN THE SCORER. `attempt.answers` holds the
 * ACTIVITY's option ids, which are synthetic for a set derived from a question
 * bank row -- they identify an option inside this attempt and mean nothing to
 * any table. The row the learner picked is on the option object, so the answer
 * has to be turned back into its option before the id is readable.
 *
 * Empty for an authored set, whose options carry no source row, and for any
 * question the learner did not answer. A caller must treat an empty list as
 * "no option id available" rather than "answered nothing" -- `answeredCount`
 * in the score is what distinguishes those.
 */
function chosenSourceOptionIds(attempt: Attempt): number[] {
  const ids: number[] = [];

  for (const entry of attempt.paper) {
    const given = attempt.answers[entry.index];
    if (given === null || given === undefined) continue;

    const chosen = entry.options.find((option) => option.id === given);
    const sourceId = Number(chosen?.source_option_id ?? NaN);
    if (Number.isFinite(sourceId) && sourceId > 0) ids.push(sourceId);
  }

  return ids;
}

export function SingleChoiceSetPlayer({ item, ctx, embedded, onResult }: PreloadedSingleChoiceSet) {
  // Memoised, because this object is the load effect's dependency. Passing a
  // fresh one each render re-ran that effect on every render, and its cleanup
  // then cancelled the setup the previous run had just scheduled.
  const preloaded = useMemo(
    () => ({ item, ctx, embedded, onResult }),
    [item, ctx, embedded, onResult]
  );

  return (
    <Suspense fallback={<PlayerSkeleton lines={3} label="Loading activity" />}>
      <SingleChoiceSetPlayerContent preloaded={preloaded} />
    </Suspense>
  );
}

export default function SingleChoiceSetPlayerPage() {
  return (
    <Suspense fallback={<PlayerSkeleton label="Loading set" />}>
      <SingleChoiceSetPlayerContent />
    </Suspense>
  );
}
