'use client';

// Teach/Learn -> Curriculum.
//
// Two tabs over one fetch. Overview is the execution view that was already
// here - stats, the subject x month grid, upcoming lessons, subject progress.
// Curriculum is the structural view: the curriculum tree the API has always
// returned under `data.curriculum` and that nothing ever rendered.
//
// The page body was split into siblings in this folder when the tabs landed;
// OverviewTab, the two full-screen views and the dialogs are verbatim moves.

import { useEffect, useMemo, useState } from 'react';
import { Filter, Pencil, Plus } from 'lucide-react';
import RequireStaff from '@/app/lms/_shared/RequireStaff';
import { createAuthHeaders, useLmsSessionContext } from '@/app/lms/_shared/useLmsSession';
import type {
  CurriculumPlanningApiData,
  CurriculumPlanningApiResponse,
  Lesson,
  Stat,
  SubjectPlan,
  SubjectProgressDetail,
  UpcomingLessonRow,
} from './types';
import {
  formatShortDate,
  primaryActionClassName,
  subjectColorAt,
  upcomingBadgeClassName,
  upcomingStatusLabel,
} from './shared';
import { AddTopicDialog, EditTopicDialog, FilterSyllabusDialog } from './dialogs';
import { AllUpcomingLessonsView } from './UpcomingLessonsView';
import { SubjectProgressDetailsView } from './SubjectProgressView';
import { OverviewTab } from './OverviewTab';
import { CurriculumTab } from './CurriculumTab';

type TabKey = 'overview' | 'curriculum';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'curriculum', label: 'Curriculum' },
];

export default function CurriculumPlanningPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddTopicDialogOpen, setIsAddTopicDialogOpen] = useState(false);
  const [isUpcomingLessonsViewOpen, setIsUpcomingLessonsViewOpen] = useState(false);
  const [isSubjectProgressViewOpen, setIsSubjectProgressViewOpen] = useState(false);

  const session = useLmsSessionContext();

  const [apiData, setApiData] = useState<CurriculumPlanningApiData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      if (!session.subInstituteId || !session.syear) {
        setApiData(null);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        // No standard_id: combines every standard's curriculum into one summary.
        const params = new URLSearchParams({
          sub_institute_id: session.subInstituteId,
          syear: session.syear,
        });

        const response = await fetch(`${session.baseUrl}/api/intelligence/curriculum-planning?${params}`, {
          method: 'GET',
          signal: controller.signal,
          headers: createAuthHeaders(session),
        });

        const payload = (await response.json().catch(() => ({}))) as CurriculumPlanningApiResponse;

        if (response.status === 404) {
          setApiData(null);
          return;
        }

        if (!response.ok) {
          throw new Error(payload.message || `Curriculum planning API failed with status ${response.status}`);
        }

        setApiData(Array.isArray(payload.data) ? null : payload.data ?? null);
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load curriculum plan.');
        setApiData(null);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [session.baseUrl, session.subInstituteId, session.syear, session.token]);

  const monthKeys = useMemo(() => {
    if (!apiData) return [];
    const keys = new Set<string>();
    apiData.subjects.forEach((subject) => subject.months.forEach((month) => keys.add(month.month_key)));
    return Array.from(keys).sort();
  }, [apiData]);

  const monthLabels = useMemo(
    () => monthKeys.map((key) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short' })),
    [monthKeys]
  );

  const subjectPlans: SubjectPlan[] = useMemo(() => {
    if (!apiData) return [];
    return apiData.subjects.map((subject, index) => {
      const color = subjectColorAt(index);
      const monthTopics = new Map(subject.months.map((month) => [month.month_key, month.topics[0] ?? '-']));
      const label = subject.standard_name ? `${subject.subject_name} - Std ${subject.standard_name}` : subject.subject_name;
      return {
        name: label,
        displayName: label,
        dotColor: color.dotColor,
        fill: color.fill,
        text: color.text,
        progress: subject.progress,
        topics: monthKeys.length > 0 ? monthKeys.map((key) => monthTopics.get(key) ?? '-') : subject.months.map((month) => month.topics[0] ?? '-'),
      };
    });
  }, [apiData, monthKeys]);

  const stats: Stat[] = useMemo(() => {
    if (!apiData) return [];
    const s = apiData.stats;
    return [
      { label: 'Total topics', value: String(s.total_topics), helper: `across ${apiData.subjects.length} subjects`, progress: 100, color: '#d8d4ce' },
      { label: 'Completed', value: String(s.completed), helper: `${s.completion_percent}% of periods done`, progress: s.completion_percent, color: '#1aa179' },
      { label: 'In progress', value: String(s.in_progress), helper: 'currently being taught', progress: Math.min(100, s.in_progress > 0 ? Math.round((s.in_progress / Math.max(1, s.completed + s.in_progress)) * 100) : 0), color: '#2f7dd9' },
      { label: 'Weeks remaining', value: String(s.weeks_remaining), helper: 'in this term', progress: Math.max(0, 100 - s.completion_percent), color: '#b87916' },
    ];
  }, [apiData]);

  const upcomingLessons: Lesson[] = useMemo(() => {
    if (!apiData) return [];
    const subjectIndexById = new Map(apiData.subjects.map((subject, index) => [subject.subject_id, index]));
    return apiData.upcoming_lessons.slice(0, 4).map((item) => {
      const color = subjectColorAt(subjectIndexById.get(item.subject_id ?? -1) ?? 0);
      const status = upcomingStatusLabel(item.status);
      const subjectLabel = item.standard_name ? `${item.subject_name ?? ''} - Std ${item.standard_name}` : item.subject_name ?? '';
      return {
        subject: subjectLabel,
        title: item.topic || 'Lesson',
        meta: `${subjectLabel} - ${formatShortDate(item.scheduled_date)} - ${item.period_slot}`,
        dotColor: color.dotColor,
        status,
        badgeClassName: upcomingBadgeClassName[status],
      };
    });
  }, [apiData]);

  const allUpcomingLessons: UpcomingLessonRow[] = useMemo(() => {
    if (!apiData) return [];
    const subjectIndexById = new Map(apiData.subjects.map((subject, index) => [subject.subject_id, index]));
    return apiData.upcoming_lessons.map((item) => {
      const color = subjectColorAt(subjectIndexById.get(item.subject_id ?? -1) ?? 0);
      const subjectLabel = item.standard_name ? `${item.subject_name ?? ''} - Std ${item.standard_name}` : item.subject_name ?? '';
      return {
        date: formatShortDate(item.scheduled_date),
        time: item.teacher_name,
        subject: subjectLabel,
        dotColor: color.dotColor,
        fill: color.fill,
        text: color.text,
        topic: item.topic || 'Lesson',
        room: item.teacher_name,
        period: item.period_slot,
        status: upcomingStatusLabel(item.status),
      };
    });
  }, [apiData]);

  const subjectProgressDetails: SubjectProgressDetail[] = useMemo(() => {
    if (!apiData) return [];
    return apiData.subject_progress.map((subject, index) => ({
      subject: subject.standard_name ? `${subject.subject_name} - Std ${subject.standard_name}` : subject.subject_name,
      color: subjectColorAt(index).dotColor,
      progress: subject.progress,
      topics: subject.topics.map((topic) => ({
        title: topic.title,
        range: `${formatShortDate(topic.start_date)} - ${formatShortDate(topic.end_date)}`,
        status: topic.status,
      })),
    }));
  }, [apiData]);

  const curricula = apiData?.curriculum ?? [];
  const unmappedChapters = apiData?.unmapped_chapters ?? [];

  const gradeLabel = 'All standards';

  // Each tab describes what it is showing, so the subtitle follows the tab
  // rather than always reporting the execution roll-up.
  const overviewSubtitle = apiData
    ? `${apiData.subjects.length} subjects - ${apiData.stats.total_topics} topics - ${apiData.stats.completion_percent}% complete`
    : isLoading
      ? 'Loading curriculum plan...'
      : loadError || 'No curriculum plan data found yet.';

  const curriculumSubtitle = apiData
    ? (() => {
        const declared = curricula.reduce((total, item) => total + item.coverage.declared_chapters, 0);
        const extracted = curricula.reduce((total, item) => total + item.coverage.extracted_chapters, 0);
        const unmappedCount = unmappedChapters.reduce((total, group) => total + group.chapter_count, 0);
        return [
          `${curricula.length} curricula`,
          `${extracted} of ${declared || extracted} declared chapters extracted`,
          unmappedCount > 0 ? `${unmappedCount} unassigned chapters` : null,
        ]
          .filter(Boolean)
          .join(' - ');
      })()
    : isLoading
      ? 'Loading curriculum...'
      : loadError || 'No curriculum data found yet.';

  const headerSubtitle = activeTab === 'overview' ? overviewSubtitle : curriculumSubtitle;
  const headerTitle =
    activeTab === 'overview' ? `${gradeLabel} - Yearly syllabus overview` : `${gradeLabel} - Curriculum`;

  const dialogs = (
    <>
      {isFilterDialogOpen && <FilterSyllabusDialog onClose={() => setIsFilterDialogOpen(false)} />}
      {isEditDialogOpen && <EditTopicDialog onClose={() => setIsEditDialogOpen(false)} />}
      {isAddTopicDialogOpen && <AddTopicDialog onClose={() => setIsAddTopicDialogOpen(false)} />}
    </>
  );

  if (isUpcomingLessonsViewOpen) {
    return (
      <RequireStaff>
        {dialogs}
        <AllUpcomingLessonsView
          lessons={allUpcomingLessons}
          gradeLabel={gradeLabel}
          onBack={() => setIsUpcomingLessonsViewOpen(false)}
          onFilter={() => setIsFilterDialogOpen(true)}
          onAddLesson={() => setIsAddTopicDialogOpen(true)}
        />
      </RequireStaff>
    );
  }

  if (isSubjectProgressViewOpen) {
    return (
      <RequireStaff>
        {dialogs}
        <SubjectProgressDetailsView
          subjects={subjectProgressDetails}
          stats={stats}
          gradeLabel={gradeLabel}
          onBack={() => setIsSubjectProgressViewOpen(false)}
          onFilter={() => setIsFilterDialogOpen(true)}
        />
      </RequireStaff>
    );
  }

  return (
    <RequireStaff>
    <div className="min-h-full  px-4 py-4 text-[#26231f] sm:px-6 lg:px-7">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-[0] text-[#24211d]">{headerTitle}</h1>
          <p className="mt-1 text-sm text-[#706b64]">{headerSubtitle}</p>
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
            className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm transition-colors ${primaryActionClassName}`}
          >
            <Plus size={16} />
            Add topic
          </button>
        </div>
      </div>

      {dialogs}

      <div className="mb-5 flex gap-1 border-b border-[#ddd9d2]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-[#2f7dd9] text-[#1761a7]'
                : 'border-transparent text-[#77716b] hover:text-[#3c3833]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <OverviewTab
          stats={stats}
          subjectPlans={subjectPlans}
          monthLabels={monthLabels}
          upcomingLessons={upcomingLessons}
          isLoading={isLoading}
          loadError={loadError}
          onOpenUpcomingLessons={() => setIsUpcomingLessonsViewOpen(true)}
          onOpenSubjectProgress={() => setIsSubjectProgressViewOpen(true)}
        />
      ) : (
        <CurriculumTab
          curricula={curricula}
          unmapped={unmappedChapters}
          isLoading={isLoading}
          loadError={loadError}
        />
      )}
    </div>
    </RequireStaff>
  );
}
