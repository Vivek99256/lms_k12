import assert from 'node:assert/strict';
import test from 'node:test';

import { draftAddress, previewAddress, readDraftRun, readPreviewRequest } from './previewAddress';

test('the address round-trips through the viewer page', () => {
  const address = previewAddress(8592, { pedagogy: 'inquiry_based', format: 'interactive_slides' });
  assert.equal(address, '/student/study-deck/8592?source=preview&pedagogy=inquiry_based&format=interactive_slides');
  const params = new URL(address, 'http://x').searchParams;
  assert.deepEqual(readPreviewRequest(params), { pedagogy: 'inquiry_based', format: 'interactive_slides' });
});

test('an address that is not a preview, or is malformed, asks for none', () => {
  const read = (q: string) => readPreviewRequest(new URLSearchParams(q));
  assert.equal(read('pedagogy=inquiry_based&format=interactive_slides'), null, 'no source=preview');
  assert.equal(read('source=pilot&pedagogy=inquiry_based&format=interactive_slides'), null);
  assert.equal(read('source=preview&pedagogy=inquiry_based'), null, 'a choice is missing');
  assert.equal(read('source=preview&pedagogy=../x&format=interactive_slides'), null, 'not a simple key');
  assert.equal(read('source=preview&pedagogy=Inquiry&format=interactive_slides'), null);
  assert.equal(read('source=preview&pedagogy=a b&format=c'), null);
  assert.equal(readPreviewRequest(null), null);
});

test('a draft waiting for review has its own viewer address, and only a run id is read back', () => {
  const address = draftAddress(8592, 'r4e06dfcb0625');
  assert.equal(address, '/student/study-deck/8592?draft=r4e06dfcb0625');
  assert.equal(readDraftRun(new URL(address, 'http://x').searchParams), 'r4e06dfcb0625');
  const read = (q: string) => readDraftRun(new URLSearchParams(q));
  assert.equal(read(''), null);
  assert.equal(read('draft=../../x'), null);
  assert.equal(read('draft=R4E06DFCB0625'), null);
  assert.equal(read('draft=r4e06dfcb06'), null, 'too short');
  assert.equal(readDraftRun(null), null);
});
