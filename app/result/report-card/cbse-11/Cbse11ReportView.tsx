'use client';

/**
 * Shared CBSE class 11 report-card renderer, used by both the CBSE and
 * CNSE class 11 pages (the legacy CNSE screen reuses the CBSE endpoint
 * and layout). Renders per-student cards with the fixed multi-level
 * scholastic header, co-scholastic parent tables and attendance.
 * Payload shapes are uncertain, so parsing is defensive with a raw-data
 * fallback per student.
 */

import React from 'react';
import { Banner, EmptyState } from '@/components/result/primitives';
import { asRecord, readString, toCollection } from '@/lib/result/api';

/* ------------------------------------------------------------- parsing */

type ScholRow = {
  subject: string;
  ut1: string;
  ut2: string;
  hyMax: string;
  hyObt: string;
  prMax: string;
  prObt: string;
  yrMax: string;
  yrObt: string;
  total: string;
  grandTotal: string;
  average: string;
};

type CoScholParent = { parent: string; items: { title: string; grade: string }[] };

export type Cbse11Student = {
  raw: Record<string, unknown>;
  id: string;
  info: { label: string; value: string }[];
  scholastic: ScholRow[];
  coScholastic: CoScholParent[];
  workingDays: string;
  daysAttended: string;
  parsed: boolean;
};

function pick(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] != null) return record[key];
  }
  return undefined;
}

function text(record: Record<string, unknown>, ...keys: string[]): string {
  const value = pick(record, ...keys);
  return value != null && typeof value !== 'object' ? readString(value) : '';
}

/** Read a max/obt pair either from flat `<base>_max`/`<base>_obt` keys or a nested record. */
function pair(record: Record<string, unknown>, bases: string[]): { max: string; obt: string } {
  for (const base of bases) {
    const max = text(record, `${base}_max`, `${base}_max_marks`, `${base}Max`);
    const obt = text(record, `${base}_obt`, `${base}_obt_marks`, `${base}_marks`, `${base}Obt`);
    if (max || obt) return { max, obt };
    const nested = asRecord(record[base]);
    if (Object.keys(nested).length > 0) {
      return {
        max: text(nested, 'max', 'max_marks', 'maxMarks', 'total', 'outof'),
        obt: text(nested, 'obt', 'obt_marks', 'obtained', 'obtained_marks', 'marks', 'points'),
      };
    }
  }
  return { max: '', obt: '' };
}

function parseScholastic(student: Record<string, unknown>): ScholRow[] {
  const source = pick(student, 'scholastic', 'scholastic_data', 'subjects', 'subject_data', 'marks_data', 'mark_data', 'marks');
  const rows: ScholRow[] = [];

  const buildRow = (subject: string, value: Record<string, unknown>): ScholRow => {
    const hy = pair(value, ['half_yearly', 'halfyearly', 'hy']);
    const pr = pair(value, ['yearly_practical', 'practical', 'asl_project', 'project']);
    const yr = pair(value, ['yearly_exam', 'yearly']);
    return {
      subject,
      ut1: text(value, 'ut1', 'unit_test_1', 'unit_test1', 'UT1', 'unit_test_i'),
      ut2: text(value, 'ut2', 'unit_test_2', 'unit_test2', 'UT2', 'unit_test_ii'),
      hyMax: hy.max,
      hyObt: hy.obt,
      prMax: pr.max,
      prObt: pr.obt,
      yrMax: yr.max,
      yrObt: yr.obt,
      total: text(value, 'total', 'Total'),
      grandTotal: text(value, 'grand_total', 'grandTotal', 'GrandTotal'),
      average: text(value, 'average', 'avg', 'Average'),
    };
  };

  if (source != null && typeof source === 'object' && !Array.isArray(source)) {
    for (const [subject, value] of Object.entries(asRecord(source))) {
      if (value == null || typeof value !== 'object') continue;
      rows.push(buildRow(subject, asRecord(value)));
    }
  } else {
    for (const item of toCollection(source)) {
      const record = asRecord(item);
      const subject = text(record, 'subject_name', 'subject', 'name', 'title');
      if (!subject) continue;
      rows.push(buildRow(subject, record));
    }
  }
  return rows;
}

function parseCoScholastic(student: Record<string, unknown>): CoScholParent[] {
  const source = asRecord(pick(student, 'co_scholastic', 'coscholastic', 'co_scholastic_data', 'coScholastic'));
  const parents: CoScholParent[] = [];
  for (const [parent, value] of Object.entries(source)) {
    const items: CoScholParent['items'] = [];
    if (Array.isArray(value)) {
      for (const item of value) {
        const record = asRecord(item);
        items.push({
          title: text(record, 'title', 'name', 'main_title', 'co_scholastic_title'),
          grade: text(record, 'grade', 'Grade', 'term2_grade', 'points'),
        });
      }
    } else if (value != null && typeof value === 'object') {
      for (const [title, grade] of Object.entries(asRecord(value))) {
        if (grade != null && typeof grade === 'object') {
          items.push({ title, grade: text(asRecord(grade), 'grade', 'Grade', 'points') });
        } else {
          items.push({ title, grade: readString(grade) });
        }
      }
    }
    if (items.length > 0) parents.push({ parent, items });
  }
  return parents;
}

function parseStudent(record: Record<string, unknown>): Cbse11Student {
  const infoCandidates: [string, string][] = [
    ['Student name', text(record, 'student_name', 'name', 'full_name')],
    ['Class', text(record, 'standard', 'standard_name', 'class', 'class_name', 'std')],
    ['Division', text(record, 'division', 'division_name')],
    ['Roll no', text(record, 'roll_no', 'rollno')],
    ['Admission no', text(record, 'admission_no', 'enrollment_no', 'gr_number', 'gr_no')],
    ["Father's name", text(record, 'father_name', 'fathers_name')],
    ["Mother's name", text(record, 'mother_name', 'mothers_name')],
    ['Date of birth', text(record, 'dob', 'date_of_birth', 'birth_date')],
  ];
  const attendance = asRecord(pick(record, 'attendance', 'attendance_data'));
  const scholastic = parseScholastic(record);
  return {
    raw: record,
    id: text(record, 'student_id', 'id'),
    info: infoCandidates.filter(([, value]) => value !== '').map(([label, value]) => ({ label, value })),
    scholastic,
    coScholastic: parseCoScholastic(record),
    workingDays: text(attendance, 'working_days', 'total_working_days', 'no_of_working_days') || text(record, 'working_days', 'total_working_day'),
    daysAttended: text(attendance, 'days_attended', 'attended_days', 'present_days') || text(record, 'days_attended', 'present_working_day'),
    parsed: scholastic.length > 0,
  };
}

export function parseCbse11Students(payload: Record<string, unknown>): Cbse11Student[] {
  const source = payload.data ?? payload;
  const record = asRecord(source);
  if (!Array.isArray(source) && (record.student_name || record.scholastic || record.subjects || record.marks_data)) {
    return [parseStudent(record)];
  }
  return toCollection(source)
    .map(asRecord)
    .filter((row) => Object.keys(row).length > 0)
    .map(parseStudent);
}

/* ----------------------------------------------------------- rendering */

const th = 'border-r border-slate-200 px-3 py-2 text-center font-semibold';
const td = 'border-r border-slate-200 px-3 py-2 text-center text-slate-600';

export default function Cbse11ReportView({ students }: { students: Cbse11Student[] }) {
  if (students.length === 0) {
    return <EmptyState title="No report cards" message="No student result data was returned for the selected criteria." />;
  }

  return (
    <div className="space-y-8">
      {students.map((student, index) => {
        if (!student.parsed) {
          return (
            <div key={index} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <Banner tone="warning">Unrecognised report payload — showing raw data</Banner>
              <pre className="max-h-96 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                {JSON.stringify(student.raw, null, 2)}
              </pre>
            </div>
          );
        }
        return (
          <div key={student.id || index} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 border-b border-slate-100 pb-3">
              <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
                {student.info.map((item) => (
                  <p key={item.label} className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-800">{item.label}:</span> {item.value}
                  </p>
                ))}
              </div>
            </div>

            {/* scholastic — fixed multi-level header */}
            <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Scholastic areas</h4>
            <div className="mb-5 overflow-x-auto">
              <table className="w-full min-w-max border border-slate-200 text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th rowSpan={2} className="border-r border-slate-200 px-3 py-2 font-semibold">SUBJECTS</th>
                    <th rowSpan={2} className={th}>UNIT TEST I (OUT OF 25)</th>
                    <th rowSpan={2} className={th}>UNIT TEST II (OUT OF 25)</th>
                    <th colSpan={2} className={`border-b ${th}`}>HALF YEARLY EXAM</th>
                    <th colSpan={2} className={`border-b ${th}`}>YEARLY PRACTICAL/ASL/PROJECT</th>
                    <th colSpan={2} className={`border-b ${th}`}>YEARLY EXAM</th>
                    <th rowSpan={2} className={th}>TOTAL</th>
                    <th rowSpan={2} className={th}>GRAND TOTAL</th>
                    <th rowSpan={2} className="px-3 py-2 text-center font-semibold">AVERAGE</th>
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className={th}>MAX. MARKS</th>
                    <th className={th}>OBT. MARKS</th>
                    <th className={th}>MAX. MARKS</th>
                    <th className={th}>OBT. MARKS</th>
                    <th className={th}>MAX. MARKS</th>
                    <th className={th}>OBT. MARKS</th>
                  </tr>
                </thead>
                <tbody>
                  {student.scholastic.map((row) => (
                    <tr key={row.subject} className="border-b border-slate-100 last:border-0">
                      <td className="border-r border-slate-200 px-3 py-2 font-medium text-slate-800">{row.subject}</td>
                      <td className={td}>{row.ut1 || '—'}</td>
                      <td className={td}>{row.ut2 || '—'}</td>
                      <td className={td}>{row.hyMax || '—'}</td>
                      <td className={td}>{row.hyObt || '—'}</td>
                      <td className={td}>{row.prMax || '—'}</td>
                      <td className={td}>{row.prObt || '—'}</td>
                      <td className={td}>{row.yrMax || '—'}</td>
                      <td className={td}>{row.yrObt || '—'}</td>
                      <td className={td}>{row.total || '—'}</td>
                      <td className={td}>{row.grandTotal || '—'}</td>
                      <td className="px-3 py-2 text-center text-slate-600">{row.average || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* co-scholastic */}
            {student.coScholastic.map((parent) => (
              <div key={parent.parent} className="mb-5">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max border border-slate-200 text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <th className="w-[70%] border-r border-slate-200 px-3 py-2 font-semibold">{parent.parent.toUpperCase()}</th>
                        <th className="w-[30%] px-3 py-2 text-center font-semibold">GRADE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parent.items.map((item, itemIndex) => (
                        <tr key={`${item.title}-${itemIndex}`} className="border-b border-slate-100 last:border-0">
                          <td className="border-r border-slate-200 px-3 py-2 text-slate-800">{item.title || '—'}</td>
                          <td className="px-3 py-2 text-center text-slate-600">{item.grade || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* attendance */}
            {(student.workingDays || student.daysAttended) && (
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Attendance</h4>
                <table className="w-full max-w-md border border-slate-200 text-left text-sm">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="border-r border-slate-200 px-3 py-2 font-medium text-slate-800">No. of working days</td>
                      <td className="px-3 py-2 text-center text-slate-600">{student.workingDays || '—'}</td>
                    </tr>
                    <tr>
                      <td className="border-r border-slate-200 px-3 py-2 font-medium text-slate-800">Days attended</td>
                      <td className="px-3 py-2 text-center text-slate-600">{student.daysAttended || '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
