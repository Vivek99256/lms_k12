import assert from 'node:assert/strict';
import test from 'node:test';

import type { CpOptions, CpWorkflowFormat } from './api';
import { formatAfterMethodChange, formatOptions, usesWorkflow } from './workflow';

const fmt = (key: string, available: boolean): CpWorkflowFormat => ({ key, name: key, description: '', available, unavailable_reason: available ? null : 'none' });

const base: CpOptions = {
  chapter: { id: 1, name: 'c' },
  suitability: {},
  pedagogies: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
  formats: [{ key: 'slides', label: 'Slides', generator_exists: true }, { key: 'video', label: 'Video', generator_exists: false }],
  pedagogy_note: '',
};
const pilot: CpOptions = {
  ...base,
  workflow: { enabled: true, formats_by_method: { a: [fmt('slides', true), fmt('video', false)], b: [fmt('story', true)] } },
};

test('a chapter without the workflow keeps the unfiltered list', () => {
  assert.equal(usesWorkflow(base), false);
  assert.deepEqual(formatOptions(base, 'a').map((f) => f.key), ['slides', 'video']);
  assert.equal(formatOptions(base, null).length, 2);
  assert.equal(formatAfterMethodChange(base, 'b', 'video'), 'video');
});

test('the pilot lists only formats compatible with the method and marks generatorless ones unselectable', () => {
  assert.deepEqual(formatOptions(pilot, 'a').map((f) => [f.key, f.selectable]), [['slides', true], ['video', false]]);
  assert.deepEqual(formatOptions(pilot, 'b').map((f) => f.key), ['story']);
  assert.deepEqual(formatOptions(pilot, null), []);
});

test('changing the method resets a format that is no longer compatible or has no generator', () => {
  assert.equal(formatAfterMethodChange(pilot, 'a', 'slides'), 'slides');
  assert.equal(formatAfterMethodChange(pilot, 'b', 'slides'), null);
  assert.equal(formatAfterMethodChange(pilot, 'a', 'video'), null);
  assert.equal(formatAfterMethodChange(pilot, 'a', null), null);
});
