import assert from 'node:assert/strict';
import test from 'node:test';

import { isIndividualFlashcard, showsInLane } from './classroomResources';

const items = [
  { title: 'glacier', type: 'Flash cards' },
  { title: 'aquifer', type: 'Flash cards' },
  { title: 'Water vocabulary class', type: 'Vocabulary cards' },
  { title: 'Water presentation', type: 'Classroom presentation' },
  { title: 'Water video', type: 'Video' },
  { title: 'Water notes', type: 'Revision notes' },
  { title: 'Water activity', type: 'Classroom activity' },
  { title: 'Water remedial', type: 'Remedial class' },
  { title: 'Water worksheet', type: 'Worksheet' },
  { title: 'Chapter 1: poster SS1, Global Water Resources', type: 'Educational Posters' },
];

test('individual flashcards are excluded from the classroom lane', () => {
  const shown = items.filter((i) => showsInLane(i, 'classroom')).map((i) => i.title);
  assert.ok(!shown.includes('glacier'));
  assert.ok(!shown.includes('aquifer'));
  assert.equal(shown.length, items.length - 2);
});

test('the complete vocabulary deck and unrelated resources stay visible', () => {
  const shown = items.filter((i) => showsInLane(i, 'classroom')).map((i) => i.type);
  for (const type of ['Vocabulary cards', 'Classroom presentation', 'Video', 'Revision notes', 'Classroom activity', 'Remedial class', 'Worksheet', 'Educational Posters']) {
    assert.ok(shown.includes(type), type);
  }
});

test('the filter is by type, not by title, and does not touch the teacher lane', () => {
  assert.equal(isIndividualFlashcard({ type: 'Vocabulary cards' }), false);
  assert.equal(showsInLane({ type: 'Flash cards' }, 'teacher'), true);
});
