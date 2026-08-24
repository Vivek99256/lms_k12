'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  Printer,
} from 'lucide-react';

import { SearchDropdown, type DropdownValue } from '@/components/search-dropdown';
import { buildSessionContext } from '@/lib/erp-client';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  exportRowsAsCsv,
  exportRowsAsExcel,
  exportRowsAsPdf,
  openPrintPreview,
  type TableExportColumn,
  type TableExportRow,
} from '@/lib/table-export';
import {
  fetchExamsForSubject,
  fetchProgressReport,
  gradeForPercent,
  type GradeBand,
  type ProgressReport,
  type ReportExam,
} from '@/app/exam/data/progressReport';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function singleValue(value: DropdownValue): string {
  return Array.isArray(value) ? value[0] ?? '' : value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

/** Percent for a score against an exam total (0 when the exam has no marks). */
function scorePercent(obtain: number, totalMarks: number): number {
  return totalMarks > 0 ? Math.round((obtain / totalMarks) * 100) : 0;
}

type BandTier = 'top' | 'good' | 'fair' | 'low';

function tierForPercent(percent: number): BandTier {
  if (percent >= 75) return 'top';
  if (percent >= 50) return 'good';
  if (percent >= 35) return 'fair';
  return 'low';
}

const TIER_CELL: Record<BandTier, string> = {
  top: 'bg-emerald-50 text-emerald-700',
  good: 'bg-sky-50 text-sky-700',
  fair: 'bg-amber-50 text-amber-700',
  low: 'bg-rose-50 text-rose-700',
};

// ---------------------------------------------------------------------------
// Banners
// ---------------------------------------------------------------------------

type BannerTone = 'error' | 'success' | 'info';

const BANNER_STYLES: Record<BannerTone, { wrap: string; icon: typeof Info }> = {
  error: { wrap: 'border-rose-200 bg-rose-50 text-rose-700', icon: AlertTriangle },
  success: { wrap: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  info: { wrap: 'border-sky-200 bg-sky-50 text-sky-700', icon: Info },
};

function Banner({ tone, children }: { tone: BannerTone; children: React.ReactNode }) {
  const style = BANNER_STYLES[tone];
  const Icon = style.icon;
  return (
    <div className={cn('flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm', style.wrap)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProgressReportPage() {
  const session = useMemo(() => buildSessionContext(), []);

  // Filters
  const [gradeId, setGradeId] = useState('');
  const [standardId, setStandardId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [examIds, setExamIds] = useState<string[]>([]);
  const [attemptedOnly, setAttemptedOnly] = useState(false);

  // Labels (for the export subtitle)
  const [standardLabel, setStandardLabel] = useState('');
  const [divisionLabel, setDivisionLabel] = useState('');
  const [subjectLabel, setSubjectLabel] = useState('');

  // Exams for the multi-select
  const [exams, setExams] = useState<ReportExam[]>([]);
  const [examsLoading, setExamsLoading] = useState(false);

  // Report
  const [report, setReport] = useState<ProgressReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  // -- Load exams when a subject is chosen ----------------------------------
  useEffect(() => {
    let cancelled = false;
    if (!standardId || !subjectId) {
      queueMicrotask(() => {
        if (cancelled) return;
        setExams([]);
        setExamIds([]);
        setExamsLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!cancelled) setExamsLoading(true);
    });
    fetchExamsForSubject(standardId, subjectId, controller.signal)
      .then((loaded) => {
        if (cancelled) return;
        setExams(loaded);
        setExamIds([]);
        setExamsLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        setExams([]);
        setExamIds([]);
        setExamsLoading(false);
        setErrorText(errorMessage(error));
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [standardId, subjectId]);

  // -- Derived --------------------------------------------------------------
  const allExamsSelected = exams.length > 0 && examIds.length === exams.length;
  const canGenerate = !!standardId && !!subjectId && examIds.length > 0 && !loading;

  const classSubjectLabel = useMemo(() => {
    const parts = [
      standardLabel,
      divisionLabel ? `Div ${divisionLabel}` : '',
      subjectLabel,
    ].filter(Boolean);
    return parts.join(' · ') || 'Exam-wise progress report';
  }, [standardLabel, divisionLabel, subjectLabel]);

  const studentAverages = useMemo(() => {
    const map = new Map<string, number | null>();
    if (!report) return map;
    report.students.forEach((student) => {
      const perExam = report.marks[student.id] ?? {};
      const percents: number[] = [];
      report.exams.forEach((exam) => {
        const score = perExam[exam.id];
        if (score && score.obtain != null) {
          percents.push(scorePercent(score.obtain, exam.totalMarks));
        }
      });
      map.set(
        student.id,
        percents.length > 0
          ? Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length)
          : null
      );
    });
    return map;
  }, [report]);

  // -- Export ---------------------------------------------------------------
  const exportColumns = useMemo<TableExportColumn[]>(() => {
    if (!report) return [];
    return [
      { key: 'sr', label: '#', width: '48px', align: 'center' },
      { key: 'enroll', label: 'Enrollment' },
      { key: 'student', label: 'Student', width: '220px' },
      { key: 'stddiv', label: 'Std/Div' },
      ...report.exams.map((exam) => ({
        key: `exam_${exam.id}`,
        label: exam.name,
        align: 'right' as const,
      })),
      { key: 'avg', label: 'Average %', align: 'right' as const },
    ];
  }, [report]);

  const exportRows = useMemo<TableExportRow[]>(() => {
    if (!report) return [];
    const scale: GradeBand[] = report.gradeScale;
    return report.students.map((student, index) => {
      const perExam = report.marks[student.id] ?? {};
      const row: TableExportRow = {
        sr: String(index + 1),
        enroll: student.enrollmentNo || '-',
        student: student.name || '-',
        stddiv: [student.standard, student.division].filter(Boolean).join(' / ') || '-',
      };
      report.exams.forEach((exam) => {
        const score = perExam[exam.id];
        if (!score || score.obtain == null) {
          row[`exam_${exam.id}`] = '—';
          return;
        }
        const percent = scorePercent(score.obtain, exam.totalMarks);
        const grade = gradeForPercent(percent, scale);
        row[`exam_${exam.id}`] = `${score.obtain}/${exam.totalMarks}${grade ? ` (${grade})` : ''}`;
      });
      const avg = studentAverages.get(student.id);
      row.avg = avg == null ? '—' : `${avg}%`;
      return row;
    });
  }, [report, studentAverages]);

  const handleExportCsv = () =>
    exportRowsAsCsv({ filename: 'exam-progress-report.csv', columns: exportColumns, rows: exportRows });
  const handleExportExcel = () =>
    exportRowsAsExcel({
      filename: 'exam-progress-report.xls',
      title: 'Exam-wise Progress Report',
      columns: exportColumns,
      rows: exportRows,
    });
  const handleExportPdf = () =>
    exportRowsAsPdf({
      filename: 'exam-progress-report.pdf',
      title: 'Exam-wise Progress Report',
      subtitle: classSubjectLabel,
      columns: exportColumns,
      rows: exportRows,
    });
  const handlePrint = () =>
    openPrintPreview({
      filename: 'exam-progress-report.pdf',
      title: 'Exam-wise Progress Report',
      subtitle: classSubjectLabel,
      columns: exportColumns,
      rows: exportRows,
    });

  // -- Handlers -------------------------------------------------------------
  const toggleExam = (id: string) => {
    setExamIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };
  const toggleAllExams = () => {
    setExamIds(allExamsSelected ? [] : exams.map((exam) => exam.id));
  };

  const handleGenerate = async () => {
    if (!standardId || !subjectId || examIds.length === 0) return;
    setLoading(true);
    setErrorText('');
    try {
      const result = await fetchProgressReport({
        gradeId,
        standardId,
        divisionId,
        subjectId,
        examIds,
        attemptedOnly,
      });
      setReport(result);
    } catch (error) {
      setReport(null);
      setErrorText(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // -- Render ---------------------------------------------------------------
  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">
        {/* Header */}
        <header className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <BarChart3 className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Exam-wise Progress Report
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Compare students&apos; scores across selected exams, with grade bands.
            </p>
          </div>
        </header>

        {errorText ? <Banner tone="error">{errorText}</Banner> : null}

        {/* Filters */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Filters</h2>

          <SearchDropdown
            fields={['section', 'standard', 'division', 'subject']}
            subInstituteId={session.subInstituteId}
            token={session.token}
            labels={{ section: 'Grade', standard: 'Standard', division: 'Division', subject: 'Subject' }}
            required={{ section: true, standard: true, subject: true }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            onSectionChange={(value, data) => {
              setGradeId(singleValue(value));
              setStandardId('');
              setDivisionId('');
              setSubjectId('');
              setExamIds([]);
              setStandardLabel('');
              setDivisionLabel('');
              setSubjectLabel('');
              const first = data[0];
              // section carries no user-facing label we surface; kept for parity.
              void first;
            }}
            onStandardChange={(value, data) => {
              setStandardId(singleValue(value));
              setDivisionId('');
              setSubjectId('');
              setExamIds([]);
              setStandardLabel(data[0]?.name ?? '');
              setDivisionLabel('');
              setSubjectLabel('');
            }}
            onDivisionChange={(value, data) => {
              setDivisionId(singleValue(value));
              setDivisionLabel(data[0]?.name ?? '');
            }}
            onSubjectChange={(value, data) => {
              setSubjectId(singleValue(value));
              setExamIds([]);
              setSubjectLabel(data[0]?.subject_name ?? '');
            }}
          />

          {/* Exam multi-select */}
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-700">
                Exams <span className="text-xs font-normal text-slate-400">(pick one or more)</span>
              </span>
              {exams.length > 0 ? (
                <button
                  type="button"
                  onClick={toggleAllExams}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  {allExamsSelected ? 'Clear' : 'Select all'}
                </button>
              ) : null}
            </div>

            {!subjectId ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                Select a standard and subject to load exams.
              </p>
            ) : examsLoading ? (
              <p className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" /> Loading exams…
              </p>
            ) : exams.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                No exams found for this subject.
              </p>
            ) : (
              <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/40 p-2">
                {exams.map((exam) => {
                  const selected = examIds.includes(exam.id);
                  return (
                    <label
                      key={exam.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition',
                        selected
                          ? 'border-indigo-300 bg-indigo-50/70'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleExam(exam.id)}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          'inline-flex size-5 shrink-0 items-center justify-center rounded-md border transition',
                          selected
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300 bg-white text-transparent'
                        )}
                      >
                        <Check className="size-3.5" strokeWidth={3} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block truncate text-sm font-medium',
                            selected ? 'text-indigo-700' : 'text-slate-800'
                          )}
                        >
                          {exam.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">{exam.totalMarks} marks</span>
                      </span>
                      {exam.examType ? (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {exam.examType}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Options + generate */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={attemptedOnly}
                onChange={(event) => setAttemptedOnly(event.target.checked)}
                className="size-4 rounded border-slate-300 text-indigo-600 accent-indigo-600"
              />
              Only students who attempted
            </label>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <BarChart3 className="size-4" />}
              Generate report
            </button>
          </div>
        </section>

        {/* Report */}
        {report ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900">Report</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {report.students.length} student{report.students.length === 1 ? '' : 's'} ·{' '}
                  {report.exams.length} exam{report.exams.length === 1 ? '' : 's'}
                  {classSubjectLabel ? ` · ${classSubjectLabel}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Download className="size-3.5" />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <FileSpreadsheet className="size-3.5" />
                  Excel
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <FileText className="size-3.5" />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Printer className="size-3.5" />
                  Print
                </button>
              </div>
            </div>

            {/* Grade-scale legend */}
            {report.gradeScale.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Grade bands:</span>
                {report.gradeScale.map((band) => (
                  <span
                    key={`${band.title}-${band.breakoff}`}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
                  >
                    <span className="font-semibold text-slate-700">{band.title}</span>
                    <span className="text-slate-400">≥ {band.breakoff}%</span>
                  </span>
                ))}
              </div>
            ) : null}

            {/* Matrix */}
            <div className="mt-4 overflow-x-auto">
              {report.students.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
                  No students match these filters.
                </p>
              ) : (
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow className="bg-slate-100/90 hover:bg-slate-100/90">
                      <TableHead className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        #
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Enrollment
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Student
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Std/Div
                      </TableHead>
                      {report.exams.map((exam) => (
                        <TableHead
                          key={exam.id}
                          className="text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600"
                        >
                          <span className="block max-w-[160px] truncate">{exam.name}</span>
                          <span className="block text-[10px] font-normal normal-case tracking-normal text-slate-400">
                            / {exam.totalMarks}
                          </span>
                        </TableHead>
                      ))}
                      <TableHead className="text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        Average %
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.students.map((student, index) => {
                      const perExam = report.marks[student.id] ?? {};
                      const avg = studentAverages.get(student.id);
                      return (
                        <TableRow key={student.id} className="odd:bg-white even:bg-slate-50/60">
                          <TableCell className="text-slate-500">{index + 1}</TableCell>
                          <TableCell className="text-slate-600">{student.enrollmentNo || '-'}</TableCell>
                          <TableCell className="font-medium text-slate-900">{student.name || '-'}</TableCell>
                          <TableCell className="text-slate-600">
                            {[student.standard, student.division].filter(Boolean).join(' / ') || '-'}
                          </TableCell>
                          {report.exams.map((exam) => {
                            const score = perExam[exam.id];
                            if (!score || score.obtain == null) {
                              return (
                                <TableCell key={exam.id} className="text-center text-slate-300">
                                  —
                                </TableCell>
                              );
                            }
                            const percent = scorePercent(score.obtain, exam.totalMarks);
                            const grade = gradeForPercent(percent, report.gradeScale);
                            return (
                              <TableCell key={exam.id} className="p-1 text-center">
                                <span
                                  className={cn(
                                    'inline-flex flex-col items-center gap-0.5 rounded-lg px-2 py-1',
                                    TIER_CELL[tierForPercent(percent)]
                                  )}
                                >
                                  <span className="text-sm font-semibold leading-none">
                                    {score.obtain}
                                    <span className="font-normal opacity-70">/{exam.totalMarks}</span>
                                    {score.attempts > 1 ? (
                                      <sup className="ml-0.5 text-[9px] font-semibold opacity-80">
                                        ×{score.attempts}
                                      </sup>
                                    ) : null}
                                  </span>
                                  <span className="text-[10px] font-medium leading-none">
                                    {percent}%{grade ? ` · ${grade}` : ''}
                                  </span>
                                </span>
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right font-semibold text-slate-700">
                            {avg == null ? <span className="text-slate-300">—</span> : `${avg}%`}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
