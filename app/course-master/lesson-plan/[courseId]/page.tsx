'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Check,
  ClipboardList,
  Clock3,
  FileCheck,
  FlaskConical,
  GraduationCap,
  Layers3,
  List,
  Plus,
  Sparkles,
  Target,
  Users,
  HelpCircle,
  BarChart3,
  BookMarked,
  School,
  AlertTriangle,
  ArrowUp,
  ArrowUpDown,
  Globe2,
  Presentation,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { courses } from '../../data/courses';
import { getChaptersByCourseid } from '../../data/chapters';
import { getChapterKeyConcepts } from '../../data/chapterKeyConcepts';
import { getSemanticIntelligenceForSelection } from '../../data/semanticIntelligence';
import type { Course } from '../../data/courses';
import type { Chapter } from '../../data/chapters';

function getStatusColor(status: Course['status']) {
  switch (status) {
    case 'Active':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Draft':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Archived':
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

const SECTION_META = [
  { id: 'knowledge', label: 'Knowledge', icon: BookMarked, color: 'from-blue-500 to-indigo-600' },
  { id: 'ability', label: 'Ability', icon: Target, color: 'from-emerald-500 to-teal-600' },
  { id: 'skill', label: 'Skill', icon: Sparkles, color: 'from-amber-500 to-orange-600' },
  { id: 'competency', label: 'Competency', icon: BarChart3, color: 'from-purple-500 to-violet-600' },
  { id: 'bloom', label: "Bloom's Taxonomy", icon: Brain, color: 'from-pink-500 to-rose-600' },
  { id: 'dok', label: 'DOK', icon: Layers3, color: 'from-cyan-500 to-sky-600' },
  { id: 'prerequisites', label: 'Prerequisites', icon: ArrowLeft, color: 'from-slate-500 to-gray-600' },
  { id: 'misconceptions', label: 'Misconceptions', icon: AlertTriangle, color: 'from-red-500 to-rose-600' },
  { id: 'real-world', label: 'Real World', icon: Globe2, color: 'from-green-500 to-emerald-600' },
  { id: 'pedagogy', label: 'Pedagogy', icon: Presentation, color: 'from-indigo-500 to-blue-600' },
] as const;

const CALENDAR_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

type LessonPlanStatus = 'Delivered' | 'Planned' | 'Assessment';

type LessonPlanEvent = {
  id: string;
  title: string;
  conceptTitle: string;
  chapterTitle: string;
  date: Date;
  status: LessonPlanStatus;
  slotLabel: string;
  periods: number;
  pedagogy: string;
};

type LessonPlanDraft = {
  conceptTitle: string;
  plannedDate: string;
  periods: string;
  pedagogy: string;
  objective: string;
};

function getCourseSectionLabel(courseId: string) {
  const numeric = Number(courseId.replace(/\D/g, '')) || 0;
  return numeric % 2 === 0 ? 'Section A' : 'Section B';
}

function getCourseGradeLabel(classGrade: string) {
  return `Grade ${classGrade.replace('Class', '').trim()}`;
}

function getCurriculumLabel(course: Course) {
  return course.category === 'STEM Resources' ? 'STEM curriculum' : 'NCF-SE 2023 curriculum';
}

function getTotalKeyConceptCount(course: Course, chapters: Chapter[]) {
  const conceptCount = chapters.reduce((total, chapter) => {
    return total + (getChapterKeyConcepts(course.id, chapter.id)?.count ?? 0);
  }, 0);

  if (conceptCount > 0) return conceptCount;
  return Math.max(course.chapters * 4, 12);
}

function getInstructionDates(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const dates: Date[] = [];
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, monthIndex, day);
    const weekday = date.getDay();
    if (weekday !== 0 && weekday !== 6) {
      dates.push(date);
    }
  }

  return dates;
}

function createLessonPlanEvents(course: Course, chapters: Chapter[], month: Date) {
  const concepts = chapters.flatMap((chapter) => {
    const conceptGroup = getChapterKeyConcepts(course.id, chapter.id);
    return (conceptGroup?.concepts ?? []).map((concept) => ({
      chapter,
      concept,
    }));
  });

  const sourceConcepts =
    concepts.length > 0
      ? concepts
      : Array.from({ length: Math.min(Math.max(course.chapters, 5), 8) }, (_, index) => ({
          chapter: {
            id: `fallback-${index + 1}`,
            courseId: course.id,
            number: index + 1,
            title: `Chapter ${index + 1}`,
            teachingMethodologies: [],
            resources: {
              teacherResource: 0,
              lessonPlanning: 0,
              chapterMapping: 0,
              hspContent: 0,
              questions: 0,
            },
          },
          concept: {
            title: `${course.subject} concept ${index + 1}`,
            description: '',
            mastery: '80% Mastery',
            time: '15 min est.',
          },
        }));

  const teachingDates = getInstructionDates(month);
  const statusCycle: LessonPlanStatus[] = ['Delivered', 'Planned', 'Planned', 'Assessment'];
  const slotCycle = ['P1', 'P2', 'P3', 'P4', 'P5'];

  return sourceConcepts.slice(0, Math.min(sourceConcepts.length, teachingDates.length, 12)).map((item, index) => {
    const prefix =
      index % 4 === 3
        ? item.chapter.title
        : item.concept.title;

    const suffixOptions = ['intro', 'recap', 'practice', 'activity', 'review', 'discussion'];
    const suffix = suffixOptions[index % suffixOptions.length];
    const status = statusCycle[index % statusCycle.length];

    return {
      id: `${item.chapter.id}-${index}`,
      title: `${prefix} - ${suffix}`,
      conceptTitle: item.concept.title,
      chapterTitle: item.chapter.title,
      date: teachingDates[index],
      status,
      slotLabel: status === 'Assessment' ? 'AM' : slotCycle[index % slotCycle.length],
      periods: (index % 3) + 1,
      pedagogy:
        item.chapter.teachingMethodologies[index % Math.max(item.chapter.teachingMethodologies.length, 1)] ||
        'Guided practice',
    };
  });
}

function getCalendarGrid(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDay = new Date(year, monthIndex, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - mondayOffset + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      return null;
    }

    return new Date(year, monthIndex, dayNumber);
  });
}

function formatMonthTitle(month: Date) {
  return month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatLessonPlanDate(date: Date) {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getEventStatusClasses(status: LessonPlanStatus) {
  switch (status) {
    case 'Delivered':
      return 'border-l-[#18A874] bg-[#F3FBF7] text-[#0F172A]';
    case 'Planned':
      return 'border-l-[#4F46E5] bg-[#F5F3FF] text-[#0F172A]';
    case 'Assessment':
      return 'border-l-[#F59E0B] bg-[#FFF7ED] text-[#0F172A]';
  }
}

function getLegendDotClasses(status: LessonPlanStatus) {
  switch (status) {
    case 'Delivered':
      return 'bg-[#18A874]';
    case 'Planned':
      return 'bg-[#4F46E5]';
    case 'Assessment':
      return 'bg-[#F59E0B]';
  }
}

export default function LessonPlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { courseId } = useParams();
  const course = courses.find((c) => c.id === courseId);
  const view = searchParams.get('view');
  const isAssessmentView = view === 'assessment';
  const isKeyConceptsView = view === 'key-concepts';
  const isSemanticIntelligenceView = view === 'semantic-intelligence';
  const chapterId = searchParams.get('chapterId') ?? '';
  const conceptTitleParam = searchParams.get('concept') ?? '';
  const courseChapters = useMemo(() => (course ? getChaptersByCourseid(course.id) : []), [course]);
  const selectedChapter =
    courseChapters.find((chapter) => chapter.id === chapterId) || courseChapters[0] || null;
  const chapterConcepts =
    course && selectedChapter ? getChapterKeyConcepts(course.id, selectedChapter.id) : null;
  const semanticData =
    course && selectedChapter
      ? getSemanticIntelligenceForSelection(
          course.id,
          selectedChapter.id,
          conceptTitleParam || chapterConcepts?.concepts[0]?.title || ''
        )
      : null;
  const selectedConcept = semanticData?.concept || chapterConcepts?.concepts[0] || null;
  const [activeSemanticSection, setActiveSemanticSection] = useState('knowledge');
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(2026, 6, 1));
  const [isCreateLessonPlanOpen, setIsCreateLessonPlanOpen] = useState(false);
  const [createdLessonPlans, setCreatedLessonPlans] = useState<LessonPlanEvent[]>([]);
  const [lessonPlanDraft, setLessonPlanDraft] = useState<LessonPlanDraft>({
    conceptTitle: '',
    plannedDate: '',
    periods: '2',
    pedagogy: '',
    objective: '',
  });
  const chapterCount = Math.max(course?.chapters ?? 0, courseChapters.length);
  const gradeLabel = course ? getCourseGradeLabel(course.classGrade) : '';
  const sectionLabel = course ? getCourseSectionLabel(course.id) : '';
  const curriculumLabel = course ? getCurriculumLabel(course) : '';
  const totalKeyConcepts = course ? getTotalKeyConceptCount(course, courseChapters) : 0;
  const generatedLessonPlanEvents = useMemo(
    () => (course ? createLessonPlanEvents(course, courseChapters, visibleMonth) : []),
    [course, courseChapters, visibleMonth]
  );
  const conceptOptions = useMemo(() => {
    if (!course) return [];

    const concepts = courseChapters.flatMap((chapter) =>
      (getChapterKeyConcepts(course.id, chapter.id)?.concepts ?? []).map((concept) => concept.title)
    );

    return Array.from(new Set(concepts));
  }, [course, courseChapters]);
  const pedagogyOptions = useMemo(() => {
    const pedagogies = courseChapters.flatMap((chapter) => chapter.teachingMethodologies);
    return Array.from(new Set(pedagogies));
  }, [courseChapters]);
  const lessonPlanEvents = useMemo(() => {
    return [...generatedLessonPlanEvents, ...createdLessonPlans].sort(
      (left, right) => left.date.getTime() - right.date.getTime()
    );
  }, [createdLessonPlans, generatedLessonPlanEvents]);
  const calendarCells = useMemo(() => getCalendarGrid(visibleMonth), [visibleMonth]);
  const eventMap = useMemo(() => {
    const mapped = new Map<string, LessonPlanEvent[]>();

    lessonPlanEvents.forEach((event) => {
      const key = event.date.toISOString().slice(0, 10);
      const current = mapped.get(key) ?? [];
      current.push(event);
      mapped.set(key, current);
    });

    return mapped;
  }, [lessonPlanEvents]);

  if (!course) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Course not found</h2>
          <p className="text-slate-500">The requested course could not be found.</p>
        </div>
      </div>
    );
  }

  const lessonPlanRoutes = {
    lessonPlan: `/course-master/lesson-plan/${course.id}`,
    chapters: `/course-master/${course.id}/chapters`,
    curriculum: `/course-master/lesson-plan/${course.id}/curriculum`,
    assessment: `/course-master/lesson-plan/${course.id}/assessment`,
  };
  const activeSemanticSectionData =
    semanticData?.sections.find((section) => section.id === activeSemanticSection) ||
    semanticData?.sections[0] ||
    null;

  const resetLessonPlanDraft = () => {
    setLessonPlanDraft({
      conceptTitle: conceptOptions[0] ?? '',
      plannedDate: '',
      periods: '2',
      pedagogy: pedagogyOptions[0] ?? '',
      objective: '',
    });
  };

  const openCreateLessonPlanModal = () => {
    setLessonPlanDraft({
      conceptTitle: conceptOptions[0] ?? '',
      plannedDate: '',
      periods: '2',
      pedagogy: pedagogyOptions[0] ?? '',
      objective: '',
    });
    setIsCreateLessonPlanOpen(true);
  };

  const closeCreateLessonPlanModal = () => {
    setIsCreateLessonPlanOpen(false);
    resetLessonPlanDraft();
  };

  const handleSaveLessonPlan = () => {
    if (!lessonPlanDraft.conceptTitle || !lessonPlanDraft.plannedDate || !lessonPlanDraft.pedagogy) {
      return;
    }

    const eventDate = new Date(`${lessonPlanDraft.plannedDate}T00:00:00`);
    const nextEvent: LessonPlanEvent = {
      id: `manual-${course?.id}-${Date.now()}`,
      title: lessonPlanDraft.conceptTitle,
      conceptTitle: lessonPlanDraft.conceptTitle,
      chapterTitle: selectedChapter?.title ?? 'Custom lesson',
      date: eventDate,
      status: 'Planned',
      slotLabel: `P${lessonPlanDraft.periods || '2'}`,
      periods: Number(lessonPlanDraft.periods || 2),
      pedagogy: lessonPlanDraft.pedagogy,
    };

    setCreatedLessonPlans((current) => [...current, nextEvent]);
    setVisibleMonth(new Date(eventDate.getFullYear(), eventDate.getMonth(), 1));
    setIsCreateLessonPlanOpen(false);
    resetLessonPlanDraft();
  };

  return isSemanticIntelligenceView ? (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_28%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))]">
      <div className="mx-auto max-w-[1720px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="relative mb-6 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.28)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_32%)]" />
          <div className="relative border-b border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] px-5 py-6 sm:px-6 sm:py-7 lg:px-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <button
                    type="button"
                    onClick={() => router.push(`/course-master/${course.id}/chapters`)}
                    className="font-medium text-slate-600 transition-colors hover:text-slate-900"
                  >
                    Chapter List
                  </button>
                  <ChevronRight size={14} className="text-slate-400" />
                  <span>{course.title}</span>
                  <ChevronRight size={14} className="text-slate-400" />
                  <span className="font-medium text-slate-700">{selectedChapter?.title}</span>
                  <ChevronRight size={14} className="text-slate-400" />
                  <span className="font-semibold text-slate-900">Semantic Intelligence</span>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge className="rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm">
                      Semantic Intelligence
                    </Badge>
                    <Badge className="rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700">
                      {semanticData?.totalConcepts} concepts
                    </Badge>
                    <Badge className="rounded-full border border-sky-100 bg-sky-50 px-3.5 py-1.5 text-xs font-semibold text-sky-700">
                      {selectedConcept?.mastery ?? '-'}
                    </Badge>
                  </div>
                  <h1 className="max-w-5xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl xl:text-[3rem] xl:leading-[1.05]">
                    {selectedConcept?.title}
                  </h1>
                  <p className="max-w-5xl text-base leading-7 text-slate-600 sm:text-[1.05rem]">
                    {selectedConcept?.description}
                  </p>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                    <p className="max-w-5xl text-sm leading-6 text-slate-500 sm:text-[0.95rem]">
                      {semanticData?.chapterSummary}
                    </p>
                    <div className="w-fit rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                        Active focus
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {activeSemanticSectionData?.title ?? 'Overview'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 xl:justify-end">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/course-master/${course.id}/chapters`)}
                  className="h-11 rounded-2xl border-slate-200 bg-white/95 px-5 text-slate-700 shadow-sm hover:border-slate-300 hover:bg-white"
                >
                  <BookOpen size={16} className="mr-2" />
                  Chapters
                </Button>
                <Button
                  onClick={() =>
                    router.push(
                      `/course-master/lesson-plan/${course.id}?view=key-concepts&chapterId=${selectedChapter?.id ?? ''}${
                        selectedConcept?.title ? `&concept=${encodeURIComponent(selectedConcept.title)}` : ''
                      }`
                    )
                  }
                  className="h-11 rounded-2xl bg-blue-600 px-5 text-white shadow-[0_16px_32px_-18px_rgba(37,99,235,0.75)] hover:bg-blue-700"
                >
                  <ClipboardList size={16} className="mr-2" />
                  Key Concepts
                </Button>
              </div>
            </div>
          </div>

          <div className="relative grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:px-8 xl:grid-cols-4">
            <StatPill label="Mastery" value={selectedConcept?.mastery ?? '-'} icon={Target} />
            <StatPill label="Time" value={selectedConcept?.time ?? '-'} icon={Clock3} />
            <StatPill label="Chapter" value={`#${selectedChapter?.number ?? '-'}`} icon={BookOpen} />
            <StatPill label="Course" value={semanticData?.courseCode ?? '-'} icon={School} />
          </div>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.22)]">
          <div className="border-b border-slate-200/80 bg-slate-50/70 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
              {SECTION_META.map((section) => {
                const Icon = section.icon;
                const active = section.id === activeSemanticSection;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSemanticSection(section.id)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-all',
                      active
                        ? 'border-blue-200 bg-white text-slate-900 shadow-[0_12px_30px_-20px_rgba(37,99,235,0.9)] ring-1 ring-blue-100'
                        : 'border-transparent bg-white/80 text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
                        active ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      <Icon size={15} />
                    </span>
                    {section.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            {activeSemanticSectionData ? (
              <div className="space-y-6">
                <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(239,246,255,0.55),rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-5 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.28)] sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-5xl">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600/70">
                        {activeSemanticSectionData.title}
                      </p>
                      <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-[1.9rem]">
                        {activeSemanticSectionData.title}
                      </h2>
                      <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600 sm:text-[0.96rem]">
                        {activeSemanticSectionData.description}
                      </p>
                    </div>
                    <Badge className="w-fit rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                      {activeSemanticSectionData.cards.length} cards
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {activeSemanticSectionData.cards.map((card) => {
                    return (
                      <Card
                        key={`${activeSemanticSectionData.id}-${card.title}`}
                        className="group overflow-hidden rounded-[1.6rem] border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.92))] shadow-[0_20px_45px_-36px_rgba(15,23,42,0.36)] transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_28px_60px_-36px_rgba(59,130,246,0.32)]"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <CardTitle className="text-base font-semibold leading-tight text-slate-950 sm:text-[1.03rem]">
                              {card.title}
                            </CardTitle>
                            <Badge className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 shadow-sm">
                              {card.category}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-sm leading-6 text-slate-600 line-clamp-6">
                            {card.description}
                          </p>
                          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                            <div className="flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                              <Sparkles size={12} />
                              Confidence {card.confidence}
                            </div>
                            <span className="text-xs font-medium text-slate-400">
                              Selected concept
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ) : (
                <div className="flex min-h-[360px] items-center justify-center rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50/70">
                  <div className="px-6 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                      <HelpCircle size={32} className="text-slate-400" />
                    </div>
                  <h3 className="mb-1 text-lg font-semibold text-slate-900">
                    No data available
                  </h3>
                  <p className="text-sm text-slate-500">
                    Select a different concept to view semantic intelligence data.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : isKeyConceptsView ? (
    <div className="min-h-screen bg-[#E9EEF7]">
      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center gap-2 text-[15px] text-[#475569]">
          <span className="inline-flex items-center gap-2">
            <BookOpen size={14} className="text-[#475569]" />
            Teach / learn
          </span>
          <ChevronRight size={14} className="text-[#94A3B8]" />
          <span>Subjects</span>
          <ChevronRight size={14} className="text-[#94A3B8]" />
          <span className="font-medium text-[#0F172A]">
            {course.subject} - {gradeLabel.replace('Grade ', 'Grade ')} {sectionLabel.replace('Section ', '')}
          </span>
        </div>

        <div className="mb-5 rounded-[18px] bg-transparent">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#4F46E5] shadow-[0_1px_6px_rgba(15,23,42,0.06)]">
                <FlaskConical size={26} />
              </div>
              <div>
                <h1 className="text-[34px] font-semibold tracking-tight text-[#0F172A]">
                  {course.subject} - {gradeLabel} - {sectionLabel}
                </h1>
                <p className="mt-1 text-[16px] text-[#475569]">
                  {chapterCount} chapters · {totalKeyConcepts} key concepts · {curriculumLabel}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 border-b border-[#D8E1F0]">
          <div className="flex flex-wrap items-center gap-8">
            <button
              type="button"
              onClick={() => router.push(lessonPlanRoutes.lessonPlan)}
              className="pb-3 text-[15px] font-medium text-[#334155] transition hover:text-[#0F172A]"
            >
              <span className="inline-flex items-center gap-2">
                <Calendar size={16} />
                Lesson plans
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push(lessonPlanRoutes.curriculum)}
              className="pb-3 text-[15px] font-medium text-[#334155] transition hover:text-[#0F172A]"
            >
              <span className="inline-flex items-center gap-2">
                <GraduationCap size={16} />
                Curriculum
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push(lessonPlanRoutes.chapters)}
              className="pb-3 text-[15px] font-medium text-[#334155] transition hover:text-[#0F172A]"
            >
              <span className="inline-flex items-center gap-2">
                <BookOpen size={16} />
                Chapters
              </span>
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(lessonPlanRoutes.lessonPlan)}
              className="inline-flex items-center gap-2 rounded-[10px] border border-transparent bg-[#EEF3FB] px-4 py-2 text-[15px] font-medium text-[#475569] transition hover:bg-white hover:border-[#D8E1F0]"
            >
              <Calendar size={15} />
              Master calendar
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-[10px] border border-[#D8E1F0] bg-white px-4 py-2 text-[15px] font-medium text-[#0F172A] shadow-[0_1px_4px_rgba(15,23,42,0.04)]"
            >
              <List size={15} />
              Concept wise
            </button>
          </div>

          <Button
            onClick={openCreateLessonPlanModal}
            className="h-11 rounded-[14px] bg-[#4F46E5] px-5 text-[15px] font-medium text-white shadow-[0_8px_18px_rgba(79,70,229,0.32)] hover:bg-[#4338CA]"
          >
            <Plus size={16} className="mr-2" />
            Create lesson plan
          </Button>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[#D8E1F0] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#F6F9FD]">
                <tr className="border-b border-[#D8E1F0]">
                  <th className="px-4 py-4 text-left text-[13px] font-semibold uppercase tracking-wide text-[#365172]">
                    <span className="inline-flex items-center gap-1.5">
                      Concept
                      <ArrowUpDown size={14} />
                    </span>
                  </th>
                  <th className="px-4 py-4 text-left text-[13px] font-semibold uppercase tracking-wide text-[#365172]">
                    <span className="inline-flex items-center gap-1.5">
                      Chapter
                      <ArrowUpDown size={14} />
                    </span>
                  </th>
                  <th className="px-4 py-4 text-left text-[13px] font-semibold uppercase tracking-wide text-[#365172]">
                    <span className="inline-flex items-center gap-1.5 text-[#4F46E5]">
                      Planned date
                      <ArrowUp size={14} />
                    </span>
                  </th>
                  <th className="px-4 py-4 text-left text-[13px] font-semibold uppercase tracking-wide text-[#365172]">
                    <span className="inline-flex items-center gap-1.5">
                      Periods
                      <ArrowUpDown size={14} />
                    </span>
                  </th>
                  <th className="px-4 py-4 text-left text-[13px] font-semibold uppercase tracking-wide text-[#365172]">
                    Pedagogy
                  </th>
                  <th className="px-4 py-4 text-left text-[13px] font-semibold uppercase tracking-wide text-[#365172]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {lessonPlanEvents.length > 0 ? (
                  lessonPlanEvents.map((event, index) => (
                    <tr
                      key={event.id}
                      className={`border-b border-[#D8E1F0] text-[15px] text-[#0F172A] ${
                        index % 2 === 0 ? 'bg-white' : 'bg-[#FDFEFF]'
                      }`}
                    >
                      <td className="px-4 py-4 font-medium">{event.conceptTitle}</td>
                      <td className="px-4 py-4 text-[#1E3A5F]">{event.chapterTitle}</td>
                      <td className="px-4 py-4">{formatLessonPlanDate(event.date)}</td>
                      <td className="px-4 py-4">{event.periods}</td>
                      <td className="px-4 py-4">{event.pedagogy}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium ${
                            event.status === 'Delivered'
                              ? 'bg-[#EEF9F3] text-[#129264]'
                              : event.status === 'Assessment'
                                ? 'bg-[#FFF6E8] text-[#C97A00]'
                                : 'bg-[#F1F0FF] text-[#4F46E5]'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              event.status === 'Delivered'
                                ? 'bg-[#129264]'
                                : event.status === 'Assessment'
                                  ? 'bg-[#F59E0B]'
                                  : 'bg-[#4F46E5]'
                            }`}
                          />
                          {event.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center text-[15px] text-[#64748B]">
                      No lesson plans available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {isCreateLessonPlanOpen && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(15,23,42,0.18)] px-4 py-8 backdrop-blur-[2px]">
            <div
              className="absolute inset-0"
              onClick={closeCreateLessonPlanModal}
              aria-hidden="true"
            />
            <div className="relative z-[1] w-full max-w-[640px] rounded-[18px] bg-white px-6 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:px-7 sm:py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[24px] font-semibold tracking-tight text-[#0F172A]">
                    Create concept-wise lesson plan
                  </h2>
                  <p className="mt-1 text-[15px] text-[#64748B]">
                    {course.subject} · {gradeLabel} · {sectionLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCreateLessonPlanModal}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <label className="mb-2 block text-[13px] font-semibold uppercase tracking-wide text-[#64748B]">
                    Concept *
                  </label>
                  <select
                    value={lessonPlanDraft.conceptTitle}
                    onChange={(event) =>
                      setLessonPlanDraft((current) => ({ ...current, conceptTitle: event.target.value }))
                    }
                    className="h-11 w-full rounded-[10px] border border-[#CBD5E1] bg-white px-4 text-[16px] text-[#0F172A] outline-none focus:border-[#4F46E5]"
                  >
                    <option value="">Select a concept</option>
                    {conceptOptions.map((concept) => (
                      <option key={concept} value={concept}>
                        {concept}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-[13px] font-semibold uppercase tracking-wide text-[#64748B]">
                      Planned date *
                    </label>
                    <input
                      type="date"
                      value={lessonPlanDraft.plannedDate}
                      onChange={(event) =>
                        setLessonPlanDraft((current) => ({ ...current, plannedDate: event.target.value }))
                      }
                      className="h-11 w-full rounded-[10px] border border-[#CBD5E1] bg-white px-4 text-[16px] text-[#0F172A] outline-none focus:border-[#4F46E5]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[13px] font-semibold uppercase tracking-wide text-[#64748B]">
                      Periods
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={lessonPlanDraft.periods}
                      onChange={(event) =>
                        setLessonPlanDraft((current) => ({ ...current, periods: event.target.value }))
                      }
                      className="h-11 w-full rounded-[10px] border border-[#CBD5E1] bg-white px-4 text-[16px] text-[#0F172A] outline-none focus:border-[#4F46E5]"
                    />
                    <p className="mt-1.5 text-[14px] text-[#64748B]">Class periods needed</p>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[13px] font-semibold uppercase tracking-wide text-[#64748B]">
                    Teaching pedagogy
                  </label>
                  <select
                    value={lessonPlanDraft.pedagogy}
                    onChange={(event) =>
                      setLessonPlanDraft((current) => ({ ...current, pedagogy: event.target.value }))
                    }
                    className="h-11 w-full rounded-[10px] border border-[#CBD5E1] bg-white px-4 text-[16px] text-[#0F172A] outline-none focus:border-[#4F46E5]"
                  >
                    <option value="">Select pedagogy</option>
                    {pedagogyOptions.map((pedagogy) => (
                      <option key={pedagogy} value={pedagogy}>
                        {pedagogy}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[13px] font-semibold uppercase tracking-wide text-[#64748B]">
                    Learning objectives
                  </label>
                  <textarea
                    rows={4}
                    value={lessonPlanDraft.objective}
                    onChange={(event) =>
                      setLessonPlanDraft((current) => ({ ...current, objective: event.target.value }))
                    }
                    placeholder="What should students be able to do after this lesson?"
                    className="w-full rounded-[10px] border border-[#CBD5E1] bg-white px-4 py-3 text-[16px] text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#4F46E5]"
                  />
                </div>
              </div>

              <div className="mt-5 border-t border-[#E2E8F0] pt-4">
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={closeCreateLessonPlanModal}
                    className="rounded-[12px] px-4 py-2.5 text-[16px] font-medium text-[#475569] transition hover:text-[#0F172A]"
                  >
                    Cancel
                  </button>
                  <Button
                    onClick={handleSaveLessonPlan}
                    disabled={!lessonPlanDraft.conceptTitle || !lessonPlanDraft.plannedDate || !lessonPlanDraft.pedagogy}
                    className="h-11 rounded-[14px] bg-[#4F46E5] px-5 text-[15px] font-medium text-white shadow-[0_8px_18px_rgba(79,70,229,0.32)] hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:bg-[#A5B4FC]"
                  >
                    <Check size={16} className="mr-2" />
                    Save lesson plan
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  ) : isAssessmentView ? (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${course.accentColor}15`, color: course.accentColor }}
            >
              <FileCheck size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">{course.title}</h1>
              <p className="mt-1 text-slate-600">Assessment</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => router.push(lessonPlanRoutes.lessonPlan)}
              className="h-10 rounded-xl border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            >
              <ClipboardList size={16} className="mr-2" />
              Lesson Plan
            </Button>
            <Button
              onClick={() => router.push(lessonPlanRoutes.curriculum)}
              className="h-10 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25"
            >
              <BookOpen size={16} className="mr-2" />
              Curriculum
            </Button>
            <Button
              onClick={() => router.push(lessonPlanRoutes.chapters)}
              className="h-10 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
            >
              <ChevronRight size={16} className="mr-2" />
              Chapters
            </Button>
          </div>
        </div>

        <div className="mb-8 rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-slate-500">Course Code:</span>
                <span className="rounded-lg bg-slate-50 px-3 py-1 font-mono text-sm font-semibold text-slate-800">
                  {course.code}
                </span>
                <Badge className={cn('text-xs font-semibold', getStatusColor(course.status))}>{course.status}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-slate-400" />
                  <span className="text-slate-600">Instructor:</span>
                  <span className="font-medium text-slate-800">{course.instructor}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-slate-400" />
                  <span className="text-slate-600">Class:</span>
                  <span className="font-medium text-slate-800">{course.classGrade}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:w-auto">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50/60 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-500">
                  <BookOpen size={18} />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{course.chapters}</div>
                  <div className="text-xs text-slate-500">Chapters</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50/60 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-500">
                  <Users size={18} />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{course.enrollments}</div>
                  <div className="text-xs text-slate-500">Students</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50/60 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-500">
                  <Target size={18} />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{course.progress}%</div>
                  <div className="text-xs text-slate-500">Progress</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50/60 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-500">
                  <CheckSquare size={18} />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">Assess</div>
                  <div className="text-xs text-slate-500">Plan hub</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Assessment Framework</h2>
              <p className="text-sm text-slate-500">Suggested checkpoints for this course</p>
            </div>
            <div className="divide-y divide-slate-100">
              {['Chapter-wise quizzes', 'Unit review tasks', 'Practice worksheets', 'Summative assessment plan'].map(
                (item, index) => (
                  <div key={item} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{item}</p>
                      <p className="text-sm text-slate-500">Track completion and performance by chapter</p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <FileCheck size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Assessment Notes</h2>
                  <p className="text-sm text-slate-500">Build your evaluation flow here</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Add formative checks, rubric-based activities, and end-of-unit assessments based on the lesson plan.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <ClipboardList size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Quick Links</h2>
                  <p className="text-sm text-slate-500">Jump to related pages</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <Button variant="outline" onClick={() => router.push(lessonPlanRoutes.lessonPlan)} className="justify-start">
                  Lesson Plan
                </Button>
                <Button variant="outline" onClick={() => router.push(lessonPlanRoutes.curriculum)} className="justify-start">
                  Curriculum
                </Button>
                <Button variant="outline" onClick={() => router.push(lessonPlanRoutes.chapters)} className="justify-start">
                  Chapters
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="min-h-screen bg-[#E9EEF7]">
      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center gap-2 text-[15px] text-[#475569]">
          <span className="inline-flex items-center gap-2">
            <BookOpen size={14} className="text-[#475569]" />
            Teach / learn
          </span>
          <ChevronRight size={14} className="text-[#94A3B8]" />
          <span>Subjects</span>
          <ChevronRight size={14} className="text-[#94A3B8]" />
          <span className="font-medium text-[#0F172A]">
            {course.subject} - {gradeLabel.replace('Grade ', 'Grade ')} {sectionLabel.replace('Section ', '')}
          </span>
        </div>

        <div className="mb-5 rounded-[18px] bg-transparent">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#4F46E5] shadow-[0_1px_6px_rgba(15,23,42,0.06)]">
                <FlaskConical size={26} />
              </div>
              <div>
                <h1 className="text-[34px] font-semibold tracking-tight text-[#0F172A]">
                  {course.subject} - {gradeLabel} - {sectionLabel}
                </h1>
                <p className="mt-1 text-[16px] text-[#475569]">
                  {chapterCount} chapters · {totalKeyConcepts} key concepts · {curriculumLabel}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 border-b border-[#D8E1F0]">
          <div className="flex flex-wrap items-center gap-8">
            <button
              type="button"
              className="border-b-2 border-[#4F46E5] pb-3 text-[15px] font-medium text-[#4F46E5]"
            >
              <span className="inline-flex items-center gap-2">
                <Calendar size={16} />
                Lesson plans
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push(lessonPlanRoutes.curriculum)}
              className="pb-3 text-[15px] font-medium text-[#334155] transition hover:text-[#0F172A]"
            >
              <span className="inline-flex items-center gap-2">
                <GraduationCap size={16} />
                Curriculum
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push(lessonPlanRoutes.chapters)}
              className="pb-3 text-[15px] font-medium text-[#334155] transition hover:text-[#0F172A]"
            >
              <span className="inline-flex items-center gap-2">
                <BookOpen size={16} />
                Chapters
              </span>
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(lessonPlanRoutes.lessonPlan)}
              className="inline-flex items-center gap-2 rounded-[10px] border border-[#D8E1F0] bg-white px-4 py-2 text-[15px] font-medium text-[#0F172A] shadow-[0_1px_4px_rgba(15,23,42,0.04)]"
            >
              <Calendar size={15} />
              Master calendar
            </button>
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/course-master/lesson-plan/${course.id}?view=key-concepts&chapterId=${selectedChapter?.id ?? ''}`
                )
              }
              className="inline-flex items-center gap-2 rounded-[10px] border border-transparent bg-[#EEF3FB] px-4 py-2 text-[15px] font-medium text-[#475569] transition hover:bg-white hover:border-[#D8E1F0]"
            >
              <List size={15} />
              Concept wise
            </button>
          </div>

          <Button
            onClick={openCreateLessonPlanModal}
            className="h-11 rounded-[14px] bg-[#4F46E5] px-5 text-[15px] font-medium text-white shadow-[0_8px_18px_rgba(79,70,229,0.32)] hover:bg-[#4338CA]"
          >
            <Plus size={16} className="mr-2" />
            Create lesson plan
          </Button>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[#D8E1F0] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 border-b border-[#E3EAF4] px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-[18px] font-semibold text-[#0F172A]">{formatMonthTitle(visibleMonth)}</h2>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-5 text-[14px] text-[#475569]">
                {(['Delivered', 'Planned', 'Assessment'] as LessonPlanStatus[]).map((status) => (
                  <div key={status} className="inline-flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${getLegendDotClasses(status)}`} />
                    <span>{status}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleMonth(
                      (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setVisibleMonth(
                      (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto p-4 sm:p-5">
            <div className="min-w-[980px] overflow-hidden rounded-[14px] border border-[#D8E1F0]">
              <div className="grid grid-cols-7 bg-[#F6F9FD]">
                {CALENDAR_WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="border-b border-r border-[#D8E1F0] px-3 py-3 text-center text-[14px] font-medium text-[#334155] last:border-r-0"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarCells.map((date, index) => {
                  const key = date ? date.toISOString().slice(0, 10) : `empty-${index}`;
                  const events = date ? eventMap.get(key) ?? [] : [];
                  const isCurrentMonth = Boolean(date);

                  return (
                    <div
                      key={key}
                      className={`min-h-[96px] border-b border-r border-[#D8E1F0] p-2.5 last:border-r-0 ${
                        isCurrentMonth ? 'bg-white' : 'bg-[#F3F6FA]'
                      }`}
                    >
                      {date ? (
                        <>
                          <div className="mb-2 text-[14px] font-medium text-[#334155]">{date.getDate()}</div>
                          <div className="space-y-2">
                            {events.map((event) => (
                              <div
                                key={event.id}
                                className={`rounded-[8px] border border-[#E2E8F0] border-l-[3px] px-2 py-1.5 text-[13px] shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${getEventStatusClasses(
                                  event.status
                                )}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="line-clamp-1 font-medium">{event.title}</p>
                                  <span className="shrink-0 text-[12px] text-[#64748B]">{event.slotLabel}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {isCreateLessonPlanOpen && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(15,23,42,0.18)] px-4 py-8 backdrop-blur-[2px]">
            <div
              className="absolute inset-0"
              onClick={closeCreateLessonPlanModal}
              aria-hidden="true"
            />
            <div className="relative z-[1] w-full max-w-[640px] rounded-[18px] bg-white px-6 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:px-7 sm:py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[24px] font-semibold tracking-tight text-[#0F172A]">
                    Create concept-wise lesson plan
                  </h2>
                  <p className="mt-1 text-[15px] text-[#64748B]">
                    {course.subject} · {gradeLabel} · {sectionLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCreateLessonPlanModal}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <label className="mb-2 block text-[13px] font-semibold uppercase tracking-wide text-[#64748B]">
                    Concept *
                  </label>
                  <select
                    value={lessonPlanDraft.conceptTitle}
                    onChange={(event) =>
                      setLessonPlanDraft((current) => ({ ...current, conceptTitle: event.target.value }))
                    }
                    className="h-11 w-full rounded-[10px] border border-[#CBD5E1] bg-white px-4 text-[16px] text-[#0F172A] outline-none focus:border-[#4F46E5]"
                  >
                    <option value="">Select a concept</option>
                    {conceptOptions.map((concept) => (
                      <option key={concept} value={concept}>
                        {concept}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-[13px] font-semibold uppercase tracking-wide text-[#64748B]">
                      Planned date *
                    </label>
                    <input
                      type="date"
                      value={lessonPlanDraft.plannedDate}
                      onChange={(event) =>
                        setLessonPlanDraft((current) => ({ ...current, plannedDate: event.target.value }))
                      }
                      className="h-11 w-full rounded-[10px] border border-[#CBD5E1] bg-white px-4 text-[16px] text-[#0F172A] outline-none focus:border-[#4F46E5]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[13px] font-semibold uppercase tracking-wide text-[#64748B]">
                      Periods
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={lessonPlanDraft.periods}
                      onChange={(event) =>
                        setLessonPlanDraft((current) => ({ ...current, periods: event.target.value }))
                      }
                      className="h-11 w-full rounded-[10px] border border-[#CBD5E1] bg-white px-4 text-[16px] text-[#0F172A] outline-none focus:border-[#4F46E5]"
                    />
                    <p className="mt-1.5 text-[14px] text-[#64748B]">Class periods needed</p>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[13px] font-semibold uppercase tracking-wide text-[#64748B]">
                    Teaching pedagogy
                  </label>
                  <select
                    value={lessonPlanDraft.pedagogy}
                    onChange={(event) =>
                      setLessonPlanDraft((current) => ({ ...current, pedagogy: event.target.value }))
                    }
                    className="h-11 w-full rounded-[10px] border border-[#CBD5E1] bg-white px-4 text-[16px] text-[#0F172A] outline-none focus:border-[#4F46E5]"
                  >
                    <option value="">Select pedagogy</option>
                    {pedagogyOptions.map((pedagogy) => (
                      <option key={pedagogy} value={pedagogy}>
                        {pedagogy}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[13px] font-semibold uppercase tracking-wide text-[#64748B]">
                    Learning objectives
                  </label>
                  <textarea
                    rows={4}
                    value={lessonPlanDraft.objective}
                    onChange={(event) =>
                      setLessonPlanDraft((current) => ({ ...current, objective: event.target.value }))
                    }
                    placeholder="What should students be able to do after this lesson?"
                    className="w-full rounded-[10px] border border-[#CBD5E1] bg-white px-4 py-3 text-[16px] text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#4F46E5]"
                  />
                </div>
              </div>

              <div className="mt-5 border-t border-[#E2E8F0] pt-4">
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    onClick={closeCreateLessonPlanModal}
                    className="rounded-[12px] px-4 py-2.5 text-[16px] font-medium text-[#475569] transition hover:text-[#0F172A]"
                  >
                    Cancel
                  </button>
                  <Button
                    onClick={handleSaveLessonPlan}
                    disabled={!lessonPlanDraft.conceptTitle || !lessonPlanDraft.plannedDate || !lessonPlanDraft.pedagogy}
                    className="h-11 rounded-[14px] bg-[#4F46E5] px-5 text-[15px] font-medium text-white shadow-[0_8px_18px_rgba(79,70,229,0.32)] hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:bg-[#A5B4FC]"
                  >
                    <Check size={16} className="mr-2" />
                    Save lesson plan
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="rounded-[1.4rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] px-4 py-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.45)]">
      <div className="flex items-center gap-2 text-slate-500">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <Icon size={15} className="text-slate-500" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em]">{label}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-950 sm:text-[0.96rem]">{value}</p>
    </div>
  );
}
