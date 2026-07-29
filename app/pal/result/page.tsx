'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Loader2,
  RefreshCw,
  TrendingUp,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PracticePanel } from '@/app/pal/_components/PracticePanel';
import {
  computeConceptMastery,
  fetchPalResult,
  type PalConceptStatus,
  type PalResultData,
  type PalResultQuestion,
} from '@/app/pal/data/pal';

export default function PalResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading result...
        </div>
      }
    >
      <PalResultContent />
    </Suspense>
  );
}

const STATUS_META: Record<PalConceptStatus, { label: string; badge: string; bar: string }> = {
  mastered: { label: 'Mastered', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' },
  developing: { label: 'Developing', badge: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-500' },
  needs_practice: { label: 'Needs practice', badge: 'bg-rose-50 text-rose-700 border-rose-200', bar: 'bg-rose-500' },
  not_started: { label: 'Not started', badge: 'bg-slate-100 text-slate-500 border-slate-200', bar: 'bg-slate-300' },
};

function PalResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const questionPaperId = searchParams?.get('id') ?? '';
  const onlineExamId = searchParams?.get('online_exam_id') ?? '';

  const [result, setResult] = useState<PalResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!questionPaperId) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        setResult(await fetchPalResult(questionPaperId, onlineExamId, controller.signal));
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Unable to load the quiz result.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [questionPaperId, onlineExamId]);

  const mastery = useMemo(
    () => (result ? computeConceptMastery(result.questions) : []),
    [result]
  );
  const masteryTotals = useMemo(() => {
    const totals = { mastered: 0, developing: 0, needs_practice: 0, not_started: 0 } as Record<PalConceptStatus, number>;
    mastery.forEach((concept) => {
      totals[concept.status] += 1;
    });
    return totals;
  }, [mastery]);

  const retake = () => {
    if (!result) return;
    const query = new URLSearchParams({
      grade_id: result.context.gradeId,
      subject_id: result.context.subjectId,
      chapter_id: result.context.chapterId,
      standard_id: result.context.standardId,
    });
    if (result.context.enrollmentNo) query.set('enrollment_no', result.context.enrollmentNo);
    router.push(`/pal/exam?${query.toString()}`);
  };

  if (!questionPaperId || error || (!loading && !result)) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-600">
            {!questionPaperId ? 'Missing result reference.' : error || 'Result unavailable.'}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/pal')}>
            <ArrowLeft className="h-4 w-4" />
            Back to PAL
          </Button>
        </div>
      </div>
    );
  }

  if (loading || !result) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading result...
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Result: {result.paperName}</h1>
            <p className="text-sm text-slate-500">Personalized Adaptive Learning practice result.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push('/pal')}>
              <ArrowLeft className="h-4 w-4" />
              Back to PAL
            </Button>
            <Button onClick={retake}>
              <RefreshCw className="h-4 w-4" />
              Next quiz
            </Button>
          </div>
        </div>

        {/* Practice engine: adaptive practice, review schedule, history */}
        <PracticePanel studentId={result.studentId} context={result.context} />

        {/* Score summary */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Award className="h-5 w-5" />}
            label="Total marks"
            value={`${result.obtainMarks}/${result.totalMarks}`}
            tone="indigo"
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Right answers"
            value={`${result.totalRight}/${result.totalQuestions}`}
            tone="emerald"
          />
          <StatCard
            icon={<XCircle className="h-5 w-5" />}
            label="Wrong answers"
            value={`${result.totalWrong}/${result.totalQuestions}`}
            tone="rose"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Current level"
            value={result.studentLevel ? capitalize(result.studentLevel) : 'N/A'}
            tone="amber"
          />
        </div>

        {/* Concept mastery matrix */}
        {mastery.length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">Concept mastery</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(STATUS_META) as PalConceptStatus[]).map((status) => (
                  <span
                    key={status}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_META[status].badge}`}
                  >
                    {STATUS_META[status].label}: {masteryTotals[status]}
                  </span>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Concept</th>
                    <th className="px-5 py-3 font-semibold">Mastery</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-center font-semibold">Accuracy</th>
                    <th className="px-5 py-3 text-center font-semibold">Attempts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mastery.map((concept) => (
                    <tr key={concept.conceptName} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3 font-medium text-slate-900">{concept.conceptName}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${STATUS_META[concept.status].bar}`}
                              style={{ width: `${concept.masteryLevel}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-slate-600">{concept.masteryLevel}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_META[concept.status].badge}`}
                        >
                          {STATUS_META[concept.status].label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center tabular-nums text-slate-600">{concept.accuracy}%</td>
                      <td className="px-5 py-3 text-center tabular-nums text-slate-600">
                        {concept.attempted}/{concept.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Per-question review */}
        {result.showAnswers && result.questions.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Answer review</h2>
            {result.questions.map((question, index) => (
              <ReviewCard key={question.questionId} question={question} index={index} />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: 'indigo' | 'emerald' | 'rose' | 'amber';
}) {
  const toneStyles: Record<typeof tone, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <article className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneStyles[tone]}`}>{icon}</div>
      <div className="mt-3 text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
    </article>
  );
}

function ReviewCard({ question, index }: { question: PalResultQuestion; index: number }) {
  const attempted = question.rightWrong === 'right' || question.rightWrong === 'wrong';
  const isRight = question.rightWrong === 'right';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="text-sm font-medium text-slate-900 [&_img]:max-w-full"
              dangerouslySetInnerHTML={{ __html: question.title }}
            />
          </div>
          <div className="mt-2">
            {!attempted ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                Not attempted
              </span>
            ) : isRight ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Correct
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                <XCircle className="h-3.5 w-3.5" />
                Incorrect
              </span>
            )}
          </div>

          <div className="mt-3 space-y-2">
            {question.options.map((option) => {
              const given = question.givenAnswerIds.includes(option.id);
              const wrongPick = given && !option.correct;
              return (
                <div
                  key={option.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    option.correct
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : wrongPick
                        ? 'border-rose-200 bg-rose-50 text-rose-900'
                        : 'border-slate-200 text-slate-700'
                  }`}
                >
                  {option.correct ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : wrongPick ? (
                    <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  ) : (
                    <span className="h-4 w-4 shrink-0" />
                  )}
                  <span className="[&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: option.answer }} />
                  {given && (
                    <span className="ml-auto text-[11px] font-medium text-slate-500">Your answer</span>
                  )}
                </div>
              );
            })}
          </div>

          {question.mapping.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {question.mapping.map((map) => (
                <span
                  key={map.typeName}
                  className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                  title={map.typeName}
                >
                  {map.typeName}: {map.values.join(', ')}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
