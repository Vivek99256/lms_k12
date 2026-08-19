'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  ListChecks,
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
  TableFooter,
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
  fetchQuestionWiseReport,
  type QuestionWiseReport,
  type ReportExam,
} from '@/app/lms/data/questionWiseReport';
import RequireStaff from '@/app/lms/_shared/RequireStaff';

function singleValue(value: DropdownValue): string {
  return Array.isArray(value) ? value[0] ?? '' : value;
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export default function QuestionWiseReportPage() {
  const session = useMemo(() => buildSessionContext(), []);

  // Filters
  const [gradeId, setGradeId] = useState('');
  const [standardId, setStandardId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [examId, setExamId] = useState('');
  const [includeNonAttempters, setIncludeNonAttempters] = useState(true);

  const [subjectLabel, setSubjectLabel] = useState('');

  // Exams
  const [exams, setExams] = useState<ReportExam[]>([]);
  const [examsLoading, setExamsLoading] = useState(false);

  // Report
  const [report, setReport] = useState<QuestionWiseReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  // Load exams for the chosen subject
  useEffect(() => {
    let cancelled = false;
    if (!standardId || !subjectId) {
      queueMicrotask(() => {
        if (cancelled) return;
        setExams([]);
        setExamId('');
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
        setExamId('');
        setExamsLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        setExams([]);
        setExamId('');
        setExamsLoading(false);
        setErrorText(errorMessage(error));
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [standardId, subjectId]);

  const canGenerate = !!standardId && !!subjectId && !!examId && !loading;

  // Derived stats
  const stats = useMemo(() => {
    if (!report) return null;
    const totalQ = report.questions.length;
    const perQuestionRight = report.questions.map(
      (q) => report.students.filter((s) => report.answers[s.id]?.[q.id]).length
    );
    const perStudent = report.students.map((student) => {
      const right = report.questions.filter((q) => report.answers[student.id]?.[q.id]).length;
      const percent = totalQ > 0 ? Math.round((right * 100) / totalQ) : 0;
      return { right, percent };
    });
    const grandRight = perStudent.reduce((sum, s) => sum + s.right, 0);
    const grandPossible = report.students.length * totalQ;
    const grandPercent = grandPossible > 0 ? Math.round((grandRight * 100) / grandPossible) : 0;
    return { totalQ, perQuestionRight, perStudent, grandRight, grandPossible, grandPercent };
  }, [report]);

  // Export
  const exportColumns = useMemo<TableExportColumn[]>(() => {
    if (!report) return [];
    return [
      { key: 'roll', label: 'Roll', width: '56px', align: 'center' },
      { key: 'student', label: 'Student', width: '200px' },
      ...report.questions.map((q, i) => ({ key: `q_${q.id}`, label: `Q${i + 1}`, align: 'center' as const })),
      { key: 'obtain', label: 'Obtain', align: 'right' as const },
      { key: 'total', label: 'Total', align: 'right' as const },
      { key: 'per', label: 'Per(%)', align: 'right' as const },
      { key: 'status', label: 'Status', align: 'center' as const },
    ];
  }, [report]);

  const exportRows = useMemo<TableExportRow[]>(() => {
    if (!report || !stats) return [];
    return report.students.map((student, index) => {
      const row: TableExportRow = {
        roll: student.rollNo || String(index + 1),
        student: student.name,
      };
      report.questions.forEach((q) => {
        row[`q_${q.id}`] = report.answers[student.id]?.[q.id] ? '1' : '0';
      });
      const s = stats.perStudent[index];
      row.obtain = String(s.right);
      row.total = String(stats.totalQ);
      row.per = `${s.percent}%`;
      row.status = student.attempted ? 'Attempt' : 'No Attempt';
      return row;
    });
  }, [report, stats]);

  const exportTitle = 'Question Wise Report';
  const exportSubtitle = report
    ? [report.standardName, report.divisionName ? `Div ${report.divisionName}` : '', report.subjectName, report.paperName]
        .filter(Boolean)
        .join(' · ')
    : subjectLabel;

  const handleGenerate = async () => {
    if (!standardId || !subjectId || !examId) return;
    setLoading(true);
    setErrorText('');
    try {
      const result = await fetchQuestionWiseReport({
        gradeId,
        standardId,
        divisionId,
        subjectId,
        examId,
        includeNonAttempters,
      });
      setReport(result);
    } catch (error) {
      setReport(null);
      setErrorText(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <RequireStaff>
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">
        {/* Header */}
        <header className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <ListChecks className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Question Wise Report
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              See which questions each student answered correctly for a selected exam.
            </p>
          </div>
        </header>

        {errorText ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">{errorText}</div>
          </div>
        ) : null}

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
            onSectionChange={(value) => {
              setGradeId(singleValue(value));
              setStandardId('');
              setDivisionId('');
              setSubjectId('');
              setSubjectLabel('');
            }}
            onStandardChange={(value) => {
              setStandardId(singleValue(value));
              setDivisionId('');
              setSubjectId('');
              setSubjectLabel('');
            }}
            onDivisionChange={(value) => setDivisionId(singleValue(value))}
            onSubjectChange={(value, data) => {
              setSubjectId(singleValue(value));
              setSubjectLabel(data[0]?.subject_name ?? '');
            }}
          />

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Exam select */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Exam <span className="text-rose-500">*</span>
              </label>
              <select
                value={examId}
                onChange={(event) => setExamId(event.target.value)}
                disabled={!subjectId || examsLoading || exams.length === 0}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">
                  {!subjectId
                    ? 'Select a subject first'
                    : examsLoading
                      ? 'Loading exams…'
                      : exams.length === 0
                        ? 'No exams found'
                        : 'Select exam'}
                </option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Mode */}
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={includeNonAttempters}
                  onChange={(event) => setIncludeNonAttempters(event.target.checked)}
                  className="size-4 rounded border-slate-300 text-indigo-600 accent-indigo-600"
                />
                Include students who did not attempt
              </label>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ListChecks className="size-4" />}
              Generate report
            </button>
          </div>
        </section>

        {/* Report */}
        {report && stats ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900">{report.paperName || 'Report'}</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {report.students.length} student{report.students.length === 1 ? '' : 's'} ·{' '}
                  {stats.totalQ} question{stats.totalQ === 1 ? '' : 's'}
                  {exportSubtitle ? ` · ${exportSubtitle}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => exportRowsAsCsv({ filename: 'question-wise-report.csv', columns: exportColumns, rows: exportRows })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                  <Download className="size-3.5" /> CSV
                </button>
                <button type="button" onClick={() => exportRowsAsExcel({ filename: 'question-wise-report.xls', title: exportTitle, columns: exportColumns, rows: exportRows })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                  <FileSpreadsheet className="size-3.5" /> Excel
                </button>
                <button type="button" onClick={() => exportRowsAsPdf({ filename: 'question-wise-report.pdf', title: exportTitle, subtitle: exportSubtitle, columns: exportColumns, rows: exportRows })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                  <FileText className="size-3.5" /> PDF
                </button>
                <button type="button" onClick={() => openPrintPreview({ filename: 'question-wise-report.pdf', title: exportTitle, subtitle: exportSubtitle, columns: exportColumns, rows: exportRows })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                  <Printer className="size-3.5" /> Print
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              {report.students.length === 0 || stats.totalQ === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 px-3 py-10 text-center text-sm text-slate-500">
                  No data for this exam.
                </p>
              ) : (
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow className="bg-slate-100/90 hover:bg-slate-100/90">
                      <TableHead className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">Roll</TableHead>
                      <TableHead className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">Student</TableHead>
                      {report.questions.map((q, i) => (
                        <TableHead key={q.id} className="text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600" title={q.label}>
                          Q{i + 1}
                        </TableHead>
                      ))}
                      <TableHead className="text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">Obtain</TableHead>
                      <TableHead className="text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">Total</TableHead>
                      <TableHead className="text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">Per(%)</TableHead>
                      <TableHead className="text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.students.map((student, index) => {
                      const s = stats.perStudent[index];
                      return (
                        <TableRow key={student.id} className="odd:bg-white even:bg-slate-50/60">
                          <TableCell className="text-center text-slate-500">{student.rollNo || index + 1}</TableCell>
                          <TableCell className="font-medium text-slate-900">{student.name}</TableCell>
                          {report.questions.map((q) => {
                            const right = report.answers[student.id]?.[q.id];
                            return (
                              <TableCell
                                key={q.id}
                                className={cn(
                                  'text-center text-xs font-semibold',
                                  right ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                                )}
                              >
                                {right ? 1 : 0}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right font-semibold text-amber-700">{s.right}</TableCell>
                          <TableCell className="text-right text-slate-600">{stats.totalQ}</TableCell>
                          <TableCell className="text-right font-semibold text-slate-700">{s.percent}%</TableCell>
                          <TableCell className="text-center">
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                                student.attempted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                              )}
                            >
                              {student.attempted ? 'Attempt' : 'No Attempt'}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-slate-50 font-semibold">
                      <TableCell colSpan={2} className="text-slate-700">
                        Question Wise Total
                      </TableCell>
                      {stats.perQuestionRight.map((count, i) => (
                        <TableCell key={`qt-${i}`} className="text-center text-slate-700">
                          {count}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-slate-700">{stats.grandRight}</TableCell>
                      <TableCell className="text-right text-slate-700">{stats.grandPossible}</TableCell>
                      <TableCell className="text-right text-slate-700">{stats.grandPercent}%</TableCell>
                      <TableCell />
                    </TableRow>
                    <TableRow className="bg-slate-50/70 font-medium">
                      <TableCell colSpan={2} className="text-slate-600">
                        Total Students
                      </TableCell>
                      {report.questions.map((q) => (
                        <TableCell key={`ts-${q.id}`} className="text-center text-slate-600">
                          {report.students.length}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-slate-600">{report.students.length}</TableCell>
                      <TableCell className="text-right text-slate-600">{stats.grandPossible}</TableCell>
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
    </RequireStaff>
  );
}
