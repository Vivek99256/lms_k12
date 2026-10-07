import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DragDropActivity } from '@/app/h5p/h5p_drag_drop/components/drag-drop-activity';
import { mapQuestionToPlayerPayload } from './question-bank-runtime';
import type { BankQuestion } from './question-bank-h5p-map';

const FIXTURE = JSON.parse(
  readFileSync(path.join(process.cwd(), 'lib/h5p/fixtures/generated-questions.json'), 'utf8')
) as Record<string, BankQuestion>;

test('the canvas draws the picture, the zones at their stored percentages and the labels in the tray', () => {
  const built = mapQuestionToPlayerPayload(FIXTURE.drag_drop, { standard_id: 8, subject_id: 3, chapter_id: 11 }, undefined, [], 'drag_drop');
  assert.equal(built.ok, true);
  if (!built.activity || built.activity.kind !== 'drag_drop') throw new Error('not a drag_drop activity');

  const html = renderToStaticMarkup(createElement(DragDropActivity, { item: built.activity.item }));

  assert.match(html, /src="https:\/\/cdn\.test\/dragdrop_gen_fixture\.jpg"/);
  assert.match(html, /aspect-ratio:1200 \/ 800/);
  assert.match(html, /left:20%;top:10%;width:20%;height:20%/, 'the first zone sits where it was stored');
  assert.equal((html.match(/data-h5p-drop-target="zone:/g) ?? []).length, 4);
  // All four labels start in the tray, once each.
  for (const label of ['Nucleus', 'Cell membrane', 'Mitochondrion', 'Cytoplasm']) {
    assert.equal((html.match(new RegExp(`>${label}<`, 'g')) ?? []).length, 1, `${label} should be in the tray exactly once`);
  }
  assert.match(html, /Picture: &quot;Animal cell&quot; by A\. Person/);
});

test('nothing on the picture names a zone before the learner has answered', () => {
  const built = mapQuestionToPlayerPayload(FIXTURE.drag_drop, { standard_id: 8, subject_id: 3, chapter_id: 11 }, undefined, [], 'drag_drop');
  if (!built.activity || built.activity.kind !== 'drag_drop') throw new Error('not a drag_drop activity');

  const html = renderToStaticMarkup(createElement(DragDropActivity, { item: built.activity.item }));
  const canvas = html.slice(html.indexOf('data-h5p-drop-target="zone:'));

  // Inside the zones there is no label text yet: the tray is the only place the names are.
  for (const label of ['Nucleus', 'Cell membrane', 'Mitochondrion', 'Cytoplasm']) {
    assert.doesNotMatch(canvas, new RegExp(`>${label}<`), `${label} is visible on a zone`);
  }
});
