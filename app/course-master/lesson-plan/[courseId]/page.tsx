'use client';

import React, { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Calendar,
  ChevronRight,
  CheckSquare,
  ClipboardList,
  Clock3,
  FileCheck,
  GraduationCap,
  Layers3,
  Sparkles,
  Target,
  Users,
  HelpCircle,
  BarChart3,
  BookMarked,
  School,
  AlertTriangle,
  Globe2,
  Presentation,
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
  const keyConceptHighlight = searchParams.get('highlight') ?? conceptTitleParam;
  const courseChapters = course ? getChaptersByCourseid(course.id) : [];
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
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${course.accentColor}15`, color: course.accentColor }}
            >
              <GraduationCap size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Key Concepts</h1>
              <p className="mt-1 text-slate-600">
                {course.title}
                {selectedChapter ? ` - ${selectedChapter.title}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => router.push(`/course-master/${course.id}/chapters`)}
              className="h-10 rounded-xl border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            >
              Back to Chapters
            </Button>
            <Button
              onClick={() => router.push(`/course-master/lesson-plan/${course.id}`)}
              className="h-10 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25"
            >
              <BookOpen size={16} className="mr-2" />
              Lesson Plan
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-sm">
          <div className="border-b border-slate-200/70 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Extracted Concepts ({chapterConcepts?.count ?? 0})
            </h2>
          </div>

          <div className="p-4 sm:p-5">
            {chapterConcepts ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {chapterConcepts.concepts.map((concept) => (
                  <div
                    key={concept.title}
                    className={cn(
                      'rounded-2xl border bg-white p-5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-md',
                      concept.title === keyConceptHighlight
                        ? 'border-blue-300 bg-blue-50/40 ring-2 ring-blue-100'
                        : 'border-slate-200 hover:border-blue-200'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold leading-tight text-slate-900">
                        {concept.title}
                      </h3>
                      <Badge className="shrink-0 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                        {concept.mastery} Mastery
                      </Badge>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {concept.description}
                    </p>

                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-500">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[10px] leading-none text-slate-500">
                          T
                        </span>
                        {concept.time}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          router.push(
                            `/course-master/lesson-plan/${course.id}?view=semantic-intelligence&chapterId=${selectedChapter?.id ?? ''}&concept=${encodeURIComponent(
                              concept.title
                            )}`
                          )
                        }
                        className="h-11 rounded-2xl border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 shadow-sm hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
                      >
                        <Brain size={16} className="mr-2" />
                        Semantic
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
                <p className="text-sm font-medium text-slate-600">
                  No key concepts are available for this chapter.
                </p>
              </div>
            )}
          </div>
        </div>
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
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${course.accentColor}15`, color: course.accentColor }}
            >
              <ClipboardList size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">{course.title}</h1>
              <p className="mt-1 text-slate-600">Lesson Plan</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => router.push(lessonPlanRoutes.chapters)}
              className="h-10 rounded-xl border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            >
              <BookOpen size={16} className="mr-2" />
              Chapters
            </Button>
            <Button
              onClick={() => router.push(lessonPlanRoutes.curriculum)}
              className="h-10 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25"
            >
              <GraduationCap size={16} className="mr-2" />
              Curriculum
            </Button>
            <Button
              onClick={() => router.push(lessonPlanRoutes.assessment)}
              className="h-10 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
            >
              <FileCheck size={16} className="mr-2" />
              Assessment
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
                  <ChevronRight size={18} />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">Plan</div>
                  <div className="text-xs text-slate-500">Route hub</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <ClipboardList size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Lesson Plan Overview</h2>
                <p className="text-sm text-slate-500">Structure the course flow and pacing</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Use this space to map the weekly sequence, teaching strategies, and lesson milestones for the selected course.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <GraduationCap size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Curriculum Link</h2>
                <p className="text-sm text-slate-500">Move into the curriculum view</p>
              </div>
            </div>
            <Button
              onClick={() => router.push(lessonPlanRoutes.curriculum)}
              className="mt-4 h-10 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Open Curriculum
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <FileCheck size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Assessment Link</h2>
                <p className="text-sm text-slate-500">Jump to assessment planning</p>
              </div>
            </div>
            <Button
              onClick={() => router.push(lessonPlanRoutes.assessment)}
              className="mt-4 h-10 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
            >
              Open Assessment
            </Button>
          </div>
        </div>
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
