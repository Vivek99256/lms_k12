'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Loader2,
  Printer,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { buildSessionContext } from '@/lib/erp-client';
import {
  openPrintPreview,
  type TableExportColumn,
  type TableExportRow,
} from '@/lib/table-export';
import {
  fetchAttemptBreakdown,
  fetchExamResult,
  type AttemptBreakdown,
  type ExamResult,
  type ResultQuestion,
} from '@/app/exam/data/onlineExam';

// ---------------------------------------------------------------------------
// Shared color banding (score & progress bars)
// ---------------------------------------------------------------------------

type Band = { text: string; bar: string; ring: string };

function bandFor(percent: number): Band {
  if (percent >= 75) return { text: 'text-emerald-600', bar: 'bg-emerald-500', ring: 'text-emerald-500' };
  if (percent >= 50) return { text: 'text-sky-600', bar: 'bg-sky-500', ring: 'text-sky-500' };
  if (percent >= 35) return { text: 'text-amber-600', bar: 'bg-amber-500', ring: 'text-amber-500' };
  return { text: 'text-rose-600', bar: 'bg-rose-500', ring: 'text-rose-500' };
}

export default function OnlineExamResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center py-24 text-sm text-slate-500">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading result…
        </div>
      }
    >
      <OnlineExamResultContent />
    </Suspense>
  );
}

function OnlineExamResultContent() {
  const router = useRouter();
  const params = useParams<{ paperId: string }>();
  const paperId = params?.paperId;
  const searchParams = useSearchParams();
  const onlineExamId = searchParams?.get('online_exam_id') ?? '';

  const [result, setResult] = useState<ExamResult | null>(null);
  const [breakdowns, setBreakdowns] = useState<AttemptBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultError, setResultError] = useState<string | null>(null);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);

  useEffect(() => {
    if (!paperId) return;
    let cancelled = false;
    const controller = new AbortController();
    const studentId = buildSessionContext().userId;
    const load = async () => {
      const [resultOutcome, breakdownOutcome] = await Promise.allSettled([
        fetchExamResult(paperId, onlineExamId, studentId, controller.signal),
        fetchAttemptBreakdown(paperId, studentId, controller.signal),
      ]);
      if (cancelled || controller.signal.aborted) return;
      if (resultOutcome.status === 'fulfilled') {
        setResult(resultOutcome.value);
      } else {
        setResultError(
          resultOutcome.reason instanceof Error
            ? resultOutcome.reason.message
            : 'Unable to load the result.'
        );
      }
      if (breakdownOutcome.status === 'fulfilled') {
        setBreakdowns(breakdownOutcome.value);
      } else {
        setBreakdownError(
          breakdownOutcome.reason instanceof Error
            ? breakdownOutcome.reason.message
            : 'Unable to load the breakdown.'
        );
      }
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [paperId, onlineExamId]);

  const percent = useMemo(() => {
    if (!result || result.totalMarks <= 0) return 0;
    return Math.round((result.obtainMarks / result.totalMarks) * 100);
  }, [result]);

  const attempt = useMemo(() => {
    if (breakdowns.length === 0) return null;
    return (
      breakdowns.find((entry) => entry.onlineExamId === onlineExamId) ??
      breakdowns[breakdowns.length - 1]
    );
  }, [breakdowns, onlineExamId]);

  const handlePrint = () => {
    if (!result) return;
    const columns: TableExportColumn[] = [
      { key: 'idx', label: '#', width: '40px', align: 'center' },
      { key: 'question', label: 'Question' },
      { key: 'result', label: 'Result', width: '110px' },
      { key: 'marks', label: 'Marks', width: '70px', align: 'right' },
    ];
    const rows: TableExportRow[] = result.questions.map((question, index) => ({
      idx: String(index + 1),
      question: question.title || 'Untitled question',
      result:
        question.rightWrong === 'right'
          ? 'Correct'
          : question.rightWrong === 'wrong'
            ? 'Incorrect'
            : '—',
      marks: String(question.points),
    }));
    openPrintPreview({
      filename: `${result.paperName || 'online-exam-result'}.pdf`,
      title: `${result.paperName} — Result`,
      subtitle: `${result.obtainMarks}/${result.totalMarks} marks · ${result.totalRight} right · ${result.totalWrong} wrong`,
      columns,
      rows,
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center py-24 text-sm text-slate-500">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading result…
      </div>
    );
  }

  const band = bandFor(percent);

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1400px] space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <BarChart3 className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                {result ? `Result: ${result.paperName}` : 'Exam result'}
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Your score with the DOK &amp; Bloom breakdown.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push('/exam/online')}>
              <ArrowLeft className="size-4" />
              Back to exams
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={!result}>
              <Printer className="size-4" />
              Print
            </Button>
          </div>
        </div>

        {/* Result-load failure */}
        {resultError ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{resultError}</span>
          </div>
        ) : null}

        {/* Score card */}
        {result ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
              <ScoreRing percent={percent} band={band} />
              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                <Stat label="Marks" value={`${result.obtainMarks} / ${result.totalMarks}`} tone="indigo" />
                <Stat label="Correct" value={String(result.totalRight)} tone="emerald" />
                <Stat label="Wrong" value={String(result.totalWrong)} tone="rose" />
              </div>
            </div>
          </section>
        ) : null}

        {/* DOK / Bloom breakdown */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">DOK &amp; Bloom breakdown</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Performance by Depth-of-Knowledge and Bloom&apos;s taxonomy levels.
            </p>
          </div>
          <div className="px-5 py-4">
            {breakdownError ? (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{breakdownError}</span>
              </div>
            ) : !attempt || attempt.groups.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
                No breakdown is available for this attempt yet.
              </p>
            ) : (
              <div className="space-y-6">
                {attempt.groups.map((group) => (
                  <div key={group.parentName}>
                    <h3 className="text-sm font-semibold text-slate-900">{group.parentName}</h3>
                    <div className="mt-3 space-y-3">
                      {group.rows.map((row) => {
                        const rowBand = bandFor(row.obtainedPercentage);
                        return (
                          <div key={`${group.parentName}-${row.name}`}>
                            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                              <span className="min-w-0 truncate font-medium text-slate-700">
                                {row.name}
                              </span>
                              <span className="shrink-0 text-xs tabular-nums text-slate-500">
                                {row.rightAnswer}/{row.totalQuestions} ·{' '}
                                <span className={`font-semibold ${rowBand.text}`}>
                                  {Math.round(row.obtainedPercentage)}%
                                </span>
                              </span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${rowBand.bar}`}
                                style={{
                                  width: `${Math.max(0, Math.min(100, row.obtainedPercentage))}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Question review */}
        {result && result.questions.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Answer review</h2>
            {result.questions.map((question, index) => (
              <ReviewCard key={question.id} question={question} index={index} />
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function ScoreRing({ percent, band }: { percent: number; band: Band }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <div className="relative flex size-32 shrink-0 items-center justify-center">
      <svg className="size-32 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={band.ring}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-3xl font-black tabular-nums ${band.text}`}>{clamped}%</span>
        <span className="text-[11px] font-medium text-slate-400">score</span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'indigo' | 'emerald' | 'rose';
}) {
  const toneStyles: Record<typeof tone, string> = {
    indigo: 'text-indigo-600',
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
      <div className={`text-2xl font-bold tabular-nums ${toneStyles[tone]}`}>{value}</div>
      <div className="mt-0.5 text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}

function ReviewCard({ question, index }: { question: ResultQuestion; index: number }) {
  const attempted = question.rightWrong === 'right' || question.rightWrong === 'wrong';
  const isRight = question.rightWrong === 'right';
  const hasOptions = question.options.length > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">{question.title}</p>
            <span className="shrink-0 text-xs text-slate-400">
              {question.points} mark{question.points === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-2">
            {!attempted ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                —
              </span>
            ) : isRight ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="size-3.5" />
                Correct
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                <XCircle className="size-3.5" />
                Incorrect
              </span>
            )}
          </div>

          {hasOptions ? (
            <div className="mt-3 space-y-2">
              {question.options.map((option) => {
                const correct =
                  option.correct || question.actualAnswerIds.includes(option.id);
                const given = question.givenAnswerIds.includes(option.id);
                const wrongPick = given && !correct;
                return (
                  <div
                    key={option.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      correct
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : wrongPick
                          ? 'border-rose-200 bg-rose-50 text-rose-900'
                          : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    {correct ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                    ) : wrongPick ? (
                      <XCircle className="size-4 shrink-0 text-rose-600" />
                    ) : (
                      <span className="size-4 shrink-0" />
                    )}
                    <span>{option.answer}</span>
                    {given ? (
                      <span className="ml-auto shrink-0 text-[11px] font-medium text-slate-500">
                        Your answer
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-700">
              {question.givenAnswerIds.length > 0
                ? question.givenAnswerIds.join(', ')
                : 'No response recorded.'}
            </div>
          )}

          {question.mapping.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {question.mapping.map((map) => (
                <span
                  key={`${map.typeName}-${map.valueName}`}
                  className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                  title={map.typeName}
                >
                  {map.typeName}: {map.valueName}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
