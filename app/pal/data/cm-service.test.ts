import test from 'node:test';
import assert from 'node:assert/strict';
import { createPalCmService } from './cm';
import { createMockPalCmStore } from './cm-store';
import type { PalCmStore } from './cm-store';
import type {
    ChallengeRow,
    ChallengeOptInRow,
    ChallengeAttemptRow,
    ChallengeLeaderboardRow,
    ChallengeContext,
} from './cm-types';

function makeCtx(): ChallengeContext {
    return { sub_institute_id: 'inst-1', syear: '2025', user_id: 'student-1' };
}

function makeStore(overrides: Partial<PalCmStore> = {}): PalCmStore {
    return { ...createMockPalCmStore(), ...overrides };
}

const NOW = new Date('2026-08-18T12:00:00Z');

function makeChallengeRow(overrides: Partial<ChallengeRow> = {}): ChallengeRow {
    return {
        id: 1,
        title: 'Speed Challenge',
        description: 'Test challenge',
        subject_id: 'math',
        concept_id: 'algebra',
        difficulty: 'hard',
        target_time_seconds: 30,
        item_count: 10,
        is_active: true,
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-12-31'),
        created_by: 99,
        sub_institute_id: 'inst-1',
        syear: '2025',
        created_at: NOW,
        updated_at: NOW,
        ...overrides,
    };
}

function makeOptInRow(overrides: Partial<ChallengeOptInRow> = {}): ChallengeOptInRow {
    return {
        id: 1,
        user_id: 'student-1',
        sub_institute_id: 'inst-1',
        syear: '2025',
        is_opted_in: true,
        opted_in_at: NOW,
        opted_out_at: null,
        created_at: NOW,
        updated_at: NOW,
        ...overrides,
    };
}

function makeAttemptRow(overrides: Partial<ChallengeAttemptRow> = {}): ChallengeAttemptRow {
    return {
        id: 1,
        challenge_id: 1,
        user_id: 'student-1',
        sub_institute_id: 'inst-1',
        syear: '2025',
        opt_in_id: 1,
        started_at: NOW,
        completed_at: null,
        total_items: 10,
        valid_responses: 0,
        correct_responses: 0,
        accuracy: 0,
        avg_time_per_item: 0,
        speed_ratio: 0,
        difficulty_coefficient: 0,
        raw_score: 0,
        is_qualified: false,
        attempt_status: 'in_progress',
        created_at: NOW,
        updated_at: NOW,
        ...overrides,
    };
}

test('getStudentChallengeStatus - not opted in returns hasOptedIn false', async () => {
    const store = makeStore({
        getOptInStatus: async () => null,
        fetchAvailableChallenges: async () => [],
    });
    const service = createPalCmService(store);
    const status = await service.getStudentChallengeStatus(makeCtx());
    assert.equal(status.hasOptedIn, false);
    assert.equal(status.optIn, null);
});

test('getStudentChallengeStatus - opted in returns hasOptedIn true', async () => {
    const store = makeStore({
        getOptInStatus: async () => makeOptInRow(),
        fetchAvailableChallenges: async () => [makeChallengeRow()],
    });
    const service = createPalCmService(store);
    const status = await service.getStudentChallengeStatus(makeCtx());
    assert.equal(status.hasOptedIn, true);
    assert.ok(status.optIn);
    assert.equal(status.availableChallenges.length, 1);
});

test('setChallengeOptIn - creates opt-in record', async () => {
    const optInRow = makeOptInRow({ is_opted_in: true });
    const store = makeStore({
        getOptInStatus: async () => null,
        setOptIn: async () => optInRow,
    });
    const service = createPalCmService(store);
    const result = await service.setChallengeOptIn('student-1', true, makeCtx());
    assert.equal(result.is_opted_in, true);
});

test('setChallengeOptIn - idempotent when already opted in', async () => {
    const existing = makeOptInRow({ is_opted_in: true });
    const store = makeStore({
        getOptInStatus: async () => existing,
        setOptIn: async () => existing,
    });
    const service = createPalCmService(store);
    const result = await service.setChallengeOptIn('student-1', true, makeCtx());
    assert.equal(result.is_opted_in, true);
});

test('setChallengeOptOut - sets is_opted_in to false', async () => {
    const optedOut = makeOptInRow({ is_opted_in: false, opted_out_at: NOW });
    const store = makeStore({
        getOptInStatus: async () => makeOptInRow(),
        setOptIn: async () => optedOut,
    });
    const service = createPalCmService(store);
    const result = await service.setChallengeOptOut('student-1', makeCtx());
    assert.equal(result.is_opted_in, false);
});

test('startAttempt - returns null if not opted in', async () => {
    const store = makeStore({
        fetchChallengeById: async () => makeChallengeRow(),
        getOptInStatus: async () => null,
    });
    const service = createPalCmService(store);
    const attempt = await service.startAttempt(1, makeCtx());
    assert.equal(attempt, null);
});

test('startAttempt - returns null if challenge not available', async () => {
    const store = makeStore({
        fetchChallengeById: async () => makeChallengeRow({ is_active: false }),
        getOptInStatus: async () => makeOptInRow(),
    });
    const service = createPalCmService(store);
    const attempt = await service.startAttempt(1, makeCtx());
    assert.equal(attempt, null);
});

test('startAttempt - creates attempt for opted-in student', async () => {
    const attemptRow = makeAttemptRow();
    const store = makeStore({
        fetchChallengeById: async () => makeChallengeRow(),
        getOptInStatus: async () => makeOptInRow(),
        getInProgressAttempt: async () => null,
        createAttempt: async () => attemptRow,
    });
    const service = createPalCmService(store);
    const attempt = await service.startAttempt(1, makeCtx());
    assert.ok(attempt);
    assert.equal(attempt.attempt_status, 'in_progress');
});

test('startAttempt - returns existing in-progress attempt', async () => {
    const existing = makeAttemptRow();
    const store = makeStore({
        fetchChallengeById: async () => makeChallengeRow(),
        getOptInStatus: async () => makeOptInRow(),
        getInProgressAttempt: async () => existing,
    });
    const service = createPalCmService(store);
    const attempt = await service.startAttempt(1, makeCtx());
    assert.ok(attempt);
    assert.equal(attempt.id, existing.id);
});

test('submitResponse - throws for non-in-progress attempt', async () => {
    const store = makeStore({
        getAttemptById: async () => makeAttemptRow({ attempt_status: 'completed' }),
    });
    const service = createPalCmService(store);
    let threw = false;
    try {
        await service.submitResponse(1, { question_id: 'q1', is_correct: true, response_time: 5, difficulty: 3, target_time: 30 }, makeCtx());
    } catch {
        threw = true;
    }
    assert.equal(threw, true);
});

test('completeAttempt - calculates score and marks completed', async () => {
    const completed = makeAttemptRow({ attempt_status: 'completed', raw_score: 100, is_qualified: true });
    const store = makeStore({
        getAttemptById: async () => makeAttemptRow(),
        fetchChallengeById: async () => makeChallengeRow(),
        completeAttempt: async () => completed,
        getStudentDisplayNames: async () => new Map([['student-1', 'Student']]),
        upsertLeaderboardEntry: async () => makeLeaderboardRow(),
    });
    const service = createPalCmService(store);
    const result = await service.completeAttempt(1, [
        { question_id: null, is_correct: true, response_time: 10, difficulty: 3, target_time: 30 },
        { question_id: null, is_correct: true, response_time: 12, difficulty: 3, target_time: 30 },
        { question_id: null, is_correct: true, response_time: 8, difficulty: 3, target_time: 30 },
        { question_id: null, is_correct: true, response_time: 15, difficulty: 3, target_time: 30 },
        { question_id: null, is_correct: true, response_time: 11, difficulty: 3, target_time: 30 },
    ], makeCtx());
    assert.equal(result.attempt.attempt_status, 'completed');
    assert.ok(result.scoring.raw_score >= 0);
});

test('completeAttempt - fewer than 5 responses does not qualify', async () => {
    const completed = makeAttemptRow({ attempt_status: 'completed', raw_score: 50, is_qualified: false });
    const store = makeStore({
        getAttemptById: async () => makeAttemptRow(),
        fetchChallengeById: async () => makeChallengeRow(),
        completeAttempt: async () => completed,
        getStudentDisplayNames: async () => new Map(),
        upsertLeaderboardEntry: async () => makeLeaderboardRow(),
    });
    const service = createPalCmService(store);
    const result = await service.completeAttempt(1, [
        { question_id: null, is_correct: true, response_time: 10, difficulty: 3, target_time: 30 },
        { question_id: null, is_correct: true, response_time: 12, difficulty: 3, target_time: 30 },
    ], makeCtx());
    assert.equal(result.scoring.is_qualified, false);
    assert.equal(result.scoring.valid_responses, 2);
});

test('getWeeklyLeaderboard - returns top 5 entries', async () => {
    const store = makeStore({
        getLeaderboard: async () => [
            makeLeaderboardRow({ id: 1, rank: 1, score: 100 }),
            makeLeaderboardRow({ id: 2, rank: 2, score: 90 }),
            makeLeaderboardRow({ id: 3, rank: 3, score: 80 }),
        ],
    });
    const service = createPalCmService(store);
    const entries = await service.getWeeklyLeaderboard(1, new Date('2026-08-17'), makeCtx());
    assert.equal(entries.length, 3);
    assert.equal(entries[0].rank, 1);
});

test('getStudentLeaderboardForTeacher - filters by studentIds', async () => {
    const store = makeStore({
        getQualifiedAttemptsForLeaderboard: async () => [
            { attempt: makeAttemptRow({ user_id: 'student-1', raw_score: 100, is_qualified: true }), display_name: 'Alice' },
            { attempt: makeAttemptRow({ user_id: 'student-2', raw_score: 80, is_qualified: true }), display_name: 'Bob' },
        ],
    });
    const service = createPalCmService(store);
    const entries = await service.getStudentLeaderboardForTeacher(['student-1'], 1, new Date('2026-08-17'), makeCtx());
    assert.equal(entries.length, 1);
    assert.equal(entries[0].user_id, 'student-1');
    assert.equal(entries[0].display_name, 'Alice');
});

test('getStudentLeaderboardForTeacher - returns empty for empty studentIds', async () => {
    const store = makeStore({
        getQualifiedAttemptsForLeaderboard: async () => [],
    });
    const service = createPalCmService(store);
    const entries = await service.getStudentLeaderboardForTeacher([], 1, new Date('2026-08-17'), makeCtx());
    assert.equal(entries.length, 0);
});

test('getStudentChallengeHistory - returns completed attempts', async () => {
    const store = makeStore({
        getStudentChallengeHistory: async () => [
            makeAttemptRow({ id: 1, attempt_status: 'completed' }),
            makeAttemptRow({ id: 2, attempt_status: 'completed' }),
        ],
    });
    const service = createPalCmService(store);
    const attempts = await service.getStudentChallengeHistory(makeCtx());
    assert.equal(attempts.length, 2);
    assert.equal(attempts[0].attempt_status, 'completed');
});

function makeLeaderboardRow(overrides: Partial<ChallengeLeaderboardRow> = {}): ChallengeLeaderboardRow {
    return {
        id: 1,
        challenge_id: 1,
        user_id: 'student-1',
        sub_institute_id: 'inst-1',
        syear: '2025',
        week_start: new Date('2026-08-17'),
        week_number: 34,
        year_number: 2026,
        score: 100,
        rank: 1,
        is_qualified: true,
        display_name: 'Student',
        created_at: NOW,
        updated_at: NOW,
        ...overrides,
    };
}
