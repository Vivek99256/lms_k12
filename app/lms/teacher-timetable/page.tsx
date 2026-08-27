'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  fetchTeacherTimetable,
  getDashboardSession,
  type TeacherTimetableSummary,
} from '@/app/dashboard/_lib/dashboard-api';
import { DashboardError, DashboardSkeleton, EmptyState } from '@/app/dashboard/_components/DashboardPrimitives';
import RequireStaff from '@/app/lms/_shared/RequireStaff';

type TimetableRow = TeacherTimetableSummary['timetable'][number];

const WEEK_DAYS: Array<{ code: string; label: string }> = [
  { code: 'M', label: 'Monday' },
  { code: 'T', label: 'Tuesday' },
  { code: 'W', label: 'Wednesday' },
  { code: 'H', label: 'Thursday' },
  { code: 'F', label: 'Friday' },
  { code: 'S', label: 'Saturday' },
];

function formatTime(value: string): string {
  return value ? value.slice(0, 5) : '';
}

export default function TeacherTimetablePage() {
  const [rows, setRows] = useState<TimetableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const session = getDashboardSession();
    fetchTeacherTimetable(session)
      .then((data) => setRows(data.timetable || []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const periods = useMemo(() => {
    const byId = new Map<number, { period_id: number; period_title: string; start_time: string; end_time: string }>();
    for (const row of rows) {
      if (!byId.has(row.period_id)) {
        byId.set(row.period_id, {
          period_id: row.period_id,
          period_title: row.period_title,
          start_time: row.start_time,
          end_time: row.end_time,
        });
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [rows]);

  const cellFor = useCallback(
    (periodId: number, dayCode: string) => rows.find((row) => row.period_id === periodId && row.week_day === dayCode),
    [rows]
  );

  return (
    <RequireStaff>
      <div className="min-h-full px-4 py-5 sm:px-6">
        <div className="mx-auto w-full max-w-[1600px] space-y-5">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Clock className="size-5" />
              </span>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">My timetable</h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  Your weekly teaching schedule across all classes and subjects.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </header>

          {loading && <DashboardSkeleton />}
          {!loading && error && <DashboardError message={error} onRetry={load} />}

          {!loading && !error && (
            rows.length === 0 ? (
              <EmptyState message="No timetable periods have been assigned to you yet." />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="w-40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Period
                      </th>
                      {WEEK_DAYS.map((day) => (
                        <th
                          key={day.code}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {day.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {periods.map((period) => (
                      <tr key={period.period_id}>
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-slate-900">{period.period_title}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {formatTime(period.start_time)} - {formatTime(period.end_time)}
                          </div>
                        </td>
                        {WEEK_DAYS.map((day) => {
                          const cell = cellFor(period.period_id, day.code);
                          return (
                            <td key={day.code} className="px-4 py-3 align-top">
                              {cell ? (
                                <div className="rounded-md border border-indigo-100 bg-indigo-50/60 px-2.5 py-1.5">
                                  <div className="font-medium text-slate-900">{cell.subject_name}</div>
                                  <div className="mt-0.5 text-xs text-slate-500">
                                    {cell.standard_name} - {cell.division_name}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>
    </RequireStaff>
  );
}
