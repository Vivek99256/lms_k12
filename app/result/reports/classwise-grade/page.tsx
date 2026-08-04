'use client';

/**
 * Classwise grade report — flat tabular report with fixed leading and
 * trailing columns plus dynamic subject columns derived from the payload.
 */

import React, { useState } from 'react';
import { GraduationCap, Table2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/result/PageHeader';
import FilterBar, { type FilterFieldDef, type FilterValues } from '@/components/result/FilterBar';
import DataTable from '@/components/result/DataTable';
import { extractRows, resultGet } from '@/lib/result/api';
import type { ColumnDef } from '@/lib/result/types';

const FILTER_FIELDS: FilterFieldDef[] = [
  { kind: 'term' },
  { kind: 'section' },
  { kind: 'standard' },
  { kind: 'division' },
  {
    kind: 'api', name: 'exam_type', label: 'Exam type', path: 'getCreateExamName',
    params: { stdId: '{standard}', termID: '{term}' },
  },
];

const LEADING: [string, string][] = [
  ['roll_no', 'Roll no.'],
  ['student_name', 'Student name'],
  ['exam', 'Exam'],
];
const TRAILING: [string, string][] = [
  ['total', 'Total'],
  ['rank', 'Rank'],
  ['percentage', 'Perc.'],
  ['attendance', 'Atted.'],
  ['applied', 'Appli.'],
  ['conduct', 'Conduct'],
  ['remarks', 'Remarks'],
];
const EXCLUDED_KEYS = new Set(['id', 'student_id', 'stud_id']);

function pretty(key: string): string {
  const spaced = key.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function buildColumns(rows: Record<string, unknown>[]): ColumnDef[] {
  const first = rows[0] ?? {};
  const fixed = new Set([...LEADING, ...TRAILING].map(([key]) => key));
  const dynamic = Object.keys(first).filter((key) => !fixed.has(key) && !EXCLUDED_KEYS.has(key));
  return [
    ...LEADING.map(([key, header]): ColumnDef => ({ key, header, sortable: true, searchable: true })),
    ...dynamic.map((key): ColumnDef => ({ key, header: pretty(key), sortable: true, searchable: true })),
    ...TRAILING.map(([key, header]): ColumnDef => ({ key, header, sortable: true, searchable: true })),
  ];
}

export default function ClasswiseGradeReportPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [lastValues, setLastValues] = useState<Record<string, string>>({});

  const runSearch = async (flat: Record<string, string>) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await resultGet('result/classwise_grade_report/create', flat);
      setRows(extractRows(payload));
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Failed to load the classwise grade report.');
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const handleSearch = (values: FilterValues) => {
    const flat: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) flat[key] = Array.isArray(value) ? value.join(',') : value;
    setLastValues(flat);
    void runSearch(flat);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <PageHeader
          icon={GraduationCap}
          title="Classwise grade report"
          subtitle="Grade-wise performance summary of a class with subject-level detail"
          breadcrumbs={[{ label: 'Result', href: '/result' }, { label: 'Reports' }, { label: 'Classwise grade report' }]}
        />

        <FilterBar fields={FILTER_FIELDS} onSearch={handleSearch} loading={loading} />

        {searched && (
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-6 py-5">
              <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Table2 className="h-4 w-4" />
                </div>
                Classwise grade report
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <DataTable
                columns={buildColumns(rows)}
                rows={rows}
                loading={loading}
                error={error}
                onRetry={() => void runSearch(lastValues)}
                rowKey="id"
                exportName="classwise-grade-report"
                exportTitle="Classwise grade report"
                emptyTitle="No report data"
                emptyMessage="No records were returned for the selected criteria."
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
