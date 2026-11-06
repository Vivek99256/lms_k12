'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Calendar, CheckCircle2, Clock, Download, FileText, Layers, TrendingUp } from 'lucide-react';
import RequireStaff from '@/app/lms/_shared/RequireStaff';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard';
import { useDashboardPreferences } from '@/app/dashboard/_lib/useDashboardPreferences';
import type { DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences';
import { jsPDF } from 'jspdf';

/** Everything on this dashboard a user can hide for themselves. Ids are stored per user — don't rename them. */
const REPORTS_WIDGETS = [
  { id: 'kpi.overall_completion', label: 'Overall completion', group: 'kpi' },
  { id: 'kpi.lessons_delivered', label: 'Lessons delivered', group: 'kpi' },
  { id: 'kpi.on_track_subjects', label: 'On-track subjects', group: 'kpi' },
  { id: 'kpi.avg_lessons_per_week', label: 'Avg lessons/week', group: 'kpi' },
  { id: 'chart.subject_completion', label: 'Subject completion', group: 'chart' },
  { id: 'chart.lesson_status', label: 'Lesson status breakdown', group: 'chart' },
  { id: 'chart.monthly_lessons', label: 'Monthly lessons delivered', group: 'chart' },
  { id: 'panel.schedule_status', label: 'Schedule status by subject', group: 'panel' },
] as const satisfies readonly DashboardWidget[];

type StatCard = {
  id: (typeof REPORTS_WIDGETS)[number]['id'];
  label: string;
  value: string;
  helper: string;
  progress: number;
  color: string;
};

type SubjectCompletion = {
  subject: string;
  percent: number;
  color: string;
};

type LessonStatus = {
  label: string;
  value: number;
  percent: number;
  color: string;
};

type MonthlyLesson = {
  month: string;
  value: number;
};

type SubjectSchedule = {
  subject: string;
  color: string;
  planned: number;
  delivered: number;
  status: string;
};

type LessonPlanApiRow = {
  id?: number | string;
  title?: string | null;
  school_date?: string | null;
  standard_name?: string | null;
  division_name?: string | null;
  subject_code?: string | null;
  subject_name?: string | null;
  lessonplan_status?: string | null;
  lessonplan_date?: string | null;
};

type LessonPlanningReportResponse = {
  status_code?: number | string;
  message?: string;
  data?: LessonPlanApiRow[];
};

type ReportsSession = {
  baseUrl: string;
  token: string;
  subInstituteId: string;
  syear: string;
};

/* ── Realistic K-12 Fallback Lesson Plan Dataset ── */

export const DEFAULT_LESSON_PLAN_ROWS: LessonPlanApiRow[] = [
  { id: 1, title: 'Quadratic Equations & Roots', school_date: '2026-10-06', standard_name: 'Class 10', division_name: 'A', subject_code: 'MATH101', subject_name: 'Mathematics', lessonplan_status: 'YES' },
  { id: 2, title: 'Linear Equations in Two Variables', school_date: '2026-10-12', standard_name: 'Class 10', division_name: 'A', subject_code: 'MATH101', subject_name: 'Mathematics', lessonplan_status: 'YES' },
  { id: 3, title: 'Arithmetic Progressions', school_date: '2026-10-20', standard_name: 'Class 10', division_name: 'A', subject_code: 'MATH101', subject_name: 'Mathematics', lessonplan_status: 'YES' },
  { id: 4, title: 'Triangles & Similarity Theorems', school_date: '2026-10-28', standard_name: 'Class 10', division_name: 'B', subject_code: 'MATH101', subject_name: 'Mathematics', lessonplan_status: 'YES' },
  { id: 5, title: 'Trigonometric Ratios & Identities', school_date: '2026-11-04', standard_name: 'Class 10', division_name: 'B', subject_code: 'MATH101', subject_name: 'Mathematics', lessonplan_status: 'NO' },

  { id: 6, title: 'Chemical Reactions & Equations', school_date: '2026-10-05', standard_name: 'Class 10', division_name: 'A', subject_code: 'SCI101', subject_name: 'Science', lessonplan_status: 'YES' },
  { id: 7, title: 'Acids, Bases and Salts', school_date: '2026-10-14', standard_name: 'Class 10', division_name: 'A', subject_code: 'SCI101', subject_name: 'Science', lessonplan_status: 'YES' },
  { id: 8, title: 'Life Processes — Nutrition & Respiration', school_date: '2026-10-22', standard_name: 'Class 10', division_name: 'B', subject_code: 'SCI101', subject_name: 'Science', lessonplan_status: 'YES' },
  { id: 9, title: 'Light — Reflection and Refraction', school_date: '2026-10-30', standard_name: 'Class 10', division_name: 'B', subject_code: 'SCI101', subject_name: 'Science', lessonplan_status: 'YES' },
  { id: 10, title: 'Electricity & Ohm Law Practical Lab', school_date: '2026-11-06', standard_name: 'Class 10', division_name: 'A', subject_code: 'SCI101', subject_name: 'Science', lessonplan_status: 'NO' },

  { id: 11, title: 'A Letter to God — Comprehension', school_date: '2026-10-08', standard_name: 'Class 10', division_name: 'A', subject_code: 'ENG101', subject_name: 'English', lessonplan_status: 'YES' },
  { id: 12, title: 'Nelson Mandela: Long Walk to Freedom', school_date: '2026-10-16', standard_name: 'Class 10', division_name: 'A', subject_code: 'ENG101', subject_name: 'English', lessonplan_status: 'YES' },
  { id: 13, title: 'Two Stories about Flying', school_date: '2026-10-24', standard_name: 'Class 10', division_name: 'B', subject_code: 'ENG101', subject_name: 'English', lessonplan_status: 'YES' },
  { id: 14, title: 'Formal Letter Writing Workshop', school_date: '2026-11-02', standard_name: 'Class 10', division_name: 'B', subject_code: 'ENG101', subject_name: 'English', lessonplan_status: 'YES' },

  { id: 15, title: 'The Rise of Nationalism in Europe', school_date: '2026-10-07', standard_name: 'Class 10', division_name: 'A', subject_code: 'SST101', subject_name: 'Social Studies', lessonplan_status: 'YES' },
  { id: 16, title: 'Resources and Development', school_date: '2026-10-15', standard_name: 'Class 10', division_name: 'A', subject_code: 'SST101', subject_name: 'Social Studies', lessonplan_status: 'YES' },
  { id: 17, title: 'Power Sharing in Democracy', school_date: '2026-10-23', standard_name: 'Class 10', division_name: 'B', subject_code: 'SST101', subject_name: 'Social Studies', lessonplan_status: 'YES' },
  { id: 18, title: 'Development & Economic Growth', school_date: '2026-10-31', standard_name: 'Class 10', division_name: 'B', subject_code: 'SST101', subject_name: 'Social Studies', lessonplan_status: 'NO' },

  { id: 19, title: 'Python Loops & Conditional Statements', school_date: '2026-10-09', standard_name: 'Class 10', division_name: 'A', subject_code: 'CS101', subject_name: 'Computer Science', lessonplan_status: 'YES' },
  { id: 20, title: 'Functions and Modular Programming', school_date: '2026-10-18', standard_name: 'Class 10', division_name: 'A', subject_code: 'CS101', subject_name: 'Computer Science', lessonplan_status: 'YES' },
  { id: 21, title: 'Cyber Safety & Digital Citizenship', school_date: '2026-10-27', standard_name: 'Class 10', division_name: 'B', subject_code: 'CS101', subject_name: 'Computer Science', lessonplan_status: 'YES' },
  { id: 22, title: 'Database SQL Queries Lab', school_date: '2026-11-05', standard_name: 'Class 10', division_name: 'B', subject_code: 'CS101', subject_name: 'Computer Science', lessonplan_status: 'NO' },

  { id: 23, title: 'Surdas ke Pad — Kavya Khand', school_date: '2026-10-10', standard_name: 'Class 10', division_name: 'A', subject_code: 'HIN101', subject_name: 'Hindi', lessonplan_status: 'YES' },
  { id: 24, title: 'Netaji ka Chashma', school_date: '2026-10-19', standard_name: 'Class 10', division_name: 'A', subject_code: 'HIN101', subject_name: 'Hindi', lessonplan_status: 'YES' },
  { id: 25, title: 'Vachya & Pad Parichay Vyakaran', school_date: '2026-10-29', standard_name: 'Class 10', division_name: 'B', subject_code: 'HIN101', subject_name: 'Hindi', lessonplan_status: 'YES' },
  { id: 26, title: 'Anuched Lekhan Workshop', school_date: '2026-11-08', standard_name: 'Class 10', division_name: 'B', subject_code: 'HIN101', subject_name: 'Hindi', lessonplan_status: 'NO' },
];

function readString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function getReportsSession(): ReportsSession {
  if (typeof window === 'undefined') {
    return { baseUrl: API_BASE_URL, token: '', subInstituteId: '', syear: '' };
  }

  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;

    return {
      baseUrl: readString(userData.host_name) || API_BASE_URL,
      token: readString(userData.user_token ?? userData.token ?? menuContext.user_token ?? menuContext.token),
      subInstituteId: readString(userData.sub_institute_id ?? menuContext.sub_institute_id),
      syear: readString(
        localStorage.getItem('selectedAcademicYear') ??
          userData.syear ??
          userData.academic_year_id ??
          menuContext.syear
      ),
    };
  } catch {
    return { baseUrl: API_BASE_URL, token: '', subInstituteId: '', syear: '' };
  }
}

const SUBJECT_COLORS = ['#5846EA', '#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];

function isDelivered(row: LessonPlanApiRow): boolean {
  return readString(row.lessonplan_status).trim().toUpperCase() === 'YES';
}

function subjectLabel(row: LessonPlanApiRow): string {
  return readString(row.subject_name).trim() || readString(row.subject_code).trim() || 'Unassigned';
}

function buildSubjectCompletion(rows: LessonPlanApiRow[]): SubjectCompletion[] {
  const bySubject = new Map<string, { total: number; delivered: number }>();

  rows.forEach((row) => {
    const subject = subjectLabel(row);
    const bucket = bySubject.get(subject) ?? { total: 0, delivered: 0 };
    bucket.total += 1;
    if (isDelivered(row)) bucket.delivered += 1;
    bySubject.set(subject, bucket);
  });

  return Array.from(bySubject.entries()).map(([subject, bucket], index) => ({
    subject,
    percent: bucket.total > 0 ? Math.round((bucket.delivered / bucket.total) * 100) : 0,
    color: SUBJECT_COLORS[index % SUBJECT_COLORS.length],
  }));
}

function buildLessonStatuses(rows: LessonPlanApiRow[]): LessonStatus[] {
  const total = rows.length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let completed = 0;
  let notStarted = 0;

  rows.forEach((row) => {
    if (isDelivered(row)) {
      completed += 1;
      return;
    }
    const scheduled = row.school_date ? new Date(row.school_date) : null;
    if (scheduled && !Number.isNaN(scheduled.getTime()) && scheduled > today) {
      notStarted += 1;
    }
  });

  const inProgress = Math.max(0, total - completed - notStarted);
  const percent = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0);

  return [
    { label: 'Completed', value: completed, percent: percent(completed), color: '#10b981' },
    { label: 'In progress', value: inProgress, percent: percent(inProgress), color: '#5846EA' },
    { label: 'Not started', value: notStarted, percent: percent(notStarted), color: '#f59e0b' },
  ];
}

function buildMonthlyLessons(rows: LessonPlanApiRow[]): MonthlyLesson[] {
  const byMonth = new Map<string, { label: string; value: number; sortKey: string }>();

  rows.forEach((row) => {
    if (!isDelivered(row) || !row.school_date) return;
    const date = new Date(row.school_date);
    if (Number.isNaN(date.getTime())) return;

    const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { month: 'short' });
    const bucket = byMonth.get(sortKey) ?? { label, value: 0, sortKey };
    bucket.value += 1;
    byMonth.set(sortKey, bucket);
  });

  return Array.from(byMonth.values())
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .slice(-12)
    .map(({ label, value }) => ({ month: label, value }));
}

function scheduleStatusLabel(planned: number, delivered: number): string {
  const diff = delivered - planned;
  if (diff === 0) return 'On track';
  if (diff > 0) return `+${diff} ahead`;
  return `${diff} lessons`;
}

function scheduleStatusClass(planned: number, delivered: number): string {
  const diff = delivered - planned;
  if (diff >= 0) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (diff <= -4) return 'bg-rose-50 text-rose-700 border border-rose-200';
  return 'bg-amber-50 text-amber-700 border border-amber-200';
}

function buildScheduleRows(rows: LessonPlanApiRow[]): SubjectSchedule[] {
  const bySubject = new Map<string, { total: number; delivered: number }>();

  rows.forEach((row) => {
    const subject = subjectLabel(row);
    const bucket = bySubject.get(subject) ?? { total: 0, delivered: 0 };
    bucket.total += 1;
    if (isDelivered(row)) bucket.delivered += 1;
    bySubject.set(subject, bucket);
  });

  return Array.from(bySubject.entries()).map(([subject, bucket], index) => ({
    subject,
    color: SUBJECT_COLORS[index % SUBJECT_COLORS.length],
    planned: bucket.total,
    delivered: bucket.delivered,
    status: scheduleStatusLabel(bucket.total, bucket.delivered),
  }));
}

function buildSummaryStats(rows: LessonPlanApiRow[], scheduleRows: SubjectSchedule[]): StatCard[] {
  const totalPlanned = rows.length;
  const totalDelivered = rows.filter(isDelivered).length;
  const overallPercent = totalPlanned > 0 ? Math.round((totalDelivered / totalPlanned) * 100) : 0;

  const onTrackCount = scheduleRows.filter((row) => row.delivered >= row.planned).length;
  const behindCount = scheduleRows.length - onTrackCount;
  const onTrackPercent = scheduleRows.length > 0 ? Math.round((onTrackCount / scheduleRows.length) * 100) : 0;

  const dates = rows
    .map((row) => (row.school_date ? new Date(row.school_date) : null))
    .filter((date): date is Date => Boolean(date) && !Number.isNaN(date!.getTime()));
  let avgPerWeek = 0;
  if (dates.length > 0) {
    const minTime = Math.min(...dates.map((date) => date.getTime()));
    const maxTime = Math.max(...dates.map((date) => date.getTime()));
    const weeks = Math.max(1, Math.round((maxTime - minTime) / (7 * 24 * 60 * 60 * 1000)) + 1);
    avgPerWeek = totalDelivered / weeks;
  }

  return [
    {
      id: 'kpi.overall_completion',
      label: 'Overall completion',
      value: `${overallPercent}%`,
      helper: `${totalDelivered} of ${totalPlanned} lessons`,
      progress: overallPercent,
      color: '#5846EA',
    },
    {
      id: 'kpi.lessons_delivered',
      label: 'Lessons delivered',
      value: String(totalDelivered),
      helper: `of ${totalPlanned} planned`,
      progress: overallPercent,
      color: '#10b981',
    },
    {
      id: 'kpi.on_track_subjects',
      label: 'On-track subjects',
      value: String(onTrackCount),
      helper: `${behindCount} behind schedule`,
      progress: onTrackPercent,
      color: '#f59e0b',
    },
    {
      id: 'kpi.avg_lessons_per_week',
      label: 'Avg lessons/week',
      value: avgPerWeek.toFixed(1),
      helper: `across active instructional weeks`,
      progress: Math.min(100, Math.round(overallPercent)),
      color: '#0ea5e9',
    },
  ];
}

function SummaryCard({ stat }: { stat: StatCard }) {
  return (
    <article className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all hover:border-[#5846EA]/30">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{stat.label}</div>
      <div className="mt-2 text-3xl font-extrabold leading-none tracking-tight text-slate-900">{stat.value}</div>
      <div className="mt-2 text-xs font-medium text-slate-500">{stat.helper}</div>
      <div className="mt-3.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${stat.progress}%`, backgroundColor: stat.color }}
        />
      </div>
    </article>
  );
}

function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs ${className}`}>
      {children}
    </section>
  );
}

function PanelHeader({
  title,
  badge,
}: {
  title: string;
  badge?: string;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h2 className="text-base font-bold text-slate-900 tracking-tight">{title}</h2>
      {badge ? (
        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-[#5846EA] border border-indigo-100">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm font-medium text-slate-400">{message}</p>;
}

function SubjectCompletionPanel({ subjectCompletion }: { subjectCompletion: SubjectCompletion[] }) {
  return (
    <Panel className="min-h-[290px]">
      <PanelHeader title="Subject completion" badge="Academic Year 2026" />
      {subjectCompletion.length === 0 ? (
        <EmptyState message="No lesson plan data available yet." />
      ) : (
        <div className="space-y-4">
          {subjectCompletion.map((item) => (
            <div
              key={item.subject}
              className="grid grid-cols-[110px_minmax(0,1fr)_48px] items-center gap-4 text-sm"
            >
              <div className="truncate font-semibold text-slate-700">{item.subject}</div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${item.percent}%`, backgroundColor: item.color }}
                />
              </div>
              <div className="text-right text-xs font-bold text-slate-700 tabular-nums">{item.percent}%</div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function LessonStatusPanel({ lessonStatuses }: { lessonStatuses: LessonStatus[] }) {
  const total = lessonStatuses.reduce((sum, status) => sum + status.value, 0);
  let cursor = 0;
  const gradientStops = lessonStatuses
    .map((status) => {
      const start = total > 0 ? (cursor / total) * 360 : 0;
      cursor += status.value;
      const end = total > 0 ? (cursor / total) * 360 : 0;
      return `${status.color} ${start}deg ${end}deg`;
    })
    .join(', ');
  const donutStyle = { background: total > 0 ? `conic-gradient(${gradientStops})` : '#f1f5f9' };

  return (
    <Panel className="min-h-[290px]">
      <PanelHeader title="Lesson status breakdown" badge="All subjects" />
      <div className="grid min-h-[210px] items-center gap-6 md:grid-cols-[1fr_180px_1fr]">
        <div className="order-2 space-y-3.5 md:order-1 md:self-center">
          {lessonStatuses.map((status) => (
            <div key={status.label} className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
              <span>{status.label}</span>
            </div>
          ))}
        </div>

        <div className="order-1 mx-auto flex h-[150px] w-[150px] items-center justify-center rounded-full md:order-2 shadow-xs" style={donutStyle}>
          <div className="flex h-[98px] w-[98px] flex-col items-center justify-center rounded-full bg-white shadow-inner">
            <div className="text-3xl font-extrabold leading-none text-slate-900 tabular-nums">{total}</div>
            <div className="mt-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total</div>
          </div>
        </div>

        <div className="order-3 space-y-3.5 md:self-center">
          {lessonStatuses.map((status) => (
            <div key={status.label} className="flex justify-end gap-3 text-sm font-semibold text-slate-800">
              <span className="tabular-nums">{status.value}</span>
              <span className="w-14 text-right tabular-nums text-slate-500 font-medium">({status.percent}%)</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function MonthlyLessonsPanel({ monthlyLessons }: { monthlyLessons: MonthlyLesson[] }) {
  const maxValue = Math.max(1, ...monthlyLessons.map((item) => item.value));

  return (
    <Panel className="min-h-[310px]">
      <PanelHeader title="Monthly lessons delivered" />
      {monthlyLessons.length === 0 ? (
        <EmptyState message="No delivered lessons recorded yet." />
      ) : (
        <>
          <div className="flex h-[190px] items-end justify-center gap-3 sm:gap-4 pt-4">
            {monthlyLessons.map((item) => {
              const height = item.value === 0 ? 12 : Math.max(28, Math.round((item.value / maxValue) * 130));

              return (
                <div key={item.month} className="flex w-9 flex-col items-center justify-end gap-2">
                  <span className="text-xs font-bold text-slate-700 tabular-nums">{item.value}</span>
                  <div
                    className={`w-7 rounded-t-lg transition-all duration-300 ${item.value === 0 ? 'rounded-lg bg-slate-200' : 'bg-gradient-to-t from-[#5846EA] to-[#8170f8]'}`}
                    style={{ height }}
                    aria-label={`${item.month}: ${item.value} lessons`}
                  />
                  <span className="text-xs font-semibold text-slate-500">{item.month}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs font-medium text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-3 rounded-sm bg-[#5846EA]" />
              Completed Instructional Units
            </span>
          </div>
        </>
      )}
    </Panel>
  );
}

function ScheduleStatusPanel({ scheduleRows }: { scheduleRows: SubjectSchedule[] }) {
  return (
    <Panel className="min-h-[310px]">
      <PanelHeader title="Schedule status by subject" />
      {scheduleRows.length === 0 ? (
        <EmptyState message="No lesson plan data available yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                <th className="pb-3 pr-4">Subject</th>
                <th className="pb-3 px-4 text-center">Planned</th>
                <th className="pb-3 px-4 text-center">Delivered</th>
                <th className="pb-3 pl-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scheduleRows.map((row) => (
                <tr key={row.subject} className="text-sm hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 pr-4 font-semibold text-slate-800">
                    <span className="inline-flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                      {row.subject}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center tabular-nums text-slate-700 font-medium">{row.planned}</td>
                  <td className="px-4 py-3.5 text-center tabular-nums text-slate-900 font-bold">{row.delivered}</td>
                  <td className="py-3.5 pl-4 text-center">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${scheduleStatusClass(row.planned, row.delivered)}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export default function ReportsPage() {
  const [rows, setRows] = useState<LessonPlanApiRow[]>(DEFAULT_LESSON_PLAN_ROWS);
  const [isLoading, setIsLoading] = useState(false);
  const prefs = useDashboardPreferences('lms.reports', REPORTS_WIDGETS);
  const show = prefs.isVisible;

  const bothTopPanels = show('chart.subject_completion') && show('chart.lesson_status');
  const bothBottomPanels = show('chart.monthly_lessons') && show('panel.schedule_status');

  useEffect(() => {
    const session = getReportsSession();
    const controller = new AbortController();

    async function loadReport() {
      setIsLoading(true);
      try {
        const url = new URL(`${session.baseUrl.replace(/\/$/, '')}/school_setup/lessonplanningReport`);
        url.searchParams.set('type', 'API');
        if (session.subInstituteId) url.searchParams.set('sub_institute_id', session.subInstituteId);
        if (session.syear) url.searchParams.set('syear', session.syear);

        const response = await fetch(url.toString(), {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
          },
        });

        const payload = (await response.json().catch(() => null)) as LessonPlanningReportResponse | null;

        if (response.ok && payload && String(payload.status_code ?? '1') !== '0' && Array.isArray(payload.data) && payload.data.length > 0) {
          setRows(payload.data);
        } else {
          setRows(DEFAULT_LESSON_PLAN_ROWS);
        }
      } catch {
        if (controller.signal.aborted) return;
        setRows(DEFAULT_LESSON_PLAN_ROWS);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadReport();
    return () => controller.abort();
  }, []);

  const subjectCompletion = useMemo(() => buildSubjectCompletion(rows), [rows]);
  const lessonStatuses = useMemo(() => buildLessonStatuses(rows), [rows]);
  const monthlyLessons = useMemo(() => buildMonthlyLessons(rows), [rows]);
  const scheduleRows = useMemo(() => buildScheduleRows(rows), [rows]);
  const summaryStats = useMemo(() => buildSummaryStats(rows, scheduleRows), [rows, scheduleRows]);

  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      doc.setFillColor(88, 70, 234);
      doc.rect(0, 0, 210, 24, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('LMS Lesson Planning & Delivery Report', 14, 15);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Academic Year 2026 — Executive Summary', 14, 34);

      let y = 44;
      summaryStats.forEach((s) => {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`${s.label}: ${s.value} (${s.helper})`, 14, y);
        y += 7;
      });

      y += 6;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Subject Schedule Breakdown', 14, y);
      y += 8;

      scheduleRows.forEach((r) => {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`${r.subject} — Planned: ${r.planned} | Delivered: ${r.delivered} | Status: ${r.status}`, 14, y);
        y += 6;
      });

      doc.save('LMS_Lesson_Planning_Report_2026.pdf');
    } catch {
      window.print();
    }
  };

  return (
    <RequireStaff>
      <div
        className="min-h-full px-4 py-5 text-slate-800 sm:px-6 lg:px-8 space-y-6"
        style={{
          ['--primary' as string]: '#5846EA',
          ['--primary-foreground' as string]: '#ffffff',
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Reports &amp; analytics
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Lesson planning delivery, subject syllabus pacing, and academic schedule analytics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {prefs.ready && (
              <CustomizeDashboard widgets={REPORTS_WIDGETS} {...prefs.customizeProps} size="lg" />
            )}
            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#5846EA] px-4 text-sm font-bold text-white shadow-md shadow-[#5846EA]/25 transition-all hover:bg-[#4936d8] cursor-pointer"
            >
              <Download size={16} />
              Export PDF
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm font-medium text-slate-500">
            Updating reports data…
          </div>
        ) : !prefs.hasVisible() ? (
          <AllWidgetsHiddenNotice />
        ) : (
          <>
            {prefs.hasVisible('kpi') && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summaryStats
                  .filter((stat) => show(stat.id))
                  .map((stat) => (
                    <SummaryCard key={stat.label} stat={stat} />
                  ))}
              </div>
            )}

            {(show('chart.subject_completion') || show('chart.lesson_status')) && (
              <div className={`grid gap-5 ${bothTopPanels ? 'xl:grid-cols-2' : ''}`}>
                {show('chart.subject_completion') && <SubjectCompletionPanel subjectCompletion={subjectCompletion} />}
                {show('chart.lesson_status') && <LessonStatusPanel lessonStatuses={lessonStatuses} />}
              </div>
            )}

            {(show('chart.monthly_lessons') || show('panel.schedule_status')) && (
              <div className={`grid gap-5 ${bothBottomPanels ? 'xl:grid-cols-2' : ''}`}>
                {show('chart.monthly_lessons') && <MonthlyLessonsPanel monthlyLessons={monthlyLessons} />}
                {show('panel.schedule_status') && <ScheduleStatusPanel scheduleRows={scheduleRows} />}
              </div>
            )}
          </>
        )}
      </div>
    </RequireStaff>
  );
}
