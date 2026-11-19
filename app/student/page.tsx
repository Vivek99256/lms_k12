'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  ClipboardList,
  Compass,
  Cpu,
  Dumbbell,
  Eye,
  FileText,
  FlaskConical,
  FolderOpen,
  Globe,
  Info,
  Library,
  Lightbulb,
  LifeBuoy,
  ListTree,
  Palette,
  PenTool,
  Play,
  Search,
  Sigma,
  Target,
  Upload,
  Video,
  type LucideIcon,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ContentCard } from '@/app/course-master/[courseId]/chapters/ContentCard';
// The very same content model the admin chapter page lists a chapter with (cards, types, tabs, lane rules), so what a
// student sees in a chapter is what the admin sees there. See classroomResourceModel.ts.
import {
  buildApiChapterContentItems,
  contentMatchesTab,
  contentSourceOptions,
  itemsInLane,
  contentTabCounts,
  itemsForActiveLane,
  tabsForLane,
  visibleContentTabs,
  type ChapterContentItem,
} from '@/app/course-master/[courseId]/chapters/classroomResourceModel';
import { PrayogshalaDetailDialog } from '@/app/course-master/[courseId]/chapters/PrayogshalaDialogs';
import { PrayogshalaLab } from '@/app/course-master/[courseId]/chapters/PrayogshalaLab';
import type { PrayogshalaActivity } from '@/app/course-master/data/prayogshala';
import { showsInLane } from '@/lib/classroomResources';
import { documentTarget } from '@/lib/documentUrl';
import { groupVideos } from '@/lib/videoGroups';
import { pdfFileNameFromTitle } from '@/lib/study-deck/pdf';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredMenuContext } from '@/app/hooks/useMenuRights';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import {
  fetchLmsCourses,
  type LmsCoursesResponse,
  type LmsSubject,
} from '@/app/course-master/data/lmsCourses';
import {
  downloadStudyDeckPdf,
  fetchChapterContent,
  getSubjectAndChapters,
  type Chapter,
  type ChapterContentAsset,
  type SubjectWithChapters,
} from '@/app/course-master/data/chapters';
import { resolveViewableUrl } from '@/app/course-master/data/content-links';
import { StudyDeckEntry } from '@/components/study-deck/StudyDeckEntry';
import { DocumentViewer, type DocumentViewerItem } from '@/components/study-document/DocumentViewer';
import { KIND_LABEL, documentKindOf } from '@/lib/study-document/document';
import type { DocumentKind } from '@/lib/study-document/types';
import {
  fetchMappedQuestionBank,
  groupQuestionBankItems,
  type QuestionBankItem,
} from '@/app/course-master/data/questionBank';
import { QuestionBankQuestionCard } from '@/app/components/questionBank/QuestionBankQuestionCard';
import { groupConceptsByTopic } from '@/app/course-master/data/chapterTopics';
import { getTotalKeyConceptCount } from '@/app/course-master/data/conceptCounts';
import { getCurriculumLabel } from '@/app/course-master/data/curriculum';

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  'My Course': BookOpen,
  SEL: FlaskConical,
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


type StudentView = 'subjects' | 'curriculum' | 'chapters' | 'content' | 'question-bank';

type CurriculumSession = {
  academicYearId: string;
  hostName: string;
  subInstituteId: string;
  token: string;
};

type CurriculumData = {
  board: string | null;
  curriculum_id: number;
  curriculum_name: string;
  framework: string | null;
  standard_id: number;
  subject_id: number;
  syear: number;
};

type UnitData = {
  chapter_id: number;
  chapter_range?: string | null;
  current?: boolean | null;
  current_unit?: boolean | null;
  is_current?: boolean | null;
  name: string;
  planned_periods: number | string | null;
  status?: string | null;
  timeline?: string | null;
  unit_chapters: string | string[] | null;
  unit_number: number;
};

type OutcomeNode = {
  chapter: string | null;
  children: OutcomeNode[];
  code: string | null;
  description: string | null;
  id: number;
};

type CurriculumApiResult = {
  curriculum_data: CurriculumData | null;
  outcomes: OutcomeNode[];
  unit_data: UnitData[];
};

type StudentUnitView = {
  chapterLabel: string;
  id: number;
  isCurrent: boolean;
  learningOutcomes: Array<{
    code: string;
    description: string;
    id: number;
  }>;
  timeline: string;
  title: string;
};

type StudentChapterView = {
  concepts: Array<{
    id: string;
    name: string;
    /** topic_master.id this concept sits under, null when it is untagged. */
    topicId: string | null;
  }>;
  /** topic_master rows for the chapter, in curriculum order. */
  topics: Array<{ id: string; title: string; description: string }>;
  id: string;
  name: string;
  number: number;
};

type StudentSubjectItem = LmsSubject & {
  chapterCount: number;
  coverage: number;
  keyConceptCount: number;
  lessonPlanCount: number;
  sectionId: string;
  sectionName: string;
};

function readString(value: unknown): string {
  return value != null && value !== '' ? String(value) : '';
}

function getGradeLabel(standardName: string) {
  return `Grade ${standardName}`;
}

function getSyear(): string {
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

/** Identifies the learner so a document's online practice keeps its place per learner on a shared browser. */
function documentUserKey(): string {
  const context = getRequestContext();

  return context ? `${context.sub_institute_id}-${context.user_id}` : 'guest';
}

function getRequestContext(): {
  client_id: number;
  sub_institute_id: number;
  user_id: number;
  user_profile_id: number;
  user_profile_name: string;
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

    const readText = (...keys: string[]): string => {
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
      user_profile_name: readText('user_profile_name', 'userProfileName'),
      client_id: readNumber('client_id'),
    };
  } catch {
    return null;
  }
}

function getCurriculumSession(overrideSyear?: string, overrideSubInstituteId?: number): CurriculumSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;

    const token = readString(userData.user_token ?? userData.token);
    const hostName = readString(userData.host_name) || API_BASE_URL;
    const subInstituteId =
      readString(overrideSubInstituteId) ||
      readString(userData.sub_institute_id ?? menuContext.sub_institute_id);
    const academicYearId =
      readString(overrideSyear) ||
      readString(localStorage.getItem('selectedAcademicYear')) ||
      readString(userData.academic_year_id ?? userData.academicYearId);

    if (!token || !hostName || !subInstituteId || !academicYearId) {
      return null;
    }

    return {
      token,
      hostName,
      subInstituteId,
      academicYearId,
    };
  } catch {
    return null;
  }
}

async function fetchCurriculumData(
  session: CurriculumSession,
  subjectId: string,
  standardId?: string
): Promise<CurriculumApiResult> {
  const query = new URLSearchParams({
    subject_id: subjectId,
    sub_institute_id: session.subInstituteId,
    syear: session.academicYearId,
    ...(standardId ? { standard_id: standardId } : {}),
  });

  const response = await fetch(
    `${session.hostName.replace(/\/$/, '')}/lms/new_curriculum?${query.toString()}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
    }
  );

  const responseData = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error('Curriculum request failed');
  }

  const result = Array.isArray(responseData) ? responseData[0] : responseData;
  const record = (result ?? {}) as Record<string, unknown>;

  return {
    curriculum_data: (record.curriculum_data as CurriculumData | null) ?? null,
    unit_data: Array.isArray(record.unit_data) ? (record.unit_data as UnitData[]) : [],
    outcomes: Array.isArray(record.outcomes) ? (record.outcomes as OutcomeNode[]) : [],
  };
}

function parseUnitChapters(value: string | string[] | null): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return String(value)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
}

function normalizeLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function getUnitChapterLabel(unit: UnitData, chapters: string[]) {
  if (readString(unit.chapter_range)) return String(unit.chapter_range);
  if (chapters.length === 0) return 'Chapters unavailable';

  const numericValues = chapters
    .map((chapter) => Number(chapter.replace(/[^\d]/g, '')))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (numericValues.length === chapters.length) {
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    return min === max ? `Chapter ${min}` : `Chapters ${min}-${max}`;
  }

  return chapters.join(', ');
}

function getUnitTimeline(unit: UnitData) {
  return readString(unit.timeline) || readString(unit.planned_periods) || 'Timeline unavailable';
}

function isCurrentUnit(unit: UnitData) {
  return Boolean(unit.is_current ?? unit.current ?? unit.current_unit) || readString(unit.status).toLowerCase() === 'current';
}

function flattenOutcomeNodes(nodes: OutcomeNode[]): OutcomeNode[] {
  return nodes.flatMap((node) => [node, ...flattenOutcomeNodes(node.children ?? [])]);
}

function buildStudentUnits(unitData: UnitData[], outcomes: OutcomeNode[]): StudentUnitView[] {
  const flattenedOutcomes = flattenOutcomeNodes(outcomes);

  return unitData.map((unit) => {
    const unitChapters = parseUnitChapters(unit.unit_chapters);
    const normalizedChapters = unitChapters.map(normalizeLabel);
    const linkedOutcomes = flattenedOutcomes.filter((outcome) => {
      const chapterLabel = normalizeLabel(readString(outcome.chapter));
      if (!chapterLabel) return false;
      return normalizedChapters.some(
        (chapter) => chapter && (chapterLabel.includes(chapter) || chapter.includes(chapterLabel))
      );
    });

    return {
      id: unit.unit_number,
      title: `Unit ${unit.unit_number} ${String.fromCharCode(183)} ${unit.name || `Unit ${unit.unit_number}`}`,
      chapterLabel: getUnitChapterLabel(unit, unitChapters),
      timeline: getUnitTimeline(unit),
      isCurrent: isCurrentUnit(unit),
      learningOutcomes: linkedOutcomes.map((outcome) => ({
        id: outcome.id,
        code: outcome.code || 'No code',
        description: outcome.description || 'No description available',
      })),
    };
  });
}

function buildStudentChapters(chapters: Chapter[]): StudentChapterView[] {
  return chapters.map((chapter, index) => {
    // topicId only exists on the concept rows. The content_categories fallback is
    // a bare list of names, so those chapters have nothing to group by and fall
    // back to a flat concept list, exactly as they do in the teacher list.
    const normalizedConcepts =
      chapter.concepts?.map((concept, conceptIndex) => ({
        id: String(concept.id ?? conceptIndex + 1),
        name: concept.title || `Concept ${conceptIndex + 1}`,
        topicId: concept.topicId ?? null,
      })) ??
      Object.keys(chapter.content_categories ?? {}).map((conceptName, conceptIndex) => ({
        id: `${chapter.id}-${conceptIndex + 1}`,
        name: conceptName || `Concept ${conceptIndex + 1}`,
        topicId: null,
      }));

    return {
      id: String(chapter.id),
      number: Number(chapter.number) || index + 1,
      name: chapter.title || 'Untitled chapter',
      topics: (chapter.topics ?? []).map((topic) => ({
        id: String(topic.id),
        title: topic.title,
        description: topic.description,
      })),
      concepts: normalizedConcepts.filter((concept) => concept.name.trim()),
    };
  });
}

function CurriculumSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-20 animate-pulse rounded-2xl bg-white/70" />
      <div className="h-14 animate-pulse rounded-2xl bg-white/70" />
      <div className="h-24 animate-pulse rounded-2xl bg-white/70" />
      <div className="h-24 animate-pulse rounded-2xl bg-white/70" />
    </div>
  );
}

export default function StudentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { menuContext } = useAuth();

  const [contentError, setContentError] = useState<string | null>(null);
  const [contentSourceFilter, setContentSourceFilter] = useState('all');
  const [contentReloadKey, setContentReloadKey] = useState(0);
  const [contentItemsByChapter, setContentItemsByChapter] = useState<Record<string, ChapterContentItem[]>>({});
  const [contentSearch, setContentSearch] = useState('');
  const [curriculumResponse, setCurriculumResponse] = useState<CurriculumApiResult | null>(null);
  const [data, setData] = useState<LmsCoursesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  // Keyed "chapterId:topicId" so the same topic id under two chapters cannot both open.
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);
  const [expandedUnitId, setExpandedUnitId] = useState<number | null>(null);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChapter, setSelectedChapter] = useState<StudentChapterView | null>(null);
  const [selectedContentType, setSelectedContentType] = useState<string>('All content');
  const [openPrayogshala, setOpenPrayogshala] = useState<PrayogshalaActivity | null>(null);
  const [labActivity, setLabActivity] = useState<PrayogshalaActivity | null>(null);
  // The study document open over the page, if any (revision notes, a remedial class, classroom activities).
  const [openDocument, setOpenDocument] = useState<DocumentViewerItem | null>(null);
  const [selectedStandard, setSelectedStandard] = useState('all');
  const [selectedSection, setSelectedSection] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<StudentSubjectItem | null>(null);
  const [studentView, setStudentView] = useState<StudentView>('subjects');
  const [questionBankItems, setQuestionBankItems] = useState<QuestionBankItem[]>([]);
  const [questionBankLoading, setQuestionBankLoading] = useState(false);
  const [questionBankError, setQuestionBankError] = useState<string | null>(null);
  const [questionBankChapterFilter, setQuestionBankChapterFilter] = useState('all');
  const [questionBankConceptFilter, setQuestionBankConceptFilter] = useState('all');
  const [questionBankTypeFilter, setQuestionBankTypeFilter] = useState('all');
  const [subjectData, setSubjectData] = useState<SubjectWithChapters | null>(null);

  useEffect(() => {
    const requestContext = getRequestContext() ?? menuContext ?? getStoredMenuContext();
    if (!requestContext) {
      setError('Course master session data is missing.');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
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
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [menuContext]);

  const studentSubjects = useMemo<StudentSubjectItem[]>(() => {
    return (data?.lms_subject ?? []).map((subject) => {
      const sectionName =
        subject.section_name ||
        subject.section ||
        subject.division_name ||
        subject.division ||
        '';
      const sectionId = sectionName ? String(subject.section_id ?? subject.division_id ?? sectionName) : '';
      const chapterCount = Number(subject.chapter_count ?? subject.chapters_count ?? subject.chapters?.length ?? 0);
      const keyConceptCount = getTotalKeyConceptCount(
        Array.isArray(subject.chapters) ? subject.chapters : [],
        subject
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
                (subject.chapters.filter((chapter) => Number(chapter.total_content) > 0).length / chapterCount) * 100
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

  const standardOptions = useMemo(() => {
    const standardsMap = new Map<string, { id: string; label: string }>();

    studentSubjects.forEach((subject) => {
      const key = String(subject.standard_id ?? subject.standard_name);
      if (!standardsMap.has(key)) {
        standardsMap.set(key, {
          id: key,
          label: getGradeLabel(subject.standard_name),
        });
      }
    });

    return Array.from(standardsMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [studentSubjects]);

  const sectionOptions = useMemo(() => {
    const sectionMap = new Map<string, string>();

    studentSubjects
      .filter(
        (subject) =>
          selectedStandard === 'all' ||
          String(subject.standard_id) === String(selectedStandard)
      )
      .forEach((subject) => {
        if (subject.sectionId && !sectionMap.has(subject.sectionId)) {
          sectionMap.set(subject.sectionId, subject.sectionName);
        }
      });

    return Array.from(sectionMap.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [selectedStandard, studentSubjects]);

  const filteredSubjects = useMemo(() => {
    return studentSubjects.filter((subject) => {
      const matchesSearch = subject.subject_name?.toLowerCase().includes(search.toLowerCase());
      const matchesStandard =
        selectedStandard === 'all' ||
        String(subject.standard_id) === String(selectedStandard);
      const matchesSection =
        selectedSection === 'all' ||
        String(subject.sectionId) === String(selectedSection);

      return matchesSearch && matchesStandard && matchesSection;
    })
      // Subjects a student can actually open come first; the empty ones follow.
      .sort((x, y) => Number(y.chapterCount > 0) - Number(x.chapterCount > 0));
  }, [search, selectedSection, selectedStandard, studentSubjects]);

  useEffect(() => {
    setSelectedSection('all');
  }, [selectedStandard]);

  useEffect(() => {
    if (studentSubjects.length === 0) return;

    const subjectIdParam = searchParams?.get('subject_id');
    const standardIdParam = searchParams?.get('standard_id');
    const sectionIdParam = searchParams?.get('section_id');
    const viewParam = searchParams?.get('view');

    if (!subjectIdParam || !viewParam) return;

    const subject =
      studentSubjects.find(
        (item) =>
          String(item.subject_id) === subjectIdParam &&
          (!standardIdParam || String(item.standard_id) === String(standardIdParam)) &&
          // A subject with no real section ignores a section_id the link carries (older links name "Section A").
          (!sectionIdParam || !item.sectionId || String(item.sectionId) === String(sectionIdParam))
      ) ?? null;

    if (!subject) return;

    setSelectedSubject(subject);
    if (
      viewParam === 'curriculum' ||
      viewParam === 'chapters' ||
      viewParam === 'content' ||
      viewParam === 'question-bank'
    ) {
      setStudentView(viewParam);
    } else {
      setStudentView('subjects');
    }
  }, [searchParams, studentSubjects]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetailData() {
      const viewsNeedingDetail = ['curriculum', 'chapters', 'content', 'question-bank'];
      if (!selectedSubject || !viewsNeedingDetail.includes(studentView)) {
        return;
      }

      const requestContext = getRequestContext();
      const session = getCurriculumSession(
        getSyear(),
        Number(selectedSubject.sub_institute_id ?? requestContext?.sub_institute_id ?? 0)
      );

      if (!session) {
        if (!cancelled) {
          setError("Couldn't load curriculum data. Try again.");
          setIsDetailLoading(false);
        }
        return;
      }

      setIsDetailLoading(true);
      setError(null);

      try {
        const [subjectResult, curriculumResult] = await Promise.all([
          getSubjectAndChapters(String(selectedSubject.subject_id), String(selectedSubject.standard_id)),
          fetchCurriculumData(session, String(selectedSubject.subject_id), String(selectedSubject.standard_id)),
        ]);

        if (cancelled) return;

        setSubjectData(subjectResult);
        setCurriculumResponse(curriculumResult);
        setExpandedUnitId(curriculumResult.unit_data[0]?.unit_number ?? null);
      } catch {
        if (!cancelled) {
          setError("Couldn't load curriculum data. Try again.");
        }
      } finally {
        if (!cancelled) {
          setIsDetailLoading(false);
        }
      }
    }

    void loadDetailData();

    return () => {
      cancelled = true;
    };
  }, [selectedSubject, studentView]);

  // Memoised because `?? []` would hand out a fresh array on every render while
  // subjectData is still null, which propagates through studentChapters into the
  // question bank fetch effect and refetches forever.
  const chapters = useMemo(() => subjectData?.chapters ?? [], [subjectData]);
  const detailSubject = subjectData?.subject ?? selectedSubject;
  const studentUnits = useMemo(
    () => buildStudentUnits(curriculumResponse?.unit_data ?? [], curriculumResponse?.outcomes ?? []),
    [curriculumResponse?.outcomes, curriculumResponse?.unit_data]
  );
  const studentChapters = useMemo(() => buildStudentChapters(chapters), [chapters]);

  useEffect(() => {
    let cancelled = false;

    async function loadChapterContentForView() {
      if (studentView !== 'content' || !selectedChapter || !selectedSubject) return;
      if (contentItemsByChapter[selectedChapter.id]) return;

      const requestContext = getRequestContext();
      const resolvedSubInstituteId = Number(
        selectedSubject.sub_institute_id ??
          requestContext?.sub_institute_id ??
          0
      );

      if (!resolvedSubInstituteId) {
        if (!cancelled) setContentError("Couldn't load content for this chapter. Try again.");
        return;
      }

      if (!cancelled) {
        setIsContentLoading(true);
        setContentError(null);
      }

      try {
        const response = await fetchChapterContent(Number(selectedChapter.id), resolvedSubInstituteId);
        if (cancelled) return;

        setContentItemsByChapter((current) => ({
          ...current,
          [selectedChapter.id]: buildApiChapterContentItems(
            { id: String(selectedChapter.id), title: selectedChapter.name },
            response.content_categories ?? {}
          ),
        }));
      } catch {
        if (!cancelled) {
          setContentError("Couldn't load content for this chapter. Try again.");
        }
      } finally {
        if (!cancelled) {
          setIsContentLoading(false);
        }
      }
    }

    void loadChapterContentForView();

    return () => {
      cancelled = true;
    };
  }, [contentItemsByChapter, contentReloadKey, selectedChapter, selectedSubject, studentView]);

  const selectedChapterContent = useMemo(
    () => (selectedChapter ? contentItemsByChapter[selectedChapter.id] ?? [] : []),
    [contentItemsByChapter, selectedChapter]
  );

  // The list below is the admin's Classroom Resource lane, rule for rule (classroomResourceModel.ts): the same lane filter,
  // the same tabs and tab counts, the same search and source filters. The student sees it Chapter wise, as the admin does
  // in that lane. The server has already withheld what a student must not read (Teacher Resources).
  const classroomTabs = tabsForLane('classroom');
  const laneContentItems = useMemo(() => itemsForActiveLane(selectedChapterContent, {
    lane: 'classroom',
    search: contentSearch,
    source: contentSourceFilter,
    showsInLane: (item) => showsInLane(item, 'classroom'),
  }), [contentSearch, contentSourceFilter, selectedChapterContent]);
  const contentSources = useMemo(() => contentSourceOptions(itemsInLane(selectedChapterContent, 'classroom')), [selectedChapterContent]);
  const activeContentTab = classroomTabs.includes(selectedContentType) ? selectedContentType : 'All content';
  const tabCounts = useMemo(() => contentTabCounts(laneContentItems, classroomTabs), [classroomTabs, laneContentItems]);
  const visibleTabs = useMemo(
    () => visibleContentTabs(classroomTabs, tabCounts, activeContentTab),
    [activeContentTab, classroomTabs, tabCounts]
  );
  const filteredContent = useMemo(
    () => laneContentItems.filter((item) => contentMatchesTab(item, activeContentTab)),
    [activeContentTab, laneContentItems]
  );
  // The Videos tab is shown in sections once the chapter's videos carry a section; otherwise it stays one flat list.
  const videoSections = useMemo(
    () => (activeContentTab === 'Videos' ? groupVideos(filteredContent) : null),
    [activeContentTab, filteredContent]
  );

  const subjectName = detailSubject?.subject_name || curriculumResponse?.curriculum_data?.curriculum_name || 'Curriculum';
  const standardName = detailSubject?.standard_name ? `Grade ${detailSubject.standard_name}` : 'Grade';
  const sectionName =
    selectedSubject?.sectionName ||
    detailSubject?.section_name ||
    detailSubject?.division_name ||
    'Section';
  const chapterCount = Number(
    detailSubject?.chapter_count ??
      detailSubject?.chapters_count ??
      selectedSubject?.chapterCount ??
      chapters.length ??
      0
  );
  // Counted from the chapters first, exactly as the teacher header does. The
  // catalog returns key_concepts_count 0 for this subject even though its 16
  // chapters carry 406 concepts, so a subject-level total can only be a fallback.
  const keyConceptCount =
    getTotalKeyConceptCount(chapters, detailSubject) || selectedSubject?.keyConceptCount || 0;
  // Already reads "CBSE curriculum" / "ICSE curriculum", and is '' when the tenant
  // has no curriculum record. The header drops the segment in that case rather than
  // printing a placeholder - the old board-or-'Curriculum' fallback rendered the
  // word twice, as "Curriculum curriculum".
  const curriculumLabel = getCurriculumLabel(curriculumResponse?.curriculum_data ?? null);

  // Questions are fetched for whichever chapter the dropdown selects, and for
  // every chapter of the subject on 'all' - the same scope the teacher bank uses.
  // State is set off a resolved promise so the effect body itself stays free of
  // synchronous setState, matching how the content fetch on this screen behaves.
  useEffect(() => {
    if (studentView !== 'question-bank') return;

    const scopedChapters =
      questionBankChapterFilter === 'all'
        ? studentChapters
        : studentChapters.filter((chapter) => chapter.id === questionBankChapterFilter);
    const fetchableChapters = scopedChapters.filter((chapter) => /^\d+$/.test(chapter.id));

    let cancelled = false;

    Promise.resolve()
      .then(() => {
        if (cancelled) return [] as QuestionBankItem[];

        if (fetchableChapters.length === 0) {
          setQuestionBankError('This chapter has no question bank.');
          return [] as QuestionBankItem[];
        }

        setQuestionBankLoading(true);
        setQuestionBankError(null);

        // One chapter failing must not blank the whole bank on 'all'.
        return Promise.all(
          fetchableChapters.map((chapter) =>
            fetchMappedQuestionBank(Number(chapter.id), {
              title: chapter.name,
              concepts: chapter.concepts.map((concept) => ({ id: concept.id, title: concept.name })),
              topics: chapter.topics,
            }).catch(() => [] as QuestionBankItem[])
          )
        ).then((results) => results.flat());
      })
      .then((items) => {
        if (!cancelled) setQuestionBankItems(items);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setQuestionBankError(err instanceof Error ? err.message : "Couldn't load questions. Try again.");
        setQuestionBankItems([]);
      })
      .finally(() => {
        if (!cancelled) setQuestionBankLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [questionBankChapterFilter, studentChapters, studentView]);

  const questionBankConceptOptions = useMemo(
    () => Array.from(new Set(questionBankItems.map((question) => question.conceptTitle))).sort(),
    [questionBankItems]
  );

  const questionBankChapterLabel =
    questionBankChapterFilter === 'all'
      ? 'All chapters'
      : studentChapters.find((chapter) => chapter.id === questionBankChapterFilter)?.name ??
        'All chapters';

  // Narrowing the chapter can drop the concept that was picked. Rather than reset
  // it behind the student's back, an out-of-scope concept just reads as 'all'.
  const effectiveQuestionBankConceptFilter =
    questionBankConceptFilter === 'all' ||
    questionBankConceptOptions.includes(questionBankConceptFilter)
      ? questionBankConceptFilter
      : 'all';

  const filteredQuestionBankItems = useMemo(() => {
    return questionBankItems.filter((question) => {
      const matchesChapter =
        questionBankChapterFilter === 'all' || question.chapterId === questionBankChapterFilter;
      const matchesConcept =
        effectiveQuestionBankConceptFilter === 'all' ||
        question.conceptTitle === effectiveQuestionBankConceptFilter;
      const matchesType = questionBankTypeFilter === 'all' || question.type === questionBankTypeFilter;
      return matchesChapter && matchesConcept && matchesType;
    });
  }, [
    effectiveQuestionBankConceptFilter,
    questionBankChapterFilter,
    questionBankItems,
    questionBankTypeFilter,
  ]);

  const groupedQuestionBankItems = useMemo(
    () => groupQuestionBankItems(filteredQuestionBankItems),
    [filteredQuestionBankItems]
  );

  const questionBankVisibleNumberById = useMemo(
    () => new Map(filteredQuestionBankItems.map((question, index) => [question.id, index + 1])),
    [filteredQuestionBankItems]
  );

  const handleSelectSubject = (subject: StudentSubjectItem, nextView: 'curriculum' | 'chapters') => {
    setSelectedSubject(subject);
    setSelectedChapter(null);
    setContentSearch('');
    setSelectedContentType('All content');
    setContentSourceFilter('all');
    setCurriculumResponse(null);
    setSubjectData(null);
    setExpandedChapterId(null);
    setExpandedUnitId(null);
    setStudentView(nextView);
  };

  const handleOpenChapterContent = (chapter: StudentChapterView) => {
    setSelectedChapter(chapter);
    setContentError(null);
    setContentSearch('');
    setSelectedContentType('All content');
    setContentSourceFilter('all');
    setStudentView('content');
  };

  const handleOpenChapterQuestionBank = (chapter: StudentChapterView) => {
    setSelectedChapter(chapter);
    setQuestionBankError(null);
    // Opens scoped to the chapter whose button was clicked; the dropdown can then
    // widen it to the whole subject.
    setQuestionBankChapterFilter(chapter.id);
    setQuestionBankConceptFilter('all');
    setQuestionBankTypeFilter('all');
    setStudentView('question-bank');
  };

  const handleChapterChange = (value: string | null) => {
    if (!value) return;
    const nextChapter = studentChapters.find((chapter) => chapter.id === value) ?? null;
    setSelectedChapter(nextChapter);
    setContentError(null);
  };

  const handleOpenContent = (item: ChapterContentItem) => {
    // A Prayogshala activity is a structured document: an interactive lab opens full-screen, a plain activity in the
    // detail dialog (read-only here: a student never manages activities).
    if (item.prayogshala) {
      if (item.prayogshala.lab_config) setLabActivity(item.prayogshala);
      else setOpenPrayogshala(item.prayogshala);
      return;
    }
    // A study document is a PDF with an online practice beside it, and opens in place over this page: no route, no new tab.
    const chapterId = Number(item.chapterId);
    const contentId = Number(item.id);
    if (item.studyDocKind && Number.isFinite(chapterId) && Number.isFinite(contentId)) {
      setOpenDocument({ chapterId, contentId, title: item.title, kind: item.studyDocKind });
      return;
    }
    // A study deck, vocabulary deck or classroom activity opens in its own student player. Only the student's own routes
    // are followed: an H5P item's link points at the teacher's editor under /h5p, which a student must not be sent to.
    if (item.deepLink) {
      if (item.deepLink.startsWith('/student/')) {
        setContentError(null);
        router.push(item.deepLink);
      } else {
        setContentError('This interactive activity opens in the teacher editor and is not available to students yet.');
      }
      return;
    }
    // A document opens at its own complete public URL (a PDF in the browser's viewer, a .docx as a download). A missing or
    // incomplete URL is reported, never opened and never silently ignored.
    const target = documentTarget(item.contentUrl);
    if (!target.ok) {
      setContentError(target.message);
      return;
    }
    setContentError(null);
    window.open(target.url, '_blank', 'noopener,noreferrer');
  };

  /** The study deck's classroom PDF as a download, found by the server from the content row (as on the admin page). */
  const handleDownloadPdf = (item: ChapterContentItem) => {
    const instituteId = Number(getRequestContext()?.sub_institute_id ?? menuContext?.sub_institute_id ?? NaN);
    const chapterId = Number(item.chapterId);
    const contentId = Number(item.id);
    if (![instituteId, chapterId, contentId].every(Number.isFinite)) {
      setContentError('Your session data is missing. Sign in again and retry.');
      return;
    }
    downloadStudyDeckPdf(chapterId, contentId, instituteId, pdfFileNameFromTitle(item.title)).catch((error: unknown) => {
      setContentError(error instanceof Error ? error.message : 'Couldn’t download the PDF.');
    });
  };

  const returnToCourseMaster = () => {
    localStorage.setItem('learningManagementAudienceMode', 'Student');
    router.push('/course-master');
  };

  const renderSubjectCard = (subject: StudentSubjectItem) => {
    const category = subject.category_name || subject.content_category;
    const SubjectIcon = CATEGORY_ICON_MAP[category] ?? BookOpen;
    const accent = CATEGORY_ACCENT_MAP[category] ?? '#5648E8';

    return (
      <div
        key={`${subject.subject_id}-${subject.standard_id}-${subject.sectionId}`}
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
                {getGradeLabel(subject.standard_name)}
                {subject.sectionName ? <span className="mx-1">·</span> : null}
                {subject.sectionName}
              </p>
            </div>
          </div>

          <Badge className="shrink-0 rounded-full bg-[#F2F5FA] px-3 py-1 text-[12px] font-medium text-[#51657F] hover:bg-[#F2F5FA] sm:text-[13px]">
            {subject.chapterCount} chapters
          </Badge>
        </div>

        <p className="mt-4 text-[13px] leading-5 text-[#3F5572] sm:text-[14px]">
          {subject.lessonPlanCount > 0
            ? `${subject.lessonPlanCount} learning items to explore`
            : 'Learning content is on its way'}
        </p>

        <div className="mt-4 border-t border-[#E4EAF2] pt-4">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleSelectSubject(subject, 'curriculum')}
              disabled={subject.chapterCount === 0}
              className="inline-flex min-w-0 items-center justify-center rounded-[12px] border border-[#C8D3E3] bg-white px-3 py-2.5 text-[14px] font-medium text-[#0F172A] transition hover:border-[#AAB8CF] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ListTree size={16} className="mr-2" />
              Syllabus
            </button>

            <button
              type="button"
              onClick={() => handleSelectSubject(subject, 'chapters')}
              disabled={subject.chapterCount === 0}
              className="inline-flex min-w-0 items-center justify-center rounded-[12px] bg-[#5648E8] px-3 py-2.5 text-[14px] font-medium text-white transition hover:bg-[#4A3DD0] disabled:cursor-not-allowed disabled:bg-[#C7CBD6]"
            >
              <BookOpen size={16} className="mr-2" />
              Chapters
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPageHeader = () => {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7A889D]">
              {getSyear() ? `Academic year ${getSyear()}` : 'Academic year'}
            </p>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-[#172554] sm:text-[34px]">
              My subjects
            </h1>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-[#5B6B82]">
              Pick a subject to explore its chapters, lessons and practice.
            </p>
          </div>

        </div>
      </div>
    );
  };

  const renderSubjectsView = () => {
    return (
      <>
        {renderPageHeader()}

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="relative w-full lg:max-w-[300px]">
              <Label className="mb-2 block text-[13px] font-medium text-[#52637A]">Search Subjects</Label>
              <Search className="pointer-events-none absolute left-4 top-[42px] h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search subjects..."
                className="h-10 w-full rounded-[10px] border border-[#C7D2E4] bg-white pl-11 pr-4 text-[14px] text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#5648E8]"
              />
            </div>

            {standardOptions.length > 1 ? (
            <div className="w-full lg:w-[165px]">
              <Label className="mb-2 block text-[13px] font-medium text-[#52637A]">Standard</Label>
              <Select value={selectedStandard} onValueChange={(value) => setSelectedStandard(value ?? 'all')}>
                <SelectTrigger className="h-10 w-full rounded-[10px] border-[#C7D2E4] bg-white text-[14px] text-[#0F172A] shadow-none focus:ring-0 focus:ring-offset-0">
                  <SelectValue placeholder="All standards" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All standards</SelectItem>
                  {standardOptions.map((standard) => (
                    <SelectItem key={standard.id} value={standard.id}>
                      {standard.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            ) : null}

            {sectionOptions.length > 1 ? (
            <div className="w-full lg:w-[165px]">
              <Label className="mb-2 block text-[13px] font-medium text-[#52637A]">Section</Label>
              <Select value={selectedSection} onValueChange={(value) => setSelectedSection(value ?? 'all')}>
                <SelectTrigger className="h-10 w-full rounded-[10px] border-[#C7D2E4] bg-white text-[14px] text-[#0F172A] shadow-none focus:ring-0 focus:ring-offset-0">
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sections</SelectItem>
                  {sectionOptions.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            ) : null}
          </div>

          <p className="text-[15px] font-medium text-[#334155]">
            {filteredSubjects.length === studentSubjects.length
              ? `${studentSubjects.length} subjects`
              : `${filteredSubjects.length} of ${studentSubjects.length} subjects`}
          </p>
        </div>

        {filteredSubjects.length === 0 ? (
          <div className="mt-8 rounded-[18px] border border-[#D9E1EE] bg-white px-6 py-16 text-center text-[#64748B] shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
            No subjects found for the selected filters.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {filteredSubjects.map((subject) => renderSubjectCard(subject))}
          </div>
        )}
      </>
    );
  };

  const renderDetailShell = (activeView: 'curriculum' | 'chapters') => {
    return (
      <div>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-white text-[#5648E8] shadow-[0_1px_6px_rgba(15,23,42,0.06)]">
            <FlaskConical size={24} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-[#0F172A] sm:text-[30px]">
                  {subjectName} {'\u2014'} {standardName}
                </h1>

                <p className="mt-1 text-[15px] text-[#475569]">
                  {chapterCount} chapters
                  <span className="mx-1">·</span>
                  {keyConceptCount} key concepts
                  {curriculumLabel ? (
                    <>
                      <span className="mx-1">·</span>
                      {curriculumLabel}
                    </>
                  ) : null}
                </p>
              </div>

              <button
                type="button"
                onClick={returnToCourseMaster}
                className="inline-flex items-center gap-2 self-start rounded-xl border border-[#C8D3E3] bg-white px-4 py-2.5 text-sm font-medium text-[#0F172A] shadow-[0_2px_6px_rgba(15,23,42,0.06)] transition hover:border-[#AAB8CF]"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 border-b border-[#D8E1F0]">
          <div className="flex flex-wrap items-center gap-8">
            <button
              type="button"
              onClick={() => setStudentView('curriculum')}
              className={`pb-3 text-[15px] font-medium transition ${
                activeView === 'curriculum'
                  ? 'border-b-2 border-[#4F46E5] text-[#4F46E5]'
                  : 'text-[#334155] hover:text-[#0F172A]'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <ListTree size={16} />
                Curriculum
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStudentView('chapters')}
              className={`pb-3 text-[15px] font-medium transition ${
                activeView === 'chapters'
                  ? 'border-b-2 border-[#4F46E5] text-[#4F46E5]'
                  : 'text-[#334155] hover:text-[#0F172A]'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <BookOpen size={16} />
                Chapters
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCurriculumView = () => {
    return (
      <>
        {renderDetailShell('curriculum')}

        {studentUnits.length === 0 ? (
          <div className="mt-6 rounded-[18px] border border-[#D8E1F0] bg-white px-6 py-14 text-center text-[15px] text-[#64748B] shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
            No curriculum data is available for this subject.
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {studentUnits.map((unit) => {
              const isExpanded = expandedUnitId === unit.id;

              return (
                <div key={unit.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setExpandedUnitId(isExpanded ? null : unit.id)}
                    className="flex w-full items-start gap-3 px-6 py-5 text-left"
                  >
                    <ChevronRight
                      className={`mt-1 h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                    />

                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{unit.title}</h3>

                      <p className="text-sm text-slate-600">
                        {unit.chapterLabel}
                        <span className="mx-1">·</span>
                        {unit.timeline}
                        {unit.isCurrent ? ' (current)' : ''}
                      </p>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="border-t px-6 py-6">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Learning outcomes
                      </h4>

                      {unit.learningOutcomes.length === 0 ? (
                        <p className="mt-4 text-sm text-slate-600">
                          No learning outcomes are available for this unit.
                        </p>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {unit.learningOutcomes.map((outcome) => (
                            <div key={outcome.id} className="flex items-start gap-3">
                              <span className="shrink-0 rounded-md border bg-slate-50 px-2 py-1 font-mono text-xs text-slate-600">
                                {outcome.code}
                              </span>

                              <p className="text-sm text-slate-800">{outcome.description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  };

  const renderChaptersView = () => {
    return (
      <>
        {renderDetailShell('chapters')}

        {studentChapters.length === 0 ? (
          <div className="mt-6 rounded-[18px] border border-[#D8E1F0] bg-white px-6 py-14 text-center text-[15px] text-[#64748B] shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
            No chapters are available for this subject.
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {studentChapters.map((chapter) => {
              const isExpanded = expandedChapterId === chapter.id;
              // Chapter -> topic -> concept, using the same rule as the teacher
              // list: chapters with no topic rows keep listing concepts directly.
              const chapterTopicRows = groupConceptsByTopic(
                chapter.topics,
                chapter.concepts,
                (concept) => concept.topicId
              );

              return (
                <div key={chapter.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between px-6 py-5">
                    <button
                      type="button"
                      onClick={() => setExpandedChapterId(isExpanded ? null : chapter.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      />

                      <h3 className="truncate text-xl font-semibold text-slate-900">
                        Chapter {chapter.number}
                        <span className="mx-2">·</span>
                        {chapter.name}
                      </h3>
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenChapterContent(chapter);
                        }}
                        className="inline-flex items-center rounded-[14px] border border-[#C8D3E3] bg-white px-4 py-2.5 text-sm font-medium text-[#0F172A] shadow-[0_2px_6px_rgba(15,23,42,0.06)] transition hover:border-[#AAB8CF]"
                      >
                        <FolderOpen size={16} className="mr-2" />
                        Content
                      </button>

                      {/* <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenChapterQuestionBank(chapter);
                        }}
                        className="inline-flex items-center rounded-[14px] border border-[#C8D3E3] bg-white px-4 py-2.5 text-sm font-medium text-[#0F172A] shadow-[0_2px_6px_rgba(15,23,42,0.06)] transition hover:border-[#AAB8CF]"
                      >
                        <ClipboardList size={16} className="mr-2" />
                        Question Bank
                      </button> */}
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="border-t border-slate-200 px-6 py-2">
                      {chapter.concepts.length === 0 ? (
                        <p className="py-4 text-sm text-slate-500">No concepts available for this chapter.</p>
                      ) : (
                        <div className="divide-y divide-slate-200/80">
                          {chapterTopicRows.length > 0
                            ? chapterTopicRows.map((topic, topicIndex) => {
                                const isTopicExpanded = expandedTopicId === `${chapter.id}:${topic.id}`;

                                return (
                                  <div key={topic.id}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedTopicId(
                                          isTopicExpanded ? null : `${chapter.id}:${topic.id}`
                                        )
                                      }
                                      className="flex w-full items-center gap-3 py-3.5 text-left"
                                    >
                                      <ChevronRight
                                        size={16}
                                        className={`shrink-0 text-slate-500 transition-transform duration-200 ${
                                          isTopicExpanded ? 'rotate-90' : ''
                                        }`}
                                      />
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[15px] font-semibold text-slate-950">
                                          {`${topicIndex + 1}. ${topic.title}`}
                                        </span>
                                      
                                      </span>
                                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                        {topic.concepts.length} concept
                                        {topic.concepts.length === 1 ? '' : 's'}
                                      </span>
                                    </button>

                                    {isTopicExpanded ? (
                                      topic.concepts.length === 0 ? (
                                        <p className="border-t border-slate-200/60 py-3.5 pl-7 text-sm text-slate-500">
                                          No concepts are mapped to this topic yet.
                                        </p>
                                      ) : (
                                        <div className="divide-y divide-slate-200/60 border-t border-slate-200/60 pl-7">
                                          {topic.concepts.map((concept, conceptIndex) => (
                                            <div key={concept.id} className="flex items-center gap-4 py-3.5">
                                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm text-slate-600">
                                                {conceptIndex + 1}
                                              </span>
                                              <p className="text-sm font-medium text-slate-900">{concept.name}</p>
                                            </div>
                                          ))}
                                        </div>
                                      )
                                    ) : null}
                                  </div>
                                );
                              })
                            : chapter.concepts.map((concept, conceptIndex) => (
                                <div key={concept.id} className="flex items-center gap-4 py-4">
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm text-slate-600">
                                    {conceptIndex + 1}
                                  </span>
                                  <p className="text-sm font-medium text-slate-900">{concept.name}</p>
                                </div>
                              ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  };

  /** The chapter's cards, laid out exactly as the admin's Classroom Resource lane lays them out. */
  const renderContentCards = (items: ChapterContentItem[]) => {
    if (videoSections) {
      return (
        <div className="space-y-10" data-testid="video-sections">
          {videoSections.map((section) => (
            <section key={section.key} data-testid={`video-section-${section.key}`}>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-[20px] font-bold leading-7 text-slate-950">{section.label}</h2>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
                  {section.items.length} video{section.items.length === 1 ? '' : 's'}
                </span>
              </div>
              {section.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
                  {section.emptyMessage}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
                  {section.items.map((item) => (
                    <ContentCard
                      key={item.id}
                      item={item}
                      onOpen={() => handleOpenContent(item)}
                      onDownloadPdf={() => handleDownloadPdf(item)}
                      hideChapter
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      );
    }

    return (
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
        {items.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            onOpen={() => handleOpenContent(item)}
            onDownloadPdf={() => handleDownloadPdf(item)}
          />
        ))}
      </div>
    );
  };

  /**
   * The question bank a student sees: the same questions, options, correct answer
   * and model answer the teacher bank shows, with no Add, Edit or Delete anywhere.
   * Those controls are not merely hidden here - this view never renders them and
   * never calls a write endpoint.
   */
  const renderQuestionBankView = () => {
    const totalQuestions = filteredQuestionBankItems.length;
    const scopeLabel =
      questionBankChapterFilter === 'all'
        ? 'this subject'
        : studentChapters.find((chapter) => chapter.id === questionBankChapterFilter)?.name ??
          'this chapter';

    return (
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-[#475569]">
              <span className="inline-flex items-center gap-2">
                <BookOpen size={14} />
                Learn
              </span>
              <ChevronRight size={14} />
              <span className="font-medium text-[#0F172A]">Question Bank</span>
            </div>

            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.03em] text-[#0F172A]">Question bank</h2>

            <p className="mt-2 text-[16px] text-[#475569]">
              Practice questions for {scopeLabel}, with the correct answer shown so you can check
              your own work.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setStudentView('chapters')}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-[#C8D3E3] bg-white px-4 py-2.5 text-sm font-medium text-[#0F172A] shadow-[0_2px_6px_rgba(15,23,42,0.06)] transition hover:border-[#AAB8CF]"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:px-5">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <Label className="shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Chapter
            </Label>
            <Select
              value={questionBankChapterFilter}
              onValueChange={(value) => setQuestionBankChapterFilter(value || 'all')}
            >
              <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white text-slate-700 sm:w-[240px]">
                <SelectValue>{questionBankChapterLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All chapters</SelectItem>
                {studentChapters.map((chapter) => (
                  <SelectItem key={chapter.id} value={chapter.id}>
                    {`Chapter ${chapter.number} · ${chapter.name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Label className="shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Concept
            </Label>
            <Select
              value={effectiveQuestionBankConceptFilter}
              onValueChange={(value) => setQuestionBankConceptFilter(value || 'all')}
            >
              <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white text-slate-700 sm:w-[260px]">
                <SelectValue>
                  {effectiveQuestionBankConceptFilter === 'all'
                    ? 'All concepts'
                    : effectiveQuestionBankConceptFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All concepts</SelectItem>
                {questionBankConceptOptions.map((concept) => (
                  <SelectItem key={concept} value={concept}>
                    {concept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Label className="shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Type
            </Label>
            <Select
              value={questionBankTypeFilter}
              onValueChange={(value) => setQuestionBankTypeFilter(value || 'all')}
            >
              <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white text-slate-700 sm:w-[180px]">
                <SelectValue>
                  {questionBankTypeFilter === 'all' ? 'All types' : questionBankTypeFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="MCQ">MCQ</SelectItem>
                <SelectItem value="Narrative">Narrative</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="shrink-0 text-sm font-medium text-slate-600">
            {totalQuestions} question{totalQuestions === 1 ? '' : 's'}
          </p>
        </div>

        <div className="mt-6">
          {questionBankError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {questionBankError}
            </div>
          ) : questionBankLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : totalQuestions === 0 ? (
            <div className="rounded-[18px] border border-[#D8E1F0] bg-white px-6 py-14 text-center text-[15px] text-[#64748B] shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
              No questions have been shared for this chapter yet.
            </div>
          ) : (
            <div className="space-y-8">
              {groupedQuestionBankItems.map((group) => (
                <section key={group.id}>
                  <div className="mb-4 flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                      <Lightbulb size={20} className="shrink-0 text-[#4f46e5]" />
                      <h3 className="min-w-0 text-[20px] font-bold leading-7 text-slate-950">
                        {group.conceptTitle}
                      </h3>
                    </div>

                    <p className="text-sm font-medium text-slate-600">
                      {group.questions.length} question{group.questions.length === 1 ? '' : 's'}
                    </p>
                  </div>

                  <div className="space-y-5">
                    {group.questions.map((question) => (
                      <QuestionBankQuestionCard
                        key={question.id}
                        question={question}
                        visibleNumber={questionBankVisibleNumberById.get(question.id) ?? 1}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderContentView = () => {
    const chapterLabel = selectedChapter?.name || 'Selected chapter';

    return (
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-[#475569]">
              <span className="inline-flex items-center gap-2">
                <BookOpen size={14} />
                Learn
              </span>
              <ChevronRight size={14} />
              <span className="font-medium text-[#0F172A]">Content</span>
            </div>

            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.03em] text-[#0F172A]">Learning content</h2>

            <p className="mt-2 text-[16px] text-[#475569]">
              Presentations, videos, notes and activities your teacher has shared for the topics you're learning.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setStudentView('chapters')}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-[#C8D3E3] bg-white px-4 py-2.5 text-sm font-medium text-[#0F172A] shadow-[0_2px_6px_rgba(15,23,42,0.06)] transition hover:border-[#AAB8CF]"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>

        {selectedChapter ? <StudyDeckEntry chapterId={Number(selectedChapter.id)} /> : null}

        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <span className="shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Viewing Chapter
              </span>

              <div className="min-w-0 w-full max-w-[320px] shrink">
                <Select value={String(selectedChapter?.id ?? '')} onValueChange={handleChapterChange}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-4 text-[15px] font-medium text-slate-900 shadow-sm">
                    <SelectValue placeholder="Select chapter">
                      {() => selectedChapter?.name ?? 'Select chapter'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {studentChapters.map((chapter) => (
                      <SelectItem key={chapter.id} value={chapter.id}>
                        {chapter.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="shrink-0 whitespace-nowrap text-sm text-slate-500">
                {filteredContent.length} items in {chapterLabel}
              </p>
            </div>

            {/* The Classroom Resource lane is always Chapter wise on the admin page; it is a label there, not a switch. */}
            <span className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200/50 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm">
              <BookOpen size={14} className="text-slate-500" />
              Chapter wise
            </span>
          </div>
        </div>

        <div className="mb-4 mt-6 border-b border-slate-200/80">
          <div className="flex flex-wrap items-center gap-6 text-[15px]">
            {visibleTabs.map((tab) => {
              const count = tabCounts[tab] ?? 0;
              const isActive = activeContentTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSelectedContentType(tab)}
                  className={`inline-flex items-center gap-2 border-b-2 px-1 py-3 font-medium transition-colors ${
                    isActive
                      ? 'border-[#4f46e5] text-[#4f46e5]'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                      isActive ? 'bg-[#eef2ff] text-[#4f46e5]' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-xs">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={contentSearch}
              onChange={(event) => setContentSearch(event.target.value)}
              placeholder="Search content..."
              className="h-11 rounded-xl border-slate-200 bg-white pl-10 text-slate-900 shadow-sm"
            />
          </div>

          {/* Deselecting means "All sources", as on the admin page. */}
          <Select value={contentSourceFilter} onValueChange={(value) => setContentSourceFilter(value || 'all')}>
            <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white text-slate-700 shadow-sm lg:w-[190px]">
              <SelectValue>{contentSourceFilter === 'all' ? 'All sources' : contentSourceFilter}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {contentSources.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {contentError ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{contentError}</span>
            <button
              type="button"
              onClick={() => {
                setContentError(null);
                setContentReloadKey((key) => key + 1);
                // Forget this chapter's cached list so the effect fetches it again.
                if (selectedChapter) {
                  setContentItemsByChapter((current) => {
                    const next = { ...current };
                    delete next[selectedChapter.id];
                    return next;
                  });
                }
              }}
              className="h-9 rounded-full bg-white px-4 text-rose-700"
            >
              Try again
            </button>
          </div>
        ) : isContentLoading ? (
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className="h-56 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : filteredContent.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">
            No content is available for this chapter.
          </div>
        ) : (
          renderContentCards(filteredContent)
        )}

        <PrayogshalaDetailDialog
          activity={openPrayogshala}
          canManage={false}
          onClose={() => setOpenPrayogshala(null)}
          onEdit={() => undefined}
          onRemove={async () => undefined}
        />
        {labActivity?.lab_config ? (
          <PrayogshalaLab activity={labActivity} lab={labActivity.lab_config} onClose={() => setLabActivity(null)} />
        ) : null}
      </div>
    );
  };

  // A link that names a subject and a view (e.g. ?subject_id=..&view=chapters) opens that view directly: while the
  // effect above is about to apply it, show the skeleton instead of flashing the subject list first.
  const deepLinkPending =
    studentView === 'subjects' &&
    !selectedSubject &&
    Boolean(searchParams?.get('subject_id') && searchParams?.get('view')) &&
    studentSubjects.some(
      (item) =>
        String(item.subject_id) === searchParams?.get('subject_id') &&
        (!searchParams?.get('standard_id') || String(item.standard_id) === String(searchParams?.get('standard_id'))) &&
        (!searchParams?.get('section_id') || !item.sectionId || String(item.sectionId) === String(searchParams?.get('section_id')))
    );

  return (
    <div className="min-h-full bg-[#E9EEF7] px-6 py-5">
      <div className="mx-auto max-w-[1800px]">
        {isLoading ? (
          <CurriculumSkeleton />
        ) : error && studentView === 'subjects' ? (
          <div className="rounded-[18px] border border-[#D9E1EE] bg-white px-6 py-16 text-center text-[#64748B] shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
            {error}
          </div>
        ) : isDetailLoading && studentView !== 'subjects' ? (
          <CurriculumSkeleton />
        ) : deepLinkPending ? (
          <CurriculumSkeleton />
        ) : studentView === 'subjects' ? (
          renderSubjectsView()
        ) : studentView === 'curriculum' ? (
          renderCurriculumView()
        ) : studentView === 'chapters' ? (
          renderChaptersView()
        ) : studentView === 'question-bank' ? (
          renderQuestionBankView()
        ) : (
          renderContentView()
        )}
      </div>

      <DocumentViewer
        item={openDocument}
        audience="student"
        instituteId={Number(getRequestContext()?.sub_institute_id ?? menuContext?.sub_institute_id ?? NaN)}
        userKey={documentUserKey()}
        onClose={() => setOpenDocument(null)}
      />
    </div>
  );
}
