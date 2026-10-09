import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseDeck } from './deck';
import {
  conceptStatus,
  deckTotals,
  initialProgress,
  loadProgress,
  progressKey,
  progressReducer,
  saveProgress,
  slideKeys,
  slideStatus,
  type DeckProgress,
  type StorageLike,
} from './progress';
import type { StudyDeck } from './types';

const AT = '2026-10-08T10:00:00.000Z';
const deck = (): StudyDeck => parseDeck(JSON.parse(readFileSync(new URL('./fixtures/study-deck-golden.json', import.meta.url), 'utf8')));
const win = { correct: true, score: 1, maxScore: 1 };
const lose = { correct: false, score: 0, maxScore: 1 };

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

test('opening slides marks them visited, in order, once', () => {
  let p = initialProgress(1, AT);
  p = progressReducer(p, { type: 'goto', n: 3, at: AT });
  p = progressReducer(p, { type: 'goto', n: 2, at: AT });
  p = progressReducer(p, { type: 'goto', n: 3, at: AT });

  assert.deepEqual(p.visited, [2, 3]);
  assert.equal(p.current, 3);
});

test('answering an activity marks it complete with its result', () => {
  let p = initialProgress(1, AT);
  p = progressReducer(p, { type: 'result', key: '2:0', result: win, conceptId: 1, questionId: 101, at: AT });

  assert.equal(p.activities['2:0'].done, true);
  assert.equal(p.activities['2:0'].correct, true);
  assert.equal(p.activities['2:0'].attempts, 1);
  assert.equal(p.activities['2:0'].conceptId, 1);
});

test('a retry that gets it right counts, and a retry never un-completes an activity', () => {
  let p = initialProgress(1, AT);
  p = progressReducer(p, { type: 'result', key: '2:0', result: lose, conceptId: 1, questionId: 101, at: AT });
  assert.equal(p.activities['2:0'].correct, false);

  p = progressReducer(p, { type: 'result', key: '2:0', result: win, conceptId: 1, questionId: 101, at: AT });
  assert.equal(p.activities['2:0'].correct, true);
  assert.equal(p.activities['2:0'].attempts, 2);

  p = progressReducer(p, { type: 'result', key: '2:0', result: lose, conceptId: 1, questionId: 101, at: AT });
  assert.equal(p.activities['2:0'].correct, true, 'a later wrong try does not undo a right one');
  assert.equal(p.activities['2:0'].done, true);
});

test('a written answer is complete but neither right nor wrong', () => {
  const p = progressReducer(initialProgress(1, AT), {
    type: 'result', key: '4:0', result: { correct: null, score: null, maxScore: null }, conceptId: 3, questionId: null, at: AT,
  });

  assert.equal(p.activities['4:0'].done, true);
  assert.equal(p.activities['4:0'].correct, null);
});

const explored = { correct: null, score: null, maxScore: null };

test('a slide is complete once it was opened and its interaction and example screen explored; practice never holds it up', () => {
  const d = deck();
  const slide = d.slides[2]; // slide 3: hotspots on a diagram, a worked example, and one optional practice question
  let p = initialProgress(1, AT);

  assert.deepEqual(slideKeys(slide), ['3:i', '3:e']);
  assert.deepEqual(slideStatus(slide, p), { visited: false, total: 2, done: 0, complete: false, practice: { total: 1, done: 0 } });

  p = progressReducer(p, { type: 'goto', n: 3, at: AT });
  assert.equal(slideStatus(slide, p).complete, false, 'opened but nothing explored');

  p = progressReducer(p, { type: 'result', key: '3:i', result: explored, conceptId: 2, questionId: null, at: AT });
  assert.equal(slideStatus(slide, p).complete, false, 'the diagram is explored but the example is not');
  p = progressReducer(p, { type: 'result', key: '3:e', result: explored, conceptId: 2, questionId: null, at: AT });
  assert.deepEqual(slideStatus(slide, p), { visited: true, total: 2, done: 2, complete: true, practice: { total: 1, done: 0 } });
});

test('the cover has nothing to explore, so it is complete once opened; unplayable practice is not counted', () => {
  const d = deck();
  let p = progressReducer(initialProgress(1, AT), { type: 'goto', n: 1, at: AT });

  assert.equal(slideStatus(d.slides[0], p).complete, true, 'the cover has nothing to explore');
  assert.equal(slideStatus(d.slides[1], progressReducer(p, { type: 'goto', n: 2, at: AT })).complete, false, 'slide 2 has a comparison to explore');

  p = progressReducer(p, { type: 'goto', n: 3, at: AT });
  const none = new Set<string>(); // the one practice question could not be built
  assert.deepEqual(slideStatus(d.slides[2], p, none).practice, { total: 0, done: 0 });
});

test('concept progress counts what was taught, explored, practised and right', () => {
  const d = deck();
  let p = initialProgress(1, AT);
  // Concept 1 is taught on slide 2: a comparison and an example screen.
  assert.deepEqual(conceptStatus(d, p, 1), { conceptId: 1, taught: false, interactions: 2, explored: 0, complete: false, activities: 1, done: 0, correct: 0, unmarked: 0 });

  p = progressReducer(p, { type: 'goto', n: 2, at: AT });
  assert.equal(conceptStatus(d, p, 1).complete, false, 'taught, but not yet explored');
  p = progressReducer(p, { type: 'result', key: '2:i', result: explored, conceptId: 1, questionId: null, at: AT });
  p = progressReducer(p, { type: 'result', key: '2:e', result: explored, conceptId: 1, questionId: null, at: AT });
  p = progressReducer(p, { type: 'result', key: '2:0', result: win, conceptId: 1, questionId: 101, at: AT });
  assert.deepEqual(conceptStatus(d, p, 1), { conceptId: 1, taught: true, interactions: 2, explored: 2, complete: true, activities: 1, done: 1, correct: 1, unmarked: 0 });

  // Concept 3 (Laws) is taught on slide 4: a reveal, and nothing else.
  p = progressReducer(p, { type: 'goto', n: 4, at: AT });
  assert.deepEqual([conceptStatus(d, p, 3).interactions, conceptStatus(d, p, 3).complete], [1, false]);
  p = progressReducer(p, { type: 'result', key: '4:i', result: explored, conceptId: 3, questionId: null, at: AT });
  assert.deepEqual([conceptStatus(d, p, 3).explored, conceptStatus(d, p, 3).complete], [1, true]);
});

test('deck totals give a percentage over slides and interactions; practice is counted apart', () => {
  const d = deck();
  let p = initialProgress(1, AT);
  const empty = deckTotals(d, p);

  assert.equal(empty.percent, 0);
  assert.equal(empty.slides, 7);
  assert.equal(empty.interactions, 8); // slide 2: comparison + example; slide 3: hotspots + example; then reveal, scenario, steps, match
  assert.equal(empty.practice, 3); // bank questions 101, 103, 104

  for (const slide of d.slides) p = progressReducer(p, { type: 'goto', n: slide.n, at: AT });
  assert.equal(deckTotals(d, p).percent, 47, '7 slides opened of 15 units; nothing explored yet');

  for (const slide of d.slides) {
    for (const key of slideKeys(slide)) p = progressReducer(p, { type: 'result', key, result: explored, conceptId: null, questionId: null, at: AT });
  }
  const all = deckTotals(d, p);
  assert.equal(all.percent, 100, 'finishing needs no practice answers');
  assert.equal(all.explored, all.interactions);
  assert.equal(all.practiceDone, 0);
  assert.equal(all.visited, 7);
});

test('progress survives a reload, and is per learner and per chapter', () => {
  const storage = memory();
  const key = progressKey('user-7', 1);
  let p = progressReducer(initialProgress(1, AT), { type: 'goto', n: 4, at: AT });
  p = progressReducer(p, { type: 'result', key: '2:0', result: win, conceptId: 1, questionId: 101, at: AT });

  assert.equal(saveProgress(storage, key, p), true);
  assert.deepEqual(loadProgress(storage, key, 1), p);

  assert.equal(loadProgress(storage, key, 2).visited.length, 0, 'saved for another chapter: start fresh');
  assert.equal(loadProgress(storage, progressKey('user-8', 1), 1).visited.length, 0, 'another learner starts fresh');
  assert.notEqual(progressKey('user-7', 1), progressKey('user-7', 2));
});

test('blocked, empty or corrupt storage never throws', () => {
  const blocked: StorageLike = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('quota'); },
    removeItem: () => { throw new Error('blocked'); },
  };
  const corrupt = memory();
  corrupt.setItem('k', '{not json');

  assert.equal(loadProgress(blocked, 'k', 1).chapterId, 1);
  assert.equal(saveProgress(blocked, 'k', initialProgress(1, AT)), false);
  assert.equal(loadProgress(corrupt, 'k', 1).visited.length, 0);
  assert.equal(loadProgress(null, 'k', 1).visited.length, 0);
  assert.equal(saveProgress(null, 'k', initialProgress(1, AT)), false);
});

test('starting again clears the activities but keeps the chapter', () => {
  let p: DeckProgress = progressReducer(initialProgress(5, AT), { type: 'result', key: '2:0', result: win, conceptId: 1, questionId: 101, at: AT });
  p = progressReducer(p, { type: 'reset', at: AT });

  assert.equal(p.chapterId, 5);
  assert.deepEqual(p.activities, {});
  assert.deepEqual(p.visited, []);
  assert.equal(p.current, 1);
});
