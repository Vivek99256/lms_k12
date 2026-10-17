import assert from 'node:assert/strict';
import test from 'node:test';

import { cedsEnabledFor, cedsNotAvailableMessage, CEDS_ENABLED_CHAPTER_IDS, CEDS_SCOPE_LABEL } from './scope';
import { formatCodeFor } from './open';

test('the planner is switched on for exactly one chapter: Std 9 Science, Chapter 1', () => {
  assert.deepEqual([...CEDS_ENABLED_CHAPTER_IDS], [8592]);
  assert.equal(CEDS_SCOPE_LABEL, 'Std 9 Science, Chapter 1');
  assert.equal(cedsEnabledFor(8592), true);
  assert.equal(cedsEnabledFor('8592'), true, 'ids arrive as strings in the content list');
});

test('every other chapter, and anything that is not a chapter id, is not enabled', () => {
  for (const other of [8593, 8591, 1, 0, -8592, 85920, 8592.5, 'abc', '', null, undefined, NaN]) {
    assert.equal(cedsEnabledFor(other as never), false, String(other));
  }
});

test('the refusal says where it is available', () => {
  assert.equal(cedsNotAvailableMessage(), 'The teaching-method planner is available only for Std 9 Science, Chapter 1.');
});

test('the Open gate needs both: a CEDS format card AND the enabled chapter', () => {
  const gate = (type: string, chapter: number) => formatCodeFor(type) !== null && cedsEnabledFor(chapter);
  assert.equal(gate('Classroom presentation', 8592), true);
  assert.equal(gate('Revision notes', 8592), true);
  assert.equal(gate('Classroom presentation', 8593), false, 'another chapter opens directly');
  assert.equal(gate('Video', 8592), false, 'a card that is not a CEDS format opens directly');
});
