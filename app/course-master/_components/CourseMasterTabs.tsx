'use client';

import { useRouter } from 'next/navigation';
import { BookOpen, Calendar, Database, FileText, Network } from 'lucide-react';

export type CourseMasterTabKey = 'curriculum' | 'chapters' | 'lessonPlan' | 'questionBank' | 'coherenceMap';

interface TabDefinition {
  key: CourseMasterTabKey;
  label: string;
  icon: typeof BookOpen;
  href: (courseId: string) => string;
}

/**
 * Single source of truth for the top-level Curriculum / Chapters / Lesson
 * plans / Question bank / Coherence map tab strip, previously copy-pasted
 * (and drifting - e.g. the lesson-plan page's copy had no active-tab
 * styling at all) across chapters/page.tsx, lesson-plan/[courseId]/page.tsx
 * and lesson-plan/[courseId]/curriculum/page.tsx. Question bank and
 * coherence map are both `?view=` sub-screens of the chapters route rather
 * than routes of their own, matching how that file already treats them.
 */
const TABS: TabDefinition[] = [
  {
    key: 'curriculum',
    label: 'Curriculum',
    icon: FileText,
    href: (courseId) => `/course-master/lesson-plan/${courseId}/curriculum`,
  },
  {
    key: 'chapters',
    label: 'Chapters',
    icon: BookOpen,
    href: (courseId) => `/course-master/${courseId}/chapters`,
  },
  {
    key: 'lessonPlan',
    label: 'Lesson plans',
    icon: Calendar,
    href: (courseId) => `/course-master/lesson-plan/${courseId}`,
  },
  {
    key: 'questionBank',
    label: 'Question Bank',
    icon: Database,
    href: (courseId) => `/course-master/${courseId}/chapters?view=question-bank`,
  },
  {
    key: 'coherenceMap',
    label: 'Coherence Map',
    icon: Network,
    href: (courseId) => `/course-master/${courseId}/chapters?view=coherence-map`,
  },
];

interface CourseMasterTabsProps {
  /** The composite "<subjectId>-<standardId>" id used throughout course-master routes. */
  courseId: string;
  active: CourseMasterTabKey;
}

export function CourseMasterTabs({ courseId, active }: CourseMasterTabsProps) {
  const router = useRouter();

  return (
    <div className="mb-6 border-b border-slate-200/80">
      <div className="flex flex-wrap items-center gap-6 text-[15px]">
        {TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={isActive ? undefined : () => router.push(tab.href(courseId))}
              className={`inline-flex items-center gap-2 border-b-2 px-1 py-3 font-medium transition-colors ${
                isActive
                  ? 'border-[#4f46e5] text-[#4f46e5]'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <TabIcon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CourseMasterTabs;
