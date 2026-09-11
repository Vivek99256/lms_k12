import test from 'node:test';
import assert from 'node:assert/strict';

import { hasExecutor } from './executors';
import { AGENT_MODULES, AGENT_TOOLS, rbacModuleKey, toolsForModule, validateToolsForModule } from './registry';

/**
 * Module scoping is the one promise Create Agent makes that the UI cannot be
 * trusted to keep alone: a Fees tool must never end up on a G2G agent, whichever
 * client built the request.
 */

test('a module is offered its own tools and the shared ones, nothing else', () => {
  const offered = toolsForModule('g2g');
  assert.ok(offered.every((tool) => tool.module === 'g2g' || tool.module === 'shared'));
  assert.ok(offered.some((tool) => tool.key === 'shared.compose_note'));
  assert.ok(!offered.some((tool) => tool.key === 'fees.draft_reminder'));
});

test('an allow-list naming another module’s tool is refused', () => {
  assert.match(validateToolsForModule('g2g', ['fees.draft_reminder']) ?? '', /belongs to fees/);
});

test('an unavailable tool cannot be put on an allow-list', () => {
  assert.match(validateToolsForModule('fees', ['fees.list_defaulters']) ?? '', /not available/);
});

test('an empty or unknown allow-list is refused', () => {
  assert.equal(validateToolsForModule('fees', []), 'Choose at least one tool.');
  assert.match(validateToolsForModule('fees', ['fees.nope']) ?? '', /Unknown tool/);
});

test('a valid allow-list passes, duplicates tolerated', () => {
  assert.equal(validateToolsForModule('fees', ['fees.draft_reminder', 'fees.draft_reminder', 'shared.compose_note']), null);
});

test('every available tool has an executor and every module has a distinct key', () => {
  for (const tool of AGENT_TOOLS) {
    if (tool.available) assert.ok(hasExecutor(tool.key), `${tool.key} is available but has no executor`);
    else assert.ok(!hasExecutor(tool.key), `${tool.key} has an executor but is marked unavailable`);
  }
  assert.equal(new Set(AGENT_MODULES.map((module) => module.key)).size, AGENT_MODULES.length);
});

test('the RBAC key follows agents.<module>', () => {
  assert.equal(rbacModuleKey('fees'), 'agents.fees');
});
