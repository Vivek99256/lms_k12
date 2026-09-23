import test from 'node:test';
import assert from 'node:assert/strict';

import { markableTokens } from './text-activity-markup';
import {
  feedbackFor,
  matchesAnswer,
  scoreBlanks,
  scoreMarkedWords,
  type ScorableTextActivity,
} from './text-activity-scoring';

/**
 * The arithmetic that decides a student's mark.
 *
 * Two things here are worth more than the rest: the negative marking in Mark
 * the Words, which is the library's rule and looks like a bug to anyone who
 * has not read it; and the unmarkable case, which must be reported as "no
 * answers defined" rather than as a zero.
 */

function activity(overrides: Partial<ScorableTextActivity> = {}): ScorableTextActivity {
  return {
    content_type: 'fill_in_the_blanks',
    blanks: [
      { blank_index: 0, solution: 'Norway', alternatives: ['Noreg'], is_distractor: false },
      { blank_index: 1, solution: 'Copenhagen', alternatives: [], is_distractor: false },
    ],
    points_per_blank: 1,
    pass_percentage: 100,
    case_sensitive: false,
    accept_spelling_errors: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The unmarkable activity
// ---------------------------------------------------------------------------

/**
 * An author can save a passage that marks nothing. Reporting that as 0/0 tells
 * the learner they got it wrong when nothing was ever right.
 */
test('an activity with no answers is unmarkable, not a zero', () => {
  const result = scoreBlanks(activity({ blanks: [] }), {});

  assert.equal(result.scoreable, false);
  assert.equal(result.maxScore, 0);
});

test('distractors are not worth marks and do not raise the maximum', () => {
  const result = scoreBlanks(
    activity({
      content_type: 'drag_text',
      blanks: [
        { blank_index: 0, solution: 'Norway', alternatives: [], is_distractor: false },
        { blank_index: 1, solution: 'Sweden', alternatives: [], is_distractor: true },
      ],
    }),
    { 0: 'Norway' }
  );

  assert.equal(result.maxScore, 1);
  assert.equal(result.score, 1);
  assert.equal(result.percentage, 100);
});

// ---------------------------------------------------------------------------
// Matching one answer
// ---------------------------------------------------------------------------

test('an alternative scores exactly like the canonical answer', () => {
  const blank = { blank_index: 0, solution: 'Norway', alternatives: ['Noreg'], is_distractor: false };
  const options = { caseSensitive: false, acceptSpellingErrors: false };

  assert.ok(matchesAnswer('Noreg', blank, options));
  assert.ok(matchesAnswer('Norway', blank, options));
});

test('case sensitivity is honoured in both directions', () => {
  const blank = { blank_index: 0, solution: 'Norway', alternatives: [], is_distractor: false };

  assert.ok(matchesAnswer('norway', blank, { caseSensitive: false, acceptSpellingErrors: false }));
  assert.ok(!matchesAnswer('norway', blank, { caseSensitive: true, acceptSpellingErrors: false }));
});

test('surrounding whitespace is not a wrong answer', () => {
  const blank = { blank_index: 0, solution: 'Norway', alternatives: [], is_distractor: false };

  assert.ok(matchesAnswer('  Norway ', blank, { caseSensitive: true, acceptSpellingErrors: false }));
});

test('spelling tolerance forgives one edit, and only when enabled', () => {
  const blank = { blank_index: 0, solution: 'Copenhagen', alternatives: [], is_distractor: false };

  assert.ok(matchesAnswer('Copenhagan', blank, { caseSensitive: false, acceptSpellingErrors: true }));
  assert.ok(!matchesAnswer('Copenhagan', blank, { caseSensitive: false, acceptSpellingErrors: false }));
  // Two edits is a different word, not a typo.
  assert.ok(!matchesAnswer('Copnhagan', blank, { caseSensitive: false, acceptSpellingErrors: true }));
});

/**
 * Below four letters, one edit IS a different word. Forgiving it would accept
 * "bat" for "cat", which is the opposite of what a spelling setting is for.
 */
test('spelling tolerance does not apply to very short answers', () => {
  const blank = { blank_index: 0, solution: 'cat', alternatives: [], is_distractor: false };

  assert.ok(!matchesAnswer('bat', blank, { caseSensitive: false, acceptSpellingErrors: true }));
});

test('an empty response is never correct', () => {
  const blank = { blank_index: 0, solution: 'Norway', alternatives: [], is_distractor: false };

  assert.ok(!matchesAnswer('   ', blank, { caseSensitive: false, acceptSpellingErrors: false }));
});

// ---------------------------------------------------------------------------
// Blanks and drag text
// ---------------------------------------------------------------------------

test('an unanswered blank is missed, not incorrect', () => {
  const result = scoreBlanks(activity(), { 0: 'Norway' });

  assert.equal(result.correct, 1);
  assert.equal(result.missed, 1);
  assert.equal(result.incorrect, 0);
  assert.deepEqual(result.perBlank, { 0: true, 1: false });
});

test('a wrong answer is incorrect and costs nothing beyond its own mark', () => {
  const result = scoreBlanks(activity(), { 0: 'Sweden', 1: 'Copenhagen' });

  assert.equal(result.correct, 1);
  assert.equal(result.incorrect, 1);
  assert.equal(result.score, 1);
  assert.equal(result.maxScore, 2);
  assert.equal(result.percentage, 50);
});

test('points per blank scale the score and the maximum together', () => {
  const result = scoreBlanks(activity({ points_per_blank: 5 }), { 0: 'Norway', 1: 'Copenhagen' });

  assert.equal(result.score, 10);
  assert.equal(result.maxScore, 10);
  assert.equal(result.percentage, 100);
});

test('the pass mark is compared against the percentage, not the raw score', () => {
  const half = { 0: 'Norway' };

  assert.ok(scoreBlanks(activity({ pass_percentage: 50 }), half).passed);
  assert.ok(!scoreBlanks(activity({ pass_percentage: 51 }), half).passed);
});

// ---------------------------------------------------------------------------
// Mark the words
// ---------------------------------------------------------------------------

const marking = activity({
  content_type: 'mark_the_words',
  blanks: [
    { blank_index: 0, solution: 'ran', alternatives: [], is_distractor: false },
    { blank_index: 1, solution: 'barked', alternatives: [], is_distractor: false },
  ],
  pass_percentage: 50,
});

const tokens = markableTokens('The dog *ran* and *barked* loudly.');

test('marking exactly the right words scores full marks', () => {
  const correct = new Set(tokens.filter((t) => t.correct).map((t) => t.tokenIndex));
  const result = scoreMarkedWords(marking, tokens, correct);

  assert.equal(result.score, 2);
  assert.equal(result.maxScore, 2);
  assert.equal(result.percentage, 100);
  assert.equal(result.incorrect, 0);
});

/**
 * THE RULE THAT LOOKS LIKE A BUG. H5P.MarkTheWords scores correct minus
 * incorrect. Without it, clicking every word scores full marks -- which is the
 * first thing a class discovers and the last thing a teacher expects.
 */
test('a wrong mark subtracts, so marking everything does not score full marks', () => {
  const everything = new Set(tokens.map((t) => t.tokenIndex));
  const result = scoreMarkedWords(marking, tokens, everything);

  assert.equal(result.correct, 2);
  assert.equal(result.incorrect, tokens.length - 2);
  assert.equal(result.score, 0);
  assert.equal(result.percentage, 0);
  assert.ok(!result.passed);
});

test('the score is floored at zero rather than going negative', () => {
  const oneRightManyWrong = new Set(
    tokens.filter((t) => t.correct).slice(0, 1).map((t) => t.tokenIndex)
  );
  tokens.filter((t) => !t.correct).forEach((t) => oneRightManyWrong.add(t.tokenIndex));

  const result = scoreMarkedWords(marking, tokens, oneRightManyWrong);

  assert.equal(result.score, 0);
  assert.ok(result.percentage >= 0);
});

test('marking nothing is all missed and no incorrect', () => {
  const result = scoreMarkedWords(marking, tokens, new Set());

  assert.equal(result.missed, 2);
  assert.equal(result.incorrect, 0);
  assert.equal(result.score, 0);
});

test('per-blank results are keyed by answer index, not token index', () => {
  const firstOnly = new Set([tokens.find((t) => t.correct)!.tokenIndex]);
  const result = scoreMarkedWords(marking, tokens, firstOnly);

  assert.deepEqual(result.perBlank, { 0: true, 1: false });
});

// ---------------------------------------------------------------------------
// Feedback bands
// ---------------------------------------------------------------------------

test('the first band containing the percentage wins, inclusive at both ends', () => {
  const bands = [
    { from: 0, to: 49, feedback: 'Keep practising' },
    { from: 50, to: 100, feedback: 'Well done' },
  ];

  assert.equal(feedbackFor(bands, 49), 'Keep practising');
  assert.equal(feedbackFor(bands, 50), 'Well done');
  assert.equal(feedbackFor(bands, 100), 'Well done');
});

test('a gap in the bands means no message rather than an invented one', () => {
  assert.equal(feedbackFor([{ from: 80, to: 100, feedback: 'Great' }], 40), null);
  assert.equal(feedbackFor(null, 40), null);
});

test('an empty message is treated as no message', () => {
  assert.equal(feedbackFor([{ from: 0, to: 100, feedback: '  ' }], 40), null);
});
