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

test('a slide is complete only once it was opened and every activity on it is done', () => {
  const d = deck();
  const slide = d.slides[2]; // slide 3, one activity
  let p = initialProgress(1, AT);

  assert.deepEqual(slideStatus(slide, p), { visited: false, total: 1, done: 0, complete: false });

  p = progressReducer(p, { type: 'goto', n: 3, at: AT });
  assert.equal(slideStatus(slide, p).complete, false, 'opened but the activity is not done');

  p = progressReducer(p, { type: 'result', key: '3:0', result: win, conceptId: 2, questionId: 103, at: AT });
  assert.deepEqual(slideStatus(slide, p), { visited: true, total: 1, done: 1, complete: true });
});

test('a slide with no activities is complete once opened; unplayable activities do not block it', () => {
  const d = deck();
  let p = progressReducer(initialProgress(1, AT), { type: 'goto', n: 1, at: AT });

  assert.equal(slideStatus(d.slides[0], p).complete, true);

  p = progressReducer(p, { type: 'goto', n: 3, at: AT });
  const playable = new Set<string>(); // the one activity could not be built
  assert.deepEqual(slideStatus(d.slides[2], p, playable), { visited: true, total: 0, done: 0, complete: true });
});

test('concept progress counts what was taught, asked, done and right', () => {
  const d = deck();
  let p = initialProgress(1, AT);
  assert.deepEqual(conceptStatus(d, p, 1), { conceptId: 1, taught: false, activities: 1, done: 0, correct: 0, unmarked: 0 });

  p = progressReducer(p, { type: 'goto', n: 2, at: AT });
  p = progressReducer(p, { type: 'result', key: '2:0', result: win, conceptId: 1, questionId: 101, at: AT });

  assert.deepEqual(conceptStatus(d, p, 1), { conceptId: 1, taught: true, activities: 1, done: 1, correct: 1, unmarked: 0 });
});

test('deck totals give a percentage over slides and activities together', () => {
  const d = deck();
  let p = initialProgress(1, AT);
  const empty = deckTotals(d, p);

  assert.equal(empty.percent, 0);
  assert.equal(empty.slides, 7);
  assert.equal(empty.activities, 6); // bank questions 101, 103, 104 plus authored checks on slides 4, 6 and 7

  for (const slide of d.slides) p = progressReducer(p, { type: 'goto', n: slide.n, at: AT });
  d.slides.forEach((slide) => slide.activities.forEach((_, i) => {
    p = progressReducer(p, { type: 'result', key: `${slide.n}:${i}`, result: win, conceptId: null, questionId: null, at: AT });
  }));

  const all = deckTotals(d, p);
  assert.equal(all.percent, 100);
  assert.equal(all.done, all.activities);
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
