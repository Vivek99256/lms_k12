'use client';
//add semi
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRegisterPageAiContext } from '@/contexts/PageAiContext';
import { isStudentSession } from '@/app/pal/data/pal-lookups';
import {
  BookOpen,
  Briefcase,
  CalendarDays,
  ClipboardList,
  Compass,
  Cpu,
  Dumbbell,
  FlaskConical,
  Globe,
  Library,
  ListTree,
  Music,
  Palette,
  PenTool,
  Search,
  Sigma,
  type LucideIcon,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
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
const SECTION_BADGES = ['Section A', 'Section A', 'Section B', 'Section B'] as const;
const LEARNING_TABS = [
  { key: 'learn', label: 'Learn', icon: BookOpen },
  { key: 'test', label: 'Test', icon: ClipboardList },
] as const;

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

const SUBJECT_CARD_PALETTES = [
  { accent: '#6366F1', soft: '#EEEEFF' },
  { accent: '#10B981', soft: '#E6F8F1' },
  { accent: '#8B5CF6', soft: '#F1EAFF' },
  { accent: '#F59E0B', soft: '#FFF4D9' },
  { accent: '#06B6D4', soft: '#E1F8FC' },
  { accent: '#EC4899', soft: '#FDE9F3' },
  { accent: '#EF4444', soft: '#FDEBEC' },
  { accent: '#D97706', soft: '#FFF0DF' },
  { accent: '#65C600', soft: '#F0FAE7' },
  { accent: '#4F7DF3', soft: '#EAF0FF' },
] as const;

function getSubjectCardPalette(subjectId: number | string) {
  const numericId = Number(subjectId);
  const index = Number.isFinite(numericId)
    ? Math.abs(numericId) % SUBJECT_CARD_PALETTES.length
    : String(subjectId).length % SUBJECT_CARD_PALETTES.length;
  return SUBJECT_CARD_PALETTES[index];
}

function getCourseRoutes(courseId: number | string, standardId?: number | string) {
  const id = standardId != null && standardId !== '' ? `${courseId}-${standardId}` : courseId;
  return {
    chapters: `/course-master/${id}/chapters`,
    lessonPlan: `/course-master/lesson-plan/${id}`,
    curriculum: `/course-master/lesson-plan/${id}/curriculum`,
  };
}

function buildStudentPageRoute(
  subject: {
  sectionId: string;
  sectionName: string;
  standard_id: number;
  subject_id: number;
  sub_institute_id?: number;
},
  view: 'curriculum' | 'chapters'
) {
  const requestContext = getRequestContext();
  const params = new URLSearchParams({
    view,
    subject_id: String(subject.subject_id),
    standard_id: String(subject.standard_id),
    section_id: String(subject.sectionId),
    section_name: subject.sectionName,
    syear: getSyear(),
  });

  if (subject.sub_institute_id || requestContext?.sub_institute_id) {
    params.set('sub_institute_id', String(subject.sub_institute_id ?? requestContext?.sub_institute_id));
  }

  return `/student?${params.toString()}`;
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

  // The audience toggle is a staff affordance for previewing the student view.
  // Resolved during render rather than in an effect so a student never gets a
  // painted frame of the teacher interface before it is hidden.
  const [isStaff, setIsStaff] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !isStudentSession();
  });


  // The session can arrive after first paint, so the flag is re-read on mount.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsStaff(!isStudentSession());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The audience follows the signed-in role and is not switchable: staff get the
  // teacher interface, students the student one. With the Viewing-as toggle gone
  // there is no stored preference left to strand anyone in the wrong view.
  const effectiveAudienceMode: 'Teacher' | 'Student' = isStaff ? 'Teacher' : 'Student';
  const [data, setData] = useState<LmsCoursesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLearningTab, setActiveLearningTab] = useState<(typeof LEARNING_TABS)[number]['key']>('learn');
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

  const studentSubjects = useMemo(() => {
    return (data?.lms_subject ?? []).map((subject, index) => {
      const fallbackSectionName = SECTION_BADGES[index % SECTION_BADGES.length];
      const sectionName =
        subject.section_name ||
        subject.section ||
        subject.division_name ||
        subject.division ||
        fallbackSectionName;
      const sectionId = String(subject.section_id ?? subject.division_id ?? sectionName);
      const chapterCount = Number(
        subject.chapter_count ??
          subject.chapters_count ??
          subject.chapters?.length ??
          0
      );
      const keyConceptCount = Number(
        subject.key_concept_count ??
          subject.key_concepts_count ??
          subject.concepts_count ??
          subject.total_concepts ??
          subject.keyConcepts?.length ??
          subject.concepts?.length ??
          (Array.isArray(subject.chapters)
            ? subject.chapters.reduce(
                (sum, chapter) => sum + (Array.isArray(chapter.concepts) ? chapter.concepts.length : 0),
                0
              )
            : 0)
      );
      const lessonPlanCount = Number(
        subject.lesson_plan_count ??
          subject.lesson_plans_count ??
          subject.total_lesson_plans ??
          subject.lessonPlans?.length ??
          (Array.isArray(subject.chapters)
            ? subject.chapters.reduce((sum, chapter) => sum + (Number(chapter.total_content) || 0), 0)
            : 0)
      );
      const coverage = Number(
        subject.coverage_percentage ??
          subject.lesson_planning_coverage ??
          (chapterCount > 0 && Array.isArray(subject.chapters)
            ? Math.round(
                (subject.chapters.filter((chapter) => Number(chapter.total_content) > 0).length / chapterCount) *
                  100
              )
            : 0)
      );

      return {
        ...subject,
        sectionId,
        sectionName,
        chapterCount,
        keyConceptCount,
        lessonPlanCount,
        coverage,
      };
    });
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

  const filteredStudentSubjects = useMemo(() => {
    return studentSubjects.filter((subject) => {
      const matchesStandard =
        standardFilter === 'all' || subject.standard_name === standardFilter;

      const matchesCategory =
        categoryFilter === 'all' ||
        (subject.category_name || subject.content_category) === categoryFilter;

      return matchesStandard && matchesCategory;
    });
  }, [categoryFilter, standardFilter, studentSubjects]);

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

  /*
   * Tell the assistant what the catalogue is showing.
   *
   * This page is the reason facets exist. Nothing is selected and usually nothing is
   * filtered, so without the grade and category lists there is no page-specific
   * material at all and the panel falls back to "what can I do on this page?" — which
   * is exactly what it was doing.
   *
   * Only the courses that survive the current filters are sent, capped by the provider,
   * with the true total alongside so the assistant never describes a window as the
   * whole catalogue.
   */
  const catalogSubjects = effectiveAudienceMode === 'Student' ? filteredStudentSubjects : null;

  useRegisterPageAiContext(
    useMemo(() => {
      // Nothing useful to say until the catalogue has loaded.
      if (loading || error || !data) {
        return null;
      }

      const courses = catalogSubjects
        ? catalogSubjects.map((subject) => ({
            id: subject.subject_id,
            label: subject.subject_name,
            grade: subject.standard_name,
            category: subject.category_name || subject.content_category,
          }))
        : filteredGroups.flatMap((group) =>
            group.categories.flatMap((category) =>
              category.subjects.map((subject) => ({
                id: subject.subject_id,
                label: subject.subject_name,
                grade: group.standardName,
                category: category.categoryName,
              }))
            )
          );

      return {
        // The audience mode belongs in the title rather than in `filters`. It changes
        // which courses are listed, but calling it a filter made the assistant offer
        // "explain what this filtered view shows" on an unfiltered catalogue — a weak
        // suggestion occupying a slot a real question could use.
        pageTitle: `Course Catalog (${effectiveAudienceMode} view)`,
        pageType: 'list' as const,
        searchQuery: search,
        filters: {
          // "all" is dropped at both ends, so an unfiltered catalogue reports no
          // filters rather than "Grade: all".
          grade: standardFilter,
          category: categoryFilter,
        },
        facets: [
          {
            key: 'grade',
            label: 'Grade',
            values: standardOptions,
            question: 'What courses are available for Grade {value}?',
          },
          {
            key: 'category',
            label: 'Category',
            values: categoryOptions,
            question: 'Show me the courses available under {value}.',
          },
        ],
        records: courses,
        recordCount: courses.length,
        availableActions: [
          { key: 'search_courses', label: 'Search the catalogue' },
          { key: 'filter_by_grade', label: 'Filter by grade' },
          { key: 'filter_by_category', label: 'Filter by category' },
          { key: 'open_course', label: 'Open a course' },
          { key: 'view_chapters', label: 'View a course’s chapters' },
          { key: 'view_curriculum', label: 'View a course’s curriculum' },
        ],
      };
    }, [
      loading,
      error,
      data,
      search,
      standardFilter,
      categoryFilter,
      effectiveAudienceMode,
      standardOptions,
      categoryOptions,
      filteredGroups,
      catalogSubjects,
    ])
  );


  useEffect(() => {
    if (effectiveAudienceMode === 'Student') {
      setActiveLearningTab('learn');
    }
  }, [effectiveAudienceMode]);

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
    const category = subject.category_name || subject.content_category;
    const SubjectIcon = CATEGORY_ICON_MAP[category] ?? BookOpen;
    const { accent, soft } = getSubjectCardPalette(subject.subject_id);
    const chapterCount = Array.isArray(subject.chapters) ? subject.chapters.length : 0;
    const keyConceptCount = Number(
      subject.key_concepts_count ??
        subject.key_concept_count ??
        subject.concepts_count ??
        subject.total_concepts ??
        subject.keyConcepts?.length ??
        subject.concepts?.length ??
        (Array.isArray(subject.chapters)
          ? subject.chapters.reduce(
              (sum, chapter) => sum + (Array.isArray(chapter.concepts) ? chapter.concepts.length : 0),
              0
            )
          : 0)
    );
    const lessonPlanCount = Number(
      subject.lesson_plans_count ??
        subject.lesson_plan_count ??
        subject.total_lesson_plans ??
        subject.lessonPlans?.length ??
        (Array.isArray(subject.chapters)
          ? subject.chapters.reduce((sum, chapter) => sum + (Number(chapter.total_content) || 0), 0)
          : 0)
    );
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
        role="button"
        tabIndex={0}
        onClick={() => router.push(routes.chapters)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            router.push(routes.chapters);
          }
        }}
        className="relative cursor-pointer rounded-[22px] border border-[#DCE3ED] bg-white p-5 shadow-[0_2px_5px_rgba(15,23,42,0.12)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(15,23,42,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5648E8] focus-visible:ring-offset-2"
      >
        <div className="flex items-start justify-between">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
            {/* <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-[0_3px_8px_rgba(15,23,42,0.08)]"
              style={{ backgroundColor: soft, color: accent }}
            >
              <SubjectIcon className="h-6 w-6" strokeWidth={1.8} />
            </div> */}
            <div className="min-w-0 ">
              <h3 className="min-h-10 text-center line-clamp-2 mt-10 text-[17px] font-semibold leading-5 tracking-[-0.02em] text-[#1E293B]">
                {subject.subject_name}
              </h3>
              <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-[#94A3B8]"><BookOpen className="h-3.5 w-3.5" strokeWidth={1.8} />{chapterCount} chapters</p>
            </div>
          </div>

          <div className="absolute right-5 top-5 flex items-center gap-1.5">
            <button type="button" title="Lesson plans" aria-label={`Open ${subject.subject_name} lesson plans`} onClick={(event) => { event.stopPropagation(); router.push(routes.lessonPlan); }} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DDD6FE] bg-[#F3F0FF] text-[#6D4AFF] transition hover:bg-[#E8E1FF]"><CalendarDays className="h-4 w-4" strokeWidth={1.9} /></button>
            <button type="button" title="Curriculum" aria-label={`Open ${subject.subject_name} curriculum`} onClick={(event) => { event.stopPropagation(); router.push(routes.curriculum); }} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#BAE6FD] bg-[#ECF9FF] text-[#0284C7] transition hover:bg-[#DDF4FF]"><ListTree className="h-4 w-4" strokeWidth={1.9} /></button>
            <button type="button" title="Chapters" aria-label={`Open ${subject.subject_name} chapters`} onClick={(event) => { event.stopPropagation(); router.push(routes.chapters); }} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#BBF7D0] bg-[#ECFDF3] text-[#16A34A] transition hover:bg-[#DCFBE8]"><BookOpen className="h-4 w-4" strokeWidth={1.9} /></button>
          </div>
        </div>

        <p className="hidden">
          {keyConceptCount} key concepts
          <span className="mx-1">{'\u00B7'}</span>
          {lessonPlanCount} lesson plans created
        </p>

        <div className="hidden" />

        <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-[#EEF1F5]">
          <div
            className="h-full rounded-full"
            style={{ width: `${progress}%`, backgroundColor: accent }}
          />
        </div>

        <div className="hidden">
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

  function renderStudentSubjectCard(
    subject: (typeof studentSubjects)[number]
  ) {
    const { accent } = getSubjectCardPalette(subject.subject_id);

    return (
      <div
        key={`${subject.subject_id}-${subject.standard_id}-${subject.sectionId}`}
        role="button"
        tabIndex={0}
        onClick={() => router.push(buildStudentPageRoute(subject, 'chapters'))}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            router.push(buildStudentPageRoute(subject, 'chapters'));
          }
        }}
        className="relative cursor-pointer rounded-[22px] border border-[#DCE3ED] bg-white p-5 shadow-[0_2px_5px_rgba(15,23,42,0.12)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(15,23,42,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5648E8] focus-visible:ring-offset-2"
      >
        <div className="flex items-start justify-between">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
            <div className="min-w-0">
              <h3 className="mt-10 min-h-10 text-center text-[17px] font-semibold leading-5 tracking-[-0.02em] text-[#1E293B] line-clamp-2">
                {subject.subject_name}
              </h3>
              <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-[#94A3B8]">
                <BookOpen className="h-3.5 w-3.5" strokeWidth={1.8} />
                {subject.chapterCount} chapters
              </p>
            </div>
          </div>

          <div className="absolute left-1/2 top-5 flex -translate-x-1/2 items-center gap-1.5">
            <button
              type="button"
              title="Curriculum"
              aria-label={`Open ${subject.subject_name} curriculum`}
              onClick={(event) => {
                event.stopPropagation();
                router.push(buildStudentPageRoute(subject, 'curriculum'));
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#BAE6FD] bg-[#ECF9FF] text-[#0284C7] transition hover:bg-[#DDF4FF]"
            >
              <ListTree className="h-4 w-4" strokeWidth={1.9} />
            </button>
            <button
              type="button"
              title="Chapters"
              aria-label={`Open ${subject.subject_name} chapters`}
              onClick={(event) => {
                event.stopPropagation();
                router.push(buildStudentPageRoute(subject, 'chapters'));
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#BBF7D0] bg-[#ECFDF3] text-[#16A34A] transition hover:bg-[#DCFBE8]"
            >
              <BookOpen className="h-4 w-4" strokeWidth={1.9} />
            </button>
          </div>
        </div>

        <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-[#EEF1F5]">
          <div
            className="h-full rounded-full bg-[#5648E8]"
            style={{ width: `${subject.coverage}%`, backgroundColor: accent }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full px-6 py-5">
      <div className="mx-auto max-w-[1800px]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className=" text-[28px] font-semibold tracking-[-0.03em] text-[#172554] sm:text-[34px]">
                Learning management
              </h1>
            </div>

          </div>

         

          {effectiveAudienceMode === 'Teacher' ? (
            <div className="mt-1 flex flex-col gap-4">
                  {/* <div className="w-full xl:max-w-[360px]">
                    <Label className="mb-2 block text-[13px] font-medium text-[#52637A]">
                      Search Subjects
                    </Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                      <input
                        type="text"
                        value={search}
                        onChange={(event) => {
                          setSearch(event.target.value);
                          setVisibleCount(PAGE_SIZE);
                        }}
                        placeholder="Search subjects..."
                        className="h-12 w-full rounded-[14px] border border-[#C7D2E4] bg-white pl-11 pr-4 text-[14px] text-[#0F172A] outline-none shadow-[0_2px_8px_rgba(15,23,42,0.04)] placeholder:text-[#94A3B8] focus:border-[#5648E8]"
                      />
                    </div>
                  </div> */}

                  <div>
                    <p className="mb-2 text-[13px] font-medium text-[#52637A]">Standard</p>
                    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by standard">
                      {['all', ...standardOptions].map((standard) => {
                        const selected = standardFilter === standard;
                        return (
                          <button
                            key={standard}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => {
                              setStandardFilter(standard);
                              setVisibleCount(PAGE_SIZE);
                            }}
                            className={`shrink-0 rounded-full border px-4 py-2 text-[14px] font-semibold transition ${
                              selected
                                ? 'border-[#5648E8] bg-[#5648E8] text-white shadow-[0_3px_8px_rgba(86,72,232,0.22)]'
                                : 'border-[#D8E0EB] bg-white text-[#52637A] hover:border-[#A99FF7] hover:text-[#5648E8]'
                            }`}
                          >
                            {standard === 'all' ? 'All standards' : `Grade ${standard}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[13px] font-medium text-[#52637A]">Category</p>
                    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by category">
                      {['all', ...categoryOptions].map((category) => {
                        const selected = categoryFilter === category;
                        return (
                          <button
                            key={category}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => {
                              setCategoryFilter(category);
                              setVisibleCount(PAGE_SIZE);
                            }}
                            className={`shrink-0 rounded-full border px-4 py-2 text-[14px] font-semibold transition ${
                              selected
                                ? 'border-[#172554] bg-[#172554] text-white shadow-[0_3px_8px_rgba(23,37,84,0.18)]'
                                : 'border-[#D8E0EB] bg-white text-[#52637A] hover:border-[#8FA1BC] hover:text-[#172554]'
                            }`}
                          >
                            {category === 'all' ? 'All categories' : category}
                          </button>
                        );
                      })}
                    </div>
                  </div>
            </div>
          ) : (
            <div className="mt-1 flex flex-col gap-4">
              <div>
                <p className="mb-2 text-[13px] font-medium text-[#52637A]">Standard</p>
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by standard">
                  {['all', ...standardOptions].map((standard) => {
                    const selected = standardFilter === standard;
                    return (
                      <button
                        key={standard}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setStandardFilter(standard)}
                        className={`shrink-0 rounded-full border px-4 py-2 text-[14px] font-semibold transition ${
                          selected
                            ? 'border-[#5648E8] bg-[#5648E8] text-white shadow-[0_3px_8px_rgba(86,72,232,0.22)]'
                            : 'border-[#D8E0EB] bg-white text-[#52637A] hover:border-[#A99FF7] hover:text-[#5648E8]'
                        }`}
                      >
                        {standard === 'all' ? 'All standards' : `Grade ${standard}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[13px] font-medium text-[#52637A]">Category</p>
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by category">
                  {['all', ...categoryOptions].map((category) => {
                    const selected = categoryFilter === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setCategoryFilter(category)}
                        className={`shrink-0 rounded-full border px-4 py-2 text-[14px] font-semibold transition ${
                          selected
                            ? 'border-[#172554] bg-[#172554] text-white shadow-[0_3px_8px_rgba(23,37,84,0.18)]'
                            : 'border-[#D8E0EB] bg-white text-[#52637A] hover:border-[#8FA1BC] hover:text-[#172554]'
                        }`}
                      >
                        {category === 'all' ? 'All categories' : category}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
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
            {effectiveAudienceMode === 'Teacher' ? (
              <>  
                {totalSubjects === 0 ? (
                  <div className="mt-8 rounded-[18px] border border-[#D9E1EE] bg-white px-6 py-16 text-center text-[#64748B] shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
                    No subjects found for the selected filters.
                  </div>
                ) : (
                  <>
                    <div className="mt-5 flex flex-col gap-10">
                      {visibleGroups.map((group) => (
                        <section key={group.standardName}>
        
                          <div className="flex flex-col gap-6">
                            {group.categories.map((category, categoryIndex) => (
                              <div key={category.categoryName} className={categoryIndex > 0 ? '' : ''}>
                                <div className="mb-4 flex items-center gap-3">
                                  <span className="h-px flex-1 bg-[#D9E2EE]" aria-hidden="true" />
                                  <h3 className="shrink-0 text-[14px] font-semibold text-[#334155]">
                                    {category.categoryName}
                                  </h3>
                                  <span className="h-px flex-1 bg-[#D9E2EE]" aria-hidden="true" />
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
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
            ) : activeLearningTab === 'learn' ? (
              filteredStudentSubjects.length === 0 ? (
                <div className="mt-8 rounded-[18px] border border-[#D9E1EE] bg-white px-6 py-16 text-center text-[#64748B] shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
                  No subjects found for the selected filters.
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
                  {filteredStudentSubjects.map((subject) => renderStudentSubjectCard(subject))}
                </div>
              )
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
