import test from 'node:test';
import assert from 'node:assert/strict';

import {
  splitSubmissions,
  submissionFor,
  toBankQuestion,
  toPlayerQuestion,
  type PalExamQuestion,
} from './exam-answers';
import type { QuestionResult } from '@/components/h5p/players/types';

/**
 * What is worth guarding here is the ROUND TRIP, not the rendering.
 *
 * A PAL question renders correctly and still records nothing if the option id
 * is lost on the way out, or records every answer wrong if a typed blank is
 * pushed down the option path with no id to put in it. Both of those look fine
 * on screen and go wrong in `lms_online_exam_answer`, which is the class of
 * bug that reaches a report card rather than a bug report.
 */

function mcq(overrides: Partial<PalExamQuestion> = {}): PalExamQuestion {
  return {
    questionId: '501',
    questionText: '<p>Which gas do plants absorb?</p>',
    options: [
      { id: '9001', answer: 'Oxygen', correctFlag: '0' },
      { id: '9002', answer: 'Carbon dioxide', correctFlag: '1' },
      { id: '9003', answer: 'Nitrogen', correctFlag: '0' },
    ],
    questionTypeCode: 'mcq',
    questionType: 'MCQ',
    modelAnswer: null,
    marks: 1,
    difficulty: 'easy',
    assertion: null,
    reason: null,
    standardId: 7,
    subjectId: 3,
    chapterId: 1012,
    ...overrides,
  };
}

function result(overrides: Partial<QuestionResult> = {}): QuestionResult {
  return {
    questionId: 501,
    score: 1,
    maxScore: 1,
    correct: true,
    durationSeconds: 12,
    ...overrides,
  };
}

test('an option carries its answer_master id into the activity', () => {
  const bank = toBankQuestion(mcq());

  assert.deepEqual(
    bank.options?.map((option) => [option.label, option.source_option_id, option.is_correct]),
    [
      ['A', 9001, false],
      ['B', 9002, true],
      ['C', 9003, false],
    ]
  );
});

test('the player question carries the scope off the question, not the paper', () => {
  const playable = toPlayerQuestion(mcq({ chapterId: 2024 }));

  assert.equal(playable.chapter_id, 2024);
  assert.equal(playable.standard_id, 7);
  assert.equal(playable.subject_id, 3);
});

test('an unmarkable result submits nothing at all', () => {
  // A player reports null when its activity has nothing to be right or wrong
  // about. Submitting that as `correct: false` would mark a learner wrong for
  // work nothing could mark; recording nothing leaves it unattempted, which is
  // what actually happened.
  assert.equal(submissionFor(mcq(), result({ correct: null })), null);
});

test('a chosen option submits as the id##flag pair the controller already marks', () => {
  const submission = submissionFor(mcq(), result({ choiceIds: [9002] }));

  assert.deepEqual(submission, { kind: 'option', questionId: '501', value: '9002##1' });
});

test('a WRONG choice submits the distractor, not merely a verdict', () => {
  // Misconception detection keys off which distractor was chosen, so losing
  // the id here would silently disable it while the paper still scored.
  const submission = submissionFor(mcq(), result({ correct: false, choiceIds: [9003] }));

  assert.deepEqual(submission, { kind: 'option', questionId: '501', value: '9003##0' });
});

test('an option the question does not carry is not submitted as one of its own', () => {
  const submission = submissionFor(mcq(), result({ choiceIds: [4242] }));

  assert.equal(submission?.kind, 'interactive');
});

test('true/false recovers the option from the verdict alone', () => {
  // The True/False player answers a boolean and has never seen answer_master,
  // so the row has to be reconstructed: correct means the learner said what
  // the question says.
  const question = mcq({
    questionId: '77',
    questionTypeCode: 'true_false',
    questionText: '<p>Water boils at 100 degrees Celsius at sea level.</p>',
    options: [
      { id: '3001', answer: 'True', correctFlag: '1' },
      { id: '3002', answer: 'False', correctFlag: '0' },
    ],
  });

  assert.deepEqual(submissionFor(question, result({ correct: true })), {
    kind: 'option',
    questionId: '77',
    value: '3001##1',
  });

  assert.deepEqual(submissionFor(question, result({ correct: false })), {
    kind: 'option',
    questionId: '77',
    value: '3002##0',
  });
});

test('a typed blank submits a verdict, because there is no row to name', () => {
  const question = mcq({
    questionId: '88',
    questionTypeCode: 'fill_blank',
    questionType: 'Narrative',
    questionText: '<p>The capital of France is ___.</p>',
    options: [],
    modelAnswer: 'Paris',
  });

  // The response is what the learner WROTE. The result screen shows it back to
  // them, and the server marks a single-slot answer against it -- a score
  // ("1/1") in this field would be useless for the first and wrong for the
  // second.
  const submission = submissionFor(
    question,
    result({ correct: true, response: 'Paris', score: 1, maxScore: 1 })
  );

  assert.deepEqual(submission, {
    kind: 'interactive',
    questionId: '88',
    correct: true,
    response: 'Paris',
    score: 1,
    maxScore: 1,
  });
});

test('match the following submits a verdict too', () => {
  const question = mcq({
    questionId: '99',
    questionTypeCode: 'match_following',
    questionType: 'Narrative',
    options: [],
    modelAnswer: 'Delhi - India; Paris - France',
  });

  assert.equal(submissionFor(question, result({ correct: false }))?.kind, 'interactive');
});

test('the two channels are split, never merged', () => {
  const { options, interactive } = splitSubmissions([
    { kind: 'option', questionId: '1', value: '10##1' },
    { kind: 'interactive', questionId: '2', correct: false, response: 'lake', score: 0, maxScore: 1 },
    { kind: 'option', questionId: '3', value: '30##0' },
  ]);

  assert.deepEqual(options, { '1': '10##1', '3': '30##0' });
  assert.deepEqual(Object.keys(interactive), ['2']);
  assert.equal(interactive['2'].correct, false);
});
