'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight, BookOpen, CalendarCheck, CalendarClock, Cake, ClipboardCheck, ClipboardList, DoorOpen, Download, FileText, Filter, GraduationCap,
  History, Inbox, LineChart, ListChecks, Megaphone, MessageCircleWarning, MessageSquareText, Package, PenLine, Phone, PieChart, Printer,
  ReceiptIndianRupee, RefreshCw, RotateCcw, ShieldCheck, Store, TriangleAlert, Trophy, UserMinus, UserRoundX, UserX, Users, Wallet, Zap, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DashboardAuthError, fetchRoleWorkspace, fetchWorkspaceFees, getDashboardSession,
  type RoleWorkspaceSummary, type RoleWorkspaceWidgets, type WorkspaceFees, type WorkspaceListItem, type WorkspacePeriod,
} from '@/app/dashboard/_lib/dashboard-api';
import {
  AreaChart, AttentionBar, BarList, Delta, Donut, EmptyNote, Funnel, Hero, HeroStat, Legend, Panel, Pill, PremiumSkeleton, RateBars, RowList,
  Segmented, StatStrip, SURFACE, type AttentionItem, type Row, type Tone,
} from '@/app/dashboard/_components/PremiumKit';
import { DashboardError } from '@/app/dashboard/_components/DashboardPrimitives';
import {
  AlertLimit, HomeworkPanel, HostelPanel, MovablePanel, ParentWaitPanel, StrengthPanel, StudentFinder, TaskAgePanel, TransportPanel, usePanelOrder,
} from '@/app/dashboard/_components/WorkspaceExtras';
import { useRegisterPageAiContext } from '@/contexts/PageAiContext';
import { RoleQuickActions, type QuickActionId } from '@/app/dashboard/_components/RoleQuickActions';
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard';
import { useDrill } from '@/app/dashboard/_components/useDrill';
import { useDashboardPreferences } from '@/app/dashboard/_lib/useDashboardPreferences';
import type { DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences';
import { fetchLibraryDashboardSummary, type LibraryDashboardPayload } from '@/app/library/_lib/library-dashboard-api';
import { friendlyError } from '@/lib/user-messages';

/*
 * One dashboard per role, driven by data:
 *   KPIS / LISTS  — every figure and list a role dashboard can show, and how to read it.
 *   ROLE_LAYOUTS  — which of them each role gets, in what order, plus its shortcuts.
 * The server decides which role the caller is and sends only that role's figures
 * (RoleWorkspaceApiController), so a layout can never reveal data the role may not read.
 * A figure the server could not compute is null and is simply not drawn — never shown as 0.
 * Clicking a figure opens the screen behind it, but only if that screen is in the user's own menu.
 */

/* ---------- formatting ---------- */

const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function formatCurrencyCompact(amount: number) {
  const abs = Math.abs(amount);
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, '');
  if (abs >= 1e7) return `₹${trim(amount / 1e7)}Cr`;
  if (abs >= 1e5) return `₹${trim(amount / 1e5)}L`;
  if (abs >= 1e3) return `₹${trim(amount / 1e3)}K`;
  return `₹${Math.round(amount)}`;
}

const formatPercent = (value: number) => `${Math.round(value)}%`;
const num = (n: number) => n.toLocaleString('en-IN');

function parseLocalDate(value: string | null | undefined): Date | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Today" / "Tomorrow" / "Yesterday" / "12 Oct" — works for past and future dates. */
function formatRelativeDay(value: string | null | undefined) {
  const date = parseLocalDate(value);
  if (!date) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
}

function greeting(now: Date) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const shortDate = (iso: string) => parseLocalDate(iso)?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) ?? iso;

const PERIOD_NAME: Record<WorkspacePeriod, string> = { today: 'today', week: 'this week', month: 'this month', year: 'this year' };

/* ---------- figures ---------- */

type DeltaInfo = { direction: 'up' | 'down' | 'flat'; tone: Tone; text: string };

type Figure = {
  value: string;
  context?: string;
  delta?: DeltaInfo;
  spark?: Array<number | null>;
  sparkLabel?: string;
} | null;

type KpiDef = {
  label: string;
  icon: LucideIcon;
  /** Screens (menu names) this figure opens when clicked. */
  drill?: readonly string[];
  /** A label that follows the chosen period, e.g. "Fees collected this week". */
  title?: (w: RoleWorkspaceWidgets, p: WorkspacePeriod) => string;
  figure: (w: RoleWorkspaceWidgets, p: WorkspacePeriod) => Figure;
};

const last7 = <T,>(a: T[] | null | undefined) => (a ?? []).slice(-7);

/** Change against the previous period of the same length. `up` is good unless `lowerIsBetter`. */
function versus(current: number, previous: number, previousName: string, format: (n: number) => string): DeltaInfo | undefined {
  if (previous <= 0) return current > 0 ? { direction: 'up', tone: 'neutral', text: `New — none ${previousName}` } : undefined;
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 1) return { direction: 'flat', tone: 'neutral', text: `Same as ${previousName}` };
  return { direction: pct > 0 ? 'up' : 'down', tone: pct > 0 ? 'good' : 'watch', text: `${Math.abs(Math.round(pct))}% vs ${previousName} (${format(previous)})` };
}

const PREVIOUS_NAME: Record<WorkspacePeriod, string> = { today: 'yesterday', week: 'last week', month: 'last month', year: 'last year' };

const KPIS = {
  students_total: {
    label: 'Total students', icon: GraduationCap, drill: ['search/edit student'],
    figure: (w) => (w.students_total == null ? null : { value: num(w.students_total), context: 'Enrolled this academic year' }),
  },
  staff_total: {
    label: 'Total staff', icon: Users, drill: ['user master'],
    figure: (w) => (w.staff_total == null ? null : { value: num(w.staff_total), context: 'Active staff accounts' }),
  },
  attendance_today: {
    label: "Today's attendance", icon: CalendarCheck, drill: ['student attendance'],
    figure: (w) => {
      const a = w.attendance_today;
      if (!a) return null;
      const marked = a.present + a.absent;
      const rates = last7(w.attendance_trend).map((r) => r.rate);
      const earlier = rates.slice(0, -1).filter((r): r is number => r != null);
      const rate = marked > 0 ? (a.present / marked) * 100 : null;
      let delta: DeltaInfo | undefined;
      if (rate != null && earlier.length > 0) {
        const diff = rate - earlier[earlier.length - 1];
        delta = Math.abs(diff) < 0.5
          ? { direction: 'flat', tone: 'neutral', text: 'Same as last marked day' }
          : { direction: diff > 0 ? 'up' : 'down', tone: diff > 0 ? 'good' : 'act', text: `${Math.abs(diff).toFixed(1)} pts vs last marked day` };
      }
      return {
        value: rate == null ? 'Not marked' : formatPercent(rate),
        context: rate == null ? 'No class has marked attendance yet' : `${num(a.present)} present · ${num(a.absent)} absent`,
        delta,
        spark: rates,
        sparkLabel: 'Attendance rate, last 7 days',
      };
    },
  },
  staff_on_leave_today: {
    label: 'Staff on leave today', icon: UserMinus, drill: ['leave application'],
    figure: (w) => (w.staff_on_leave_today == null ? null : { value: num(w.staff_on_leave_today), context: 'Approved leave covering today' }),
  },
  leaves_pending: {
    label: 'Leave requests pending', icon: CalendarClock, drill: ['leave application'],
    figure: (w) => (w.leaves_pending == null ? null : { value: num(w.leaves_pending), context: 'Waiting for a decision' }),
  },
  my_leaves_pending: {
    label: 'My leave requests', icon: CalendarClock, drill: ['leave application'],
    figure: (w) => (w.my_leaves_pending == null ? null : { value: num(w.my_leaves_pending), context: 'Pending approval' }),
  },
  fees_today: {
    label: 'Fees collected', icon: Wallet, drill: ['fees collection report', 'fees collect'],
    title: (_w, p) => `Fees collected ${PERIOD_NAME[p]}`,
    figure: (w, p) => {
      if (w.fees_today == null && !w.fees_period) return null;
      const fp = w.fees_period;
      if (p !== 'today' && fp) {
        return { value: formatCurrency(fp.amount), delta: versus(fp.amount, fp.previous, PREVIOUS_NAME[p], formatCurrencyCompact), context: fp.previous > 0 ? undefined : `Nothing ${PREVIOUS_NAME[p]}` };
      }
      const today = w.fees_today ?? fp?.amount ?? 0;
      const trend = last7(w.fee_trend);
      const earlier = trend.slice(0, -1);
      const avg = earlier.length > 0 ? earlier.reduce((s, r) => s + r.amount, 0) / earlier.length : 0;
      let delta: DeltaInfo | undefined;
      if (avg > 0) {
        const pct = ((today - avg) / avg) * 100;
        delta = Math.abs(pct) < 1
          ? { direction: 'flat', tone: 'neutral', text: 'In line with 6-day average' }
          : { direction: pct > 0 ? 'up' : 'down', tone: pct > 0 ? 'good' : 'watch', text: `${Math.abs(Math.round(pct))}% vs 6-day average` };
      } else if (fp && fp.previous > 0) {
        delta = versus(today, fp.previous, 'yesterday', formatCurrencyCompact);
      }
      const week = trend.reduce((s, r) => s + r.amount, 0);
      return {
        value: formatCurrency(today),
        context: delta ? undefined : trend.length > 0 ? `${formatCurrencyCompact(week)} in the last 7 days` : today > 0 ? 'Collected so far today' : 'Nothing collected yet today',
        delta,
        spark: trend.map((r) => r.amount),
        sparkLabel: 'Fees collected, last 7 days',
      };
    },
  },
  admissions_year: {
    label: 'Admission enquiries', icon: ClipboardList, drill: ['admission inquiry'],
    title: (_w, p) => (p === 'today' ? 'Admission enquiries' : `Enquiries ${PERIOD_NAME[p]}`),
    figure: (w, p) => {
      const ap = w.admissions_period;
      if (p !== 'today' && ap) return { value: num(ap.count), delta: versus(ap.count, ap.previous, PREVIOUS_NAME[p], num) };
      return w.admissions_year == null ? null : { value: num(w.admissions_year), context: 'This academic year' };
    },
  },
  parent_msgs_pending: {
    label: 'Parent messages awaiting reply', icon: MessageCircleWarning, drill: ['parent communication'],
    figure: (w) => (w.parent_msgs_pending == null ? null : { value: num(w.parent_msgs_pending) }),
  },
  visitors_today: {
    label: 'Visitors today', icon: DoorOpen, drill: ['add visitor', 'visitor report'],
    title: (_w, p) => `Visitors ${PERIOD_NAME[p]}`,
    figure: (w, p) => {
      const vp = w.visitors_period;
      if (p !== 'today' && vp) return { value: num(vp.count), delta: versus(vp.count, vp.previous, PREVIOUS_NAME[p], num) };
      return w.visitors_today == null ? null : { value: num(w.visitors_today.total), context: `${w.visitors_today.inside} not signed out yet` };
    },
  },
  complaints: {
    label: 'Open complaints', icon: TriangleAlert, drill: ['complaint management'],
    figure: (w) => (w.complaints == null ? null : { value: num(w.complaints.open), context: `${num(w.complaints.total)} logged in total` }),
  },
  tasks_pending_all: {
    label: 'Open tasks', icon: ListChecks, drill: ['task management'],
    figure: (w) => (w.tasks_pending_all == null ? null : { value: num(w.tasks_pending_all), context: 'Pending or in progress' }),
  },
  tasks_pending_me: {
    label: 'My open tasks', icon: ListChecks, drill: ['task management'],
    figure: (w) => (w.tasks_pending_me == null ? null : { value: num(w.tasks_pending_me.count), context: 'Assigned to you' }),
  },
  inward_month: {
    label: 'Inward this month', icon: Inbox, drill: ['add inward'],
    figure: (w) => (w.inward_month == null ? null : { value: num(w.inward_month) }),
  },
  outward_month: {
    label: 'Outward this month', icon: Inbox, drill: ['add outward'],
    figure: (w) => (w.outward_month == null ? null : { value: num(w.outward_month) }),
  },
  petty_cash_month: {
    label: 'Petty cash this month', icon: Wallet, drill: ['petty cash'],
    figure: (w) => (w.petty_cash_month == null ? null : { value: formatCurrency(w.petty_cash_month) }),
  },
  requisitions: {
    label: 'Requisitions pending', icon: FileText, drill: ['requisition form approved', 'requisition form'],
    figure: (w) => {
      const r = w.requisitions;
      return r ? { value: num(r.pending), context: `${r.approved} approved · ${r.on_hold} on hold · ${r.rejected} rejected` } : null;
    },
  },
  po_status: {
    label: 'Purchase orders awaiting decision', icon: Package, drill: ['generat po'],
    figure: (w) => (w.po_status == null ? null : { value: num(w.po_status.awaiting), context: `${w.po_status.decided} decided` }),
  },
  items_total: {
    label: 'Inventory items', icon: Store, drill: ['inventory item master'],
    figure: (w) => (w.items_total == null ? null : { value: num(w.items_total) }),
  },
  vendors_total: {
    label: 'Vendors', icon: Users, drill: ['vendor master'],
    figure: (w) => (w.vendors_total == null ? null : { value: num(w.vendors_total) }),
  },
  purchases_month: {
    label: 'Direct purchases this month', icon: ReceiptIndianRupee, drill: ['item direct purchase'],
    figure: (w) => (w.purchases_month == null ? null : { value: formatCurrency(w.purchases_month.amount), context: `${w.purchases_month.count} purchase(s)` }),
  },
  upcoming_exams: {
    label: 'Upcoming exams', icon: CalendarClock, drill: ['exam schedule'],
    figure: (w) => (w.upcoming_exams == null ? null : { value: num(w.upcoming_exams.count), context: 'Scheduled from today onwards' }),
  },
  exam_evaluation: {
    label: 'Answer sheets evaluated', icon: PenLine, drill: ['mark entry'],
    figure: (w) => {
      const e = w.exam_evaluation;
      return e ? { value: `${num(e.evaluated)} / ${num(e.sheets)}`, context: `${e.batches} batch(es) · ${e.approved} approved` } : null;
    },
  },
} as const satisfies Record<string, KpiDef>;

type KpiKey = keyof typeof KPIS;

type ChartKey =
  | 'attendance_trend' | 'fee_trend' | 'fees_overview' | 'class_attendance' | 'fees_month' | 'admission_funnel' | 'exam_results' | 'gender_split' | 'students_by_class'
  | 'parent_msg_age' | 'task_aging' | 'homework_rate' | 'strength_changes' | 'transport_summary' | 'hostel_summary';

const CHART_LABEL: Record<ChartKey, string> = {
  attendance_trend: 'Attendance trend',
  fee_trend: 'Fee collection trend',
  fees_overview: 'Fees: collected vs outstanding',
  class_attendance: 'Attendance by class',
  fees_month: 'Fees this month vs last month',
  admission_funnel: 'Admission pipeline',
  exam_results: 'Exam results by class',
  gender_split: 'Gender split',
  students_by_class: 'Students by class',
  parent_msg_age: 'Parent messages: waiting time',
  task_aging: 'Open tasks: age',
  homework_rate: 'Homework completion',
  strength_changes: 'Student strength changes',
  transport_summary: 'Transport',
  hostel_summary: 'Hostel',
};

type ListKey =
  | 'recent_circulars' | 'recent_enquiries' | 'recent_parent_messages' | 'my_tasks' | 'upcoming_exams_list' | 'recent_requisitions' | 'recent_fee_receipts'
  | 'pending_approvals' | 'absent_today' | 'staff_on_leave' | 'birthdays' | 'upcoming_events' | 'followups_due' | 'library_overdue' | 'stock_reorder'
  | 'chronic_absentees' | 'substitutes_needed';

type ListDef = {
  label: string; title: string; description: string | ((w: RoleWorkspaceWidgets) => string); icon: LucideIcon; empty: string;
  rows: (w: RoleWorkspaceWidgets) => Row[] | null;
};

const dated = (items: WorkspaceListItem[] | null | undefined): Row[] | null =>
  items == null ? null : items.map((i) => ({ id: i.id, title: i.title, detail: i.detail, trailing: formatRelativeDay(i.date) }));

const callLink = (phone: string | null | undefined) =>
  phone ? (
    <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50" onClick={(e) => e.stopPropagation()}>
      <Phone size={11} aria-hidden /> Call
    </a>
  ) : undefined;

const LISTS: Record<ListKey, ListDef> = {
  recent_circulars: {
    label: 'Recent circulars', title: 'Recent circulars', description: 'Latest notices sent out', icon: Megaphone,
    empty: 'No circulars this academic year.', rows: (w) => dated(w.recent_circulars),
  },
  recent_enquiries: {
    label: 'Recent admission enquiries', title: 'Recent enquiries', description: 'Newest admission enquiries', icon: ClipboardList,
    empty: 'No admission enquiries this academic year.', rows: (w) => dated(w.recent_enquiries),
  },
  recent_parent_messages: {
    label: 'Parent messages', title: 'Parent messages', description: 'Latest messages from parents', icon: MessageSquareText,
    empty: 'No parent messages yet.',
    rows: (w) => (w.recent_parent_messages == null ? null : w.recent_parent_messages.map((i) => ({
      id: i.id, title: i.title, detail: i.detail, trailing: formatRelativeDay(i.date),
      badge: i.done ? { tone: 'good' as Tone, text: 'Replied' } : { tone: 'watch' as Tone, text: 'Awaiting reply' },
    }))),
  },
  my_tasks: {
    label: 'My tasks', title: 'My open tasks', description: 'Pending or in progress, assigned to you', icon: ListChecks,
    empty: 'Nothing is assigned to you right now.',
    rows: (w) => (w.tasks_pending_me == null ? null : w.tasks_pending_me.items.map((i) => ({
      id: i.id, title: i.title, trailing: formatRelativeDay(i.date),
      badge: { tone: (i.detail === 'IN-PROGRESS' ? 'brand' : 'watch') as Tone, text: i.detail === 'IN-PROGRESS' ? 'In progress' : 'Pending' },
    }))),
  },
  upcoming_exams_list: {
    label: 'Upcoming exams', title: 'Upcoming exams', description: 'Next scheduled exams', icon: CalendarClock,
    empty: 'No exams are scheduled from today onwards.', rows: (w) => dated(w.upcoming_exams?.items),
  },
  recent_requisitions: {
    label: 'Recent requisitions', title: 'Recent requisitions', description: 'Latest requests for stock', icon: FileText,
    empty: 'No requisitions this academic year.', rows: (w) => dated(w.recent_requisitions),
  },
  recent_fee_receipts: {
    label: 'Recent fee receipts', title: 'Recent fee receipts', description: 'Latest payments received', icon: ReceiptIndianRupee,
    empty: 'No fee receipts yet this academic year.',
    rows: (w) => (w.recent_fee_receipts == null ? null : w.recent_fee_receipts.map((r) => ({
      id: r.id, title: r.student_name, detail: `Receipt ${r.receipt_no}`, trailing: formatRelativeDay(r.date),
      badge: { tone: 'neutral' as Tone, text: formatCurrency(r.amount) },
    }))),
  },
  pending_approvals: {
    label: 'Waiting for your decision', title: 'Waiting for your decision', icon: ShieldCheck,
    description: (w) => (w.pending_approvals ? `${num(w.pending_approvals.total)} item(s) across leave, requisitions and purchase orders` : 'Leave, requisitions and purchase orders'),
    empty: 'Nothing is waiting.',
    rows: (w) => {
      const p = w.pending_approvals;
      if (!p) return null;
      const row = (id: string, title: string, n: number): Row => ({ id, title, detail: n > 0 ? 'Waiting for a decision' : 'All clear', badge: { tone: n > 0 ? 'watch' : 'good', text: String(n) } });
      return [row('leaves', 'Leave requests', p.leaves), row('req', 'Requisitions', p.requisitions), row('po', 'Purchase orders', p.purchase_orders)];
    },
  },
  absent_today: {
    label: 'Absent students', title: 'Absent students', icon: UserX,
    description: (w) => (w.absent_today?.date ? `${num(w.absent_today.total)} absent · ${formatRelativeDay(w.absent_today.date)}` : 'Marked absent on the latest attendance day'),
    empty: 'No student is marked absent.',
    rows: (w) => (w.absent_today == null ? null : w.absent_today.items.map((i) => ({
      id: i.id, title: i.name, detail: [i.class_name, i.phone].filter(Boolean).join(' · '), trailing: callLink(i.phone),
    }))),
  },
  chronic_absentees: {
    label: 'Repeated absence', title: 'Repeated absence', icon: UserRoundX,
    description: (w) => (w.chronic_absentees ? `${num(w.chronic_absentees.total)} student(s) absent ${w.chronic_absentees.threshold}+ of the last ${w.chronic_absentees.days} marked days` : 'Absent most of the last 10 marked days'),
    empty: 'No student has been absent on 5 or more of the last 10 marked days.',
    rows: (w) => (w.chronic_absentees == null ? null : w.chronic_absentees.items.map((i) => ({
      id: i.id, title: i.name, detail: [i.class_name, i.phone].filter(Boolean).join(' · '), trailing: callLink(i.phone),
      badge: { tone: (i.absences >= 8 ? 'act' : 'watch') as Tone, text: `${i.absences} of ${w.chronic_absentees?.days ?? 10} days` },
    }))),
  },
  substitutes_needed: {
    label: 'Substitutes needed', title: 'Substitutes needed today', icon: UserMinus,
    description: (w) => (w.substitutes_needed ? `${num(w.substitutes_needed.uncovered)} of ${num(w.substitutes_needed.periods)} period(s) without a proxy` : 'Periods of teachers on leave'),
    empty: 'Every period of a teacher on leave is covered.',
    rows: (w) => (w.substitutes_needed == null ? null : w.substitutes_needed.items.map((i) => ({ id: i.id, title: i.title, detail: i.detail, badge: { tone: 'act' as Tone, text: 'No proxy' } }))),
  },
  staff_on_leave: {
    label: 'Staff on leave', title: 'Staff on leave today', icon: UserMinus,
    description: (w) => (w.staff_on_leave_list ? `${num(w.staff_on_leave_list.total)} on approved leave` : 'Approved leave covering today'),
    empty: 'Nobody is on approved leave today.',
    rows: (w) => (w.staff_on_leave_list == null ? null : w.staff_on_leave_list.items.map((i) => ({ id: i.id, title: i.name, detail: `Back after ${formatRelativeDay(i.until)}`.replace('Back after Today', 'Last day today') }))),
  },
  birthdays: {
    label: 'Birthdays', title: 'Birthdays this week', icon: Cake, description: 'Students and staff, next 7 days',
    empty: 'No birthdays in the next 7 days.',
    rows: (w) => {
      const b = w.birthdays;
      if (!b) return null;
      const pack = (kind: string, list: typeof b.students): Row[] => list.map((i) => ({
        id: `${kind}-${i.id}`, title: i.name, detail: kind, trailing: i.in_days === 0 ? undefined : i.in_days === 1 ? 'Tomorrow' : shortDate(i.date),
        badge: i.in_days === 0 ? { tone: 'brand' as Tone, text: 'Today' } : undefined,
      }));
      return [...pack('Student', b.students), ...pack('Staff', b.staff)].slice(0, 10);
    },
  },
  upcoming_events: {
    label: 'Calendar', title: 'Coming up', icon: CalendarClock, description: 'School events and holidays',
    empty: 'No events or holidays are scheduled.',
    rows: (w) => (w.upcoming_events == null ? null : w.upcoming_events.map((e) => ({
      id: e.id, title: e.title, detail: e.kind, trailing: formatRelativeDay(e.date),
      badge: e.kind === 'Holiday' ? { tone: 'good' as Tone, text: 'Holiday' } : undefined,
    }))),
  },
  followups_due: {
    label: 'Enquiry follow-ups due', title: 'Follow-ups due', icon: Phone,
    description: (w) => (w.followups_due ? `${num(w.followups_due.total)} enquiries to call, not yet registered` : 'Enquiries to call'),
    empty: 'No follow-ups are due.',
    rows: (w) => (w.followups_due == null ? null : w.followups_due.items.map((i) => {
      const overdue = (parseLocalDate(i.date)?.getTime() ?? 0) < new Date().setHours(0, 0, 0, 0);
      return { id: i.id, title: i.name, detail: [i.detail, i.phone].filter(Boolean).join(' · '), trailing: callLink(i.phone), badge: { tone: (overdue ? 'act' : 'watch') as Tone, text: overdue ? 'Overdue' : 'Due today' } };
    })),
  },
  library_overdue: {
    label: 'Overdue books', title: 'Overdue books', icon: BookOpen,
    description: (w) => (w.library_overdue ? `${num(w.library_overdue.total)} not returned after the due date` : 'Not returned after the due date'),
    empty: 'No book is overdue.',
    rows: (w) => (w.library_overdue == null ? null : w.library_overdue.items.map((i) => ({
      id: i.id, title: i.title, detail: i.detail, badge: { tone: (i.days > 30 ? 'act' : 'watch') as Tone, text: `${i.days} days late` },
    }))),
  },
  stock_reorder: {
    label: 'Reorder level', title: 'At or below reorder level', icon: Package,
    description: 'Recorded stock vs reorder level — no running balance is kept',
    empty: 'No item is at or below its reorder level.',
    rows: (w) => (w.stock_reorder == null ? null : w.stock_reorder.items.map((i) => ({
      id: i.id, title: i.title, detail: `Recorded ${num(i.recorded)} · reorder at ${num(i.reorder_at)}`, badge: { tone: 'watch' as Tone, text: 'Check stock' },
    }))),
  },
};

/* ---------- what needs a person, and the one-line read of the day ---------- */

type AttentionDef = { key: string; icon: LucideIcon; count: number; display?: string; text: string; tone: Tone; drill?: readonly string[] };

const DEFAULT_ATTENDANCE_TARGET = 85;

/** Built only from figures the server sent for this role, so a role never sees another's alerts. */
function attentionFor(w: RoleWorkspaceWidgets, target: number): AttentionDef[] {
  const out: AttentionDef[] = [];
  const add = (key: string, icon: LucideIcon, count: number | null | undefined, text: string, tone: Tone, drill?: readonly string[]) => {
    if (count && count > 0) out.push({ key, icon, count, text, tone, drill });
  };
  const a = w.attendance_today;
  if (a && a.present + a.absent > 0) {
    const rate = (a.present / (a.present + a.absent)) * 100;
    if (rate < target) out.push({ key: 'lowrate', icon: CalendarCheck, count: Math.round(rate), display: formatPercent(rate), text: `attendance today — below your ${target}% limit`, tone: 'act', drill: ['student attendance'] });
  }
  add('complaints', TriangleAlert, w.complaints?.open, 'complaints are still open', 'act', ['complaint management']);
  const lowClasses = w.class_attendance?.rows.filter((r) => r.rate != null && r.rate < 75).length;
  add('lowclass', CalendarCheck, lowClasses, 'classes are below 75% attendance', 'act', ['student attendance']);
  add('substitutes', UserMinus, w.substitutes_needed?.uncovered, 'periods have no substitute today', 'act', ['proxy management']);
  add('chronic', UserRoundX, w.chronic_absentees?.total, 'students keep missing school', 'act', ['student attendance']);
  add('library', BookOpen, w.library_overdue?.total, 'books are overdue', 'act', ['issue/overdue report']);
  add('waiting', MessageCircleWarning, w.parent_msg_age?.gt7, 'parent messages have waited over a week', 'act', ['parent communication']);
  add('oldtasks', ListChecks, w.task_aging?.gt30, 'tasks have been open over 30 days', 'watch', ['task management']);
  add('followups', Phone, w.followups_due?.total, 'enquiry follow-ups are due', 'watch', ['admission inquiry']);
  add('parent', MessageCircleWarning, w.parent_msgs_pending, 'parent messages are waiting for a reply', 'watch', ['parent communication']);
  add('leaves', CalendarClock, w.leaves_pending, 'leave requests need a decision', 'watch', ['leave application']);
  add('requisitions', FileText, w.requisitions?.pending, 'requisitions are pending approval', 'watch', ['requisition form approved', 'requisition form']);
  add('po', Package, w.po_status?.awaiting, 'purchase orders await a decision', 'watch', ['generat po']);
  add('stock', Package, w.stock_reorder?.total, 'items are at their reorder level', 'watch', ['inventory item master']);
  add('visitors', DoorOpen, w.visitors_today?.inside, 'visitors have not signed out', 'watch', ['add visitor']);
  add('tasks', ListChecks, w.tasks_pending_me?.count, 'tasks are assigned to you', 'watch', ['task management']);
  if (a && a.present + a.absent > 0) add('attendance', CalendarCheck, a.not_marked, 'students have no attendance marked yet', 'watch', ['student attendance']);

  return out.slice(0, 6);
}

/** A sentence built only from figures that are present — nothing is guessed. */
function insightFor(w: RoleWorkspaceWidgets, fallback: string): string {
  const parts: string[] = [];
  const a = w.attendance_today;
  if (a) {
    const marked = a.present + a.absent;
    parts.push(marked > 0 ? `Attendance is ${formatPercent((a.present / marked) * 100)} across ${num(marked)} students marked today.` : 'No class has marked attendance yet today.');
  }
  if (w.fees_today != null) parts.push(w.fees_today > 0 ? `${formatCurrency(w.fees_today)} collected in fees so far.` : 'No fees collected yet today.');
  if (w.requisitions) parts.push(`${w.requisitions.pending} requisition(s) waiting for approval.`);
  if (w.library_overdue && parts.length < 2) parts.push(`${w.library_overdue.total} book(s) overdue.`);
  if (w.tasks_pending_me && parts.length < 2) parts.push(w.tasks_pending_me.count > 0 ? `You have ${w.tasks_pending_me.count} open task(s).` : 'You have no open tasks.');

  return parts.length > 0 ? parts.slice(0, 2).join(' ') : fallback;
}

/* ---------- role layouts ---------- */

type Layout = {
  subtitle: string;
  /** Headline figures at the top (up to four). */
  primary: KpiKey[];
  /** Smaller figures in the strip beneath. */
  glance: KpiKey[];
  charts: ChartKey[];
  lists: ListKey[];
  /** Shortcuts, shown only for screens the role can actually open. */
  actions: QuickActionId[];
  /** Panel fed by an existing module dashboard. */
  module?: 'library';
};

const LEADERSHIP: Layout = {
  subtitle: "Here's how the school is running today.",
  primary: ['students_total', 'attendance_today', 'fees_today', 'staff_on_leave_today'],
  glance: ['staff_total', 'admissions_year', 'parent_msgs_pending', 'complaints', 'leaves_pending'],
  charts: ['attendance_trend', 'fee_trend', 'fees_overview', 'class_attendance', 'homework_rate', 'fees_month', 'admission_funnel', 'strength_changes', 'exam_results', 'parent_msg_age', 'task_aging', 'transport_summary', 'hostel_summary', 'gender_split', 'students_by_class'],
  lists: ['pending_approvals', 'substitutes_needed', 'absent_today', 'chronic_absentees', 'staff_on_leave', 'birthdays', 'upcoming_events', 'upcoming_exams_list', 'recent_circulars'],
  actions: ['circular', 'parent-comm', 'attendance', 'timetable', 'fees-report', 'strength', 'exam-schedule', 'complaint'],
};

const ROLE_LAYOUTS: Record<string, Layout> = {
  admin: {
    subtitle: "Here's today's overview across the school.",
    primary: ['students_total', 'attendance_today', 'fees_today', 'admissions_year'],
    glance: ['staff_total', 'staff_on_leave_today', 'visitors_today', 'complaints', 'tasks_pending_all', 'parent_msgs_pending', 'leaves_pending'],
    charts: ['attendance_trend', 'fee_trend', 'fees_overview', 'class_attendance', 'homework_rate', 'fees_month', 'admission_funnel', 'strength_changes', 'exam_results', 'parent_msg_age', 'task_aging', 'transport_summary', 'hostel_summary', 'gender_split', 'students_by_class'],
    lists: ['pending_approvals', 'substitutes_needed', 'absent_today', 'chronic_absentees', 'followups_due', 'staff_on_leave', 'birthdays', 'upcoming_events', 'recent_fee_receipts', 'recent_enquiries', 'upcoming_exams_list', 'recent_circulars'],
    actions: ['add-student', 'search-student', 'collect-fees', 'enquiry', 'circular', 'notify', 'attendance', 'timetable', 'fees-report', 'strength', 'result', 'task'],
  },
  principal: LEADERSHIP,
  vice_principal: LEADERSHIP,
  assistant_admin: {
    subtitle: "Here's what needs attention across the school today.",
    primary: ['students_total', 'attendance_today', 'fees_today', 'admissions_year'],
    glance: ['staff_total', 'visitors_today', 'complaints', 'tasks_pending_all', 'parent_msgs_pending'],
    charts: ['attendance_trend', 'fees_overview', 'class_attendance', 'fees_month', 'admission_funnel', 'strength_changes', 'parent_msg_age', 'task_aging', 'gender_split'],
    lists: ['pending_approvals', 'substitutes_needed', 'absent_today', 'chronic_absentees', 'followups_due', 'staff_on_leave', 'birthdays', 'upcoming_events', 'recent_enquiries', 'recent_circulars'],
    actions: ['add-student', 'search-student', 'collect-fees', 'enquiry', 'circular', 'notify', 'visitor', 'task'],
  },
  clerk: {
    subtitle: "Today's collections, enquiries and office work.",
    primary: ['fees_today', 'students_total', 'admissions_year', 'visitors_today'],
    glance: ['inward_month', 'outward_month', 'petty_cash_month', 'tasks_pending_me'],
    charts: ['fee_trend', 'fees_overview', 'fees_month', 'admission_funnel'],
    lists: ['recent_fee_receipts', 'followups_due', 'recent_enquiries', 'my_tasks', 'birthdays', 'upcoming_events', 'recent_circulars'],
    actions: ['collect-fees', 'search-student', 'add-student', 'enquiry', 'visitor', 'inward', 'petty-cash', 'fees-report', 'defaulters'],
  },
  assistant_clerk: {
    subtitle: "Today's collections, enquiries and visitors.",
    primary: ['fees_today', 'admissions_year', 'visitors_today', 'tasks_pending_me'],
    glance: ['inward_month'],
    charts: ['fee_trend', 'fees_overview', 'fees_month', 'admission_funnel'],
    lists: ['recent_fee_receipts', 'followups_due', 'recent_enquiries', 'birthdays', 'upcoming_events', 'recent_circulars'],
    actions: ['collect-fees', 'search-student', 'add-student', 'enquiry', 'visitor', 'inward', 'front-desk'],
  },
  counsellor: {
    subtitle: 'Students who may need support, and messages waiting for a reply.',
    primary: ['students_total', 'attendance_today', 'parent_msgs_pending', 'tasks_pending_me'],
    glance: ['upcoming_exams'],
    charts: ['exam_results', 'parent_msg_age'],
    lists: ['chronic_absentees', 'absent_today', 'recent_parent_messages', 'upcoming_exams_list', 'birthdays', 'upcoming_events', 'recent_circulars'],
    actions: ['search-student', 'parent-comm', 'circular', 'timetable', 'result'],
  },
  librarian: {
    subtitle: 'Books out, books overdue and your day at the desk.',
    primary: ['tasks_pending_me', 'my_leaves_pending'],
    glance: [],
    charts: [],
    lists: ['library_overdue', 'birthdays', 'upcoming_events', 'recent_circulars'],
    actions: ['book-resources', 'quick-return', 'scan-book', 'overdue', 'search-student', 'leave', 'task'],
    module: 'library',
  },
  store_keeper: {
    subtitle: 'Requisitions, purchase orders and stock.',
    primary: ['requisitions', 'po_status', 'items_total', 'purchases_month'],
    glance: ['vendors_total', 'tasks_pending_me'],
    charts: [],
    lists: ['stock_reorder', 'recent_requisitions', 'my_tasks', 'upcoming_events', 'recent_circulars'],
    actions: ['requisition', 'requisition-approved', 'po', 'receivable', 'item-master', 'task'],
  },
  exam_department: {
    subtitle: 'Exam schedule, evaluation and results.',
    primary: ['upcoming_exams', 'exam_evaluation', 'students_total', 'attendance_today'],
    glance: ['tasks_pending_me'],
    charts: ['exam_results'],
    lists: ['upcoming_exams_list', 'upcoming_events', 'recent_circulars'],
    actions: ['mark-entry', 'exam-schedule', 'exam-creation', 'result', 'search-student', 'circular'],
  },
  trustee: {
    subtitle: 'The school at a glance.',
    primary: ['students_total', 'fees_today', 'attendance_today', 'admissions_year'],
    glance: ['staff_total', 'complaints'],
    charts: ['attendance_trend', 'fee_trend', 'fees_overview', 'class_attendance', 'fees_month', 'admission_funnel', 'strength_changes', 'exam_results', 'transport_summary', 'hostel_summary', 'gender_split', 'students_by_class'],
    lists: ['upcoming_events', 'recent_circulars'],
    actions: ['fees-report', 'strength', 'result', 'circular'],
  },
  peon: {
    subtitle: "Your tasks and today's notices.",
    primary: ['tasks_pending_me', 'visitors_today', 'my_leaves_pending'],
    glance: [],
    charts: [],
    lists: ['my_tasks', 'birthdays', 'upcoming_events', 'recent_circulars'],
    actions: ['circular', 'task', 'leave', 'front-desk'],
  },
  workspace: {
    subtitle: 'Your tasks and notices.',
    primary: ['tasks_pending_me', 'my_leaves_pending'],
    glance: [],
    charts: [],
    lists: ['my_tasks', 'upcoming_events', 'recent_circulars'],
    actions: ['task', 'leave', 'circular'],
  },
};

/** Ids a user can hide, per layout. Ids are stored per user — don't rename them. */
function widgetsFor(layout: Layout): DashboardWidget[] {
  const out: DashboardWidget[] = [];
  for (const k of [...layout.primary, ...layout.glance]) out.push({ id: `kpi.${k}`, label: KPIS[k].label, group: 'kpi' });
  for (const c of layout.charts) out.push({ id: `chart.${c}`, label: CHART_LABEL[c], group: 'chart' });
  for (const l of layout.lists) out.push({ id: `panel.${l}`, label: LISTS[l].label, group: 'panel' });
  if (layout.module === 'library') out.push({ id: 'panel.library', label: 'Library at a glance', group: 'panel' });
  out.push({ id: 'panel.quick_actions', label: 'Quick actions', group: 'panel' });

  return out;
}

/* ---------- pieces ---------- */

type Range = '7' | '14' | '30';

/** Attendance and fee trends share one card; the user picks the series and the window. */
function TrendPanel({ w, show }: { w: RoleWorkspaceWidgets; show: { attendance: boolean; fees: boolean } }) {
  const series = [
    ...(show.attendance && w.attendance_trend ? [{ id: 'attendance' as const, label: 'Attendance' }] : []),
    ...(show.fees && w.fee_trend ? [{ id: 'fees' as const, label: 'Fees' }] : []),
  ];
  const [which, setWhich] = useState<'attendance' | 'fees'>(series[0]?.id ?? 'attendance');
  const [range, setRange] = useState<Range>('14');
  if (series.length === 0) return null;
  const active = series.some((s) => s.id === which) ? which : series[0].id;
  const n = Number(range);

  const raw: Array<{ date: string; value: number | null }> = active === 'attendance'
    ? (w.attendance_trend ?? []).map((r) => ({ date: r.date, value: r.rate }))
    : (w.fee_trend ?? []).map((r) => ({ date: r.date, value: r.amount }));

  const slice = raw.slice(-n);
  const before = n * 2 <= raw.length ? raw.slice(-n * 2, -n) : null;
  const points = slice.map((p) => ({
    label: n <= 7 ? (parseLocalDate(p.date)?.toLocaleDateString('en-IN', { weekday: 'short' }) ?? p.date) : shortDate(p.date),
    value: p.value,
  }));

  const real = slice.map((p) => p.value).filter((v): v is number => v != null);
  const prevReal = (before ?? []).map((p) => p.value).filter((v): v is number => v != null);
  const isRate = active === 'attendance';
  const headline = isRate
    ? (real.length ? real.reduce((s, v) => s + v, 0) / real.length : null)
    : real.reduce((s, v) => s + v, 0);
  const baseline = isRate
    ? (prevReal.length ? prevReal.reduce((s, v) => s + v, 0) / prevReal.length : null)
    : (before ? prevReal.reduce((s, v) => s + v, 0) : null);

  let delta: React.ReactNode = null;
  if (headline != null && baseline != null && baseline > 0) {
    if (isRate) {
      const diff = headline - baseline;
      delta = Math.abs(diff) < 0.5
        ? <Delta direction="flat" tone="neutral">Steady vs previous {n} days</Delta>
        : <Delta direction={diff > 0 ? 'up' : 'down'} tone={diff > 0 ? 'good' : 'act'}>{Math.abs(diff).toFixed(1)} pts vs previous {n} days</Delta>;
    } else {
      const pct = ((headline - baseline) / baseline) * 100;
      delta = Math.abs(pct) < 1
        ? <Delta direction="flat" tone="neutral">Steady vs previous {n} days</Delta>
        : <Delta direction={pct > 0 ? 'up' : 'down'} tone={pct > 0 ? 'good' : 'watch'}>{Math.abs(Math.round(pct))}% vs previous {n} days</Delta>;
    }
  }

  const empty = real.length === 0 || (!isRate && real.every((v) => v === 0));
  return (
    <Panel
      title="Trends"
      description={isRate ? 'Share of marked students present' : 'Fees collected per day'}
      icon={LineChart}
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {series.length > 1 && <Segmented label="Series" value={active} onChange={setWhich} options={series} />}
          <Segmented label="Range" value={range} onChange={setRange} options={[{ id: '7', label: '7D' }, { id: '14', label: '14D' }, { id: '30', label: '30D' }]} />
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="text-3xl font-semibold tracking-tight tabular-nums text-slate-900">
          {headline == null ? '—' : isRate ? formatPercent(headline) : formatCurrency(headline)}
        </span>
        <span className="pb-1 text-xs text-slate-500">{isRate ? `average, last ${n} days` : `collected, last ${n} days`}</span>
        <span className="pb-0.5">{delta}</span>
      </div>
      {empty ? (
        <EmptyNote icon={LineChart}>{isRate ? `No attendance was marked in the last ${n} days.` : `No fees were collected in the last ${n} days.`}</EmptyNote>
      ) : (
        <AreaChart
          points={points}
          previous={before ? before.map((p) => p.value) : undefined}
          format={isRate ? formatPercent : formatCurrencyCompact}
          domain={isRate ? [0, 100] : undefined}
          unit={isRate ? `Attendance rate, last ${n} days` : `Fees collected, last ${n} days`}
          previousLabel={`Previous ${n} days`}
        />
      )}
      {!empty && before && (
        <p className="mt-2 flex items-center gap-4 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-indigo-600" aria-hidden /> Last {n} days</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-slate-400" aria-hidden /> Previous {n} days</span>
        </p>
      )}
    </Panel>
  );
}

function FeesMonthPanel({ data }: { data: NonNullable<RoleWorkspaceWidgets['fees_month']> }) {
  const { this_month: now, last_month_same_days: before } = data;
  const top = Math.max(now, before, 1);
  const pct = before > 0 ? ((now - before) / before) * 100 : null;
  return (
    <Panel title={`Fees in ${data.month_label}`} description={`Against the same days of ${data.last_month_label}`} icon={ReceiptIndianRupee}>
      <div className="flex flex-wrap items-end gap-x-3">
        <span className="text-3xl font-semibold tracking-tight tabular-nums text-slate-900">{formatCurrency(now)}</span>
        {pct != null && (
          <span className="pb-1">
            {Math.abs(pct) < 1
              ? <Delta direction="flat" tone="neutral">Same as {data.last_month_label}</Delta>
              : <Delta direction={pct > 0 ? 'up' : 'down'} tone={pct > 0 ? 'good' : 'watch'}>{Math.abs(Math.round(pct))}% vs {data.last_month_label}</Delta>}
          </span>
        )}
      </div>
      <div className="mt-4 space-y-3">
        {[{ label: data.month_label, value: now, solid: true }, { label: data.last_month_label, value: before, solid: false }].map((r) => (
          <div key={r.label} className="grid grid-cols-[5rem_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate text-slate-600">{r.label}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <span className={`block h-full rounded-full ${r.solid ? 'bg-gradient-to-r from-indigo-500 to-violet-500' : 'bg-slate-300'}`} style={{ width: `${(r.value / top) * 100}%` }} />
            </span>
            <span className="w-16 text-right font-semibold tabular-nums text-slate-900">{formatCurrencyCompact(r.value)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/**
 * Collected vs outstanding and how parents paid — loaded on its own, only for roles allowed to see fees.
 * Figures come from the existing Fees dashboard summary, so they match that screen. There is no
 * defaulter list here: that report takes about 20 minutes on a school this size, so the panel links
 * to the Fees defaulter report instead.
 */
function FeesOverviewPanel({ openReport }: { openReport?: () => void }) {
  const [data, setData] = useState<WorkspaceFees | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchWorkspaceFees(getDashboardSession(), controller.signal)
      .then(setData)
      .catch((err) => {
        if (!controller.signal.aborted) setError(friendlyError(err, "We couldn't load the fee summary."));
      });
    return () => controller.abort();
  }, []);

  const s = data?.summary;
  const action = openReport ? (
    <button type="button" onClick={openReport} className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-700 outline-none hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500/40">
      Defaulter report <ArrowUpRight size={13} aria-hidden />
    </button>
  ) : undefined;

  return (
    <Panel title="Fees this year" description="Collected against total demand" icon={ReceiptIndianRupee} action={action}>
      {error ? (
        <p className="text-sm text-slate-500">{error}</p>
      ) : !data ? (
        <div className="flex items-center gap-5" aria-busy="true">
          <div className="h-[136px] w-[136px] animate-pulse rounded-full bg-slate-100" />
          <div className="flex-1 space-y-2.5">{[0, 1, 2].map((i) => <div key={i} className="h-5 animate-pulse rounded bg-slate-100" />)}</div>
        </div>
      ) : s ? (
        <div className="grid gap-6 @3xl:grid-cols-2">
          <div className="flex items-center gap-5">
            <Donut
              size={136}
              center={`${Math.round(s.collection_rate)}%`}
              centerLabel="collected"
              segments={[
                { label: 'Collected', value: Math.max(s.collected_amount, 0), color: '#4f46e5' },
                { label: 'Outstanding', value: Math.max(s.outstanding_amount, 0), color: '#cbd5e1' },
              ]}
            />
            <Legend
              items={[
                { label: 'Collected', value: formatCurrencyCompact(s.collected_amount), color: '#4f46e5' },
                { label: 'Outstanding', value: formatCurrencyCompact(s.outstanding_amount), color: '#cbd5e1' },
                { label: 'Total demand', value: formatCurrencyCompact(s.demand_amount), color: '#e2e8f0' },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">How parents paid</p>
            {data.payment_mode_mix.length === 0
              ? <p className="text-sm text-slate-500">No payments recorded yet.</p>
              : <BarList rows={data.payment_mode_mix.map((m) => ({ label: m.payment_mode, value: m.amount }))} format={formatCurrencyCompact} />}
          </div>
        </div>
      ) : (
        <EmptyNote icon={ReceiptIndianRupee}>The fee summary is not available.</EmptyNote>
      )}
    </Panel>
  );
}

function ExamResultsPanel({ data }: { data: NonNullable<RoleWorkspaceWidgets['exam_results']> }) {
  return (
    <Panel title="Exam results by class" description={data.exam ? `${data.exam} · average %, absent students left out` : 'Average % per class'} icon={Trophy}>
      {data.rows.length === 0
        ? <EmptyNote icon={Trophy}>No exam marks have been entered yet.</EmptyNote>
        : <BarList showShare={false} format={(v) => `${v.toFixed(1)}%`} rows={data.rows.map((r) => ({ label: `${r.standard_name} · best ${r.best.toFixed(0)}%`, value: r.average }))} />}
    </Panel>
  );
}

function GenderPanel({ data }: { data: NonNullable<RoleWorkspaceWidgets['gender_split']> }) {
  const total = data.Male + data.Female + data['Not recorded'];
  const pct = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '');
  const segments = [
    { label: 'Male', value: data.Male, color: '#4f46e5' },
    { label: 'Female', value: data.Female, color: '#a78bfa' },
    { label: 'Not recorded', value: data['Not recorded'], color: '#cbd5e1' },
  ];
  return (
    <Panel title="Gender split" description="As recorded on student profiles" icon={PieChart}>
      <div className="flex items-center gap-5">
        <Donut segments={segments} center={num(total)} centerLabel="students" size={136} />
        <Legend items={segments.map((s) => ({ label: s.label, value: num(s.value), color: s.color, sub: pct(s.value) }))} />
      </div>
    </Panel>
  );
}

function LibraryPanel() {
  const [data, setData] = useState<LibraryDashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const session = getDashboardSession();
    fetchLibraryDashboardSummary(session, { sub_institute_id: session.subInstituteId, syear: session.academicYearId, user_id: session.userId }, controller.signal)
      .then(setData)
      .catch((err) => {
        if (!controller.signal.aborted) setError(friendlyError(err, "We couldn't load the library summary."));
      });
    return () => controller.abort();
  }, []);

  const open = (
    <a href="/library/dashboard" className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-700 outline-none hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500/40">
      Open library <ArrowUpRight size={13} aria-hidden />
    </a>
  );

  return (
    <Panel title="Library at a glance" description="Books and circulation this academic year" icon={BookOpen} action={open} flush>
      {error ? (
        <p className="p-5 text-sm text-slate-500">{error}</p>
      ) : !data ? (
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 divide-x divide-y divide-slate-100 border-b border-slate-100 sm:grid-cols-4 sm:divide-y-0">
            {[
              { label: 'Book titles', value: data.summary.total_titles, icon: BookOpen },
              { label: 'Copies', value: data.summary.total_items, icon: Package },
              { label: 'Currently issued', value: data.summary.currently_issued, icon: ClipboardCheck },
              { label: 'Overdue', value: data.summary.overdue, icon: TriangleAlert },
            ].map((s) => (
              <div key={s.label} className="px-5 py-3.5">
                <dt className="flex items-center gap-1.5 text-xs text-slate-500"><s.icon size={13} aria-hidden /> {s.label}</dt>
                <dd className="mt-1 flex items-center gap-2 text-xl font-semibold tabular-nums text-slate-900">
                  {num(s.value)}
                  {s.label === 'Overdue' && s.value > 0 && <Pill tone="act">Follow up</Pill>}
                </dd>
              </div>
            ))}
          </dl>
          {data.recent_issues.length === 0 ? (
            <EmptyNote icon={BookOpen}>No books have been issued this academic year.</EmptyNote>
          ) : (
            <RowList icon={BookOpen} rows={data.recent_issues.slice(0, 5).map((r) => ({ id: r.id, title: r.book_title, detail: r.student_name, trailing: `Due ${formatRelativeDay(r.due_date)}` }))} />
          )}
        </>
      )}
    </Panel>
  );
}

const HERO_BTN = 'inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-50';

function HeroFrame({
  roleLabel, title, insight, loadedAt, busy, onRefresh, customize, tools, children,
}: {
  roleLabel?: string; title: string; insight?: string; loadedAt: Date | null; busy: boolean; onRefresh: () => void; customize?: React.ReactNode; tools?: React.ReactNode; children?: React.ReactNode;
}) {
  const now = loadedAt ?? new Date();
  const academicYear = getDashboardSession().academicYearId;
  return (
    <Hero
      eyebrow={
        <>
          {roleLabel && <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">{roleLabel}</span>}
          <span>{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          {academicYear && <span aria-hidden className="text-slate-300">·</span>}
          {academicYear && <span>Academic year {academicYear}</span>}
        </>
      }
      title={title}
      insight={insight}
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
          {tools}
          {loadedAt && <span className="hidden text-xs text-slate-400 sm:inline">Updated {loadedAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>}
          <button type="button" onClick={onRefresh} disabled={busy} aria-label="Refresh dashboard" title="Refresh" className={`${HERO_BTN} w-9 px-0`}>
            <RefreshCw size={15} className={busy ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden />
          </button>
          {customize}
        </div>
      }
    >
      {children}
    </Hero>
  );
}

/** Downloads what is on screen as a CSV, so a trustee can open it in Excel. */
function downloadCsv(filename: string, rows: string[][]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- dashboard ---------- */

const PERIOD_OPTIONS: Array<{ id: WorkspacePeriod; label: string }> = [
  { id: 'today', label: 'Today' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: 'year', label: 'Year' },
];

/**
 * Mounted only once the server has named the role, so the user's saved show/hide choices are read
 * under the right key (`home.<role>`) — never under a placeholder that would flash hidden widgets.
 */
function RoleWorkspaceView({
  data, loadedAt, refreshing, onRefresh, onPeriod, onFilter,
}: {
  data: RoleWorkspaceSummary; loadedAt: Date | null; refreshing: boolean; onRefresh: () => void; onPeriod: (p: WorkspacePeriod) => void; onFilter: (standardId: number) => void;
}) {
  const { user } = useAuth();
  const drill = useDrill();
  const layout = ROLE_LAYOUTS[data.role] ?? ROLE_LAYOUTS.workspace;
  const widgets = useMemo(() => widgetsFor(layout), [layout]);
  const prefs = useDashboardPreferences(`home.${data.role}`, widgets);
  const w = data.widgets;
  const period = data.period ?? 'today';
  const firstName = (user?.name || '').trim().split(/\s+/)[0];
  const hasPeriod = Boolean(w.fees_period || w.admissions_period || w.visitors_period);

  // Per-person, per-browser choices: attendance alert limit and panel order.
  const [target, setTarget] = useState<number>(() => {
    try {
      const n = Number(window.localStorage.getItem('dash-att-target'));
      return Number.isFinite(n) && n >= 50 && n <= 100 ? n : DEFAULT_ATTENDANCE_TARGET;
    } catch {
      return DEFAULT_ATTENDANCE_TARGET;
    }
  });
  const changeTarget = (n: number) => {
    setTarget(n);
    try { window.localStorage.setItem('dash-att-target', String(n)); } catch { /* not remembered */ }
  };
  const order = usePanelOrder(`dash-order:${data.role}:${user?.email ?? 'me'}`);
  const [dragging, setDragging] = useState<string | null>(null);

  const figures = (keys: KpiKey[]) => keys.flatMap((key) => {
    if (!prefs.isVisible(`kpi.${key}`)) return [];
    const def: KpiDef = KPIS[key];
    const fig = def.figure(w, period);
    return fig ? [{ key, def, fig, label: def.title ? def.title(w, period) : def.label }] : [];
  });

  const primaryFigs = figures(layout.primary);
  const glanceFigs = figures(layout.glance);

  const hero = primaryFigs.map(({ key, def, fig, label }) => (
    <HeroStat
      key={key} label={label} icon={def.icon} value={fig.value} context={fig.context} spark={fig.spark} sparkLabel={fig.sparkLabel}
      delta={fig.delta ? <Delta direction={fig.delta.direction} tone={fig.delta.tone}>{fig.delta.text}</Delta> : undefined}
      onClick={drill(def.drill)}
    />
  ));
  const glanceItems = glanceFigs.map(({ key, def, fig, label }) => ({ key, label, value: fig.value, icon: def.icon, onClick: drill(def.drill) }));

  const main: React.ReactNode[] = [];
  const mid: React.ReactNode[] = [];
  const side: React.ReactNode[] = [];
  const on = (k: ChartKey) => layout.charts.includes(k) && prefs.isVisible(`chart.${k}`);

  const showAttendance = on('attendance_trend');
  const showFees = on('fee_trend');
  if ((showAttendance && w.attendance_trend) || (showFees && w.fee_trend)) {
    main.push(<TrendPanel key="trends" w={w} show={{ attendance: showAttendance, fees: showFees }} />);
  }

  if (on('fees_overview') && data.can_see_fees) mid.push(<FeesOverviewPanel key="fees-overview" openReport={drill(['fees defaulter report'])} />);

  if (on('class_attendance') && w.class_attendance) {
    const ca = w.class_attendance;
    mid.push(
      <Panel key="class-att" title="Attendance by class" description={ca.date ? `Lowest first · ${shortDate(ca.date)}` : 'Lowest first'} icon={CalendarCheck}>
        {ca.rows.length === 0
          ? <EmptyNote icon={CalendarCheck}>No class has marked attendance in the last 30 days.</EmptyNote>
          : <RateBars rows={ca.rows.map((r) => ({ label: r.standard_name, rate: r.rate ?? 0, detail: `${num(r.present)} of ${num(r.present + r.absent)}` }))} />}
      </Panel>,
    );
  }
  if (on('fees_month') && w.fees_month) mid.push(<FeesMonthPanel key="fees-month" data={w.fees_month} />);
  if (on('admission_funnel') && w.admission_funnel) {
    const f = w.admission_funnel;
    mid.push(
      <Panel key="funnel" title="Admission pipeline" description="Enquiry to admitted" icon={Filter}>
        <Funnel steps={[{ label: 'Enquiries', value: f.enquiries }, { label: 'Registered', value: f.registered }, { label: 'Admitted', value: f.admitted }]} />
      </Panel>,
    );
  }
  if (on('exam_results') && w.exam_results) mid.push(<ExamResultsPanel key="exam-results" data={w.exam_results} />);
  if (on('gender_split') && w.gender_split) mid.push(<GenderPanel key="gender" data={w.gender_split} />);

  if (on('homework_rate') && w.homework_rate) mid.push(<HomeworkPanel key="homework" data={w.homework_rate} />);
  if (on('parent_msg_age') && w.parent_msg_age) mid.push(<ParentWaitPanel key="parent-age" data={w.parent_msg_age} />);
  if (on('task_aging') && w.task_aging) mid.push(<TaskAgePanel key="task-age" data={w.task_aging} />);
  if (on('strength_changes') && w.strength_changes) mid.push(<StrengthPanel key="strength" data={w.strength_changes} />);
  if (on('transport_summary') && w.transport_summary) mid.push(<TransportPanel key="transport" data={w.transport_summary} />);
  if (on('hostel_summary') && w.hostel_summary) mid.push(<HostelPanel key="hostel" data={w.hostel_summary} />);

  if (on('students_by_class') && w.students_by_class) {
    const rows = w.students_by_class;
    mid.push(
      <Panel key="by-class" title="Students by class" description="Current enrollment distribution" icon={GraduationCap}>
        {rows.length === 0 ? <EmptyNote icon={GraduationCap}>No enrollment data yet.</EmptyNote> : <BarList rows={rows.map((r) => ({ label: r.standard_name, value: Number(r.students) }))} />}
      </Panel>,
    );
  }

  if (layout.module === 'library' && prefs.isVisible('panel.library')) main.push(<LibraryPanel key="library" />);

  layout.lists.forEach((key, i) => {
    if (!prefs.isVisible(`panel.${key}`)) return;
    const def = LISTS[key];
    const rows = def.rows(w);
    if (!rows) return;
    const panel = (
      <Panel key={key} title={def.title} description={typeof def.description === 'function' ? def.description(w) : def.description} icon={def.icon} flush>
        {rows.length === 0 ? <EmptyNote icon={def.icon}>{def.empty}</EmptyNote> : <RowList rows={rows} icon={def.icon} />}
      </Panel>
    );
    // With no chart or module panel to lead the main column, the first list takes it.
    (i === 0 && main.length === 0 && mid.length === 0 ? main : side).push(panel);
  });

  if (prefs.isVisible('panel.quick_actions') && layout.actions.length > 0)
    side.unshift(
      <Panel key="quick" title="Quick actions" description="Shortcuts for your role" icon={Zap} className="print:hidden">
        <RoleQuickActions ids={layout.actions} />
      </Panel>,
    );

  const attention: AttentionItem[] = attentionFor(w, target).map((a) => ({ key: a.key, icon: a.icon, count: a.count, display: a.display, text: a.text, tone: a.tone, onClick: drill(a.drill) }));
  const customize = prefs.ready ? <CustomizeDashboard widgets={widgets} {...prefs.customizeProps} className="!h-9 bg-white shadow-sm" /> : undefined;
  const isQuick = (n: React.ReactNode) => React.isValidElement(n) && n.key === 'quick';
  // Lead with the main panels, then shortcuts, then the charts, then the lists.
  const panels = [...main, ...side.filter(isQuick), ...mid, ...side.filter((n) => !isQuick(n))];
  const nothing = hero.length === 0 && glanceItems.length === 0 && panels.length === 0;
  const keyed = panels.map((node, i) => ({ node, key: String((node as React.ReactElement).key ?? i) }));
  const ordered = order.arrange(keyed);
  const orderedKeys = ordered.map((x) => x.key);

  // Tell the assistant what is on screen, so "why is attendance low?" can be answered from these figures.
  const selectedClass = data.standards.find((c) => c.id === data.standard_id)?.name;
  useRegisterPageAiContext({
    pageTitle: `${data.label} dashboard`,
    pageType: 'dashboard',
    filters: selectedClass ? { class: selectedClass, period } : { period },
    metrics: [...primaryFigs, ...glanceFigs].slice(0, 12).map((f) => ({ key: f.key, label: f.label, value: f.fig.value, trend: f.fig.delta?.text })),
    availableActions: ['Change period', 'Filter by class', 'Find a student', 'Download CSV', 'Print', 'Reorder panels'],
  });

  const exportCsv = () => {
    const rows: string[][] = [['Section', 'Item', 'Value', 'Detail']];
    for (const f of [...primaryFigs, ...glanceFigs]) rows.push(['Figures', f.label, f.fig.value, [f.fig.delta?.text, f.fig.context].filter(Boolean).join(' — ')]);
    for (const a of attentionFor(w, target)) rows.push(['Needs attention', a.text, a.display ?? String(a.count), '']);
    for (const key of layout.lists) {
      const def = LISTS[key];
      for (const r of def.rows(w) ?? []) rows.push([def.title, r.title, r.badge?.text ?? '', r.detail ?? '']);
    }
    if (w.attendance_trend) for (const r of w.attendance_trend) rows.push(['Attendance trend', r.date, r.rate == null ? '' : `${r.rate}%`, `${r.present} present, ${r.absent} absent`]);
    if (w.fee_trend) for (const r of w.fee_trend) rows.push(['Fee trend', r.date, String(r.amount), '']);
    downloadCsv(`${data.role}-dashboard-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const tools = (
    <>
      {data.can_find_student && <StudentFinder openSearch={drill(['search/edit student'])} />}
      {data.standards.length > 0 && w.students_total != null && (
        <label className="inline-flex items-center">
          <span className="sr-only">Show one class</span>
          <select
            value={data.standard_id}
            onChange={(e) => onFilter(Number(e.target.value))}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
          >
            <option value={0}>All classes</option>
            {data.standards.map((c) => <option key={c.id} value={c.id}>Class {c.name}</option>)}
          </select>
        </label>
      )}
      {hasPeriod && <Segmented label="Period" value={period} onChange={onPeriod} options={PERIOD_OPTIONS} />}
      {w.attendance_today && <AlertLimit value={target} onChange={changeTarget} />}
      {order.custom && <button type="button" onClick={order.reset} className={HERO_BTN} title="Put the panels back in their original order"><RotateCcw size={15} aria-hidden /> <span className="hidden md:inline">Reset layout</span></button>}
      <button type="button" onClick={exportCsv} className={HERO_BTN} title="Download these figures as a CSV file"><Download size={15} aria-hidden /> <span className="hidden md:inline">CSV</span></button>
      <button type="button" onClick={() => window.print()} className={HERO_BTN} title="Print, or save as PDF"><Printer size={15} aria-hidden /> <span className="hidden md:inline">Print</span></button>
    </>
  );

  return (
    <div className="mx-auto w-full max-w-[2200px] flex-1 px-1 pb-8 sm:px-2">
      <HeroFrame
        roleLabel={data.label}
        title={`${greeting(loadedAt ?? new Date())}${firstName ? `, ${firstName}` : ''}`}
        insight={insightFor(w, layout.subtitle)}
        loadedAt={loadedAt} busy={refreshing} onRefresh={onRefresh} customize={customize} tools={tools}
      >
        {prefs.ready ? hero : undefined}
      </HeroFrame>

      {/* Wait for the user's layout too, so hidden widgets never flash in. */}
      {!prefs.ready && <PremiumSkeleton />}
      {prefs.ready && !prefs.hasVisible() && <AllWidgetsHiddenNotice />}

      {prefs.ready && (
        <div className="space-y-4">
          <AttentionBar items={attention} />
          {glanceItems.length > 0 && <StatStrip items={glanceItems} />}

          {panels.length > 0 && (
            // Panels flow into as many columns as the width allows (about 28rem each), so the layout
            // follows the window, browser zoom and big monitors without any breakpoint to maintain.
            <div className="[column-gap:1rem] [column-width:28rem]">
              {ordered.map(({ node, key }) => (
                <MovablePanel key={key} id={key} keys={orderedKeys} dragging={dragging} setDragging={setDragging} move={order.move} nudge={order.nudge}>{node}</MovablePanel>
              ))}
            </div>
          )}

          {nothing && prefs.hasVisible() && <div className={SURFACE}><EmptyNote icon={History}>There is nothing to show for your role yet.</EmptyNote></div>}
        </div>
      )}
    </div>
  );
}

export default function RoleWorkspaceDashboard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<RoleWorkspaceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [period, setPeriod] = useState<WorkspacePeriod>('today');
  const [standardId, setStandardId] = useState(0);

  const load = useCallback(
    (mode: 'initial' | 'refresh' = 'initial', nextPeriod: WorkspacePeriod = period, nextStandard: number = standardId) => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      fetchRoleWorkspace(getDashboardSession(), undefined, nextPeriod, nextStandard)
        .then((payload) => {
          setData(payload);
          setLoadedAt(new Date());
        })
        .catch((err: Error) => {
          // The stored session is gone/invalid — "Try again" would hit the same empty session.
          if (err instanceof DashboardAuthError) {
            setError('Your session has expired. Signing you out...');
            logout();
            return;
          }
          setError(friendlyError(err, "We couldn't load the dashboard. Please try again."));
        })
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [logout, period, standardId],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load('initial', 'today', 0);
    // Only on mount; later changes go through changePeriod / the refresh button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changePeriod = (p: WorkspacePeriod) => {
    setPeriod(p);
    load('refresh', p, standardId);
  };

  const changeFilter = (id: number) => {
    setStandardId(id);
    load('refresh', period, id);
  };

  if (data) {
    // key=role: a different role (e.g. after switching profile) remounts and re-reads its own saved layout.
    return <RoleWorkspaceView key={data.role} data={data} loadedAt={loadedAt} refreshing={refreshing} onRefresh={() => load('refresh')} onPeriod={changePeriod} onFilter={changeFilter} />;
  }

  const firstName = (user?.name || '').trim().split(/\s+/)[0];
  return (
    <div className="mx-auto w-full max-w-[2200px] flex-1 px-1 pb-8 sm:px-2">
      <HeroFrame title={`${greeting(new Date())}${firstName ? `, ${firstName}` : ''}`} insight={ROLE_LAYOUTS.workspace.subtitle} loadedAt={null} busy={loading} onRefresh={() => load('initial')} />
      {loading && <PremiumSkeleton />}
      {!loading && error && <DashboardError message={error} onRetry={() => load('initial')} />}
    </div>
  );
}
