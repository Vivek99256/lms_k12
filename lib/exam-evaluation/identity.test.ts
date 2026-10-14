import test from 'node:test';
import assert from 'node:assert/strict';

import {
  anyInFlight,
  bulkConfirmableSheets,
  confidenceLabel,
  describeStudent,
  filterStudents,
  identityBlocker,
  identityIssueMessage,
  identityState,
  identityStateLabel,
  isUsableReason,
  isWeakMatch,
  matchMethodLabel,
  needsCorrectionReason,
  sheetsAwaitingIdentity,
  type PickerStudent,
} from './identity';

const roster: PickerStudent[] = [
  { student_id: 101, name: 'Asha Patel', roll_no: '1', enrollment_no: 'GR101', section_name: 'A' },
  { student_id: 102, name: 'Ravi Shah', roll_no: '2', enrollment_no: 'GR102', section_name: 'B' },
  { student_id: 103, name: 'Ravi Shah', roll_no: '3', enrollment_no: 'GR103', section_name: 'A' },
  { student_id: 104, name: 'Meera Joshi', roll_no: '10', enrollment_no: 'GR/104', section_name: 'B' },
];

// -- Suggestion and confirmation are never confused ----------------------------

test('a suggested student is not a confirmed one, and the screen says which', () => {
  const suggested = { student_id: 101, identity_source: 'enrollment_no', identity_confirmed: false };
  const confirmed = { student_id: 101, identity_source: 'enrollment_no', identity_confirmed: true };
  const chosen = { student_id: 102, identity_source: 'manual', identity_confirmed: true };
  const nobody = { student_id: null, identity_source: 'unmatched', identity_confirmed: false };

  assert.equal(identityState(suggested), 'suggested');
  assert.equal(identityState(confirmed), 'confirmed_match');
  assert.equal(identityState(chosen), 'selected_by_teacher');
  assert.equal(identityState(nobody), 'unmatched');

  assert.match(identityStateLabel(suggested), /needs your confirmation/);
  assert.equal(identityStateLabel(confirmed), 'Confirmed by a teacher');
  assert.equal(identityStateLabel(chosen), 'Selected by a teacher');
  assert.equal(identityStateLabel(nobody), 'Not matched');
});

test('a confirmation with nobody to attach it to is not one', () => {
  assert.equal(identityState({ student_id: null, identity_source: 'manual', identity_confirmed: true }), 'unmatched');
});

test('the method of a match is named in words, and the weakest is flagged', () => {
  assert.equal(matchMethodLabel('enrollment_no'), 'GR / enrollment number');
  assert.equal(matchMethodLabel('roll_no'), 'Roll number');
  assert.equal(matchMethodLabel('name'), 'Handwritten name');
  assert.equal(matchMethodLabel('manual'), 'Chosen by a teacher');
  assert.equal(matchMethodLabel('unmatched'), 'No match');
  assert.equal(matchMethodLabel(''), 'No match');

  assert.equal(isWeakMatch({ identity_source: 'name', identity_confirmed: false }), true);
  assert.equal(isWeakMatch({ identity_source: 'name', identity_confirmed: true }), false);
  assert.equal(isWeakMatch({ identity_source: 'roll_no', identity_confirmed: false }), false);
});

test('confidence is shown only when there is one', () => {
  assert.equal(confidenceLabel(92.4), '92% sure');
  assert.equal(confidenceLabel(null), '');
  assert.equal(confidenceLabel(undefined), '');
  assert.equal(confidenceLabel(Number.NaN), '');
});

test('every reason a sheet is left for a teacher has a plain-words explanation', () => {
  for (const issue of ['unreadable', 'unavailable', 'not_on_roll', 'ambiguous', 'conflict', 'duplicate', 'low_confidence', 'multiple_students']) {
    const message = identityIssueMessage(issue);

    assert.ok(message && message.length > 10, `no message for ${issue}`);
    assert.doesNotMatch(message ?? '', /oops|sorry/i, 'blame-free and calm');
  }

  assert.equal(identityIssueMessage(null), null);
  assert.equal(identityIssueMessage(undefined), null);
  assert.equal(identityIssueMessage('something_new'), null, 'an unknown reason is not invented');
});

// -- The searchable picker -----------------------------------------------------

test('a student can be found by name, roll number, GR number or section', () => {
  assert.deepEqual(filterStudents(roster, 'meera').map((s) => s.student_id), [104]);
  assert.deepEqual(filterStudents(roster, 'PATEL').map((s) => s.student_id), [101]);
  assert.equal(filterStudents(roster, '10')[0].student_id, 104, 'roll 10 is first; GR101-103 merely contain "10" and rank below it');
  assert.deepEqual(filterStudents(roster, 'gr102').map((s) => s.student_id), [102]);
  assert.deepEqual(filterStudents(roster, 'GR/104').map((s) => s.student_id), [104], 'punctuation in a GR number does not matter');
});

test('two students with the same name are told apart by a second word', () => {
  assert.deepEqual(filterStudents(roster, 'ravi').map((s) => s.student_id).sort(), [102, 103]);
  assert.deepEqual(filterStudents(roster, 'ravi 3').map((s) => s.student_id), [103]);
  assert.deepEqual(filterStudents(roster, 'ravi gr102').map((s) => s.student_id), [102]);
  assert.deepEqual(filterStudents(roster, 'shah b').map((s) => s.student_id), [102]);
});

test('every word has to match something, so a wrong one finds nobody', () => {
  assert.deepEqual(filterStudents(roster, 'ravi xyz'), []);
  assert.deepEqual(filterStudents(roster, 'zzzz'), []);
});

test('an exact roll number outranks a partial match elsewhere', () => {
  const crowded: PickerStudent[] = [
    { student_id: 1, name: 'Dev One', roll_no: '12', enrollment_no: 'GR1', section_name: 'A' },
    { student_id: 2, name: 'Dev Two', roll_no: '1', enrollment_no: 'GR12', section_name: 'A' },
  ];

  assert.equal(filterStudents(crowded, '1')[0].student_id, 2, 'roll 1 is exactly 1; roll 12 only starts with it');
});

test('with nothing typed everyone is listed, and the students the server named come first', () => {
  assert.deepEqual(filterStudents(roster, '').map((s) => s.student_id), [101, 102, 103, 104]);
  assert.deepEqual(filterStudents(roster, '', [103, 102]).map((s) => s.student_id).slice(0, 2), [102, 103], 'candidates first, in roll order');
  assert.deepEqual(filterStudents(roster, '   ').map((s) => s.student_id), [101, 102, 103, 104]);
});

test('names in other scripts can be searched', () => {
  const gujarati: PickerStudent[] = [
    { student_id: 1, name: 'આશા પટેલ', roll_no: '1', enrollment_no: 'GR1' },
    { student_id: 2, name: 'રવિ શાહ', roll_no: '2', enrollment_no: 'GR2' },
  ];

  assert.deepEqual(filterStudents(gujarati, 'પટેલ').map((s) => s.student_id), [1]);
});

test('searching never reorders or mutates the class list it was given', () => {
  const before = roster.map((s) => s.student_id);

  filterStudents(roster, 'ravi', [103]);

  assert.deepEqual(roster.map((s) => s.student_id), before);
});

test('a student is described by what tells similar students apart', () => {
  assert.equal(describeStudent(roster[1]), '2. Ravi Shah · GR GR102 · Div B');
  assert.equal(describeStudent({ student_id: 9, name: 'Neha Desai', roll_no: '', enrollment_no: '' }), 'Neha Desai');
});

// -- Corrections ---------------------------------------------------------------

test('moving a confirmed sheet to someone else is a correction and needs a reason', () => {
  const move = { currentStudentId: 101, nextStudentId: 102, confirmed: true, hasTeacherWork: false };

  assert.equal(needsCorrectionReason(move), true);
  assert.equal(needsCorrectionReason({ ...move, nextStudentId: null }), true, 'removing a confirmed student is one too');
  assert.equal(needsCorrectionReason({ ...move, confirmed: false, hasTeacherWork: true }), true, 'so is moving marks a teacher has begun');
});

test('choosing among suggestions, or the same student again, needs no reason', () => {
  const move = { currentStudentId: 101, nextStudentId: 102, confirmed: false, hasTeacherWork: false };

  assert.equal(needsCorrectionReason(move), false);
  assert.equal(needsCorrectionReason({ ...move, confirmed: true, nextStudentId: 101 }), false);
  assert.equal(needsCorrectionReason({ ...move, currentStudentId: null, confirmed: true }), false, 'assigning an empty sheet is not a correction');
});

test('a reason has to say something', () => {
  assert.equal(isUsableReason(''), false);
  assert.equal(isUsableReason('  '), false);
  assert.equal(isUsableReason('ok'), false);
  assert.equal(isUsableReason('Wrong scan order'), true);
});

// -- Approval ----------------------------------------------------------------------

test('a suggestion nobody confirmed blocks approval', () => {
  assert.match(
    identityBlocker({ studentId: 101, savedStudentId: 101, savedConfirmed: false }) ?? '',
    /Confirm that this sheet belongs/
  );
});

test('a confirmed student, or one chosen by hand in the same save, does not', () => {
  assert.equal(identityBlocker({ studentId: 101, savedStudentId: 101, savedConfirmed: true }), null);
  assert.equal(identityBlocker({ studentId: 102, savedStudentId: 101, savedConfirmed: false }), null, 'picking them is confirming them');
});

test('no student at all is left to the existing "assign a student" message', () => {
  assert.equal(identityBlocker({ studentId: null, savedStudentId: null, savedConfirmed: false }), null);
});

// -- The batch screen ------------------------------------------------------------------

test('only sheets waiting for a teacher are listed for identification', () => {
  const sheets = [
    { status: 'Awaiting identity', can_bulk_confirm: true },
    { status: 'Awaiting identity', can_bulk_confirm: false },
    { status: 'Evaluated', can_bulk_confirm: true },
    { status: 'Identifying' },
  ];

  assert.equal(sheetsAwaitingIdentity(sheets).length, 2);
});

test('bulk confirmation offers only the sheets the server says are clean number matches', () => {
  const sheets = [
    { id: 1, status: 'Awaiting identity', can_bulk_confirm: true },
    { id: 2, status: 'Awaiting identity', can_bulk_confirm: false },
    { id: 3, status: 'Awaiting identity' },
    { id: 4, status: 'Evaluated', can_bulk_confirm: true },
  ];

  assert.deepEqual(bulkConfirmableSheets(sheets).map((s) => s.id), [1]);
});

test('the screen keeps refreshing while the system is working, and stops when it is waiting for a person', () => {
  assert.equal(anyInFlight([{ status: 'Identifying' }]), true);
  assert.equal(anyInFlight([{ status: 'Pending' }]), true);
  assert.equal(anyInFlight([{ status: 'Processing' }, { status: 'Approved' }]), true);

  assert.equal(anyInFlight([{ status: 'Awaiting identity' }, { status: 'Needs review' }, { status: 'Approved' }, { status: 'Failed' }]), false);
  assert.equal(anyInFlight([]), false);
});
