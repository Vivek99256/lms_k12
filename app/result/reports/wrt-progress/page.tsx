'use client';

/**
 * WRT progress report — like the WRT report but with test name and grade
 * columns plus a computed per-student summary row (total, percentage,
 * difference, grade, result, rank, ribbon base — whichever the payload
 * provides; total and percentage are computed client-side as a fallback).
 */

import React, { useRef, useState } from 'react';
import { FileText, Loader2, Printer, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/result/PageHeader';
import FilterBar, { type FilterFieldDef, type FilterValues } from '@/components/result/FilterBar';
import { Banner, EmptyState, TableSkeleton } from '@/components/result/primitives';
import { toast } from '@/components/result/toast';
import { printElement } from '@/components/result/print';
import { asRecord, readString, resultPost, toCollection } from '@/lib/result/api';

const FILTER_FIELDS: FilterFieldDef[] = [
  { kind: 'section', required: true },
  { kind: 'standard', required: true },
  { kind: 'division', required: true },
  { kind: 'date', name: 'from_date', label: 'From date', required: true },
  { kind: 'date', name: 'to_date', label: 'To date', required: true },
  {
    kind: 'api', name: 'exam_type', label: 'Exam type', path: 'api/get-exam-master-list',
    params: { standard_id: '{standard}' },
  },
];

type WrtStudent = {
  id: string;
  name: string;
  standard: string;
  division: string;
  rows: Record<string, unknown>[];
  raw: Record<string, unknown>;
};

function cell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value != null && value !== '' && typeof value !== 'object') return readString(value);
  }
  return '';
}

function parseStudents(payload: Record<string, unknown>): WrtStudent[] {
  const source = payload.data ?? payload;
  const record = asRecord(source);
  if (!Array.isArray(source) && Object.keys(record).length > 0 && Object.values(record).every((value) => Array.isArray(value))) {
    return Object.entries(record).map(([name, rows]) => ({
      id: '',
      name,
      standard: '',
      division: '',
      rows: (rows as unknown[]).map(asRecord),
      raw: {},
    })).filter((student) => student.rows.length > 0);
  }
  return toCollection(source)
    .map((item) => {
      const row = asRecord(item);
      const nested = toCollection(row.exam_data ?? row.exam_list ?? row.exams ?? row.rows ?? row.data ?? row.result).map(asRecord);
      return {
        id: cell(row, 'student_id', 'id'),
        name: cell(row, 'student_name', 'name', 'full_name'),
        standard: cell(row, 'standard', 'standard_name', 'std'),
        division: cell(row, 'division', 'division_name'),
        rows: nested.length > 0 ? nested : (Array.isArray(item) ? (item as unknown[]).map(asRecord) : []),
        raw: row,
      };
    })
    .filter((student) => student.name || student.rows.length > 0);
}

type Summary = { label: string; value: string }[];

function buildSummary(student: WrtStudent): Summary {
  // Client-side fallback computation of total + percentage.
  let totalMax = 0;
  let totalObt = 0;
  for (const row of student.rows) {
    const max = Number(cell(row, 'total_marks', 'outof', 'max_marks', 'TotalMarks'));
    const obt = Number(cell(row, 'obtained_marks', 'obt_marks', 'points', 'ObtainMarks'));
    if (Number.isFinite(max)) totalMax += max;
    if (Number.isFinite(obt)) totalObt += obt;
  }
  const computedTotal = totalMax > 0 ? `${totalObt} / ${totalMax}` : '';
  const computedPer = totalMax > 0 ? `${((totalObt / totalMax) * 100).toFixed(2)}%` : '';

  const entries: [string, string][] = [
    ['Total', cell(student.raw, 'total', 'Total', 'total_marks') || computedTotal],
    ['Per.%', cell(student.raw, 'per', 'percentage', 'Per', 'Percentage') || computedPer],
    ['Diff per.%', cell(student.raw, 'diff_per', 'diff_percentage', 'DiffPer')],
    ['Grade', cell(student.raw, 'grade', 'Grade')],
    ['Result', cell(student.raw, 'result', 'Result')],
    ['Rank', cell(student.raw, 'rank', 'Rank')],
    ['Ribbon base', cell(student.raw, 'ribbon_base', 'ribbon', 'RibbonBase')],
  ];
  return entries.filter(([, value]) => value !== '').map(([label, value]) => ({ label, value }));
}

export default function WrtProgressReportPage() {
  const [students, setStudents] = useState<WrtStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [lastFilters, setLastFilters] = useState<Record<string, string>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const handleSearch = async (values: FilterValues) => {
    const flat: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) flat[key] = Array.isArray(value) ? value.join(',') : value;
    setLastFilters(flat);
    setLoading(true);
    setError(null);
    try {
      const payload = await resultPost('result/WRT_progress_report/show_result', flat);
      setStudents(parseStudents(payload));
    } catch (err) {
      setStudents([]);
      setError(err instanceof Error ? err.message : 'Failed to load the WRT progress report.');
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const handlePrintAndGenerate = async () => {
    printElement(printRef.current, 'WRT progress report');
    setSaving(true);
    try {
      await resultPost('result/save_result_html', {
        grade_id: readString(lastFilters.grade),
        standard_id: readString(lastFilters.standard),
        division_id: readString(lastFilters.division),
        term_id: '',
        student_arr: students.map((student) => student.id).filter(Boolean).join(','),
      });
      toast.success('Result HTML saved for mobile app');
    } catch (err) {
      toast.error('Failed to save result HTML', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <PageHeader
          icon={TrendingUp}
          title="WRT progress report"
          subtitle="Weekly test progress per student with grades and summary"
          breadcrumbs={[{ label: 'Result', href: '/result' }, { label: 'Reports' }, { label: 'WRT progress report' }]}
        />

        <FilterBar fields={FILTER_FIELDS} onSearch={(values) => void handleSearch(values)} loading={loading} />

        {error && <Banner tone="error">{error}</Banner>}

        {searched && !error && (
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  Student progress {students.length > 0 && `(${students.length})`}
                </CardTitle>
                {students.length > 0 && (
                  <Button
                    onClick={() => void handlePrintAndGenerate()}
                    disabled={saving}
                    className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                    Print & generate result
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {loading ? (
                <TableSkeleton columns={8} />
              ) : students.length === 0 ? (
                <EmptyState title="No results found" message="No WRT progress results were returned for the selected criteria." />
              ) : (
                <div ref={printRef} className="space-y-6">
                  {students.map((student, studentIndex) => {
                    const summary = buildSummary(student);
                    return (
                      <div key={`${student.id || student.name}-${studentIndex}`} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
                          <h3 className="text-sm font-bold text-slate-900">{student.name || 'Student'}</h3>
                          {(student.standard || student.division) && (
                            <span className="text-xs text-slate-500">
                              {[student.standard, student.division].filter(Boolean).join(' / ')}
                            </span>
                          )}
                        </div>
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                              <th className="px-3 py-2 font-semibold">Sr. no.</th>
                              <th className="px-3 py-2 font-semibold">Test name</th>
                              <th className="px-3 py-2 font-semibold">Date</th>
                              <th className="px-3 py-2 font-semibold">Day</th>
                              <th className="px-3 py-2 font-semibold">Subject</th>
                              <th className="px-3 py-2 text-center font-semibold">Total marks</th>
                              <th className="px-3 py-2 text-center font-semibold">Obt. marks</th>
                              <th className="px-3 py-2 text-center font-semibold">Percentage (%)</th>
                              <th className="px-3 py-2 text-center font-semibold">Grade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {student.rows.length === 0 ? (
                              <tr><td colSpan={9} className="px-3 py-4 text-center text-slate-400">No test rows</td></tr>
                            ) : (
                              student.rows.map((row, rowIndex) => (
                                <tr key={rowIndex} className="border-b border-slate-100 last:border-0">
                                  <td className="px-3 py-2 text-slate-600">{rowIndex + 1}</td>
                                  <td className="px-3 py-2 text-slate-600">{cell(row, 'ExamTitle', 'exam_title', 'test_name', 'exam_name') || '—'}</td>
                                  <td className="px-3 py-2 text-slate-600">{cell(row, 'date', 'exam_date', 'Date') || '—'}</td>
                                  <td className="px-3 py-2 text-slate-600">{cell(row, 'day', 'Day') || '—'}</td>
                                  <td className="px-3 py-2 text-slate-600">{cell(row, 'subject', 'subject_name', 'Subject') || '—'}</td>
                                  <td className="px-3 py-2 text-center text-slate-600">{cell(row, 'total_marks', 'outof', 'max_marks', 'TotalMarks') || '—'}</td>
                                  <td className="px-3 py-2 text-center text-slate-600">{cell(row, 'obtained_marks', 'obt_marks', 'points', 'ObtainMarks') || '—'}</td>
                                  <td className="px-3 py-2 text-center text-slate-600">{cell(row, 'percentage', 'per', 'Percentage') || '—'}</td>
                                  <td className="px-3 py-2 text-center text-slate-600">{cell(row, 'grade', 'Grade') || '—'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                          {summary.length > 0 && (
                            <tfoot>
                              <tr className="border-t border-slate-200 bg-slate-50/70">
                                <td colSpan={9} className="px-3 py-2">
                                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-semibold text-slate-700">
                                    {summary.map((item) => (
                                      <span key={item.label}>
                                        <span className="uppercase tracking-wide text-slate-500">{item.label}:</span> {item.value}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
