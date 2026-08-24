import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as listChallenges, POST as createChallenge } from '@/app/api/pal/gamification/team-challenges/route';
import { GET as getDetail, PATCH as updateChallenge } from '@/app/api/pal/gamification/team-challenges/[id]/route';
import { POST as joinChallenge } from '@/app/api/pal/gamification/team-challenges/[id]/join/route';
import { POST as contribute } from '@/app/api/pal/gamification/team-challenges/[id]/contribute/route';
import { GET as getProgress } from '@/app/api/pal/gamification/team-challenges/[id]/progress/route';
import { POST as endChallenge } from '@/app/api/pal/gamification/team-challenges/[id]/end/route';

const BASE = 'http://localhost:3000';
const CONTEXT = '?user_id=u1&sub_institute_id=i1&syear=2025';

function createRequest(url: string, options?: { method?: string; body?: unknown }): NextRequest {
  return new NextRequest(url, {
    method: options?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: options?.body ? new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(options.body)));
        controller.close();
      },
    }) : undefined,
  });
}

test('GET /team-challenges returns 401 when user context is missing', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges`);
  const response = (await listChallenges(request))!;
  assert.equal(response.status, 401);
  const payload = await response.json();
  assert.equal(payload.status, '0');
  assert.equal(payload.message, 'Unauthorized');
});

test('GET /team-challenges returns 200 with challenges array', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges${CONTEXT}`);
  const response = (await listChallenges(request))!;
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, '1');
  assert.equal(Array.isArray(payload.data.challenges), true);
});

test('GET /team-challenges returns 200 with empty challenges when mock store has no data', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges${CONTEXT}`);
  const response = (await listChallenges(request))!;
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, '1');
  assert.equal(payload.data.challenges.length, 0);
});

test('POST /team-challenges returns 401 when user context is missing', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges`, {
    method: 'POST',
    body: { title: 'Test' },
  });
  const response = (await createChallenge(request))!;
  assert.equal(response.status, 401);
});

test('POST /team-challenges returns 200 with challengeId on valid body', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges${CONTEXT}`, {
    method: 'POST',
    body: {
      title: 'Mastery Sprint',
      challenge_type: 'mastery_sprint',
      target_type: 'concepts_mastered',
      target_value: 50,
    },
  });
  const response = (await createChallenge(request))!;
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, '1');
  assert.equal(payload.data.challengeId, 1);
});

test('POST /team-challenges returns 400 for invalid JSON', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges${CONTEXT}`, {
    method: 'POST',
    body: { _invalid: 'not-json' },
  });
  const req = new NextRequest(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not-json',
  });
  const response = (await createChallenge(req))!;
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.status, '0');
  assert.equal(payload.message, 'Invalid JSON body.');
});

test('GET /team-challenges/{id} returns 401 when user context is missing', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges/1`);
  const response = (await getDetail(request))!;
  assert.equal(response.status, 401);
});

test('GET /team-challenges/{id} returns 400 for invalid id', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges/invalid${CONTEXT}`);
  const response = (await getDetail(request))!;
  assert.equal(response.status, 400);
});

test('GET /team-challenges/{id} returns 404 when challenge not found (mock)', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges/999${CONTEXT}`);
  const response = (await getDetail(request))!;
  assert.equal(response.status, 404);
  const payload = await response.json();
  assert.equal(payload.status, '0');
  assert.equal(payload.message, 'Challenge not found.');
});

test('PATCH /team-challenges/{id} returns 401 when user context is missing', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges/1`, {
    method: 'PATCH',
    body: { title: 'Updated' },
  });
  const response = (await updateChallenge(request))!;
  assert.equal(response.status, 401);
});

test('PATCH /team-challenges/{id} returns 200 with updated flag', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges/1${CONTEXT}`, {
    method: 'PATCH',
    body: { title: 'Updated Title' },
  });
  const response = (await updateChallenge(request))!;
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, '1');
  assert.equal(payload.data.updated, true);
});

test('POST /team-challenges/{id}/join returns 401 when user context is missing', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges/1/join`, {
    method: 'POST',
  });
  const response = (await joinChallenge(request))!;
  assert.equal(response.status, 401);
});

test('POST /team-challenges/{id}/join returns 200 with joined flag (mock)', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges/1/join${CONTEXT}`, {
    method: 'POST',
  });
  const response = (await joinChallenge(request))!;
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, '1');
  assert.equal(payload.data.joined, false);
});

test('POST /team-challenges/{id}/contribute returns 401 when user context is missing', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges/1/contribute`, {
    method: 'POST',
    body: { event_type: 'mastery', idempotency_key: 'key1' },
  });
  const response = (await contribute(request))!;
  assert.equal(response.status, 401);
});

test('POST /team-challenges/{id}/contribute returns 400 when idempotency_key is missing', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges/1/contribute${CONTEXT}`, {
    method: 'POST',
    body: { event_type: 'mastery' },
  });
  const response = (await contribute(request))!;
  assert.equal(response.status, 400);
});

test('POST /team-challenges/{id}/end returns 401 when user context is missing', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges/1/end`, {
    method: 'POST',
  });
  const response = (await endChallenge(request))!;
  assert.equal(response.status, 401);
});

test('POST /team-challenges/{id}/end returns 200 with ended flag', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges/1/end${CONTEXT}`, {
    method: 'POST',
  });
  const response = (await endChallenge(request))!;
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, '1');
  assert.equal(payload.data.ended, true);
});

test('GET /team-challenges/{id}/progress returns 401 when user context is missing', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges/1/progress`);
  const response = (await getProgress(request))!;
  assert.equal(response.status, 401);
});

test('GET /team-challenges/{id}/progress returns 404 when no progress (mock)', async () => {
  const request = createRequest(`${BASE}/api/pal/gamification/team-challenges/999/progress${CONTEXT}`);
  const response = (await getProgress(request))!;
  assert.equal(response.status, 404);
});
