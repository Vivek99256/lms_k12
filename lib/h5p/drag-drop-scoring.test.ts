import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dragDropSolution,
  scoreDragDropAttempt,
  type ScorableTask,
} from './drag-drop-scoring';

/**
 * Regression cover for the "scored 0 out of 1 even though the items were in the
 * right zones" report.
 *
 * The cause turned out to be authored data -- every zone had an empty answer
 * key -- so the first test here is the one that reproduces that exact shape and
 * pins the behaviour: it is reported as unmarkable, not as a zero. The rest
 * pin the arithmetic that was (wrongly) suspected, so the next time this is
 * questioned the answer is a test run rather than a code read.
 */

/** Ids are non-sequential on purpose: an id used as an index would show up. */
function task(overrides: Partial<ScorableTask> = {}): ScorableTask {
  return {
    zones: [
      { id: 41, correct_element_ids: [12] },
      { id: 57, correct_element_ids: [34] },
    ],
    elements: [
      { id: 12, drop_zone_ids: [41], multiple: false },
      { id: 34, drop_zone_ids: [57], multiple: false },
      { id: 99, drop_zone_ids: [], multiple: false },
    ],
    pass_percentage: 100,
    apply_penalties: true,
    single_point: false,
    ...overrides,
  };
}

test('a task with no answer key is unmarkable, not a zero', () => {
  // Exactly what was in the database: droppable everywhere, correct nowhere.
  const broken = task({
    zones: [
      { id: 41, correct_element_ids: [] },
      { id: 57, correct_element_ids: [] },
    ],
  });

  const result = scoreDragDropAttempt(broken, { 12: [41], 34: [57] });

  assert.equal(result.scoreable, false);
  assert.equal(result.passed, false, 'an unmarkable task must never report a pass');
});

test('correct placements score, and a fully correct attempt passes', () => {
  const result = scoreDragDropAttempt(task(), { 12: [41], 34: [57] });

  assert.equal(result.scoreable, true);
  assert.equal(result.correct, 2);
  assert.equal(result.incorrect, 0);
  assert.equal(result.missed, 0);
  assert.equal(result.score, 2);
  assert.equal(result.maxScore, 2);
  assert.equal(result.percentage, 100);
  assert.equal(result.passed, true);
  assert.deepEqual(result.perElement, { 12: true, 34: true });
});

test('a swapped pair scores nothing and is marked wrong per element', () => {
  const result = scoreDragDropAttempt(task(), { 12: [57], 34: [41] });

  assert.equal(result.correct, 0);
  assert.equal(result.incorrect, 2);
  assert.equal(result.missed, 2);
  assert.equal(result.score, 0);
  assert.equal(result.passed, false);
  assert.deepEqual(result.perElement, { 12: false, 34: false });
});

test('a partly finished attempt scores what was placed', () => {
  const result = scoreDragDropAttempt(task({ pass_percentage: 50 }), { 12: [41] });

  assert.equal(result.correct, 1);
  assert.equal(result.missed, 1);
  assert.equal(result.score, 1);
  assert.equal(result.maxScore, 2);
  assert.equal(result.percentage, 50);
  assert.equal(result.passed, true, 'the pass mark is 50%, and 1 of 2 is 50%');
});

test('penalties subtract, and the score never goes below zero', () => {
  const withPenalties = scoreDragDropAttempt(task(), { 12: [41], 34: [41], 99: [57] });
  // One right (12 in 41), two wrong (34 in 41, 99 in 57) -> 1 - 2, floored.
  assert.equal(withPenalties.correct, 1);
  assert.equal(withPenalties.incorrect, 2);
  assert.equal(withPenalties.score, 0);

  const without = scoreDragDropAttempt(task({ apply_penalties: false }), {
    12: [41],
    34: [41],
    99: [57],
  });
  assert.equal(without.score, 1, 'without penalties a wrong placement simply does not count');
});

test('max score counts correct pairs, so one-to-many scores proportionally', () => {
  const sorting = task({
    zones: [
      { id: 41, correct_element_ids: [12, 34] },
      { id: 57, correct_element_ids: [12] },
    ],
    elements: [
      { id: 12, drop_zone_ids: [41, 57], multiple: true },
      { id: 34, drop_zone_ids: [41], multiple: false },
    ],
    pass_percentage: 60,
  });

  // Three correct pairs: 12-in-41, 34-in-41, 12-in-57.
  assert.equal(scoreDragDropAttempt(sorting, {}).maxScore, 3);

  const partial = scoreDragDropAttempt(sorting, { 12: [41], 34: [41] });
  assert.equal(partial.correct, 2);
  assert.equal(partial.missed, 1);
  assert.equal(partial.percentage, 67);
  assert.equal(partial.passed, true);
});

test('single point makes the whole task worth one, awarded at the pass mark', () => {
  const onePoint = task({ single_point: true, pass_percentage: 100 });

  const complete = scoreDragDropAttempt(onePoint, { 12: [41], 34: [57] });
  assert.equal(complete.score, 1);
  assert.equal(complete.maxScore, 1);

  const partial = scoreDragDropAttempt(onePoint, { 12: [41] });
  assert.equal(partial.score, 0);
  assert.equal(partial.maxScore, 1);
});

test('scoring compares ids, so a zone rename cannot change the answer', () => {
  // The scorable types carry no label at all -- this asserts the shape rather
  // than the behaviour, which is the point: there is no string to mismatch on.
  const result = scoreDragDropAttempt(task(), { 12: [41], 34: [57] });
  assert.equal(result.passed, true);

  // Ids arriving as strings (a JSON column read loosely) still match.
  const loose = scoreDragDropAttempt(
    task({ zones: [{ id: 41, correct_element_ids: ['12' as unknown as number] }] }),
    { 12: [41] }
  );
  assert.equal(loose.correct, 1);
});

test('the solution map inverts the answer key', () => {
  assert.deepEqual(dragDropSolution(task()), { 12: [41], 34: [57] });

  const multi = task({
    zones: [
      { id: 41, correct_element_ids: [12] },
      { id: 57, correct_element_ids: [12] },
    ],
  });
  assert.deepEqual(dragDropSolution(multi), { 12: [41, 57] });
});
