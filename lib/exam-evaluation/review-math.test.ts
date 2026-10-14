import test from 'node:test';
import assert from 'node:assert/strict';

import {
  acceptAiMark,
  approvalBlocker,
  buildMarkEdits,
  computeTotals,
  formatMarks,
  formatMarksInput,
  isDirty,
  parseMarkInput,
  previewEdits,
  previewKey,
  questionLabel,
  toInputs,
  type ReviewAnswer,
} from './review-math';

/**
 * A three-question sheet matching the one the backend tests use:
 *   Q1 objective 2/2 (AI 2), Q2 written 5 (AI 3, flagged), Q3 written 3 (AI 0, flagged).
 */
function sheet(over: Partial<Record<number, Partial<ReviewAnswer>>> = {}): ReviewAnswer[] {
  const base: ReviewAnswer[] = [
    { question_no: 1, max_marks: 2, ai_marks: 2, teacher_marks: null, needs_attention: false },
    { question_no: 2, max_marks: 5, ai_marks: 3, teacher_marks: null, needs_attention: true },
    { question_no: 3, max_marks: 3, ai_marks: 0, teacher_marks: null, needs_attention: true },
  ];

  return base.map((answer) => ({ ...answer, ...(over[answer.question_no] ?? {}) }));
}

// -- Reading a mark box --------------------------------------------------------

test('an empty box means "not reviewed", not zero', () => {
  assert.deepEqual(parseMarkInput('', 5), { value: null, error: null });
  assert.deepEqual(parseMarkInput('   ', 5), { value: null, error: null });
  assert.deepEqual(parseMarkInput(undefined, 5), { value: null, error: null });
});

test('zero is a real mark, distinct from an empty box', () => {
  assert.deepEqual(parseMarkInput('0', 5), { value: 0, error: null });
});

test('whole, fractional and boundary marks are accepted; fractions keep two places', () => {
  assert.equal(parseMarkInput('4', 5).value, 4);
  assert.equal(parseMarkInput('2.5', 5).value, 2.5);
  assert.equal(parseMarkInput('5', 5).value, 5);
  assert.equal(parseMarkInput('2.456', 5).value, 2.46);
});

test('a mark above the maximum is an error, not clamped', () => {
  const parsed = parseMarkInput('6', 5);

  assert.equal(parsed.value, null);
  assert.match(parsed.error ?? '', /more than 5/);
});

test('a negative mark is an error', () => {
  assert.match(parseMarkInput('-1', 5).error ?? '', /negative/);
});

test('text that is only partly a number is an error, never read as its numeric prefix', () => {
  assert.match(parseMarkInput('3abc', 5).error ?? '', /number/);
  assert.match(parseMarkInput('abc', 5).error ?? '', /number/);
  assert.match(parseMarkInput('1,5', 5).error ?? '', /number/);
});

test('marks display without trailing zeros', () => {
  assert.equal(formatMarks(5), '5');
  assert.equal(formatMarks(2.5), '2.5');
  assert.equal(formatMarks(null), '—');
  assert.equal(formatMarksInput(null), '');
  assert.equal(formatMarksInput(0), '0');
});

// -- Starting state --------------------------------------------------------------

test('boxes start with only what the teacher already saved, never the AI suggestion', () => {
  const { marks, feedback } = toInputs(sheet({ 2: { teacher_marks: 4, teacher_feedback: 'Good.' } }));

  assert.deepEqual(marks, { 1: '', 2: '4', 3: '' });
  assert.deepEqual(feedback, { 1: '', 2: 'Good.', 3: '' });
});

// -- Totals ----------------------------------------------------------------------

test('with nothing reviewed the preview total is the AI total', () => {
  const answers = sheet();
  const totals = computeTotals(answers, toInputs(answers).marks);

  assert.equal(totals.maxTotal, 10);
  assert.equal(totals.aiTotal, 5);
  assert.equal(totals.teacherTotal, 5);
  assert.equal(totals.percentage, 50);
  assert.equal(totals.reviewedCount, 0);
  assert.equal(totals.unreviewedCount, 3);
});

test('AI 3/5 changed to 4 moves the total by one and the percentage by ten', () => {
  const answers = sheet();
  const totals = computeTotals(answers, { 1: '', 2: '4', 3: '' });

  assert.equal(totals.aiTotal, 5, 'the AI total does not move');
  assert.equal(totals.teacherTotal, 6);
  assert.equal(totals.percentage, 60);
  assert.equal(totals.reviewedCount, 1);
});

test('a teacher mark of zero lowers the total rather than falling back to the AI', () => {
  const totals = computeTotals(sheet(), { 1: '', 2: '0', 3: '' });

  assert.equal(totals.teacherTotal, 2); // Q1 AI 2 + Q2 teacher 0 + Q3 AI 0
});

test('fractional marks add up without float noise', () => {
  const answers = sheet();
  const totals = computeTotals(answers, { 1: '0.1', 2: '0.2', 3: '0.3' });

  assert.equal(totals.teacherTotal, 0.6);
});

test('an invalid box is counted, and the preview uses the suggestion for it', () => {
  const totals = computeTotals(sheet(), { 1: '', 2: '99', 3: '' });

  assert.equal(totals.invalidCount, 1);
  assert.equal(totals.teacherTotal, 5);
});

test('flagged questions are counted, and the unresolved ones are those with no mark', () => {
  const answers = sheet();

  assert.equal(computeTotals(answers, { 1: '', 2: '', 3: '' }).flaggedCount, 2);
  assert.equal(computeTotals(answers, { 1: '', 2: '', 3: '' }).flaggedUnresolvedCount, 2);
  assert.equal(computeTotals(answers, { 1: '', 2: '3', 3: '' }).flaggedUnresolvedCount, 1);
  assert.equal(computeTotals(answers, { 1: '', 2: '3', 3: '0' }).flaggedUnresolvedCount, 0);
});

test('a sheet with no marks available has no percentage', () => {
  const totals = computeTotals([], {});

  assert.equal(totals.percentage, null);
  assert.equal(totals.teacherTotal, 0);
});

// -- Saving ----------------------------------------------------------------------

test('a save sends every question, with an empty box as "no teacher mark"', () => {
  const answers = sheet();
  const edits = buildMarkEdits(answers, { 1: '', 2: '4', 3: '0' }, { 1: '', 2: '  Missed light.  ', 3: '' });

  assert.deepEqual(edits, [
    { question_no: 1, teacher_marks: null, teacher_feedback: null },
    { question_no: 2, teacher_marks: 4, teacher_feedback: 'Missed light.' },
    { question_no: 3, teacher_marks: 0, teacher_feedback: null },
  ]);
});

test('an invalid box is never sent as a number', () => {
  const edits = buildMarkEdits(sheet(), { 1: '', 2: '99', 3: '' }, {});

  assert.equal(edits[1].teacher_marks, null);
});

test('accepting the AI mark fills the box with its suggestion, so approval treats it as the teacher’s', () => {
  const answers = sheet();

  assert.equal(acceptAiMark(answers[1]), '3');
  assert.equal(acceptAiMark(answers[2]), '0');
  assert.equal(computeTotals(answers, { 1: '', 2: acceptAiMark(answers[1]), 3: acceptAiMark(answers[2]) }).flaggedUnresolvedCount, 0);
});

// -- Unsaved changes ---------------------------------------------------------------

test('nothing has changed straight after loading', () => {
  const answers = sheet({ 2: { teacher_marks: 4, teacher_feedback: 'Good.' } });
  const { marks, feedback } = toInputs(answers);

  assert.equal(isDirty(answers, marks, feedback, 101, 101), false);
});

test('a typed mark, a feedback edit or a different student each count as a change', () => {
  const answers = sheet();
  const { marks, feedback } = toInputs(answers);

  assert.equal(isDirty(answers, { ...marks, 2: '4' }, feedback, 101, 101), true);
  assert.equal(isDirty(answers, marks, { ...feedback, 2: 'x' }, 101, 101), true);
  assert.equal(isDirty(answers, marks, feedback, 102, 101), true);
  assert.equal(isDirty(answers, marks, feedback, null, null), false);
});

test('trailing spaces are not a change', () => {
  const answers = sheet({ 2: { teacher_marks: 4, teacher_feedback: 'Good.' } });
  const { marks, feedback } = toInputs(answers);

  assert.equal(isDirty(answers, { ...marks, 2: '4 ' }, { ...feedback, 2: 'Good. ' }, 101, 101), false);
});

// -- Approval ----------------------------------------------------------------------

test('approval needs a student first', () => {
  assert.match(approvalBlocker(sheet(), { 1: '', 2: '3', 3: '0' }, null) ?? '', /Assign this sheet to a student/);
});

test('approval is blocked while a flagged question has no teacher mark', () => {
  assert.match(approvalBlocker(sheet(), { 1: '', 2: '', 3: '' }, 101) ?? '', /2 flagged questions still need your mark/);
  assert.match(approvalBlocker(sheet(), { 1: '', 2: '3', 3: '' }, 101) ?? '', /1 flagged question still needs your mark/);
});

test('approval is blocked while any box is invalid', () => {
  assert.match(approvalBlocker(sheet(), { 1: '', 2: '99', 3: '0' }, 101) ?? '', /isn’t valid/);
});

test('once every flagged question has a mark, and every box is valid, approval is allowed', () => {
  assert.equal(approvalBlocker(sheet(), { 1: '', 2: '4', 3: '2' }, 101), null);
});

test('unflagged questions never block approval, even when untouched', () => {
  // Q1 is objective and unflagged; it takes the AI mark on the server at approval.
  assert.equal(approvalBlocker(sheet(), { 1: '', 2: '3', 3: '0' }, 101), null);
});

// -- Question labels ------------------------------------------------------------

test('a question is called by the number its sheet printed, never by position or database id', () => {
  assert.equal(questionLabel({ question_no: 3, display_label: 'Q.2' }), 'Q.2');
  assert.equal(questionLabel({ question_no: 2, display_label: 'Q.1(B)' }), 'Q.1(B)');
  // Without a label from the server, the paper position -- the only number the page may fall back on.
  assert.equal(questionLabel({ question_no: 6, display_label: '' }), 'Q6');
  assert.equal(questionLabel({ question_no: 6, display_label: undefined }), 'Q6');
});

test('questions whose printed number was not read are counted, so the page can say so', () => {
  const answers: ReviewAnswer[] = [
    { question_no: 1, max_marks: 1, ai_marks: 1, teacher_marks: null, needs_attention: false, display_label: 'Q.1(A)', label_from_sheet: true },
    { question_no: 2, max_marks: 1, ai_marks: 1, teacher_marks: null, needs_attention: false, display_label: 'Q2', label_from_sheet: false },
    { question_no: 3, max_marks: 1, ai_marks: 1, teacher_marks: null, needs_attention: false },
  ];

  assert.equal(computeTotals(answers, {}).unlabelledCount, 1, 'only an explicit "not read" counts; an older server sends nothing');
});

// -- A question is never counted twice --------------------------------------------

test('a repeated question row is counted once in every total', () => {
  const answers = [...sheet(), { ...sheet()[1] }];   // Q2 twice
  const totals = computeTotals(answers, { 2: '4' });

  assert.equal(totals.questionCount, 3);
  assert.equal(totals.maxTotal, 10);
  assert.equal(totals.aiTotal, 5);
  assert.equal(totals.teacherTotal, 6);   // 2 (AI) + 4 + 0 (AI)
  assert.equal(totals.reviewedCount, 1);
});

// -- The live preview -----------------------------------------------------------------

test('the preview is sent only the marks that differ from what is saved', () => {
  const answers = sheet({ 2: { teacher_marks: 4 } });

  // Nothing typed since the last save: nothing to preview.
  assert.deepEqual(previewEdits(answers, toInputs(answers).marks), []);

  // A changed mark, a newly given one, and a cleared one.
  assert.deepEqual(previewEdits(answers, { 1: '1', 2: '', 3: '2.5' }), [
    { question_no: 1, teacher_marks: 1 },
    { question_no: 2, teacher_marks: null },
    { question_no: 3, teacher_marks: 2.5 },
  ]);
});

test('a half-typed or illegal mark is not sent to the preview, so it keeps the last good drawing', () => {
  const answers = sheet();

  assert.deepEqual(previewEdits(answers, { 1: '3', 2: '5.5', 3: 'abc' }), [], 'over max, over max, not a number');
  assert.deepEqual(previewEdits(answers, { 2: '-1' }), []);
  // "1." is a number the teacher is still typing; it is already a valid 1.
  assert.deepEqual(previewEdits(answers, { 2: '1.' }), [{ question_no: 2, teacher_marks: 1 }]);
});

test('the preview key changes exactly when the drawing would', () => {
  const a = previewKey([{ question_no: 2, teacher_marks: 4 }]);

  assert.equal(a, previewKey([{ question_no: 2, teacher_marks: 4 }]));
  assert.notEqual(a, previewKey([{ question_no: 2, teacher_marks: 4.5 }]));
  assert.notEqual(a, previewKey([{ question_no: 2, teacher_marks: null }]));
  assert.equal(previewKey([]), '');
});

test('the total and percentage follow a typed mark immediately, with partial marks', () => {
  const answers = sheet();   // AI total 5 of 10

  assert.deepEqual(
    (({ teacherTotal, percentage, aiTotal }) => ({ teacherTotal, percentage, aiTotal }))(computeTotals(answers, { 2: '4', 3: '1.5' })),
    { teacherTotal: 7.5, percentage: 75, aiTotal: 5 }   // 2 + 4 + 1.5; the AI total is untouched
  );
  // An illegal box falls back to the AI's mark in the preview and is counted, never clamped.
  const bad = computeTotals(answers, { 2: '9' });
  assert.equal(bad.teacherTotal, 5);
  assert.equal(bad.invalidCount, 1);
});
