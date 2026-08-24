'use client';

<<<<<<< HEAD
import { type ReactNode, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Download, Filter, MapPin, Plus, X } from 'lucide-react';
=======
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Download, Filter, Plus, User, X } from 'lucide-react';
import RequireStaff from '@/app/lms/_shared/RequireStaff';
import { createAuthHeaders, useLmsSessionContext } from '@/app/lms/_shared/useLmsSession';
import { SearchDropdown, type DropdownField, type SearchDropdownValues } from '@/components/search-dropdown';
import type { SessionContext } from '@/lib/erp-client';

const classPickerFields: DropdownField[] = ['section', 'standard', 'division'];

function readDropdownValue(value: SearchDropdownValues[keyof SearchDropdownValues] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

type SessionLike = SessionContext;
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

type EventStyleKey = 'math' | 'science' | 'english' | 'history' | 'geography' | 'art' | 'revision' | 'neutral';

type CalendarEvent = {
  label: string;
  style: EventStyleKey;
};

type Lesson = {
<<<<<<< HEAD
  subject: string;
  period: string;
=======
  periodId: number;
  subjectId: number | null;
  subject: string;
  period: string;
  periodSlot: string;
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  title: string;
  room: string;
  status: string;
  statusClassName: string;
  accent: string;
};

type CalendarDay = {
  date: number | null;
  weekday: string;
  events: CalendarEvent[];
  lessons?: Lesson[];
};

type CalendarWeek = {
  label: string;
  days: CalendarDay[];
};

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const eventStyles: Record<EventStyleKey, { bg: string; text: string; dot: string }> = {
  math: { bg: '#dfeeff', text: '#1d5ea8', dot: '#2f7dd9' },
  science: { bg: '#d9f0e8', text: '#0d6c55', dot: '#18a379' },
  english: { bg: '#e9e5fb', text: '#4c40a5', dot: '#7468d9' },
  history: { bg: '#fae8c6', text: '#74490d', dot: '#b87916' },
  geography: { bg: '#fae2d6', text: '#8a351c', dot: '#d45628' },
  art: { bg: '#f7dce8', text: '#8b2549', dot: '#c64a74' },
  revision: { bg: '#e4eef9', text: '#285f9e', dot: '#2f7dd9' },
  neutral: { bg: '#efeeec', text: '#69645d', dot: '#9a958e' },
};

<<<<<<< HEAD
const dialogSubjects = ['Mathematics', 'Science', 'English', 'History', 'Geography', 'Art'];
const dialogMonths = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];
const dialogColours = ['#2f7dd9', '#18a379', '#7468d9', '#b87916', '#d45628', '#c64a74'];
=======
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
const filterSubjects = [
  { name: 'Mathematics', color: '#2f7dd9' },
  { name: 'Science', color: '#18a379' },
  { name: 'English', color: '#7468d9' },
  { name: 'History', color: '#b87916' },
  { name: 'Geography', color: '#d45628' },
  { name: 'Art', color: '#c64a74' },
];
const filterGrades = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];
const filterStatuses = [
  { name: 'Completed', checked: true },
  { name: 'In progress', checked: true },
  { name: 'Upcoming', checked: true },
  { name: 'Exam / Break', checked: false },
];
const filterMonthOptions = ['April 2026', 'May 2026', 'June 2026'];
const quickTags = [
  { label: 'Behind schedule', active: true },
  { label: 'On track', active: false },
  { label: 'Revision weeks', active: true },
  { label: 'Exam months', active: false },
  { label: 'Has resources', active: false },
  { label: 'No homework set', active: false },
  { label: 'Practical / Lab', active: false },
];

const primaryActionClassName =
  'bg-[var(--primary-blue)] text-white hover:bg-[color-mix(in_srgb,var(--primary-blue),#000_12%)]';

<<<<<<< HEAD
const lessonsForMay21: Lesson[] = [
  {
    subject: 'Mathematics',
    period: 'Period 2',
    title: 'Calculus - Introduction to derivatives',
    room: 'Room 14',
    status: 'In progress',
    statusClassName: 'bg-[#dcecff] text-[#114f8f]',
    accent: '#2f7dd9',
  },
  {
    subject: 'English',
    period: 'Period 4',
    title: 'Media literacy - Analysing news',
    room: 'Room 7',
    status: 'Upcoming',
    statusClassName: 'bg-[#e9e7e3] text-[#6f6a63]',
    accent: '#7468d9',
  },
  {
    subject: 'Geography',
    period: 'Period 6',
    title: 'Development - Human development index',
    room: 'Room 3',
    status: 'Ready',
    statusClassName: 'bg-[#def4d2] text-[#3f7b2b]',
    accent: '#d45628',
  },
];

const calendarWeeks: CalendarWeek[] = [
  {
    label: 'W18',
    days: [
      { date: null, weekday: 'Monday', events: [] },
      { date: null, weekday: 'Tuesday', events: [] },
      { date: null, weekday: 'Wednesday', events: [] },
      {
        date: 1,
        weekday: 'Thursday',
        events: [
          { label: 'Calculus', style: 'math' },
          { label: 'Physics', style: 'science' },
        ],
      },
      {
        date: 2,
        weekday: 'Friday',
        events: [
          { label: 'Media', style: 'english' },
          { label: 'Revision', style: 'history' },
        ],
      },
    ],
  },
  {
    label: 'W19',
    days: [
      {
        date: 5,
        weekday: 'Monday',
        events: [
          { label: 'Calculus', style: 'math' },
          { label: 'Dev.', style: 'geography' },
        ],
      },
      {
        date: 6,
        weekday: 'Tuesday',
        events: [
          { label: 'Revision', style: 'science' },
          { label: 'Exhibition', style: 'art' },
        ],
      },
      {
        date: 7,
        weekday: 'Wednesday',
        events: [
          { label: 'Calculus', style: 'math' },
          { label: 'Media', style: 'english' },
        ],
      },
      {
        date: 8,
        weekday: 'Thursday',
        events: [
          { label: 'Cold War', style: 'history' },
          { label: 'Dev.', style: 'geography' },
        ],
      },
      {
        date: 9,
        weekday: 'Friday',
        events: [
          { label: 'Ecology', style: 'science' },
          { label: 'Portfolio', style: 'art' },
        ],
      },
    ],
  },
  {
    label: 'W20',
    days: [
      {
        date: 12,
        weekday: 'Monday',
        events: [
          { label: 'Revision', style: 'revision' },
          { label: 'Modern', style: 'history' },
        ],
      },
      {
        date: 13,
        weekday: 'Tuesday',
        events: [
          { label: 'Revision', style: 'english' },
          { label: 'Revision', style: 'geography' },
        ],
      },
      {
        date: 14,
        weekday: 'Wednesday',
        events: [
          { label: 'Revision', style: 'science' },
          { label: 'Exhibition', style: 'art' },
        ],
      },
      {
        date: 15,
        weekday: 'Thursday',
        events: [
          { label: 'Revision', style: 'revision' },
          { label: 'Revision', style: 'history' },
        ],
      },
      {
        date: 16,
        weekday: 'Friday',
        events: [
          { label: 'Revision', style: 'english' },
          { label: 'Revision', style: 'geography' },
        ],
      },
    ],
  },
  {
    label: 'W21',
    days: [
      {
        date: 19,
        weekday: 'Monday',
        events: [
          { label: 'Lab work', style: 'science' },
          { label: 'Exhibition', style: 'art' },
        ],
      },
      {
        date: 20,
        weekday: 'Tuesday',
        events: [
          { label: 'Calculus', style: 'math' },
          { label: 'Modern', style: 'history' },
        ],
      },
      {
        date: 21,
        weekday: 'Wednesday',
        events: [
          { label: 'Calculus', style: 'math' },
          { label: 'Media', style: 'english' },
          { label: 'Dev.', style: 'geography' },
        ],
        lessons: lessonsForMay21,
      },
      {
        date: 22,
        weekday: 'Thursday',
        events: [
          { label: 'Revision', style: 'science' },
          { label: 'Cold War', style: 'history' },
        ],
      },
      {
        date: 23,
        weekday: 'Friday',
        events: [
          { label: 'Revision', style: 'revision' },
          { label: 'Exhibition', style: 'art' },
        ],
      },
    ],
  },
  {
    label: 'W22',
    days: [
      {
        date: 26,
        weekday: 'Monday',
        events: [
          { label: 'Revision', style: 'revision' },
          { label: 'Revision', style: 'science' },
        ],
      },
      {
        date: 27,
        weekday: 'Tuesday',
        events: [
          { label: 'Revision', style: 'english' },
          { label: 'Revision', style: 'history' },
        ],
      },
      {
        date: 28,
        weekday: 'Wednesday',
        events: [
          { label: 'Revision', style: 'geography' },
          { label: 'Exhibition', style: 'art' },
        ],
      },
      {
        date: 29,
        weekday: 'Thursday',
        events: [
          { label: 'Revision', style: 'revision' },
          { label: 'Revision', style: 'science' },
        ],
      },
      {
        date: 30,
        weekday: 'Friday',
        events: [
          { label: 'Revision', style: 'english' },
          { label: 'Revision', style: 'geography' },
        ],
      },
    ],
  },
];

function buildLessonsFromEvents(day: CalendarDay): Lesson[] {
  return day.events.map((event, index) => {
    const style = eventStyles[event.style];
    const subjectByStyle: Record<EventStyleKey, string> = {
      math: 'Mathematics',
      science: 'Science',
      english: 'English',
      history: 'History',
      geography: 'Geography',
      art: 'Art',
      revision: 'Revision',
      neutral: 'Lesson',
    };

    return {
      subject: subjectByStyle[event.style],
      period: `Period ${index + 2}`,
      title: `${event.label} - Planned classroom session`,
      room: `Room ${index + 7}`,
      status: index === 0 ? 'Ready' : 'Upcoming',
      statusClassName: index === 0 ? 'bg-[#def4d2] text-[#3f7b2b]' : 'bg-[#e9e7e3] text-[#6f6a63]',
      accent: style.dot,
=======
const styleKeys: EventStyleKey[] = ['math', 'science', 'english', 'history', 'geography', 'art'];

function styleForSubject(subjectId: number | null, subjectOrder: number[]): EventStyleKey {
  if (subjectId == null) return 'neutral';
  const index = subjectOrder.indexOf(subjectId);
  return styleKeys[(index < 0 ? 0 : index) % styleKeys.length];
}

function monthlyStatusMeta(status: string): { label: string; className: string } {
  if (status === 'in_progress') return { label: 'In progress', className: 'bg-[#dcecff] text-[#114f8f]' };
  if (status === 'completed') return { label: 'Ready', className: 'bg-[#def4d2] text-[#3f7b2b]' };
  return { label: 'Upcoming', className: 'bg-[#e9e7e3] text-[#6f6a63]' };
}

// --- Monthly Plan API ---------------------------------------------------------

type ApiMonthlyPeriod = {
  period_id: number;
  subject_id: number | null;
  subject_name: string | null;
  topic: string | null;
  period_slot: string;
  teacher_name: string;
  status: string;
  planned_duration_min: number;
};

type ApiMonthlyDay = {
  date: string;
  weekday: string;
  periods: ApiMonthlyPeriod[];
};

type MonthlyPlanApiData = {
  month: string;
  month_start: string;
  month_end: string;
  total_lessons: number;
  days: ApiMonthlyDay[];
};

type MonthlyPlanApiResponse = {
  status?: boolean;
  message?: string;
  data?: MonthlyPlanApiData | [];
};

function buildLessonsFromPeriods(periods: ApiMonthlyPeriod[]): Lesson[] {
  return periods.map((period) => {
    const meta = monthlyStatusMeta(period.status);
    return {
      periodId: period.period_id,
      subjectId: period.subject_id,
      subject: period.subject_name ?? '',
      period: `Period ${period.period_slot}`,
      periodSlot: period.period_slot,
      title: period.topic || 'Planned classroom session',
      room: period.teacher_name,
      status: meta.label,
      statusClassName: meta.className,
      accent: '#2f7dd9',
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    };
  });
}

<<<<<<< HEAD
=======
/** Mon-Fri grid for a calendar month, padded with nulls outside the month. */
function buildWeekdayGrid(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const daysFromMonday = (first.getDay() + 6) % 7;
  const cursor = new Date(first);
  cursor.setDate(first.getDate() - daysFromMonday);

  const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const weeks: Array<Array<{ date: number | null; iso: string | null; weekday: string }>> = [];

  while (cursor <= last) {
    const week: Array<{ date: number | null; iso: string | null; weekday: string }> = [];
    for (let i = 0; i < 5; i += 1) {
      const inMonth = cursor.getMonth() === month - 1;
      week.push({
        date: inMonth ? cursor.getDate() : null,
        iso: inMonth
          ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
          : null,
        weekday: weekdayNames[i],
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    cursor.setDate(cursor.getDate() + 2);
  }

  return weeks;
}

>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
function LessonPill({ event }: { event: CalendarEvent }) {
  const style = eventStyles[event.style];

  return (
    <div
      className="flex h-5 min-w-0 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold leading-5"
      style={{ backgroundColor: style.bg, color: style.text }}
      title={event.label}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: style.dot }} />
      <span className="truncate">{event.label}</span>
    </div>
  );
}

function HeaderButton({
  children,
  className = '',
  ariaLabel,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#ddd9d2] bg-white px-3 text-sm font-semibold text-[#2d2924] shadow-sm transition-colors hover:bg-[#f1f0ed] ${className}`}
    >
      {children}
    </button>
  );
}

function FilterCheckCard({
  children,
  checked = true,
}: {
  children: ReactNode;
  checked?: boolean;
}) {
  return (
    <label
      className={`flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors ${
        checked
          ? 'border-[#4e9eff] bg-[#e3f0ff] text-[#2d3748]'
          : 'border-[#d7d3cd] bg-white text-[#2d2924]'
      }`}
    >
      <input
        type="checkbox"
        defaultChecked={checked}
        className="h-3.5 w-3.5 rounded border-[#c9c4bd] accent-[#2f7dd9]"
      />
      {children}
    </label>
  );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#77716b]">{title}</h3>
      {children}
    </section>
  );
}

<<<<<<< HEAD
function SelectControl({
  label,
  defaultValue,
  placeholder,
  children,
}: {
  label: string;
  defaultValue: string;
  placeholder?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#66615b]">{label}</span>
      <span className="relative block">
        <select
          defaultValue={defaultValue}
          className="h-10 w-full appearance-none rounded-lg border border-[#d7d3cd] bg-white px-3 pr-10 text-sm text-[#27231f] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9a958e]"
        />
      </span>
    </label>
  );
}

function TextInput({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
=======
function TextInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#66615b]">{label}</span>
      <input
        placeholder={placeholder}
<<<<<<< HEAD
=======
        value={value}
        onChange={onChange}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
        className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#27231f] outline-none transition-colors placeholder:text-[#817c75] focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
      />
    </label>
  );
}

function FilterSyllabusDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-syllabus-title"
      onMouseDown={onClose}
    >
      <form
        className="max-h-[calc(100vh-48px)] w-full max-w-[376px] overflow-y-auto rounded-[14px] bg-white px-6 py-7 shadow-[0_24px_70px_rgba(23,22,15,0.28)]"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 id="filter-syllabus-title" className="text-lg font-semibold tracking-[0] text-[#24211d]">
            Filter syllabus
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d7d3cd] bg-[#f1f0ed] text-[#6f6a63] transition-colors hover:bg-[#e7e5e1] hover:text-[#27231f]"
            aria-label="Close filter syllabus dialog"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
          <FilterSection title="Subjects">
            <div className="grid grid-cols-2 gap-1.5">
              {filterSubjects.map((subject) => (
                <FilterCheckCard key={subject.name}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: subject.color }} />
                  <span className="truncate">{subject.name}</span>
                </FilterCheckCard>
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Grade / Class">
            <div className="grid grid-cols-2 gap-1.5">
              {filterGrades.map((grade) => (
                <FilterCheckCard key={grade}>{grade}</FilterCheckCard>
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Topic Status">
            <div className="grid grid-cols-2 gap-1.5">
              {filterStatuses.map((status) => (
                <FilterCheckCard key={status.name} checked={status.checked}>
                  {status.name}
                </FilterCheckCard>
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Month Range">
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1.5 block text-xs font-medium text-[#77716b]">From</span>
                <select
                  defaultValue="May 2026"
                  className="h-9 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-xs text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
                >
                  {filterMonthOptions.map((month) => (
                    <option key={month}>{month}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-[#77716b]">To</span>
                <select
                  defaultValue="June 2026"
                  className="h-9 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-xs text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
                >
                  {filterMonthOptions.map((month) => (
                    <option key={month}>{month}</option>
                  ))}
                </select>
              </label>
            </div>
          </FilterSection>

          <FilterSection title="Completion % Range">
            <div className="flex items-center gap-3 text-xs font-medium text-[#9a958e]">
              <span>0%</span>
              <div className="relative h-5 flex-1">
                <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[#a7a29b]" />
                <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-[#2f7dd9]" />
                <span className="absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-[#2f7dd9]" />
                <span className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-[#2f7dd9]" />
              </div>
              <span>100%</span>
            </div>
          </FilterSection>

          <FilterSection title="Quick Tags">
            <div className="flex flex-wrap gap-1.5">
              {quickTags.map((tag) => (
                <button
                  key={tag.label}
                  type="button"
                  className={`h-7 rounded-full border px-3 text-[11px] font-medium transition-colors ${
                    tag.active
                      ? 'border-[#4e9eff] bg-[#e3f0ff] text-[#0f4c8a]'
                      : 'border-[#d7d3cd] bg-white text-[#2d2924] hover:bg-[#f1f0ed]'
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </FilterSection>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-[#e7e3dd] pt-4">
          <button
            type="button"
            className="h-9 rounded-lg border border-[#d7d3cd] bg-white px-4 text-sm font-semibold text-[#4a453f] transition-colors hover:bg-[#f1f0ed]"
          >
            Clear all
          </button>
          <button
            type="submit"
            className={`h-9 rounded-lg px-4 text-sm font-semibold transition-colors ${primaryActionClassName}`}
          >
            Apply filters
          </button>
        </div>
      </form>
    </div>
  );
}

<<<<<<< HEAD
function AddLessonDialog({ onClose }: { onClose: () => void }) {
=======
type ChapterOption = { chapter_id: number; chapter_name: string };
type PeriodOption = { period_id: number; title: string; short_name: string };

function useChapterOptions(session: SessionLike, standardId: string, subjectId: string) {
  const [chapters, setChapters] = useState<ChapterOption[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      if (!session.subInstituteId || !session.syear || !standardId || !subjectId) {
        setChapters([]);
        return;
      }

      try {
        const params = new URLSearchParams({
          sub_institute_id: session.subInstituteId,
          syear: session.syear,
          standard_id: standardId,
          subject_id: subjectId,
        });
        const response = await fetch(`${session.baseUrl}/api/intelligence/lesson-plan-lookup/chapters?${params}`, {
          signal: controller.signal,
          headers: createAuthHeaders(session),
        });
        const payload = await response.json().catch(() => ({}));
        setChapters(Array.isArray(payload?.data) ? payload.data : []);
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') setChapters([]);
      }
    })();

    return () => controller.abort();
  }, [session, standardId, subjectId]);

  return chapters;
}

function usePeriodOptions(session: SessionLike) {
  const [periods, setPeriods] = useState<PeriodOption[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      if (!session.subInstituteId) {
        setPeriods([]);
        return;
      }

      try {
        const params = new URLSearchParams({ sub_institute_id: session.subInstituteId });
        const response = await fetch(`${session.baseUrl}/api/intelligence/lesson-plan-lookup/periods?${params}`, {
          signal: controller.signal,
          headers: createAuthHeaders(session),
        });
        const payload = await response.json().catch(() => ({}));
        setPeriods(Array.isArray(payload?.data) ? payload.data : []);
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') setPeriods([]);
      }
    })();

    return () => controller.abort();
  }, [session]);

  return periods;
}

function AddLessonDialog({
  session,
  standardId,
  divisionId,
  defaultDateIso,
  onClose,
  onSaved,
}: {
  session: SessionLike;
  standardId: string;
  divisionId: string;
  defaultDateIso: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [classFilters, setClassFilters] = useState<Partial<SearchDropdownValues>>({ standard: standardId });
  const subjectId = readDropdownValue(classFilters.subject);
  const chapters = useChapterOptions(session, standardId, subjectId);
  const periods = usePeriodOptions(session);

  const [chapterId, setChapterId] = useState('');
  const [chapterFreeText, setChapterFreeText] = useState('');
  const [scheduledDate, setScheduledDate] = useState(defaultDateIso);
  const [periodId, setPeriodId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the chapter choice whenever the subject changes (render-time state
  // adjustment, not an effect - avoids an extra render pass).
  const [subjectIdForChapterReset, setSubjectIdForChapterReset] = useState(subjectId);
  if (subjectId !== subjectIdForChapterReset) {
    setSubjectIdForChapterReset(subjectId);
    setChapterId('');
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!divisionId) {
      setError('Select a Division in the class picker above the calendar first - a lesson must belong to one specific division.');
      return;
    }
    if (!subjectId || !scheduledDate || !periodId) {
      setError('Subject, date and period are all required.');
      return;
    }
    const dayOfWeek = new Date(`${scheduledDate}T00:00:00`).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      setError('The monthly calendar only shows weekdays - pick a Monday-Friday date.');
      return;
    }
    const selectedPeriod = periods.find((p) => String(p.period_id) === periodId);

    setIsSaving(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        sub_institute_id: session.subInstituteId,
        syear: session.syear,
        standard_id: standardId,
        division_id: divisionId,
        subject_id: subjectId,
        teacher_id: session.userId,
        scheduled_date: scheduledDate,
        period_id: periodId,
        period_slot: selectedPeriod?.short_name ?? periodId,
      });
      if (chapterId) params.set('chapter_id', chapterId);
      else if (chapterFreeText.trim()) params.set('chapter_name', chapterFreeText.trim());
      if (notes.trim()) params.set('teacher_notes', notes.trim());

      const response = await fetch(`${session.baseUrl}/api/intelligence/lesson-plan-periods`, {
        method: 'POST',
        headers: createAuthHeaders(session, 'application/x-www-form-urlencoded'),
        body: params,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.status === false) {
        throw new Error(payload?.message || `Failed to schedule the lesson (${response.status}).`);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to schedule the lesson.');
    } finally {
      setIsSaving(false);
    }
  };

>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-lesson-title"
      onMouseDown={onClose}
    >
      <form
        className="max-h-[calc(100vh-48px)] w-full max-w-[586px] overflow-y-auto rounded-[18px] bg-white px-8 py-8 shadow-[0_24px_70px_rgba(23,22,15,0.28)]"
        onMouseDown={(event) => event.stopPropagation()}
<<<<<<< HEAD
        onSubmit={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <div className="mb-7 flex items-start justify-between gap-4">
          <h2 id="add-lesson-title" className="text-xl font-semibold tracking-[0] text-[#17160f]">
            Add new topic
=======
        onSubmit={handleSubmit}
      >
        <div className="mb-7 flex items-start justify-between gap-4">
          <h2 id="add-lesson-title" className="text-xl font-semibold tracking-[0] text-[#17160f]">
            Add lesson
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d7d3cd] bg-[#f1f0ed] text-[#6f6a63] transition-colors hover:bg-[#e7e5e1] hover:text-[#27231f]"
            aria-label="Close add lesson dialog"
          >
            <X size={22} />
          </button>
        </div>

<<<<<<< HEAD
        <div className="grid gap-x-3 gap-y-5 sm:grid-cols-2">
          <SelectControl label="Subject *" defaultValue="" placeholder="Select subject...">
            {dialogSubjects.map((subject) => (
              <option key={subject}>{subject}</option>
            ))}
          </SelectControl>

          <SelectControl label="Grade / Class *" defaultValue="Grade 8">
            <option>Grade 6</option>
            <option>Grade 7</option>
            <option>Grade 8</option>
            <option>Grade 9</option>
            <option>Grade 10</option>
          </SelectControl>

          <div className="sm:col-span-2">
            <TextInput label="Topic name *" placeholder="e.g. Quadratic equations" />
          </div>

          <SelectControl label="Start month *" defaultValue="July">
            {dialogMonths.map((month) => (
              <option key={month}>{month}</option>
            ))}
          </SelectControl>

          <SelectControl label="End month *" defaultValue="July">
            {dialogMonths.map((month) => (
              <option key={month}>{month}</option>
            ))}
          </SelectControl>

          <TextInput label="Estimated lessons" placeholder="e.g. 8" />
          <TextInput label="Room / Location" placeholder="e.g. Room 12" />

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-medium text-[#66615b]">Learning objectives</span>
            <textarea
              placeholder="Enter key learning objectives for this topic..."
              className="min-h-[90px] w-full resize-y rounded-lg border border-[#d7d3cd] bg-white px-3 py-2.5 text-sm leading-5 text-[#27231f] outline-none transition-colors placeholder:text-[#817c75] focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>

          <div className="sm:col-span-2">
            <TextInput label="Resources (optional)" placeholder="Paste a link or enter file name..." />
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2.5 text-sm font-medium text-[#66615b]">Colour label</div>
          <div className="flex items-center gap-3">
            {dialogColours.map((colour, index) => (
              <button
                key={colour}
                type="button"
                className={`h-7 w-7 rounded-full ${index === 1 ? 'ring-2 ring-[#17160f] ring-offset-2' : ''}`}
                style={{ backgroundColor: colour }}
                aria-label={`Use colour label ${index + 1}`}
              />
            ))}
          </div>
=======
        {error && (
          <div className="mb-4 rounded-lg bg-[#fde7e7] px-3 py-2 text-sm text-[#a33636]">{error}</div>
        )}

        {!divisionId && !error && (
          <div className="mb-4 rounded-lg bg-[#fde9c9] px-3 py-2 text-sm text-[#754a0f]">
            Select a Division in the class picker above the calendar before adding a lesson.
          </div>
        )}

        <div className="grid gap-x-3 gap-y-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <SearchDropdown
              fields={['subject']}
              values={classFilters}
              onChange={setClassFilters}
              labels={{ subject: 'Subject *' }}
              required={{ subject: true }}
            />
          </div>

          {chapters.length > 0 ? (
            <div className="sm:col-span-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#66615b]">Chapter</span>
                <span className="relative block">
                  <select
                    value={chapterId}
                    onChange={(event) => setChapterId(event.target.value)}
                    className="h-10 w-full appearance-none rounded-lg border border-[#d7d3cd] bg-white px-3 pr-10 text-sm text-[#27231f] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
                  >
                    <option value="">Select chapter...</option>
                    {chapters.map((chapter) => (
                      <option key={chapter.chapter_id} value={chapter.chapter_id}>
                        {chapter.chapter_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9a958e]" />
                </span>
              </label>
            </div>
          ) : (
            <div className="sm:col-span-2">
              <TextInput
                label="Topic name"
                placeholder="e.g. Quadratic equations"
                value={chapterFreeText}
                onChange={(event) => setChapterFreeText(event.target.value)}
              />
            </div>
          )}

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#66615b]">Date *</span>
            <input
              type="date"
              value={scheduledDate}
              onChange={(event) => setScheduledDate(event.target.value)}
              required
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#27231f] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#66615b]">Period *</span>
            <span className="relative block">
              <select
                value={periodId}
                onChange={(event) => setPeriodId(event.target.value)}
                required
                className="h-10 w-full appearance-none rounded-lg border border-[#d7d3cd] bg-white px-3 pr-10 text-sm text-[#27231f] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
              >
                <option value="" disabled>Select period...</option>
                {periods.map((period) => (
                  <option key={period.period_id} value={period.period_id}>
                    {period.title}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9a958e]" />
            </span>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-medium text-[#66615b]">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Anything the teacher should know for this lesson..."
              className="min-h-[90px] w-full resize-y rounded-lg border border-[#d7d3cd] bg-white px-3 py-2.5 text-sm leading-5 text-[#27231f] outline-none transition-colors placeholder:text-[#817c75] focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-[#e7e3dd] pt-5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-[#d7d3cd] bg-white px-4 text-sm font-semibold text-[#4a453f] transition-colors hover:bg-[#f1f0ed]"
          >
            Cancel
          </button>
          <button
            type="submit"
<<<<<<< HEAD
            className={`h-9 rounded-lg px-4 text-sm font-semibold transition-colors ${primaryActionClassName}`}
          >
            Add topic
=======
            disabled={isSaving || !divisionId}
            className={`h-9 rounded-lg px-4 text-sm font-semibold transition-colors disabled:opacity-60 ${primaryActionClassName}`}
          >
            {isSaving ? 'Scheduling...' : 'Add lesson'}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
          </button>
        </div>
      </form>
    </div>
  );
}

<<<<<<< HEAD
export default function MonthlyPlanPage() {
  const [selectedDate, setSelectedDate] = useState(21);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isAddLessonDialogOpen, setIsAddLessonDialogOpen] = useState(false);

  const selectedDay = useMemo(() => {
    return calendarWeeks.flatMap((week) => week.days).find((day) => day.date === selectedDate) ?? calendarWeeks[3].days[2];
  }, [selectedDate]);

  const selectedLessons = selectedDay.lessons ?? buildLessonsFromEvents(selectedDay);

  return (
    <div className="min-h-full  px-4 py-4 text-[#27231f] sm:px-6 lg:px-7">
      {isFilterDialogOpen && <FilterSyllabusDialog onClose={() => setIsFilterDialogOpen(false)} />}
      {isAddLessonDialogOpen && <AddLessonDialog onClose={() => setIsAddLessonDialogOpen(false)} />}
=======
function EditLessonDialog({
  session,
  lesson,
  onClose,
  onSaved,
}: {
  session: SessionLike;
  lesson: Lesson;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<'not_started' | 'in_progress' | 'completed' | 'skipped'>(
    lesson.status === 'Ready' ? 'completed' : lesson.status === 'In progress' ? 'in_progress' : 'not_started'
  );
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        sub_institute_id: session.subInstituteId,
        status,
      });
      if (notes.trim()) params.set('teacher_notes', notes.trim());

      const response = await fetch(`${session.baseUrl}/api/intelligence/lesson-plan-periods/${lesson.periodId}/update`, {
        method: 'POST',
        headers: createAuthHeaders(session, 'application/x-www-form-urlencoded'),
        body: params,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.status === false) {
        throw new Error(payload?.message || `Failed to update the lesson (${response.status}).`);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update the lesson.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const params = new URLSearchParams({ sub_institute_id: session.subInstituteId });
      const response = await fetch(`${session.baseUrl}/api/intelligence/lesson-plan-periods/${lesson.periodId}/delete`, {
        method: 'POST',
        headers: createAuthHeaders(session, 'application/x-www-form-urlencoded'),
        body: params,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.status === false) {
        throw new Error(payload?.message || `Failed to delete the lesson (${response.status}).`);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete the lesson.');
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-lesson-title"
      onMouseDown={onClose}
    >
      <form
        className="w-full max-w-[480px] rounded-[18px] bg-white px-7 py-7 shadow-[0_24px_70px_rgba(23,22,15,0.28)]"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={handleSave}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 id="edit-lesson-title" className="text-lg font-semibold tracking-[0] text-[#17160f]">
            {lesson.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d7d3cd] bg-[#f1f0ed] text-[#6f6a63] transition-colors hover:bg-[#e7e5e1] hover:text-[#27231f]"
            aria-label="Close edit lesson dialog"
          >
            <X size={19} />
          </button>
        </div>

        {error && <div className="mb-4 rounded-lg bg-[#fde7e7] px-3 py-2 text-sm text-[#a33636]">{error}</div>}

        <p className="mb-4 text-sm text-[#706b64]">
          {lesson.subject} - {lesson.period}
        </p>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#66615b]">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#27231f] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            >
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="skipped">Skipped</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#66615b]">Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add a note about this lesson..."
              className="min-h-[80px] w-full resize-y rounded-lg border border-[#d7d3cd] bg-white px-3 py-2.5 text-sm leading-5 text-[#27231f] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-[#e7e3dd] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="h-9 rounded-lg bg-[#fde7e7] px-4 text-sm font-semibold text-[#a33636] transition-colors hover:bg-[#fbd9d9] disabled:opacity-60"
          >
            {isDeleting ? 'Deleting...' : 'Delete lesson'}
          </button>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-[#d7d3cd] bg-white px-4 text-sm font-semibold text-[#4a453f] transition-colors hover:bg-[#f1f0ed]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`h-9 rounded-lg px-4 text-sm font-semibold transition-colors disabled:opacity-60 ${primaryActionClassName}`}
            >
              {isSaving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function MonthlyPlanPage() {
  const session = useLmsSessionContext();
  const [classFilters, setClassFilters] = useState<Partial<SearchDropdownValues>>({ section: '', standard: '', division: '' });
  const [standardName, setStandardName] = useState('');
  const standardId = readDropdownValue(classFilters.standard);
  const divisionId = readDropdownValue(classFilters.division);

  const today = useMemo(() => new Date(), []);
  const [visibleYear, setVisibleYear] = useState(today.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(today.getMonth() + 1);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isAddLessonDialogOpen, setIsAddLessonDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [apiData, setApiData] = useState<MonthlyPlanApiData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      if (!session.subInstituteId || !session.syear || !standardId) {
        setApiData(null);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const params = new URLSearchParams({
          sub_institute_id: session.subInstituteId,
          syear: session.syear,
          standard_id: standardId,
          year: String(visibleYear),
          month: String(visibleMonth),
        });
        if (divisionId) params.set('division_id', divisionId);

        const response = await fetch(`${session.baseUrl}/api/intelligence/monthly-plan?${params}`, {
          method: 'GET',
          signal: controller.signal,
          headers: createAuthHeaders(session),
        });
        const payload = (await response.json().catch(() => ({}))) as MonthlyPlanApiResponse;

        if (response.status === 404) {
          setApiData(null);
          return;
        }
        if (!response.ok) {
          throw new Error(payload.message || `Monthly plan API failed with status ${response.status}`);
        }

        setApiData(Array.isArray(payload.data) ? null : payload.data ?? null);
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the monthly plan.');
        setApiData(null);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [session.baseUrl, session.subInstituteId, session.syear, session.token, standardId, divisionId, visibleYear, visibleMonth, refreshKey]);

  const daysByIso = useMemo(() => {
    const map = new Map<string, ApiMonthlyDay>();
    apiData?.days.forEach((day) => map.set(day.date, day));
    return map;
  }, [apiData]);

  const subjectOrder = useMemo(() => {
    const seen: number[] = [];
    apiData?.days.forEach((day) =>
      day.periods.forEach((period) => {
        if (period.subject_id != null && !seen.includes(period.subject_id)) seen.push(period.subject_id);
      })
    );
    return seen;
  }, [apiData]);

  const weeks = useMemo(() => buildWeekdayGrid(visibleYear, visibleMonth), [visibleYear, visibleMonth]);

  const calendarWeeks: CalendarWeek[] = useMemo(
    () =>
      weeks.map((week, weekIndex) => ({
        label: `Week ${weekIndex + 1}`,
        days: week.map((slot): CalendarDay => {
          const apiDay = slot.iso ? daysByIso.get(slot.iso) : undefined;
          return {
            date: slot.date,
            weekday: slot.weekday,
            events: (apiDay?.periods ?? []).map((period) => ({
              label: period.topic || period.subject_name || 'Lesson',
              style: styleForSubject(period.subject_id, subjectOrder),
            })),
            lessons: apiDay ? buildLessonsFromPeriods(apiDay.periods) : undefined,
          };
        }),
      })),
    [weeks, daysByIso, subjectOrder]
  );

  const todayIso = useMemo(
    () => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    [today]
  );

  const flatDayEntries = useMemo(
    () =>
      calendarWeeks.flatMap((week, weekIndex) =>
        week.days.map((day, dayIndex) => ({ day, iso: weeks[weekIndex]?.[dayIndex]?.iso ?? null }))
      ).filter((entry) => entry.day.date !== null),
    [calendarWeeks, weeks]
  );

  const selectedDay =
    flatDayEntries.find((entry) => entry.iso === selectedIso)?.day ??
    flatDayEntries.find((entry) => entry.iso === todayIso)?.day ??
    flatDayEntries[0]?.day ??
    null;

  const selectedLessons = selectedDay?.lessons ?? [];
  const monthLabel = apiData?.month ?? new Date(visibleYear, visibleMonth - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const gradeLabel = standardName || (standardId ? `Grade ${standardId}` : 'Your class');

  const goToPreviousMonth = () => {
    setSelectedIso(null);
    setVisibleMonth((m) => {
      if (m === 1) {
        setVisibleYear((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  };

  const goToNextMonth = () => {
    setSelectedIso(null);
    setVisibleMonth((m) => {
      if (m === 12) {
        setVisibleYear((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  };

  return (
    <RequireStaff>
    <div className="min-h-full  px-4 py-4 text-[#27231f] sm:px-6 lg:px-7">
      {isFilterDialogOpen && <FilterSyllabusDialog onClose={() => setIsFilterDialogOpen(false)} />}
      {isAddLessonDialogOpen && (
        <AddLessonDialog
          session={session}
          standardId={standardId}
          divisionId={divisionId}
          defaultDateIso={selectedIso ?? todayIso}
          onClose={() => setIsAddLessonDialogOpen(false)}
          onSaved={() => setRefreshKey((key) => key + 1)}
        />
      )}
      {editingLesson && (
        <EditLessonDialog
          session={session}
          lesson={editingLesson}
          onClose={() => setEditingLesson(null)}
          onSaved={() => setRefreshKey((key) => key + 1)}
        />
      )}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-tight tracking-[0] text-[#26231f]">
<<<<<<< HEAD
            May 2026 - Monthly detail
          </h1>
          <p className="mt-1 text-sm font-medium text-[#716b64]">
            Grade 8 - All subjects - 42 lessons this month
          </p>
=======
            {monthLabel} - Monthly detail
          </h1>
          <p className="mt-1 text-sm font-medium text-[#716b64]">
            {!standardId
              ? 'Pick a class below to load its monthly plan.'
              : `${gradeLabel} - All subjects - ${isLoading ? 'loading...' : `${apiData?.total_lessons ?? 0} lessons this month`}`}
          </p>
          
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
<<<<<<< HEAD
            <HeaderButton className="w-9 px-0" ariaLabel="Previous month">
              <ChevronLeft size={18} />
            </HeaderButton>
            <HeaderButton className="w-9 px-0" ariaLabel="Next month">
=======
            <HeaderButton className="w-9 px-0" ariaLabel="Previous month" onClick={goToPreviousMonth}>
              <ChevronLeft size={18} />
            </HeaderButton>
            <select
              aria-label="Month"
              value={visibleMonth}
              onChange={(event) => {
                setSelectedIso(null);
                setVisibleMonth(Number(event.target.value));
              }}
              className="h-9 rounded-lg border border-[#ddd9d2] bg-white px-2 text-sm font-semibold text-[#2d2924]"
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((monthNumber) => (
                <option key={monthNumber} value={monthNumber}>
                  {new Date(2000, monthNumber - 1, 1).toLocaleDateString('en-GB', { month: 'long' })}
                </option>
              ))}
            </select>
            <select
              aria-label="Year"
              value={visibleYear}
              onChange={(event) => {
                setSelectedIso(null);
                setVisibleYear(Number(event.target.value));
              }}
              className="h-9 rounded-lg border border-[#ddd9d2] bg-white px-2 text-sm font-semibold text-[#2d2924]"
            >
              {Array.from({ length: 6 }, (_, index) => today.getFullYear() - 3 + index).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <HeaderButton className="w-9 px-0" ariaLabel="Next month" onClick={goToNextMonth}>
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
              <ChevronRight size={18} />
            </HeaderButton>
          </div>
          <HeaderButton onClick={() => setIsFilterDialogOpen(true)}>
            <Filter size={15} />
            Filter
          </HeaderButton>
          <HeaderButton>
            <Download size={15} />
            Export
          </HeaderButton>
          <button
            type="button"
            onClick={() => setIsAddLessonDialogOpen(true)}
            className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--primary-blue)] px-4 text-sm font-semibold shadow-sm transition-colors ${primaryActionClassName}`}
            aria-label="Add lesson"
          >
            <Plus size={17} />
            Add lesson
          </button>
        </div>
      </div>

<<<<<<< HEAD
=======
      <section className="mb-4 rounded-lg border border-[#ddd9d2] bg-white p-4 shadow-[0_8px_18px_rgba(23,22,15,0.08)]">
        <div className="grid gap-3 sm:grid-cols-3 md:max-w-2xl">
          <SearchDropdown
            fields={classPickerFields}
            values={classFilters}
            className="w-200"
            onChange={setClassFilters}
            onStandardChange={(_value, rows) => setStandardName(rows[0]?.name ?? '')}
          />
        </div>
      </section>

>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
      <section className="rounded-lg border border-[#ddd9d2] bg-white p-4 shadow-[0_14px_30px_rgba(23,22,15,0.10)]">
        <div className="overflow-x-auto pb-0.5">
          <div className="min-w-[1160px]">
            <div
              className="mb-2 grid items-end gap-1.5"
              style={{ gridTemplateColumns: '44px repeat(5, minmax(190px, 1fr))' }}
            >
              <div />
              {weekdays.map((weekday) => (
                <div key={weekday} className="text-center text-[11px] font-bold text-[#aaa49c]">
                  {weekday}
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
<<<<<<< HEAD
              {calendarWeeks.map((week) => (
=======
              {calendarWeeks.map((week, weekIndex) => (
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
                <div
                  key={week.label}
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: '44px repeat(5, minmax(190px, 1fr))' }}
                >
<<<<<<< HEAD
                  <div className="flex h-[104px] items-center justify-center text-[11px] font-bold text-[#aaa49c]">
                    {week.label}
                  </div>

                  {week.days.map((day) => {
=======
                  <div className="flex min-h-[104px] items-center justify-center text-[11px] font-bold text-[#aaa49c]">
                    {week.label}
                  </div>

                  {week.days.map((day, dayIndex) => {
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
                    if (day.date === null) {
                      return (
                        <div
                          key={`${week.label}-${day.weekday}`}
<<<<<<< HEAD
                          className="h-[104px] rounded-lg border border-[#ddd9d2] bg-[#ebe9e7]"
=======
                          className="min-h-[104px] rounded-lg border border-[#ddd9d2] bg-[#ebe9e7]"
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
                          aria-hidden="true"
                        />
                      );
                    }

                    const calendarDate = day.date;
<<<<<<< HEAD
                    const isSelected = calendarDate === selectedDate;
=======
                    const dayIso = weeks[weekIndex]?.[dayIndex]?.iso ?? null;
                    const isSelected = dayIso !== null && dayIso === (selectedIso ?? todayIso);
                    const visibleEvents = day.events.slice(0, 4);
                    const hiddenCount = day.events.length - visibleEvents.length;
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

                    return (
                      <button
                        key={calendarDate}
                        type="button"
<<<<<<< HEAD
                        onClick={() => setSelectedDate(calendarDate)}
                        className={`h-[104px] rounded-lg border border-[#ddd9d2] bg-white p-2 text-left transition-colors hover:bg-[#f8fbff] ${
=======
                        onClick={() => setSelectedIso(dayIso)}
                        className={`min-h-[104px] rounded-lg border border-[#ddd9d2] bg-white p-2 text-left transition-colors hover:bg-[#f8fbff] ${
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
                          isSelected ? 'bg-[#e4f1ff] ring-2 ring-inset ring-[#2f7dd9]' : ''
                        }`}
                      >
                        <span
                          className={`mb-2 flex h-6 w-6 items-center justify-center text-sm font-semibold ${
                            isSelected
                              ? 'rounded-full bg-[#2f7dd9] text-white'
                              : 'text-[#77716b]'
                          }`}
                        >
                          {calendarDate}
                        </span>

                        <div className="space-y-1.5">
<<<<<<< HEAD
                          {day.events.map((event, eventIndex) => (
                            <LessonPill key={`${calendarDate}-${event.label}-${eventIndex}`} event={event} />
                          ))}
=======
                          {visibleEvents.map((event, eventIndex) => (
                            <LessonPill key={`${calendarDate}-${event.label}-${eventIndex}`} event={event} />
                          ))}
                          {hiddenCount > 0 && (
                            <div className="px-1 text-[11px] font-semibold text-[#9a958e]">+{hiddenCount} more</div>
                          )}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-[#ddd9d2] bg-white p-4 shadow-[0_14px_30px_rgba(23,22,15,0.10)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-[0] text-[#26231f]">
<<<<<<< HEAD
            {selectedDay.weekday}, {selectedDay.date} May - Today&apos;s lessons
=======
            {selectedDay ? `${selectedDay.weekday}, ${selectedDay.date} - Lessons` : 'Lessons'}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
          </h2>
          <span className="rounded-full bg-[#e7f1ff] px-2.5 py-1 text-xs font-semibold text-[#1d5ea8]">
            {selectedLessons.length} lessons
          </span>
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
<<<<<<< HEAD
          {selectedLessons.map((lesson) => (
            <article
              key={`${lesson.subject}-${lesson.period}-${lesson.title}`}
              className="min-h-[94px] rounded-lg bg-[#efeeec] px-4 py-3"
=======
          {selectedLessons.length === 0 && (
            <div className="col-span-full rounded-lg bg-[#efeeec] px-4 py-6 text-center text-sm text-[#9a958e]">
              {isLoading ? 'Loading lessons...' : loadError || 'No lessons scheduled on this day.'}
            </div>
          )}
          {selectedLessons.map((lesson) => (
            <button
              type="button"
              key={lesson.periodId}
              onClick={() => setEditingLesson(lesson)}
              className="min-h-[94px] rounded-lg bg-[#efeeec] px-4 py-3 text-left transition-colors hover:bg-[#e7e5e1]"
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
              style={{ borderLeft: `4px solid ${lesson.accent}` }}
            >
              <div className="text-sm font-bold" style={{ color: lesson.accent }}>
                {lesson.subject} - {lesson.period}
              </div>
              <div className="mt-1 truncate text-sm font-medium text-[#77716b]">{lesson.title}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[#9a958e]">
                <span className="inline-flex items-center gap-1">
<<<<<<< HEAD
                  <MapPin size={12} className="text-[#e04472]" />
=======
                  <User size={12} className="text-[#e04472]" />
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
                  {lesson.room}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${lesson.statusClassName}`}>
                  {lesson.status}
                </span>
              </div>
<<<<<<< HEAD
            </article>
=======
            </button>
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
          ))}
        </div>
      </section>
    </div>
<<<<<<< HEAD
=======
    </RequireStaff>
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  );
}
