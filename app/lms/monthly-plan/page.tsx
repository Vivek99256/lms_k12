'use client';

import { type ReactNode, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Download, Filter, MapPin, Plus, X } from 'lucide-react';
import RequireStaff from '@/app/lms/_shared/RequireStaff';

type EventStyleKey = 'math' | 'science' | 'english' | 'history' | 'geography' | 'art' | 'revision' | 'neutral';

type CalendarEvent = {
  label: string;
  style: EventStyleKey;
};

type Lesson = {
  subject: string;
  period: string;
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

const dialogSubjects = ['Mathematics', 'Science', 'English', 'History', 'Geography', 'Art'];
const dialogMonths = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];
const dialogColours = ['#2f7dd9', '#18a379', '#7468d9', '#b87916', '#d45628', '#c64a74'];
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
    };
  });
}

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
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#66615b]">{label}</span>
      <input
        placeholder={placeholder}
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

function AddLessonDialog({ onClose }: { onClose: () => void }) {
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
        onSubmit={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <div className="mb-7 flex items-start justify-between gap-4">
          <h2 id="add-lesson-title" className="text-xl font-semibold tracking-[0] text-[#17160f]">
            Add new topic
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
            className={`h-9 rounded-lg px-4 text-sm font-semibold transition-colors ${primaryActionClassName}`}
          >
            Add topic
          </button>
        </div>
      </form>
    </div>
  );
}

export default function MonthlyPlanPage() {
  const [selectedDate, setSelectedDate] = useState(21);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isAddLessonDialogOpen, setIsAddLessonDialogOpen] = useState(false);

  const selectedDay = useMemo(() => {
    return calendarWeeks.flatMap((week) => week.days).find((day) => day.date === selectedDate) ?? calendarWeeks[3].days[2];
  }, [selectedDate]);

  const selectedLessons = selectedDay.lessons ?? buildLessonsFromEvents(selectedDay);

  return (
    <RequireStaff>
    <div className="min-h-full  px-4 py-4 text-[#27231f] sm:px-6 lg:px-7">
      {isFilterDialogOpen && <FilterSyllabusDialog onClose={() => setIsFilterDialogOpen(false)} />}
      {isAddLessonDialogOpen && <AddLessonDialog onClose={() => setIsAddLessonDialogOpen(false)} />}

      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-tight tracking-[0] text-[#26231f]">
            May 2026 - Monthly detail
          </h1>
          <p className="mt-1 text-sm font-medium text-[#716b64]">
            Grade 8 - All subjects - 42 lessons this month
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <HeaderButton className="w-9 px-0" ariaLabel="Previous month">
              <ChevronLeft size={18} />
            </HeaderButton>
            <HeaderButton className="w-9 px-0" ariaLabel="Next month">
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
              {calendarWeeks.map((week) => (
                <div
                  key={week.label}
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: '44px repeat(5, minmax(190px, 1fr))' }}
                >
                  <div className="flex h-[104px] items-center justify-center text-[11px] font-bold text-[#aaa49c]">
                    {week.label}
                  </div>

                  {week.days.map((day) => {
                    if (day.date === null) {
                      return (
                        <div
                          key={`${week.label}-${day.weekday}`}
                          className="h-[104px] rounded-lg border border-[#ddd9d2] bg-[#ebe9e7]"
                          aria-hidden="true"
                        />
                      );
                    }

                    const calendarDate = day.date;
                    const isSelected = calendarDate === selectedDate;

                    return (
                      <button
                        key={calendarDate}
                        type="button"
                        onClick={() => setSelectedDate(calendarDate)}
                        className={`h-[104px] rounded-lg border border-[#ddd9d2] bg-white p-2 text-left transition-colors hover:bg-[#f8fbff] ${
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
                          {day.events.map((event, eventIndex) => (
                            <LessonPill key={`${calendarDate}-${event.label}-${eventIndex}`} event={event} />
                          ))}
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
            {selectedDay.weekday}, {selectedDay.date} May - Today&apos;s lessons
          </h2>
          <span className="rounded-full bg-[#e7f1ff] px-2.5 py-1 text-xs font-semibold text-[#1d5ea8]">
            {selectedLessons.length} lessons
          </span>
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          {selectedLessons.map((lesson) => (
            <article
              key={`${lesson.subject}-${lesson.period}-${lesson.title}`}
              className="min-h-[94px] rounded-lg bg-[#efeeec] px-4 py-3"
              style={{ borderLeft: `4px solid ${lesson.accent}` }}
            >
              <div className="text-sm font-bold" style={{ color: lesson.accent }}>
                {lesson.subject} - {lesson.period}
              </div>
              <div className="mt-1 truncate text-sm font-medium text-[#77716b]">{lesson.title}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[#9a958e]">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} className="text-[#e04472]" />
                  {lesson.room}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${lesson.statusClassName}`}>
                  {lesson.status}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
    </RequireStaff>
  );
}
