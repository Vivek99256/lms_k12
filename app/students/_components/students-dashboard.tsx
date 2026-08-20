'use client';

import { StatCard } from '@/components/ui/stat-card';
import type {
  DropReasonRow,
  GenderCountRow,
  RecentEnrollmentRow,
  StudentsByClassRow,
} from '@/app/students/_lib/students-dashboard-api';

export interface StudentsDashboardProps {
  totalStudents: number;
  inactiveThisYear: number;
  totalClasses: number;
}

export function StudentsDashboard({ totalStudents, inactiveThisYear, totalClasses }: StudentsDashboardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Active students" value={totalStudents} />
      <StatCard label="Classes" value={totalClasses} />
      <StatCard label="Left this year" value={inactiveThisYear} />
      <StatCard
        label="Retention"
        value={
          totalStudents + inactiveThisYear > 0
            ? `${Math.round((totalStudents / (totalStudents + inactiveThisYear)) * 100)}%`
            : '—'
        }
        hint="Active vs. total enrolled"
      />
    </div>
  );
}

function BarList({
  rows,
  labelKey,
  valueKey,
  emptyLabel,
}: {
  rows: Array<Record<string, unknown>>;
  labelKey: string;
  valueKey: string;
  emptyLabel: string;
}) {
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey]) || 0));

  if (rows.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((row, index) => {
        const value = Number(row[valueKey]) || 0;
        const width = (value / max) * 100;

        return (
          <li key={index}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
              <span className="font-medium text-slate-700">{String(row[labelKey])}</span>
              <span className="font-semibold text-slate-900 tabular-nums">{value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[var(--primary-blue)]" style={{ width: `${width}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function StudentsByClassPanel({ rows }: { rows: StudentsByClassRow[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Students by class</h3>
      <p className="mt-0.5 text-xs text-slate-500">Active enrollment, current academic year.</p>
      <div className="mt-3">
        <BarList rows={rows} labelKey="standard_name" valueKey="students" emptyLabel="No active enrollment for this academic year." />
      </div>
    </section>
  );
}

export function GenderBreakdownPanel({ rows }: { rows: GenderCountRow[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Gender breakdown</h3>
      <p className="mt-0.5 text-xs text-slate-500">Active students, current academic year.</p>
      <div className="mt-3">
        <BarList rows={rows} labelKey="gender" valueKey="total" emptyLabel="No active enrollment for this academic year." />
      </div>
    </section>
  );
}

export function DropReasonsPanel({ rows }: { rows: DropReasonRow[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Students who left, by reason</h3>
      <p className="mt-0.5 text-xs text-slate-500">Current academic year.</p>
      <div className="mt-3">
        <BarList rows={rows} labelKey="reason" valueKey="total" emptyLabel="No students have left this academic year." />
      </div>
    </section>
  );
}

export function RecentEnrollmentsPanel({ rows }: { rows: RecentEnrollmentRow[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Recently enrolled</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">No enrollments recorded yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.student_id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{row.student_name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {row.standard_name}
                  {row.division_name ? ` - ${row.division_name}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-xs text-slate-500">{row.created_on?.slice(0, 10)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default StudentsDashboard;
