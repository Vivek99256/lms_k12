'use client';

/**
 * HPC activity entry — per-student radio matrix mapping students to an
 * activity group for the selected skillset / activity / sub-activity.
 *
 * Backed by the dedicated `api/result/hpc-activity-entry` REST API.
 * Confirmed against the Laravel controller: the group-option columns are
 * `result_activity_groups` and the student list is `student_datas`;
 * existing selections are NOT embedded per-student but returned as a
 * separate `get_activity_marks[studentId]` map (row + `group_id` +
 * `group_title`, or null). `activity_id` is required by the save
 * endpoint, so the activity filter must be required too — the original
 * draft left it optional, which could 422 on save.
 *
 * Term is optional here, so it is rendered as a custom control instead of
 * the FilterBar term field (which would hold back the section cascade
 * until a term is chosen).
 */

import React, { useMemo, useState } from 'react';
import { Activity, Calendar, Save, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/result/PageHeader';
import FilterBar, { type FilterFieldDef, type FilterValues } from '@/components/result/FilterBar';
import { Banner, EmptyState, TableSkeleton } from '@/components/result/primitives';
import { toast } from '@/components/result/toast';
import {
  asRecord, assertOk, readString, resultGet, resultPost, toCollection,
} from '@/lib/result/api';

type StudentRow = {
  id: string;
  rollNo: string;
  name: string;
};

type ActivityGroup = {
  id: string;
  title: string;
};

type Criteria = {
  grade: string;
  standard: string;
  division: string;
  term: string;
  skillset_id: string;
  activity_master: string;
  sub_activity_master: string;
};

const FILTER_FIELDS: FilterFieldDef[] = [
  { kind: 'section', required: true },
  { kind: 'standard', required: true },
  { kind: 'division', required: true },
  {
    kind: 'api', name: 'skillset_id', label: 'Select skillset', path: 'result/getActivityLists',
    params: { standard: '{standard}', level: '2' }, required: true, icon: Activity,
  },
  {
    kind: 'api', name: 'activity_master', label: 'Select activity', path: 'api/get-activity-master-list',
    params: { skillset_id: '{skillset_id}', standard: '{standard}' }, required: true, icon: Activity,
  },
  {
    kind: 'api', name: 'sub_activity_master', label: 'Select sub activity', path: 'result/getActivityLists',
    params: { skill_id: '{activity_master}', type: 'API', level: '4' }, icon: Activity,
  },
];

function TermField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { academicTerms } = useAuth();
  const options = useMemo(() => {
    const selectedAcademicYear = typeof window === 'undefined' ? '' : localStorage.getItem('selectedAcademicYear') || '';
    return academicTerms
      .filter((item) => {
        const year = readString(item.syear);
        return !selectedAcademicYear || !year || year === selectedAcademicYear;
      })
      .map((item) => ({ id: readString(item.term_id ?? item.id), label: readString(item.title ?? item.name) }))
      .filter((option) => option.id && option.label);
  }, [academicTerms]);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-slate-500">
          <Calendar className="h-3 w-3" />
        </span>
        Select term
      </Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Select term"
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 transition-all hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function studentName(record: Record<string, unknown>): string {
  const fullName = [record.first_name, record.middle_name, record.last_name]
    .map(readString)
    .filter(Boolean)
    .join(' ');
  return fullName || readString(record.name);
}

export default function HpcActivityEntryPage() {
  const [term, setTerm] = useState('');
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (values: FilterValues) => {
    const next: Criteria = {
      grade: readString(values.grade),
      standard: readString(values.standard),
      division: readString(values.division),
      term,
      skillset_id: readString(values.skillset_id),
      activity_master: readString(values.activity_master),
      sub_activity_master: readString(values.sub_activity_master),
    };
    setCriteria(next);
    setLoading(true);
    setSearched(true);
    setError(null);
    try {
      const payload = await resultGet('api/result/hpc-activity-entry/create', { ...next });
      const source = asRecord(payload.data ?? payload);

      const groupRows: ActivityGroup[] = toCollection(source.result_activity_groups)
        .map((item) => {
          const record = asRecord(item);
          return { id: readString(record.id), title: readString(record.title) };
        })
        .filter((group) => group.id && group.title);
      setGroups(groupRows);

      const existingMarks = asRecord(source.get_activity_marks);
      const studentRows: StudentRow[] = toCollection(source.student_datas)
        .map((item) => {
          const record = asRecord(item);
          return {
            id: readString(record.id),
            rollNo: readString(record.roll_no ?? record.gr_no),
            name: studentName(record),
          };
        })
        .filter((student) => student.id);
      setStudents(studentRows);

      const nextSelections: Record<string, string> = {};
      for (const student of studentRows) {
        const existing = existingMarks[student.id];
        const groupId = existing && typeof existing === 'object' ? readString(asRecord(existing).group_id) : '';
        if (groupId) nextSelections[student.id] = groupId;
      }
      setSelections(nextSelections);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students. Please try again.');
      setStudents([]);
      setGroups([]);
      setSelections({});
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!criteria) return;
    setSaving(true);
    try {
      const data: Record<string, string> = {};
      for (const student of students) {
        const groupId = selections[student.id];
        if (groupId) data[`activity_group[${student.id}]`] = groupId;
      }
      data.student_id = students.map((student) => student.id).join(',');
      data.sub_activity_master = criteria.sub_activity_master;
      data.activity_id = criteria.activity_master;

      const payload = await resultPost('api/result/hpc-activity-entry', data);
      const message = assertOk(payload, 'Laravel did not confirm that the activity marks were saved.');
      toast.success('Activity marks saved', message || undefined);
    } catch (err) {
      toast.error('Could not save activity marks', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <PageHeader
          icon={Activity}
          title="HPC activity entry"
          subtitle="Assign an activity group to each student for the selected activity"
          breadcrumbs={[
            { label: 'Result', href: '/result' },
            { label: 'Entry' },
            { label: 'HPC activity entry' },
          ]}
        />

        <FilterBar fields={FILTER_FIELDS} onSearch={handleSearch} loading={loading}>
          <TermField value={term} onChange={setTerm} />
        </FilterBar>

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
                    {saving ? 'Saving…' : 'Save entries'}
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
                <TableSkeleton columns={Math.max(3, groups.length + 2)} />
              ) : students.length === 0 ? (
                !error && (
                  <EmptyState
                    icon={<Users />}
                    title="No students found"
                    message="No students matched the selected class and activity. Adjust the filters and search again."
                  />
                )
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-3 font-semibold">Roll no</th>
                        <th className="px-5 py-3 font-semibold">Student name</th>
                        {groups.map((group) => (
                          <th key={group.id} className="px-5 py-3 text-center font-semibold">
                            {group.title}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                          <td className="px-5 py-4 font-mono text-xs text-slate-600">{student.rollNo}</td>
                          <td className="px-5 py-4 font-medium text-slate-900">{student.name}</td>
                          {groups.map((group) => (
                            <td key={group.id} className="px-5 py-4 text-center">
                              <input
                                type="radio"
                                name={`group-${student.id}`}
                                value={group.id}
                                checked={selections[student.id] === group.id}
                                onChange={() =>
                                  setSelections((current) => ({ ...current, [student.id]: group.id }))
                                }
                                aria-label={`${group.title} for ${student.name}`}
                                className="h-4 w-4 cursor-pointer accent-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                              />
                            </td>
                          ))}
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
