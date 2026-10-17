import assert from 'node:assert/strict';
import test from 'node:test';

import { componentLabel, fitLabel, missingSelection, openHref, statusLabel, toggleAll, type FormatRow, type ResourceItem } from './api';

const item = (over: Partial<ResourceItem>): ResourceItem => ({
  id: 1, source: 'content_master', title: 't', kind: 'study_document', scope: 'chapter', status: 'available', review_label: null, ...over,
});

const row = (format: string, status: FormatRow['status']): FormatRow => ({ format, label: format, status, items: [], hidden_ignored: 0, unavailable_ignored: 0 });

test('fit and status are named in words, and a lab in review is never called approved', () => {
  assert.equal(fitLabel('S'), 'Strong fit');
  assert.equal(fitLabel('P'), 'Possible fit');
  assert.equal(fitLabel('W'), 'Weak fit');
  assert.equal(fitLabel(undefined), '');
  assert.equal(statusLabel('pending_review'), 'Pending Review');
  assert.equal(statusLabel('missing'), 'Not created yet');
  assert.notEqual(statusLabel('pending_review').toLowerCase(), statusLabel('available').toLowerCase());
});

test('study decks and documents open in the existing viewer; labs and older rows get no link', () => {
  assert.equal(openHref(item({ id: 61401, kind: 'study_deck' }), 8592), '/student/study-deck/8592?content=61401');
  assert.equal(openHref(item({ id: 61402, kind: 'study_document' }), 8592), '/student/study-deck/8592?content=61402');
  assert.equal(openHref(item({ kind: 'legacy' }), 8592), null);
  assert.equal(openHref(item({ source: 'lms_prayogshala_activity', kind: 'prayogshala_lab', status: 'pending_review' }), 8592), null);
});

test('only formats with nothing stored count as missing, and only when ticked', () => {
  const formats = [row('D1', 'missing'), row('D2', 'available'), row('D3', 'available'), row('D4', 'pending_review'), row('D5', 'available'), row('D6', 'available')];
  assert.deepEqual(missingSelection(formats, ['D1', 'D2', 'D4']), ['D1']);
  assert.deepEqual(missingSelection(formats, ['D2', 'D4']), []);
});

test('select all six ticks every format, and ticking again clears them', () => {
  const formats = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'].map((f) => row(f, 'missing'));
  assert.deepEqual(toggleAll(formats, []), ['D1', 'D2', 'D3', 'D4', 'D5', 'D6']);
  assert.deepEqual(toggleAll(formats, ['D1', 'D2']), ['D1', 'D2', 'D3', 'D4', 'D5', 'D6']);
  assert.deepEqual(toggleAll(formats, ['D1', 'D2', 'D3', 'D4', 'D5', 'D6']), []);
});

test('Classroom Content can be partly available, and its rows are named for the existing resource they are', () => {
  assert.equal(statusLabel('partial'), 'Partly available');
  assert.equal(componentLabel('presentation'), 'Classroom Presentation');
  assert.equal(componentLabel('revision_notes'), 'Revision Notes');
  assert.equal(componentLabel(undefined), null);
});

test('a partly available format is not "missing", so it is never counted as something to generate', () => {
  const formats = [row('D1', 'partial'), row('D2', 'available')];
  assert.deepEqual(missingSelection(formats, ['D1', 'D2']), []);
});

test('a D1 row opens through the same link rule as the existing Presentation and Revision Notes', () => {
  assert.equal(openHref(item({ id: 61401, kind: 'study_deck', component: 'presentation' }), 8592), '/student/study-deck/8592?content=61401');
  assert.equal(openHref(item({ id: 61402, kind: 'study_document', component: 'revision_notes' }), 8592), '/student/study-deck/8592?content=61402');
});
