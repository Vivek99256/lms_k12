'use client';

/**
 * Result report — unified screen for 8 report types (merit, subject
 * progress, classwise, classwise grade, overall, marks, weightage
 * conversion and created exam reports). Columns are partly fixed per
 * report type and partly derived from the payload at runtime.
 */

import React, { useState } from 'react';
import { BarChart3, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/result/PageHeader';
import FilterBar, { type FilterFieldDef, type FilterValues } from '@/components/result/FilterBar';
import DataTable from '@/components/result/DataTable';
import { toast } from '@/components/result/toast';
import { extractRows, readString, resultGet, resultPost } from '@/lib/result/api';
import type { ColumnDef } from '@/lib/result/types';

const REPORT_OPTIONS = [
  { value: 'merit_report', label: 'Merit report' },
  { value: 'subject_progress_report', label: 'Subject progress report' },
  { value: 'classwise_report', label: 'Classwise report' },
  { value: 'classwise_grade_report', label: 'Classwise grade report' },
  { value: 'overall_report', label: 'Overall report' },
  { value: 'marks_report', label: 'Marks report' },
  { value: 'weightage_conversion_report', label: 'Weightage conversion report' },
  { value: 'created_exam_report', label: 'Created exam report' },
];

const REPORT_LABELS: Record<string, string> = Object.fromEntries(
  REPORT_OPTIONS.map((option) => [option.value, option.label]),
);

const DATE_RANGE_REPORTS = ['subject_progress_report', 'classwise_report', 'marks_report', 'created_exam_report'];

const FILTER_FIELDS: FilterFieldDef[] = [
  { kind: 'static', name: 'report_of', label: 'Select report', required: true, options: REPORT_OPTIONS },
  { kind: 'term', required: true },
  { kind: 'section', required: true },
  { kind: 'standard', required: true },
  { kind: 'division', required: true },
  {
    kind: 'api', name: 'additional_subjects', label: 'Select subject', path: 'ajax_StandardwiseSubject',
    params: { std_id: '{standard}' }, multi: true,
    showIf: { field: 'report_of', equals: ['marks_report'] },
  },
  {
    kind: 'api', name: 'subject', label: 'Select subject', path: 'ajax_StandardwiseSubject',
    params: { std_id: '{standard}' },
    showIf: { field: 'report_of', equals: ['subject_progress_report', 'weightage_conversion_report'] },
  },
  { kind: 'number', name: 'top_students', label: 'Top students', showIf: { field: 'report_of', equals: ['merit_report'] } },
  { kind: 'number', name: 'roll_no', label: 'Roll no', showIf: { field: 'report_of', equals: ['merit_report'] } },
  { kind: 'date', name: 'from_date', label: 'From date', showIf: { field: 'report_of', equals: DATE_RANGE_REPORTS } },
  { kind: 'date', name: 'to_date', label: 'To date', showIf: { field: 'report_of', equals: DATE_RANGE_REPORTS } },
  {
    kind: 'api', name: 'exam_type', label: 'Exam type', path: 'api/get-exam-master-list',
    params: { standard_id: '{standard}', term_id: '{term}' },
    showIf: { field: 'report_of', equals: ['classwise_report', 'classwise_grade_report', 'overall_report'] },
  },
  {
    kind: 'api', name: 'exam_create', label: 'Select exam', path: 'api/get-exam-list',
    params: { standard_id: '{standard}', exam_id: '{exam_type}' },
    showIf: { field: 'report_of', equals: ['classwise_report', 'classwise_grade_report'] },
  },
  {
    kind: 'static', name: 'totalField', label: 'With total',
    options: [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }],
    defaultValue: 'Yes',
    showIf: { field: 'report_of', equals: ['created_exam_report'] },
  },
];

function flatten(values: FilterValues): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    flat[key] = Array.isArray(value) ? value.join(',') : value;
  }
  return flat;
}

function pretty(key: string): string {
  const spaced = key.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const EXCLUDED_KEYS = new Set(['id', 'student_id', 'stud_id']);

/** Fixed leading/trailing columns per report type; dynamic keys fill the middle. */
function buildColumns(reportType: string, rows: Record<string, unknown>[]): ColumnDef[] {
  const first = rows[0] ?? {};
  const keys = Object.keys(first);

  const col = (key: string, header?: string, extra?: Partial<ColumnDef>): ColumnDef => ({
    key, header: header ?? pretty(key), sortable: true, searchable: true, ...extra,
  });
  const dynamic = (used: string[]): ColumnDef[] =>
    keys
      .filter((key) => !used.includes(key) && !EXCLUDED_KEYS.has(key))
      .map((key) => col(key));

  switch (reportType) {
    case 'merit_report':
      return [col('rank', 'Rank'), col('student_name', 'Student name'), col('percentage', 'Percentage(%)')];
    case 'subject_progress_report': {
      const leading = ['roll_no', 'student_name'];
      const trailing = ['total', 'percentage'];
      return [
        col('roll_no', 'Roll no'), col('student_name', 'Student name'),
        ...dynamic([...leading, ...trailing]),
        col('total', 'Total'), col('percentage', 'Percentage'),
      ];
    }
    case 'classwise_report':
    case 'classwise_grade_report': {
      const leading = ['standard', 'roll_no', 'student_name'];
      const trailing = ['total', 'percentage', 'grade', 'attendance'];
      return [
        col('standard', 'Standard'), col('roll_no', 'Roll no'), col('student_name', 'Student name'),
        ...dynamic([...leading, ...trailing]),
        col('total', 'Total'), col('percentage', 'Percentage'), col('grade', 'Grade'),
        ...(keys.includes('attendance') ? [col('attendance', 'Attendance')] : []),
      ];
    }
    case 'overall_report': {
      const leading = ['roll_no', 'student_name'];
      const trailing = ['final_total', 'final_grades', 'percentage'];
      return [
        col('roll_no', 'Roll no'), col('student_name', 'Student name'),
        ...dynamic([...leading, ...trailing]),
        col('final_total', 'Final total'), col('final_grades', 'Grades'), col('percentage', 'Percentage'),
      ];
    }
    case 'marks_report': {
      const leading = ['standard', 'roll_no', 'student_name'];
      const trailing = ['total', 'percentage'];
      return [
        col('standard', 'Standard'), col('roll_no', 'Roll no'), col('student_name', 'Student name'),
        ...dynamic([...leading, ...trailing]),
        col('total', 'Total'), col('percentage', 'Percentage'),
      ];
    }
    case 'weightage_conversion_report': {
      const leading = ['standard', 'roll_no', 'student_name'];
      const trailing = ['marks_obtained'];
      return [
        col('standard', 'Standard'), col('roll_no', 'Roll no'), col('student_name', 'Student name'),
        ...dynamic([...leading, ...trailing]),
        col('marks_obtained', 'Marks obtained'),
      ];
    }
    case 'created_exam_report': {
      const leading = ['roll_no', 'student_name', 'enrollment_no', 'std_div', 'term'];
      return [
        col('roll_no', 'Roll no'), col('student_name', 'Student name'),
        col('enrollment_no', 'Enrollment no', { mono: true }), col('std_div', 'Std/Div'), col('term', 'Term'),
        ...dynamic(leading),
      ];
    }
    default:
      return dynamic([]);
  }
}

export default function ResultReportPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [reportType, setReportType] = useState('');
  const [lastFilters, setLastFilters] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = async (flat: Record<string, string>) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await resultPost('result/show_result_report', flat);
      setRows(extractRows(payload));
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Failed to load report. Please try again.');
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const handleSearch = (values: FilterValues) => {
    const flat = flatten(values);
    setReportType(readString(values.report_of));
    setLastFilters(flat);
    void runSearch(flat);
  };

  const handleServerExcel = async () => {
    try {
      await resultGet('result/cbse_1t5_result/download_overall_report', lastFilters);
      toast.info('Server export requested', 'The overall report Excel export was requested from the server.');
    } catch (err) {
      toast.error('Server export failed', err instanceof Error ? err.message : undefined);
    }
  };

  const columns = buildColumns(reportType, rows);
  const reportLabel = REPORT_LABELS[reportType] ?? 'Report';

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <PageHeader
          icon={BarChart3}
          title="Result report"
          subtitle="Generate merit, progress, classwise, overall, marks, weightage and created exam reports"
          breadcrumbs={[{ label: 'Result', href: '/result' }, { label: 'Reports' }, { label: 'Result report' }]}
        />

        <FilterBar fields={FILTER_FIELDS} onSearch={handleSearch} loading={loading} searchLabel="Show report" />

        {searched && (
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-6 py-5">
              <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <BarChart3 className="h-4 w-4" />
                </div>
                {reportLabel}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <DataTable
                columns={columns}
                rows={rows}
                loading={loading}
                error={error}
                onRetry={() => void runSearch(lastFilters)}
                rowKey="id"
                exportName="result-report"
                exportTitle={reportLabel}
                emptyTitle="No report data"
                emptyMessage="No records were returned for the selected criteria."
                toolbar={
                  reportType === 'overall_report' ? (
                    <Button variant="outline" size="sm" onClick={() => void handleServerExcel()} title="Request server-side Excel export">
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      Excel (server)
                    </Button>
                  ) : undefined
                }
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
