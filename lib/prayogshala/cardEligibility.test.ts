import test from 'node:test';
import assert from 'node:assert/strict';

import { isEligiblePrayogshalaCard } from './cardEligibility';

const lab = { version: 1, simulation: { type: 'sequence', params: {} } };
const generated = (over: Record<string, unknown> = {}) => ({
  prayogshala: { chapter_id: 8592, lab_config: lab, generation_status: 'ready', ...over },
});

test('an activity of the selected chapter with a lab is eligible (id as number or string)', () => {
  assert.equal(isEligiblePrayogshalaCard(generated(), 8592), true);
  assert.equal(isEligiblePrayogshalaCard(generated(), '8592'), true);
  assert.equal(isEligiblePrayogshalaCard(generated({ chapter_id: '8592' }), 8592), true);
});

test('an activity of a different chapter is rejected', () => {
  assert.equal(isEligiblePrayogshalaCard(generated(), 8593), false);
  assert.equal(isEligiblePrayogshalaCard(generated({ chapter_id: 8593 }), 8592), false);
});

test('an activity without a valid chapter_id is rejected', () => {
  for (const chapter_id of [undefined, null, '', 0, -3, 'abc', 8592.5, Number.NaN]) {
    assert.equal(isEligiblePrayogshalaCard(generated({ chapter_id }), 8592), false, String(chapter_id));
  }
  assert.equal(isEligiblePrayogshalaCard(generated(), 'not-a-number'), false, 'an invalid selected chapter matches nothing');
});

test('generated content without a usable lab is rejected', () => {
  assert.equal(isEligiblePrayogshalaCard(generated({ lab_config: null }), 8592), false);
  assert.equal(isEligiblePrayogshalaCard(generated({ lab_config: undefined }), 8592), false);
});

test('failed, generating and needs-content placeholders are never cards - even if a lab were attached', () => {
  for (const generation_status of ['failed', 'generating', 'needs_content']) {
    assert.equal(isEligiblePrayogshalaCard(generated({ generation_status, lab_config: null }), 8592), false, generation_status);
    assert.equal(isEligiblePrayogshalaCard(generated({ generation_status }), 8592), false, `${generation_status} with lab`);
  }
  assert.equal(isEligiblePrayogshalaCard(generated({ generation_status: 'something_new' }), 8592), false, 'unknown state is not trusted');
});

test('a hand-written document activity (no generation record) stays eligible without a lab', () => {
  assert.equal(isEligiblePrayogshalaCard({ prayogshala: { chapter_id: 8592, lab_config: null, generation_status: null } }, 8592), true);
  assert.equal(isEligiblePrayogshalaCard({ prayogshala: { chapter_id: 8593, lab_config: null, generation_status: null } }, 8592), false);
});

test('other resource types are not touched by the check', () => {
  assert.equal(isEligiblePrayogshalaCard({}, 8592), true);
  assert.equal(isEligiblePrayogshalaCard({ prayogshala: null }, 8592), true);
  assert.equal(isEligiblePrayogshalaCard({ prayogshala: undefined }, 'anything'), true);
});

// ------------------------------------------------- the page-level call, and other resource types

import { filterCardAssets, type ContentAssetLike } from './cardEligibility';

test('filterCardAssets leaves every non-Prayogshala resource exactly as it was: same objects, same order', () => {
  // Fields that look like Prayogshala ones sit at the top level of ordinary assets on purpose:
  // only the nested `prayogshala` payload may influence the decision.
  const others = [
    { id: 1, title: 'Deck', content_category: 'Classroom Presentation', chapter_id: 999, generation_status: 'failed', lab_config: null },
    { id: 2, title: 'Notes', content_category: 'Revision Notes', prayogshala: null },
    { id: 3, title: 'H5P', content_category: 'H5P Interactive', prayogshala: undefined, chapter_id: 0 },
    { id: 4, title: 'Remedial', content_category: 'Remedial Class' },
  ];

  const kept = filterCardAssets(others, 8592);

  assert.equal(kept.length, others.length);
  kept.forEach((asset, i) => assert.equal(asset, others[i], `item ${i} is the same object`));
  assert.deepEqual(filterCardAssets(others, 1), others, 'the selected chapter does not matter to other types');
});

test('in a mixed category only invalid Prayogshala items are dropped, and the rest keep their order', () => {
  const deck = { id: 'deck' };
  const mine = { id: 'mine', ...generated() };
  const foreign = { id: 'foreign', ...generated({ chapter_id: 8593 }) };
  const failed = { id: 'failed', ...generated({ generation_status: 'failed', lab_config: null }) };
  const doc = { id: 'doc', prayogshala: { chapter_id: 8592, lab_config: null, generation_status: null } };

  const category: Array<{ id: string } & ContentAssetLike> = [deck, foreign, mine, failed, doc];
  assert.deepEqual(filterCardAssets(category, 8592).map((a) => a.id), ['deck', 'mine', 'doc']);
});

test('filterCardAssets tolerates a missing category', () => {
  assert.deepEqual(filterCardAssets(undefined, 8592), []);
  assert.deepEqual(filterCardAssets(null, 8592), []);
});

test('placeholders stay out even when marked published, and a published flag is not what is read', () => {
  const placeholder = { prayogshala: { chapter_id: 8592, lab_config: lab, generation_status: 'needs_content', status: 'published', show_hide: 1 } };
  assert.deepEqual(filterCardAssets([placeholder], 8592), []);
});
