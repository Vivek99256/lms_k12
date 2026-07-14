'use client';

import { Fragment, useState } from 'react';
import { ArrowRight, Filter, Pencil, Plus, X } from 'lucide-react';

type Stat = {
  label: string;
  value: string;
  helper: string;
  progress: number;
  color: string;
};

type SubjectPlan = {
  name: string;
  dotColor: string;
  fill: string;
  text: string;
  topics: string[];
  progress: number;
  displayName: string;
};

type Lesson = {
  subject: string;
  title: string;
  meta: string;
  dotColor: string;
  status: string;
  badgeClassName: string;
};

const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

const stats: Stat[] = [
  { label: 'Total topics', value: '48', helper: 'across 6 subjects', progress: 100, color: '#d8d4ce' },
  { label: 'Completed', value: '19', helper: '40% of year done', progress: 40, color: '#1aa179' },
  { label: 'In progress', value: '7', helper: 'current month', progress: 58, color: '#2f7dd9' },
  { label: 'Weeks remaining', value: '22', helper: 'ends June 2026', progress: 46, color: '#b87916' },
];

const subjectPlans: SubjectPlan[] = [
  {
    name: 'Maths',
    displayName: 'Mathematics',
    dotColor: '#2f7dd9',
    fill: '#dcecff',
    text: '#114f8f',
    topics: ['Algebra', 'Algebra', 'Geometry', 'Geometry', 'Statistics', 'Break', 'Fractions', 'Fractions', 'Calculus', 'Calculus', 'Revision', 'Exams'],
    progress: 62,
  },
  {
    name: 'Science',
    displayName: 'Science',
    dotColor: '#18a379',
    fill: '#d8f0e8',
    text: '#0d6c55',
    topics: ['Biology', 'Biology', 'Chemistry', 'Chemistry', 'Physics', 'Break', 'Ecology', 'Ecology', 'Physics', 'Lab work', 'Revision', 'Exams'],
    progress: 55,
  },
  {
    name: 'English',
    displayName: 'English',
    dotColor: '#7468d9',
    fill: '#e8e4fb',
    text: '#473aa5',
    topics: ['Prose', 'Prose', 'Poetry', 'Drama', 'Drama', 'Break', 'Writing', 'Writing', 'Media', 'Media', 'Revision', 'Exams'],
    progress: 48,
  },
  {
    name: 'History',
    displayName: 'History',
    dotColor: '#b87916',
    fill: '#fae8c7',
    text: '#6f470c',
    topics: ['WWI', 'WWI', 'WWII', 'WWII', 'Cold War', 'Break', 'Civil Rights', 'Cold War', 'Modern', 'Modern', 'Revision', 'Exams'],
    progress: 40,
  },
  {
    name: 'Geography',
    displayName: 'Geography',
    dotColor: '#d45628',
    fill: '#fae0d4',
    text: '#8a331a',
    topics: ['Climate', 'Climate', 'Landforms', 'Landforms', 'Ecosystems', 'Break', 'Urban', 'Urban', 'Dev.', 'Dev.', 'Revision', 'Exams'],
    progress: 35,
  },
  {
    name: 'Art',
    displayName: 'Art',
    dotColor: '#c64a74',
    fill: '#f7dce8',
    text: '#8b2549',
    topics: ['Drawing', 'Drawing', 'Colour', 'Colour', '3D Forms', 'Break', 'Digital', 'Digital', 'Portfolio', 'Portfolio', 'Exhibition', 'Exhibition'],
    progress: 50,
  },
];

const calendarDays = [
  5, 6, 7, 8, 9,
  12, 13, 14, 15, 16,
  19, 20, 21, 22, 23,
  26, 27, 28, 29, 30,
];

const upcomingLessons: Lesson[] = [
  {
    subject: 'Maths',
    title: 'Calculus - Introduction to derivatives',
    meta: 'Maths - Today - Period 2 - Room 14',
    dotColor: '#2f7dd9',
    status: 'In progress',
    badgeClassName: 'bg-[#dcecff] text-[#114f8f]',
  },
  {
    subject: 'Science',
    title: 'Revision - Ecosystems & biomes',
    meta: 'Science - Tomorrow - Period 4 - Lab B',
    dotColor: '#18a379',
    status: 'Upcoming',
    badgeClassName: 'bg-[#e9e7e3] text-[#68635d]',
  },
  {
    subject: 'English',
    title: 'Media literacy - Analysing news sources',
    meta: 'English - 23 May - Period 1 - Room 7',
    dotColor: '#7468d9',
    status: 'Upcoming',
    badgeClassName: 'bg-[#e9e7e3] text-[#68635d]',
  },
  {
    subject: 'History',
    title: 'Revision - Cold War and detente',
    meta: 'History - 26 May - Period 3 - Room 9',
    dotColor: '#b87916',
    status: 'Ready',
    badgeClassName: 'bg-[#def4d2] text-[#3f7b2b]',
  },
];

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const editMonths = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const editColourLabels = ['#2f7dd9', '#18a379', '#7468d9', '#b87916', '#d45628', '#c64a74'];
const addTopicMonths = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];
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

function getTopicStyle(plan: SubjectPlan, topic: string) {
  if (topic === 'Exams') {
    return {
      backgroundColor: '#16150f',
      color: '#ffffff',
      fontWeight: 700,
    };
  }

  if (topic === 'Break') {
    return {
      backgroundColor: '#e5e2de',
      color: '#908c86',
      fontStyle: 'italic',
    };
  }

  return {
    backgroundColor: plan.fill,
    color: plan.text,
  };
}

function ProgressLine({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#dedbd6]">
      <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
    </div>
  );
}

function FilterCheckCard({
  children,
  checked = true,
}: {
  children: React.ReactNode;
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

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#77716b]">{title}</h3>
      {children}
    </section>
  );
}

function AddTopicDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-topic-title"
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
          <h2 id="add-topic-title" className="text-xl font-semibold tracking-[0] text-[#24211d]">
            Add new topic
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d7d3cd] bg-[#f1f0ed] text-[#6f6a63] transition-colors hover:bg-[#e7e5e1] hover:text-[#27231f]"
            aria-label="Close add topic dialog"
          >
            <X size={22} />
          </button>
        </div>

        <div className="grid gap-x-3 gap-y-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#6f6a63]">Subject *</span>
            <select
              defaultValue=""
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            >
              <option value="" disabled>Select subject...</option>
              {filterSubjects.map((subject) => (
                <option key={subject.name}>{subject.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#6f6a63]">Grade / Class *</span>
            <select
              defaultValue="Grade 8"
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            >
              <option>Grade 6</option>
              <option>Grade 7</option>
              <option>Grade 8</option>
              <option>Grade 9</option>
              <option>Grade 10</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-medium text-[#6f6a63]">Topic name *</span>
            <input
              placeholder="e.g. Quadratic equations"
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors placeholder:text-[#88837c] focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#6f6a63]">Start month *</span>
            <select
              defaultValue="July"
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            >
              {addTopicMonths.map((month) => (
                <option key={month}>{month}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#6f6a63]">End month *</span>
            <select
              defaultValue="July"
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            >
              {addTopicMonths.map((month) => (
                <option key={month}>{month}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#6f6a63]">Estimated lessons</span>
            <input
              placeholder="e.g. 8"
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors placeholder:text-[#88837c] focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#6f6a63]">Room / Location</span>
            <input
              placeholder="e.g. Room 12"
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors placeholder:text-[#88837c] focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-medium text-[#6f6a63]">Learning objectives</span>
            <textarea
              placeholder="Enter key learning objectives for this topic..."
              className="min-h-[90px] w-full resize-y rounded-lg border border-[#d7d3cd] bg-white px-3 py-2.5 text-sm leading-5 text-[#2b2723] outline-none transition-colors placeholder:text-[#88837c] focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-medium text-[#6f6a63]">Resources (optional)</span>
            <input
              placeholder="Paste a link or enter file name..."
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors placeholder:text-[#88837c] focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>
        </div>

        <div className="mt-5">
          <div className="mb-2.5 text-sm font-medium text-[#6f6a63]">Colour label</div>
          <div className="flex gap-3">
            {editColourLabels.map((colour, index) => (
              <button
                key={colour}
                type="button"
                className={`h-7 w-7 rounded-full ${index === 1 ? 'ring-2 ring-[#16150f] ring-offset-2' : ''}`}
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
      </form>
    </div>
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
            className="h-9 rounded-lg bg-[#17160f] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#2a271f]"
          >
            Apply filters
          </button>
        </div>
      </form>
    </div>
  );
}

function EditTopicDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-topic-title"
      onMouseDown={onClose}
    >
      <form
        className="w-full max-w-[520px] rounded-[18px] bg-white px-7 py-7 shadow-[0_24px_70px_rgba(23,22,15,0.28)]"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <div className="mb-7 flex items-start justify-between gap-4">
          <h2 id="edit-topic-title" className="text-lg font-semibold tracking-[0] text-[#24211d]">
            Edit topic
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d7d3cd] bg-[#f1f0ed] text-[#6f6a63] transition-colors hover:bg-[#e7e5e1] hover:text-[#27231f]"
            aria-label="Close edit topic dialog"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#77716b]">Subject</span>
            <select defaultValue="Mathematics" className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15">
              <option>Mathematics</option>
              <option>Science</option>
              <option>English</option>
              <option>History</option>
              <option>Geography</option>
              <option>Art</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#77716b]">Grade / Class</span>
            <select defaultValue="Grade 8" className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15">
              <option>Grade 6</option>
              <option>Grade 7</option>
              <option>Grade 8</option>
              <option>Grade 9</option>
              <option>Grade 10</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-[#77716b]">Topic name</span>
            <input
              defaultValue="Calculus - Introduction to derivatives"
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#77716b]">Start month</span>
            <select defaultValue="May" className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15">
              {editMonths.map((month) => (
                <option key={month}>{month}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#77716b]">End month</span>
            <select defaultValue="May" className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15">
              {editMonths.map((month) => (
                <option key={month}>{month}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#77716b]">Room / Location</span>
            <input
              defaultValue="Room 14"
              className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[#77716b]">Period</span>
            <select defaultValue="Period 2" className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15">
              <option>Period 1</option>
              <option>Period 2</option>
              <option>Period 3</option>
              <option>Period 4</option>
              <option>Period 5</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-[#77716b]">Status</span>
            <select defaultValue="In progress" className="h-10 w-full rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15">
              <option>In progress</option>
              <option>Upcoming</option>
              <option>Ready</option>
              <option>Completed</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-[#77716b]">Notes</span>
            <textarea
              defaultValue={'Begin with a recap of limits. Introduce instantaneous rate of change.\nWalk through formal definition with worked examples.'}
              className="min-h-20 w-full resize-y rounded-lg border border-[#d7d3cd] bg-white px-3 py-2.5 text-sm leading-5 text-[#2b2723] outline-none transition-colors focus:border-[#2f7dd9] focus:ring-2 focus:ring-[#2f7dd9]/15"
            />
          </label>
        </div>

        <div className="mt-5">
          <div className="mb-2.5 text-xs font-semibold text-[#77716b]">Colour label</div>
          <div className="flex gap-2">
            {editColourLabels.map((colour, index) => (
              <button
                key={colour}
                type="button"
                className={`h-6 w-6 rounded-full ${index === 0 ? 'ring-2 ring-[#16150f] ring-offset-2' : ''}`}
                style={{ backgroundColor: colour }}
                aria-label={`Use colour label ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-2 border-t border-[#e7e3dd] pt-4 sm:flex-row sm:items-center sm:justify-end">
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
      </form>
    </div>
  );
}

export default function CurriculumPlanningPage() {
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddTopicDialogOpen, setIsAddTopicDialogOpen] = useState(false);

  return (
    <div className="min-h-full  px-4 py-4 text-[#26231f] sm:px-6 lg:px-7">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-[0] text-[#24211d]">Grade 8 - Yearly syllabus overview</h1>
          <p className="mt-1 text-sm text-[#706b64]">Academic Year 2025-26 - 6 subjects - 48 topics - 40% complete</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsFilterDialogOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d7d3cd] bg-white px-4 text-sm font-medium text-[#332f2a] shadow-sm transition-colors hover:bg-[#f1f0ed]"
          >
            <Filter size={15} />
            Filter
          </button>
          <button
            type="button"
            onClick={() => setIsEditDialogOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d7d3cd] bg-white px-4 text-sm font-medium text-[#332f2a] shadow-sm transition-colors hover:bg-[#f1f0ed]"
          >
            <Pencil size={15} />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setIsAddTopicDialogOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#17160f] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2a271f]"
          >
            <Plus size={16} />
            Add topic
          </button>
        </div>
      </div>

      {isFilterDialogOpen && <FilterSyllabusDialog onClose={() => setIsFilterDialogOpen(false)} />}
      {isEditDialogOpen && <EditTopicDialog onClose={() => setIsEditDialogOpen(false)} />}
      {isAddTopicDialogOpen && <AddTopicDialog onClose={() => setIsAddTopicDialogOpen(false)} />}

      <section className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg bg-white p-4">
            <div className="text-xs font-medium text-[#77716b]">{stat.label}</div>
            <div className="mt-1 text-3xl font-bold leading-none tracking-[0] text-[#1f1d19]">{stat.value}</div>
            <div className="mt-1 text-xs text-[#9a958e]">{stat.helper}</div>
            <div className="mt-3">
              <ProgressLine value={stat.progress} color={stat.color} />
            </div>
          </div>
        ))}
      </section>

      <section className="mb-5 overflow-hidden rounded-lg border border-[#ddd9d2] bg-white shadow-[0_10px_24px_rgba(23,22,15,0.10)]">
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[1260px]"
            style={{ gridTemplateColumns: `128px repeat(${months.length}, minmax(94px, 1fr))` }}
          >
            <div className="border-b border-r border-[#e3dfd8] px-4 py-3 text-xs font-semibold text-[#8a847d]">
              Subject
            </div>
            {months.map((month) => (
              <div
                key={month}
                className="border-b border-r border-[#e3dfd8] px-3 py-3 text-center text-xs font-semibold text-[#a09a93] last:border-r-0"
              >
                {month}
              </div>
            ))}

            {subjectPlans.map((plan) => (
              <Fragment key={plan.name}>
                <div
                  className="flex min-h-12 items-center gap-3 border-b border-r border-[#e9e5de] px-4 text-sm font-medium last:border-b-0"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: plan.dotColor }} />
                  {plan.name}
                </div>
                {plan.topics.map((topic, index) => (
                  <div
                    key={`${plan.name}-${months[index]}`}
                    className="flex min-h-12 items-center border-b border-r border-[#e9e5de] px-2 last:border-r-0"
                  >
                    <span
                      className="block h-6 w-full truncate rounded-md px-2 text-center text-xs font-medium leading-6"
                      style={getTopicStyle(plan, topic)}
                      title={topic}
                    >
                      {topic}
                    </span>
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-[#ddd9d2] bg-white p-4 shadow-[0_8px_18px_rgba(23,22,15,0.08)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-[0]">May 2026 - monthly detail</h2>
            <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-[#2f7dd9]">
              View full
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {weekdays.map((day) => (
              <div key={day} className="pb-1 text-center text-xs font-semibold text-[#aaa49c]">
                {day}
              </div>
            ))}
            {calendarDays.map((day) => (
              <button
                key={day}
                type="button"
                className={`h-8 rounded-md text-xs font-medium transition-colors ${
                  day === 21
                    ? 'border-2 border-[#2f7dd9] bg-[#dcecff] text-[#0f4c8a]'
                    : 'border border-transparent bg-[#dcecff] text-[#0f4c8a] hover:border-[#9ac3ef]'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#ddd9d2] bg-white p-4 shadow-[0_8px_18px_rgba(23,22,15,0.08)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-[0]">Upcoming lessons</h2>
            <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-[#2f7dd9]">
              See all
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="space-y-2">
            {upcomingLessons.map((lesson) => (
              <div key={`${lesson.subject}-${lesson.title}`} className="flex min-h-14 items-start gap-3 rounded-lg bg-[#efeeec] px-3 py-3">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: lesson.dotColor }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[#2d2924]">{lesson.title}</div>
                  <div className="mt-0.5 truncate text-xs text-[#7d766f]">{lesson.meta}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${lesson.badgeClassName}`}>
                  {lesson.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#ddd9d2] bg-white p-4 shadow-[0_8px_18px_rgba(23,22,15,0.08)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-[0]">Subject progress</h2>
            <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-[#2f7dd9]">
              Details
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="space-y-3">
            {subjectPlans.map((plan) => (
              <div key={`${plan.name}-progress`}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: plan.dotColor }} />
                    <span className="truncate font-medium">{plan.displayName}</span>
                  </div>
                  <span className="shrink-0 text-xs text-[#706b64]">{plan.progress}%</span>
                </div>
                <ProgressLine value={plan.progress} color={plan.dotColor} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
