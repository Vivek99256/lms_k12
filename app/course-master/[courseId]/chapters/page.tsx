'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  ChevronRight,
  ChevronUp,
  Plus,
  X,
  BookOpen,
  Pencil,
  Trash2,
  ChevronDown,
  Brain,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Search,
  Upload,
  FileText,
  Link2,
  Lightbulb,
  CircleDot,
  Target,
  BriefcaseBusiness,
  TriangleAlert,
  ClipboardList,
  Orbit,
  WandSparkles,
  Eye,
  Play,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { courses, type Course } from '../../data/courses';
import {
  getChaptersByCourseid,
  getConceptIntelligenceData,
  getSubjectAndChapters,
  type SubjectWithChapters,
} from '../../data/chapters';
import { getChapterKeyConcepts } from '../../data/chapterKeyConcepts';
import type { ChapterKeyConceptGroup } from '../../data/chapterKeyConcepts';
import type { Chapter } from '../../data/chapters';

const EMPTY_CHAPTER_FORM = {
  chapterName: '',
  chapterDescription: '',
  sortOrder: '',
  availability: true,
  show: true,
};

const RESOURCE_MAPPING_TYPES = ['Pedagogical Process', 'Material Type', 'Learning Outcome'] as const;
const RESOURCE_MATERIAL_TYPES = ['Mindmap', 'Teacher Training', 'Worksheet', 'Reference Notes', 'Assessment Aid'] as const;
const RESOURCE_FILE_TYPES = ['PDF', 'PPT', 'DOCX', 'Video Link'] as const;
const UPLOAD_CONTENT_TYPES = ['Presentation', 'Video', 'Revision notes', 'Classroom activity'] as const;
const UPLOAD_PRESENTATION_TYPES = ['Classroom presentation', 'Teacher training presentation'] as const;
const UPLOAD_METHOD_TABS = ['Upload file', 'Add link'] as const;
const QUESTION_TYPE_OPTIONS = ['Multiple choice', 'True or false', 'Short answer', 'Assertion and reason'] as const;
const PRESENTATION_SLIDE_OPTIONS = ['8 slides', '10 slides', '12 slides', '15 slides', '18 slides'] as const;
const GAMMA_THEME_OPTIONS = ['EduERP default', 'Clean light', 'Bold classroom', 'Scholar blue'] as const;
const CONTENT_LIBRARY_TABS = ['All content', 'Presentations', 'Videos', 'Revision notes', 'Classroom activity'] as const;
const UPLOAD_TYPE_CONFIG: Record<
  (typeof UPLOAD_CONTENT_TYPES)[number],
  {
    accept: string;
    helperText: string;
    maxSize: number;
    extensions: string[];
    mimeTypes: string[];
  }
> = {
  Presentation: {
    accept:
      '.ppt,.pptx,.pdf,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation',
    helperText: 'PPT, PPTX or PDF · up to 100 MB',
    maxSize: 100 * 1024 * 1024,
    extensions: ['ppt', 'pptx', 'pdf'],
    mimeTypes: [
      'application/pdf',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
  },
  Video: {
    accept: '.mp4,.mov,.webm,video/mp4,video/quicktime,video/webm',
    helperText: 'MP4, MOV or WEBM · up to 500 MB',
    maxSize: 500 * 1024 * 1024,
    extensions: ['mp4', 'mov', 'webm'],
    mimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
  },
  'Revision notes': {
    accept:
      '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    helperText: 'PDF, DOC or DOCX · up to 50 MB',
    maxSize: 50 * 1024 * 1024,
    extensions: ['pdf', 'doc', 'docx'],
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  'Classroom activity': {
    accept:
      '.pdf,.ppt,.pptx,.docx,application/pdf,application/msword,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    helperText: 'PDF, PPT, PPTX or DOCX · up to 100 MB',
    maxSize: 100 * 1024 * 1024,
    extensions: ['pdf', 'ppt', 'pptx', 'docx'],
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
};

type ChapterContentType = 'Classroom presentation' | 'Teacher training presentation' | 'Revision notes' | 'Video' | 'PDF';
type ChapterContentSource = 'Gamma AI' | 'Uploaded';
type ChapterContentPreview = 'presentation' | 'notes' | 'video' | 'pdf';

interface ChapterContentItem {
  id: string;
  title: string;
  subtitle: string;
  chapterTitle: string;
  conceptTitle: string;
  type: ChapterContentType;
  source: ChapterContentSource;
  preview: ChapterContentPreview;
  actionLabel: 'Open' | 'Play';
  slideCount: number;
  statValue: string;
  updatedDate: string;
  updatedAt: string;
  slides: {
    id: string;
    number: number;
    title: string;
  }[];
}

interface ConceptIntelligenceDetails {
  domain: string;
  dok: string;
  topic: string;
  knowledge: string[];
  abilities: string[];
  skills: string[];
  misconceptions: string[];
  prerequisites: string[];
  learningOutcomes: string[];
  competencies: string[];
  learningObjectives: string[];
  teachingPedagogies: string[];
  realWorldApplications: string[];
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function getConceptIntelligence(chapter: Chapter, conceptTitle: string): ConceptIntelligenceDetails {
  const intel = getConceptIntelligenceData(chapter, conceptTitle);

  const abilitiesForConcept = intel.abilities.filter(
    (ability) => !ability.concept_name || ability.concept_name === conceptTitle
  );
  const dokEntry = intel.dok.find((entry) => entry.concept_name === conceptTitle) ?? intel.dok[0];

  const primaryVerb =
    abilitiesForConcept[0]?.verb ?? intel.blooms[0]?.level ?? 'Understand';
  const dokLabel = dokEntry?.level
    ? `DOK ${asText(dokEntry.level)} — Skills & concepts`
    : 'DOK 2 — Skills & concepts';

  const knowledge = (chapter.concepts ?? []).find((item) => item.title === conceptTitle)?.description
    ? [(chapter.concepts ?? []).find((item) => item.title === conceptTitle)?.description as string]
    : intel.knowledge;

  const abilities = abilitiesForConcept.map((item) => asText(item.ability)).filter(Boolean);
  const skills = intel.skills.map((item) => asText(item.skill)).filter(Boolean);
  const misconceptions = (intel.misconceptions ?? []).map((item) => asText(item?.misconception)).filter(Boolean);
  const prerequisites = (intel.prerequisites ?? []).map((item) => asText(item)).filter(Boolean);
  const learningOutcomes = (intel.learningOutcomes ?? []).map((item) => asText(item?.outcome)).filter(Boolean);
  const competencies = (intel.competencies ?? []).map((item) => asText(item?.competency)).filter(Boolean);
  const learningObjectives = (intel.learningObjectives ?? []).map((item) => asText(item?.objective)).filter(Boolean);
  const teachingPedagogies = (intel.pedagogy ?? []).map((item) => asText(item?.strategy)).filter(Boolean);
  const realWorldApplications = (intel.realWorld ?? []).map((item) => asText(item?.application)).filter(Boolean);

  return {
    domain: `Bloom · ${primaryVerb}`,
    dok: dokLabel,
    topic: chapter.title,
    knowledge,
    abilities,
    skills,
    misconceptions,
    prerequisites,
    learningOutcomes,
    competencies,
    learningObjectives,
    teachingPedagogies,
    realWorldApplications,
  };
}

function getCourseSectionLabel(courseId: string) {
  const numeric = Number(courseId.replace(/\D/g, '')) || 0;
  return numeric % 2 === 0 ? 'Section A' : 'Section B';
}

function getCourseGradeLabel(classGrade: string) {
  return `Grade ${classGrade.replace('Class', '').trim()}`;
}

function getCurriculumLabel() {
  return 'CBSE curriculum';
}

function getChapterWindow(chapterNumber: number) {
  const ranges = ['Apr W1-W3', 'Apr W4-May W2', 'Jun W3-Jul W3', 'Aug W1-Sep W2', 'Sep W3-Oct W4'];
  return ranges[(chapterNumber - 1) % ranges.length];
}

function buildTeacherResources(chapterTitle: string) {
  return [
    {
      id: 'tr-1',
      title: 'Mindmap',
      file: 'chemical-reactions-mindmap.pdf',
      type: 'PDF',
      mappedValues: [
        'Pedagogical Process / Instructor-led',
        'Material Type / Mindmap',
      ],
      updatedAt: 'Updated 2 days ago',
    },
    {
      id: 'tr-2',
      title: 'Teacher Training',
      file: 'teacher-training-module.pptx',
      type: 'PPT',
      mappedValues: [
        'Pedagogical Process / Guided practice',
        'Content Type / Training Deck',
      ],
      updatedAt: 'Updated 5 days ago',
    },
    {
      id: 'tr-3',
      title: `${chapterTitle} Notes`,
      file: 'chapter-reference-notes.docx',
      type: 'DOCX',
      mappedValues: [
        'Material Type / Reference Notes',
        'Learning Outcome / Chapter Reinforcement',
      ],
      updatedAt: 'Updated 1 week ago',
    },
  ];
}

function getCourseClassroomLabel(courseId: string, classGrade: string) {
  const sectionLabel = getCourseSectionLabel(courseId);
  const sectionSuffix = sectionLabel.split(' ').pop() ?? sectionLabel;
  return `${getCourseGradeLabel(classGrade)} ${sectionSuffix}`;
}

function getChapterContentType(index: number): ChapterContentType {
  const sequence: ChapterContentType[] = [
    'Classroom presentation',
    'Classroom presentation',
    'Teacher training presentation',
    'Video',
    'Revision notes',
    'PDF',
  ];

  return sequence[index % sequence.length];
}

function getChapterContentPreview(type: ChapterContentType): ChapterContentPreview {
  if (type === 'Video') return 'video';
  if (type === 'Revision notes') return 'notes';
  if (type === 'PDF') return 'pdf';
  return 'presentation';
}

function getChapterContentTitle(conceptTitle: string, type: ChapterContentType, chapterTitle: string) {
  switch (type) {
    case 'Teacher training presentation':
      return `Teaching ${conceptTitle.toLowerCase()} - misconceptions & strategies`;
    case 'Revision notes':
      return `${chapterTitle} - chapter revision notes`;
    case 'Video':
      return `${conceptTitle} demonstration`;
    case 'PDF':
      return `NCERT ${chapterTitle} - reference chapter`;
    default:
      return conceptTitle;
  }
}

function getChapterContentStat(type: ChapterContentType, index: number) {
  const slideCount = 14 + index * 2;

  if (type === 'Video') {
    return {
      slideCount,
      statValue: `${8 + (index % 4)}:${index % 2 === 0 ? '20' : '45'}`,
    };
  }

  if (type === 'Revision notes' || type === 'PDF') {
    return {
      slideCount,
      statValue: `${6 + index} pages`,
    };
  }

  return {
    slideCount,
    statValue: `${slideCount} slides`,
  };
}

function buildContentSlides(conceptTitle: string, chapterTitle: string, type: ChapterContentType, count: number) {
  const titles = [
    `Title - ${conceptTitle}`,
    "What you'll learn",
    `Key idea: ${conceptTitle}`,
    'Real-world example',
    'Worked example',
    'Quick activity',
    'Check your understanding',
    'Summary & recap',
  ];

  return Array.from({ length: Math.min(8, Math.max(4, count)) }, (_, index) => ({
    id: `${chapterTitle}-${conceptTitle}-${index + 1}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    number: index + 1,
    title: titles[index] ?? `${type} insight ${index + 1}`,
  }));
}

function buildChapterContentItems(
  course: { subject: string; classGrade: string; id: string },
  chapter: Chapter,
  chapterConcepts: ChapterKeyConceptGroup | null
): ChapterContentItem[] {
  const concepts = chapterConcepts?.concepts ?? [];
  const itemCount = Math.max(chapter.resources.hspContent, concepts.length || 1);
  const chapterLabel = `${course.subject} - ${chapter.title}`;
  const gradeLabel = getCourseClassroomLabel(course.id, course.classGrade);

  return Array.from({ length: itemCount }, (_, index) => {
    const concept = concepts[index % Math.max(concepts.length, 1)];
    const fallbackConcept = `${chapter.title} overview ${index + 1}`;
    const conceptTitle = concept?.title ?? fallbackConcept;
    const type = getChapterContentType(index);
    const source: ChapterContentSource = index % 3 === 0 ? 'Uploaded' : 'Gamma AI';
    const preview = getChapterContentPreview(type);
    const { slideCount, statValue } = getChapterContentStat(type, index);
    const updatedDate = `${28 - (index % 9)} Jun 2026`;

    return {
      id: `${chapter.id}-content-${index + 1}`,
      title: getChapterContentTitle(conceptTitle, type, chapter.title),
      subtitle: `${chapterLabel} - ${gradeLabel}`,
      chapterTitle: chapter.title,
      conceptTitle,
      type,
      source,
      preview,
      actionLabel: type === 'Video' ? 'Play' : 'Open',
      slideCount,
      statValue,
      updatedDate,
      updatedAt: `updated ${updatedDate}`,
      slides: buildContentSlides(conceptTitle, chapter.title, type, slideCount),
    };
  });
}

function getContentPreviewIcon(preview: ChapterContentPreview) {
  if (preview === 'video') {
    return Upload;
  }

  if (preview === 'notes' || preview === 'pdf') {
    return FileText;
  }

  return BookOpen;
}

export default function ChapterListPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const courseId = params.courseId as string;
  const expandedChapterParam = searchParams.get('expandedChapterId');

  const [subjectData, setSubjectData] = useState<SubjectWithChapters | null>(null);
  const [subjectLoading, setSubjectLoading] = useState(true);

  const courseIdParts = courseId.includes('-') ? courseId.split('-', 2) : [courseId];
  const subjectId = courseIdParts[0];
  const standardId = courseIdParts[1] ?? undefined;

  useEffect(() => {
    let cancelled = false;
    setSubjectLoading(true);
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
  }, [subjectId, standardId]);

  const staticCourse = courses.find((c) => c.id === courseId);
  const apiSubject = subjectData?.subject ?? null;
  const course: Course | undefined =
    staticCourse ??
    (apiSubject
      ? {
          id: courseId,
          title: apiSubject.subject_name,
          code: '',
          subject: apiSubject.subject_name,
          category: apiSubject.content_category,
          classGrade: `Class ${apiSubject.standard_name}`,
          status: 'Active',
          chapters: subjectData?.chapters.length ?? 0,
          enrollments: 0,
          progress: 0,
          instructor: '',
          createdAt: '',
          accentColor: '#5648E8',
          icon: 'book-open',
        }
      : undefined);
  const allChapters = subjectData?.chapters ?? getChaptersByCourseid(courseId);

  const [searchTerm] = useState('');
  const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [uploadChapter, setUploadChapter] = useState<Chapter | null>(null);
  const [conceptDrawer, setConceptDrawer] = useState<{
    chapter: Chapter;
    conceptTitle: string;
    conceptIndex: number;
  } | null>(null);
  const [isPresentationMenuOpen, setIsPresentationMenuOpen] = useState(false);
  const [isGeneratingPresentation, setIsGeneratingPresentation] = useState(false);
  const [isPresentationReady, setIsPresentationReady] = useState(false);
  const [isGeneratePresentationDrawerOpen, setIsGeneratePresentationDrawerOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState<'Classroom' | 'Teacher training'>('Classroom');
  const [presentationChapterId, setPresentationChapterId] = useState('');
  const [presentationConcept, setPresentationConcept] = useState('');
  const [presentationSlides, setPresentationSlides] = useState<string>(PRESENTATION_SLIDE_OPTIONS[2]);
  const [presentationTheme, setPresentationTheme] = useState<string>(GAMMA_THEME_OPTIONS[0]);
  const [presentationAudienceNotes, setPresentationAudienceNotes] = useState('');
  const [uploadContentType, setUploadContentType] = useState<(typeof UPLOAD_CONTENT_TYPES)[number]>(
    UPLOAD_CONTENT_TYPES[0]
  );
  const [uploadPresentationType, setUploadPresentationType] = useState<
    (typeof UPLOAD_PRESENTATION_TYPES)[number]
  >(UPLOAD_PRESENTATION_TYPES[0]);
  const [uploadChapterId, setUploadChapterId] = useState('');
  const [uploadConcept, setUploadConcept] = useState('all');
  const [uploadMethod, setUploadMethod] = useState<(typeof UPLOAD_METHOD_TABS)[number]>(
    UPLOAD_METHOD_TABS[0]
  );
  const [uploadLink, setUploadLink] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [chapterForm, setChapterForm] = useState(EMPTY_CHAPTER_FORM);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceMappingType, setResourceMappingType] = useState('');
  const [resourceMappingValue, setResourceMappingValue] = useState('');
  const [resourceFileType, setResourceFileType] = useState('');
  const [resourceSearch, setResourceSearch] = useState('');
  const [contentSearch, setContentSearch] = useState('');
  const [contentSourceFilter, setContentSourceFilter] = useState('all');
  const [selectedLibraryChapterId, setSelectedLibraryChapterId] = useState('');
  const [contentLibraryTab, setContentLibraryTab] =
    useState<(typeof CONTENT_LIBRARY_TABS)[number]>('All content');
  const [contentGroupBy, setContentGroupBy] =
    useState<'Chapter wise' | 'Concept wise'>('Chapter wise');
  const [selectedContentItem, setSelectedContentItem] = useState<ChapterContentItem | null>(null);
  const [questionModalConcept, setQuestionModalConcept] = useState<{
    chapter: Chapter;
    conceptTitle: string;
    conceptIndex: number;
  } | null>(null);
  const [questionType, setQuestionType] = useState('');
  const [totalQuestions, setTotalQuestions] = useState('');

  const view = searchParams.get('view');
  const activeChapterId = searchParams.get('chapterId') ?? '';
  const resourceChapter =
    allChapters.find((chapter) => chapter.id === activeChapterId) || allChapters[0] || null;
  const contentChapter = resourceChapter;
  const contentChapterConcepts =
    course && contentChapter ? getChapterKeyConcepts(course.id, contentChapter.id) : null;

  const activeLibraryChapter = useMemo(
    () => allChapters.find((chapter) => chapter.id === selectedLibraryChapterId) ?? contentChapter,
    [allChapters, contentChapter, selectedLibraryChapterId]
  );

  const activeLibraryChapterConcepts = useMemo(
    () =>
      course && activeLibraryChapter
        ? getChapterKeyConcepts(course.id, activeLibraryChapter.id)
        : null,
    [activeLibraryChapter, course]
  );
  const contentChapterConceptOptions = contentChapterConcepts?.concepts ?? [];

  const filteredChapters = useMemo(() => {
    return allChapters.filter((chapter) => {
      return chapter.title.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [allChapters, searchTerm]);

  const teacherResources = useMemo(
    () =>
      resourceChapter
        ? buildTeacherResources(resourceChapter.title)
        : [],
    [resourceChapter]
  );

  const filteredTeacherResources = useMemo(() => {
    return teacherResources.filter((resource) => {
      const haystack = [
        resource.title,
        resource.file,
        resource.type,
        resource.mappedValues.join(' '),
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch = haystack.includes(resourceSearch.toLowerCase());
      const matchesFileType = !resourceFileType || resource.type === resourceFileType;

      return matchesSearch && matchesFileType;
    });
  }, [resourceFileType, resourceSearch, teacherResources]);

  const chapterContentItems = useMemo(() => {
    if (!course || !activeLibraryChapter) return [];
    return buildChapterContentItems(course, activeLibraryChapter, activeLibraryChapterConcepts);
  }, [activeLibraryChapter, activeLibraryChapterConcepts, course]);

  const contentSourceOptions = useMemo(
    () => Array.from(new Set(chapterContentItems.map((item) => item.source))),
    [chapterContentItems]
  );

  const presentationConceptOptions = useMemo(() => {
    if (!presentationChapterId || !course) return [];
    return getChapterKeyConcepts(course.id, presentationChapterId)?.concepts ?? [];
  }, [course, presentationChapterId]);
  const uploadChapterOptions = useMemo(
    () => allChapters.map((chapter) => ({ id: chapter.id, title: chapter.title })),
    [allChapters]
  );
  const uploadSelectedChapter = useMemo(
    () => allChapters.find((chapter) => chapter.id === uploadChapterId) ?? uploadChapter,
    [allChapters, uploadChapter, uploadChapterId]
  );
  const uploadConceptOptions = useMemo(() => {
    if (!course || !uploadChapterId) return [];
    return getChapterKeyConcepts(course.id, uploadChapterId)?.concepts ?? [];
  }, [course, uploadChapterId]);
  const uploadTypeConfig = UPLOAD_TYPE_CONFIG[uploadContentType];
  const canSaveUploadContent =
    uploadMethod === 'Upload file' ? Boolean(uploadFile) : uploadLink.trim().length > 0;
  const totalQuestionsNumber = Number(totalQuestions);
  const isTotalQuestionsValid =
    totalQuestions.trim() !== '' &&
    Number.isInteger(totalQuestionsNumber) &&
    totalQuestionsNumber >= 1 &&
    totalQuestionsNumber <= 50;
  const canGenerateQuestions = questionType !== '' && isTotalQuestionsValid;

  useEffect(() => {
    if (!contentChapter) return;

    const hasMatchingChapter = allChapters.some((chapter) => chapter.id === selectedLibraryChapterId);
    if (!selectedLibraryChapterId || !hasMatchingChapter) {
      setSelectedLibraryChapterId(contentChapter.id);
    }
  }, [allChapters, contentChapter, selectedLibraryChapterId]);

  const filteredChapterContentItems = useMemo(() => {
    return chapterContentItems.filter((item) => {
      const matchesSearch =
        !contentSearch ||
        [item.title, item.subtitle, item.type, item.chapterTitle, item.source]
          .join(' ')
          .toLowerCase()
          .includes(contentSearch.toLowerCase());
      const matchesSource = contentSourceFilter === 'all' || item.source === contentSourceFilter;
      const matchesTab =
        contentLibraryTab === 'All content' ||
        (contentLibraryTab === 'Presentations' &&
          (item.type === 'Classroom presentation' || item.type === 'Teacher training presentation')) ||
        (contentLibraryTab === 'Videos' && item.type === 'Video') ||
        (contentLibraryTab === 'Revision notes' &&
          (item.type === 'Revision notes' || item.type === 'PDF')) ||
        (contentLibraryTab === 'Classroom activity' && item.type === 'Revision notes');

      return matchesSearch && matchesSource && matchesTab;
    });
  }, [
    chapterContentItems,
    contentLibraryTab,
    contentSearch,
    contentSourceFilter,
  ]);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const presentationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAnyModalOpen =
    isAddChapterOpen ||
    editingChapter !== null ||
    uploadChapter !== null ||
    conceptDrawer !== null ||
    selectedContentItem !== null ||
    isGeneratePresentationDrawerOpen ||
    questionModalConcept !== null;
  const expandedChapterId = view === 'teacher-resource' ? null : expandedChapterParam;

  useEffect(() => {
    if (!isAnyModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAddChapterOpen(false);
        setEditingChapter(null);
        setUploadChapter(null);
        setConceptDrawer(null);
        setIsPresentationMenuOpen(false);
        setIsGeneratingPresentation(false);
        setIsPresentationReady(false);
        setUploadContentType(UPLOAD_CONTENT_TYPES[0]);
        setUploadPresentationType(UPLOAD_PRESENTATION_TYPES[0]);
        setUploadChapterId('');
        setUploadConcept('all');
        setUploadMethod(UPLOAD_METHOD_TABS[0]);
        setUploadLink('');
        setUploadFile(null);
        setUploadError('');
        setIsDraggingUpload(false);
        setSelectedContentItem(null);
        setIsGeneratePresentationDrawerOpen(false);
        setQuestionModalConcept(null);
        setQuestionType('');
        setTotalQuestions('');
        if (presentationTimerRef.current) {
          clearTimeout(presentationTimerRef.current);
          presentationTimerRef.current = null;
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isAnyModalOpen]);

  useEffect(() => {
    return () => {
      if (presentationTimerRef.current) {
        clearTimeout(presentationTimerRef.current);
      }
    };
  }, []);

  const closeAddChapterModal = () => {
    setIsAddChapterOpen(false);
    setChapterForm(EMPTY_CHAPTER_FORM);
  };

  const closeUploadContentModal = () => {
    setUploadChapter(null);
    setUploadContentType(UPLOAD_CONTENT_TYPES[0]);
    setUploadPresentationType(UPLOAD_PRESENTATION_TYPES[0]);
    setUploadChapterId('');
    setUploadConcept('all');
    setUploadMethod(UPLOAD_METHOD_TABS[0]);
    setUploadLink('');
    setUploadFile(null);
    setUploadError('');
    setIsDraggingUpload(false);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  };

  const closeConceptDrawer = () => {
    setConceptDrawer(null);
    setIsPresentationMenuOpen(false);
    setIsGeneratingPresentation(false);
    setIsPresentationReady(false);
    if (presentationTimerRef.current) {
      clearTimeout(presentationTimerRef.current);
      presentationTimerRef.current = null;
    }
  };

  const closeEditChapterModal = () => {
    setEditingChapter(null);
    setChapterForm(EMPTY_CHAPTER_FORM);
  };

  const openUploadContentModal = (chapter: Chapter) => {
    setUploadChapter(chapter);
    setUploadContentType(UPLOAD_CONTENT_TYPES[0]);
    setUploadPresentationType(UPLOAD_PRESENTATION_TYPES[0]);
    setUploadChapterId(chapter.id);
    setUploadConcept('all');
    setUploadMethod(UPLOAD_METHOD_TABS[0]);
    setUploadLink('');
    setUploadFile(null);
    setUploadError('');
    setIsDraggingUpload(false);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  };

  const openConceptDrawer = (chapter: Chapter, conceptTitle: string, conceptIndex: number) => {
    setConceptDrawer({
      chapter,
      conceptTitle,
      conceptIndex,
    });
    setIsPresentationMenuOpen(false);
    setIsGeneratingPresentation(false);
    setIsPresentationReady(false);
    if (presentationTimerRef.current) {
      clearTimeout(presentationTimerRef.current);
      presentationTimerRef.current = null;
    }
  };

  const generateTeacherTrainingPresentation = () => {
    setIsPresentationMenuOpen(false);
    setIsPresentationReady(false);
    setIsGeneratingPresentation(true);

    if (presentationTimerRef.current) {
      clearTimeout(presentationTimerRef.current);
    }

    presentationTimerRef.current = setTimeout(() => {
      setIsGeneratingPresentation(false);
      setIsPresentationReady(true);
      presentationTimerRef.current = null;
    }, 1800);
  };

  const validateUploadFile = (file: File) => {
    const config = UPLOAD_TYPE_CONFIG[uploadContentType];
    const extension = file.name.split('.').pop()?.toLowerCase();
    const extensionAllowed = config.extensions.includes(extension ?? '');
    const mimeAllowed = file.type ? config.mimeTypes.includes(file.type) : false;

    if (!mimeAllowed && !extensionAllowed) {
      return `Only ${config.helperText.split(' · ')[0]} files are supported.`;
    }

    if (file.size > config.maxSize) {
      return `Each file must be ${Math.round(config.maxSize / (1024 * 1024))} MB or smaller.`;
    }

    return '';
  };

  const handleUploadFileSelection = (file: File | null) => {
    if (!file) return;

    const validationError = validateUploadFile(file);
    if (validationError) {
      setUploadError(validationError);
      setUploadFile(null);
      return;
    }

    setUploadFile(file);
    setUploadError('');
  };

  const saveUploadContent = () => {
    if (uploadMethod === 'Upload file') {
      if (!uploadFile) {
        setUploadError('Please select a file before saving.');
        return;
      }
    } else if (!uploadLink.trim()) {
      setUploadError('Please add a link before saving.');
      return;
    }

    closeUploadContentModal();
  };

  useEffect(() => {
    if (!uploadChapterId) return;

    const matchingConcept = uploadConceptOptions.find((concept) => concept.title === uploadConcept);
    if (!matchingConcept && uploadConcept !== 'all') {
      setUploadConcept('all');
    }
  }, [uploadChapterId, uploadConcept, uploadConceptOptions]);

  useEffect(() => {
    setUploadError('');
    setUploadFile(null);
    setIsDraggingUpload(false);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  }, [uploadContentType, uploadMethod]);

  const updateExpandedChapter = (chapterId: string | null) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (chapterId) {
      nextParams.set('expandedChapterId', chapterId);
    } else {
      nextParams.delete('expandedChapterId');
    }

    const nextQuery = nextParams.toString();
    router.replace(`/course-master/${courseId}/chapters${nextQuery ? `?${nextQuery}` : ''}`);
  };

  const openChapterContentView = (chapter: Chapter) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('view', 'content');
    nextParams.set('chapterId', chapter.id);
    nextParams.set('expandedChapterId', chapter.id);

    router.push(`/course-master/${courseId}/chapters?${nextParams.toString()}`);
  };

  const closeContentDrawer = () => {
    setSelectedContentItem(null);
  };

  const openGenerateQuestionsModal = (chapter: Chapter, conceptTitle: string, conceptIndex: number) => {
    setQuestionModalConcept({
      chapter,
      conceptTitle,
      conceptIndex,
    });
    setQuestionType('');
    setTotalQuestions('');
  };

  const closeGenerateQuestionsModal = () => {
    setQuestionModalConcept(null);
    setQuestionType('');
    setTotalQuestions('');
  };

  const openGeneratePresentationDrawer = () => {
    setPresentationMode('Classroom');
    setPresentationChapterId(activeLibraryChapter?.id ?? contentChapter?.id ?? '');
    setPresentationConcept(activeLibraryChapterConcepts?.concepts[0]?.title ?? '');
    setPresentationSlides(PRESENTATION_SLIDE_OPTIONS[2]);
    setPresentationTheme(GAMMA_THEME_OPTIONS[0]);
    setPresentationAudienceNotes('');
    setIsGeneratePresentationDrawerOpen(true);
  };

  const closeGeneratePresentationDrawer = () => {
    setIsGeneratePresentationDrawerOpen(false);
  };

  useEffect(() => {
    if (!presentationChapterId) return;

    const matchingConcept = presentationConceptOptions.find(
      (concept) => concept.title === presentationConcept
    );

    if (!matchingConcept) {
      setPresentationConcept(presentationConceptOptions[0]?.title ?? '');
    }
  }, [presentationChapterId, presentationConcept, presentationConceptOptions]);

  const uploadContentModal = uploadChapter ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-[2px]"
      onClick={closeUploadContentModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-content-title"
        className="relative w-full max-w-[736px] rounded-[20px] border border-white/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="upload-content-title" className="text-[24px] font-bold tracking-tight text-slate-950">
                Upload content
              </h2>
              <p className="mt-1 text-[15px] text-slate-600">
                Add presentations, videos, revision notes or classroom activities to the library
              </p>
            </div>
            <button
              type="button"
              onClick={closeUploadContentModal}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-5 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Content Type <span className="text-rose-500">*</span>
                </Label>
                <Select
                  value={uploadContentType}
                  onValueChange={(value) =>
                    setUploadContentType(value as (typeof UPLOAD_CONTENT_TYPES)[number])
                  }
                >
                  <SelectTrigger className="h-11 rounded-[10px] border-slate-300 px-4 text-[15px] text-slate-900 shadow-none">
                    <SelectValue placeholder="Select content type" />
                  </SelectTrigger>
                  <SelectContent>
                    {UPLOAD_CONTENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Presentation Type
                </Label>
                <Select
                  value={uploadPresentationType}
                  onValueChange={(value) =>
                    setUploadPresentationType(value as (typeof UPLOAD_PRESENTATION_TYPES)[number])
                  }
                >
                  <SelectTrigger className="h-11 rounded-[10px] border-slate-300 px-4 text-[15px] text-slate-900 shadow-none">
                    <SelectValue placeholder="Select presentation type" />
                  </SelectTrigger>
                  <SelectContent>
                    {UPLOAD_PRESENTATION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Chapter <span className="text-rose-500">*</span>
                </Label>
                <Select value={uploadChapterId} onValueChange={(value) => setUploadChapterId(value ?? '')}>
                  <SelectTrigger className="h-11 rounded-[10px] border-slate-300 px-4 text-[15px] text-slate-900 shadow-none">
                    <SelectValue placeholder="Select chapter" />
                  </SelectTrigger>
                  <SelectContent>
                    {uploadChapterOptions.map((chapter) => (
                      <SelectItem key={chapter.id} value={chapter.id}>
                        {chapter.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Concept
                </Label>
                <Select value={uploadConcept} onValueChange={(value) => setUploadConcept(value ?? 'all')}>
                  <SelectTrigger className="h-11 rounded-[10px] border-slate-300 px-4 text-[15px] text-slate-900 shadow-none">
                    <SelectValue placeholder="Select concept" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All concepts</SelectItem>
                    {uploadConceptOptions.map((concept) => (
                      <SelectItem key={concept.title} value={concept.title}>
                        {concept.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-[12px] bg-[#eef3fb] p-1">
              <div className="inline-flex gap-1">
                {UPLOAD_METHOD_TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setUploadMethod(tab);
                      setUploadError('');
                    }}
                    className={cn(
                      'rounded-[10px] px-4 py-2 text-[15px] font-semibold transition-colors',
                      uploadMethod === tab
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <input
              ref={uploadInputRef}
              type="file"
              accept={uploadTypeConfig.accept}
              className="hidden"
              onChange={(event) => handleUploadFileSelection(event.target.files?.[0] ?? null)}
            />

            {uploadMethod === 'Upload file' ? (
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDraggingUpload(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDraggingUpload(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDraggingUpload(false);
                  handleUploadFileSelection(event.dataTransfer.files?.[0] ?? null);
                }}
                className={cn(
                  'flex min-h-[172px] w-full flex-col items-center justify-center rounded-[14px] border border-dashed px-6 py-8 text-center transition-colors',
                  isDraggingUpload
                    ? 'border-[#8b85ff] bg-[#f4f3ff]'
                    : 'border-[#d4dcf0] bg-[#f8fbff] hover:border-[#b9c6eb] hover:bg-[#f5f8ff]'
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200/80">
                  <Upload size={22} />
                </div>
                <p className="mt-5 text-[14px] text-slate-600">
                  <span className="font-semibold text-[#4f46e5]">Click to upload</span> or drag and drop
                </p>
                <p className="mt-2 text-sm text-slate-500">{uploadTypeConfig.helperText}</p>
                {uploadFile && (
                  <p className="mt-4 rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200/70">
                    {uploadFile.name}
                  </p>
                )}
              </button>
            ) : (
              <div className="rounded-[14px] border border-slate-200 bg-[#f8fbff] p-5">
                <Label htmlFor="upload-content-link" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Content Link
                </Label>
                <div className="mt-3 flex items-center gap-3 rounded-[12px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <Link2 size={18} className="text-slate-400" />
                  <Input
                    id="upload-content-link"
                    value={uploadLink}
                    onChange={(event) => {
                      setUploadLink(event.target.value);
                      setUploadError('');
                    }}
                    placeholder="Paste a content link"
                    className="h-auto border-0 p-0 text-[15px] text-slate-900 shadow-none focus-visible:ring-0"
                  />
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  Add a shareable link for {uploadSelectedChapter?.title ?? 'this chapter'} content.
                </p>
              </div>
            )}

            {uploadError && <p className="text-sm font-medium text-rose-600">{uploadError}</p>}
          </div>

          <div className="mt-6 flex items-center justify-end gap-4 border-t border-slate-200/80 pt-4">
            <button
              type="button"
              onClick={closeUploadContentModal}
              className="text-[15px] font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Cancel
            </button>
            <Button
              type="button"
              onClick={saveUploadContent}
              disabled={!canSaveUploadContent}
              className="h-10 rounded-xl bg-[#aea8ff] px-5 text-[15px] font-semibold text-white shadow-[0_8px_18px_rgba(99,91,255,0.28)] hover:bg-[#978fff] disabled:bg-[#d7d2ff] disabled:text-white/85 disabled:shadow-none"
            >
              <Upload size={16} className="mr-2" />
              Save content
            </Button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const generateQuestionsModal = questionModalConcept ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-[2px]"
      onClick={closeGenerateQuestionsModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-ai-questions-title"
        className="relative w-full max-w-[800px] rounded-[20px] border border-white/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-6 pb-6 pt-6 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="generate-ai-questions-title"
                className="text-[24px] font-bold tracking-tight text-slate-950"
              >
                Generate AI questions
              </h2>
              <p className="mt-1 text-[15px] text-slate-600">
                Concept: {questionModalConcept.conceptTitle}
              </p>
            </div>
            <button
              type="button"
              onClick={closeGenerateQuestionsModal}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Question Type <span className="text-rose-500">*</span>
              </Label>
              <Select value={questionType} onValueChange={(value) => setQuestionType(value ?? '')}>
                <SelectTrigger className="h-12 rounded-[10px] border-slate-300 px-4 text-[15px] text-slate-900 shadow-none">
                  <SelectValue placeholder="Select question type" />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="total-questions" className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Total Questions <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="total-questions"
                inputMode="numeric"
                value={totalQuestions}
                onChange={(event) => setTotalQuestions(event.target.value.replace(/[^\d]/g, ''))}
                placeholder="Enter a number"
                className="h-12 rounded-[10px] border-slate-300 px-4 text-[15px] text-slate-900 shadow-none"
              />
              <p className="text-sm text-slate-500">Between 1 and 50</p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-4 border-t border-slate-200/80 pt-4">
            <button
              type="button"
              onClick={closeGenerateQuestionsModal}
              className="text-[15px] font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Cancel
            </button>
            <Button
              type="button"
              disabled={!canGenerateQuestions}
              className="h-10 rounded-xl bg-[#aea8ff] px-5 text-[15px] font-semibold text-white shadow-[0_8px_18px_rgba(99,91,255,0.28)] hover:bg-[#978fff] disabled:bg-[#d7d2ff] disabled:text-white/85 disabled:shadow-none"
            >
              <Sparkles size={16} className="mr-2" />
              Generate questions
            </Button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const generatePresentationDrawer = (
    <div
      className={cn(
        'fixed inset-0 z-50 transition-all duration-300',
        isGeneratePresentationDrawerOpen ? 'pointer-events-auto' : 'pointer-events-none'
      )}
    >
      <div
        className={cn(
          'absolute inset-0 bg-slate-950/45 transition-opacity duration-300',
          isGeneratePresentationDrawerOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={closeGeneratePresentationDrawer}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-presentation-title"
        className={cn(
          'absolute right-0 top-0 flex h-full w-full max-w-[700px] flex-col overflow-hidden rounded-l-[28px] border-l border-slate-200/80 bg-white shadow-[-24px_0_70px_rgba(15,23,42,0.18)] transition-transform duration-300',
          isGeneratePresentationDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-5 py-5 sm:px-6">
          <div>
            <h2 id="generate-presentation-title" className="text-[18px] font-bold tracking-tight text-slate-950 sm:text-[20px]">
              Generate presentation
            </h2>
          </div>
          <button
            type="button"
            onClick={closeGeneratePresentationDrawer}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-slate-600 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#4f46e5] ring-1 ring-slate-200/80">
                <Sparkles size={16} />
              </div>
              <p className="text-[15px] leading-7">
                Slides are drafted with <span className="font-semibold text-slate-900">Gamma</span> from concept intelligence, then added to your content library.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-100/90 p-1">
            <div className="grid grid-cols-2 gap-1">
              {(['Classroom', 'Teacher training'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPresentationMode(mode)}
                  className={cn(
                    'rounded-xl px-4 py-3 text-left text-[15px] font-semibold transition-colors',
                    presentationMode === mode
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Chapter
              </Label>
              <Select value={presentationChapterId} onValueChange={(value) => setPresentationChapterId(value ?? '')}>
                <SelectTrigger className="h-12 rounded-xl border-slate-300 px-4 text-[15px] text-slate-900 shadow-none">
                  <SelectValue placeholder="Select chapter" />
                </SelectTrigger>
                <SelectContent>
                  {allChapters.map((chapter) => (
                    <SelectItem key={chapter.id} value={chapter.id}>
                      {chapter.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Concept
              </Label>
              <Select value={presentationConcept} onValueChange={(value) => setPresentationConcept(value ?? '')}>
                <SelectTrigger className="h-12 rounded-xl border-slate-300 px-4 text-[15px] text-slate-900 shadow-none">
                  <SelectValue placeholder="Select concept" />
                </SelectTrigger>
                <SelectContent>
                  {presentationConceptOptions.map((concept) => (
                    <SelectItem key={concept.title} value={concept.title}>
                      {concept.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Slides
              </Label>
              <Select value={presentationSlides} onValueChange={(value) => setPresentationSlides(value ?? '')}>
                <SelectTrigger className="h-12 rounded-xl border-slate-300 px-4 text-[15px] text-slate-900 shadow-none">
                  <SelectValue placeholder="Select slide count" />
                </SelectTrigger>
                <SelectContent>
                  {PRESENTATION_SLIDE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Gamma Theme
              </Label>
              <Select value={presentationTheme} onValueChange={(value) => setPresentationTheme(value ?? '')}>
                <SelectTrigger className="h-12 rounded-xl border-slate-300 px-4 text-[15px] text-slate-900 shadow-none">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  {GAMMA_THEME_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Audience Notes (Optional)
            </Label>
            <Textarea
              value={presentationAudienceNotes}
              onChange={(event) => setPresentationAudienceNotes(event.target.value)}
              placeholder="e.g. keep language simple, add two local examples"
              className="min-h-[108px] rounded-2xl border-slate-300 px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 border-t border-slate-200/80 px-5 py-5 sm:px-6">
          <button
            type="button"
            onClick={closeGeneratePresentationDrawer}
            className="text-[15px] font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            Cancel
          </button>
          <Button
            type="button"
            onClick={closeGeneratePresentationDrawer}
            className="h-12 rounded-2xl bg-[#4f46e5] px-6 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,0.28)] hover:bg-[#4338ca]"
          >
            <Sparkles size={16} className="mr-2" />
            Generate with Gamma
          </Button>
        </div>
      </aside>
    </div>
  );

  if (subjectLoading && !course) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C8D3E3] border-t-[#5648E8]" />
          <p className="text-sm font-medium text-slate-500">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-10">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Course not found</h2>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 font-semibold"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (view === 'teacher-resource' && resourceChapter) {
    const mappingValueOptions =
      resourceMappingType === 'Pedagogical Process'
        ? ['Instructor-led', 'Guided practice', 'Independent reinforcement']
        : resourceMappingType === 'Material Type'
          ? [...RESOURCE_MATERIAL_TYPES]
          : ['Chapter Reinforcement', 'Concept Mastery', 'Assessment Readiness'];

    return (
      <div className="min-h-full">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => router.push(`/course-master/${course.id}/chapters`)}
                className="font-medium text-slate-500 transition-colors hover:text-slate-900"
              >
                LMS
              </button>
              <ChevronRight size={14} className="text-slate-400" />
              <span className="font-medium text-slate-500">{course.subject}</span>
              <ChevronRight size={14} className="text-slate-400" />
              <span className="font-medium text-slate-500">{resourceChapter.title}</span>
              <ChevronRight size={14} className="text-slate-400" />
              <span className="font-semibold text-blue-600">Teacher Resources</span>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                  <Sparkles size={13} />
                  Resource Studio
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Teacher Resources</h1>
                <p className="mt-2 text-slate-600">
                  Curate supporting assets for <span className="font-semibold text-slate-900">{resourceChapter.title}</span> with a cleaner upload flow and a professional resource library.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/course-master/${course.id}/chapters`)}
                  className="h-11 rounded-2xl border-slate-200 bg-white px-5 font-semibold text-slate-700"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Back to Chapters
                </Button>
                <Button
                  type="button"
                  className="h-11 rounded-2xl bg-slate-900 px-5 font-semibold text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800"
                >
                  <Download size={16} className="mr-2" />
                  Export List
                </Button>
              </div>
            </div>
          </div>

          <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Teacher Assets</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{resourceChapter.resources.teacherResource}</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Link2 size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Mapped Values</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{filteredTeacherResources.length * 2}</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Active Files</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{teacherResources.length}</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                  <Upload size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Chapter Code</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{course.code}-{resourceChapter.number}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8 rounded-[28px] border border-slate-200/70 bg-white shadow-sm">
            <div className="border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.05),_transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] px-6 py-5 sm:px-8">
              <h2 className="text-xl font-bold text-slate-900">Add Teacher Resource</h2>
              <p className="mt-1 text-sm text-slate-500">Upload files, tag them to the right pedagogy, and keep instructor materials easy to discover.</p>
            </div>

            <div className="grid gap-8 px-6 py-6 sm:px-8 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="resource-title" className="text-sm font-medium text-slate-700">
                    Title
                  </Label>
                  <Input
                    id="resource-title"
                    value={resourceTitle}
                    onChange={(event) => setResourceTitle(event.target.value)}
                    placeholder="Enter resource title"
                    className="h-12 rounded-2xl border-slate-200 bg-slate-50/70 px-4 text-slate-900 focus-visible:bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resource-file" className="text-sm font-medium text-slate-700">
                    Resource File
                  </Label>
                  <div className="flex h-12 items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 transition hover:border-blue-300 hover:bg-white">
                    <input
                      id="resource-file"
                      type="file"
                      className="w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Mapping Type</Label>
                  <Select value={resourceMappingType} onValueChange={(val) => setResourceMappingType(val ?? '')}>
                    <SelectTrigger variant="soft" size="lg">
                      <SelectValue placeholder="Select mapping type" />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOURCE_MAPPING_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Mapping Value</Label>
                  <Select value={resourceMappingValue} onValueChange={(val) => setResourceMappingValue(val ?? '')}>
                    <SelectTrigger variant="soft" size="lg">
                      <SelectValue placeholder="Select mapping value" />
                    </SelectTrigger>
                    <SelectContent>
                      {mappingValueOptions.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    type="button"
                    className="h-11 rounded-2xl bg-cyan-500 px-5 font-semibold text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-600"
                  >
                    <Plus size={16} className="mr-2" />
                    Save Resource
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-2xl border-slate-200 bg-white px-5 font-semibold text-slate-700"
                  >
                    Save and Add Another
                  </Button>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200/70 bg-slate-50/70 p-5">
                <h3 className="text-base font-semibold text-slate-900">Chapter Mapping Summary</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Chapter</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{resourceChapter.title}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Recommended Focus</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {['Mindmap', 'Reference Notes', 'Assessment Aid'].map((method) => (
                        <Badge key={method} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          {method}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Teacher Resource Target</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Aim to keep at least {resourceChapter.resources.teacherResource} curated assets available for instructors in this chapter.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200/70 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200/80 px-6 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Resource Library</h2>
                <p className="mt-1 text-sm text-slate-500">Review uploaded files, mapped values, and quick actions for this chapter.</p>
              </div>

              <div className="flex flex-wrap gap-3">
                {['PDF', 'CSV', 'Excel', 'Print'].map((action) => (
                  <Button
                    key={action}
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                  >
                    {action}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4 px-6 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full max-w-md">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={resourceSearch}
                  onChange={(event) => setResourceSearch(event.target.value)}
                  placeholder="Search title, file, type, or mapped values"
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50/70 pl-11 text-slate-900 focus-visible:bg-white"
                />
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                <Select value={resourceFileType} onValueChange={(val) => setResourceFileType(val ?? '')}>
                  <SelectTrigger variant="soft" className="min-w-[180px]">
                    <SelectValue placeholder="Filter by file type" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {RESOURCE_FILE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setResourceSearch('');
                    setResourceFileType('');
                  }}
                  className="h-10 rounded-xl border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                >
                  Clear Filters
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="min-w-[80px] font-semibold text-slate-700">Sr No</TableHead>
                    <TableHead className="min-w-[240px] font-semibold text-slate-700">Chapter Name</TableHead>
                    <TableHead className="min-w-[180px] font-semibold text-slate-700">Title</TableHead>
                    <TableHead className="min-w-[180px] font-semibold text-slate-700">File</TableHead>
                    <TableHead className="min-w-[300px] font-semibold text-slate-700">Mapped Values</TableHead>
                    <TableHead className="min-w-[140px] font-semibold text-slate-700">Updated</TableHead>
                    <TableHead className="min-w-[130px] text-right font-semibold text-slate-700">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeacherResources.map((resource, index) => (
                    <TableRow key={resource.id} className="hover:bg-slate-50/60">
                      <TableCell className="font-medium text-slate-800">{index + 1}</TableCell>
                      <TableCell className="font-medium text-slate-900">{resourceChapter.title}</TableCell>
                      <TableCell className="text-slate-700">{resource.title}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="font-medium text-blue-600 transition-colors hover:text-blue-700"
                        >
                          View {resource.file}
                        </button>
                        <div className="mt-1 text-xs text-slate-400">{resource.type}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {resource.mappedValues.map((value) => (
                            <Badge
                              key={value}
                              className={cn(
                                'rounded-full border px-3 py-1 text-xs font-semibold',
                                value.startsWith('Pedagogical Process')
                                  ? 'border-cyan-100 bg-cyan-50 text-cyan-700'
                                  : 'border-slate-200 bg-slate-100 text-slate-700'
                              )}
                            >
                              {value}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{resource.updatedAt}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'content' && contentChapter) {
    const gradeLabel = getCourseClassroomLabel(course.id, course.classGrade);
    const totalItems = chapterContentItems.length;
    const gammaItems = chapterContentItems.filter((item) => item.source === 'Gamma AI').length;
    const uploadedItems = chapterContentItems.filter((item) => item.source === 'Uploaded').length;
    const sourceLabel = contentSourceFilter === 'all' ? 'All sources' : contentSourceFilter;
    const activeChapterTitle = activeLibraryChapter?.title ?? contentChapter.title;

    return (
      <div className="min-h-full">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => router.push(`/course-master/${course.id}/chapters`)}
                className="font-medium text-slate-500 transition-colors hover:text-slate-900"
              >
                Teach / learn
              </button>
              <ChevronRight size={14} className="text-slate-400" />
              <span className="font-medium text-slate-500">
                {course.subject} - {gradeLabel}
              </span>
              <ChevronRight size={14} className="text-slate-400" />
              <span className="font-semibold text-[#4f46e5]">Content</span>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  Content - {course.subject} - {gradeLabel}
                </h1>
                <p className="mt-2 text-slate-600">
                  Generate presentations with Gamma, upload videos, notes and PDFs, and manage the content library for{' '}
                  <span className="font-semibold text-slate-900">{activeChapterTitle}</span>.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={openGeneratePresentationDrawer}
                  className="h-11 rounded-2xl bg-[#4f46e5] px-5 font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,0.28)] hover:bg-[#4338ca]"
                >
                  <Sparkles size={16} className="mr-2" />
                  Generate presentation
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => openUploadContentModal(activeLibraryChapter ?? contentChapter)}
                  className="h-11 rounded-2xl border-slate-200 bg-white px-5 font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <Upload size={16} className="mr-2" />
                  Upload content
                </Button>
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm sm:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-3 xl:flex-nowrap">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-500">
                  <BookOpen size={17} />
                </div>
                <p className="shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Viewing Chapter
                </p>
                <div className="min-w-0 w-full max-w-[320px] shrink">
                  <Select value={selectedLibraryChapterId} onValueChange={(value) => setSelectedLibraryChapterId(value ?? '')}>
                    <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white px-4 text-[15px] font-medium text-slate-900 shadow-sm">
                      <span className="truncate">{activeChapterTitle}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {allChapters.map((chapter) => (
                        <SelectItem key={chapter.id} value={chapter.id}>
                          {chapter.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="shrink-0 whitespace-nowrap text-sm text-slate-500">
                  {filteredChapterContentItems.length} items in {activeChapterTitle}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 xl:justify-end">
                <p className="shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Group By
                </p>
                <div className="inline-flex rounded-2xl bg-slate-100/90 p-1">
                  {(['Chapter wise', 'Concept wise'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setContentGroupBy(option)}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                        contentGroupBy === option
                          ? 'bg-white text-[#4f46e5] shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-600">Content items</p>
                  <p className="mt-3 text-4xl font-bold tracking-tight text-slate-950">{totalItems}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
                  <FolderOpen size={18} />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-600">Generated with Gamma</p>
                  <p className="mt-3 text-4xl font-bold tracking-tight text-slate-950">{gammaItems}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
                  <Sparkles size={18} />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-600">Uploaded</p>
                  <p className="mt-3 text-4xl font-bold tracking-tight text-slate-950">{uploadedItems}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
                  <Upload size={18} />
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 border-b border-slate-200/80">
            <div className="flex flex-wrap items-center gap-6 text-[15px]">
              {CONTENT_LIBRARY_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setContentLibraryTab(tab)}
                  className={`inline-flex items-center border-b-2 px-1 py-3 font-medium transition-colors ${
                    contentLibraryTab === tab
                      ? 'border-[#4f46e5] text-[#4f46e5]'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
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

            <Select value={contentSourceFilter} onValueChange={(value) => setContentSourceFilter(value ?? '')}>
              <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white text-slate-700 shadow-sm lg:w-[190px]">
                <SelectValue>{sourceLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {contentSourceOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="mb-5 text-sm text-slate-500">
            {filteredChapterContentItems.length} items in {activeChapterTitle}
          </p>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {filteredChapterContentItems.map((item) => {
              const PreviewIcon = getContentPreviewIcon(item.preview);

              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_6px_22px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex h-[132px] items-start justify-between border-b border-slate-200/70 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-3">
                    <span className="inline-flex rounded-full bg-[#eef2ff] px-2.5 py-1 text-[11px] font-semibold text-[#4f46e5]">
                      {item.type}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      {item.source === 'Gamma AI' ? <Sparkles size={12} className="text-[#4f46e5]" /> : <Upload size={12} />}
                      {item.source}
                    </span>
                  </div>

                  <div className="-mt-[74px] flex justify-center px-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#dbe3ff] bg-white text-[#4f46e5] shadow-sm">
                      <PreviewIcon size={28} />
                    </div>
                  </div>

                  <div className="px-4 pb-4 pt-3">
                    <div className="mb-3 rounded-full bg-[#eef4ff] px-3 py-1 text-[11px] font-medium text-[#4f46e5]">
                      {item.chapterTitle}
                    </div>
                    <h3 className="text-[19px] font-semibold leading-7 text-slate-950">{item.title}</h3>
                    <p className="mt-2 min-h-[44px] text-sm leading-6 text-slate-600">{item.subtitle}</p>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-200/80 pt-4">
                      <p className="text-xs text-slate-500">
                        {item.statValue} - {item.updatedAt}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setSelectedContentItem(item)}
                        className="h-9 rounded-full bg-[#eef2ff] px-4 text-sm font-semibold text-[#4f46e5] hover:bg-[#e3e9ff] hover:text-[#4338ca]"
                      >
                        {item.actionLabel === 'Play' ? (
                          <Play size={14} className="mr-2" />
                        ) : (
                          <Eye size={14} className="mr-2" />
                        )}
                        {item.actionLabel}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div
            className={cn(
              'fixed inset-0 z-50 transition-all duration-300',
              selectedContentItem ? 'pointer-events-auto' : 'pointer-events-none'
            )}
          >
            <div
              className={cn(
                'absolute inset-0 bg-slate-950/45 transition-opacity duration-300',
                selectedContentItem ? 'opacity-100' : 'opacity-0'
              )}
              onClick={closeContentDrawer}
            />

            <aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="content-detail-title"
              className={cn(
                'absolute right-0 top-0 flex h-full w-full max-w-[700px] flex-col overflow-hidden rounded-l-[28px] border-l border-slate-200/80 bg-white shadow-[-24px_0_70px_rgba(15,23,42,0.18)] transition-transform duration-300',
                selectedContentItem ? 'translate-x-0' : 'translate-x-full'
              )}
            >
              {selectedContentItem ? (
                <>
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-5 py-5 sm:px-6">
                    <div>
                      <h2 id="content-detail-title" className="text-[18px] font-bold tracking-tight text-slate-950 sm:text-[20px]">
                        {selectedContentItem.title}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={closeContentDrawer}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Close drawer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                    {(() => {
                      const isVideoContent = selectedContentItem.preview === 'video';

                      return (
                        <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-medium text-[#3157ff] hover:bg-[#eef2ff]">
                        {selectedContentItem.type}
                      </Badge>
                      <Badge className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-medium text-[#3157ff] hover:bg-[#eef2ff]">
                        {selectedContentItem.source === 'Gamma AI' ? (
                          <Sparkles size={12} className="mr-1.5" />
                        ) : (
                          <Upload size={12} className="mr-1.5" />
                        )}
                        {selectedContentItem.source}
                      </Badge>
                    </div>

                    <dl className="mt-6 grid gap-y-4 text-sm sm:grid-cols-[124px_minmax(0,1fr)] sm:gap-x-5">
                      <dt className="text-slate-500">Chapter</dt>
                      <dd className="font-medium text-slate-900">{selectedContentItem.chapterTitle}</dd>
                      <dt className="text-slate-500">Concept</dt>
                      <dd className="font-medium text-slate-900">{selectedContentItem.conceptTitle}</dd>
                      <dt className="text-slate-500">Format</dt>
                      <dd className="font-medium text-slate-900">{selectedContentItem.type}</dd>
                      <dt className="text-slate-500">Source</dt>
                      <dd className="font-medium text-slate-900">{selectedContentItem.source}</dd>
                      <dt className="text-slate-500">{isVideoContent ? 'Duration' : 'Slides'}</dt>
                      <dd className="font-medium text-slate-900">
                        {isVideoContent ? selectedContentItem.statValue : selectedContentItem.slideCount}
                      </dd>
                      <dt className="text-slate-500">Updated</dt>
                      <dd className="font-medium text-slate-900">{selectedContentItem.updatedDate}</dd>
                    </dl>

                    {isVideoContent ? (
                      <section className="mt-8">
                        <div className="rounded-2xl border border-[#d9e3f1] bg-[linear-gradient(180deg,#f8fbff_0%,#eef4fb_100%)] px-6 py-12 shadow-[0_2px_10px_rgba(15,23,42,0.03)]">
                          <div className="flex flex-col items-center justify-center text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#c9d7f2] bg-white text-slate-500 shadow-sm">
                              <Play size={24} className="ml-0.5 text-slate-500" />
                            </div>
                            <p className="mt-4 text-sm font-medium text-slate-500">
                              Video preview placeholder - {selectedContentItem.statValue}
                            </p>
                          </div>
                        </div>
                      </section>
                    ) : (
                      <section className="mt-8">
                        <div className="mb-4 border-b border-slate-200/80 pb-3">
                          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Slides</h3>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          {selectedContentItem.slides.map((slide) => (
                            <article
                              key={slide.id}
                              className="rounded-xl border border-[#d9e3f1] bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.03)]"
                            >
                              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                                Slide {slide.number}
                              </p>
                              <h4 className="mt-2 min-h-[40px] text-[13px] font-semibold leading-5 text-slate-900">
                                {slide.title}
                              </h4>
                              <div className="mt-6 space-y-2">
                                <div className="h-1.5 w-full rounded-full bg-slate-100" />
                                <div className="h-1.5 w-[78%] rounded-full bg-slate-100" />
                                <div className="h-1.5 w-[56%] rounded-full bg-slate-100" />
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                    )}
                        </>
                      );
                    })()}
                  </div>
                </>
              ) : null}
            </aside>
          </div>
          {uploadContentModal}
          {generateQuestionsModal}
          {generatePresentationDrawer}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E9EEF7] rounded-t-3xl">
      <div className="mx-auto w-full max-w-[1460px] px-4 py-7 sm:px-6 lg:px-8 ">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/course-master')}
              className="font-medium transition-colors hover:text-slate-900"
            >
              Teach / learn
            </button>
            <ChevronRight size={14} className="text-slate-400" />
            <button
              type="button"
              onClick={() => router.push('/course-master')}
              className="font-medium transition-colors hover:text-slate-900"
            >
              Subjects
            </button>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="font-semibold text-slate-900">
              {course.subject} - {getCourseGradeLabel(course.classGrade).replace('Grade ', 'Grade ')}{' '}
              {getCourseSectionLabel(course.id).replace('Section ', '')}
            </span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-medium text-[#4f46e5] shadow-sm ring-1 ring-white/80">
            <BookOpen size={14} />
            248 questions in bank
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#4f46e5] shadow-sm ring-1 ring-slate-200/70">
              <GraduationCap size={24} />
            </div>
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-slate-950">
                {course.subject} - {getCourseGradeLabel(course.classGrade)} - {getCourseSectionLabel(course.id)}
              </h1>
              <p className="mt-1 text-[15px] text-slate-600">
                {allChapters.length} chapters -{' '}
                {allChapters.reduce((total, chapter) => {
                  const chapterConcepts = getChapterKeyConcepts(course.id, chapter.id);
                  return total + (chapterConcepts?.count ?? 0);
                }, 0)}{' '}
                key concepts - {getCurriculumLabel()}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 border-b border-slate-200/80">
          <div className="flex flex-wrap items-center gap-6 text-[15px]">
            <button
              type="button"
              onClick={() => router.push(`/course-master/lesson-plan/${course.id}`)}
              className="inline-flex items-center gap-2 border-b-2 border-transparent px-1 py-3 font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              <BookOpen size={16} />
              Lesson plans
            </button>
            <button
              type="button"
              onClick={() => router.push(`/course-master/lesson-plan/${course.id}/curriculum`)}
              className="inline-flex items-center gap-2 border-b-2 border-transparent px-1 py-3 font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              <FileText size={16} />
              Curriculum
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 border-b-2 border-[#4f46e5] px-1 py-3 font-medium text-[#4f46e5]"
            >
              <BookOpen size={16} />
              Chapters
            </button>
          </div>
        </div>

        {subjectLoading && getChaptersByCourseid(courseId).length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map((skeleton) => (
              <div
                key={skeleton}
                className="overflow-hidden rounded-[14px] border border-slate-200/90 bg-white p-6 shadow-sm"
              >
                <div className="animate-pulse space-y-3">
                  <div className="h-5 w-3/4 rounded-lg bg-slate-200" />
                  <div className="h-4 w-1/2 rounded-lg bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredChapters.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white py-20 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <BookOpen size={28} className="text-slate-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">No chapters found</h3>
            <p className="mx-auto max-w-md text-slate-500">
              Try adjusting your search criteria or clearing filters to see chapters.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredChapters.map((chapter) => {
              const isExpanded = expandedChapterId === chapter.id;
              const chapterConceptRows = Object.keys(chapter.content_categories ?? {}).filter((concept) =>
                concept.trim()
              );

              return (
                <div
                  key={chapter.id}
                  className="overflow-hidden rounded-[14px] border border-slate-200/90 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex items-start justify-between gap-4 px-6 py-5">
                    <button
                      type="button"
                      onClick={() => updateExpandedChapter(isExpanded ? null : chapter.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <ChevronDown
                        size={18}
                        className={cn(
                          'shrink-0 text-slate-500 transition-transform duration-200',
                          !isExpanded && '-rotate-90'
                        )}
                      />
                      <div className="min-w-0">
                        <h3 className="text-[19px] font-bold leading-tight text-slate-950">
                          {`Chapter ${chapter.number} \u00B7 ${chapter.title}`}
                        </h3>
                      </div>
                    </button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openChapterContentView(chapter)}
                      className="h-10 shrink-0 rounded-2xl border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                    >
                      <FolderOpen size={16} className="mr-2" />
                      Content
                    </Button>
                  </div>

                  {isExpanded && chapterConceptRows.length > 0 && (
                    <div className="border-t border-slate-200/80 bg-white px-6">
                      <div className="divide-y divide-slate-200/80">
                        {chapterConceptRows.map((concept, index) => (
                          <div
                            key={concept}
                            className="flex flex-col gap-3 py-3.5 lg:flex-row lg:items-center lg:justify-between"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                                {index + 1}
                              </div>
                              <p className="truncate text-[15px] font-medium text-slate-950">{concept}</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => openConceptDrawer(chapter, concept, index)}
                                className="h-9 rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                              >
                                <Brain size={16} className="mr-2 text-[#4f46e5]" />
                                Concept Intelligence
                              </Button>
                              <Button
                                type="button"
                                onClick={() => openGenerateQuestionsModal(chapter, concept, index)}
                                className="h-9 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(79,70,229,0.2)] hover:bg-[#4338ca]"
                              >
                                <Sparkles size={16} className="mr-2" />
                                Generate Questions
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {uploadContentModal}
      {generateQuestionsModal}

      {conceptDrawer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-[2px]"
          onClick={closeConceptDrawer}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="concept-intelligence-title"
            className="flex h-full w-full max-w-[520px] flex-col overflow-hidden rounded-l-[28px] border-l border-slate-200/80 bg-white shadow-[-24px_0_70px_rgba(15,23,42,0.18)] transition-transform duration-300"
            onClick={(event) => event.stopPropagation()}
          >
            {(() => {
              const details = getConceptIntelligence(
                conceptDrawer.chapter,
                conceptDrawer.conceptTitle
              );

              const detailSections = [
                { title: 'Knowledge', icon: BookOpen, items: details.knowledge, kind: 'list' as const },
                { title: 'Abilities', icon: Lightbulb, items: details.abilities, kind: 'list' as const },
                { title: 'Skills', icon: WandSparkles, items: details.skills, kind: 'tags' as const },
                { title: 'Misconceptions', icon: TriangleAlert, items: details.misconceptions, kind: 'list' as const },
                { title: 'Prerequisites', icon: Orbit, items: details.prerequisites, kind: 'tags' as const },
                { title: 'Learning outcomes', icon: Target, items: details.learningOutcomes, kind: 'list' as const },
                { title: 'Competencies', icon: BriefcaseBusiness, items: details.competencies, kind: 'tags' as const },
                { title: 'Learning objectives', icon: CircleDot, items: details.learningObjectives, kind: 'list' as const },
                { title: 'Teaching pedagogies', icon: ClipboardList, items: details.teachingPedagogies, kind: 'tags' as const },
                { title: 'Real-world applications', icon: GraduationCap, items: details.realWorldApplications, kind: 'list' as const },
              ];

              return (
                <>
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-5 py-5 sm:px-6">
                    <div>
                      <h2 id="concept-intelligence-title" className="text-[18px] font-bold tracking-tight text-slate-950 sm:text-[20px]">
                        {conceptDrawer.conceptTitle}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={closeConceptDrawer}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Close drawer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-medium text-[#3157ff] hover:bg-[#eef2ff]">
                        <Sparkles size={12} className="mr-1.5" />
                        {details.domain}
                      </Badge>
                      <Badge className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                        <Orbit size={12} className="mr-1.5" />
                        {details.dok}
                      </Badge>
                      <Badge className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                        <BookOpen size={12} className="mr-1.5" />
                        {conceptDrawer.chapter.title}
                      </Badge>
                    </div>

                    <div className="mt-6 space-y-5">
                      {detailSections.map((section) => {
                        const SectionIcon = section.icon;

                        return (
                          <section key={section.title}>
                            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                              <SectionIcon size={14} className="text-slate-500" />
                              {section.title}
                            </div>

                            {section.kind === 'list' ? (
                              <ul className="space-y-2 text-[15px] leading-6 text-slate-700">
                                {section.items.map((item) => (
                                  <li key={item} className="flex gap-2">
                                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {section.items.map((item) => (
                                  <Badge
                                    key={item}
                                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                  >
                                    {item}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
          </aside>
        </div>
      )}

      {isAddChapterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-md"
          onClick={closeAddChapterModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-chapter-title"
            className="relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4">
              <h2 id="add-chapter-title" className="text-lg font-semibold tracking-tight text-slate-900">
                Add Chapter
              </h2>
              <button
                type="button"
                onClick={closeAddChapterModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="space-y-2">
                <Label htmlFor="chapter-name" className="text-sm font-medium text-slate-700">
                  Chapter Name
                </Label>
                <Input
                  id="chapter-name"
                  value={chapterForm.chapterName}
                  onChange={(event) =>
                    setChapterForm((prev) => ({ ...prev, chapterName: event.target.value }))
                  }
                  className="h-11 rounded-xl border-slate-300 bg-slate-50/60 px-3 text-slate-900 placeholder:text-slate-400 focus-visible:bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="chapter-description" className="text-sm font-medium text-slate-700">
                  Chapter Description
                </Label>
                <Textarea
                  id="chapter-description"
                  value={chapterForm.chapterDescription}
                  onChange={(event) =>
                    setChapterForm((prev) => ({ ...prev, chapterDescription: event.target.value }))
                  }
                  className="min-h-28 rounded-xl border-slate-300 bg-slate-50/60 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus-visible:bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sort-order" className="text-sm font-medium text-slate-700">
                  Sort Order
                </Label>
                <Input
                  id="sort-order"
                  type="number"
                  value={chapterForm.sortOrder}
                  onChange={(event) =>
                    setChapterForm((prev) => ({ ...prev, sortOrder: event.target.value }))
                  }
                  className="h-11 rounded-xl border-slate-300 bg-slate-50/60 px-3 text-slate-900 placeholder:text-slate-400 focus-visible:bg-white"
                />
              </div>

              <div className="space-y-4 pt-1">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={chapterForm.availability}
                    onChange={(event) =>
                      setChapterForm((prev) => ({ ...prev, availability: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Availability
                </label>

                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={chapterForm.show}
                    onChange={(event) =>
                      setChapterForm((prev) => ({ ...prev, show: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Show
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-slate-200/80 bg-slate-50/60 px-6 py-4">
              <Button
                onClick={closeAddChapterModal}
                className="h-10 rounded-xl bg-cyan-500 px-5 font-semibold text-white shadow-lg shadow-cyan-500/25 hover:bg-cyan-600"
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {editingChapter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-md"
          onClick={closeEditChapterModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-chapter-title"
            className="relative w-full max-w-4xl overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_35px_120px_rgba(15,23,42,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="relative overflow-hidden border-b border-slate-200/80 bg-[linear-gradient(160deg,#0f172a_0%,#0f766e_48%,#22d3ee_100%)] p-6 text-white lg:border-b-0 lg:border-r">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_34%)]" />
                <div className="relative">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/90">
                    <Sparkles size={13} />
                    Update Chapter
                  </div>
                  <h2 id="edit-chapter-title" className="mt-5 text-2xl font-bold tracking-tight">
                    {editingChapter.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-white/80">
                    Refresh chapter details, adjust visibility, and keep the sequence aligned with your lesson plan flow.
                  </p>

                  <div className="mt-8 space-y-3">
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Chapter Order</p>
                      <p className="mt-2 text-lg font-semibold">#{editingChapter.number}</p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Resource Links</p>
                      <p className="mt-2 text-sm font-medium leading-6 text-white/90">
                        {editingChapter.resources.teacherResource} teacher resources connected
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Questions Bank</p>
                      <p className="mt-2 text-sm font-medium leading-6 text-white/90">
                        {editingChapter.resources.questions} question resources linked
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white">
                <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-5">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Chapter Editor</p>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Modern Update Panel</h3>
                  </div>
                  <button
                    type="button"
                    onClick={closeEditChapterModal}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close dialog"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="max-h-[80vh] overflow-y-auto px-6 py-6">
                  <div className="grid gap-6">
                    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_160px]">
                      <div className="space-y-2">
                        <Label htmlFor="edit-chapter-name" className="text-sm font-medium text-slate-700">
                          Chapter Name
                        </Label>
                        <Input
                          id="edit-chapter-name"
                          value={chapterForm.chapterName}
                          onChange={(event) =>
                            setChapterForm((prev) => ({ ...prev, chapterName: event.target.value }))
                          }
                          className="h-12 rounded-2xl border-slate-200 bg-slate-50/70 px-4 text-slate-900 shadow-sm transition focus-visible:bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-sort-order" className="text-sm font-medium text-slate-700">
                          Sort Order
                        </Label>
                        <Input
                          id="edit-sort-order"
                          type="number"
                          value={chapterForm.sortOrder}
                          onChange={(event) =>
                            setChapterForm((prev) => ({ ...prev, sortOrder: event.target.value }))
                          }
                          className="h-12 rounded-2xl border-slate-200 bg-slate-50/70 px-4 text-slate-900 shadow-sm transition focus-visible:bg-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-chapter-description" className="text-sm font-medium text-slate-700">
                        Chapter Description
                      </Label>
                      <Textarea
                        id="edit-chapter-description"
                        value={chapterForm.chapterDescription}
                        onChange={(event) =>
                          setChapterForm((prev) => ({ ...prev, chapterDescription: event.target.value }))
                        }
                        className="min-h-32 rounded-2xl border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-900 shadow-sm transition focus-visible:bg-white"
                      />
                    </div>

                    <div className="rounded-3xl border border-slate-200/80 bg-slate-50/70 p-5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Visibility Controls
                        </h4>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-200">
                          <input
                            type="checkbox"
                            checked={chapterForm.availability}
                            onChange={(event) =>
                              setChapterForm((prev) => ({ ...prev, availability: event.target.checked }))
                            }
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Available to learners</div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              Keep this chapter accessible across linked lesson plan views.
                            </p>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-blue-200">
                          <input
                            type="checkbox"
                            checked={chapterForm.show}
                            onChange={(event) =>
                              setChapterForm((prev) => ({ ...prev, show: event.target.checked }))
                            }
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Show in chapter list</div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              Surface the chapter in the LMS list and connected curriculum summaries.
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200/80 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    Changes are local to this prototype view until backend save is connected.
                  </p>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeEditChapterModal}
                      className="h-11 rounded-2xl border-slate-200 bg-white px-5 font-semibold text-slate-700"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={closeEditChapterModal}
                      className="h-11 rounded-2xl bg-slate-900 px-5 font-semibold text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800"
                    >
                      Update Chapter
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

