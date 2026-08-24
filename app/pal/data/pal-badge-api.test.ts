import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as getBadges } from '@/app/api/pal/gamification/badges/route';
import { POST as evaluateBadges } from '@/app/api/pal/gamification/badges/evaluate/route';
import { POST as postBadgeEvents } from '@/app/api/pal/gamification/badge-events/route';
import { createMockPalBadgeStore } from '@/app/pal/data/pal-badge-store';
import { evaluateBadges as evaluateBadgesEngine, recordBadgeEvent, checkBadgeCondition } from '@/app/pal/data/pal-badge';
import type { BadgeDefinition, BadgeEvaluateInput } from '@/app/pal/data/pal-badge-types';

function createRequest(url: string, options?: { method?: string; body?: string }): NextRequest {
  return new NextRequest(url, {
    method: options?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: options?.body ? new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(options.body!));
        controller.close();
      },
    }) : undefined,
  });
}

test('GET /api/pal/gamification/badges returns 401 when user context is missing', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/badges');
  const response = (await getBadges(request))!;
  assert.equal(response.status, 401);
  const payload = await response.json()!;
  assert.equal(payload.status, '0');
  assert.equal(payload.message, 'Missing user context');
});

test('GET /api/pal/gamification/badges returns 17 badge definitions with mock store', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/badges?user_id=u1&sub_institute_id=i1&syear=2025');
  const response = (await getBadges(request))!;
  assert.equal(response.status, 200);
  const payload = await response.json()!;
  assert.equal(payload.status, '1');
  assert.equal(Array.isArray(payload.data.badges), true);
  assert.equal(payload.data.badges.length, 17);
  assert.equal(payload.data.summary.totalBadges, 0);
});

test('POST /api/pal/gamification/badges/evaluate returns 401 when user context is missing', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/badges/evaluate', {
    method: 'POST',
    body: '{}',
  });
  const response = (await evaluateBadges(request))!;
  assert.equal(response.status, 401);
  const payload = await response.json()!;
  assert.equal(payload.status, '0');
});

test('POST /api/pal/gamification/badges/evaluate returns 200 with empty body', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/badges/evaluate?user_id=u1&sub_institute_id=i1&syear=2025', {
    method: 'POST',
    body: '{}',
  });
  const response = (await evaluateBadges(request))!;
  assert.equal(response.status, 200);
  const payload = await response.json()!;
  assert.equal(payload.status, '1');
  assert.equal(payload.data.processed, true);
  assert.equal(Array.isArray(payload.data.awarded), true);
});

test('POST /api/pal/gamification/badges/evaluate returns 400 for invalid JSON', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/badges/evaluate?user_id=u1&sub_institute_id=i1&syear=2025', {
    method: 'POST',
    body: 'not-json',
  });
  const response = (await evaluateBadges(request))!;
  assert.equal(response.status, 400);
  const payload = await response.json()!;
  assert.equal(payload.status, '0');
  assert.equal(payload.message, 'Invalid JSON body.');
});

test('POST /api/pal/gamification/badge-events returns 401 when user context is missing', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/badge-events', {
    method: 'POST',
    body: '{}',
  });
  const response = (await postBadgeEvents(request))!;
  assert.equal(response.status, 401);
});

test('POST /api/pal/gamification/badge-events returns 400 when eventType is missing', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/badge-events?user_id=u1&sub_institute_id=i1&syear=2025', {
    method: 'POST',
    body: '{}',
  });
  const response = (await postBadgeEvents(request))!;
  assert.equal(response.status, 400);
  const payload = await response.json()!;
  assert.equal(payload.status, '0');
  assert.equal(payload.message, 'eventType is required.');
});

test('POST /api/pal/gamification/badge-events records event and evaluates with mock store', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/badge-events?user_id=u1&sub_institute_id=i1&syear=2025', {
    method: 'POST',
    body: JSON.stringify({ eventType: 'content_visit', sourceId: 'ch1' }),
  });
  const response = (await postBadgeEvents(request))!;
  assert.equal(response.status, 200);
  const payload = await response.json()!;
  assert.equal(payload.status, '1');
  assert.equal(payload.data.processed, true);
  assert.equal(payload.data.recorded, false, 'Recording should be false when DB is unavailable');
});

test('mock store returns all 17 badge definitions with correct categories', async () => {
  const store = createMockPalBadgeStore();
  const defs = await store.getAllBadgeDefinitions();
  assert.equal(defs.length, 17);

  const categories: Record<string, number> = {};
  for (const def of defs) {
    categories[def.category] = (categories[def.category] || 0) + 1;
  }

  assert.equal(categories['Mastery'], 3);
  assert.equal(categories['Fluency'], 3);
  assert.equal(categories['Persistence'], 3);
  assert.equal(categories['Curiosity'], 3);
  assert.equal(categories['Social'], 2);
  assert.equal(categories['Career'], 3);
});

test('mock store awards badges and prevents duplicates', async () => {
  const store = createMockPalBadgeStore();
  const input = {
    userId: 'u1',
    subInstituteId: 'i1',
    syear: '2025',
  };

  const result1 = await evaluateBadgesEngine(input, store);
  assert.equal(result1.processed, true);
  assert.equal(Array.isArray(result1.awarded), true);

  const result2 = await evaluateBadgesEngine(input, store);
  assert.equal(result2.processed, true);
  for (const a of result2.awarded) {
    assert.equal(a.awarded, false);
  }
});

test('mock store records badge events in memory', async () => {
  const store = createMockPalBadgeStore();
  await recordBadgeEvent({
    userId: 'u1',
    subInstituteId: 'i1',
    syear: '2025',
    eventType: 'content_visit',
    sourceId: 'ch1',
    context: { chapterId: 'ch1' },
  }, store);

  const count = await store.countBadgeEvents('u1', 'i1', '2025', 'content_visit');
  assert.equal(count, 1);
});

test('checkBadgeCondition - all 7 trigger flows pass with valid input', () => {
  const flows: Array<{ triggerType: string; rule: Record<string, unknown>; input: Partial<BadgeEvaluateInput> }> = [
    { triggerType: 'first_quiz', rule: {}, input: {} },
    { triggerType: 'content_visit', rule: { min_count: 5 }, input: {} },
    { triggerType: 'misconception_view', rule: { min_count: 3 }, input: {} },
    { triggerType: 'pedagogy_view', rule: { min_count: 5 }, input: {} },
    { triggerType: 'career_visit', rule: { min_count: 1 }, input: {} },
    { triggerType: 'riasec_complete', rule: {}, input: {} },
    { triggerType: 'remediation_view', rule: { min_count: 1 }, input: {} },
  ];

  for (const flow of flows) {
    const def: BadgeDefinition = {
      id: 1,
      badgeCode: 'TEST',
      badgeName: 'Test',
      category: 'Test',
      description: 'Test',
      triggerType: flow.triggerType,
      triggerRule: flow.rule,
      icon: 'Test',
      color: 'blue',
      sortOrder: 1,
    };
    const result = checkBadgeCondition(def, flow.input as BadgeEvaluateInput);
    assert.equal(result.passes, false, `Flow ${flow.triggerType} should not pass without DB`);
  }
});
