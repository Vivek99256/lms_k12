import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  INTELLIGENCE_MODULES,
  findIntelligenceModule,
  liveIntelligenceModules,
} from '@/components/intelligence/module/registry';

test('all registered intelligence modules have unique keys and valid routes', () => {
  const seenKeys = new Set<string>();
  const seenRoutes = new Set<string>();

  for (const entry of INTELLIGENCE_MODULES) {
    assert.ok(entry.key, 'Module must have a key');
    assert.ok(entry.label, `Module ${entry.key} must have a label`);
    assert.ok(entry.route, `Module ${entry.key} must have a route`);
    assert.ok(['live', 'partial', 'planned'].includes(entry.status), `Module ${entry.key} must have a valid status`);

    assert.ok(!seenKeys.has(entry.key), `Duplicate module key: ${entry.key}`);
    seenKeys.add(entry.key);

    assert.ok(!seenRoutes.has(entry.route), `Duplicate module route: ${entry.route}`);
    seenRoutes.add(entry.route);
  }
});

test('live and partial modules load valid contracts with required structure', async () => {
  const activeModules = INTELLIGENCE_MODULES.filter((m) => m.status === 'live' || m.status === 'partial');

  for (const entry of activeModules) {
    if (!entry.loadContract) {
      continue;
    }

    const contract = await entry.loadContract();
    assert.ok(contract, `Module ${entry.key} contract must resolve`);
    assert.equal(contract.key, entry.key, `Contract key must match registry key for ${entry.key}`);
    assert.ok(contract.label, `Contract ${contract.key} must have label`);
    assert.ok(contract.accent, `Contract ${contract.key} must have accent color`);
    assert.ok(contract.grain, `Contract ${contract.key} must have grain definition`);
    assert.ok(contract.nouns?.singular, `Contract ${contract.key} must have singular noun`);
    assert.ok(contract.nouns?.plural, `Contract ${contract.key} must have plural noun`);
    assert.equal(typeof contract.load, 'function', `Contract ${contract.key} must have a load function`);
    assert.ok(contract.sections, `Contract ${contract.key} must have sections`);
    assert.ok(Array.isArray(contract.summaryMetrics), `Contract ${contract.key} summaryMetrics must be an array`);
    assert.ok(contract.emptyState?.title, `Contract ${contract.key} must have emptyState title`);
  }
});

test('liveIntelligenceModules returns all live modules', () => {
  const live = liveIntelligenceModules();
  assert.ok(live.length >= 9, 'Expected at least 9 live intelligence modules');

  const keys = live.map((m) => m.key);

  // The invariants, not a hardcoded roll-call. A list of expected keys has to be
  // edited every time a module's status changes honestly, which teaches whoever
  // sees the failure to edit the list rather than to ask whether the status is
  // right.
  assert.ok(keys.length > 0, 'No module is live');
  assert.ok(keys.includes('fees'), 'Fees is the reference implementation and must be live');

  for (const entry of live) {
    assert.ok(entry.loadContract, `${entry.key} is live but has no contract to load`);
    assert.ok(entry.ladder, `${entry.key} is live but does not say how far up the ladder it reaches`);
    assert.ok(
      ['L3', 'L4', 'L5'].includes(entry.ladder),
      `${entry.key} is live at ${entry.ladder} — live means findings with evidence, which is L3 at least`,
    );
  }

  // A module that is not live must say so by stopping short of findings, by
  // having no contract, or by carrying a note that explains what is missing.
  for (const entry of INTELLIGENCE_MODULES.filter((m) => m.status === 'partial')) {
    assert.ok(
      entry.note || entry.ladder === 'L2',
      `${entry.key} is partial but nothing on it says what is missing`,
    );
  }
});

test('findIntelligenceModule retrieves correct module descriptor', () => {
  const att = findIntelligenceModule('attendance');
  assert.ok(att);
  assert.equal(att?.key, 'attendance');
  assert.equal(att?.status, 'live');

  const nonExistent = findIntelligenceModule('non-existent-module');
  assert.equal(nonExistent, undefined);
});

