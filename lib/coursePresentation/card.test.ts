import assert from 'node:assert/strict';
import test from 'node:test';

import { COURSE_PRESENTATION_CARD_ID, isCoursePresentationCard, routeCardOpen, shouldShowCoursePresentationCard } from './card';
import { coursePresentationEnabledFor } from './scope';
import { readCpState, withCpState, withoutCpState } from './urlState';

const courseCard = { id: COURSE_PRESENTATION_CARD_ID, type: 'Classroom presentation', chapterId: '8592', coursePresentationPilot: true, prayogshala: null };
const lab = { id: '68', type: 'Prayogshala', chapterId: '8592', prayogshala: { id: 68, status: 'review' } };

test('chapter 8592 (Std 9 Science chapter 1) and the four Std 4 EVS Water chapters are enabled, and nothing else', () => {
  assert.equal(coursePresentationEnabledFor(8592), true);
  assert.equal(coursePresentationEnabledFor('8592'), true);
  for (const id of [41675, 41676, 41677, 41678]) assert.equal(coursePresentationEnabledFor(id), true, String(id));
  for (const id of [41674, 41679]) assert.equal(coursePresentationEnabledFor(id), false, String(id)); // the chapters next to them
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
  for (const type of ['Revision notes', 'Classroom activity', 'Remedial class', 'Video', 'Worksheet', 'Interactive', 'Educational Posters']) {
    assert.equal(routeCardOpen({ id: '1', type, chapterId: '8592' }, 'classroom'), 'default', type);
  }
  // A stored presentation, story lesson or poster is its own item: it opens as it always did (a stored deck straight to its own
  // deep link), in a chapter in scope or not. Only the dedicated entry card opens the chooser.
  assert.equal(routeCardOpen({ id: '1', type: 'Classroom presentation', chapterId: '8614' }, 'classroom'), 'default');
  for (const chapterId of ['8592', '41675', '41678']) {
    assert.equal(routeCardOpen({ id: '1', type: 'Classroom presentation', chapterId }, 'classroom'), 'default', `poster in ${chapterId}`);
    assert.equal(routeCardOpen({ id: '2', type: 'Classroom presentation', chapterId, deepLink: `/student/study-deck/${chapterId}?content=61549` }, 'classroom'), 'default', `stored deck in ${chapterId}`);
    assert.equal(routeCardOpen({ id: '3', type: 'Interactive', chapterId, deepLink: `/student/study-deck/${chapterId}?content=61550` }, 'classroom'), 'default', `story lesson in ${chapterId}`);
    assert.equal(routeCardOpen({ ...courseCard, chapterId }, 'classroom'), 'course-presentation', `entry card in ${chapterId}`);
  }
  assert.equal(routeCardOpen({ ...courseCard, chapterId: '8614' }, 'classroom'), 'default'); // chapter 8 (the former pilot)
  assert.equal(routeCardOpen({ ...courseCard, chapterId: undefined }, 'classroom'), 'default');
});

test('the card is added only for a chapter in scope, in the Classroom lane, once loaded, whatever is already stored, and never twice', () => {
  const base = { chapterId: '8592', lane: 'classroom' as const, loaded: true, items: [{ type: 'Prayogshala' }] };
  assert.equal(shouldShowCoursePresentationCard(base), true);
  assert.equal(shouldShowCoursePresentationCard({ ...base, chapterId: '8615' }), false);
  assert.equal(shouldShowCoursePresentationCard({ ...base, chapterId: '8614' }), false); // chapter 8, the former pilot
  assert.equal(shouldShowCoursePresentationCard({ ...base, lane: 'teacher' }), false);
  assert.equal(shouldShowCoursePresentationCard({ ...base, loaded: false }), false);
  // The Std 4 EVS chapters each already have a printed poster (a "Classroom presentation"): the entry card is still there beside it.
  for (const chapterId of ['41675', '41676', '41677', '41678']) {
    assert.equal(shouldShowCoursePresentationCard({ ...base, chapterId, items: [{ type: 'Classroom presentation' }, { type: 'Video' }] }), true, chapterId);
  }
  // ...and beside presentations stored for other teaching methods.
  assert.equal(shouldShowCoursePresentationCard({ ...base, items: [{ type: 'Classroom presentation' }, { type: 'Classroom presentation' }] }), true);
  // The list already holding the entry card does not get a second one.
  assert.equal(shouldShowCoursePresentationCard({ ...base, items: [{ type: 'Classroom presentation', coursePresentationPilot: true }] }), false);
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
