import test from 'node:test';
import assert from 'node:assert/strict';

import { BRAIN_ROUTES, BRAIN_SECTIONS, findBrainScreen, findBrainSection } from './navigation';

/**
 * The sidebar keeps Enterprise Brain expanded, and the Level 3 sub-header shows
 * the right screens, only if the current path resolves to the MOST SPECIFIC
 * section. Overview is routed at /enterprise-brain, a prefix of every other
 * Brain route, so a first-match scan silently answers "Overview" everywhere.
 */

test('a section route resolves to its own section', () => {
  assert.equal(findBrainSection('/enterprise-brain/analytics')?.key, 'analytics');
  assert.equal(findBrainSection('/enterprise-brain/knowledge')?.key, 'knowledge');
  assert.equal(findBrainSection('/enterprise-brain/automation')?.key, 'automation');
});

test('the bare root resolves to Overview', () => {
  assert.equal(findBrainSection('/enterprise-brain')?.key, 'overview');
});

test('a screen route resolves to the section that owns it, not Overview', () => {
  assert.equal(findBrainSection('/enterprise-brain/capabilities')?.key, 'foundation');
  assert.equal(findBrainSection('/enterprise-brain/ingestion')?.key, 'foundation');
  assert.equal(findBrainSection('/enterprise-brain/settings')?.key, 'account');
  assert.equal(findBrainSection('/enterprise-brain/intelligence-loop/signals')?.key, 'intelligence-loop');
  assert.equal(findBrainSection('/enterprise-brain/knowledge/kasba')?.key, 'knowledge');
});

test('a capability detail page stays inside Foundation → Capabilities', () => {
  assert.equal(findBrainSection('/enterprise-brain/capabilities/cap-1-2')?.key, 'foundation');
  assert.equal(findBrainScreen('/enterprise-brain/capabilities/cap-1-2')?.key, 'capabilities');
});

test('a non-Brain path resolves to nothing', () => {
  assert.equal(findBrainSection('/fees/dashboard'), null);
  assert.equal(findBrainSection('/dashboard'), null);
});

test('every screen route is unique and lives under the Brain root', () => {
  const hrefs = BRAIN_SECTIONS.flatMap((section) => section.screens.map((screen) => screen.href));
  assert.equal(new Set(hrefs).size, hrefs.length, 'two screens share a route');
  for (const href of BRAIN_ROUTES) {
    assert.ok(href.startsWith('/enterprise-brain'), `${href} is outside the Brain namespace`);
  }
});

test('every screen resolves back to itself', () => {
  for (const section of BRAIN_SECTIONS) {
    for (const screen of section.screens) {
      assert.equal(findBrainScreen(screen.href)?.key, screen.key, `${screen.href} resolved to the wrong screen`);
    }
  }
});
