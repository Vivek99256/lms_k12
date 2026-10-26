import assert from 'node:assert/strict';
import test from 'node:test';

import { documentTarget, INCOMPLETE_DOCUMENT_MESSAGE, MISSING_DOCUMENT_MESSAGE } from './documentUrl';

const BASE = 'https://s3-triz.fra1.cdn.digitaloceanspaces.com/public/lms_content_file/';

test('a complete public file URL opens as given', () => {
  for (const file of ['g4-water-ch1-lesson-plan-a1-0ba84816.pdf', 'g4-water-ch1-lesson-plan-b1-fffd4cb5.docx', 'g4-water-ch1-lesson-plan-b2-8f3d42a7.docx']) {
    assert.deepEqual(documentTarget(BASE + file), { ok: true, url: BASE + file });
  }
});

test('an external link without a file extension still opens', () => {
  assert.deepEqual(documentTarget('https://example.org/watch?v=abc'), { ok: true, url: 'https://example.org/watch?v=abc' });
});

test('a missing URL says so instead of doing nothing', () => {
  for (const value of [null, undefined, '', '   ']) {
    assert.deepEqual(documentTarget(value), { ok: false, message: MISSING_DOCUMENT_MESSAGE });
  }
});

test('the base folder alone, a relative path and a non-http scheme are refused', () => {
  for (const value of [BASE, 'public/lms_content_file/a.pdf', 'javascript:alert(1)', 'ftp://host/a.pdf']) {
    assert.deepEqual(documentTarget(value), { ok: false, message: INCOMPLETE_DOCUMENT_MESSAGE }, value);
  }
});
