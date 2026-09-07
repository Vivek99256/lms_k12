'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ClipboardList,
  FileText,
  GraduationCap,
  ListChecks,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';

import { DashboardBarChart } from '@/app/dashboard/_components/DashboardBarChart';
import {
  DashboardError,
  DashboardSkeleton,
  EmptyState,
  QuickActionLink,
  SectionPanel,
  StatCard,
} from '@/app/dashboard/_components/DashboardPrimitives';
import {
  SearchDropdown,
  type DropdownField,
  type SearchDropdownValues,
} from '@/components/search-dropdown';
import {
  fetchResultDashboard,
  type ResultDashboardData,
  type ResultDashboardFilters,
} from '@/app/lms/exam/_result-dashboard/api';

/** Marks under this share of the paper are the ones a teacher chases up. */
const AT_RISK_PERCENT = 40;

/** "Section" in these dropdowns is the grade; Subject is not a result filter. */
const academicFields: DropdownField[] = ['section', 'standard', 'division'];

const selectClassName =
  'h-10 w-full rounded-[10px] border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#5846EA] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400';

function readValue(value: SearchDropdownValues[keyof SearchDropdownValues] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function percentLabel(value: number | null): string {
  return value === null ? '-' : `${value}%`;
}

/** Green when strong, amber mid, red at risk — the same read across every panel. */
function percentToneClass(value: number | null): string {
  if (value === null) return 'text-slate-400';
  if (value < AT_RISK_PERCENT) return 'text-red-600';
  if (value < 60) return 'text-amber-600';
  return 'text-emerald-600';
}

export default function ExamResultDashboard() {
  const [academic, setAcademic] = useState<Partial<SearchDropdownValues>>({
    section: '',
    standard: '',
    division: '',
  });
  const [studentId, setStudentId] = useState('');

  const [data, setData] = useState<ResultDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Aborts the in-flight request so a fast series of filter changes cannot land out of order. */
  const requestRef = useRef<AbortController | null>(null);

  const filters: ResultDashboardFilters = useMemo(
    () => ({
      gradeId: readValue(academic.section),
      standardId: readValue(academic.standard),
      divisionId: readValue(academic.division),
      studentId,
    }),
    [academic.section, academic.standard, academic.division, studentId]
  );

  const hasFilters =
    Boolean(filters.gradeId) ||
    Boolean(filters.standardId) ||
    Boolean(filters.divisionId) ||
    Boolean(filters.studentId);

  const load = useCallback(
    (next: ResultDashboardFilters, isFirstLoad: boolean) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      if (isFirstLoad) setLoading(true);
      else setRefreshing(true);
      setError(null);

      fetchResultDashboard(next, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setData(result);
        })
        .catch((reason: unknown) => {
          // An abort just means a newer filter selection took over.
          if (controller.signal.aborted) return;
          setError(reason instanceof Error ? reason.message : 'Unable to load the result dashboard.');
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setLoading(false);
          setRefreshing(false);
        });
    },
    []
  );

  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    const isFirstLoad = isFirstLoadRef.current;
    isFirstLoadRef.current = false;

    queueMicrotask(() => load(filters, isFirstLoad));

    return () => requestRef.current?.abort();
  }, [filters, load]);

  /**
   * Changing the class changes who the student options are, so a student left
   * selected from the previous class would filter against a cohort they are
   * not in. Clear it whenever the academic selection moves.
   */
  function handleAcademicChange(values: SearchDropdownValues) {
    setAcademic(values);
    setStudentId('');
  }

  function clearFilters() {
    setAcademic({ section: '', standard: '', division: '' });
    setStudentId('');
  }

  const studentOptions = data?.studentOptions ?? [];
  const canPickStudent = studentOptions.length > 0;
  const selectedStudent = studentOptions.find((option) => String(option.id) === studentId);

  const filterPanel = (
    <SectionPanel
      title="Filters"
      description="Narrow to a section, standard, division, or a single student"
      action={
        hasFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <X size={14} />
            Clear
          </button>
        ) : null
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <SearchDropdown
            fields={academicFields}
            values={academic}
            onChange={handleAcademicChange}
          />
        </div>

        <div>
          <label
            htmlFor="result-dashboard-student"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Student
          </label>
          <select
            id="result-dashboard-student"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            disabled={!canPickStudent}
            className={selectClassName}
          >
            <option value="">
              {canPickStudent ? 'All students' : 'Select a standard first'}
            </option>
            {studentOptions.map((option) => (
              <option key={option.id} value={String(option.id)}>
                {option.rollNo ? `${option.rollNo}. ` : ''}
                {option.studentName || `Student #${option.id}`}
                {option.divisionName ? ` (${option.divisionName})` : ''}
              </option>
            ))}
          </select>
          {canPickStudent ? (
            <p className="mt-1 text-xs text-slate-500">
              {studentOptions.length} student{studentOptions.length === 1 ? '' : 's'} in this class
            </p>
          ) : null}
        </div>
      </div>
    </SectionPanel>
  );

  if (loading) {
    return (
      <div className="space-y-5">
        {filterPanel}
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        {filterPanel}
        <DashboardError message={error} onRetry={() => load(filters, false)} />
      </div>
    );
  }

  if (!data) return filterPanel;

  const { summary } = data;
  const hasAttempts = summary.attemptsRecorded > 0;

  return (
    <div className={`space-y-5 ${refreshing ? 'opacity-60 transition-opacity' : ''}`}>
      <header className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <GraduationCap className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Result dashboard</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {selectedStudent
              ? `Exam performance for ${selectedStudent.studentName || `student #${selectedStudent.id}`} this academic year.`
              : data.scope === 'institute'
                ? 'Exam performance across every class in the institute, for the current academic year.'
                : 'How your published exams are performing this academic year.'}
          </p>
        </div>
      </header>

      {filterPanel}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label={selectedStudent ? 'Exams sat' : 'Exams published'}
          value={summary.examsPublished}
          icon={FileText}
        />
        <StatCard label="Attempts recorded" value={summary.attemptsRecorded} icon={ClipboardList} />
        <StatCard label="Students assessed" value={summary.studentsAssessed} icon={Users} />
        <StatCard
          label="Average score"
          value={percentLabel(summary.averageScore)}
          icon={TrendingUp}
          tone={summary.averageScore !== null && summary.averageScore >= 60 ? 'positive' : 'default'}
        />
        <StatCard
          label={`Below ${AT_RISK_PERCENT}%`}
          value={summary.needsAttention}
          icon={AlertTriangle}
          tone={summary.needsAttention > 0 ? 'warning' : 'default'}
        />
      </section>

      <SectionPanel
        title="Score distribution"
        description="How every attempt in the current selection is spread across score bands"
      >
        {hasAttempts ? (
          <DashboardBarChart
            labels={data.scoreDistribution.map((band) => band.label)}
            values={data.scoreDistribution.map((band) => band.attempts)}
          />
        ) : (
          <EmptyState
            message={
              hasFilters
                ? 'No exam attempts match the current filters.'
                : 'No exam attempts have been recorded yet this year.'
            }
          />
        )}
      </SectionPanel>

      <SectionPanel title="Result quick actions">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickActionLink href="/exam/progress-report" label="Exam-wise progress report" icon={TrendingUp} />
          <QuickActionLink href="/lms/question-wise-report" label="Question-wise report" icon={ListChecks} />
          <QuickActionLink href="/lms/student-analysis" label="Student analysis" icon={Users} />
        </div>
      </SectionPanel>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionPanel
          title={selectedStudent ? 'Exam-by-exam results' : 'Recent exams'}
          description={
            selectedStudent
              ? `Every exam ${selectedStudent.studentName || 'this student'} has attempted`
              : 'Latest papers and how the class scored'
          }
          className="lg:col-span-2"
        >
          {data.recentExams.length === 0 ? (
            <EmptyState
              message={
                hasFilters
                  ? 'No exams match the current filters.'
                  : 'No exams have been published for this academic year.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-3">Exam</th>
                    <th className="pb-2 pr-3">Class</th>
                    <th className="pb-2 pr-3">Subject</th>
                    <th className="pb-2 pr-3 text-right">Attempts</th>
                    <th className="pb-2 pr-3 text-right">{selectedStudent ? 'Score' : 'Average'}</th>
                    <th className="pb-2 pr-3 text-right">Lowest</th>
                    <th className="pb-2 text-right">Highest</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentExams.map((exam) => (
                    <tr key={exam.id}>
                      <td className="max-w-[280px] py-3 pr-3">
                        <span className="block truncate font-medium text-slate-900" title={exam.paperName}>
                          {exam.paperName || '-'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {exam.totalQuestions} questions · {exam.totalMarks} marks
                          {exam.closeDate ? ` · closes ${exam.closeDate}` : ''}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{exam.standardName || '-'}</td>
                      <td className="py-3 pr-3 text-slate-600">{exam.subjectName || '-'}</td>
                      <td className="py-3 pr-3 text-right tabular-nums text-slate-700">{exam.attempts}</td>
                      <td className={`py-3 pr-3 text-right font-semibold tabular-nums ${percentToneClass(exam.averagePercent)}`}>
                        {percentLabel(exam.averagePercent)}
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums text-slate-500">
                        {percentLabel(exam.lowestPercent)}
                      </td>
                      <td className="py-3 text-right tabular-nums text-slate-500">
                        {percentLabel(exam.highestPercent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionPanel>

        <SectionPanel title="Subject performance" description="Weakest subjects first">
          {data.subjectPerformance.length === 0 ? (
            <EmptyState message="No subject has any recorded attempts in this selection." />
          ) : (
            <div className="space-y-3">
              {data.subjectPerformance.map((subject) => (
                <div key={subject.subjectId}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-slate-900" title={subject.subjectName}>
                      {subject.subjectName || '-'}
                    </span>
                    <span className={`shrink-0 font-semibold tabular-nums ${percentToneClass(subject.averagePercent)}`}>
                      {percentLabel(subject.averagePercent)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#4F46E5]"
                      style={{ width: `${Math.min(subject.averagePercent ?? 0, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{subject.attempts} attempts</p>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>

        <SectionPanel
          title="Students to watch"
          description={`Most recent attempts under ${AT_RISK_PERCENT}%`}
        >
          {data.studentsToWatch.length === 0 ? (
            <EmptyState message={`No attempt in this selection scored below ${AT_RISK_PERCENT}%.`} />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.studentsToWatch.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">
                      {row.studentName || `Student #${row.studentId}`}
                    </span>
                    <span className="block truncate text-xs text-slate-500" title={row.paperName}>
                      {row.paperName || '-'}
                      {row.attemptedOn ? ` · ${row.attemptedOn}` : ''}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`block font-semibold tabular-nums ${percentToneClass(row.percent)}`}>
                      {percentLabel(row.percent)}
                    </span>
                    <span className="block text-xs text-slate-500 tabular-nums">
                      {row.obtainMarks}/{row.totalMarks}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>
      </section>
    </div>
  );
}
