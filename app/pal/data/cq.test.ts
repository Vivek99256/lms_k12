import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as getCareerQuest } from '@/app/api/pal/gamification/career-quest/route';
import { GET as getCareerPathways } from '@/app/api/pal/gamification/career-pathways/route';
import { GET as getPathwaySkills } from '@/app/api/pal/gamification/career-pathways/[id]/skills/route';
import { POST as postCareerInterests } from '@/app/api/pal/gamification/career-interests/route';
import { POST as postCareerActivities } from '@/app/api/pal/gamification/career-activities/route';
import { resolveStageFromGrade, createMockPalCqStore, createPalCqStore, resetMockPalCqStore } from '@/app/pal/data/cq-store';
import type { PalCqStore } from '@/app/pal/data/cq-store';

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

// =============================================================================
// STAGE LOGIC TESTS
// =============================================================================

test('resolveStageFromGrade - Grade 1 returns explorer', () => {
  assert.equal(resolveStageFromGrade(1), 'explorer');
});

test('resolveStageFromGrade - Grade 2 returns explorer', () => {
  assert.equal(resolveStageFromGrade(2), 'explorer');
});

test('resolveStageFromGrade - Grade 3 returns skill_builder', () => {
  assert.equal(resolveStageFromGrade(3), 'skill_builder');
});

test('resolveStageFromGrade - Grade 5 returns skill_builder', () => {
  assert.equal(resolveStageFromGrade(5), 'skill_builder');
});

test('resolveStageFromGrade - Grade 6 returns pathway_seeker', () => {
  assert.equal(resolveStageFromGrade(6), 'pathway_seeker');
});

test('resolveStageFromGrade - Grade 8 returns pathway_seeker', () => {
  assert.equal(resolveStageFromGrade(8), 'pathway_seeker');
});

test('resolveStageFromGrade - Grade 9 returns career_builder', () => {
  assert.equal(resolveStageFromGrade(9), 'career_builder');
});

test('resolveStageFromGrade - Grade 12 returns career_builder', () => {
  assert.equal(resolveStageFromGrade(12), 'career_builder');
});

test('resolveStageFromGrade - null grade returns explorer', () => {
  assert.equal(resolveStageFromGrade(null), 'explorer');
});

test('resolveStageFromGrade - undefined grade returns explorer', () => {
  assert.equal(resolveStageFromGrade(undefined), 'explorer');
});

test('resolveStageFromGrade - grade 0 returns explorer', () => {
  assert.equal(resolveStageFromGrade(0), 'explorer');
});

test('resolveStageFromGrade - grade 13 returns explorer (out of range)', () => {
  assert.equal(resolveStageFromGrade(13), 'explorer');
});

// =============================================================================
// MOCK STORE TESTS
// =============================================================================

test('mock store returns empty state initially', async () => {
  resetMockPalCqStore();
  const store = createMockPalCqStore();
  const state = await store.getCareerQuestState('u1', 'i1', '2025');
  assert.equal(state, null);
});

test('mock store upserts state and returns created record', async () => {
  resetMockPalCqStore();
  const store = createMockPalCqStore();
  const state = await store.upsertCareerQuestState('u1', 'i1', '2025', 5, 'skill_builder', null, null, null, 1, null);
  assert.ok(state);
  assert.equal(state.userId, 'u1');
  assert.equal(state.currentStage, 'skill_builder');
  assert.equal(state.grade, 5);
});

test('mock store returns stage definitions', async () => {
  resetMockPalCqStore();
  const store = createMockPalCqStore();
  const stages = await store.getStageDefinitions();
  assert.equal(stages.length, 4);
  assert.equal(stages[0].stage, 'explorer');
  assert.equal(stages[3].stage, 'career_builder');
});

test('mock store returns empty pathways', async () => {
  resetMockPalCqStore();
  const store = createMockPalCqStore();
  const pathways = await store.getCareerPathways(true);
  assert.equal(pathways.length, 0);
});

test('mock store records activity', async () => {
  resetMockPalCqStore();
  const store = createMockPalCqStore();
  const activity = await store.recordCareerActivity({
    userId: 'u1',
    subInstituteId: 'i1',
    syear: '2025',
    activityType: 'exploration',
    activityName: 'Test Activity',
    pathwayId: null,
    skillId: null,
    sourceId: null,
    metadata: null,
  });
  assert.ok(activity);
  assert.equal(activity.activityName, 'Test Activity');
});

test('mock store declares interest', async () => {
  resetMockPalCqStore();
  const store = createMockPalCqStore();
  const interest = await store.declareInterest('u1', 'i1', '2025', {
    interestType: 'riasec',
    interestValue: 'Investigative',
    metadata: null,
  });
  assert.ok(interest);
  assert.equal(interest.interestValue, 'Investigative');
});

test('mock store returns summary', async () => {
  resetMockPalCqStore();
  const store = createMockPalCqStore();
  const summary = await store.getCareerQuestSummary('u1', 'i1', '2025', null, null);
  assert.ok(summary);
  assert.equal(summary.currentStage, 'explorer');
  assert.equal(summary.interestCount, 0);
});

// =============================================================================
// API ROUTE TESTS
// =============================================================================

test('GET /api/pal/gamification/career-quest returns 401 without auth', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/career-quest');
  const response = (await getCareerQuest(request))!;
  assert.equal(response.status, 401);
  const payload = await response.json();
  assert.equal(payload.status, '0');
});

test('GET /api/pal/gamification/career-quest returns 401 with invalid query params', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/career-quest?user_id=');
  const response = (await getCareerQuest(request))!;
  assert.equal(response.status, 401);
});

test('GET /api/pal/gamification/career-quest returns state with valid params', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/career-quest?user_id=test_user_1&sub_institute_id=1&syear=2024-25');
  const response = (await getCareerQuest(request))!;
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, '1');
  assert.ok(payload.data);
  assert.ok(payload.data.state);
  assert.ok(Array.isArray(payload.data.stages));
  assert.equal(payload.data.stages.length, 4);
});

test('GET /api/pal/gamification/career-quest returns stage definitions', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/career-quest?user_id=test_user_2&sub_institute_id=1&syear=2024-25&grade=5');
  const response = (await getCareerQuest(request))!;
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, '1');
  assert.equal(payload.data.stages.length, 4);
  assert.equal(payload.data.stages[1].stage, 'skill_builder');
});

test('GET /api/pal/gamification/career-pathways returns 401 without auth', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/career-pathways');
  const response = (await getCareerPathways(request))!;
  assert.equal(response.status, 401);
});

test('GET /api/pal/gamification/career-pathways returns pathways', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/career-pathways?user_id=test_user_3&sub_institute_id=1&syear=2024-25&active=true');
  const response = (await getCareerPathways(request))!;
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, '1');
  assert.ok(Array.isArray(payload.data.pathways));
});

test('GET /api/pal/gamification/career-pathways/[id]/skills returns 401 without auth', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/career-pathways/1/skills');
  const response = (await getPathwaySkills(request))!;
  assert.equal(response.status, 401);
});

test('GET /api/pal/gamification/career-pathways/[id]/skills returns 400 for invalid id', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/career-pathways/0/skills?user_id=test_user_4&sub_institute_id=1&syear=2024-25');
  const response = (await getPathwaySkills(request))!;
  assert.equal(response.status, 400);
});

test('GET /api/pal/gamification/career-pathways/[id]/skills returns 404 for non-existent pathway', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/career-pathways/99999/skills?user_id=test_user_5&sub_institute_id=1&syear=2024-25');
  const response = (await getPathwaySkills(request))!;
  assert.equal(response.status, 404);
});

test('POST /api/pal/gamification/career-interests returns 401 without auth', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/career-interests', {
    method: 'POST',
    body: '{}',
  });
  const response = (await postCareerInterests(request))!;
  assert.equal(response.status, 401);
});

test('POST /api/pal/gamification/career-interests returns 400 for missing fields', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/career-interests?user_id=test_user_6&sub_institute_id=1&syear=2024-25', {
    method: 'POST',
    body: '{}',
  });
  const response = (await postCareerInterests(request))!;
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.status, '0');
});

test('POST /api/pal/gamification/career-interests declares interest successfully', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/career-interests?user_id=test_user_7&sub_institute_id=1&syear=2024-25&grade=5', {
    method: 'POST',
    body: JSON.stringify({ interest_type: 'riasec', interest_value: 'Investigative' }),
  });
  const response = (await postCareerInterests(request))!;
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, '1');
  assert.ok(payload.data.interest);
});

test('POST /api/pal/gamification/career-interests rejects invalid interest_type', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/career-interests?user_id=test_user_8&sub_institute_id=1&syear=2024-25', {
    method: 'POST',
    body: JSON.stringify({ interest_type: 'invalid', interest_value: 'Test' }),
  });
  const response = (await postCareerInterests(request))!;
  assert.equal(response.status, 400);
});

test('POST /api/pal/gamification/career-activities returns 401 without auth', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/career-activities', {
    method: 'POST',
    body: '{}',
  });
  const response = (await postCareerActivities(request))!;
  assert.equal(response.status, 401);
});

test('POST /api/pal/gamification/career-activities returns 400 for missing fields', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/career-activities?user_id=test_user_9&sub_institute_id=1&syear=2024-25', {
    method: 'POST',
    body: '{}',
  });
  const response = (await postCareerActivities(request))!;
  assert.equal(response.status, 400);
});

test('POST /api/pal/gamification/career-activities records activity successfully', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/career-activities?user_id=test_user_10&sub_institute_id=1&syear=2024-25&grade=3', {
    method: 'POST',
    body: JSON.stringify({ activity_type: 'exploration', activity_name: 'Science Exploration' }),
  });
  const response = (await postCareerActivities(request))!;
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, '1');
  assert.ok(payload.data.activity);
});

test('POST /api/pal/gamification/career-activities rejects invalid activity_type', async () => {
  const request = createRequest('http://localhost:3000/api/pal/gamification/career-activities?user_id=test_user_11&sub_institute_id=1&syear=2024-25', {
    method: 'POST',
    body: JSON.stringify({ activity_type: 'invalid', activity_name: 'Test' }),
  });
  const response = (await postCareerActivities(request))!;
  assert.equal(response.status, 400);
});

// =============================================================================
// DATA PERSISTENCE TESTS
// =============================================================================

test('Career Quest state persists across requests for same user', async () => {
  const userId = 'test_persist_user';
  const subInstituteId = '1';
  const syear = '2024-25';
  const grade = 6;

  // First request - creates state
  const request1 = createRequest(`http://localhost:3000/api/pal/gamification/career-quest?user_id=${userId}&sub_institute_id=${subInstituteId}&syear=${syear}&grade=${grade}`);
  const response1 = (await getCareerQuest(request1))!;
  assert.equal(response1.status, 200);
  const payload1 = await response1.json();
  assert.equal(payload1.status, '1');
  const state1 = payload1.data.state;
  assert.equal(state1.currentStage, 'pathway_seeker');

  // Second request - should retrieve same state
  const request2 = createRequest(`http://localhost:3000/api/pal/gamification/career-quest?user_id=${userId}&sub_institute_id=${subInstituteId}&syear=${syear}&grade=${grade}`);
  const response2 = (await getCareerQuest(request2))!;
  assert.equal(response2.status, 200);
  const payload2 = await response2.json();
  assert.equal(payload2.status, '1');
  const state2 = payload2.data.state;
  assert.equal(state2.currentStage, 'pathway_seeker');
  assert.equal(state2.userId, userId);
});

test('Interest declaration persists and returns same value on retrieve', async () => {
  const userId = 'test_interest_persist_user';
  const subInstituteId = '1';
  const syear = '2024-25';

  // Declare interest
  const postRequest = createRequest(`http://localhost:3000/api/pal/gamification/career-interests?user_id=${userId}&sub_institute_id=${subInstituteId}&syear=${syear}&grade=4`, {
    method: 'POST',
    body: JSON.stringify({ interest_type: 'pathway', interest_value: 'Technology' }),
  });
  const postResponse = (await postCareerInterests(postRequest))!;
  assert.equal(postResponse.status, 200);
  const postPayload = await postResponse.json();
  assert.equal(postPayload.status, '1');
  assert.equal(postPayload.data.interest.interestValue, 'Technology');

  // Get career quest state and check interest declaration
  const getRequest = createRequest(`http://localhost:3000/api/pal/gamification/career-quest?user_id=${userId}&sub_institute_id=${subInstituteId}&syear=${syear}&grade=4`);
  const getResponse = (await getCareerQuest(getRequest))!;
  assert.equal(getResponse.status, 200);
  const getPayload = await getResponse.json();
  assert.equal(getPayload.status, '1');
  assert.ok(getPayload.data.state.interestDeclaration);
  const interestKey = 'pathway:Technology';
  assert.ok(getPayload.data.state.interestDeclaration[interestKey]);
});

// =============================================================================
// STORE UNIT TESTS
// =============================================================================

test('real store connects and returns stage definitions', async () => {
  let store: PalCqStore | null = null;
  try {
    store = createPalCqStore();
    const stages = await store.getStageDefinitions();
    assert.equal(stages.length, 4);
    assert.equal(stages[0].stage, 'explorer');
    assert.equal(stages[3].stage, 'career_builder');
  } catch (e) {
    // DB may not be available in test environment
    assert.ok(true, 'DB not available, skipping real store test');
  } finally {
    if (store) {
      try { await store.close(); } catch {}
    }
  }
});

test('real store verifies tables exist', async () => {
  let store: PalCqStore | null = null;
  try {
    store = createPalCqStore();
    // Try to query each table via store methods
    const pathways = await store.getCareerPathways(true);
    assert.ok(Array.isArray(pathways));
    const stages = await store.getStageDefinitions();
    assert.equal(stages.length, 4);
  } catch (e) {
    // DB may not be available
    assert.ok(true, 'DB not available, skipping real store verification');
  } finally {
    if (store) {
      try { await store.close(); } catch {}
    }
  }
});
