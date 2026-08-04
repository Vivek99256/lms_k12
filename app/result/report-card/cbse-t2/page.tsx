'use client';

/**
 * CBSE report card (Term 2) — per-student report cards with a scholastic
 * table of Term 1 exam marks + grade (omitted for class IX), academic-year
 * exam marks + grade, total and percentage. AB / N.A. / EX values render
 * verbatim. Includes an attendance block and a combined
 * "Print & generate result" action.
 */

import React, { useRef, useState } from 'react';
import { Award, Loader2, Printer } from 'lucide-react';
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
];

/* ------------------------------------------------------------- parsing */

type TermBlock = { marks: Record<string, string>; grade: string };
type ScholRow = { subject: string; term1: TermBlock; yearly: TermBlock; total: string; percentage: string };
type T2Student = {
  raw: Record<string, unknown>;
  id: string;
  info: { label: string; value: string }[];
  className: string;
  scholastic: ScholRow[];
  workingDays: string;
  daysAttended: string;
  parsed: boolean;
};

function pick(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] != null) return record[key];
  }
  return undefined;
}

function text(record: Record<string, unknown>, ...keys: string[]): string {
  const value = pick(record, ...keys);
  return value != null && typeof value !== 'object' ? readString(value) : '';
}

function parseTermBlock(value: unknown): TermBlock {
  const record = asRecord(value);
  const marks: Record<string, string> = {};
  let grade = '';
  for (const [key, item] of Object.entries(record)) {
    if (/grade/i.test(key)) { grade = readString(item); continue; }
    if (item == null || typeof item === 'object') continue;
    marks[key] = readString(item);
  }
  return { marks, grade };
}

function parseScholastic(student: Record<string, unknown>): ScholRow[] {
  const source = pick(student, 'scholastic', 'scholastic_data', 'subjects', 'subject_data', 'marks_data', 'mark_data', 'marks');
  const rows: ScholRow[] = [];

  const buildRow = (subject: string, value: Record<string, unknown>): ScholRow => {
    const term1 = parseTermBlock(pick(value, 'term1', 'Term1', 'term_1', 'Term 1', 'term-1'));
    const yearly = parseTermBlock(pick(value, 'academic_year', 'academicYear', 'Academic year', 'yearly', 'term2', 'Term2', 'term_2', 'Term 2'));
    term1.grade = text(value, 'term1_grade', 'grade1', 'Term1Grade') || term1.grade;
    yearly.grade = text(value, 'academic_year_grade', 'yearly_grade', 'term2_grade', 'grade2') || yearly.grade;
    return {
      subject,
      term1,
      yearly,
      total: text(value, 'total', 'Total'),
      percentage: text(value, 'percentage', 'per', 'Percentage'),
    };
  };

  if (source != null && typeof source === 'object' && !Array.isArray(source)) {
    for (const [subject, value] of Object.entries(asRecord(source))) {
      if (value == null || typeof value !== 'object') continue;
      rows.push(buildRow(subject, asRecord(value)));
    }
  } else {
    for (const item of toCollection(source)) {
      const record = asRecord(item);
      const subject = text(record, 'subject_name', 'subject', 'name', 'title');
      if (!subject) continue;
      rows.push(buildRow(subject, record));
    }
  }
  return rows;
}

function parseStudent(record: Record<string, unknown>): T2Student {
  const className = text(record, 'standard', 'standard_name', 'class', 'class_name', 'std');
  const infoCandidates: [string, string][] = [
    ['Student name', text(record, 'student_name', 'name', 'full_name')],
    ['Class', className],
    ['Division', text(record, 'division', 'division_name')],
    ['Roll no', text(record, 'roll_no', 'rollno')],
    ['Admission no', text(record, 'admission_no', 'enrollment_no', 'gr_number', 'gr_no')],
    ["Father's name", text(record, 'father_name', 'fathers_name')],
    ["Mother's name", text(record, 'mother_name', 'mothers_name')],
    ['Date of birth', text(record, 'dob', 'date_of_birth', 'birth_date')],
  ];
  const attendance = asRecord(pick(record, 'attendance', 'attendance_data'));
  const scholastic = parseScholastic(record);
  return {
    raw: record,
    id: text(record, 'student_id', 'id'),
    info: infoCandidates.filter(([, value]) => value !== '').map(([label, value]) => ({ label, value })),
    className,
    scholastic,
    workingDays: text(attendance, 'working_days', 'total_working_days', 'no_of_working_days') || text(record, 'working_days', 'total_working_day'),
    daysAttended: text(attendance, 'days_attended', 'attended_days', 'present_days') || text(record, 'days_attended', 'present_working_day'),
    parsed: scholastic.length > 0,
  };
}

function parseStudents(payload: Record<string, unknown>): T2Student[] {
  const source = payload.data ?? payload;
  const record = asRecord(source);
  if (!Array.isArray(source) && (record.student_name || record.scholastic || record.subjects || record.marks_data)) {
    return [parseStudent(record)];
  }
  return toCollection(source)
    .map(asRecord)
    .filter((row) => Object.keys(row).length > 0)
    .map(parseStudent);
}

function isClassNine(className: string): boolean {
  return /(^|[^A-Za-z0-9])(IX|9)([^A-Za-z0-9]|$)/i.test(` ${className} `);
}

function unionKeys(rows: ScholRow[], term: 'term1' | 'yearly'): string[] {
  const keys: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row[term].marks)) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

/* -------------------------------------------------------------- page */

export default function CbseT2ReportCardPage() {
  const [students, setStudents] = useState<T2Student[]>([]);
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
      const payload = await resultPost('result/cbse_1t5_t2_result/show_result', flat);
      setStudents(parseStudents(payload));
    } catch (err) {
      setStudents([]);
      setError(err instanceof Error ? err.message : 'Failed to load report cards.');
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const handlePrintAndGenerate = async () => {
    printElement(printRef.current, 'CBSE report card (Term 2)');
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
          icon={Award}
          title="CBSE report card (Term 2)"
          subtitle="Term 2 report cards with academic-year totals and percentages"
          breadcrumbs={[{ label: 'Result', href: '/result' }, { label: 'Reports' }, { label: 'CBSE report card (Term 2)' }]}
        />

        <FilterBar fields={FILTER_FIELDS} onSearch={(values) => void handleSearch(values)} loading={loading} />

        {error && <Banner tone="error">{error}</Banner>}

        {searched && !error && (
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Award className="h-4 w-4" />
                  </div>
                  Report cards {students.length > 0 && `(${students.length})`}
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
                <TableSkeleton columns={6} />
              ) : students.length === 0 ? (
                <EmptyState title="No report cards" message="No student result data was returned for the selected criteria." />
              ) : (
                <div ref={printRef} className="space-y-8">
                  {students.map((student, index) => {
                    if (!student.parsed) {
                      return (
                        <div key={index} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                          <Banner tone="warning">Unrecognised report payload — showing raw data</Banner>
                          <pre className="max-h-96 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                            {JSON.stringify(student.raw, null, 2)}
                          </pre>
                        </div>
                      );
                    }
                    const showTerm1 = !isClassNine(student.className);
                    const term1Cols = unionKeys(student.scholastic, 'term1');
                    const yearlyCols = unionKeys(student.scholastic, 'yearly');
                    return (
                      <div key={student.id || index} className="rounded-xl border border-slate-200 bg-white p-5">
                        <div className="mb-4 border-b border-slate-100 pb-3">
                          <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
                            {student.info.map((item) => (
                              <p key={item.label} className="text-sm text-slate-600">
                                <span className="font-semibold text-slate-800">{item.label}:</span> {item.value}
                              </p>
                            ))}
                          </div>
                        </div>

                        <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Scholastic areas</h4>
                        <div className="mb-5 overflow-x-auto">
                          <table className="w-full min-w-max border border-slate-200 text-left text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                <th rowSpan={2} className="border-r border-slate-200 px-3 py-2 font-semibold">Subject name</th>
                                {showTerm1 && term1Cols.length > 0 && (
                                  <th colSpan={term1Cols.length + 1} className="border-b border-r border-slate-200 px-3 py-2 text-center font-semibold">Term 1</th>
                                )}
                                {yearlyCols.length > 0 && (
                                  <th colSpan={yearlyCols.length + 1} className="border-b border-r border-slate-200 px-3 py-2 text-center font-semibold">Academic year</th>
                                )}
                                <th rowSpan={2} className="border-r border-slate-200 px-3 py-2 text-center font-semibold">Total</th>
                                <th rowSpan={2} className="px-3 py-2 text-center font-semibold">Percentage</th>
                              </tr>
                              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                {showTerm1 && term1Cols.map((columnKey) => (
                                  <th key={`t1-${columnKey}`} className="border-r border-slate-200 px-3 py-2 text-center font-semibold">{columnKey}</th>
                                ))}
                                {showTerm1 && term1Cols.length > 0 && <th className="border-r border-slate-200 px-3 py-2 text-center font-semibold">Grade</th>}
                                {yearlyCols.map((columnKey) => (
                                  <th key={`yr-${columnKey}`} className="border-r border-slate-200 px-3 py-2 text-center font-semibold">{columnKey}</th>
                                ))}
                                {yearlyCols.length > 0 && <th className="border-r border-slate-200 px-3 py-2 text-center font-semibold">Grade</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {student.scholastic.map((row) => (
                                <tr key={row.subject} className="border-b border-slate-100 last:border-0">
                                  <td className="border-r border-slate-200 px-3 py-2 font-medium text-slate-800">{row.subject}</td>
                                  {showTerm1 && term1Cols.map((columnKey) => (
                                    <td key={`t1-${columnKey}`} className="border-r border-slate-200 px-3 py-2 text-center text-slate-600">
                                      {row.term1.marks[columnKey] ?? '—'}
                                    </td>
                                  ))}
                                  {showTerm1 && term1Cols.length > 0 && (
                                    <td className="border-r border-slate-200 px-3 py-2 text-center font-semibold text-slate-700">{row.term1.grade || '—'}</td>
                                  )}
                                  {yearlyCols.map((columnKey) => (
                                    <td key={`yr-${columnKey}`} className="border-r border-slate-200 px-3 py-2 text-center text-slate-600">
                                      {row.yearly.marks[columnKey] ?? '—'}
                                    </td>
                                  ))}
                                  {yearlyCols.length > 0 && (
                                    <td className="border-r border-slate-200 px-3 py-2 text-center font-semibold text-slate-700">{row.yearly.grade || '—'}</td>
                                  )}
                                  <td className="border-r border-slate-200 px-3 py-2 text-center text-slate-600">{row.total || '—'}</td>
                                  <td className="px-3 py-2 text-center text-slate-600">{row.percentage || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {(student.workingDays || student.daysAttended) && (
                          <div>
                            <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Attendance</h4>
                            <table className="w-full max-w-md border border-slate-200 text-left text-sm">
                              <tbody>
                                <tr className="border-b border-slate-100">
                                  <td className="border-r border-slate-200 px-3 py-2 font-medium text-slate-800">No. of working days</td>
                                  <td className="px-3 py-2 text-center text-slate-600">{student.workingDays || '—'}</td>
                                </tr>
                                <tr>
                                  <td className="border-r border-slate-200 px-3 py-2 font-medium text-slate-800">Days attended</td>
                                  <td className="px-3 py-2 text-center text-slate-600">{student.daysAttended || '—'}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}
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
