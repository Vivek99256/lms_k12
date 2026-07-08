'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { BookOpen, ChevronDown, ChevronRight, FlaskConical, GraduationCap, List, CalendarDays } from 'lucide-react';
import { getChaptersByCourseid } from '../../../data/chapters';
import type { Chapter } from '../../../data/chapters';
import { courses } from '../../../data/courses';
import type { Course } from '../../../data/courses';

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

const UNIT_MONTH_RANGES = ['Apr-Jul', 'Apr-May', 'Aug-Oct', 'Nov-Feb', 'Mar-Apr'] as const;

function getCourseSectionLabel(courseId: string) {
  const numeric = Number(courseId.replace(/\D/g, '')) || 0;
  return numeric % 2 === 0 ? 'Section A' : 'Section B';
}

function getCourseGradeLabel(classGrade: string) {
  return `Grade ${classGrade.replace('Class', '').trim()}`;
}

function getCurriculumLabel(course: Course) {
  return course.category === 'STEM Resources' ? 'STEM curriculum' : 'CBSE curriculum';
}

function getTotalKeyConceptCount(course: Course, chapters: Chapter[]) {
  return Math.max(course.chapters * 4 + chapters.length, 12);
}

function getUnitLearningOutcomes(unitId: number) {
  const goalIndex = Math.max(0, (unitId - 1) % Math.ceil(learningOutcomes.length / 2));
  return learningOutcomes.slice(goalIndex, goalIndex + 4);
}

export default function CurriculumPage() {
  const router = useRouter();
  const { courseId } = useParams();
  const course = courses.find((c) => c.id === courseId);
  const [openUnitId, setOpenUnitId] = useState<number>(2);

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

  const chapterCount = Math.max(course.chapters, getChaptersByCourseid(course.id).length);
  const resolvedChapters = buildResolvedChapters(course, chapterCount, getChaptersByCourseid(course.id));
  const units = generateCurriculumUnits(course, resolvedChapters);
  const sectionLabel = getCourseSectionLabel(course.id);
  const gradeLabel = getCourseGradeLabel(course.classGrade);
  const curriculumLabel = getCurriculumLabel(course);
  const totalKeyConcepts = getTotalKeyConceptCount(course, resolvedChapters);
  const accordionUnits = units.map((unit, index) => ({
    ...unit,
    title:
      index === 0
        ? `${course.subject} foundations`
        : index === 1
          ? 'Force, motion and energy'
          : index === 2
            ? 'Electricity and light'
            : index === 3
              ? 'Natural phenomena and resources'
              : unit.name.replace(`${course.subject} `, ''),
    chapterRange: `Chapters ${unit.chapters[0]?.number ?? 1}-${unit.chapters[unit.chapters.length - 1]?.number ?? unit.chapterCount}`,
    monthRange: UNIT_MONTH_RANGES[index] ?? 'Apr-May',
    isCurrent: index === 1,
    outcomes: getUnitLearningOutcomes(unit.id),
  }));

  return (
   <div className="min-h-screen bg-[#E9EEF7] rounded-t-3xl">
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

        <div className="mb-4 border-b border-[#D8E1F0]">
          <div className="flex flex-wrap items-center gap-8">
            <button
              type="button"
              onClick={() => router.push(`/course-master/lesson-plan/${course.id}`)}
              className="pb-3 text-[15px] font-medium text-[#334155] transition hover:text-[#0F172A]"
            >
              <span className="inline-flex items-center gap-2">
                <CalendarDays size={16} />
                Lesson plans
              </span>
            </button>
            <button
              type="button"
              className="border-b-2 border-[#4F46E5] pb-3 text-[15px] font-medium text-[#4F46E5]"
            >
              <span className="inline-flex items-center gap-2">
                <GraduationCap size={16} />
                Curriculum
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push(`/course-master/${course.id}/chapters`)}
              className="pb-3 text-[15px] font-medium text-[#334155] transition hover:text-[#0F172A]"
            >
              <span className="inline-flex items-center gap-2">
                <List size={16} />
                Chapters
              </span>
            </button>
          </div>
        </div>

        <div className="space-y-5">
          {accordionUnits.map((unit) => {
            const isOpen = openUnitId === unit.id;
            const Icon = isOpen ? ChevronDown : ChevronRight;

            return (
              <div
                key={unit.id}
                className="overflow-hidden rounded-[12px] border border-[#D8E1F0] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)]"
              >
                <button
                  type="button"
                  onClick={() => setOpenUnitId((current) => (current === unit.id ? -1 : unit.id))}
                  className="flex w-full items-start gap-3 px-6 py-5 text-left"
                >
                  <span className="mt-1 text-[#365172]">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[18px] font-semibold leading-7 text-[#0F172A]">
                      Unit {unit.id} · {unit.title}
                    </h3>
                    <p className="mt-1 text-[15px] text-[#365172]">
                      {unit.chapterRange} · {unit.monthRange}
                      {unit.isCurrent ? ' (current)' : ''}
                    </p>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-[#E2E8F0] px-6 py-6">
                    <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
                      Learning Outcomes
                    </p>
                    <div className="space-y-3">
                      {unit.outcomes.map((outcome) => (
                        <div key={`${unit.id}-${outcome.code}`} className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex rounded-[6px] border border-[#D8E1F0] bg-[#F8FAFC] px-2 py-1 font-mono text-[13px] text-[#365172]">
                            {outcome.code}
                          </span>
                          <p className="text-[16px] leading-7 text-[#0F172A]">{outcome.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
