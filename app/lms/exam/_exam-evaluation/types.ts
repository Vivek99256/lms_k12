// ---------------------------------------------------------------------------
// Exam Evaluation — the shared vocabulary.
//
// A BATCH is one scanning run for one question paper. A SHEET is one student's
// answer sheet inside it. An ANSWER is one question on one sheet.
//
// The distinction that matters everywhere below is `ai_marks` vs
// `teacher_marks`. The first is a proposal; the second is what counts. Nothing
// reaches the gradebook except teacher marks on an approved sheet, so the UI
// never shows an AI number as if it were final.
//
// These types mirror App\Http\Controllers\api\ExamEvaluationApiController.
// ---------------------------------------------------------------------------

/** Draft → Processing → Review → Published. Published is terminal. */
export type BatchStatus = 'Draft' | 'Processing' | 'Review' | 'Published';

/**
 * A sheet goes through two stages, and the teacher sits between them:
 *
 * Identifying       — uploaded; being read for whose it is (nothing is marked).
 * Awaiting identity — read and matched; waiting for a teacher to confirm the
 *                     student. Marking does not start until they do.
 * Pending    — the student is confirmed; queued for marking.
 * Processing — being read and scored.
 * Evaluated  — scored, identified, nothing flagged.
 * Needs review — scored but something wants a teacher: a written answer, a low
 *                confidence, or no student matched.
 * Approved   — a teacher signed the marks off. Only these publish.
 * Failed     — the scan could not be read at all.
 */
export type SheetStatus =
  | 'Identifying'
  | 'Awaiting identity'
  | 'Pending'
  | 'Processing'
  | 'Evaluated'
  | 'Needs review'
  | 'Approved'
  | 'Failed';

/** How the sheet was matched to a student — weakest is 'name'. */
export type IdentitySource =
  | 'enrollment_no'
  | 'roll_no'
  | 'name'
  | 'manual'
  | 'unmatched'
  | '';

/** Why a sheet was left for a teacher instead of being matched. */
export type IdentityIssue =
  | 'unreadable'
  | 'unavailable'
  | 'not_on_roll'
  | 'ambiguous'
  | 'conflict'
  | 'duplicate'
  | 'low_confidence'
  | 'multiple_students';

export type AnswerStatus = 'correct' | 'partially_correct' | 'wrong' | 'unattempted';

export type EvaluationBatch = {
  id: number;
  question_paper_id: number;
  name: string;
  status: BatchStatus;
  syear: number;
  total_sheets: number;
  evaluated_sheets: number;
  approved_sheets: number;
  total_marks: number;
  paper_name: string;
  exam_type: string;
  standard_name: string;
  subject_name: string;
  published_at: string | null;
  created_at: string | null;
};

export type EvaluationSheet = {
  id: number;
  batch_id: number;
  original_name: string;
  file_type: string;
  status: SheetStatus;
  /** null until a match is made or a teacher assigns one. */
  student_id: number | null;
  student_name: string;
  student_roll_no: string;
  student_enrollment_no: string;
  /** What the reader saw in the identity block, kept even when it matched. */
  detected_roll_no: string;
  detected_enrollment_no: string;
  detected_student_name: string;
  identity_source: IdentitySource;
  identity_confidence: number | null;
  /**
   * A teacher has vouched for `student_id` — agreed with the suggestion, or chose
   * the student themselves. False means it is only the matcher's suggestion.
   */
  identity_confirmed: boolean;
  identity_confirmed_at: string | null;
  /** Why the sheet could not be matched cleanly, if it could not. */
  identity_issue: IdentityIssue | null;
  /** The students it could be, when it is between a few. */
  identity_candidates: number[];
  /** 1-based page of the file the details were found on. */
  identity_page: number | null;
  /** The other sheet that already holds the matched student, for a duplicate. */
  duplicate_of_sheet_id: number | null;
  /** A clean GR / roll match with nothing flagged: safe to confirm along with others. */
  can_bulk_confirm: boolean;
  /**
   * The system has been "working on" this sheet for so long that its job is presumed lost (a
   * worker that died or never started). It can be put back on the queue by a teacher.
   */
  stalled: boolean;
  ai_total: number | null;
  teacher_total: number | null;
  max_marks: number | null;
  percentage: number | null;
  has_annotated: boolean;
  failure_reason: string;
  evaluated_at: string | null;
  approved_at: string | null;
};

export type EvaluationAnswer = {
  id: number;
  /**
   * The question's POSITION in the paper. It ties the answer to the marking key and is how a
   * mark is addressed on save; it is NOT the number to show a teacher (see display_label), and
   * neither is question_id, which is a database id.
   */
  question_no: number;
  /** The number the answer sheet itself printed (Q.1(A), Q.2 ...); null when it wasn't read reliably. */
  question_label: string | null;
  /** What to call the question on screen: the sheet's label, else its paper position ("Q6"). */
  display_label: string;
  /** False when display_label is only the paper position, because the sheet's number wasn't read. */
  label_from_sheet: boolean;
  /** True when display_label was worked out from the paper's layout (a run of MCQs = Q.1(A), (B) ...), not read from the sheet. */
  label_inferred: boolean;
  question_id: number | null;
  question_title: string;
  question_type: string;
  /** Objective marks are computed against the key, not proposed by a model. */
  is_objective: boolean;
  detected_answer: string;
  selected_options: string[];
  expected_answer: string;
  max_marks: number;
  ai_marks: number | null;
  teacher_marks: number | null;
  status: AnswerStatus;
  ai_confidence: number | null;
  ai_remark: string;
  /** The teacher's own note on this question. Empty until they write one. */
  teacher_feedback: string;
  /** The server's own call on whether this one wants a human first. */
  needs_attention: boolean;
  /** A teacher has put a mark on it (typed, or accepted the AI's). */
  reviewed: boolean;
  /** 1-based page of the scan the answer was read from. */
  page: number;
};

/** Everything the review page header shows beyond the sheet itself. */
export type SheetContext = {
  batch_id: number;
  batch_name: string;
  batch_status: BatchStatus | '';
  paper_id: number | null;
  paper_name: string;
  exam_type: string;
  subject_name: string;
  class_name: string;
  grade_name: string;
  /** The matched student's division. Empty while the sheet is unassigned. */
  section_name: string;
  syear: number;
  total_marks: number | null;
};

/**
 * One student eligible for the paper: enrolled this year in the class it was set
 * for. The only students a sheet can be assigned to.
 */
export type RosterStudent = {
  student_id: number;
  roll_no: string;
  enrollment_no: string;
  name: string;
  /** The division. Absent from an older server. */
  section_name?: string;
};

export type BatchDetail = {
  batch: EvaluationBatch;
  sheets: EvaluationSheet[];
  roster: RosterStudent[];
  uploaded?: number;
  rejected?: Array<{ file: string; reason: string }>;
  /** Present after a bulk confirmation: what was confirmed, and what was left for a person. */
  confirmed?: number[];
  skipped?: Array<{ sheet_id: number; reason: string }>;
};

export type SheetDetail = {
  sheet: EvaluationSheet;
  /** Absent only from an older server. */
  context?: SheetContext;
  answers: EvaluationAnswer[];
};

/**
 * What a paper looks like as a marking key, read before any scanning starts.
 *
 * `missing_model_answers` is the one that decides whether this paper is worth
 * scanning: a written question with no model answer saved on it has nothing to
 * be graded against, and finding that out here costs nothing.
 */
export type AnswerKeySummary = {
  paper: {
    id: number;
    paper_name: string;
    exam_type: string;
    standard_name: string;
    grade_name: string;
    subject_name: string;
  };
  /** False when the exam is tied to no class: then everyone enrolled that year would be eligible. */
  applies_to_class: boolean;
  /** How many students a sheet for this exam could be assigned to. A count, never names. */
  eligible_students: number;
  /**
   * A problem with the AI key that its format already shows (empty, or a Vertex / OAuth
   * credential where a Google AI Studio key is needed), told before anything is uploaded.
   * Null when there is nothing to say. The key itself is never included.
   */
  ai_warning: string | null;
  total_marks: number;
  objective_count: number;
  subjective_count: number;
  question_count: number;
  missing_model_answers: number[];
  questions: Array<{
    question_no: number;
    question_title: string;
    kind: 'objective' | 'subjective';
    max_marks: number;
    correct_letters: string[];
    has_model_answer: boolean;
  }>;
};

/** A teacher's edit to one question, as sent back on review. */
export type MarkEdit = {
  question_no: number;
  /** null = no teacher mark: the question goes back to the AI's suggestion. */
  teacher_marks: number | null;
  /** Omit to leave the saved note alone; null or empty clears it. */
  teacher_feedback?: string | null;
};
