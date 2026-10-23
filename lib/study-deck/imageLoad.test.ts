import assert from 'node:assert/strict';
import test from 'node:test';

import { failedPictureLabel, imageAttemptKey, imageFailed, imageLoaded, INITIAL_IMAGE_LOAD, MAX_IMAGE_RETRIES } from './imageLoad';

test('a picture that loads stays loaded and counts no retry', () => {
  assert.deepEqual(imageLoaded(INITIAL_IMAGE_LOAD), { status: 'loaded', attempts: 0 });
});

test('a failed picture is asked for again exactly once, then given up on', () => {
  const first = imageFailed(INITIAL_IMAGE_LOAD);
  assert.deepEqual(first, { status: 'retrying', attempts: 1 });
  const second = imageFailed(first);
  assert.deepEqual(second, { status: 'failed', attempts: 2 });
  // Nothing after that asks again.
  assert.equal(imageFailed(second).status, 'failed');
  assert.equal(MAX_IMAGE_RETRIES, 1);
});

test('a picture that fails once and then loads ends loaded, with the retry counted', () => {
  const retrying = imageFailed(INITIAL_IMAGE_LOAD);
  assert.deepEqual(imageLoaded(retrying), { status: 'loaded', attempts: 1 });
});

test('the retry key changes with every attempt so the browser asks for the same address again', () => {
  const url = '/api/study-deck/images/7?expires=1&t=1&signature=abc';
  const keys = [INITIAL_IMAGE_LOAD, imageFailed(INITIAL_IMAGE_LOAD)].map((s) => imageAttemptKey(url, s));
  assert.notEqual(keys[0], keys[1]);
  assert.ok(keys.every((k) => k.startsWith(url)), 'the address itself is never altered (it is signed)');
});

test('the failure label always names the picture, and says so when it has no description', () => {
  assert.equal(failedPictureLabel('Related picture, not this exact scene. A vernier caliper.'), 'This picture could not be loaded: Related picture, not this exact scene. A vernier caliper.');
  assert.equal(failedPictureLabel('   '), 'This picture could not be loaded.');
});
