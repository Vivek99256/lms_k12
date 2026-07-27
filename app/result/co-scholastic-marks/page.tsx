'use client';

/**
 * Co-scholastic marks — grade or mark entry per student for a selected
 * co-scholastic area, with approve (lock) support. Mirrors the legacy
 * Blade screen at result/co_scholastic_marks_entry.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { Award, CheckCircle2, ExternalLink, Save, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/result/PageHeader';
import FilterBar, { type FilterFieldDef, type FilterValues } from '@/components/result/FilterBar';
import { Banner, ConfirmDialog, EmptyState, StatusChip, TableSkeleton } from '@/components/result/primitives';
import { toast } from '@/components/result/toast';
import {
  asRecord, assertOk, readNumber, readString, resultGet, resultPost, toCollection, toOptions,
  type SelectOption,
} from '@/lib/result/api';

type StudentRow = {
  id: string;
  rollNo: string;
  name: string;
  /** Selected grade option id (GRADE mode) or entered marks (MARK mode). */
  value: string;
  maxMark: number;
};

type Criteria = {
  term: string;
  grade: string;
  standard: string;
  division: string;
  co_scholastic_parent: string;
  co_scholastic: string;
};

const FILTER_FIELDS: FilterFieldDef[] = [
  { kind: 'term', required: true },
  { kind: 'section', required: true },
  { kind: 'standard', required: true },
  { kind: 'division', required: true },
  {
    kind: 'api', name: 'co_scholastic_parent', label: 'Select co-scholastic parent',
    path: 'api/get-co-scholastic-parent-list', params: { standard_id: '{standard}' }, required: true,
  },
  {
    kind: 'api', name: 'co_scholastic', label: 'Select co-scholastic',
    path: 'api/get-co-scholastic-list',
    params: { standard_id: '{standard}', co_scholastic_parent_id: '{co_scholastic_parent}', term_id: '{term}' },
    required: true,
  },
];

function isValidMark(value: string, maxMark: number): boolean {
  if (value.trim() === '') return true;
  const numericValue = Number(value);
  const cap = maxMark > 0 ? maxMark : 500;
  return Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= cap;
}

export default function CoScholasticMarksPage() {
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [markType, setMarkType] = useState<'MARK' | 'GRADE'>('MARK');
  const [gradeOptions, setGradeOptions] = useState<SelectOption[]>([]);
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (values: FilterValues) => {
    const next: Criteria = {
      term: readString(values.term),
      grade: readString(values.grade),
      standard: readString(values.standard),
      division: readString(values.division),
      co_scholastic_parent: readString(values.co_scholastic_parent),
      co_scholastic: readString(values.co_scholastic),
    };
    setCriteria(next);
    setLoading(true);
    setSearched(true);
    setError(null);
    try {
      const payload = await resultGet('result/co_scholastic_marks_entry/create', { ...next });
      const source = asRecord(payload.data ?? payload);

      const mode = readString(source.mark_type).toUpperCase() === 'GRADE' ? 'GRADE' : 'MARK';
      setMarkType(mode);
      setGradeOptions(toOptions(source.grade_options ?? source.co_grade ?? source.grade_data));
      setApproved(readString(source.approve ?? source.is_approved) === '1');

      const sourceMax = readNumber(source.max_mark ?? source.outof ?? source.max_marks);
      setStudents(
        toCollection(source.stu_data ?? source.students)
          .map((item) => {
            const record = asRecord(item);
            const fullName = [record.first_name, record.middle_name, record.last_name]
              .map(readString)
              .filter(Boolean)
              .join(' ');
            return {
              id: readString(record.id ?? record.student_id ?? record.unique_id),
              rollNo: readString(record.roll_no ?? record.gr_no ?? record.enrollment_no),
              name: readString((record.student_name ?? record.full_name ?? fullName) || record.name),
              value: mode === 'GRADE'
                ? readString(record.grade ?? record.grade_id)
                : readString(record.points ?? record.marks),
              maxMark: readNumber(record.outof ?? record.max_mark) || sourceMax,
            };
          })
          .filter((student) => student.id),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students. Please try again.');
      setStudents([]);
      setApproved(false);
    } finally {
      setLoading(false);
    }
  };

  const setStudentValue = (studentId: string, value: string) => {
    setStudents((current) =>
      current.map((student) => (student.id === studentId ? { ...student, value } : student)),
    );
  };

  const handleSave = async () => {
    if (!criteria) return;
    if (markType === 'MARK') {
      const invalidRow = students.find((student) => !isValidMark(student.value, student.maxMark));
      if (invalidRow) {
        toast.error(
          'Invalid marks',
          `Check marks for ${invalidRow.name}. Use a number up to ${invalidRow.maxMark > 0 ? invalidRow.maxMark : 500}.`,
        );
        return;
      }
    }
    setSaving(true);
    try {
      const data: Record<string, string> = {};
      for (const student of students) {
        data[`values[${student.id}][term_id]`] = criteria.term;
        data[`values[${student.id}][grade_id]`] = criteria.grade;
        data[`values[${student.id}][standard_id]`] = criteria.standard;
        data[`values[${student.id}][division_id]`] = criteria.division;
        data[`values[${student.id}][co_scholastic]`] = criteria.co_scholastic;
        if (markType === 'GRADE') {
          data[`values[${student.id}][grade]`] = student.value;
        } else {
          data[`values[${student.id}][points]`] = student.value;
        }
      }
      const payload = await resultPost('result/co_scholastic_marks_entry', data);
      const message = assertOk(payload, 'Laravel did not confirm that marks were saved.');
      toast.success('Co-scholastic marks saved', message || undefined);
    } catch (err) {
      toast.error('Could not save marks', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!criteria) return;
    setApproving(true);
    try {
      const payload = await resultPost('result/co_scholastic_marks_entry_approve', {
        approve: '1',
        term_id: criteria.term,
        standard_id: criteria.standard,
        division_id: criteria.division,
        subject_id: '0',
        exam_id: criteria.co_scholastic,
      });
      const message = assertOk(payload, 'Approval was not confirmed by the server.');
      setApproved(true);
      setConfirmApprove(false);
      toast.success('Marks approved', message || 'Entries are now locked for this co-scholastic area.');
    } catch (err) {
      toast.error('Could not approve marks', err instanceof Error ? err.message : undefined);
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <PageHeader
          icon={Award}
          title="Co-scholastic marks"
          subtitle="Record grades or marks for co-scholastic areas"
          breadcrumbs={[
            { label: 'Result', href: '/result' },
            { label: 'Entry' },
            { label: 'Co-scholastic marks' },
          ]}
          actions={
            <>
              <Link
                href="/result/master/co-scholastic-setup"
                className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              >
                <ExternalLink className="h-4 w-4" />
                Co-scholastic setup
              </Link>
              <Link
                href="/result/master/standard-grade-mapping"
                className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              >
                <ExternalLink className="h-4 w-4" />
                Grade scale mapping
              </Link>
            </>
          }
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
                  {searched && !loading && students.length > 0 && (
                    <StatusChip tone="info">{markType === 'GRADE' ? 'Grade entry' : 'Mark entry'}</StatusChip>
                  )}
                  {approved && <StatusChip tone="success">Approved</StatusChip>}
                </CardTitle>
                {students.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || approving || approved}
                      className="h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? 'Saving…' : 'Save marks'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmApprove(true)}
                      disabled={saving || approving || approved}
                      className="h-9 rounded-lg px-4 text-sm font-medium"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve marks
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {error && (
                <div className="p-4">
                  <Banner tone="error">{error}</Banner>
                </div>
              )}
              {loading ? (
                <TableSkeleton columns={3} />
              ) : students.length === 0 ? (
                !error && (
                  <EmptyState
                    icon={<Users />}
                    title="No students found"
                    message="No students matched the selected class and co-scholastic area. Adjust the filters and search again."
                  />
                )
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-3 font-semibold">Roll no</th>
                        <th className="px-5 py-3 font-semibold">Student name</th>
                        <th className="px-5 py-3 text-center font-semibold">
                          {markType === 'GRADE' ? 'Grade' : `Marks${students[0]?.maxMark ? ` (out of ${students[0].maxMark})` : ''}`}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => {
                        const invalid = markType === 'MARK' && !isValidMark(student.value, student.maxMark);
                        return (
                          <tr key={student.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                            <td className="px-5 py-4 font-mono text-xs text-slate-600">{student.rollNo}</td>
                            <td className="px-5 py-4 font-medium text-slate-900">{student.name}</td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col items-center gap-1">
                                {markType === 'GRADE' ? (
                                  <select
                                    value={student.value}
                                    disabled={approved}
                                    onChange={(event) => setStudentValue(student.id, event.target.value)}
                                    aria-label={`Grade for ${student.name}`}
                                    className="h-9 w-40 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 transition-all hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                  >
                                    <option value="">Select</option>
                                    {gradeOptions.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={student.value}
                                    disabled={approved}
                                    onChange={(event) => setStudentValue(student.id, event.target.value)}
                                    aria-label={`Marks for ${student.name}`}
                                    aria-invalid={invalid}
                                    placeholder="Enter"
                                    className={`h-9 w-24 rounded-lg border bg-white px-3 text-center text-sm transition-all focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${
                                      invalid
                                        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                                        : 'border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-blue-500/20'
                                    }`}
                                  />
                                )}
                                {invalid && (
                                  <p className="text-[11px] text-rose-600">
                                    Enter a number up to {student.maxMark > 0 ? student.maxMark : 500}
                                  </p>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmApprove}
        onClose={() => !approving && setConfirmApprove(false)}
        onConfirm={handleApprove}
        busy={approving}
        tone="primary"
        title="Approve marks?"
        confirmLabel="Approve"
        message="Approving locks the co-scholastic entries for this area. Teachers will no longer be able to edit them. Save any pending changes before approving."
      />
    </div>
  );
}
