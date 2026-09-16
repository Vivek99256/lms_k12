import test from 'node:test';
import assert from 'node:assert/strict';

import { optionColumnCount, SHORT_OPTION_LENGTH } from './options';

const opts = (...texts: string[]) => texts.map((text) => ({ text }));

test('sets four short options in two columns', () => {
  assert.equal(optionColumnCount(opts('Pancreas', 'Thyroid', 'Adrenal', 'Liver')), 2);
});

test('drops to one column as soon as any option is long', () => {
  assert.equal(
    optionColumnCount(
      opts(
        'Pancreas',
        'Thyroid',
        'A learner depends on a teacher for every task and cannot begin alone',
        'Liver'
      )
    ),
    1
  );
});

test('keeps a true/false pair on its own lines', () => {
  assert.equal(optionColumnCount(opts('True', 'False')), 1);
});

test('measures the visible text, not the markup', () => {
  const short = `<strong>${'a'.repeat(SHORT_OPTION_LENGTH)}</strong>`;
  const long = `<em>${'a'.repeat(SHORT_OPTION_LENGTH + 1)}</em>`;

  assert.equal(optionColumnCount(opts(short, short, short, short)), 2, 'tags must not count');
  assert.equal(optionColumnCount(opts(short, short, short, long)), 1, 'one over the limit is enough');
});

test('collapses entities and runs of whitespace before measuring', () => {
  assert.equal(optionColumnCount(opts('&nbsp;Pancreas', 'Thyroid  ', '\n Adrenal', 'Liver')), 2);
});

test('survives a missing or malformed option list', () => {
  assert.equal(optionColumnCount([]), 1);
  assert.equal(optionColumnCount(null), 1);
  assert.equal(optionColumnCount(undefined), 1);
  assert.equal(
    optionColumnCount([{ text: 'a' }, { text: 'b' }, { text: 'c' }, null as unknown as { text: string }]),
    1
  );
});
