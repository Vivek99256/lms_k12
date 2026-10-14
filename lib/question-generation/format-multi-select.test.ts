import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { FormatMultiSelect } from '../../app/course-master/[courseId]/chapters/FormatMultiSelect';
import { toFormatCards, type GeneratableFormat } from './generatable-formats';

/**
 * The only render-level check of the Generate AI questions format picker (this repo
 * has no DOM harness, so clicking through the popup is not covered -- the selection
 * LOGIC is, in generatable-formats.test.ts). It renders on the server and checks that
 * the field shows what the backend's formats say, as removable chips.
 */

const FORMATS: GeneratableFormat[] = [
  { code: 'mcq', label: 'Multiple Choice', lms_question_type_id: 1, default_marks: 1, marks_editable: false, min_marks: 1, max_marks: 1, allowed_bloom_levels: ['Remember'] },
  { code: 'fill_blank', label: 'Fill in the Blank', lms_question_type_id: 2, default_marks: 1, marks_editable: false, min_marks: 1, max_marks: 1, allowed_bloom_levels: ['Remember'] },
  { code: 'numerical', label: 'Numerical Response', lms_question_type_id: 2, default_marks: 2, marks_editable: true, min_marks: 1, max_marks: 3, allowed_bloom_levels: ['Apply'] },
];

function render(value: string[]) {
  return renderToString(
    createElement(FormatMultiSelect, { cards: toFormatCards(FORMATS), value, onChange: () => undefined })
  );
}

test('each selected format shows as a chip with its own remove control', () => {
  const html = render(['mcq', 'numerical']);

  assert.match(html, /Multiple Choice/);
  assert.match(html, /Numerical Response/);
  assert.match(html, /Remove Multiple Choice/);
  assert.match(html, /Remove Numerical Response/);
  assert.doesNotMatch(html, /Remove Fill in the Blank/, 'an unselected format has no chip');
});

test('a selection offers "clear all"; an empty one shows the placeholder instead', () => {
  const some = render(['fill_blank']);
  assert.match(some, /Clear all formats/);
  assert.doesNotMatch(some, /Select question format\(s\)/);

  const none = render([]);
  assert.match(none, /Select question format\(s\)/);
  assert.doesNotMatch(none, /Clear all formats/);
});

test('the field is labelled for assistive technology', () => {
  assert.match(render([]), /aria-label="Question formats"/);
});

test('a code the backend does not list still renders, by its code, rather than crashing', () => {
  const html = render(['retired_form']);

  assert.match(html, /retired_form/);
});
