// Shape of the curriculum-planning screen: the local view models the tabs render,
// and the API contract they are built from. Mirrored by hand from
// app/Http/Controllers/api/lms/CurriculumPlanningApiController.php in next_lms_erp;
// there is no shared type package across the two repos.

export type Stat = {
  label: string;
  value: string;
  helper: string;
  progress: number;
  color: string;
};

export type SubjectPlan = {
  name: string;
  dotColor: string;
  fill: string;
  text: string;
  topics: string[];
  progress: number;
  displayName: string;
};

export type Lesson = {
  subject: string;
  title: string;
  meta: string;
  dotColor: string;
  status: string;
  badgeClassName: string;
};

export type UpcomingLessonStatus = 'In progress' | 'Upcoming' | 'Ready';
export type SubjectProgressStatus = 'Done' | 'In progress' | 'Upcoming';

export type UpcomingLessonRow = {
  date: string;
  time: string;
  subject: string;
  dotColor: string;
  fill: string;
  text: string;
  topic: string;
  room: string;
  period: string;
  status: UpcomingLessonStatus;
  highlight?: boolean;
};

export type SubjectProgressTopic = {
  title: string;
  range: string;
  status: SubjectProgressStatus;
};

export type SubjectProgressDetail = {
  subject: string;
  color: string;
  progress: number;
  topics: SubjectProgressTopic[];
};

// --- Curriculum Planning API -------------------------------------------------

export type ApiStats = {
  total_topics: number;
  completed: number;
  in_progress: number;
  weeks_remaining: number;
  completion_percent: number;
};

export type ApiSubjectMonth = {
  month: string;
  month_key: string;
  topics: string[];
  completion_percent: number;
};

export type ApiSubject = {
  subject_id: number;
  subject_name: string;
  standard_id: number;
  standard_name: string | null;
  progress: number;
  months: ApiSubjectMonth[];
};

export type ApiUpcomingLesson = {
  period_id: number;
  subject_id: number | null;
  subject_name: string | null;
  standard_id: number | null;
  standard_name: string | null;
  topic: string | null;
  scheduled_date: string;
  period_slot: string;
  status: string;
  teacher_name: string;
};

export type ApiSubjectProgressTopic = {
  title: string;
  start_date: string;
  end_date: string;
  status: SubjectProgressStatus;
};

export type ApiSubjectProgress = {
  subject_id: number;
  subject_name: string;
  standard_id: number;
  standard_name: string | null;
  progress: number;
  topics: ApiSubjectProgressTopic[];
};

// --- The structural half: curriculum -> units -> chapters --------------------
//
// The API has always returned this under `data.curriculum`; until now nothing
// declared it, so the whole tree was discarded on arrival.

export type ApiTopic = {
  id: number;
  chapter_id: number;
  name: string | null;
  description: string | null;
  estimated_minutes: number | null;
  topic_sort_order: number | null;
  topic_show_hide: number | null;
};

export type ApiLearningOutcome = {
  id: number;
  chapter_id?: number;
  code: string | null;
  type: string | null;
  description: string | null;
};

/** A curricular goal (CG-n) with its competencies (C-n.m) beneath it. */
export type ApiOutcomeGoal = {
  id: number | null;
  code: string | null;
  type: string;
  description: string | null;
  competencies: ApiLearningOutcome[];
};

export type ApiChapter = {
  chapter_id: number;
  chapter_name: string;
  chapter_desc: string | null;
  sort_order: number | null;
  availability: number | null;
  show_hide: number | null;
  /** Key to /api/semantic-intelligence/{extraction_id}/result. */
  extraction_id: number | null;
  topics: ApiTopic[];
  topic_count: number;
  learning_outcomes: ApiLearningOutcome[];
  concept_count: number;
  key_concept_count: number;
  learning_objective: string | null;
  total_concepts: number | null;
  has_intelligence: boolean;
  status: SubjectProgressStatus;
  total_periods: number;
  completed_periods: number;
  start_date: string | null;
  end_date: string | null;
};

export type ApiUnit = {
  unit_id: number;
  unit_number: number | null;
  unit_name: string | null;
  total_marks: number | null;
  planned_periods: number | null;
  extraction_id: number | null;
  /** Chapter names the syllabus declares, which is not what has been extracted. */
  declared_chapters: string[];
  declared_chapter_count: number;
  extracted_chapter_count: number;
  chapters: ApiChapter[];
};

/** The seven authoring fields. null means nobody has written this yet. */
export type ApiCurriculumDetails = {
  curriculum_alignment: string | null;
  holistic_curriculum: string | null;
  model_integration: string | null;
  objective: string | null;
  chapter: string | null;
  outcome: string | null;
  assessment_tool: string | null;
};

export type ApiCurriculum = {
  subject_id: number;
  subject_name: string;
  standard_id: number;
  standard_name: string | null;
  curriculum_id: number;
  curriculum_name: string | null;
  board: string | null;
  framework: string | null;
  grade_id: number | null;
  syear: number | null;
  status: string | null;
  extraction_id: number | null;
  total_marks: number | null;
  internal_marks: number | null;
  details: ApiCurriculumDetails;
  outcomes: ApiOutcomeGoal[];
  coverage: {
    declared_chapters: number;
    extracted_chapters: number;
    chapters_with_intelligence: number;
  };
  progress: number;
  units: ApiUnit[];
};

/** Chapters that exist but that no curriculum unit claims. */
export type ApiUnmappedGroup = {
  standard_id: number | null;
  standard_name: string | null;
  subject_id: number | null;
  subject_name: string | null;
  chapter_count: number;
  concept_count: number;
  chapters_with_intelligence: number;
  chapters: Array<{
    chapter_id: number;
    chapter_name: string;
    chapter_desc: string | null;
    sort_order: number | null;
    extraction_id: number | null;
    topic_count: number;
    concept_count: number;
    key_concept_count: number;
    learning_objective: string | null;
    total_concepts: number | null;
    has_intelligence: boolean;
  }>;
};

export type CurriculumPlanningApiData = {
  stats: ApiStats;
  subjects: ApiSubject[];
  curriculum: ApiCurriculum[];
  upcoming_lessons: ApiUpcomingLesson[];
  subject_progress: ApiSubjectProgress[];
  unmapped_chapters: ApiUnmappedGroup[];
};

// --- Lazy per-chapter detail -------------------------------------------------
// GET /api/intelligence/curriculum-planning/chapter

export type ApiChapterConcept = {
  concept_id: number;
  topic_id: number | null;
  name: string;
  description: string | null;
  mastery_threshold: number | null;
  learning_pattern: string | null;
  estimated_mastery_minutes: number | null;
};

export type ApiKeyConcept = {
  name?: string;
  description?: string;
};

export type ApiChapterDetail = {
  chapter_id: number;
  chapter_name: string;
  chapter_desc: string | null;
  sort_order: number | null;
  availability: number | null;
  show_hide: number | null;
  unit_id: number | null;
  extraction_id: number | null;
  topics: Array<{
    topic_id: number;
    name: string | null;
    description: string | null;
    estimated_minutes: number | null;
    topic_sort_order: number | null;
    topic_show_hide: number | null;
  }>;
  concepts: ApiChapterConcept[];
  key_concepts: ApiKeyConcept[];
  semantic: {
    id: number;
    extraction_id: number | null;
    learning_objective: string | null;
    total_concepts: number | null;
    blooms_level: string | null;
  } | null;
  source: {
    id: number;
    document_type: string | null;
    document_tittle: string | null;
    chapter_number: number | null;
    board: string | null;
    page_count: number | null;
    pdf_url: string | null;
  } | null;
};

export type ChapterDetailApiResponse = {
  status?: boolean;
  message?: string;
  data?: ApiChapterDetail | null;
};

export type CurriculumPlanningApiResponse = {
  status?: boolean;
  message?: string;
  data?: CurriculumPlanningApiData | [];
};
