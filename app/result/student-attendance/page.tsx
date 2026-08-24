'use client';

/**
 * Student attendance master — per-student present/working days, remark
 * selection and teacher remark, saved as bracketed values.
 *
 * Backed by the dedicated `api/result/student-attendance-master` REST
 * API (create + store only — there is no index route). Confirmed against
 * the Laravel controller: student rows use `att`/`day`/`remark`/
 * `student_id` (not `attendance`/`working_day`/`remark_id`/`id`), there
 * is no top-level default working-days field (only per-row), and `store`
 * reads a `standard` key (not `standard_id`) and ignores `grade` entirely.
 */

import React, { useState } from 'react';
import { CalendarCheck, Save, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/result/PageHeader';
import FilterBar, { type FilterFieldDef, type FilterValues } from '@/components/result/FilterBar';
import { Banner, EmptyState, TableSkeleton } from '@/components/result/primitives';
import { toast } from '@/components/result/toast';
import {
  asRecord, assertOk, readNumber, readString, resultGet, resultPost, toCollection,
  toOptions, type SelectOption,
} from '@/lib/result/api';

type StudentRow = {
  id: string;
  name: string;
  attendance: string;
  workingDay: string;
  remarkId: string;
  teacherRemark: string;
};

type Criteria = {
  standard: string;
  term: string;
};

const FILTER_FIELDS: FilterFieldDef[] = [
<<<<<<< HEAD
  { kind: 'section' },
  { kind: 'standard', required: true },
  { kind: 'division', required: true },
  { kind: 'term', required: true },
=======
  { kind: 'term', required: true },
  { kind: 'section' },
  { kind: 'standard', required: true },
  { kind: 'division', required: true },
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
];

function isValidRow(student: StudentRow): boolean {
  const attendance = student.attendance.trim();
  if (attendance === '') return false;
  const present = Number(attendance);
  if (!Number.isFinite(present) || present < 0) return false;
  const working = readNumber(student.workingDay);
  return working <= 0 || present <= working;
}

export default function StudentAttendancePage() {
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [remarkOptions, setRemarkOptions] = useState<SelectOption[]>([]);
  const [invalidIds, setInvalidIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (values: FilterValues) => {
    const next: Criteria = {
      standard: readString(values.standard),
      term: readString(values.term),
    };
    setCriteria(next);
    setLoading(true);
    setSearched(true);
    setError(null);
    setInvalidIds(new Set());
    try {
      const payload = await resultGet('api/result/student-attendance-master/create', {
        grade: readString(values.grade),
        standard: next.standard,
        division: readString(values.division),
        term: next.term,
      });
      const source = asRecord(payload.data ?? payload);

      setStudents(
        toCollection(source.stu_data)
          .map((item) => {
            const record = asRecord(item);
            return {
              id: readString(record.student_id),
              name: readString(record.name),
              attendance: readString(record.att),
              workingDay: readString(record.day),
              remarkId: readString(record.remark),
              teacherRemark: readString(record.teacher_remark),
            };
          })
          .filter((student) => student.id),
      );
      setRemarkOptions(toOptions(source.remark_data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students. Please try again.');
      setStudents([]);
      setRemarkOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStudent = (id: string, patch: Partial<StudentRow>) => {
    setStudents((current) => current.map((student) => (student.id === id ? { ...student, ...patch } : student)));
  };

  const handleSave = async () => {
    if (!criteria) return;
    const invalid = students.filter((student) => !isValidRow(student));
    if (invalid.length > 0) {
      setInvalidIds(new Set(invalid.map((student) => student.id)));
      toast.error(
        'Invalid attendance',
        `Check present days for ${invalid[0].name}. Enter a number no greater than the working days.`,
      );
      return;
    }
    setInvalidIds(new Set());
    setSaving(true);
    try {
      const data: Record<string, string> = {};
      for (const student of students) {
        data[`values[${student.id}][standard]`] = criteria.standard;
        data[`values[${student.id}][term_id]`] = criteria.term;
        data[`values[${student.id}][attendance]`] = student.attendance;
        data[`values[${student.id}][working_day]`] = student.workingDay;
        data[`values[${student.id}][remark_id]`] = student.remarkId;
        data[`values[${student.id}][teacher_remark]`] = student.teacherRemark;
      }
      const payload = await resultPost('api/result/student-attendance-master', data);
      const message = assertOk(payload, 'Laravel did not confirm that attendance was saved.');
      toast.success('Attendance saved', message || undefined);
    } catch (err) {
      toast.error('Could not save attendance', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <PageHeader
          icon={CalendarCheck}
          title="Student attendance master"
          subtitle="Record present days, working days and remarks per student"
          breadcrumbs={[
            { label: 'Result', href: '/result' },
            { label: 'Masters' },
            { label: 'Student attendance' },
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
                </CardTitle>
                {students.length > 0 && (
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="h-9 rounded-lg bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving…' : 'Save attendance'}
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
              {loading ? (
                <TableSkeleton columns={6} />
              ) : students.length === 0 ? (
                !error && (
                  <EmptyState
                    icon={<Users />}
                    title="No students found"
                    message="No students matched the selected class and term. Adjust the filters and search again."
                  />
                )
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-3 font-semibold">No</th>
                        <th className="w-[20%] px-5 py-3 font-semibold">Student name</th>
                        <th className="px-5 py-3 text-center font-semibold">Present days</th>
                        <th className="w-[15%] px-5 py-3 text-center font-semibold">Working days</th>
                        <th className="w-[20%] px-5 py-3 font-semibold">Remark</th>
                        <th className="w-[40%] px-5 py-3 font-semibold">Teacher remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, index) => {
                        const invalid = invalidIds.has(student.id);
                        return (
                          <tr key={student.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                            <td className="px-5 py-4 text-slate-600">{index + 1}</td>
                            <td className="px-5 py-4 font-medium text-slate-900">{student.name}</td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col items-center gap-1">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={student.attendance}
                                  onChange={(event) => updateStudent(student.id, { attendance: event.target.value })}
                                  aria-label={`Present days for ${student.name}`}
                                  aria-invalid={invalid}
                                  placeholder="Days"
                                  className={`h-9 w-24 rounded-lg border bg-white px-3 text-center text-sm transition-all focus:outline-none focus:ring-2 ${
                                    invalid
                                      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                                      : 'border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-blue-500/20'
                                  }`}
                                />
                                {invalid && (
                                  <p className="text-[11px] text-rose-600">Required, up to working days</p>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={student.workingDay}
                                onChange={(event) => updateStudent(student.id, { workingDay: event.target.value })}
                                aria-label={`Working days for ${student.name}`}
                                className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-3 text-center text-sm transition-all hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              />
                            </td>
                            <td className="px-5 py-4">
                              <select
                                value={student.remarkId}
                                onChange={(event) => updateStudent(student.id, { remarkId: event.target.value })}
                                aria-label={`Remark for ${student.name}`}
                                className="h-9 w-full min-w-36 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 transition-all hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              >
                                <option value="">Select</option>
                                {remarkOptions.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-5 py-4">
                              <textarea
                                value={student.teacherRemark}
                                onChange={(event) => updateStudent(student.id, { teacherRemark: event.target.value })}
                                rows={2}
                                aria-label={`Teacher remark for ${student.name}`}
                                className="w-full min-w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
    </div>
  );
}
