import test from 'node:test';
import assert from 'node:assert/strict';

import {
  answerFeedback,
  correctOption,
  isCorrectChoice,
  plainText,
  prepareSingleChoicePaper,
  scoreSingleChoiceAttempt,
  singleChoiceFeedback,
  type SingleChoiceQuestion,
} from './single-choice-set';

/**
 * What is tested here is what a teacher would notice the hard way: a shuffle
 * that drops or duplicates a question, an answer whose feedback followed the
 * position rather than the option, an unanswered question scored as full
 * marks, or a paper that changes under a learner who reloaded.
 *
 * The shuffle is seeded, so these assert on real papers rather than on
 * statistics over a sample.
 */

function question(id: number, text: string, correctIndex: number, count = 3): SingleChoiceQuestion {
  return {
    id,
    question_text: `<p>${text}</p>`,
    feedback_correct: `Yes — ${text}`,
    feedback_incorrect: `Not quite — ${text}`,
    explanation: null,
    options: Array.from({ length: count }, (_, i) => ({
      id: id * 10 + i,
      option_text: `<p>Option ${i + 1}</p>`,
      is_correct: i === correctIndex,
      feedback: i === correctIndex ? null : `About option ${i + 1}`,
    })),
  };
}

/** Three questions whose right answer is at a different position in each. */
function set(): SingleChoiceQuestion[] {
  return [question(1, 'First', 1), question(2, 'Second', 0), question(3, 'Third', 2)];
}

const NO_SHUFFLE = { randomize_questions: false, randomize_answers: false };
const SHUFFLE_BOTH = { randomize_questions: true, randomize_answers: true };

// ---------------------------------------------------------------------------
// Preparing a paper
// ---------------------------------------------------------------------------

test('with shuffling off the paper is exactly the authored order', () => {
  const paper = prepareSingleChoicePaper(set(), NO_SHUFFLE, 12345);

  assert.deepEqual(
    paper.map((entry) => entry.question.id),
    [1, 2, 3]
  );
  assert.deepEqual(
    paper[0].options.map((option) => option.id),
    [10, 11, 12]
  );
});

test('the same seed always produces the same paper', () => {
  const a = prepareSingleChoicePaper(set(), SHUFFLE_BOTH, 98765);
  const b = prepareSingleChoicePaper(set(), SHUFFLE_BOTH, 98765);

  assert.deepEqual(
    a.map((e) => [e.question.id, e.options.map((o) => o.id)]),
    b.map((e) => [e.question.id, e.options.map((o) => o.id)])
  );
});

test('a different seed eventually produces a different paper', () => {
  const fingerprint = (seed: number) =>
    prepareSingleChoicePaper(set(), SHUFFLE_BOTH, seed)
      .map((e) => `${e.question.id}:${e.options.map((o) => o.id).join(',')}`)
      .join('|');

  const first = fingerprint(1);
  // Not asserting that seed 2 differs from seed 1 specifically — a shuffle of
  // three items has only six orderings, so a fixed pair colliding is a real
  // possibility and would make this test flaky for no reason.
  const anyDifferent = [2, 3, 4, 5, 6, 7, 8].some((seed) => fingerprint(seed) !== first);

  assert.equal(anyDifferent, true);
});

test('shuffling never loses, duplicates or invents a question', () => {
  for (let seed = 0; seed < 50; seed++) {
    const paper = prepareSingleChoicePaper(set(), SHUFFLE_BOTH, seed);
    const ids = paper.map((entry) => entry.question.id).sort();

    assert.deepEqual(ids, [1, 2, 3]);
  }
});

test('shuffling never loses, duplicates or invents an option', () => {
  for (let seed = 0; seed < 50; seed++) {
    const paper = prepareSingleChoicePaper(set(), SHUFFLE_BOTH, seed);

    for (const entry of paper) {
      const ids = entry.options.map((option) => option.id).sort();
      assert.deepEqual(ids, entry.question.options.map((option) => option.id).sort());

      // Exactly one right answer survived the shuffle. If this ever fails the
      // activity still renders and still scores — it just scores wrongly.
      assert.equal(entry.options.filter((option) => option.is_correct).length, 1);
    }
  }
});

test('the paper is indexed by position, not by authored order', () => {
  const paper = prepareSingleChoicePaper(set(), SHUFFLE_BOTH, 7);

  assert.deepEqual(
    paper.map((entry) => entry.index),
    [0, 1, 2]
  );
});

test('preparing a paper does not reorder the caller-s rows', () => {
  const rows = set();
  prepareSingleChoicePaper(rows, SHUFFLE_BOTH, 4242);

  // The editor and the results screen read these rows afterwards.
  assert.deepEqual(
    rows.map((q) => q.id),
    [1, 2, 3]
  );
  assert.deepEqual(
    rows[0].options.map((o) => o.id),
    [10, 11, 12]
  );
});

test('a question with no options survives into the paper and scores zero', () => {
  const broken: SingleChoiceQuestion = {
    id: 9,
    question_text: '<p>Unfinished</p>',
    options: [],
  };

  const paper = prepareSingleChoicePaper([question(1, 'Fine', 0), broken], NO_SHUFFLE, 1);

  // Kept, not dropped: removing it would change the max score and make a
  // broken activity look like a shorter one.
  assert.equal(paper.length, 2);
  assert.equal(correctOption(broken), null);
});

// ---------------------------------------------------------------------------
// Answering
// ---------------------------------------------------------------------------

test('correctness is read from the flag, never from the position', () => {
  const q = question(1, 'First', 1);

  assert.equal(isCorrectChoice(q, 11), true);
  assert.equal(isCorrectChoice(q, 10), false);
  // An id from a different question is not this question's answer.
  assert.equal(isCorrectChoice(q, 20), false);
  assert.equal(isCorrectChoice(q, null), false);
});

test('the feedback on the chosen option beats the question-s generic message', () => {
  const q = question(1, 'First', 1);

  // A distractor with its own message: that message is what the author wrote
  // for the learner who picked it.
  assert.deepEqual(answerFeedback(q, 12), { correct: false, message: 'About option 3' });

  // The right answer has no specific message, so the question's stands.
  assert.deepEqual(answerFeedback(q, 11), { correct: true, message: 'Yes — First' });
});

test('a distractor with no message of its own falls back to the question-s', () => {
  const q = question(1, 'First', 1);
  q.options[0].feedback = '   ';

  assert.deepEqual(answerFeedback(q, 10), { correct: false, message: 'Not quite — First' });
});

test('an unanswered question produces no message rather than a wrong one', () => {
  const q = question(1, 'First', 1);
  q.feedback_incorrect = null;

  assert.deepEqual(answerFeedback(q, null), { correct: false, message: '' });
});

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const SCORING = { points_per_question: 2, pass_percentage: 60 };

test('a full paper of right answers is full marks and a pass', () => {
  const paper = prepareSingleChoicePaper(set(), NO_SHUFFLE, 1);
  const answers = paper.map((entry) => correctOption(entry.question)!.id);

  const result = scoreSingleChoiceAttempt(paper, answers, SCORING);

  assert.equal(result.correctCount, 3);
  assert.equal(result.score, 6);
  assert.equal(result.maxScore, 6);
  assert.equal(result.percentage, 100);
  assert.equal(result.passed, true);
});

test('unanswered questions count against the total, not out of what was reached', () => {
  const paper = prepareSingleChoicePaper(set(), NO_SHUFFLE, 1);
  // Answered the first correctly and then stopped.
  const answers = [correctOption(paper[0].question)!.id];

  const result = scoreSingleChoiceAttempt(paper, answers, SCORING);

  assert.equal(result.answeredCount, 1);
  assert.equal(result.correctCount, 1);
  assert.equal(result.maxScore, 6, 'the whole paper, not the part attempted');
  assert.equal(result.percentage, 33);
  assert.equal(result.passed, false);
});

test('unanswered is reported separately from wrong', () => {
  const paper = prepareSingleChoicePaper(set(), NO_SHUFFLE, 1);
  // One right, one wrong, one never reached.
  const answers = [correctOption(paper[0].question)!.id, paper[1].question.options[1].id, null];

  const result = scoreSingleChoiceAttempt(paper, answers, SCORING);

  assert.equal(result.answeredCount, 2);
  assert.equal(result.correctCount, 1);
  assert.equal(result.questionCount, 3);
});

test('an answer is matched to its question by paper position, not by index into the rows', () => {
  // The shuffle puts the questions in some other order; an answer recorded at
  // position 0 belongs to whatever question is at position 0.
  const paper = prepareSingleChoicePaper(set(), { randomize_questions: true, randomize_answers: false }, 31);
  const answers = paper.map((entry) => correctOption(entry.question)!.id);

  assert.equal(scoreSingleChoiceAttempt(paper, answers, SCORING).percentage, 100);
});

test('an empty paper scores zero per cent rather than NaN', () => {
  const result = scoreSingleChoiceAttempt([], [], SCORING);

  assert.equal(result.percentage, 0);
  assert.equal(Number.isNaN(result.percentage), false);
  assert.equal(result.passed, false);
});

test('the pass mark is inclusive at its own boundary', () => {
  const paper = prepareSingleChoicePaper(set(), NO_SHUFFLE, 1);
  // Two of three is 67%, against a 67% pass mark.
  const answers = [correctOption(paper[0].question)!.id, correctOption(paper[1].question)!.id, null];

  const result = scoreSingleChoiceAttempt(paper, answers, { points_per_question: 1, pass_percentage: 67 });

  assert.equal(result.percentage, 67);
  assert.equal(result.passed, true);
});

// ---------------------------------------------------------------------------
// End-of-attempt feedback
// ---------------------------------------------------------------------------

test('the last matching band wins, so the list reads as unless rules', () => {
  const bands = [
    { from: 0, to: 100, feedback: 'Have another go.' },
    { from: 90, to: 100, feedback: 'Fluent.' },
  ];

  assert.equal(singleChoiceFeedback(95, bands), 'Fluent.');
  assert.equal(singleChoiceFeedback(50, bands), 'Have another go.');
});

test('a score matching no band produces no message rather than a wrong one', () => {
  assert.equal(singleChoiceFeedback(40, [{ from: 60, to: 100, feedback: 'Pass.' }]), '');
  assert.equal(singleChoiceFeedback(40, null), '');
});

// ---------------------------------------------------------------------------
// Plain text
// ---------------------------------------------------------------------------

test('plain text strips markup and decodes the entities H5P writes', () => {
  assert.equal(plainText('<p>Water &amp; ice</p>'), 'Water & ice');
  assert.equal(plainText('<p>A <strong>bold</strong> claim</p>'), 'A bold claim');
  assert.equal(plainText('<p>Ten&nbsp;&deg;C</p>'), 'Ten &deg;C');
  assert.equal(plainText(null), '');
});
