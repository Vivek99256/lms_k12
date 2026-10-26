import assert from 'node:assert/strict';
import test from 'node:test';

import { NOT_CONFIGURED_LABEL, resourceBadges, resourceKindOf, resourceTitle, viewTarget } from './resourceCard';

const ppt = {
  content_id: 70,
  teaching_method: 'inquiry_based',
  teaching_method_label: 'Inquiry-based learning',
  teaching_method_short: 'Inquiry-Based',
  content_format: 'interactive_slides',
  content_format_label: 'PPT / interactive slides',
  generation_status: 'stored',
  generation_run_id: 'r0123456789ab',
};
const story = { ...ppt, content_id: 71, content_format: 'branching_scenario', content_format_label: 'Interactive branching scenario', generation_run_id: 'rba9876543210' };

test('the PowerPoint and the branching scenario get the descriptive titles', () => {
  assert.equal(resourceTitle('Global Water Resources', ppt, 'Classroom Presentation'), 'Global Water Resources — Inquiry-Based PPT');
  assert.equal(resourceTitle('Global Water Resources', story, 'Classroom Presentation'), 'Global Water Resources — Inquiry-Based Branching Scenario');
});

test('the two stored cards differ in kind, format badge and ids, so they can be told apart unopened', () => {
  const a = resourceBadges(ppt);
  const b = resourceBadges(story);
  assert.equal(a.kind, 'powerpoint');
  assert.equal(b.kind, 'branching_scenario');
  assert.notEqual(a.format, b.format);
  assert.equal(a.method, 'Inquiry-based learning');
  assert.deepEqual([a.contentId, a.runId, a.status], [70, 'r0123456789ab', 'stored']);
  assert.deepEqual([b.contentId, b.runId], [71, 'rba9876543210']);
  assert.equal(a.missing, false);
});

test('missing metadata is reported, never guessed, and the stored title is kept', () => {
  const legacy = { content_id: 5, teaching_method: null, content_format: 'interactive_slides', content_format_label: 'PPT / interactive slides' };
  const badges = resourceBadges(legacy);
  assert.equal(badges.method, null);
  assert.equal(badges.missing, true);
  assert.equal(resourceTitle('Global Water Resources', legacy, 'Classroom Presentation'), 'Classroom Presentation');
  const nothing = resourceBadges({});
  assert.deepEqual([nothing.method, nothing.format, nothing.missing, nothing.kind], [null, null, true, 'other']);
  assert.equal(resourceKindOf({ content_format: 'something_else' }), 'other');
  assert.match(NOT_CONFIGURED_LABEL, /not configured/);
});

test('View opens only the link naming this item’s own content id', () => {
  assert.equal(viewTarget('/student/study-deck/41675?content=70', '70'), '/student/study-deck/41675?content=70');
  assert.equal(viewTarget('/student/study-deck/41675?content=71', '70'), null, 'a sibling of the same chapter');
  assert.equal(viewTarget('/student/study-deck/41675', '70'), null, 'no content id: would open the chapter default');
  assert.equal(viewTarget('/student/study-deck/41675?content=700', '70'), null);
  assert.equal(viewTarget(undefined, '70'), null);
});
