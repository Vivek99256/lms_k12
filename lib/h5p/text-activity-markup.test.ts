import test from 'node:test';
import assert from 'node:assert/strict';

import {
  answerKey,
  markableTokens,
  parseDistractors,
  parsePassage,
  passageProblems,
  plainText,
  segmentPassage,
  wordBank,
} from './text-activity-markup';

/**
 * The grammar every answer key is derived from.
 *
 * These cases deliberately mirror the ones in the backend's
 * H5PTextActivityBuilderTest, because the two parsers must agree: this one
 * decides what the author is SHOWN and what the learner SEES, the PHP one
 * decides what is STORED and what the attempt is scored against. A change to
 * one grammar that does not break the other is exactly the silent divergence
 * worth catching here.
 */

test('reads solution, alternatives and tip out of one slot', () => {
  const slots = parsePassage('Oslo is the capital of *Norway/Noreg:It is Nordic*.');

  assert.equal(slots.length, 1);
  assert.equal(slots[0].solution, 'Norway');
  assert.deepEqual(slots[0].alternatives, ['Noreg']);
  assert.equal(slots[0].tip, 'It is Nordic');
});

test('numbers slots in reading order', () => {
  const slots = parsePassage('The *dog* chased the *cat* past the *fox*.');

  assert.deepEqual(
    slots.map((slot) => slot.index),
    [0, 1, 2]
  );
  assert.deepEqual(
    slots.map((slot) => slot.solution),
    ['dog', 'cat', 'fox']
  );
});

/**
 * An escaped asterisk is prose. Without this, a passage about multiplication
 * turns the text between two of them into an answer and the activity silently
 * asks a different question than the one on the page.
 */
test('ignores escaped asterisks', () => {
  const slots = parsePassage('Work out 3 \\* 4 and write *12* in the box.');

  assert.equal(slots.length, 1);
  assert.equal(slots[0].solution, '12');
});

test('an unclosed marker produces no slot', () => {
  assert.deepEqual(parsePassage('The *dog chased the cat.'), []);
});

test('an empty marker is not an answer, and the survivors renumber from zero', () => {
  const slots = parsePassage('The ** chased the *cat*.');

  assert.equal(slots.length, 1);
  assert.equal(slots[0].solution, 'cat');
  assert.equal(slots[0].index, 0);
});

test('the tip comes from the last colon, so a solution may contain one', () => {
  const slots = parsePassage('The ratio is *3:4:both are integers*.');

  assert.equal(slots[0].solution, '3:4');
  assert.equal(slots[0].tip, 'both are integers');
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

test('segments alternate prose and blanks, and unescape asterisks for display', () => {
  const segments = segmentPassage('A \\* b *one* c');

  assert.deepEqual(
    segments.map((s) => (s.kind === 'text' ? ['text', s.text] : ['blank', s.slot.solution])),
    [
      ['text', 'A * b '],
      ['blank', 'one'],
      ['text', ' c'],
    ]
  );
});

test('plain text hides the answers rather than leaking them into a list row', () => {
  assert.equal(plainText('The *dog* chased the *cat*.'), 'The dog chased the cat.');
});

/**
 * The whole point of Mark the Words: every word is clickable, and only the
 * marked ones are right. A token index means nothing unless the renderer and
 * the scorer got it from the same call, which is why this shape is pinned.
 */
test('tokenises the whole passage, flagging only the marked words', () => {
  const tokens = markableTokens('The dog *ran* across the *yard*.');

  assert.deepEqual(
    tokens.map((t) => [t.word, t.correct]),
    [
      ['The', false],
      ['dog', false],
      ['ran', true],
      ['across', false],
      ['the', false],
      ['yard', true],
      ['.', false],
    ]
  );
  assert.deepEqual(
    tokens.filter((t) => t.correct).map((t) => t.blankIndex),
    [0, 1]
  );
});

/**
 * A repeated word must not be markable by its other occurrence. This is the
 * case a string-matching scorer gets wrong, and the reason tokens carry an
 * index rather than a word.
 */
test('an unmarked repeat of a marked word is its own token and is not correct', () => {
  const tokens = markableTokens('The dog *ran* across the ran-down yard.');

  const ran = tokens.filter((t) => t.word.startsWith('ran'));
  assert.deepEqual(
    ran.map((t) => [t.word, t.correct]),
    [
      ['ran', true],
      ['ran-down', false],
    ]
  );
});

// ---------------------------------------------------------------------------
// Distractors and the word bank
// ---------------------------------------------------------------------------

test('distractors are accepted as a plain list or as markup', () => {
  assert.deepEqual(parseDistractors('ribosome, mitochondrion'), ['ribosome', 'mitochondrion']);
  assert.deepEqual(parseDistractors('*ribosome* *mitochondrion*'), ['ribosome', 'mitochondrion']);
});

test('only drag the words gets distractors in its answer key', () => {
  const marked = answerKey('mark_the_words', 'The *dog* ran.', 'cat, fox');
  assert.equal(marked.length, 1);

  const dragged = answerKey('drag_text', 'The *dog* ran.', 'cat, fox');
  assert.deepEqual(
    dragged.map((slot) => [slot.solution, slot.isDistractor]),
    [
      ['dog', false],
      ['cat', true],
      ['fox', true],
    ]
  );
});

/**
 * An unshuffled bank lists the answers first and gives the activity away; a
 * bank reshuffled on every render is unusable. Seeded is the only shape that
 * is neither.
 */
test('the word bank holds every answer and distractor, stable for a given seed', () => {
  const first = wordBank('A *one* B *two*', 'three, four', 42);
  const second = wordBank('A *one* B *two*', 'three, four', 42);

  assert.deepEqual(first, second);
  assert.deepEqual([...first].sort(), ['four', 'one', 'three', 'two']);
});

// ---------------------------------------------------------------------------
// Author-facing problems
// ---------------------------------------------------------------------------

test('an unclosed asterisk is reported as itself, not as "no answers"', () => {
  const problems = passageProblems('fill_in_the_blanks', 'The *dog chased the cat.', '');

  assert.ok(problems.some((p) => p.includes('unclosed asterisk')));
});

test('a passage with no markers says so in the words of its own type', () => {
  assert.ok(
    passageProblems('mark_the_words', 'The dog chased the cat.', '')
      .some((p) => p.includes('mark'))
  );
});

/**
 * A "distractor" that is also an answer is accepted wherever that answer is,
 * so it distracts from nothing and quietly makes the activity easier than the
 * author believes.
 */
test('a spare word that is also an answer is refused', () => {
  const problems = passageProblems('drag_text', 'Oslo is in *Norway*.', 'norway, Sweden');

  assert.ok(problems.some((p) => p.includes('Norway') || p.includes('norway')));
});

test('a well-formed passage has no problems', () => {
  assert.deepEqual(passageProblems('drag_text', 'Oslo is in *Norway*.', 'Sweden'), []);
});
