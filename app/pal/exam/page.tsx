'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Clock, GraduationCap, Loader2, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  fetchPalQuiz,
  formatQuizTimestamp,
  submitPalQuiz,
  type PalChapterContext,
  type PalQuizData,
} from '@/app/pal/data/pal';

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
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<{ correct: number; total: number } | null>(null);

  const startedAtRef = useRef<string>('');
  const attemptTimesRef = useRef<Record<string, number>>({});
  const activeQuestionRef = useRef<string>('');
  const submittedRef = useRef(false);

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

  const handleSubmit = useCallback(
    async (auto: boolean) => {
      if (!quiz || submittedRef.current) return;
      if (!auto) {
        const unanswered = quiz.questions.filter((q) => !answers[q.questionId]).length;
        if (unanswered > 0) {
          const proceed = window.confirm(
            `${unanswered} question${unanswered === 1 ? '' : 's'} left unanswered. Submit anyway?`
          );
          if (!proceed) return;
        }
      }
      submittedRef.current = true;

      // Guest preview → score client-side (answer values are "id##correctFlag").
      if (isGuest) {
        const correct = quiz.questions.filter(
          (q) => (answers[q.questionId] ?? '').split('##')[1] === '1'
        ).length;
        setPreviewResult({ correct, total: quiz.questions.length });
        return;
      }

      setSubmitting(true);
      setSubmitError(null);
      try {
        const result = await submitPalQuiz({
          context: quiz.context,
          paperName: quiz.paperName,
          totalMarks: quiz.totalMarks,
          timeAllowedMinutes: quiz.timeAllowedMinutes,
          answers,
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
    [quiz, answers, router, isGuest]
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
          activeQuestionRef.current = (visible.target as HTMLElement).dataset.questionId ?? '';
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
    () => (quiz ? quiz.questions.filter((q) => answers[q.questionId]).length : 0),
    [quiz, answers]
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
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Sticky header with timer */}
        <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">{quiz.paperName}</h1>
            <p className="text-xs text-slate-500">
              {answeredCount} of {quiz.questions.length} answered
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

        {submitError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {submitError}
          </div>
        )}

        {/* Questions */}
        <div className="space-y-4">
          {quiz.questions.map((question, index) => (
            <section
              key={question.questionId}
              data-question-id={question.questionId}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-sm font-medium text-slate-900 [&_img]:max-w-full"
                    dangerouslySetInnerHTML={{ __html: question.questionText }}
                  />
                  <div className="mt-3 space-y-2">
                    {question.options.map((option) => {
                      const value = `${option.id}##${option.correctFlag}`;
                      const selected = answers[question.questionId] === value;
                      return (
                        <label
                          key={option.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                            selected
                              ? 'border-indigo-400 bg-indigo-50 text-indigo-900'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${question.questionId}`}
                            value={value}
                            checked={selected}
                            onChange={() =>
                              setAnswers((prev) => ({ ...prev, [question.questionId]: value }))
                            }
                            className="h-4 w-4 accent-indigo-600"
                          />
                          <span className="[&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: option.answer }} />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
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
