import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canRunOrToggle, lastRunSummary } from './scheduler-display';

test('a task without a job cannot run or be toggled', () => {
  assert.equal(canRunOrToggle({ has_job: false }), false);
  assert.equal(canRunOrToggle({ has_job: true }), true);
});

test('last run summary shows only for ok runs of tasks with a job', () => {
  assert.equal(lastRunSummary({ has_job: true, last_run_status: 'ok', last_run_message: ' 3 books overdue ' }), '3 books overdue');
  assert.equal(lastRunSummary({ has_job: true, last_run_status: 'failed', last_run_message: 'old' }), null);
  assert.equal(lastRunSummary({ has_job: false, last_run_status: 'ok', last_run_message: 'x' }), null);
  assert.equal(lastRunSummary({ has_job: true, last_run_status: 'ok', last_run_message: '  ' }), null);
  assert.equal(lastRunSummary({ has_job: true, last_run_status: null }), null);
});
