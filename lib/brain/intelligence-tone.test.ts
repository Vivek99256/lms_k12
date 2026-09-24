import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveTone } from '@/components/intelligence/module/primitives';

/**
 * The tone vocabulary crosses an HTTP boundary, so the renderer must be total.
 *
 * ── THE FAILURE THIS GUARDS ─────────────────────────────────────────────────
 *
 * `TONES[tone].rail` threw `Cannot read properties of undefined` and took every
 * People & Competency Intelligence screen down. The payload's TypeScript type
 * said `Tone`, which is one of seven strings — but the value is computed in PHP,
 * and twenty-two Brain controllers emit `'warning'` (39 branches), `'attention'`
 * (16) and a bare `null` (39). None of those is a `Tone`, and a type annotation
 * on the far side of an API cannot make them one.
 *
 * A default parameter does NOT cover this: `tone = 'neutral'` applies only to
 * `undefined`, so an explicit `null` sails straight past it into the lookup.
 *
 * These assertions are about crash-safety, not about which colour is prettiest.
 */

test('the tones the backend actually emits all resolve', () => {
  // Measured from next_lms_erp/app/Http/Controllers/Brain — not invented.
  assert.equal(resolveTone('warning'), 'medium', 'warning must keep its amber meaning');
  assert.equal(resolveTone('attention'), 'medium', 'attention must keep its amber meaning');
  assert.equal(resolveTone('positive'), 'positive');
  assert.equal(resolveTone('critical'), 'critical');
  assert.equal(resolveTone('medium'), 'medium');
  assert.equal(resolveTone('neutral'), 'neutral');
});

test('absent tones degrade instead of throwing', () => {
  // `null` is the one that actually crashed production screens.
  assert.equal(resolveTone(null), 'neutral');
  assert.equal(resolveTone(undefined), 'neutral');
  assert.equal(resolveTone(''), 'neutral');
});

test('an unknown tone never throws', () => {
  // A controller is free to invent a word tomorrow. A metric drawn without
  // emphasis is a far smaller defect than a screen that will not render.
  for (const odd of ['chartreuse', 'URGENT', '  Warning  ', '123', 'rail']) {
    assert.doesNotThrow(() => resolveTone(odd), `resolveTone(${odd}) threw`);
  }
  assert.equal(resolveTone('  Warning  '), 'medium', 'case and padding must not defeat the alias');
  assert.equal(resolveTone('chartreuse'), 'neutral');
});
