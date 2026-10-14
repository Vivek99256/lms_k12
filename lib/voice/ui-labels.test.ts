import assert from 'node:assert/strict';
import test from 'node:test';

import { UI_LABELS, stepsCompleted, uiLabel } from './ui-labels';
import { scriptOf } from './voice-utils';

test('every language has every label', () => {
  const keys = Object.keys(UI_LABELS.en).sort();

  assert.deepEqual(Object.keys(UI_LABELS.hi).sort(), keys);
  assert.deepEqual(Object.keys(UI_LABELS.gu).sort(), keys);
});

test('Hindi and Gujarati labels are written in their own script, and English stays English', () => {
  for (const [key, text] of Object.entries(UI_LABELS.hi)) {
    // "AI analysis" keeps the letters AI; the rest of the label must be Devanagari.
    assert.equal(scriptOf(text), 'hi', `hi ${key}: ${text}`);
  }

  for (const [key, text] of Object.entries(UI_LABELS.gu)) {
    assert.equal(scriptOf(text), 'gu', `gu ${key}: ${text}`);
  }

  for (const [key, text] of Object.entries(UI_LABELS.en)) {
    assert.equal(scriptOf(text), 'en', `en ${key}: ${text}`);
  }
});

test('an unknown language falls back to English rather than showing nothing', () => {
  assert.equal(uiLabel(undefined, 'showDetails'), 'Show details');
  assert.equal(uiLabel('hi', 'showDetails'), 'विवरण दिखाएँ');
  assert.equal(uiLabel('gu', 'showDetails'), 'વિગતો બતાવો');
});

test('the step count keeps its numbers in every language', () => {
  assert.equal(stepsCompleted('en', 3, 12), '3 of 12 steps completed');
  assert.match(stepsCompleted('hi', 3, 12), /12.*3|3.*12/);
  assert.match(stepsCompleted('gu', 3, 12), /12.*3|3.*12/);
  assert.equal(scriptOf(stepsCompleted('hi', 3, 12)), 'hi');
  assert.equal(scriptOf(stepsCompleted('gu', 3, 12)), 'gu');
});
