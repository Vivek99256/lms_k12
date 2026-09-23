import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fallbackTypeLabel,
  foldTypeToken,
  matchesQuestionType,
  questionTypeAliases,
  questionTypeDisplayLabel,
} from './question-types';

const mcq = {
  question_type_code: 'mcq',
  question_type_label: 'Multiple Choice',
  question_type: 'multiple',
};

const assertionReason = {
  question_type_code: 'assertion_reason',
  question_type_label: 'Assertion & Reason',
  question_type: 'assertion & reason',
};

/** An AI-generated question: no extraction sidecar, so no catalogue row. */
const generated = {
  question_type_code: '',
  question_type_label: '',
  question_type: 'narrative',
};

test('folds case, punctuation and separators to the same token', () => {
  assert.equal(foldTypeToken('Assertion & Reason'), 'assertion reason');
  assert.equal(foldTypeToken('assertion_reason'), 'assertion reason');
  assert.equal(foldTypeToken('ASSERTION-REASON'), 'assertion reason');
  assert.equal(foldTypeToken('True / False'), 'true false');
  assert.equal(foldTypeToken(null), '');
});

test('a question answers to its catalogue code, catalogue label and grading name', () => {
  assert.deepEqual(questionTypeAliases(mcq), ['mcq', 'multiple choice', 'multiple']);
  assert.deepEqual(questionTypeAliases(generated), ['narrative']);
  assert.deepEqual(questionTypeAliases(null), []);
});

test('matches a section that asks by catalogue code', () => {
  assert.equal(matchesQuestionType(mcq, ['mcq']), true);
  assert.equal(matchesQuestionType(assertionReason, ['assertion_reason']), true);
  assert.equal(matchesQuestionType(mcq, ['assertion_reason']), false);
});

test('matches a section that asks by catalogue label', () => {
  assert.equal(matchesQuestionType(mcq, ['Multiple Choice']), true);
  assert.equal(matchesQuestionType(assertionReason, ['Assertion & Reason']), true);
});

test('keeps templates saved against the grading names working', () => {
  // Every built-in preset stores 'multiple', from before the dropdown was fed
  // from the catalogue. Those sections must still collect the MCQs.
  assert.equal(matchesQuestionType(mcq, ['multiple']), true);
  assert.equal(matchesQuestionType(generated, ['narrative']), true);
  assert.equal(matchesQuestionType(generated, ['mcq']), false);
});

test('a section that chose no type matches nothing', () => {
  assert.equal(matchesQuestionType(mcq, []), false);
  assert.equal(matchesQuestionType(mcq, ['', '   ']), false);
  assert.equal(matchesQuestionType(mcq, null), false);
});

test('prints the catalogue label, falling back to the grading name', () => {
  assert.equal(questionTypeDisplayLabel(mcq), 'Multiple Choice');
  assert.equal(questionTypeDisplayLabel(generated), 'narrative');
  assert.equal(questionTypeDisplayLabel(null), '');
});

test('reads a bare stored value back as a label', () => {
  assert.equal(fallbackTypeLabel('assertion_reason'), 'Assertion Reason');
  assert.equal(fallbackTypeLabel('multiple'), 'Multiple');
  assert.equal(fallbackTypeLabel('  '), '');
});
