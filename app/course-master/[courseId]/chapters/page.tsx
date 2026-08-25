'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  ChevronLeft,
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
  Database,
  Layers3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiFieldAssistant } from '@/components/ai/AiFieldAssistant';
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
  fetchChapterContent,
  fetchQuestionBank,
  fetchSemanticIntelligenceResult,
  generateIntelligenceQuestions,
  getChaptersByCourseid,
  getConceptIntelligenceData,
  getSubjectAndChapters,
  resolveSubjectDisplayName,
  uploadChapterContent,
  type ChapterContentAsset,
  type ChapterSemantic,
  type ConceptIntelEntry,
  type GeneratedQuestionPreview,
  type QuestionBankApiQuestion,
  type SubjectWithChapters,
} from '../../data/chapters';
import { ConceptIntelligenceTabs } from './ConceptIntelligenceTabs';
import { getRequestContext } from '../../page';
import { getChapterKeyConcepts } from '../../data/chapterKeyConcepts';
import type { ChapterKeyConceptGroup } from '../../data/chapterKeyConcepts';
import type { Chapter } from '../../data/chapters';
import { GeneratePresentationDrawer } from './sideDrawer';
import { persistPalConceptContext } from '@/app/pal/_components/PalContextBootstrap';

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
const UPLOAD_VIDEO_TYPES = ['Recorded video', 'External video'] as const;
const UPLOAD_METHOD_TABS = ['Upload file', 'Add link'] as const;
const QUESTION_TYPE_OPTIONS = ['MCQ', 'Narrative'] as const;
const QUESTION_OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;
const QUESTION_TYPE_API_CONFIG: Record<
  (typeof QUESTION_TYPE_OPTIONS)[number],
  { question_type: 'mcq' | 'narrative'; question_type_id: number }
> = {
  MCQ: { question_type: 'mcq', question_type_id: 1 },
  Narrative: { question_type: 'narrative', question_type_id: 2 },
};
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

type ChapterContentType = 'Classroom presentation' | 'Teacher training presentation' | 'Revision notes' | 'Video' | 'PDF' | 'Classroom activity';
type ChapterContentSource = 'Gamma AI' | 'Uploaded';
type ChapterContentPreview = 'presentation' | 'notes' | 'video' | 'pdf' | 'activity';

interface ChapterContentItem {
  id: string;
  title: string;
  subtitle: string;
  chapterTitle: string;
  conceptTitle: string;
  contentCategory: string;
  conceptId: string | null;
  type: ChapterContentType;
  source: ChapterContentSource;
  preview: ChapterContentPreview;
  actionLabel: 'Open' | 'Play';
  slideCount: number;
  statValue: string;
  updatedDate: string;
  updatedAt: string;
  contentUrl?: string;
  slides: {
    id: string;
    number: number;
    title: string;
  }[];
}

type QuestionBankQuestionType = (typeof QUESTION_TYPE_OPTIONS)[number];
type QuestionOptionLabel = (typeof QUESTION_OPTION_LABELS)[number];

interface QuestionBankOption {
  label: string;
  text: string;
  isCorrect?: boolean;
}

interface QuestionBankItem {
  id: string;
  displayId: string;
  chapterId: string;
  chapterTitle: string;
  conceptTitle: string;
  category: string;
  type: QuestionBankQuestionType;
  marks: number;
  question: string;
  options?: QuestionBankOption[];
  modelAnswer?: string;
}

interface QuestionBankGroup {
  id: string;
  chapterId: string;
  chapterTitle: string;
  conceptTitle: string;
  category: string;
  questions: QuestionBankItem[];
}

function getApiContentType(category: string, asset: ChapterContentAsset): ChapterContentType {
  const normalizedCategory = category.toLowerCase().replace(/[_\s]+/g, ' ').trim();
  const contentCategory = (asset.content_category ?? '').toLowerCase().replace(/[_\s]+/g, ' ').trim();
  const contentLabel = `${normalizedCategory} ${contentCategory} ${asset.file_type ?? ''} ${asset.title}`.toLowerCase();

  if (contentLabel.includes('video') || /\.(mp4|mov|webm)(?:$|\?)/.test(asset.filename ?? '')) return 'Video';
  if (contentLabel.includes('presentation') || /\.(ppt|pptx)(?:$|\?)/.test(asset.filename ?? '')) {
    if (contentLabel.includes('teacher training')) return 'Teacher training presentation';
    return 'Classroom presentation';
  }
  if (contentLabel.includes('classroom activity')) return 'Classroom activity';
  if (contentLabel.includes('pdf')) return 'PDF';
  return 'Revision notes';
}

function buildApiChapterContentItems(
  chapter: Chapter,
  categories: Record<string, ChapterContentAsset[]>
): ChapterContentItem[] {
  return Object.entries(categories).flatMap(([category, assets]) =>
    (assets ?? []).map((asset) => {
      const type = getApiContentType(category, asset);
      const contentUrl = asset.url || asset.filename || undefined;
      const updatedDate = asset.created_at?.split(' ')[0] ?? '—';
      const rawConceptId =
        asset.concept_id === null || asset.concept_id === undefined
          ? null
          : String(asset.concept_id).trim();
      const source = asset.source === 'Gamma AI' ? 'Gamma AI' : 'Uploaded';

      return {
        id: String(asset.id),
        title: asset.title || 'Untitled content',
        subtitle: category,
        chapterTitle: chapter.title,
        conceptTitle: category,
        contentCategory: asset.content_category ?? category,
        conceptId: rawConceptId && rawConceptId !== '0' ? rawConceptId : null,
        type,
        source,
        preview: getChapterContentPreview(type),
        actionLabel: type === 'Video' ? 'Play' : 'Open',
        slideCount: 0,
        statValue: asset.file_type || category,
        updatedDate,
        updatedAt: updatedDate === '—' ? 'Date unavailable' : `updated ${updatedDate}`,
        contentUrl,
        slides: [],
      };
    })
  );
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

  const conceptDescription = (chapter.concepts ?? []).find(
    (item) => item.title === conceptTitle
  )?.description;
  const knowledge = Array.from(
    new Set([conceptDescription, ...intel.knowledge].map(asText).filter(Boolean))
  );

  const abilities = abilitiesForConcept.map((item) => asText(item.ability)).filter(Boolean);
  const skills = intel.skills.map((item) => asText(item.skill)).filter(Boolean);
  const misconceptions = (intel.misconceptions ?? []).map((item) => asText(item?.misconception)).filter(Boolean);
  const prerequisites = (intel.prerequisites ?? []).map((item) => asText(item)).filter(Boolean);
  const learningOutcomes = (intel.learningOutcomes ?? []).map((item) => asText(item?.outcome)).filter(Boolean);
  const competencies = (intel.competencies ?? []).map((item) => asText(item?.competency)).filter(Boolean);
  const learningObjectives = (intel.learningObjectives ?? []).map((item) => asText(item?.objective)).filter(Boolean);
  const teachingPedagogies = (intel.pedagogy ?? []).map((item) => asText(item?.strategy)).filter(Boolean);
  const realWorldApplications = (intel.realWorld ?? [])
    .map((item) => asText(item?.application ?? item?.example))
    .filter(Boolean);

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
    'Classroom activity',
    'PDF',
  ];

  return sequence[index % sequence.length];
}

function getChapterContentPreview(type: ChapterContentType): ChapterContentPreview {
  if (type === 'Video') return 'video';
  if (type === 'Revision notes') return 'notes';
  if (type === 'PDF') return 'pdf';
  if (type === 'Classroom activity') return 'activity';
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
    case 'Classroom activity':
      return `${chapterTitle} - classroom activity`;
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

  if (type === 'Revision notes' || type === 'PDF' || type === 'Classroom activity') {
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
      contentCategory: type === 'Teacher training presentation' ? 'Teacher Training' : conceptTitle,
      // Demo data has no real concept_id; approximate chapter-wise vs concept-wise
      // by alternating so both grouping views show sample content.
      conceptId: concept && index % 2 === 1 ? `${chapter.id}-concept-${index}` : null,
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

  if (preview === 'activity') {
    return ClipboardList;
  }

  return BookOpen;
}

function isTeacherTrainingContent(item: ChapterContentItem): boolean {
  return `${item.contentCategory ?? ''} ${item.type}`.toLowerCase().includes('teacher');
}

function truncateToWords(value: string, maxWords = 150): string {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value;
  return words.slice(0, maxWords).join(' ') + '…';
}

function getQuestionBankConceptTitles(course: Course, chapter: Chapter) {
  const savedConcepts = (chapter.concepts ?? [])
    .map((concept) => concept.title)
    .filter((title) => title.trim());
  const keyConcepts = getChapterKeyConcepts(course.id, chapter.id)?.concepts.map((concept) => concept.title) ?? [];
  const categoryConcepts = Object.keys(chapter.content_categories ?? {}).filter(
    (title) => title.trim() && !/^(my course|videos|recorded videos)$/i.test(title.trim())
  );
  const concepts = savedConcepts.length
    ? savedConcepts
    : keyConcepts.length
      ? keyConcepts
      : categoryConcepts;

  return Array.from(new Set(concepts.map((title) => title.trim()))).slice(0, 4);
}

function getQuestionBankCategory(course: Course, chapter: Chapter, conceptTitle: string) {
  const haystack = `${chapter.title} ${conceptTitle}`.toLowerCase();

  if (/sound|amplitude|frequency|pitch|ultrasound|wave/.test(haystack)) return 'Sound';
  if (/force|motion|work|energy|electric|magnet|light/.test(haystack)) return 'Physics';
  if (/reaction|acid|base|salt|metal|carbon/.test(haystack)) return 'Chemistry';
  if (/life|cell|organ|plant|animal|nutrition|respiration/.test(haystack)) return 'Biology';

  return course.subject || 'Concept';
}

function isLikelyJson(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith('{') && trimmed.endsWith('}');
}

function deriveQuestionBankAnswer(
  q: QuestionBankApiQuestion
): { type: QuestionBankQuestionType; options?: QuestionBankOption[]; modelAnswer?: string } {
  if (q.options && q.options.length > 0) {
    return {
      type: q.question_type === 'MCQ' ? 'MCQ' : 'Narrative',
      options: q.options.map((o) => ({ label: o.label, text: o.text, isCorrect: o.is_correct })),
      modelAnswer: q.question_type === 'MCQ' ? undefined : q.model_answer,
    };
  }

  if (q.model_answer) {
    try {
      const parsed = JSON.parse(q.model_answer) as {
        question_type?: string;
        options?: Array<{ label: string; text: string; is_correct?: boolean }>;
        correct_option?: string;
      };

      if (Array.isArray(parsed.options) && parsed.options.length > 0) {
        const isMcq = (parsed.question_type ?? '').toLowerCase() === 'mcq';
        return {
          type: isMcq ? 'MCQ' : 'Narrative',
          options: parsed.options.map((o) => ({
            label: o.label,
            text: o.text,
            isCorrect: o.is_correct ?? o.label === parsed.correct_option,
          })),
          modelAnswer: undefined,
        };
      }
    } catch {
      // model_answer isn't structured JSON — treat it as a plain-text model answer below.
    }
  }

  return {
    type: q.question_type === 'MCQ' ? 'MCQ' : 'Narrative',
    options: undefined,
    modelAnswer: q.model_answer,
  };
}

async function fetchMappedQuestionBank(
  chapterId: number,
  chapter: Chapter | undefined,
  course: Course | null | undefined
): Promise<QuestionBankItem[]> {
  const response = await fetchQuestionBank(chapterId);

  return response.data.map((q: QuestionBankApiQuestion) => {
    const conceptTitle =
      chapter?.concepts?.find((c) => Number(c.id) === q.topic_id)?.title ??
      (q.topic_id ? `Topic ${q.topic_id}` : 'General');
    const { type, options, modelAnswer } = deriveQuestionBankAnswer(q);

    return {
      id: String(q.id),
      displayId: `QB-${q.id}`,
      chapterId: String(q.chapter_id),
      chapterTitle: chapter?.title ?? 'Unknown Chapter',
      conceptTitle,
      category: course ? getQuestionBankCategory(course, chapter ?? ({} as Chapter), conceptTitle) : 'Question Bank',
      type,
      marks: q.marks ?? 1,
      question: q.question,
      options,
      modelAnswer,
    };
  });
}

function buildQuestionBankItems(course: Course, chapters: Chapter[]): QuestionBankItem[] {
  let questionNumber = 101;

  return chapters.flatMap((chapter) => {
    const concepts = getQuestionBankConceptTitles(course, chapter);
    const conceptTitles = concepts.length ? concepts : [chapter.title];

    return conceptTitles.flatMap((conceptTitle, conceptIndex) => {
      const conceptLower = conceptTitle.toLowerCase();
      const chapterLower = chapter.title.toLowerCase();
      const category = getQuestionBankCategory(course, chapter, conceptTitle);
      const baseId = `${chapter.id}-${conceptTitle}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      return [
        {
          id: `${baseId}-mcq-key-idea`,
          displayId: `QB-${questionNumber++}`,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          conceptTitle,
          category,
          type: 'MCQ' as const,
          marks: 1,
          question: `Which option best represents ${conceptLower} in ${chapterLower}?`,
          options: [
            { label: 'A', text: conceptTitle, isCorrect: true },
            { label: 'B', text: 'A separate topic from another chapter' },
            { label: 'C', text: 'Only a memorized definition' },
            { label: 'D', text: 'None of these' },
          ],
        },
        {
          id: `${baseId}-mcq-application`,
          displayId: `QB-${questionNumber++}`,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          conceptTitle,
          category,
          type: 'MCQ' as const,
          marks: 1,
          question: `What should a learner check first while applying ${conceptLower}?`,
          options: [
            { label: 'A', text: 'Ignore the given condition' },
            { label: 'B', text: `Identify where ${conceptLower} appears in the situation`, isCorrect: true },
            { label: 'C', text: 'Copy the previous answer exactly' },
            { label: 'D', text: 'Skip the supporting reason' },
          ],
        },
        {
          id: `${baseId}-narrative-${conceptIndex + 1}`,
          displayId: `QB-${questionNumber++}`,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          conceptTitle,
          category,
          type: 'Narrative' as const,
          marks: 3,
          question: `Describe how ${conceptLower} can be used or observed in ${chapterLower}.`,
          modelAnswer: `A complete answer names ${conceptLower}, connects it to ${chapter.title}, and gives a clear example with a short reason. Any valid example with the correct concept link earns full marks.`,
        },
      ];
    });
  });
}

export default function ChapterListPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const courseId = params?.courseId as string;
  const expandedChapterParam = searchParams?.get('expandedChapterId');

  const [subjectData, setSubjectData] = useState<SubjectWithChapters | null>(null);
  const [subjectLoading, setSubjectLoading] = useState(true);

  const courseIdParts = courseId.includes('-') ? courseId.split('-', 2) : [courseId];
  const subjectId = courseIdParts[0];
  const standardId = courseIdParts[1] ?? undefined;

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setSubjectLoading(true);
    });

    // Phase 1 — render chapters immediately. resolveDisplayNames:false skips the
    // slow (~8s / 1.3MB) course-catalog lookup that only supplies cosmetic names.
    getSubjectAndChapters(subjectId, standardId, { resolveDisplayNames: false })
      .then((data) => {
        if (!cancelled) setSubjectData(data);
      })
      .finally(() => {
        if (!cancelled) setSubjectLoading(false);
      });

    // Phase 2 — enrich the header's subject/standard names in the background,
    // without blocking the chapter list from rendering.
    resolveSubjectDisplayName(subjectId, standardId).then((matched) => {
      if (cancelled || !matched) return;
      setSubjectData((current) => {
        if (!current?.subject) return current;
        return {
          ...current,
          subject: {
            ...current.subject,
            subject_name: matched.subject_name ?? current.subject.subject_name,
            standard_name: matched.standard_name ?? current.subject.standard_name,
            section_id: matched.section_id ?? current.subject.section_id,
            section_name: matched.section_name ?? current.subject.section_name,
            division_id: matched.division_id ?? current.subject.division_id,
            division_name: matched.division_name ?? current.subject.division_name,
            display_image: matched.display_image ?? current.subject.display_image,
            content_category: matched.content_category ?? current.subject.content_category,
          },
        };
      });
    });

    return () => {
      cancelled = true;
    };
  }, [subjectId, standardId]);

  const course: Course | undefined = useMemo(() => {
    const staticCourse = courses.find((c) => c.id === courseId);
    const apiSubject = subjectData?.subject ?? null;

    return (
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
        : undefined)
    );
  }, [courseId, subjectData?.chapters, subjectData?.subject]);
  const allChapters = subjectData?.chapters ?? getChaptersByCourseid(courseId);

  const [searchTerm] = useState('');
  const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [uploadChapter, setUploadChapter] = useState<Chapter | null>(null);
  const [isPresentationMenuOpen, setIsPresentationMenuOpen] = useState(false);
  const [isGeneratingPresentation, setIsGeneratingPresentation] = useState(false);
  const [isPresentationReady, setIsPresentationReady] = useState(false);
  const [isGeneratePresentationDrawerOpen, setIsGeneratePresentationDrawerOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState<'Classroom' | 'Teacher training'>('Classroom');
  const [presentationChapterId, setPresentationChapterId] = useState('');
  const [presentationConcept, setPresentationConcept] = useState('');
  const [presentationSlides, setPresentationSlides] = useState<string>(PRESENTATION_SLIDE_OPTIONS[1]);
  const [presentationTheme, setPresentationTheme] = useState<string>(GAMMA_THEME_OPTIONS[0]);
  const [presentationAudienceNotes, setPresentationAudienceNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploadContentType, setUploadContentType] = useState<(typeof UPLOAD_CONTENT_TYPES)[number]>(
    UPLOAD_CONTENT_TYPES[0]
  );
  const [uploadPresentationType, setUploadPresentationType] = useState<
    (typeof UPLOAD_PRESENTATION_TYPES)[number]
  >(UPLOAD_PRESENTATION_TYPES[0]);
  const [uploadVideoType, setUploadVideoType] = useState<(typeof UPLOAD_VIDEO_TYPES)[number]>(
    UPLOAD_VIDEO_TYPES[0]
  );
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
  const [questionBankChapterFilter, setQuestionBankChapterFilter] = useState('all');
  const [questionBankConceptFilter, setQuestionBankConceptFilter] = useState('all');
  const [questionBankTypeFilter, setQuestionBankTypeFilter] = useState('all');
  const [manualQuestionBankItems, setManualQuestionBankItems] = useState<QuestionBankItem[]>([]);
  const [questionBankItemEdits, setQuestionBankItemEdits] = useState<Record<string, QuestionBankItem>>({});
  const [editingQuestionBankItem, setEditingQuestionBankItem] = useState<QuestionBankItem | null>(null);
  const [apiQuestionBankItems, setApiQuestionBankItems] = useState<QuestionBankItem[]>([]);
  const [questionBankLoading, setQuestionBankLoading] = useState(false);
  const [questionBankError, setQuestionBankError] = useState('');
  const [isAddQuestionBankModalOpen, setIsAddQuestionBankModalOpen] = useState(false);
  const [manualQuestionChapterId, setManualQuestionChapterId] = useState('');
  const [manualQuestionConcept, setManualQuestionConcept] = useState('');
  const [manualQuestionType, setManualQuestionType] = useState<QuestionBankQuestionType>('MCQ');
  const [manualQuestionMarks, setManualQuestionMarks] = useState('1');
  const [manualQuestionText, setManualQuestionText] = useState('');
  const [manualQuestionOptions, setManualQuestionOptions] = useState<Record<QuestionOptionLabel, string>>({
    A: '',
    B: '',
    C: '',
    D: '',
  });
  const [manualCorrectOption, setManualCorrectOption] = useState<QuestionOptionLabel>('A');
  const [manualModelAnswer, setManualModelAnswer] = useState('');
  const [manualQuestionError, setManualQuestionError] = useState('');
  const [selectedLibraryChapterId, setSelectedLibraryChapterId] = useState('');
  const [contentLibraryTab, setContentLibraryTab] =
    useState<(typeof CONTENT_LIBRARY_TABS)[number]>('All content');
  const [contentGroupBy, setContentGroupBy] =
    useState<'Chapter wise' | 'Concept wise'>('Chapter wise');
  const [selectedContentItem, setSelectedContentItem] = useState<ChapterContentItem | null>(null);
  const [chapterContentCategories, setChapterContentCategories] = useState<
    Record<string, Record<string, ChapterContentAsset[]>>
  >({});
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState('');
  const [questionModalConcept, setQuestionModalConcept] = useState<{
    chapter: Chapter;
    conceptTitle: string;
    conceptIndex: number;
  } | null>(null);
  const [questionType, setQuestionType] = useState('');
  const [totalQuestions, setTotalQuestions] = useState('');
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionGenerationError, setQuestionGenerationError] = useState('');
  const [questionGenerationSuccess, setQuestionGenerationSuccess] = useState('');
  const [generatedQuestionPreviews, setGeneratedQuestionPreviews] = useState<GeneratedQuestionPreview[]>([]);
  // Lazy-loaded, per-chapter semantic intelligence (the heavy full_intelegance_json
  // blob). Fetched on first Concept Intelligence click and cached by chapter id so a
  // chapter is only ever fetched once.
  const [chapterIntelligence, setChapterIntelligence] = useState<Record<string, ChapterSemantic>>({});
  const [intelligenceLoadingId, setIntelligenceLoadingId] = useState<string | null>(null);
  const [intelligenceError, setIntelligenceError] = useState('');

  const view = searchParams?.get('view');
  const contentResourceType = searchParams?.get('resourceType') === 'teacher' ? 'teacher' : 'classroom';
  const contentResourceLabel = contentResourceType === 'teacher' ? 'Teacher Resource' : 'Classroom Resource';
  const activeChapterId = searchParams?.get('chapterId') ?? '';
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
    const cacheKey = `${activeLibraryChapter.id}:${contentLibraryTab}:${contentGroupBy}:${contentSourceFilter}:${contentResourceType}`;
    const apiCategories = chapterContentCategories[cacheKey];
    if (apiCategories) return buildApiChapterContentItems(activeLibraryChapter, apiCategories);
    if (/^\d+$/.test(activeLibraryChapter.id)) return [];
    return buildChapterContentItems(course, activeLibraryChapter, activeLibraryChapterConcepts);
  }, [activeLibraryChapter, activeLibraryChapterConcepts, chapterContentCategories, contentLibraryTab, contentGroupBy, contentSourceFilter, contentResourceType, course]);

  const contentSourceOptions = useMemo(
    () => Array.from(new Set(chapterContentItems.map((item) => item.source))),
    [chapterContentItems]
  );

  const generatedQuestionBankItems = useMemo(
    () => (course ? buildQuestionBankItems(course, allChapters) : []),
    [allChapters, course]
  );
  const questionBankItems = useMemo(
    () =>
      [...(apiQuestionBankItems.length > 0 ? apiQuestionBankItems : generatedQuestionBankItems), ...manualQuestionBankItems].map(
        (question) => questionBankItemEdits[question.id] ?? question
      ),
    [apiQuestionBankItems, generatedQuestionBankItems, manualQuestionBankItems, questionBankItemEdits]
  );
  const questionBankChapterOptions = useMemo(
    () => allChapters.map((chapter) => ({ id: chapter.id, title: chapter.title })),
    [allChapters]
  );
  const manualQuestionChapter = useMemo(
    () => allChapters.find((chapter) => chapter.id === manualQuestionChapterId) ?? null,
    [allChapters, manualQuestionChapterId]
  );
  const manualQuestionConceptOptions = useMemo(
    () => (course && manualQuestionChapter ? getQuestionBankConceptTitles(course, manualQuestionChapter) : []),
    [course, manualQuestionChapter]
  );
  const questionBankConceptOptions = useMemo(() => {
    const conceptSource =
      questionBankChapterFilter === 'all'
        ? questionBankItems
        : questionBankItems.filter((question) => question.chapterId === questionBankChapterFilter);

    return Array.from(new Set(conceptSource.map((question) => question.conceptTitle)));
  }, [questionBankChapterFilter, questionBankItems]);
  const effectiveQuestionBankConceptFilter =
    questionBankConceptFilter === 'all' || questionBankConceptOptions.includes(questionBankConceptFilter)
      ? questionBankConceptFilter
      : 'all';
  const filteredQuestionBankItems = useMemo(() => {
    return questionBankItems.filter((question) => {
      const matchesChapter =
        questionBankChapterFilter === 'all' || question.chapterId === questionBankChapterFilter;
      const matchesConcept =
        effectiveQuestionBankConceptFilter === 'all' ||
        question.conceptTitle === effectiveQuestionBankConceptFilter;
      const matchesType =
        questionBankTypeFilter === 'all' || question.type === questionBankTypeFilter;

      return matchesChapter && matchesConcept && matchesType;
    });
  }, [
    effectiveQuestionBankConceptFilter,
    questionBankChapterFilter,
    questionBankItems,
    questionBankTypeFilter,
  ]);
  const questionBankVisibleNumberById = useMemo(
    () => new Map(filteredQuestionBankItems.map((question, index) => [question.id, index + 1])),
    [filteredQuestionBankItems]
  );
  const groupedQuestionBankItems = useMemo(() => {
    const groups: QuestionBankGroup[] = [];
    const groupLookup = new Map<string, QuestionBankGroup>();

    filteredQuestionBankItems.forEach((question) => {
      const key = `${question.chapterId}-${question.conceptTitle}`;
      const existingGroup = groupLookup.get(key);

      if (existingGroup) {
        existingGroup.questions.push(question);
        return;
      }

      const group: QuestionBankGroup = {
        id: key,
        chapterId: question.chapterId,
        chapterTitle: question.chapterTitle,
        conceptTitle: question.conceptTitle,
        category: question.category,
        questions: [question],
      };

      groupLookup.set(key, group);
      groups.push(group);
    });

    return groups;
  }, [filteredQuestionBankItems]);

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
  const uploadConceptOptions = useMemo<{ id: string | null; title: string }[]>(() => {
    if (!uploadSelectedChapter) return [];
    // Prefer the chapter's real concepts (they carry concept ids); fall back to the
    // static key-concept list and finally to the content_categories keys so the
    // dropdown is populated for API-backed chapters too.
    const chapterConcepts = uploadSelectedChapter.concepts ?? [];
    if (chapterConcepts.length > 0) {
      return chapterConcepts
        .filter((concept) => concept.title?.trim())
        .map((concept) => ({ id: concept.id ?? null, title: concept.title }));
    }
    const keyConcepts = course
      ? getChapterKeyConcepts(course.id, uploadChapterId)?.concepts ?? []
      : [];
    if (keyConcepts.length > 0) {
      return keyConcepts
        .filter((concept) => concept.title?.trim())
        .map((concept) => ({ id: null, title: concept.title }));
    }
    return Object.keys(uploadSelectedChapter.content_categories ?? {})
      .filter((title) => title.trim())
      .map((title) => ({ id: null, title }));
  }, [course, uploadChapterId, uploadSelectedChapter]);
  const uploadTypeConfig = UPLOAD_TYPE_CONFIG[uploadContentType];
  const canSaveUploadContent =
    Boolean(uploadChapterId) &&
    (uploadMethod === 'Upload file' ? Boolean(uploadFile) : uploadLink.trim().length > 0);
  const totalQuestionsNumber = Number(totalQuestions);
  const isTotalQuestionsValid =
    totalQuestions.trim() !== '' &&
    Number.isInteger(totalQuestionsNumber) &&
    totalQuestionsNumber >= 1 &&
    totalQuestionsNumber <= 50;
  const canGenerateQuestions = questionType !== '' && isTotalQuestionsValid && !isGeneratingQuestions;

  useEffect(() => {
    if (!contentChapter) return;

    const hasMatchingChapter = allChapters.some((chapter) => chapter.id === selectedLibraryChapterId);
    if (!selectedLibraryChapterId || !hasMatchingChapter) {
      queueMicrotask(() => setSelectedLibraryChapterId(contentChapter.id));
    }
  }, [allChapters, contentChapter, selectedLibraryChapterId]);

  const questionBankChapterSyncedFromUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (view !== 'question-bank' || !activeChapterId) return;
    if (questionBankChapterSyncedFromUrlRef.current === activeChapterId) return;
    const hasMatchingChapter = allChapters.some((chapter) => chapter.id === activeChapterId);
    if (!hasMatchingChapter) return;

    questionBankChapterSyncedFromUrlRef.current = activeChapterId;
    queueMicrotask(() => {
      setQuestionBankChapterFilter(activeChapterId);
      setQuestionBankConceptFilter('all');
    });
  }, [activeChapterId, allChapters, view]);

  const loadQuestionBankItems = useCallback(
    (filterValue: string) => {
      let cancelled = false;

      setQuestionBankLoading(true);
      setQuestionBankError('');

      const request =
        filterValue === 'all'
          ? Promise.all(
              allChapters
                .filter((chapter) => /^\d+$/.test(chapter.id))
                .map((chapter) => fetchMappedQuestionBank(Number(chapter.id), chapter, course).catch(() => []))
            ).then((results) => results.flat())
          : fetchMappedQuestionBank(
              Number(filterValue),
              allChapters.find((chapter) => chapter.id === filterValue),
              course
            );

      request
        .then((mappedItems) => {
          if (!cancelled) setApiQuestionBankItems(mappedItems);
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setQuestionBankError(error instanceof Error ? error.message : 'Failed to load questions.');
            setApiQuestionBankItems([]);
          }
        })
        .finally(() => {
          if (!cancelled) setQuestionBankLoading(false);
        });

      return () => {
        cancelled = true;
      };
    },
    [allChapters, course]
  );

  useEffect(() => {
    if (view !== 'question-bank') return;
    return loadQuestionBankItems(questionBankChapterFilter);
  }, [loadQuestionBankItems, questionBankChapterFilter, view]);

  useEffect(() => {
    if (view !== 'content' || !activeLibraryChapter || !/^\d+$/.test(activeLibraryChapter.id)) return;

    const cacheKey = `${activeLibraryChapter.id}:${contentLibraryTab}:${contentGroupBy}:${contentSourceFilter}:${contentResourceType}`;
    if (chapterContentCategories[cacheKey]) return;

    const requestContext = getRequestContext();
    if (!requestContext) {
      queueMicrotask(() => setContentError('Course master session data is missing.'));
      return;
    }

    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) {
          setContentLoading(true);
          setContentError('');
        }
        const conceptWise = contentGroupBy === 'Concept wise';
        const contentCategory = contentLibraryTab === 'All content' ? undefined : contentLibraryTab;
        return fetchChapterContent(Number(activeLibraryChapter.id), requestContext.sub_institute_id, {
          contentCategory,
          conceptWise,
          source: contentSourceFilter === 'all' ? undefined : contentSourceFilter,
        });
      })
      .then((response) => {
        if (!cancelled) {
          setChapterContentCategories((current) => ({
            ...current,
            [cacheKey]: response.content_categories,
          }));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setContentError(error instanceof Error ? error.message : 'Failed to load chapter content.');
        }
      })
      .finally(() => {
        if (!cancelled) setContentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeLibraryChapter, contentLibraryTab, contentGroupBy, contentSourceFilter, contentResourceType, view, chapterContentCategories]);

  const filteredChapterContentItems = useMemo(() => {
    return chapterContentItems.filter((item) => {
      const matchesSearch =
        !contentSearch ||
        [item.title, item.subtitle, item.type, item.chapterTitle, item.source]
          .join(' ')
          .toLowerCase()
          .includes(contentSearch.toLowerCase());
      const matchesSource = contentSourceFilter === 'all' || item.source === contentSourceFilter;

      const isTeacherTraining = isTeacherTrainingContent(item);
      // Teacher Resources only ever shows Teacher Training content; Classroom
      // Resources never shows it.
      const matchesResourceType =
        contentResourceType === 'teacher' ? isTeacherTraining : !isTeacherTraining;

      const matchesTab =
        contentResourceType === 'teacher'
          ? // In Teacher Resources, both "All content" and "Presentations" surface
            // every Teacher Training item regardless of its underlying type.
            true
          : contentLibraryTab === 'All content' ||
            (contentLibraryTab === 'Presentations' && item.type === 'Classroom presentation') ||
            (contentLibraryTab === 'Videos' && item.type === 'Video') ||
            (contentLibraryTab === 'Revision notes' &&
              (item.type === 'Revision notes' || item.type === 'PDF')) ||
             (contentLibraryTab === 'Classroom activity' && item.type === 'Classroom activity');

      // Chapter-wise shows only records without a concept_id; Concept-wise shows
      // only records that carry a concept_id.
      const matchesGroup =
        contentGroupBy === 'Concept wise' ? item.conceptId !== null : item.conceptId === null;

      return matchesSearch && matchesSource && matchesResourceType && matchesTab && matchesGroup;
    });
  }, [
    chapterContentItems,
    contentGroupBy,
    contentLibraryTab,
    contentResourceType,
    contentSearch,
    contentSourceFilter,
  ]);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const presentationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAnyModalOpen =
    isAddChapterOpen ||
    editingChapter !== null ||
    uploadChapter !== null ||
    selectedContentItem !== null ||
    isGeneratePresentationDrawerOpen ||
    isAddQuestionBankModalOpen ||
    questionModalConcept !== null;
  const expandedChapterId = view === 'teacher-resource' ? null : expandedChapterParam;

  useEffect(() => {
    if (!isAnyModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAddChapterOpen(false);
        setEditingChapter(null);
        setUploadChapter(null);
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
        setIsAddQuestionBankModalOpen(false);
        setEditingQuestionBankItem(null);
        setManualQuestionError('');
        setQuestionModalConcept(null);
        setQuestionType('');
        setTotalQuestions('');
        setQuestionGenerationError('');
        setQuestionGenerationSuccess('');
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
    setUploadVideoType(UPLOAD_VIDEO_TYPES[0]);
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

  const closeEditChapterModal = () => {
    setEditingChapter(null);
    setChapterForm(EMPTY_CHAPTER_FORM);
  };

  const openUploadContentModal = (chapter: Chapter) => {
    setUploadChapter(chapter);
    setUploadContentType(UPLOAD_CONTENT_TYPES[0]);
    setUploadPresentationType(UPLOAD_PRESENTATION_TYPES[0]);
    setUploadVideoType(UPLOAD_VIDEO_TYPES[0]);
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

  const loadChapterIntelligence = (chapterId: string) => {
    // Lazy-load a chapter's semantic intelligence. The list endpoint no longer
    // ships the heavy full_intelegance_json blob, so we fetch it per chapter and
    // cache the result. Only real (numeric) chapter ids exist in
    // semantic_intelligence; skip static/demo chapters.
    setIntelligenceError('');
    if (
      !/^\d+$/.test(chapterId) ||
      chapterIntelligence[chapterId] ||
      intelligenceLoadingId === chapterId
    ) {
      return;
    }

    setIntelligenceLoadingId(chapterId);
    fetchSemanticIntelligenceResult(chapterId)
      .then((result) => {
        if (result) {
          setChapterIntelligence((current) => ({ ...current, [chapterId]: result }));
        } else {
          setIntelligenceError('No concept intelligence has been generated for this chapter yet.');
        }
      })
      .catch((error: unknown) => {
        setIntelligenceError(
          error instanceof Error ? error.message : 'Failed to load concept intelligence.'
        );
      })
      .finally(() => {
        setIntelligenceLoadingId((current) => (current === chapterId ? null : current));
      });
  };

  const buildConceptIntelligenceUrl = (chapterId: string, conceptIndex: number) => {
    const nextParams = new URLSearchParams(searchParams?.toString());
    nextParams.set('view', 'concept-intelligence');
    nextParams.set('chapterId', chapterId);
    nextParams.set('concept', String(conceptIndex));
    nextParams.set('expandedChapterId', chapterId);
    return `/course-master/${courseId}/chapters?${nextParams.toString()}`;
  };

  // Concept Intelligence opens as a full page view (?view=concept-intelligence)
  // instead of a popup drawer. Kick off the fetch before navigating so the data
  // is usually ready by the time the view renders.
  const openConceptIntelligenceView = (chapter: Chapter, conceptIndex: number) => {
    loadChapterIntelligence(chapter.id);
    router.push(buildConceptIntelligenceUrl(chapter.id, conceptIndex));
  };

  // When the concept-intelligence view is opened directly (deep link, refresh,
  // browser back), the click handler never ran — fetch the chapter here.
  useEffect(() => {
    if (view !== 'concept-intelligence' || !activeChapterId) return;
    loadChapterIntelligence(activeChapterId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, activeChapterId]);

  useEffect(() => {
    if (view !== 'concept-intelligence' || !activeChapterId) return;
    persistPalConceptContext({
      chapterId: activeChapterId,
      concept: searchParams?.get('concept') ?? '0',
    });
  }, [view, activeChapterId, searchParams]);

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

  // The stored content_category also drives library filtering (teacher vs
  // classroom, presentation/video/notes tabs), so it mirrors the selected
  // secondary field per content type.
  const getUploadContentCategory = () => {
    switch (uploadContentType) {
      case 'Presentation':
        return uploadPresentationType;
      case 'Video':
        return uploadVideoType;
      default:
        return uploadContentType;
    }
  };

  const saveUploadContent = async () => {
    if (!uploadChapterId) {
      setUploadError('Please select a chapter before saving.');
      return;
    }
    if (uploadMethod === 'Upload file') {
      if (!uploadFile) {
        setUploadError('Please select a file before saving.');
        return;
      }
    } else if (!uploadLink.trim()) {
      setUploadError('Please add a link before saving.');
      return;
    }

    const requestContext = getRequestContext();
    if (!requestContext) {
      setUploadError('Course master session data is missing.');
      return;
    }

    const category = getUploadContentCategory();
    // "All concepts" means chapter-wise (null). Otherwise resolve the concept's
    // real id when available, falling back to its title.
    const selectedConcept =
      uploadConcept !== 'all'
        ? uploadConceptOptions.find((concept) => concept.title === uploadConcept)
        : null;
    const conceptTitle =
      uploadConcept !== 'all' ? selectedConcept?.id ?? uploadConcept : null;
    const linkValue = uploadMethod === 'Add link' ? uploadLink.trim() : null;
    const title = uploadFile?.name ?? linkValue ?? category;

    try {
      const result = await uploadChapterContent({
        chapter_id: Number(uploadChapterId),
        sub_institute_id: requestContext.sub_institute_id,
        user_id: requestContext.user_id,
        subject_id: Number(subjectData?.subject?.subject_id ?? subjectId) || undefined,
        standard_id: Number(subjectData?.subject?.standard_id ?? standardId) || undefined,
        content_type: uploadContentType,
        content_category: category,
        concept_id: conceptTitle,
        title,
        file: uploadMethod === 'Upload file' ? uploadFile : null,
        url: linkValue,
      });

      // Optimistically surface the new item in the library (only the numeric,
      // API-backed chapters read from this store).
      if (/^\d+$/.test(uploadChapterId)) {
        const newAsset: ChapterContentAsset = result.asset ?? {
          id: Date.now(),
          title,
          description: null,
          filename: uploadFile?.name ?? null,
          url: linkValue,
          file_type: uploadFile?.type || (uploadFile?.name.split('.').pop() ?? null),
          content_category: category,
          concept_id: conceptTitle,
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        };
        setChapterContentCategories((current) => {
          const chapterCategories = { ...(current[uploadChapterId] ?? {}) };
          chapterCategories[category] = [newAsset, ...(chapterCategories[category] ?? [])];
          return { ...current, [uploadChapterId]: chapterCategories };
        });
      }

      setSuccessMessage(result.message || 'Content saved.');
      closeUploadContentModal();
    } catch (error: unknown) {
      setUploadError(error instanceof Error ? error.message : 'Failed to save content.');
    }
  };

  useEffect(() => {
    if (!uploadChapterId) return;

    const matchingConcept = uploadConceptOptions.find((concept) => concept.title === uploadConcept);
    if (!matchingConcept && uploadConcept !== 'all') {
      queueMicrotask(() => setUploadConcept('all'));
    }
  }, [uploadChapterId, uploadConcept, uploadConceptOptions]);

  useEffect(() => {
    queueMicrotask(() => {
      setUploadError('');
      setUploadFile(null);
      setIsDraggingUpload(false);
    });
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  }, [uploadContentType, uploadMethod]);

  const updateExpandedChapter = (chapterId: string | null) => {
    const nextParams = new URLSearchParams(searchParams?.toString());
    if (chapterId) {
      nextParams.set('expandedChapterId', chapterId);
    } else {
      nextParams.delete('expandedChapterId');
    }

    const nextQuery = nextParams.toString();
    router.replace(`/course-master/${courseId}/chapters${nextQuery ? `?${nextQuery}` : ''}`);
  };

  const openChapterContentView = (chapter: Chapter, resourceType: 'classroom' | 'teacher' = 'classroom') => {
    const nextParams = new URLSearchParams(searchParams?.toString());
    nextParams.set('view', 'content');
    nextParams.set('resourceType', resourceType);
    nextParams.set('chapterId', chapter.id);
    nextParams.set('expandedChapterId', chapter.id);

    router.push(`/course-master/${courseId}/chapters?${nextParams.toString()}`);
  };

  const openQuestionBankView = (chapter: Chapter) => {
    const nextParams = new URLSearchParams(searchParams?.toString());
    nextParams.set('view', 'question-bank');
    nextParams.set('chapterId', chapter.id);
    nextParams.set('expandedChapterId', chapter.id);

    setQuestionBankChapterFilter(chapter.id);
    setQuestionBankConceptFilter('all');
    setQuestionBankTypeFilter('all');
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
    setQuestionGenerationError('');
    setQuestionGenerationSuccess('');
    setGeneratedQuestionPreviews([]);
  };

  const handleOpenContent = (item: ChapterContentItem) => {
    if (!item.contentUrl) return;

    window.open(item.contentUrl, '_blank', 'noopener,noreferrer');
  };

  const closeGenerateQuestionsModal = () => {
    setQuestionModalConcept(null);
    setQuestionType('');
    setTotalQuestions('');
    setQuestionGenerationError('');
    setQuestionGenerationSuccess('');
    setGeneratedQuestionPreviews([]);
  };

  const resetManualQuestionForm = () => {
    setManualQuestionChapterId('');
    setManualQuestionConcept('');
    setManualQuestionType('MCQ');
    setManualQuestionMarks('1');
    setManualQuestionText('');
    setManualQuestionOptions({
      A: '',
      B: '',
      C: '',
      D: '',
    });
    setManualCorrectOption('A');
    setManualModelAnswer('');
    setManualQuestionError('');
    setEditingQuestionBankItem(null);
  };

  const closeAddQuestionBankModal = () => {
    setIsAddQuestionBankModalOpen(false);
    resetManualQuestionForm();
  };

  const openQuestionBankAddQuestion = () => {
    const targetQuestion = filteredQuestionBankItems[0] ?? questionBankItems[0];
    const filterChapter =
      questionBankChapterFilter === 'all'
        ? null
        : allChapters.find((chapter) => chapter.id === questionBankChapterFilter) ?? null;
    const targetChapter =
      filterChapter ??
      (targetQuestion ? allChapters.find((chapter) => chapter.id === targetQuestion.chapterId) : null) ??
      resourceChapter ??
      allChapters[0] ??
      null;

    if (!targetChapter || !course) return;

    const conceptOptions = getQuestionBankConceptTitles(course, targetChapter);
    const targetConcept =
      effectiveQuestionBankConceptFilter !== 'all' &&
      conceptOptions.includes(effectiveQuestionBankConceptFilter)
        ? effectiveQuestionBankConceptFilter
        : targetQuestion?.chapterId === targetChapter.id && conceptOptions.includes(targetQuestion.conceptTitle)
          ? targetQuestion.conceptTitle
          : conceptOptions[0] ?? '';
    const targetType: QuestionBankQuestionType =
      questionBankTypeFilter === 'Narrative' ? 'Narrative' : 'MCQ';

    setManualQuestionChapterId(targetChapter.id);
    setManualQuestionConcept(targetConcept);
    setManualQuestionType(targetType);
    setManualQuestionMarks(targetType === 'Narrative' ? '3' : '1');
    setManualQuestionText('');
    setManualQuestionOptions({
      A: '',
      B: '',
      C: '',
      D: '',
    });
    setManualCorrectOption('A');
    setManualModelAnswer('');
    setManualQuestionError('');
    setIsAddQuestionBankModalOpen(true);
  };

  const openQuestionBankEditQuestion = (question: QuestionBankItem) => {
    const chapter = allChapters.find((item) => item.id === question.chapterId) ?? allChapters[0] ?? null;
    const correctOption =
      (question.options?.find((option) => option.isCorrect)?.label as QuestionOptionLabel | undefined) ?? 'A';

    setEditingQuestionBankItem(question);
    setManualQuestionChapterId(chapter?.id ?? question.chapterId);
    setManualQuestionConcept(question.conceptTitle);
    setManualQuestionType(question.type);
    setManualQuestionMarks(String(question.marks));
    setManualQuestionText(question.question);
    setManualQuestionOptions({
      A: question.options?.find((option) => option.label === 'A')?.text ?? '',
      B: question.options?.find((option) => option.label === 'B')?.text ?? '',
      C: question.options?.find((option) => option.label === 'C')?.text ?? '',
      D: question.options?.find((option) => option.label === 'D')?.text ?? '',
    });
    setManualCorrectOption(correctOption);
    setManualModelAnswer(question.modelAnswer ?? '');
    setManualQuestionError('');
    setIsAddQuestionBankModalOpen(true);
  };

  const updateManualQuestionChapter = (chapterId: string) => {
    const nextChapter = allChapters.find((chapter) => chapter.id === chapterId) ?? null;
    const nextConcepts = course && nextChapter ? getQuestionBankConceptTitles(course, nextChapter) : [];

    setManualQuestionChapterId(chapterId);
    setManualQuestionConcept(nextConcepts[0] ?? '');
    setManualQuestionError('');
  };

  const updateManualQuestionType = (value: string | null) => {
    const nextType: QuestionBankQuestionType = value === 'Narrative' ? 'Narrative' : 'MCQ';

    setManualQuestionType(nextType);
    setManualQuestionMarks(nextType === 'Narrative' ? '3' : '1');
    setManualQuestionError('');
  };

  const submitManualQuestion = () => {
    const chapter = allChapters.find((item) => item.id === manualQuestionChapterId);
    const marks = Number(manualQuestionMarks);

    if (!chapter || !course) {
      setManualQuestionError('Please select a chapter.');
      return;
    }

    if (!manualQuestionConcept) {
      setManualQuestionError('Please select a concept.');
      return;
    }

    if (!manualQuestionText.trim()) {
      setManualQuestionError('Please enter the question text.');
      return;
    }

    if (!Number.isFinite(marks) || marks <= 0) {
      setManualQuestionError('Please enter valid marks.');
      return;
    }

    if (
      manualQuestionType === 'MCQ' &&
      !QUESTION_OPTION_LABELS.every((label) => manualQuestionOptions[label].trim() !== '')
    ) {
      setManualQuestionError('Please enter all four answer options.');
      return;
    }

    const nextQuestion: QuestionBankItem = {
      id: editingQuestionBankItem?.id ?? `manual-${Date.now()}`,
      displayId: editingQuestionBankItem?.displayId ?? `QB-${101 + questionBankItems.length}`,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      conceptTitle: manualQuestionConcept,
      category: getQuestionBankCategory(course, chapter, manualQuestionConcept),
      type: manualQuestionType,
      marks,
      question: manualQuestionText.trim(),
      options:
        manualQuestionType === 'MCQ'
          ? QUESTION_OPTION_LABELS.map((label) => ({
              label,
              text: manualQuestionOptions[label].trim(),
              isCorrect: label === manualCorrectOption,
            }))
          : undefined,
      modelAnswer:
        manualQuestionType === 'Narrative'
          ? manualModelAnswer.trim() || 'Model answer not added yet.'
          : undefined,
    };

    if (editingQuestionBankItem) {
      setQuestionBankItemEdits((current) => ({
        ...current,
        [editingQuestionBankItem.id]: nextQuestion,
      }));
    } else {
      setManualQuestionBankItems((current) => [...current, nextQuestion]);
    }

    closeAddQuestionBankModal();
  };

  const submitGenerateQuestions = async () => {
    if (!questionModalConcept || !isTotalQuestionsValid || !questionType) return;

    const requestContext = getRequestContext();
    if (!requestContext) {
      setQuestionGenerationError('Course master session data is missing.');
      return;
    }

    const selectedConcept = questionModalConcept.chapter.concepts?.find(
      (concept) => concept.title === questionModalConcept.conceptTitle
    );
    const chapterId = Number(questionModalConcept.chapter.id);
    const conceptId = Number(selectedConcept?.id);
    const numericSubjectId = Number(subjectData?.subject?.subject_id ?? subjectId);
    const numericStandardId = Number(subjectData?.subject?.standard_id ?? standardId);

    if (![chapterId, conceptId, numericSubjectId, numericStandardId].every(Number.isFinite)) {
      setQuestionGenerationError('Question generation needs saved chapter, subject, standard, and concept IDs.');
      return;
    }

    const config = QUESTION_TYPE_API_CONFIG[questionType as (typeof QUESTION_TYPE_OPTIONS)[number]];
    if (!config) {
      setQuestionGenerationError('Please select a valid question type.');
      return;
    }

    setIsGeneratingQuestions(true);
    setQuestionGenerationError('');
    setQuestionGenerationSuccess('');
    setGeneratedQuestionPreviews([]);

    try {
      const response = await generateIntelligenceQuestions({
        chapter_id: chapterId,
        subject_id: numericSubjectId,
        standard_id: numericStandardId,
        concept_id: conceptId,
        sub_institute_id: requestContext.sub_institute_id,
        question_type: config.question_type,
        question_type_id: config.question_type_id,
        total_questions: totalQuestionsNumber,
        created_by: requestContext.user_id,
      });

      const inserted = response.data?.inserted;
      setQuestionGenerationSuccess(
        inserted != null
          ? `${response.message} ${inserted} question${inserted === 1 ? '' : 's'} saved.`
          : response.message
      );
      setGeneratedQuestionPreviews(response.data?.questions ?? []);
    } catch (error: unknown) {
      setQuestionGenerationError(
        error instanceof Error ? error.message : 'Failed to generate questions.'
      );
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const openGeneratePresentationDrawer = () => {
    setIsGeneratePresentationDrawerOpen(true);
  };

  const closeGeneratePresentationDrawer = () => {
    setIsGeneratePresentationDrawerOpen(false);
  };

  const handleGenerateSuccess = (raw: Record<string, unknown>) => {
    setSuccessMessage((raw.message as string) || 'Gamma content generated successfully');
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };
  useEffect(() => {
    if (!presentationChapterId) return;

    const matchingConcept = presentationConceptOptions.find(
      (concept) => concept.title === presentationConcept
    );

    if (!matchingConcept) {
      queueMicrotask(() => setPresentationConcept(presentationConceptOptions[0]?.title ?? ''));
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

              {uploadContentType === 'Presentation' && (
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
              )}

              {uploadContentType === 'Video' && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Video Type
                  </Label>
                  <Select
                    value={uploadVideoType}
                    onValueChange={(value) =>
                      setUploadVideoType(value as (typeof UPLOAD_VIDEO_TYPES)[number])
                    }
                  >
                    <SelectTrigger className="h-11 rounded-[10px] border-slate-300 px-4 text-[15px] text-slate-900 shadow-none">
                      <SelectValue placeholder="Select video type" />
                    </SelectTrigger>
                    <SelectContent>
                      {UPLOAD_VIDEO_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Keeps Chapter/Concept aligned on the next row when there is no
                  secondary type field (Revision notes / Classroom activity). */}
              {uploadContentType !== 'Presentation' && uploadContentType !== 'Video' && (
                <div aria-hidden className="hidden md:block" />
              )}

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Chapter <span className="text-rose-500">*</span>
                </Label>
                <Select value={uploadChapterId} onValueChange={(value) => setUploadChapterId(value ?? '')}>
                  <SelectTrigger className="h-11 rounded-[10px] border-slate-300 px-4 text-[15px] text-slate-900 shadow-none">
                    <SelectValue placeholder="Select chapter">
                      {allChapters.find(ch => ch.id === uploadChapterId)?.title || 'Select chapter'}
                    </SelectValue>
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

  const renderGeneratedQuestionPreview = (question: GeneratedQuestionPreview, index: number) => {
    const answer = question.answer ?? {};
    const options = answer.options ?? [];
    const markingPoints = answer.marking_points ?? [];

    return (
      <article
        key={`${question.id}-${index}`}
        className="rounded-[10px] border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <span>Question {index + 1}</span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
            ID {question.id}
          </span>
          {answer.bloom_level ? (
            <span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] text-violet-700">
              {answer.bloom_level}
            </span>
          ) : null}
          {question.points ? (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
              {question.points} mark{question.points === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>

        <h3 className="mt-3 text-[15px] font-semibold leading-6 text-slate-950">
          {question.question_title}
        </h3>

        {options.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {options.map((option, optionIndex) => (
              <div
                key={`${option.label ?? optionIndex}-${option.text ?? optionIndex}`}
                className={cn(
                  'flex gap-3 rounded-[8px] border px-3 py-2 text-sm',
                  option.is_correct
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700">
                  {option.label ?? String.fromCharCode(65 + optionIndex)}
                </span>
                <div className="min-w-0 flex-1">
                  <p>{option.text}</p>
                  {option.is_correct ? (
                    <p className="mt-1 text-xs font-semibold text-emerald-700">Correct answer</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {answer.model_answer ? (
          <div className="mt-3 rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
              Model answer
            </p>
            <p className="mt-1 leading-6">{answer.model_answer}</p>
          </div>
        ) : null}

        {markingPoints.length > 0 ? (
          <div className="mt-3 rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Marking points
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {markingPoints.map((point, pointIndex) => (
                <li key={`${point.criterion ?? pointIndex}`} className="leading-6">
                  {point.criterion}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {answer.explanation ? (
          <p className="mt-3 text-sm leading-6 text-slate-600">{answer.explanation}</p>
        ) : null}
      </article>
    );
  };

  const renderQuestionBankQuestion = (question: QuestionBankItem) => {
    const visibleNumber = questionBankVisibleNumberById.get(question.id) ?? 1;

    return (
      <article
        key={question.id}
        className="rounded-[8px] border border-slate-200/90 bg-white px-5 py-5 shadow-[0_2px_8px_rgba(15,23,42,0.08)] sm:px-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <span className="shrink-0 pt-0.5 font-mono text-[14px] text-slate-600">
              {question.displayId}
            </span>
            <h3 className="min-w-0 text-[18px] font-bold leading-7 text-slate-950">
              {visibleNumber}. {question.question}
            </h3>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start">
            <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-bold text-[#3157ff]">
              {question.type}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
              {question.marks} mark{question.marks === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {question.options ? (
          <div className="mt-4 space-y-2">
            {question.options.map((option) => (
              <div
                key={`${question.id}-${option.label}`}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-[6px] border px-3 text-[16px] transition-colors',
                  option.isCorrect
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-900'
                )}
              >
                <span className="shrink-0 font-mono text-sm font-semibold text-slate-600">
                  {option.label}.
                </span>
                <span className="min-w-0 flex-1">{option.text}</span>
                {option.isCorrect ? (
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {question.modelAnswer && !isLikelyJson(question.modelAnswer) ? (
          <div className="mt-4 rounded-[6px] border border-slate-200 border-l-4 border-l-[#4f46e5] bg-[#f3f7fc] px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Model answer
            </p>
            <p className="mt-2 text-[16px] leading-7 text-slate-700">{question.modelAnswer}</p>
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-3 border-t border-slate-200/80 pt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => openQuestionBankEditQuestion(question)}
            className="h-10 rounded-2xl bg-[#eef2ff] px-4 text-sm font-semibold text-[#4f46e5] hover:bg-[#e2e7ff] hover:text-[#4338ca]"
          >
            <Pencil size={17} className="mr-2" />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-10 rounded-2xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950"
          >
            <Trash2 size={17} className="mr-2" />
            Delete
          </Button>
        </div>
      </article>
    );
  };

  const isEditingQuestionBankItem = editingQuestionBankItem !== null;
  const addQuestionBankModal = isAddQuestionBankModalOpen ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-[1px]"
      onClick={closeAddQuestionBankModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-question-bank-title"
        className="flex max-h-[92vh] w-full max-w-[1128px] flex-col overflow-hidden rounded-[16px] border border-white/80 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.32)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-7 pb-4 pt-7 sm:px-8">
          <div>
            <h2 id="add-question-bank-title" className="text-[30px] font-bold leading-tight text-slate-950">
              {isEditingQuestionBankItem ? 'Edit question' : 'Add question to bank'}
            </h2>
            <p className="mt-1 text-[18px] leading-7 text-slate-600">
              {isEditingQuestionBankItem
                ? 'Update this question and its answer.'
                : 'Manually add a question to the question bank, chapter-wise.'}
            </p>
          </div>
          <button
            type="button"
            onClick={closeAddQuestionBankModal}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close dialog"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-7 pb-5 sm:px-8">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                Chapter <span className="text-rose-500">*</span>
              </Label>
              <Select value={manualQuestionChapterId} onValueChange={(value) => updateManualQuestionChapter(value ?? '')}>
                <SelectTrigger className="h-[50px] rounded-[7px] border-slate-300 bg-white px-4 text-[17px] text-slate-900 shadow-none">
                  <SelectValue>{manualQuestionChapter?.title ?? 'Select a chapter'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {questionBankChapterOptions.map((chapter) => (
                    <SelectItem key={chapter.id} value={chapter.id}>
                      {chapter.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                Concept <span className="text-rose-500">*</span>
              </Label>
              <Select value={manualQuestionConcept} onValueChange={(value) => setManualQuestionConcept(value ?? '')}>
                <SelectTrigger className="h-[50px] rounded-[7px] border-slate-300 bg-white px-4 text-[17px] text-slate-900 shadow-none">
                  <SelectValue>{manualQuestionConcept || 'Select a concept'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {manualQuestionConceptOptions.map((concept) => (
                    <SelectItem key={concept} value={concept}>
                      {concept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(180px,1fr)]">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                Question Type <span className="text-rose-500">*</span>
              </Label>
              <Select value={manualQuestionType} onValueChange={updateManualQuestionType}>
                <SelectTrigger className="h-[50px] rounded-[7px] border-slate-300 bg-white px-4 text-[17px] text-slate-900 shadow-none">
                  <SelectValue>{manualQuestionType}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="manual-question-marks" className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                Marks
              </Label>
              <Input
                id="manual-question-marks"
                inputMode="numeric"
                value={manualQuestionMarks}
                onChange={(event) => {
                  setManualQuestionMarks(event.target.value.replace(/[^\d]/g, ''));
                  setManualQuestionError('');
                }}
                className="h-[50px] rounded-[7px] border-slate-300 px-4 text-[17px] text-slate-900 shadow-none"
              />
            </div>
          </div>

          <div className="mt-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="manual-question-text" className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                Question Text <span className="text-rose-500">*</span>
              </Label>
              <AiFieldAssistant
                value={manualQuestionText}
                onApply={(next) => {
                  setManualQuestionText(next);
                  setManualQuestionError('');
                }}
                fieldType="question"
                label="Question text"
                module="course-master"
                page="Chapter question bank"
                entityType="question"
              />
            </div>
            <Textarea
              id="manual-question-text"
              value={manualQuestionText}
              onChange={(event) => {
                setManualQuestionText(event.target.value);
                setManualQuestionError('');
              }}
              placeholder="Enter the question"
              className="min-h-[106px] rounded-[7px] border-slate-300 px-4 py-3 text-[17px] text-slate-900 placeholder:text-slate-400 shadow-none"
            />
          </div>

          {manualQuestionType === 'MCQ' ? (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Options - Mark the correct answer
              </p>
              <div className="mt-3 space-y-3">
                {QUESTION_OPTION_LABELS.map((label) => (
                  <div key={label} className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-4">
                    <span className="text-sm font-bold text-slate-600">{label}</span>
                    <Input
                      value={manualQuestionOptions[label]}
                      onChange={(event) => {
                        setManualQuestionOptions((current) => ({
                          ...current,
                          [label]: event.target.value,
                        }));
                        setManualQuestionError('');
                      }}
                      placeholder={`Option ${label}`}
                      className="h-[50px] rounded-[7px] border-slate-300 px-4 text-[17px] text-slate-900 placeholder:text-slate-400 shadow-none"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 max-w-[350px] space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                  Correct Option
                </Label>
                <Select
                  value={manualCorrectOption}
                  onValueChange={(value) => setManualCorrectOption((value || 'A') as QuestionOptionLabel)}
                >
                  <SelectTrigger className="h-[50px] rounded-[7px] border-slate-300 bg-white px-4 text-[17px] text-slate-900 shadow-none">
                    <SelectValue>
                      {manualQuestionOptions[manualCorrectOption].trim()
                        ? `${manualCorrectOption} · ${manualQuestionOptions[manualCorrectOption].trim()}`
                        : manualCorrectOption}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {QUESTION_OPTION_LABELS.map((label) => (
                      <SelectItem key={label} value={label}>
                        {manualQuestionOptions[label].trim()
                          ? `${label} · ${manualQuestionOptions[label].trim()}`
                          : label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="manual-model-answer" className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                  Model Answer
                </Label>
                <AiFieldAssistant
                  value={manualModelAnswer}
                  onApply={setManualModelAnswer}
                  fieldType="explanation"
                  label="Model answer"
                  module="course-master"
                  page="Chapter question bank"
                  entityType="question"
                  // The question is the thing the answer must actually answer, so it
                  // travels with the request rather than leaving the model to guess.
                  related={{ "Question": manualQuestionText }}
                />
              </div>
              <Textarea
                id="manual-model-answer"
                value={manualModelAnswer}
                onChange={(event) => setManualModelAnswer(event.target.value)}
                placeholder="Enter the model answer"
                className="min-h-[118px] rounded-[7px] border-slate-300 px-4 py-3 text-[17px] text-slate-900 placeholder:text-slate-400 shadow-none"
              />
            </div>
          )}

          {manualQuestionError ? (
            <p className="mt-5 rounded-[8px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {manualQuestionError}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-4 border-t border-slate-200/90 px-7 py-4 sm:px-8">
          <button
            type="button"
            onClick={closeAddQuestionBankModal}
            className="h-11 px-3 text-[16px] font-semibold text-slate-600 transition-colors hover:text-slate-950"
          >
            Cancel
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--primary ds-btn--md inline-flex h-11 items-center gap-2 rounded-xl bg-[#4f46e5] px-6 text-[16px] font-bold text-white shadow-[0_8px_18px_rgba(79,70,229,0.32)] transition-colors hover:bg-[#4338ca]"
            onClick={submitManualQuestion}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ds-icon"
              aria-hidden="true"
              style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle' }}
            >
              <path d="M20 6 9 17l-5-5"></path>
            </svg>
            <span className="ds-btn__label">
              <span className="sc-interp">
                {isEditingQuestionBankItem ? 'Save changes' : 'Add to bank'}
              </span>
            </span>
          </button>
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
        className="relative max-h-[90vh] w-full max-w-[800px] overflow-hidden rounded-[20px] border border-white/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="max-h-[90vh] overflow-y-auto px-6 pb-6 pt-6 sm:px-8">
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
            {questionGenerationError ? (
              <p className="rounded-[10px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {questionGenerationError}
              </p>
            ) : null}
            {questionGenerationSuccess ? (
              <p className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {questionGenerationSuccess}
              </p>
            ) : null}
            {generatedQuestionPreviews.length > 0 ? (
              <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Generated questions
                  </p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    {generatedQuestionPreviews.length} saved
                  </span>
                </div>
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {generatedQuestionPreviews.map(renderGeneratedQuestionPreview)}
                </div>
              </div>
            ) : null}
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
              onClick={submitGenerateQuestions}
              disabled={!canGenerateQuestions}
              aria-busy={isGeneratingQuestions}
              className="h-10 rounded-xl bg-[#aea8ff] px-5 text-[15px] font-semibold text-white shadow-[0_8px_18px_rgba(99,91,255,0.28)] hover:bg-[#978fff] disabled:bg-[#d7d2ff] disabled:text-white/85 disabled:shadow-none"
            >
              <Sparkles size={16} className="mr-2" />
              {isGeneratingQuestions ? 'Generating...' : 'Generate questions'}
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
                Slides are drafted with <span className="font-semibold text-slate-900">AI</span> from concept intelligence, then added to your content library.
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
            Generate with AI
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

  if (view === 'question-bank') {
    const questionCountLabel = questionBankLoading
      ? 'Loading questions…'
      : questionBankError
        ? 'Error loading questions'
        : `${filteredQuestionBankItems.length} of ${questionBankItems.length} questions`;

    return (
      <div className="min-h-screen rounded-t-3xl bg-[#E9EEF7]">
        <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-9">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <button
              type="button"
              onClick={() => router.push('/course-master')}
              className="inline-flex items-center gap-2 font-medium text-[#34489a] transition-colors hover:text-[#1f2f76]"
            >
              <BookOpen size={16} />
              Teach / learn
            </button>
            <ChevronRight size={14} className="text-slate-400" />
            <button
              type="button"
              onClick={() => router.push(`/course-master/${course.id}/chapters`)}
              className="font-medium transition-colors hover:text-slate-900"
            >
              Chapters
            </button>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="font-bold text-slate-950">Question bank</span>
          </div>

          <div className="mb-6">
            <h1 className="text-[24px] font-bold tracking-tight text-slate-950">Question bank</h1>
            <p className="mt-2 text-[16px] leading-7 text-slate-700">
              View and manage questions & answers. Correct options are highlighted; narrative questions show a model answer. Use Add question to build the bank chapter-wise.
            </p>
          </div>

          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <p className={`text-[16px] font-medium ${questionBankError ? 'text-rose-600' : 'text-slate-700'}`}>
              {questionCountLabel}
            </p>

            <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-[225px_275px_215px_auto]">
              <Select
                value={questionBankChapterFilter}
                onValueChange={(value) => {
                  setQuestionBankChapterFilter(value ?? 'all');
                  setQuestionBankConceptFilter('all');
                }}
              >
                <SelectTrigger className="h-10 rounded-[8px] border-slate-300 bg-white px-4 text-[16px] text-slate-900 shadow-sm">
                  <SelectValue>
                    {questionBankChapterFilter === 'all'
                      ? 'All Chapters'
                      : questionBankChapterOptions.find((chapter) => chapter.id === questionBankChapterFilter)
                          ?.title ?? 'All Chapters'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Chapters</SelectItem>
                  {questionBankChapterOptions.map((chapter) => (
                    <SelectItem key={chapter.id} value={chapter.id}>
                      {chapter.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={effectiveQuestionBankConceptFilter}
                onValueChange={(value) => setQuestionBankConceptFilter(value ?? 'all')}
              >
                <SelectTrigger className="h-10 rounded-[8px] border-slate-300 bg-white px-4 text-[16px] text-slate-900 shadow-sm">
                  <SelectValue>
                    {effectiveQuestionBankConceptFilter === 'all'
                      ? 'All Concepts'
                      : questionBankConceptOptions.find((concept) => concept === effectiveQuestionBankConceptFilter)
                          ?? 'All Concepts'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Concepts</SelectItem>
                  {questionBankConceptOptions.map((concept) => (
                    <SelectItem key={concept} value={concept}>
                      {concept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={questionBankTypeFilter} onValueChange={(value) => setQuestionBankTypeFilter(value ?? 'all')}>
                <SelectTrigger className="h-10 rounded-[8px] border-slate-300 bg-white px-4 text-[16px] text-slate-900 shadow-sm">
                  <SelectValue>
                    {questionBankTypeFilter === 'all' ? 'All Types' : questionBankTypeFilter}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {QUESTION_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                onClick={openQuestionBankAddQuestion}
                disabled={questionBankItems.length === 0 || questionBankLoading}
                className="h-10 rounded-xl bg-[#4f46e5] px-5 text-[15px] font-bold text-white shadow-[0_8px_18px_rgba(79,70,229,0.35)] hover:bg-[#4338ca] disabled:bg-[#c6c3f8] disabled:text-white"
              >
                <Plus size={18} className="mr-2" />
                Add question
              </Button>
            </div>
          </div>

          {questionBankLoading ? (
            <div className="rounded-[8px] border border-slate-200 bg-white px-5 py-12 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-600">Loading questions for the selected chapter…</p>
            </div>
          ) : questionBankError ? (
            <div className="rounded-[8px] border border-rose-200 bg-rose-50 px-5 py-12 text-center shadow-sm">
              <h2 className="text-lg font-bold text-rose-900">Unable to load questions</h2>
              <p className="mt-2 text-sm text-rose-700">{questionBankError}</p>
              <button
                type="button"
                onClick={() => loadQuestionBankItems(questionBankChapterFilter)}
                className="mt-4 inline-flex items-center rounded-lg bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-200"
              >
                Retry
              </button>
            </div>
          ) : groupedQuestionBankItems.length === 0 ? (
            <div className="rounded-[8px] border border-slate-200 bg-white px-5 py-12 text-center shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">No questions found</h2>
              <p className="mt-2 text-sm text-slate-500">
                Change the filters or add a question for the selected chapter.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedQuestionBankItems.map((group) => (
                <section key={group.id}>
                  <div className="mb-4 flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                      <Lightbulb size={20} className="shrink-0 text-[#4f46e5]" />
                      <h2 className="min-w-0 text-[20px] font-bold leading-7 text-slate-950">
                        {group.conceptTitle}
                      </h2>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
                        {group.category}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-slate-600">
                      {group.questions.length} question{group.questions.length === 1 ? '' : 's'}
                    </p>
                  </div>

                  <div className="space-y-5">
                    {group.questions.map(renderQuestionBankQuestion)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {addQuestionBankModal}
        {generateQuestionsModal}
      </div>
    );
  }

  if (view === 'concept-intelligence') {
    const gradeLabel = getCourseClassroomLabel(course.id, course.classGrade);
    const intelChapter = allChapters.find((chapter) => chapter.id === activeChapterId) ?? null;
    const conceptRows = intelChapter
      ? Object.keys(intelChapter.content_categories ?? {}).filter((concept) => concept.trim())
      : [];
    const requestedConceptIndex = Number(searchParams?.get('concept') ?? '0');
    const conceptIndex =
      conceptRows.length > 0
        ? Math.min(
            Math.max(
              Number.isFinite(requestedConceptIndex) ? Math.trunc(requestedConceptIndex) : 0,
              0
            ),
            conceptRows.length - 1
          )
        : 0;
    const conceptTitle = conceptRows[conceptIndex] ?? '';

    const fetchedSemantic = intelChapter ? chapterIntelligence[intelChapter.id] : undefined;
    const chapterForIntel =
      intelChapter && fetchedSemantic
        ? { ...intelChapter, semantic: fetchedSemantic }
        : intelChapter;
    const isIntelligenceLoading =
      intelChapter !== null && intelligenceLoadingId === intelChapter.id && !fetchedSemantic;
    const hasIntelligenceError = Boolean(intelligenceError) && !fetchedSemantic;

    const conceptsList = (fetchedSemantic?.full_intelegance_json?.concepts ??
      []) as ConceptIntelEntry[];
    const rawEntry =
      conceptsList.find((item) => (item?.concept?.concept_name ?? '') === conceptTitle) ??
      conceptsList[conceptIndex] ??
      null;

    const details =
      chapterForIntel && conceptTitle ? getConceptIntelligence(chapterForIntel, conceptTitle) : null;
    const detailSections = details
      ? [
          { title: 'Knowledge', icon: BookOpen, items: details.knowledge, kind: 'cards' as const },
          { title: 'Abilities', icon: Lightbulb, items: details.abilities, kind: 'cards' as const },
          { title: 'Skills', icon: WandSparkles, items: details.skills, kind: 'tags' as const },
          { title: 'Misconceptions', icon: TriangleAlert, items: details.misconceptions, kind: 'cards' as const },
          { title: 'Prerequisites', icon: Orbit, items: details.prerequisites, kind: 'tags' as const },
          { title: 'Learning outcomes', icon: Target, items: details.learningOutcomes, kind: 'cards' as const },
          { title: 'Competencies', icon: BriefcaseBusiness, items: details.competencies, kind: 'cards' as const },
          { title: 'Learning objectives', icon: CircleDot, items: details.learningObjectives, kind: 'cards' as const },
          { title: 'Teaching pedagogies', icon: ClipboardList, items: details.teachingPedagogies, kind: 'tags' as const },
          { title: 'Real-world applications', icon: GraduationCap, items: details.realWorldApplications, kind: 'cards' as const },
        ]
      : [];

    const goToConcept = (index: number) => {
      if (!intelChapter || index < 0 || index >= conceptRows.length) return;
      router.replace(buildConceptIntelligenceUrl(intelChapter.id, index));
    };

    const backToChapters = () => {
      const nextParams = new URLSearchParams(searchParams?.toString());
      nextParams.delete('view');
      nextParams.delete('concept');
      nextParams.delete('chapterId');
      const nextQuery = nextParams.toString();
      router.push(`/course-master/${courseId}/chapters${nextQuery ? `?${nextQuery}` : ''}`);
    };

    const conceptPager =
      conceptRows.length > 0 ? (
        <div className="flex shrink-0 items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={conceptIndex <= 0}
            onClick={() => goToConcept(conceptIndex - 1)}
            className="h-10 rounded-xl border-slate-200 bg-white px-4 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft size={16} className="mr-1.5" />
            Previous
          </Button>
          <span className="whitespace-nowrap text-sm font-medium text-slate-500">
            {conceptIndex + 1} of {conceptRows.length}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={conceptIndex >= conceptRows.length - 1}
            onClick={() => goToConcept(conceptIndex + 1)}
            className="h-10 rounded-xl border-slate-200 bg-white px-4 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Next
            <ChevronRight size={16} className="ml-1.5" />
          </Button>
        </div>
      ) : null;

    return (
      <div className="min-h-full">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <button
              type="button"
              onClick={backToChapters}
              className="font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              Teach / learn
            </button>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="font-medium text-slate-500">
              {course.subject} - {gradeLabel}
            </span>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="font-medium text-slate-500">{intelChapter?.title ?? 'Chapter'}</span>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="font-semibold text-[#4f46e5]">Concept Intelligence</span>
          </div>

          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={backToChapters}
                aria-label="Back to chapters"
                className="h-10 w-10 shrink-0 rounded-xl border-slate-200 bg-white p-0 text-slate-600 hover:bg-slate-50"
              >
                <ArrowLeft size={17} />
              </Button>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {conceptTitle || 'Concept Intelligence'}
                </h1>
              </div>
            </div>

            {conceptPager}
          </div>

          {/* Fixed-height card: clamped to the viewport so switching tabs never
              resizes the layout — content scrolls inside instead. The card itself
              carries no padding; each region (tab band / body / footer) manages
              its own, matching the app's card pattern. */}
          <div className="flex h-[max(420px,calc(100vh_-_260px))] flex-col overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
            {!intelChapter ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <TriangleAlert size={24} className="text-amber-500" />
                <p className="text-sm font-medium text-slate-600">
                  Chapter not found. Go back and pick a concept from the chapter list.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={backToChapters}
                  className="mt-1 h-10 rounded-xl border-slate-200 bg-white px-4 font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Back to chapters
                </Button>
              </div>
            ) : isIntelligenceLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#4f46e5]" />
                <p className="text-sm font-medium text-slate-500">Loading concept intelligence…</p>
              </div>
            ) : hasIntelligenceError ? (
              <div className="m-5 flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center sm:m-6">
                <TriangleAlert size={22} className="text-amber-500" />
                <p className="max-w-[420px] text-sm font-medium text-slate-600">{intelligenceError}</p>
              </div>
            ) : rawEntry ? (
              <div className="min-h-0 flex-1">
                <ConceptIntelligenceTabs
                  key={`${intelChapter.id}-${conceptTitle}`}
                  entry={rawEntry}
                  chapterTitle={intelChapter.title}
                />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                <div className="mb-6 grid gap-4 lg:grid-cols-4">
                  {[
                    { label: 'Knowledge', value: details?.knowledge.length ?? 0 },
                    { label: 'Objectives', value: details?.learningObjectives.length ?? 0 },
                    { label: 'Outcomes', value: details?.learningOutcomes.length ?? 0 },
                    { label: 'Skills', value: details?.skills.length ?? 0 },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 shadow-sm"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {metric.label}
                      </p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{metric.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
                {detailSections.map((section) => {
                  const SectionIcon = section.icon;
                  const visibleItems = section.kind === 'tags' ? section.items.slice(0, 10) : section.items.slice(0, 4);
                  const hiddenCount = Math.max(section.items.length - visibleItems.length, 0);

                  return (
                    <section key={section.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        <SectionIcon size={14} className="text-slate-500" />
                        {section.title}
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {section.items.length}
                        </span>
                      </div>

                      {section.kind === 'cards' ? (
                        <div className="space-y-3">
                          {visibleItems.map((item, index) => (
                            <article
                              key={`${section.title}-${index}-${item}`}
                              className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                            >
                              <div className="mb-2 flex items-center gap-2">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                                  {index + 1}
                                </span>
                                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  {section.title.slice(0, -1) || section.title}
                                </span>
                              </div>
                              <p className="text-[15px] leading-6 text-slate-800">{item}</p>
                            </article>
                          ))}
                          {hiddenCount > 0 && (
                            <p className="text-xs font-medium text-slate-500">
                              +{hiddenCount} more {section.title.toLowerCase()} available in the detailed concept intelligence tab view.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {visibleItems.map((item) => (
                            <Badge
                              key={item}
                              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                            >
                              {item}
                            </Badge>
                          ))}
                          {hiddenCount > 0 ? (
                            <Badge className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200 hover:bg-white">
                              +{hiddenCount} more
                            </Badge>
                          ) : null}
                        </div>
                      )}
                    </section>
                  );
                })}
                </div>
              </div>
            )}
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
              <span className="font-semibold text-[#4f46e5]">{contentResourceLabel}</span>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  {contentResourceLabel} - {course.subject} - {gradeLabel}
                </h1>
                <p className="mt-2 text-slate-600">
                  Generate presentations with AI, upload videos, notes and PDFs, and manage the content library for{' '}
                  <span className="font-semibold text-slate-900">{activeChapterTitle}</span>.
                </p>
              </div>

              {contentResourceType === 'teacher' && (
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={openGeneratePresentationDrawer}
                    className="h-11 rounded-2xl bg-[#4f46e5] px-5 font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,0.28)] hover:bg-[#4338ca]"
                  >
                    <Sparkles size={16} className="mr-2" />
                    Generate content
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
              )}
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
                  <Select
                    value={selectedLibraryChapterId}
                    onValueChange={(value) => {
                      const nextChapterId = value ?? '';
                      setSelectedLibraryChapterId(nextChapterId);
                      if (nextChapterId) {
                        const nextParams = new URLSearchParams(searchParams?.toString());
                        nextParams.set('chapterId', nextChapterId);
                        nextParams.set('expandedChapterId', nextChapterId);
                        router.replace(`/course-master/${courseId}/chapters?${nextParams.toString()}`);
                      }
                    }}
                  >
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
                  <p className="text-sm font-medium text-slate-600">Generated with AI</p>
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
              {CONTENT_LIBRARY_TABS.filter(
                (tab) =>
                  contentResourceType !== 'teacher' ||
                  !(['Videos', 'Revision notes', 'Classroom activity'] as const).includes(
                    tab as 'Videos' | 'Revision notes' | 'Classroom activity'
                  )
              ).map((tab) => (
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
            {contentLoading ? 'Loading content…' : `${filteredChapterContentItems.length} items in ${activeChapterTitle}`}
          </p>

          {contentError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {contentError}
            </div>
          ) : contentLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-72 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : filteredChapterContentItems.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">
              No content is available for this chapter.
            </div>
          ) : contentGroupBy === 'Concept wise' ? (() => {
              const groups = new Map<string, { title: string; items: ChapterContentItem[] }>();
              filteredChapterContentItems.forEach((item) => {
                const key = item.conceptId ?? 'unknown';
                const title = item.conceptTitle || 'Unnamed concept';
                const existing = groups.get(key);
                if (existing) {
                  existing.items.push(item);
                } else {
                  groups.set(key, { title, items: [item] });
                }
              });
              const groupEntries = Array.from(groups.entries()).map(([key, value]) => ({ key, ...value }));
              return (
                <div className="space-y-10">
                  {groupEntries.map((group) => (
                    <section key={group.key}>
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                          <Brain size={16} className="text-[#4f46e5]" />
                        </div>
                        <h2 className="text-[20px] font-bold leading-7 text-slate-950">{group.title}</h2>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
                          {group.items.length} item{group.items.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {group.items.map((item) => {
                          const PreviewIcon = getContentPreviewIcon(item.preview);
                          return (
                            <article
                              key={item.id}
                              className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_6px_22px_rgba(15,23,42,0.05)]"
                            >
                              <div className="flex h-[132px] items-start justify-between border-b border-slate-200/70 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-3">
                                <span className="inline-flex rounded-full bg-[#eef2ff] px-2.5 py-1 text-[11px] font-semibold text-[#4f46e5]">
                                  {truncateToWords(item.subtitle, 150)}
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
                                <div className="mt-4 flex items-center justify-between border-t border-slate-200/80 pt-4">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleOpenContent(item);
                                    }}
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
                    </section>
                  ))}
                </div>
              );
            })() : (
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
                          {truncateToWords(item.subtitle, 150)}
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

                        <div className="mt-4 flex items-center justify-between border-t border-slate-200/80 pt-4">
                          
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenContent(item);
                            }}
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
            )}

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

                    {selectedContentItem.subtitle ? (
                      <p className="mt-4 text-sm leading-7 text-slate-600">{selectedContentItem.subtitle}</p>
                    ) : null}

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

                    {selectedContentItem.contentUrl ? (
                      <a
                        href={selectedContentItem.contentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-6 inline-flex h-10 items-center rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#4338ca]"
                      >
                        {isVideoContent ? 'Play content' : 'Open content'}
                      </a>
                    ) : null}

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
          <GeneratePresentationDrawer
            isOpen={isGeneratePresentationDrawerOpen}
            onClose={closeGeneratePresentationDrawer}
            allChapters={allChapters}
            courseId={course.id}
            course={course}
            initialChapterId={activeLibraryChapter?.id ?? contentChapter?.id ?? ''}
            initialConcept={activeLibraryChapterConcepts?.concepts[0]?.title ?? ''}
            onSuccess={handleGenerateSuccess}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen rounded-t-3xl">
      <div className="mx-auto w-full max-w-[1460px] px-4 py-7 sm:px-6 lg:px-8 ">
        {successMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
            <CheckCircle2 size={16} className="shrink-0" />
            {successMessage}
          </div>
        )}
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
                {course.subject} - {getCourseGradeLabel(course.classGrade)} 
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
                      onClick={() => openChapterContentView(chapter, 'classroom')}
                      className="h-10 shrink-0 rounded-xl border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                    >
                      <FolderOpen size={16} className="mr-2" />
                      Classroom Resource
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openChapterContentView(chapter, 'teacher')}
                      className="h-10 shrink-0 rounded-xl border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                    >
                      <FolderOpen size={16} className="mr-2" />
                      Teacher Resource
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openQuestionBankView(chapter)}
                      className="h-10 shrink-0 rounded-xl border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                    >
                      <Database size={16} className="mr-2" />
                      Question Bank
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        router.push(
                          `/h5p/html_contents?${new URLSearchParams({
                            chapter_id: String(chapter.id),
                            subject_id: String(subjectData?.subject?.subject_id ?? subjectId),
                            standard_id: String(subjectData?.subject?.standard_id ?? standardId ?? ''),
                            chapter_name: chapter.title,
                            subject_name: subjectData?.subject?.subject_name ?? course.subject,
                            standard_name: subjectData?.subject?.standard_name ?? getCourseGradeLabel(course.classGrade),
                          }).toString()}`
                        )
                      }
                      className="h-10 shrink-0 rounded-xl border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                    >
                      <Layers3 size={16} className="mr-2" />
                      H5P Content
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
                                onClick={() => openConceptIntelligenceView(chapter, index)}
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="chapter-description" className="text-sm font-medium text-slate-700">
                    Chapter Description
                  </Label>
                  <AiFieldAssistant
                    value={chapterForm.chapterDescription}
                    onApply={(next) =>
                      setChapterForm((prev) => ({ ...prev, chapterDescription: next }))
                    }
                    fieldType="description"
                    label="Chapter description"
                    module="course-master"
                    page="Chapters"
                    entityType="chapter"
                    related={{ "Chapter name": chapterForm.chapterName ?? '' }}
                  />
                </div>
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
