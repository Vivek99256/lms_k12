import test from 'node:test';
import assert from 'node:assert/strict';

import { hotspotFeedback, scoreHotspotVisit, type ScorableHotspot } from './image-hotspots';

/**
 * Coverage scoring is short, which is exactly why it is worth pinning: its
 * three failure modes are all silent. A learner who cannot reach 100% on a
 * diagram they have fully read; a learner who reaches 100% on one they have
 * not; and a diagram with no hotspots reporting NaN into a report.
 */

function hotspots(): ScorableHotspot[] {
  // Non-sequential ids on purpose: an id used as an index would show up.
  return [
    { id: 91, sort_order: 0 },
    { id: 12, sort_order: 1 },
    { id: 77, sort_order: 2 },
    { id: 34, sort_order: 3 },
  ];
}

const rules = { points_per_hotspot: 1, pass_percentage: 100 };

test('an untouched diagram scores zero and is not completed', () => {
  const result = scoreHotspotVisit(hotspots(), new Set(), rules);

  assert.equal(result.openedCount, 0);
  assert.equal(result.percentage, 0);
  assert.equal(result.completed, false);
  assert.equal(result.remaining.length, 4);
});

test('opening every hotspot completes the diagram', () => {
  const result = scoreHotspotVisit(hotspots(), new Set([91, 12, 77, 34]), rules);

  assert.equal(result.openedCount, 4);
  assert.equal(result.percentage, 100);
  assert.equal(result.completed, true);
  assert.equal(result.passed, true);
  assert.deepEqual(result.remaining, []);
});

test('points per hotspot scales the score but not the percentage', () => {
  const result = scoreHotspotVisit(hotspots(), new Set([91, 12]), {
    points_per_hotspot: 5,
    pass_percentage: 50,
  });

  assert.equal(result.score, 10);
  assert.equal(result.maxScore, 20);
  assert.equal(result.percentage, 50);
  assert.equal(result.passed, true);
});

test('a stale id from a deleted hotspot cannot inflate the score', () => {
  // 999 was a hotspot the author has since removed. Counting the SET size
  // rather than the intersection would report 3 of 4 on a diagram where only
  // two markers have been opened.
  const result = scoreHotspotVisit(hotspots(), new Set([91, 12, 999]), rules);

  assert.equal(result.openedCount, 2);
  assert.equal(result.percentage, 50);
  assert.equal(result.completed, false);
});

test('opening the same hotspot again does not count twice', () => {
  // A Set makes this structural rather than a rule the player has to remember,
  // which is the point of taking one.
  const opened = new Set([91]);
  opened.add(91);

  assert.equal(scoreHotspotVisit(hotspots(), opened, rules).openedCount, 1);
});

test('remaining hotspots come back in author order', () => {
  const result = scoreHotspotVisit(hotspots(), new Set([77]), rules);

  assert.deepEqual(
    result.remaining.map((h) => h.sort_order),
    [0, 1, 3]
  );
});

test('a diagram with no hotspots scores zero rather than NaN', () => {
  const result = scoreHotspotVisit([], new Set(), rules);

  assert.equal(result.percentage, 0);
  assert.equal(result.completed, false);
  assert.ok(!Number.isNaN(result.percentage));
});

test('the last matching feedback band wins', () => {
  const bands = [
    { from: 0, to: 99, feedback: 'Keep exploring.' },
    { from: 100, to: 100, feedback: 'You read the whole diagram.' },
  ];

  assert.equal(hotspotFeedback(100, bands), 'You read the whole diagram.');
  assert.equal(hotspotFeedback(25, bands), 'Keep exploring.');
  assert.equal(hotspotFeedback(25, undefined), '');
});
