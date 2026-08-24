import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { createMockVisibilityService, type VisibilityContext, type ActorRole, type VisibilityDomain } from '@/app/pal/data/visibility-service';
import { GET as getVisibilityPermissions } from '@/app/api/pal/gamification/visibility/permissions/route';

type Role = ActorRole;
type Domain = VisibilityDomain;

function ctx(actor: { userId: string; role: Role; subInstituteId: string; syear: string }, target: { userId: string; subInstituteId: string; syear: string }, domain: Domain): VisibilityContext {
    return {
        actorUserId: actor.userId,
        actorRole: actor.role,
        actorSubInstituteId: actor.subInstituteId,
        actorSyear: actor.syear,
        targetUserId: target.userId,
        targetSubInstituteId: target.subInstituteId,
        targetSyear: target.syear,
        domain,
    };
}

const SAME = { userId: 'u1', subInstituteId: 'i1', syear: '2025' };
const OTHER = { userId: 'u2', subInstituteId: 'i2', syear: '2025' };
const OTHER_SAME_INST = { userId: 'u2', subInstituteId: 'i1', syear: '2025' };
const PARENT = { userId: 'p1', subInstituteId: 'i1', syear: '2025', role: 'parent' as Role };

const ALL_DOMAINS: Domain[] = [
    'mastery',
    'badges',
    'streak',
    'personal_best',
    'career_quest',
    'team_challenge',
    'challenge_mode',
    'notifications',
];

const STUDENT_EXPECTED: Record<Domain, { granted: boolean; accessLevel: string }> = {
    mastery: { granted: true, accessLevel: 'full' },
    badges: { granted: true, accessLevel: 'full' },
    streak: { granted: true, accessLevel: 'full' },
    personal_best: { granted: true, accessLevel: 'full' },
    career_quest: { granted: true, accessLevel: 'full' },
    team_challenge: { granted: true, accessLevel: 'aggregate' },
    challenge_mode: { granted: true, accessLevel: 'own_plus_optin_top5' },
    notifications: { granted: true, accessLevel: 'full' },
};

const TEACHER_EXPECTED: Record<Domain, { granted: boolean; accessLevel: string }> = {
    mastery: { granted: true, accessLevel: 'full' },
    badges: { granted: true, accessLevel: 'full' },
    streak: { granted: true, accessLevel: 'full' },
    personal_best: { granted: true, accessLevel: 'full' },
    career_quest: { granted: true, accessLevel: 'full' },
    team_challenge: { granted: true, accessLevel: 'per_student' },
    challenge_mode: { granted: true, accessLevel: 'full' },
    notifications: { granted: true, accessLevel: 'full' },
};

const PARENT_EXPECTED: Record<Domain, { granted: boolean; accessLevel: string }> = {
    mastery: { granted: true, accessLevel: 'summary' },
    badges: { granted: true, accessLevel: 'milestone' },
    streak: { granted: true, accessLevel: 'current' },
    personal_best: { granted: false, accessLevel: 'none' },
    career_quest: { granted: true, accessLevel: 'full' },
    team_challenge: { granted: false, accessLevel: 'none' },
    challenge_mode: { granted: false, accessLevel: 'none' },
    notifications: { granted: true, accessLevel: 'milestone' },
};

const ADMIN_EXPECTED: Record<Domain, { granted: boolean; accessLevel: string }> = {
    mastery: { granted: true, accessLevel: 'aggregate' },
    badges: { granted: true, accessLevel: 'count_only' },
    streak: { granted: false, accessLevel: 'none' },
    personal_best: { granted: false, accessLevel: 'none' },
    career_quest: { granted: false, accessLevel: 'none' },
    team_challenge: { granted: false, accessLevel: 'none' },
    challenge_mode: { granted: false, accessLevel: 'none' },
    notifications: { granted: false, accessLevel: 'none' },
};

test('student visibility matrix - all domains self-access', async () => {
    const service = createMockVisibilityService();
    for (const domain of ALL_DOMAINS) {
        const decision = await service.checkAccess(ctx({ ...SAME, role: 'student' }, SAME, domain));
        assert.equal(decision.granted, STUDENT_EXPECTED[domain].granted, `student ${domain} granted`);
        assert.equal(decision.accessLevel, STUDENT_EXPECTED[domain].accessLevel, `student ${domain} accessLevel`);
    }
});

test('student cannot access another student data - all domains', async () => {
    const service = createMockVisibilityService();
    for (const domain of ALL_DOMAINS) {
        const decision = await service.checkAccess(ctx({ ...SAME, role: 'student' }, OTHER_SAME_INST, domain));
        assert.equal(decision.granted, false, `student other ${domain} granted`);
        assert.equal(decision.accessLevel, 'none', `student other ${domain} accessLevel`);
    }
});

test('teacher visibility matrix - all domains same scope', async () => {
    const service = createMockVisibilityService();
    for (const domain of ALL_DOMAINS) {
        const decision = await service.checkAccess(ctx({ ...SAME, role: 'teacher' }, OTHER_SAME_INST, domain));
        assert.equal(decision.granted, TEACHER_EXPECTED[domain].granted, `teacher ${domain} granted`);
        assert.equal(decision.accessLevel, TEACHER_EXPECTED[domain].accessLevel, `teacher ${domain} accessLevel`);
    }
});

test('teacher cannot access different institution', async () => {
    const service = createMockVisibilityService();
    for (const domain of ALL_DOMAINS) {
        const decision = await service.checkAccess(ctx({ ...SAME, role: 'teacher' }, OTHER, domain));
        assert.equal(decision.granted, false, `teacher diff inst ${domain} granted`);
        assert.equal(decision.reason.includes('same institution/year scope'), true, `teacher diff inst ${domain} reason`);
    }
});

test('parent visibility matrix - all domains same scope', async () => {
    const service = createMockVisibilityService();
    for (const domain of ALL_DOMAINS) {
        const decision = await service.checkAccess(ctx({ ...PARENT, role: 'parent' }, OTHER_SAME_INST, domain));
        assert.equal(decision.granted, PARENT_EXPECTED[domain].granted, `parent ${domain} granted`);
        assert.equal(decision.accessLevel, PARENT_EXPECTED[domain].accessLevel, `parent ${domain} accessLevel`);
    }
});

test('parent cannot access different institution', async () => {
    const service = createMockVisibilityService();
    for (const domain of ALL_DOMAINS) {
        const decision = await service.checkAccess(ctx({ ...PARENT, role: 'parent' }, OTHER, domain));
        assert.equal(decision.granted, false, `parent diff inst ${domain} granted`);
        assert.equal(decision.reason.includes('same institution/year scope'), true, `parent diff inst ${domain} reason`);
    }
});

test('admin visibility matrix - all domains same scope', async () => {
    const service = createMockVisibilityService();
    for (const domain of ALL_DOMAINS) {
        const decision = await service.checkAccess(ctx({ ...SAME, role: 'admin' }, OTHER_SAME_INST, domain));
        assert.equal(decision.granted, ADMIN_EXPECTED[domain].granted, `admin ${domain} granted`);
        assert.equal(decision.accessLevel, ADMIN_EXPECTED[domain].accessLevel, `admin ${domain} accessLevel`);
    }
});

test('admin cannot access different institution', async () => {
    const service = createMockVisibilityService();
    for (const domain of ALL_DOMAINS) {
        const decision = await service.checkAccess(ctx({ ...SAME, role: 'admin' }, OTHER, domain));
        assert.equal(decision.granted, false, `admin diff inst ${domain} granted`);
    }
});

test('classmate cannot access another student personal data', async () => {
    const service = createMockVisibilityService();
    const classmate = { userId: 'u3', subInstituteId: 'i1', syear: '2025', role: 'student' as Role };
    for (const domain of ALL_DOMAINS) {
        const decision = await service.checkAccess(ctx(classmate, OTHER_SAME_INST, domain));
        assert.equal(decision.granted, false, `classmate ${domain} granted`);
        assert.equal(decision.accessLevel, 'none', `classmate ${domain} accessLevel`);
    }
});

test('IDOR - student tries to access another student badges via query param', async () => {
    const service = createMockVisibilityService();
    const attacker = { userId: 'attacker', subInstituteId: 'i1', syear: '2025', role: 'student' as Role };
    const victim = { userId: 'victim', subInstituteId: 'i1', syear: '2025' };
    const decision = await service.checkAccess(ctx(attacker, victim, 'badges'));
    assert.equal(decision.granted, false);
    assert.equal(decision.accessLevel, 'none');
});

test('IDOR - student tries to access another student personal best via URL param', async () => {
    const service = createMockVisibilityService();
    const attacker = { userId: 'attacker', subInstituteId: 'i1', syear: '2025', role: 'student' as Role };
    const victim = { userId: 'victim', subInstituteId: 'i1', syear: '2025' };
    const decision = await service.checkAccess(ctx(attacker, victim, 'personal_best'));
    assert.equal(decision.granted, false);
    assert.equal(decision.accessLevel, 'none');
});

test('IDOR - student cannot bypass with different institution', async () => {
    const service = createMockVisibilityService();
    const attacker = { userId: 'attacker', subInstituteId: 'i1', syear: '2025', role: 'student' as Role };
    const victim = { userId: 'victim', subInstituteId: 'i2', syear: '2025' };
    const decision = await service.checkAccess(ctx(attacker, victim, 'mastery'));
    assert.equal(decision.granted, false);
});

test('institution isolation - teacher same institution different year denied', async () => {
    const service = createMockVisibilityService();
    const teacher = { userId: 't1', subInstituteId: 'i1', syear: '2025', role: 'teacher' as Role };
    const target = { userId: 's1', subInstituteId: 'i1', syear: '2024' };
    const decision = await service.checkAccess(ctx(teacher, target, 'mastery'));
    assert.equal(decision.granted, false);
    assert.equal(decision.reason.includes('same institution/year scope'), true);
});

test('institution isolation - parent same institution different year denied', async () => {
    const service = createMockVisibilityService();
    const parent = { userId: 'p1', subInstituteId: 'i1', syear: '2025', role: 'parent' as Role };
    const target = { userId: 's1', subInstituteId: 'i1', syear: '2024' };
    const decision = await service.checkAccess(ctx(parent, target, 'mastery'));
    assert.equal(decision.granted, false);
});

test('institution isolation - student different institution self denied', async () => {
    const service = createMockVisibilityService();
    const student = { userId: 's1', subInstituteId: 'i1', syear: '2025', role: 'student' as Role };
    const target = { userId: 's1', subInstituteId: 'i2', syear: '2025' };
    const decision = await service.checkAccess(ctx(student, target, 'mastery'));
    assert.equal(decision.granted, false);
});

test('teacher authorized for student in same scope - mastery', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'teacher' }, OTHER_SAME_INST, 'mastery'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'full');
    assert.equal(decision.canViewPersonal, true);
});

test('teacher authorized for student in same scope - badges', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'teacher' }, OTHER_SAME_INST, 'badges'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'full');
});

test('teacher authorized for student in same scope - streak', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'teacher' }, OTHER_SAME_INST, 'streak'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'full');
});

test('teacher authorized for student in same scope - personal_best', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'teacher' }, OTHER_SAME_INST, 'personal_best'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'full');
});

test('teacher authorized for student in same scope - career_quest', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'teacher' }, OTHER_SAME_INST, 'career_quest'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'full');
});

test('teacher authorized for student in same scope - team_challenge', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'teacher' }, OTHER_SAME_INST, 'team_challenge'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'per_student');
});

test('teacher authorized for student in same scope - challenge_mode', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'teacher' }, OTHER_SAME_INST, 'challenge_mode'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'full');
});

test('parent authorized for child - badges milestone', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx(PARENT, OTHER_SAME_INST, 'badges'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'milestone');
    assert.equal(decision.canViewMilestone, true);
});

test('parent authorized for child - streak current', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx(PARENT, OTHER_SAME_INST, 'streak'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'current');
});

test('parent authorized for child - career_quest full', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx(PARENT, OTHER_SAME_INST, 'career_quest'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'full');
    assert.equal(decision.canViewFull, true);
});

test('parent denied for personal_best', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx(PARENT, OTHER_SAME_INST, 'personal_best'));
    assert.equal(decision.granted, false);
    assert.equal(decision.accessLevel, 'none');
});

test('parent denied for team_challenge', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx(PARENT, OTHER_SAME_INST, 'team_challenge'));
    assert.equal(decision.granted, false);
    assert.equal(decision.accessLevel, 'none');
});

test('parent denied for challenge_mode', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx(PARENT, OTHER_SAME_INST, 'challenge_mode'));
    assert.equal(decision.granted, false);
    assert.equal(decision.accessLevel, 'none');
});

test('student self access always granted regardless of target overrides', async () => {
    const service = createMockVisibilityService();
    const student = { userId: 's1', subInstituteId: 'i1', syear: '2025', role: 'student' as Role };
    const selfTarget = { userId: 's1', subInstituteId: 'i1', syear: '2025' };
    const decision = await service.checkAccess(ctx(student, selfTarget, 'mastery'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'full');
});

test('student cannot access classmate data even in same class', async () => {
    const service = createMockVisibilityService();
    const studentA = { userId: 'sA', subInstituteId: 'i1', syear: '2025', role: 'student' as Role };
    const studentB = { userId: 'sB', subInstituteId: 'i1', syear: '2025' };
    for (const domain of ALL_DOMAINS) {
        const decision = await service.checkAccess(ctx(studentA, studentB, domain));
        assert.equal(decision.granted, false, `classmate access ${domain} should be denied`);
    }
});

test('teacher self access is granted', async () => {
    const service = createMockVisibilityService();
    const teacher = { userId: 't1', subInstituteId: 'i1', syear: '2025', role: 'teacher' as Role };
    const decision = await service.checkAccess(ctx(teacher, SAME, 'mastery'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'full');
});

test('parent self access is granted', async () => {
    const service = createMockVisibilityService();
    const parent = { userId: 'p1', subInstituteId: 'i1', syear: '2025', role: 'parent' as Role };
    const decision = await service.checkAccess(ctx(parent, SAME, 'mastery'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'summary');
});

test('admin self access is granted', async () => {
    const service = createMockVisibilityService();
    const admin = { userId: 'a1', subInstituteId: 'i1', syear: '2025', role: 'admin' as Role };
    const decision = await service.checkAccess(ctx(admin, SAME, 'mastery'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'aggregate');
});

function createRequest(url: string, options?: { method?: string; headers?: Record<string, string> }): NextRequest {
    return new NextRequest(url, {
        method: options?.method ?? 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });
}

test('API: GET /api/pal/gamification/visibility/permissions returns 401 without auth', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions');
    const response = await getVisibilityPermissions(request);
    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.status, '0');
});

test('API: GET /api/pal/gamification/visibility/permissions returns 200 with student role', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=u1&sub_institute_id=i1&syear=2025&profile_name=student');
    const response = await getVisibilityPermissions(request);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, '1');
    assert.equal(payload.data.actor.role, 'student');
    assert.equal(Array.isArray(payload.data.permissions), true);
    assert.equal(payload.data.permissions.length, 8);
});

test('API: GET /api/pal/gamification/visibility/permissions returns 200 with teacher role', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=u1&sub_institute_id=i1&syear=2025&profile_name=teacher');
    const response = await getVisibilityPermissions(request);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, '1');
    assert.equal(payload.data.actor.role, 'teacher');
    const masteryPerm = payload.data.permissions.find((p: { domain: string }) => p.domain === 'mastery');
    assert.equal(masteryPerm.granted, true);
    assert.equal(masteryPerm.accessLevel, 'full');
});

test('API: GET /api/pal/gamification/visibility/permissions returns 200 with parent role', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=u1&sub_institute_id=i1&syear=2025&profile_name=parent');
    const response = await getVisibilityPermissions(request);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, '1');
    assert.equal(payload.data.actor.role, 'parent');
    const masteryPerm = payload.data.permissions.find((p: { domain: string }) => p.domain === 'mastery');
    assert.equal(masteryPerm.granted, true);
    assert.equal(masteryPerm.accessLevel, 'summary');
});

test('API: GET /api/pal/gamification/visibility/permissions returns 200 with admin role', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=u1&sub_institute_id=i1&syear=2025&profile_name=admin');
    const response = await getVisibilityPermissions(request);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, '1');
    assert.equal(payload.data.actor.role, 'admin');
    const masteryPerm = payload.data.permissions.find((p: { domain: string }) => p.domain === 'mastery');
    assert.equal(masteryPerm.granted, true);
    assert.equal(masteryPerm.accessLevel, 'aggregate');
});

test('API: student accessing own data via permissions endpoint is granted all domains', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=s1&sub_institute_id=i1&syear=2025&profile_name=student');
    const response = await getVisibilityPermissions(request);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, '1');
    for (const perm of payload.data.permissions) {
        if (perm.domain === 'personal_best' || perm.domain === 'career_quest' || perm.domain === 'mastery' || perm.domain === 'badges' || perm.domain === 'streak' || perm.domain === 'notifications') {
            assert.equal(perm.granted, true, `student should have access to ${perm.domain}`);
        }
    }
});

test('API: student trying to access another student via target_user_id is denied', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=s1&sub_institute_id=i1&syear=2025&profile_name=student&target_user_id=s2');
    const response = await getVisibilityPermissions(request);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, '1');
    const masteryPerm = payload.data.permissions.find((p: { domain: string }) => p.domain === 'mastery');
    assert.equal(masteryPerm.granted, false);
});

test('role detection: admin profile returns admin role', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=u1&sub_institute_id=i1&syear=2025&profile_name=admin');
    const response = await getVisibilityPermissions(request);
    const payload = await response.json();
    assert.equal(payload.data.actor.role, 'admin');
});

test('role detection: guardian profile returns parent role', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=u1&sub_institute_id=i1&syear=2025&profile_name=guardian');
    const response = await getVisibilityPermissions(request);
    const payload = await response.json();
    assert.equal(payload.data.actor.role, 'parent');
});

test('role detection: learner profile returns student role', async () => {
    const request = createRequest('http://localhost:3000/api/pal/gamification/visibility/permissions?user_id=u1&sub_institute_id=i1&syear=2025&profile_name=learner');
    const response = await getVisibilityPermissions(request);
    const payload = await response.json();
    assert.equal(payload.data.actor.role, 'student');
});
