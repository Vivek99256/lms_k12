'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Users, GraduationCap, School, Wallet, UserPlus, BookOpenCheck, Megaphone, MessageCircleWarning, FileText, Settings, Cake } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAdminDashboard, getDashboardSession, type AdminDashboardSummary } from '@/app/dashboard/_lib/dashboard-api';
import { DashboardError, DashboardSkeleton, EmptyState, QuickActionLink, SectionPanel, StatCard } from '@/app/dashboard/_components/DashboardPrimitives';
import { DashboardBarChart } from '@/app/dashboard/_components/DashboardBarChart';

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const session = getDashboardSession();
    fetchAdminDashboard(session)
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Welcome back, {user?.name || 'Admin'}</h1>
        <p className="mt-1 text-slate-500">Here&apos;s today&apos;s overview across the school.</p>
      </div>

      {loading && <DashboardSkeleton />}
      {!loading && error && <DashboardError message={error} onRetry={load} />}

      {!loading && !error && data && (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total students" value={data.summary.total_students} icon={GraduationCap} />
            <StatCard label="Total staff" value={data.summary.total_staff} icon={Users} />
            <StatCard label="Total classes" value={data.summary.total_classes} icon={School} />
            <StatCard label="Fees collected today" value={formatCurrency(data.summary.fees_collected_today)} icon={Wallet} tone="positive" />
            <StatCard label="Admissions this year" value={data.summary.admissions_this_year} icon={UserPlus} />
            <StatCard label="Homework posted today" value={data.summary.homework_today} icon={BookOpenCheck} />
            <StatCard label="Circulars today" value={data.summary.circulars_today} icon={Megaphone} />
            <StatCard
              label="Parent messages awaiting reply"
              value={data.summary.pending_parent_communications}
              icon={MessageCircleWarning}
              tone={data.summary.pending_parent_communications > 0 ? 'warning' : 'default'}
            />
          </div>

          <SectionPanel title="Quick actions" className="mb-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <QuickActionLink href="/student" label="Add student" icon={UserPlus} />
              <QuickActionLink href="/fees" label="Collect fee" icon={Wallet} />
              <QuickActionLink href="/reports" label="View reports" icon={FileText} />
              <QuickActionLink href="/settings" label="Manage settings" icon={Settings} />
            </div>
          </SectionPanel>

          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionPanel title="Fee collection" description="Last 7 days">
              {data.fee_collection_trend.every((row) => row.amount === 0) ? (
                <EmptyState message="No fee collections in the last 7 days." />
              ) : (
                <DashboardBarChart
                  labels={data.fee_collection_trend.map((row) => row.label)}
                  values={data.fee_collection_trend.map((row) => row.amount)}
                />
              )}
            </SectionPanel>

            <SectionPanel title="Students by class" description="Current enrollment distribution">
              {data.students_by_class.length === 0 ? (
                <EmptyState message="No enrollment data yet." />
              ) : (
                <DashboardBarChart
                  labels={data.students_by_class.map((row) => row.standard_name)}
                  values={data.students_by_class.map((row) => row.students)}
                  color="#7ED957"
                />
              )}
            </SectionPanel>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionPanel title="Recent fee receipts" description="Latest payments received">
              {data.recent_fee_receipts.length === 0 ? (
                <EmptyState message="No fee receipts yet today." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.recent_fee_receipts.map((row) => (
                    <div key={row.receipt_no} className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <div className="font-medium text-slate-900">{row.student_name}</div>
                        <div className="text-slate-500">Receipt {row.receipt_no}</div>
                      </div>
                      <div className="font-mono text-slate-900">{formatCurrency(row.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </SectionPanel>

            <SectionPanel title="Upcoming birthdays" description="Students celebrating in the next 7 days">
              {data.upcoming_birthdays.length === 0 ? (
                <EmptyState message="No student birthdays in the next 7 days." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.upcoming_birthdays.map((row, i) => (
                    <div key={i} className="flex items-center gap-3 py-3 text-sm">
                      <Cake size={16} className="text-[#4F46E5]" strokeWidth={1.75} />
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{row.student_name}</div>
                        <div className="text-slate-500">
                          {row.standard_name} - {row.division_name}
                        </div>
                      </div>
                      <div className="text-slate-500">{row.dob}</div>
                    </div>
                  ))}
                </div>
              )}
            </SectionPanel>
          </div>
        </>
      )}
    </div>
  );
}
