import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CANVAS_MAX_HEIGHT,
  CANVAS_MAX_WIDTH,
  CANVAS_MIN_HEIGHT,
  CANVAS_MIN_WIDTH,
  canvasAspectRatio,
  fitCanvasSize,
  IMAGE_FIT_CLASS,
  normaliseImageFit,
} from './drag-drop-canvas';

/**
 * Cover for the "background image is cropped inside the canvas" report.
 *
 * The cause was a cover-fit background drawn into a fixed 620x310 box: a
 * portrait diagram lost its top and bottom, and the drop zones an author had
 * drawn over the cropped labels pointed at nothing. The fix is that a
 * background sets the canvas to its own proportions and is drawn contain by
 * default, so these tests pin the two things that has to get right -- the
 * canvas size derived from an image, and the aspect ratio the box renders at.
 */

// The three shapes the report asked to be tested, plus the extreme that forces
// the clamp to give up on the ratio.
const WIDE = { width: 1920, height: 1080 }; // 16:9
const SQUARE = { width: 1000, height: 1000 }; // 1:1
const PORTRAIT = { width: 1080, height: 1920 }; // 9:16

function ratio({ width, height }: { width: number; height: number }): number {
  return width / height;
}

test('a canvas derived from an image keeps the image aspect ratio', () => {
  for (const image of [WIDE, SQUARE, PORTRAIT]) {
    const canvas = fitCanvasSize(image.width, image.height);
    assert.ok(
      Math.abs(ratio(canvas) - ratio(image)) < 0.01,
      `${image.width}x${image.height} became ${canvas.width}x${canvas.height}`
    );
  }
});

test('a derived canvas is always a size the save endpoint accepts', () => {
  const cases = [WIDE, SQUARE, PORTRAIT, { width: 60, height: 40 }, { width: 8000, height: 12000 }];
  for (const image of cases) {
    const canvas = fitCanvasSize(image.width, image.height);
    assert.ok(canvas.width >= CANVAS_MIN_WIDTH && canvas.width <= CANVAS_MAX_WIDTH, `width ${canvas.width}`);
    assert.ok(canvas.height >= CANVAS_MIN_HEIGHT && canvas.height <= CANVAS_MAX_HEIGHT, `height ${canvas.height}`);
  }
});

test('a portrait image gives a taller canvas than a wide one', () => {
  const portrait = fitCanvasSize(PORTRAIT.width, PORTRAIT.height);
  const wide = fitCanvasSize(WIDE.width, WIDE.height);
  assert.ok(portrait.height > portrait.width);
  assert.ok(wide.width > wide.height);
});

test('contain takes its aspect ratio from the image, not the stored canvas', () => {
  // The mismatch an older task has: a portrait background in the 2:1 default.
  assert.equal(canvasAspectRatio('contain', 620, 310, PORTRAIT), '1080 / 1920');
});

test('the other fits keep the authored canvas, and so does contain before the image is measured', () => {
  assert.equal(canvasAspectRatio('cover', 620, 310, PORTRAIT), '620 / 310');
  assert.equal(canvasAspectRatio('original', 620, 310, PORTRAIT), '620 / 310');
  assert.equal(canvasAspectRatio('stretch', 620, 310, PORTRAIT), '620 / 310');
  assert.equal(canvasAspectRatio('contain', 620, 310, null), '620 / 310');
});

test('a zero-sized measurement never produces an invalid aspect ratio', () => {
  assert.equal(canvasAspectRatio('contain', 620, 310, { width: 0, height: 0 }), '620 / 310');
  assert.equal(canvasAspectRatio('contain', 0, 0, null), '620 / 310');
});

test('an unknown or missing fit reads as contain', () => {
  assert.equal(normaliseImageFit(null), 'contain');
  assert.equal(normaliseImageFit(undefined), 'contain');
  assert.equal(normaliseImageFit('fill'), 'contain');
  assert.equal(normaliseImageFit('cover'), 'cover');
});

test('contain is the only fit that cannot crop or distort', () => {
  assert.equal(IMAGE_FIT_CLASS.contain, 'object-contain');
  assert.equal(IMAGE_FIT_CLASS.cover, 'object-cover');
  assert.equal(IMAGE_FIT_CLASS.stretch, 'object-fill');
});
