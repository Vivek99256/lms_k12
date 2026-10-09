import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ROADMAP_ITEMS } from './index';

/**
 * A status on the Platform administration screen is a claim about the code.
 * These tests keep the claim honest: the files a row cites must exist, and a
 * Platform services row cannot say it is live or in progress while citing
 * nothing, except when its proof lives only in the backend repo.
 */

const ROOT = join(process.cwd());

// Rows whose proof is backend-only; the reason is in a comment in registry.ts.
const BACKEND_ONLY = new Set(['platform.evidence-engine']);

test('every cited evidence file exists', () => {
  for (const item of ROADMAP_ITEMS) {
    for (const path of item.evidence ?? []) {
      assert.ok(existsSync(join(ROOT, path)), `${item.id} cites missing file ${path}`);
    }
  }
});

test('a Platform services row that is live or in progress cites evidence', () => {
  for (const item of ROADMAP_ITEMS) {
    if (item.module !== 'Platform services') continue;
    if (item.status === 'coming-soon' || BACKEND_ONLY.has(item.id)) continue;
    assert.ok(item.evidence?.length, `${item.id} is ${item.status} but cites no evidence`);
  }
});

test('a row that cites evidence is not marked coming soon', () => {
  for (const item of ROADMAP_ITEMS) {
    if (!item.evidence?.length) continue;
    assert.notEqual(item.status, 'coming-soon', `${item.id} has code but is marked coming soon`);
  }
});
