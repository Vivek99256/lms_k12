'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Briefcase,
  ClipboardList,
  Compass,
  Cpu,
  Dumbbell,
  FlaskConical,
  Globe,
  Library,
  Music,
  Palette,
  PenTool,
  Search,
  Sigma,
  type LucideIcon,
} from 'lucide-react';
import { courses, type Course } from './data/courses';

const WORKSPACE_TABS = [
  { key: 'lms', label: 'LMS' },
  { key: 'teach', label: 'Teach / learn', icon: BookOpen },
  { key: 'test', label: 'Test', icon: ClipboardList },
] as const;

const SECTION_BADGES = ['Section A', 'Section A', 'Section B', 'Section B'] as const;

const SUBJECT_ICON_MAP: Record<Course['icon'], LucideIcon> = {
  'book-open': BookOpen,
  'flask-conical': FlaskConical,
  calculator: Sigma,
  globe: Globe,
  'pen-tool': PenTool,
  music: Music,
  dumbbell: Dumbbell,
  briefcase: Briefcase,
  palette: Palette,
  library: Library,
  cpu: Cpu,
  compass: Compass,
};

function getCourseRoutes(courseId: string) {
  return {
    chapters: `/course-master/${courseId}/chapters`,
    lessonPlan: `/course-master/lesson-plan/${courseId}`,
    curriculum: `/course-master/lesson-plan/${courseId}/curriculum`,
  };
}

function getGradeLabel(classGrade: string) {
  const grade = classGrade.replace('Class', '').trim();
  return `Grade ${grade}`;
}

function getSectionLabel(index: number) {
  return SECTION_BADGES[index % SECTION_BADGES.length];
}

function getKeyConceptCount(chapters: number, enrollments: number) {
  return chapters * 3 + (enrollments % 11) + 5;
}

function getLessonPlanCount(chapters: number, progress: number) {
  return Math.max(1, Math.round((chapters * progress) / 30));
}

export default function CourseMasterPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<(typeof WORKSPACE_TABS)[number]['key']>('teach');
  const [search, setSearch] = useState('');
  const [standardFilter, setStandardFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');

  const standardOptions = useMemo(() => {
    return Array.from(
      new Set(courses.map((course) => course.classGrade.replace('Class', '').trim()))
    ).sort((a, b) => Number(a) - Number(b));
  }, []);

  const filteredCourses = useMemo(() => {
    return courses.filter((course, index) => {
      const matchesSearch =
        course.subject.toLowerCase().includes(search.toLowerCase()) ||
        course.title.toLowerCase().includes(search.toLowerCase()) ||
        course.code.toLowerCase().includes(search.toLowerCase());

      const matchesStandard =
        standardFilter === 'all' || course.classGrade.replace('Class', '').trim() === standardFilter;

      const matchesSection =
        sectionFilter === 'all' || getSectionLabel(index) === sectionFilter;

      return matchesSearch && matchesStandard && matchesSection;
    });
  }, [search, standardFilter, sectionFilter]);

  return (
    <div className="min-h-full bg-[#E9EEF7] px-6 py-5">
      <div className="mx-auto max-w-[1800px]">
        

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative w-full max-w-[300px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search subjects..."
              className="h-10 w-full rounded-[10px] border border-[#C7D2E4] bg-white pl-11 pr-4 text-[14px] text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#5648E8]"
            />
          </div>

          <select
            value={standardFilter}
            onChange={(event) => setStandardFilter(event.target.value)}
            className="h-10 min-w-[165px] rounded-[10px] border border-[#C7D2E4] bg-white px-4 text-[14px] text-[#0F172A] outline-none focus:border-[#5648E8]"
          >
            <option value="all">All standards</option>
            {standardOptions.map((standard) => (
              <option key={standard} value={standard}>
                Grade {standard}
              </option>
            ))}
          </select>

          <select
            value={sectionFilter}
            onChange={(event) => setSectionFilter(event.target.value)}
            className="h-10 min-w-[165px] rounded-[10px] border border-[#C7D2E4] bg-white px-4 text-[14px] text-[#0F172A] outline-none focus:border-[#5648E8]"
          >
            <option value="all">All sections</option>
            <option value="Section A">Section A</option>
            <option value="Section B">Section B</option>
          </select>
        </div>

        <p className="mt-3 text-[15px] font-medium text-[#334155]">
          {filteredCourses.length} of {courses.length} subjects
        </p>

        {filteredCourses.length === 0 ? (
          <div className="mt-8 rounded-[18px] border border-[#D9E1EE] bg-white px-6 py-16 text-center text-[#64748B] shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
            No subjects found for the selected filters.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {filteredCourses.map((course, index) => {
              const routes = getCourseRoutes(course.id);
              const keyConcepts = getKeyConceptCount(course.chapters, course.enrollments);
              const lessonPlanCount = getLessonPlanCount(course.chapters, course.progress);
              const sectionLabel = getSectionLabel(index);
              const SubjectIcon = SUBJECT_ICON_MAP[course.icon] ?? BookOpen;

              return (
                <div
                  key={course.id}
                  className="rounded-[14px] border border-[#DCE4F0] bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.05)] sm:p-[18px]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#EDF2F8] text-[#5648E8] sm:h-12 sm:w-12">
                        <SubjectIcon className="h-[18px] w-[18px] sm:h-5 sm:w-5" strokeWidth={1.9} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-[16px] font-semibold leading-5 text-[#0F172A] sm:text-[17px]">
                          {course.subject}
                        </h3>
                        <p className="mt-1 text-[13px] leading-5 text-[#475569] sm:text-[14px]">
                          {getGradeLabel(course.classGrade)} · {sectionLabel}
                        </p>
                      </div>
                    </div>

                    <span className="shrink-0 whitespace-nowrap rounded-full bg-[#F2F5FA] px-3 py-1 text-[12px] font-medium text-[#51657F] sm:text-[13px]">
                      {course.chapters} chapters
                    </span>
                  </div>

                  <p className="mt-4 text-[13px] leading-5 text-[#3F5572] sm:text-[14px]">
                    {keyConcepts} key concepts · {lessonPlanCount} lesson plans created
                  </p>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-[14px] font-medium text-[#334155] sm:text-[15px]">Lesson planning coverage</span>
                    <span className="text-[14px] font-semibold text-[#334155] sm:text-[15px]">{course.progress}%</span>
                  </div>

                  <div className="mt-2.5 h-[7px] overflow-hidden rounded-full bg-[#EEF2F7]">
                    <div
                      className="h-full rounded-full bg-[#5648E8]"
                      style={{ width: `${course.progress}%` }}
                    />
                  </div>

                  <div className="mt-4 border-t border-[#E4EAF2] pt-4">
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => router.push(routes.lessonPlan)}
                        className="col-span-2 rounded-[16px] border border-[#C8D3E3] bg-white px-4 py-2.5 text-[14px] font-medium text-[#0F172A] shadow-[0_2px_6px_rgba(15,23,42,0.06)] transition hover:border-[#AAB8CF] sm:text-[15px]"
                      >
                        Lesson plans
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(routes.curriculum)}
                        className="min-w-0 rounded-[16px] border border-[#C8D3E3] bg-white px-3 py-2.5 text-[14px] font-medium text-[#0F172A] shadow-[0_2px_6px_rgba(15,23,42,0.06)] transition hover:border-[#AAB8CF] sm:px-4 sm:text-[15px]"
                      >
                        Curriculum
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(routes.chapters)}
                        className="min-w-0 rounded-[16px] border border-[#C8D3E3] bg-white px-3 py-2.5 text-[14px] font-medium text-[#0F172A] shadow-[0_2px_6px_rgba(15,23,42,0.06)] transition hover:border-[#AAB8CF] sm:px-4 sm:text-[15px]"
                      >
                        Chapters
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
