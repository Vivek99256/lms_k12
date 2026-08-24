import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockVisibilityService, type VisibilityContext, type ActorRole, type VisibilityDomain } from '@/app/pal/data/visibility-service';

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

test('student accessing own mastery is granted full', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'student' }, SAME, 'mastery'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'full');
    assert.equal(decision.canViewFull, true);
});

test('student accessing other student mastery is denied', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'student' }, OTHER_SAME_INST, 'mastery'));
    assert.equal(decision.granted, false);
    assert.equal(decision.accessLevel, 'none');
});

test('teacher accessing student in same scope is granted full', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'teacher' }, OTHER_SAME_INST, 'mastery'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'full');
});

test('teacher accessing student in different scope is denied', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'teacher' }, OTHER, 'mastery'));
    assert.equal(decision.granted, false);
    assert.equal(decision.reason.includes('same institution/year scope'), true);
});

test('parent accessing child in same scope is granted summary for mastery', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'parent' }, OTHER_SAME_INST, 'mastery'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'summary');
});

test('parent accessing own profile is granted (self-access)', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'parent' }, SAME, 'mastery'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'summary');
});

test('admin accessing student in same scope gets aggregate for mastery', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'admin' }, OTHER_SAME_INST, 'mastery'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'aggregate');
    assert.equal(decision.canViewPersonal, false);
});

test('admin has no access to streak data', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'admin' }, OTHER_SAME_INST, 'streak'));
    assert.equal(decision.granted, false);
    assert.equal(decision.accessLevel, 'none');
});

test('parent has no access to personal_best', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'parent' }, OTHER_SAME_INST, 'personal_best'));
    assert.equal(decision.granted, false);
    assert.equal(decision.accessLevel, 'none');
});

test('parent has full access to career_quest for child', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'parent' }, OTHER_SAME_INST, 'career_quest'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'full');
});

test('teacher gets per_student for team_challenge', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'teacher' }, OTHER_SAME_INST, 'team_challenge'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'per_student');
});

test('student gets own_plus_optin_top5 for challenge_mode', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'student' }, SAME, 'challenge_mode'));
    assert.equal(decision.granted, true);
    assert.equal(decision.accessLevel, 'own_plus_optin_top5');
});

test('admin has no access to challenge_mode', async () => {
    const service = createMockVisibilityService();
    const decision = await service.checkAccess(ctx({ ...SAME, role: 'admin' }, OTHER_SAME_INST, 'challenge_mode'));
    assert.equal(decision.granted, false);
    assert.equal(decision.accessLevel, 'none');
});
