'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { BookOpen, Calendar, Clock, Users, Target, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getChaptersByCourseid } from '../../../data/chapters';
import type { Chapter } from '../../../data/chapters';
import { courses } from '../../../data/courses';
import type { Course } from '../../../data/courses';

const ICON_MAP: Record<string, React.ElementType> = {
  'book-open': BookOpen,
  'flask-conical': BookOpen,
  'calculator': BookOpen,
  'globe': BookOpen,
  'pen-tool': BookOpen,
  'music': BookOpen,
  'dumbbell': BookOpen,
  'briefcase': BookOpen,
  'palette': BookOpen,
  'library': BookOpen,
  'cpu': BookOpen,
  'compass': BookOpen,
};

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

function buildFallbackChapters(course: Course, chapterTotal: number): Chapter[] {
  return Array.from({ length: chapterTotal }, (_, index) => ({
    id: `generated-${course.id}-${index + 1}`,
    courseId: course.id,
    number: index + 1,
    title: `${course.subject} Chapter ${index + 1}`,
    teachingMethodologies: [],
    resources: {
      teacherResource: 0,
      lessonPlanning: 0,
      chapterMapping: 0,
      hspContent: 0,
      questions: 10,
    },
  }));
}

function buildResolvedChapters(course: Course, chapterTotal: number, chapterData: Chapter[]) {
  const fallbackChapters = buildFallbackChapters(course, chapterTotal);

  return Array.from({ length: chapterTotal }, (_, index) => {
    const existingChapter = chapterData[index];
    if (!existingChapter) {
      return fallbackChapters[index];
    }

    return {
      ...fallbackChapters[index],
      ...existingChapter,
      resources: existingChapter.resources ?? fallbackChapters[index].resources,
    };
  });
}

function distributeMarks(weights: number[], totalMarks: number) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || weights.length;
  const exactMarks = weights.map((weight) => (weight / totalWeight) * totalMarks);
  const baseMarks = exactMarks.map((value) => Math.floor(value));
  let remainingMarks = totalMarks - baseMarks.reduce((sum, value) => sum + value, 0);

  exactMarks
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction)
    .forEach(({ index }) => {
      if (remainingMarks <= 0) {
        return;
      }

      baseMarks[index] += 1;
      remainingMarks -= 1;
    });

  return baseMarks;
}

function generateCurriculumUnits(course: Course, chapters: Chapter[]) {
  const targetUnitCount = Math.max(1, Math.min(5, chapters.length));
  const chaptersPerUnit = Math.max(1, Math.ceil(chapters.length / targetUnitCount));
  const unitNameParts = ['Foundations', 'Core Concepts', 'Systems', 'Applications', 'Practice'];
  const units = Array.from({ length: Math.ceil(chapters.length / chaptersPerUnit) }, (_, index) => {
    const unitChapters = chapters.slice(index * chaptersPerUnit, (index + 1) * chaptersPerUnit);

    return {
      id: index + 1,
      name: `${course.subject} ${unitNameParts[index] ?? `Unit ${index + 1}`}`,
      chapters: unitChapters,
      periods: '-',
      status:
        index < Math.min(2, targetUnitCount)
          ? 'Completed'
          : index === Math.min(2, targetUnitCount)
            ? 'In Progress'
            : 'Not Started',
      weight: unitChapters.reduce((sum, chapter) => sum + (chapter.resources.questions || 10), 0),
    };
  });
  const marksByUnit = distributeMarks(
    units.map((unit) => unit.weight),
    80
  );

  return units.map((unit, index) => ({
    ...unit,
    chapterCount: unit.chapters.length,
    marks: marksByUnit[index] ?? 0,
  }));
}

interface LearningOutcome {
  code: string;
  type: 'Goal' | 'competency';
  description: string;
  parentCode?: string;
}

const learningOutcomes: LearningOutcome[] = [
  {
    code: 'CG 1',
    type: 'Goal',
    description: 'Explores the world of matter, its interactions, and properties at the atomic level',
  },
  {
    code: 'C 1.1',
    type: 'competency',
    description: 'Describes classification of elements in the Periodic Table, and explains how compounds are formed based on atomic structure and properties.',
    parentCode: 'CG 1',
  },
  {
    code: 'C 1.2',
    type: 'competency',
    description: 'Investigates the nature and properties of chemical substances.',
    parentCode: 'CG 1',
  },
  {
    code: 'C 1.3',
    type: 'competency',
    description: 'Describes and represents chemical interactions and changes using symbols and chemical equations.',
    parentCode: 'CG 1',
  },
  {
    code: 'CG 2',
    type: 'Goal',
    description: 'Explores the physical world around them and understands scientific principles and laws.',
  },
  {
    code: 'C 2.1',
    type: 'competency',
    description: "Applies Newton's laws to explain the effect of forces and analyses motion representations.",
    parentCode: 'CG 2',
  },
];

export default function CurriculumPage() {
  const router = useRouter();
  const { courseId } = useParams();
  const course = courses.find((c) => c.id === courseId);

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

  const IconComponent = ICON_MAP[course.icon] || BookOpen;
  const chapterCount = Math.max(course.chapters, getChaptersByCourseid(course.id).length);
  const resolvedChapters = buildResolvedChapters(course, chapterCount, getChaptersByCourseid(course.id));
  const units = generateCurriculumUnits(course, resolvedChapters);
  const curriculumOverview = {
    framework: 'NCF-SE 2023',
    totalMarks: 100,
    internalMarks: 20,
  };

  const stats = [
    { label: 'Total Units', value: units.length, icon: BookOpen },
    { label: 'Enrollments', value: course.enrollments, icon: Users },
    { label: 'Duration', value: `${Math.floor(course.chapters * 1.5)} weeks`, icon: Clock },
    { label: 'Completion', value: `${course.progress}%`, icon: Target },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${course.accentColor}15`, color: course.accentColor }}
              >
                <IconComponent size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{course.title}</h1>
                <p className="text-slate-600 mt-1">Curriculum Overview</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="h-10 rounded-xl border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              >
                Back to Courses
              </Button>
            </div>
          </div>
        </div>

        {/* Course Overview Card */}
        <div className="mb-8 rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-slate-500">Course Code:</span>
                <span className="font-mono text-sm font-semibold text-slate-800 bg-slate-50 px-3 py-1 rounded-lg">
                  {course.code}
                </span>
                <Badge className={cn('text-xs font-semibold', getStatusColor(course.status))}>
                  {course.status}
                </Badge>
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
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">Category:</span>
                  <span className="font-medium text-slate-800">{course.category}</span>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-4 lg:w-auto w-full">
              {stats.map((stat) => {
                const StatIcon = stat.icon;
                return (
                  <div key={stat.label} className="flex items-center gap-3 rounded-xl bg-slate-50/60 px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-500">
                      <StatIcon size={18} />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-slate-900">{stat.value}</div>
                      <div className="text-xs text-slate-500">{stat.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Curriculum Overview Section */}
        <div className="mb-8 overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-sm">
          <div className="border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.05),_transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] px-6 py-5 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                <ClipboardList size={18} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">LMS Curriculum Overview</h2>
                <p className="text-sm text-slate-500">Summary aligned to the curriculum framework</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 divide-y divide-slate-200/80 md:grid-cols-3 md:divide-x md:divide-y-0">
            <div className="px-6 py-5 sm:px-8">
              <p className="text-sm font-medium text-slate-500">Framework</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{curriculumOverview.framework}</p>
            </div>
            <div className="px-6 py-5 sm:px-8">
              <p className="text-sm font-medium text-slate-500">Total Marks</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{curriculumOverview.totalMarks}</p>
            </div>
            <div className="px-6 py-5 sm:px-8">
              <p className="text-sm font-medium text-slate-500">Internal Marks</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{curriculumOverview.internalMarks}</p>
            </div>
          </div>
        </div>

        {/* Units Breakdown Table */}
        <div className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-sm">
          <div className="border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.05),_transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] px-6 py-5 sm:px-8">
            <h3 className="text-xl font-bold text-slate-900">LMS Units Breakup</h3>
            <p className="mt-1 text-sm text-slate-500">Structured view of units, included chapters, and assessment weightage</p>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[80px_240px_minmax(360px,1fr)_120px_110px] border-b border-slate-200/80 bg-slate-50/70 px-4 py-4 text-sm font-semibold text-slate-700 sm:px-6">
                <div>Unit No.</div>
                <div>Name / Title</div>
                <div>Chapters Included</div>
                <div>Periods</div>
                <div>Marks</div>
              </div>

              <div className="divide-y divide-slate-200/80">
                {units.map((unit) => (
                  <div
                    key={unit.id}
                    className="grid grid-cols-[80px_240px_minmax(360px,1fr)_120px_110px] items-start px-4 py-4 transition-colors hover:bg-slate-50/70 sm:px-6"
                  >
                    <div className="pt-1 text-lg font-medium text-slate-800">{unit.id}</div>
                    <div className="space-y-3 pr-4">
                      <div className="text-lg font-semibold leading-8 text-slate-900">{unit.name}</div>
                      <Badge className={cn(
                        'w-fit rounded-full border px-3 py-1 text-xs font-semibold',
                        unit.status === 'Completed' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                        unit.status === 'In Progress' && 'border-blue-200 bg-blue-50 text-blue-700',
                        unit.status === 'Not Started' && 'border-slate-200 bg-slate-100 text-slate-600'
                      )}>
                        {unit.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2 pr-6">
                      {unit.chapters.map((chapter) => (
                        <span
                          key={chapter.id}
                          className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                        >
                          {chapter.title}
                        </span>
                      ))}
                    </div>

                    <div className="pt-1 text-lg font-semibold text-slate-700">{unit.periods}</div>
                    <div className="pt-1 text-lg font-semibold text-slate-900">{unit.marks}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* LMS Learning Outcomes Breakup */}
        <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/30 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Target size={20} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">LMS Learning Outcomes Breakup</h3>
                <p className="text-sm text-slate-500">Goals and competencies for this course</p>
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-slate-100">
            {learningOutcomes.map((outcome) => {
              const isGoal = outcome.type === 'Goal';
              const isCompetency = outcome.type === 'competency';
              
              return (
                <div
                  key={outcome.code}
                  className={cn(
                    'transition-colors',
                    isGoal && 'bg-indigo-50/40',
                    !isGoal && 'pl-12 md:pl-16'
                  )}
                >
                  <div className="px-4 py-4 sm:px-6 sm:py-5">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                      <div className="flex items-center gap-2 sm:w-24 sm:flex-shrink-0">
                        <span className="font-mono text-sm font-semibold text-slate-800">
                          {outcome.code}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                              isGoal &&
                                'bg-indigo-100 text-indigo-700 border border-indigo-200',
                              isCompetency &&
                                'bg-blue-50 text-blue-700 border border-blue-100'
                            )}
                          >
                            {outcome.type}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">
                          {outcome.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
