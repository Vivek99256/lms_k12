'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  History,
  Lightbulb,
  Loader2,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  fetchAdaptivePractice,
  fetchPracticeHistory,
  fetchSpacedRepetition,
  submitAdaptivePractice,
  type AdaptivePracticeData,
  type PalChapterContext,
  type PracticeHistoryData,
  type PracticeQuestion,
  type PracticeSubmitResult,
  type SpacedRepetitionData,
  type SpacedRepetitionItem,
} from '@/app/pal/data/pal';

type PracticeModalKind = 'practice' | 'repetition' | 'history';

export function PracticePanel({
  studentId,
  context,
}: {
  studentId: string;
  context: PalChapterContext;
}) {
  const [modal, setModal] = useState<PracticeModalKind | null>(null);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          onClick={() => setModal('practice')}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Adaptive practice
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-sky-200 text-sky-700 hover:bg-sky-50"
          onClick={() => setModal('repetition')}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Review schedule
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-slate-200 text-slate-700 hover:bg-slate-50"
          onClick={() => setModal('history')}
        >
          <History className="h-3.5 w-3.5" />
          Practice history
        </Button>
      </div>

      {modal === 'practice' && (
        <AdaptivePracticeModal
          studentId={studentId}
          context={context}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'repetition' && (
        <SpacedRepetitionModal studentId={studentId} onClose={() => setModal(null)} />
      )}
      {modal === 'history' && (
        <PracticeHistoryModal studentId={studentId} onClose={() => setModal(null)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared modal shell
// ---------------------------------------------------------------------------

function ModalShell({
  title,
  subtitle,
  icon,
  onClose,
  headerAction,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  onClose: () => void;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/45" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              {icon}
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {headerAction}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function ModalStates({
  loading,
  error,
  loadingLabel,
}: {
  loading: boolean;
  error: string | null;
  loadingLabel: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {loadingLabel}
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error}
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Adaptive practice
// ---------------------------------------------------------------------------

function AdaptivePracticeModal({
  studentId,
  context,
  onClose,
}: {
  studentId: string;
  context: PalChapterContext;
  onClose: () => void;
}) {
  const [data, setData] = useState<AdaptivePracticeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PracticeSubmitResult | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      setResult(null);
      setAnswers({});
      try {
        const response = await fetchAdaptivePractice(
          {
            studentId,
            standardId: context.standardId,
            subjectId: context.subjectId,
            chapterId: context.chapterId,
            conceptId: '0',
            questionCount: 5,
          },
          controller.signal
        );
        if (!controller.signal.aborted) setData(response);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Unable to load practice questions.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [studentId, context, reloadKey]);

  const toggleAnswer = (question: PracticeQuestion, optionId: string) => {
    setAnswers((prev) => {
      if (question.multipleAnswer) {
        const current = Array.isArray(prev[question.id]) ? (prev[question.id] as string[]) : [];
        const next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
        return { ...prev, [question.id]: next };
      }
      return { ...prev, [question.id]: optionId };
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      setResult(await submitAdaptivePractice({ studentId, answers }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit practice.');
    } finally {
      setSubmitting(false);
    }
  };

  const answeredCount = useMemo(
    () =>
      Object.values(answers).filter((value) =>
        Array.isArray(value) ? value.length > 0 : Boolean(value)
      ).length,
    [answers]
  );

  const questions = data?.questions ?? [];

  return (
    <ModalShell
      title="Adaptive practice"
      subtitle={data?.strategy?.description || 'Targeted practice based on your mastery.'}
      icon={<Sparkles className="h-5 w-5" />}
      onClose={onClose}
    >
      <ModalStates loading={loading} error={error} loadingLabel="Generating practice questions..." />

      {!loading && !error && result && (
        <PracticeResult result={result} onPracticeAgain={() => setReloadKey((key) => key + 1)} />
      )}

      {!loading && !error && !result && questions.length === 0 && (
        <div className="py-12 text-center text-sm text-slate-500">
          No practice questions are available for this chapter yet.
        </div>
      )}

      {!loading && !error && !result && questions.length > 0 && (
        <div className="space-y-4">
          {questions.map((question, index) => (
            <div key={question.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {question.conceptName && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {question.conceptName}
                      </span>
                    )}
                    {question.difficulty && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        {question.difficulty}
                      </span>
                    )}
                  </div>
                  <div
                    className="mt-1.5 text-sm font-medium text-slate-900 [&_img]:max-w-full"
                    dangerouslySetInnerHTML={{ __html: question.title }}
                  />
                  {question.options.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {question.options.map((option) => {
                        const selected = question.multipleAnswer
                          ? Array.isArray(answers[question.id]) &&
                            (answers[question.id] as string[]).includes(option.id)
                          : answers[question.id] === option.id;
                        return (
                          <label
                            key={option.id}
                            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                              selected
                                ? 'border-indigo-400 bg-indigo-50 text-indigo-900'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type={question.multipleAnswer ? 'checkbox' : 'radio'}
                              name={`practice-${question.id}`}
                              checked={selected}
                              onChange={() => toggleAnswer(question, option.id)}
                              className="h-4 w-4 accent-indigo-600"
                            />
                            <span
                              className="[&_img]:max-w-full"
                              dangerouslySetInnerHTML={{ __html: option.answer }}
                            />
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs italic text-slate-400">
                      This question type is not answerable here.
                    </p>
                  )}
                  {question.hintText && (
                    <p className="mt-2 flex items-start gap-1 text-xs text-indigo-700">
                      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {question.hintText}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {answeredCount} of {questions.length} answered
            </span>
            <Button onClick={handleSubmit} disabled={submitting || answeredCount === 0}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
              Submit practice
            </Button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function PracticeResult({
  result,
  onPracticeAgain,
}: {
  result: PracticeSubmitResult;
  onPracticeAgain: () => void;
}) {
  const { summary } = result;
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-6">
        <Trophy className="h-8 w-8 text-emerald-600" />
        <div className="text-3xl font-bold text-emerald-700">{summary.percentage}%</div>
        <div className="text-sm text-emerald-700">
          {summary.totalCorrect} correct · {summary.totalWrong} wrong
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniStat label="Obtained" value={`${summary.obtainedMarks}/${summary.totalMarks}`} />
        <MiniStat label="Accuracy" value={`${summary.percentage}%`} />
      </div>

      {result.nextRecommendation && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-indigo-800">
            <ArrowRight className="h-4 w-4" />
            {result.nextRecommendation.action
              ? result.nextRecommendation.action.charAt(0).toUpperCase() +
                result.nextRecommendation.action.slice(1)
              : 'Next step'}
          </div>
          {result.nextRecommendation.message && (
            <p className="mt-1 text-xs text-indigo-700">{result.nextRecommendation.message}</p>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={onPracticeAgain}>
          <RotateCcw className="h-4 w-4" />
          Practice again
        </Button>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center">
      <div className="text-lg font-bold text-slate-900">{value}</div>
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spaced repetition
// ---------------------------------------------------------------------------

function SpacedRepetitionModal({
  studentId,
  onClose,
}: {
  studentId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<SpacedRepetitionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchSpacedRepetition(studentId, controller.signal);
        if (!controller.signal.aborted) setData(response);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Unable to load review schedule.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [studentId]);

  const buckets: { key: keyof SpacedRepetitionData; label: string; tone: string }[] = [
    { key: 'today', label: 'Today', tone: 'border-rose-200 bg-rose-50 text-rose-700' },
    { key: 'tomorrow', label: 'Tomorrow', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
    { key: 'thisWeek', label: 'This week', tone: 'border-sky-200 bg-sky-50 text-sky-700' },
    { key: 'nextWeek', label: 'Next week', tone: 'border-slate-200 bg-slate-50 text-slate-700' },
  ];

  const isEmpty =
    data &&
    buckets.every((bucket) => (data[bucket.key] as SpacedRepetitionItem[]).length === 0);

  return (
    <ModalShell
      title="Review schedule"
      subtitle="Spaced repetition of concepts due for revision."
      icon={<CalendarClock className="h-5 w-5" />}
      onClose={onClose}
    >
      <ModalStates loading={loading} error={error} loadingLabel="Loading review schedule..." />
      {!loading && !error && isEmpty && (
        <div className="py-12 text-center text-sm text-slate-500">
          Nothing due for review yet. Complete some practice to build your schedule.
        </div>
      )}
      {!loading && !error && data && !isEmpty && (
        <div className="space-y-4">
          {buckets.map((bucket) => {
            const items = data[bucket.key] as SpacedRepetitionItem[];
            if (items.length === 0) return null;
            return (
              <div key={bucket.key}>
                <div className="mb-2 flex items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${bucket.tone}`}>
                    {bucket.label}
                  </span>
                  <span className="text-xs text-slate-400">{items.length}</span>
                </div>
                <div className="space-y-1.5">
                  {items.map((item) => (
                    <div
                      key={`${bucket.key}-${item.conceptId}`}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-800">{item.conceptName}</span>
                      <span className="text-xs tabular-nums text-slate-500">
                        {item.masteryLevel}% · {item.daysAgo}d ago
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Practice history
// ---------------------------------------------------------------------------

function PracticeHistoryModal({
  studentId,
  onClose,
}: {
  studentId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<PracticeHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchPracticeHistory(studentId, 20, signal);
        if (!signal?.aborted) setData(response);
      } catch (reason) {
        if (signal?.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Unable to load practice history.');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [studentId]
  );

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch loader, matches repo report pages
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const maxWeekly = useMemo(
    () => Math.max(1, ...(data?.weekly.map((week) => week.total) ?? [1])),
    [data]
  );

  return (
    <ModalShell
      title="Practice history"
      subtitle="Your recent practice attempts and weekly trend."
      icon={<History className="h-5 w-5" />}
      onClose={onClose}
      headerAction={
        data ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
            {data.accuracy}% accuracy
          </span>
        ) : null
      }
    >
      <ModalStates loading={loading} error={error} loadingLabel="Loading practice history..." />
      {!loading && !error && data && (
        <div className="space-y-5">
          {data.weekly.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Last 7 days
              </h3>
              <div className="flex items-end justify-between gap-2">
                {data.weekly.map((week) => (
                  <div key={week.date} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-24 w-full items-end">
                      <div
                        className="w-full rounded-t bg-indigo-500"
                        style={{ height: `${Math.max(4, (week.total / maxWeekly) * 100)}%` }}
                        title={`${week.correct}/${week.total} correct`}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-slate-500">
                      {week.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Recent attempts ({data.totalPracticed})
            </h3>
            {data.history.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No practice attempts recorded yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {data.history.map((item, index) => {
                  const correct = item.statusText.toLowerCase() === 'correct';
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div
                          className="truncate text-sm text-slate-800 [&_img]:hidden"
                          dangerouslySetInnerHTML={{ __html: item.questionTitle }}
                        />
                        <div className="text-[11px] text-slate-400">
                          {item.conceptName} · {item.createdAt}
                        </div>
                      </div>
                      {correct ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
}
