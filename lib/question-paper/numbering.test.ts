import test from 'node:test';
import assert from 'node:assert/strict';

import { numberLabel, planSectionNumbers, toRoman } from './numbering';
import type { SectionNumbering } from './numbering';

const numbering = (overrides: Partial<SectionNumbering> = {}): SectionNumbering => ({
  prefix: 'Q.',
  style: 'decimal',
  start: 1,
  restart: false,
  groupAsParts: false,
  subStyle: 'upper-alpha',
  ...overrides,
});

/** The board-paper shape: one number per part, lettered inside. */
const part = (count: number, overrides: Partial<SectionNumbering> = {}) => ({
  numbering: numbering({ groupAsParts: true, ...overrides }),
  count,
});

const flat = (count: number, overrides: Partial<SectionNumbering> = {}) => ({
  numbering: numbering(overrides),
  count,
});

test('numbers questions straight through consecutive sections', () => {
  const plan = planSectionNumbers([flat(2), flat(3)]);

  assert.deepEqual(plan[0].labels, ['Q.1', 'Q.2']);
  assert.deepEqual(plan[1].labels, ['Q.3', 'Q.4', 'Q.5']);
  assert.deepEqual([plan[0].groupLabel, plan[1].groupLabel], ['', '']);
});

test('gives each part-numbered section one number and letters its parts', () => {
  const plan = planSectionNumbers([part(4), part(3), part(2)]);

  assert.deepEqual(
    plan.map((entry) => entry.groupLabel),
    ['Q.1', 'Q.2', 'Q.3']
  );
  assert.deepEqual(plan[0].labels, ['(A)', '(B)', '(C)', '(D)']);
  assert.deepEqual(plan[1].labels, ['(A)', '(B)', '(C)']);
});

test('a skipped middle section does not spend a number', () => {
  // PART A, no PART B, PART C -> the paper reads Q.1 then Q.2, with nothing
  // missing in between and no empty heading.
  const plan = planSectionNumbers([part(4), part(0), part(2)]);

  assert.deepEqual(
    plan.map((entry) => entry.groupLabel),
    ['Q.1', '', 'Q.2']
  );
  assert.deepEqual(plan[1].labels, []);
});

test('a skipped section never rewinds the count for the sections after it', () => {
  // The regression this guards: an empty section that restarts numbering used
  // to reset the running count to its own `start`, so PART C came back as Q.1.
  const plan = planSectionNumbers([
    flat(3),
    flat(0, { restart: true, start: 1 }),
    flat(2),
  ]);

  assert.deepEqual(plan[0].labels, ['Q.1', 'Q.2', 'Q.3']);
  assert.deepEqual(plan[1].labels, []);
  assert.deepEqual(plan[2].labels, ['Q.4', 'Q.5']);
});

test('honours a section that restarts its own numbering', () => {
  const plan = planSectionNumbers([flat(2), flat(2, { restart: true, start: 10 })]);

  assert.deepEqual(plan[1].labels, ['Q.10', 'Q.11']);
});

test('carries the chosen style and prefix', () => {
  const plan = planSectionNumbers([
    flat(3, { style: 'roman', prefix: '' }),
    part(2, { style: 'upper-alpha', prefix: '', subStyle: 'lower-alpha' }),
  ]);

  assert.deepEqual(plan[0].labels, ['I', 'II', 'III']);
  assert.equal(plan[1].groupLabel, 'D');
  assert.deepEqual(plan[1].labels, ['(a)', '(b)']);
});

test('part letters can be switched off entirely', () => {
  const plan = planSectionNumbers([part(2, { subStyle: 'none' })]);

  assert.equal(plan[0].groupLabel, 'Q.1');
  assert.deepEqual(plan[0].labels, ['', '']);
});

test('survives an absent or malformed section list', () => {
  assert.deepEqual(planSectionNumbers([]), []);
  assert.deepEqual(planSectionNumbers(undefined), []);
  assert.deepEqual(planSectionNumbers([{ numbering: numbering(), count: -3 }]), [
    { groupLabel: '', labels: [] },
  ]);
});

test('numbers and roman numerals read as a paper expects', () => {
  assert.equal(numberLabel(0, 1, 'decimal'), '1');
  assert.equal(numberLabel(2, 1, 'upper-alpha'), 'C');
  assert.equal(numberLabel(0, 4, 'lower-alpha'), 'd');
  assert.equal(numberLabel(0, 1, 'none'), '');
  assert.equal(toRoman(4), 'IV');
  assert.equal(toRoman(9), 'IX');
  assert.equal(toRoman(0), 'I');
});
