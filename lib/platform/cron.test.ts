import assert from 'node:assert/strict';
import test from 'node:test';

import { describeSchedule, expandField, nextRunAt, scheduleProblem, scheduleToString, schedulesEqual } from './cron';
import type { CronSchedule } from './types';

/**
 * Tests for the cron parser behind the Scheduler screen.
 *
 * WHAT IS WORTH TESTING HERE, AND WHY. This code is the live preview an operator
 * reads while typing — the sentence under the five inputs and the "next run"
 * they check their intent against. It has one job: agree with the operator about
 * what they typed. Laravel's App\Services\Platform\CronSchedule is the copy that
 * decides, and it is a deliberate port of this logic; these cases are the shared
 * contract between the two, so a change on either side that breaks one of them is
 * a change that would let the screen promise something the API refuses.
 *
 * The day-of-month / day-of-week OR rule gets its own case because it is the rule
 * operators get wrong, and a silent disagreement there means a task that runs on
 * days nobody asked for.
 */

const at = (minute: string, hour: string, day = '*', month = '*', day_of_week = '*'): CronSchedule => ({
  minute,
  hour,
  day,
  month,
  day_of_week,
});

const MINUTE = { name: 'minute' as const, label: 'Minute', min: 0, max: 59 };
const DOW = { name: 'day_of_week' as const, label: 'Day of week', min: 0, max: 6 };

test('expandField reads every form a field can take', () => {
  assert.deepEqual(expandField('5', MINUTE), [5]);
  assert.deepEqual(expandField('1,15,30', MINUTE), [1, 15, 30]);
  assert.deepEqual(expandField('1-5', DOW), [1, 2, 3, 4, 5]);
  assert.deepEqual(expandField('*/15', MINUTE), [0, 15, 30, 45]);
  assert.deepEqual(expandField('0-30/10', MINUTE), [0, 10, 20, 30]);
  assert.equal(expandField('*', MINUTE).length, 60);
  // Duplicates across a list collapse rather than firing twice.
  assert.deepEqual(expandField('5,5,1', MINUTE), [1, 5]);
});

test('a bad field is refused with its own name in the message', () => {
  // The point of the message: it says WHERE to look. "invalid cron" does not.
  assert.match(scheduleProblem(at('61', '0')) ?? '', /Minute/);
  assert.match(scheduleProblem(at('61', '0')) ?? '', /0–59/);
  assert.match(scheduleProblem(at('0', '9', '*', '*', '5-1')) ?? '', /backwards/);
  assert.match(scheduleProblem(at('', '9')) ?? '', /cannot be empty/);
  assert.match(scheduleProblem(at('*/0', '9')) ?? '', /1 or more/);
  assert.match(scheduleProblem(at('abc', '9')) ?? '', /whole number/);
  assert.equal(scheduleProblem(at('0', '9', '*', '*', '1-5')), null);
});

test('nextRunAt starts at the next whole minute, not the current one', () => {
  // 09:00:30 on a task due at 09:00 is not "due now" — it has already passed.
  const from = new Date(2026, 8, 10, 9, 0, 30);
  const next = nextRunAt(at('0', '9'), from);
  assert.equal(next?.getDate(), 11);
  assert.equal(next?.getHours(), 9);
  assert.equal(next?.getMinutes(), 0);
});

test('nextRunAt finds the next slot later the same day', () => {
  const from = new Date(2026, 8, 10, 9, 7, 0);
  const next = nextRunAt(at('*/10', '*'), from);
  assert.equal(next?.getHours(), 9);
  assert.equal(next?.getMinutes(), 10);
});

test('nextRunAt honours a weekday restriction', () => {
  // 12 September 2026 is a Saturday; the next weekday run is Monday the 14th.
  const from = new Date(2026, 8, 12, 6, 0, 0);
  const next = nextRunAt(at('30', '10', '*', '*', '1-5'), from);
  assert.equal(next?.getDate(), 14);
  assert.equal(next?.getDay(), 1);
  assert.equal(next?.getHours(), 10);
  assert.equal(next?.getMinutes(), 30);
});

test('day-of-month and day-of-week both restricted means EITHER matches', () => {
  // Standard cron, and the rule people get wrong: `0 9 1 * 1` is the 1st of the
  // month AND every Monday, not "Mondays that fall on the 1st".
  const schedule = at('0', '9', '1', '*', '1');

  // 1 October 2026 is a Thursday — matched by the day-of-month half alone.
  const fromLateSeptember = new Date(2026, 8, 29, 12, 0, 0);
  const next = nextRunAt(schedule, fromLateSeptember);
  assert.equal(next?.getMonth(), 9);
  assert.equal(next?.getDate(), 1);

  // And a Monday in the middle of a month matches through the other half.
  const fromMidMonth = new Date(2026, 8, 12, 12, 0, 0);
  const monday = nextRunAt(schedule, fromMidMonth);
  assert.equal(monday?.getDay(), 1);
  assert.equal(monday?.getDate(), 14);
});

test('a schedule that can never fire returns null rather than a date', () => {
  // 30 February. Null is the honest answer; a date would be a promise the
  // dispatcher cannot keep.
  assert.equal(nextRunAt(at('0', '9', '30', '2')), null);
});

test('describeSchedule says the OR rule out loud', () => {
  assert.match(describeSchedule(at('0', '9', '1', '*', '1')), / or /);
  assert.match(describeSchedule(at('0', '9')), /every day/);
  assert.match(describeSchedule(at('*/5', '*')), /every 5 minutes/);
  assert.match(describeSchedule(at('30', '10', '*', '*', '1-5')), /Monday, Tuesday, Wednesday, Thursday and Friday/);
  // A schedule that does not parse describes its own problem rather than
  // rendering something confident and wrong.
  assert.match(describeSchedule(at('99', '9')), /Minute/);
});

test('scheduleToString and schedulesEqual normalise blanks to a star', () => {
  assert.equal(scheduleToString(at('0', '9', '*', '*', '1-5')), '0 9 * * 1-5');
  assert.equal(scheduleToString({ minute: '0', hour: '9', day: '', month: ' ', day_of_week: '*' }), '0 9 * * *');
  assert.ok(schedulesEqual(at('0', '9'), { minute: '0', hour: '9', day: ' * ', month: '*', day_of_week: '*' }));
  assert.ok(!schedulesEqual(at('0', '9'), at('0', '10')));
});
