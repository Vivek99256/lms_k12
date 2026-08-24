import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as getVisibilityPermissions } from '@/app/api/pal/gamification/visibility/permissions/route';

function createRequest(url: string, options?: { method?: string; headers?: Record<string, string> }): NextRequest {
    return new NextRequest(url, {
        method: options?.method ?? 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });
}

test('GET /api/pal/gamification/visibility/permissions returns 401 without auth', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions');
    const response = await getVisibilityPermissions(request);
    assert.equal(response?.status, 401);
    const payload = await response?.json();
    assert.equal(payload?.status, '0');
});

test('GET /api/pal/gamification/visibility/permissions returns permissions with valid query params', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=u1&sub_institute_id=i1&syear=2025&profile_name=student');
    const response = await getVisibilityPermissions(request);
    assert.equal(response?.status, 200);
    const payload = await response?.json();
    assert.equal(payload?.status, '1');
    assert.equal(Array.isArray(payload?.data?.permissions), true);
    assert.equal(payload?.data?.permissions?.length, 8);
    assert.equal(payload?.data?.actor?.role, 'student');
});

test('GET /api/pal/gamification/visibility/permissions returns teacher permissions', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=u1&sub_institute_id=i1&syear=2025&profile_name=teacher');
    const response = await getVisibilityPermissions(request);
    assert.equal(response?.status, 200);
    const payload = await response?.json();
    assert.equal(payload?.status, '1');
    assert.equal(payload?.data?.actor?.role, 'teacher');
    const masteryPerm = payload?.data?.permissions?.find((p: { domain: string }) => p.domain === 'mastery');
    assert.equal(masteryPerm?.granted, true);
    assert.equal(masteryPerm?.accessLevel, 'full');
});

test('GET /api/pal/gamification/visibility/permissions returns parent permissions', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=u1&sub_institute_id=i1&syear=2025&profile_name=parent');
    const response = await getVisibilityPermissions(request);
    assert.equal(response?.status, 200);
    const payload = await response?.json();
    assert.equal(payload?.status, '1');
    assert.equal(payload?.data?.actor?.role, 'parent');
    const masteryPerm = payload?.data?.permissions?.find((p: { domain: string }) => p.domain === 'mastery');
    assert.equal(masteryPerm?.granted, true);
    assert.equal(masteryPerm?.accessLevel, 'summary');
    const challengePerm = payload?.data?.permissions?.find((p: { domain: string }) => p.domain === 'challenge_mode');
    assert.equal(challengePerm?.granted, true);
    assert.equal(challengePerm?.accessLevel, 'none');
});

test('GET /api/pal/gamification/visibility/permissions returns admin permissions', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=u1&sub_institute_id=i1&syear=2025&profile_name=admin');
    const response = await getVisibilityPermissions(request);
    assert.equal(response?.status, 200);
    const payload = await response?.json();
    assert.equal(payload?.status, '1');
    assert.equal(payload?.data?.actor?.role, 'admin');
    const masteryPerm = payload?.data?.permissions?.find((p: { domain: string }) => p.domain === 'mastery');
    assert.equal(masteryPerm?.granted, true);
    assert.equal(masteryPerm?.accessLevel, 'aggregate');
});
