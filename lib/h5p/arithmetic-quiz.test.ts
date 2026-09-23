import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DIFFICULTY_RANGES,
  arithmeticFeedback,
  generateArithmeticPaper,
  scoreArithmeticAttempt,
  type ArithmeticQuestion,
  type ArithmeticQuizRules,
} from './arithmetic-quiz';

/**
 * The generator decides what a class is asked, so the properties that matter
 * are the ones a teacher would notice the hard way: a negative answer in a
 * class that has not met negatives, a division with a remainder, a division by
 * zero, or the same question three times in twenty.
 *
 * Generation is seeded, so these assert on real papers rather than on
 * statistics over a sample.
 */

function rules(overrides: Partial<ArithmeticQuizRules> = {}): ArithmeticQuizRules {
  return {
    operations: ['addition'],
    difficulty_level: 1,
    max_questions: 20,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

test('the same seed always produces the same paper', () => {
  const spec = rules({ operations: ['addition', 'multiplication'], difficulty_level: 2 });

  assert.deepEqual(generateArithmeticPaper(spec, 12345), generateArithmeticPaper(spec, 12345));
});

test('a different seed produces a different paper', () => {
  const spec = rules({ operations: ['multiplication'], difficulty_level: 3, max_questions: 20 });

  const a = generateArithmeticPaper(spec, 1).map((q) => q.prompt).join('|');
  const b = generateArithmeticPaper(spec, 2).map((q) => q.prompt).join('|');

  assert.notEqual(a, b);
});

test('the paper is exactly as long as the author asked for', () => {
  assert.equal(generateArithmeticPaper(rules({ max_questions: 7 }), 99).length, 7);
  // Even when the range cannot supply that many distinct questions -- the
  // paper falls back to repeats rather than coming up short.
  assert.equal(generateArithmeticPaper(rules({ max_questions: 100 }), 99).length, 100);
});

test('subtraction never produces a negative answer', () => {
  for (const seed of [1, 7, 4242, 999983]) {
    const paper = generateArithmeticPaper(
      rules({ operations: ['subtraction'], difficulty_level: 3, max_questions: 60 }),
      seed
    );

    for (const question of paper) {
      assert.ok(question.answer >= 0, `${question.prompt} = ${question.answer}`);
      assert.equal(question.left - question.right, question.answer);
    }
  }
});

test('division is always exact and never divides by zero', () => {
  for (const seed of [3, 11, 5150, 771001]) {
    const paper = generateArithmeticPaper(
      rules({ operations: ['division'], difficulty_level: 3, max_questions: 60 }),
      seed
    );

    for (const question of paper) {
      assert.notEqual(question.right, 0, question.prompt);
      assert.equal(question.left % question.right, 0, `${question.prompt} has a remainder`);
      assert.equal(question.left / question.right, question.answer);
    }
  }
});

test('operands stay inside the level range', () => {
  const { min, max } = DIFFICULTY_RANGES[1];
  const paper = generateArithmeticPaper(
    // Addition, subtraction and multiplication draw both operands from the
    // range directly. Division is excluded here because it multiplies two
    // in-range numbers to build the dividend, which is above the range by
    // design -- see draw()'s note.
    rules({ operations: ['addition', 'subtraction', 'multiplication'], difficulty_level: 1, max_questions: 50 }),
    2024
  );

  for (const question of paper) {
    assert.ok(question.left >= min && question.left <= max, question.prompt);
    assert.ok(question.right >= min && question.right <= max, question.prompt);
  }
});

test('a range with room produces no duplicate questions', () => {
  const paper = generateArithmeticPaper(
    rules({ operations: ['multiplication'], difficulty_level: 3, max_questions: 20 }),
    606
  );

  const keys = new Set(paper.map((q) => `${q.operation}:${q.left}:${q.right}`));
  assert.equal(keys.size, paper.length);
});

test('every chosen operation shows up in a long enough paper', () => {
  const paper = generateArithmeticPaper(
    rules({ operations: ['addition', 'division'], difficulty_level: 2, max_questions: 40 }),
    31337
  );

  const used = new Set(paper.map((q) => q.operation));
  assert.deepEqual([...used].sort(), ['addition', 'division']);
});

test('an empty operation list falls back to addition rather than an empty paper', () => {
  const paper = generateArithmeticPaper(rules({ operations: [], max_questions: 5 }), 8);

  assert.equal(paper.length, 5);
  assert.ok(paper.every((q) => q.operation === 'addition'));
});

test('an unknown difficulty level falls back to the easiest', () => {
  const odd = generateArithmeticPaper(rules({ difficulty_level: 9, max_questions: 30 }), 17);
  const easy = generateArithmeticPaper(rules({ difficulty_level: 1, max_questions: 30 }), 17);

  assert.deepEqual(odd, easy);
});

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function paper(): ArithmeticQuestion[] {
  return [
    { index: 0, operation: 'addition', left: 3, right: 4, answer: 7, prompt: '3 + 4' },
    { index: 1, operation: 'addition', left: 5, right: 6, answer: 11, prompt: '5 + 6' },
    { index: 2, operation: 'addition', left: 8, right: 9, answer: 17, prompt: '8 + 9' },
    { index: 3, operation: 'addition', left: 2, right: 2, answer: 4, prompt: '2 + 2' },
  ];
}

test('score counts correct answers at the authored point value', () => {
  const result = scoreArithmeticAttempt(paper(), [7, 11, 0, 4], {
    points_per_question: 3,
    pass_percentage: 60,
  });

  assert.equal(result.correctCount, 3);
  assert.equal(result.answeredCount, 4);
  assert.equal(result.score, 9);
  assert.equal(result.maxScore, 12);
  assert.equal(result.percentage, 75);
  assert.equal(result.passed, true);
});

test('unanswered questions count against the total, not out of it', () => {
  // The case this exists for: an attempt that ran out of time after two
  // questions. Scoring out of what was answered would report full marks.
  const result = scoreArithmeticAttempt(paper(), [7, 11], {
    points_per_question: 1,
    pass_percentage: 60,
  });

  assert.equal(result.answeredCount, 2);
  assert.equal(result.correctCount, 2);
  assert.equal(result.maxScore, 4);
  assert.equal(result.percentage, 50);
  assert.equal(result.passed, false);
});

test('a null or NaN answer is unanswered, not wrong', () => {
  const result = scoreArithmeticAttempt(paper(), [7, null, Number.NaN, undefined], {
    points_per_question: 1,
    pass_percentage: 100,
  });

  assert.equal(result.answeredCount, 1);
  assert.equal(result.correctCount, 1);
});

test('zero is a real answer and is scored as one', () => {
  // 0 is falsy, which is exactly the bug this pins: `if (given)` would treat a
  // correct answer of 0 as unanswered.
  const zero: ArithmeticQuestion[] = [
    { index: 0, operation: 'subtraction', left: 5, right: 5, answer: 0, prompt: '5 − 5' },
  ];

  const result = scoreArithmeticAttempt(zero, [0], { points_per_question: 1, pass_percentage: 100 });

  assert.equal(result.answeredCount, 1);
  assert.equal(result.correctCount, 1);
  assert.equal(result.passed, true);
});

test('an empty paper scores zero rather than NaN', () => {
  const result = scoreArithmeticAttempt([], [], { points_per_question: 1, pass_percentage: 0 });

  assert.equal(result.percentage, 0);
  assert.equal(result.maxScore, 0);
  assert.ok(!Number.isNaN(result.percentage));
});

test('the last matching feedback band wins', () => {
  const bands = [
    { from: 0, to: 100, feedback: 'Attempted.' },
    { from: 60, to: 100, feedback: 'Passed.' },
  ];

  assert.equal(arithmeticFeedback(80, bands), 'Passed.');
  assert.equal(arithmeticFeedback(20, bands), 'Attempted.');
  assert.equal(arithmeticFeedback(80, null), '');
});
