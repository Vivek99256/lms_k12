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
 * Pending    — uploaded, not read yet.
 * Processing — being read and scored.
 * Evaluated  — scored, identified, nothing flagged.
 * Needs review — scored but something wants a teacher: a written answer, a low
 *                confidence, or no student matched.
 * Approved   — a teacher signed the marks off. Only these publish.
 * Failed     — the scan could not be read at all.
 */
export type SheetStatus =
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
  question_no: number;
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
  /** The server's own call on whether this one wants a human first. */
  needs_attention: boolean;
  page: number;
};

/** One student on the paper's class list, for assigning an unmatched sheet. */
export type RosterStudent = {
  student_id: number;
  roll_no: string;
  enrollment_no: string;
  name: string;
};

export type BatchDetail = {
  batch: EvaluationBatch;
  sheets: EvaluationSheet[];
  roster: RosterStudent[];
  uploaded?: number;
  rejected?: Array<{ file: string; reason: string }>;
};

export type SheetDetail = {
  sheet: EvaluationSheet;
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

/** A teacher's edit to one question's marks, as sent back on review. */
export type MarkEdit = {
  question_no: number;
  teacher_marks: number | null;
};
