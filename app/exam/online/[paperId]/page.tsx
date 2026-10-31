'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Info,
  Loader2,
  Maximize,
  Minimize,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchOnlineExam,
  formatExamTimestamp,
  isStudentProfile,
  submitOnlineExam,
  type OnlineExamPaper,
} from '@/app/exam/data/onlineExam';
import { submitProctoringSession } from '@/app/exam/data/proctoring';
import { useExamProctoring } from '@/app/exam/online/_hooks/use-exam-proctoring';
import { askAssistant, setExamHelpFocus } from '@/lib/exam-help';

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
  const [profileReady, setProfileReady] = useState(false);

  const startedAtRef = useRef<string>('');
  const submittedRef = useRef(false);
  const restoredSessionRef = useRef('');
  const proctoringEnabled = profileReady && !notStudent;
  const {
    sessionId: proctoringSessionId,
    error: proctoringError,
    warning: proctoringWarningMessage,
    warningHistory,
    fullscreenActive,
    restrictionsActive,
    serverRemainingSeconds,
    settings,
    tabSwitchCount,
    violationCount,
    criticalViolationCount,
    restoredAnswers,
    autoSubmitReason,
    existingOnlineExamId,
    ensureSession: ensureProctoringSession,
    persistLocalDraft,
    saveDraft: saveProctoringDraft,
    markSubmitted: markProctoringSubmitted,
    toggleFullscreen,
    retry: retryProctoring,
  } = useExamProctoring(paper?.id ?? '', proctoringEnabled);

  // --- profile note (deferred to avoid SSR/hydration mismatch) ------------
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setNotStudent(!isStudentProfile());
        setProfileReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The chat panel reads which question the student is on from here; it only applies on this screen.
  useEffect(() => () => setExamHelpFocus(null), []);

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
        setError(reason instanceof Error ? reason.message : "Couldn't load the exam. Try again.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [paperId]);

  useEffect(() => {
    if (!proctoringSessionId || restoredSessionRef.current === proctoringSessionId) return;
    restoredSessionRef.current = proctoringSessionId;
    setMcqAnswers(restoredAnswers.mcq);
    setNarrativeAnswers(restoredAnswers.narrative);
  }, [proctoringSessionId, restoredAnswers]);

  useEffect(() => {
    if (serverRemainingSeconds === null) return;
    // The browser countdown is display-only; the server revalidates every submission.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeLeft(serverRemainingSeconds);
  }, [serverRemainingSeconds]);

  useEffect(() => {
    if (!proctoringSessionId || !restrictionsActive) return;
    persistLocalDraft({ mcq: mcqAnswers, narrative: narrativeAnswers });
    const timer = window.setTimeout(() => {
      void saveProctoringDraft({ mcq: mcqAnswers, narrative: narrativeAnswers }).catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    mcqAnswers,
    narrativeAnswers,
    proctoringSessionId,
    restrictionsActive,
    persistLocalDraft,
    saveProctoringDraft,
  ]);

  useEffect(() => {
    if (existingOnlineExamId) {
      router.replace(`/exam/online/${paperId}/result?online_exam_id=${existingOnlineExamId}`);
    }
  }, [existingOnlineExamId, paperId, router]);

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
      const proctoringWarning = Boolean(proctoringError);
      try {
        let onlineExamId: string;
        if (proctoringEnabled) {
          const currentSessionId = await ensureProctoringSession();
          if (!currentSessionId) throw new Error("Couldn't start a secure examination session. Retry before submitting.");
          await saveProctoringDraft({ mcq: mcqAnswers, narrative: narrativeAnswers });
          const result = await submitProctoringSession(currentSessionId, {
            mcq: mcqAnswers,
            narrative: narrativeAnswers,
          });
          onlineExamId = result.onlineExamId;
          markProctoringSubmitted();
        } else {
          const result = await submitOnlineExam({
            paperId,
            mcqAnswers,
            narrativeAnswers,
            startedAt: startedAtRef.current || formatExamTimestamp(new Date()),
          });
          onlineExamId = result.onlineExamId;
        }
        const warningQuery = proctoringWarning ? '&proctoring_warning=1' : '';
        router.push(
          `/exam/online/${paperId}/result?online_exam_id=${onlineExamId}${warningQuery}`
        );
      } catch (reason) {
        submittedRef.current = false;
        setSubmitError(reason instanceof Error ? reason.message : "Couldn't submit the exam. Try again.");
        setSubmitting(false);
      }
    },
    [
      paper,
      paperId,
      mcqAnswers,
      narrativeAnswers,
      isAnswered,
      router,
      proctoringEnabled,
      proctoringError,
      ensureProctoringSession,
      saveProctoringDraft,
      markProctoringSubmitted,
    ]
  );

  useEffect(() => {
    if (!autoSubmitReason || submitting || submittedRef.current) return;
    void handleSubmit(true);
  }, [autoSubmitReason, submitting, handleSubmit]);

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
    <div
      className={`min-h-full px-4 py-5 sm:px-6 ${restrictionsActive ? 'exam-proctoring-restricted' : ''}`}
      data-exam-restrictions-active={restrictionsActive ? 'true' : 'false'}
    >
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

        {!notStudent && profileReady ? (
          <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-sm text-indigo-900">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">
                  {proctoringSessionId ? 'Proctoring is active' : 'Starting proctoring'}
                </p>
                <p className="mt-0.5 text-xs text-indigo-800">
                  Copy, cut and paste are blocked across the exam, including answer fields. Tab and window changes are monitored.
                  {settings ? ` The exam submits after ${settings.tabSwitchLimit} tab switches; recorded: ${tabSwitchCount}.` : ''}
                </p>
                <p className="mt-1 text-xs text-indigo-800">
                  Screenshot shortcuts are recorded when detectable, but browser controls cannot prevent operating-system screenshots or external capture.
                </p>
                <p className="mt-1 text-xs text-indigo-800">
                  {violationCount} violation{violationCount === 1 ? '' : 's'} recorded ({criticalViolationCount} critical). The exam timer is synchronized with the server.
                </p>
              </div>
            </div>
            {proctoringSessionId ? (
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                aria-label={fullscreenActive ? 'Exit fullscreen mode' : 'Enter fullscreen mode'}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                {fullscreenActive ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
                {fullscreenActive ? 'Exit fullscreen' : 'Enter fullscreen'}
              </button>
            ) : null}
          </div>
        ) : null}

        {proctoringWarningMessage ? (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <p className="font-semibold">Proctoring warning</p>
            <p className="mt-1">{proctoringWarningMessage}</p>
            {warningHistory.length > 1 ? (
              <ul className="mt-2 list-inside list-disc text-xs">
                {warningHistory.slice(0, 5).map((warning, index) => (
                  <li key={`${index}-${warning}`}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {proctoringError ? (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{proctoringError}</span>
            </span>
            {!proctoringSessionId && !notStudent ? (
              <button
                type="button"
                onClick={retryProctoring}
                className="shrink-0 font-semibold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : null}

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
                onFocusCapture={() => setExamHelpFocus({ paperId, questionId: question.id })}
                onPointerDownCapture={() => setExamHelpFocus({ paperId, questionId: question.id })}
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{question.title}</p>
                      <span className="flex shrink-0 items-center gap-3 text-xs text-slate-400">
                        <button
                          type="button"
                          onClick={() => {
                            setExamHelpFocus({ paperId, questionId: question.id });
                            askAssistant('Show me the answer to this question and explain it.');
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100"
                        >
                          <Sparkles className="size-3.5" />
                          Ask AI
                        </button>
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
                        className="mt-3 select-text"
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
