'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  Loader2,
  Phone,
  User,
} from 'lucide-react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title as ChartTitle,
  Tooltip,
  type ChartOptions,
  type TooltipItem,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

import { cn } from '@/lib/utils';
import {
  fetchStudentAnalysis,
  type StudentAnalysis,
} from '@/app/lms/data/studentAnalysis';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTitle, Tooltip, Legend);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function tierColor(percent: number): string {
  if (percent >= 75) return 'bg-emerald-500';
  if (percent >= 50) return 'bg-sky-500';
  if (percent >= 35) return 'bg-amber-500';
  return 'bg-rose-500';
}

export default function StudentAnalysisDetailPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = Array.isArray(params.studentId) ? params.studentId[0] : params.studentId;

  const [analysis, setAnalysis] = useState<StudentAnalysis | null>(null);
  const [subjectId, setSubjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  const load = useCallback(
    (subject: string | undefined, signal?: AbortSignal) => {
      if (!studentId) return;
      setLoading(true);
      setErrorText('');
      fetchStudentAnalysis(studentId, subject, signal)
        .then((result) => {
          setAnalysis(result);
          setSubjectId(result.currentSubjectId);
          setLoading(false);
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setAnalysis(null);
          setErrorText(errorMessage(error));
          setLoading(false);
        });
    },
    [studentId]
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => load(undefined, controller.signal));
    return () => controller.abort();
  }, [load]);

  const overallPercent = useMemo(() => {
    if (!analysis || analysis.grandTotal <= 0) return 0;
    return Math.round((analysis.grandObtained / analysis.grandTotal) * 100);
  }, [analysis]);

  const chartData = useMemo(() => {
    const exams = analysis?.exams ?? [];
    return {
      labels: exams.map((exam) => exam.paperName),
      datasets: [
        {
          label: 'Achieved %',
          data: exams.map((exam) => exam.obtainedPercentage),
          backgroundColor: 'rgba(79, 70, 229, 0.7)',
          borderRadius: 6,
          maxBarThickness: 48,
        },
      ],
    };
  }, [analysis]);

  const chartOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: TooltipItem<'bar'>) => `${ctx.parsed.y ?? 0}%`,
          },
        },
      },
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: (value: number | string) => `${value}%` } },
      },
    }),
    []
  );

  const handleSubjectChange = (id: string) => {
    if (id === subjectId) return;
    setSubjectId(id);
    load(id);
  };

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1200px] space-y-5">
        <Link
          href="/lms/student-analysis"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-700"
        >
          <ArrowLeft className="size-4" />
          Back to students
        </Link>

        {errorText ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
            {errorText}
          </div>
        ) : null}

        {loading && !analysis ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-20 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Loading analysis…
          </div>
        ) : analysis ? (
          <>
            {/* Profile header */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-50 text-indigo-500">
                  <User className="size-8" />
                </span>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                    {analysis.profile.name || `Student #${analysis.studentId}`}
                  </h1>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                    {analysis.profile.enrollmentNo ? (
                      <span>Enrollment: {analysis.profile.enrollmentNo}</span>
                    ) : null}
                    {analysis.profile.mobile ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="size-3.5" />
                        {analysis.profile.mobile}
                      </span>
                    ) : null}
                    {analysis.profile.dob ? <span>DOB: {analysis.profile.dob}</span> : null}
                    {analysis.profile.city ? <span>{analysis.profile.city}</span> : null}
                  </div>
                </div>
                <div className="rounded-xl bg-indigo-50 px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-indigo-700">
                    {analysis.grandObtained}
                    <span className="text-base font-medium text-indigo-400">/{analysis.grandTotal}</span>
                  </p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-indigo-500">
                    {overallPercent}% overall
                  </p>
                </div>
              </div>
            </section>

            {/* Subject selector */}
            {analysis.subjects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {analysis.subjects.map((subject) => {
                  const active = subject.subjectId === subjectId;
                  return (
                    <button
                      key={subject.subjectId}
                      type="button"
                      onClick={() => handleSubjectChange(subject.subjectId)}
                      disabled={loading}
                      className={cn(
                        'rounded-xl border px-3.5 py-2 text-sm font-medium transition disabled:opacity-60',
                        active
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {subject.displayName}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* Exam chart */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="size-4 text-indigo-500" />
                <h2 className="text-base font-semibold text-slate-900">Exam Report</h2>
                {loading ? <Loader2 className="size-4 animate-spin text-slate-400" /> : null}
              </div>
              {analysis.exams.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 px-3 py-10 text-center text-sm text-slate-500">
                  No exam data for this subject.
                </p>
              ) : (
                <div className="h-72 w-full">
                  <Bar data={chartData} options={chartOptions} />
                </div>
              )}
            </section>

            {/* Per-exam achieved/not-achieved bars */}
            {analysis.exams.length > 0 ? (
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-base font-semibold text-slate-900">Subject Report</h2>
                <div className="space-y-4">
                  {analysis.exams.map((exam) => (
                    <div key={exam.paperId}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-medium text-slate-800">{exam.paperName}</span>
                        <span className="shrink-0 text-slate-500">
                          {exam.obtainedMarks}/{exam.totalMarks} · {exam.obtainedPercentage}%
                        </span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn('h-full rounded-full transition-all', tierColor(exam.obtainedPercentage))}
                          style={{ width: `${exam.obtainedPercentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
