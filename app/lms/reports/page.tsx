import type { CSSProperties, ReactNode } from 'react';
import { Download } from 'lucide-react';

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
  forecast?: boolean;
  current?: boolean;
};

type SubjectSchedule = {
  subject: string;
  color: string;
  planned: number;
  delivered: number;
  status: 'On track' | '-2 lessons' | '-4 lessons' | '+2 ahead';
};

const summaryStats: StatCard[] = [
  {
    label: 'Overall completion',
    value: '40%',
    helper: '19 of 48 topics',
    progress: 40,
    color: '#18a379',
  },
  {
    label: 'Lessons delivered',
    value: '186',
    helper: 'of 320 planned',
    progress: 58,
    color: '#2f7dd9',
  },
  {
    label: 'On-track subjects',
    value: '4',
    helper: '2 behind schedule',
    progress: 67,
    color: '#b87916',
  },
  {
    label: 'Avg lessons/week',
    value: '9.3',
    helper: 'target: 10/week',
    progress: 93,
    color: '#d45628',
  },
];

const subjectCompletion: SubjectCompletion[] = [
  { subject: 'Mathematics', percent: 62, color: '#2f7dd9' },
  { subject: 'Science', percent: 55, color: '#18a379' },
  { subject: 'English', percent: 48, color: '#7468d9' },
  { subject: 'History', percent: 40, color: '#b87916' },
  { subject: 'Geography', percent: 35, color: '#d45628' },
  { subject: 'Art', percent: 50, color: '#c64a74' },
];

const lessonStatuses: LessonStatus[] = [
  { label: 'Completed', value: 126, percent: 62, color: '#18a379' },
  { label: 'In progress', value: 46, percent: 25, color: '#2f7dd9' },
  { label: 'Not started', value: 28, percent: 13, color: '#b87916' },
];

const monthlyLessons: MonthlyLesson[] = [
  { month: 'Jul', value: 25 },
  { month: 'Aug', value: 29 },
  { month: 'Sep', value: 31 },
  { month: 'Oct', value: 33 },
  { month: 'Nov', value: 35 },
  { month: 'Dec', value: 0 },
  { month: 'Jan', value: 37 },
  { month: 'Feb', value: 39 },
  { month: 'Mar', value: 41 },
  { month: 'Apr', value: 43 },
  { month: 'May', value: 42, forecast: true, current: true },
  { month: 'Jun', value: 40, forecast: true },
];

const scheduleRows: SubjectSchedule[] = [
  { subject: 'Mathematics', color: '#2f7dd9', planned: 32, delivered: 32, status: 'On track' },
  { subject: 'Science', color: '#18a379', planned: 30, delivered: 28, status: '-2 lessons' },
  { subject: 'English', color: '#7468d9', planned: 30, delivered: 30, status: 'On track' },
  { subject: 'History', color: '#b87916', planned: 26, delivered: 22, status: '-4 lessons' },
  { subject: 'Geography', color: '#d45628', planned: 26, delivered: 24, status: '-2 lessons' },
  { subject: 'Art', color: '#c64a74', planned: 24, delivered: 26, status: '+2 ahead' },
];

const statusBadgeClassName: Record<SubjectSchedule['status'], string> = {
  'On track': 'bg-[#dff2d5] text-[#3f7b2b]',
  '-2 lessons': 'bg-[#f8e8cd] text-[#9a6a22]',
  '-4 lessons': 'bg-[#f8dfe0] text-[#a34848]',
  '+2 ahead': 'bg-[#dff2d5] text-[#3f7b2b]',
};

const deliveredLegendStyle = { backgroundColor: '#6fa8dc' };
const forecastLegendStyle = {
  borderColor: '#2f7dd9',
  backgroundImage: 'linear-gradient(135deg, rgba(47,125,217,0.12) 25%, transparent 25%, transparent 50%, rgba(47,125,217,0.12) 50%, rgba(47,125,217,0.12) 75%, transparent 75%, transparent)',
  backgroundSize: '6px 6px',
};

const donutStyle = {
  background:
    'conic-gradient(#18a379 0deg 223.2deg, #2f7dd9 223.2deg 313.2deg, #b87916 313.2deg 360deg)',
};

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

function SubjectCompletionPanel() {
  return (
    <Panel className="min-h-[282px] px-5 py-5">
      <PanelHeader title="Subject completion" badge="Year to date" />
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
    </Panel>
  );
}

function LessonStatusPanel() {
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
            <div className="text-3xl font-bold leading-none text-[#25221e]">186</div>
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

function MonthlyLessonsPanel() {
  const maxValue = Math.max(...monthlyLessons.map((item) => item.value));

  return (
    <Panel className="min-h-[308px] px-5 py-5">
      <PanelHeader title="Monthly lessons delivered" />
      <div className="flex h-[182px] items-end justify-center gap-2 sm:gap-3">
        {monthlyLessons.map((item) => {
          const height = item.value === 0 ? 10 : Math.max(28, Math.round((item.value / maxValue) * 118));
          const barStyle: CSSProperties = item.forecast
            ? {
                height,
                backgroundColor: '#c9e0f5',
                border: '1px dashed #7cb1e5',
              }
            : {
                height,
                background: item.value === 0 ? '#dfdcd7' : 'linear-gradient(180deg, #5d9fe2 0%, #bcd7ef 100%)',
              };

          return (
            <div key={item.month} className="flex w-7 flex-col items-center justify-end gap-1 sm:w-8">
              <div
                className={`w-6 rounded-t-md ${item.value === 0 ? 'rounded-md' : ''}`}
                style={barStyle}
                aria-label={`${item.month}: ${item.value} lessons`}
              />
              <span
                className={`text-[11px] font-medium ${item.current ? 'text-[#1d5ea8]' : 'text-[#aaa49c]'}`}
              >
                {item.month}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs font-medium text-[#77716b]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm" style={deliveredLegendStyle} />
          Delivered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm border" style={forecastLegendStyle} />
          Forecast
        </span>
      </div>
    </Panel>
  );
}

function ScheduleStatusPanel() {
  return (
    <Panel className="min-h-[308px] px-5 py-5">
      <PanelHeader title="Schedule status by subject" />
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
                  <span className={`inline-flex h-6 items-center rounded-full px-3 text-xs font-bold ${statusBadgeClassName[row.status]}`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export default function ReportsPage() {
  return (
    <div className="min-h-full px-4 py-4 text-[#27231f] sm:px-6 lg:px-7">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold leading-tight tracking-[0] text-[#26231f]">
            Reports &amp; analytics
          </h1>
          <p className="mt-1 text-sm font-medium text-[#716b64]">
            Grade 8 - Academic Year 2025-26 - Data as of 21 May 2026
          </p>
        </div>

        <HeaderButton>
          <Download size={15} />
          Export PDF
        </HeaderButton>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryStats.map((stat) => (
          <SummaryCard key={stat.label} stat={stat} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <SubjectCompletionPanel />
        <LessonStatusPanel />
        <MonthlyLessonsPanel />
        <ScheduleStatusPanel />
      </div>
    </div>
  );
}
