'use client';

import { type ReactNode, useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock,
  FileText,
  Filter,
  Link2,
  MapPin,
  Pencil,
  Plus,
  X,
} from 'lucide-react';

type ResourceKind = 'pdf' | 'link' | 'doc';

type LessonResource = {
  title: string;
  detail: string;
  kind: ResourceKind;
};

type Lesson = {
  id: string;
  subject: string;
  subjectColor: string;
  grade: string;
  date: string;
  dateLabel: string;
  period: string;
  time: string;
  room: string;
  title: string;
  unit: string;
  duration: string;
  status: string;
  materialStatus: string;
  notes: string;
  homework: string;
  objectives: string[];
  resources: LessonResource[];
};

const lessons: Lesson[] = [
  {
    id: 'mathematics-derivatives',
    subject: 'Mathematics',
    subjectColor: '#0f4c8a',
    grade: 'Grade 8',
    date: '21 May',
    dateLabel: 'Wednesday, 21 May 2026',
    period: 'Period 2',
    time: '9:30-10:20 AM',
    room: 'Room 14',
    title: 'Calculus - Introduction to derivatives',
    unit: 'Calculus unit',
    duration: '50 min',
    status: 'In progress',
    materialStatus: 'Materials ready',
    notes:
      'Begin with a recap of limits from last week. Introduce the concept of instantaneous rate of change using real-world examples (speed, temperature). Walk through the formal definition and work three examples at the board before group practice.',
    homework: 'Exercise 6.2 - Questions 1-10 (page 84). Due Friday 23 May.',
    objectives: [
      'Understand the concept of a derivative as a rate of change',
      'Apply first-principles differentiation to simple polynomials',
      'Interpret the gradient of a tangent line on a graph',
    ],
    resources: [
      { title: 'Derivatives worksheet - Set A', detail: 'PDF - 2 pages', kind: 'pdf' },
      { title: 'Desmos graphing tool - tangent lines', detail: 'External link', kind: 'link' },
      { title: 'Chapter 6 - Textbook notes', detail: 'Google Doc', kind: 'doc' },
    ],
  },
  {
    id: 'english-media-literacy',
    subject: 'English',
    subjectColor: '#4c40a5',
    grade: 'Grade 8',
    date: '21 May',
    dateLabel: 'Wednesday, 21 May 2026',
    period: 'Period 4',
    time: '11:30 AM-12:20 PM',
    room: 'Room 7',
    title: 'Media literacy - Analysing news sources',
    unit: 'Media literacy',
    duration: '50 min',
    status: 'Ready',
    materialStatus: 'Materials ready',
    notes:
      'Use a pair comparison of two current news articles. Students should identify author purpose, evidence, source credibility, and headline framing before writing a short reflection.',
    homework: 'Bring one printed or bookmarked article for source evaluation on Thursday.',
    objectives: [
      'Identify bias and author purpose in a news source',
      'Compare evidence quality across two articles',
      'Write a short credibility judgement with supporting reasons',
    ],
    resources: [
      { title: 'News source comparison sheet', detail: 'PDF - 1 page', kind: 'pdf' },
      { title: 'Class media checklist', detail: 'Google Doc', kind: 'doc' },
    ],
  },
  {
    id: 'science-ecosystems',
    subject: 'Science',
    subjectColor: '#0d6c55',
    grade: 'Grade 8',
    date: '22 May',
    dateLabel: 'Thursday, 22 May 2026',
    period: 'Period 1',
    time: '8:30-9:20 AM',
    room: 'Lab B',
    title: 'Revision - Ecosystems and biomes',
    unit: 'Ecology revision',
    duration: '50 min',
    status: 'Upcoming',
    materialStatus: 'Needs printout',
    notes:
      'Start with vocabulary retrieval, then use biome cards for a sorting activity. Close with a short exit quiz covering food webs, habitats, and adaptation.',
    homework: 'Revise ecosystem vocabulary and complete the food web worksheet.',
    objectives: [
      'Review key vocabulary for ecosystems and biomes',
      'Explain how organisms interact in a food web',
      'Connect adaptation examples to biome conditions',
    ],
    resources: [
      { title: 'Biome card sort', detail: 'PDF - 4 pages', kind: 'pdf' },
      { title: 'Food web starter quiz', detail: 'Google Doc', kind: 'doc' },
    ],
  },
  {
    id: 'history-cold-war',
    subject: 'History',
    subjectColor: '#74490d',
    grade: 'Grade 8',
    date: '22 May',
    dateLabel: 'Thursday, 22 May 2026',
    period: 'Period 3',
    time: '10:30-11:20 AM',
    room: 'Room 9',
    title: 'Cold War - Detente and arms race',
    unit: 'Cold War',
    duration: '50 min',
    status: 'Upcoming',
    materialStatus: 'Materials ready',
    notes:
      'Build a timeline of major arms-control agreements and tension points. Students should use evidence cards to debate whether detente reduced conflict.',
    homework: 'Write one paragraph explaining whether detente was successful.',
    objectives: [
      'Sequence key events in the Cold War arms race',
      'Define detente in historical context',
      'Use evidence to support a judgement about change over time',
    ],
    resources: [
      { title: 'Cold War evidence cards', detail: 'PDF - 3 pages', kind: 'pdf' },
      { title: 'Timeline reference', detail: 'External link', kind: 'link' },
    ],
  },
  {
    id: 'geography-development',
    subject: 'Geography',
    subjectColor: '#8a351c',
    grade: 'Grade 8',
    date: '23 May',
    dateLabel: 'Friday, 23 May 2026',
    period: 'Period 6',
    time: '1:30-2:20 PM',
    room: 'Room 3',
    title: 'Development - Human development index',
    unit: 'Development',
    duration: '50 min',
    status: 'Upcoming',
    materialStatus: 'Materials ready',
    notes:
      'Introduce HDI through country profiles. Students compare income, education, and life expectancy data before discussing why one number can hide local inequality.',
    homework: 'Complete the HDI comparison table for two assigned countries.',
    objectives: [
      'Describe the three parts of the human development index',
      'Compare development data between countries',
      'Explain one limitation of using HDI alone',
    ],
    resources: [
      { title: 'HDI country profile table', detail: 'Google Doc', kind: 'doc' },
      { title: 'UNDP HDI overview', detail: 'External link', kind: 'link' },
    ],
  },
  {
    id: 'art-portfolio',
    subject: 'Art',
    subjectColor: '#8b2549',
    grade: 'Grade 8',
    date: '23 May',
    dateLabel: 'Friday, 23 May 2026',
    period: 'Period 5',
    time: '12:30-1:20 PM',
    room: 'Studio 2',
    title: 'Exhibition prep - Final portfolio review',
    unit: 'Portfolio',
    duration: '50 min',
    status: 'Ready',
    materialStatus: 'Materials ready',
    notes:
      'Students review final pieces against the exhibition checklist, update artist statements, and mark any missing process evidence before peer feedback.',
    homework: 'Finish artist statement edits and photograph final portfolio pieces.',
    objectives: [
      'Evaluate portfolio work against exhibition criteria',
      'Revise artist statements for clarity',
      'Give constructive peer feedback using success criteria',
    ],
    resources: [
      { title: 'Portfolio review checklist', detail: 'PDF - 1 page', kind: 'pdf' },
      { title: 'Artist statement template', detail: 'Google Doc', kind: 'doc' },
    ],
  },
  {
    id: 'mathematics-rules',
    subject: 'Mathematics',
    subjectColor: '#0f4c8a',
    grade: 'Grade 8',
    date: '26 May',
    dateLabel: 'Monday, 26 May 2026',
    period: 'Period 2',
    time: '9:30-10:20 AM',
    room: 'Room 14',
    title: 'Calculus - Differentiation rules',
    unit: 'Calculus unit',
    duration: '50 min',
    status: 'Upcoming',
    materialStatus: 'Materials ready',
    notes:
      'Move from first principles to power rule shortcuts. Students should identify when each rule applies and practise a short mixed problem set.',
    homework: 'Complete practice questions 1-12 from the differentiation rules sheet.',
    objectives: [
      'Use the power rule for simple polynomial terms',
      'Select an efficient differentiation strategy',
      'Check answers by comparing with graph gradients',
    ],
    resources: [
      { title: 'Differentiation rules practice', detail: 'PDF - 2 pages', kind: 'pdf' },
      { title: 'Worked examples slide deck', detail: 'Google Doc', kind: 'doc' },
    ],
  },
];

const subjects = [
  { name: 'Mathematics', color: '#2f7dd9' },
  { name: 'English', color: '#7468d9' },
  { name: 'Science', color: '#18a379' },
  { name: 'History', color: '#b87916' },
  { name: 'Geography', color: '#d45628' },
  { name: 'Art', color: '#c64a74' },
];

const grades = ['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];
const periods = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6'];
const statusOptions = ['In progress', 'Ready', 'Upcoming', 'Completed'];
const addTopicMonths = [
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
];
const addTopicColourLabels = ['#2f7dd9', '#18a379', '#7468d9', '#b87916', '#d45628', '#c64a74'];
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

const resourceStyles: Record<ResourceKind, { icon: typeof FileText; className: string }> = {
  pdf: { icon: FileText, className: 'bg-[#f8dfd2] text-[#9a4423]' },
  link: { icon: Link2, className: 'bg-[#dcecff] text-[#1761a7]' },
  doc: { icon: BookOpen, className: 'bg-[#dff1e8] text-[#16755d]' },
};

function HeaderButton({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm font-semibold text-[#2d2924] shadow-sm transition-colors hover:bg-[#f1f0ed] ${className}`}
    >
      {children}
    </button>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-bold uppercase tracking-[0] text-[#aaa39c]">
      {children}
    </h2>
  );
}

function LessonChip({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${className}`}>
      {children}
    </span>
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
          ? 'border-[#4e9eff] bg-[#e3f0ff] text-[#1f2937]'
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
      <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6f675f]">{title}</h3>
      {children}
    </section>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[#706b64]">{label}</span>
      {children}
    </label>
  );
}

function TextInput({
  label,
  placeholder,
  defaultValue,
}: {
  label: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <FormField label={label}>
      <input
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors placeholder:text-[#8d8780] focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
      />
    </FormField>
  );
}

function SelectField({
  label,
  defaultValue,
  children,
}: {
  label: string;
  defaultValue: string;
  children: ReactNode;
}) {
  return (
    <FormField label={label}>
      <span className="relative block">
        <select
          defaultValue={defaultValue}
          className="h-10 w-full appearance-none rounded-lg border border-[#d7d3cd] bg-white px-3 pr-9 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#928c84]"
        />
      </span>
    </FormField>
  );
}

function DialogShell({
  children,
  title,
  onClose,
  widthClassName = 'max-w-[520px]',
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
  widthClassName?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${title.toLowerCase().replace(/\s+/g, '-')}-title`}
      onMouseDown={onClose}
    >
      <form
        className={`max-h-[calc(100vh-48px)] w-full overflow-y-auto rounded-lg bg-white px-6 py-6 shadow-[0_24px_70px_rgba(23,22,15,0.28)] ${widthClassName}`}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2
            id={`${title.toLowerCase().replace(/\s+/g, '-')}-title`}
            className="text-lg font-semibold tracking-[0] text-[#24211d]"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d7d3cd] bg-[#f1f0ed] text-[#6f6a63] transition-colors hover:bg-[#e7e5e1] hover:text-[#27231f]"
            aria-label={`Close ${title}`}
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </form>
    </div>
  );
}

function FilterLessonDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-syllabus-title"
      onMouseDown={onClose}
    >
      <form
        className="max-h-[calc(100vh-48px)] w-full max-w-[400px] overflow-y-auto rounded-[14px] bg-white px-7 py-7 shadow-[0_24px_70px_rgba(23,22,15,0.28)]"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 id="filter-syllabus-title" className="text-lg font-semibold tracking-[0] text-[#17160f]">
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
                <span className="relative block">
                  <select
                    defaultValue="May 2026"
                    className="h-9 w-full appearance-none rounded-lg border border-[#d7d3cd] bg-white px-3 pr-8 text-xs text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
                  >
                    {filterMonthOptions.map((month) => (
                      <option key={month}>{month}</option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9a958e]"
                  />
                </span>
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-[#77716b]">To</span>
                <span className="relative block">
                  <select
                    defaultValue="June 2026"
                    className="h-9 w-full appearance-none rounded-lg border border-[#d7d3cd] bg-white px-3 pr-8 text-xs text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
                  >
                    {filterMonthOptions.map((month) => (
                      <option key={month}>{month}</option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9a958e]"
                  />
                </span>
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
            className="h-9 rounded-lg bg-[#17160f] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#2a271f]"
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
    <DialogShell title="Add new topic" onClose={onClose} widthClassName="max-w-[520px]">
      <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
        <SelectField label="Subject *" defaultValue="">
          <option value="" disabled>
            Select subject...
          </option>
          {subjects.map((subject) => (
            <option key={subject.name}>{subject.name}</option>
          ))}
        </SelectField>

        <SelectField label="Grade / Class *" defaultValue="Grade 8">
          {grades.map((grade) => (
            <option key={grade}>{grade}</option>
          ))}
        </SelectField>

        <div className="sm:col-span-2">
          <TextInput label="Topic name *" placeholder="e.g. Quadratic equations" />
        </div>

        <SelectField label="Start month *" defaultValue="July">
          {addTopicMonths.map((month) => (
            <option key={month}>{month}</option>
          ))}
        </SelectField>

        <SelectField label="End month *" defaultValue="July">
          {addTopicMonths.map((month) => (
            <option key={month}>{month}</option>
          ))}
        </SelectField>

        <TextInput label="Estimated lessons" placeholder="e.g. 8" />
        <TextInput label="Room / Location" placeholder="e.g. Room 12" />

        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-[#706b64]">Learning objectives</span>
          <textarea
            placeholder="Enter key learning objectives for this topic..."
            className="min-h-[80px] w-full resize-y rounded-lg border border-[#d7d3cd] bg-white px-3 py-2.5 text-sm leading-5 text-[#2b2723] outline-none transition-colors placeholder:text-[#8d8780] focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
          />
        </label>

        <div className="sm:col-span-2">
          <TextInput label="Resources (optional)" placeholder="Paste a link or enter file name..." />
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2.5 text-sm font-medium text-[#706b64]">Colour label</div>
        <div className="flex items-center gap-3">
          {addTopicColourLabels.map((colour, index) => (
            <button
              key={colour}
              type="button"
              className={`h-6 w-6 rounded-full ${index === 1 ? 'ring-2 ring-[#17160f] ring-offset-2' : ''}`}
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
          className="h-9 rounded-lg bg-[#17160f] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#2a271f]"
        >
          Add topic
        </button>
      </div>
    </DialogShell>
  );
}

function EditLessonDialog({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const lessonMonth = lesson.date.split(' ')[1] ?? 'May';

  return (
    <DialogShell title="Edit topic" onClose={onClose} widthClassName="max-w-[586px]">
      <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
        <SelectField label="Subject" defaultValue={lesson.subject}>
          {subjects.map((subject) => (
            <option key={subject.name}>{subject.name}</option>
          ))}
        </SelectField>

        <SelectField label="Grade / Class" defaultValue={lesson.grade}>
          {grades.map((grade) => (
            <option key={grade}>{grade}</option>
          ))}
        </SelectField>

        <div className="sm:col-span-2">
          <TextInput label="Topic name" defaultValue={lesson.title} />
        </div>

        <SelectField label="Start month" defaultValue={lessonMonth}>
          {addTopicMonths.map((month) => (
            <option key={month}>{month}</option>
          ))}
        </SelectField>

        <SelectField label="End month" defaultValue={lessonMonth}>
          {addTopicMonths.map((month) => (
            <option key={month}>{month}</option>
          ))}
        </SelectField>

        <TextInput label="Room / Location" defaultValue={lesson.room} />

        <SelectField label="Period" defaultValue={lesson.period}>
          {periods.map((period) => (
            <option key={period}>{period}</option>
          ))}
        </SelectField>

        <div className="sm:col-span-2">
          <SelectField label="Status" defaultValue={lesson.status}>
            {statusOptions.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </SelectField>
        </div>

        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-[#706b64]">Notes</span>
          <textarea
            defaultValue={
              lesson.id === 'mathematics-derivatives'
                ? 'Begin with a recap of limits. Introduce instantaneous rate of change.\nWalk through formal definition with worked examples.'
                : lesson.notes
            }
            className="min-h-[88px] w-full resize-y rounded-lg border border-[#d7d3cd] bg-white px-3 py-2.5 text-sm leading-5 text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
          />
        </label>
      </div>

      <div className="mt-5">
        <div className="mb-2.5 text-sm font-medium text-[#706b64]">Colour label</div>
        <div className="flex items-center gap-3">
          {addTopicColourLabels.map((colour, index) => (
            <button
              key={colour}
              type="button"
              className={`h-7 w-7 rounded-full ${index === 0 ? 'ring-2 ring-[#17160f] ring-offset-2' : ''}`}
              style={{ backgroundColor: colour }}
              aria-label={`Use colour label ${index + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-[#e7e3dd] pt-5 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          className="h-9 rounded-lg bg-[#fde7e7] px-4 text-sm font-semibold text-[#a33636] transition-colors hover:bg-[#fbd9d9]"
        >
          Delete topic
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-lg border border-[#d7d3cd] bg-white px-4 text-sm font-semibold text-[#4a453f] transition-colors hover:bg-[#f1f0ed]"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="h-9 rounded-lg bg-[#17160f] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#2a271f]"
        >
          Save changes
        </button>
      </div>
    </DialogShell>
  );
}

function ResourceRow({ resource }: { resource: LessonResource }) {
  const style = resourceStyles[resource.kind];
  const Icon = style.icon;

  return (
    <div className="flex min-h-14 items-center gap-3 rounded-lg bg-[#ebe9e7] px-3 py-2.5">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.className}`}>
        <Icon size={16} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-[#2d2924]">{resource.title}</span>
        <span className="mt-0.5 block truncate text-xs text-[#aaa39c]">{resource.detail}</span>
      </span>
    </div>
  );
}

function LessonDetail({ lesson, onEdit }: { lesson: Lesson; onEdit: () => void }) {
  return (
    <section className="min-h-[640px] rounded-lg border border-[#d7d3cd] bg-white px-5 py-5 shadow-[0_14px_32px_rgba(23,22,15,0.12)] sm:px-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[0] text-[#0f4c8a]">
            {lesson.subject} - {lesson.grade}
          </div>
          <h2 className="mt-3 text-xl font-semibold leading-tight tracking-[0] text-[#24211d]">
            {lesson.title}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#706b64]">
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={14} />
              {lesson.dateLabel}
            </span>
            <span>-</span>
            <span>{lesson.period}</span>
            <span>-</span>
            <span className="inline-flex items-center gap-1">
              <Clock size={14} />
              {lesson.time}
            </span>
            <span>-</span>
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} />
              {lesson.room}
            </span>
          </div>
        </div>

        <HeaderButton onClick={onEdit} className="self-start">
          <Pencil size={15} />
          Edit
        </HeaderButton>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <LessonChip className="bg-[#dcecff] text-[#114f8f]">{lesson.status}</LessonChip>
        <LessonChip className="bg-[#dcecff] text-[#114f8f]">{lesson.unit}</LessonChip>
        <LessonChip className="bg-[#efeeec] text-[#6c665f]">{lesson.duration}</LessonChip>
        <LessonChip className="bg-[#def4d2] text-[#3f7b2b]">{lesson.materialStatus}</LessonChip>
      </div>

      <div className="space-y-6">
        <section>
          <SectionTitle>Learning objectives</SectionTitle>
          <div className="space-y-2">
            {lesson.objectives.map((objective, index) => (
              <div key={objective} className="flex items-start gap-3 text-sm text-[#706b64]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#dcecff] text-xs font-bold text-[#1d5ea8]">
                  {index + 1}
                </span>
                <span className="pt-0.5">{objective}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle>Lesson notes</SectionTitle>
          <p className="max-w-[1500px] text-sm leading-6 text-[#706b64]">{lesson.notes}</p>
        </section>

        <section>
          <SectionTitle>Resources and materials</SectionTitle>
          <div className="space-y-2">
            {lesson.resources.map((resource) => (
              <ResourceRow key={`${resource.kind}-${resource.title}`} resource={resource} />
            ))}
          </div>
        </section>

        <section>
          <SectionTitle>Homework assigned</SectionTitle>
          <div className="rounded-lg bg-[#fae9c9] px-4 py-3 text-sm leading-6 text-[#754a0f]">
            {lesson.homework}
          </div>
        </section>
      </div>
    </section>
  );
}

export default function LessonPlanPage() {
  const [selectedLessonId, setSelectedLessonId] = useState(lessons[0].id);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isAddLessonDialogOpen, setIsAddLessonDialogOpen] = useState(false);
  const [isEditLessonDialogOpen, setIsEditLessonDialogOpen] = useState(false);

  const selectedLesson = useMemo(() => {
    return lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0];
  }, [selectedLessonId]);

  return (
    <div className="min-h-full  px-4 py-4 text-[#24211d] sm:px-6 lg:px-7">
      {isFilterDialogOpen && <FilterLessonDialog onClose={() => setIsFilterDialogOpen(false)} />}
      {isAddLessonDialogOpen && <AddLessonDialog onClose={() => setIsAddLessonDialogOpen(false)} />}
      {isEditLessonDialogOpen && (
        <EditLessonDialog lesson={selectedLesson} onClose={() => setIsEditLessonDialogOpen(false)} />
      )}

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold leading-tight tracking-[0] text-[#24211d]">Lesson plan</h1>
          <p className="mt-1 text-sm text-[#706b64]">Grade 8 - All subjects - Week of 19-23 May 2026</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <HeaderButton onClick={() => setIsFilterDialogOpen(true)}>
            <Filter size={15} />
            Filter
          </HeaderButton>
          <button
            type="button"
            onClick={() => setIsAddLessonDialogOpen(true)}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#17160f] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2a271f]"
          >
            <Plus size={17} />
            Add lesson
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[292px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-lg border border-[#d7d3cd] bg-white shadow-[0_12px_28px_rgba(23,22,15,0.12)] xl:min-h-[728px]">
          <div className="border-b border-[#e4e0da] px-4 py-4 text-sm font-semibold text-[#24211d]">
            All lessons - May 2026
          </div>
          <div>
            {lessons.map((lesson) => {
              const isSelected = lesson.id === selectedLesson.id;

              return (
                <button
                  key={lesson.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedLessonId(lesson.id)}
                  className={`block w-full border-b border-[#ebe7e1] px-4 py-3 text-left transition-colors last:border-b-0 ${
                    isSelected ? 'bg-[#dcecff]' : 'bg-white hover:bg-[#f8fbff]'
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span
                        className="block truncate text-sm font-semibold"
                        style={{ color: lesson.subjectColor }}
                      >
                        {lesson.subject}
                      </span>
                      <span className="mt-1 block truncate text-xs text-[#706b64]">{lesson.title}</span>
                    </span>
                    <span className="shrink-0 pt-0.5 text-[11px] text-[#aaa39c]">{lesson.date}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <LessonDetail lesson={selectedLesson} onEdit={() => setIsEditLessonDialogOpen(true)} />
      </div>
    </div>
  );
}
