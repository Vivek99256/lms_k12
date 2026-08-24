'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  GraduationCap,
  Loader2,
  User,
} from 'lucide-react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

import { SearchDropdown, type DropdownValue } from '@/components/search-dropdown';
import { buildSessionContext, readString } from '@/lib/erp-client';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchStudentList, type StudentListRow } from '@/app/lms/data/studentAnalysis';
import { fetchLmsDashboard, type LmsDashboard } from '@/app/lms/data/lmsDashboard';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function singleValue(value: DropdownValue): string {
  return Array.isArray(value) ? value[0] ?? '' : value;
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function currentUserProfile(): string {
  if (typeof window === 'undefined') return '';
  try {
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    return readString(menuContext.user_profile_name ?? userData.user_profile_name ?? userData.user_profile);
  } catch {
    return '';
  }
}

function tierColor(percent: number): string {
  if (percent >= 75) return 'bg-emerald-500';
  if (percent >= 50) return 'bg-sky-500';
  if (percent >= 35) return 'bg-amber-500';
  return 'bg-rose-500';
}

export default function LmsDashboardPage() {
  const session = useMemo(() => buildSessionContext(), []);
  const profileName = useMemo(() => currentUserProfile(), []);
  const isStudent = profileName.toLowerCase() === 'student';

  // Teacher filters
  const [gradeId, setGradeId] = useState('');
  const [standardId, setStandardId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [students, setStudents] = useState<StudentListRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // Dashboard
  const [dashboard, setDashboard] = useState<LmsDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const loadDashboard = useCallback(
    (userId: string, userProfile: string, signal?: AbortSignal) => {
      if (!userId) return;
      setLoading(true);
      setErrorText('');
      fetchLmsDashboard({ userId, userProfile }, signal)
        .then((result) => {
          setDashboard(result);
          setLoading(false);
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setDashboard(null);
          setErrorText(errorMessage(error));
          setLoading(false);
        });
    },
    []
  );

  // Student self-view: load own dashboard immediately.
  useEffect(() => {
    if (!isStudent) return;
    const controller = new AbortController();
    queueMicrotask(() => loadDashboard(session.userId, 'Student', controller.signal));
    return () => controller.abort();
  }, [isStudent, session.userId, loadDashboard]);

  // Teacher: load the class student list when a standard is chosen.
  useEffect(() => {
    if (isStudent) return;
    let cancelled = false;
    if (!gradeId || !standardId) {
      queueMicrotask(() => {
        if (cancelled) return;
        setStudents([]);
        setSelectedStudentId('');
      });
      return () => {
        cancelled = true;
      };
    }
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!cancelled) setStudentsLoading(true);
    });
    fetchStudentList({ gradeId, standardId, divisionId }, controller.signal)
      .then((rows) => {
        if (cancelled) return;
        setStudents(rows);
        setSelectedStudentId('');
        setStudentsLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        setStudents([]);
        setStudentsLoading(false);
        setErrorText(errorMessage(error));
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isStudent, gradeId, standardId, divisionId]);

  const handleStudentSelect = (id: string) => {
    setSelectedStudentId(id);
    setDashboard(null);
    if (id) loadDashboard(id, 'Teacher');
  };

  const pastChart = useMemo(() => {
    const group = dashboard?.pastGroups[0];
    const subjects = group?.subjects ?? [];
    return {
      hasData: subjects.length > 0,
      data: {
        labels: subjects.map((s) => s.name),
        datasets: [
          {
            label: 'Achieved %',
            data: subjects.map((s) => s.percent),
            backgroundColor: 'rgba(79, 70, 229, 0.7)',
            borderRadius: 6,
            maxBarThickness: 44,
          },
        ],
      },
    };
  }, [dashboard]);

  const chartOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: (value: number | string) => `${value}%` } },
      },
    }),
    []
  );

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1400px] space-y-5">
        {/* Header */}
        <header className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <GraduationCap className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              LMS Dashboard
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {isStudent
                ? 'Your learning progress across standards and subjects.'
                : 'Pick a class and student to view their learning progress.'}
            </p>
          </div>
        </header>

        {errorText ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">{errorText}</div>
          </div>
        ) : null}

        {/* Teacher filters */}
        {!isStudent ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Select student</h2>
            <SearchDropdown
              fields={['section', 'standard', 'division']}
              subInstituteId={session.subInstituteId}
              token={session.token}
              labels={{ section: 'Grade', standard: 'Standard', division: 'Division' }}
              required={{ section: true, standard: true }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
              onSectionChange={(value) => {
                setGradeId(singleValue(value));
                setStandardId('');
                setDivisionId('');
              }}
              onStandardChange={(value) => {
                setStandardId(singleValue(value));
                setDivisionId('');
              }}
              onDivisionChange={(value) => setDivisionId(singleValue(value))}
            />
            <div className="mt-3">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Student</label>
              <select
                value={selectedStudentId}
                onChange={(event) => handleStudentSelect(event.target.value)}
                disabled={!standardId || studentsLoading || students.length === 0}
                className="h-10 w-full max-w-md rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">
                  {!standardId
                    ? 'Select a standard first'
                    : studentsLoading
                      ? 'Loading students…'
                      : students.length === 0
                        ? 'No students found'
                        : 'Select student'}
                </option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                    {student.enrollmentNo ? ` (${student.enrollmentNo})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </section>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-20 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Loading dashboard…
          </div>
        ) : dashboard ? (
          <>
            {/* Profile + timeline */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
                  <User className="size-7" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {dashboard.profile.name || 'Student'}
                  </h2>
                  {dashboard.profile.enrollmentNo ? (
                    <p className="text-sm text-slate-500">Enrollment: {dashboard.profile.enrollmentNo}</p>
                  ) : null}
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-slate-800">{dashboard.standardCount}</p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Standards</p>
                </div>
              </div>

              {dashboard.timeline.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {dashboard.timeline.map((entry, index) => (
                    <span
                      key={`${entry.standardName}-${entry.syear}-${index}`}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                    >
                      <GraduationCap className="size-3.5 text-indigo-500" />
                      {entry.standardName || '—'}
                      {entry.syear ? <span className="text-slate-400">· {entry.syear}</span> : null}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>

            {/* Past performance chart */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="size-4 text-indigo-500" />
                <h2 className="text-base font-semibold text-slate-900">Past Performance</h2>
              </div>
              {pastChart.hasData ? (
                <div className="h-72 w-full">
                  <Bar data={pastChart.data} options={chartOptions} />
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 px-3 py-10 text-center text-sm text-slate-500">
                  No past-standard results available.
                </p>
              )}
            </section>

            {/* Current subjects + chapters */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <BookOpen className="size-4 text-indigo-500" />
                <h2 className="text-base font-semibold text-slate-900">Current Standard — Subjects</h2>
              </div>
              {dashboard.currentSubjects.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 px-3 py-10 text-center text-sm text-slate-500">
                  No current-standard subject data available.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {dashboard.currentSubjects.map((subject, index) => (
                    <div key={`${subject.name}-${index}`} className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="min-w-0 truncate text-sm font-semibold text-slate-900">{subject.name}</h3>
                        <span className="shrink-0 text-sm font-semibold text-slate-700">{subject.percent}%</span>
                      </div>
                      <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn('h-full rounded-full', tierColor(subject.percent))}
                          style={{ width: `${subject.percent}%` }}
                        />
                      </div>
                      {subject.chapters.length > 0 ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Chapter</TableHead>
                                <TableHead className="text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Obtain</TableHead>
                                <TableHead className="text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Total</TableHead>
                                <TableHead className="text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">%</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {subject.chapters.map((chapter, ci) => (
                                <TableRow key={`${chapter.title}-${ci}`}>
                                  <TableCell className="text-slate-700">{chapter.title}</TableCell>
                                  <TableCell className="text-right text-slate-600">{chapter.obtain}</TableCell>
                                  <TableCell className="text-right text-slate-600">{chapter.total}</TableCell>
                                  <TableCell className="text-right font-medium text-slate-700">{chapter.percent}%</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">No chapter breakdown.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : !isStudent && !selectedStudentId ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-3 py-16 text-center text-sm text-slate-500">
            Select a class and student to view their dashboard.
          </div>
        ) : null}
      </div>
    </div>
  );
}
