import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { hasStudyDeckPdf, pdfDownloadName, pdfFileNameFromTitle, studyDeckPdfRequest } from './pdf';

describe('study deck PDF', () => {
  it('is offered only when the backend reported a PDF', () => {
    assert.equal(hasStudyDeckPdf({ pdf_url: 'https://bucket.example/x.pdf' }), true);
    assert.equal(hasStudyDeckPdf({}), false);
    assert.equal(hasStudyDeckPdf({ pdf_url: '' }), false);
    assert.equal(hasStudyDeckPdf({ pdf_url: '  ' }), false);
    assert.equal(hasStudyDeckPdf(null), false);
  });

  it('asks the server by chapter, content item and school, never by a file path', () => {
    assert.deepEqual(studyDeckPdfRequest(8592, 61401, 1), { chapter_id: 8592, content_id: 61401, sub_institute_id: 1 });
    assert.deepEqual(studyDeckPdfRequest(8592, 61401, NaN), { chapter_id: 8592, content_id: 61401 });
    assert.ok(!Object.keys(studyDeckPdfRequest(1, 2, 3)).some((k) => /url|path|file/i.test(k)));
  });

  it('takes the download name from the server and never trusts odd ones', () => {
    assert.equal(pdfDownloadName('attachment; filename="study_deck_x_ab12.pdf"'), 'study_deck_x_ab12.pdf');
    assert.equal(pdfDownloadName('attachment; filename="../../evil.exe"'), 'study-deck.pdf');
    assert.equal(pdfDownloadName(null), 'study-deck.pdf');
  });

  it('names the file from the title when the server name is hidden by CORS', () => {
    assert.equal(pdfFileNameFromTitle('Exploration: Entering the World of Secondary Science Study Deck'), 'exploration-entering-the-world-of-secondary-science-study-deck.pdf');
    assert.equal(pdfFileNameFromTitle(''), 'study-deck.pdf');
    assert.equal(pdfDownloadName(null, pdfFileNameFromTitle('A b')), 'a-b.pdf');
  });

  it('keeps Open on the interactive player and has no hardcoded PDF address', () => {
    const page = readFileSync('app/course-master/[courseId]/chapters/page.tsx', 'utf8');
    const card = readFileSync('app/course-master/[courseId]/chapters/ContentCard.tsx', 'utf8');
    // Open still follows the item's own deep link before anything else.
    assert.match(page, /if \(item\.deepLink\) \{\s*router\.push\(item\.deepLink\);\s*return;\s*\}/);
    // The PDF is a separate button, rendered only when the item has one, and it does not touch Open.
    assert.match(card, /item\.pdfUrl/);
    assert.match(card, /onDownloadPdf/);
    for (const source of [page, card]) {
      assert.doesNotMatch(source, /study_deck_[a-z0-9_]+\.pdf|digitaloceanspaces\.com[^'"`]*\.pdf/i);
    }
  });
});
