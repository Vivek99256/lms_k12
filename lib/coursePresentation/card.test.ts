import assert from 'node:assert/strict';
import test from 'node:test';

import { COURSE_PRESENTATION_CARD_ID, isCoursePresentationCard, routeCardOpen, shouldShowCoursePresentationCard } from './card';
import { coursePresentationEnabledFor } from './scope';
import { readCpState, withCpState, withoutCpState } from './urlState';

const courseCard = { id: COURSE_PRESENTATION_CARD_ID, type: 'Classroom presentation', chapterId: '8592', coursePresentationPilot: true, prayogshala: null };
const lab = { id: '68', type: 'Prayogshala', chapterId: '8592', prayogshala: { id: 68, status: 'review' } };

test('only chapter 8592 (Std 9 Science chapter 1) is enabled', () => {
  assert.equal(coursePresentationEnabledFor(8592), true);
  assert.equal(coursePresentationEnabledFor('8592'), true);
  for (const id of [8614, 8593, 8613, 8615, 0, '', null, undefined, 'abc', '8592.5']) assert.equal(coursePresentationEnabledFor(id as never), false, String(id));
});

test('the Course Presentation card opens the new workflow, in the Classroom lane only', () => {
  assert.equal(routeCardOpen(courseCard, 'classroom'), 'course-presentation');
  assert.equal(routeCardOpen(courseCard, 'teacher'), 'default');
});

test('a Prayogshala card never opens the new workflow', () => {
  assert.equal(routeCardOpen(lab, 'classroom'), 'default');
  // not even if it were somehow given the marker or the card id
  assert.equal(routeCardOpen({ ...lab, coursePresentationPilot: true }, 'classroom'), 'default');
  assert.equal(routeCardOpen({ ...lab, id: COURSE_PRESENTATION_CARD_ID, coursePresentationPilot: true }, 'classroom'), 'default');
});

test('other card types and other chapters keep the default route', () => {
  for (const type of ['Revision notes', 'Classroom activity', 'Remedial class', 'Video', 'Worksheet', 'Interactive']) {
    assert.equal(routeCardOpen({ id: '1', type, chapterId: '8592' }, 'classroom'), 'default', type);
  }
  // Classroom presentation in non-pilot chapter keeps default route
  assert.equal(routeCardOpen({ id: '1', type: 'Classroom presentation', chapterId: '8614' }, 'classroom'), 'default');
  // Classroom presentation or study deck in pilot chapter routes to course-presentation
  assert.equal(routeCardOpen({ id: '1', type: 'Classroom presentation', chapterId: '8592' }, 'classroom'), 'course-presentation');
  assert.equal(routeCardOpen({ id: '1', type: 'Interactive', deepLink: '/student/study-deck/8592?content=61549', chapterId: '8592' }, 'classroom'), 'course-presentation');
  assert.equal(routeCardOpen({ ...courseCard, chapterId: '8614' }, 'classroom'), 'default'); // chapter 8 (the former pilot)
  assert.equal(routeCardOpen({ ...courseCard, chapterId: undefined }, 'classroom'), 'default');
});

test('the card is added only for the pilot chapter, in the Classroom lane, once loaded, and never beside a stored presentation', () => {
  const base = { chapterId: '8592', lane: 'classroom' as const, loaded: true, items: [{ type: 'Prayogshala' }] };
  assert.equal(shouldShowCoursePresentationCard(base), true);
  assert.equal(shouldShowCoursePresentationCard({ ...base, chapterId: '8615' }), false);
  assert.equal(shouldShowCoursePresentationCard({ ...base, chapterId: '8614' }), false); // chapter 8, the former pilot
  assert.equal(shouldShowCoursePresentationCard({ ...base, lane: 'teacher' }), false);
  assert.equal(shouldShowCoursePresentationCard({ ...base, loaded: false }), false);
  assert.equal(shouldShowCoursePresentationCard({ ...base, items: [{ type: 'Classroom presentation' }] }), false);
});

test('url state round-trips, and the pre-flight needs both choices', () => {
  const next = withCpState(new URLSearchParams('view=content&chapterId=8592'), { open: true, pedagogy: 'inquiry_based', format: 'interactive_slides', stage: 'preflight' });
  assert.equal(next.get('view'), 'content');
  assert.deepEqual(readCpState(next), { open: true, pedagogy: 'inquiry_based', format: 'interactive_slides', stage: 'preflight' });
  // a link that claims the pre-flight without a format falls back to choosing
  const partial = new URLSearchParams('cpOpen=1&cpPedagogy=gamified&cpStage=preflight');
  assert.equal(readCpState(partial).stage, 'choose');
  // choices that are not simple keys are ignored
  assert.equal(readCpState(new URLSearchParams('cpOpen=1&cpPedagogy=../x&cpFormat=A B')).pedagogy, null);
  // closing removes only the cp keys
  const closed = withoutCpState(next);
  assert.equal(closed.toString(), 'view=content&chapterId=8592');
  assert.equal(withCpState(new URLSearchParams('a=1'), { open: false, pedagogy: 'x', format: 'y', stage: 'choose' }).toString(), 'a=1');
});
