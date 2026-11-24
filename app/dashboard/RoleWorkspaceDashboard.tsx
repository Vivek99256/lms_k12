'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight, BookOpen, CalendarCheck, CalendarClock, ClipboardCheck, ClipboardList, DoorOpen, FileText, Filter, GraduationCap, History,
  Inbox, LineChart, ListChecks, Megaphone, MessageCircleWarning, MessageSquareText, Package, PenLine, PieChart, ReceiptIndianRupee,
  RefreshCw, Store, TriangleAlert, UserMinus, Users, Wallet, Zap, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DashboardAuthError, fetchRoleWorkspace, getDashboardSession, type RoleWorkspaceSummary, type RoleWorkspaceWidgets, type WorkspaceListItem,
} from '@/app/dashboard/_lib/dashboard-api';
import {
  AreaChart, AttentionBar, BarList, Delta, Donut, EmptyNote, Funnel, Hero, HeroStat, Legend, Panel, Pill, PremiumSkeleton, RateBars, RowList,
  Segmented, StatStrip, SURFACE, type Row, type Tone,
} from '@/app/dashboard/_components/PremiumKit';
import { DashboardError } from '@/app/dashboard/_components/DashboardPrimitives';
import { RoleQuickActions, type QuickActionId } from '@/app/dashboard/_components/RoleQuickActions';
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard';
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

/* ---------- figures ---------- */

type DeltaInfo = { direction: 'up' | 'down' | 'flat'; tone: Tone; text: string };

type Figure = {
  value: string;
  context?: string;
  delta?: DeltaInfo;
  spark?: Array<number | null>;
  sparkLabel?: string;
} | null;

type KpiDef = { label: string; icon: LucideIcon; figure: (w: RoleWorkspaceWidgets) => Figure };

const last7 = <T,>(a: T[] | null | undefined) => (a ?? []).slice(-7);

const KPIS = {
  students_total: {
    label: 'Total students', icon: GraduationCap,
    figure: (w) => (w.students_total == null ? null : { value: num(w.students_total), context: 'Enrolled this academic year' }),
  },
  staff_total: {
    label: 'Total staff', icon: Users,
    figure: (w) => (w.staff_total == null ? null : { value: num(w.staff_total), context: 'Active staff accounts' }),
  },
  attendance_today: {
    label: "Today's attendance", icon: CalendarCheck,
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
    label: 'Staff on leave today', icon: UserMinus,
    figure: (w) => (w.staff_on_leave_today == null ? null : { value: num(w.staff_on_leave_today), context: 'Approved leave covering today' }),
  },
  leaves_pending: {
    label: 'Leave requests pending', icon: CalendarClock,
    figure: (w) => (w.leaves_pending == null ? null : { value: num(w.leaves_pending), context: 'Waiting for a decision' }),
  },
  my_leaves_pending: {
    label: 'My leave requests', icon: CalendarClock,
    figure: (w) => (w.my_leaves_pending == null ? null : { value: num(w.my_leaves_pending), context: 'Pending approval' }),
  },
  fees_today: {
    label: 'Fees collected today', icon: Wallet,
    figure: (w) => {
      if (w.fees_today == null) return null;
      const trend = last7(w.fee_trend);
      const earlier = trend.slice(0, -1);
      const avg = earlier.length > 0 ? earlier.reduce((s, r) => s + r.amount, 0) / earlier.length : 0;
      let delta: DeltaInfo | undefined;
      if (avg > 0) {
        const pct = ((w.fees_today - avg) / avg) * 100;
        delta = Math.abs(pct) < 1
          ? { direction: 'flat', tone: 'neutral', text: 'In line with 6-day average' }
          : { direction: pct > 0 ? 'up' : 'down', tone: pct > 0 ? 'good' : 'watch', text: `${Math.abs(Math.round(pct))}% vs 6-day average` };
      }
      const week = trend.reduce((s, r) => s + r.amount, 0);
      return {
        value: formatCurrency(w.fees_today),
        context: delta ? undefined : trend.length > 0 ? `${formatCurrencyCompact(week)} in the last 7 days` : w.fees_today > 0 ? 'Collected so far today' : 'Nothing collected yet today',
        delta,
        spark: trend.map((r) => r.amount),
        sparkLabel: 'Fees collected, last 7 days',
      };
    },
  },
  admissions_year: {
    label: 'Admission enquiries', icon: ClipboardList,
    figure: (w) => (w.admissions_year == null ? null : { value: num(w.admissions_year), context: 'This academic year' }),
  },
  parent_msgs_pending: {
    label: 'Parent messages awaiting reply', icon: MessageCircleWarning,
    figure: (w) => (w.parent_msgs_pending == null ? null : { value: num(w.parent_msgs_pending) }),
  },
  visitors_today: {
    label: 'Visitors today', icon: DoorOpen,
    figure: (w) => (w.visitors_today == null ? null : { value: num(w.visitors_today.total), context: `${w.visitors_today.inside} not signed out yet` }),
  },
  complaints: {
    label: 'Open complaints', icon: TriangleAlert,
    figure: (w) => (w.complaints == null ? null : { value: num(w.complaints.open), context: `${num(w.complaints.total)} logged in total` }),
  },
  tasks_pending_all: {
    label: 'Open tasks', icon: ListChecks,
    figure: (w) => (w.tasks_pending_all == null ? null : { value: num(w.tasks_pending_all), context: 'Pending or in progress' }),
  },
  tasks_pending_me: {
    label: 'My open tasks', icon: ListChecks,
    figure: (w) => (w.tasks_pending_me == null ? null : { value: num(w.tasks_pending_me.count), context: 'Assigned to you' }),
  },
  inward_month: {
    label: 'Inward this month', icon: Inbox,
    figure: (w) => (w.inward_month == null ? null : { value: num(w.inward_month) }),
  },
  outward_month: {
    label: 'Outward this month', icon: Inbox,
    figure: (w) => (w.outward_month == null ? null : { value: num(w.outward_month) }),
  },
  petty_cash_month: {
    label: 'Petty cash this month', icon: Wallet,
    figure: (w) => (w.petty_cash_month == null ? null : { value: formatCurrency(w.petty_cash_month) }),
  },
  requisitions: {
    label: 'Requisitions pending', icon: FileText,
    figure: (w) => {
      const r = w.requisitions;
      return r ? { value: num(r.pending), context: `${r.approved} approved · ${r.on_hold} on hold · ${r.rejected} rejected` } : null;
    },
  },
  po_status: {
    label: 'Purchase orders awaiting decision', icon: Package,
    figure: (w) => (w.po_status == null ? null : { value: num(w.po_status.awaiting), context: `${w.po_status.decided} decided` }),
  },
  items_total: {
    label: 'Inventory items', icon: Store,
    figure: (w) => (w.items_total == null ? null : { value: num(w.items_total) }),
  },
  vendors_total: {
    label: 'Vendors', icon: Users,
    figure: (w) => (w.vendors_total == null ? null : { value: num(w.vendors_total) }),
  },
  purchases_month: {
    label: 'Direct purchases this month', icon: ReceiptIndianRupee,
    figure: (w) => (w.purchases_month == null ? null : { value: formatCurrency(w.purchases_month.amount), context: `${w.purchases_month.count} purchase(s)` }),
  },
  upcoming_exams: {
    label: 'Upcoming exams', icon: CalendarClock,
    figure: (w) => (w.upcoming_exams == null ? null : { value: num(w.upcoming_exams.count), context: 'Scheduled from today onwards' }),
  },
  exam_evaluation: {
    label: 'Answer sheets evaluated', icon: PenLine,
    figure: (w) => {
      const e = w.exam_evaluation;
      return e ? { value: `${num(e.evaluated)} / ${num(e.sheets)}`, context: `${e.batches} batch(es) · ${e.approved} approved` } : null;
    },
  },
} as const satisfies Record<string, KpiDef>;

type KpiKey = keyof typeof KPIS;

type ChartKey = 'attendance_trend' | 'fee_trend' | 'class_attendance' | 'fees_month' | 'admission_funnel' | 'gender_split' | 'students_by_class';

const CHART_LABEL: Record<ChartKey, string> = {
  attendance_trend: 'Attendance trend',
  fee_trend: 'Fee collection trend',
  class_attendance: 'Attendance by class',
  fees_month: 'Fees this month vs last month',
  admission_funnel: 'Admission pipeline',
  gender_split: 'Gender split',
  students_by_class: 'Students by class',
};

type ListKey =
  | 'recent_circulars' | 'recent_enquiries' | 'recent_parent_messages' | 'my_tasks' | 'upcoming_exams_list'
  | 'recent_requisitions' | 'recent_fee_receipts';

type ListDef = {
  label: string; title: string; description: string; icon: LucideIcon; empty: string;
  rows: (w: RoleWorkspaceWidgets) => Row[] | null;
};

const dated = (items: WorkspaceListItem[] | null | undefined): Row[] | null =>
  items == null ? null : items.map((i) => ({ id: i.id, title: i.title, detail: i.detail, trailing: formatRelativeDay(i.date) }));

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
};

/* ---------- what needs a person, and the one-line read of the day ---------- */

type Attention = { key: string; icon: LucideIcon; count: number; text: string; tone: Tone };

/** Built only from figures the server sent for this role, so a role never sees another's alerts. */
function attentionFor(w: RoleWorkspaceWidgets): Attention[] {
  const out: Attention[] = [];
  const add = (key: string, icon: LucideIcon, count: number | null | undefined, text: string, tone: Tone) => {
    if (count && count > 0) out.push({ key, icon, count, text, tone });
  };
  add('complaints', TriangleAlert, w.complaints?.open, 'complaints are still open', 'act');
  const lowest = w.class_attendance?.rows.filter((r) => r.rate != null && r.rate < 75).length;
  add('lowclass', CalendarCheck, lowest, 'classes are below 75% attendance', 'act');
  add('parent', MessageCircleWarning, w.parent_msgs_pending, 'parent messages are waiting for a reply', 'watch');
  add('leaves', CalendarClock, w.leaves_pending, 'leave requests need a decision', 'watch');
  add('requisitions', FileText, w.requisitions?.pending, 'requisitions are pending approval', 'watch');
  add('po', Package, w.po_status?.awaiting, 'purchase orders await a decision', 'watch');
  add('visitors', DoorOpen, w.visitors_today?.inside, 'visitors have not signed out', 'watch');
  add('tasks', ListChecks, w.tasks_pending_me?.count, 'tasks are assigned to you', 'watch');
  const a = w.attendance_today;
  if (a && a.present + a.absent > 0) add('attendance', CalendarCheck, a.not_marked, 'students have no attendance marked yet', 'watch');

  return out.slice(0, 5);
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
  if (w.tasks_pending_me && parts.length < 2) parts.push(w.tasks_pending_me.count > 0 ? `You have ${w.tasks_pending_me.count} open task(s).` : 'You have no open tasks.');

  return parts.length > 0 ? parts.slice(0, 2).join(' ') : fallback;
}

/* ---------- role layouts ---------- */

type Layout = {
  subtitle: string;
  /** Headline figures in the hero (up to four). */
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
  charts: ['attendance_trend', 'fee_trend', 'class_attendance', 'fees_month', 'admission_funnel', 'gender_split', 'students_by_class'],
  lists: ['upcoming_exams_list', 'recent_circulars'],
  actions: ['circular', 'parent-comm', 'attendance', 'timetable', 'fees-report', 'strength', 'exam-schedule', 'complaint'],
};

const ROLE_LAYOUTS: Record<string, Layout> = {
  principal: LEADERSHIP,
  vice_principal: LEADERSHIP,
  assistant_admin: {
    subtitle: "Here's what needs attention across the school today.",
    primary: ['students_total', 'attendance_today', 'fees_today', 'admissions_year'],
    glance: ['staff_total', 'visitors_today', 'complaints', 'tasks_pending_all', 'parent_msgs_pending'],
    charts: ['attendance_trend', 'class_attendance', 'fees_month', 'admission_funnel', 'gender_split'],
    lists: ['recent_enquiries', 'recent_circulars'],
    actions: ['add-student', 'search-student', 'collect-fees', 'enquiry', 'circular', 'notify', 'visitor', 'task'],
  },
  clerk: {
    subtitle: "Today's collections, enquiries and office work.",
    primary: ['fees_today', 'students_total', 'admissions_year', 'visitors_today'],
    glance: ['inward_month', 'outward_month', 'petty_cash_month', 'tasks_pending_me'],
    charts: ['fee_trend', 'fees_month', 'admission_funnel'],
    lists: ['recent_fee_receipts', 'recent_enquiries', 'my_tasks', 'recent_circulars'],
    actions: ['collect-fees', 'search-student', 'add-student', 'enquiry', 'visitor', 'inward', 'petty-cash', 'fees-report', 'defaulters'],
  },
  assistant_clerk: {
    subtitle: "Today's collections, enquiries and visitors.",
    primary: ['fees_today', 'admissions_year', 'visitors_today', 'tasks_pending_me'],
    glance: ['inward_month'],
    charts: ['fee_trend', 'fees_month', 'admission_funnel'],
    lists: ['recent_fee_receipts', 'recent_enquiries', 'recent_circulars'],
    actions: ['collect-fees', 'search-student', 'add-student', 'enquiry', 'visitor', 'inward', 'front-desk'],
  },
  counsellor: {
    subtitle: 'Students who may need support, and messages waiting for a reply.',
    primary: ['students_total', 'attendance_today', 'parent_msgs_pending', 'tasks_pending_me'],
    glance: ['upcoming_exams'],
    charts: [],
    lists: ['recent_parent_messages', 'upcoming_exams_list', 'recent_circulars'],
    actions: ['search-student', 'parent-comm', 'circular', 'timetable', 'result'],
  },
  librarian: {
    subtitle: 'Books out, books overdue and your day at the desk.',
    primary: ['tasks_pending_me', 'my_leaves_pending'],
    glance: [],
    charts: [],
    lists: ['recent_circulars'],
    actions: ['book-resources', 'quick-return', 'scan-book', 'overdue', 'search-student', 'leave', 'task'],
    module: 'library',
  },
  store_keeper: {
    subtitle: 'Requisitions, purchase orders and stock.',
    primary: ['requisitions', 'po_status', 'items_total', 'purchases_month'],
    glance: ['vendors_total', 'tasks_pending_me'],
    charts: [],
    lists: ['recent_requisitions', 'my_tasks', 'recent_circulars'],
    actions: ['requisition', 'requisition-approved', 'po', 'receivable', 'item-master', 'task'],
  },
  exam_department: {
    subtitle: 'Exam schedule, evaluation and results.',
    primary: ['upcoming_exams', 'exam_evaluation', 'students_total', 'attendance_today'],
    glance: ['tasks_pending_me'],
    charts: [],
    lists: ['upcoming_exams_list', 'recent_circulars'],
    actions: ['mark-entry', 'exam-schedule', 'exam-creation', 'result', 'search-student', 'circular'],
  },
  trustee: {
    subtitle: 'The school at a glance.',
    primary: ['students_total', 'fees_today', 'attendance_today', 'admissions_year'],
    glance: ['staff_total', 'complaints'],
    charts: ['attendance_trend', 'fee_trend', 'class_attendance', 'fees_month', 'admission_funnel', 'gender_split', 'students_by_class'],
    lists: ['recent_circulars'],
    actions: ['fees-report', 'strength', 'result', 'circular'],
  },
  peon: {
    subtitle: "Your tasks and today's notices.",
    primary: ['tasks_pending_me', 'visitors_today', 'my_leaves_pending'],
    glance: [],
    charts: [],
    lists: ['my_tasks', 'recent_circulars'],
    actions: ['circular', 'task', 'leave', 'front-desk'],
  },
  workspace: {
    subtitle: 'Your tasks and notices.',
    primary: ['tasks_pending_me', 'my_leaves_pending'],
    glance: [],
    charts: [],
    lists: ['my_tasks', 'recent_circulars'],
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
  roleLabel, title, insight, loadedAt, busy, onRefresh, customize, children,
}: {
  roleLabel?: string; title: string; insight?: string; loadedAt: Date | null; busy: boolean; onRefresh: () => void; customize?: React.ReactNode; children?: React.ReactNode;
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
        <>
          {loadedAt && <span className="hidden text-xs text-slate-400 sm:inline">Updated {loadedAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>}
          <button type="button" onClick={onRefresh} disabled={busy} aria-label="Refresh dashboard" title="Refresh" className={`${HERO_BTN} w-9 px-0`}>
            <RefreshCw size={15} className={busy ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden />
          </button>
          {customize}
        </>
      }
    >
      {children}
    </Hero>
  );
}


/* ---------- dashboard ---------- */

/**
 * Mounted only once the server has named the role, so the user's saved show/hide choices are read
 * under the right key (`home.<role>`) — never under a placeholder that would flash hidden widgets.
 */
function RoleWorkspaceView({
  data, loadedAt, refreshing, onRefresh,
}: {
  data: RoleWorkspaceSummary; loadedAt: Date | null; refreshing: boolean; onRefresh: () => void;
}) {
  const { user } = useAuth();
  const layout = ROLE_LAYOUTS[data.role] ?? ROLE_LAYOUTS.workspace;
  const widgets = useMemo(() => widgetsFor(layout), [layout]);
  const prefs = useDashboardPreferences(`home.${data.role}`, widgets);
  const w = data.widgets;
  const firstName = (user?.name || '').trim().split(/\s+/)[0];

  const hero = layout.primary.flatMap((key) => {
    if (!prefs.isVisible(`kpi.${key}`)) return [];
    const def: KpiDef = KPIS[key];
    const fig = def.figure(w);
    if (!fig) return [];
    return [
      <HeroStat
        key={key} label={def.label} icon={def.icon} value={fig.value} context={fig.context} spark={fig.spark} sparkLabel={fig.sparkLabel}
        delta={fig.delta ? <Delta direction={fig.delta.direction} tone={fig.delta.tone}>{fig.delta.text}</Delta> : undefined}
      />,
    ];
  });

  const glanceItems = layout.glance.flatMap((key) => {
    if (!prefs.isVisible(`kpi.${key}`)) return [];
    const def: KpiDef = KPIS[key];
    const fig = def.figure(w);
    return fig ? [{ key, label: def.label, value: fig.value, icon: def.icon }] : [];
  });

  const main: React.ReactNode[] = [];
  const mid: React.ReactNode[] = [];
  const side: React.ReactNode[] = [];
  const on = (k: ChartKey) => layout.charts.includes(k) && prefs.isVisible(`chart.${k}`);

  const showAttendance = on('attendance_trend');
  const showFees = on('fee_trend');
  if ((showAttendance && w.attendance_trend) || (showFees && w.fee_trend)) {
    main.push(<TrendPanel key="trends" w={w} show={{ attendance: showAttendance, fees: showFees }} />);
  }

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
  if (on('gender_split') && w.gender_split) mid.push(<GenderPanel key="gender" data={w.gender_split} />);

  if (on('students_by_class') && w.students_by_class) {
    const rows = w.students_by_class;
    mid.push(
      <Panel key="by-class" title="Students by class" description="Current enrollment distribution" icon={GraduationCap} className="md:col-span-2">
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
      <Panel key={key} title={def.title} description={def.description} icon={def.icon} flush>
        {rows.length === 0 ? <EmptyNote icon={def.icon}>{def.empty}</EmptyNote> : <RowList rows={rows} icon={def.icon} />}
      </Panel>
    );
    // With no chart or module panel to lead the main column, the first list takes it.
    (i === 0 && main.length === 0 && mid.length === 0 ? main : side).push(panel);
  });

  if (prefs.isVisible('panel.quick_actions') && layout.actions.length > 0)
    side.unshift(
      <Panel key="quick" title="Quick actions" description="Shortcuts for your role" icon={Zap}>
        <RoleQuickActions ids={layout.actions} />
      </Panel>,
    );

  const attention = attentionFor(w);
  const customize = prefs.ready ? <CustomizeDashboard widgets={widgets} {...prefs.customizeProps} className="!h-9 bg-white shadow-sm" /> : undefined;
  const nothing = hero.length === 0 && glanceItems.length === 0 && main.length === 0 && mid.length === 0 && side.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1600px] flex-1 px-1 pb-8 sm:px-2">
      <HeroFrame
        roleLabel={data.label}
        title={`${greeting(loadedAt ?? new Date())}${firstName ? `, ${firstName}` : ''}`}
        insight={insightFor(w, layout.subtitle)}
        loadedAt={loadedAt} busy={refreshing} onRefresh={onRefresh} customize={customize}
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

          {(main.length > 0 || mid.length > 0 || side.length > 0) && (
            <div className={`grid grid-cols-1 items-start gap-4 ${side.length > 0 && (main.length > 0 || mid.length > 0) ? 'lg:grid-cols-3' : ''}`}>
              {(main.length > 0 || mid.length > 0) && (
                <div className={`min-w-0 space-y-4 ${side.length > 0 ? 'lg:col-span-2' : ''}`}>
                  {main}
                  {mid.length > 0 && <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">{mid}</div>}
                </div>
              )}
              {side.length > 0 && <div className={`min-w-0 ${main.length > 0 || mid.length > 0 ? 'space-y-4' : 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'}`}>{side}</div>}
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

  const load = useCallback(
    (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      fetchRoleWorkspace(getDashboardSession())
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
    [logout],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (data) {
    // key=role: a different role (e.g. after switching profile) remounts and re-reads its own saved layout.
    return <RoleWorkspaceView key={data.role} data={data} loadedAt={loadedAt} refreshing={refreshing} onRefresh={() => load('refresh')} />;
  }

  const firstName = (user?.name || '').trim().split(/\s+/)[0];
  return (
    <div className="mx-auto w-full max-w-[1600px] flex-1 px-1 pb-8 sm:px-2">
      <HeroFrame title={`${greeting(new Date())}${firstName ? `, ${firstName}` : ''}`} insight={ROLE_LAYOUTS.workspace.subtitle} loadedAt={null} busy={loading} onRefresh={() => load()} />
      {loading && <PremiumSkeleton />}
      {!loading && error && <DashboardError message={error} onRetry={() => load()} />}
    </div>
  );
}
