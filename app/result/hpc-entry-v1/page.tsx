'use client';

/**
 * HPC entry v1 — matrix of the hierarchical activity tree (rows) against
 * students (columns); each leaf cell selects an activity group.
 *
 * Backed by the dedicated `api/result/hpc-entry-v1` REST API. Verified
 * directly against the Laravel controller (`resultActivityMarksV1Controller
 * @create`) rather than guessed: the real hierarchy is FOUR levels, not
 * two — `skillData` (skills, grouped by `main_sort_order` under a shared
 * `main_title` header) → `activityGroup[skill.id]` (activities) →
 * `subActivityGroup[activity.id]` (sub-activities). The group-option list
 * is `marksType` (one shared list for the whole matrix, confirmed — not
 * per-row). Students are `studentsList`. Existing selections are
 * `studentMarks.activity[studentId][activityId]` and
 * `studentMarks.sub_activity_id[studentId][subActivityId]` (flat, looked
 * up directly per known node rather than inverted — the source query has
 * a known data-quality issue that can leak a stray `''`-keyed entry).
 * `grade` and `division` are required by the API (not just `standard`).
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
  asRecord, assertOk, readString, resultGet, resultPost, toCollection,
} from '@/lib/result/api';

type SubActivity = { id: string; title: string };
type ActivityNode = { id: string; title: string; subs: SubActivity[] };
type SkillNode = { id: string; title: string; activities: ActivityNode[] };
type MainGroup = { key: string; mainTitle: string; skills: SkillNode[] };

type StudentCol = {
  id: string;
  name: string;
  enrollmentNo: string;
};

type ActivityGroupOption = {
  id: string;
  title: string;
};

const FILTER_FIELDS: FilterFieldDef[] = [
  { kind: 'section', required: true },
  { kind: 'standard', required: true },
  { kind: 'division', required: true },
];

function TermField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { academicTerms } = useAuth();
  const options = useMemo(() => {
    const selectedAcademicYear = typeof window === 'undefined' ? '' : localStorage.getItem('selectedAcademicYear') || '';
    return academicTerms
      .filter((item) => {
        const year = readString((item as Record<string, unknown>).syear);
        return !selectedAcademicYear || !year || year === selectedAcademicYear;
      })
      .map((item) => {
        const row = item as Record<string, unknown>;
        return { id: readString(row.term_id ?? row.id), label: readString(row.title ?? row.name) };
      })
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

/** Build the skill → activity → sub-activity tree from the four related maps. */
function buildTree(
  skillData: unknown,
  mainTitlesOrder: unknown,
  activityGroup: unknown,
  subActivityGroup: unknown,
): { groups: MainGroup[]; flatActivities: ActivityNode[] } {
  const skillDataRecord = asRecord(skillData);
  const activityGroupRecord = asRecord(activityGroup);
  const subActivityGroupRecord = asRecord(subActivityGroup);

  const order = toCollection(mainTitlesOrder).map(readString).filter(Boolean);
  const keys = order.length > 0 ? order : Object.keys(skillDataRecord);

  const groups: MainGroup[] = [];
  const flatActivities: ActivityNode[] = [];

  for (const key of keys) {
    const skillRows = toCollection(skillDataRecord[key]).map(asRecord);
    if (skillRows.length === 0) continue;

    const skills: SkillNode[] = skillRows
      .map((skillRow) => {
        const skillId = readString(skillRow.id);
        const activities: ActivityNode[] = toCollection(activityGroupRecord[skillId])
          .map(asRecord)
          .map((activityRow) => {
            const activityId = readString(activityRow.id);
            const subs: SubActivity[] = toCollection(subActivityGroupRecord[activityId])
              .map(asRecord)
              .map((subRow) => ({ id: readString(subRow.id), title: readString(subRow.title) }))
              .filter((sub) => sub.id);
            return { id: activityId, title: readString(activityRow.title), subs };
          })
          .filter((activity) => activity.id);
        activities.forEach((activity) => flatActivities.push(activity));
        return { id: skillId, title: readString(skillRow.title), activities };
      })
      .filter((skill) => skill.id && skill.activities.length > 0);

    if (skills.length === 0) continue;
    groups.push({ key, mainTitle: readString(skillRows[0].main_title) || 'Activities', skills });
  }

  return { groups, flatActivities };
}

/** Look up existing selections only for known activity/sub-activity ids (avoids a source-side stray `''` key). */
function buildExistingMarks(studentMarks: unknown, students: StudentCol[], activities: ActivityNode[]): Record<string, string> {
  const record = asRecord(studentMarks);
  const activityMarks = asRecord(record.activity);
  const subActivityMarks = asRecord(record.sub_activity_id);
  const marks: Record<string, string> = {};

  for (const student of students) {
    const studentActivityMarks = asRecord(activityMarks[student.id]);
    const studentSubMarks = asRecord(subActivityMarks[student.id]);
    for (const activity of activities) {
      if (activity.subs.length === 0) {
        const groupId = readString(studentActivityMarks[activity.id]);
        if (groupId) marks[`${student.id}:${activity.id}`] = groupId;
      } else {
        for (const sub of activity.subs) {
          const groupId = readString(studentSubMarks[sub.id]);
          if (groupId) marks[`${student.id}:${activity.id}:${sub.id}`] = groupId;
        }
      }
    }
  }
  return marks;
}

export default function HpcEntryV1Page() {
  const [term, setTerm] = useState('');
  const [groups, setGroups] = useState<MainGroup[]>([]);
  const [flatActivities, setFlatActivities] = useState<ActivityNode[]>([]);
  const [students, setStudents] = useState<StudentCol[]>([]);
  const [groupOptions, setGroupOptions] = useState<ActivityGroupOption[]>([]);
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
      const payload = await resultGet('api/result/hpc-entry-v1/create', {
        grade: readString(values.grade),
        standard: readString(values.standard),
        division: readString(values.division),
        term,
      });
      const source = asRecord(payload.data ?? payload);

      const { groups: nextGroups, flatActivities: nextActivities } = buildTree(
        source.skillData, source.mainTitlesOrder, source.activityGroup, source.subActivityGroup,
      );
      setGroups(nextGroups);
      setFlatActivities(nextActivities);

      const studentRows: StudentCol[] = toCollection(source.studentsList)
        .map((item) => {
          const record = asRecord(item);
          const fullName = [record.first_name, record.middle_name, record.last_name].map(readString).filter(Boolean).join(' ');
          return {
            id: readString(record.id),
            name: fullName || readString(record.name),
            enrollmentNo: readString(record.roll_no ?? record.gr_no),
          };
        })
        .filter((student) => student.id);
      setStudents(studentRows);

      setGroupOptions(
        toCollection(source.marksType)
          .map(asRecord)
          .map((row) => ({ id: readString(row.id), title: readString(row.title) }))
          .filter((option) => option.id && option.title),
      );

      setMarks(buildExistingMarks(source.studentMarks, studentRows, nextActivities));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the activity matrix. Please try again.');
      setGroups([]);
      setFlatActivities([]);
      setStudents([]);
      setGroupOptions([]);
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
        for (const activity of flatActivities) {
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
      const payload = await resultPost('api/result/hpc-entry-v1', data);
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
      {groupOptions.map((option) => (
        <option key={option.id} value={option.id}>
          {option.title}
        </option>
      ))}
    </select>
  );

  const hasMatrix = groups.length > 0 && students.length > 0;

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
                        <th className="sticky left-0 top-0 z-30 min-w-[280px] border-b border-slate-100 bg-slate-50 px-5 py-3 font-semibold">
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
                      {groups.map((group, groupIndex) => (
                        <React.Fragment key={group.key}>
                          <tr className="border-b border-slate-100 bg-slate-100/70">
                            <td
                              colSpan={students.length + 1}
                              className="sticky left-0 z-10 px-5 py-2 text-xs font-bold uppercase tracking-wide text-slate-600"
                            >
                              {groupIndex + 1}. {group.mainTitle}
                            </td>
                          </tr>
                          {group.skills.map((skill, skillIndex) => (
                            <React.Fragment key={skill.id}>
                              <tr className="border-b border-slate-100">
                                <td className="sticky left-0 z-10 min-w-[280px] bg-white px-5 py-2 pl-8 font-semibold text-slate-800">
                                  {groupIndex + 1}.{skillIndex + 1} {skill.title}
                                </td>
                                {students.map((student) => (
                                  <td key={student.id} className="bg-slate-50/40 px-5 py-2" />
                                ))}
                              </tr>
                              {skill.activities.map((activity, activityIndex) => {
                                const number = `${groupIndex + 1}.${skillIndex + 1}.${activityIndex + 1}`;
                                if (activity.subs.length === 0) {
                                  return (
                                    <tr key={activity.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                                      <td className="sticky left-0 z-10 min-w-[280px] bg-white px-5 py-3 pl-12 text-slate-900">
                                        {number} {activity.title}
                                      </td>
                                      {students.map((student) => (
                                        <td key={student.id} className="px-5 py-3 text-center">
                                          {cellSelect(`${student.id}:${activity.id}`, `${activity.title} for ${student.name}`)}
                                        </td>
                                      ))}
                                    </tr>
                                  );
                                }
                                return (
                                  <React.Fragment key={activity.id}>
                                    <tr className="border-b border-slate-100">
                                      <td className="sticky left-0 z-10 min-w-[280px] bg-white px-5 py-3 pl-12 font-medium text-slate-900">
                                        {number} {activity.title}
                                      </td>
                                      {students.map((student) => (
                                        <td key={student.id} className="bg-slate-50/40 px-5 py-3" />
                                      ))}
                                    </tr>
                                    {activity.subs.map((sub, subIndex) => (
                                      <tr key={sub.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                                        <td className="sticky left-0 z-10 min-w-[280px] bg-white px-5 py-3 pl-16 text-slate-700">
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
                            </React.Fragment>
                          ))}
                        </React.Fragment>
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
