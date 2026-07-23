'use client';

/**
 * Mark entry — scholastic marks grid with auto percentage/grade,
 * save + approve (lock) actions. Mirrors the legacy Blade screen at
 * result/marks_entry.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ClipboardList, ExternalLink, Save, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/result/PageHeader';
import FilterBar, { type FilterFieldDef, type FilterValues } from '@/components/result/FilterBar';
import { Banner, ConfirmDialog, EmptyState, StatusChip, TableSkeleton } from '@/components/result/primitives';
import { toast } from '@/components/result/toast';
import {
  asRecord, assertOk, readNumber, readString, resultGet, resultPost, toCollection,
} from '@/lib/result/api';

type StudentRow = {
  id: string;
  rollNo: string;
  name: string;
  marks: string;
  maxMarks: number;
  percentage: number;
  grade: string;
  comment: string;
};

type Criteria = {
  term: string;
  grade: string;
  standard: string;
  division: string;
  subject: string;
  exam_master: string;
  exam: string;
};

const FILTER_FIELDS: FilterFieldDef[] = [
  { kind: 'term', required: true },
  { kind: 'section', required: true },
  { kind: 'standard', required: true },
  { kind: 'division', required: true },
  {
    kind: 'api', name: 'subject', label: 'Select subject', path: 'api/get-subject-list',
    params: { standard_id: '{standard}', division_id: '{division}' }, required: true,
  },
  {
    kind: 'api', name: 'exam_master', label: 'Select exam master', path: 'api/get-exam-master-list',
    params: { standard_id: '{standard}', term_id: '{term}' }, required: true,
  },
  {
    kind: 'api', name: 'exam', label: 'Select exam', path: 'api/get-exam-list',
    params: { standard_id: '{standard}', subject_id: '{subject}', term_id: '{term}', exam_id: '{exam_master}' },
    required: true,
  },
];

/** Effective validation ceiling: max marks from the payload, capped at 500. */
function markCap(maxMarks: number): number {
  return maxMarks > 0 ? Math.min(maxMarks, 500) : 500;
}

function isValidMark(value: string, maxMarks: number): boolean {
  const normalized = value.trim().toUpperCase();
  if (normalized === '' || ['AB', 'N.A.', 'EX'].includes(normalized)) return true;
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= markCap(maxMarks);
}

function calculatePercentage(value: string, maxMarks: number): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && maxMarks > 0
    ? Number(((numericValue / maxMarks) * 100).toFixed(2))
    : 0;
}

function toGradeRanges(value: unknown): Record<string, number[]> {
  const ranges: Record<string, number[]> = {};
  for (const [grade, range] of Object.entries(asRecord(value))) {
    const values = Array.isArray(range) ? range : Object.values(asRecord(range));
    ranges[grade] = values.map(Number).filter(Number.isFinite);
  }
  return ranges;
}

function findGrade(percentage: number, mark: string, ranges: Record<string, number[]>): string {
  if (!Number.isFinite(Number(mark)) || mark.trim() === '') return '-';
  const rounded = Math.round(percentage);
  return Object.entries(ranges).find(([, range]) => range.includes(rounded))?.[0] || '-';
}

function toStudentRows(items: unknown): StudentRow[] {
  return toCollection(items)
    .map((item) => {
      const record = asRecord(item);
      const fullName = [record.first_name, record.middle_name, record.last_name]
        .map(readString)
        .filter(Boolean)
        .join(' ');
      return {
        id: readString(record.id ?? record.student_id ?? record.unique_id),
        rollNo: readString(record.roll_no ?? record.gr_no ?? record.enrollment_no),
        name: readString(record.student_name ?? record.full_name ?? fullName || record.name),
        marks: readString(record.points ?? record.marks ?? record.obtained_marks),
        maxMarks: readNumber(record.outof ?? record.max_marks),
        percentage: readNumber(record.per ?? record.percentage),
        grade: readString(record.grade),
        comment: readString(record.comment ?? record.remark),
      };
    })
    .filter((student) => student.id);
}

export default function MarksEntryPage() {
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [gradeRanges, setGradeRanges] = useState<Record<string, number[]>>({});
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
      subject: readString(values.subject),
      exam_master: readString(values.exam_master),
      exam: readString(values.exam),
    };
    setCriteria(next);
    setLoading(true);
    setSearched(true);
    setError(null);
    try {
      const payload = await resultGet('result/marks_entry/create', { ...next });
      const source = asRecord(payload.data ?? payload);
      setGradeRanges(toGradeRanges(source.grd_data));
      setApproved(readString(source.approve ?? source.is_approved) === '1');
      setStudents(toStudentRows(source.stu_data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students. Please try again.');
      setStudents([]);
      setApproved(false);
    } finally {
      setLoading(false);
    }
  };

  const handleMarksChange = (studentId: string, value: string) => {
    setStudents((current) =>
      current.map((student) => {
        if (student.id !== studentId) return student;
        const percentage = calculatePercentage(value, student.maxMarks);
        return { ...student, marks: value, percentage, grade: findGrade(percentage, value, gradeRanges) };
      }),
    );
  };

  const handleCommentChange = (studentId: string, value: string) => {
    setStudents((current) =>
      current.map((student) => (student.id === studentId ? { ...student, comment: value } : student)),
    );
  };

  const handleSave = async () => {
    if (!criteria) return;
    const invalidRow = students.find((student) => !isValidMark(student.marks, student.maxMarks));
    if (invalidRow) {
      toast.error(
        'Invalid marks',
        `Check marks for ${invalidRow.name}. Use a number up to ${markCap(invalidRow.maxMarks)}, AB, N.A., or EX.`,
      );
      return;
    }
    setSaving(true);
    try {
      const marksData = Object.fromEntries(
        students.map((student) => [
          student.id,
          {
            exam_id: criteria.exam,
            points: student.marks,
            per: student.percentage,
            grade: student.grade || '-',
            comment: student.comment,
          },
        ]),
      );
      const payload = await resultPost('result/marks_entry', { data: JSON.stringify(marksData) });
      const message = assertOk(payload, 'Laravel did not confirm that marks were saved.');
      toast.success('Marks saved', message || undefined);
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
      const payload = await resultPost('result/approve', {
        approve: '1',
        term_id: criteria.term,
        standard_id: criteria.standard,
        division_id: criteria.division,
        subject_id: criteria.subject,
        exam_id: criteria.exam,
      });
      const message = assertOk(payload, 'Approval was not confirmed by the server.');
      setApproved(true);
      setConfirmApprove(false);
      toast.success('Marks approved', message || 'Entries are now locked for this exam.');
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
          icon={ClipboardList}
          title="Mark entry"
          subtitle="Enter, validate and approve student examination marks"
          breadcrumbs={[
            { label: 'Result', href: '/result' },
            { label: 'Entry' },
            { label: 'Mark entry' },
          ]}
          actions={
            <Link
              href="/result/master/standard-grade-mapping"
              className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
            >
              <ExternalLink className="h-4 w-4" />
              Grade scale mapping
            </Link>
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
                <TableSkeleton columns={7} />
              ) : students.length === 0 ? (
                !error && (
                  <EmptyState
                    icon={<Users />}
                    title="No students found"
                    message="No students matched the selected term, class and exam. Adjust the filters and search again."
                  />
                )
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-3 font-semibold">Sr no</th>
                        <th className="px-5 py-3 font-semibold">Roll no</th>
                        <th className="px-5 py-3 font-semibold">Student name</th>
                        <th className="px-5 py-3 text-center font-semibold">Marks</th>
                        <th className="px-5 py-3 text-center font-semibold">Per.(%)</th>
                        <th className="px-5 py-3 text-center font-semibold">Grade</th>
                        <th className="px-5 py-3 font-semibold">Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, index) => {
                        const invalid = !isValidMark(student.marks, student.maxMarks);
                        return (
                          <tr key={student.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                            <td className="px-5 py-4 text-slate-600">{index + 1}</td>
                            <td className="px-5 py-4 font-mono text-xs text-slate-600">{student.rollNo}</td>
                            <td className="px-5 py-4 font-medium text-slate-900">{student.name}</td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col items-center gap-1">
                                <input
                                  type="text"
                                  value={student.marks}
                                  disabled={approved}
                                  onChange={(event) => handleMarksChange(student.id, event.target.value)}
                                  aria-label={`Marks for ${student.name}`}
                                  aria-invalid={invalid}
                                  placeholder={`/ ${markCap(student.maxMarks)}`}
                                  className={`h-9 w-24 rounded-lg border bg-white px-3 text-center text-sm transition-all focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${
                                    invalid
                                      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                                      : 'border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-blue-500/20'
                                  }`}
                                />
                                {invalid && (
                                  <p className="text-[11px] text-rose-600">
                                    0–{markCap(student.maxMarks)}, AB, N.A. or EX
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center text-slate-600">{student.percentage.toFixed(2)}%</td>
                            <td className="px-5 py-4 text-center">
                              <StatusChip tone="neutral">{student.grade || '-'}</StatusChip>
                            </td>
                            <td className="px-5 py-4">
                              <textarea
                                value={student.comment}
                                disabled={approved}
                                onChange={(event) => handleCommentChange(student.id, event.target.value)}
                                rows={2}
                                aria-label={`Remark for ${student.name}`}
                                className="min-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                              />
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
        message="Approving locks the mark entries for this exam. Teachers will no longer be able to edit them. Save any pending changes before approving."
      />
    </div>
  );
}
