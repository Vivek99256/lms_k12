import assert from 'node:assert/strict';
import test from 'node:test';

import { isStudentRouteAllowed } from './student-nav';

// With no menu rows granted, only the baseline routes and the learner players may open.
const noMenu: Parameters<typeof isStudentRouteAllowed>[1] = [];

test('the learner players a Classroom Resource card opens are allowed for a student', () => {
  assert.equal(isStudentRouteAllowed('/student/study-deck/8592', noMenu), true);
  assert.equal(isStudentRouteAllowed('/student/vocabulary-class/41675', noMenu), true);
  assert.equal(isStudentRouteAllowed('/student/classroom-activity/8592', noMenu), true);
});

test('the learner chapter browser stays allowed', () => {
  assert.equal(isStudentRouteAllowed('/student', noMenu), true);
});

test('staff screens under /student stay refused', () => {
  assert.equal(isStudentRouteAllowed('/student/add_student', noMenu), false);
  assert.equal(isStudentRouteAllowed('/student/student_health', noMenu), false);
  assert.equal(isStudentRouteAllowed('/student/study-decks-admin', noMenu), false, 'a prefix match must be on a whole segment');
});
