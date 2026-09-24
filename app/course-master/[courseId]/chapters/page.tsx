//
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { usePermission } from '@/app/hooks/usePermission';
import {
  ArrowLeft,
  Download,
  Network,
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
  AlertTriangle,
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
  Play,
  FolderOpen,
  Database,
  Layers3,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { fetchHub, type H5pHubModule } from '@/app/h5p/data/h5p-model';
import {
  H5P_ROUTE_MAP,
  h5pContextQuery,
  createTextActivity,
  type H5pContext,
  type TextActivityType,
} from '@/app/h5p/data/h5p';
import { trueFalseApi, singleChoiceSetApi, memoryGameApi, arithmeticQuizApi } from '@/app/h5p/data/h5p-content-types';
import {
  TrueFalseEditor,
  emptyTrueFalseState,
  trueFalseToPayload,
  validateTrueFalseState,
  type TrueFalseEditorState,
} from '@/app/h5p/h5p_true_false/components/editor';
import {
  SingleChoiceSetEditor,
  emptySingleChoiceState,
  singleChoiceToPayload,
  validateSingleChoiceState,
  type SingleChoiceSetEditorState,
} from '@/app/h5p/h5p_single_choice_set/components/editor';
import {
  MemoryGameEditor,
  emptyMemoryState,
  memoryToPayload,
  validateMemoryState,
  type MemoryGameEditorState,
} from '@/app/h5p/h5p_memory_game/components/editor';
import {
  TextActivityEditor,
  emptyEditorState as emptyTextActivityState,
  toSavePayload as textActivityToPayload,
  validateEditorState as validateTextActivityState,
  type TextActivityEditorState,
} from '@/app/h5p/text_activity/components/editor';
import {
  ArithmeticQuizEditor,
  emptyArithmeticState,
  arithmeticToPayload,
  validateArithmeticState,
  type ArithmeticQuizEditorState,
} from '@/app/h5p/h5p_arithmetic_quiz/components/editor';
import { ContentCard } from './ContentCard';
import { AiFieldAssistant } from '@/components/ai/AiFieldAssistant';
import { resolveViewableContentUrl } from '@/app/course-master/data/content-links';
import { extractGeneratedBodyHtml, sanitizeGeneratedHtml } from '@/app/course-master/data/generated-html';
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
import { type Course } from '../../data/courses';
import {
  fetchChapterContent,
  fetchSemanticIntelligenceResult,
  generateIntelligenceQuestions,
  type IntelligenceBloomLevel,
  getConceptIntelligenceData,
  getSubjectAndChapters,
  resolveSubjectDisplayName,
  deleteQuestionBankQuestion,
  createQuestionBankQuestion,
  updateQuestionBankQuestion,
  reviewQuestionBankQuestion,
  fetchQuestionTypeCatalog,
  type QuestionTypeCatalogEntry,
  fetchQuestionBankFacets,
  EMPTY_QUESTION_BANK_FACETS,
  type QuestionBankFacets,
  type CountedOption,
  uploadChapterContent,
  type ChapterContentAsset,
  type ChapterSemantic,
  type ConceptIntelEntry,
  type GeneratedQuestionPreview,
  type SubjectWithChapters,
} from '../../data/chapters';
import {
  fetchMappedQuestionBank,
  groupQuestionBankItems,
  questionBankCategoryLabel,
  QUESTION_BANK_CATEGORIES,
  type QuestionBankItem,
  type QuestionBankChapterRef,
  type QuestionBankQuestionType,
} from '../../data/questionBank';
import { QuestionBankQuestionCard } from '@/app/components/questionBank/QuestionBankQuestionCard';
import { QuestionBankFilterBar } from '@/app/components/questionBank/QuestionBankFilterBar';
import { groupConceptsByTopic, type TopicGroup } from '../../data/chapterTopics';
import { ConceptIntelligenceTabs } from './ConceptIntelligenceTabs';
import {
  GroundingPanel,
  PipelineStream,
  RunTelemetryStrip,
  useStaggeredReveal,
  type GroundingSource,
  type RunTelemetry,
  type StreamPhase,
} from './GenerationPipeline';
import { getRequestContext, getSyear } from '../../page';
import { getChapterKeyConcepts } from '../../data/chapterKeyConcepts';
import type { ChapterKeyConceptGroup } from '../../data/chapterKeyConcepts';
import { useCurriculumMeta } from '../../data/curriculum';
import type { Chapter } from '../../data/chapters';
import type { LmsSubject } from '../../data/lmsCourses';
import { GeneratePresentationDrawer } from './sideDrawer';
import { persistPalConceptContext } from '@/app/pal/_components/PalContextBootstrap';

/**
 * Loaded on demand: the map pulls in @xyflow/react, which no other view on this
 * page needs. `ssr: false` because the canvas measures the DOM on mount and this
 * page is client-rendered anyway.
 *
 * The folder is underscore-prefixed so the App Router treats it as colocated files
 * rather than a `/coherence-map` route segment — without that, its `graphLayout`
 * module was being validated as a route layout.
 */
const CoherenceMapView = dynamic(() => import('./_coherence-map/CoherenceMapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center rounded-[14px] border border-slate-200 bg-white text-sm text-slate-500">
      Loading the coherence map…
    </div>
  ),
});

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

/**
 * The Bloom ladder the generator works to, mirroring BLOOM_META in
 * App\Services\QuestionGenerationService. `weight` is that service's own default
 * distribution, used here only to seed the table when a teacher switches from
 * Auto to a custom mix, so "custom" starts from what the server would have done
 * rather than from zeros.
 *
 * Difficulty and marks are the server's defaults per level and are editable:
 * both are honoured when a quota is sent. MCQ marks are not - the service pins
 * every MCQ to 1 mark - so that column is hidden for MCQ.
 */
const BLOOM_LEVEL_META: ReadonlyArray<{
  level: IntelligenceBloomLevel;
  difficulty: string;
  points: number;
  weight: number;
}> = [
  { level: 'Remember', difficulty: 'Easy', points: 1, weight: 0.15 },
  { level: 'Understand', difficulty: 'Easy', points: 2, weight: 0.3 },
  { level: 'Apply', difficulty: 'Medium', points: 3, weight: 0.3 },
  { level: 'Analyze', difficulty: 'Hard', points: 4, weight: 0.15 },
  { level: 'Evaluate', difficulty: 'Hard', points: 5, weight: 0.1 },
  { level: 'Create', difficulty: 'Hard', points: 5, weight: 0 },
];

const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'] as const;

type BloomCounts = Record<IntelligenceBloomLevel, number>;
type BloomDifficulties = Record<IntelligenceBloomLevel, string>;
type BloomPoints = Record<IntelligenceBloomLevel, number>;

const EMPTY_BLOOM_COUNTS = BLOOM_LEVEL_META.reduce((counts, meta) => {
  counts[meta.level] = 0;
  return counts;
}, {} as BloomCounts);

const DEFAULT_BLOOM_DIFFICULTIES = BLOOM_LEVEL_META.reduce((map, meta) => {
  map[meta.level] = meta.difficulty;
  return map;
}, {} as BloomDifficulties);

const DEFAULT_BLOOM_POINTS = BLOOM_LEVEL_META.reduce((map, meta) => {
  map[meta.level] = meta.points;
  return map;
}, {} as BloomPoints);

/**
 * Split `total` across the Bloom levels by weight, largest-remainder style, so
 * the parts always add back up to the total instead of drifting on rounding.
 */
function suggestedBloomCounts(total: number): BloomCounts {
  if (!Number.isFinite(total) || total <= 0) return { ...EMPTY_BLOOM_COUNTS };

  const exact = BLOOM_LEVEL_META.map((meta) => ({ level: meta.level, value: total * meta.weight }));
  const counts = { ...EMPTY_BLOOM_COUNTS };
  exact.forEach((entry) => {
    counts[entry.level] = Math.floor(entry.value);
  });

  let remaining = total - Object.values(counts).reduce((sum, value) => sum + value, 0);
  const byRemainder = [...exact]
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - Math.floor(b.value) - (a.value - Math.floor(a.value)));

  let index = 0;
  while (remaining > 0 && byRemainder.length > 0) {
    counts[byRemainder[index % byRemainder.length].level] += 1;
    remaining -= 1;
    index += 1;
  }

  return counts;
}
const QUESTION_OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;
/** One-line explanation of what each type produces, shown on the type cards. */
const QUESTION_TYPE_BLURBS: Record<(typeof QUESTION_TYPE_OPTIONS)[number], string> = {
  MCQ: 'Four options with one correct answer. Distractors are built from the concept’s recorded misconceptions.',
  Narrative: 'Open-response items with a model answer and marking points, weighted per Bloom level.',
};

/** Common run sizes, offered as chips beside the free-text total. */
const QUESTION_COUNT_PRESETS = [5, 10, 15, 20] as const;

const QUESTION_TYPE_API_CONFIG: Record<
  (typeof QUESTION_TYPE_OPTIONS)[number],
  { question_type: 'mcq' | 'narrative'; question_type_id: number }
> = {
  MCQ: { question_type: 'mcq', question_type_id: 1 },
  Narrative: { question_type: 'narrative', question_type_id: 2 },
};

type ManualH5pTypeKey =
  | 'h5p_true_false'
  | 'h5p_single_choice_set'
  | 'h5p_blanks'
  | 'h5p_drag_text'
  | 'h5p_mark_the_words'
  | 'h5p_memory_game'
  | 'h5p_arithmetic_quiz'
  | 'h5p_drag_drop'
  | 'h5p_course_presentation';

/** The TextActivityEditor-backed keys, and which TextActivityType each is. */
const H5P_TEXT_ACTIVITY_TYPE: Partial<Record<ManualH5pTypeKey, TextActivityType>> = {
  h5p_blanks: 'fill_in_the_blanks',
  h5p_drag_text: 'drag_text',
  h5p_mark_the_words: 'mark_the_words',
};

interface ManualH5pOption {
  key: ManualH5pTypeKey;
  label: string;
  /** 'inline' authors right in this modal. 'redirect' has no modal-sized
   *  editor (a canvas or multi-slide deck) -- picking it shows a link out to
   *  its real full-page /create instead of an embedded form. */
  mode: 'inline' | 'redirect';
}

/**
 * Which H5P content types a question_type_catalog.code can be authored as,
 * mirrored from the backend's own App\Services\lms\H5P\QuestionBankSource::
 * TYPE_CODES (next_lms_erp) -- the real, already-vetted mapping the H5P
 * player screens use to pull bank questions, reversed here for authoring.
 * Every type the backend maps appears somewhere below: 'inline' where a
 * modal-ready editor exists, 'redirect' where it doesn't (h5p_drag_drop's
 * canvas, h5p_course_presentation's slide deck). h5p_mcq is the one
 * exception -- it has no authoring UI of its own at all, served live from
 * the bank already -- so it never appears here.
 */
const FORMAT_TO_H5P_TYPES: Record<string, ManualH5pOption[]> = {
  true_false: [{ key: 'h5p_true_false', label: 'True / False', mode: 'inline' }],
  mcq: [{ key: 'h5p_single_choice_set', label: 'Single Choice Set', mode: 'inline' }],
  assertion_reason: [{ key: 'h5p_single_choice_set', label: 'Single Choice Set', mode: 'inline' }],
  fill_blank: [
    { key: 'h5p_blanks', label: 'Fill in the Blanks', mode: 'inline' },
    { key: 'h5p_drag_text', label: 'Drag Text', mode: 'inline' },
    { key: 'h5p_mark_the_words', label: 'Mark the Words', mode: 'inline' },
  ],
  drag_text: [{ key: 'h5p_drag_text', label: 'Drag Text', mode: 'inline' }],
  mark_the_words: [{ key: 'h5p_mark_the_words', label: 'Mark the Words', mode: 'inline' }],
  numerical: [
    { key: 'h5p_blanks', label: 'Fill in the Blanks', mode: 'inline' },
    { key: 'h5p_arithmetic_quiz', label: 'Arithmetic Quiz', mode: 'inline' },
  ],
  match_following: [
    { key: 'h5p_memory_game', label: 'Memory Game', mode: 'inline' },
    { key: 'h5p_drag_drop', label: 'Drag & Drop', mode: 'redirect' },
  ],
  drag_drop: [{ key: 'h5p_drag_drop', label: 'Drag & Drop', mode: 'redirect' }],
  case_study: [{ key: 'h5p_course_presentation', label: 'Course Presentation', mode: 'redirect' }],
  case_study_parent: [{ key: 'h5p_course_presentation', label: 'Course Presentation', mode: 'redirect' }],
  case_study_child: [{ key: 'h5p_course_presentation', label: 'Course Presentation', mode: 'redirect' }],
  source_based_integrated: [{ key: 'h5p_course_presentation', label: 'Course Presentation', mode: 'redirect' }],
  competency_focused: [{ key: 'h5p_course_presentation', label: 'Course Presentation', mode: 'redirect' }],
  proof: [{ key: 'h5p_course_presentation', label: 'Course Presentation', mode: 'redirect' }],
  construction: [{ key: 'h5p_course_presentation', label: 'Course Presentation', mode: 'redirect' }],
};
const PRESENTATION_SLIDE_OPTIONS = ['8 slides', '10 slides', '12 slides', '15 slides', '18 slides'] as const;
const GAMMA_THEME_OPTIONS = ['EduERP default', 'Clean light', 'Bold classroom', 'Scholar blue'] as const;

/**
 * Shown on a control the user's role does not permit.
 *
 * Gated controls are DISABLED rather than hidden. 70-80% of teachers are expected
 * never to hold creation rights, and a silently absent button reads as a broken
 * product rather than as a permission boundary.
 */
const CONTENT_CREATE_DENIED_HINT =
  'Your role does not include content creation rights. Ask an administrator to enable them.';

/**
 * Tabs for the two library lanes.
 *
 * Both lanes were narrower than the data: Classroom had six tabs and Teacher
 * three, while content_master holds Remedial Class, Worksheet, Lesson Plan and
 * My Course rows with no tab to appear under - and Teacher Training alone is
 * 2,450 rows. Tabs whose count is zero for the chapter in view are hidden, so a
 * longer list does not mean more dead ends.
 */
const CONTENT_LIBRARY_TABS = [
  'All content',
  'Presentations',
  'Videos',
  'Revision notes',
  'Classroom activity',
  'Remedial class',
  'Worksheet',
  'Lesson plan',
  'My course',
  'H5P Interactive',
] as const;
/**
 * Teacher Workspace tabs.
 *
 * Shorter than the Classroom list on purpose. This lane only ever shows
 * teacher-training content, so of the eleven content types only 'Teacher
 * training' (2,450 rows), 'Teacher training presentation' (5) and the
 * audience-neutral H5P items can reach it. A Worksheet or Lesson plan tab here
 * would be permanently empty, so the missing tab this lane actually needed is
 * 'Teacher training' - 2,450 rows that previously had no tab of their own.
 */
const TEACHER_CONTENT_LIBRARY_TABS = [
  'All content',
  'Presentations',
  'Teacher training',
  'H5P Interactive',
] as const;

/** Any tab either lane can show. */
type ContentLibraryTab =
  | (typeof CONTENT_LIBRARY_TABS)[number]
  | (typeof TEACHER_CONTENT_LIBRARY_TABS)[number];

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
    helperText: 'PPT, PPTX or PDF Â· up to 100 MB',
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
    helperText: 'MP4, MOV or WEBM Â· up to 500 MB',
    maxSize: 500 * 1024 * 1024,
    extensions: ['mp4', 'mov', 'webm'],
    mimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
  },
  'Revision notes': {
    accept:
      '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    helperText: 'PDF, DOC or DOCX Â· up to 50 MB',
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
    helperText: 'PDF, PPT, PPTX or DOCX Â· up to 100 MB',
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

type ChapterContentType =
  | 'Classroom presentation'
  | 'Teacher training presentation'
  | 'Teacher training'
  | 'Revision notes'
  | 'Video'
  | 'PDF'
  | 'Classroom activity'
  | 'Remedial class'
  | 'Worksheet'
  | 'Lesson plan'
  | 'My course'
  | 'H5P Interactive';
type ChapterContentSource = 'Gamma AI' | 'Claude AI' | 'Uploaded';

/**
 * content_master.source values written by the Generate Content flow. It has used
 * more than one marker over time, so the badge matches against the whole set
 * rather than a single string.
 */
const GENERATED_CONTENT_SOURCES = ['gamma ai', 'aigenerated', 'claude ai'];

/**
 * Where a content row came from.
 *
 * Only an explicit generated marker counts as generated. Everything else is an
 * upload â€” including rows with no source at all, which predate the source column
 * being stamped and were created by the upload path.
 */
function resolveContentSource(source: string | null | undefined): ChapterContentSource {
  const normalized = (source ?? '').trim().toLowerCase();
  if (!GENERATED_CONTENT_SOURCES.includes(normalized)) return 'Uploaded';
  // Name the provider that actually wrote the row. Anything generated but not
  // Claude keeps the historical 'Gamma AI' label, including the legacy
  // 'aiGenerated' marker.
  return normalized === 'claude ai' ? 'Claude AI' : 'Gamma AI';
}

/** Was this row written by a generator, whichever one? */
function isGeneratedContent(source: ChapterContentSource): boolean {
  return source !== 'Uploaded';
}
type ChapterContentPreview = 'presentation' | 'notes' | 'video' | 'pdf' | 'activity';

interface ChapterContentItem {
  id: string;
  title: string;
  subtitle: string;
  chapterTitle: string;
  conceptTitle: string;
  contentCategory: string;
  conceptId: string | null;
  /**
   * Name of the mapped concept, from lms_concept via content_master.concept_id.
   * Null when the content has not been mapped to a concept. Kept separate from
   * `conceptTitle`, which holds the content category and drives grouping.
   */
  conceptName: string | null;
  type: ChapterContentType;
  source: ChapterContentSource;
  preview: ChapterContentPreview;
  actionLabel: 'Open' | 'Play';
  slideCount: number;
  statValue: string;
  updatedDate: string;
  updatedAt: string;
  contentUrl?: string;
  /**
   * Sanitised HTML of an AI-generated document, read from
   * content_master.description. Null for uploads and for the older Gamma/Gemini
   * rows, whose description holds the originating prompt rather than a document.
   */
  bodyHtml: string | null;
  /** Route of the existing H5P editor this item opens in. Only set for H5P items. */
  deepLink?: string;
  slides: {
    id: string;
    number: number;
    title: string;
  }[];
}

type QuestionOptionLabel = (typeof QUESTION_OPTION_LABELS)[number];

function getApiContentType(category: string, asset: ChapterContentAsset): ChapterContentType {
  const normalizedCategory = category.toLowerCase().replace(/[_\s]+/g, ' ').trim();
  const contentCategory = (asset.content_category ?? '').toLowerCase().replace(/[_\s]+/g, ' ').trim();
  const contentLabel = `${normalizedCategory} ${contentCategory} ${asset.file_type ?? ''} ${asset.title}`.toLowerCase();

  // The category is authoritative when it names a type outright, so it is tested
  // before anything that sniffs a filename or a title. These four categories had
  // no case at all and fell through to the 'Revision notes' default, which
  // mislabelled 12,965 rows - every Remedial Class, Worksheet, Lesson Plan and
  // My Course row in the table - and left them with no tab to appear under.
  if (contentCategory === 'remedial class') return 'Remedial class';
  if (contentCategory === 'worksheet') return 'Worksheet';
  if (contentCategory === 'lesson plan') return 'Lesson plan';
  if (contentCategory === 'my course') return 'My course';
  // 'Teacher Training' is the bulk category (2,450 rows) and is distinct from
  // 'Teacher training presentation' (4 rows). Matched here rather than inside the
  // presentation branch below, because most of these rows are PDFs, not decks,
  // and would otherwise be classified as revision notes.
  if (contentCategory === 'teacher training') return 'Teacher training';

  if (contentLabel.includes('video') || /\.(mp4|mov|webm)(?:$|\?)/.test(asset.filename ?? '')) return 'Video';
  if (contentLabel.includes('presentation') || /\.(ppt|pptx)(?:$|\?)/.test(asset.filename ?? '')) {
    if (contentLabel.includes('teacher training')) return 'Teacher training presentation';
    return 'Classroom presentation';
  }
  // H5P assets are merged in by H5PContentAdapter with format='h5p' and their own
  // category, so they are identified by that rather than by guessing from a filename.
  if (asset.format === 'h5p' || contentCategory === 'h5p interactive') return 'H5P Interactive';
  if (contentLabel.includes('classroom activity')) return 'Classroom activity';
  if (contentLabel.includes('remedial')) return 'Remedial class';
  if (contentLabel.includes('worksheet')) return 'Worksheet';
  if (contentLabel.includes('lesson plan')) return 'Lesson plan';
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
      const contentUrl = resolveViewableContentUrl(asset);
      const updatedDate = asset.created_at?.split(' ')[0] ?? 'â€”';
      const rawConceptId =
        asset.concept_id === null || asset.concept_id === undefined
          ? null
          : String(asset.concept_id).trim();
      const source = resolveContentSource(asset.source);

      return {
        id: String(asset.id),
        title: asset.title || 'Untitled content',
        subtitle: category,
        chapterTitle: chapter.title,
        conceptTitle: category,
        contentCategory: asset.content_category ?? category,
        conceptId: rawConceptId && rawConceptId !== '0' ? rawConceptId : null,
        conceptName: asset.concept_name?.trim() ? asset.concept_name.trim() : null,
        type,
        source,
        preview: getChapterContentPreview(type),
        actionLabel: type === 'Video' ? 'Play' : 'Open',
        slideCount: 0,
        statValue: asset.file_type || category,
        updatedDate,
        updatedAt: updatedDate === 'â€”' ? 'Date unavailable' : `updated ${updatedDate}`,
        contentUrl,
        bodyHtml: extractGeneratedBodyHtml(asset.description, isGeneratedContent(source)),
        slides: [],
        // Where an H5P card opens. The existing /h5p/* editors keep all the CRUD,
        // which is what makes removing the top-level H5P button non-destructive.
        deepLink: asset.deep_link,
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

/** Narrow a loosely-typed API field to a number, or drop it. */
function asOptionalNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
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
    ? `DOK ${asText(dokEntry.level)} â€” Skills & concepts`
    : 'DOK 2 â€” Skills & concepts';

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
    domain: `Bloom Â· ${primaryVerb}`,
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

/**
 * Concepts actually stored for a chapter. Prefers the concept rows the API
 * returned, and falls back to the semantic record's own total when the rows
 * weren't expanded in the response.
 */
function getChapterConceptCount(chapter: Chapter): number {
  const conceptRows = chapter.concepts?.length ?? 0;
  if (conceptRows > 0) return conceptRows;

  const semanticTotal = Number(chapter.semantic?.total_concepts);
  return Number.isFinite(semanticTotal) && semanticTotal > 0 ? semanticTotal : 0;
}

/**
 * Key concepts stored for the subject. Sums the concept rows on the chapters, and
 * falls back to the catalog's own subject-level total when the chapter rows didn't
 * carry their concepts. Never a fabricated or padded number.
 */
function getTotalConceptCount(chapters: Chapter[], subject?: LmsSubject | null): number {
  const chapterTotal = chapters.reduce((total, chapter) => total + getChapterConceptCount(chapter), 0);
  if (chapterTotal > 0) return chapterTotal;

  const subjectTotal = Number(
    subject?.key_concepts_count ??
      subject?.key_concept_count ??
      subject?.concepts_count ??
      subject?.total_concepts ??
      0
  );

  return Number.isFinite(subjectTotal) && subjectTotal > 0 ? subjectTotal : 0;
}

/**
 * Key-concept group for a chapter, built from the concepts stored against it.
 * Falls back to the bundled sample set only for the demo courses that have no
 * API-backed concepts of their own.
 */
function resolveChapterKeyConcepts(
  courseId: string,
  chapter: Chapter
): ChapterKeyConceptGroup | null {
  const concepts = chapter.concepts ?? [];

  if (concepts.length > 0) {
    return {
      count: getChapterConceptCount(chapter),
      concepts: concepts.map((concept) => ({
        title: concept.title,
        description: concept.description ?? '',
        mastery: '',
        time: '',
      })),
    };
  }

  return getChapterKeyConcepts(courseId, chapter.id);
}

/** Bucket id for concepts that carry no topic_id â€” never a real topic_master row. */
/**
 * A topic row in the chapter list, carrying the concepts that sit under it.
 * `conceptIndex` stays the chapter-wide index into `content_categories`, so
 * Concept Intelligence and question generation keep addressing a concept exactly
 * the way they did before the topic level was inserted.
 */
type ChapterTopicRow = TopicGroup<{ title: string; conceptIndex: number }>;

/**
 * Split a chapter's concepts across its topics. The rule for when the topic level
 * appears is shared with the student chapter list, so both sections group the same
 * chapter the same way.
 */
function buildChapterTopicRows(chapter: Chapter, conceptRows: string[]): ChapterTopicRow[] {
  // The list renders concept titles, so the topic lookup is keyed by title.
  const topicIdByConcept = new Map<string, string>();
  for (const concept of chapter.concepts ?? []) {
    if (concept.topicId) topicIdByConcept.set(concept.title, concept.topicId);
  }

  return groupConceptsByTopic(
    chapter.topics,
    conceptRows.map((title, conceptIndex) => ({ title, conceptIndex })),
    (concept) => topicIdByConcept.get(concept.title) ?? null
  );
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
  return `${getCourseGradeLabel(classGrade)} `;
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
  if (type === 'H5P Interactive') return 'video';
  if (type === 'Video') return 'video';
  if (type === 'Revision notes') return 'notes';
  if (type === 'PDF') return 'pdf';
  if (type === 'Classroom activity') return 'activity';
  // Worksheets and remedial packs are things a class works through, so they
  // preview as activities; a lesson plan is a document.
  if (type === 'Worksheet' || type === 'Remedial class') return 'activity';
  if (type === 'Lesson plan' || type === 'Teacher training') return 'notes';
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
      conceptName: concept?.title ?? null,
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
      // Demo rows have no stored document; only API-backed generated rows do.
      bodyHtml: null,
      slides: buildContentSlides(conceptTitle, chapter.title, type, slideCount),
    };
  });
}

// getContentPreviewIcon lived here. The card now picks its icon from the content
// type rather than from the coarse `preview` bucket, so five content types no
// longer share one icon - which was half of why the cards looked identical.

function isTeacherTrainingContent(item: ChapterContentItem): boolean {
  return `${item.contentCategory ?? ''} ${item.type}`.toLowerCase().includes('teacher');
}

/**
 * Does an item belong under a library tab?
 *
 * Module-level and exported to the count logic so the tab strip's numbers and
 * the grid below it cannot disagree. Previously this lived inline in the filter
 * callback, which meant a tab count could only be had by duplicating the rules.
 *
 * Teacher Workspace once short-circuited this to `true`, so its tab strip
 * rendered but filtered nothing - "All content" and "Presentations" returned an
 * identical list. Presentations means presentations on both surfaces.
 */
function contentMatchesTab(item: ChapterContentItem, tab: string): boolean {
  switch (tab) {
    case 'All content':
      return true;
    case 'Presentations':
      return (
        item.type === 'Classroom presentation' || item.type === 'Teacher training presentation'
      );
    case 'Videos':
      return item.type === 'Video';
    case 'Revision notes':
      return item.type === 'Revision notes' || item.type === 'PDF';
    case 'Classroom activity':
      return item.type === 'Classroom activity';
    case 'Remedial class':
      return item.type === 'Remedial class';
    case 'Worksheet':
      return item.type === 'Worksheet';
    case 'Lesson plan':
      return item.type === 'Lesson plan';
    case 'My course':
      return item.type === 'My course';
    // The Teacher Workspace tab for the bulk 'Teacher Training' category. It
    // deliberately also catches the 4 'Teacher training presentation' rows, so
    // no teacher-training row is unreachable from this lane.
    case 'Teacher training':
      return item.type === 'Teacher training' || item.type === 'Teacher training presentation';
    case 'H5P Interactive':
      return item.type === 'H5P Interactive';
    default:
      return true;
  }
}

// truncateToWords lived here, used only to cap the header pill at 150 words. A
// pill allowed to hold 150 words is what let the header stretch unpredictably;
// the pill now holds the content type, which is a short fixed label.

/**
 * Concepts a question can be filed under. These are the chapter's own concept
 * rows from the chapter master API (`/lms/new_chapter_master`) â€” the same source
 * the chapter dropdown uses â€” so the list is the tenant's real curriculum rather
 * than a sample. `content_categories` covers chapters whose concept rows weren't
 * expanded in the response. The full list is returned: capping it hid most of a
 * chapter's concepts, since chapters carry up to 40-odd.
 */
function getQuestionBankConceptTitles(chapter: Chapter) {
  const savedConcepts = (chapter.concepts ?? [])
    .map((concept) => concept.title)
    .filter((title) => title.trim());
  const categoryConcepts = Object.keys(chapter.content_categories ?? {}).filter(
    (title) => title.trim() && !/^(my course|videos|recorded videos)$/i.test(title.trim())
  );
  const concepts = savedConcepts.length ? savedConcepts : categoryConcepts;

  return Array.from(new Set(concepts.map((title) => title.trim())));
}

// Takes the chapter's title rather than the chapter: that is all it reads, and it
// lets the shared question-bank fetch pass its lighter chapter shape straight in.
function getQuestionBankCategory(course: Course, chapterTitle: string, conceptTitle: string) {
  const haystack = `${chapterTitle} ${conceptTitle}`.toLowerCase();

  if (/sound|amplitude|frequency|pitch|ultrasound|wave/.test(haystack)) return 'Sound';
  if (/force|motion|work|energy|electric|magnet|light/.test(haystack)) return 'Physics';
  if (/reaction|acid|base|salt|metal|carbon/.test(haystack)) return 'Chemistry';
  if (/life|cell|organ|plant|animal|nutrition|respiration/.test(haystack)) return 'Biology';

  return course.subject || 'Concept';
}

export default function ChapterListPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const courseId = params?.courseId as string;
  const expandedChapterParam = searchParams?.get('expandedChapterId');
  const expandedTopicParam = searchParams?.get('expandedTopicId');

  const [subjectData, setSubjectData] = useState<SubjectWithChapters | null>(null);
  const [subjectLoading, setSubjectLoading] = useState(true);

  const courseIdParts = courseId.includes('-') ? courseId.split('-', 2) : [courseId];
  const subjectId = courseIdParts[0];
  const standardId = courseIdParts[1] ?? undefined;

  // The board (CBSE / ICSE / GSEB / IB / state board) belongs to the tenant's
  // curriculum record, so it is read per subject instead of being assumed by the UI.
  const { board: curriculumBoard, label: curriculumLabel } = useCurriculumMeta(subjectId, standardId);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setSubjectLoading(true);
    });

    // Phase 1 â€” render chapters immediately. resolveDisplayNames:false skips the
    // slow (~8s / 1.3MB) course-catalog lookup that only supplies cosmetic names.
    getSubjectAndChapters(subjectId, standardId, { resolveDisplayNames: false })
      .then((data) => {
        if (!cancelled) setSubjectData(data);
      })
      .finally(() => {
        if (!cancelled) setSubjectLoading(false);
      });

    // Phase 2 â€” enrich the header's subject/standard names in the background,
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
    const apiSubject = subjectData?.subject ?? null;

    return apiSubject
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
      : undefined;
  }, [courseId, subjectData?.chapters, subjectData?.subject]);
  // Memoised because a fresh [] each render would invalidate every hook that
  // derives from the chapter list â€” including the question bank's concept options.
  const allChapters = useMemo(() => subjectData?.chapters ?? [], [subjectData?.chapters]);
  // Both header stats come from live data: concept rows stored against the chapters,
  // and the board on the tenant's curriculum record.
  const totalConceptCount = useMemo(
    () => getTotalConceptCount(allChapters, subjectData?.subject),
    [allChapters, subjectData?.subject]
  );

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
  // The question-form vocabulary from question_type_catalog. It is the
  // authority on how a form is spelled and ordered, and it is where a
  // publisher's own invented form appears -- so the dropdown reads from it
  // rather than from whatever happens to be on the current page.
  const [questionTypeCatalog, setQuestionTypeCatalog] = useState<QuestionTypeCatalogEntry[]>([]);
  // H5P content types for the "Create H5P content" submenu, loaded the first
  // time that menu opens rather than on every page load.
  const [h5pHubModules, setH5pHubModules] = useState<H5pHubModule[]>([]);
  const [h5pHubLoaded, setH5pHubLoaded] = useState(false);
  const [questionBankBloomFilter, setQuestionBankBloomFilter] = useState('all');
  const [questionBankDifficultyFilter, setQuestionBankDifficultyFilter] = useState('all');
  const [questionBankCategoryFilter, setQuestionBankCategoryFilter] = useState('all');
  const [questionBankSourceFilter, setQuestionBankSourceFilter] = useState('all');
  const [questionBankStatusFilter, setQuestionBankStatusFilter] = useState('all');
  const [questionBankSearchInput, setQuestionBankSearchInput] = useState('');
  const [questionBankSearch, setQuestionBankSearch] = useState('');
  const [questionBankFacets, setQuestionBankFacets] = useState<QuestionBankFacets>(
    EMPTY_QUESTION_BANK_FACETS
  );
  const [manualQuestionBankItems, setManualQuestionBankItems] = useState<QuestionBankItem[]>([]);
  const [questionBankItemEdits, setQuestionBankItemEdits] = useState<Record<string, QuestionBankItem>>({});
  const [editingQuestionBankItem, setEditingQuestionBankItem] = useState<QuestionBankItem | null>(null);
  const [apiQuestionBankItems, setApiQuestionBankItems] = useState<QuestionBankItem[]>([]);
  const [questionBankLoading, setQuestionBankLoading] = useState(false);
  const [questionBankError, setQuestionBankError] = useState('');
  const [isAddQuestionBankModalOpen, setIsAddQuestionBankModalOpen] = useState(false);
  const [isSavingQuestionBankItem, setIsSavingQuestionBankItem] = useState(false);
  const [deletingQuestionBankItemId, setDeletingQuestionBankItemId] = useState<string | null>(null);
  const [questionBankDeleteError, setQuestionBankDeleteError] = useState('');
  const [reviewingQuestionBankItemId, setReviewingQuestionBankItemId] = useState<string | null>(null);
  const [manualQuestionChapterId, setManualQuestionChapterId] = useState('');
  const [manualQuestionConcept, setManualQuestionConcept] = useState('');
  const [manualQuestionType, setManualQuestionType] = useState<QuestionBankQuestionType>('MCQ');
  // question_type_catalog.code for the chosen Question Type -- e.g. 'mcq' or
  // 'assertion_reason' under MCQ, 'long' or 'fill_blank' under Narrative.
  const [manualQuestionFormat, setManualQuestionFormat] = useState('');
  // '' means "type the question manually" -- the default, unchanged behaviour.
  const [manualH5pType, setManualH5pType] = useState<ManualH5pTypeKey | ''>('');
  const [trueFalseState, setTrueFalseState] = useState<TrueFalseEditorState>(emptyTrueFalseState);
  const [singleChoiceState, setSingleChoiceState] = useState<SingleChoiceSetEditorState>(emptySingleChoiceState);
  // Shared by h5p_blanks / h5p_drag_text / h5p_mark_the_words -- one passage
  // editor, same as the standalone text-activity screens share it, so
  // switching between the three under one Format keeps the passage.
  const [textActivityState, setTextActivityState] = useState<TextActivityEditorState>(emptyTextActivityState);
  const [memoryGameState, setMemoryGameState] = useState<MemoryGameEditorState>(emptyMemoryState);
  const [arithmeticState, setArithmeticState] = useState<ArithmeticQuizEditorState>(emptyArithmeticState);
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
  // Typed as the union of BOTH tab lists. The two lanes no longer offer the same
  // tabs - 'Teacher training' exists only on the Teacher lane - so typing this
  // off the Classroom list alone makes the Teacher lane's own tabs unassignable.
  const [contentLibraryTab, setContentLibraryTab] = useState<ContentLibraryTab>('All content');
  // Grouping follows the resource type: Classroom Resources is chapter-wise,
  // Teacher Workspace is concept-wise. Derived instead of stored, so the two can
  // never drift out of step and there is no toggle to leave in the wrong state.
  const contentGroupBy: 'Chapter wise' | 'Concept wise' =
    searchParams?.get('resourceType') === 'teacher' ? 'Concept wise' : 'Chapter wise';
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
  // Auto leaves the mix to the generator (which prefers the chapter's own
  // intelligence slice when there is one). Turning it off sends an explicit
  // quota, and from then on the teacher's numbers are what bind.
  const [useAutoQuota, setUseAutoQuota] = useState(true);
  const [bloomCounts, setBloomCounts] = useState<BloomCounts>({ ...EMPTY_BLOOM_COUNTS });
  const [bloomDifficulties, setBloomDifficulties] = useState<BloomDifficulties>({
    ...DEFAULT_BLOOM_DIFFICULTIES,
  });
  const [bloomPoints, setBloomPoints] = useState<BloomPoints>({ ...DEFAULT_BLOOM_POINTS });
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionGenerationError, setQuestionGenerationError] = useState('');
  const [questionGenerationSuccess, setQuestionGenerationSuccess] = useState('');
  const [generatedQuestionPreviews, setGeneratedQuestionPreviews] = useState<GeneratedQuestionPreview[]>([]);
  // Real per-run numbers off the generation response (model, batches, tokens,
  // duplicates dropped). The API already returned these; they were being
  // discarded before the pipeline panel had somewhere to show them.
  const [questionRunTelemetry, setQuestionRunTelemetry] = useState<RunTelemetry | null>(null);
  // Bumped once per generation. Remounts the stage stream so a second run starts
  // from the top, and keys the result reveal so a previous run's progress is
  // never reused.
  const [questionRunId, setQuestionRunId] = useState(0);
  // Lazy-loaded, per-chapter semantic intelligence (the heavy full_intelegance_json
  // blob). Fetched on first Concept Intelligence click and cached by chapter id so a
  // chapter is only ever fetched once.
  const [chapterIntelligence, setChapterIntelligence] = useState<Record<string, ChapterSemantic>>({});
  const [intelligenceLoadingId, setIntelligenceLoadingId] = useState<string | null>(null);
  const [intelligenceError, setIntelligenceError] = useState('');

  const view = searchParams?.get('view');
  // Tracker row 5 / Decision #37. ADVISORY ONLY - this decides whether the control
  // looks available; the server decides whether the action is allowed, via the
  // `perm:lms.content,create` middleware on the write route. `undefined` means
  // "not yet known" (loading, or no token), which is deliberately distinct from
  // `false` ("denied") so a gated button does not flash disabled on every load.
  const canCreateContent = usePermission('lms.content', 'create');
  // 2026-09-08 REGRESSION FIX. This flag was wired to `disabled` on three controls.
  // The server-side gate (`perm:lms.content,create`) runs in WARN-ONLY mode
  // (LMS_API_AUTH_ENFORCE=false), so it blocks nothing - the disabled state bought no
  // security while genuinely stopping work. The rights data is not ready for it either:
  // 59 (profile, tenant) pairs hold rights on menu 270 with NO row on menu 236, and 30
  // of 148 menu-270 rows carry can_add=0, so create=false resolved for many real users
  // and Generate Questions went read-only on live.
  // The hint still shows; the control stays usable. Re-wire `disabled` only once the
  // server actually enforces AND the rights rows are backfilled.
  const contentCreationDenied = canCreateContent === false;
  const contentResourceType = searchParams?.get('resourceType') === 'teacher' ? 'teacher' : 'classroom';
  const contentResourceLabel = contentResourceType === 'teacher' ? 'Teacher Workspace' : 'Classroom Resource';
  const availableContentLibraryTabs =
    contentResourceType === 'teacher' ? TEACHER_CONTENT_LIBRARY_TABS : CONTENT_LIBRARY_TABS;
  // A resource view can be opened while a type selected in the other view is still
  // in state. Fall back to All content so both resource views always have a valid
  // type filter and the visible tab matches the data being loaded.
  // Widened to string[] on purpose: the two tab lists are different tuple types,
  // so includes() on the union narrows its argument to the shorter tuple's members
  // and rejects the very tabs this is meant to test for.
  const activeContentLibraryTab = (availableContentLibraryTabs as readonly string[]).includes(
    contentLibraryTab
  )
    ? contentLibraryTab
    : 'All content';
  const activeChapterId = searchParams?.get('chapterId') ?? '';
  const resourceChapter =
    allChapters.find((chapter) => chapter.id === activeChapterId) || allChapters[0] || null;
  const contentChapter = resourceChapter;
  const contentChapterConcepts =
    course && contentChapter ? resolveChapterKeyConcepts(course.id, contentChapter) : null;

  const activeLibraryChapter = useMemo(
    () => allChapters.find((chapter) => chapter.id === selectedLibraryChapterId) ?? contentChapter,
    [allChapters, contentChapter, selectedLibraryChapterId]
  );

  const activeLibraryChapterConcepts = useMemo(
    () =>
      course && activeLibraryChapter
        ? resolveChapterKeyConcepts(course.id, activeLibraryChapter)
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

  // Source is deliberately absent from the cache key: the fetch below no longer
  // narrows by it, so one response serves every source and changing the source is
  // a client-side filter rather than a refetch.
  const chapterContentItems = useMemo(() => {
    if (!course || !activeLibraryChapter) return [];
    const cacheKey = `${activeLibraryChapter.id}:${activeContentLibraryTab}:${contentGroupBy}:${contentResourceType}`;
    const apiCategories = chapterContentCategories[cacheKey];
    if (apiCategories) return buildApiChapterContentItems(activeLibraryChapter, apiCategories);
    if (/^\d+$/.test(activeLibraryChapter.id)) return [];
    return buildChapterContentItems(course, activeLibraryChapter, activeLibraryChapterConcepts);
  }, [activeContentLibraryTab, activeLibraryChapter, activeLibraryChapterConcepts, chapterContentCategories, contentGroupBy, contentResourceType, course]);

  /**
   * The chapter's content narrowed to the resource type currently on screen.
   *
   * Teacher Workspace holds Teacher Training content and Classroom Resources holds
   * everything else â€” the same split `filteredChapterContentItems` applies to the
   * list below, reusing one classifier so the counts can never disagree with the
   * items. Search, tab and source filters are deliberately not applied: these are
   * the totals for the resource type, not for the current search.
   */
  const resourceScopedContentItems = useMemo(() => {
    return chapterContentItems.filter((item) =>
      contentResourceType === 'teacher'
        ? isTeacherTrainingContent(item)
        : !isTeacherTrainingContent(item)
    );
  }, [chapterContentItems, contentResourceType]);

  /**
   * Every source present in this resource view, so the dropdown always offers the
   * full choice. It is built from the unfiltered items on purpose: deriving it
   * from the filtered list made the list collapse to whatever was already
   * selected, leaving no way to switch straight to the other source.
   */
  const contentSourceOptions = useMemo(
    () => Array.from(new Set(resourceScopedContentItems.map((item) => item.source))).sort(),
    [resourceScopedContentItems]
  );

  // The bank shows only questions that actually exist: what the API returned for the
  // current chapter scope, plus questions added in this session. No synthetic
  // placeholder questions, so every count on this screen is the real count.
  const questionBankItems = useMemo(
    () =>
      [...apiQuestionBankItems, ...manualQuestionBankItems].map(
        (question) => questionBankItemEdits[question.id] ?? question
      ),
    [apiQuestionBankItems, manualQuestionBankItems, questionBankItemEdits]
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
    () => (manualQuestionChapter ? getQuestionBankConceptTitles(manualQuestionChapter) : []),
    [manualQuestionChapter]
  );
  // Only the catalog forms that belong to the chosen Question Type, keyed by
  // question_type_catalog.lms_question_type_id -- the real FK, not a name match.
  const manualQuestionFormatOptions = useMemo(() => {
    const matches = questionTypeCatalog.filter(
      (entry) => entry.lms_question_type_id === QUESTION_TYPE_API_CONFIG[manualQuestionType].question_type_id
    );

    // The catalog carries one row per (code, publisher) -- 'case_study' from
    // KVS RO Agra and from NODIA Press are two distinct rows with the same
    // code. This dropdown only ever selects a code (publisher plays no part
    // in Format or the H5P mapping downstream), so two entries sharing a code
    // would be two SelectItems with the same value -- indistinguishable to
    // pick between, not just a duplicate React key. Keep the first.
    const seen = new Set<string>();
    return matches.filter((entry) => {
      if (seen.has(entry.code)) return false;
      seen.add(entry.code);
      return true;
    });
  }, [questionTypeCatalog, manualQuestionType]);
  const manualH5pTypeOptions = useMemo(
    () => FORMAT_TO_H5P_TYPES[manualQuestionFormat] ?? [],
    [manualQuestionFormat]
  );
  useEffect(() => {
    let cancelled = false;
    fetchQuestionTypeCatalog()
      .then((rows) => {
        if (!cancelled) setQuestionTypeCatalog(rows);
      })
      // A missing catalog is not fatal: the dropdown falls back to whatever
      // labels the loaded questions carry.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const questionBankTypeOptions = useMemo(() => {
    const present = new Map<string, number>();
    questionBankItems.forEach((question) => {
      const label = question.typeLabel;
      if (label) present.set(label, (present.get(label) ?? 0) + 1);
    });

    const ordered: Array<{ label: string; count: number; publisher?: string | null }> = [];
    const seen = new Set<string>();

    // Catalog order first, so related forms stay grouped the way the
    // blueprint lists them rather than alphabetically by accident.
    questionTypeCatalog.forEach((entry) => {
      if (!entry.label || seen.has(entry.label)) return;
      const count = present.get(entry.label);
      if (!count) return;
      seen.add(entry.label);
      ordered.push({ label: entry.label, count, publisher: entry.publisher });
    });

    // Anything on the page the catalog has never heard of still gets listed,
    // otherwise those questions become unreachable through the filter.
    present.forEach((count, label) => {
      if (seen.has(label)) return;
      ordered.push({ label, count });
    });

    return ordered;
  }, [questionBankItems, questionTypeCatalog]);

  // Debounced so typing does not re-filter on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuestionBankSearch(questionBankSearchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [questionBankSearchInput]);

  // Facets come from the server for the current scope. Deriving them from the
  // loaded page is what made the full filter set appear on the one chapter
  // that had extracted questions and vanish everywhere else.
  useEffect(() => {
    const controller = new AbortController();
    fetchQuestionBankFacets(
      {
        standard_id: standardId,
        subject_id: subjectId,
        chapter_id: questionBankChapterFilter === 'all' ? undefined : questionBankChapterFilter,
      },
      controller.signal
    )
      .then(setQuestionBankFacets)
      // Facets are a convenience, not the data: a failure leaves the
      // dropdowns empty rather than blocking the bank.
      .catch(() => undefined);
    return () => controller.abort();
  }, [standardId, subjectId, questionBankChapterFilter]);

  const clearQuestionBankFilters = useCallback(() => {
    setQuestionBankConceptFilter('all');
    setQuestionBankTypeFilter('all');
    setQuestionBankCategoryFilter('all');
    setQuestionBankBloomFilter('all');
    setQuestionBankDifficultyFilter('all');
    setQuestionBankSourceFilter('all');
    setQuestionBankStatusFilter('all');
    setQuestionBankSearchInput('');
  }, []);

  const questionBankConceptOptions = useMemo(() => {
    // Concepts come from the chapters loaded off `/lms/new_chapter_master` â€” the
    // same source as the chapter dropdown â€” so every concept of the chapter is
    // selectable even before a question exists for it. Concepts carried by the
    // loaded questions are merged in so nothing already in the bank is unreachable.
    const scopedChapters =
      questionBankChapterFilter === 'all'
        ? allChapters
        : allChapters.filter((chapter) => chapter.id === questionBankChapterFilter);
    const scopedQuestions =
      questionBankChapterFilter === 'all'
        ? questionBankItems
        : questionBankItems.filter((question) => question.chapterId === questionBankChapterFilter);

    const titles = [
      ...scopedChapters.flatMap((chapter) => getQuestionBankConceptTitles(chapter)),
      ...scopedQuestions.map((question) => question.conceptTitle),
    ];

    return Array.from(new Set(titles.map((title) => title.trim()).filter(Boolean)));
  }, [allChapters, questionBankChapterFilter, questionBankItems]);
  const effectiveQuestionBankConceptFilter =
    questionBankConceptFilter === 'all' || questionBankConceptOptions.includes(questionBankConceptFilter)
      ? questionBankConceptFilter
      : 'all';
  /**
   * The filter bar's contents, in the order a teacher narrows down: where the
   * question sits, then what kind it is, then where it came from.
   *
   * Every facet is offered on every chapter. Server counts are appended as a
   * hint so an option that would return nothing is visibly "(0)" rather than
   * silently missing -- the previous behaviour of hiding empty facets is what
   * made the bar look different on each chapter.
   */
  const questionBankFilterSpecs = useMemo(() => {
    const counted = (rows: CountedOption[], idKey: 'id' | 'value', labelKey: 'name' | 'value') =>
      rows.map((row) => ({
        value: String(row[idKey] ?? ''),
        label: String(row[labelKey] ?? row.name ?? row.value ?? ''),
        hint: row.total != null ? `(${row.total})` : undefined,
      }));

    return [
      {
        key: 'chapter',
        label: 'Chapter',
        allLabel: 'All Chapters',
        value: questionBankChapterFilter,
        onChange: (next: string) => {
          setQuestionBankChapterFilter(next);
          setQuestionBankConceptFilter('all');
        },
        options: questionBankChapterOptions.map((chapter) => ({
          value: chapter.id,
          label: chapter.title,
        })),
      },
      {
        key: 'concept',
        label: 'Concept',
        allLabel: 'All Concepts',
        value: effectiveQuestionBankConceptFilter,
        onChange: setQuestionBankConceptFilter,
        options: questionBankConceptOptions.map((concept) => ({
          value: concept,
          label: concept,
        })),
      },
      {
        key: 'type',
        label: 'Question type',
        allLabel: 'All Types',
        value: questionBankTypeFilter,
        onChange: setQuestionBankTypeFilter,
        options: questionBankTypeOptions.map((option) => ({
          value: option.label,
          label: option.label,
          hint: option.publisher ? `· ${option.publisher} (${option.count})` : `(${option.count})`,
        })),
      },
      {
        key: 'bloom',
        label: 'Bloom level',
        allLabel: 'All Bloom',
        value: questionBankBloomFilter,
        onChange: setQuestionBankBloomFilter,
        options: counted(questionBankFacets.bloom_levels, 'value', 'value'),
      },
      {
        key: 'difficulty',
        label: 'Difficulty',
        allLabel: 'All Difficulty',
        value: questionBankDifficultyFilter,
        onChange: setQuestionBankDifficultyFilter,
        options: counted(questionBankFacets.difficulty_levels, 'value', 'value'),
      },
      {
        key: 'category',
        label: 'Learning step',
        allLabel: 'All Categories',
        value: questionBankCategoryFilter,
        onChange: setQuestionBankCategoryFilter,
        options: QUESTION_BANK_CATEGORIES.map((category) => ({
          value: category.value,
          label: `${category.step}. ${category.label}`,
        })),
      },
      {
        key: 'source',
        label: 'Origin',
        allLabel: 'Any Origin',
        value: questionBankSourceFilter,
        onChange: setQuestionBankSourceFilter,
        options: [
          { value: 'extracted', label: 'From a published book' },
          { value: 'ai_generated', label: 'AI generated' },
        ],
      },
    ];
  }, [
    questionBankChapterFilter,
    questionBankChapterOptions,
    effectiveQuestionBankConceptFilter,
    questionBankConceptOptions,
    questionBankTypeFilter,
    questionBankTypeOptions,
    questionBankBloomFilter,
    questionBankDifficultyFilter,
    questionBankCategoryFilter,
    questionBankSourceFilter,
    questionBankFacets,
  ]);

  const filteredQuestionBankItems = useMemo(() => {
    return questionBankItems.filter((question) => {
      const matchesChapter =
        questionBankChapterFilter === 'all' || question.chapterId === questionBankChapterFilter;
      const matchesConcept =
        effectiveQuestionBankConceptFilter === 'all' ||
        question.conceptTitle === effectiveQuestionBankConceptFilter;
      const matchesType =
        questionBankTypeFilter === 'all' || question.typeLabel === questionBankTypeFilter;
      const matchesBloom = questionBankBloomFilter === 'all' || question.bloom === questionBankBloomFilter;
      const matchesDifficulty = questionBankDifficultyFilter === 'all' || question.difficulty === questionBankDifficultyFilter;
      // Questions generated before the category column existed carry null, so
      // they are only ever hidden by an explicit category choice, never by 'all'.
      const matchesCategory =
        questionBankCategoryFilter === 'all' ||
        question.palCategory === questionBankCategoryFilter;

      const matchesSource =
        questionBankSourceFilter === 'all' || (question.source ?? 'ai_generated') === questionBankSourceFilter;
      // Rows written before the status column was meaningful default to
      // published, so 'held' never hides a question that was never held.
      const matchesStatus =
        questionBankStatusFilter === 'all' ||
        (questionBankStatusFilter === 'held' ? question.status === 0 : question.status !== 0);
      const matchesSearch =
        questionBankSearch === '' ||
        question.question.toLowerCase().includes(questionBankSearch.toLowerCase());

      return (
        matchesChapter &&
        matchesConcept &&
        matchesType &&
        matchesCategory &&
        matchesBloom &&
        matchesDifficulty &&
        matchesSource &&
        matchesStatus &&
        matchesSearch
      );
    });
  }, [
    effectiveQuestionBankConceptFilter,
    questionBankCategoryFilter,
    questionBankChapterFilter,
    questionBankItems,
    questionBankTypeFilter,
    questionBankSourceFilter,
    questionBankStatusFilter,
    questionBankSearch,
  ]);
  const questionBankVisibleNumberById = useMemo(
    () => new Map(filteredQuestionBankItems.map((question, index) => [question.id, index + 1])),
    [filteredQuestionBankItems]
  );
  const groupedQuestionBankItems = useMemo(
    () => groupQuestionBankItems(filteredQuestionBankItems),
    [filteredQuestionBankItems]
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
  const bloomCountTotal = BLOOM_LEVEL_META.reduce(
    (sum, meta) => sum + (bloomCounts[meta.level] || 0),
    0
  );
  // A custom mix has to add up: the server writes exactly the counts it is given,
  // so a table summing to 12 when the teacher asked for 10 would quietly produce 12.
  const isQuotaValid = useAutoQuota || (isTotalQuestionsValid && bloomCountTotal === totalQuestionsNumber);
  const canGenerateQuestions =
    questionType !== '' && isTotalQuestionsValid && isQuotaValid && !isGeneratingQuestions;

  /* ------------------------------------------------------------------ *
   * Generator transparency
   *
   * The grounding panel reads the SAME concept intelligence the server slices
   * for the prompt (`QuestionGenerationService::buildConceptSlice`), so what the
   * teacher sees listed is what the model is actually handed. Signals the server
   * does not send - skills, pedagogy - are deliberately left out.
   * ------------------------------------------------------------------ */

  const questionModalChapter = useMemo(() => {
    if (!questionModalConcept) return null;
    const fetched = chapterIntelligence[questionModalConcept.chapter.id];
    return fetched
      ? { ...questionModalConcept.chapter, semantic: fetched }
      : questionModalConcept.chapter;
  }, [chapterIntelligence, questionModalConcept]);

  const isQuestionIntelLoading =
    questionModalConcept !== null &&
    intelligenceLoadingId === questionModalConcept.chapter.id &&
    !chapterIntelligence[questionModalConcept.chapter.id];

  const questionGroundingSources = useMemo<GroundingSource[]>(() => {
    if (!questionModalChapter || !questionModalConcept) return [];

    const details = getConceptIntelligence(
      questionModalChapter,
      questionModalConcept.conceptTitle
    );
    // getConceptIntelligence() defaults the DOK label to "DOK 2" when nothing was
    // extracted, so read the raw rows instead - an absent ladder has to read as
    // absent here, not as a level the extraction never produced.
    const rawIntel = getConceptIntelligenceData(
      questionModalChapter,
      questionModalConcept.conceptTitle
    );
    const dokItems = Array.from(
      new Set(
        (rawIntel.dok ?? [])
          .map((entry) =>
            [asText(entry?.level) && `DOK ${asText(entry.level)}`, asText(entry?.description)]
              .filter(Boolean)
              .join(' - ')
          )
          .filter(Boolean)
      )
    );

    /** 3+ signals is enough to write a spread of items against; 1-2 is thin. */
    const gauge = (items: string[]): GroundingSource['state'] =>
      items.length >= 3 ? 'rich' : items.length > 0 ? 'thin' : 'missing';

    const objectives = Array.from(
      new Set([...details.learningOutcomes, ...details.learningObjectives])
    );
    const capabilities = Array.from(new Set([...details.abilities, ...details.competencies]));

    const measured: Array<Omit<GroundingSource, 'state'>> = [
      {
        id: 'knowledge',
        label: 'Knowledge items',
        role: 'The factual spine every stem is written from.',
        icon: BookOpen,
        items: details.knowledge,
      },
      {
        id: 'capabilities',
        label: 'Abilities & competencies',
        role: 'What a learner must be able to do - drives the Apply and Analyze items.',
        icon: Lightbulb,
        items: capabilities,
      },
      {
        id: 'outcomes',
        label: 'Learning outcomes & objectives',
        role: 'Each generated item is tagged back to one of these.',
        icon: Target,
        items: objectives,
      },
      {
        id: 'misconceptions',
        label: 'Misconceptions',
        role: 'Become the plausible wrong options, each with its own rationale.',
        icon: TriangleAlert,
        items: details.misconceptions,
      },
      {
        id: 'prerequisites',
        label: 'Prerequisites',
        role: 'Keeps items inside the prior knowledge the concept assumes.',
        icon: Orbit,
        items: details.prerequisites,
      },
      {
        id: 'applications',
        label: 'Real-world applications',
        role: 'Grounds context, scenario and case-study stems.',
        icon: GraduationCap,
        items: details.realWorldApplications,
      },
      {
        id: 'dok',
        label: 'Depth-of-knowledge ladder',
        role: 'Caps how deep an item may be pitched; the Bloom spread is clamped to it.',
        icon: Layers3,
        items: dokItems,
      },
    ];

    const sources: GroundingSource[] = measured.map((source) => ({
      ...source,
      state: gauge(source.items),
    }));

    sources.push(
      {
        id: 'curriculum',
        label: 'Curriculum anchor',
        role: 'Concept is pinned to its chapter, subject and standard before anything is written.',
        icon: Database,
        items: [
          `${subjectData?.subject?.subject_name ?? 'Subject'} / Class ${
            subjectData?.subject?.standard_name ?? '-'
          }`,
          questionModalChapter.title,
          questionModalConcept.conceptTitle,
        ].filter(Boolean),
        state: 'rich',
      },
      {
        id: 'dedup',
        label: 'Duplicate guard',
        role: 'Existing stems for this concept are sent along so new items must be distinct.',
        icon: ClipboardList,
        items: [],
        state: 'server',
        note: 'checked on save',
      }
    );

    return sources;
  }, [questionModalChapter, questionModalConcept, subjectData?.subject]);

  /** The Bloom spread this run will ask for - auto split, or the teacher's own. */
  const questionBlueprint = useMemo(() => {
    const counts = useAutoQuota
      ? suggestedBloomCounts(isTotalQuestionsValid ? totalQuestionsNumber : 0)
      : bloomCounts;

    return BLOOM_LEVEL_META.map((meta) => ({
      level: meta.level,
      count: counts[meta.level] ?? 0,
      difficulty: useAutoQuota ? meta.difficulty : bloomDifficulties[meta.level],
    }));
  }, [bloomCounts, bloomDifficulties, isTotalQuestionsValid, totalQuestionsNumber, useAutoQuota]);

  const questionStreamPhase: StreamPhase = isGeneratingQuestions
    ? 'running'
    : questionGenerationError
      ? 'error'
      : generatedQuestionPreviews.length > 0 || questionGenerationSuccess
        ? 'success'
        : 'idle';

  const revealedQuestionCount = useStaggeredReveal(
    generatedQuestionPreviews.length,
    questionStreamPhase === 'success',
    questionRunId
  );

  const generationBatchLabel = `${isTotalQuestionsValid ? totalQuestionsNumber : 0} ${
    questionType || 'item'
  } item${totalQuestionsNumber === 1 ? '' : 's'}`;

  const generationSummaryLabel = !questionType
    ? 'Pick a question type to begin.'
    : !isTotalQuestionsValid
      ? 'Enter how many questions to generate (1-50).'
      : `${totalQuestionsNumber} ${questionType} question${
          totalQuestionsNumber === 1 ? '' : 's'
        } · ${useAutoQuota ? 'auto' : 'custom'} Bloom mix · saved to this concept’s bank`;

  const groundingCoverageLabel = useMemo(() => {
    const measurable = questionGroundingSources.filter((source) => source.state !== 'server');
    const present = measurable.filter((source) => source.state !== 'missing');
    if (measurable.length === 0) return 'No intelligence signals available yet.';
    if (present.length === 0) {
      return 'No intelligence extracted for this concept - the model will work best-effort from its name.';
    }
    return `${present.length} of ${measurable.length} intelligence signals available for this concept.`;
  }, [questionGroundingSources]);

  /** Seed the table from the server's own default split the first time it is shown. */
  const handleToggleAutoQuota = (nextAuto: boolean) => {
    setUseAutoQuota(nextAuto);
    if (!nextAuto) {
      setBloomCounts(suggestedBloomCounts(isTotalQuestionsValid ? totalQuestionsNumber : 0));
    }
  };

  const handleBloomCountChange = (level: IntelligenceBloomLevel, raw: string) => {
    const digits = raw.replace(/[^\d]/g, '');
    setBloomCounts((current) => ({ ...current, [level]: digits === '' ? 0 : Number(digits) }));
  };

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

      // The teacher bank labels each question with the course's subject area. The
      // student bank has no course in hand and takes the shared default instead.
      const resolveCategory = (chapter: QuestionBankChapterRef | undefined, conceptTitle: string) =>
        course ? getQuestionBankCategory(course, chapter?.title ?? '', conceptTitle) : 'Question Bank';

      const request =
        filterValue === 'all'
          ? Promise.all(
              allChapters
                .filter((chapter) => /^\d+$/.test(chapter.id))
                .map((chapter) =>
                  fetchMappedQuestionBank(Number(chapter.id), chapter, resolveCategory).catch(() => [])
                )
            ).then((results) => results.flat())
          : fetchMappedQuestionBank(
              Number(filterValue),
              allChapters.find((chapter) => chapter.id === filterValue),
              resolveCategory
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

    const cacheKey = `${activeLibraryChapter.id}:${activeContentLibraryTab}:${contentGroupBy}:${contentResourceType}`;
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
        const contentCategory = activeContentLibraryTab === 'All content' ? undefined : activeContentLibraryTab;
        // Source is not sent: the response has to carry every source so the
        // dropdown can list them all, and `filteredChapterContentItems` already
        // narrows to the selected one from `resolveContentSource`.
        return fetchChapterContent(Number(activeLibraryChapter.id), requestContext.sub_institute_id, {
          contentCategory,
          conceptWise,
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
  }, [activeContentLibraryTab, activeLibraryChapter, contentGroupBy, contentResourceType, view, chapterContentCategories]);

  /**
   * Everything the current search, source and lane allow - before the tab
   * filter. Split out from the filter below so the tab counts are computed from
   * exactly the rows the grid would show, and so the counts and the grid cannot
   * drift apart.
   */
  const contentItemsForActiveLane = useMemo(() => {
    return chapterContentItems.filter((item) => {
      const matchesSearch =
        !contentSearch ||
        [item.title, item.subtitle, item.type, item.chapterTitle, item.source]
          .join(' ')
          .toLowerCase()
          .includes(contentSearch.toLowerCase());
      const matchesSource = contentSourceFilter === 'all' || item.source === contentSourceFilter;

      // H5P carries no audience signal in any h5p_* table, and the tracker asks for it
      // to be reachable "inside Classroom Resource AND Teacher Resource". So it is shown
      // on both surfaces rather than being assigned an audience we cannot evidence.
      const isAudienceNeutral = item.type === 'H5P Interactive';
      const isTeacherTraining = isTeacherTrainingContent(item);
      // Teacher Workspace only ever shows Teacher Training content; Classroom
      // Resources never shows it.
      const matchesResourceType =
        isAudienceNeutral || (contentResourceType === 'teacher' ? isTeacherTraining : !isTeacherTraining);

      return matchesSearch && matchesSource && matchesResourceType;
    });
  }, [chapterContentItems, contentResourceType, contentSearch, contentSourceFilter]);

  const filteredChapterContentItems = useMemo(
    () =>
      contentItemsForActiveLane.filter((item) =>
        contentMatchesTab(item, activeContentLibraryTab)
      ),
    [contentItemsForActiveLane, activeContentLibraryTab]
  );

  /**
   * How many items each tab would show for the chapter in view.
   *
   * Drives both the count on the tab and whether the tab appears at all: a tab
   * leading to an empty grid is worse than no tab, and with eleven possible
   * types most chapters only hold a few. The active tab is always kept, so the
   * strip cannot remove the tab the user is standing on and strand them.
   */
  const contentLibraryTabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    availableContentLibraryTabs.forEach((tab) => {
      counts[tab] = contentItemsForActiveLane.filter((item) => contentMatchesTab(item, tab)).length;
    });
    return counts;
  }, [availableContentLibraryTabs, contentItemsForActiveLane]);

  const visibleContentLibraryTabs = useMemo(
    () =>
      availableContentLibraryTabs.filter(
        (tab) =>
          tab === 'All content' ||
          tab === activeContentLibraryTab ||
          (contentLibraryTabCounts[tab] ?? 0) > 0
      ),
    [availableContentLibraryTabs, activeContentLibraryTab, contentLibraryTabCounts]
  );

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
  const expandedTopicId = expandedChapterId ? expandedTopicParam : null;

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
  // browser back), the click handler never ran â€” fetch the chapter here.
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
      return `Only ${config.helperText.split(' Â· ')[0]} files are supported.`;
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
        user_profile_name: requestContext.user_profile_name,
        subject_id: Number(subjectData?.subject?.subject_id ?? subjectId) || undefined,
        standard_id: Number(subjectData?.subject?.standard_id ?? standardId) || undefined,
        // Without this the row is stamped with the calendar year instead of the
        // academic year, and drops out of the current year's content.
        syear: getSyear() || undefined,
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
    // A topic only exists inside its chapter, so switching or closing the
    // chapter closes the topic with it.
    nextParams.delete('expandedTopicId');

    const nextQuery = nextParams.toString();
    router.replace(`/course-master/${courseId}/chapters${nextQuery ? `?${nextQuery}` : ''}`);
  };

  const updateExpandedTopic = (chapterId: string, topicId: string | null) => {
    const nextParams = new URLSearchParams(searchParams?.toString());
    nextParams.set('expandedChapterId', chapterId);
    if (topicId) {
      nextParams.set('expandedTopicId', topicId);
    } else {
      nextParams.delete('expandedTopicId');
    }

    const nextQuery = nextParams.toString();
    router.replace(`/course-master/${courseId}/chapters${nextQuery ? `?${nextQuery}` : ''}`);
  };

  const openChapterContentView = (chapter: Chapter, resourceType: 'classroom' | 'teacher' = 'classroom') => {
    setContentLibraryTab('All content');
    setContentSourceFilter('all');
    setContentSearch('');
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
    // Categories differ from chapter to chapter, so a selection carried over
    // from the last one can leave the bank looking empty rather than filtered.
    setQuestionBankCategoryFilter('all');
    router.push(`/course-master/${courseId}/chapters?${nextParams.toString()}`);
  };

  const closeContentDrawer = () => {
    setSelectedContentItem(null);
  };

  /** Back to Auto for the next concept, so one concept's mix never leaks into another. */
  const resetQuestionMix = () => {
    setUseAutoQuota(true);
    setBloomCounts({ ...EMPTY_BLOOM_COUNTS });
    setBloomDifficulties({ ...DEFAULT_BLOOM_DIFFICULTIES });
    setBloomPoints({ ...DEFAULT_BLOOM_POINTS });
  };

  const openGenerateQuestionsModal = (chapter: Chapter, conceptTitle: string, conceptIndex: number) => {
    // Same lazy fetch Concept Intelligence uses. The generator's grounding panel
    // reads the identical blob the server slices for the prompt, so without this
    // the panel would report "not extracted" for a chapter that simply had not
    // been opened yet.
    loadChapterIntelligence(chapter.id);
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
    setQuestionRunTelemetry(null);
    resetQuestionMix();
  };

  /**
   * One concept row in the chapter list. `conceptIndex` is the chapter-wide index
   * the Concept Intelligence view and the question generator address concepts by;
   * `displayNumber` is only what the badge shows, so concepts stay numbered 1..n
   * inside their own topic.
   */
  const renderConceptRow = (
    chapter: Chapter,
    conceptTitle: string,
    conceptIndex: number,
    displayNumber: number
  ) => (
    <div
      key={conceptTitle}
      className="flex flex-col gap-3 py-3.5 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
          {displayNumber}
        </div>
        <p className="truncate text-[15px] font-medium text-slate-950">{conceptTitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => openConceptIntelligenceView(chapter, conceptIndex)}
          className="h-9 rounded-xl border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Brain size={16} className="mr-2 text-[#4f46e5]" />
          Concept Intelligence
        </Button>
        <Button
          type="button"
          onClick={() => openGenerateQuestionsModal(chapter, conceptTitle, conceptIndex)}
          title={contentCreationDenied ? CONTENT_CREATE_DENIED_HINT : undefined}
          className="h-9 rounded-xl bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(79,70,229,0.2)] hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          <Sparkles size={16} className="mr-2" />
          Generate Questions
        </Button>
      </div>
    </div>
  );

  const handleOpenContent = (item: ChapterContentItem) => {
    // An H5P item is not a file - it is a route. It opens in its existing editor
    // in-app, which is what keeps all the H5P CRUD reachable now that H5P is a
    // filter value rather than a top-level destination (tracker row 2).
    if (item.deepLink) {
      router.push(item.deepLink);
      return;
    }

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
    setQuestionRunTelemetry(null);
    resetQuestionMix();
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
    // Closing mid-save would leave the request writing into a reset form.
    if (isSavingQuestionBankItem) return;
    setIsAddQuestionBankModalOpen(false);
    resetManualQuestionForm();
  };

  const resolveQuestionBankTargetChapter = () => {
    const targetQuestion = filteredQuestionBankItems[0] ?? questionBankItems[0];
    const filterChapter =
      questionBankChapterFilter === 'all'
        ? null
        : allChapters.find((chapter) => chapter.id === questionBankChapterFilter) ?? null;
    return (
      filterChapter ??
      (targetQuestion ? allChapters.find((chapter) => chapter.id === targetQuestion.chapterId) : null) ??
      resourceChapter ??
      allChapters[0] ??
      null
    );
  };

  const openQuestionBankAddQuestion = () => {
    const targetQuestion = filteredQuestionBankItems[0] ?? questionBankItems[0];
    const targetChapter = resolveQuestionBankTargetChapter();

    if (!targetChapter || !course) return;

    const conceptOptions = getQuestionBankConceptTitles(targetChapter);
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
    setManualQuestionFormat('');
    resetManualH5pState();
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

  /** Clears the H5P authoring choice and every type's draft state. Called
   *  whenever something the H5P Content Type list depends on changes. */
  const resetManualH5pState = () => {
    setManualH5pType('');
    setTrueFalseState(emptyTrueFalseState());
    setSingleChoiceState(emptySingleChoiceState());
    setTextActivityState(emptyTextActivityState());
    setMemoryGameState(emptyMemoryState());
    setArithmeticState(emptyArithmeticState());
  };

  const updateManualQuestionFormat = (value: string | null) => {
    setManualQuestionFormat(value ?? '');
    resetManualH5pState();
    setManualQuestionError('');
  };

  const buildH5pContext = (): H5pContext | null => {
    const targetChapter = resolveQuestionBankTargetChapter();
    if (!targetChapter || !course) return null;

    return {
      chapter_id: String(targetChapter.id),
      subject_id: String(subjectData?.subject?.subject_id ?? subjectId),
      standard_id: String(subjectData?.subject?.standard_id ?? standardId ?? ''),
      chapter_name: targetChapter.title,
      subject_name: subjectData?.subject?.subject_name ?? course.subject,
      standard_name: subjectData?.subject?.standard_name ?? getCourseGradeLabel(course.classGrade),
    };
  };

  // Loaded the first time "Create H5P content" opens, not on every page load
  // -- the list rarely changes and most visits never touch this menu.
  const loadH5pHubModules = async () => {
    if (h5pHubLoaded) return;
    const ctx = buildH5pContext();
    if (!ctx) return;

    setH5pHubLoaded(true);
    try {
      const hub = await fetchHub(ctx);
      setH5pHubModules(hub.modules);
    } catch (error) {
      console.error('Failed to load H5P content types', error);
      setH5pHubLoaded(false);
    }
  };

  /** Wherever the teacher is right now (this chapter's Question bank view),
   *  so an H5P create page's Back link can return here instead of to that
   *  type's own list. Read live rather than reconstructed, so it always
   *  matches the address bar exactly -- filters, expanded chapter and all. */
  const currentQuestionBankUrl = () =>
    typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : null;

  const openH5pContentType = (module: H5pHubModule) => {
    const ctx = buildH5pContext();
    const route = module.route ? H5P_ROUTE_MAP[module.route] : null;
    if (!ctx || !route) return;

    const returnTo = currentQuestionBankUrl();
    router.push(
      `${route}/create?${h5pContextQuery(ctx, returnTo ? { return_to: returnTo } : undefined)}`
    );
  };

  /** The "Create H5P content" menu item itself, not one of its submenu
   *  entries -- takes the teacher to the full catalog of content types. */
  const openH5pCatalog = () => {
    const ctx = buildH5pContext();
    if (!ctx) return;

    const returnTo = currentQuestionBankUrl();
    router.push(
      `/h5p/html_contents?${h5pContextQuery(ctx, returnTo ? { return_to: returnTo } : undefined)}`
    );
  };

  /** For an H5P Content Type whose editor doesn't fit this modal -- closes
   *  the modal and hands off to that type's own full-page /create. */
  const openManualH5pFullEditor = (key: ManualH5pTypeKey) => {
    const ctx = buildH5pContext();
    const route = H5P_ROUTE_MAP[`${key}.index`];
    if (!ctx || !route) return;

    closeAddQuestionBankModal();
    router.push(`${route}/create?${h5pContextQuery(ctx)}`);
  };

  const openQuestionBankEditQuestion = (question: QuestionBankItem) => {
    const chapter = allChapters.find((item) => item.id === question.chapterId) ?? allChapters[0] ?? null;
    const correctOption =
      (question.options?.find((option) => option.isCorrect)?.label as QuestionOptionLabel | undefined) ?? 'A';

    setEditingQuestionBankItem(question);
    setManualQuestionChapterId(chapter?.id ?? question.chapterId);
    setManualQuestionConcept(question.conceptTitle);
    setManualQuestionType(question.type);
    setManualQuestionFormat(question.typeCode ?? '');
    // Editing an H5P-linked question through this modal isn't supported yet --
    // it always reopens in the plain manual editor, matching what the modal
    // already showed for these rows before this feature existed.
    resetManualH5pState();
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
    const nextConcepts = nextChapter ? getQuestionBankConceptTitles(nextChapter) : [];

    setManualQuestionChapterId(chapterId);
    setManualQuestionConcept(nextConcepts[0] ?? '');
    // The H5P context (chapter/subject/standard) is stale for whatever draft
    // was in progress -- clear it rather than let a save target the old chapter.
    resetManualH5pState();
    setManualQuestionError('');
  };

  const updateManualQuestionType = (value: string | null) => {
    const nextType: QuestionBankQuestionType = value === 'Narrative' ? 'Narrative' : 'MCQ';

    setManualQuestionType(nextType);
    // The old Format no longer belongs to this Type -- clear it rather than
    // leaving a stale selection the dropdown can no longer show.
    setManualQuestionFormat('');
    resetManualH5pState();
    setManualQuestionMarks(nextType === 'Narrative' ? '3' : '1');
    setManualQuestionError('');
  };

  /**
   * The H5P branch of submitManualQuestion: create the H5P content itself,
   * then link it into a new Question Bank row. Two separate systems, two
   * separate calls -- if the second one fails, the first is NOT rolled back
   * (there is no transaction spanning them), so the error names what was
   * created rather than pretending nothing happened.
   */
  const submitH5pQuestion = async (chapter: Chapter, marks: number) => {
    const ctx = buildH5pContext();
    if (!ctx) {
      setManualQuestionError('Missing chapter, subject or standard context for H5P content.');
      return;
    }

    const requestContext = getRequestContext();
    if (!requestContext) {
      setManualQuestionError('Course master session data is missing.');
      return;
    }

    const typeLabel =
      manualH5pTypeOptions.find((option) => option.key === manualH5pType)?.label ?? 'H5P content';

    let problems: string[];
    let title: string;
    let createH5pContent: () => Promise<{ id: number }>;

    switch (manualH5pType) {
      case 'h5p_true_false':
        problems = validateTrueFalseState(trueFalseState);
        title = trueFalseState.title.trim() || trueFalseState.questions[0]?.question_text.trim() || typeLabel;
        createH5pContent = () => trueFalseApi.create(ctx, { ...trueFalseToPayload(trueFalseState) });
        break;
      case 'h5p_single_choice_set':
        problems = validateSingleChoiceState(singleChoiceState);
        title =
          singleChoiceState.title.trim() || singleChoiceState.questions[0]?.question_text.trim() || typeLabel;
        createH5pContent = () => singleChoiceSetApi.create(ctx, { ...singleChoiceToPayload(singleChoiceState) });
        break;
      case 'h5p_blanks':
      case 'h5p_drag_text':
      case 'h5p_mark_the_words': {
        const textActivityType = H5P_TEXT_ACTIVITY_TYPE[manualH5pType]!;
        problems = validateTextActivityState(textActivityType, textActivityState);
        title = textActivityState.title.trim() || typeLabel;
        createH5pContent = () =>
          createTextActivity(textActivityType, ctx, textActivityToPayload(textActivityType, textActivityState));
        break;
      }
      case 'h5p_memory_game':
        problems = validateMemoryState(memoryGameState);
        title = memoryGameState.title.trim() || typeLabel;
        createH5pContent = () => memoryGameApi.create(ctx, { ...memoryToPayload(memoryGameState) });
        break;
      case 'h5p_arithmetic_quiz':
        problems = validateArithmeticState(arithmeticState);
        title = arithmeticState.title.trim() || typeLabel;
        createH5pContent = () => arithmeticQuizApi.create(ctx, { ...arithmeticToPayload(arithmeticState) });
        break;
      // h5p_drag_drop / h5p_course_presentation are 'redirect' options -- the
      // footer button is disabled whenever one is selected, so this should be
      // unreachable. Surfaced rather than silently no-op'd in case that ever drifts.
      default:
        setManualQuestionError(`${typeLabel} needs its own full-page editor -- use "Open in full editor" above.`);
        return;
    }

    if (problems.length > 0) {
      setManualQuestionError(problems[0]);
      return;
    }

    const matchedConcept = chapter.concepts?.find((item) => item.title === manualQuestionConcept);
    const conceptId = matchedConcept && /^\d+$/.test(matchedConcept.id) ? Number(matchedConcept.id) : null;

    setIsSavingQuestionBankItem(true);
    setManualQuestionError('');

    let h5pResult: { id: number };
    try {
      h5pResult = await createH5pContent();
    } catch (error) {
      setManualQuestionError(
        error instanceof Error ? error.message : `Failed to create the ${typeLabel} content.`
      );
      setIsSavingQuestionBankItem(false);
      return;
    }

    try {
      await createQuestionBankQuestion({
        chapter_id: Number(chapter.id),
        subject_id: Number(subjectData?.subject?.subject_id ?? subjectId),
        standard_id: Number(subjectData?.subject?.standard_id ?? standardId),
        sub_institute_id: requestContext.sub_institute_id,
        question: title,
        question_type: manualQuestionType,
        marks,
        concept_id: conceptId,
        concept: manualQuestionConcept,
        question_type_code: manualQuestionFormat || null,
        h5p_content_type: manualH5pType,
        h5p_content_id: h5pResult.id,
      });
    } catch (error) {
      setManualQuestionError(
        `The ${typeLabel} content was created and saved, but adding it to the Question Bank failed: ` +
          (error instanceof Error ? error.message : 'unknown error') +
          `. Open "Create H5P content" → ${typeLabel} to find it and try again.`
      );
      setIsSavingQuestionBankItem(false);
      return;
    }

    setIsSavingQuestionBankItem(false);
    closeAddQuestionBankModal();
    loadQuestionBankItems(questionBankChapterFilter);
  };

  const submitManualQuestion = async () => {
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

    if (!Number.isFinite(marks) || marks <= 0) {
      setManualQuestionError('Please enter valid marks.');
      return;
    }

    if (manualH5pType !== '') {
      await submitH5pQuestion(chapter, marks);
      return;
    }

    if (!manualQuestionText.trim()) {
      setManualQuestionError('Please enter the question text.');
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
      category: getQuestionBankCategory(course, chapter.title, manualQuestionConcept),
      // A hand-written question has no learning-flow category: those are assigned
      // by question generation. Preserve it on edit rather than dropping it.
      palCategory: editingQuestionBankItem?.palCategory ?? null,
      type: manualQuestionType,
      // Local-state-only questions (the editedApiQuestionId === null branch
      // below) never reach the database today -- this just keeps the in-memory
      // item consistent with what was picked.
      typeCode: manualQuestionFormat || null,
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

    // Questions loaded from the API have a numeric id and a row behind them, so
    // the edit has to go to the database. Manually added items exist only in this
    // session, so they stay in local state as before.
    const editedApiQuestionId =
      editingQuestionBankItem && /^\d+$/.test(editingQuestionBankItem.id)
        ? Number(editingQuestionBankItem.id)
        : null;

    if (editedApiQuestionId !== null) {
      const requestContext = getRequestContext();
      if (!requestContext) {
        setManualQuestionError('Course master session data is missing.');
        return;
      }

      // Sent alongside the name so the saved row keeps a real lms_concept link
      // rather than only a label.
      const matchedConcept = chapter.concepts?.find(
        (item) => item.title === manualQuestionConcept
      );

      setIsSavingQuestionBankItem(true);
      setManualQuestionError('');

      try {
        await updateQuestionBankQuestion({
          id: editedApiQuestionId,
          sub_institute_id: requestContext.sub_institute_id,
          question: nextQuestion.question,
          question_type: nextQuestion.type,
          marks: nextQuestion.marks,
          concept_id:
            matchedConcept && /^\d+$/.test(matchedConcept.id) ? Number(matchedConcept.id) : null,
          concept: nextQuestion.conceptTitle,
          model_answer: nextQuestion.type === 'Narrative' ? manualModelAnswer.trim() : null,
          question_type_code: nextQuestion.typeCode,
          options: nextQuestion.options?.map((option) => ({
            label: option.label,
            text: option.text,
            is_correct: Boolean(option.isCorrect),
          })),
        });
      } catch (error) {
        setManualQuestionError(
          error instanceof Error ? error.message : 'Failed to save the question.'
        );
        setIsSavingQuestionBankItem(false);
        return;
      }

      setIsSavingQuestionBankItem(false);

      // Drop any stale local override for this question â€” the list is about to be
      // re-read from the database, and an override would shadow what was saved.
      setQuestionBankItemEdits((current) => {
        if (!(editingQuestionBankItem!.id in current)) return current;
        const next = { ...current };
        delete next[editingQuestionBankItem!.id];
        return next;
      });

      closeAddQuestionBankModal();
      loadQuestionBankItems(questionBankChapterFilter);
      return;
    }

    if (editingQuestionBankItem) {
      // Editing an item that was never saved server-side in the first place
      // (a leftover from before questions were persisted on create) -- nothing
      // to update in the database, so this stays a local-state edit.
      setQuestionBankItemEdits((current) => ({
        ...current,
        [editingQuestionBankItem.id]: nextQuestion,
      }));
      closeAddQuestionBankModal();
      return;
    }

    const requestContext = getRequestContext();
    if (!requestContext) {
      setManualQuestionError('Course master session data is missing.');
      return;
    }

    const matchedConcept = chapter.concepts?.find((item) => item.title === manualQuestionConcept);

    setIsSavingQuestionBankItem(true);
    setManualQuestionError('');

    try {
      await createQuestionBankQuestion({
        chapter_id: Number(chapter.id),
        subject_id: Number(subjectData?.subject?.subject_id ?? subjectId),
        standard_id: Number(subjectData?.subject?.standard_id ?? standardId),
        sub_institute_id: requestContext.sub_institute_id,
        question: nextQuestion.question,
        question_type: nextQuestion.type,
        marks: nextQuestion.marks,
        concept_id: matchedConcept && /^\d+$/.test(matchedConcept.id) ? Number(matchedConcept.id) : null,
        concept: nextQuestion.conceptTitle,
        model_answer: nextQuestion.type === 'Narrative' ? manualModelAnswer.trim() : null,
        question_type_code: nextQuestion.typeCode,
        options: nextQuestion.options?.map((option) => ({
          label: option.label,
          text: option.text,
          is_correct: Boolean(option.isCorrect),
        })),
      });
    } catch (error) {
      setManualQuestionError(error instanceof Error ? error.message : 'Failed to add the question.');
      setIsSavingQuestionBankItem(false);
      return;
    }

    setIsSavingQuestionBankItem(false);
    closeAddQuestionBankModal();
    loadQuestionBankItems(questionBankChapterFilter);
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
    setQuestionRunTelemetry(null);
    setQuestionRunId((current) => current + 1);

    try {
      const response = await generateIntelligenceQuestions({
        chapter_id: chapterId,
        subject_id: numericSubjectId,
        standard_id: numericStandardId,
        concept_id: conceptId,
        question_type: config.question_type,
        question_type_id: config.question_type_id,
        total_questions: totalQuestionsNumber,
        // sub_institute_id / created_by are no longer sent: the server reads
        // both from the bearer token. requestContext is still checked above so
        // the modal fails early when the user has no usable session at all.
        // Omitted entirely on Auto, so the server keeps deciding the mix exactly
        // as it did before this control existed. Zero-count levels are dropped:
        // the server reads a row's presence as "generate at this level".
        ...(useAutoQuota
          ? {}
          : {
              quota: BLOOM_LEVEL_META.filter((meta) => (bloomCounts[meta.level] || 0) > 0).map(
                (meta) => ({
                  level: meta.level,
                  count: bloomCounts[meta.level],
                  difficulty: bloomDifficulties[meta.level],
                  points: bloomPoints[meta.level],
                })
              ),
            }),
      });

      const data = response.data;
      const inserted = data?.inserted;
      setQuestionGenerationSuccess(
        inserted != null
          ? `${response.message} ${inserted} question${inserted === 1 ? '' : 's'} saved.`
          : response.message
      );
      setGeneratedQuestionPreviews(data?.questions ?? []);
      // Straight passthrough of what the service reports for this run - nothing
      // here is estimated on the client.
      setQuestionRunTelemetry({
        requested: asOptionalNumber(data?.requested),
        generated: asOptionalNumber(data?.generated),
        inserted: asOptionalNumber(inserted),
        skippedDuplicate: asOptionalNumber(data?.skipped_duplicate),
        skippedInvalid: asOptionalNumber(data?.skipped_invalid),
        batches: asOptionalNumber(data?.batches),
        inputTokens: asOptionalNumber(data?.input_tokens),
        outputTokens: asOptionalNumber(data?.output_tokens),
      });
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

  /**
   * Delete a Question Bank question. API-backed questions (numeric id) are
   * soft-deleted server-side â€” the row keeps its id and gets a deleted_at stamp â€”
   * and the card is dropped from local state straight away so the list updates
   * without a refetch. Questions added in this session only exist locally, so
   * they are just removed from state.
   */
  const handleDeleteQuestionBankItem = async (question: QuestionBankItem) => {
    if (deletingQuestionBankItemId) return;

    if (!window.confirm('Delete this question? It will be removed from the question bank.')) {
      return;
    }

    setQuestionBankDeleteError('');

    const dropLocalCopies = () => {
      setApiQuestionBankItems((current) => current.filter((item) => item.id !== question.id));
      setManualQuestionBankItems((current) => current.filter((item) => item.id !== question.id));
      setQuestionBankItemEdits((current) => {
        if (!(question.id in current)) return current;
        const next = { ...current };
        delete next[question.id];
        return next;
      });
    };

    if (!/^\d+$/.test(question.id)) {
      dropLocalCopies();
      return;
    }

    const requestContext = getRequestContext();
    if (!requestContext) {
      setQuestionBankDeleteError('Course master session data is missing.');
      return;
    }

    setDeletingQuestionBankItemId(question.id);

    try {
      await deleteQuestionBankQuestion({
        id: Number(question.id),
        sub_institute_id: requestContext.sub_institute_id,
      });
      dropLocalCopies();
    } catch (error: unknown) {
      setQuestionBankDeleteError(
        error instanceof Error ? error.message : 'Failed to delete the question.'
      );
    } finally {
      setDeletingQuestionBankItemId(null);
    }
  };

  // Presentation is shared with the student bank; only these actions are the
  // teacher's, so a student never gets an Edit or Delete control rendered at all.
  /**
   * Release a held question, or put a published one back under review.
   *
   * A validator failure writes status = 0, which keeps the question out of
   * every paper. Without this the bank could show held items but never clear
   * them, so a false positive stranded a good question permanently.
   */
  const handleReviewQuestionBankItem = useCallback(
    async (question: QuestionBankItem, action: 'approve' | 'hold') => {
      const context = getRequestContext();
      if (!context) {
        setQuestionBankDeleteError('Course master session data is missing.');
        return;
      }

      const numericId = Number(question.id);
      if (!Number.isInteger(numericId)) return;

      setReviewingQuestionBankItemId(question.id);
      setQuestionBankDeleteError('');
      try {
        await reviewQuestionBankQuestion({
          id: numericId,
          sub_institute_id: context.sub_institute_id,
          action,
          user_id: context.user_id,
        });
        // Patch in place rather than refetching: the list is already filtered
        // and a reload would jump the reviewer back to the top.
        const nextStatus = action === 'approve' ? 1 : 0;
        setApiQuestionBankItems((current) =>
          current.map((item) => (item.id === question.id ? { ...item, status: nextStatus } : item))
        );
        setQuestionBankItemEdits((current) => {
          const existing = current[question.id];
          return existing ? { ...current, [question.id]: { ...existing, status: nextStatus } } : current;
        });
      } catch (error) {
        setQuestionBankDeleteError(
          error instanceof Error ? error.message : 'Failed to update the question.'
        );
      } finally {
        setReviewingQuestionBankItemId(null);
      }
    },
    []
  );

  const renderQuestionBankQuestion = (question: QuestionBankItem) => (
    <QuestionBankQuestionCard
      key={question.id}
      question={question}
      visibleNumber={questionBankVisibleNumberById.get(question.id) ?? 1}
      actions={
        <>
          {question.status === 0 ? (
            <Button
              type="button"
              onClick={() => handleReviewQuestionBankItem(question, 'approve')}
              disabled={reviewingQuestionBankItemId !== null}
              className="h-10 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 size={17} className="mr-2" />
              {reviewingQuestionBankItemId === question.id ? 'Approving...' : 'Approve'}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleReviewQuestionBankItem(question, 'hold')}
              disabled={reviewingQuestionBankItemId !== null}
              className="h-10 rounded-2xl px-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <AlertTriangle size={17} className="mr-2" />
              {reviewingQuestionBankItemId === question.id ? 'Holding...' : 'Hold'}
            </Button>
          )}
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
            onClick={() => handleDeleteQuestionBankItem(question)}
            disabled={deletingQuestionBankItemId !== null}
            className="h-10 rounded-2xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 size={17} className="mr-2" />
            {deletingQuestionBankItemId === question.id ? 'Deletingâ€¦' : 'Delete'}
          </Button>
        </>
      }
    />
  );

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

          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(140px,1fr)]">
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

            {manualQuestionFormatOptions.length > 0 ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                  Question Format
                </Label>
                <Select
                  value={manualQuestionFormat}
                  onValueChange={updateManualQuestionFormat}
                >
                  <SelectTrigger className="h-[50px] rounded-[7px] border-slate-300 bg-white px-4 text-[17px] text-slate-900 shadow-none">
                    <SelectValue>
                      {manualQuestionFormatOptions.find((entry) => entry.code === manualQuestionFormat)
                        ?.label ?? 'Standard'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {manualQuestionFormatOptions.map((entry) => (
                      <SelectItem key={entry.code} value={entry.code}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

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

          {manualH5pTypeOptions.length > 0 ? (
            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(140px,1fr)]">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                  H5P Content Type
                </Label>
                <Select
                  value={manualH5pType || 'none'}
                  onValueChange={(value) => {
                    setManualH5pType(value === 'none' ? '' : (value as ManualH5pTypeKey));
                    setManualQuestionError('');
                  }}
                >
                  <SelectTrigger className="h-[50px] rounded-[7px] border-slate-300 bg-white px-4 text-[17px] text-slate-900 shadow-none">
                    <SelectValue>
                      {manualH5pTypeOptions.find((option) => option.key === manualH5pType)?.label ??
                        'Select H5P Content Type'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None — type the question manually</SelectItem>
                    {manualH5pTypeOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {manualH5pType !== '' &&
          manualH5pTypeOptions.find((option) => option.key === manualH5pType)?.mode === 'redirect' ? (
            <div className="mt-5 flex items-center justify-between gap-4 rounded-[8px] border border-indigo-200 bg-indigo-50 px-4 py-3">
              <p className="text-sm text-indigo-900">
                {manualH5pTypeOptions.find((option) => option.key === manualH5pType)?.label} needs its own
                full-page editor — it doesn&apos;t fit here.
              </p>
              <button
                type="button"
                onClick={() => openManualH5pFullEditor(manualH5pType)}
                className="shrink-0 rounded-[7px] bg-[#4f46e5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4338ca]"
              >
                Open in full editor
              </button>
            </div>
          ) : manualH5pType !== '' ? (
            <div className="mt-5">
              {manualH5pType === 'h5p_true_false' ? (
                <TrueFalseEditor
                  state={trueFalseState}
                  onChange={setTrueFalseState}
                  disabled={isSavingQuestionBankItem}
                />
              ) : manualH5pType === 'h5p_single_choice_set' ? (
                <SingleChoiceSetEditor
                  state={singleChoiceState}
                  onChange={setSingleChoiceState}
                  disabled={isSavingQuestionBankItem}
                />
              ) : manualH5pType === 'h5p_memory_game' ? (
                <MemoryGameEditor
                  state={memoryGameState}
                  onChange={setMemoryGameState}
                  disabled={isSavingQuestionBankItem}
                />
              ) : manualH5pType === 'h5p_arithmetic_quiz' ? (
                <ArithmeticQuizEditor
                  state={arithmeticState}
                  onChange={setArithmeticState}
                  disabled={isSavingQuestionBankItem}
                />
              ) : (
                // The remaining keys are h5p_blanks / h5p_drag_text /
                // h5p_mark_the_words -- one shared editor, parametrised by
                // type. It carries its own Save button (its API predates
                // ContentTypeFormSpec's external-footer pattern the others
                // follow) -- wiring it to the same submit as the modal's own
                // footer button means the two happen to agree rather than fight.
                <TextActivityEditor
                  type={H5P_TEXT_ACTIVITY_TYPE[manualH5pType]!}
                  state={textActivityState}
                  onChange={setTextActivityState}
                  onSave={() => {
                    void submitManualQuestion();
                  }}
                  saving={isSavingQuestionBankItem}
                  saveLabel="Add to bank"
                />
              )}
            </div>
          ) : (
          <>
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
                        ? `${manualCorrectOption} Â· ${manualQuestionOptions[manualCorrectOption].trim()}`
                        : manualCorrectOption}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {QUESTION_OPTION_LABELS.map((label) => (
                      <SelectItem key={label} value={label}>
                        {manualQuestionOptions[label].trim()
                          ? `${label} Â· ${manualQuestionOptions[label].trim()}`
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
          </>
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
            disabled={isSavingQuestionBankItem}
            onClick={closeAddQuestionBankModal}
            className="h-11 px-3 text-[16px] font-semibold text-slate-600 transition-colors hover:text-slate-950 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={
              isSavingQuestionBankItem ||
              manualH5pTypeOptions.find((option) => option.key === manualH5pType)?.mode === 'redirect'
            }
            className="ds-btn ds-btn--primary ds-btn--md inline-flex h-11 items-center gap-2 rounded-xl bg-[#4f46e5] px-6 text-[16px] font-bold text-white shadow-[0_8px_18px_rgba(79,70,229,0.32)] transition-colors hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:bg-[#c6c3f8]"
            onClick={() => {
              void submitManualQuestion();
            }}
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
                {isSavingQuestionBankItem
                  ? 'Savingâ€¦'
                  : isEditingQuestionBankItem
                    ? 'Save changes'
                    : 'Add to bank'}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const generateQuestionsModal = questionModalConcept ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-[3px]"
      onClick={closeGenerateQuestionsModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-ai-questions-title"
        className="relative flex max-h-[92vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-[20px] border border-white/80 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.32)]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* ---------------------------------------------------------- Header */}
        <header className="relative shrink-0 overflow-hidden border-b border-slate-200 bg-gradient-to-r from-[#eef2ff] via-white to-[#faf5ff] px-6 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-[12px] font-medium text-slate-500">
                <span className="truncate">{questionModalConcept.chapter.title}</span>
                <ChevronRight size={13} className="shrink-0 text-slate-400" />
                <span className="truncate font-semibold text-slate-700">
                  {questionModalConcept.conceptTitle}
                </span>
              </p>
              <h2
                id="generate-ai-questions-title"
                className="mt-1.5 text-[23px] font-bold tracking-tight text-slate-950"
              >
                Generate AI questions
              </h2>
              <p className="mt-1 flex items-center gap-1.5 text-[13px] text-slate-600">
                <Brain size={14} className="text-[#4f46e5]" />
                Written against this concept&apos;s intelligence and saved straight to the question
                bank.
              </p>
            </div>

            <button
              type="button"
              onClick={closeGenerateQuestionsModal}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white hover:text-slate-800"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* ------------------------------------------------- Body: two panes */}
        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_378px] lg:overflow-hidden">
          {/* ------------------------------------------------ Left: setup */}
          <section className="px-6 py-6 sm:px-8 lg:min-h-0 lg:overflow-y-auto">
            <div className="space-y-6">
              <div className="space-y-2.5">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Question type <span className="text-rose-500">*</span>
                </Label>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {QUESTION_TYPE_OPTIONS.map((option) => {
                    const selected = questionType === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setQuestionType(option)}
                        aria-pressed={selected}
                        className={cn(
                          'rounded-[12px] border px-4 py-3 text-left transition-all',
                          selected
                            ? 'border-[#4f46e5] bg-[#eef2ff] shadow-[0_4px_14px_rgba(79,70,229,0.14)]'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[14px] font-semibold text-slate-900">{option}</span>
                          {selected ? (
                            <CheckCircle2 size={16} className="shrink-0 text-[#4f46e5]" />
                          ) : null}
                        </span>
                        <span className="mt-1 block text-[12px] leading-[18px] text-slate-500">
                          {QUESTION_TYPE_BLURBS[option]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                <Label
                  htmlFor="total-questions"
                  className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                >
                  Total questions <span className="text-rose-500">*</span>
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="total-questions"
                    inputMode="numeric"
                    value={totalQuestions}
                    onChange={(event) =>
                      setTotalQuestions(event.target.value.replace(/[^\d]/g, ''))
                    }
                    placeholder="Enter a number"
                    className="h-11 w-[150px] rounded-[10px] border-slate-300 px-4 text-[15px] text-slate-900 shadow-none"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {QUESTION_COUNT_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTotalQuestions(String(preset))}
                        className={cn(
                          'h-8 rounded-full border px-3 text-[13px] font-semibold transition-colors',
                          totalQuestions === String(preset)
                            ? 'border-[#4f46e5] bg-[#eef2ff] text-[#4338ca]'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[12px] text-slate-500">Between 1 and 50 per run.</p>
              </div>

              <div className="space-y-3 rounded-[14px] border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Question mix
                    </Label>
                    <p className="mt-1 text-[12px] leading-[18px] text-slate-500">
                      {useAutoQuota
                        ? 'The generator weights Bloom levels from the concept intelligence.'
                        : 'You decide how many questions sit at each Bloom level.'}
                    </p>
                  </div>
                  <div className="inline-flex overflow-hidden rounded-full border border-slate-300 bg-white text-[13px] font-semibold">
                    {[
                      { label: 'Auto', value: true },
                      { label: 'Custom', value: false },
                    ].map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => handleToggleAutoQuota(option.value)}
                        className={
                          useAutoQuota === option.value
                            ? 'bg-[#4f46e5] px-4 py-1.5 text-white'
                            : 'bg-white px-4 py-1.5 text-slate-600 hover:bg-slate-50'
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {useAutoQuota ? null : (
                  <>
                    <div className="overflow-x-auto rounded-[10px] border border-slate-200 bg-white">
                      <table className="w-full min-w-[440px] text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            <th className="px-3 py-2">Bloom level</th>
                            <th className="px-3 py-2">Difficulty</th>
                            <th className="px-3 py-2 text-right">Questions</th>
                            {questionType === 'Narrative' ? (
                              <th className="px-3 py-2 text-right">Marks each</th>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {BLOOM_LEVEL_META.map((meta) => (
                            <tr key={meta.level}>
                              <td className="px-3 py-2 font-medium text-slate-900">{meta.level}</td>
                              <td className="px-3 py-2">
                                <select
                                  aria-label={`Difficulty for ${meta.level}`}
                                  value={bloomDifficulties[meta.level]}
                                  onChange={(event) =>
                                    setBloomDifficulties((current) => ({
                                      ...current,
                                      [meta.level]: event.target.value,
                                    }))
                                  }
                                  className="h-9 w-full rounded-[8px] border border-slate-300 bg-white px-2 text-sm text-slate-700 outline-none focus:border-[#4f46e5]"
                                >
                                  {DIFFICULTY_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <input
                                  aria-label={`Number of ${meta.level} questions`}
                                  inputMode="numeric"
                                  value={String(bloomCounts[meta.level] ?? 0)}
                                  onChange={(event) =>
                                    handleBloomCountChange(meta.level, event.target.value)
                                  }
                                  className="h-9 w-20 rounded-[8px] border border-slate-300 px-2 text-right text-sm text-slate-900 outline-none focus:border-[#4f46e5]"
                                />
                              </td>
                              {questionType === 'Narrative' ? (
                                <td className="px-3 py-2 text-right">
                                  <input
                                    aria-label={`Marks per ${meta.level} question`}
                                    inputMode="numeric"
                                    value={String(bloomPoints[meta.level] ?? 0)}
                                    onChange={(event) =>
                                      setBloomPoints((current) => ({
                                        ...current,
                                        [meta.level]: Number(
                                          event.target.value.replace(/[^\d]/g, '') || 0
                                        ),
                                      }))
                                    }
                                    className="h-9 w-20 rounded-[8px] border border-slate-300 px-2 text-right text-sm text-slate-900 outline-none focus:border-[#4f46e5]"
                                  />
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p
                        className={cn(
                          'text-[13px] font-medium',
                          isQuotaValid ? 'text-emerald-700' : 'text-rose-700'
                        )}
                      >
                        {bloomCountTotal} of {isTotalQuestionsValid ? totalQuestionsNumber : 0}{' '}
                        questions allocated
                        {isQuotaValid
                          ? ''
                          : ' - the mix must add up to the total before you can generate.'}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setBloomCounts(
                            suggestedBloomCounts(isTotalQuestionsValid ? totalQuestionsNumber : 0)
                          )
                        }
                        className="text-[13px] font-semibold text-[#4f46e5] hover:text-[#4338ca]"
                      >
                        Reset to suggested split
                      </button>
                    </div>

                    {questionType === 'MCQ' ? (
                      <p className="text-[11px] text-slate-500">
                        MCQs are always scored at 1 mark each, so marks are not editable for this
                        type.
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              {questionGenerationError && questionStreamPhase !== 'error' ? (
                <p className="rounded-[10px] border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">
                  {questionGenerationError}
                </p>
              ) : null}

              {questionGenerationSuccess ? (
                <p className="flex items-start gap-2 rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-700">
                  <CheckCircle2 size={15} className="mt-px shrink-0" />
                  <span>{questionGenerationSuccess}</span>
                </p>
              ) : null}

              {generatedQuestionPreviews.length > 0 ? (
                <div className="rounded-[14px] border border-slate-200 bg-slate-50/60 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Generated questions
                    </p>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                      {revealedQuestionCount} of {generatedQuestionPreviews.length} shown
                    </span>
                  </div>
                  <div className="max-h-[440px] space-y-3 overflow-y-auto pr-1">
                    {generatedQuestionPreviews
                      .slice(0, revealedQuestionCount)
                      .map((question, index) => (
                        <div
                          key={`${question.id}-${index}`}
                          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                        >
                          {renderGeneratedQuestionPreview(question, index)}
                        </div>
                      ))}
                    {revealedQuestionCount < generatedQuestionPreviews.length ? (
                      <div className="flex items-center gap-2 px-1 py-2 text-[12px] font-medium text-slate-400">
                        <Loader2 size={13} className="animate-spin" />
                        Loading the rest...
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {/* -------------------------------- Right: pipeline transparency */}
          <aside className="border-slate-200 bg-slate-50/70 px-5 py-6 max-lg:border-t lg:min-h-0 lg:overflow-y-auto lg:border-l">
            <div className="space-y-4">
              {questionStreamPhase !== 'idle' ? (
                <PipelineStream
                  key={questionRunId}
                  phase={questionStreamPhase}
                  errorMessage={questionGenerationError}
                  batchLabel={generationBatchLabel}
                />
              ) : null}

              {questionRunTelemetry ? (
                <RunTelemetryStrip telemetry={questionRunTelemetry} />
              ) : null}

              {isQuestionIntelLoading ? (
                <div className="flex items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-4 py-6 text-[13px] font-medium text-slate-500">
                  <Loader2 size={15} className="animate-spin text-[#4f46e5]" />
                  Reading this concept&apos;s intelligence...
                </div>
              ) : (
                <GroundingPanel
                  sources={questionGroundingSources}
                  coverageLabel={groundingCoverageLabel}
                  blueprint={questionBlueprint}
                  footnote="The AI writes the items; the concept slice, Bloom x DOK blueprint and duplicate guard are all built by the server before the model is called."
                />
              )}
            </div>
          </aside>
        </div>

        {/* ---------------------------------------------------------- Footer */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:px-8">
          <p className="text-[12px] font-medium text-slate-500">{generationSummaryLabel}</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={closeGenerateQuestionsModal}
              className="text-[14px] font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              {generatedQuestionPreviews.length > 0 ? 'Done' : 'Cancel'}
            </button>
            <Button
              type="button"
              onClick={submitGenerateQuestions}
              disabled={!canGenerateQuestions}
              aria-busy={isGeneratingQuestions}
              className="h-10 rounded-xl bg-[#4f46e5] px-5 text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(79,70,229,0.24)] transition-colors hover:bg-[#4338ca] disabled:bg-[#c7d2fe] disabled:text-white/90 disabled:shadow-none"
            >
              {isGeneratingQuestions ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <Sparkles size={16} className="mr-2" />
              )}
              {isGeneratingQuestions ? 'Generating...' : 'Generate questions'}
            </Button>
          </div>
        </footer>
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
              <span className="font-semibold text-blue-600">Teacher Workspace</span>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
                  <Sparkles size={13} />
                  Resource Studio
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Teacher Workspace</h1>
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
              <h2 className="text-xl font-bold text-slate-900">Add Teacher Workspace Item</h2>
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
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Teacher Workspace Target</p>
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
    const totalQuestionBankCount = questionBankItems.length;
    const visibleQuestionBankCount = filteredQuestionBankItems.length;
    const questionCountLabel = questionBankLoading
      ? 'Loading questionsâ€¦'
      : questionBankError
        ? 'Error loading questions'
        : visibleQuestionBankCount === totalQuestionBankCount
          ? `${totalQuestionBankCount} question${totalQuestionBankCount === 1 ? '' : 's'}`
          : `${visibleQuestionBankCount} of ${totalQuestionBankCount} questions`;

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

          <QuestionBankFilterBar
            countLabel={questionCountLabel}
            countTone={questionBankError ? 'error' : 'default'}
            filters={questionBankFilterSpecs}
            reviewState={questionBankStatusFilter}
            onReviewStateChange={setQuestionBankStatusFilter}
            search={questionBankSearchInput}
            onSearchChange={setQuestionBankSearchInput}
            onClearAll={clearQuestionBankFilters}
            action={
              <DropdownMenu onOpenChange={(open) => { if (open) loadH5pHubModules(); }}>
                <DropdownMenuTrigger
                  disabled={allChapters.length === 0 || questionBankLoading}
                  className="inline-flex h-10 items-center rounded-[8px] bg-[#4f46e5] px-5 text-[15px] font-bold text-white shadow-[0_8px_18px_rgba(79,70,229,0.35)] hover:bg-[#4338ca] disabled:bg-[#c6c3f8] disabled:text-white"
                >
                  <Plus size={18} className="mr-2" />
                  Add question
                  <ChevronDown size={16} className="ml-2" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={openQuestionBankAddQuestion}>
                    <Pencil size={16} className="mr-2" />
                    Add manually
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    {/* Hovering opens the submenu (Base UI's own behaviour);
                        clicking the label itself takes you to the full H5P
                        catalog instead of just sitting there with a click
                        that does nothing. */}
                    <DropdownMenuSubTrigger onClick={openH5pCatalog}>
                      <Layers3 size={16} className="mr-2" />
                      Create H5P content
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {h5pHubModules.length === 0 ? (
                        <DropdownMenuItem disabled>
                          {h5pHubLoaded ? 'No H5P content types available' : 'Loading…'}
                        </DropdownMenuItem>
                      ) : (
                        h5pHubModules.map((module) => (
                          <DropdownMenuItem
                            key={module.h5pType}
                            disabled={!module.available || !module.route || !H5P_ROUTE_MAP[module.route]}
                            onClick={() => openH5pContentType(module)}
                          >
                            {module.title}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          {questionBankDeleteError ? (
            <div className="mb-4 flex items-start justify-between gap-4 rounded-[8px] border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-sm font-medium text-rose-700">{questionBankDeleteError}</p>
              <button
                type="button"
                onClick={() => setQuestionBankDeleteError('')}
                className="shrink-0 text-sm font-semibold text-rose-800 hover:underline"
              >
                Dismiss
              </button>
            </div>
          ) : null}

          {questionBankLoading ? (
            <div className="rounded-[8px] border border-slate-200 bg-white px-5 py-12 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-600">Loading questions for the selected chapterâ€¦</p>
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

  if (view === 'coherence-map') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
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
            onClick={() => router.push(`/course-master/${courseId}/chapters`)}
            className="font-medium transition-colors hover:text-slate-900"
          >
            {course.subject} - {getCourseGradeLabel(course.classGrade)}
          </button>
          <ChevronRight size={14} className="text-slate-400" />
          <span className="font-semibold text-slate-900">Coherence map</span>
        </div>

        <div className="min-h-0 flex-1">
          <CoherenceMapView
            subjectId={subjectId}
            standardId={standardId}
            title={`${course.subject} - ${getCourseGradeLabel(course.classGrade)}`}
            onClose={() => router.push(`/course-master/${courseId}/chapters`)}
          />
        </div>
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
              resizes the layout â€” content scrolls inside instead. The card itself
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
                <p className="text-sm font-medium text-slate-500">Loading concept intelligenceâ€¦</p>
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
    const totalItems = resourceScopedContentItems.length;
    const gammaItems = resourceScopedContentItems.filter((item) => isGeneratedContent(item.source)).length;
    const uploadedItems = resourceScopedContentItems.filter((item) => item.source === 'Uploaded').length;
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
                    title={contentCreationDenied ? CONTENT_CREATE_DENIED_HINT : undefined}
                    className="h-11 rounded-2xl bg-[#4f46e5] px-5 font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,0.28)] hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                  >
                    <Sparkles size={16} className="mr-2" />
                    Generate content
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openUploadContentModal(activeLibraryChapter ?? contentChapter)}
                    title={contentCreationDenied ? CONTENT_CREATE_DENIED_HINT : undefined}
                    className="h-11 rounded-2xl border-slate-200 bg-white px-5 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                  
                </p>
                <span className="inline-flex items-center gap-2 rounded-2xl bg-slate-100/90 px-4 py-2 text-sm font-semibold text-[#4f46e5]">
                  {contentGroupBy === 'Concept wise' ? (
                    <Brain size={15} />
                  ) : (
                    <BookOpen size={15} />
                  )}
                  {contentGroupBy}
                </span>
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
              {visibleContentLibraryTabs.map((tab) => {
                const count = contentLibraryTabCounts[tab] ?? 0;
                const isActive = activeContentLibraryTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setContentLibraryTab(tab)}
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

            {/* Base UI clears the value when the selected item is picked again, and
                '' is not a state this filter has - it would blank the trigger and
                match nothing. Deselecting means "All sources". */}
            <Select value={contentSourceFilter} onValueChange={(value) => setContentSourceFilter(value || 'all')}>
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
            {contentLoading ? 'Loading contentâ€¦' : `${filteredChapterContentItems.length} items in ${activeChapterTitle}`}
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
                const title = item.conceptTitle || 'Unnamed concept';
                // Keyed by name, not concept_id: content is rarely tagged with an
                // id, and keying on it put every untagged item in one bucket.
                const key = title.trim().toLowerCase();
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
                        {group.items.map((item) => (
                          // hideChapter: the group heading above this grid already
                          // names it, so a chapter pill on each card is noise.
                          <ContentCard
                            key={item.id}
                            item={item}
                            onOpen={() => handleOpenContent(item)}
                            hideChapter
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              );
            })() : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {filteredChapterContentItems.map((item) => (
                  <ContentCard
                    key={item.id}
                    item={item}
                    onOpen={() => handleOpenContent(item)}
                  />
                ))}
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
                        {isGeneratedContent(selectedContentItem.source) ? (
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
                    ) : selectedContentItem.bodyHtml ? (
                      <section className="mt-8">
                        <div className="mb-4 border-b border-slate-200/80 pb-3">
                          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Content</h3>
                        </div>

                        {/*
                          The generated document, stored in content_master.description.
                          Sanitised server-side when written and again here on read:
                          a stored row is untrusted input by the time it reaches a browser.
                        */}
                        <div
                          className="lms-generated-body"
                          dangerouslySetInnerHTML={{ __html: sanitizeGeneratedHtml(selectedContentItem.bodyHtml) }}
                        />
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
            board={curriculumBoard}
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
            </span>
          </div>

          {/* <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-medium text-[#4f46e5] shadow-sm ring-1 ring-white/80">
            <BookOpen size={14} />
            5 questions in bank
          </div> */}
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
                {allChapters.length} chapters - {totalConceptCount} key concepts
                {curriculumLabel ? ` - ${curriculumLabel}` : ''}
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

        {subjectLoading && allChapters.length === 0 ? (
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
              // Chapter -> topic -> concept. Chapters with no topic_master rows come
              // back with no topic rows and keep listing their concepts directly.
              const chapterTopicRows = buildChapterTopicRows(chapter, chapterConceptRows);

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
                      Teacher Workspace
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
                      onClick={() => router.push(`/course-master/${courseId}/chapters?view=coherence-map`)}
                      className="h-10 shrink-0 rounded-xl border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                    >
                      <Network size={16} className="mr-2" />
                      Coherence map
                    </Button>
                  </div>

                  {isExpanded && chapterConceptRows.length > 0 && (
                    <div className="border-t border-slate-200/80 bg-white px-6">
                      <div className="divide-y divide-slate-200/80">
                        {chapterTopicRows.length > 0
                          ? chapterTopicRows.map((topic, topicIndex) => {
                              const isTopicExpanded = expandedTopicId === topic.id;

                              return (
                                <div key={topic.id}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateExpandedTopic(chapter.id, isTopicExpanded ? null : topic.id)
                                    }
                                    className="flex w-full items-center gap-3 py-3.5 text-left"
                                  >
                                    <ChevronDown
                                      size={16}
                                      className={cn(
                                        'shrink-0 text-slate-500 transition-transform duration-200',
                                        !isTopicExpanded && '-rotate-90'
                                      )}
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

                                  {isTopicExpanded &&
                                    (topic.concepts.length === 0 ? (
                                      <p className="border-t border-slate-200/60 py-3.5 pl-7 text-sm text-slate-500">
                                        No concepts are mapped to this topic yet.
                                      </p>
                                    ) : (
                                      <div className="divide-y divide-slate-200/60 border-t border-slate-200/60 pl-7">
                                        {topic.concepts.map((concept, index) =>
                                          renderConceptRow(
                                            chapter,
                                            concept.title,
                                            concept.conceptIndex,
                                            index + 1
                                          )
                                        )}
                                      </div>
                                    ))}
                                </div>
                              );
                            })
                          : chapterConceptRows.map((concept, index) =>
                              renderConceptRow(chapter, concept, index, index + 1)
                            )}
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


