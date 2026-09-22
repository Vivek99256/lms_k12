'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  startChapterDiagnostic,
  submitChapterDiagnostic,
  BAND_ORDER,
  type ChapterDiagnosticPaper,
  type DiagnosticQuestionItem,
} from '@/app/pal/data/pal-diagnostic';
import { BandChip, bandLabel } from '@/app/pal/_components/BandMeter';
import { JourneyRail } from '@/app/pal/_components/JourneyRail';
import { PalRailSection, PalRailStat, PalWorkspace } from '@/app/pal/_components/PalWorkspace';

/**
 * Stage 1 - the chapter diagnostic.
 *
 * Fifteen multiple-choice questions drawn from one chapter: five easy, five
 * medium and five hard. The result is the input to every stage after it, which
 * is why this is a full page rather than the modal the old DOK-sampled
 * diagnostic used - fifteen questions do not belong in an overlay.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SCREEN DOES NOT DO
 * ---------------------------------------------------------------------------
 * It does not mark anything. The served payload carries options only, with no
 * answer key, and correctness is resolved server-side from the submitted
 * answer_master id. There is deliberately nowhere in this file that could show
 * a tick or a cross while the paper is being sat.
 *
 * It also does not decide the paper. A chapter that cannot fill all three bands
 * comes back with `attemptId: null` and a machine `reason`; only 23 of 150
 * chapters on this estate can, so that path is ordinary and is explained rather
 * than rendered as an error.
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
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

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

  useEffect(() => load(), [load]);

  const submit = useCallback(async () => {
    if (!paper?.attemptId || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const outcome = await submitChapterDiagnostic({ attemptId: paper.attemptId, answers });
      router.push(`/pal/diagnostic/result/${outcome.result?.attemptId ?? paper.attemptId}`);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'The chapter diagnostic could not be submitted.');
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
  // boolean the linter can check statically.
  const timerRunning = secondsLeft !== null && secondsLeft > 0;

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

  /**
   * Questions grouped into their bands, in BAND_ORDER, each carrying the
   * number the learner actually sees.
   *
   * The number is assigned HERE, over the grouped order, rather than being the
   * question's position in `paper.questions`. The paper is drawn interleaved,
   * so the flat position gave Easy "1, 2, 4, 13, 18" and Medium "6, 9, 10, 15"
   * - correct indices into a flat list nobody is ever shown, and nonsense
   * beside the bands the questions are actually read in. Numbering the rendered
   * order instead runs 1..n straight down the page and keeps every number
   * unique across the three bands, so "question 7" means one question.
   */
  const grouped = useMemo(() => {
    const out = new Map<string, DiagnosticQuestionItem[]>();
    (paper?.questions ?? []).forEach((question) => {
      const band = (question.difficulty || 'untagged').toLowerCase();
      out.set(band, [...(out.get(band) ?? []), question]);
    });

    const ordered: Array<[string, DiagnosticQuestionItem[]]> = [];
    BAND_ORDER.forEach((band) => {
      if (out.has(band)) ordered.push([band, out.get(band)!]);
    });
    out.forEach((items, band) => {
      if (!BAND_ORDER.includes(band as never)) ordered.push([band, items]);
    });

    let number = 0;

    return ordered.map(
      ([band, items]) =>
        [band, items.map((question) => ({ question, number: ++number }))] as [
          string,
          Array<{ question: DiagnosticQuestionItem; number: number }>,
        ]
    );
  }, [paper]);

  const total = paper?.questions.length ?? 0;
  const answered = Object.keys(answers).length;

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

  // Progress, the clock and the band breakdown are context, not the task, so on
  // a wide screen they live in the rail where they stay visible without
  // competing with the questions.
  const rail = (
    <>
      <PalRailSection title="Progress">
        <PalRailStat label="Answered" value={`${answered} of ${total}`} />
        {secondsLeft !== null && (
          <PalRailStat
            label="Time left"
            value={formatClock(secondsLeft)}
            tone={secondsLeft <= 120 ? 'warning' : 'default'}
          />
        )}
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
        {answered < total && (
          <p className="mt-2 text-xs text-slate-500">
            You can submit before answering them all.
          </p>
        )}
      </PalRailSection>

      {grouped.length > 0 && (
        <PalRailSection title="By difficulty">
          {grouped.map(([band, items]) => {
            const done = items.filter(({ question }) => answers[question.questionId]).length;
            return (
              <PalRailStat
                key={band}
                label={bandLabel(band)}
                value={`${done}/${items.length}`}
                tone={done === items.length ? 'positive' : 'default'}
              />
            );
          })}
        </PalRailSection>
      )}

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
            . The clock starts again from the full time.
          </p>
        </div>
      )}

      {/* Small screens only. The rail carries these on desktop, but it sits
          BELOW the questions on a phone, so a timer that lived only there would
          scroll out of sight exactly when it matters. */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {answered} of {total} answered
            </span>
            {answered < total && (
              <span className="text-xs text-slate-500">You can submit before answering them all.</span>
            )}
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

      <div className="space-y-6">
        {grouped.map(([band, items]) => (
          <section key={band} aria-labelledby={`band-${band}`}>
            <div className="mb-2 flex items-center gap-2">
              <h2 id={`band-${band}`} className="text-sm font-semibold text-slate-900">
                {bandLabel(band)}
              </h2>
              <span className="text-xs text-slate-500">{items.length} questions</span>
            </div>

            <div className="space-y-3">
              {items.map(({ question, number }) => (
                <QuestionCard
                  key={question.questionId}
                  question={question}
                  index={number}
                  selected={answers[question.questionId] ?? null}
                  onSelect={(optionId) =>
                    setAnswers((previous) => ({ ...previous, [question.questionId]: optionId }))
                  }
                  disabled={submitting}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
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
    </Shell>
  );
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
  selected,
  onSelect,
  disabled,
}: {
  question: DiagnosticQuestionItem;
  index: number;
  selected: string | null;
  onSelect: (optionId: string) => void;
  disabled: boolean;
}) {
  const name = `question-${question.questionId}`;

  return (
    <Card data-pal-question-id={question.questionId}>
      <CardContent className="pt-5">
        <fieldset disabled={disabled}>
          <legend className="sr-only">
            Question {index}, {bandLabel(question.difficulty).toLowerCase()}
          </legend>

          <div className="mb-3 flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold tabular-nums text-slate-600">
              {index}
            </span>
            <div className="min-w-0 flex-1">
              {/* The band sits with the number rather than off at the right
                  edge: the two are read as one label ("7, medium"), and on a
                  phone a right-aligned chip was squeezed to the far side of a
                  long question title. */}
              <div
                className="text-sm font-medium text-slate-900 [&_img]:max-w-full"
                // Question bodies are authored HTML in lms_question_master and
                // contain markup and figures; the rest of PAL renders them the
                // same way.
                dangerouslySetInnerHTML={{ __html: question.title }}
              />
            </div>
          </div>

          <div className="space-y-1.5 pl-9">
            {question.options.map((option, optionIndex) => {
              const isSelected = selected === option.id;

              return (
                <label
                  key={option.id}
                  data-pal-option-id={option.id}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    isSelected
                      ? 'border-indigo-400 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
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
