import test from 'node:test';
import assert from 'node:assert/strict';

import { canPlay, selectedOptionId, toBankQuestion, type DiagnosticLikeQuestion } from './diagnostic-answers';
import { mappingForQuestion } from '@/lib/h5p/question-bank-h5p-map';
import type { QuestionResult } from '@/components/h5p/players/types';

/**
 * `DiagnosticQuestionItem` used to reach this module with `questionType` only
 * ("MCQ" or nothing), because the chapter/concept diagnostic pools only ever
 * drew MCQ. These guard that the full ladder now round-trips into the
 * `BankQuestion` shape `mappingForQuestion()` reads, the same way
 * `exam-answers.test.ts` guards `/lms/pal/create` -- so a diagnostic pool that
 * starts serving true/false, fill-blank or assertion & reason rows resolves a
 * player instead of silently falling back to the generic radio list.
 */

function question(overrides: Partial<DiagnosticLikeQuestion> = {}): DiagnosticLikeQuestion {
  return {
    questionId: '701',
    title: '<p>Which gas do plants absorb?</p>',
    options: [
      { id: '9001', answer: 'Oxygen', isCorrect: false },
      { id: '9002', answer: 'Carbon dioxide', isCorrect: true },
      { id: '9003', answer: 'Nitrogen', isCorrect: false },
    ],
    questionTypeCode: 'mcq',
    questionTypeRaw: 'Multiple choice',
    questionType: 'MCQ',
    modelAnswer: null,
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
    questionId: 701,
    score: 1,
    maxScore: 1,
    correct: true,
    durationSeconds: 8,
    ...overrides,
  };
}

test('toBankQuestion carries the full type ladder through, not just questionType', () => {
  const q = question({
    questionTypeCode: 'assertion_reason',
    questionTypeRaw: 'Assertion & Reason',
    questionType: 'MCQ',
    assertion: 'Plants absorb carbon dioxide.',
    reason: 'Carbon dioxide is required for photosynthesis.',
  });
  const bank = toBankQuestion(q);

  assert.equal(bank.question_type_code, 'assertion_reason');
  assert.equal(bank.question_type_raw, 'Assertion & Reason');
  assert.equal(bank.assertion, 'Plants absorb carbon dioxide.');
  assert.equal(bank.reason, 'Carbon dioxide is required for photosynthesis.');
});

test('a question with no finer type still resolves through the questionType fallback', () => {
  const bank = toBankQuestion(question({ questionTypeCode: null, questionTypeRaw: null }));
  const mapping = mappingForQuestion(bank);
  assert.ok(mapping);
  assert.equal(mapping.target?.kind, 'single_choice_set');
});

test('a fill-blank row resolves a non-MCQ player once questionTypeCode is served', () => {
  const q = question({
    questionTypeCode: 'fill_blank',
    questionTypeRaw: 'Fill in the blank',
    questionType: null,
    modelAnswer: 'photosynthesis',
    options: [],
  });
  const mapping = mappingForQuestion(toBankQuestion(q));
  assert.ok(mapping);
  assert.equal(mapping.target?.kind, 'fill_in_the_blanks');
});

test('canPlay still refuses a question missing curriculum scope, ladder notwithstanding', () => {
  assert.equal(canPlay(question({ chapterId: null })), false);
});

test('canPlay resolves once scope and a real type are both present', () => {
  assert.equal(canPlay(question()), true);
});

test('selectedOptionId maps a chosen option id back onto the served option', () => {
  const q = question();
  assert.equal(selectedOptionId(q, result({ choiceIds: [9002] })), '9002');
  assert.equal(selectedOptionId(q, result({ choiceIds: [] })), null);
});
