'use client';

/**
 * HPC entry v1 — matrix of the hierarchical activity tree (rows) against
 * students (columns); each leaf cell selects an activity group. Mirrors
 * the legacy Blade screen at result/result_activity_marks_V1.
 *
 * Term is optional (only relevant when the institute runs term-wise HPC),
 * so it is rendered as a custom control instead of the FilterBar term
 * field (which would hold back the section cascade until a term is chosen).
 */

import React, { useMemo, useState } from 'react';
import { Calendar, Grid3x3, Save, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/result/PageHeader';
import FilterBar, { type FilterFieldDef, type FilterValues } from '@/components/result/FilterBar';
import { Banner, EmptyState, TableSkeleton } from '@/components/result/primitives';
import { toast } from '@/components/result/toast';
import {
  asRecord, assertOk, readString, resultGet, resultPost, toCollection, toOptions,
} from '@/lib/result/api';

type SubActivity = {
  id: string;
  title: string;
};

type ActivityNode = {
  id: string;
  title: string;
  subs: SubActivity[];
};

type StudentCol = {
  id: string;
  name: string;
  enrollmentNo: string;
};

type ActivityGroup = {
  id: string;
  title: string;
};

const FILTER_FIELDS: FilterFieldDef[] = [
  { kind: 'section' },
  { kind: 'standard', required: true },
  { kind: 'division' },
];

function TermField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { academicTerms } = useAuth();
  const options = useMemo(() => {
    const selectedAcademicYear = typeof window === 'undefined' ? '' : localStorage.getItem('selectedAcademicYear') || '';
    return toOptions(
      academicTerms.filter((item) => {
        const year = readString(item.syear);
        return !selectedAcademicYear || !year || year === selectedAcademicYear;
      }),
    );
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

function toActivities(value: unknown): ActivityNode[] {
  return toCollection(value)
    .map((item) => {
      const record = asRecord(item);
      const subs: SubActivity[] = toCollection(
        record.sub_activities ?? record.sub_activity ?? record.subActivities ?? record.children,
      )
        .map((sub) => {
          const subRecord = asRecord(sub);
          return {
            id: readString(subRecord.id ?? subRecord.sub_activity_id),
            title: readString(subRecord.title ?? subRecord.name ?? subRecord.activity_name),
          };
        })
        .filter((sub) => sub.id);
      return {
        id: readString(record.id ?? record.activity_id),
        title: readString(record.title ?? record.name ?? record.activity_name),
        subs,
      };
    })
    .filter((activity) => activity.id);
}

/** Existing selections keyed `${studentId}:${activityId}` or `${studentId}:${activityId}:${subId}`. */
function toExistingMarks(value: unknown): Record<string, string> {
  const marks: Record<string, string> = {};
  for (const [studentId, entry] of Object.entries(asRecord(value))) {
    const record = asRecord(entry);
    for (const [activityId, groupId] of Object.entries(asRecord(record.activity_id))) {
      if (groupId != null && typeof groupId !== 'object') marks[`${studentId}:${activityId}`] = readString(groupId);
    }
    for (const [activityId, subs] of Object.entries(asRecord(record.sub_activity_id))) {
      for (const [subId, groupId] of Object.entries(asRecord(subs))) {
        if (groupId != null && typeof groupId !== 'object') {
          marks[`${studentId}:${activityId}:${subId}`] = readString(groupId);
        }
      }
    }
    // Flat fallback shape: { activityId: groupId }.
    for (const [key, flat] of Object.entries(record)) {
      if (key === 'activity_id' || key === 'sub_activity_id') continue;
      if (typeof flat === 'string' || typeof flat === 'number') marks[`${studentId}:${key}`] = readString(flat);
    }
  }
  return marks;
}

export default function HpcEntryV1Page() {
  const [term, setTerm] = useState('');
  const [activities, setActivities] = useState<ActivityNode[]>([]);
  const [students, setStudents] = useState<StudentCol[]>([]);
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (values: FilterValues) => {
    setLoading(true);
    setSearched(true);
    setError(null);
    try {
      const payload = await resultGet('result/result_activity_marks_V1/create', {
        grade: readString(values.grade),
        standard: readString(values.standard),
        division: readString(values.division),
        term,
      });
      const source = asRecord(payload.data ?? payload);

      setActivities(toActivities(source.activities ?? source.activity_data ?? source.result_activity ?? source.activity));

      setStudents(
        toCollection(source.students ?? source.stu_data ?? source.student_data)
          .map((item) => {
            const record = asRecord(item);
            const fullName = [record.first_name, record.last_name].map(readString).filter(Boolean).join(' ');
            return {
              id: readString(record.id ?? record.student_id ?? record.unique_id),
              name: readString((record.student_name ?? record.full_name ?? fullName) || record.name),
              enrollmentNo: readString(record.enrollment_no ?? record.roll_no ?? record.gr_no),
            };
          })
          .filter((student) => student.id),
      );

      setGroups(
        toCollection(source.result_activity_group ?? source.group_data ?? source.groups)
          .map((item) => {
            const record = asRecord(item);
            return {
              id: readString(record.id ?? record.group_id),
              title: readString(record.title ?? record.name ?? record.group_name),
            };
          })
          .filter((group) => group.id && group.title),
      );

      setMarks(toExistingMarks(source.marksArr ?? source.marks_arr ?? source.marks));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the activity matrix. Please try again.');
      setActivities([]);
      setStudents([]);
      setGroups([]);
      setMarks({});
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: Record<string, string> = {};
      for (const student of students) {
        for (const activity of activities) {
          if (activity.subs.length === 0) {
            const groupId = marks[`${student.id}:${activity.id}`];
            if (groupId) data[`marksArr[${student.id}][activity_id][${activity.id}]`] = groupId;
          } else {
            for (const sub of activity.subs) {
              const groupId = marks[`${student.id}:${activity.id}:${sub.id}`];
              if (groupId) data[`marksArr[${student.id}][sub_activity_id][${activity.id}][${sub.id}]`] = groupId;
            }
          }
        }
      }
      const payload = await resultPost('result/result_activity_marks_V1', data);
      const message = assertOk(payload, 'Laravel did not confirm that the entries were saved.');
      toast.success('HPC entries saved', message || undefined);
    } catch (err) {
      toast.error('Could not save entries', err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const setCell = (key: string, value: string) => {
    setMarks((current) => ({ ...current, [key]: value }));
  };

  const cellSelect = (key: string, ariaLabel: string) => (
    <select
      value={marks[key] ?? ''}
      onChange={(event) => setCell(key, event.target.value)}
      aria-label={ariaLabel}
      className="h-8 w-32 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 transition-all hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
    >
      <option value="">--Select--</option>
      {groups.map((group) => (
        <option key={group.id} value={group.id}>
          {group.title}
        </option>
      ))}
    </select>
  );

  const hasMatrix = activities.length > 0 && students.length > 0;

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        <PageHeader
          icon={Grid3x3}
          title="HPC entry v1"
          subtitle="Assign activity groups across the full activity hierarchy per student"
          breadcrumbs={[
            { label: 'Result', href: '/result' },
            { label: 'Entry' },
            { label: 'HPC entry v1' },
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
                  Activity matrix
                </CardTitle>
                {hasMatrix && (
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
                <TableSkeleton columns={5} />
              ) : !hasMatrix ? (
                !error && (
                  <EmptyState
                    icon={<Users />}
                    title="Nothing to show"
                    message="No activities or students matched the selected class. Adjust the filters and search again."
                  />
                )
              ) : (
                <div className="max-h-[70vh] overflow-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-slate-500">
                        <th className="sticky left-0 top-0 z-30 min-w-[250px] border-b border-slate-100 bg-slate-50 px-5 py-3 font-semibold">
                          Activities
                        </th>
                        {students.map((student) => (
                          <th
                            key={student.id}
                            className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-100 bg-slate-50 px-5 py-3 text-center font-semibold"
                          >
                            <span className="block">{student.name}</span>
                            <span className="block font-mono text-[10px] normal-case text-slate-400">
                              {student.enrollmentNo}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activities.map((activity, activityIndex) => {
                        const number = `${activityIndex + 1}`;
                        if (activity.subs.length === 0) {
                          return (
                            <tr key={activity.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                              <td className="sticky left-0 z-10 min-w-[250px] bg-white px-5 py-3 font-medium text-slate-900">
                                {number}. {activity.title}
                              </td>
                              {students.map((student) => (
                                <td key={student.id} className="px-5 py-3 text-center">
                                  {cellSelect(
                                    `${student.id}:${activity.id}`,
                                    `${activity.title} for ${student.name}`,
                                  )}
                                </td>
                              ))}
                            </tr>
                          );
                        }
                        return (
                          <React.Fragment key={activity.id}>
                            <tr className="border-b border-slate-100">
                              <td className="sticky left-0 z-10 min-w-[250px] bg-white px-5 py-3 font-semibold text-slate-900">
                                {number}. {activity.title}
                              </td>
                              {students.map((student) => (
                                <td key={student.id} className="bg-slate-50/40 px-5 py-3" />
                              ))}
                            </tr>
                            {activity.subs.map((sub, subIndex) => (
                              <tr key={sub.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                                <td className="sticky left-0 z-10 min-w-[250px] bg-white px-5 py-3 pl-9 text-slate-700">
                                  {number}.{subIndex + 1} {sub.title}
                                </td>
                                {students.map((student) => (
                                  <td key={student.id} className="px-5 py-3 text-center">
                                    {cellSelect(
                                      `${student.id}:${activity.id}:${sub.id}`,
                                      `${activity.title} — ${sub.title} for ${student.name}`,
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </React.Fragment>
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
