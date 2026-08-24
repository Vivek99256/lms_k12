import test from 'node:test';
import assert from 'node:assert/strict';
import { createPalSsService } from '@/app/pal/data/ss';
import { createMockSessionSummaryStore } from '@/app/pal/data/ss-store';
import type { PalPbStore } from '@/app/pal/data/pal-pb-store';
import type { PalCqStore } from '@/app/pal/data/cq-store';
import type { SessionSummaryStore } from '@/app/pal/data/ss-types';

function makeStore(overrides: Partial<SessionSummaryStore> = {}): SessionSummaryStore {
    return { ...createMockSessionSummaryStore(), ...overrides };
}

const NOW = '2026-08-18T12:00:00Z';

function makePbStore(overrides: Partial<PalPbStore> = {}): PalPbStore {
    return {
        getStreakRecord: async () => ({ currentStreak: 5, longestStreak: 12, lastActivityDate: '2026-08-17' }),
        getNotifications: async () => [],
        ...overrides,
    } as unknown as PalPbStore;
}

function makeCqStore(overrides: Partial<PalCqStore> = {}): PalCqStore {
    return {
        getCareerQuestState: async () => ({ id: 1, userId: 'u1', subInstituteId: 'i1', syear: '2025', grade: 5, currentStage: 'skill_builder', primaryPathwayId: 1, secondaryPathwayId: null, interestDeclaration: null, questLevel: 1, progressInfo: null, createdAt: NOW, updatedAt: NOW }),
        getCareerQuestSummary: async () => ({ currentStage: 'skill_builder', stageLabel: 'Skill Builder', stageDescription: 'Grow your skill tree.', activityCount: 2, masteredSkillCount: 1, totalSkillCount: 5 }),
        ...overrides,
    } as unknown as PalCqStore;
}

function makeSummaryRow(overrides: Partial<{ id: number; sessionId: string; userId: string; subInstituteId: string; syear: string; sessionStart: string | null; sessionEnd: string | null; completionState: string; totalConcepts: number; totalQuestions: number; obtainMarks: number; totalMarks: number; accuracy: number; createdAt: string; updatedAt: string }> = {}) {
    return {
        id: 1,
        sessionId: 'qp-1',
        userId: 'u1',
        subInstituteId: 'i1',
        syear: '2025',
        sessionStart: '2026-08-18T10:00:00Z',
        sessionEnd: '2026-08-18T10:30:00Z',
        completionState: 'completed',
        totalConcepts: 2,
        totalQuestions: 10,
        obtainMarks: 8,
        totalMarks: 10,
        accuracy: 80,
        createdAt: NOW,
        updatedAt: NOW,
        ...overrides,
    };
}

function makeConceptRow(overrides: Partial<{ id: number; summaryId: number; conceptId: string | null; conceptName: string; masteryBefore: number; masteryAfter: number; masteryChange: number; accuracy: number; attempted: number; correct: number; sortOrder: number; createdAt: string }> = {}) {
    return {
        id: 1,
        summaryId: 1,
        conceptId: 'c1',
        conceptName: 'Fractions',
        masteryBefore: 60,
        masteryAfter: 75,
        masteryChange: 15,
        accuracy: 80,
        attempted: 5,
        correct: 4,
        sortOrder: 0,
        createdAt: NOW,
        ...overrides,
    };
}

function makePraiseRow(overrides: Partial<{ id: number; summaryId: number; praiseText: string; reason: string; sourceType: string | null; conceptName: string | null; sortOrder: number; createdAt: string }> = {}) {
    return {
        id: 1,
        summaryId: 1,
        praiseText: 'You improved your mastery of Fractions from 60% to 75%.',
        reason: 'Mastery increased by 15 percentage points.',
        sourceType: 'mastery_improvement',
        conceptName: 'Fractions',
        sortOrder: 0,
        createdAt: NOW,
        ...overrides,
    };
}

function makeUpcomingRow(overrides: Partial<{ id: number; summaryId: number; conceptId: string | null; conceptName: string; reason: string | null; expectedTiming: string | null; sortOrder: number; createdAt: string }> = {}) {
    return {
        id: 1,
        summaryId: 1,
        conceptId: 'c2',
        conceptName: 'Decimals',
        reason: 'Prerequisite for Fractions mastery.',
        expectedTiming: 'Next session',
        sortOrder: 0,
        createdAt: NOW,
        ...overrides,
    };
}

test('getSessionSummary - returns null when summary not found', async () => {
    const store = makeStore({
        getSummary: async () => null,
    });
    const pbStore = makePbStore();
    const cqStore = makeCqStore();
    const service = createPalSsService(store, pbStore, cqStore);
    const result = await service.getSessionSummary('u1', 'i1', '2025', 'qp-1');
    assert.equal(result, null);
});

test('getSessionSummary - returns full summary when found', async () => {
    const store = makeStore({
        getSummary: async () => makeSummaryRow(),
        getConcepts: async () => [makeConceptRow()],
        getPraise: async () => [makePraiseRow()],
        getUpcoming: async () => [makeUpcomingRow()],
    });
    const pbStore = makePbStore();
    const cqStore = makeCqStore();
    const service = createPalSsService(store, pbStore, cqStore);
    const result = await service.getSessionSummary('u1', 'i1', '2025', 'qp-1');

    assert.ok(result);
    assert.equal(result.sessionId, 'qp-1');
    assert.equal(result.userId, 'u1');
    assert.equal(result.subInstituteId, 'i1');
    assert.equal(result.syear, '2025');
    assert.equal(result.completionState, 'completed');
    assert.equal(result.totalConcepts, 2);
    assert.equal(result.totalQuestions, 10);
    assert.equal(result.obtainMarks, 8);
    assert.equal(result.totalMarks, 10);
    assert.equal(result.accuracy, 80);
    assert.equal(result.conceptsWorkedOn.length, 1);
    assert.equal(result.conceptsWorkedOn[0].conceptName, 'Fractions');
    assert.equal(result.conceptsWorkedOn[0].masteryBefore, 60);
    assert.equal(result.conceptsWorkedOn[0].masteryAfter, 75);
    assert.equal(result.conceptsWorkedOn[0].masteryChange, 15);
    assert.equal(result.specificPraise.length, 1);
    assert.equal(result.specificPraise[0].praiseText, 'You improved your mastery of Fractions from 60% to 75%.');
    assert.equal(result.upcoming.length, 1);
    assert.equal(result.upcoming[0].conceptName, 'Decimals');
    assert.ok(result.streak);
    assert.equal(result.streak.currentStreak, 5);
    assert.equal(result.streak.longestStreak, 12);
    assert.ok(result.careerQuestUpdate);
    assert.equal(result.careerQuestUpdate.currentStage, 'skill_builder');
    assert.equal(result.badgesEarned.length, 0);
});

test('getSessionSummary - gracefully handles missing streak data', async () => {
    const store = makeStore({
        getSummary: async () => makeSummaryRow(),
        getConcepts: async () => [],
        getPraise: async () => [],
        getUpcoming: async () => [],
    });
    const pbStore = makePbStore({
        getStreakRecord: async () => null,
    });
    const cqStore = makeCqStore();
    const service = createPalSsService(store, pbStore, cqStore);
    const result = await service.getSessionSummary('u1', 'i1', '2025', 'qp-1');

    assert.ok(result);
    assert.equal(result.streak, null);
});

test('getSessionSummary - gracefully handles missing career quest data', async () => {
    const store = makeStore({
        getSummary: async () => makeSummaryRow(),
        getConcepts: async () => [],
        getPraise: async () => [],
        getUpcoming: async () => [],
    });
    const pbStore = makePbStore();
    const cqStore = makeCqStore({
        getCareerQuestState: async () => null,
    });
    const service = createPalSsService(store, pbStore, cqStore);
    const result = await service.getSessionSummary('u1', 'i1', '2025', 'qp-1');

    assert.ok(result);
    assert.equal(result.careerQuestUpdate, null);
});

test('getSessionSummary - gracefully handles missing badges data', async () => {
    const store = makeStore({
        getSummary: async () => makeSummaryRow(),
        getConcepts: async () => [],
        getPraise: async () => [],
        getUpcoming: async () => [],
    });
    const pbStore = makePbStore({
        getNotifications: async () => {
            throw new Error('DB error');
        },
    });
    const cqStore = makeCqStore();
    const service = createPalSsService(store, pbStore, cqStore);
    const result = await service.getSessionSummary('u1', 'i1', '2025', 'qp-1');

    assert.ok(result);
    assert.deepEqual(result.badgesEarned, []);
});

test('getSessionSummary - includes badges earned within session window', async () => {
    const store = makeStore({
        getSummary: async () => makeSummaryRow({ sessionEnd: '2026-08-18T10:30:00Z' }),
        getConcepts: async () => [],
        getPraise: async () => [],
        getUpcoming: async () => [],
    });
    const pbStore = makePbStore({
        getNotifications: async () => [
            {
                id: 1,
                notificationType: 'mastery_pb',
                title: 'New Mastery PB',
                message: 'You improved mastery in Fractions.',
                relatedConcept: 'Fractions',
                previousValue: 60,
                newValue: 75,
                improvement: 15,
                isRead: 0,
                createdAt: '2026-08-18T10:25:00Z',
            },
            {
                id: 2,
                notificationType: 'fluency_pb',
                title: 'Old Fluency PB',
                message: 'You achieved fluency.',
                relatedConcept: null,
                previousValue: 0,
                newValue: 50,
                improvement: 50,
                isRead: 0,
                createdAt: '2026-08-18T09:00:00Z',
            },
        ],
    });
    const cqStore = makeCqStore();
    const service = createPalSsService(store, pbStore, cqStore);
    const result = await service.getSessionSummary('u1', 'i1', '2025', 'qp-1');

    assert.ok(result);
    assert.equal(result.badgesEarned.length, 1);
    assert.equal(result.badgesEarned[0].badgeName, 'New Mastery PB');
});

test('getSessionSummary - falls back to all badges when no session end', async () => {
    const store = makeStore({
        getSummary: async () => makeSummaryRow({ sessionEnd: null }),
        getConcepts: async () => [],
        getPraise: async () => [],
        getUpcoming: async () => [],
    });
    const pbStore = makePbStore({
        getNotifications: async () => [
            {
                id: 1,
                notificationType: 'mastery_pb',
                title: 'New Mastery PB',
                message: 'You improved mastery.',
                relatedConcept: null,
                previousValue: 0,
                newValue: 50,
                improvement: 50,
                isRead: 0,
                createdAt: '2026-08-18T10:00:00Z',
            },
        ],
    });
    const cqStore = makeCqStore();
    const service = createPalSsService(store, pbStore, cqStore);
    const result = await service.getSessionSummary('u1', 'i1', '2025', 'qp-1');

    assert.ok(result);
    assert.equal(result.badgesEarned.length, 1);
});
