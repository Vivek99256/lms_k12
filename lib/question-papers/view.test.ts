import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  activatable,
  queueHint,
  STALLED_QUEUE_SECONDS,
  breakdownParts,
  chapterSourceText,
  chapterSuggestionText,
  chooseableLabels,
  pagesText,
  reviewGaps,
  safeInternalPath,
  unresolvedFields,
  type ReviewItemInput,
} from './view';

const resolved = { standard_id: 42, subject_id: 3975, chapter_id: 7 };
const noChapter = { standard_id: 42, subject_id: 3975, chapter_id: null };

const keyed: ReviewItemInput = { state: 'needs_review', format: 'mcq', needs_answer_key: false, can_activate: true, options: [{ label: 'A' }, { label: 'B' }] };
const unkeyed: ReviewItemInput = { state: 'needs_review', format: 'mcq', needs_answer_key: true, can_activate: false, options: [{ label: 'A' }, { label: 'B' }] };

describe('safeInternalPath', () => {
  it('keeps in-app paths and rejects anything that could leave the site', () => {
    assert.equal(safeInternalPath('/documents_new?tab=question-papers&job=abc'), '/documents_new?tab=question-papers&job=abc');
    for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', 'documents_new', '', null, undefined]) {
      assert.equal(safeInternalPath(bad as string | null | undefined), null, String(bad));
    }
  });
});

describe('unresolvedFields', () => {
  it('names what is missing, in a fixed order', () => {
    assert.deepEqual(unresolvedFields({ standard_id: null, subject_id: null, chapter_id: null }), ['standard', 'subject', 'chapter']);
    assert.deepEqual(unresolvedFields(noChapter), ['chapter']);
    assert.deepEqual(unresolvedFields(resolved), []);
  });
});

describe('pagesText', () => {
  it('shows N / total only when the total is known and invents nothing otherwise', () => {
    assert.equal(pagesText({ total_pages: 30, processed_pages: 12 }), '12 / 30 pages');
    assert.equal(pagesText({ total_pages: null, processed_pages: 4 }), '4 pages');
    assert.equal(pagesText({ total_pages: null, processed_pages: 0 }), null);
  });
});

describe('breakdownParts', () => {
  it('lists only the non-zero outcomes', () => {
    assert.deepEqual(breakdownParts({ saved_active: 3, saved_inactive: 0, unresolved: 2, duplicate: 1, skipped: 2, pending: 0 }), [
      '3 active',
      '2 waiting for standard or subject',
      '1 duplicates skipped',
      '2 failed',
    ]);
    assert.deepEqual(breakdownParts(null), []);
  });
});

describe('review gaps and activation', () => {
  it('explains each gap', () => {
    assert.deepEqual(reviewGaps(unkeyed, noChapter), ['Confirm the chapter for this question', 'The paper prints no answer key: choose the correct option']);
    assert.deepEqual(reviewGaps(keyed, resolved), []);
    assert.deepEqual(reviewGaps({ ...keyed, state: 'saved' }, noChapter), []);
  });

  it('offers only the extracted option labels for an unkeyed question', () => {
    assert.deepEqual(chooseableLabels(unkeyed), ['A', 'B']);
    assert.deepEqual(chooseableLabels(keyed), []);
  });

  it('is activatable only when nothing but a choosable answer key is missing', () => {
    assert.equal(activatable(keyed, undefined, resolved), true);
    assert.equal(activatable(keyed, undefined, noChapter), false, 'no chapter yet');
    assert.equal(activatable(unkeyed, undefined, resolved), false, 'answer not chosen');
    assert.equal(activatable(unkeyed, 'Z', resolved), false, 'not one of the extracted options');
    assert.equal(activatable(unkeyed, 'B', resolved), true);
    assert.equal(activatable(unkeyed, 'B', noChapter), false);
    assert.equal(activatable({ ...keyed, state: 'saved' }, undefined, resolved), false, 'already active');
    assert.equal(activatable({ ...keyed, chapter_id: 101 }, undefined, noChapter), true, 'a question-specific confirmed chapter resolves the chapter gap');
    assert.deepEqual(reviewGaps({ ...keyed, chapter_id: 101 }, noChapter), []);
  });

  it('counts a chapter chosen in the screen toward readiness, per question', () => {
    assert.equal(activatable(keyed, undefined, noChapter, 102), true, 'chosen in the dropdown');
    assert.equal(activatable(unkeyed, 'B', noChapter, 102), true);
    assert.equal(activatable(unkeyed, undefined, noChapter, 102), false, 'the answer key is still missing');
    assert.deepEqual(reviewGaps(keyed, noChapter, 102), []);
  });

  it('still needs a standard and subject for the whole paper, whatever the question chapter', () => {
    const noSubject = { standard_id: 42, subject_id: null, chapter_id: null };
    assert.equal(activatable({ ...keyed, chapter_id: 101 }, undefined, noSubject, 102), false);
    assert.deepEqual(reviewGaps({ ...keyed, chapter_id: 101 }, noSubject), ['Choose the subject for this paper']);
  });
});

describe('chapter wording', () => {
  it('never calls a suggestion assigned', () => {
    const auto = chapterSuggestionText({ chapter_name: 'Cell', confidence: 99, level: 'high', assigned: true });
    assert.match(auto, /assigned automatically/);
    assert.match(auto, /99%/);

    const close = chapterSuggestionText({ chapter_name: 'Motion', confidence: 73, level: 'close', assigned: false });
    assert.match(close, /suggestion only/);
    assert.match(close, /several chapters fit/);
    assert.doesNotMatch(close, /assigned/);

    assert.match(chapterSuggestionText({ chapter_name: 'X', confidence: 84, level: 'weak', assigned: false }), /few shared terms/);
  });

  it("says who chose a question's chapter", () => {
    assert.equal(chapterSourceText({ chapter_id: 102, chapter_source: 'auto' }), 'matched automatically');
    assert.equal(chapterSourceText({ chapter_id: 102, chapter_source: 'teacher' }), 'confirmed by a teacher');
    assert.equal(chapterSourceText({ chapter_id: 102, chapter_source: null }), 'paper-wide chapter');
    assert.equal(chapterSourceText({ chapter_id: null, chapter_source: null }), null);
  });
});

describe("queueHint", () => {
  it("says nothing for a paper that is not queued", () => {
    for (const status of ["processing", "retrying", "completed", "completed_with_warnings", "failed"]) {
      assert.equal(queueHint({ status, queued_seconds: 9999, worker_state: "not_detected" }), null, status);
    }
  });

  it("names the missing worker and what to run, immediately, when the heartbeat is absent", () => {
    const hint = queueHint({ status: "queued", queued_seconds: 5, worker_state: "not_detected" });
    assert.match(hint ?? "", /worker is not running/);
    assert.match(hint ?? "", /dev-question-papers.ps1/);
  });

  it("explains the inline queue driver", () => {
    assert.match(queueHint({ status: "queued", worker_state: "inline" }) ?? "", /sync/);
  });

  it("stays quiet while a live worker has had the paper only a short time", () => {
    assert.equal(queueHint({ status: "queued", queued_seconds: 20, worker_state: "active" }), null);
    assert.equal(queueHint({ status: "queued", queued_seconds: STALLED_QUEUE_SECONDS - 1, worker_state: "busy" }), null);
  });

  it("says the worker is busy, not missing, when it is alive but the paper waits", () => {
    const hint = queueHint({ status: "queued", queued_seconds: STALLED_QUEUE_SECONDS, worker_state: "busy" });
    assert.match(hint ?? "", /worker is running/);
    assert.doesNotMatch(hint ?? "", /not running/);
  });

  it("falls back to the time-based hint, and says nothing false, when the server cannot tell", () => {
    assert.equal(queueHint({ status: "queued", queued_seconds: 30, worker_state: null }), null);
    assert.match(queueHint({ status: "queued", queued_seconds: 600, worker_state: undefined }) ?? "", /waiting for several minutes/);
  });
});
