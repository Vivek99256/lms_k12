'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Clock, Info, Loader2, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchOnlineExam,
  formatExamTimestamp,
  isStudentProfile,
  submitOnlineExam,
  type OnlineExamPaper,
} from '@/app/exam/data/onlineExam';

export default function OnlineExamAttemptPage() {
  const router = useRouter();
  const params = useParams<{ paperId: string }>();
  const paperId = params?.paperId ?? '';

  const [paper, setPaper] = useState<OnlineExamPaper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string[]>>({});
  const [narrativeAnswers, setNarrativeAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notStudent, setNotStudent] = useState(false);

  const startedAtRef = useRef<string>('');
  const submittedRef = useRef(false);

  // --- profile note (deferred to avoid SSR/hydration mismatch) ------------
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setNotStudent(!isStudentProfile());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // --- load the paper ------------------------------------------------------
  useEffect(() => {
    if (!paperId) return;
    let cancelled = false;
    const controller = new AbortController();
    fetchOnlineExam(paperId, controller.signal)
      .then((loaded) => {
        if (cancelled) return;
        setPaper(loaded);
        startedAtRef.current = formatExamTimestamp(new Date());
        setTimeLeft(loaded.timeAllowedMinutes * 60);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Unable to load the exam.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [paperId]);

  const isAnswered = useCallback(
    (questionId: string, hasOptions: boolean) =>
      hasOptions
        ? (mcqAnswers[questionId]?.length ?? 0) > 0
        : (narrativeAnswers[questionId]?.trim().length ?? 0) > 0,
    [mcqAnswers, narrativeAnswers]
  );

  const answeredCount = useMemo(
    () =>
      paper
        ? paper.questions.filter((q) => isAnswered(q.id, q.options.length > 0)).length
        : 0,
    [paper, isAnswered]
  );

  const handleSubmit = useCallback(
    async (auto: boolean) => {
      if (!paper || submittedRef.current) return;
      if (!auto) {
        const unanswered = paper.questions.filter(
          (q) => !isAnswered(q.id, q.options.length > 0)
        ).length;
        if (unanswered > 0) {
          const proceed = window.confirm(
            `${unanswered} question${unanswered === 1 ? '' : 's'} left unanswered. Submit anyway?`
          );
          if (!proceed) return;
        }
      }
      submittedRef.current = true;
      setSubmitting(true);
      setSubmitError(null);
      try {
        const result = await submitOnlineExam({
          paperId,
          mcqAnswers,
          narrativeAnswers,
          startedAt: startedAtRef.current || formatExamTimestamp(new Date()),
        });
        router.push(`/exam/online/${paperId}/result?online_exam_id=${result.onlineExamId}`);
      } catch (reason) {
        submittedRef.current = false;
        setSubmitError(reason instanceof Error ? reason.message : 'Unable to submit the exam.');
        setSubmitting(false);
      }
    },
    [paper, paperId, mcqAnswers, narrativeAnswers, isAnswered, router]
  );

  // --- countdown timer (auto-submit on expiry) ----------------------------
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-submit on timer expiry
      void handleSubmit(true);
      return;
    }
    const timer = window.setTimeout(
      () => setTimeLeft((prev) => (prev === null ? null : prev - 1)),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [timeLeft, handleSubmit]);

  const setRadio = (questionId: string, value: string) =>
    setMcqAnswers((prev) => ({ ...prev, [questionId]: [value] }));

  const toggleCheckbox = (questionId: string, value: string) =>
    setMcqAnswers((prev) => {
      const current = prev[questionId] ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [questionId]: next };
    });

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center py-24 text-sm text-slate-500">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading exam…
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="min-h-full px-4 py-5 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <AlertTriangle className="mx-auto size-8 text-amber-500" />
            <p className="mt-3 text-sm text-slate-600">{error || 'Exam unavailable.'}</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push('/exam/online')}>
              <ArrowLeft className="size-4" />
              Back to exams
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (paper.questions.length === 0) {
    return (
      <div className="min-h-full px-4 py-5 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Info className="mx-auto size-8 text-slate-400" />
            <p className="mt-3 text-sm text-slate-600">This exam has no questions.</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push('/exam/online')}>
              <ArrowLeft className="size-4" />
              Back to exams
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1400px] space-y-5">
        {/* Sticky header with timer */}
        <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900">{paper.name}</h1>
            <p className="text-xs text-slate-500">
              {answeredCount} of {paper.questions.length} answered
            </p>
          </div>
          <div className="flex items-center gap-3">
            <TimerPill seconds={timeLeft ?? 0} />
            <Button
              onClick={() => void handleSubmit(false)}
              disabled={submitting}
              className="bg-[#4f46e5] text-white hover:bg-[#4338ca]"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {submitting ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </div>

        {notStudent ? (
          <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm text-sky-700">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>You&apos;re not a student — this attempt is recorded under your account.</span>
          </div>
        ) : null}

        {submitError ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        ) : null}

        {/* Questions */}
        <div className="space-y-4">
          {paper.questions.map((question, index) => {
            const hasOptions = question.options.length > 0;
            const selected = mcqAnswers[question.id] ?? [];
            return (
              <section
                key={question.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{question.title}</p>
                      <span className="shrink-0 text-xs text-slate-400">
                        {question.points} mark{question.points === 1 ? '' : 's'}
                      </span>
                    </div>

                    {hasOptions ? (
                      <div className="mt-3 space-y-2">
                        {question.options.map((option) => {
                          const value = `${option.id}##${option.correctFlag}`;
                          const checked = selected.includes(value);
                          return (
                            <label
                              key={option.id}
                              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                                checked
                                  ? 'border-indigo-400 bg-indigo-50 text-indigo-900'
                                  : 'border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type={question.multipleAnswer ? 'checkbox' : 'radio'}
                                name={`question-${question.id}`}
                                value={value}
                                checked={checked}
                                onChange={() =>
                                  question.multipleAnswer
                                    ? toggleCheckbox(question.id, value)
                                    : setRadio(question.id, value)
                                }
                                className="size-4 accent-indigo-600"
                              />
                              <span>{option.answer}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <Textarea
                        value={narrativeAnswers[question.id] ?? ''}
                        onChange={(event) =>
                          setNarrativeAnswers((prev) => ({
                            ...prev,
                            [question.id]: event.target.value,
                          }))
                        }
                        placeholder="Type your answer…"
                        rows={4}
                        className="mt-3"
                      />
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <div className="flex justify-end pb-8">
          <Button
            onClick={() => void handleSubmit(false)}
            disabled={submitting}
            className="min-w-40 bg-[#4f46e5] text-white hover:bg-[#4338ca]"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {submitting ? 'Submitting…' : 'Submit exam'}
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
        urgent
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-slate-200 bg-slate-50 text-slate-700'
      }`}
    >
      <Clock className="size-4" />
      {mm}:{ss}
    </span>
  );
}
