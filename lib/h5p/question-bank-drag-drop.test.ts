import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { mapQuestionToPlayerPayload } from './question-bank-runtime';
import {
  convertibilityAs,
  mappingForQuestion,
  playsAs,
  readDragDrop,
  targetsForQuestion,
  type BankQuestion,
  type DragDropData,
} from './question-bank-h5p-map';
import { dragDropSolution, scoreDragDropAttempt } from './drag-drop-scoring';

/**
 * Image-based Drag & Drop rows, run through the real projection and the real scoring.
 *
 * The row is the backend's own: H5pContractFixtureTest produces it from the actual
 * format and producer classes (picture and vision answer fixed), so a change to what the
 * generator stores fails there first and here second.
 */

const FIXTURE = JSON.parse(
  readFileSync(path.join(process.cwd(), 'lib/h5p/fixtures/generated-questions.json'), 'utf8')
) as Record<string, BankQuestion>;

const SCOPE = { standard_id: 8, subject_id: 3, chapter_id: 11 };

function row(): BankQuestion {
  return JSON.parse(JSON.stringify(FIXTURE.drag_drop)) as BankQuestion;
}

function withData(change: (data: DragDropData) => void): BankQuestion {
  const question = row();
  change(question.drag_drop as DragDropData);
  return question;
}

function build(question: BankQuestion) {
  const result = mapQuestionToPlayerPayload(question, SCOPE, undefined, [], 'drag_drop');
  assert.equal(result.ok, true, result.ok ? '' : result.reason);
  assert.equal(result.activity?.kind, 'drag_drop');
  return result.activity as Extract<NonNullable<typeof result.activity>, { kind: 'drag_drop' }>;
}

test('a generated drag-and-drop row is recognised as that form and offered to the drag-and-drop player', () => {
  const question = row();

  assert.equal(question.question_type_code, 'drag_drop');
  assert.equal(mappingForQuestion(question)?.target?.kind, 'drag_drop');
  assert.equal(mappingForQuestion(question)?.target?.library, 'H5P.DragQuestion');
  assert.equal(playsAs(question, 'drag_drop'), true);
  assert.deepEqual(targetsForQuestion(question).map((target) => target.kind), ['drag_drop']);
});

test('the stored picture, zones and key come through in the shape the existing player and scoring read', () => {
  const { item } = build(row());

  assert.equal(item.background_image, 'https://cdn.test/dragdrop_gen_fixture.jpg');
  assert.equal(item.canvas_width, 1200);
  assert.equal(item.canvas_height, 800);
  assert.equal(item.image_fit, 'contain');
  assert.equal(item.zones.length, 4);
  assert.equal(item.elements.length, 4);

  // Percent of the picture, unchanged: the manual editor's own convention.
  assert.deepEqual(
    { x: item.zones[0].position_x, y: item.zones[0].position_y, w: item.zones[0].width, h: item.zones[0].height },
    { x: 20, y: 10, w: 20, h: 20 }
  );
  assert.equal(item.zones[0].label, 'Nucleus');
  assert.deepEqual(item.zones[0].correct_element_ids, [item.elements[0].id]);
  assert.equal(item.elements[0].text, 'Nucleus');

  assert.match(item.attribution ?? '', /A\. Person/);
});

test('the zones are never labelled on the picture, and a label may be dropped anywhere', () => {
  const { item } = build(row());

  for (const zone of item.zones) {
    assert.equal(zone.show_label, false, 'the zone name is the answer');
    assert.equal(zone.single, true);
  }
  // The manual player refuses a drop outside an element's list; an empty list means
  // "anywhere", so a wrong drop is a wrong answer and not an impossible move.
  for (const element of item.elements) {
    assert.deepEqual(element.drop_zone_ids, []);
  }
});

test('placing every label where it belongs scores full marks; swapping two does not', () => {
  const { item } = build(row());

  const perfect = dragDropSolution(item);
  const full = scoreDragDropAttempt(item, perfect);
  assert.equal(full.score, 4);
  assert.equal(full.maxScore, 4);
  assert.equal(full.passed, true);

  const [a, b] = [item.elements[0].id, item.elements[1].id];
  const swapped = { ...perfect, [a]: perfect[b], [b]: perfect[a] };
  const bad = scoreDragDropAttempt(item, swapped);
  assert.equal(bad.correct, 2);
  assert.equal(bad.incorrect, 2);
  assert.equal(bad.passed, false);
  assert.equal(bad.perElement[a], false);

  assert.equal(scoreDragDropAttempt(item, {}).score, 0);
  assert.equal(full.scoreable, true);
});

test('every id is numeric, unique and consistent between zones and labels', () => {
  const { item } = build(row());

  const zoneIds = item.zones.map((zone) => zone.id);
  const elementIds = item.elements.map((element) => element.id);
  assert.equal(new Set(zoneIds).size, zoneIds.length);
  assert.equal(new Set(elementIds).size, elementIds.length);
  for (const zone of item.zones) {
    for (const id of zone.correct_element_ids) assert.ok(elementIds.includes(id));
  }
});

const BROKEN: Array<[string, (data: DragDropData) => void]> = [
  ['a zone off the picture', (d) => { d.zones[0].x = 95; }],
  ['a zone with a negative position', (d) => { d.zones[0].y = -2; }],
  ['a zone too small to drop on', (d) => { d.zones[0].width = 1; }],
  ['a zone covering most of the picture', (d) => { d.zones[0].height = 90; }],
  ['two zones on top of each other', (d) => { d.zones[1].x = d.zones[0].x + 1; d.zones[1].y = d.zones[0].y + 1; }],
  ['a duplicated zone id', (d) => { d.zones[1].id = d.zones[0].id; }],
  ['a duplicated zone label', (d) => { d.zones[1].label = d.zones[0].label.toUpperCase(); }],
  ['too few zones', (d) => { d.zones.splice(2); d.elements.splice(2); }],
  ['a label mapped to a zone that does not exist', (d) => { d.elements[0].zone_ids = ['z99']; }],
  ['a label that maps to nothing', (d) => { d.elements[0].zone_ids = []; }],
  ['a zone no label belongs to', (d) => { d.elements[3].zone_ids = ['z1']; }],
  ['a duplicated label id', (d) => { d.elements[1].id = d.elements[0].id; }],
  ['a picture too small to use', (d) => { d.image.width_px = 200; }],
  ['a picture with no address', (d) => { d.image.url = 'not-a-url'; }],
];

for (const [name, change] of BROKEN) {
  test(`a payload with ${name} is unplayable everywhere, not drawn wrongly`, () => {
    const question = withData(change);

    assert.equal(readDragDrop(question.drag_drop), null);
    assert.equal(convertibilityAs(question, 'drag_drop').ok, false);
    assert.equal(playsAs(question, 'drag_drop'), false);
    assert.deepEqual(targetsForQuestion(question), []);

    const result = mapQuestionToPlayerPayload(question, SCOPE, undefined, [], 'drag_drop');
    assert.equal(result.ok, false);
    assert.ok(result.reason);
  });
}

test('a drag-and-drop row with no payload at all is refused with a reason', () => {
  const question = row();
  question.drag_drop = null;

  const result = mapQuestionToPlayerPayload(question, SCOPE);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? '', /picture|zones/i);
});

test('rows of other forms are unaffected: none of them is offered drag and drop', () => {
  for (const [code, fixtureRow] of Object.entries(FIXTURE)) {
    if (code === 'drag_drop') continue;
    assert.equal(playsAs(fixtureRow, 'drag_drop'), false, `${code} should not play as drag and drop`);
  }
});

test('readDragDrop takes untyped input safely', () => {
  for (const bad of [undefined, null, 0, 'x', [], {}, { image: {}, zones: [], elements: [] }]) {
    assert.equal(readDragDrop(bad), null, JSON.stringify(bad));
  }
});
