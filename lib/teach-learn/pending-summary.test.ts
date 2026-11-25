import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { backgroundStatus, pendingSummary } from './pending-summary';

describe('pendingSummary', () => {
  it('says what is stored and what is still generating', () => {
    assert.equal(
      pendingSummary(4, 2, 0),
      'Generated and stored 2 of 4 background resource(s) in Classroom Resource. 2 still generating; each is stored automatically once it passes validation.'
    );
  });

  it('gives the final result with the failure reasons', () => {
    const text = pendingSummary(4, 3, 1, [{ label: 'Classroom Activity', reason: 'Activity "A": Write exactly 3 teacher steps.' }]);
    assert.match(text, /^Generated and stored 3 of 4/);
    assert.match(text, /1 could not be stored\./);
    assert.match(text, /Classroom Activity: Activity "A": Write exactly 3 teacher steps\./);
    assert.doesNotMatch(text, /still generating/);
  });

  it('shortens a very long reason', () => {
    const text = pendingSummary(1, 0, 1, [{ label: 'Revision Notes', reason: 'x'.repeat(500) }]);
    assert.ok(text.length < 400);
    assert.match(text, /\.\.\.$/);
  });
});

describe('backgroundStatus', () => {
  it('is in progress while anything is generating or queued', () => {
    assert.equal(backgroundStatus({ total: 4, stored: 0, failed: 0 }), 'in_progress');
    assert.equal(backgroundStatus({ total: 4, stored: 2, failed: 1 }), 'in_progress');
  });

  it('is completed when everything is stored', () => {
    assert.equal(backgroundStatus({ total: 4, stored: 4, failed: 0 }), 'completed');
    assert.equal(backgroundStatus({ total: 0, stored: 0, failed: 0 }), 'completed');
  });

  it('is completed with issues when finished, something failed and something is stored', () => {
    assert.equal(backgroundStatus({ total: 4, stored: 3, failed: 1 }), 'issues');
    assert.equal(backgroundStatus({ total: 4, stored: 0, failed: 4 }, 1), 'issues');
  });

  it('is failed when everything failed and nothing is stored', () => {
    assert.equal(backgroundStatus({ total: 4, stored: 0, failed: 4 }), 'failed');
  });

  it('does not wait for ever: after the long wait, what is unresolved counts as not stored', () => {
    assert.equal(backgroundStatus({ total: 2, stored: 1, failed: 0, gaveUp: true }), 'issues');
    assert.equal(backgroundStatus({ total: 2, stored: 0, failed: 0, gaveUp: true }), 'failed');
  });
});
