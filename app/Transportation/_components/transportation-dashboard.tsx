'use client';

import { StatCard } from '@/components/ui/stat-card';
import type { VanSummaryRow } from '@/app/Transportation/_lib/transportation-dashboard-api';

export interface TransportationDashboardProps {
  totalRoutes: number;
  totalVehicles: number;
  totalStudentsMapped: number;
  capacityUtilization: number;
}

export function TransportationDashboard({
  totalRoutes,
  totalVehicles,
  totalStudentsMapped,
  capacityUtilization,
}: TransportationDashboardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Routes" value={totalRoutes} />
      <StatCard label="Vehicles" value={totalVehicles} />
      <StatCard label="Students mapped" value={totalStudentsMapped} />
      <StatCard label="Capacity utilization" value={`${capacityUtilization}%`} hint="Mapped students vs. total seats" />
    </div>
  );
}

export function VanSummaryPanel({ rows }: { rows: VanSummaryRow[] }) {
  const max = Math.max(1, ...rows.map((row) => row.student_count));

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Vehicle occupancy by shift</h3>
        <p className="mt-0.5 text-xs text-slate-500">Students mapped per vehicle, current academic year.</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">No students are mapped to a vehicle yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 p-4">
          {rows.map((row) => {
            const width = (row.student_count / max) * 100;

            return (
              <li key={`${row.vehicle_id}-${row.shift_id}`} className="py-3 first:pt-0 last:pb-0">
                <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                  <span className="font-medium text-slate-700">
                    {row.vehicle_name} · {row.shift_title}
                  </span>
                  <span className="font-semibold text-slate-900 tabular-nums">{row.student_count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[var(--primary-blue)]" style={{ width: `${width}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default TransportationDashboard;
