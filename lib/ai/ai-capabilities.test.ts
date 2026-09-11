/**
 * The AI capability registry has to agree with two lists it cannot import.
 *
 * `packages/ai-intelligence-core` is deliberately free of any dependency on this
 * app, so that G2G and Enterprise Brain can consume it. That independence is
 * what makes these assertions necessary: nothing at compile time stops the
 * package from naming a product the shared endpoint would refuse to serve, or
 * from telling a customer a capability is live while Platform Administration
 * says it is coming.
 *
 * So the checks live here, on the app side, where all three lists are reachable.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AI_CAPABILITIES,
  SOLUTIONS,
  SOLUTION_ID_HEADER,
  capabilityHref,
  capabilityStatusLabel,
  getCapabilityBySlug,
} from '@shared/ai-intelligence-core';
import { PROJECT_ID_HEADER, getProjectAdapter, listProjectAdapters } from './project-resolver';
import { getRoadmapItem, roadmapStatusLabel } from '../roadmap';

test('every solution in the package is an adapter the shared endpoint serves', () => {
  for (const solution of SOLUTIONS) {
    const adapter = getProjectAdapter(solution.id);
    assert.ok(adapter, `"${solution.id}" is not registered in lib/ai/project-resolver.ts`);
    assert.equal(adapter.kind, solution.kind, `"${solution.id}" disagrees on host/external`);
  }
});

test('the resolver registers no product the capability registry has forgotten', () => {
  const known = new Set(SOLUTIONS.map((solution) => solution.id));
  for (const adapter of listProjectAdapters()) {
    assert.ok(
      known.has(adapter.projectId as (typeof SOLUTIONS)[number]['id']),
      `"${adapter.projectId}" is served by /api/ai but missing from packages/ai-intelligence-core`,
    );
  }
});

test('both packages name the same cross-product header', () => {
  assert.equal(SOLUTION_ID_HEADER, PROJECT_ID_HEADER);
});

test('a capability that cites a roadmap row agrees with it', () => {
  for (const capability of AI_CAPABILITIES) {
    if (!capability.roadmapId) continue;

    const row = getRoadmapItem(capability.roadmapId);
    assert.ok(row, `${capability.id} cites roadmap row "${capability.roadmapId}", which does not exist`);

    // `pilot` is the one roadmap status no AI capability uses; if that ever
    // changes, widen CapabilityStatus rather than letting the two drift.
    assert.equal(
      capability.status,
      row.status,
      `${capability.id} says "${capability.status}" while the roadmap says "${row.status}"`,
    );
  }
});

test('the package words a status exactly as the roadmap does', () => {
  // The package cannot import lib/roadmap — that is what makes it portable — so
  // the two label maps are separate copies. This is what keeps them one wording.
  for (const status of ['live', 'in-progress', 'coming-soon'] as const) {
    assert.equal(capabilityStatusLabel(status), roadmapStatusLabel(status));
  }
});

test('ids, slugs and names are unique', () => {
  for (const field of ['id', 'slug', 'name'] as const) {
    const values = AI_CAPABILITIES.map((capability) => capability[field]);
    assert.equal(new Set(values).size, values.length, `duplicate ${field} in the capability registry`);
  }
});

test('slugs are URL-safe and resolve back to their capability', () => {
  for (const capability of AI_CAPABILITIES) {
    assert.match(capability.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, `"${capability.slug}" is not a clean URL segment`);
    assert.equal(getCapabilityBySlug(capability.slug)?.id, capability.id);
  }
});

test('every capability describes every product', () => {
  for (const capability of AI_CAPABILITIES) {
    for (const solution of SOLUTIONS) {
      const consumption = capability.solutions[solution.id];
      assert.ok(consumption, `${capability.id} says nothing about ${solution.id}`);
      assert.ok(consumption.use.trim().length > 0, `${capability.id} has an empty use for ${solution.id}`);
    }
  }
});

test('a capability with no screen falls back to the shared console route', () => {
  for (const capability of AI_CAPABILITIES) {
    const href = capabilityHref(capability);
    assert.ok(href.startsWith('/'), `${capability.id} has a non-absolute href`);
    if (!capability.href) assert.equal(href, `/ai/${capability.slug}`);
  }
});

test('a live capability points at a real screen', () => {
  // Marking something live with nowhere to go is the failure this codebase has
  // hit repeatedly in the other direction — see the roadmap registry's note on
  // never labelling working features as unbuilt. Both errors mislead.
  for (const capability of AI_CAPABILITIES) {
    if (capability.status !== 'live') continue;
    assert.ok(capability.href, `${capability.id} is marked live but has no screen to open`);
  }
});
