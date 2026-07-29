'use client';

/**
 * Student result remarks — assign a promotion/result remark (and an
 * optional custom remark) to every student of a class for a term.
 */

import React, { useState } from 'react';
import { ClipboardList, Loader2, Save, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import PageHeader from '@/components/result/PageHeader';
import FilterBar, { type FilterFieldDef, type FilterValues } from '@/components/result/FilterBar';
import { Banner, EmptyState, TableSkeleton } from '@/components/result/primitives';
import { toast } from '@/components/result/toast';
import { assertOk, extractRows, readString, resultGet, resultPost } from '@/lib/result/api';

const FILTER_FIELDS: FilterFieldDef[] = [
  { kind: 'section', required: true },
  { kind: 'standard', required: true },
  { kind: 'division', required: true },
  { kind: 'term', required: true },
];

const REMARK_OPTIONS = [
  'Passed & Promoted',
  'Promoted',
  'Promoted with condition of improvement',
  'Detained in class 9',
  '*Passed with grace marks',
  'Failed',
  'Conditionally Promoted',
  'Needs improvement',
  'Passed Promoted to class 10',
  'Detain',
  'Essential repeat',
  'Promoted as per RTE Guidelines (Conditional Promotion)',
  'Not appeared in Annual Exam',
  'Not appeared in Term-II',
  'Pass & Promoted to Class IX with Grace Marks',
];

type RemarkRow = {
  id: string;
  rollNo: string;
  grNo: string;
  studentName: string;
  remark: string;
  customRemark: string;
};

export default function StudentResultRemarksPage() {
  const [rows, setRows] = useState<RemarkRow[]>([]);
  const [termId, setTermId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (values: FilterValues) => {
    const flat: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) flat[key] = Array.isArray(value) ? value.join(',') : value;
    setTermId(readString(values.term));
    setLoading(true);
    setError(null);
    try {
      const payload = await resultGet('result/student-result-remarks/create', flat);
      const students = extractRows(payload).map((row): RemarkRow => ({
        id: readString(row.id ?? row.student_id),
        rollNo: readString(row.roll_no),
        grNo: readString(row.gr_number ?? row.enrollment_no ?? row.gr_no),
        studentName: readString(row.student_name ?? row.name ?? row.full_name),
        remark: readString(row.result_remarks),
        customRemark: readString(row.result_remarks_input ?? row.custom_remark ?? ''),
      })).filter((row) => row.id);
      setRows(students);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Failed to load students.');
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const updateRow = (id: string, patch: Partial<RemarkRow>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleSave = async () => {
    if (rows.length === 0) return;
    setSaving(true);
    try {
      const body: Record<string, string> = { term_id: termId };
      rows.forEach((row, index) => {
        body[`student_id[${index}]`] = row.id;
        body[`result_remarks[${row.id}]`] = row.remark;
        body[`result_remarks_input[${row.id}]`] = row.customRemark;
      });
      const payload = await resultPost('result/student-result-remarks', body);
      const message = assertOk(payload, 'Failed to save result remarks.');
      toast.success('Result remarks saved', message || undefined);
    } catch (err) {
      toast.error('Failed to save result remarks', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <PageHeader
          icon={ClipboardList}
          title="Student result remarks"
          subtitle="Assign result remarks such as promotion status to every student"
          breadcrumbs={[{ label: 'Result', href: '/result' }, { label: 'Reports' }, { label: 'Student result remarks' }]}
        />

        <FilterBar fields={FILTER_FIELDS} onSearch={(values) => void handleSearch(values)} loading={loading} />

        {searched && (
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Users className="h-4 w-4" />
                  </div>
                  Students {rows.length > 0 && `(${rows.length})`}
                </CardTitle>
                {rows.length > 0 && (
                  <Button
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save remarks
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {error && <div className="p-4"><Banner tone="error">{error}</Banner></div>}
              {loading ? (
                <TableSkeleton columns={6} />
              ) : rows.length === 0 ? (
                <EmptyState title="No students found" message="No students matched the selected criteria." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3 font-semibold">Sr no</th>
                        <th className="px-4 py-3 font-semibold">Roll no</th>
                        <th className="px-4 py-3 font-semibold">Gr no</th>
                        <th className="px-4 py-3 font-semibold">Student name</th>
                        <th className="px-4 py-3 font-semibold">Result remarks</th>
                        <th className="px-4 py-3 font-semibold">Custom remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                          <td className="px-4 py-3 text-slate-600">{index + 1}</td>
                          <td className="px-4 py-3 text-slate-600">{row.rollNo || '—'}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.grNo || '—'}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">{row.studentName || '—'}</td>
                          <td className="px-4 py-3">
                            <Select value={row.remark} onValueChange={(value) => updateRow(row.id, { remark: value ?? '' })}>
                              <SelectTrigger className="w-72">
                                <SelectValue placeholder="Select remark" />
                              </SelectTrigger>
                              <SelectContent>
                                {REMARK_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              value={row.customRemark}
                              onChange={(event) => updateRow(row.id, { customRemark: event.target.value })}
                              placeholder="Custom remark (optional)"
                              className="h-9 w-64"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
