import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DRAG_GESTURE_DEFAULTS,
  edgeAutoScrollVelocity,
  normalisePointerType,
  shouldAbandonGesture,
  shouldActivateDrag,
  type DragPointerType,
} from './drag-gesture';

/**
 * The property that matters here is not "drag works" -- it is that a gesture
 * which was going to be a scroll is never taken for a drag. A stolen scroll
 * makes the page feel broken on a phone, and is what these tests are for.
 */

const sample = (pointerType: DragPointerType, dx: number, dy: number, elapsedMs = 0) => ({
  pointerType,
  dx,
  dy,
  elapsedMs,
});

// --- mouse and pen ---------------------------------------------------------

test('a mouse press does not drag until it leaves the slop radius', () => {
  assert.equal(shouldActivateDrag(sample('mouse', 0, 0)), false, 'a press alone is a click');
  assert.equal(shouldActivateDrag(sample('mouse', 3, 3)), false, 'hand-shake during a click');
  assert.equal(shouldActivateDrag(sample('mouse', 6, 0)), true);
  assert.equal(shouldActivateDrag(sample('mouse', 0, -8)), true, 'direction is irrelevant');
});

test('a pen behaves like a mouse, not like a finger', () => {
  assert.equal(shouldActivateDrag(sample('pen', 7, 0)), true);
  assert.equal(shouldActivateDrag(sample('pen', 0, 7)), true, 'a pen cannot scroll by dragging');
});

test('a mouse gesture never abandons to scrolling', () => {
  assert.equal(shouldAbandonGesture(sample('mouse', 0, 200)), false);
  assert.equal(shouldAbandonGesture(sample('pen', 0, 200)), false);
});

// --- touch: the case the report was about ----------------------------------

test('a vertical finger swipe scrolls and never starts a drag', () => {
  const swipe = sample('touch', 0, 40, 60);
  assert.equal(shouldActivateDrag(swipe), false);
  assert.equal(shouldAbandonGesture(swipe), true);
});

test('a slow vertical swipe still scrolls even past the long-press time', () => {
  // The dangerous case: a finger resting mid-scroll long enough to trip a
  // naive timer. Travel has to beat the timer, or the page locks up.
  const slowScroll = sample('touch', 2, 60, 900);
  assert.equal(shouldActivateDrag(slowScroll), false);
  assert.equal(shouldAbandonGesture(slowScroll), true);
});

test('a stationary long press starts a drag', () => {
  assert.equal(shouldActivateDrag(sample('touch', 0, 0, 100)), false, 'too early');
  assert.equal(shouldActivateDrag(sample('touch', 0, 0, 350)), true);
  assert.equal(shouldActivateDrag(sample('touch', 3, 4, 400)), true, 'a little drift is fine');
});

test('a horizontal finger drag starts a drag without waiting', () => {
  assert.equal(shouldActivateDrag(sample('touch', 12, 0, 20)), true);
  assert.equal(shouldActivateDrag(sample('touch', -14, 2, 20)), true, 'either direction');
  assert.equal(shouldActivateDrag(sample('touch', 8, 0, 20)), false, 'below the threshold');
});

test('a diagonal finger swipe resolves to scrolling, not dragging', () => {
  // 20 across, 18 down: past the horizontal threshold but not dominant enough.
  // Erring toward scrolling is deliberate -- a missed drag is retried, a
  // stolen scroll feels broken.
  assert.equal(shouldActivateDrag(sample('touch', 20, 18, 50)), false);
  assert.equal(shouldActivateDrag(sample('touch', 30, 10, 50)), true, 'clearly sideways');
});

test('a tap is neither a drag nor a scroll, so the click survives', () => {
  const tap = sample('touch', 1, 1, 80);
  assert.equal(shouldActivateDrag(tap), false);
  assert.equal(shouldAbandonGesture(tap), false);
});

test('thresholds are configurable and the defaults are what the hook uses', () => {
  const twitchy = { ...DRAG_GESTURE_DEFAULTS, pointerSlop: 1 };
  assert.equal(shouldActivateDrag(sample('mouse', 2, 0)), false);
  assert.equal(shouldActivateDrag(sample('mouse', 2, 0), twitchy), true);
});

test('pointer type falls back to mouse for anything unrecognised', () => {
  assert.equal(normalisePointerType('touch'), 'touch');
  assert.equal(normalisePointerType('pen'), 'pen');
  assert.equal(normalisePointerType('mouse'), 'mouse');
  assert.equal(normalisePointerType(undefined), 'mouse');
  assert.equal(normalisePointerType(''), 'mouse');
});

// --- auto-scroll -----------------------------------------------------------

const edge = (clientY: number, viewportHeight = 800) =>
  edgeAutoScrollVelocity({ clientY, viewportHeight, edgeSize: 80, maxSpeed: 20 });

test('the middle of the viewport does not auto-scroll', () => {
  assert.equal(edge(400), 0);
  assert.equal(edge(80), 0, 'exactly at the edge boundary is still calm');
  assert.equal(edge(720), 0);
});

test('auto-scroll ramps with depth into the edge zone', () => {
  const shallow = edge(70);
  const deep = edge(10);
  assert.ok(shallow < 0 && deep < 0, 'both scroll up');
  assert.ok(Math.abs(deep) > Math.abs(shallow), 'deeper is faster');
  assert.equal(edge(0), -20, 'the very edge runs at max speed');
});

test('the bottom edge scrolls down', () => {
  assert.ok(edge(760) > 0);
  assert.equal(edge(800), 20);
});

test('past the edge still clamps to max speed rather than accelerating', () => {
  // The pointer can leave the viewport during a drag; velocity must not run away.
  assert.equal(edge(-200), -20);
  assert.equal(edge(1400), 20);
});

test('a viewport too short for two edge zones does not scroll everywhere', () => {
  // 100px tall with an 80px edge would otherwise overlap into a permanent scroll.
  const tiny = (clientY: number) =>
    edgeAutoScrollVelocity({ clientY, viewportHeight: 100, edgeSize: 80, maxSpeed: 20 });
  assert.equal(tiny(50), 0, 'the middle is still calm');
  assert.ok(tiny(5) < 0);
  assert.ok(tiny(95) > 0);
});

test('degenerate inputs are inert rather than throwing', () => {
  assert.equal(edgeAutoScrollVelocity({ clientY: 10, viewportHeight: 0, edgeSize: 80, maxSpeed: 20 }), 0);
  assert.equal(edgeAutoScrollVelocity({ clientY: 10, viewportHeight: 800, edgeSize: 0, maxSpeed: 20 }), 0);
});
