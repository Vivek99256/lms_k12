'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Circle,
  Clock,
  Globe2,
  Presentation,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import { cn } from '@/lib/utils';
import { courses } from '../../data/courses';
import {
  getChaptersByCourseid,
  getSubjectAndChapters,
  type Chapter,
  type SubjectWithChapters,
} from '../../data/chapters';
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
  { id: 'assessment', label: 'Assessment', icon: FileCheck, color: 'from-rose-500 to-pink-600' },
] as const;

const CALENDAR_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

type LessonPlanStatus = 'Delivered' | 'Planned' | 'Assessment';

type LessonPlanApiStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'delivered'
  | 'planned'
  | 'assessment';

type LessonPlanConceptCoverage = {
  conceptName: string;
  coveragePercent: number;
};

type Teacher = {
  id: number | string;
  user_id?: number | string;
  teacher_id?: number | string;
  employee_id?: number | string;
  userId?: number | string;
  name?: string;
  user_name?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
};

type TeacherSession = {
  token: string;
  hostName: string;
  subInstituteId: string;
};

type LessonPlanEvent = {
  id: string;
  title: string;
  conceptTitle: string;
  chapterTitle: string;
  date: Date;
  status: LessonPlanStatus;
  statusLabel: string;
  slotLabel: string;
  periods: number;
  pedagogy: string;
  startTime: string;
  endTime: string;
  teacherId?: number;
  teacherName: string;
  plannedDurationMin?: number;
  periodType?: string;
  concepts: LessonPlanConceptCoverage[];
};

type LessonPlanDraft = {
  conceptTitle: string;
  plannedDate: string;
  periods: string;
  pedagogy: string;
  objective: string;
};

type CalendarViewMode = 'day' | 'week' | 'month';

type LessonPlanApiPeriod = {
  id: number;
  scheduled_date: string;
  period_id?: number;
  period_slot: string | number;
  teacher_id?: number;
  chapter_name?: string | null;
  primary_concept_name?: string | null;
  period_type?: string | null;
  planned_duration_min?: number | null;
  status?: LessonPlanApiStatus | null;
  concepts?: {
    concept_name?: string | null;
    coverage_percent?: number | null;
  }[];
};

type LessonPlanApiMeta = {
  id: number;
  plan_title?: string | null;
  term_start_date?: string | null;
  term_end_date?: string | null;
  period_duration_min?: number | null;
};

type LessonPlanApiResponse = {
  status?: boolean;
  message?: string;
  data?: {
    lesson_plan?: LessonPlanApiMeta | null;
    periods?: LessonPlanApiPeriod[];
  }[];
};

type HoverPopupState = {
  event: LessonPlanEvent;
  style: React.CSSProperties;
};

function readString(value: unknown): string {
  return value != null && value !== '' ? String(value) : '';
}

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

const LESSON_PLAN_API_URL =
  'https://dev.triz.co.in/api/intelligence/lesson-plans?sub_institute_id=195&standard_id=2235&subject_id=4018&term_id=149&division_id=936&syear=2025';

const PERIOD_SLOT_TIME_MAP: Record<string, { startHour: number; startMinute: number; fallbackLabel: string }> = {
  AM: { startHour: 8, startMinute: 0, fallbackLabel: 'AM' },
  '0': { startHour: 8, startMinute: 0, fallbackLabel: 'AM' },
  '1': { startHour: 9, startMinute: 0, fallbackLabel: 'P1' },
  P1: { startHour: 9, startMinute: 0, fallbackLabel: 'P1' },
  '2': { startHour: 10, startMinute: 0, fallbackLabel: 'P2' },
  P2: { startHour: 10, startMinute: 0, fallbackLabel: 'P2' },
  '3': { startHour: 11, startMinute: 0, fallbackLabel: 'P3' },
  P3: { startHour: 11, startMinute: 0, fallbackLabel: 'P3' },
  '4': { startHour: 12, startMinute: 0, fallbackLabel: 'P4' },
  P4: { startHour: 12, startMinute: 0, fallbackLabel: 'P4' },
  '5': { startHour: 13, startMinute: 0, fallbackLabel: 'P5' },
  P5: { startHour: 13, startMinute: 0, fallbackLabel: 'P5' },
  '6': { startHour: 14, startMinute: 0, fallbackLabel: 'P6' },
  P6: { startHour: 14, startMinute: 0, fallbackLabel: 'P6' },
};

function formatTimeFromParts(hour: number, minute: number) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function addMinutesToTime(hour: number, minute: number, duration: number) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setMinutes(date.getMinutes() + duration);
  return {
    hour: date.getHours(),
    minute: date.getMinutes(),
    label: date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }),
  };
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeStatusLabel(status: LessonPlanApiStatus | string | null | undefined) {
  switch (status) {
    case 'not_started':
      return 'Not Started';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    case 'delivered':
      return 'Delivered';
    case 'planned':
      return 'Planned';
    case 'assessment':
      return 'Assessment';
    default:
      return 'Planned';
  }
}

function mapStatusToCalendarStatus(status: LessonPlanApiStatus | string | null | undefined): LessonPlanStatus {
  switch (status) {
    case 'delivered':
    case 'completed':
      return 'Delivered';
    case 'assessment':
      return 'Assessment';
    default:
      return 'Planned';
  }
}

function getStoredTeacherName(teacherId: number | undefined) {
  if (!teacherId || typeof window === 'undefined') return null;

  const candidates = ['userData', 'menuContext'];

  const visit = (value: unknown, depth = 0): string | null => {
    if (depth > 5 || value == null) return null;

    if (Array.isArray(value)) {
      for (const item of value) {
        const result = visit(item, depth + 1);
        if (result) return result;
      }
      return null;
    }

    if (typeof value !== 'object') return null;

    const record = value as Record<string, unknown>;
    const recordId = Number(record.teacher_id ?? record.user_id ?? record.id ?? record.employee_id);
    if (recordId === teacherId) {
      const directName =
        record.teacher_name ??
        record.user_name ??
        record.name ??
        record.full_name ??
        record.employee_name;
      if (typeof directName === 'string' && directName.trim()) {
        return directName.trim();
      }

      const firstName = typeof record.first_name === 'string' ? record.first_name.trim() : '';
      const lastName = typeof record.last_name === 'string' ? record.last_name.trim() : '';
      const composed = `${firstName} ${lastName}`.trim();
      if (composed) return composed;
    }

    for (const nestedValue of Object.values(record)) {
      const result = visit(nestedValue, depth + 1);
      if (result) return result;
    }

    return null;
  };

  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      const result = visit(parsed);
      if (result) return result;
    } catch {
      continue;
    }
  }

  return null;
}

function getTeacherSession(): TeacherSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;

    const token = readString(userData.user_token ?? userData.token);
    const hostName = readString(userData.host_name) || API_BASE_URL;
    const subInstituteId = readString(userData.sub_institute_id ?? menuContext.sub_institute_id);

    if (!token || !hostName || !subInstituteId) {
      return null;
    }

    return {
      token,
      hostName,
      subInstituteId,
    };
  } catch {
    return null;
  }
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

function getStartOfWeekSunday(date: Date) {
  const next = new Date(date);
  next.setDate(next.getDate() - next.getDay());
  next.setHours(0, 0, 0, 0);
  return next;
}

function getWeekDatesSunday(date: Date) {
  const start = getStartOfWeekSunday(date);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start);
    next.setDate(start.getDate() + index);
    return next;
  });
}

function formatCalendarHeaderTitle(date: Date, viewMode: CalendarViewMode) {
  if (viewMode === 'month') {
    return formatMonthTitle(date);
  }

  if (viewMode === 'day') {
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  const weekDates = getWeekDatesSunday(date);
  const start = weekDates[0];
  const end = weekDates[6];

  const startLabel = start.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  });
  const endLabel = end.toLocaleDateString('en-US', {
    day: 'numeric',
    month: start.getMonth() === end.getMonth() ? undefined : 'short',
    year: start.getFullYear() === end.getFullYear() ? undefined : 'numeric',
  });

  return `${startLabel} - ${endLabel}`;
}

const DAY_TIMELINE_START_HOUR = 7;
const DAY_TIMELINE_END_HOUR = 15;
const DAY_TIMELINE_HOUR_HEIGHT = 72;

function formatHourLabel(hour: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalizedHour} ${suffix}`;
}

function getSlotHourRange(slotLabel: string) {
  const range = PERIOD_SLOT_TIME_MAP[slotLabel] ?? PERIOD_SLOT_TIME_MAP[String(slotLabel)] ?? PERIOD_SLOT_TIME_MAP.P1;
  return { startHour: range.startHour, endHour: range.startHour + 1 };
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

function getEventCardClasses(status: LessonPlanStatus) {
  return `cursor-pointer rounded-[8px] border border-[#E2E8F0] border-l-[3px] px-2 py-1.5 text-[13px] shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none focus:ring-2 focus:ring-[#C7D2FE] ${getEventStatusClasses(
    status
  )}`;
}

function CalendarEventCard({
  event,
  className,
  style,
  onOpenHover,
  onCloseHover,
}: {
  event: LessonPlanEvent;
  className?: string;
  style?: React.CSSProperties;
  onOpenHover: (event: LessonPlanEvent, element: HTMLElement) => void;
  onCloseHover: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={(hoverEvent) => onOpenHover(event, hoverEvent.currentTarget)}
      onMouseLeave={onCloseHover}
      onFocus={(focusEvent) => onOpenHover(event, focusEvent.currentTarget)}
      onBlur={onCloseHover}
      className={cn(getEventCardClasses(event.status), className)}
      style={style}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium">{event.conceptTitle}</p>
          <p className="mt-1 text-[12px] text-[#64748B]">
            {event.startTime} - {event.endTime}
          </p>
        </div>
        <span className="shrink-0 text-[12px] text-[#64748B]">{event.slotLabel}</span>
      </div>
    </div>
  );
}

export default function LessonPlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCourseId = useParams().courseId;
  const courseId = Array.isArray(rawCourseId) ? rawCourseId[0] : rawCourseId ?? '';
  const view = searchParams.get('view');
  const isAssessmentView = view === 'assessment';
  const isKeyConceptsView = view === 'key-concepts';
  const isSemanticIntelligenceView = view === 'semantic-intelligence';
  const chapterId = searchParams.get('chapterId') ?? '';
  const conceptTitleParam = searchParams.get('concept') ?? '';

  const staticCourse = courses.find((c) => c.id === courseId);
  const courseIdParts = courseId.includes('-') ? courseId.split('-', 2) : [];
  const subjectId = courseIdParts[0];
  const standardId = courseIdParts[1];

  const isLmsRoute = Boolean(subjectId && standardId);
  const [subjectData, setSubjectData] = useState<SubjectWithChapters | null>(null);
  const [subjectLoading, setSubjectLoading] = useState(isLmsRoute);

  const apiSubject = subjectData?.subject ?? null;
  const course: Course | undefined = useMemo(
    () =>
      staticCourse ??
      (apiSubject
        ? {
            id: courseId,
            title: apiSubject.subject_name,
            code: '',
            subject: apiSubject.subject_name,
            category: apiSubject.content_category || 'My Course',
            classGrade: `Class ${apiSubject.standard_name}`,
            status: 'Active',
            chapters: subjectData?.chapters.length ?? 0,
            enrollments: 0,
            progress: 0,
            instructor: '',
            createdAt: '',
            accentColor: '#4F46E5',
            icon: 'book-open',
          }
        : undefined),
    [staticCourse, apiSubject, subjectData, courseId]
  );
  const courseChapters = useMemo<Chapter[]>(() => {
    if (subjectData?.chapters?.length) return subjectData.chapters;
    if (staticCourse) return getChaptersByCourseid(courseId);
    return [];
  }, [subjectData, staticCourse, courseId]);
  const selectedChapter =
    courseChapters.find((chapter) => chapter.id === chapterId) || courseChapters[0] || null;
  const chapterConcepts = useMemo(() => {
    if (!selectedChapter) return null;
    const concepts = selectedChapter.concepts ?? [];
    return {
      count: concepts.length,
      concepts: concepts.map((concept) => ({
        title: concept.title,
        description: concept.description,
        mastery: '—',
        time: '—',
      })),
    };
  }, [selectedChapter]);
  const conceptTitle = conceptTitleParam || chapterConcepts?.concepts[0]?.title || '';
  const semanticData =
    selectedChapter && course
      ? getSemanticIntelligenceForSelection(selectedChapter, conceptTitle, {
          title: course.title,
          code: course.code,
        })
      : null;
  const selectedConcept = semanticData?.concept || chapterConcepts?.concepts[0] || null;
  const [activeSemanticSection, setActiveSemanticSection] = useState('knowledge');
  const [visibleMonth, setVisibleMonth] = useState(() => new Date('2025-04-01T00:00:00'));
  const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>('month');
  const [isCreateLessonPlanOpen, setIsCreateLessonPlanOpen] = useState(false);
  const [apiPeriods, setApiPeriods] = useState<LessonPlanApiPeriod[]>([]);
  const [lessonPlanLoading, setLessonPlanLoading] = useState(true);
  const [lessonPlanError, setLessonPlanError] = useState<string | null>(null);
  const [createdLessonPlans, setCreatedLessonPlans] = useState<LessonPlanEvent[]>([]);
  const [hoverPopup, setHoverPopup] = useState<HoverPopupState | null>(null);
  const [lessonPlanDraft, setLessonPlanDraft] = useState<LessonPlanDraft>({
    conceptTitle: '',
    plannedDate: '',
    periods: '2',
    pedagogy: '',
    objective: '',
  });
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLmsRoute) return;
    let cancelled = false;
    getSubjectAndChapters(subjectId, standardId)
      .then((data) => {
        if (!cancelled) setSubjectData(data);
      })
      .finally(() => {
        if (!cancelled) setSubjectLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLmsRoute, subjectId, standardId]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(LESSON_PLAN_API_URL, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as LessonPlanApiResponse;
        if (!response.ok) {
          throw new Error('Failed to fetch lesson plan calendar.');
        }
        const firstItem = Array.isArray(payload.data) ? payload.data[0] : null;
        setApiPeriods(Array.isArray(firstItem?.periods) ? firstItem.periods : []);
        if (firstItem?.lesson_plan?.term_start_date) {
          setVisibleMonth(new Date(`${firstItem.lesson_plan.term_start_date}T00:00:00`));
        }
      })
      .catch((error: unknown) => {
        if ((error as Error)?.name === 'AbortError') return;
        setApiPeriods([]);
        setLessonPlanError(error instanceof Error ? error.message : 'Unable to fetch lesson plan calendar.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLessonPlanLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    return () => {
      if (hoverCloseTimerRef.current) {
        clearTimeout(hoverCloseTimerRef.current);
      }
    };
  }, []);

  const chapterCount = Math.max(course?.chapters ?? 0, courseChapters.length);
  const gradeLabel = course ? getCourseGradeLabel(course.classGrade) : '';
  const sectionLabel = course ? getCourseSectionLabel(course.id) : '';
  const curriculumLabel = course ? getCurriculumLabel(course) : '';
  const totalKeyConcepts = course ? getTotalKeyConceptCount(course, courseChapters) : 0;
  const conceptOptions = useMemo(() => {
    const concepts = courseChapters.flatMap((chapter) =>
      (chapter.concepts ?? []).map((concept) => concept.title)
    );

    return Array.from(new Set(concepts));
  }, [courseChapters]);
  const pedagogyOptions = useMemo(() => {
    const pedagogies = courseChapters.flatMap((chapter) => chapter.teachingMethodologies);
    return Array.from(new Set(pedagogies));
  }, [courseChapters]);
  const apiLessonPlanEvents = useMemo(() => {
    return apiPeriods.map((period) => {
      const slotKey = String(period.period_slot).toUpperCase();
      const slotConfig =
        PERIOD_SLOT_TIME_MAP[slotKey] ??
        PERIOD_SLOT_TIME_MAP[String(period.period_slot)] ??
        PERIOD_SLOT_TIME_MAP.P1;
      const duration = Number(period.planned_duration_min) || 35;
      const endTime = addMinutesToTime(slotConfig.startHour, slotConfig.startMinute, duration);
      const teacherId = Number(period.teacher_id) || undefined;

      return {
        id: String(period.id),
        title: period.primary_concept_name?.trim() || period.chapter_name?.trim() || `Lesson Period ${period.period_slot}`,
        conceptTitle: period.primary_concept_name?.trim() || period.chapter_name?.trim() || 'Untitled concept',
        chapterTitle: period.chapter_name?.trim() || 'Untitled chapter',
        date: new Date(`${period.scheduled_date}T00:00:00`),
        status: mapStatusToCalendarStatus(period.status),
        statusLabel: normalizeStatusLabel(period.status),
        slotLabel: slotConfig.fallbackLabel,
        periods: 1,
        pedagogy: period.period_type?.trim() || 'Teaching',
        startTime: formatTimeFromParts(slotConfig.startHour, slotConfig.startMinute),
        endTime: endTime.label,
        teacherId,
        teacherName: getStoredTeacherName(teacherId) || `Teacher #${teacherId ?? '—'}`,
        plannedDurationMin: duration,
        periodType: period.period_type?.trim() || 'Teaching',
        concepts: Array.isArray(period.concepts)
          ? period.concepts.map((concept) => ({
              conceptName: concept.concept_name?.trim() || 'Untitled concept',
              coveragePercent: Number(concept.coverage_percent) || 0,
            }))
          : [],
      } satisfies LessonPlanEvent;
    });
  }, [apiPeriods]);
  const lessonPlanEvents = useMemo(() => {
    return [...apiLessonPlanEvents, ...createdLessonPlans].sort(
      (left, right) => left.date.getTime() - right.date.getTime()
    );
  }, [apiLessonPlanEvents, createdLessonPlans]);
  const calendarCells = useMemo(() => getCalendarGrid(visibleMonth), [visibleMonth]);
  const weekDates = useMemo(() => getWeekDatesSunday(visibleMonth), [visibleMonth]);
  const eventMap = useMemo(() => {
    const mapped = new Map<string, LessonPlanEvent[]>();

    lessonPlanEvents.forEach((event) => {
      const key = formatDateKey(event.date);
      const current = mapped.get(key) ?? [];
      current.push(event);
      mapped.set(key, current);
    });

    return mapped;
  }, [lessonPlanEvents]);
  const calendarHeaderTitle = useMemo(
    () => formatCalendarHeaderTitle(visibleMonth, calendarViewMode),
    [visibleMonth, calendarViewMode]
  );

  const cancelHoverClose = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const scheduleHoverClose = () => {
    cancelHoverClose();
    hoverCloseTimerRef.current = setTimeout(() => {
      setHoverPopup(null);
    }, 180);
  };

  const openHoverPopup = (event: LessonPlanEvent, element: HTMLElement) => {
    cancelHoverClose();
    const rect = element.getBoundingClientRect();
    const popupWidth = 340;
    const popupHeight = 320;
    const gap = 6;

    let left = rect.right + gap;
    let top = rect.top;

    if (left + popupWidth > window.innerWidth - 16) {
      left = rect.left - popupWidth - gap;
    }
    if (left < 16) {
      left = Math.max(16, window.innerWidth - popupWidth - 16);
    }
    if (top + popupHeight > window.innerHeight - 16) {
      top = rect.bottom - popupHeight;
    }
    if (top < 16) {
      top = 16;
    }

    setHoverPopup({
      event,
      style: {
        position: 'fixed',
        top,
        left,
        width: popupWidth,
        maxWidth: 'calc(100vw - 32px)',
        zIndex: 9999,
      },
    });
  };

  const openHoverPopupFromMouse = (
    hoverEvent: React.MouseEvent<HTMLElement>,
    event: LessonPlanEvent
  ) => {
    openHoverPopup(event, hoverEvent.currentTarget);
  };

  const openHoverPopupFromFocus = (
    focusEvent: React.FocusEvent<HTMLElement>,
    event: LessonPlanEvent
  ) => {
    openHoverPopup(event, focusEvent.currentTarget);
  };

  if (subjectLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/50">
        <div className="text-center text-slate-500">Loading course intelligence…</div>
      </div>
    );
  }

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
      statusLabel: 'Planned',
      slotLabel: `P${lessonPlanDraft.periods || '2'}`,
      periods: Number(lessonPlanDraft.periods || 2),
      pedagogy: lessonPlanDraft.pedagogy,
      startTime: '9:00 AM',
      endTime: '9:35 AM',
      teacherName: 'Teacher #—',
      plannedDurationMin: 35,
      periodType: 'Teaching',
      concepts: [
        {
          conceptName: lessonPlanDraft.conceptTitle,
          coveragePercent: 100,
        },
      ],
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
    <div className="min-h-full">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-[14px] border border-[#D8E1F0] bg-[#EEF3FB] p-1 shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
              {(['day', 'week', 'month'] as CalendarViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCalendarViewMode(mode)}
                  className={`rounded-[10px] px-4 py-2 text-[14px] font-medium capitalize transition sm:px-5 ${
                    calendarViewMode === mode
                      ? 'bg-white text-[#4F46E5] shadow-[0_1px_4px_rgba(15,23,42,0.06)]'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <Button
              onClick={openCreateLessonPlanModal}
              className="h-11 rounded-[14px] bg-[#4F46E5] px-5 text-[15px] font-medium text-white shadow-[0_8px_18px_rgba(79,70,229,0.32)] hover:bg-[#4338CA]"
            >
              <Plus size={16} className="mr-2" />
              Create lesson plan
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[#D8E1F0] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 border-b border-[#E3EAF4] px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-[18px] font-semibold text-[#0F172A]">{calendarHeaderTitle}</h2>

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
                    setVisibleMonth((current) => {
                      if (calendarViewMode === 'day') {
                        return new Date(current.getFullYear(), current.getMonth(), current.getDate() - 1);
                      }
                      if (calendarViewMode === 'week') {
                        return new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7);
                      }
                      return new Date(current.getFullYear(), current.getMonth() - 1, 1);
                    })
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setVisibleMonth((current) => {
                      if (calendarViewMode === 'day') {
                        return new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
                      }
                      if (calendarViewMode === 'week') {
                        return new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7);
                      }
                      return new Date(current.getFullYear(), current.getMonth() + 1, 1);
                    })
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>

          {lessonPlanLoading ? (
            <div className="border-b border-[#E3EAF4] px-4 py-4 text-[14px] text-[#64748B] sm:px-6">
              Loading lesson plan calendar...
            </div>
          ) : null}

          {!lessonPlanLoading && lessonPlanError ? (
            <div className="border-b border-[#FDE2E2] bg-[#FFF8F8] px-4 py-4 text-[14px] text-[#B91C1C] sm:px-6">
              {lessonPlanError}
            </div>
          ) : null}

          {!lessonPlanLoading && !lessonPlanError && lessonPlanEvents.length === 0 ? (
            <div className="border-b border-[#E3EAF4] px-4 py-4 text-[14px] text-[#64748B] sm:px-6">
              No lesson plan periods were returned for this calendar.
            </div>
          ) : null}

          <div className="overflow-x-auto p-4 sm:p-5">
            {calendarViewMode === 'month' ? (
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
                    const key = date ? formatDateKey(date) : `empty-${index}`;
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
                                  role="button"
                                  tabIndex={0}
                                  onMouseEnter={(hoverEvent) => openHoverPopupFromMouse(hoverEvent, event)}
                                  onMouseLeave={scheduleHoverClose}
                                  onFocus={(focusEvent) => openHoverPopupFromFocus(focusEvent, event)}
                                  onBlur={scheduleHoverClose}
                                  className={cn(getEventCardClasses(event.status), 'min-w-0')}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="line-clamp-2 font-medium">{event.conceptTitle}</p>
                                      <p className="mt-1 text-[12px] text-[#64748B]">
                                        {event.startTime} - {event.endTime}
                                      </p>
                                    </div>
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
            ) : calendarViewMode === 'day' ? (
              <div className="min-w-[980px] overflow-hidden rounded-[14px] border border-[#D8E1F0]">
                <div className="grid grid-cols-[92px_minmax(0,1fr)] bg-[#F6F9FD]">
                  <div className="border-b border-r border-[#D8E1F0] px-3 py-3" />
                  <div className="border-b border-[#D8E1F0] px-3 py-3 text-center text-[14px] font-medium text-[#334155]">
                    <div>{visibleMonth.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className="mt-1 text-[13px] text-[#64748B]">
                      {visibleMonth.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>

                <div className="max-h-[680px] overflow-y-auto">
                  <div className="grid grid-cols-[92px_minmax(0,1fr)]">
                    <div className="border-r border-[#D8E1F0] bg-[#F8FAFC]">
                      {Array.from(
                        { length: DAY_TIMELINE_END_HOUR - DAY_TIMELINE_START_HOUR + 1 },
                        (_, index) => DAY_TIMELINE_START_HOUR + index
                      ).map((hour) => (
                        <div
                          key={hour}
                          className="flex h-[72px] items-start justify-center border-b border-[#EAF0F7] px-2 pt-2 text-[13px] font-medium text-[#475569]"
                        >
                          {formatHourLabel(hour)}
                        </div>
                      ))}
                    </div>

                    <div className="relative bg-white" style={{ height: `${(DAY_TIMELINE_END_HOUR - DAY_TIMELINE_START_HOUR + 1) * DAY_TIMELINE_HOUR_HEIGHT}px` }}>
                      {Array.from(
                        { length: DAY_TIMELINE_END_HOUR - DAY_TIMELINE_START_HOUR + 1 },
                        (_, index) => DAY_TIMELINE_START_HOUR + index
                      ).map((hour, index, hours) => (
                        <div
                          key={`separator-${hour}`}
                          className={`absolute left-0 right-0 border-b border-[#EAF0F7] ${
                            index !== hours.length - 1 ? '' : 'border-b-0'
                          }`}
                          style={{ top: `${index * DAY_TIMELINE_HOUR_HEIGHT}px` }}
                        />
                      ))}

                      {(eventMap.get(formatDateKey(visibleMonth)) ?? []).map((event) => {
                        const { startHour, endHour } = getSlotHourRange(event.slotLabel);
                        const top = (startHour - DAY_TIMELINE_START_HOUR) * DAY_TIMELINE_HOUR_HEIGHT + 4;
                        const height = Math.max((endHour - startHour) * DAY_TIMELINE_HOUR_HEIGHT - 8, 44);

                        return (
                          <CalendarEventCard
                            key={event.id}
                            event={event}
                            className="absolute left-2 right-2"
                            style={{ top: `${top}px`, height: `${height}px` }}
                            onOpenHover={openHoverPopup}
                            onCloseHover={scheduleHoverClose}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="min-w-[980px] overflow-hidden rounded-[14px] border border-[#D8E1F0]">
                <div className="grid grid-cols-[92px_repeat(7,minmax(120px,1fr))] bg-[#F6F9FD]">
                  <div className="border-b border-r border-[#D8E1F0] px-3 py-3" />
                  {weekDates.map((date, index, dates) => (
                    <div
                      key={`${formatDateKey(date)}-${index}`}
                      className={`border-b px-3 py-3 text-center text-[14px] font-medium text-[#334155] ${
                        index !== dates.length - 1 ? 'border-r border-[#D8E1F0]' : ''
                      }`}
                    >
                      <div>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                      <div className="mt-1 text-[13px] text-[#64748B]">
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="max-h-[680px] overflow-y-auto">
                  <div className="grid grid-cols-[92px_repeat(7,minmax(120px,1fr))]">
                    <div className="border-r border-[#D8E1F0] bg-[#F8FAFC]">
                      {Array.from(
                        { length: DAY_TIMELINE_END_HOUR - DAY_TIMELINE_START_HOUR + 1 },
                        (_, index) => DAY_TIMELINE_START_HOUR + index
                      ).map((hour) => (
                        <div
                          key={hour}
                          className="flex h-[72px] items-start justify-center border-b border-[#EAF0F7] px-2 pt-2 text-[13px] font-medium text-[#475569]"
                        >
                          {formatHourLabel(hour)}
                        </div>
                      ))}
                    </div>

                    {weekDates.map((date, dayIndex) => {
                      const key = formatDateKey(date);
                      const dayEvents = [...(eventMap.get(key) ?? [])].sort((left, right) => {
                        const leftRange = getSlotHourRange(left.slotLabel);
                        const rightRange = getSlotHourRange(right.slotLabel);
                        return leftRange.startHour - rightRange.startHour;
                      });
                      const overlapCountBySlot = new Map<string, number>();

                      return (
                        <div
                          key={key}
                          className={`relative bg-white ${
                            dayIndex !== weekDates.length - 1 ? 'border-r border-[#D8E1F0]' : ''
                          }`}
                          style={{ height: `${(DAY_TIMELINE_END_HOUR - DAY_TIMELINE_START_HOUR + 1) * DAY_TIMELINE_HOUR_HEIGHT}px` }}
                        >
                          {Array.from(
                            { length: DAY_TIMELINE_END_HOUR - DAY_TIMELINE_START_HOUR + 1 },
                            (_, index) => DAY_TIMELINE_START_HOUR + index
                          ).map((hour, index, hours) => (
                            <div
                              key={`${key}-separator-${hour}`}
                              className={`absolute left-0 right-0 border-b border-[#EAF0F7] ${
                                index !== hours.length - 1 ? '' : 'border-b-0'
                              }`}
                              style={{ top: `${index * DAY_TIMELINE_HOUR_HEIGHT}px` }}
                            />
                          ))}

                          {dayEvents.map((event) => {
                            const { startHour, endHour } = getSlotHourRange(event.slotLabel);
                            const slotKey = `${startHour}-${endHour}`;
                            const overlapIndex = overlapCountBySlot.get(slotKey) ?? 0;
                            overlapCountBySlot.set(slotKey, overlapIndex + 1);
                            const totalOverlaps = dayEvents.filter((item) => {
                              const range = getSlotHourRange(item.slotLabel);
                              return range.startHour === startHour && range.endHour === endHour;
                            }).length;

                            const top = (startHour - DAY_TIMELINE_START_HOUR) * DAY_TIMELINE_HOUR_HEIGHT + 4;
                            const height = Math.max((endHour - startHour) * DAY_TIMELINE_HOUR_HEIGHT - 8, 44);
                            const widthCalc = `calc(${100 / totalOverlaps}% - 8px)`;
                            const leftCalc = totalOverlaps > 1 ? `calc(${(100 / totalOverlaps) * overlapIndex}% + 4px)` : '4px';

                            return (
                              <CalendarEventCard
                                key={event.id}
                                event={event}
                                className="absolute"
                                style={{
                                  top: `${top}px`,
                                  height: `${height}px`,
                                  width: widthCalc,
                                  left: leftCalc,
                                }}
                                onOpenHover={openHoverPopup}
                                onCloseHover={scheduleHoverClose}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {hoverPopup ? (
          <div
            className="fixed z-[9999] max-w-[340px]"
            style={hoverPopup.style}
            onMouseEnter={cancelHoverClose}
            onMouseLeave={scheduleHoverClose}
          >
            <div className="rounded-[16px] border border-[#D8E1F0] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
              <div className="border-b border-[#E2E8F0] pb-3">
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold text-[#0F172A]">
                    {hoverPopup.event.chapterTitle}
                  </p>
                  <p className="mt-1 text-[13px] text-[#64748B]">
                    {formatLessonPlanDate(hoverPopup.event.date)}
                  </p>
                </div>
              </div>

              <div className="space-y-2 py-3 text-[13px] text-[#475569]">
                <div className="flex items-center justify-between gap-3">
                  <span>Period</span>
                  <span className="font-medium text-[#0F172A]">{hoverPopup.event.slotLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Duration</span>
                  <span className="font-medium text-[#0F172A]">
                    {hoverPopup.event.plannedDurationMin ?? 0} minutes
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Teacher</span>
                  <span className="font-medium text-[#0F172A]">{hoverPopup.event.teacherName}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Status</span>
                  <span className="font-medium text-[#0F172A]">{hoverPopup.event.statusLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Type</span>
                  <span className="font-medium capitalize text-[#0F172A]">
                    {hoverPopup.event.periodType?.replace(/_/g, ' ') ?? 'Teaching'}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1 text-[#64748B]">
                  <Clock className="h-4 w-4 text-[#64748B]" />
                  <span>{hoverPopup.event.startTime} - {hoverPopup.event.endTime}</span>
                </div>
                <div className="flex items-center gap-2 text-[#64748B]">
                  <Circle className="h-3 w-3 fill-current text-[#64748B]" />
                  <span>{hoverPopup.event.teacherName}</span>
                </div>
              </div>

              <div className="border-t border-[#E2E8F0] pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                  Primary Concept
                </p>
                <p className="mt-2 text-[15px] font-medium text-[#0F172A]">
                  {hoverPopup.event.conceptTitle}
                </p>
              </div>

              <div className="mt-4 border-t border-[#E2E8F0] pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                  Concept Coverage
                </p>
                <div className="mt-2 space-y-2">
                  {hoverPopup.event.concepts.length > 0 ? (
                    hoverPopup.event.concepts.map((concept, index) => (
                      <div
                        key={`${concept.conceptName}-${index}`}
                        className="flex items-start justify-between gap-3 text-[13px] text-[#0F172A]"
                      >
                        <span className="min-w-0 flex-1 break-words">{concept.conceptName}</span>
                        <span className="shrink-0 text-[#64748B]">{concept.coveragePercent}%</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[13px] text-[#64748B]">No concept coverage available.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

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
