import { fetchLmsCourses, type ApiChapter, type LmsSubject } from './lmsCourses';
import { getRequestContext, getSyear } from '../page';
import { API_BASE_URL } from '@/app/components/utils/api_url';

export interface Chapter {
  id: string;
  courseId: string;
  number: number;
  title: string;
  content_categories?: Record<string, unknown[]>;
  concepts?: ChapterConcept[];
  teachingMethodologies: string[];
  resources: {
    teacherResource: number;
    lessonPlanning: number;
    chapterMapping: number;
    hspContent: number;
    questions: number;
  };
  semantic?: ChapterSemantic;
}

export interface ChapterSemantic {
  semantic_id?: number;
  total_concepts?: number | string;
  learning_objective?: string;
  learning_objectives?: Array<{ objective?: string }>;
  learning_outcomes?: Array<{ outcome?: string }>;
  abilities?: Array<{
    ability?: string;
    verb?: string;
    concept_name?: string;
    description?: string;
    knowledge_refs?: string[];
  }>;
  assessment_blueprint?: Array<{
    assessment_type?: string;
    bloom_level?: string;
    dok_level?: string;
    difficulty?: string;
  }>;
  blooms_level?: Array<{
    level?: string;
    coverage_score?: number;
    concept_name?: string;
  }>;
  competency?: Array<{
    competency?: string;
  }>;
  dok?: Array<{
    level?: string;
    description?: string;
    concept_name?: string;
  }>;
  knowledge?: Array<{
    knowledge?: string;
  }>;
  misconceptions?: Array<{
    misconception?: string;
  }>;
  pedagogy?: Array<{
    strategy?: string;
    activity?: string;
  }>;
  prerequisites?: string[];
  real_world_applications?: Array<{
    application_type?: string;
    application?: string;
  }>;
  skill?: Array<{
    skill?: string;
    ability_refs?: string[];
  }>;
  full_intelegance_json?: {
    chapter_summary?: string;
    concepts?: unknown[];
    assessments?: unknown[];
    learning_objective?: string;
    learning_objectives?: unknown[];
    learning_outcomes?: unknown[];
    misconceptions?: unknown[];
    pedagogy?: unknown[];
    prerequisites?: unknown[];
    real_world_applications?: unknown[];
    skill?: unknown[];
    knowledge?: unknown[];
    total_concepts?: number | string;
  };
}

export interface ChapterConcept {
  id: string;
  title: string;
  description: string;
  learningObjective?: string;
  semantic?: {
    learning_objective?: string;
    total_concepts?: number | string;
    full_intelegance_json?: {
      chapter_summary?: string;
      concepts?: unknown[];
      assessments?: unknown[];
    };
  };
}

interface ApiChapterSource {
  id?: number;
  chapter_id?: number;
  chapter_name: string;
  chapter_desc?: string;
  sort_order?: number;
  concepts?: ApiChapterConceptSource[];
  total_content?: number | string;
  total_triz_content?: number | string;
  total_OER_content?: number | string;
  content_categories?: Record<string, unknown[]>;
  subject_id?: number;
  standard_id?: number;
  semantic?: ChapterSemantic;
  semantic_id?: number;
  concept_description?: string;
  total_concepts?: number | string;
  learning_objective?: string;
  learning_objectives?: ChapterSemantic['learning_objectives'];
  learning_outcomes?: ChapterSemantic['learning_outcomes'];
  abilities?: ChapterSemantic['abilities'];
  knowledge?: ChapterSemantic['knowledge'];
  competency?: ChapterSemantic['competency'];
  dok?: ChapterSemantic['dok'];
  blooms_level?: ChapterSemantic['blooms_level'];
  misconceptions?: ChapterSemantic['misconceptions'];
  pedagogy?: ChapterSemantic['pedagogy'];
  prerequisites?: string[];
  real_world_applications?: ChapterSemantic['real_world_applications'];
  skill?: ChapterSemantic['skill'];
  assessment_blueprint?: ChapterSemantic['assessment_blueprint'];
  full_intelegance_json?: ChapterSemantic['full_intelegance_json'];
}

interface ApiChapterConceptSource {
  concept_id?: number | string;
  concept_name?: string;
  concept_description?: string;
  semantic?: ChapterConcept['semantic'];
}

export interface SubjectWithChapters {
  subject: LmsSubject | null;
  chapters: Chapter[];
}

function mapChapterConcepts(concepts: ApiChapterConceptSource[] | undefined): ChapterConcept[] {
  if (!Array.isArray(concepts)) return [];

  return concepts
    .map((concept, index) => ({
      id: String(concept.concept_id ?? index + 1),
      title: concept.concept_name ?? `Concept ${index + 1}`,
      description: concept.concept_description ?? '',
      learningObjective: concept.semantic?.learning_objective,
      semantic: concept.semantic,
    }))
    .filter((concept) => concept.title.trim());
}

function mapConceptCategories(concepts: ChapterConcept[], fallback?: Record<string, unknown[]>) {
  if (fallback && Object.keys(fallback).length > 0) return fallback;

  return concepts.reduce<Record<string, unknown[]>>((categories, concept) => {
    categories[concept.title] = concept.description ? [concept.description] : [];
    return categories;
  }, {});
}

function buildChapterSemantic(source: ApiChapterSource): ChapterSemantic | undefined {
  const nested = source.semantic ?? {};

  const stringifyLevel = (value: unknown): string | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    return String(value);
  };

  return {
    semantic_id: source.semantic_id ?? nested.semantic_id,
    total_concepts: source.total_concepts ?? nested.total_concepts,
    learning_objective: source.learning_objective ?? nested.learning_objective,
    learning_objectives: source.learning_objectives ?? nested.learning_objectives,
    learning_outcomes: source.learning_outcomes ?? nested.learning_outcomes,
    abilities: source.abilities ?? nested.abilities,
    knowledge: source.knowledge ?? nested.knowledge,
    competency: source.competency ?? nested.competency,
    dok: (source.dok ?? nested.dok)?.map((entry) => ({
      level: stringifyLevel(entry?.level),
      description: entry?.description,
      concept_name: entry?.concept_name,
    })),
    blooms_level: source.blooms_level ?? nested.blooms_level,
    misconceptions: source.misconceptions ?? nested.misconceptions,
    pedagogy: source.pedagogy ?? nested.pedagogy,
    prerequisites: source.prerequisites ?? nested.prerequisites,
    real_world_applications: source.real_world_applications ?? nested.real_world_applications,
    skill: source.skill ?? nested.skill,
    assessment_blueprint: source.assessment_blueprint ?? nested.assessment_blueprint,
    full_intelegance_json: source.full_intelegance_json ?? nested.full_intelegance_json,
  };
}

export interface ConceptIntelAbility {
  ability?: string;
  verb?: string;
  description?: string;
  knowledge_refs?: string[];
  concept_name?: string;
}

export interface ConceptIntelSkill {
  skill?: string;
  ability_refs?: string[];
  concept_name?: string;
}

export interface ConceptIntelKnowledge {
  knowledge?: string;
  [key: string]: unknown;
}

export interface ConceptIntelCompetency {
  competency?: string;
  [key: string]: unknown;
}

export interface ConceptIntelObjective {
  objective?: string;
  [key: string]: unknown;
}

export interface ConceptIntelOutcome {
  outcome?: string;
  [key: string]: unknown;
}

export interface ConceptIntelBloom {
  level?: string;
  coverage_score?: number;
  [key: string]: unknown;
}

export interface ConceptIntelDok {
  level?: string;
  description?: string;
  [key: string]: unknown;
}

export interface ConceptIntelPrerequisite {
  concept_name?: string;
  prerequisite_type?: string;
  [key: string]: unknown;
}

export interface ConceptIntelMisconception {
  misconception?: string;
  [key: string]: unknown;
}

export interface ConceptIntelRealWorld {
  application_type?: string;
  application?: string;
  example?: string;
  [key: string]: unknown;
}

export interface ConceptIntelPedagogy {
  strategy?: string;
  [key: string]: unknown;
}

export interface ConceptIntelAssessment {
  assessment_type?: string;
  bloom_level?: string;
  dok_level?: string;
  difficulty?: string;
  marks?: number;
  recommended_question?: string;
  [key: string]: unknown;
}

export interface ConceptIntelEntry {
  concept?: { concept_id?: string; concept_name?: string; [key: string]: unknown };
  knowledge_items?: ConceptIntelKnowledge[];
  abilities?: ConceptIntelAbility[];
  skills?: ConceptIntelSkill[];
  competencies?: ConceptIntelCompetency[];
  learning_objectives?: ConceptIntelObjective[];
  learning_outcomes?: ConceptIntelOutcome[];
  blooms?: ConceptIntelBloom[];
  dok?: ConceptIntelDok[];
  prerequisites?: ConceptIntelPrerequisite[];
  misconceptions?: ConceptIntelMisconception[];
  real_world_applications?: ConceptIntelRealWorld[];
  pedagogy_recommendations?: ConceptIntelPedagogy[];
  assessment_blueprint?: ConceptIntelAssessment[];
  [key: string]: unknown;
}

export interface ConceptIntelligenceData {
  learningObjective: string;
  totalConcepts: number;
  knowledge: string[];
  abilities: ConceptIntelAbility[];
  skills: ConceptIntelSkill[];
  competencies: ConceptIntelCompetency[];
  learningObjectives: ConceptIntelObjective[];
  learningOutcomes: ConceptIntelOutcome[];
  blooms: ConceptIntelBloom[];
  dok: ConceptIntelDok[];
  prerequisites: string[];
  misconceptions: ConceptIntelMisconception[];
  realWorld: ConceptIntelRealWorld[];
  pedagogy: ConceptIntelPedagogy[];
  assessmentBlueprint: ConceptIntelAssessment[];
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function getConceptIntelligenceData(
  chapter: Chapter,
  conceptTitle: string
): ConceptIntelligenceData {
  const semantic = chapter.semantic ?? {};
  const concept = (chapter.concepts ?? []).find((item) => item.title === conceptTitle);

  const entries = (concept?.semantic?.full_intelegance_json?.concepts as ConceptIntelEntry[] | undefined) ?? [];
  const entry =
    entries.find((item) => item?.concept?.concept_name === conceptTitle) ?? entries[0] ?? {};

  const knowledgeItems = entry.knowledge_items ?? [];
  const knowledgeFromItems = knowledgeItems.map((item) => asText(item?.knowledge)).filter(Boolean);
  const knowledge =
    knowledgeFromItems.length > 0
      ? knowledgeFromItems
      : (semantic.knowledge ?? []).map((item) => asText(item?.knowledge)).filter(Boolean);

  const rawPrerequisites = entry.prerequisites ?? [];
  const prerequisites = rawPrerequisites.length
    ? rawPrerequisites.map((item) => asText(item?.concept_name)).filter(Boolean)
    : (semantic.prerequisites ?? []).map((item) => asText(item)).filter(Boolean);

  return {
    learningObjective: asText(semantic.learning_objective) || asText(semantic.full_intelegance_json?.chapter_summary),
    totalConcepts: Number(semantic.total_concepts) || (chapter.concepts ?? []).length || 0,
    knowledge,
    abilities: entry.abilities ?? semantic.abilities ?? [],
    skills: entry.skills ?? semantic.skill ?? [],
    competencies: entry.competencies ?? semantic.competency ?? [],
    learningObjectives: entry.learning_objectives ?? semantic.learning_objectives ?? [],
    learningOutcomes: entry.learning_outcomes ?? semantic.learning_outcomes ?? [],
    blooms: entry.blooms ?? semantic.blooms_level ?? [],
    dok: entry.dok ?? semantic.dok ?? [],
    prerequisites,
    misconceptions: entry.misconceptions ?? semantic.misconceptions ?? [],
    realWorld: entry.real_world_applications ?? semantic.real_world_applications ?? [],
    pedagogy: entry.pedagogy_recommendations ?? semantic.pedagogy ?? [],
    assessmentBlueprint: entry.assessment_blueprint ?? semantic.assessment_blueprint ?? [],
  };
}

export interface NewChapterMasterResponse {
  status?: boolean;
  status_code?: number;
  message?: string;
  pagination?: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number;
    to: number;
  };
  data: ApiChapterSource[];
}

export interface NewChapterMasterRequest {
  sub_institute_id: number;
  standard_id: number;
  subject_id: number;
}

export interface ChapterContentAsset {
  id: number;
  title: string;
  description: string | null;
  filename: string | null;
  url: string | null;
  file_type: string | null;
  content_category: string | null;
  created_at: string | null;
}

export interface ChapterContentResponse {
  id: number;
  chapter_name: string;
  content_categories: Record<string, ChapterContentAsset[]>;
}

export type IntelligenceQuestionType = 'mcq' | 'narrative';

export interface GenerateIntelligenceQuestionsRequest {
  concept_id: number;
  sub_institute_id: number;
  subject_id: number;
  standard_id: number;
  chapter_id: number;
  question_type_id: number;
  question_type: IntelligenceQuestionType;
  total_questions: number;
  created_by: number;
  grade_id?: number;
}

export interface GeneratedQuestionPreview {
  id: number;
  question_type: IntelligenceQuestionType;
  question_title: string;
  description?: string;
  subconcept?: string;
  points?: number;
  hint_text?: string | null;
  learning_outcome?: string[];
  answer?: {
    sub_type?: string;
    bloom_level?: string;
    dok_level?: number;
    difficulty?: string;
    options?: Array<{
      label?: string;
      text?: string;
      is_correct?: boolean;
      distractor_type?: string;
      rationale?: string;
    }>;
    correct_option?: string;
    explanation?: string;
    remediation?: string;
    model_answer?: string;
    marking_points?: Array<{
      criterion?: string;
      knowledge_ref?: string;
      mark?: number;
    }>;
  };
}

export interface GenerateIntelligenceQuestionsResponse {
  status: boolean;
  message: string;
  data?: {
    requested?: number;
    generated?: number;
    inserted?: number;
    skipped_duplicate?: number;
    skipped_invalid?: number;
    question_ids?: number[];
    questions?: GeneratedQuestionPreview[];
    missing_slice?: boolean;
    [key: string]: unknown;
  };
}

function responseContext(res: Response) {
  const status = [res.status, res.statusText].filter(Boolean).join(' ');
  const source = res.url ? ` from ${res.url}` : '';
  return status || source ? ` (${status}${source})` : '';
}

function extractHtmlMessage(text: string) {
  const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title?.trim()) {
    return title.replace(/\s+/g, ' ').trim();
  }

  return text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

async function readApiJson(res: Response, fallback: string): Promise<Record<string, unknown>> {
  const text = await res.text();
  const trimmed = text.trim();

  if (!trimmed) {
    return {};
  }

  const contentType = res.headers.get('content-type') ?? '';
  const looksLikeJson =
    contentType.toLowerCase().includes('json') ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('[');

  if (looksLikeJson) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return { data: parsed };
    } catch {
      // Fall through so HTML error pages that start with "<" become readable messages.
    }
  }

  const message = extractHtmlMessage(trimmed) || 'The server returned a non-JSON response.';
  throw new Error(`${fallback}: ${message}${responseContext(res)}`);
}

export async function fetchChapterContent(
  chapterId: number,
  subInstituteId: number
): Promise<ChapterContentResponse> {
  const res = await fetch(`${API_BASE_URL}/api/lms-chapter-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chapter_id: chapterId,
      sub_institute_id: subInstituteId,
    }),
  });

  const raw = await readApiJson(res, 'Failed to fetch chapter content');
  if (!res.ok || Number(raw.status_code) !== 1) {
    throw new Error((raw.message as string) || 'Failed to fetch chapter content');
  }

  const data = (raw.data ?? {}) as Record<string, unknown>;
  return {
    id: Number(data.id ?? chapterId),
    chapter_name: String(data.chapter_name ?? ''),
    content_categories: (data.content_categories ?? {}) as Record<string, ChapterContentAsset[]>,
  };
}

function getApiErrorMessage(raw: Record<string, unknown>, fallback: string) {
  const errors = raw.errors;
  if (errors && typeof errors === 'object') {
    for (const value of Object.values(errors as Record<string, unknown>)) {
      if (Array.isArray(value) && value.length > 0) {
        return String(value[0]);
      }
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }
  }

  return (raw.message as string) || fallback;
}

export async function generateIntelligenceQuestions(
  request: GenerateIntelligenceQuestionsRequest
): Promise<GenerateIntelligenceQuestionsResponse> {
  const res = await fetch(`${API_BASE_URL}/api/intelligence/questions/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const raw = await readApiJson(res, 'Failed to generate questions');
  if (!res.ok || raw.status === false) {
    throw new Error(getApiErrorMessage(raw, 'Failed to generate questions'));
  }

  return {
    status: Boolean(raw.status),
    message: (raw.message as string) || 'Questions generated successfully.',
    data: raw.data as GenerateIntelligenceQuestionsResponse['data'],
  };
}

export async function fetchNewChapterMaster(
  request: NewChapterMasterRequest
): Promise<NewChapterMasterResponse> {
  const url = new URL(`${API_BASE_URL}/lms/new_chapter_master`);
  url.searchParams.set('sub_institute_id', String(request.sub_institute_id));
  url.searchParams.set('standard_id', String(request.standard_id));
  url.searchParams.set('subject_id', String(request.subject_id));

  const res = await fetch(url.toString());

  const raw = await readApiJson(res, 'Failed to fetch chapters');
  if (!res.ok) {
    throw new Error((raw.message as string) || 'Failed to fetch chapters');
  }
  if ((raw.status as boolean) === false) {
    throw new Error((raw.message as string) || 'Chapter master request failed');
  }
  if ((raw.status_code as number) && (raw.status_code as number) !== 1) {
    throw new Error((raw.message as string) || 'Chapter master request failed');
  }

  return {
    status: (raw.status as boolean) ?? true,
    status_code: raw.status_code as number | undefined,
    message: raw.message as string | undefined,
    pagination: raw.pagination as NewChapterMasterResponse['pagination'] | undefined,
    data: (raw.data as ApiChapterSource[]) ?? [],
  };
}

export async function getSubjectAndChapters(subjectId: string, standardId?: string): Promise<SubjectWithChapters> {
  const requestContext = getRequestContext();
  if (!requestContext) return { subject: null, chapters: [] };

  try {
    const numericSubjectId = Number(subjectId);
    const numericStandardId = standardId != null && standardId !== '' ? Number(standardId) : numericSubjectId;

    const response = await fetchNewChapterMaster({
      sub_institute_id: requestContext.sub_institute_id,
      standard_id: numericStandardId,
      subject_id: numericSubjectId,
    });

    let matchedCourse: LmsSubject | undefined;
    try {
      const coursesResponse = await fetchLmsCourses({
        type: 'API',
        sub_institute_id: requestContext.sub_institute_id,
        syear: getSyear(),
        user_id: requestContext.user_id,
        user_profile_name: requestContext.user_profile_name,
        user_profile_id: requestContext.user_profile_id,
        client_id: requestContext.client_id,
      });
      matchedCourse = coursesResponse.lms_subject.find(
        (course) =>
          Number(course.subject_id) === numericSubjectId &&
          Number(course.standard_id) === numericStandardId
      );
    } catch {
      // Chapter data remains usable if the course catalog is temporarily unavailable.
    }

    const firstChapter = response.data[0];
    const subject: LmsSubject | null = firstChapter
      ? {
          standard_name: matchedCourse?.standard_name ?? String(firstChapter.standard_id ?? numericStandardId),
          subject_name: matchedCourse?.subject_name ?? String(firstChapter.subject_id ?? numericSubjectId),
          subject_id: firstChapter.subject_id ?? numericSubjectId,
          standard_id: firstChapter.standard_id ?? numericStandardId,
          section_id: matchedCourse?.section_id,
          section_name: matchedCourse?.section_name,
          division_id: matchedCourse?.division_id,
          division_name: matchedCourse?.division_name,
          display_image: matchedCourse?.display_image ?? '',
          content_category: matchedCourse?.content_category ?? '',
          sub_institute_id: requestContext.sub_institute_id,
          chapters: response.data as ApiChapter[],
        }
      : null;

    const rawChapters = Array.isArray(response.data) ? response.data : [];

    const chapters: Chapter[] = rawChapters.map((chapter, index) => {
      const concepts = mapChapterConcepts(chapter.concepts);
      const totalConcepts = concepts.length;
      const totalAssessments = concepts.reduce((sum, concept) => {
        const assessments = concept.semantic?.full_intelegance_json?.assessments;
        return sum + (Array.isArray(assessments) ? assessments.length : 0);
      }, 0);

      return {
        id: String(chapter.chapter_id ?? chapter.id ?? index + 1),
        courseId: String(numericSubjectId),
        number: Number(chapter.sort_order) || index + 1,
        title: chapter.chapter_name || '',
        content_categories: mapConceptCategories(concepts, chapter.content_categories),
        concepts,
        teachingMethodologies: [],
        resources: {
          teacherResource: Number(chapter.total_OER_content) || 0,
          lessonPlanning: Number(chapter.total_triz_content) || 0,
          chapterMapping: totalConcepts,
          hspContent: totalConcepts,
          questions: Number(chapter.total_content) || totalAssessments,
        },
        semantic: buildChapterSemantic(chapter),
      };
    });

    return { subject, chapters };
  } catch {
    return { subject: null, chapters: [] };
  }
}

export async function fetchChapterSemantic(
  subjectId: string | number,
  standardId: string | number,
  chapterId: string | number
): Promise<ChapterSemantic | null> {
  try {
    const response = await fetchNewChapterMaster({
      sub_institute_id: getRequestContext()?.sub_institute_id ?? 0,
      standard_id: Number(standardId),
      subject_id: Number(subjectId),
    });

    const match = response.data.find(
      (chapter) =>
        String(chapter.chapter_id ?? chapter.id) === String(chapterId)
    );

    return match ? buildChapterSemantic(match) ?? null : null;
  } catch {
    return null;
  }
}

export const chapterData: Record<string, Chapter[]> = {
  'c2': [ // Advanced Science Concepts (Class 9, Science)
    {
      id: 'ch1',
      courseId: 'c2',
      number: 1,
      title: 'Chemical Reactions and Equations',
      teachingMethodologies: ['Inquiry Based Teaching', 'Experiential Based Teaching', 'Art Initiated Teaching', 'Game Based, Activity Based Teaching, Project Based Teaching', 'Flashcard Based Teaching/Flipped Classroom Teaching', 'Scenario Based Teaching', 'Spiritual Science Teaching'],
      resources: {
        teacherResource: 10,
        lessonPlanning: 8,
        chapterMapping: 5,
        hspContent: 12,
        questions: 15,
      },
    },
    {
      id: 'ch2',
      courseId: 'c2',
      number: 2,
      title: 'Acids, Bases and Salts',
      teachingMethodologies: ['Experiential Based Teaching', 'Inquiry Based Teaching', 'Project Based Teaching'],
      resources: {
        teacherResource: 9,
        lessonPlanning: 7,
        chapterMapping: 6,
        hspContent: 10,
        questions: 12,
      },
    },
    {
      id: 'ch3',
      courseId: 'c2',
      number: 3,
      title: 'Metals and Non-metals',
      teachingMethodologies: ['Game Based, Activity Based Teaching', 'Inquiry Based Teaching', 'Skill/Competency Based Teaching'],
      resources: {
        teacherResource: 8,
        lessonPlanning: 6,
        chapterMapping: 4,
        hspContent: 9,
        questions: 13,
      },
    },
    {
      id: 'ch4',
      courseId: 'c2',
      number: 4,
      title: 'Carbon and its Compounds',
      teachingMethodologies: ['Concept Based Teaching Sports', 'Experiential Based Teaching', 'Project Based Teaching'],
      resources: {
        teacherResource: 8,
        lessonPlanning: 7,
        chapterMapping: 5,
        hspContent: 11,
        questions: 14,
      },
    },
    {
      id: 'ch5',
      courseId: 'c2',
      number: 5,
      title: 'Life Processes',
      teachingMethodologies: ['Inquiry Based Teaching', 'Game Based, Activity Based Teaching', 'Experiential Based Teaching'],
      resources: {
        teacherResource: 9,
        lessonPlanning: 8,
        chapterMapping: 6,
        hspContent: 10,
        questions: 13,
      },
    },
  ],
  // Add more courses' chapter data as needed
  'c1': [ // Social Science Fundamentals
    {
      id: 'ch1-ss',
      courseId: 'c1',
      number: 1,
      title: 'Introduction to Social Science',
      teachingMethodologies: ['Inquiry Based Teaching', 'Project Based Teaching'],
      resources: {
        teacherResource: 7,
        lessonPlanning: 6,
        chapterMapping: 4,
        hspContent: 8,
        questions: 10,
      },
    },
    {
      id: 'ch2-ss',
      courseId: 'c1',
      number: 2,
      title: 'Geography and Maps',
      teachingMethodologies: ['Visual Based Teaching', 'Experiential Based Teaching'],
      resources: {
        teacherResource: 8,
        lessonPlanning: 7,
        chapterMapping: 5,
        hspContent: 9,
        questions: 11,
      },
    },
    {
      id: 'ch3-ss',
      courseId: 'c1',
      number: 3,
      title: 'History and Culture',
      teachingMethodologies: ['Narrative Based Teaching', 'Project Based Teaching'],
      resources: {
        teacherResource: 9,
        lessonPlanning: 8,
        chapterMapping: 6,
        hspContent: 10,
        questions: 12,
      },
    },
  ],
};

export function getChaptersByCourseid(courseId: string): Chapter[] {
  return chapterData[courseId] || [];
}
