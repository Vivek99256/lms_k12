'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Briefcase,
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
import { useAuth } from '@/contexts/AuthContext';
import { getStoredMenuContext } from '@/app/hooks/useMenuRights';
import {
  fetchLmsCourses,
  groupCoursesByStandard,
  type LmsCoursesResponse,
  type LmsSubject,
} from './data/lmsCourses';
import { type Course } from './data/courses';

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  'My Course': BookOpen,
  SEL: Music,
  'STEM Resources': Cpu,
  'Career Counselling': Compass,
  'Foundational Skills': Sigma,
  'Soft Skills': Briefcase,
  Sports: Dumbbell,
  'Vocational Traning': PenTool,
  'Hobbies and Activities': Palette,
  Library: Library,
};

const CATEGORY_ACCENT_MAP: Record<string, string> = {
  'My Course': '#5648E8',
  SEL: '#EC4899',
  'STEM Resources': '#0891B2',
  'Career Counselling': '#7C3AED',
  'Foundational Skills': '#3B82F6',
  'Soft Skills': '#F43F5E',
  Sports: '#84CC16',
  'Vocational Traning': '#D97706',
  'Hobbies and Activities': '#6366F1',
  Library: '#DB2777',
};

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

function getCourseRoutes(courseId: number | string, standardId?: number | string) {
  const id = standardId != null && standardId !== '' ? `${courseId}-${standardId}` : courseId;
  return {
    chapters: `/course-master/${id}/chapters`,
    lessonPlan: `/course-master/lesson-plan/${id}`,
    curriculum: `/course-master/lesson-plan/${id}/curriculum`,
  };
}

function getGradeLabel(standardName: string) {
  return `Grade ${standardName}`;
}

export function getSyear(): string {
  if (typeof window === 'undefined') return '';

  const selected = localStorage.getItem('selectedAcademicYear');
  if (selected) return selected;

  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    const academicYears = userData.academicYears;
    if (Array.isArray(academicYears) && academicYears.length > 0) {
      const first = academicYears[0] as Record<string, unknown>;
      if (first.syear != null) return String(first.syear);
    }
    if (userData.academic_year_id != null) return String(userData.academic_year_id);
    if (userData.academicYearId != null) return String(userData.academicYearId);
  } catch {
    return '';
  }
  return '';
}

export function getRequestContext(): {
  sub_institute_id: number;
  user_id: number;
  user_profile_id: number;
  user_profile_name: string;
  client_id: number;
} | null {
  if (typeof window === 'undefined') return null;

  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;

    const readNumber = (...keys: string[]): number => {
      for (const key of keys) {
        const value = userData[key] ?? menuContext[key];
        if (value != null && value !== '') return Number(value);
      }
      return 0;
    };
    const readString = (...keys: string[]): string => {
      for (const key of keys) {
        const value = userData[key] ?? menuContext[key];
        if (value != null && value !== '') return String(value);
      }
      return '';
    };

    const sub_institute_id = readNumber('sub_institute_id');
    if (!sub_institute_id) return null;

    return {
      sub_institute_id,
      user_id: readNumber('user_id', 'userId', 'id'),
      user_profile_id: readNumber('user_profile_id'),
      user_profile_name: readString('user_profile_name', 'userProfileName'),
      client_id: readNumber('client_id'),
    };
  } catch {
    return null;
  }
}

export default function CourseMasterPage() {
  const router = useRouter();
  const { menuContext } = useAuth();

  const [data, setData] = useState<LmsCoursesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [standardFilter, setStandardFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const requestContext = getRequestContext() ?? menuContext ?? getStoredMenuContext();
    if (!requestContext) {
      setError('Course master session data is missing.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchLmsCourses({
      type: 'API',
      sub_institute_id: requestContext.sub_institute_id,
      syear: getSyear(),
      user_id: requestContext.user_id,
      user_profile_name: requestContext.user_profile_name,
      user_profile_id: requestContext.user_profile_id,
      client_id: requestContext.client_id,
    })
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [menuContext]);

  const standardOptions = useMemo(() => {
    if (!data) return [];
    const standards = new Set<string>();
    for (const subject of data.lms_subject) {
      standards.add(subject.standard_name);
    }
    return Array.from(standards).sort((a, b) => Number(a) - Number(b));
  }, [data]);

  const categoryOptions = useMemo(() => {
    return data?.categories ?? [];
  }, [data]);

  const groupedByStandard = useMemo(() => {
    if (!data) return [];
    return groupCoursesByStandard(data.lms_subject);
  }, [data]);

  const filteredGroups = useMemo(() => {
    const searchLower = search.toLowerCase();
    return groupedByStandard
      .filter((group) => standardFilter === 'all' || group.standardName === standardFilter)
      .map((group) => ({
        ...group,
        categories: group.categories
          .filter(
            (category) => categoryFilter === 'all' || category.categoryName === categoryFilter
          )
          .map((category) => ({
            ...category,
            subjects: category.subjects.filter(
              (subject) =>
                subject.subject_name.toLowerCase().includes(searchLower) ||
                category.categoryName.toLowerCase().includes(searchLower)
            ),
          }))
          .filter((category) => category.subjects.length > 0),
      }))
      .filter((group) => group.categories.length > 0);
  }, [groupedByStandard, search, standardFilter, categoryFilter]);

  const totalSubjects = useMemo(
    () => filteredGroups.reduce(
      (sum, group) => sum + group.categories.reduce((c, cat) => c + cat.subjects.length, 0),
      0
    ),
    [filteredGroups]
  );

  const visibleGroups = useMemo(() => {
    if (visibleCount >= totalSubjects) return filteredGroups;

    let count = 0;
    const result: typeof filteredGroups = [];

    for (const group of filteredGroups) {
      if (count >= visibleCount) break;
      const categories: typeof group.categories = [];
      for (const category of group.categories) {
        if (count >= visibleCount) break;
        const remaining = visibleCount - count;
        const subjects = category.subjects.slice(0, remaining);
        if (subjects.length > 0) {
          categories.push({ ...category, subjects });
          count += subjects.length;
        }
      }
      if (categories.length > 0) {
        result.push({ ...group, categories });
      }
      if (count >= visibleCount) break;
    }

    return result;
  }, [filteredGroups, visibleCount, totalSubjects]);

  const hasMore = visibleCount < totalSubjects;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + PAGE_SIZE);
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

  function renderSubjectCard(subject: LmsSubject) {
    const routes = getCourseRoutes(subject.subject_id, subject.standard_id);
    const category = subject.content_category;
    const SubjectIcon = CATEGORY_ICON_MAP[category] ?? BookOpen;
    const accent = CATEGORY_ACCENT_MAP[category] ?? '#5648E8';
    const chapterCount = Array.isArray(subject.chapters) ? subject.chapters.length : 0;
    const keyConcepts = chapterCount;
    const lessonPlanCount = Array.isArray(subject.chapters)
      ? subject.chapters.reduce((sum, chapter) => sum + (Number(chapter.total_content) || 0), 0)
      : 0;
    const progress =
      chapterCount > 0
        ? Math.round(
            (subject.chapters.filter((chapter) => Number(chapter.total_content) > 0).length /
              chapterCount) *
              100
          )
        : 0;

    return (
      <div
        key={subject.subject_id}
        className="rounded-[14px] border border-[#DCE4F0] bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.05)] sm:p-[18px]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] sm:h-12 sm:w-12"
              style={{ backgroundColor: `${accent}1A`, color: accent }}
            >
              <SubjectIcon className="h-[18px] w-[18px] sm:h-5 sm:w-5" strokeWidth={1.9} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-[16px] font-semibold leading-5 text-[#0F172A] sm:text-[17px]">
                {subject.subject_name}
              </h3>
              <p className="mt-1 text-[13px] leading-5 text-[#475569] sm:text-[14px]">
                {getGradeLabel(subject.standard_name)} Â· {category}
              </p>
            </div>
          </div>

          <span className="shrink-0 whitespace-nowrap rounded-full bg-[#F2F5FA] px-3 py-1 text-[12px] font-medium text-[#51657F] sm:text-[13px]">
            {chapterCount} chapters
          </span>
        </div>

        <p className="mt-4 text-[13px] leading-5 text-[#3F5572] sm:text-[14px]">
          {keyConcepts} key concepts Â· {lessonPlanCount} lesson plans created
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[14px] font-medium text-[#334155] sm:text-[15px]">Lesson planning coverage</span>
          <span className="text-[14px] font-semibold text-[#334155] sm:text-[15px]">{progress}%</span>
        </div>

        <div className="mt-2.5 h-[7px] overflow-hidden rounded-full bg-[#EEF2F7]">
          <div
            className="h-full rounded-full bg-[#5648E8]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-4 border-t border-[#E4EAF2] pt-4">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => router.push(routes.lessonPlan)}
              className="col-span-2 rounded-[16px] border border-[#C8D3E3] bg-white px-4 py-2.5 text-[14px] font-medium text-[#0F172A] shadow-[0_2px_6px_rgba(15,23,42,0.06)] transition hover:border-[#AAB8CF] sm:text-[15px]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="ds-icon" aria-hidden="true" style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle' }}><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path></svg>{" "}
              Lesson plans
            </button>
            <button
              type="button"
              onClick={() => router.push(routes.curriculum)}
              className="min-w-0 rounded-[16px] border border-[#C8D3E3] bg-white px-3 py-2.5 text-[14px] font-medium text-[#0F172A] shadow-[0_2px_6px_rgba(15,23,42,0.06)] transition hover:border-[#AAB8CF] sm:px-4 sm:text-[15px]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="ds-icon" aria-hidden="true" style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle' }}><path d="M8 5h13"></path><path d="M13 12h8"></path><path d="M13 19h8"></path><path d="M3 10a2 2 0 0 0 2 2h3"></path><path d="M3 5v12a2 2 0 0 0 2 2h3"></path></svg>{" "}
              Curriculum
            </button>
            <button
              type="button"
              onClick={() => router.push(routes.chapters)}
              className="min-w-0 rounded-[16px] border border-[#C8D3E3] bg-white px-3 py-2.5 text-[14px] font-medium text-[#0F172A] shadow-[0_2px_6px_rgba(15,23,42,0.06)] transition hover:border-[#AAB8CF] sm:px-4 sm:text-[15px]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="ds-icon" aria-hidden="true" style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle' }}><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg>{" "}
              Chapters
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full px-6 py-5">
      <div className="mx-auto max-w-[1800px]">
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative w-full max-w-[300px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="Search subjects..."
              className="h-10 w-full rounded-[10px] border border-[#C7D2E4] bg-white pl-11 pr-4 text-[14px] text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#5648E8]"
            />
          </div>

          <select
            value={standardFilter}
            onChange={(event) => {
              setStandardFilter(event.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="h-10 min-w-[165px] rounded-[10px] border border-[#C7D2E4] bg-white px-4 text-[14px] text-[#0F172A] outline-none focus:border-[#5648E8]"
          >
            <option value="all">All standards</option>
            {standardOptions.map((standard) => (
              <option key={standard} value={standard}>
                Grade {standard}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setCategoryFilter('all');
              setVisibleCount(PAGE_SIZE);
            }}
            className={`rounded-full border px-4 py-2 text-[14px] font-medium transition ${
              categoryFilter === 'all'
                ? 'border-[#5648E8] bg-[#5648E8] text-white'
                : 'border-[#D9E1EE] bg-white text-[#334155] hover:border-[#B8C5D9]'
            }`}
          >
            All
          </button>
          {categoryOptions.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                setCategoryFilter(category);
                setVisibleCount(PAGE_SIZE);
              }}
              className={`rounded-full border px-4 py-2 text-[14px] font-medium transition ${
                categoryFilter === category
                  ? 'border-[#5648E8] bg-[#5648E8] text-white'
                  : 'border-[#D9E1EE] bg-white text-[#334155] hover:border-[#B8C5D9]'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-8 rounded-[18px] border border-[#D9E1EE] bg-white px-6 py-16 text-center text-[#64748B] shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
            Loading courses...
          </div>
        ) : error ? (
          <div className="mt-8 rounded-[18px] border border-[#D9E1EE] bg-white px-6 py-16 text-center text-[#64748B] shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
            {error}
          </div>
        ) : (
          <>
            <p className="mt-3 text-[15px] font-medium text-[#334155]">
              {totalSubjects} subjects
            </p>

            {totalSubjects === 0 ? (
              <div className="mt-8 rounded-[18px] border border-[#D9E1EE] bg-white px-6 py-16 text-center text-[#64748B] shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
                No subjects found for the selected filters.
              </div>
            ) : (
              <>
                <div className="mt-6 flex flex-col gap-10">
                  {visibleGroups.map((group) => (
                    <section key={group.standardName}>
                      <h2 className="mb-4 text-[20px] font-semibold text-[#0F172A]">
                        {getGradeLabel(group.standardName)}
                      </h2>

                      <div className="flex flex-col gap-6">
                        {group.categories.map((category) => (
                          <div key={category.categoryName}>
                            <h3 className="mb-3 text-[15px] font-medium text-[#475569]">
                              {category.categoryName}
                            </h3>
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                              {category.subjects.map((subject) => renderSubjectCard(subject))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                {hasMore && (
                  <div
                    ref={sentinelRef}
                    className="mt-10 flex items-center justify-center"
                  >
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#C8D3E3] border-t-[#5648E8]" />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
