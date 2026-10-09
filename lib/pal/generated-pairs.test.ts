import test from 'node:test';
import assert from 'node:assert/strict';

import { toBankQuestion as examBank, type PalExamQuestion } from './exam-answers';
import { toBankQuestion as diagnosticBank, type DiagnosticLikeQuestion } from './diagnostic-answers';
import { matchPairs, readPairs } from '@/lib/h5p/question-bank-h5p-map';

/**
 * A generated match-the-following question reaches PAL with structured `pairs`.
 *
 * PAL copies the bank fields it needs by hand (pal.ts, pal-diagnostic.ts), so a
 * field the copy forgets is silently lost: the question still plays, but
 * `matchPairs()` falls back to parsing the model answer ("a-(ii), b-(i)") and the
 * memory game is built from letters and numerals. These guard that the pairs
 * survive the projection in both PAL paths, and that a row without them is
 * unchanged.
 */

const PAIRS = [
  { left: 'x-axis', right: 'Horizontal reference line' },
  { left: 'y-axis', right: 'Vertical reference line' },
  { left: 'Origin (0, 0)', right: 'Where the axes cross' },
  { left: 'Ratio a:b', right: 'Comparison of two quantities' },
];

function examMatch(overrides: Partial<PalExamQuestion> = {}): PalExamQuestion {
  return {
    questionId: '801',
    questionText: 'Match each term in Column A with its description in Column B.',
    options: [],
    questionTypeCode: 'match_following',
    questionTypeRaw: 'Match the Following',
    questionType: 'Narrative',
    modelAnswer: 'a-(ii), b-(i), c-(iv), d-(iii)',
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

function diagnosticMatch(overrides: Partial<DiagnosticLikeQuestion> = {}): DiagnosticLikeQuestion {
  return {
    questionId: '802',
    title: 'Match each term in Column A with its description in Column B.',
    options: [],
    questionTypeCode: 'match_following',
    questionTypeRaw: 'Match the Following',
    questionType: 'Narrative',
    modelAnswer: 'a-(ii), b-(i), c-(iv), d-(iii)',
    assertion: null,
    reason: null,
    standardId: 7,
    subjectId: 3,
    chapterId: 1012,
    ...overrides,
  };
}

test('PAL exam: structured pairs reach the H5P projection and are read exactly', () => {
  const bank = examBank(examMatch({ pairs: PAIRS }));

  assert.deepEqual(bank.pairs, PAIRS);
  assert.deepEqual(matchPairs(bank), PAIRS);
});

test('PAL diagnostic: structured pairs reach the H5P projection and are read exactly', () => {
  const bank = diagnosticBank(diagnosticMatch({ pairs: PAIRS }));

  assert.deepEqual(bank.pairs, PAIRS);
  assert.deepEqual(matchPairs(bank), PAIRS);
});

test('without pairs the PAL projection is what it was: null, and the text parse', () => {
  const exam = examBank(examMatch());
  const diagnostic = diagnosticBank(diagnosticMatch());

  assert.equal(exam.pairs, null);
  assert.equal(diagnostic.pairs, null);
  // Not meaningful pairs -- the old text parse of a bare key -- which is exactly
  // why structured pairs exist. The point is that nothing changed for such rows.
  assert.notDeepEqual(matchPairs(exam), PAIRS);
});

test('readPairs accepts only well-formed pairs from an untyped payload', () => {
  assert.deepEqual(readPairs(PAIRS), PAIRS);
  assert.deepEqual(readPairs([{ left: ' a ', right: ' b ' }]), [{ left: 'a', right: 'b' }]);

  for (const bad of [undefined, null, 'x', 7, {}, [], [null], [{}], [{ left: 'only' }], [{ left: '', right: 'x' }], [{ left: 3, right: 4 }]]) {
    assert.equal(readPairs(bad), null, JSON.stringify(bad));
  }

  // A mix keeps the good pairs and drops the rest.
  assert.deepEqual(readPairs([{ left: 'a', right: 'b' }, { left: 'c' }, null]), [{ left: 'a', right: 'b' }]);
});
