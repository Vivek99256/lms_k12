import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as getPermissions } from '@/app/api/pal/gamification/visibility/permissions/route';
import { GET as getStudentVisibility } from '@/app/api/pal/gamification/visibility/student/[studentId]/route';

function createRequest(url: string, options?: { method?: string; headers?: Record<string, string> }): NextRequest {
    return new NextRequest(url, {
        method: options?.method ?? 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });
}

test('visibility/permissions returns 401 without auth', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions');
    const response = await getPermissions(request);
    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.status, '0');
});

test('visibility/permissions returns 200 with student auth', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=s1&sub_institute_id=i1&syear=2025&profile_name=student');
    const response = await getPermissions(request);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, '1');
    assert.equal(payload.data.actor.role, 'student');
});

test('visibility/permissions returns 200 with teacher auth', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=t1&sub_institute_id=i1&syear=2025&profile_name=teacher');
    const response = await getPermissions(request);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, '1');
    assert.equal(payload.data.actor.role, 'teacher');
});

test('visibility/permissions returns 200 with parent auth', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=p1&sub_institute_id=i1&syear=2025&profile_name=parent');
    const response = await getPermissions(request);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, '1');
    assert.equal(payload.data.actor.role, 'parent');
});

test('visibility/permissions returns 200 with admin auth', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=a1&sub_institute_id=i1&syear=2025&profile_name=admin');
    const response = await getPermissions(request);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, '1');
    assert.equal(payload.data.actor.role, 'admin');
});

test('student accessing own visibility is allowed', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/student/s1?user_id=s1&sub_institute_id=i1&syear=2025&profile_name=student');
    const response = await getStudentVisibility(request, { params: Promise.resolve({ studentId: 's1' }) });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, '1');
    assert.equal(payload.data.studentId, 's1');
});

test('student accessing another student visibility is denied', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/student/s2?user_id=s1&sub_institute_id=i1&syear=2025&profile_name=student');
    const response = await getStudentVisibility(request, { params: Promise.resolve({ studentId: 's2' }) });
    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload.status, '0');
});

test('teacher accessing authorized student visibility is allowed', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/student/s1?user_id=t1&sub_institute_id=i1&syear=2025&profile_name=teacher');
    const response = await getStudentVisibility(request, { params: Promise.resolve({ studentId: 's1' }) });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, '1');
});

test('cross-institution student access is denied', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/student/s1?user_id=s1&sub_institute_id=i1&syear=2025&profile_name=student&target_sub_institute_id=i2');
    const response = await getPermissions(request);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, '1');
    const masteryPerm = payload.data.permissions.find((p: { domain: string }) => p.domain === 'mastery');
    assert.equal(masteryPerm.granted, false);
});

test('cross-institution teacher access is denied', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=t1&sub_institute_id=i1&syear=2025&profile_name=teacher&target_sub_institute_id=i2');
    const response = await getPermissions(request);
    assert.equal(response.status, 200);
    const payload = await response.json();
    const masteryPerm = payload.data.permissions.find((p: { domain: string }) => p.domain === 'mastery');
    assert.equal(masteryPerm.granted, false);
});

test('different academic year access is denied for teacher', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=t1&sub_institute_id=i1&syear=2025&profile_name=teacher&target_syear=2024');
    const response = await getPermissions(request);
    assert.equal(response.status, 200);
    const payload = await response.json();
    const masteryPerm = payload.data.permissions.find((p: { domain: string }) => p.domain === 'mastery');
    assert.equal(masteryPerm.granted, false);
});

test('guardian profile is detected as parent', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=p1&sub_institute_id=i1&syear=2025&profile_name=guardian');
    const response = await getPermissions(request);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.data.actor.role, 'parent');
});

test('learner profile is detected as student', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=s1&sub_institute_id=i1&syear=2025&profile_name=learner');
    const response = await getPermissions(request);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.data.actor.role, 'student');
});
