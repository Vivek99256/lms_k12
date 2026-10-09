import assert from 'node:assert/strict';
import test from 'node:test';

import { canShowPdfInline, defaultVariant, documentFileName, documentPdfRequest, documentRequest, variantLabels, variantsOffered } from './api';

test('a document is asked for by chapter, content item and school, never by a file name or a path', () => {
  assert.deepEqual(documentRequest(8592, 61401, 7), { chapter_id: 8592, content_id: 61401, sub_institute_id: 7 });
  assert.deepEqual(documentRequest(8592, 61401, NaN), { chapter_id: 8592, content_id: 61401 }, 'a school that is not known is left out');
  assert.deepEqual(documentRequest(8592, 61401, 0), { chapter_id: 8592, content_id: 61401 });
  for (const body of [documentRequest(1, 2, 3), documentPdfRequest(1, 2, 3, { variant: 'practice', inline: true })]) {
    assert.deepEqual(Object.keys(body).filter((k) => /file|path|url|name/i.test(k)), []);
  }
});

test('the viewer asks for the PDF inline, so it opens where the learner already is', () => {
  assert.deepEqual(documentPdfRequest(1, 2, 3, { inline: true }), { chapter_id: 1, content_id: 2, sub_institute_id: 3, disposition: 'inline' });
  assert.deepEqual(documentPdfRequest(1, 2, 3), { chapter_id: 1, content_id: 2, sub_institute_id: 3 }, 'a plain request is a download');
});

test('the other copy is asked for by name, and only that copy', () => {
  assert.deepEqual(documentPdfRequest(1, 2, 3, { variant: 'practice' }), { chapter_id: 1, content_id: 2, sub_institute_id: 3, variant: 'practice' });
  assert.equal('variant' in documentPdfRequest(1, 2, 3, { variant: 'revision' }), false, 'the stored copy is the default and is not named');
});

test('each kind names its two copies the way a reader would', () => {
  assert.deepEqual(variantLabels('revision_notes'), { revision: 'Answers shown', practice: 'Answers hidden' });
  assert.deepEqual(variantLabels('remedial'), { revision: 'Answers shown', practice: 'Answers hidden' });
  assert.deepEqual(variantLabels('activities'), { revision: 'Teacher edition', practice: 'Student handout' });
});

test('a teacher opens the full copy first and a student the copy without answers', () => {
  assert.equal(defaultVariant('teacher'), 'revision');
  assert.equal(defaultVariant('student'), 'practice');
});

test("a student is not offered a classroom activity's teacher edition; everything else is offered to everyone", () => {
  assert.deepEqual(variantsOffered('activities', 'student'), ['practice']);
  assert.deepEqual(variantsOffered('activities', 'teacher'), ['revision', 'practice']);
  for (const kind of ['revision_notes', 'remedial'] as const) {
    assert.deepEqual(variantsOffered(kind, 'student'), ['revision', 'practice'], 'a learner revising may want the answers');
    assert.deepEqual(variantsOffered(kind, 'teacher'), ['revision', 'practice']);
  }
  // The copy a reader opens first is always one they are offered.
  for (const kind of ['revision_notes', 'remedial', 'activities'] as const) {
    for (const audience of ['teacher', 'student'] as const) {
      assert.ok(variantsOffered(kind, audience).includes(defaultVariant(audience)), `${kind} ${audience}`);
    }
  }
});

test('a download is named from the title, and the other copy says so', () => {
  assert.equal(documentFileName('Exploration: Entering the World of Secondary Science Remedial Class'), 'exploration-entering-the-world-of-secondary-science-remedial-class.pdf');
  assert.equal(documentFileName('Ideas Revision Notes', 'practice'), 'ideas-revision-notes-practice.pdf');
  assert.equal(documentFileName('   !!!  '), 'study-document.pdf');
  assert.equal(documentFileName(null), 'study-document.pdf');
  assert.ok(documentFileName('x'.repeat(500)).length <= 84);
});

test('a browser that says it cannot show a PDF in a page is offered the download instead of a blank frame', () => {
  assert.equal(canShowPdfInline({ pdfViewerEnabled: false }), false);
  assert.equal(canShowPdfInline({ pdfViewerEnabled: true }), true);
  assert.equal(canShowPdfInline({}), true, 'when the browser does not say, try');
  assert.equal(canShowPdfInline(null), true);
});
