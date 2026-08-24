'use client';

<<<<<<< HEAD
import { type ReactNode, useMemo, useState } from 'react';
=======
import { type ReactNode, useEffect, useMemo, useState } from 'react';
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock,
  FileText,
  Filter,
  Link2,
<<<<<<< HEAD
  MapPin,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
=======
  Pencil,
  Plus,
  User,
  X,
} from 'lucide-react';
import RequireStaff from '@/app/lms/_shared/RequireStaff';
import { createAuthHeaders, useLmsSessionContext } from '@/app/lms/_shared/useLmsSession';
import { SearchDropdown, type DropdownField, type SearchDropdownValues } from '@/components/search-dropdown';
import type { SessionContext } from '@/lib/erp-client';

const classPickerFields: DropdownField[] = ['section', 'standard', 'division'];

function readDropdownValue(value: SearchDropdownValues[keyof SearchDropdownValues] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

type SessionLike = SessionContext;
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
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

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

<<<<<<< HEAD
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
=======
const lessonSubjectColors = ['#0f4c8a', '#4c40a5', '#0d6c55', '#74490d', '#8a351c', '#8b2549'];

function lessonColorFor(subjectId: number | null, subjectOrder: number[]) {
  if (subjectId == null) return lessonSubjectColors[0];
  const index = subjectOrder.indexOf(subjectId);
  return lessonSubjectColors[(index < 0 ? 0 : index) % lessonSubjectColors.length];
}

function lessonStatusLabel(status: string): string {
  if (status === 'in_progress') return 'In progress';
  if (status === 'completed') return 'Completed';
  return 'Upcoming';
}

// --- Lesson Plan Detail API ----------------------------------------------------

type ApiLessonConcept = {
  concept_id: number;
  concept_name: string;
  is_primary: boolean;
  coverage_percent: number;
};

type ApiLessonPeriod = {
  period_id: number;
  subject_id: number | null;
  subject_name: string | null;
  scheduled_date: string;
  period_slot: string;
  teacher_name: string;
  chapter_name: string | null;
  primary_concept_name: string | null;
  period_type: string;
  plan_json: Record<string, unknown> | null;
  learning_objectives: unknown[];
  planned_duration_min: number;
  status: string;
  completion_percent: number | null;
  teacher_notes: string | null;
  concepts: ApiLessonConcept[];
};

type LessonPlanDetailApiResponse = {
  status?: boolean;
  message?: string;
  data?: ApiLessonPeriod[];
};

function readPlanJsonString(planJson: Record<string, unknown> | null, key: string): string {
  const value = planJson?.[key];
  return typeof value === 'string' ? value : '';
}

function readPlanJsonResources(planJson: Record<string, unknown> | null): LessonResource[] {
  const value = planJson?.resources;
  if (!Array.isArray(value)) return [];
  return value
    .map((item): LessonResource | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const title = typeof record.title === 'string' ? record.title : '';
      if (!title) return null;
      const kind: ResourceKind = record.kind === 'pdf' || record.kind === 'link' || record.kind === 'doc' ? record.kind : 'doc';
      return { title, detail: typeof record.detail === 'string' ? record.detail : '', kind };
    })
    .filter((resource): resource is LessonResource => resource !== null);
}

function mapApiPeriodToLesson(period: ApiLessonPeriod, subjectOrder: number[]): Lesson {
  const scheduledDate = new Date(`${period.scheduled_date}T00:00:00`);
  return {
    id: String(period.period_id),
    subject: period.subject_name ?? '',
    subjectColor: lessonColorFor(period.subject_id, subjectOrder),
    grade: '',
    date: scheduledDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    dateLabel: scheduledDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    period: `Period ${period.period_slot}`,
    time: `${period.planned_duration_min} min`,
    room: period.teacher_name,
    title: period.primary_concept_name || period.chapter_name || 'Lesson',
    unit: period.chapter_name || period.primary_concept_name || 'General',
    duration: `${period.planned_duration_min} min`,
    status: lessonStatusLabel(period.status),
    materialStatus: period.plan_json ? 'Materials ready' : 'Needs review',
    notes: period.teacher_notes || 'No lesson notes have been added yet.',
    homework: readPlanJsonString(period.plan_json, 'homework') || 'No homework assigned.',
    objectives: Array.isArray(period.learning_objectives)
      ? period.learning_objectives.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      : [],
    resources: readPlanJsonResources(period.plan_json),
  };
}

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
<<<<<<< HEAD
=======
  value,
  onChange,
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
}: {
  label: string;
  placeholder?: string;
  defaultValue?: string;
<<<<<<< HEAD
=======
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
}) {
  return (
    <FormField label={label}>
      <input
        defaultValue={defaultValue}
<<<<<<< HEAD
=======
        value={value}
        onChange={onChange}
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors placeholder:text-[#8d8780] focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
      />
    </FormField>
  );
}

<<<<<<< HEAD
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
=======
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

function DialogShell({
  children,
  title,
  onClose,
<<<<<<< HEAD
=======
  onSubmit,
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  widthClassName = 'max-w-[520px]',
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
<<<<<<< HEAD
=======
  onSubmit?: (event: React.FormEvent) => void;
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
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
<<<<<<< HEAD
        onSubmit={(event) => {
          event.preventDefault();
          onClose();
        }}
=======
        onSubmit={
          onSubmit ??
          ((event) => {
            event.preventDefault();
            onClose();
          })
        }
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
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
=======
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
  const periodOptions = usePeriodOptions(session);

  const [chapterId, setChapterId] = useState('');
  const [chapterFreeText, setChapterFreeText] = useState('');
  const [scheduledDate, setScheduledDate] = useState(defaultDateIso);
  const [periodId, setPeriodId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subjectIdForChapterReset, setSubjectIdForChapterReset] = useState(subjectId);
  if (subjectId !== subjectIdForChapterReset) {
    setSubjectIdForChapterReset(subjectId);
    setChapterId('');
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!divisionId) {
      setError('Select a Division in the class picker above before adding a lesson.');
      return;
    }
    if (!subjectId || !scheduledDate || !periodId) {
      setError('Subject, date and period are all required.');
      return;
    }
    const dayOfWeek = new Date(`${scheduledDate}T00:00:00`).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      setError('Pick a Monday-Friday date - weekends are not shown on the timetable.');
      return;
    }
    const selectedPeriod = periodOptions.find((p) => String(p.period_id) === periodId);

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

  return (
    <DialogShell title="Add lesson" onClose={onClose} onSubmit={handleSubmit} widthClassName="max-w-[520px]">
      {error && <div className="mb-4 rounded-lg bg-[#fde7e7] px-3 py-2 text-sm text-[#a33636]">{error}</div>}
      {!divisionId && !error && (
        <div className="mb-4 rounded-lg bg-[#fae9c9] px-3 py-2 text-sm text-[#754a0f]">
          Select a Division in the class picker above before adding a lesson.
        </div>
      )}

      <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
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
            <FormField label="Chapter">
              <span className="relative block">
                <select
                  value={chapterId}
                  onChange={(event) => setChapterId(event.target.value)}
                  className="h-10 w-full appearance-none rounded-lg border border-[#d7d3cd] bg-white px-3 pr-9 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
                >
                  <option value="">Select chapter...</option>
                  {chapters.map((chapter) => (
                    <option key={chapter.chapter_id} value={chapter.chapter_id}>
                      {chapter.chapter_name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#928c84]" />
              </span>
            </FormField>
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

        <FormField label="Date *">
          <input
            type="date"
            value={scheduledDate}
            onChange={(event) => setScheduledDate(event.target.value)}
            required
            className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
          />
        </FormField>

        <FormField label="Period *">
          <span className="relative block">
            <select
              value={periodId}
              onChange={(event) => setPeriodId(event.target.value)}
              required
              className="h-10 w-full appearance-none rounded-lg border border-[#d7d3cd] bg-white px-3 pr-9 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            >
              <option value="" disabled>Select period...</option>
              {periodOptions.map((period) => (
                <option key={period.period_id} value={period.period_id}>
                  {period.title}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#928c84]" />
          </span>
        </FormField>

        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-[#706b64]">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Anything the teacher should know for this lesson..."
            className="min-h-[80px] w-full resize-y rounded-lg border border-[#d7d3cd] bg-white px-3 py-2.5 text-sm leading-5 text-[#2b2723] outline-none transition-colors placeholder:text-[#8d8780] focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
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
    </DialogShell>
  );
}

<<<<<<< HEAD
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
    lesson.status === 'Completed' ? 'completed' : lesson.status === 'In progress' ? 'in_progress' : 'not_started'
  );
  const [notes, setNotes] = useState(lesson.notes === 'No lesson notes have been added yet.' ? '' : lesson.notes);
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

      const response = await fetch(`${session.baseUrl}/api/intelligence/lesson-plan-periods/${lesson.id}/update`, {
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
      const response = await fetch(`${session.baseUrl}/api/intelligence/lesson-plan-periods/${lesson.id}/delete`, {
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
    <DialogShell title="Edit lesson" onClose={onClose} onSubmit={handleSave} widthClassName="max-w-[520px]">
      {error && <div className="mb-4 rounded-lg bg-[#fde7e7] px-3 py-2 text-sm text-[#a33636]">{error}</div>}

      <p className="mb-4 text-sm text-[#706b64]">
        {lesson.title} - {lesson.subject} - {lesson.period}
      </p>

      <div className="space-y-4">
        <FormField label="Status">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
          >
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="skipped">Skipped</option>
          </select>
        </FormField>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[#706b64]">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add a note about this lesson..."
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
            className="min-h-[88px] w-full resize-y rounded-lg border border-[#d7d3cd] bg-white px-3 py-2.5 text-sm leading-5 text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
          />
        </label>
      </div>

<<<<<<< HEAD
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
          className={`h-9 rounded-lg px-4 text-sm font-semibold transition-colors ${primaryActionClassName}`}
        >
          Save changes
        </button>
      </div>
=======
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
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
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
<<<<<<< HEAD
              <MapPin size={14} />
=======
              <User size={14} />
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
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

<<<<<<< HEAD
export default function LessonPlanPage() {
  const [selectedLessonId, setSelectedLessonId] = useState(lessons[0].id);
=======
function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function currentWeekRange() {
  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return { dateFrom: toIsoDate(monday), dateTo: toIsoDate(friday) };
}

function shiftWeek(dateFrom: string, days: number) {
  const monday = new Date(`${dateFrom}T00:00:00`);
  monday.setDate(monday.getDate() + days);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return { dateFrom: toIsoDate(monday), dateTo: toIsoDate(friday) };
}

export default function LessonPlanPage() {
  const session = useLmsSessionContext();
  const [classFilters, setClassFilters] = useState<Partial<SearchDropdownValues>>({ section: '', standard: '', division: '' });
  const [standardName, setStandardName] = useState('');
  const standardId = readDropdownValue(classFilters.standard);
  const divisionId = readDropdownValue(classFilters.division);

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isAddLessonDialogOpen, setIsAddLessonDialogOpen] = useState(false);
  const [isEditLessonDialogOpen, setIsEditLessonDialogOpen] = useState(false);

<<<<<<< HEAD
  const selectedLesson = useMemo(() => {
    return lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0];
  }, [selectedLessonId]);

  return (
    <div className="min-h-full  px-4 py-4 text-[#24211d] sm:px-6 lg:px-7">
      {isFilterDialogOpen && <FilterLessonDialog onClose={() => setIsFilterDialogOpen(false)} />}
      {isAddLessonDialogOpen && <AddLessonDialog onClose={() => setIsAddLessonDialogOpen(false)} />}
      {isEditLessonDialogOpen && (
        <EditLessonDialog lesson={selectedLesson} onClose={() => setIsEditLessonDialogOpen(false)} />
=======
  const [apiPeriods, setApiPeriods] = useState<ApiLessonPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [weekRange, setWeekRange] = useState(() => currentWeekRange());
  const { dateFrom, dateTo } = weekRange;
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      if (!session.subInstituteId || !session.syear || !standardId) {
        setApiPeriods([]);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const params = new URLSearchParams({
          sub_institute_id: session.subInstituteId,
          syear: session.syear,
          standard_id: standardId,
          date_from: dateFrom,
          date_to: dateTo,
        });
        if (divisionId) params.set('division_id', divisionId);

        const response = await fetch(`${session.baseUrl}/api/intelligence/lesson-plan-detail?${params}`, {
          method: 'GET',
          signal: controller.signal,
          headers: createAuthHeaders(session),
        });
        const payload = (await response.json().catch(() => ({}))) as LessonPlanDetailApiResponse;

        if (response.status === 404) {
          setApiPeriods([]);
          return;
        }
        if (!response.ok) {
          throw new Error(payload.message || `Lesson plan API failed with status ${response.status}`);
        }

        setApiPeriods(Array.isArray(payload.data) ? payload.data : []);
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the lesson plan.');
        setApiPeriods([]);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [session.baseUrl, session.subInstituteId, session.syear, session.token, standardId, divisionId, dateFrom, dateTo, refreshKey]);

  const subjectOrder = useMemo(() => {
    const seen: number[] = [];
    apiPeriods.forEach((period) => {
      if (period.subject_id != null && !seen.includes(period.subject_id)) seen.push(period.subject_id);
    });
    return seen;
  }, [apiPeriods]);

  const gradeLabel = standardName || (standardId ? `Grade ${standardId}` : 'Your class');
  const lessons: Lesson[] = useMemo(
    () => apiPeriods.map((period) => ({ ...mapApiPeriodToLesson(period, subjectOrder), grade: gradeLabel })),
    [apiPeriods, subjectOrder, gradeLabel]
  );

  const selectedLesson = useMemo(() => {
    return lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0] ?? null;
  }, [lessons, selectedLessonId]);

  return (
    <RequireStaff>
    <div className="min-h-full  px-4 py-4 text-[#24211d] sm:px-6 lg:px-7">
      {isFilterDialogOpen && <FilterLessonDialog onClose={() => setIsFilterDialogOpen(false)} />}
      {isAddLessonDialogOpen && (
        <AddLessonDialog
          session={session}
          standardId={standardId}
          divisionId={divisionId}
          defaultDateIso={dateFrom}
          onClose={() => setIsAddLessonDialogOpen(false)}
          onSaved={() => setRefreshKey((key) => key + 1)}
        />
      )}
      {isEditLessonDialogOpen && selectedLesson && (
        <EditLessonDialog
          session={session}
          lesson={selectedLesson}
          onClose={() => setIsEditLessonDialogOpen(false)}
          onSaved={() => setRefreshKey((key) => key + 1)}
        />
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
      )}

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold leading-tight tracking-[0] text-[#24211d]">Lesson plan</h1>
<<<<<<< HEAD
          <p className="mt-1 text-sm text-[#706b64]">Grade 8 - All subjects - Week of 19-23 May 2026</p>
=======
          <p className="mt-1 text-sm text-[#706b64]">
            {!standardId
              ? 'Pick a class below to load its lesson plan.'
              : `${gradeLabel} - All subjects - Week of ${dateFrom} to ${dateTo}`}
          </p>
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
        </div>

        <div className="flex flex-wrap gap-2">
          <HeaderButton onClick={() => setIsFilterDialogOpen(true)}>
            <Filter size={15} />
            Filter
          </HeaderButton>
          <button
            type="button"
            onClick={() => setIsAddLessonDialogOpen(true)}
            className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm transition-colors ${primaryActionClassName}`}
          >
            <Plus size={17} />
            Add lesson
          </button>
        </div>
      </div>

<<<<<<< HEAD
      <div className="grid gap-4 xl:grid-cols-[292px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-lg border border-[#d7d3cd] bg-white shadow-[0_12px_28px_rgba(23,22,15,0.12)] xl:min-h-[728px]">
          <div className="border-b border-[#e4e0da] px-4 py-4 text-sm font-semibold text-[#24211d]">
            All lessons - May 2026
          </div>
          <div>
            {lessons.map((lesson) => {
              const isSelected = lesson.id === selectedLesson.id;
=======
      <section className="mb-4 rounded-lg border border-[#d7d3cd] bg-white p-4 shadow-[0_8px_18px_rgba(23,22,15,0.08)]">
        <div className="grid gap-3 sm:grid-cols-3 md:max-w-2xl">
          <SearchDropdown
            fields={classPickerFields}
            values={classFilters}
            onChange={setClassFilters}
            className="w-200"
            onStandardChange={(_value, rows) => setStandardName(rows[0]?.name ?? '')}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <HeaderButton
            className="w-9 px-0"
            onClick={() => {
              setSelectedLessonId(null);
              setWeekRange((current) => shiftWeek(current.dateFrom, -7));
            }}
          >
            {'<'}
          </HeaderButton>
          <label className="flex items-center gap-2 text-sm text-[#706b64]">
            Week of
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                if (!event.target.value) return;
                setSelectedLessonId(null);
                setWeekRange(shiftWeek(event.target.value, 0));
              }}
              className="h-9 rounded-lg border border-[#d7d3cd] bg-white px-2 text-sm text-[#2b2723]"
            />
          </label>
          <HeaderButton
            className="w-9 px-0"
            onClick={() => {
              setSelectedLessonId(null);
              setWeekRange((current) => shiftWeek(current.dateFrom, 7));
            }}
          >
            {'>'}
          </HeaderButton>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[292px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-lg border border-[#d7d3cd] bg-white shadow-[0_12px_28px_rgba(23,22,15,0.12)] xl:min-h-[728px]">
          <div className="border-b border-[#e4e0da] px-4 py-4 text-sm font-semibold text-[#24211d]">
            All lessons this week
          </div>
          <div>
            {lessons.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-[#9a958e]">
                {isLoading ? 'Loading lessons...' : loadError || 'No lessons scheduled this week.'}
              </div>
            )}
            {lessons.map((lesson) => {
              const isSelected = lesson.id === selectedLesson?.id;
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

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

<<<<<<< HEAD
        <LessonDetail lesson={selectedLesson} onEdit={() => setIsEditLessonDialogOpen(true)} />
      </div>
    </div>
=======
        {selectedLesson ? (
          <LessonDetail lesson={selectedLesson} onEdit={() => setIsEditLessonDialogOpen(true)} />
        ) : (
          <section className="flex min-h-[300px] items-center justify-center rounded-lg border border-[#d7d3cd] bg-white text-sm text-[#9a958e]">
            {isLoading ? 'Loading lesson plan...' : loadError || 'No lesson selected.'}
          </section>
        )}
      </div>
    </div>
    </RequireStaff>
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  );
}
