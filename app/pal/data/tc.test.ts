import test from 'node:test';
import assert from 'node:assert/strict';
import { createPalTcService } from './tc';
import { createMockPalTcStore } from './tc-store';
import type { PalTcStore } from './tc-store';
import type {
    TeamChallengeRow,
    TeamChallengeParticipantRow,
    TeamChallengeContributionRow,
    TeamChallengeProgressRow,
    ChallengeContext,
    TeamChallengeCreateData,
    TeamChallengeUpdateData,
    ContributionInput,
} from './tc-types';

function makeCtx(): ChallengeContext {
    return { sub_institute_id: 1, syear: 2025, user_id: 100 };
}

function makeStore(overrides: Partial<PalTcStore> = {}): PalTcStore {
    const base = createMockPalTcStore();
    return { ...base, ...overrides };
}

const TEST_CHALLENGE: TeamChallengeRow = {
    id: 1,
    title: 'Mastery Sprint #1',
    description: 'Race to master 50 concepts',
    challenge_type: 'mastery_sprint' as const,
    target_type: 'concepts_mastered' as const,
    target_value: 50,
    reward_type: 'points' as const,
    reward_value: '100',
    status: 'active' as const,
    created_by: 1,
    sub_institute_id: 1,
    syear: 2025,
    grade_id: 5,
    standard_id: 10,
    division_id: 2,
    start_date: new Date('2026-08-01'),
    deadline: new Date('2026-08-31'),
    ended_at: null,
    created_at: new Date(),
    updated_at: new Date(),
};

const TEST_PROGRESS: TeamChallengeProgressRow = {
    id: 1,
    team_challenge_id: 1,
    total_participants: 3,
    active_contributors: 2,
    aggregate_value: 25,
    target_value: 50,
    progress_percentage: 50,
    status: 'in_progress' as const,
    last_updated: new Date(),
    updated_at: new Date(),
};

const TEST_PARTICIPANT: TeamChallengeParticipantRow = {
    id: 1,
    team_challenge_id: 1,
    user_id: 100,
    sub_institute_id: 1,
    syear: 2025,
    joined_at: new Date(),
    status: 'active' as const,
};

const TEST_CONTRIBUTION: TeamChallengeContributionRow = {
    id: 1,
    team_challenge_id: 1,
    user_id: 100,
    sub_institute_id: 1,
    syear: 2025,
    event_type: 'mastery' as const,
    source_id: 'concept_42',
    value: 5,
    idempotency_key: 'test_key_1',
    status: 'counted' as const,
    created_at: new Date(),
    updated_at: new Date(),
};

test('fetchTeamChallenges returns mapped challenges with progress', async () => {
    const store = makeStore({
        fetchChallenges: async () => [TEST_CHALLENGE],
        fetchProgress: async () => TEST_PROGRESS,
        fetchParticipants: async () => [TEST_PARTICIPANT],
    });
    const service = createPalTcService(store);
    const result = await service.fetchTeamChallenges(makeCtx());

    assert.equal(result.length, 1);
    assert.equal(result[0].title, 'Mastery Sprint #1');
    assert.equal(result[0].progress.progress_percentage, 50);
    assert.equal(result[0].progress.aggregate_value, 25);
    assert.equal(result[0].progress.target_value, 50);
    assert.equal(result[0].progress.is_completed, false);
    assert.equal(result[0].progress.status, 'in_progress');
    assert.equal(result[0].participant_count, 1);
    assert.equal(result[0].can_join, false);
    assert.equal(result[0].can_contribute, true);
});

test('fetchTeamChallenges marks progress as completed at 100%', async () => {
    const completedProgress: TeamChallengeProgressRow = {
        ...TEST_PROGRESS,
        progress_percentage: 100,
        status: 'completed' as const,
        aggregate_value: 50,
    };
    const store = makeStore({
        fetchChallenges: async () => [TEST_CHALLENGE],
        fetchProgress: async () => completedProgress,
        fetchParticipants: async () => [TEST_PARTICIPANT],
    });
    const service = createPalTcService(store);
    const result = await service.fetchTeamChallenges(makeCtx());

    assert.equal(result[0].progress.is_completed, true);
    assert.equal(result[0].progress.status, 'completed');
    assert.equal(result[0].can_join, false);
});

test('fetchTeamChallenges with draft status is not joinable', async () => {
    const draftChallenge: TeamChallengeRow = { ...TEST_CHALLENGE, status: 'draft' as const };
    const store = makeStore({
        fetchChallenges: async () => [draftChallenge],
        fetchProgress: async () => TEST_PROGRESS,
        fetchParticipants: async () => [],
    });
    const service = createPalTcService(store);
    const result = await service.fetchTeamChallenges(makeCtx());

    assert.equal(result[0].can_join, false);
    assert.equal(result[0].can_contribute, false);
});

test('fetchChallengeDetail returns full detail with participants and contributions', async () => {
    const store = makeStore({
        fetchChallengeById: async () => TEST_CHALLENGE,
        fetchParticipants: async () => [TEST_PARTICIPANT],
        fetchProgress: async () => TEST_PROGRESS,
        fetchContributions: async () => [TEST_CONTRIBUTION],
    });
    const service = createPalTcService(store);
    const detail = await service.fetchChallengeDetail(1, makeCtx());

    assert.ok(detail);
    assert.equal(detail!.challenge.title, 'Mastery Sprint #1');
    assert.equal(detail!.participants.length, 1);
    assert.equal(detail!.participants[0].user_id, 100);
    assert.equal(detail!.progress?.progress_percentage, 50);
    assert.equal(detail!.contributions.length, 1);
    assert.equal(detail!.contributions[0].event_type, 'mastery');
    assert.equal(detail!.contributions[0].value, 5);
});

test('fetchChallengeDetail returns null when challenge not found', async () => {
    const store = makeStore({
        fetchChallengeById: async () => null,
    });
    const service = createPalTcService(store);
    const detail = await service.fetchChallengeDetail(999, makeCtx());
    assert.equal(detail, null);
});

test('createTeamChallenge delegates to store and returns id', async () => {
    const captured: { data: TeamChallengeCreateData | null } = { data: null };
    const store = makeStore({
        createChallenge: async (data: TeamChallengeCreateData) => {
            captured.data = data;
            return 42;
        },
    });
    const service = createPalTcService(store);
    const id = await service.createTeamChallenge(
        { title: 'New Challenge', challenge_type: 'mastery_sprint', target_type: 'concepts_mastered', target_value: 100 },
        makeCtx()
    );

    assert.equal(id, 42);
    assert.equal(captured.data?.title, 'New Challenge');
});

test('updateTeamChallenge delegates to store', async () => {
    const captured: { id: number; data: TeamChallengeUpdateData | null } = { id: 0, data: null };
    const store = makeStore({
        updateChallenge: async (id: number, data: TeamChallengeUpdateData) => {
            captured.id = id;
            captured.data = data;
            return true;
        },
    });
    const service = createPalTcService(store);
    const result = await service.updateTeamChallenge(1, { status: 'ended' as const, ended_at: new Date() }, makeCtx());

    assert.equal(result, true);
    assert.equal(captured.id, 1);
    assert.equal(captured.data?.status, 'ended');
});

test('endTeamChallenge sets status to ended and recomputes progress', async () => {
    const captured: { data: TeamChallengeUpdateData | null } = { data: null };
    const recomputeCalled: { challengeId: number | null } = { challengeId: null };
    const store = makeStore({
        updateChallenge: async (_id: number, data: TeamChallengeUpdateData) => {
            captured.data = data;
            return true;
        },
        recomputeProgress: async (challengeId: number) => {
            recomputeCalled.challengeId = challengeId;
            return {
                id: 1,
                team_challenge_id: challengeId,
                total_participants: 3,
                active_contributors: 2,
                aggregate_value: 25,
                target_value: 50,
                progress_percentage: 50,
                status: 'ended' as const,
                last_updated: new Date(),
                updated_at: new Date(),
            };
        },
    });
    const service = createPalTcService(store);
    const result = await service.endTeamChallenge(1, makeCtx());

    assert.equal(result, true);
    assert.equal(captured.data?.status, 'ended');
    assert.ok(captured.data?.ended_at instanceof Date);
    assert.equal(recomputeCalled.challengeId, 1);
});

test('joinChallenge returns false when challenge not found', async () => {
    const store = makeStore({
        fetchChallengeById: async () => null,
    });
    const service = createPalTcService(store);
    const result = await service.joinChallenge(1, makeCtx());
    assert.equal(result, false);
});

test('joinChallenge returns false when challenge is not active', async () => {
    const draftChallenge: TeamChallengeRow = { ...TEST_CHALLENGE, status: 'draft' as const };
    const store = makeStore({
        fetchChallengeById: async () => draftChallenge,
    });
    const service = createPalTcService(store);
    const result = await service.joinChallenge(1, makeCtx());
    assert.equal(result, false);
});

test('joinChallenge returns true when challenge is active', async () => {
    let joinedChallengeId = 0;
    let joinedUserId = 0;
    const store = makeStore({
        fetchChallengeById: async () => TEST_CHALLENGE,
        addParticipant: async (challengeId, userId) => {
            joinedChallengeId = challengeId;
            joinedUserId = userId;
            return true;
        },
    });
    const service = createPalTcService(store);
    const result = await service.joinChallenge(1, makeCtx());
    assert.equal(result, true);
    assert.equal(joinedChallengeId, 1);
    assert.equal(joinedUserId, 100);
});

test('submitContribution returns null when challenge not found', async () => {
    const store = makeStore({
        fetchChallengeById: async () => null,
    });
    const service = createPalTcService(store);
    const result = await service.submitContribution(1, {
        event_type: 'mastery',
        value: 5,
        idempotency_key: 'key1',
    }, makeCtx());
    assert.equal(result, null);
});

test('submitContribution returns null when user is not a participant', async () => {
    const store = makeStore({
        fetchChallengeById: async () => TEST_CHALLENGE,
        fetchParticipants: async () => [],
    });
    const service = createPalTcService(store);
    const result = await service.submitContribution(1, {
        event_type: 'mastery',
        value: 5,
        idempotency_key: 'key1',
    }, makeCtx());
    assert.equal(result, null);
});

test('submitContribution returns null when challenge is not active', async () => {
    const draftChallenge: TeamChallengeRow = { ...TEST_CHALLENGE, status: 'draft' as const };
    const store = makeStore({
        fetchChallengeById: async () => draftChallenge,
        fetchParticipants: async () => [TEST_PARTICIPANT],
    });
    const service = createPalTcService(store);
    const result = await service.submitContribution(1, {
        event_type: 'mastery',
        value: 5,
        idempotency_key: 'key1',
    }, makeCtx());
    assert.equal(result, null);
});

test('submitContribution records contribution and recomputes progress', async () => {
    const store = makeStore({
        fetchChallengeById: async () => TEST_CHALLENGE,
        fetchParticipants: async () => [TEST_PARTICIPANT],
        recordContribution: async () => TEST_CONTRIBUTION,
        recomputeProgress: async () => ({
            id: 1,
            team_challenge_id: 1,
            total_participants: 3,
            active_contributors: 2,
            aggregate_value: 30,
            target_value: 50,
            progress_percentage: 60,
            status: 'in_progress' as const,
            last_updated: new Date(),
            updated_at: new Date(),
        }),
    });
    const service = createPalTcService(store);
    const result = await service.submitContribution(1, {
        event_type: 'mastery',
        source_id: 'concept_42',
        value: 5,
        idempotency_key: 'test_key_1',
    }, makeCtx());

    assert.ok(result);
    assert.equal(result!.aggregate_value, 30);
    assert.equal(result!.progress_percentage, 60);
    assert.equal(result!.is_completed, false);
});

test('submitContribution builds full input with challengeId and user_id', async () => {
    const captured: { input: ContributionInput | null } = { input: null };
    const store = makeStore({
        fetchChallengeById: async () => TEST_CHALLENGE,
        fetchParticipants: async () => [TEST_PARTICIPANT],
        recordContribution: async (input: ContributionInput) => {
            captured.input = input;
            return TEST_CONTRIBUTION;
        },
        recomputeProgress: async () => ({
            id: 1, team_challenge_id: 1, total_participants: 1,
            active_contributors: 1, aggregate_value: 5, target_value: 50,
            progress_percentage: 10, status: 'in_progress' as const,
            last_updated: new Date(), updated_at: new Date(),
        }),
    });
    const service = createPalTcService(store);
    await service.submitContribution(1, {
        event_type: 'mastery',
        value: 5,
        idempotency_key: 'key1',
    }, makeCtx());

    assert.equal(captured.input?.team_challenge_id, 1);
    assert.equal(captured.input?.user_id, 100);
    assert.equal(captured.input?.event_type, 'mastery');
    assert.equal(captured.input?.idempotency_key, 'key1');
});

test('fetchChallengeProgress returns null when no progress exists', async () => {
    const store = makeStore({
        fetchProgress: async () => null,
    });
    const service = createPalTcService(store);
    const result = await service.fetchChallengeProgress(1, makeCtx());
    assert.equal(result, null);
});

test('fetchChallengeProgress maps progress correctly', async () => {
    const store = makeStore({
        fetchProgress: async () => TEST_PROGRESS,
    });
    const service = createPalTcService(store);
    const result = await service.fetchChallengeProgress(1, makeCtx());

    assert.ok(result);
    assert.equal(result!.progress_percentage, 50);
    assert.equal(result!.aggregate_value, 25);
    assert.equal(result!.total_participants, 3);
    assert.equal(result!.active_contributors, 2);
    assert.equal(result!.is_completed, false);
});

test('fetchTeamChallenges includes can_join=true for non-participant on active challenge', async () => {
    const store = makeStore({
        fetchChallenges: async () => [TEST_CHALLENGE],
        fetchProgress: async () => TEST_PROGRESS,
        fetchParticipants: async () => [],
    });
    const service = createPalTcService(store);
    const result = await service.fetchTeamChallenges(makeCtx());
    assert.equal(result[0].can_join, true);
    assert.equal(result[0].can_contribute, false);
});

test('submitContribution deduplicates by idempotency_key and does not double-count progress', async () => {
    const existingContribution: TeamChallengeContributionRow = {
        ...TEST_CONTRIBUTION,
        idempotency_key: 'dup-key',
        value: 5,
    };
    const store = makeStore({
        fetchChallengeById: async () => TEST_CHALLENGE,
        fetchParticipants: async () => [TEST_PARTICIPANT],
        recordContribution: async (input: ContributionInput) => {
            if (input.idempotency_key === 'dup-key') {
                return existingContribution;
            }
            return { ...TEST_CONTRIBUTION, id: 99, idempotency_key: input.idempotency_key };
        },
        recomputeProgress: async () => ({
            id: 1,
            team_challenge_id: 1,
            total_participants: 1,
            active_contributors: 1,
            aggregate_value: 5,
            target_value: 50,
            progress_percentage: 10,
            status: 'in_progress' as const,
            last_updated: new Date(),
            updated_at: new Date(),
        }),
    });
    const service = createPalTcService(store);

    const first = await service.submitContribution(1, {
        event_type: 'mastery',
        value: 5,
        idempotency_key: 'dup-key',
    }, makeCtx());

    const second = await service.submitContribution(1, {
        event_type: 'mastery',
        value: 5,
        idempotency_key: 'dup-key',
    }, makeCtx());

    assert.ok(first);
    assert.ok(second);
    assert.equal(first!.aggregate_value, 5);
    assert.equal(second!.aggregate_value, 5);
    assert.equal(first!.progress_percentage, 10);
    assert.equal(second!.progress_percentage, 10);
});

test('submitContribution rejects contributions for ended challenge', async () => {
    const endedChallenge: TeamChallengeRow = { ...TEST_CHALLENGE, status: 'ended' as const };
    const store = makeStore({
        fetchChallengeById: async () => endedChallenge,
        fetchParticipants: async () => [TEST_PARTICIPANT],
    });
    const service = createPalTcService(store);
    const result = await service.submitContribution(1, {
        event_type: 'mastery',
        value: 5,
        idempotency_key: 'key1',
    }, makeCtx());
    assert.equal(result, null);
});

test('submitContribution rejects contributions for completed challenge', async () => {
    const completedChallenge: TeamChallengeRow = { ...TEST_CHALLENGE, status: 'completed' as const };
    const store = makeStore({
        fetchChallengeById: async () => completedChallenge,
        fetchParticipants: async () => [TEST_PARTICIPANT],
    });
    const service = createPalTcService(store);
    const result = await service.submitContribution(1, {
        event_type: 'mastery',
        value: 5,
        idempotency_key: 'key1',
    }, makeCtx());
    assert.equal(result, null);
});

test('teacher can create, update, and end challenge through service', async () => {
    const captured: { create: TeamChallengeCreateData | null; update: TeamChallengeUpdateData | null } = { create: null, update: null };
    const store = makeStore({
        fetchChallengeById: async () => TEST_CHALLENGE,
        createChallenge: async (data: TeamChallengeCreateData) => {
            captured.create = data;
            return 42;
        },
        updateChallenge: async (_id: number, data: TeamChallengeUpdateData) => {
            captured.update = data;
            return true;
        },
        recomputeProgress: async () => ({
            id: 1,
            team_challenge_id: 1,
            total_participants: 1,
            active_contributors: 1,
            aggregate_value: 5,
            target_value: 50,
            progress_percentage: 10,
            status: 'ended' as const,
            last_updated: new Date(),
            updated_at: new Date(),
        }),
    });
    const service = createPalTcService(store);
    const teacherCtx = makeCtx();

    const createResult = await service.createTeamChallenge({
        title: 'Teacher Challenge',
        challenge_type: 'mastery_sprint',
        target_type: 'concepts_mastered',
        target_value: 50,
    }, teacherCtx);
    assert.equal(createResult, 42);
    assert.equal(captured.create?.title, 'Teacher Challenge');

    const updateResult = await service.updateTeamChallenge(1, { status: 'ended' as const, ended_at: new Date() }, teacherCtx);
    assert.equal(updateResult, true);
    assert.equal(captured.update?.status, 'ended');

    const endResult = await service.endTeamChallenge(1, teacherCtx);
    assert.equal(endResult, true);
});
