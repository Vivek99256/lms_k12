'use client';

/**
 * Student result remarks — assign a promotion/result remark (and an
 * optional custom remark) to every student of a class for a term.
 *
 * Backed by the dedicated `api/result/student-result-remarks` REST API.
 * Confirmed against the Laravel controller: the "load students" call is
 * `GET .../students` (there is no `/create` route), rows expose
 * `first_name`/`middle_name`/`last_name` (not a combined name field) and
 * a single combined `result_remarks` string in the form
 * `"<remark>||<customText>"` rather than separate remark/custom-remark
 * fields. The remark options come from the real remark-master API
 * (`api/result/result-remark-master/dropdown`), not a hard-coded list.
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
import {
  assertOk, asRecord, extractRows, readString, resultGet, resultPost, toOptions, type SelectOption,
} from '@/lib/result/api';

const FILTER_FIELDS: FilterFieldDef[] = [
  { kind: 'section', required: true },
  { kind: 'standard', required: true },
  { kind: 'division', required: true },
  { kind: 'term', required: true },
];

type RemarkRow = {
  id: string;
  rollNo: string;
  grNo: string;
  studentName: string;
  remark: string;
  customRemark: string;
};

function splitRemark(value: string): { remark: string; customRemark: string } {
  const [remark = '', customRemark = ''] = value.split('||');
  return { remark, customRemark };
}

export default function StudentResultRemarksPage() {
  const [rows, setRows] = useState<RemarkRow[]>([]);
  const [remarkOptions, setRemarkOptions] = useState<SelectOption[]>([]);
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
      const [studentsPayload, remarksPayload] = await Promise.all([
        resultGet('api/result/student-result-remarks/students', flat),
        resultGet('api/result/result-remark-master/dropdown').catch(() => ({})),
      ]);

      const students = extractRows(studentsPayload).map((row): RemarkRow => {
        const name = [row.first_name, row.middle_name, row.last_name].map(readString).filter(Boolean).join(' ');
        const { remark, customRemark } = splitRemark(readString(row.result_remarks));
        return {
          id: readString(row.id),
          rollNo: readString(row.roll_no),
          grNo: readString(row.enrollment_no),
          studentName: name,
          remark,
          customRemark,
        };
      }).filter((row) => row.id);
      setRows(students);
      setRemarkOptions(toOptions(asRecord(remarksPayload).data ?? remarksPayload));
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
      const payload = await resultPost('api/result/student-result-remarks', body);
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
                        <th className="px-4 py-3 font-semibold">Enrollment no</th>
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
                                {remarkOptions.map((option) => (
                                  <SelectItem key={option.id} value={option.label}>
                                    {option.label}
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
