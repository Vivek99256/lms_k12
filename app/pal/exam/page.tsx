'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Clock, GraduationCap, Loader2, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { QuestionPlayer, libraryForQuestion } from '@/components/h5p/players';
import type { QuestionResult } from '@/components/h5p/players/types';
import {
  splitSubmissions,
  submissionFor,
  toPlayerQuestion,
  type PalSubmission,
} from '@/lib/pal/exam-answers';
import {
  fetchPalQuiz,
  formatQuizTimestamp,
  submitPalQuiz,
  type PalChapterContext,
  type PalQuestion,
  type PalQuizData,
} from '@/app/pal/data/pal';

/**
 * The PAL Test.
 *
 * EVERY QUESTION IS AN H5P ACTIVITY, CHOSEN FROM ITS OWN FORM. This page used
 * to draw one thing: a stem and a list of radio buttons. That was wrong for
 * most of the bank -- a fill-in-the-blank question became four options to pick
 * between, a match-the-following became a list -- and it was a second renderer
 * to keep in step with the H5P library's players.
 *
 * It now hands each question to `QuestionPlayer`, which reads the question's
 * recorded form and renders the matching player: multiple choice as a single
 * choice set, true/false as True or false, fill-in-the-blank as Blanks, match
 * the following as a matching activity, and so on for every form the platform
 * has built. Nothing is converted and no H5P record is created -- the question
 * bank row IS the content, and `lib/h5p/question-bank-runtime.ts` builds the
 * activity in the browser at render time.
 *
 * WHAT THIS PAGE STILL OWNS. Timing, the paper, and the submission. A player
 * scores its own activity and reports the outcome through `onResult`; it never
 * persists anything. This page collects those outcomes, turns each into
 * something `palController@store` can record (`lib/pal/exam-answers.ts`) and
 * submits the paper once.
 */
export default function PalExamPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Preparing quiz...
        </div>
      }
    >
      <PalExamContent />
    </Suspense>
  );
}

function PalExamContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const context = useMemo<PalChapterContext>(
    () => ({
      gradeId: searchParams?.get('grade_id') ?? '',
      subjectId: searchParams?.get('subject_id') ?? '',
      chapterId: searchParams?.get('chapter_id') ?? '',
      standardId: searchParams?.get('standard_id') ?? '',
      enrollmentNo: searchParams?.get('enrollment_no') ?? undefined,
    }),
    [searchParams]
  );

  const hasContext = Boolean(context.chapterId && context.standardId);
  // Guest "view as student" preview: there is no real learner to record against,
  // so the quiz is scored client-side instead of writing to the backend.
  const isGuest = searchParams?.get('guest') === '1';

  const [quiz, setQuiz] = useState<PalQuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /**
   * questionId -> what the player reported when the learner finished it.
   *
   * The player is the only thing that knows whether an activity was answered
   * correctly -- it holds the attempt and it does the scoring -- so this page
   * stores the verdict rather than the raw interaction. A question with no
   * entry here was never finished, which is what "unanswered" means on submit.
   */
  const [results, setResults] = useState<Record<string, QuestionResult>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<{ correct: number; total: number } | null>(null);

  const startedAtRef = useRef<string>('');
  const attemptTimesRef = useRef<Record<string, number>>({});
  const activeQuestionRef = useRef<string>('');
  const submittedRef = useRef(false);
  // Which question is currently in view, for the ONE overall "Question X of
  // N" counter in the sticky header -- mirrored from `activeQuestionRef`
  // (already tracked for per-question attempt time) into state, since a ref
  // does not re-render. This is the single source of "where am I", not
  // anything an individual player draws for itself.
  const [activeIndex, setActiveIndex] = useState(0);
  // Read inside `handleSubmit`, which must not be rebuilt on every answer: the
  // countdown effect depends on it, and a new identity each keystroke would
  // restart the timer.
  const resultsRef = useRef(results);
  resultsRef.current = results;

  // --- load the adaptive quiz --------------------------------------------
  useEffect(() => {
    if (!hasContext) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchPalQuiz(context, controller.signal);
        if (controller.signal.aborted) return;
        if (result.questions.length === 0) {
          setError(result.message || 'No questions are available for this chapter yet.');
          setQuiz(null);
        } else {
          setQuiz(result);
          startedAtRef.current = formatQuizTimestamp(new Date());
          setTimeLeft(result.timeAllowedMinutes * 60);
        }
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Unable to start the quiz.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [context, hasContext]);

  const recordResult = useCallback((questionId: string, result: QuestionResult) => {
    setResults((prev) => ({ ...prev, [questionId]: result }));
  }, []);

  const handleSubmit = useCallback(
    async (auto: boolean) => {
      if (!quiz || submittedRef.current) return;
      const finished = resultsRef.current;

      if (!auto) {
        const unanswered = quiz.questions.filter((q) => !finished[q.questionId]).length;
        if (unanswered > 0) {
          const proceed = window.confirm(
            `${unanswered} question${unanswered === 1 ? '' : 's'} not finished. ` +
              'An activity counts as answered once you check or complete it. Submit anyway?'
          );
          if (!proceed) return;
        }
      }
      submittedRef.current = true;

      // Guest preview → score client-side from what the players reported.
      if (isGuest) {
        const correct = quiz.questions.filter(
          (q) => finished[q.questionId]?.correct === true
        ).length;
        setPreviewResult({ correct, total: quiz.questions.length });
        return;
      }

      const submissions: PalSubmission[] = quiz.questions
        .filter((question) => finished[question.questionId])
        .map((question) => submissionFor(question, finished[question.questionId]))
        // `submissionFor` returns null for an activity that could not be
        // marked at all. Dropping it records the question as unattempted,
        // which is true; submitting it would record the learner as wrong,
        // which is not.
        .filter((submission): submission is PalSubmission => submission !== null);
      const { options, interactive } = splitSubmissions(submissions);

      setSubmitting(true);
      setSubmitError(null);
      try {
        const result = await submitPalQuiz({
          context: quiz.context,
          paperName: quiz.paperName,
          totalMarks: quiz.totalMarks,
          timeAllowedMinutes: quiz.timeAllowedMinutes,
          answers: options,
          interactiveAnswers: interactive,
          attemptTimes: attemptTimesRef.current,
          questionIds: quiz.questions.map((q) => q.questionId),
          startedAt: startedAtRef.current || formatQuizTimestamp(new Date()),
        });
        const query = new URLSearchParams({
          id: result.questionPaperId,
          online_exam_id: result.onlineExamId,
        });
        router.push(`/pal/result?${query.toString()}`);
      } catch (reason) {
        submittedRef.current = false;
        setSubmitError(reason instanceof Error ? reason.message : 'Unable to submit the quiz.');
        setSubmitting(false);
      }
    },
    [quiz, router, isGuest]
  );

  // --- countdown timer (auto-submit on expiry) ---------------------------
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-submit on timer expiry
      void handleSubmit(true);
      return;
    }
    const timer = window.setTimeout(() => setTimeLeft((prev) => (prev === null ? null : prev - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [timeLeft, handleSubmit]);

  // --- per-question attempt-time tracking --------------------------------
  useEffect(() => {
    if (!quiz) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const id = (visible.target as HTMLElement).dataset.questionId ?? '';
          activeQuestionRef.current = id;
          const idx = quiz.questions.findIndex((q) => q.questionId === id);
          if (idx >= 0) setActiveIndex(idx);
        }
      },
      { threshold: [0.25, 0.5, 0.75] }
    );
    document.querySelectorAll('[data-question-id]').forEach((node) => observer.observe(node));

    const ticker = window.setInterval(() => {
      const id = activeQuestionRef.current;
      if (!id) return;
      const current = attemptTimesRef.current[id] ?? 0;
      attemptTimesRef.current[id] = Math.min(60, current + 1);
    }, 1000);

    return () => {
      observer.disconnect();
      window.clearInterval(ticker);
    };
  }, [quiz]);

  const answeredCount = useMemo(
    () => (quiz ? quiz.questions.filter((q) => results[q.questionId]).length : 0),
    [quiz, results]
  );

  if (!hasContext) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <p className="mt-3 text-sm text-slate-600">
            Missing quiz context. Please launch the quiz from a chapter.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/pal')}>
            <ArrowLeft className="h-4 w-4" />
            Back to PAL
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Building your adaptive quiz...
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <p className="mt-3 text-sm text-slate-600">{error || 'Quiz unavailable.'}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/pal')}>
            <ArrowLeft className="h-4 w-4" />
            Back to PAL
          </Button>
        </div>
      </div>
    );
  }

  if (previewResult) {
    const pct = Math.round((previewResult.correct / Math.max(1, previewResult.total)) * 100);
    const tone = pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-rose-600';
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <GraduationCap className="h-7 w-7" />
          </span>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-indigo-500">
            Guest preview — not saved
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{quiz.paperName} complete</h1>
          <p className={`mt-4 text-5xl font-black tabular-nums ${tone}`}>{pct}%</p>
          <p className="mt-1 text-sm text-slate-600">
            {previewResult.correct} of {previewResult.total} correct
          </p>
          <p className="mx-auto mt-3 max-w-sm text-xs text-slate-500">
            This is a student-experience preview. Results are scored locally and are not recorded —
            log in as the student to save real attempts.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => router.push('/pal')}>
              <ArrowLeft className="h-4 w-4" />
              Back to PAL
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-3">
        {/* Sticky header with timer — the ONE progress readout for the whole
            paper. Every question below is embedded, so none of them draws
            its own "Question X of Y" any more; this is the only one. */}
        <div className="sticky top-0 z-10 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900">{quiz.paperName}</h1>
              <p className="text-xs text-slate-500">
                Question {Math.min(activeIndex + 1, quiz.questions.length)} of {quiz.questions.length} ·{' '}
                {answeredCount} answered
              </p>
            </div>
            <div className="flex items-center gap-3">
              <TimerPill seconds={timeLeft ?? 0} />
              <Button onClick={() => void handleSubmit(false)} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit
              </Button>
            </div>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${(answeredCount / quiz.questions.length) * 100}%` }}
            />
          </div>
        </div>

        {submitError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {submitError}
          </div>
        )}

        {/* One continuous container for every question, not a stack of
            separately bordered and shadowed cards -- a single assessment,
            not a row of independent activities that happen to be near each
            other. Each question gets a divider, not its own card. */}
        <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {quiz.questions.map((question, index) => (
            <QuestionCard
              key={question.questionId}
              question={question}
              index={index}
              done={Boolean(results[question.questionId])}
              onResult={recordResult}
            />
          ))}
        </div>

        <div className="flex justify-end pb-8">
          <Button onClick={() => void handleSubmit(false)} disabled={submitting} className="min-w-40">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit quiz
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * One question, played as whatever it is.
 *
 * The activity is derived from the question on every render, which is cheap
 * and pure, and memoised only so the player is not handed a new object each
 * time the paper's answered-count changes -- a fresh `question` prop would
 * restart an attempt the learner is halfway through.
 */
function QuestionCard({
  question,
  index,
  done,
  onResult,
}: {
  question: PalQuestion;
  index: number;
  done: boolean;
  onResult: (questionId: string, result: QuestionResult) => void;
}) {
  const playable = useMemo(() => toPlayerQuestion(question), [question]);
  const library = libraryForQuestion(playable);

  const handleResult = useCallback(
    (result: QuestionResult) => onResult(question.questionId, result),
    [onResult, question.questionId]
  );

  return (
    <section data-question-id={question.questionId} className="px-5 py-4">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            done ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
          }`}
        >
          {index + 1}
        </span>
        {/* Named, not decorative: a learner meeting a different interaction on
            every question is helped by knowing which one this is. */}
        {library && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            {library.replace(/^H5P\./, '').replace(/([a-z])([A-Z])/g, '$1 $2')}
          </span>
        )}
      </div>

      <div className="mt-2">
        <QuestionPlayer question={playable} onResult={handleResult} embedded />
      </div>
    </section>
  );
}

function TimerPill({ seconds }: { seconds: number }) {
  const safe = Math.max(0, seconds);
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  const urgent = safe <= 60;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold tabular-nums ${
        urgent ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-700'
      }`}
    >
      <Clock className="h-4 w-4" />
      {mm}:{ss}
    </span>
  );
}
