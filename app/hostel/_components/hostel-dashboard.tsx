'use client';

import { StatCard } from '@/components/ui/stat-card';
import type { CategoryCountRow, HostelCountRow } from '@/app/hostel/_lib/hostel-dashboard-api';

export interface HostelDashboardProps {
  totalHostels: number;
  totalRooms: number;
  totalAllocations: number;
  occupancyRate: number;
}

export function HostelDashboard({ totalHostels, totalRooms, totalAllocations, occupancyRate }: HostelDashboardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Hostels" value={totalHostels} />
      <StatCard label="Rooms" value={totalRooms} />
      <StatCard label="Allocations" value={totalAllocations} />
      <StatCard label="Occupancy rate" value={`${occupancyRate}%`} hint="Allocations vs. total rooms" />
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

export function AllocationsByHostelPanel({ rows }: { rows: HostelCountRow[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Allocations by hostel</h3>
      <p className="mt-0.5 text-xs text-slate-500">Current academic year.</p>
      <div className="mt-3">
        <BarList rows={rows} labelKey="hostel_name" valueKey="total" emptyLabel="No allocations yet for this academic year." />
      </div>
    </section>
  );
}

export function AllocationsByCategoryPanel({ rows }: { rows: CategoryCountRow[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Allocations by admission category</h3>
      <p className="mt-0.5 text-xs text-slate-500">Current academic year.</p>
      <div className="mt-3">
        <BarList rows={rows} labelKey="category" valueKey="total" emptyLabel="No allocations yet for this academic year." />
      </div>
    </section>
  );
}

export default HostelDashboard;
