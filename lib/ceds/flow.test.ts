import assert from 'node:assert/strict';
import test from 'node:test';

import {
  flowQuery, linkLabel, minutesOf, parseMinutes, periodFrom, plannedTotal, resourceHref, resourceKindLabel, slideHref, teacherLedExplanation,
  TEACHER_LED_LABEL, topicLabel, type FlowPhase, type FlowResource, type FlowTopic,
} from './flow';

const base = { title: 't', status: 'available' as const, review_label: null, stored_minutes: null };

test('a slide link uses the viewer\'s existing slide parameter on the same stored deck', () => {
  assert.equal(slideHref(8592, 61401, 7), '/student/study-deck/8592?content=61401&slide=7');
  const slide: FlowResource = { ...base, type: 'slide', slide: 9, slide_type: 'worked_example', content_id: 61401, scope: 'topic' };
  assert.equal(resourceHref(slide, 8592), '/student/study-deck/8592?content=61401&slide=9');
  assert.equal(linkLabel(slide), 'Go to slide');
  assert.equal(resourceKindLabel(slide), 'Slide 9');
});

test('activities and revision notes open their stored document; labs get no link', () => {
  const act: FlowResource = { ...base, type: 'activity', section: 1, content_id: 61404, format: 'inquiry', grouping: 'pair' };
  assert.equal(resourceHref(act, 8592), '/student/study-deck/8592?content=61404');
  assert.equal(resourceHref({ ...act, content_id: null }, 8592), null, 'no id, no link');
  const notes: FlowResource = { ...base, type: 'notes', section: 4, content_id: 61402 };
  assert.equal(resourceHref(notes, 8592), '/student/study-deck/8592?content=61402');
  const lab: FlowResource = { ...base, type: 'lab', id: 1, status: 'pending_review', review_label: 'Pending Review' };
  assert.equal(resourceHref(lab, 8592), null);
  assert.equal(resourceKindLabel(lab), 'Prayogshala lab');
});

test('practice questions link to the first slide that carries one', () => {
  const q: FlowResource = { ...base, type: 'questions', question_ids: [1, 2], on_slides: [7, 9], content_id: 61401 };
  assert.equal(resourceHref(q, 8592), '/student/study-deck/8592?content=61401&slide=7');
  assert.equal(resourceHref({ ...q, on_slides: [] }, 8592), null);
});

test('the teacher-led label and its reasons are fixed words', () => {
  assert.equal(TEACHER_LED_LABEL, 'Teacher-led, nothing stored');
  assert.match(teacherLedExplanation('no_stored_equivalent'), /No stored resource corresponds/);
  assert.match(teacherLedExplanation('none_found'), /verifiably linked/);
  assert.match(teacherLedExplanation('resource_unreadable'), /could not be read/);
  assert.equal(teacherLedExplanation(null), '');
});

test('the query carries only what the teacher chose', () => {
  assert.equal(flowQuery({ chapterId: 8592 }), 'chapter_id=8592');
  assert.equal(flowQuery({ chapterId: 8592, pedagogy: 'P2', topicId: 23810, period: 40 }), 'chapter_id=8592&pedagogy=P2&topic_id=23810&period=40');
  const q = flowQuery({ chapterId: 1, pedagogy: 'P2', topicId: 2, minutes: [4, 12, 10] });
  assert.deepEqual(new URLSearchParams(q).getAll('minutes[]'), ['4', '12', '10']);
  assert.equal(q.includes('sub_institute_id'), false, 'the school is never sent');
});

test('minutes and period fields accept whole numbers in range only', () => {
  assert.equal(parseMinutes('12'), 12);
  assert.equal(parseMinutes(' 0 '), 0);
  for (const bad of ['', '-1', '1.5', 'abc', '1000', '121']) assert.equal(parseMinutes(bad), null, bad);
  assert.equal(periodFrom('40'), 40);
  assert.equal(periodFrom('9'), null);
  assert.equal(periodFrom('121'), null);
});

test('planned minutes add up from the phases', () => {
  const phases = [4, 12, 10, 8, 6].map((minutes, i) => ({ index: i + 1, name: `p${i}`, minutes }) as FlowPhase);
  assert.deepEqual(minutesOf(phases), [4, 12, 10, 8, 6]);
  assert.equal(plannedTotal(minutesOf(phases)), 40);
});

test('a topic is offered by name with what is stored for it', () => {
  const t: FlowTopic = { id: 23810, name: 'Scientific Models and Simplification', concept_ids: [], slides: 4, activities: 1, notes: 4, labs: 1 };
  assert.equal(topicLabel(t), 'Scientific Models and Simplification (4 slides, 1 activity, 1 lab)');
  assert.equal(topicLabel({ ...t, slides: 0, activities: 0, labs: 0 }), 'Scientific Models and Simplification');
});
