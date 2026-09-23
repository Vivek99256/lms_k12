import test from 'node:test';
import assert from 'node:assert/strict';

import { splitSectionsByContent } from './sections';

const section = (title: string, questionCount: number) => ({
  title,
  questions: Array.from({ length: questionCount }, (_, index) => index),
});

const titles = (rows: Array<{ title: string }>) => rows.map((row) => row.title);

test('prints every section when all of them matched questions', () => {
  const { printable, empty } = splitSectionsByContent([
    section('SECTION A', 8),
    section('SECTION B', 4),
    section('SECTION C', 2),
  ]);

  assert.deepEqual(titles(printable), ['SECTION A', 'SECTION B', 'SECTION C']);
  assert.deepEqual(titles(empty), []);
});

test('drops a section in the middle that matched nothing', () => {
  const { printable, empty } = splitSectionsByContent([
    section('SECTION A', 8),
    section('SECTION B', 0),
    section('SECTION C', 2),
  ]);

  assert.deepEqual(titles(printable), ['SECTION A', 'SECTION C']);
  assert.deepEqual(titles(empty), ['SECTION B']);
});

test('prints only Section A when the exam has nothing else', () => {
  const { printable, empty } = splitSectionsByContent([
    section('SECTION A', 10),
    section('SECTION B', 0),
    section('SECTION C', 0),
  ]);

  assert.deepEqual(titles(printable), ['SECTION A']);
  assert.deepEqual(titles(empty), ['SECTION B', 'SECTION C']);
});

test('keeps blueprint order rather than regrouping', () => {
  const { printable } = splitSectionsByContent([
    section('SECTION A', 0),
    section('SECTION B', 3),
    section('SECTION C', 0),
    section('SECTION D', 1),
  ]);

  assert.deepEqual(titles(printable), ['SECTION B', 'SECTION D']);
});

test('prints nothing when no section matched a question', () => {
  const { printable, empty } = splitSectionsByContent([section('A', 0), section('B', 0)]);

  assert.deepEqual(titles(printable), []);
  assert.deepEqual(titles(empty), ['A', 'B']);
});

test('survives an absent or malformed section list', () => {
  assert.deepEqual(splitSectionsByContent([]), { printable: [], empty: [] });
  assert.deepEqual(
    splitSectionsByContent(undefined as unknown as Array<{ questions: unknown[] }>),
    { printable: [], empty: [] }
  );
  assert.deepEqual(
    splitSectionsByContent([null as unknown as { questions: unknown[] }, section('A', 1)]).printable
      .length,
    1
  );
});
