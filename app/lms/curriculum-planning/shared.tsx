// Palette, formatters and the small presentational pieces shared by the
// Overview and Curriculum tabs and by the two full-screen detail views.

import type { SubjectPlan, SubjectProgressStatus, UpcomingLessonStatus } from "./types";

export const subjectColorPalette = [
  { dotColor: '#2f7dd9', fill: '#dcecff', text: '#114f8f' },
  { dotColor: '#18a379', fill: '#d8f0e8', text: '#0d6c55' },
  { dotColor: '#7468d9', fill: '#e8e4fb', text: '#473aa5' },
  { dotColor: '#b87916', fill: '#fae8c7', text: '#6f470c' },
  { dotColor: '#d45628', fill: '#fae0d4', text: '#8a331a' },
  { dotColor: '#c64a74', fill: '#f7dce8', text: '#8b2549' },
];

export function subjectColorAt(index: number) {
  return subjectColorPalette[index % subjectColorPalette.length];
}

export function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function upcomingStatusLabel(status: string): UpcomingLessonStatus {
  if (status === 'in_progress') return 'In progress';
  if (status === 'completed') return 'Ready';
  return 'Upcoming';
}

export const upcomingBadgeClassName: Record<UpcomingLessonStatus, string> = {
  'In progress': 'bg-[#dcecff] text-[#114f8f]',
  Upcoming: 'bg-[#e9e7e3] text-[#68635d]',
  Ready: 'bg-[#def4d2] text-[#3f7b2b]',
};

export const calendarDays = [
  5, 6, 7, 8, 9,
  12, 13, 14, 15, 16,
  19, 20, 21, 22, 23,
  26, 27, 28, 29, 30,
];

export const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const editMonths = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
export const editColourLabels = ['#2f7dd9', '#18a379', '#7468d9', '#b87916', '#d45628', '#c64a74'];
export const addTopicMonths = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];
export const filterSubjects = [
  { name: 'Mathematics', color: '#2f7dd9' },
  { name: 'Science', color: '#18a379' },
  { name: 'English', color: '#7468d9' },
  { name: 'History', color: '#b87916' },
  { name: 'Geography', color: '#d45628' },
  { name: 'Art', color: '#c64a74' },
];
export const filterGrades = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];
export const filterStatuses = [
  { name: 'Completed', checked: true },
  { name: 'In progress', checked: true },
  { name: 'Upcoming', checked: true },
  { name: 'Exam / Break', checked: false },
];
export const filterMonthOptions = ['April 2026', 'May 2026', 'June 2026'];
export const quickTags = [
  { label: 'Behind schedule', active: true },
  { label: 'On track', active: false },
  { label: 'Revision weeks', active: true },
  { label: 'Exam months', active: false },
  { label: 'Has resources', active: false },
  { label: 'No homework set', active: false },
  { label: 'Practical / Lab', active: false },
];

export const primaryActionClassName =
  'bg-[var(--primary-blue)] text-white hover:bg-[color-mix(in_srgb,var(--primary-blue),#000_12%)]';

export const upcomingLessonStatusClassName: Record<UpcomingLessonStatus, string> = {
  'In progress': 'bg-[#dcecff] text-[#1761a7]',
  Upcoming: 'bg-[#e3e1de] text-[#706b64]',
  Ready: 'bg-[#def4d2] text-[#3f7b2b]',
};

export const subjectProgressStatusClassName: Record<SubjectProgressStatus, string> = {
  Done: 'bg-[#def4d2] text-[#3f7b2b]',
  'In progress': 'bg-[#dcecff] text-[#1761a7]',
  Upcoming: 'bg-[#e3e1de] text-[#706b64]',
};

export const subjectProgressStatusDot: Record<SubjectProgressStatus, string> = {
  Done: '#1aa179',
  'In progress': '#2f7dd9',
  Upcoming: '#d8d4ce',
};

export function getTopicStyle(plan: SubjectPlan, topic: string) {
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

export function ProgressLine({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#dedbd6]">
      <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
    </div>
  );
}

// --- Curriculum tab -----------------------------------------------------------

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a847d]">{children}</h4>
  );
}

/**
 * The standing marker for curriculum data nobody has supplied.
 *
 * Every one of the seven authoring fields on lms_curriculum is empty across the
 * whole estate, and most units declare more chapters than have been extracted.
 * Rendering those as blanks hides the shortfall; naming them makes it something
 * a coordinator can act on.
 */
export function NotProvided({ label = 'Not provided' }: { label?: string }) {
  return <p className="text-sm italic text-[#a09a93]">{label}</p>;
}

/** Formats a mark pair as "80 + 20 internal", omitting whichever half is absent. */
export function formatMarks(total: number | null, internal: number | null) {
  if (total === null && internal === null) return null;
  if (internal === null) return `${total} marks`;
  if (total === null) return `${internal} internal`;
  return `${total} + ${internal} internal`;
}
