'use client';

import { StatCard } from '@/components/ui/stat-card';
import type {
  RecentEnquiryRow,
  StandardCountRow,
  StatusCountRow,
} from '@/app/admissions/_lib/admissions-dashboard-api';

export interface AdmissionsDashboardProps {
  totalEnquiries: number;
  totalApplications: number;
  totalRegistrations: number;
  conversionRate: number;
}

export function AdmissionsDashboard({
  totalEnquiries,
  totalApplications,
  totalRegistrations,
  conversionRate,
}: AdmissionsDashboardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Enquiries" value={totalEnquiries} />
      <StatCard label="Applications" value={totalApplications} />
      <StatCard label="Registrations" value={totalRegistrations} />
      <StatCard label="Conversion rate" value={`${conversionRate}%`} hint="Enquiry to registration" />
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

export function AdmissionsFunnelPanel({ rows }: { rows: StatusCountRow[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Registrations by status</h3>
      <p className="mt-0.5 text-xs text-slate-500">Confirmed registrations grouped by their current status.</p>
      <div className="mt-3">
        <BarList rows={rows} labelKey="status" valueKey="total" emptyLabel="No registrations yet for this academic year." />
      </div>
    </section>
  );
}

export function EnquiriesByStandardPanel({ rows }: { rows: StandardCountRow[] }) {
  const withLabel = rows.map((row) => ({ ...row, label: `Grade ${row.admission_standard}` }));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Enquiries by grade</h3>
      <p className="mt-0.5 text-xs text-slate-500">Grade applied for, across all enquiries this year.</p>
      <div className="mt-3">
        <BarList rows={withLabel} labelKey="label" valueKey="total" emptyLabel="No enquiries yet for this academic year." />
      </div>
    </section>
  );
}

export function RecentEnquiriesPanel({ rows }: { rows: RecentEnquiryRow[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Recent enquiries</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">No enquiries recorded yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{row.student_name || `Enquiry #${row.enquiry_no}`}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {row.admission_standard ? `Grade ${row.admission_standard}` : 'Grade not set'}
                  {row.source_of_enquiry ? ` · ${row.source_of_enquiry}` : ''}
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

export default AdmissionsDashboard;
