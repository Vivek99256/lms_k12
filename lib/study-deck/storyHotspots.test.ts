import assert from 'node:assert/strict';
import test from 'node:test';

import { calloutSide, closeStoryHotspot, discoveredSummary, initialStoryHotspots, openStoryHotspot, pinInBox, storyHotspotProgress, storySpots } from './storyHotspots';
import type { DeckImage, HotspotSpot } from './types';

const spot = (id: string, over: Partial<HotspotSpot> = {}): HotspotSpot => ({ id, label: `Part ${id}`, x: 30, y: 40, w: 20, h: 20, text: `About part ${id}.`, ...over });
const picture = (hotspots: unknown): DeckImage => ({
  type: 'photo', url: 'x', alt: 'a', caption: null, width: 100, height: 100, licence: null, source_url: null, creator: null, attribution: '', attribution_required: false,
  hotspots: hotspots as HotspotSpot[],
});

test('two to four valid parts are usable; fewer than two show none', () => {
  assert.equal(storySpots(picture([spot('h1'), spot('h2')])).length, 2);
  assert.equal(storySpots(picture([spot('h1')])).length, 0, 'one pin explores nothing');
  assert.equal(storySpots(picture([spot('h1'), spot('h2'), spot('h3'), spot('h4'), spot('h5')])).length, 4, 'at most four');
  assert.deepEqual(storySpots(picture(null)), []);
  assert.deepEqual(storySpots(undefined), []);
});

test('a part with no words, no label or a box outside the picture is dropped', () => {
  const bad = [spot('b1', { text: '  ' }), spot('b2', { label: '' }), spot('b3', { x: 95, w: 30 }), spot('b4', { w: 2 }), spot('b5', { y: Number.NaN })];
  assert.equal(storySpots(picture([spot('h1'), ...bad, spot('h2')])).length, 2);
  assert.equal(storySpots(picture([spot('h1'), ...bad])).length, 0, 'one good part left: none shown');
});

test('opening parts counts them as explored with the same rule a hotspots slide uses', () => {
  const spots = [spot('h1'), spot('h2'), spot('h3')];
  let state = openStoryHotspot(initialStoryHotspots(), spots, 'h1');
  assert.deepEqual(storyHotspotProgress(spots, state), { opened: 1, total: 3, done: false });
  assert.equal(state.active, 'h1');
  state = openStoryHotspot(state, spots, 'h1'); // opening it again counts once
  state = openStoryHotspot(state, spots, 'nope'); // an unknown part changes nothing
  assert.equal(storyHotspotProgress(spots, state).opened, 1);
  state = closeStoryHotspot(state);
  assert.equal(state.active, null);
  assert.equal(storyHotspotProgress(spots, state).opened, 1, 'closing keeps it explored');
  state = openStoryHotspot(openStoryHotspot(state, spots, 'h2'), spots, 'h3');
  assert.deepEqual(storyHotspotProgress(spots, state), { opened: 3, total: 3, done: true });
});

test('a pin sits on the part inside the picture, wherever the picture sits in its box', () => {
  const box = { left: 50, top: 10, width: 200, height: 100 };
  assert.deepEqual(pinInBox(box, spot('h1', { x: 50, y: 50 })), { left: 150, top: 60 });
  assert.deepEqual(pinInBox(box, spot('h1', { x: 0, y: 0, pin: { x: 25, y: 75 } })), { left: 100, top: 85 }, 'a part may name its own pin');
});

test('the explanation opens on the side away from the part', () => {
  assert.equal(calloutSide(spot('h1', { x: 20 })), 'right');
  assert.equal(calloutSide(spot('h1', { x: 80 })), 'left');
});

test('the summary names the parts the learner looked at', () => {
  assert.equal(discoveredSummary([spot('h1', { label: 'Wheel' }), spot('h2', { label: 'Chain' }), spot('h3', { label: 'Pedal' })]), 'You looked at Wheel, Chain and Pedal.');
  assert.equal(discoveredSummary([spot('h1', { label: 'Wheel' })]), 'You looked at Wheel.');
  assert.equal(discoveredSummary([]), '');
});
