import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import type { ClassroomActivity, CompareBlock, ReportBlock, TableBlock } from './activity';
import { parseClassroomActivity, storageKey } from './activity';
import {
  blockStarted,
  cellKey,
  clearProgress,
  compareKey,
  derivedValue,
  emptyProgress,
  entityName,
  fillTokens,
  finish,
  go,
  loadProgress,
  nameKey,
  noteKey,
  numberOf,
  parseProgress,
  rankChanges,
  readStatus,
  reflectionKey,
  reportKey,
  reportSections,
  saveProgress,
  setValue,
  signed,
  statusFromStored,
  statusOf,
  summarise,
  summaryText,
  tableCounts,
  toggleStep,
  type KeyValueStore,
} from './progress';

const BUNDLES = join(process.cwd(), '..', 'next_lms_erp', 'content_bundles', 'classroom-activity');
const real = (file: string): unknown => JSON.parse(readFileSync(join(BUNDLES, file), 'utf8'));
const haveBundles = existsSync(join(BUNDLES, 'g4-water-a1.json'));

const memory = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};

function small(): ClassroomActivity {
  return parseClassroomActivity({
    type: 'classroom_activity',
    version: 1,
    key: 'k',
    code: 'X1',
    title: 'Small',
    scope: { sub_institute_id: 1, standard_id: 1, subject_id: 1, chapter_id: 1 },
    intro: { purpose: 'p', objectives: [{ text: 'o', origin: 'textbook' }], materials: [{ text: 'm', origin: 'task_card' }], safety: [] },
    steps: [
      { n: 1, id: 's1', text: 'One', uses: [{ block: 't', columns: ['a'] }] },
      { n: 2, id: 's2', text: 'Two' },
    ],
    blocks: [
      { id: 't', kind: 'table', title: 'T', rows: [{ id: 'r1', label: 'R1' }, { id: 'r2', label: 'R2' }], columns: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], derived: [{ id: 'd', label: 'D', of: 'b', minus: 'a' }] },
    ],
    reflection: [{ id: 'q', step: 2, prompt: 'Why?' }],
  });
}

test('the real A1 and B1 bundles are playable and keep the PDF steps', { skip: !haveBundles }, () => {
  const a1 = parseClassroomActivity(real('g4-water-a1.json'));
  const b1 = parseClassroomActivity(real('g4-water-b1.json'));

  assert.equal(a1.steps.length, 9);
  assert.equal(b1.steps.length, 11);
  assert.equal(a1.steps[3].text, 'Put the trays under a lamp or in sunlight for 15 minutes.');
  assert.equal(a1.steps[3].timer?.seconds, 900);
  assert.equal(a1.steps[6].timer?.seconds, 900);
  assert.equal(b1.steps[1].text, 'Search for both countries on your cards—one water-rich and one water-poor.');
  assert.deepEqual(b1.steps[5].items, ['Rainfall', 'Water sources (rivers, lakes, glaciers, coastlines)', 'Population', 'Climate (hot/dry, cool/wet, etc.)', 'Water availability']);
  assert.deepEqual(a1.steps.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('the worksheets carry no pre-filled results', { skip: !haveBundles }, () => {
  for (const file of ['g4-water-a1.json', 'g4-water-b1.json']) {
    const activity = parseClassroomActivity(real(file));
    assert.deepEqual(activity.reflection.filter((r) => 'answer' in r), []);
    assert.equal(JSON.stringify(activity).includes('"values"'), false);
  }
  const b1 = parseClassroomActivity(real('g4-water-b1.json'));
  assert.deepEqual(b1.reflection, [], 'the Reflection Questions are named by the card but not printed, so none are invented');
});

test('a document the player cannot rely on is refused', () => {
  const ok = JSON.parse(JSON.stringify(small()));
  assert.doesNotThrow(() => parseClassroomActivity(ok));

  const reorder = JSON.parse(JSON.stringify(ok));
  reorder.steps[1].n = 5;
  assert.throws(() => parseClassroomActivity(reorder), /out of order/);

  const dangling = JSON.parse(JSON.stringify(ok));
  dangling.steps[0].uses = [{ block: 'nope' }];
  assert.throws(() => parseClassroomActivity(dangling), /does not exist/);

  const column = JSON.parse(JSON.stringify(ok));
  column.steps[0].uses = [{ block: 't', columns: ['zzz'] }];
  assert.throws(() => parseClassroomActivity(column), /column/);

  const noObjective = JSON.parse(JSON.stringify(ok));
  noObjective.intro.objectives = [];
  assert.throws(() => parseClassroomActivity(noObjective), /objective/);

  assert.throws(() => parseClassroomActivity({ type: 'quiz' }), /not a classroom activity/);
  assert.throws(() => parseClassroomActivity(null), /not a classroom activity/);
});

test('numbers are read the way a learner types them, and nothing else is a number', () => {
  assert.equal(numberOf('12'), 12);
  assert.equal(numberOf(' 12.5 '), 12.5);
  assert.equal(numberOf('12,5'), 12.5);
  assert.equal(numberOf('-3'), -3);
  assert.equal(numberOf(''), null);
  assert.equal(numberOf('abc'), null);
  assert.equal(numberOf('12abc'), null);
  assert.equal(numberOf(undefined), null);
});

test('a change is worked out only from numbers the learner entered', () => {
  const a = small();
  const t = a.blocks[0] as TableBlock;
  let p = emptyProgress();
  assert.equal(derivedValue(t, 'd', 'r1', p.values), null, 'nothing entered, nothing worked out');

  p = setValue(p, cellKey('t', 'r1', 'a'), '26');
  assert.equal(derivedValue(t, 'd', 'r1', p.values), null, 'one number is not enough');

  p = setValue(p, cellKey('t', 'r1', 'b'), '38.5');
  assert.equal(derivedValue(t, 'd', 'r1', p.values), 12.5);
  p = setValue(p, cellKey('t', 'r1', 'b'), '20');
  assert.equal(derivedValue(t, 'd', 'r1', p.values), -6, 'a fall is negative');
  p = setValue(p, cellKey('t', 'r1', 'b'), 'hot');
  assert.equal(derivedValue(t, 'd', 'r1', p.values), null, 'a word is not a number');

  assert.equal(signed(12.5), '+12.5');
  assert.equal(signed(-6), '-6');
  assert.equal(signed(0), '0');
  assert.equal(derivedValue(t, 'd', 'r2', { [cellKey('t', 'r2', 'a')]: '0.1', [cellKey('t', 'r2', 'b')]: '0.3' }), 0.2, 'no floating point noise');
});

test('rows are ranked by how much they changed, from the learner\'s own numbers only', () => {
  const t = small().blocks[0] as TableBlock;
  const values = { [cellKey('t', 'r1', 'a')]: '20', [cellKey('t', 'r1', 'b')]: '25', [cellKey('t', 'r2', 'a')]: '20', [cellKey('t', 'r2', 'b')]: '35' };
  assert.deepEqual(rankChanges(t, 'd', values).map((r) => [r.row, r.change]), [['r2', 15], ['r1', 5]]);
  assert.deepEqual(rankChanges(t, 'd', {}), []);
  assert.deepEqual(tableCounts(t, values), { filled: 4, total: 4 });
  assert.deepEqual(tableCounts(t, { [cellKey('t', 'r1', 'a')]: '20', [cellKey('t', 'r1', 'b')]: 'x' }), { filled: 1, total: 4 });
});

test('a worksheet block counts as started only once something is written in it', () => {
  const a = small();
  const t = a.blocks[0] as TableBlock;
  assert.equal(blockStarted(t, {}), false);
  assert.equal(blockStarted(t, { [noteKey('other')]: 'x' }), false);
  assert.equal(blockStarted(t, { [cellKey('t', 'r1', 'a')]: '20' }), true);
  const notes = { id: 'n', kind: 'notes' as const, label: 'Notes' };
  assert.equal(blockStarted(notes, { [noteKey('n')]: 'x' }), true);
  assert.equal(blockStarted(notes, { [noteKey('nn')]: 'x' }), false, 'a block whose id merely starts the same is not it');
});

test('steps toggle, finishing records a time, and changing work afterwards reopens the activity', () => {
  let p = emptyProgress('2026-01-01T00:00:00.000Z');
  p = toggleStep(p, 's1');
  assert.deepEqual(p.stepsDone, ['s1']);
  p = toggleStep(p, 's1');
  assert.deepEqual(p.stepsDone, []);

  p = finish(p, '2026-01-02T00:00:00.000Z');
  assert.equal(p.completedAt, '2026-01-02T00:00:00.000Z');
  p = setValue(p, noteKey('x'), 'changed my mind');
  assert.equal(p.completedAt, null);
  p = finish(p);
  p = toggleStep(p, 's2');
  assert.equal(p.completedAt, null);

  const moved = go(emptyProgress(), 'steps', 1);
  assert.equal(moved.stage, 'steps');
  assert.equal(moved.stepIndex, 1);
});

test('an empty value removes the key instead of storing blank text', () => {
  const p = setValue(setValue(emptyProgress(), 'k', 'v'), 'k', '   ');
  assert.deepEqual(p.values, {});
});

test('saved work is made safe when read back: foreign keys, wrong types and bad steps are dropped', () => {
  const a = small();
  const raw = {
    version: 1,
    stage: 'steps',
    stepIndex: 99,
    stepsDone: ['s1', 'ghost', 7, 's1'],
    values: { [cellKey('t', 'r1', 'a')]: '21', 'ghost/cell/x/y': '5', [reflectionKey('q')]: 'because', [cellKey('t', 'r2', 'b')]: 42, [noteKey('t')]: 'not a notes block' },
    completedAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };
  const p = parseProgress(raw, a);

  assert.equal(p.stage, 'steps');
  assert.equal(p.stepIndex, 1, 'clamped to the last step');
  assert.deepEqual(p.stepsDone, ['s1']);
  assert.deepEqual(Object.keys(p.values).sort(), [cellKey('t', 'r1', 'a'), reflectionKey('q')].sort());
  assert.deepEqual(parseProgress('garbage', a), { ...emptyProgress(), updatedAt: parseProgress('garbage', a).updatedAt });
  assert.deepEqual(parseProgress({ version: 2 }, a).stepsDone, []);
});

test('progress is saved per learner and per activity, and a failing store never throws', () => {
  const a = small();
  const store = memory();
  const p = setValue(emptyProgress(), cellKey('t', 'r1', 'a'), '30');

  assert.equal(saveProgress(p, 61700, 5, store), true);
  assert.equal(loadProgress(a, 61700, 5, store).values[cellKey('t', 'r1', 'a')], '30');
  assert.deepEqual(loadProgress(a, 61700, 6, store).values, {}, 'another learner on the same device sees nothing');
  assert.deepEqual(loadProgress(a, 61701, 5, store).values, {}, 'another activity sees nothing');
  assert.ok(store.data.has(storageKey(61700, 5)));

  clearProgress(61700, 5, store);
  assert.deepEqual(loadProgress(a, 61700, 5, store).values, {});

  const broken: KeyValueStore = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); }, removeItem: () => { throw new Error('blocked'); } };
  assert.equal(saveProgress(p, 1, 1, broken), false, 'says it was not saved');
  assert.deepEqual(loadProgress(a, 1, 1, broken).values, {});
  assert.equal(saveProgress(p, 1, 1, null), false);
  assert.doesNotThrow(() => clearProgress(1, 1, broken));
  store.data.set(storageKey(9, 9), '{not json');
  assert.deepEqual(loadProgress(a, 9, 9, store).values, {});
});

test('the card status: not started, in progress, completed', () => {
  assert.deepEqual(statusFromStored(null, 9), { state: 'not_started', stepsDone: 0, totalSteps: 9 });
  assert.equal(statusFromStored('{broken', 9).state, 'not_started');

  const a = small();
  assert.equal(statusOf(a, emptyProgress()).state, 'not_started');
  assert.equal(statusOf(a, go(emptyProgress(), 'steps', 0)).state, 'in_progress');
  assert.deepEqual(statusOf(a, toggleStep(emptyProgress(), 's1')), { state: 'in_progress', stepsDone: 1, totalSteps: 2 });
  assert.equal(statusOf(a, finish(toggleStep(toggleStep(emptyProgress(), 's1'), 's2'))).state, 'completed');

  const store = memory();
  saveProgress(finish(emptyProgress()), 7, 3, store);
  assert.equal(readStatus(7, 3, 2, store).state, 'completed');
  assert.equal(readStatus(7, 4, 2, store).state, 'not_started');
  assert.equal(readStatus(7, 3, 2, null).state, 'not_started');
});

test('the review says what was recorded and what was not, and invents nothing', () => {
  const a = small();
  let p = toggleStep(emptyProgress(), 's1');
  p = setValue(p, cellKey('t', 'r1', 'a'), '20');
  p = setValue(p, cellKey('t', 'r1', 'b'), '29');
  const s = summarise(a, p);

  assert.equal(s.stepsDone, 1);
  assert.deepEqual(s.skipped, [2]);
  const text = summaryText(a, p);
  assert.match(text, /Steps done: 1 of 2/);
  assert.match(text, /Steps not marked done: 2/);
  assert.match(text, /R1 \| A: 20 \| B: 29 \| D: \+9/);
  assert.match(text, /R2 \| A: not recorded \| B: not recorded \| D: not worked out/);
  assert.match(text, /Why\?\nNot answered/);

  p = setValue(p, reflectionKey('q'), 'Water holds heat');
  assert.match(summaryText(a, p), /Why\?\nWater holds heat/);
});

test('a comparison uses the names the learner typed, and a report fills them into its title', { skip: !haveBundles }, () => {
  const b1 = parseClassroomActivity(real('g4-water-b1.json'));
  const countries = b1.blocks.find((b): b is CompareBlock => b.kind === 'compare')!;
  const report = b1.blocks.find((b): b is ReportBlock => b.kind === 'report')!;

  assert.equal(entityName(countries, 'a', {}), 'Country A');
  let p = setValue(emptyProgress(), nameKey(countries.id, 'a'), 'Canada');
  p = setValue(p, nameKey(countries.id, 'b'), '  Egypt ');
  assert.equal(entityName(countries, 'b', p.values), 'Egypt');
  assert.equal(fillTokens(report.title_template, report, countries, {}), 'Why Country A is Water-Rich and Country B is Water-Poor');
  assert.equal(fillTokens(report.title_template, report, countries, p.values), 'Why Canada is Water-Rich and Egypt is Water-Poor');
  assert.equal(fillTokens(report.sections[2].label, report, countries, p.values), 'One suggestion to help Egypt improve its water situation');
});

test('a report counts its entries against the card\'s 2-3 reasons and 1 suggestion', { skip: !haveBundles }, () => {
  const report = parseClassroomActivity(real('g4-water-b1.json')).blocks.find((b): b is ReportBlock => b.kind === 'report')!;
  const at = (section: string, i: number) => reportKey(report.id, section, i);

  let p = emptyProgress();
  let s = reportSections(report, p.values);
  assert.deepEqual(s.map((x) => [x.id, x.count, x.ok]), [['rich', 0, false], ['poor', 0, false], ['suggestion', 0, false]]);

  p = setValue(p, at('rich', 0), 'Many rivers');
  assert.equal(reportSections(report, p.values)[0].ok, false, 'one reason is not enough');
  p = setValue(p, at('rich', 1), 'Heavy rainfall');
  assert.equal(reportSections(report, p.values)[0].ok, true);
  p = setValue(p, at('suggestion', 0), 'Harvest rainwater');
  s = reportSections(report, p.values);
  assert.deepEqual([s[2].count, s[2].ok], [1, true]);

  // A second suggestion is not even a field: the card asks for exactly one.
  assert.equal(parseProgress({ ...p, values: { [at('suggestion', 1)]: 'x' } }, parseClassroomActivity(real('g4-water-b1.json'))).values[at('suggestion', 1)], 'x', 'kept if saved, but the form offers one field');
});

test('B1 review shows both countries side by side with what was typed', { skip: !haveBundles }, () => {
  const b1 = parseClassroomActivity(real('g4-water-b1.json'));
  const countries = b1.blocks.find((b): b is CompareBlock => b.kind === 'compare')!;
  let p = setValue(emptyProgress(), nameKey(countries.id, 'a'), 'Canada');
  p = setValue(p, compareKey(countries.id, 'rainfall', 'a'), 'High');

  const text = summaryText(b1, p);
  assert.match(text, /Country comparison: Canada and Country B/);
  assert.match(text, /Rainfall \| Canada: High \| Country B: not recorded/);
  assert.match(text, /Why Canada is Water-Rich and Country B is Water-Poor/);
});
