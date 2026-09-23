import test from 'node:test';
import assert from 'node:assert/strict';

import { computePageCuts, marginToMm } from './pagination';

test('keeps a short paper on a single page', () => {
  assert.deepEqual(computePageCuts([0, 100, 200], 500, 1000), [[0, 500]]);
});

test('breaks at a block boundary rather than at the page limit', () => {
  assert.deepEqual(computePageCuts([0, 300, 600, 900, 1200], 1400, 1000), [
    [0, 900],
    [900, 1400],
  ]);
});

test('fills each page with as many whole blocks as fit', () => {
  assert.deepEqual(
    computePageCuts([0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800], 2000, 700),
    [
      [0, 600],
      [600, 1200],
      [1200, 1800],
      [1800, 2000],
    ]
  );
});

test('does not waste a page on a block that is taller than one', () => {
  // A 50px header followed by a 2450px block: breaking after the header would
  // leave page 1 almost empty and the block still would not fit, so the cut
  // falls at the page boundary instead.
  assert.deepEqual(computePageCuts([0, 50], 2500, 1000), [
    [0, 1000],
    [1000, 2000],
    [2000, 2500],
  ]);
});

test('still breaks early for a short block that fits on its own page', () => {
  assert.deepEqual(computePageCuts([0, 200, 1010], 3000, 1000), [
    [0, 200],
    [200, 1010],
    [1010, 2010],
    [2010, 3000],
  ]);
});

test('survives a sheet with no marked blocks', () => {
  assert.deepEqual(computePageCuts([], 400, 1000), [[0, 400]]);
});

test('survives degenerate measurements', () => {
  assert.deepEqual(computePageCuts([0], 0, 1000), [[0, 1]]);
  assert.deepEqual(computePageCuts([0], 400, 0), [[0, 400]]);
  assert.deepEqual(computePageCuts([Number.NaN, 120], 300, 1000), [[0, 300]]);
});

test('page ranges are contiguous, ordered and cover the sheet exactly', () => {
  const cuts = computePageCuts([0, 180, 360, 540, 720, 900, 1080], 1250, 500);

  assert.equal(cuts[0][0], 0);
  assert.equal(cuts[cuts.length - 1][1], 1250);

  cuts.forEach(([top, bottom], index) => {
    assert.ok(bottom > top, `page ${index} has no height`);
    assert.ok(bottom - top <= 500 + 1e-9, `page ${index} is taller than the page box`);
    if (index > 0) assert.equal(top, cuts[index - 1][1], `page ${index} does not follow the last`);
  });
});

test('reads every margin unit a blueprint can carry', () => {
  assert.equal(marginToMm('16mm'), 16);
  assert.equal(marginToMm('1.6cm'), 16);
  assert.equal(marginToMm('1in'), 25.4);
  assert.equal(Math.round(marginToMm('96px')), 25);
  assert.equal(marginToMm('20'), 20, 'a bare number is millimetres');
});

test('falls back when the margin is unreadable', () => {
  assert.equal(marginToMm('wide'), 16);
  assert.equal(marginToMm(''), 16);
  assert.equal(marginToMm('-4mm'), 16);
  assert.equal(marginToMm(undefined as unknown as string), 16);
});
