'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion as useFramerReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  ListOrdered,
  Loader2,
  Lock,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { QuestionPlayer } from '@/components/h5p/players';
import type { QuestionResult } from '@/components/h5p/players/types';
import { canPlay, selectedOptionId, toPlayerQuestion } from '@/lib/pal/diagnostic-answers';
import {
  fetchAdaptiveConcepts,
  startChapterDiagnostic,
  submitChapterDiagnostic,
  type ChapterDiagnosticPaper,
  type ChapterDiagnosticResult,
  type DiagnosticQuestionItem,
} from '@/app/pal/data/pal-diagnostic';
import { DiagnosticAlreadyAttemptedGate } from '@/app/pal/_components/DiagnosticAlreadyAttemptedGate';
import {
  CompletedBadge,
  CompletedChapterPanel,
  ReadOnlyBadge,
  useChapterCompletion,
} from '@/app/pal/_components/CompletionState';
import { COMPLETED_THROUGH_CHECK, JourneyRail, JourneyStepList } from '@/app/pal/_components/JourneyRail';
import { PalRailSection, PalWorkspace } from '@/app/pal/_components/PalWorkspace';
import { BandChip } from '@/app/pal/_components/BandMeter';
import { FlagToggle, ProgressRing, QuestionNavigator } from '@/app/pal/_components/DiagnosticNavigator';
import { Celebration, ConfettiRain, PrimaryAction, useCountUp } from '@/app/h5p/components/game';
import {
  H5PJourneyCollage,
  JOURNEY_STEPS,
  STEP_SEQUENCE,
  DEFAULT_STAGE_IMAGES,
  getStageImage,
  isStepUnlocked,
  type JourneyImageInfo,
  type JourneyStepId,
} from '@/app/pal/_components/H5PJourneyCollage';
import { SelectedJourneyStepRail } from '@/app/pal/_components/SelectedJourneyStepRail';
import { JourneyStepContent } from '@/app/pal/_components/JourneyStepContent';

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
 * SUBMIT SHOWS A REVEAL DIALOG, THEN GOES STRAIGHT TO THE RESULT PAGE
 * ---------------------------------------------------------------------------
 * `submitChapterDiagnostic` already returns the scored `ChapterDiagnosticResult`
 * in the same round trip, so a completion moment (score, percentage, tier)
 * shows immediately -- but as a dialog (`DiagnosticScoreSummary`, below), not
 * a screen of its own. There used to be an intermediate "Diagnostic
 * submitted" dashboard here (metric cards, a concept-breakdown preview,
 * achievement chips); it duplicated what `/pal/diagnostic/result/[attemptId]`
 * already shows, so every way of dismissing the dialog -- its one CTA,
 * Escape, an outside click -- now leads straight there instead. That page
 * still owns readiness analysis (strengths, weaknesses, recommended focus,
 * the full answer review) and is unchanged by any of this.
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

function getJourneyStepTitle(step: JourneyStepId | null, chapterName: string): string {
  if (!step) return `${chapterName} Learning Journey`;
  const meta = JOURNEY_STEPS.find((s) => s.id === step);
  return meta ? `Step ${meta.stepNumber}: ${meta.label}` : `${chapterName} Learning Journey`;
}

function getJourneyStepDescription(step: JourneyStepId | null): string {
  if (!step) return 'A sequential 10-stage learning path. Complete each stage in order to master this chapter.';
  const meta = JOURNEY_STEPS.find((s) => s.id === step);
  return meta ? meta.detail : 'Sequential progress along your personalized curriculum.';
}

function MainJourneyOverview({
  subjectName,
  chapterName,
  completedSteps,
  onStartNextStep,
}: {
  subjectName: string;
  chapterName: string;
  completedSteps: Set<JourneyStepId>;
  onStartNextStep: () => void;
}) {
  const nextStep = JOURNEY_STEPS.find(
    (step) => isStepUnlocked(step.id, completedSteps) && !completedSteps.has(step.id)
  ) || JOURNEY_STEPS[0];

  const allCompleted = completedSteps.size >= JOURNEY_STEPS.length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">
            Interactive Learning Journey
          </span>
          <h2 className="mt-0.5 text-lg font-bold text-slate-900 sm:text-xl">
            {chapterName} Sequential Roadmap
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-xl">
            Each stage unlocks as you complete the previous one. Click any unlocked stage image above or use the button to advance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="lg"
            onClick={onStartNextStep}
            className="gap-2 bg-purple-700 px-5 text-sm font-semibold text-white shadow-md hover:bg-purple-800"
          >
            {allCompleted ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <span>Review Chapter Diagnostic</span>
              </>
            ) : (
              <>
                <span>Continue: Step {nextStep.stepNumber} ({nextStep.label})</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
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

  // Image-based journey interactive states
  const searchParams = useSearchParams();
  const initialStage = (searchParams?.get('stage') as JourneyStepId) || null;
  const [selectedStep, setSelectedStep] = useState<JourneyStepId | null>(() => {
    if (initialStage === 'adaptive' || initialStage === 'plan') {
      return null;
    }
    if (initialStage && JOURNEY_STEPS.some((s) => s.id === initialStage)) {
      return initialStage;
    }
    return null;
  });

  useEffect(() => {
    const stageParam = (searchParams?.get('stage') as JourneyStepId) || null;
    if (stageParam === 'adaptive') {
      router.replace(`/pal/adaptive/chapter/${chapterId}`);
      return;
    }
    if (stageParam === 'plan') {
      router.replace(`/pal/plan/chapter/${chapterId}`);
      return;
    }
    if (stageParam && JOURNEY_STEPS.some((s) => s.id === stageParam)) {
      setSelectedStep(stageParam);
    }
  }, [searchParams, chapterId, router]);

  const [showClassicJourney, setShowClassicJourney] = useState(false);
  const [subjectName, setSubjectName] = useState<string>('Mathematics');

  // Track completed steps sequentially
  const [completedSteps, setCompletedSteps] = useState<Set<JourneyStepId>>(() => {
    try {
      const saved = sessionStorage.getItem(`pal_completed_steps_${chapterId}`);
      if (saved) {
        return new Set<JourneyStepId>(JSON.parse(saved));
      }
    } catch {}
    return new Set<JourneyStepId>();
  });

  // Cached images initialized with defaults so images ALWAYS exist immediately
  const [journeyImages, setJourneyImages] = useState<Record<string, JourneyImageInfo>>(() => {
    try {
      const cacheKey = `pal_journey_images_math_${chapterId}`.toLowerCase().replace(/\s+/g, '_');
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}
    return DEFAULT_STAGE_IMAGES;
  });

  const {
    mastery,
    completion,
    loading: checkingCompletion,
  } = useChapterCompletion(chapterId);

  const chapterName = mastery?.chapterName || 'Integers';

  // Discover subject name dynamically from syllabus
  useEffect(() => {
    if (!chapterId) return;
    const controller = new AbortController();

    import('@/app/pal/data/pal')
      .then(({ fetchPalLanding }) => fetchPalLanding({ signal: controller.signal }))
      .then((landing) => {
        for (const subj of landing.subjects) {
          if (subj.chapters.some((c) => String(c.id) === String(chapterId))) {
            setSubjectName(subj.name);
            break;
          }
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [chapterId]);

  // Persist completed steps to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(
        `pal_completed_steps_${chapterId}`,
        JSON.stringify(Array.from(completedSteps))
      );
    } catch {}
  }, [completedSteps, chapterId]);

  // Pre-unlock completed steps if backend shows diagnostic or practice already done
  useEffect(() => {
    if (!chapterId) return;
    try {
      sessionStorage.setItem('pal_active_chapter_id', chapterId);
    } catch {}
    fetchAdaptiveConcepts(chapterId)
      .then((data) => {
        if (data?.hasDiagnostic) {
          setCompletedSteps((prev) => new Set([...prev, 'diagnostic']));
        }
        if (data?.concepts?.some((c) => c.practiceAttempts > 0)) {
          setCompletedSteps((prev) => new Set([...prev, 'adaptive']));
        }
      })
      .catch(() => undefined);
  }, [chapterId]);

  // Load and cache web-searched journey images for this subject & chapter
  useEffect(() => {
    let active = true;
    fetch(`/api/pal/journey-images?subject=${encodeURIComponent(subjectName)}&chapter=${encodeURIComponent(chapterName)}`)
      .then((res) => res.json())
      .then((data) => {
        if (active && data?.images) {
          setJourneyImages(data.images);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [subjectName, chapterName]);

  const load = useCallback((opts?: { retake?: boolean }) => {
    const controller = new AbortController();
    // Deferred so setState never fires synchronously inside the effect body -
    // the convention the rest of app/pal follows, and what
    // react-hooks/set-state-in-effect enforces.
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      startChapterDiagnostic(chapterId, controller.signal, { retake: opts?.retake ?? false })
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
          setError(reason instanceof Error ? reason.message : 'The chapter diagnostic couldn’t be loaded.');
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
    // ?retake=1 arrives from the history page's "Retake chapter diagnostic"
    // link - the learner already reviewed their result there and explicitly
    // chose to retake, so this skips straight past the already-attempted
    // gate instead of showing it a second time. Harmless if it fires twice
    // (e.g. once completion resolves): resume() always wins over a forced
    // retake server-side, so this can never strand or duplicate a paper.
    const forceNewFromUrl = searchParams?.get('retake') === '1';
    return load({ retake: forceNewFromUrl });
  }, [load, checkingCompletion, completion.isComplete, searchParams]);

  const submit = useCallback(async () => {
    if (!paper?.attemptId || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const outcome = await submitChapterDiagnostic({ attemptId: paper.attemptId, answers });
      if (outcome.result) {
        setSummary(outcome.result);
        setSubmitting(false);
        setCompletedSteps((prev) => new Set([...prev, 'diagnostic']));
      } else {
        // No score payload to summarise - go straight to the result page,
        // which re-fetches it itself, rather than show a summary with nothing in it.
        router.push(`/pal/diagnostic/result/${paper.attemptId}`);
      }
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'The chapter diagnostic couldn’t be submitted.');
      setSubmitting(false);
    }
  }, [paper, answers, submitting, router]);

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

  const handleStepComplete = useCallback((stepId: JourneyStepId) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(stepId);
      return next;
    });
  }, []);

  const handleNextStep = useCallback(
    (nextStepId: JourneyStepId) => {
      if (nextStepId === 'adaptive') {
        router.push(`/pal/adaptive/chapter/${chapterId}`);
        return;
      }
      if (nextStepId === 'plan') {
        router.push(`/pal/plan/chapter/${chapterId}`);
        return;
      }
      setSelectedStep(nextStepId);
    },
    [chapterId, router]
  );

  const handleSelectStep = useCallback(
    (stepId: JourneyStepId) => {
      if (!isStepUnlocked(stepId, completedSteps)) {
        return;
      }
      if (stepId === 'adaptive') {
        router.push(`/pal/adaptive/chapter/${chapterId}`);
        return;
      }
      if (stepId === 'plan') {
        router.push(`/pal/plan/chapter/${chapterId}`);
        return;
      }
      setSelectedStep(stepId);
    },
    [completedSteps, chapterId, router]
  );

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
  // the question bank, not something the learner did. Excludes
  // 'already_attempted', which also has a null attemptId (no NEW paper was
  // drawn) but for a completely different, non-error reason handled below.
  if (paper && !paper.attemptId && paper.attemptStatus !== 'already_attempted') {
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

  // A submitted attempt already exists and no in_progress one is being
  // resumed - show the previous result and offer a retake instead of
  // silently drafting a second attempt the learner never asked for. See
  // DiagnosticService::previousAttempt() on the backend.
  if (paper && paper.attemptStatus === 'already_attempted' && paper.previousAttempt) {
    return (
      <Shell chapterId={chapterId}>
        <DiagnosticAlreadyAttemptedGate
          previous={paper.previousAttempt}
          onRetake={() => load({ retake: true })}
        />
      </Shell>
    );
  }

  // Submitted. A reveal dialog shows the score/tier moment, then sends the
  // learner straight into the readiness analysis on the result page - see
  // the module doc comment.
  if (summary) {
    return (
      <DiagnosticScoreSummary
        result={summary}
        totalQuestions={total}
        onContinue={() => router.push(`/pal/diagnostic/result/${summary.attemptId}`)}
      />
    );
  }

  const navigatorItems = questions.map((question) => ({
    id: question.questionId,
    answered: answers[question.questionId] != null,
  }));

  const currentStepTitle = getJourneyStepTitle(selectedStep, chapterName);
  const currentStepDescription = getJourneyStepDescription(selectedStep);

  const headerActions = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setShowClassicJourney((v) => !v)}
      className={cn(
        'border-slate-200 transition-colors',
        showClassicJourney && 'bg-slate-100 border-indigo-300 text-indigo-700'
      )}
    >
      <ListOrdered className="mr-1.5 h-3.5 w-3.5" />
      {showClassicJourney ? 'Hide journey list' : 'Show journey list'}
    </Button>
  );

  const progressSection = (
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
  );

  const classicJourneySection = (
    <PalRailSection title="Journey steps">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <JourneyStepList
          current={selectedStep ?? 'diagnostic'}
          completed={Array.from(completedSteps)}
          orientation="vertical"
        />
      </div>
    </PalRailSection>
  );

  const rail = selectedStep ? (
    <>
      <SelectedJourneyStepRail
        selectedStep={selectedStep}
        images={journeyImages}
        subjectName={subjectName}
        chapterName={chapterName}
        completedSteps={completedSteps}
        onSelectStep={handleSelectStep}
        onBackToCollage={() => setSelectedStep(null)}
      />

      {selectedStep === 'diagnostic' && progressSection}

      {showClassicJourney && classicJourneySection}
    </>
  ) : null;

  const diagnosticExamQuestions = (
    <>
      {paper?.resumed && (
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

      {/* Small screens only */}
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
          disabled={submitting}
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
    </>
  );

  return (
    <Shell
      chapterId={chapterId}
      rail={rail}
      actions={selectedStep !== null ? headerActions : undefined}
      title={currentStepTitle}
      description={currentStepDescription}
      constrainMeasure={selectedStep !== null}
    >
      {selectedStep === null ? (
        <div className="space-y-6">
          <H5PJourneyCollage
            subjectName={subjectName}
            chapterName={chapterName}
            activeStep={null}
            completedSteps={completedSteps}
            onSelectStep={handleSelectStep}
            images={journeyImages}
          />

          <MainJourneyOverview
            subjectName={subjectName}
            chapterName={chapterName}
            completedSteps={completedSteps}
            onStartNextStep={() => {
              for (const step of JOURNEY_STEPS) {
                if (isStepUnlocked(step.id, completedSteps) && !completedSteps.has(step.id)) {
                  handleSelectStep(step.id);
                  return;
                }
              }
              handleSelectStep('diagnostic');
            }}
          />
        </div>
      ) : (
        <JourneyStepContent
          stepId={selectedStep}
          chapterId={chapterId}
          chapterName={chapterName}
          subjectName={subjectName}
          diagnosticContent={diagnosticExamQuestions}
          onStepComplete={handleStepComplete}
          onNextStep={handleNextStep}
          onBackToCollage={() => setSelectedStep(null)}
          isCompleted={completedSteps.has(selectedStep)}
        />
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Score tiers
// ---------------------------------------------------------------------------
// Four bands over the raw percentage -- deliberately a different axis from
// `result.level` (the server's beginner/developing/proficient/advanced
// mastery read, still shown as its own pill below). This one drives only the
// headline, the tone of the ring, and which tiers get a confetti moment; it
// never feeds back into scoring or the level badge.

interface ScoreTier {
  key: 'excellent' | 'great' | 'good' | 'keep-going';
  label: string;
  subtitle: string;
  icon: LucideIcon;
  tone: { bg: string; icon: string; fg: string };
  /** Only the top band gets the full-viewport moment -- reward tied to a genuinely strong result, not to finishing. */
  fullScreenCelebration: boolean;
}

const SCORE_TIERS: readonly ScoreTier[] = [
  {
    key: 'excellent',
    label: 'Excellent!',
    subtitle: 'Great understanding of this chapter.',
    icon: Trophy,
    tone: { bg: 'var(--h5p-success-soft)', icon: 'var(--h5p-success)', fg: 'color-mix(in srgb, var(--h5p-success) 80%, #000)' },
    fullScreenCelebration: true,
  },
  {
    key: 'great',
    label: 'Great work!',
    subtitle: 'A few gaps are worth a closer look before you move on.',
    icon: Sparkles,
    tone: { bg: 'var(--h5p-accent-soft)', icon: 'var(--h5p-accent)', fg: 'var(--h5p-accent-deep)' },
    fullScreenCelebration: false,
  },
  {
    key: 'good',
    label: 'Good start!',
    subtitle: 'The concept diagnostic will help close the gaps.',
    icon: ThumbsUp,
    tone: {
      bg: 'var(--h5p-reward-soft)',
      icon: 'var(--h5p-reward)',
      fg: 'color-mix(in srgb, var(--h5p-warning) 84%, #000)',
    },
    fullScreenCelebration: false,
  },
  {
    key: 'keep-going',
    label: 'Keep going!',
    subtitle: 'This is exactly what a diagnostic is for — now you know where to start.',
    icon: TrendingUp,
    tone: { bg: 'var(--h5p-surface-sunken)', icon: 'var(--h5p-ink-muted)', fg: 'var(--h5p-ink-muted)' },
    fullScreenCelebration: false,
  },
] as const;

function scoreTierFor(percentage: number): ScoreTier {
  if (percentage >= 80) return SCORE_TIERS[0];
  if (percentage >= 60) return SCORE_TIERS[1];
  if (percentage >= 40) return SCORE_TIERS[2];
  return SCORE_TIERS[3];
}

/**
 * One small, finite gesture per tier's icon, playing once after the headline
 * has popped in -- this is what gives the lowest band (no confetti, no ring
 * sweep to speak of at a low score) its own "light encouraging" /
 * "supportive" motion rather than leaning on the generic entrance alone.
 * Never `repeat: Infinity` -- a reward tied to a real result plays once, the
 * same reasoning `h5p.css` gives for the one deliberate looping exception
 * (`h5p-ping`) being an affordance, not decoration.
 */
const TIER_ICON_MOTION: Record<ScoreTier['key'], Record<string, number[]>> = {
  excellent: { rotate: [0, -10, 10, -6, 0], scale: [1, 1.15, 1.05, 1.1, 1] },
  great: { rotate: [0, -14, 12, -8, 0] },
  good: { rotate: [0, -14, 4, 0] },
  'keep-going': { y: [0, -4, 0, -4, 0] },
};

/**
 * The score reveal shown immediately after submit, before the result page.
 *
 * Everything here comes from the same `ChapterDiagnosticResult` the result
 * page reads - no second request - so this is a rendering choice, not a new
 * data path. It reports only the raw outcome (score, tier, correct/incorrect/
 * unanswered, mastery level) as a moment, not an analysis; the result page it
 * hands off to is where that outcome turns into readiness analysis
 * (strengths, weaknesses, what to focus on next, the full concept breakdown
 * and answer review).
 *
 * Built on `app/h5p/components/game.tsx` -- the same "finished" primitives
 * every H5P activity in this product already ends on (trophy, count-up,
 * confetti) -- rather than a bespoke completion design, with the ring
 * layered on top of them.
 *
 * ---------------------------------------------------------------------------
 * A DIALOG, NOT A PAGE
 * ---------------------------------------------------------------------------
 * This used to render a full "Diagnostic submitted" page: a title, a rail, an
 * inline score card, metric cards, a concept-breakdown preview and an
 * achievement row -- all of which duplicated `/pal/diagnostic/result/[id]`
 * (score, correct/incorrect/unanswered, concept breakdown, mastery level,
 * and a genuinely fuller "Review answers" via `AnswerReviewButton`). Now it
 * renders nothing of its own but a real `Dialog` (`components/ui/dialog`,
 * Radix underneath -- the same modal every other confirmation in this app
 * already uses, per the design system's "reuse variants, never fork" rule)
 * over a bare backdrop. It auto-opens on mount (no trigger), gets its own
 * confetti rain for a strong result, and every way of leaving it -- the one
 * CTA, Escape, an outside click -- calls `onContinue`, which the caller wires
 * to `router.push('/pal/diagnostic/result/[attemptId]')`. There is nothing
 * left behind the dialog to reveal, so there is nothing to flash.
 */
export function DiagnosticScoreSummary({
  result,
  totalQuestions,
  onContinue,
}: {
  result: ChapterDiagnosticResult;
  totalQuestions: number;
  onContinue: () => void;
}) {
  const reduceMotion = !!useFramerReducedMotion();
  const questionCount = result.totalQuestions || totalQuestions;
  const percentage = Math.max(0, Math.min(100, Math.round(result.percentage)));
  const level = (result.level || '').toLowerCase();
  const tone = LEVEL_TONE[level] ?? LEVEL_TONE.beginner;
  const tier = scoreTierFor(percentage);
  // The contained burst (inside the dialog) covers "great" and "excellent" --
  // the same threshold `deriveAchievements` uses for "Sharp". "Excellent"
  // additionally gets the confetti rain, below.
  const celebrate = tier.key === 'excellent' || tier.key === 'great';
  const TierIcon = tier.icon;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      {/* The whole result in one announcement -- a screen reader user gets
          this the moment the page updates, same as `ResultScreen`, whether
          or not they ever interact with the dialog's own visual content. */}
      <p className="sr-only" aria-live="polite">
        {`${result.correct} out of ${questionCount}, ${percentage} percent. ${tier.label}${level ? ` ${level} level.` : ''}`}
      </p>

      <ConfettiRain show={tier.fullScreenCelebration} />

      {/* Always open: nothing below it is ever revealed, so there is no
          local "closed" state to hold -- every dismissal path (the CTA,
          Escape, an outside click) calls `onContinue` directly, which
          navigates away and unmounts this along with everything else on
          the exam page. */}
      <Dialog open onOpenChange={(open) => { if (!open) onContinue(); }}>
        <DialogContent className="w-full max-w-sm overflow-visible border-0 bg-transparent p-0 shadow-none">
          <div className="h5p-surface h5p-stage relative overflow-visible rounded-[var(--h5p-radius-lg)] p-6 text-center sm:p-7">
            <Celebration show={celebrate} />

            <div className="relative flex flex-col items-center">
              {/* The ring takes its colour from the score tier (the headline
                  right below it), not from `tone` -- that token is the
                  mastery-level pill's own colour, a related but distinct read
                  on the same attempt, and the two can disagree. */}
              <ScoreRing percentage={percentage} color={tier.tone.icon} reduceMotion={reduceMotion} />

              <DialogTitle
                className="mt-3 flex items-center justify-center gap-2 text-2xl font-extrabold"
                style={{ color: tier.tone.icon }}
              >
                <motion.span
                  className="inline-flex"
                  animate={reduceMotion ? undefined : TIER_ICON_MOTION[tier.key]}
                  transition={{ duration: 0.7, delay: 0.6, ease: 'easeInOut' }}
                >
                  <TierIcon className="h-6 w-6" aria-hidden="true" />
                </motion.span>
                {tier.label}
              </DialogTitle>

              <DialogDescription className="mx-auto mt-1.5 max-w-xs text-sm text-[color:var(--h5p-ink-muted)]">
                {tier.subtitle}
              </DialogDescription>

              <p className="mt-3 text-sm text-[color:var(--h5p-ink-muted)]">
                {result.correct} of {questionCount} correct
                {result.unanswered > 0 && ` · ${result.unanswered} unanswered`}
              </p>

              {level && (
                <span
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize"
                  style={{ background: tone.bg, color: tone.fg }}
                >
                  {level}
                </span>
              )}

              <PrimaryAction
                onClick={onContinue}
                icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                className="mt-6 w-full justify-center"
                autoFocus
              >
                See your results
              </PrimaryAction>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
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

  // The arc sweep below draws nothing at 0% -- `strokeDashoffset` starts and
  // ends at the same value, so a 0% result (exactly the case a diagnostic
  // exists to surface gently, and not a rare one) would otherwise show no
  // ring motion at all. Everything on this component from here down is
  // therefore keyed to the ring's OWN entrance and settle, never to the
  // score, so there is always something to see regardless of the number.
  const [settled, setSettled] = useState(reduceMotion);
  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setTimeout(() => setSettled(true), 1300);
    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  return (
    <motion.div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Score"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.55, rotate: -60 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {/* A sonar-style ring once the sweep settles: opacity and scale only,
          never colour, so this animates correctly on a framer-motion
          MotionValue whether or not `color` is a resolvable CSS colour or a
          `var(--h5p-*)` token the browser has to look up. */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ border: `3px solid ${color}` }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={settled && !reduceMotion ? { opacity: [0.6, 0], scale: [0.8, 1.4] } : { opacity: 0 }}
        transition={{ duration: 0.75, ease: 'easeOut' }}
      />

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
        <motion.span
          className="text-3xl font-extrabold tabular-nums text-[color:var(--h5p-ink)]"
          animate={settled && !reduceMotion ? { scale: [1, 1.14, 1] } : {}}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {shown}%
        </motion.span>
      </div>
    </motion.div>
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

function Shell({
  chapterId,
  rail,
  actions,
  title = 'Chapter diagnostic',
  description = 'Fifteen questions — five easy, five medium and five hard. This finds where to start; it is not a test you can fail.',
  children,
  constrainMeasure = true,
}: {
  chapterId: string;
  rail?: React.ReactNode;
  actions?: React.ReactNode;
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  constrainMeasure?: boolean;
}) {
  return (
    <PalWorkspace
      title={title}
      description={description}
      backHref="/pal"
      backLabel="Back to subjects"
      actions={actions}
      rail={
        rail !== undefined ? rail : (
          <PalRailSection title="Your journey">
            <JourneyRail current="diagnostic" orientation="vertical" />
          </PalRailSection>
        )
      }
      constrainMeasure={constrainMeasure}
    >
      {children}
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
