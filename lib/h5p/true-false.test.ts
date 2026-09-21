import test from 'node:test';
import assert from 'node:assert/strict';

import {
  answerBalance,
  drawTrueFalsePaper,
  isCorrectAnswer,
  plainText,
  scoreTrueFalseAttempt,
  statementFeedback,
  trueFalseFeedback,
  type TrueFalseQuestion,
} from './true-false';

/**
 * The behaviour worth guarding here is the DRAW: a pool asked in the wrong
 * order, asked twice, truncated before it was shuffled, or scored against the
 * pool rather than the paper. All four render perfectly and score wrongly,
 * which is the class of bug that reaches a classroom.
 *
 * The draw is seeded, so these assert on real papers rather than on statistics.
 */

function pool(size: number): TrueFalseQuestion[] {
  return Array.from({ length: size }, (_, i) => ({
    id: i + 1,
    question_text: `<p>Statement ${i + 1}</p>`,
    // Alternating, so a pool of any size is a balanced one.
    correct_answer: i % 2 === 0,
    feedback_correct: `Right about ${i + 1}.`,
    feedback_incorrect: `Wrong about ${i + 1}.`,
    explanation: null,
    media_image: null,
    media_alt: null,
  }));
}

const ALL_IN_ORDER = { randomize_questions: false, questions_to_ask: 0 };

// ---------------------------------------------------------------------------
// Drawing a paper
// ---------------------------------------------------------------------------

test('zero means the whole pool in author order', () => {
  const paper = drawTrueFalsePaper(pool(10), ALL_IN_ORDER, 1);

  assert.equal(paper.length, 10);
  assert.deepEqual(
    paper.map((entry) => entry.question.id),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  );
});

test('a positive count asks that many', () => {
  const paper = drawTrueFalsePaper(pool(20), { randomize_questions: true, questions_to_ask: 10 }, 42);

  assert.equal(paper.length, 10);
});

test('asking for more than the pool holds asks for the pool', () => {
  const paper = drawTrueFalsePaper(pool(6), { randomize_questions: false, questions_to_ask: 99 }, 1);

  assert.equal(paper.length, 6);
});

test('the same seed always draws the same paper', () => {
  const rules = { randomize_questions: true, questions_to_ask: 5 };

  assert.deepEqual(
    drawTrueFalsePaper(pool(20), rules, 777).map((e) => e.question.id),
    drawTrueFalsePaper(pool(20), rules, 777).map((e) => e.question.id)
  );
});

test('a different seed draws a different subset of a large pool', () => {
  const rules = { randomize_questions: true, questions_to_ask: 5 };
  const fingerprint = (seed: number) =>
    drawTrueFalsePaper(pool(20), rules, seed)
      .map((e) => e.question.id)
      .join(',');

  const first = fingerprint(1);
  const anyDifferent = [2, 3, 4, 5].some((seed) => fingerprint(seed) !== first);

  assert.equal(anyDifferent, true);
});

test('the pool is shuffled before it is truncated, not after', () => {
  /*
   * This is the whole point of a pool. Truncate-then-shuffle would ask the
   * first five statements in a random order every single time -- which looks
   * random, passes a casual glance, and means the other fifteen are never
   * asked. So: over many seeds, a statement from the back of the pool must
   * turn up in a five-question paper.
   */
  const rules = { randomize_questions: true, questions_to_ask: 5 };

  const reachedTheBack = Array.from({ length: 30 }, (_, seed) =>
    drawTrueFalsePaper(pool(20), rules, seed).map((e) => e.question.id)
  ).some((ids) => ids.some((id) => id > 15));

  assert.equal(reachedTheBack, true);
});

test('a drawn paper never repeats a statement', () => {
  for (let seed = 0; seed < 40; seed++) {
    const ids = drawTrueFalsePaper(pool(12), { randomize_questions: true, questions_to_ask: 8 }, seed).map(
      (entry) => entry.question.id
    );

    assert.equal(new Set(ids).size, ids.length);
  }
});

test('the paper is indexed by position from zero', () => {
  const paper = drawTrueFalsePaper(pool(8), { randomize_questions: true, questions_to_ask: 4 }, 3);

  assert.deepEqual(
    paper.map((entry) => entry.index),
    [0, 1, 2, 3]
  );
});

test('drawing does not reorder the caller-s pool', () => {
  const rows = pool(8);
  drawTrueFalsePaper(rows, { randomize_questions: true, questions_to_ask: 4 }, 9);

  assert.deepEqual(
    rows.map((q) => q.id),
    [1, 2, 3, 4, 5, 6, 7, 8]
  );
});

test('an empty pool draws an empty paper rather than faulting', () => {
  assert.deepEqual(drawTrueFalsePaper([], { randomize_questions: true, questions_to_ask: 5 }, 1), []);
});

// ---------------------------------------------------------------------------
// Answering
// ---------------------------------------------------------------------------

test('an answer is right when it equals the stored boolean', () => {
  const [first, second] = pool(2);

  assert.equal(isCorrectAnswer(first, true), true);
  assert.equal(isCorrectAnswer(first, false), false);
  assert.equal(isCorrectAnswer(second, false), true);
  assert.equal(isCorrectAnswer(second, true), false);
});

test('an unanswered statement is not a right answer', () => {
  // The statement's answer is false, and `null` must not compare equal to it.
  assert.equal(isCorrectAnswer(pool(2)[1], null), false);
});

test('feedback is the author-s words for the side the learner landed on', () => {
  const [first] = pool(1);

  assert.deepEqual(statementFeedback(first, true), { correct: true, message: 'Right about 1.' });
  assert.deepEqual(statementFeedback(first, false), { correct: false, message: 'Wrong about 1.' });
});

test('no authored feedback produces no message rather than an invented one', () => {
  const [first] = pool(1);
  first.feedback_correct = '   ';
  first.feedback_incorrect = null;

  assert.deepEqual(statementFeedback(first, true), { correct: true, message: '' });
  assert.deepEqual(statementFeedback(first, false), { correct: false, message: '' });
});

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const SCORING = { points_per_question: 3, pass_percentage: 60 };

test('a paper answered correctly throughout is full marks and a pass', () => {
  const paper = drawTrueFalsePaper(pool(4), ALL_IN_ORDER, 1);
  const answers = paper.map((entry) => entry.question.correct_answer);

  const result = scoreTrueFalseAttempt(paper, answers, SCORING);

  assert.equal(result.score, 12);
  assert.equal(result.maxScore, 12);
  assert.equal(result.percentage, 100);
  assert.equal(result.passed, true);
});

test('the score is out of the paper drawn, not out of the pool', () => {
  /*
   * The bug this guards: scoring ten answers against a pool of twenty reports
   * every full-marks attempt as 50% and every learner as failing.
   */
  const paper = drawTrueFalsePaper(pool(20), { randomize_questions: true, questions_to_ask: 10 }, 5);
  const answers = paper.map((entry) => entry.question.correct_answer);

  const result = scoreTrueFalseAttempt(paper, answers, SCORING);

  assert.equal(result.questionCount, 10);
  assert.equal(result.maxScore, 30);
  assert.equal(result.percentage, 100);
});

test('unanswered statements count against the total and are reported separately', () => {
  const paper = drawTrueFalsePaper(pool(4), ALL_IN_ORDER, 1);
  // Two right, then stopped.
  const answers = [paper[0].question.correct_answer, paper[1].question.correct_answer];

  const result = scoreTrueFalseAttempt(paper, answers, SCORING);

  assert.equal(result.answeredCount, 2);
  assert.equal(result.correctCount, 2);
  assert.equal(result.questionCount, 4);
  assert.equal(result.maxScore, 12);
  assert.equal(result.percentage, 50);
  assert.equal(result.passed, false);
});

test('a false answer recorded on a false statement is not read as unanswered', () => {
  /*
   * The classic bug in this type: `if (!answer)` treats a correct `false` as
   * a missing answer, and a whole paper of false statements scores zero.
   */
  const paper = drawTrueFalsePaper(
    [{ id: 1, question_text: '<p>Bats are blind.</p>', correct_answer: false }],
    ALL_IN_ORDER,
    1
  );

  const result = scoreTrueFalseAttempt(paper, [false], { points_per_question: 1, pass_percentage: 50 });

  assert.equal(result.answeredCount, 1);
  assert.equal(result.correctCount, 1);
  assert.equal(result.percentage, 100);
});

test('an empty paper scores zero per cent rather than NaN', () => {
  const result = scoreTrueFalseAttempt([], [], SCORING);

  assert.equal(result.percentage, 0);
  assert.equal(Number.isNaN(result.percentage), false);
  assert.equal(result.passed, false);
});

// ---------------------------------------------------------------------------
// End-of-attempt feedback
// ---------------------------------------------------------------------------

test('the last matching band wins, so the list reads as unless rules', () => {
  const bands = [
    { from: 0, to: 100, feedback: 'Have another go.' },
    { from: 90, to: 100, feedback: 'Excellent.' },
  ];

  assert.equal(trueFalseFeedback(95, bands), 'Excellent.');
  assert.equal(trueFalseFeedback(20, bands), 'Have another go.');
  assert.equal(trueFalseFeedback(20, null), '');
});

// ---------------------------------------------------------------------------
// Answer balance
// ---------------------------------------------------------------------------

test('a pool that is all one answer is reported as lopsided', () => {
  const allTrue = pool(4).map((q) => ({ ...q, correct_answer: true }));

  assert.deepEqual(answerBalance(allTrue), { trueCount: 4, falseCount: 0, lopsided: true });

  const allFalse = pool(4).map((q) => ({ ...q, correct_answer: false }));

  assert.deepEqual(answerBalance(allFalse), { trueCount: 0, falseCount: 4, lopsided: true });
});

test('a mixed pool is not lopsided', () => {
  assert.equal(answerBalance(pool(10)).lopsided, false);
  assert.deepEqual(answerBalance(pool(10)), { trueCount: 5, falseCount: 5, lopsided: false });
});

test('a single statement is not lopsided, it is a statement', () => {
  assert.equal(answerBalance(pool(1)).lopsided, false);
  assert.equal(answerBalance([]).lopsided, false);
});

// ---------------------------------------------------------------------------
// Plain text
// ---------------------------------------------------------------------------

test('plain text strips markup and decodes the entities H5P writes', () => {
  assert.equal(plainText('<p>Salt &amp; water</p>'), 'Salt & water');
  assert.equal(plainText('<p>The <em>Pacific</em> is largest.</p>'), 'The Pacific is largest.');
  assert.equal(plainText(undefined), '');
});
