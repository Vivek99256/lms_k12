'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import RequireStaff from '@/app/lms/_shared/RequireStaff';
import { API_BASE_URL } from '@/app/components/utils/api_url';

type StatCard = {
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

const SUBJECT_COLORS = ['#2f7dd9', '#18a379', '#7468d9', '#b87916', '#d45628', '#c64a74', '#0f9ba6', '#8a5cf6'];

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
    { label: 'Completed', value: completed, percent: percent(completed), color: '#18a379' },
    { label: 'In progress', value: inProgress, percent: percent(inProgress), color: '#2f7dd9' },
    { label: 'Not started', value: notStarted, percent: percent(notStarted), color: '#b87916' },
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
  if (diff >= 0) return 'bg-[#dff2d5] text-[#3f7b2b]';
  if (diff <= -4) return 'bg-[#f8dfe0] text-[#a34848]';
  return 'bg-[#f8e8cd] text-[#9a6a22]';
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
      label: 'Overall completion',
      value: `${overallPercent}%`,
      helper: `${totalDelivered} of ${totalPlanned} lessons`,
      progress: overallPercent,
      color: '#18a379',
    },
    {
      label: 'Lessons delivered',
      value: String(totalDelivered),
      helper: `of ${totalPlanned} planned`,
      progress: overallPercent,
      color: '#2f7dd9',
    },
    {
      label: 'On-track subjects',
      value: String(onTrackCount),
      helper: `${behindCount} behind schedule`,
      progress: onTrackPercent,
      color: '#b87916',
    },
    {
      label: 'Avg lessons/week',
      value: avgPerWeek.toFixed(1),
      helper: `over ${dates.length > 0 ? Math.max(1, Math.round((Math.max(...dates.map((d) => d.getTime())) - Math.min(...dates.map((d) => d.getTime()))) / (7 * 24 * 60 * 60 * 1000)) + 1) : 0} weeks`,
      progress: Math.min(100, Math.round(overallPercent)),
      color: '#d45628',
    },
  ];
}

function HeaderButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#ddd9d2] bg-white px-3 text-sm font-semibold text-[#2d2924] shadow-sm transition-colors hover:bg-[#f1f0ed]"
    >
      {children}
    </button>
  );
}

function SummaryCard({ stat }: { stat: StatCard }) {
  return (
    <article className="rounded-lg bg-white px-4 py-4">
      <div className="text-xs font-medium text-[#746f68]">{stat.label}</div>
      <div className="mt-1 text-3xl font-bold leading-none tracking-[0] text-[#25221e]">{stat.value}</div>
      <div className="mt-2 text-xs font-medium text-[#928c84]">{stat.helper}</div>
      <div className="mt-3 h-1 rounded-full bg-[#d8d4ce]">
        <div
          className="h-full rounded-full"
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
    <section className={`rounded-lg border border-[#ddd9d2] bg-white shadow-[0_14px_30px_rgba(23,22,15,0.10)] ${className}`}>
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
      <h2 className="text-base font-semibold tracking-[0] text-[#26231f]">{title}</h2>
      {badge ? (
        <span className="rounded-full bg-[#e4e1dc] px-2.5 py-1 text-[11px] font-bold text-[#77716b]">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm font-medium text-[#928c84]">{message}</p>;
}

function SubjectCompletionPanel({ subjectCompletion }: { subjectCompletion: SubjectCompletion[] }) {
  return (
    <Panel className="min-h-[282px] px-5 py-5">
      <PanelHeader title="Subject completion" badge="Year to date" />
      {subjectCompletion.length === 0 ? (
        <EmptyState message="No lesson plan data available yet." />
      ) : (
        <div className="space-y-3.5">
          {subjectCompletion.map((item) => (
            <div
              key={item.subject}
              className="grid grid-cols-[82px_minmax(0,1fr)_42px] items-center gap-4 text-sm"
            >
              <div className="truncate font-medium text-[#706b64]">{item.subject}</div>
              <div className="h-2 rounded-full bg-[#dfdcd7]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${item.percent}%`, backgroundColor: item.color }}
                />
              </div>
              <div className="text-right text-xs font-semibold text-[#706b64]">{item.percent}%</div>
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
  const donutStyle = { background: total > 0 ? `conic-gradient(${gradientStops})` : '#e4e1dc' };

  return (
    <Panel className="min-h-[282px] px-5 py-5">
      <PanelHeader title="Lesson status breakdown" badge="All subjects" />
      <div className="grid min-h-[206px] items-center gap-6 md:grid-cols-[1fr_178px_1fr]">
        <div className="order-2 space-y-3 md:order-1 md:self-end">
          {lessonStatuses.map((status) => (
            <div key={status.label} className="flex items-center gap-2 text-sm text-[#4f4a44]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
              <span>{status.label}</span>
            </div>
          ))}
        </div>

        <div className="order-1 mx-auto flex h-[142px] w-[142px] items-center justify-center rounded-full md:order-2" style={donutStyle}>
          <div className="flex h-[92px] w-[92px] flex-col items-center justify-center rounded-full bg-white">
            <div className="text-3xl font-bold leading-none text-[#25221e]">{total}</div>
            <div className="mt-1 text-xs font-medium text-[#8f8982]">total</div>
          </div>
        </div>

        <div className="order-3 space-y-3 md:self-end">
          {lessonStatuses.map((status) => (
            <div key={status.label} className="flex justify-end gap-3 text-sm text-[#2d2924]">
              <span className="tabular-nums">{status.value}</span>
              <span className="w-12 text-right tabular-nums">({status.percent}%)</span>
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
    <Panel className="min-h-[308px] px-5 py-5">
      <PanelHeader title="Monthly lessons delivered" />
      {monthlyLessons.length === 0 ? (
        <EmptyState message="No delivered lessons recorded yet." />
      ) : (
        <>
          <div className="flex h-[182px] items-end justify-center gap-2 sm:gap-3">
            {monthlyLessons.map((item) => {
              const height = item.value === 0 ? 10 : Math.max(28, Math.round((item.value / maxValue) * 118));

              return (
                <div key={item.month} className="flex w-7 flex-col items-center justify-end gap-1 sm:w-8">
                  <div
                    className={`w-6 rounded-t-md ${item.value === 0 ? 'rounded-md' : ''}`}
                    style={{
                      height,
                      background: item.value === 0 ? '#dfdcd7' : 'linear-gradient(180deg, #5d9fe2 0%, #bcd7ef 100%)',
                    }}
                    aria-label={`${item.month}: ${item.value} lessons`}
                  />
                  <span className="text-[11px] font-medium text-[#aaa49c]">{item.month}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs font-medium text-[#77716b]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: '#6fa8dc' }} />
              Delivered
            </span>
          </div>
        </>
      )}
    </Panel>
  );
}

function ScheduleStatusPanel({ scheduleRows }: { scheduleRows: SubjectSchedule[] }) {
  return (
    <Panel className="min-h-[308px] px-5 py-5">
      <PanelHeader title="Schedule status by subject" />
      {scheduleRows.length === 0 ? (
        <EmptyState message="No lesson plan data available yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#d7d3cd] text-xs font-bold text-[#77716b]">
                <th className="pb-3 pr-4">Subject</th>
                <th className="pb-3 px-4 text-center">Planned</th>
                <th className="pb-3 px-4 text-center">Delivered</th>
                <th className="pb-3 pl-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {scheduleRows.map((row) => (
                <tr key={row.subject} className="border-b border-[#ebe7e1] text-sm last:border-b-0">
                  <td className="py-3 pr-4 font-medium text-[#4f4a44]">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                      {row.subject}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums text-[#2d2924]">{row.planned}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-[#2d2924]">{row.delivered}</td>
                  <td className="py-3 pl-4 text-center">
                    <span className={`inline-flex h-6 items-center rounded-full px-3 text-xs font-bold ${scheduleStatusClass(row.planned, row.delivered)}`}>
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
  const [rows, setRows] = useState<LessonPlanApiRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const session = getReportsSession();
    const controller = new AbortController();

    async function loadReport() {
      setIsLoading(true);
      setLoadError('');

      try {
        const url = new URL(`${session.baseUrl.replace(/\/$/, '')}/school_setup/lessonplanningReport`);
        url.searchParams.set('type', 'API');
        if (session.subInstituteId) url.searchParams.set('sub_institute_id', session.subInstituteId);
        if (session.syear) url.searchParams.set('syear', session.syear);

        // No `credentials: 'include'`: the backend's CORS config uses a
        // wildcard origin with supports_credentials=false, so browsers
        // reject credentialed cross-origin requests outright. The
        // controller already prefers the sub_institute_id/syear query
        // params (sent above) over the session, so cookies aren't needed.
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

        if (!response.ok || !payload || String(payload.status_code ?? '1') === '0') {
          throw new Error(payload?.message || 'Unable to load the lesson plan report.');
        }

        setRows(Array.isArray(payload.data) ? payload.data : []);
      } catch (error) {
        if (controller.signal.aborted) return;
        setRows([]);
        setLoadError(error instanceof Error ? error.message : 'Unable to load the lesson plan report.');
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

  return (
    <RequireStaff>
    <div className="min-h-full px-4 py-4 text-[#27231f] sm:px-6 lg:px-7">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold leading-tight tracking-[0] text-[#26231f]">
            Reports &amp; analytics
          </h1>
          <p className="mt-1 text-sm font-medium text-[#716b64]">
            Lesson planning completion across subjects
          </p>
        </div>

        <HeaderButton>
          <Download size={15} />
          Export PDF
        </HeaderButton>
      </div>

      {loadError ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-700">Unable to load reports</p>
          <p className="mt-1 text-sm text-red-600">{loadError}</p>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-[#ddd9d2] bg-white px-5 py-10 text-center text-sm font-medium text-[#716b64]">
          Loading reports...
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {summaryStats.map((stat) => (
              <SummaryCard key={stat.label} stat={stat} />
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <SubjectCompletionPanel subjectCompletion={subjectCompletion} />
            <LessonStatusPanel lessonStatuses={lessonStatuses} />
            <MonthlyLessonsPanel monthlyLessons={monthlyLessons} />
            <ScheduleStatusPanel scheduleRows={scheduleRows} />
          </div>
        </>
      )}
    </div>
    </RequireStaff>
  );
}
