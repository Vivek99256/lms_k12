import assert from 'node:assert/strict';
import test from 'node:test';

import { captionText, containedRect, regionInBox, usableRegion } from './picture';

test('a picture scaled to fit its box is centred, with empty bands on the long side', () => {
  // a wide picture (16:9) in a tall box: full width, bands above and below
  const wide = containedRect(400, 600, 1280, 720);
  assert.equal(wide.width, 400);
  assert.equal(Math.round(wide.height), 225);
  assert.equal(wide.left, 0);
  assert.equal(Math.round(wide.top), 188);
  // a tall picture in a wide box: full height, bands left and right
  const tall = containedRect(800, 400, 300, 600);
  assert.equal(tall.height, 400);
  assert.equal(tall.width, 200);
  assert.equal(tall.left, 300);
  assert.equal(tall.top, 0);
  // an unmeasured box or picture draws nothing
  assert.deepEqual(containedRect(0, 400, 1280, 720), { left: 0, top: 0, width: 0, height: 0 });
  assert.deepEqual(containedRect(400, 400, 0, 720), { left: 0, top: 0, width: 0, height: 0 });
});

test('the part to notice is placed on the picture itself, not on the box around it', () => {
  const picture = containedRect(400, 600, 1280, 720); // 400 x 225 at top 187.5
  const mark = regionInBox(picture, { x: 25, y: 40, w: 50, h: 20 });
  assert.equal(mark.left, 100);
  assert.equal(mark.width, 200);
  assert.equal(Math.round(mark.top), Math.round(187.5 + 225 * 0.4));
  assert.equal(Math.round(mark.height), 45);
});

test('only a rectangle inside the picture that points at something smaller than the whole is drawn', () => {
  assert.deepEqual(usableRegion({ x: 10, y: 20, w: 30, h: 40 }), { x: 10, y: 20, w: 30, h: 40 });
  assert.deepEqual(usableRegion({ x: 70, y: 0, w: 30.4, h: 50 }), { x: 70, y: 0, w: 30, h: 50 }, 'a rounding overshoot is trimmed');
  for (const bad of [null, undefined, 'x', {}, { x: 1, y: 1, w: 10 }, { x: -1, y: 0, w: 20, h: 20 }, { x: 0, y: 0, w: 5, h: 20 }, { x: 0, y: 0, w: 100, h: 100 }, { x: 90, y: 0, w: 30, h: 20 }, { x: '1', y: 0, w: 20, h: 20 }, { x: NaN, y: 0, w: 20, h: 20 }]) {
    assert.equal(usableRegion(bad), null, JSON.stringify(bad));
  }
});

test('the caption says what to notice for a photograph or a highlighted part, and leaves a drawn diagram its own words', () => {
  assert.equal(captionText('Look at the printed scale.', { photo: true, highlighted: false }), 'What to notice: Look at the printed scale.');
  assert.equal(captionText('Look at the printed scale.', { photo: false, highlighted: true }), 'What to notice: Look at the printed scale.');
  assert.equal(captionText('Step 2 of 4: Investigation.', { photo: false, highlighted: false }), 'Step 2 of 4: Investigation.');
  assert.equal(captionText('  ', { photo: true, highlighted: true }), '');
  assert.equal(captionText(null, { photo: true, highlighted: true }), '');
  assert.equal(captionText('Ends twice...', { photo: false, highlighted: false }), 'Ends twice.');
});
