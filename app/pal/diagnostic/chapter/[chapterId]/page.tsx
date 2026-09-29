'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion, useReducedMotion as useFramerReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  Gauge,
  Loader2,
  Target,
  Timer,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QuestionPlayer } from '@/components/h5p/players';
import type { QuestionResult } from '@/components/h5p/players/types';
import { canPlay, selectedOptionId, toPlayerQuestion } from '@/lib/pal/diagnostic-answers';
import {
  startChapterDiagnostic,
  submitChapterDiagnostic,
  type ChapterDiagnosticPaper,
  type ChapterDiagnosticResult,
  type DiagnosticConceptBreakdown,
  type DiagnosticQuestionItem,
} from '@/app/pal/data/pal-diagnostic';
import {
  CompletedBadge,
  CompletedChapterPanel,
  ReadOnlyBadge,
  useChapterCompletion,
} from '@/app/pal/_components/CompletionState';
import { COMPLETED_THROUGH_CHECK, JourneyRail } from '@/app/pal/_components/JourneyRail';
import { PalRailSection, PalWorkspace } from '@/app/pal/_components/PalWorkspace';
import { BandChip } from '@/app/pal/_components/BandMeter';
import { FlagToggle, ProgressRing, QuestionNavigator } from '@/app/pal/_components/DiagnosticNavigator';
import {
  AchievementList,
  Celebration,
  deriveAchievements,
  PrimaryAction,
  SecondaryAction,
  useCountUp,
  type Achievement,
} from '@/app/h5p/components/game';

/**
 * Stage 1 - the chapter diagnostic.
 *
 * Fifteen multiple-choice questions drawn from one chapter: five easy, five
 * medium and five hard. The result is the input to every stage after it, which
 * is why this is a full page rather than the modal the old DOK-sampled
 * diagnostic used - fifteen questions do not belong in an overlay.
 *
 * ---------------------------------------------------------------------------
 * ONE QUESTION AT A TIME, BY DESIGN
 * ---------------------------------------------------------------------------
 * Every question is still loaded and answerable from the moment the paper
 * arrives - `answers` covers the whole set, not just the one on screen - the
 * navigator and Previous/Next only control which one is RENDERED. Jumping
 * around, answering out of order and coming back to change something all
 * work exactly as they did when every question sat on one long page; nothing
 * about submission, scoring or the timer changed, only how much of the paper
 * is visible at once.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SCREEN DOES NOT DO
 * ---------------------------------------------------------------------------
 * It does not mark anything. The served payload carries an `isCorrect` flag
 * per option (see `lib/pal/diagnostic-answers.ts`) -- that is what lets
 * `QuestionPlayer` build a real activity -- but scoring is still resolved
 * server-side from the submitted answer_master id on `submit`. The player
 * renders with `instantFeedback={false}`, so nothing in this file (or the
 * shared player) shows a tick or a cross while the paper is being sat.
 *
 * It also does not decide the paper. A chapter that cannot fill all three bands
 * comes back with `attemptId: null` and a machine `reason`; only 23 of 150
 * chapters on this estate can, so that path is ordinary and is explained rather
 * than rendered as an error.
 *
 * ---------------------------------------------------------------------------
 * A COMPLETED CHAPTER IS NEVER STARTED
 * ---------------------------------------------------------------------------
 * `startChapterDiagnostic` WRITES - it opens or resumes a pal_diagnostic_attempt
 * - so completion has to be settled before it is called, not after a paper has
 * already been drawn. A chapter whose every measurable concept has been cleared
 * to hard and signed off renders its mastery instead, and no attempt is created.
 * See app/pal/data/pal-completion.ts for the rule.
 *
 * ---------------------------------------------------------------------------
 * SUBMIT DOES NOT NAVIGATE STRAIGHT TO THE RESULT PAGE
 * ---------------------------------------------------------------------------
 * `submitChapterDiagnostic` already returns the scored `ChapterDiagnosticResult`
 * in the same round trip, so a completion moment (score, percentage, time
 * taken) shows immediately, on a dedicated score-summary screen, rather than
 * after a second fetch. `Continue` there is what navigates to
 * `/pal/diagnostic/result/[attemptId]` -- the existing result page, unchanged,
 * still owned entirely by readiness analysis (strengths, weaknesses,
 * recommended focus) rather than raw score reporting.
 */

export default function DiagnosticExamPage() {
  return (
    <Suspense fallback={<Centered>Loading the chapter diagnostic…</Centered>}>
      <DiagnosticExam />
    </Suspense>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
      <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
      {children}
    </div>
  );
}

function DiagnosticExam() {
  const params = useParams();
  const router = useRouter();
  const chapterId = String(params?.chapterId ?? '');

  const [paper, setPaper] = useState<ChapterDiagnosticPaper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  // Set the moment submit() returns a score - this is what switches the page
  // from the paper to the score-summary screen. Null the rest of the time.
  const [summary, setSummary] = useState<ChapterDiagnosticResult | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  // "Review answers" from the summary screen drops back into the already-loaded
  // paper, read-only - no re-fetch, since every question and choice is still
  // in `questions`/`answers`. Only meaningful once `summary` is set.
  const [reviewing, setReviewing] = useState(false);

  const {
    mastery,
    completion,
    loading: checkingCompletion,
  } = useChapterCompletion(chapterId);

  const load = useCallback(() => {
    const controller = new AbortController();
    // Deferred so setState never fires synchronously inside the effect body -
    // the convention the rest of app/pal follows, and what
    // react-hooks/set-state-in-effect enforces.
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      startChapterDiagnostic(chapterId, controller.signal)
        .then((result) => {
          setPaper(result);
          // A resumed attempt comes back with the choices already made, so the
          // form is rebuilt from the server rather than starting blank over
          // answers that are actually recorded.
          setAnswers(
            Object.fromEntries(
              result.questions
                .filter((question) => question.selectedOptionId !== null)
                .map((question) => [question.questionId, question.selectedOptionId as string])
            )
          );
          setFlagged({});
          // A resumed attempt opens on the first unanswered question rather
          // than the very first one, so picking back up does not mean
          // re-clicking through everything already saved.
          const firstOpen = result.questions.findIndex((question) => question.selectedOptionId === null);
          setCurrentIndex(firstOpen === -1 ? 0 : firstOpen);
          setSecondsLeft(result.attemptId ? result.timeAllowedMinutes * 60 : null);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'The chapter diagnostic could not be loaded.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    });

    return () => controller.abort();
  }, [chapterId]);

  // Gated, not aborted: `load` opens an attempt server-side, so a completed
  // chapter must never reach it in the first place.
  useEffect(() => {
    if (checkingCompletion || completion.isComplete) return;
    return load();
  }, [load, checkingCompletion, completion.isComplete]);

  const submit = useCallback(async () => {
    if (!paper?.attemptId || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const outcome = await submitChapterDiagnostic({ attemptId: paper.attemptId, answers });
      if (outcome.result) {
        // Elapsed, not remaining - the summary screen reports what the
        // learner spent, and the clock on the paper only ever counted down.
        setElapsedSeconds(
          secondsLeft !== null ? Math.max(0, paper.timeAllowedMinutes * 60 - secondsLeft) : null
        );
        setSummary(outcome.result);
        setSubmitting(false);
      } else {
        // No score payload to summarise - go straight to the result page,
        // which re-fetches it itself, rather than show a summary with nothing in it.
        router.push(`/pal/diagnostic/result/${paper.attemptId}`);
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'The chapter diagnostic could not be submitted.');
      setSubmitting(false);
    }
  }, [paper, answers, submitting, router, secondsLeft]);

  // The timer auto-submits rather than discarding the paper: every answer is
  // already persisted server-side, so losing them at zero would be a choice,
  // not a consequence.
  //
  // `submit` is held in a ref so the interval always calls the CURRENT closure
  // without the interval itself restarting every time an answer changes - a
  // one-second timer that resets on each keystroke would never reach zero. The
  // ref is synced in an effect rather than during render, which is what
  // react-hooks/refs requires.
  const submitRef = useRef(submit);

  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  // Whether the clock is running, extracted so the dependency is a plain
  // boolean the linter can check statically. Stops the moment a score comes
  // back - the paper is no longer on screen, and ticking on in the
  // background would eventually fire the auto-submit path a second time.
  const timerRunning = secondsLeft !== null && secondsLeft > 0 && !summary;

  useEffect(() => {
    if (!timerRunning) return;

    const id = window.setInterval(() => {
      setSecondsLeft((value) => {
        if (value === null) return null;
        if (value <= 1) {
          window.clearInterval(id);
          void submitRef.current();
          return 0;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [timerRunning]);

  const questions = paper?.questions ?? [];
  const total = questions.length;
  const answered = Object.keys(answers).length;
  const current = questions[currentIndex] ?? null;
  const isLast = currentIndex >= total - 1;
  const isFirst = currentIndex <= 0;

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(total - 1, index)));
    },
    [total]
  );

  // Left/right arrow keys step through the paper, the same as the
  // Previous/Next buttons - a keyboard-only learner should not be stuck
  // tabbing through the navigator strip one pip at a time.
  useEffect(() => {
    if (total === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Never hijack arrow keys while they are being used to operate an
      // option button, a text field or the navigator itself.
      if (target && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return;

      if (event.key === 'ArrowRight') goTo(currentIndex + 1);
      else if (event.key === 'ArrowLeft') goTo(currentIndex - 1);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [total, currentIndex, goTo]);

  if (checkingCompletion) return <Centered>Loading this chapter…</Centered>;

  // Nothing left to diagnose. No paper was drawn and no attempt was opened.
  if (completion.isComplete && mastery) {
    return (
      <PalWorkspace
        eyebrow={mastery.chapterName || 'This chapter'}
        title="Chapter mastery"
        description="This chapter is completed, so there is no diagnostic left to take."
        backHref="/pal"
        backLabel="Back to subjects"
        actions={
          <>
            <CompletedBadge />
            <ReadOnlyBadge />
          </>
        }
        rail={
          <PalRailSection title="Your journey">
            <JourneyRail
              current="mastery"
              completed={COMPLETED_THROUGH_CHECK}
              bypassed={['intervention']}
              orientation="vertical"
            />
          </PalRailSection>
        }
      >
        <CompletedChapterPanel mastery={mastery} completion={completion} />
      </PalWorkspace>
    );
  }

  if (loading) return <Centered>Drawing your chapter diagnostic…</Centered>;

  if (error && !paper) {
    return (
      <Shell chapterId={chapterId}>
        <ErrorCard message={error} onRetry={load} />
      </Shell>
    );
  }

  // A chapter without enough tagged questions. Said plainly - this is a gap in
  // the question bank, not something the learner did.
  if (paper && !paper.attemptId) {
    return (
      <Shell chapterId={chapterId}>
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="flex flex-row items-start gap-3">
            <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <CardTitle className="text-base text-amber-900">
                This chapter is not ready for a chapter diagnostic yet
              </CardTitle>
              <p className="mt-1 text-sm text-amber-800">
                {paper.message ||
                  'There are not enough multiple-choice questions tagged for this chapter.'}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-800">
              The chapter diagnostic needs five easy, five medium and five hard questions. Your teacher
              will see this chapter listed as a content gap.
            </p>
            <Link href="/pal" className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>Back to subjects</Link>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // Submitted. Show what happened before sending the learner into the
  // readiness analysis on the result page - see the module doc comment.
  // "Review answers" drops back into the paper below (in read-only mode)
  // rather than replacing this screen outright.
  if (summary && !reviewing) {
    return (
      <DiagnosticScoreSummary
        result={summary}
        totalQuestions={total}
        elapsedSeconds={elapsedSeconds}
        onContinue={() => router.push(`/pal/diagnostic/result/${summary.attemptId}`)}
        onReview={() => setReviewing(true)}
      />
    );
  }

  const navigatorItems = questions.map((question) => ({
    id: question.questionId,
    answered: answers[question.questionId] != null,
  }));

  // Progress, the clock, the ring and the flagged count are context, not the
  // task, so on a wide screen they live in the rail where they stay visible
  // without competing with the one question on screen.
  const rail = (
    <>
      <PalRailSection title="Progress">
        <div className="flex items-center gap-3">
          <ProgressRing value={answered} max={total} />
          <div>
            <p className="text-sm font-semibold text-slate-900">{answered} of {total} answered</p>
            {secondsLeft !== null && (
              <p className={cn('text-xs font-medium tabular-nums', secondsLeft <= 120 ? 'text-rose-600' : 'text-slate-500')}>
                {formatClock(secondsLeft)} left
              </p>
            )}
          </div>
        </div>
        {answered < total && (
          <p className="mt-2 text-xs text-slate-500">
            You can submit before answering them all.
          </p>
        )}
      </PalRailSection>

      <PalRailSection title="Your journey">
        <JourneyRail current="diagnostic" orientation="vertical" />
      </PalRailSection>

      <p className="px-1 text-xs text-slate-400">
        <Link
          href={`/pal/diagnostic/chapter/${chapterId}/history`}
          className="hover:text-slate-600 hover:underline"
        >
          Previous attempts
        </Link>
      </p>
    </>
  );

  return (
    <Shell chapterId={chapterId} rail={rail}>
      {paper?.resumed && (
        // Restoring answers without saying so reads as a glitch, and the clock
        // restarts on a resume, so both facts are stated plainly.
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
          <p className="text-sm font-medium text-indigo-900">
            Picking up where you left off
          </p>
          <p className="mt-0.5 text-sm text-indigo-800">
            This is the same paper you started
            {paper.answered > 0
              ? `, with ${paper.answered} ${paper.answered === 1 ? 'answer' : 'answers'} already saved`
              : ''}
            . The clock starts again from the full time, and you are back where you left off.
          </p>
        </div>
      )}

      {/* Small screens only. The rail carries the ring on desktop, but it sits
          BELOW the question there, so a timer that lived only there would
          scroll out of sight exactly when it matters. */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {answered} of {total} answered
            </span>
          </div>

          {secondsLeft !== null && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums ${
                secondsLeft <= 120
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
              role="timer"
              aria-live="off"
            >
              <Clock aria-hidden className="h-3.5 w-3.5" />
              {formatClock(secondsLeft)} left
            </span>
          )}
        </div>

        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{ width: `${total > 0 ? (answered / total) * 100 : 0}%` }}
            role="progressbar"
            aria-valuenow={answered}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label="Questions answered"
          />
        </div>
      </div>

      {error && <div className="mb-4"><ErrorCard message={error} onRetry={() => setError(null)} retryLabel="Dismiss" /></div>}

      <div className="mb-4">
        <QuestionNavigator items={navigatorItems} currentIndex={currentIndex} onJump={goTo} disabled={submitting} />
      </div>

      {current && (
        <QuestionCard
          key={current.questionId}
          question={current}
          index={currentIndex + 1}
          total={total}
          selected={answers[current.questionId] ?? null}
          onSelect={(optionId) =>
            setAnswers((previous) => ({ ...previous, [current.questionId]: optionId }))
          }
          flagged={flagged[current.questionId] ?? false}
          onToggleFlag={() =>
            setFlagged((previous) => ({ ...previous, [current.questionId]: !previous[current.questionId] }))
          }
          disabled={submitting || reviewing}
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

      {reviewing ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
          <p className="text-sm text-slate-600">
            Reviewing what you submitted. Nothing here can be changed.
          </p>
          <Button onClick={() => setReviewing(false)}>
            Back to summary
          </Button>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
          <p className="text-sm text-slate-600">
            {answered === total
              ? 'All questions answered.'
              : `${total - answered} unanswered. Unanswered questions score zero.`}
          </p>

          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700">Submit now?</span>
              <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={submitting}>
                Keep working
              </Button>
              <Button size="sm" onClick={() => void submit()} disabled={submitting}>
                {submitting && <Loader2 aria-hidden className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Yes, submit
              </Button>
            </div>
          ) : (
            <Button onClick={() => setConfirming(true)} disabled={submitting || total === 0}>
              <CheckCircle2 aria-hidden className="mr-1.5 h-4 w-4" />
              Submit chapter diagnostic
            </Button>
          )}
        </div>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------
// Three variant sets, reused rather than inlined so every section moves in
// step: a stagger container for anything with children that should cascade,
// a rise-and-fade for a section as a whole, and a spring scale-in for the
// one hero element (the ring). `useFramerReducedMotion` (below) gates all of
// it the same way `app/h5p/components/game.tsx`'s own `useReducedMotion`
// gates the H5P layer's animation - the summary screen sits right next to
// that layer and should not disagree with it about that preference.

const MOTION_CONTAINER = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const MOTION_ITEM = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } },
};

const MOTION_SCALE = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] as const } },
};

/**
 * The score summary shown immediately after submit, before the result page.
 *
 * Everything here comes from the same `ChapterDiagnosticResult` the result
 * page reads - no second request - so this is a rendering choice, not a new
 * data path. It reports the raw outcome (score, correct/incorrect, time,
 * concept-wise breakdown); the result page it hands off to is where that
 * outcome turns into readiness analysis (strengths, weaknesses, what to
 * focus on next) - the concept bars here are a preview of that, not a
 * replacement for it, which is why they cap at five with a "+N more" note.
 *
 * Built on `app/h5p/components/game.tsx` -- the same "finished" primitives
 * every H5P activity in this product already ends on (trophy, count-up,
 * confetti, achievement chips) -- rather than a bespoke completion design,
 * with the ring, metric cards and concept bars layered on top of them. The
 * one deliberate departure from that module's own `ResultScreen` is the
 * pill: that component's is "Passed" / "Not passed yet", and a chapter
 * diagnostic has no pass mark (see the page description above: "not a test
 * you can fail"), so this renders the performance LEVEL instead, and only
 * lights the confetti for a strong result rather than a pass/fail it does
 * not have.
 */
export function DiagnosticScoreSummary({
  result,
  totalQuestions,
  elapsedSeconds,
  onContinue,
  onReview,
}: {
  result: ChapterDiagnosticResult;
  totalQuestions: number;
  elapsedSeconds: number | null;
  onContinue: () => void;
  onReview: () => void;
}) {
  const reduceMotion = !!useFramerReducedMotion();
  const questionCount = result.totalQuestions || totalQuestions;
  const percentage = Math.max(0, Math.min(100, Math.round(result.percentage)));
  const level = (result.level || '').toLowerCase();
  const tone = LEVEL_TONE[level] ?? LEVEL_TONE.beginner;
  const attempted = result.correct + result.incorrect;
  // A diagnostic has no pass mark, so the celebration is tied to a strong
  // result instead - the same threshold `deriveAchievements` uses for "Sharp".
  const celebrate = percentage >= 70;

  // Two milestones every submitted attempt earns, ahead of whatever
  // `deriveAchievements` works out from the score itself - a 0% attempt
  // still finished the diagnostic and still unlocked the next stage, and
  // both of those are true regardless of how the questions went.
  const achievements: Achievement[] = [
    { id: 'diagnostic-completed', label: 'Diagnostic completed', detail: `${questionCount} questions, done.` },
    { id: 'path-unlocked', label: 'Learning path unlocked', detail: 'The concept diagnostic is ready.' },
    ...deriveAchievements({ percentage, passed: celebrate, questionCount }),
  ];

  const metrics: MetricSpec[] = [
    { id: 'score', icon: Gauge, label: 'Score', value: `${percentage}%` },
    { id: 'correct', icon: Target, label: 'Correct', value: result.correct },
    { id: 'incorrect', icon: XCircle, label: 'Incorrect', value: result.incorrect },
    { id: 'attempted', icon: Zap, label: 'Attempted', value: `${attempted}/${questionCount}` },
  ];
  if (elapsedSeconds !== null) {
    metrics.push({ id: 'time', icon: Timer, label: 'Time taken', value: formatClock(elapsedSeconds) });
  }

  // A preview, not the analysis - the result page owns the full breakdown.
  const topConcepts = result.conceptBreakdown.slice(0, 5);

  return (
    <PalWorkspace
      title="Diagnostic submitted"
      description="Here's how it went. Continue when you're ready to see what it means for this chapter."
      backHref="/pal"
      backLabel="Back to subjects"
      rail={
        <PalRailSection title="Your journey">
          <JourneyRail current="diagnostic" orientation="vertical" />
        </PalRailSection>
      }
    >
      <motion.div
        initial={reduceMotion ? false : 'hidden'}
        animate="visible"
        variants={MOTION_CONTAINER}
        className="space-y-5"
      >
        <motion.div
          variants={MOTION_SCALE}
          className="h5p-surface h5p-stage relative overflow-visible p-6 text-center sm:p-8"
        >
          <Celebration show={celebrate} />

          <div className="relative flex flex-col items-center">
            <ScoreRing percentage={percentage} color={tone.icon} reduceMotion={reduceMotion} />

            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[color:var(--h5p-ink-faint)]">
              Finished
            </p>

            {/* The whole result in one announcement, same as `ResultScreen`. */}
            <p className="sr-only" aria-live="polite">
              {`${result.correct} out of ${questionCount}, ${percentage} percent.${level ? ` ${level} level.` : ''}`}
            </p>

            <p className="mt-1 text-sm text-[color:var(--h5p-ink-muted)]">
              {result.correct} of {questionCount} correct
              {result.unanswered > 0 && ` · ${result.unanswered} unanswered`}
            </p>

            {level && (
              <span
                className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize"
                style={{ background: tone.bg, color: tone.fg }}
              >
                {level}
              </span>
            )}
          </div>
        </motion.div>

        <motion.div variants={MOTION_CONTAINER} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {metrics.map((metric) => (
            <MetricCard key={metric.id} {...metric} />
          ))}
        </motion.div>

        {topConcepts.length > 0 && (
          <motion.div variants={MOTION_ITEM} className="h5p-surface p-5 sm:p-6">
            <h3 className="text-left text-sm font-semibold text-[color:var(--h5p-ink)]">
              How you did by concept
            </h3>
            <div className="mt-4 space-y-3">
              {topConcepts.map((concept, index) => (
                <ConceptBar
                  key={`${concept.conceptId}-${index}`}
                  concept={concept}
                  reduceMotion={reduceMotion}
                  delay={index * 0.08}
                />
              ))}
            </div>
            {result.conceptBreakdown.length > topConcepts.length && (
              <p className="mt-3 text-left text-xs text-[color:var(--h5p-ink-faint)]">
                +{result.conceptBreakdown.length - topConcepts.length} more concepts on the result page.
              </p>
            )}
          </motion.div>
        )}

        <motion.div variants={MOTION_ITEM} className="h5p-surface p-5 text-center sm:p-6">
          <AchievementList achievements={achievements} />

          <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--h5p-ink-muted)]">
            {diagnosticMessage(percentage)}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <PrimaryAction onClick={onContinue} icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
              Continue
            </PrimaryAction>
            <SecondaryAction onClick={onReview} icon={<Eye className="h-4 w-4" aria-hidden="true" />}>
              Review answers
            </SecondaryAction>
          </div>
        </motion.div>
      </motion.div>
    </PalWorkspace>
  );
}

/** A percentage ring, its sweep animating in on mount - the hero element the metric cards and concept bars sit below. */
function ScoreRing({
  percentage,
  color,
  reduceMotion,
  size = 128,
  strokeWidth = 10,
}: {
  percentage: number;
  color: string;
  reduceMotion: boolean;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const shown = useCountUp(percentage);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Score"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          style={{ stroke: 'var(--h5p-line)' }}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ stroke: color }}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - percentage / 100) }}
          transition={{ duration: reduceMotion ? 0 : 1.1, ease: [0.16, 1, 0.3, 1], delay: reduceMotion ? 0 : 0.15 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-3xl font-extrabold tabular-nums text-[color:var(--h5p-ink)]">{shown}%</span>
      </div>
    </div>
  );
}

interface MetricSpec {
  /**
   * Not `key` - a spread `{...metric}` prop named `key` is the one prop name
   * React reserves and strips before a component ever sees its props, so
   * this doubled as the list key AND the theme lookup would always read
   * `undefined` inside `MetricCard`. `id` is the data field; the list `key`
   * is set separately from it at the call site.
   */
  id: 'score' | 'correct' | 'incorrect' | 'attempted' | 'time';
  icon: LucideIcon;
  label: string;
  value: string | number;
}

/**
 * Colour per metric, in `--h5p-*` tokens: score is accent, correct is
 * success, incorrect is danger, attempted is reward (amber - neither a pass
 * nor a fail signal), time is neutral. A count-up only for the numeric ones;
 * "67%" and "1:21" are already-formatted strings and stay static.
 */
const METRIC_THEME: Record<MetricSpec['id'], { bg: string; fg: string; ring: string }> = {
  score: { bg: 'var(--h5p-accent-soft)', fg: 'var(--h5p-accent)', ring: 'var(--h5p-accent-line)' },
  correct: { bg: 'var(--h5p-success-soft)', fg: 'var(--h5p-success)', ring: 'var(--h5p-success-line)' },
  incorrect: { bg: 'var(--h5p-danger-soft)', fg: 'var(--h5p-danger)', ring: 'var(--h5p-danger-line)' },
  attempted: {
    bg: 'var(--h5p-reward-soft)',
    fg: 'var(--h5p-reward)',
    ring: 'color-mix(in srgb, var(--h5p-reward) 32%, var(--h5p-surface))',
  },
  time: { bg: 'var(--h5p-surface-sunken)', fg: 'var(--h5p-ink-muted)', ring: 'var(--h5p-line)' },
};

function MetricCard({ icon: Icon, label, value, id }: MetricSpec) {
  const theme = METRIC_THEME[id];
  const numeric = typeof value === 'number';
  const shown = useCountUp(numeric ? value : 0);

  return (
    <motion.div
      variants={MOTION_ITEM}
      className="rounded-2xl border p-4 text-center"
      style={{ borderColor: theme.ring, background: 'var(--h5p-surface)' }}
    >
      <span
        className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ background: theme.bg, color: theme.fg }}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="mt-2 text-lg font-bold tabular-nums text-[color:var(--h5p-ink)]">{numeric ? shown : value}</p>
      <p className="text-[11px] font-medium text-[color:var(--h5p-ink-faint)]">{label}</p>
    </motion.div>
  );
}

/** One concept's line in the preview breakdown - a smaller, undecorated cousin of the result page's own `ConceptRow`, since this is a teaser rather than the analysis. */
function ConceptBar({
  concept,
  reduceMotion,
  delay,
}: {
  concept: DiagnosticConceptBreakdown;
  reduceMotion: boolean;
  delay: number;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(concept.percentage)));
  const barColor = pct >= 70 ? 'var(--h5p-success)' : pct >= 40 ? 'var(--h5p-warning)' : 'var(--h5p-danger)';

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate font-medium text-[color:var(--h5p-ink-muted)]">
          {concept.name}
          {!concept.conceptExact && <span className="ml-1 text-[color:var(--h5p-ink-faint)]">(via chapter)</span>}
        </span>
        <span className="shrink-0 tabular-nums text-[color:var(--h5p-ink-faint)]">
          {concept.correct}/{concept.served}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--h5p-surface-sunken)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{
            duration: reduceMotion ? 0 : 0.7,
            ease: [0.16, 1, 0.3, 1],
            delay: reduceMotion ? 0 : 0.25 + delay,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Level colours, in the same `--h5p-*` token language as the rest of the
 * finished screen - not the Tailwind slate/amber/indigo/emerald `LevelBadge`
 * uses elsewhere in PAL, which would clash with it.
 *
 * `icon` is a bold, saturated colour for the ring and trophy; `fg` is the
 * same hue darkened for text-on-soft-fill (the pill). Two shades of one
 * tone, not a second palette - a Beginner result gets a muted grey ring
 * rather than the same celebratory green as a 100%, which is what made every
 * result look identical regardless of score before this.
 */
const LEVEL_TONE: Record<string, { bg: string; icon: string; fg: string }> = {
  beginner: {
    bg: 'var(--h5p-surface-sunken)',
    icon: 'var(--h5p-ink-muted)',
    fg: 'var(--h5p-ink-muted)',
  },
  developing: {
    bg: 'color-mix(in srgb, var(--h5p-warning) 14%, var(--h5p-surface))',
    icon: 'var(--h5p-warning)',
    fg: 'color-mix(in srgb, var(--h5p-warning) 80%, #000)',
  },
  proficient: {
    bg: 'var(--h5p-accent-soft)',
    icon: 'var(--h5p-accent)',
    fg: 'var(--h5p-accent-deep)',
  },
  advanced: {
    bg: 'var(--h5p-success-soft)',
    icon: 'var(--h5p-success)',
    fg: 'color-mix(in srgb, var(--h5p-success) 80%, #000)',
  },
};

/** Tiered, blame-free - a low score is what a diagnostic is FOR, not a bad result. */
function diagnosticMessage(percentage: number): string {
  if (percentage >= 90) return 'Excellent — you already have a strong handle on this chapter.';
  if (percentage >= 70) return 'Good work. A few gaps are worth a closer look before you move on.';
  if (percentage >= 40) return 'A solid starting point. The concept diagnostic will help close the gaps.';
  return 'This is exactly what a diagnostic is for — now you know where to start.';
}

function Shell({
  chapterId,
  rail,
  children,
}: {
  chapterId: string;
  rail?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <PalWorkspace
      title="Chapter diagnostic"
      description="Fifteen questions — five easy, five medium and five hard. This finds where to start; it is not a test you can fail."
      backHref="/pal"
      backLabel="Back to subjects"
      rail={
        rail ?? (
          <PalRailSection title="Your journey">
            <JourneyRail current="diagnostic" orientation="vertical" />
          </PalRailSection>
        )
      }
    >
      {children}

      <p className="text-xs text-slate-400 lg:hidden">
        <Link
          href={`/pal/diagnostic/chapter/${chapterId}/history`}
          className="hover:text-slate-600 hover:underline"
        >
          Previous attempts
        </Link>
      </p>
    </PalWorkspace>
  );
}

function QuestionCard({
  question,
  index,
  total,
  selected,
  onSelect,
  flagged,
  onToggleFlag,
  disabled,
}: {
  question: DiagnosticQuestionItem;
  index: number;
  total: number;
  selected: string | null;
  onSelect: (optionId: string) => void;
  flagged: boolean;
  onToggleFlag: () => void;
  disabled: boolean;
}) {
  const name = `question-${question.questionId}`;

  // `canPlay` runs the real convertibility check -- most MCQs resolve to a
  // single_choice_set activity, but the radio list below stays as a fallback
  // for the rare row it refuses (e.g. fewer than two options).
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
        <fieldset disabled={disabled}>
          <legend className="sr-only">Question {index}</legend>

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
              // A chapter diagnostic measures where a learner stands; it
              // does not teach mid-paper. Correct/incorrect is resolved
              // server-side on submit, same as it always was -- this just
              // stops the interactive player from revealing it early.
              instantFeedback={false}
            />
          ) : (
            <>
              <div
                className="mb-3 text-base font-medium text-slate-900 [&_img]:max-w-full"
                // Question bodies are authored HTML in lms_question_master and
                // contain markup and figures; the rest of PAL renders them the
                // same way.
                dangerouslySetInnerHTML={{ __html: question.title }}
              />
              <div className="space-y-2">
                {question.options.map((option) => {
                  const isSelected = selected === option.id;

                  return (
                    <label
                      key={option.id}
                      data-pal-option-id={option.id}
                      className={cn(
                        'h5p-tappable h5p-focusable flex cursor-pointer items-start gap-2.5 rounded-xl border px-4 py-3 text-sm transition-colors',
                        isSelected
                          ? 'border-indigo-400 bg-indigo-50 font-semibold text-indigo-900'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <input
                        type="radio"
                        name={name}
                        value={option.id}
                        checked={isSelected}
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
        </fieldset>
      </CardContent>
    </Card>
  );
}

function ErrorCard({
  message,
  onRetry,
  retryLabel = 'Try again',
}: {
  message: string;
  onRetry: () => void;
  retryLabel?: string;
}) {
  return (
    <Card className="border-rose-200 bg-rose-50">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
        <p className="text-sm text-rose-800">{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

function formatClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
