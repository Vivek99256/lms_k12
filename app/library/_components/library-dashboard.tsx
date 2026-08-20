'use client';

import { StatCard } from '@/components/ui/stat-card';
import type { MaterialTypeRow, RecentIssueRow } from '@/app/library/_lib/library-dashboard-api';

export interface LibraryDashboardProps {
  totalTitles: number;
  totalItems: number;
  currentlyIssued: number;
  overdue: number;
}

export function LibraryDashboard({ totalTitles, totalItems, currentlyIssued, overdue }: LibraryDashboardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Titles" value={totalTitles} />
      <StatCard label="Copies in catalog" value={totalItems} />
      <StatCard label="Currently issued" value={currentlyIssued} />
      <StatCard label="Overdue" value={overdue} />
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

export function ItemsByMaterialTypePanel({ rows }: { rows: MaterialTypeRow[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Catalog by material type</h3>
      <p className="mt-0.5 text-xs text-slate-500">Active copies, current catalog.</p>
      <div className="mt-3">
        <BarList rows={rows} labelKey="material_type" valueKey="total" emptyLabel="No catalog items yet." />
      </div>
    </section>
  );
}

export function RecentIssuesPanel({ rows }: { rows: RecentIssueRow[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Recent issues</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">No books issued yet this year.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{row.book_title}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {row.student_name} · due {row.due_date?.slice(0, 10)}
                </p>
              </div>
              <span className="shrink-0 text-xs text-slate-500">
                {row.return_date && !row.return_date.startsWith('0000-00') ? `Returned ${row.return_date.slice(0, 10)}` : 'Not returned'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default LibraryDashboard;
