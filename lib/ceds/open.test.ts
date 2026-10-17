import assert from 'node:assert/strict';
import test from 'node:test';

import type { CedsResources, FormatRow } from './api';
import { fitMessage, fitRowFor, formatCodeFor } from './open';

const row = (over: Partial<FormatRow>): FormatRow => ({ format: 'D2', label: 'Classroom Presentation', status: 'available', items: [], hidden_ignored: 0, unavailable_ignored: 0, ...over });

test('the five card types that are a CEDS format map to it, and every other card keeps opening as before', () => {
  assert.equal(formatCodeFor('Classroom presentation'), 'D2');
  assert.equal(formatCodeFor('Classroom activity'), 'D3');
  assert.equal(formatCodeFor('Prayogshala'), 'D4');
  assert.equal(formatCodeFor('Revision notes'), 'D5');
  assert.equal(formatCodeFor('Remedial class'), 'D6');
  for (const other of ['Video', 'Worksheet', 'Lesson plan', 'My course', 'H5P Interactive', 'PDF', 'Teacher training', 'Teacher training presentation', '', null, undefined]) {
    assert.equal(formatCodeFor(other), null, String(other));
  }
});

test('a weak fit is explained once, offers alternatives, and lets the teacher present anyway', () => {
  const m = fitMessage(row({ fit: 'W', warning: 'Direct instruction explains first; a lab is an experience, not an explanation.', alternative_formats: ['D1', 'D2'], alternative_pedagogies: ['P2'] }));
  assert.equal(m.tone, 'weak');
  assert.match(m.text, /Direct instruction explains first/);
  assert.match(m.text, /Better suited to this method: D1, D2/);
  assert.match(m.text, /different method: P2/);
  assert.match(m.text, /You can still present it/);
  assert.equal(m.confirmLabel, 'Present anyway');
});

test('a strong or possible fit goes straight on, and an unknown fit says nothing', () => {
  assert.deepEqual(fitMessage(row({ fit: 'S' })), { tone: 'ok', text: 'Strong fit.', confirmLabel: 'Show lesson flow' });
  assert.equal(fitMessage(row({ fit: 'P' })).text, 'Possible fit.');
  assert.equal(fitMessage(undefined).tone, 'unknown');
  assert.equal(fitMessage(row({})).tone, 'unknown');
});

test('the fit row is found by format code', () => {
  const res = { formats: [row({ format: 'D1' }), row({ format: 'D4', fit: 'W' })] } as unknown as CedsResources;
  assert.equal(fitRowFor(res, 'D4')?.fit, 'W');
  assert.equal(fitRowFor(res, 'D9'), undefined);
  assert.equal(fitRowFor(null, 'D4'), undefined);
});
