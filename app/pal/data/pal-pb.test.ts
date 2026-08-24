import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFluency, computeMasteryPBs, computeSessionPBs, computeStreak } from './pal-pb';
import type { PalConceptMastery, PalResultQuestion } from './pal';

const asQuestion = (q: Partial<PalResultQuestion>): PalResultQuestion => ({
  questionId: '',
  title: '',
  points: 0,
  rightWrong: '',
  conceptName: '',
  options: [],
  givenAnswerIds: [],
  correctAnswerIds: [],
  mapping: [],
  ...q,
});

test('computeFluency - basic accuracy per concept', () => {
  const questions = [
    asQuestion({ conceptName: 'Addition', rightWrong: 'right' }),
    asQuestion({ conceptName: 'Addition', rightWrong: 'wrong' }),
    asQuestion({ conceptName: 'Subtraction', rightWrong: 'right' }),
  ];
  const result = computeFluency(questions);
  assert.ok(result.has('Addition'));
  assert.ok(result.has('Subtraction'));
  assert.equal(result.get('Addition')!.fluency, 0.5);
  assert.equal(result.get('Subtraction')!.fluency, 1);
});

test('computeFluency - empty questions', () => {
  const result = computeFluency([]);
  assert.equal(result.size, 0);
});

test('computeFluency - general concept fallback', () => {
  const questions = [
    asQuestion({ conceptName: '', rightWrong: 'right' }),
  ];
  const result = computeFluency(questions);
  assert.ok(result.has('General Concept'));
  assert.equal(result.get('General Concept')!.fluency, 1);
});

test('computeStreak - first day starts at 1', () => {
  const event = computeStreak('2026-08-14', 0, 0, null);
  assert.ok(event);
  assert.equal(event!.newLongest, 1);
  assert.equal(event!.previousLongest, 0);
});

test('computeStreak - consecutive days increments', () => {
  const event = computeStreak('2026-08-14', 1, 1, '2026-08-13');
  assert.ok(event);
  assert.equal(event!.newLongest, 2);
});

test('computeStreak - missed day resets but does not create new longest', () => {
  const event = computeStreak('2026-08-14', 1, 1, '2026-08-12');
  assert.equal(event, null);
});

test('computeStreak - same day does not increment', () => {
  const event = computeStreak('2026-08-14', 1, 1, '2026-08-14');
  assert.equal(event, null);
});

test('computeStreak - new longest streak', () => {
  const event = computeStreak('2026-08-14', 5, 5, '2026-08-13');
  assert.ok(event);
  assert.equal(event!.newLongest, 6);
  assert.equal(event!.previousLongest, 5);
});

test('computeMasteryPBs - first mastery triggers event', () => {
  const mastery: PalConceptMastery[] = [
    { conceptName: 'Fractions', attempted: 5, correct: 4, wrong: 1, total: 5, accuracy: 80, masteryLevel: 88, status: 'mastered' },
  ];
  const existing = new Map<string, { masteryResult: number }>();
  const events = computeMasteryPBs(mastery, existing);
  assert.equal(events.length, 1);
  assert.equal(events[0].concept, 'Fractions');
  assert.equal(events[0].newResult, 88);
  assert.equal(events[0].previousResult, 0);
});

test('computeMasteryPBs - slower mastery does not trigger', () => {
  const mastery: PalConceptMastery[] = [
    { conceptName: 'Fractions', attempted: 5, correct: 3, wrong: 2, total: 5, accuracy: 60, masteryLevel: 62, status: 'developing' },
  ];
  const existing = new Map<string, { masteryResult: number }>();
  existing.set('Fractions', { masteryResult: 70 });
  const events = computeMasteryPBs(mastery, existing);
  assert.equal(events.length, 0);
});

test('computeMasteryPBs - faster mastery triggers event', () => {
  const mastery: PalConceptMastery[] = [
    { conceptName: 'Fractions', attempted: 5, correct: 5, wrong: 0, total: 5, accuracy: 100, masteryLevel: 100, status: 'mastered' },
  ];
  const existing = new Map<string, { masteryResult: number }>();
  existing.set('Fractions', { masteryResult: 85 });
  const events = computeMasteryPBs(mastery, existing);
  assert.equal(events.length, 1);
  assert.equal(events[0].newResult, 100);
});

test('computeSessionPBs - longest session triggers when better', () => {
  const existing = new Map<string, { previousValue: number }>();
  existing.set('longest_productive_session', { previousValue: 30 });
  const events = computeSessionPBs('2026-08-14T10:00:00Z', '2026-08-14T11:30:00Z', ['A', 'B'], existing);
  assert.ok(events.some(e => e.recordType === 'longest_productive_session'));
});

test('computeSessionPBs - no trigger when not better', () => {
  const existing = new Map<string, { previousValue: number }>();
  existing.set('longest_productive_session', { previousValue: 120 });
  const events = computeSessionPBs('2026-08-14T10:00:00Z', '2026-08-14T10:30:00Z', ['A'], existing);
  assert.equal(events.filter(e => e.recordType === 'longest_productive_session').length, 0);
});

test('computeSessionPBs - dedupes concepts', () => {
  const existing = new Map<string, { previousValue: number }>();
  const events = computeSessionPBs('2026-08-14T10:00:00Z', '2026-08-14T11:00:00Z', ['A', 'A', 'B', 'B'], existing);
  const mostConcepts = events.find(e => e.recordType === 'most_concepts_in_one_day');
  assert.ok(mostConcepts);
  assert.equal(mostConcepts!.newValue, 2);
});
