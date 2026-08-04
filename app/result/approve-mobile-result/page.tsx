'use client';

/**
 * Approve mobile result — choose which students' results are visible in
 * the parent mobile app. Mirrors the legacy Blade screen at
 * result/approve_mobile_result.
 */

import React, { useState } from 'react';
import { Save, Smartphone, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/result/PageHeader';
import FilterBar, { type FilterFieldDef, type FilterValues } from '@/components/result/FilterBar';
import { Banner, Checkbox, EmptyState, StatusChip, TableSkeleton } from '@/components/result/primitives';
import { toast } from '@/components/result/toast';
import {
  asRecord, assertOk, readString, resultGet, resultPost, toCollection,
} from '@/lib/result/api';

type StudentRow = {
  id: string;
  name: string;
  standard: string;
  division: string;
  allowed: boolean;
};

type Criteria = {
  term_id: string;
  grade: string;
  standard: string;
  division: string;
};

const FILTER_FIELDS: FilterFieldDef[] = [
  { kind: 'term', name: 'term_id' },
  { kind: 'section' },
  { kind: 'standard', required: true },
  { kind: 'division' },
];

export default function ApproveMobileResultPage() {
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (values: FilterValues) => {
    const next: Criteria = {
      term_id: readString(values.term_id),
      grade: readString(values.grade),
      standard: readString(values.standard),
      division: readString(values.division),
    };
    setCriteria(next);
    setLoading(true);
    setSearched(true);
    setError(null);
    try {
      const payload = await resultGet('result/approve_mobile_result/create', { ...next });
      const source = payload.data ?? payload;
      const inner = asRecord(source);
      const list = toCollection(Array.isArray(source) ? source : inner.stu_data ?? inner.students ?? inner.data ?? source);

      const nextChecked = new Set<string>();
      const studentRows: StudentRow[] = list
        .map((item) => {
          const record = asRecord(item);
          const id = readString(record.id ?? record.student_id ?? record.unique_id);
          const allowed = readString(record.is_allowed).toUpperCase() === 'Y';
          if (id && allowed) nextChecked.add(id);
          return {
            id,
            name: readString(record.student_name ?? record.name ?? record.full_name),
            standard: readString(record.standard ?? record.standard_name),
            division: readString(record.division ?? record.division_name),
            allowed,
          };
        })
        .filter((student) => student.id);
      setRows(studentRows);
      setChecked(nextChecked);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students. Please try again.');
      setRows([]);
      setChecked(new Set());
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string, value: boolean) => {
    setChecked((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (value: boolean) => {
    setChecked(value ? new Set(rows.map((row) => row.id)) : new Set());
  };

  const handlePublish = async () => {
    if (!criteria || rows.length === 0) {
      toast.error('Nothing to publish', 'Search for students before publishing a selection.');
      return;
    }
    setSaving(true);
    try {
      const data: Record<string, string> = {};
      const checkedIds = rows.filter((row) => checked.has(row.id)).map((row) => row.id);
      checkedIds.forEach((id, index) => {
        data[`students[${index}]`] = id;
      });
      rows.forEach((row, index) => {
        data[`student_id[${index}]`] = row.id;
      });
      data.grade_id = criteria.grade;
      data.standard_id = criteria.standard;
      data.division_id = criteria.division;
      data.term_id = criteria.term_id;

      const payload = await resultPost('result/approve_mobile_result', data);
      const message = assertOk(payload, 'Laravel did not confirm the mobile visibility update.');
      setRows((current) => current.map((row) => ({ ...row, allowed: checked.has(row.id) })));
      toast.success('Selection published', message || 'Mobile app visibility has been updated.');
    } catch (err) {
      toast.error('Could not publish selection', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const allChecked = rows.length > 0 && checked.size === rows.length;
  const someChecked = checked.size > 0 && checked.size < rows.length;

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <PageHeader
          icon={Smartphone}
          title="Approve mobile result"
          subtitle="Control which students' results are visible in the mobile app"
          breadcrumbs={[
            { label: 'Result', href: '/result' },
            { label: 'Entry' },
            { label: 'Approve mobile result' },
          ]}
        />

        <FilterBar fields={FILTER_FIELDS} onSearch={handleSearch} loading={loading} />

        {searched && (
          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-100 px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2.5 text-base font-bold text-slate-800">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <Users className="h-4 w-4" />
                  </div>
                  Student list
                  {rows.length > 0 && (
                    <StatusChip tone="info">{checked.size} of {rows.length} selected</StatusChip>
                  )}
                </CardTitle>
                {rows.length > 0 && (
                  <Button
                    type="button"
                    onClick={handlePublish}
                    disabled={saving}
                    className="h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Publishing…' : 'Publish selection'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {error && (
                <div className="p-4">
                  <Banner tone="error">{error}</Banner>
                </div>
              )}
              {!loading && rows.length > 0 && (
                <div className="border-b border-slate-100 p-4">
                  <Banner tone="info">Checked students&apos; results are visible in the mobile app.</Banner>
                </div>
              )}
              {loading ? (
                <TableSkeleton columns={6} />
              ) : rows.length === 0 ? (
                !error && (
                  <EmptyState
                    icon={<Users />}
                    title="No students found"
                    message="No students matched the selected class. Adjust the filters and search again."
                  />
                )
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                        <th className="w-12 px-5 py-3">
                          <Checkbox
                            checked={allChecked}
                            indeterminate={someChecked}
                            onChange={toggleAll}
                          />
                        </th>
                        <th className="px-5 py-3 font-semibold">Student id</th>
                        <th className="px-5 py-3 font-semibold">Student name</th>
                        <th className="px-5 py-3 font-semibold">Standard</th>
                        <th className="px-5 py-3 font-semibold">Division</th>
                        <th className="px-5 py-3 font-semibold">Mobile app</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                          <td className="px-5 py-4">
                            <Checkbox
                              checked={checked.has(row.id)}
                              onChange={(value) => toggleRow(row.id, value)}
                            />
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-slate-600">{row.id}</td>
                          <td className="px-5 py-4 font-medium text-slate-900">{row.name}</td>
                          <td className="px-5 py-4 text-slate-600">{row.standard}</td>
                          <td className="px-5 py-4 text-slate-600">{row.division}</td>
                          <td className="px-5 py-4">
                            {row.allowed ? (
                              <StatusChip tone="success">Visible in app</StatusChip>
                            ) : (
                              <StatusChip tone="neutral">Hidden</StatusChip>
                            )}
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
