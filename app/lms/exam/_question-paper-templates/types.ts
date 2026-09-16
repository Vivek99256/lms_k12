// ---------------------------------------------------------------------------
// Question paper templates — the shared vocabulary.
//
// A template is a *layout*, never content. Everything a school would otherwise
// hardcode — its name, logo, the subject, the standard, the questions and their
// marks — is either a `{{placeholder}}` or drawn from the selected question
// paper at render time, which is what lets a single template serve every school
// on the platform.
//
// These types mirror App\Domain\Exam\QuestionPaperTemplateBlueprint on the ERP
// side; that class is the authority and normalises anything it is handed, so a
// blueprint saved by an older build still loads here.
// ---------------------------------------------------------------------------

export type NumberingStyle = 'decimal' | 'upper-alpha' | 'lower-alpha' | 'roman';
export type SubNumberingStyle = NumberingStyle | 'none';
export type InstructionNumbering =
  | 'decimal'
  | 'paren'
  | 'lower-alpha'
  | 'roman'
  | 'bullet'
  | 'none';

/** How a section draws its questions out of the selected paper. */
export type SectionSourceMode =
  | 'types'
  | 'points'
  | 'chapters'
  | 'rest'
  | 'all'
  | 'manual';

/**
 * How a section stacks its questions. Every layout runs one question below the
 * next — there is deliberately no multi-column option, because numbering that
 * reads down one column and back up another is unusable on a printed paper.
 * Blueprints saved with the old `grid-2` are normalised to `list` by the API.
 */
export type SectionLayout = 'list' | 'table' | 'compact';
export type AnswerSpaceMode = 'none' | 'lines' | 'box' | 'grid';

export type MetaField = {
  label: string;
  value: string;
};

export type BlueprintPage = {
  size: string;
  orientation: 'portrait' | 'landscape';
  margin: string;
  fontFamily: 'serif' | 'sans';
  fontSize: number;
};

export type BlueprintHeader = {
  showLogo: boolean;
  showSchoolName: boolean;
  title: string;
  subtitle: string;
  /** Rendered on the left of the meta row — conventionally time. */
  metaLeft: MetaField[];
  /** Rendered on the right — conventionally marks. */
  metaRight: MetaField[];
  /** A strip of blanks for the student to fill in before starting. */
  showStudentFields: boolean;
  studentFields: string[];
  rule: 'none' | 'single' | 'double' | 'dashed';
  align: 'left' | 'center';
};

export type BlueprintInstructions = {
  title: string;
  numbering: InstructionNumbering;
  items: string[];
};

export type SectionSource = {
  mode: SectionSourceMode;
  /** Matched against `question_type` (case-insensitive) — e.g. 'multiple'. */
  questionTypes: string[];
  /** Matched against a question's marks. */
  points: number[];
  chapterIds: number[];
  /** Only for mode 'manual' — explicit question ids, in the order given. */
  questionIds: number[];
  /** 0 means "no cap". */
  limit: number;
};

export type SectionNumbering = {
  prefix: string;
  style: NumberingStyle;
  start: number;
  /** false continues the previous section's numbering. */
  restart: boolean;
  /**
   * Print the whole section as a single question number whose questions are
   * lettered parts — the `Q.1 (A) … (B) …` shape board papers use.
   */
  groupAsParts: boolean;
  subStyle: SubNumberingStyle;
};

export type SectionOptional = {
  enabled: boolean;
  attempt: number;
  outOf: number;
  label: string;
};

export type BlueprintSection = {
  id: string;
  title: string;
  subtitle: string;
  note: string;
  instructions: string[];
  marksLabel: string;
  source: SectionSource;
  numbering: SectionNumbering;
  layout: SectionLayout;
  showMarks: boolean;
  showQuestionType: boolean;
  optional: SectionOptional;
  answerSpace: { mode: AnswerSpaceMode; lines: number };
};

export type BlueprintFooter = {
  text: string;
  showPageNumbers: boolean;
};

export type Blueprint = {
  version: number;
  page: BlueprintPage;
  header: BlueprintHeader;
  instructions: BlueprintInstructions;
  sections: BlueprintSection[];
  footer: BlueprintFooter;
};

export type QuestionPaperTemplate = {
  /** null for a built-in example that has not been saved to the school yet. */
  id: number | null;
  preset_key: string | null;
  name: string;
  description: string;
  is_preset: boolean;
  blueprint: Blueprint;
  created_on: string | null;
  created_by: number | null;
};

// --- Live exam data -------------------------------------------------------

export type PaperQuestionOption = {
  id: number;
  text: string;
  is_correct: boolean;
};

export type PaperQuestion = {
  id: number;
  question_type_id: number;
  question_type: string;
  question_title: string;
  description: string;
  points: number;
  multiple_answer: number;
  chapter_id: number | null;
  chapter_name: string;
  concept: string;
  hint_text: string;
  learning_outcome: string;
  options: PaperQuestionOption[];
};

export type PaperMeta = {
  id: number;
  paper_name: string;
  paper_desc: string;
  exam_type: string;
  grade_id: number;
  grade_name: string;
  standard_id: number;
  standard_name: string;
  subject_id: number;
  subject_name: string;
  syear: string;
  open_date: string;
  close_date: string;
  timelimit_enable: number;
  time_allowed: number;
  total_ques: number;
  total_marks: number;
};

export type PaperContext = {
  paper: PaperMeta;
  questions: PaperQuestion[];
};

/** The signed-in school, read from the session the rest of the app already uses. */
export type SchoolBranding = {
  name: string;
  logoUrl: string | null;
};

export type TemplateOptions = {
  placeholders: Array<{ token: string; description: string }>;
  source_modes: SectionSourceMode[];
  question_types: Array<{ id: number; name: string }>;
  defaults: Blueprint;
};

export type TemplateIndex = {
  templates: QuestionPaperTemplate[];
  presets: QuestionPaperTemplate[];
  options: TemplateOptions;
};

/** A question placed into a section, with the number the paper will show. */
export type PlacedQuestion = {
  question: PaperQuestion;
  /** e.g. "Q.1" — prefix and style already applied. */
  label: string;
  marks: number;
};

export type ResolvedSection = {
  section: BlueprintSection;
  /**
   * The one question number the whole section carries when its questions are
   * printed as lettered parts (e.g. "Q.1"); empty when each question is
   * numbered in its own right.
   */
  groupLabel: string;
  title: string;
  subtitle: string;
  note: string;
  instructions: string[];
  marksLabel: string;
  optionalLabel: string;
  questions: PlacedQuestion[];
  marks: number;
};

export type ResolvedPaper = {
  header: {
    schoolName: string;
    logoUrl: string | null;
    title: string;
    subtitle: string;
    metaLeft: MetaField[];
    metaRight: MetaField[];
    studentFields: string[];
    /** The rule drawn under the header block. */
    rule: BlueprintHeader['rule'];
    align: BlueprintHeader['align'];
  };
  instructions: BlueprintInstructions;
  sections: ResolvedSection[];
  footer: BlueprintFooter;
  totalMarks: number;
  totalQuestions: number;
  /**
   * Questions in the paper that no section claimed. Surfaced rather than
   * dropped quietly, so a teacher can see the template needs another section
   * before the paper goes to print.
   */
  unplaced: PaperQuestion[];
};
