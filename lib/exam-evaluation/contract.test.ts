import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type {
  AnswerKeySummary,
  BatchDetail,
  EvaluationAnswer,
  EvaluationBatch,
  EvaluationSheet,
  RosterStudent,
  SheetContext,
  SheetDetail,
} from '../../app/lms/exam/_exam-evaluation/types';

// ---------------------------------------------------------------------------
// The shape of the exam-evaluation API, from this side.
//
// The backend lives in another repository (next_lms_erp) and its JSON is pinned there by
// tests/Feature/ExamEvaluation/ApiContractTest.php. This file is the matching half, in two
// parts:
//
//   1. COMPILE TIME. Each list below must name exactly the keys of its TypeScript type:
//      add a field to a type and forget the list (or the reverse) and `tsc` fails here.
//   2. RUN TIME. When the backend repo is next to this one (or EXAM_EVAL_BACKEND_DIR points at
//      it), the lists are compared with the backend's own, so the two cannot drift apart
//      unnoticed. Without the backend checked out that part is skipped, not passed.
//
// Add a key: add it to the type, to the list here, and to ApiContractTest.php.
// Rename or remove one: that is a breaking change on the other side.
// ---------------------------------------------------------------------------

/** Compiles to `true` only when `List` names exactly the keys of `T`. */
type SameKeys<T, List extends readonly PropertyKey[]> = [Exclude<keyof T, List[number]>] extends [never]
  ? [Exclude<List[number], keyof T>] extends [never]
    ? true
    : 'the list names a key the type does not have'
  : 'the type has a key the list does not name';

const SHEET = [
  'id', 'batch_id', 'original_name', 'file_type', 'status',
  'student_id', 'student_name', 'student_roll_no', 'student_enrollment_no',
  'detected_roll_no', 'detected_enrollment_no', 'detected_student_name',
  'identity_source', 'identity_confidence', 'identity_confirmed', 'identity_confirmed_at',
  'identity_issue', 'identity_candidates', 'identity_page', 'duplicate_of_sheet_id',
  'can_bulk_confirm', 'stalled',
  'ai_total', 'teacher_total', 'max_marks', 'percentage', 'has_annotated',
  'failure_reason', 'evaluated_at', 'approved_at',
] as const;

const BATCH = [
  'id', 'question_paper_id', 'name', 'status', 'syear', 'total_sheets', 'evaluated_sheets',
  'approved_sheets', 'total_marks', 'paper_name', 'exam_type', 'standard_name', 'subject_name',
  'published_at', 'created_at',
] as const;

// `section_name` is optional on the type (an older server omits it) but always sent today.
const ROSTER_STUDENT = ['student_id', 'roll_no', 'enrollment_no', 'name', 'section_name'] as const;

const CONTEXT = [
  'batch_id', 'batch_name', 'batch_status', 'paper_id', 'paper_name', 'exam_type', 'subject_name',
  'class_name', 'grade_name', 'section_name', 'syear', 'total_marks',
] as const;

const ANSWER = [
  'id', 'question_no', 'question_id', 'question_title', 'question_type', 'is_objective', 'detected_answer',
  'selected_options', 'expected_answer', 'max_marks', 'ai_marks', 'teacher_marks', 'status', 'ai_confidence',
  'ai_remark', 'teacher_feedback', 'needs_attention', 'reviewed', 'page',
  'question_label', 'display_label', 'label_from_sheet', 'label_inferred',
] as const;

const ANSWER_KEY = [
  'paper', 'applies_to_class', 'eligible_students', 'ai_warning', 'total_marks', 'objective_count', 'subjective_count',
  'question_count', 'missing_model_answers', 'questions',
] as const;

const ANSWER_KEY_QUESTION = ['question_no', 'question_title', 'kind', 'max_marks', 'correct_letters', 'has_model_answer'] as const;

const ANSWER_KEY_PAPER = ['id', 'paper_name', 'exam_type', 'standard_name', 'grade_name', 'subject_name'] as const;

// -- compile-time: a mismatch here is a type error ---------------------------------------------

export const typeChecks: [
  SameKeys<EvaluationSheet, typeof SHEET>,
  SameKeys<EvaluationBatch, typeof BATCH>,
  SameKeys<Required<RosterStudent>, typeof ROSTER_STUDENT>,
  SameKeys<SheetContext, typeof CONTEXT>,
  SameKeys<EvaluationAnswer, typeof ANSWER>,
  SameKeys<AnswerKeySummary, typeof ANSWER_KEY>,
  SameKeys<AnswerKeySummary['questions'][number], typeof ANSWER_KEY_QUESTION>,
  SameKeys<AnswerKeySummary['paper'], typeof ANSWER_KEY_PAPER>,
  SameKeys<SheetDetail, readonly ['sheet', 'context', 'answers']>,
] = [true, true, true, true, true, true, true, true, true];

// The wrapper shapes the client unwraps: a sheet detail's `context` is optional in the type
// (an older server omits it) but sent today; a batch detail's extras appear only after a bulk
// confirmation or an upload.
const _batchDetailKeys: Array<keyof BatchDetail> = ['batch', 'sheets', 'roster', 'uploaded', 'rejected', 'confirmed', 'skipped'];

// -- run time: the same lists, against the backend's own --------------------------------------

const BACKEND = process.env.EXAM_EVAL_BACKEND_DIR ?? path.resolve(process.cwd(), '..', 'next_lms_erp');
const BACKEND_TEST = path.join(BACKEND, 'tests', 'Feature', 'ExamEvaluation', 'ApiContractTest.php');

/** The quoted names inside one `public const NAME = [...]` of the backend's contract test. */
function backendList(source: string, name: string): string[] {
  const block = new RegExp(`public const ${name} = \\[([\\s\\S]*?)\\];`).exec(source);

  assert.ok(block, `ApiContractTest.php has no constant ${name}`);

  return [...block[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
}

const canCompare = existsSync(BACKEND_TEST);
const sorted = (list: readonly string[]) => [...list].sort();

test('the key lists are not empty and have no duplicates', () => {
  for (const list of [SHEET, BATCH, ROSTER_STUDENT, CONTEXT, ANSWER, ANSWER_KEY, ANSWER_KEY_QUESTION, ANSWER_KEY_PAPER]) {
    assert.ok(list.length > 0);
    assert.equal(new Set(list).size, list.length, 'a key listed twice');
  }

  assert.ok(_batchDetailKeys.length > 0);
});

test('every list here matches the backend contract test, key for key', { skip: canCompare ? false : `the backend is not at ${BACKEND}; set EXAM_EVAL_BACKEND_DIR to compare` }, () => {
  const source = readFileSync(BACKEND_TEST, 'utf8');

  const pairs: Array<[string, readonly string[]]> = [
    ['SHEET', SHEET],
    ['BATCH', BATCH],
    ['ROSTER_STUDENT', ROSTER_STUDENT],
    ['CONTEXT', CONTEXT],
    ['ANSWER', ANSWER],
    ['ANSWER_KEY', ANSWER_KEY],
    ['ANSWER_KEY_QUESTION', ANSWER_KEY_QUESTION],
    ['ANSWER_KEY_PAPER', ANSWER_KEY_PAPER],
  ];

  for (const [name, mine] of pairs) {
    assert.deepEqual(sorted(mine), sorted(backendList(source, name)), `${name}: this side and the backend disagree`);
  }
});

test('the statuses the screens style are the ones the backend can produce', { skip: canCompare ? false : 'backend not checked out' }, () => {
  const source = readFileSync(BACKEND_TEST, 'utf8');
  const frontend = ['Identifying', 'Awaiting identity', 'Pending', 'Processing', 'Evaluated', 'Needs review', 'Approved', 'Failed'];
  const mention = /\$frontend = \[([^\]]*)\]/.exec(source);

  assert.ok(mention, 'the backend contract test lists the frontend statuses');
  assert.deepEqual(sorted([...mention[1].matchAll(/'([^']+)'/g)].map((m) => m[1])), sorted(frontend));
});
