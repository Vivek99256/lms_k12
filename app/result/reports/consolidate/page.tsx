'use client';

/**
 * Consolidate report — Term > Exam > Subject/notebook matrix of marks per
 * student, rendered with a three-row grouped header. If the nested payload
 * shape cannot be resolved, the rows are flattened into a plain DataTable.
 */

import React, { useState } from 'react';
import { FileSpreadsheet, Sheet, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/result/PageHeader';
import FilterBar, { type FilterFieldDef, type FilterValues } from '@/components/result/FilterBar';
import DataTable from '@/components/result/DataTable';
import { Banner, EmptyState, TableSkeleton } from '@/components/result/primitives';
import { asRecord, readString, resultGet, toCollection } from '@/lib/result/api';
import type { ColumnDef } from '@/lib/result/types';
import { exportRowsAsExcel, type TableExportColumn } from '@/lib/table-export';

const FILTER_FIELDS: FilterFieldDef[] = [
  { kind: 'section' },
  { kind: 'standard', required: true },
  { kind: 'division', required: true },
];

type Leaf = { term: string; exam: string; leaf: string };
type HeaderTree = { term: string; exams: { exam: string; leaves: string[] }[] }[];
type StudentRow = { rollNo: string; name: string; raw: Record<string, unknown> };

/** Find a depth-3 nested record (term -> exam -> subject labels) in the payload. */
function findHeaderTree(data: Record<string, unknown>): HeaderTree {
  const candidates = [
    data.examMasterWise, data.exam_data, data.header, data.header_data, data.term_data, data.terms, data.structure,
    ...Object.values(data),
  ];
  for (const candidate of candidates) {
    if (candidate == null || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const termRecord = asRecord(candidate);
    const entries = Object.entries(termRecord);
    if (entries.length === 0) continue;
    const allNested = entries.every(([, examMap]) =>
      examMap != null && typeof examMap === 'object' && !Array.isArray(examMap) &&
      Object.values(asRecord(examMap)).every((leaves) => leaves != null && typeof leaves === 'object'),
    );
    if (!allNested) continue;
    const tree: HeaderTree = entries.map(([term, examMap]) => ({
      term,
      exams: Object.entries(asRecord(examMap)).map(([exam, leaves]) => ({
        exam,
        leaves: Array.isArray(leaves)
          ? (leaves as unknown[]).map((leaf) => readString(leaf)).filter(Boolean)
          : Object.keys(asRecord(leaves)),
      })),
    }));
    if (tree.some((term) => term.exams.some((exam) => exam.leaves.length > 0))) return tree;
  }
  return [];
}

function findStudents(data: Record<string, unknown>): StudentRow[] {
  const candidates = [data.studentMarks, data.students, data.stu_data, data.student_data, data.student_list, data.data];
  for (const candidate of candidates) {
    const collection = toCollection(candidate).map(asRecord).filter((row) => Object.keys(row).length > 0);
    if (collection.length > 0 && collection.some((row) => row.student_name || row.name || row.full_name)) {
      return collection.map((row) => ({
        rollNo: readString(row.roll_no ?? row.rollno),
        name: readString(row.student_name ?? row.name ?? row.full_name),
        raw: row,
      }));
    }
  }
  // Last resort: any array of records with a student-name-ish key.
  for (const value of Object.values(data)) {
    const collection = toCollection(value).map(asRecord);
    if (collection.length > 0 && collection.some((row) => row.student_name || row.name)) {
      return collection.map((row) => ({
        rollNo: readString(row.roll_no ?? row.rollno),
        name: readString(row.student_name ?? row.name),
        raw: row,
      }));
    }
  }
  return [];
}

/** Resolve a student's mark for a term/exam/leaf cell across likely shapes. */
function cellValue(student: StudentRow, leaf: Leaf): string {
  const { raw } = student;
  const nested = asRecord(asRecord(asRecord(raw[leaf.term])[leaf.exam]));
  const fromNested = nested[leaf.leaf];
  if (fromNested != null && typeof fromNested !== 'object') return readString(fromNested);
  const marks = asRecord(raw.marks ?? raw.marks_data ?? raw.points);
  const fromMarks = asRecord(asRecord(marks[leaf.term])[leaf.exam])[leaf.leaf];
  if (fromMarks != null && typeof fromMarks !== 'object') return readString(fromMarks);
  const termMarks = asRecord(asRecord(asRecord(raw.terms)[leaf.term]).exams);
  const examMarks = asRecord(termMarks[leaf.exam]);
  const subjectMarks = asRecord(examMarks[leaf.leaf]);
  const directMark = Object.values(subjectMarks)[0];
  if (directMark != null && typeof directMark === 'object') {
    const obtained = asRecord(directMark).ob_marks;
    if (obtained != null) return readString(obtained);
  }
  const flatKeys = [`${leaf.term}_${leaf.exam}_${leaf.leaf}`, `${leaf.exam}_${leaf.leaf}`, leaf.leaf];
  for (const key of flatKeys) {
    const value = raw[key];
    if (value != null && typeof value !== 'object') return readString(value);
  }
  return '';
}

/** Flatten one level of nested records into dotted keys for the fallback table. */
function flattenRow(row: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value != null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [innerKey, innerValue] of Object.entries(asRecord(value))) {
        if (innerValue == null || typeof innerValue !== 'object') flat[`${key}.${innerKey}`] = innerValue;
      }
    } else if (!Array.isArray(value)) {
      flat[key] = value;
    }
  }
  return flat;
}

export default function ConsolidateReportPage() {
  const [tree, setTree] = useState<HeaderTree>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [fallbackRows, setFallbackRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (values: FilterValues) => {
    const flat: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) flat[key] = Array.isArray(value) ? value.join(',') : value;
    setLoading(true);
    setError(null);
    try {
      const payload = await resultGet('api/result/consolidate-report', flat);
      const data = asRecord(payload.data ?? payload);
      const headerTree = findHeaderTree(data);
      const studentRows = findStudents(data);
      setTree(headerTree);
      setStudents(studentRows);
      setFallbackRows(headerTree.length === 0 ? studentRows.map((student) => flattenRow(student.raw)) : []);
    } catch (err) {
      setTree([]);
      setStudents([]);
      setFallbackRows([]);
      setError(err instanceof Error ? err.message : 'Failed to load the consolidate report.');
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const leaves: Leaf[] = tree.flatMap((term) =>
    term.exams.flatMap((exam) => exam.leaves.map((leaf) => ({ term: term.term, exam: exam.exam, leaf }))),
  );

  const handleExcelExport = () => {
    const columns: TableExportColumn[] = [
      { key: 'roll_no', label: 'Roll no' },
      { key: 'student_name', label: 'Student name' },
      ...leaves.map((leaf, index) => ({ key: `c${index}`, label: `${leaf.term} / ${leaf.exam} / ${leaf.leaf}` })),
    ];
    const rows = students.map((student) => {
      const row: Record<string, string> = { roll_no: student.rollNo, student_name: student.name };
      leaves.forEach((leaf, index) => { row[`c${index}`] = cellValue(student, leaf); });
      return row;
    });
    exportRowsAsExcel({ filename: 'ConsolidateReport.xls', title: 'Consolidate report', columns, rows });
  };

  const fallbackColumns: ColumnDef[] = Object.keys(fallbackRows[0] ?? {}).map((key) => ({
    key, header: key.replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), sortable: true, searchable: true,
  }));

  const hasMatrix = tree.length > 0 && students.length > 0;

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <PageHeader
          icon={Sheet}
          title="Consolidate report"
          subtitle="Term, exam and subject-wise consolidated marks for a class"
          breadcrumbs={[{ label: 'Result', href: '/result' }, { label: 'Reports' }, { label: 'Consolidate report' }]}
        />

        <FilterBar fields={FILTER_FIELDS} onSearch={(values) => void handleSearch(values)} loading={loading} />

        {error && <Banner tone="error">{error}</Banner>}

        {searched && !error && (
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Table2 className="h-4 w-4" />
                  </div>
                  Consolidated marks
                </CardTitle>
                {hasMatrix && (
                  <Button variant="outline" size="sm" onClick={handleExcelExport}>
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Export to Excel
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className={hasMatrix ? 'p-0' : 'p-4'}>
              {loading ? (
                <TableSkeleton columns={6} />
              ) : hasMatrix ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <th rowSpan={3} className="border-r border-slate-100 px-4 py-3 font-semibold">Roll no</th>
                        <th rowSpan={3} className="border-r border-slate-100 px-4 py-3 font-semibold">Student name</th>
                        {tree.map((term) => (
                          <th
                            key={term.term}
                            colSpan={term.exams.reduce((count, exam) => count + exam.leaves.length, 0)}
                            className="border-b border-r border-slate-100 px-4 py-2 text-center font-semibold"
                          >
                            {term.term}
                          </th>
                        ))}
                      </tr>
                      <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        {tree.flatMap((term) =>
                          term.exams.map((exam) => (
                            <th
                              key={`${term.term}-${exam.exam}`}
                              colSpan={exam.leaves.length}
                              className="border-b border-r border-slate-100 px-4 py-2 text-center font-semibold"
                            >
                              {exam.exam}
                            </th>
                          )),
                        )}
                      </tr>
                      <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        {leaves.map((leaf, index) => (
                          <th key={index} className="border-r border-slate-100 px-4 py-2 text-center font-semibold">
                            {leaf.leaf}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, studentIndex) => (
                        <tr key={`${student.name}-${studentIndex}`} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                          <td className="border-r border-slate-100 px-4 py-3 text-slate-600">{student.rollNo || '—'}</td>
                          <td className="border-r border-slate-100 px-4 py-3 font-medium text-slate-900">{student.name || '—'}</td>
                          {leaves.map((leaf, index) => (
                            <td key={index} className="border-r border-slate-100 px-4 py-3 text-center text-slate-600">
                              {cellValue(student, leaf) || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : fallbackRows.length > 0 ? (
                <div className="space-y-3">
                  <Banner tone="warning">
                    The nested consolidate structure could not be resolved — showing a flattened table instead.
                  </Banner>
                  <DataTable
                    columns={fallbackColumns}
                    rows={fallbackRows}
                    loading={false}
                    rowKey="id"
                    exportName="consolidate-report"
                    exportTitle="Consolidate report"
                    emptyTitle="No report data"
                    emptyMessage="No records were returned for the selected criteria."
                  />
                </div>
              ) : (
                <EmptyState title="No report data" message="No consolidated marks were returned for the selected criteria." />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
