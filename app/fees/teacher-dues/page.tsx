'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';

import { fetchTeacherFeeDues, getDashboardSession, type TeacherFeeDuesSummary } from '@/app/dashboard/_lib/dashboard-api';
import { DashboardError, DashboardSkeleton, EmptyState } from '@/app/dashboard/_components/DashboardPrimitives';
import RequireStaff from '@/app/lms/_shared/RequireStaff';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function TeacherFeeDuesPage() {
  const [data, setData] = useState<TeacherFeeDuesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const session = getDashboardSession();
    fetchTeacherFeeDues(session)
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <RequireStaff>
      <div className="flex-1 overflow-auto p-8">
        <div className="mb-8 flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-[#4F46E5]">
            <Wallet size={20} strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Fee dues (my class)</h1>
            <p className="mt-1 text-slate-500">Students with pending fees across the classes you teach, so you can follow up directly.</p>
          </div>
        </div>

        {loading && <DashboardSkeleton />}
        {!loading && error && <DashboardError message={error} onRetry={load} />}

        {!loading && !error && data && (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="text-sm text-slate-500">Students with dues</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{data.summary.total_due_students}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="text-sm text-slate-500">Total amount due</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{formatCurrency(data.summary.total_due_amount)}</div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-slate-900">Students with pending fees</h3>
                <p className="mt-0.5 text-sm text-slate-500">Read-only — fee collection is handled by the accounts office.</p>
              </div>

              {data.students.length === 0 ? (
                <EmptyState message="No pending fee dues in your classes right now. Nice work keeping up with collections." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-4">Student</th>
                        <th className="py-2 pr-4">Class</th>
                        <th className="py-2 pr-4 text-right">Total fee</th>
                        <th className="py-2 pr-4 text-right">Paid</th>
                        <th className="py-2 pr-4 text-right">Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.students.map((student) => (
                        <tr key={student.student_id}>
                          <td className="py-3 pr-4">
                            <div className="font-medium text-slate-900">{student.student_name}</div>
                            {student.enrollment_no && <div className="text-xs text-slate-500">{student.enrollment_no}</div>}
                          </td>
                          <td className="py-3 pr-4 text-slate-700">
                            {student.standard_name} - {student.division_name}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums text-slate-700">{formatCurrency(student.total_fee)}</td>
                          <td className="py-3 pr-4 text-right tabular-nums text-slate-700">{formatCurrency(student.paid_amount)}</td>
                          <td className="py-3 pr-4 text-right tabular-nums font-semibold text-red-600">{formatCurrency(student.due_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </RequireStaff>
  );
}
