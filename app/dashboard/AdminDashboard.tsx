'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Users, GraduationCap, School, Wallet, UserPlus, BookOpenCheck, Megaphone, MessageCircleWarning, FileText, Settings, Cake } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAdminDashboard, getDashboardSession, type AdminDashboardSummary } from '@/app/dashboard/_lib/dashboard-api';
import { DashboardError, DashboardSkeleton, EmptyState, QuickActionLink, SectionPanel, StatCard } from '@/app/dashboard/_components/DashboardPrimitives';
import { DashboardBarChart } from '@/app/dashboard/_components/DashboardBarChart';
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard';
import { useDashboardPreferences } from '@/app/dashboard/_lib/useDashboardPreferences';
import type { DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences';

/** Everything on this dashboard a user can hide for themselves. Ids are stored per user — don't rename them. */
const ADMIN_WIDGETS = [
  { id: 'kpi.total_students', label: 'Total students', group: 'kpi' },
  { id: 'kpi.total_staff', label: 'Total staff', group: 'kpi' },
  { id: 'kpi.total_classes', label: 'Total classes', group: 'kpi' },
  { id: 'kpi.fees_collected_today', label: 'Fees collected today', group: 'kpi' },
  { id: 'kpi.admissions_this_year', label: 'Admissions this year', group: 'kpi' },
  { id: 'kpi.homework_today', label: 'Homework posted today', group: 'kpi' },
  { id: 'kpi.circulars_today', label: 'Circulars today', group: 'kpi' },
  { id: 'kpi.pending_parent_communications', label: 'Parent messages awaiting reply', group: 'kpi' },
  { id: 'chart.fee_collection', label: 'Fee collection (last 7 days)', group: 'chart' },
  { id: 'chart.students_by_class', label: 'Students by class', group: 'chart' },
  { id: 'panel.quick_actions', label: 'Quick actions', group: 'panel' },
  { id: 'panel.recent_fee_receipts', label: 'Recent fee receipts', group: 'panel' },
  { id: 'panel.upcoming_birthdays', label: 'Upcoming birthdays', group: 'panel' },
] as const satisfies readonly DashboardWidget[];

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prefs = useDashboardPreferences('home.admin', ADMIN_WIDGETS);
  const show = prefs.isVisible;
  const bothCharts = show('chart.fee_collection') && show('chart.students_by_class');
  const bothLists = show('panel.recent_fee_receipts') && show('panel.upcoming_birthdays');

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
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Welcome back, {user?.name || 'Admin'}</h1>
          <p className="mt-1 text-slate-500">Here&apos;s today&apos;s overview across the school.</p>
        </div>
        {prefs.ready && (
          <CustomizeDashboard widgets={ADMIN_WIDGETS} {...prefs.customizeProps} />
        )}
      </div>

      {/* Wait for the user's layout too, so hidden widgets never flash in. */}
      {(loading || !prefs.ready) && <DashboardSkeleton />}
      {!loading && prefs.ready && error && <DashboardError message={error} onRetry={load} />}

      {!loading && prefs.ready && !error && data && !prefs.hasVisible() && (
        <AllWidgetsHiddenNotice />
      )}

      {!loading && prefs.ready && !error && data && (
        <>
          {prefs.hasVisible('kpi') && (
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {show('kpi.total_students') && <StatCard label="Total students" value={data.summary.total_students} icon={GraduationCap} />}
              {show('kpi.total_staff') && <StatCard label="Total staff" value={data.summary.total_staff} icon={Users} />}
              {show('kpi.total_classes') && <StatCard label="Total classes" value={data.summary.total_classes} icon={School} />}
              {show('kpi.fees_collected_today') && (
                <StatCard label="Fees collected today" value={formatCurrency(data.summary.fees_collected_today)} icon={Wallet} tone="positive" />
              )}
              {show('kpi.admissions_this_year') && <StatCard label="Admissions this year" value={data.summary.admissions_this_year} icon={UserPlus} />}
              {show('kpi.homework_today') && <StatCard label="Homework posted today" value={data.summary.homework_today} icon={BookOpenCheck} />}
              {show('kpi.circulars_today') && <StatCard label="Circulars today" value={data.summary.circulars_today} icon={Megaphone} />}
              {show('kpi.pending_parent_communications') && (
                <StatCard
                  label="Parent messages awaiting reply"
                  value={data.summary.pending_parent_communications}
                  icon={MessageCircleWarning}
                  tone={data.summary.pending_parent_communications > 0 ? 'warning' : 'default'}
                />
              )}
            </div>
          )}

          {show('panel.quick_actions') && (
            <SectionPanel title="Quick actions" className="mb-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <QuickActionLink href="/student" label="Add student" icon={UserPlus} />
                <QuickActionLink href="/fees" label="Collect fee" icon={Wallet} />
                <QuickActionLink href="/reports" label="View reports" icon={FileText} />
                <QuickActionLink href="/settings" label="Manage settings" icon={Settings} />
              </div>
            </SectionPanel>
          )}

          {prefs.hasVisible('chart') && (
            // A lone remaining chart takes the full row instead of leaving a gap.
            <div className={`mb-6 grid grid-cols-1 gap-6 ${bothCharts ? 'lg:grid-cols-2' : ''}`}>
              {show('chart.fee_collection') && (
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
              )}

              {show('chart.students_by_class') && (
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
              )}
            </div>
          )}

          {(show('panel.recent_fee_receipts') || show('panel.upcoming_birthdays')) && (
            <div className={`grid grid-cols-1 gap-6 ${bothLists ? 'lg:grid-cols-2' : ''}`}>
              {show('panel.recent_fee_receipts') && (
                <SectionPanel title="Recent fee receipts" description="Latest payments received">
                  {data.recent_fee_receipts.length === 0 ? (
                    <EmptyState message="No fee receipts yet today." />
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {data.recent_fee_receipts.map((row, i) => (
                        <div key={row.id ?? i} className="flex items-center justify-between py-3 text-sm">
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
              )}

              {show('panel.upcoming_birthdays') && (
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
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
