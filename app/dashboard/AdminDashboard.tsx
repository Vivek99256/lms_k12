'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck, Cake, CalendarCheck, ClipboardList, GraduationCap, Megaphone, MessageCircleWarning, ReceiptIndianRupee,
  RefreshCw, School, UserPlus, Users, Wallet, ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardAuthError, fetchAdminDashboard, getDashboardSession, type AdminDashboardSummary } from '@/app/dashboard/_lib/dashboard-api';
import {
  DashboardError, DashboardSkeleton, EmptyState, MiniStat, SectionPanel, SegmentBar, StatCard,
} from '@/app/dashboard/_components/DashboardPrimitives';
import { DashboardBarChart } from '@/app/dashboard/_components/DashboardBarChart';
import { AdminQuickActions, useHasMenuModule } from '@/app/dashboard/_components/AdminQuickActions';
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard';
import { useDashboardPreferences } from '@/app/dashboard/_lib/useDashboardPreferences';
import type { DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences';
import { fetchFeesDashboardSummary, type FeesDashboardPayload } from '@/app/fees/_lib/fees-dashboard-api';
import { friendlyError } from '@/lib/user-messages';

/** Everything on this dashboard a user can hide for themselves. Ids are stored per user — don't rename them. */
const ADMIN_WIDGETS = [
  { id: 'kpi.total_students', label: 'Total students', group: 'kpi' },
  { id: 'kpi.total_staff', label: 'Total staff', group: 'kpi' },
  { id: 'kpi.attendance_today', label: "Today's attendance", group: 'kpi' },
  { id: 'kpi.fees_collected_today', label: 'Fees collected today', group: 'kpi' },
  { id: 'kpi.total_classes', label: 'Total classes', group: 'kpi' },
  { id: 'kpi.admissions_this_year', label: 'Admissions this year', group: 'kpi' },
  { id: 'kpi.homework_today', label: 'Homework posted today', group: 'kpi' },
  { id: 'kpi.circulars_today', label: 'Circulars today', group: 'kpi' },
  { id: 'kpi.pending_parent_communications', label: 'Parent messages awaiting reply', group: 'kpi' },
  { id: 'chart.fee_collection', label: 'Fee collection (last 7 days)', group: 'chart' },
  { id: 'chart.attendance_trend', label: 'Attendance (last 7 days)', group: 'chart' },
  { id: 'chart.students_by_class', label: 'Students by class', group: 'chart' },
  { id: 'panel.quick_actions', label: 'Quick actions', group: 'panel' },
  { id: 'panel.fee_status', label: 'Fee collection this year', group: 'panel' },
  { id: 'panel.recent_fee_receipts', label: 'Recent fee receipts', group: 'panel' },
  { id: 'panel.recent_activity', label: 'Recent activity', group: 'panel' },
  { id: 'panel.upcoming_birthdays', label: 'Upcoming birthdays', group: 'panel' },
] as const satisfies readonly DashboardWidget[];

type WidgetId = (typeof ADMIN_WIDGETS)[number]['id'];

/* ---------- formatting ---------- */

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** ₹18.4L / ₹42.5K / ₹1.2Cr — for chart axes where a full figure would crowd. */
function formatCurrencyCompact(amount: number) {
  const abs = Math.abs(amount);
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, '');
  if (abs >= 1e7) return `₹${trim(amount / 1e7)}Cr`;
  if (abs >= 1e5) return `₹${trim(amount / 1e5)}L`;
  if (abs >= 1e3) return `₹${trim(amount / 1e3)}K`;
  return `₹${Math.round(amount)}`;
}

const formatPercent = (value: number) => `${Math.round(value)}%`;

/** Parses `YYYY-MM-DD[ HH:MM:SS]` as a local date; returns null for anything else. */
function parseLocalDate(value: string | null | undefined): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRelativeDay(value: string | null | undefined) {
  const date = parseLocalDate(value);
  if (!date) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
}

/** The API sends birthdays as `dd-mm-yyyy`; show just the day and month. */
function formatBirthday(dob: string) {
  const match = dob.match(/^(\d{2})-(\d{2})-\d{4}$/);
  if (!match) return dob;
  return new Date(2000, Number(match[2]) - 1, Number(match[1])).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function greeting(now: Date) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}

/** Literal class strings so Tailwind can see them. */
const KPI_GRID: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
};

const GLANCE_GRID: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
};

/* ---------- fee status (Fees module summary — gated by the user's fee rights) ---------- */

function FeeStatusPanel() {
  const [data, setData] = useState<FeesDashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const session = getDashboardSession();
    fetchFeesDashboardSummary(
      session,
      { sub_institute_id: session.subInstituteId, syear: session.academicYearId, user_id: session.userId },
      controller.signal,
    )
      .then(setData)
      .catch((err) => {
        if (!controller.signal.aborted) setError(friendlyError(err, "We couldn't load the fee summary."));
      });
    return () => controller.abort();
  }, []);

  const action = (
    <a href="/fees/dashboard" className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-[#4F46E5] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40">
      Fees dashboard <ArrowUpRight size={14} aria-hidden />
    </a>
  );

  return (
    <SectionPanel title="Fee collection this year" description="Collected against total demand" action={action}>
      {error ? (
        <p className="text-sm text-slate-500">{error}</p>
      ) : !data ? (
        <div className="space-y-3" aria-busy="true">
          <div className="h-6 w-2/3 animate-pulse rounded bg-slate-100" />
          <div className="h-2 animate-pulse rounded-full bg-slate-100" />
          <div className="h-10 animate-pulse rounded bg-slate-100" />
        </div>
      ) : data.summary.demand_amount <= 0 && data.summary.collected_amount <= 0 ? (
        <EmptyState message="No fee demand has been set up for this academic year." />
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {formatPercent(Math.min(100, data.summary.collection_rate))}
            </span>
            <span className="text-xs text-slate-500">collection rate</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="Fee collection rate"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(Math.min(100, data.summary.collection_rate))}
          >
            <div className="h-full rounded-full bg-[#4F46E5]" style={{ width: `${Math.min(100, data.summary.collection_rate)}%` }} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">Collected</dt>
              <dd className="mt-0.5 font-semibold text-slate-900 tabular-nums">{formatCurrency(data.summary.collected_amount)}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">Outstanding</dt>
              <dd className="mt-0.5 font-semibold text-slate-900 tabular-nums">{formatCurrency(data.summary.outstanding_amount)}</dd>
            </div>
          </dl>
        </>
      )}
    </SectionPanel>
  );
}

/* ---------- dashboard ---------- */

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const prefs = useDashboardPreferences('home.admin', ADMIN_WIDGETS);
  const fees = useHasMenuModule('Fees');

  const load = useCallback(
    (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      fetchAdminDashboard(getDashboardSession())
        .then((payload) => {
          setData(payload);
          setLoadedAt(new Date());
        })
        .catch((err: Error) => {
          // The stored session is gone/invalid (expired, or cleared by a
          // sign-out/timeout in another tab) — "Try again" would just hit the
          // same empty session again, so sign out properly instead.
          if (err instanceof DashboardAuthError) {
            setError('Your session has expired. Signing you out...');
            logout();
            return;
          }
          setError(err.message);
        })
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [logout],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Widgets whose data the backend did not send (older API) are treated as absent, not as zero.
  const hasAttendance = Boolean(data?.attendance_today);
  const show = useCallback(
    (id: WidgetId) => {
      if (!prefs.isVisible(id)) return false;
      if ((id === 'kpi.attendance_today' || id === 'chart.attendance_trend') && !hasAttendance) return false;
      if (id === 'panel.recent_activity' && !data?.recent_activity) return false;
      if (id === 'panel.fee_status' && !fees.has) return false;
      return true;
    },
    [prefs, hasAttendance, data?.recent_activity, fees.has],
  );

  const attendance = useMemo(() => {
    const today = data?.attendance_today;
    if (!today) return null;
    const marked = today.present + today.absent;
    return { ...today, marked, rate: marked > 0 ? (today.present / marked) * 100 : null };
  }, [data?.attendance_today]);

  const now = loadedAt ?? new Date();
  const firstName = (user?.name || '').trim().split(/\s+/)[0];
  const ready = !loading && prefs.ready && !error && data;

  /* --- primary KPI row --- */
  const kpis: React.ReactNode[] = [];
  if (data) {
    if (show('kpi.total_students'))
      kpis.push(
        <StatCard
          key="students"
          label="Total students"
          value={data.summary.total_students.toLocaleString('en-IN')}
          icon={GraduationCap}
          hint={`Enrolled this academic year · ${data.summary.total_classes} classes`}
        />,
      );
    if (show('kpi.attendance_today') && attendance)
      kpis.push(
        <StatCard
          key="attendance"
          label="Today's attendance"
          value={attendance.rate == null ? 'Not marked' : formatPercent(attendance.rate)}
          icon={CalendarCheck}
          tone={attendance.rate == null ? 'default' : attendance.rate < 75 ? 'warning' : 'positive'}
          hint={
            attendance.marked === 0
              ? 'No class has marked attendance yet today'
              : `${attendance.present.toLocaleString('en-IN')} present · ${attendance.absent.toLocaleString('en-IN')} absent · ${attendance.not_marked.toLocaleString('en-IN')} not marked`
          }
        >
          <SegmentBar
            label={`${attendance.present} present, ${attendance.absent} absent, ${attendance.not_marked} not marked`}
            segments={[
              { label: 'Present', value: attendance.present, className: 'bg-emerald-500' },
              { label: 'Absent', value: attendance.absent, className: 'bg-red-500' },
              { label: 'Not marked', value: attendance.not_marked, className: 'bg-slate-200' },
            ]}
          />
        </StatCard>,
      );
    if (show('kpi.fees_collected_today'))
      kpis.push(
        <StatCard
          key="fees"
          label="Fees collected today"
          value={formatCurrency(data.summary.fees_collected_today)}
          icon={Wallet}
          tone="positive"
          hint={`${formatCurrencyCompact(data.fee_collection_trend.reduce((sum, row) => sum + row.amount, 0))} in the last 7 days`}
        />,
      );
    if (show('kpi.total_staff'))
      kpis.push(
        <StatCard key="staff" label="Total staff" value={data.summary.total_staff.toLocaleString('en-IN')} icon={Users} hint="Active user accounts" />,
      );
  }

  /* --- secondary "at a glance" strip --- */
  const glance: React.ReactNode[] = [];
  if (data) {
    if (show('kpi.total_classes')) glance.push(<MiniStat key="classes" label="Classes" value={data.summary.total_classes} icon={School} />);
    if (show('kpi.admissions_this_year'))
      glance.push(<MiniStat key="admissions" label="Admission enquiries this year" value={data.summary.admissions_this_year} icon={UserPlus} />);
    if (show('kpi.homework_today')) glance.push(<MiniStat key="homework" label="Homework posted today" value={data.summary.homework_today} icon={BookOpenCheck} />);
    if (show('kpi.circulars_today')) glance.push(<MiniStat key="circulars" label="Circulars today" value={data.summary.circulars_today} icon={Megaphone} />);
    if (show('kpi.pending_parent_communications'))
      glance.push(
        <MiniStat
          key="parents"
          label="Parent messages awaiting reply"
          value={data.summary.pending_parent_communications}
          icon={MessageCircleWarning}
          tone={data.summary.pending_parent_communications > 0 ? 'warning' : 'default'}
        />,
      );
  }

  /* --- main column --- */
  const main: React.ReactNode[] = [];
  const side: React.ReactNode[] = [];
  if (data) {
    const trendCharts: React.ReactNode[] = [];
    if (show('chart.fee_collection'))
      trendCharts.push(
        <SectionPanel key="fee-trend" title="Fee collection" description="Last 7 days, all fee types">
          {data.fee_collection_trend.every((row) => row.amount === 0) ? (
            <EmptyState icon={ReceiptIndianRupee} message="No fee collections in the last 7 days." />
          ) : (
            <DashboardBarChart
              label="Collected"
              labels={data.fee_collection_trend.map((row) => row.label)}
              values={data.fee_collection_trend.map((row) => row.amount)}
              formatValue={formatCurrencyCompact}
              height={220}
            />
          )}
        </SectionPanel>,
      );
    if (show('chart.attendance_trend') && data.attendance_trend)
      trendCharts.push(
        <SectionPanel key="attendance-trend" title="Attendance" description="Students present, last 7 days">
          {data.attendance_trend.every((row) => row.rate == null) ? (
            <EmptyState icon={CalendarCheck} message="No attendance was marked in the last 7 days." />
          ) : (
            <DashboardBarChart
              label="Present"
              labels={data.attendance_trend.map((row) => row.label)}
              values={data.attendance_trend.map((row) => row.rate)}
              formatValue={formatPercent}
              max={100}
              height={220}
            />
          )}
        </SectionPanel>,
      );
    if (trendCharts.length > 0)
      main.push(
        <div key="trends" className={`grid grid-cols-1 gap-4 ${trendCharts.length === 2 ? 'xl:grid-cols-2' : ''}`}>
          {trendCharts}
        </div>,
      );

    if (show('chart.students_by_class'))
      main.push(
        <SectionPanel key="by-class" title="Students by class" description="Current enrollment distribution">
          {data.students_by_class.length === 0 ? (
            <EmptyState icon={GraduationCap} message="No enrollment data yet." />
          ) : (
            <DashboardBarChart
              label="Students"
              labels={data.students_by_class.map((row) => row.standard_name)}
              values={data.students_by_class.map((row) => Number(row.students))}
              height={240}
            />
          )}
        </SectionPanel>,
      );

    if (show('panel.recent_fee_receipts'))
      main.push(
        <SectionPanel key="receipts" title="Recent fee receipts" description="Latest payments received" flush>
          {data.recent_fee_receipts.length === 0 ? (
            <div className="px-5 pb-3">
              <EmptyState icon={ReceiptIndianRupee} message="No fee receipts yet this academic year." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th scope="col" className="px-5 py-2">Student</th>
                    <th scope="col" className="px-3 py-2">Receipt</th>
                    <th scope="col" className="hidden px-3 py-2 sm:table-cell">Date</th>
                    <th scope="col" className="px-5 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recent_fee_receipts.map((row, i) => (
                    <tr key={row.id ?? i} className="hover:bg-slate-50/60">
                      <td className="max-w-[220px] truncate px-5 py-2.5 font-medium text-slate-900">{row.student_name}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{row.receipt_no}</td>
                      <td className="hidden px-3 py-2.5 text-slate-500 sm:table-cell">{formatRelativeDay(row.receiptdate)}</td>
                      <td className="px-5 py-2.5 text-right font-medium text-slate-900 tabular-nums">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionPanel>,
      );

    /* --- side column --- */
    if (show('panel.quick_actions'))
      side.push(
        <SectionPanel key="quick" title="Quick actions" description="Shortcuts to frequent tasks">
          <AdminQuickActions />
        </SectionPanel>,
      );

    if (show('panel.fee_status')) side.push(<FeeStatusPanel key="fee-status" />);

    if (show('panel.recent_activity') && data.recent_activity)
      side.push(
        <SectionPanel key="activity" title="Recent activity" description="Circulars and admission enquiries">
          {data.recent_activity.length === 0 ? (
            <EmptyState message="Nothing new this academic year." />
          ) : (
            <ol className="space-y-3">
              {data.recent_activity.map((item) => {
                const isCircular = item.type === 'circular';
                const Icon = isCircular ? Megaphone : ClipboardList;
                return (
                  <li key={`${item.type}-${item.id}`} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <Icon size={14} strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900" title={item.title}>
                        {item.title || (isCircular ? 'Untitled circular' : 'Unnamed applicant')}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {isCircular ? 'Circular published' : 'Admission enquiry'}
                        {item.detail && (
                          <>
                            {' · '}
                            <span className="font-mono">{item.detail}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{formatRelativeDay(item.occurred_at)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </SectionPanel>,
      );

    if (show('panel.upcoming_birthdays'))
      side.push(
        <SectionPanel key="birthdays" title="Upcoming birthdays" description="Students in the next 7 days">
          {data.upcoming_birthdays.length === 0 ? (
            <EmptyState icon={Cake} message="No student birthdays in the next 7 days." />
          ) : (
            <ul className="space-y-3">
              {data.upcoming_birthdays.map((row, i) => (
                <li key={`${row.student_name}-${i}`} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-[#4F46E5]" aria-hidden>
                    {initials(row.student_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{row.student_name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {row.standard_name} – {row.division_name}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{formatBirthday(row.dob)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>,
      );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] flex-1 px-1 pb-6 sm:px-2">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">
            {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="mt-0.5 truncate text-2xl font-semibold tracking-tight text-slate-900">
            {greeting(now)}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">Here&apos;s today&apos;s overview across the school.</p>
        </div>
        <div className="flex items-center gap-2">
          {loadedAt && (
            <span className="hidden text-xs text-slate-400 sm:inline">
              Updated {loadedAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={() => load('refresh')}
            disabled={loading || refreshing}
            aria-label="Refresh dashboard"
            title="Refresh"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-xs outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#4F46E5]/40 disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden />
          </button>
          {prefs.ready && <CustomizeDashboard widgets={ADMIN_WIDGETS} {...prefs.customizeProps} />}
        </div>
      </header>

      {/* Wait for the user's layout too, so hidden widgets never flash in. */}
      {(loading || !prefs.ready) && <DashboardSkeleton />}
      {!loading && prefs.ready && error && <DashboardError message={error} onRetry={() => load()} />}

      {ready && !prefs.hasVisible() && <AllWidgetsHiddenNotice />}

      {ready && (
        <div className="space-y-4">
          {kpis.length > 0 && <div className={`grid gap-4 ${KPI_GRID[kpis.length]}`}>{kpis}</div>}

          {glance.length > 0 && (
            <section aria-label="Today at a glance" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {/* 1px gaps over a tinted background draw the dividers, so they stay right however the grid wraps. */}
              <div className={`grid gap-px bg-slate-100 ${GLANCE_GRID[glance.length]} [&>*]:bg-white`}>{glance}</div>
            </section>
          )}

          {(main.length > 0 || side.length > 0) && (
            <div className={`grid grid-cols-1 items-start gap-4 ${main.length > 0 && side.length > 0 ? 'lg:grid-cols-3' : ''}`}>
              {main.length > 0 && <div className={`min-w-0 space-y-4 ${side.length > 0 ? 'lg:col-span-2' : ''}`}>{main}</div>}
              {side.length > 0 && (
                <div className={`min-w-0 ${main.length > 0 ? 'space-y-4' : 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'}`}>{side}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
