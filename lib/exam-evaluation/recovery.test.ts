import test from 'node:test';
import assert from 'node:assert/strict';

import { canReprocess, describeBulkResult, eligibleSummary, isStuck, rerunTitle, stalledMessage, type RecoverySheet } from './recovery';

const sheet = (over: Partial<RecoverySheet> = {}): RecoverySheet => ({ status: 'Needs review', stalled: false, identity_confirmed: true, ...over });

// -- when a sheet may be re-run ---------------------------------------------------------

test('a sheet the system is working on is left alone until the server calls it stalled', () => {
  assert.equal(canReprocess(sheet({ status: 'Identifying' })), false);
  assert.equal(canReprocess(sheet({ status: 'Processing' })), false);

  assert.equal(canReprocess(sheet({ status: 'Identifying', stalled: true })), true);
  assert.equal(canReprocess(sheet({ status: 'Processing', stalled: true })), true);
});

test('a queued sheet, a finished sheet, a failed sheet and one waiting for a person can always be re-run', () => {
  for (const status of ['Pending', 'Evaluated', 'Needs review', 'Failed', 'Awaiting identity']) {
    assert.equal(canReprocess(sheet({ status })), true, status);
  }
});

test('an approved sheet and a published batch are never re-run, stalled or not', () => {
  assert.equal(canReprocess(sheet({ status: 'Approved' })), false);
  assert.equal(canReprocess(sheet({ status: 'Approved', stalled: true })), false);
  assert.equal(canReprocess(sheet({ status: 'Failed' }), true), false);
  assert.equal(canReprocess(sheet({ status: 'Identifying', stalled: true }), true), false);
});

// -- what is said about a stuck sheet -------------------------------------------------------

test('only an in-flight sheet can be stuck', () => {
  assert.equal(isStuck(sheet({ status: 'Identifying', stalled: true })), true);
  assert.equal(isStuck(sheet({ status: 'Pending', stalled: true })), true);
  assert.equal(isStuck(sheet({ status: 'Processing', stalled: true })), true);

  assert.equal(isStuck(sheet({ status: 'Identifying' })), false, 'slow is not stuck');
  assert.equal(isStuck(sheet({ status: 'Awaiting identity', stalled: true })), false, 'waiting for a person is not stuck');
  assert.equal(isStuck(sheet({ status: 'Approved', stalled: true })), false);
});

test('the message for a stuck sheet is calm, says what to do, and blames no one', () => {
  const reading = stalledMessage(sheet({ status: 'Identifying', stalled: true }));
  const marking = stalledMessage(sheet({ status: 'Processing', stalled: true }));

  assert.match(reading ?? '', /student’s details/);
  assert.match(marking ?? '', /Try again/);
  assert.match(`${reading}${marking}`, /background worker/);
  assert.doesNotMatch(`${reading}${marking}`, /oops|sorry|failed|error/i);

  assert.equal(stalledMessage(sheet()), null);
  assert.equal(stalledMessage(sheet({ status: 'Identifying' })), null);
});

test('the re-run control says what it will really do', () => {
  assert.match(rerunTitle(sheet({ status: 'Identifying', stalled: true })), /back on the queue/);
  assert.match(rerunTitle(sheet({ identity_confirmed: true })), /confirmed student is kept/);
  assert.match(rerunTitle(sheet({ identity_confirmed: false })), /starting with the student’s details/);
});

// -- who is eligible, said before scanning ---------------------------------------------------------

test('an exam tied to a class says how many students are eligible and does not warn', () => {
  const summary = eligibleSummary({ applies_to_class: true, eligible_students: 42 });

  assert.equal(summary.warn, false);
  assert.match(summary.text, /42 students are eligible/);
  assert.match(summary.text, /only be assigned to one of them/);
});

test('one student reads correctly', () => {
  assert.match(eligibleSummary({ applies_to_class: true, eligible_students: 1 }).text, /1 student is eligible/);
});

test('an exam tied to no class warns that everyone enrolled would count as eligible', () => {
  const summary = eligibleSummary({ applies_to_class: false, eligible_students: 3120 });

  assert.equal(summary.warn, true);
  assert.match(summary.text, /isn’t set for a class/);
  assert.match(summary.text, /3,120 students/, 'Indian digit grouping, as elsewhere in the product');
  assert.match(summary.text, /Set the exam’s class first/);
});

test('a class with nobody enrolled warns that no sheet could be assigned', () => {
  const summary = eligibleSummary({ applies_to_class: true, eligible_students: 0 });

  assert.equal(summary.warn, true);
  assert.match(summary.text, /no sheet could be assigned/);
});

test('the eligibility text never contains a person\'s name, only a count', () => {
  for (const key of [
    { applies_to_class: true, eligible_students: 30 },
    { applies_to_class: false, eligible_students: 900 },
    { applies_to_class: true, eligible_students: 0 },
  ]) {
    assert.doesNotMatch(eligibleSummary(key).text, /[A-Z][a-z]+ [A-Z][a-z]+ (Patel|Shah)/);
  }
});

// -- the bulk result -------------------------------------------------------------------------------------

test('a bulk confirmation is summarised in one sentence, with what is left for a person', () => {
  assert.equal(describeBulkResult(5, 0), '5 students confirmed and queued for marking.');
  assert.equal(describeBulkResult(1, 0), '1 student confirmed and queued for marking.');
  assert.equal(describeBulkResult(4, 2), '4 students confirmed and queued for marking. 2 sheets need to be checked one at a time.');
  assert.equal(describeBulkResult(4, 1), '4 students confirmed and queued for marking. 1 sheet needs to be checked one at a time.');
  assert.equal(describeBulkResult(0, 3), '0 students confirmed and queued for marking. 3 sheets need to be checked one at a time.');
});
