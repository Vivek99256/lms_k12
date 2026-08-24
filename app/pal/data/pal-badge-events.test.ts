import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSingleBadge } from './pal-badge';
import type { BadgeDefinition, BadgeEvaluateInput, BadgeAward, BadgeProgress, BadgeSummary } from './pal-badge-types';
import type { PalBadgeStore } from './pal-badge-store';

function createMockStore(overrides: Partial<PalBadgeStore> = {}): PalBadgeStore {
  const store: PalBadgeStore = {
    getAllBadgeDefinitions: async () => [],
    getStudentBadges: async () => [] as BadgeAward[],
    getBadgeProgress: async () => [] as BadgeProgress[],
    getBadgeSummary: async () => ({ totalBadges: 0, categories: {}, recentBadges: [] } as BadgeSummary),
    isBadgeEarned: async () => false,
    awardBadge: async () => {},
    insertBadgeEvent: async () => {},
    countBadgeEvents: async () => 0,
    getMasteredConceptCount: async () => 0,
    getCurrentStreak: async () => 0,
    countSessionRecords: async () => 0,
    ...overrides,
  };
  return store;
}

const BASE_INPUT: BadgeEvaluateInput = {
  userId: 'test_user',
  subInstituteId: 'test_inst',
  syear: '2025',
};

function makeDef(triggerType: string, triggerRule: Record<string, unknown> = {}): BadgeDefinition {
  return {
    id: 1,
    badgeCode: 'TEST_BADGE',
    badgeName: 'Test Badge',
    category: 'Test',
    description: 'Test badge.',
    triggerType,
    triggerRule,
    icon: 'Target',
    color: 'emerald',
    sortOrder: 1,
  };
}

test('evaluateSingleBadge - content_visit awards when count >= threshold', async () => {
  const store = createMockStore({ countBadgeEvents: async () => 5 });
  const def = makeDef('content_visit', { min_count: 5 });
  const result = await evaluateSingleBadge(store, def, BASE_INPUT);
  assert.equal(result.awarded, true);
  assert.equal((result.evidence.visitCount as number), 5);
});

test('evaluateSingleBadge - content_visit does not award below threshold', async () => {
  const store = createMockStore({ countBadgeEvents: async () => 2 });
  const def = makeDef('content_visit', { min_count: 5 });
  const result = await evaluateSingleBadge(store, def, BASE_INPUT);
  assert.equal(result.awarded, false);
});

test('evaluateSingleBadge - misconception_view awards when count >= threshold', async () => {
  const store = createMockStore({ countBadgeEvents: async () => 3 });
  const def = makeDef('misconception_view', { min_count: 3 });
  const result = await evaluateSingleBadge(store, def, BASE_INPUT);
  assert.equal(result.awarded, true);
  assert.equal((result.evidence.viewCount as number), 3);
});

test('evaluateSingleBadge - remediation_view awards when accessed', async () => {
  const store = createMockStore({ countBadgeEvents: async () => 1 });
  const def = makeDef('remediation_view', { min_count: 1 });
  const result = await evaluateSingleBadge(store, def, BASE_INPUT);
  assert.equal(result.awarded, true);
});

test('evaluateSingleBadge - pedagogy_view awards when count >= threshold', async () => {
  const store = createMockStore({ countBadgeEvents: async () => 5 });
  const def = makeDef('pedagogy_view', { min_count: 5 });
  const result = await evaluateSingleBadge(store, def, BASE_INPUT);
  assert.equal(result.awarded, true);
  assert.equal((result.evidence.viewCount as number), 5);
});

test('evaluateSingleBadge - career_visit awards on first visit', async () => {
  const store = createMockStore({ countBadgeEvents: async () => 1 });
  const def = makeDef('career_visit', { min_count: 1 });
  const result = await evaluateSingleBadge(store, def, BASE_INPUT);
  assert.equal(result.awarded, true);
});

test('evaluateSingleBadge - riasec_complete awards when assessment completed', async () => {
  const store = createMockStore({ countBadgeEvents: async () => 1 });
  const def = makeDef('riasec_complete', {});
  const result = await evaluateSingleBadge(store, def, BASE_INPUT);
  assert.equal(result.awarded, true);
  assert.equal((result.evidence.assessmentCount as number), 1);
});

test('evaluateSingleBadge - first_quiz awards on first session', async () => {
  const store = createMockStore({ countSessionRecords: async () => 1 });
  const def = makeDef('first_quiz', {});
  const result = await evaluateSingleBadge(store, def, BASE_INPUT);
  assert.equal(result.awarded, true);
});

test('evaluateSingleBadge - first_quiz does not award after second quiz', async () => {
  const store = createMockStore({ countSessionRecords: async () => 2 });
  const def = makeDef('first_quiz', {});
  const result = await evaluateSingleBadge(store, def, BASE_INPUT);
  assert.equal(result.awarded, false);
});

test('evaluateSingleBadge - streak awards when min_days met', async () => {
  const store = createMockStore({ getCurrentStreak: async () => 7 });
  const def = makeDef('streak', { min_days: 7 });
  const result = await evaluateSingleBadge(store, def, BASE_INPUT);
  assert.equal(result.awarded, true);
  assert.equal((result.evidence.streakDays as number), 7);
});

test('evaluateSingleBadge - streak does not award below min_days', async () => {
  const store = createMockStore({ getCurrentStreak: async () => 3 });
  const def = makeDef('streak', { min_days: 7 });
  const result = await evaluateSingleBadge(store, def, BASE_INPUT);
  assert.equal(result.awarded, false);
});

test('evaluateSingleBadge - quiz_count awards when count >= threshold', async () => {
  const store = createMockStore({ countSessionRecords: async () => 5 });
  const def = makeDef('quiz_count', { min_count: 5 });
  const result = await evaluateSingleBadge(store, def, BASE_INPUT);
  assert.equal(result.awarded, true);
  assert.equal((result.evidence.quizCount as number), 5);
});

test('evaluateSingleBadge - mastery_count awards when concepts mastered >= threshold', async () => {
  const store = createMockStore({ getMasteredConceptCount: async () => 3 });
  const def = makeDef('mastery_count', { min_mastered_concepts: 3 });
  const result = await evaluateSingleBadge(store, def, BASE_INPUT);
  assert.equal(result.awarded, true);
  assert.equal((result.evidence.masteredConcepts as number), 3);
});

test('evaluateSingleBadge - duplicate protection prevents re-awarding', async () => {
  const store = createMockStore({ countBadgeEvents: async () => 1, isBadgeEarned: async () => true });
  const def = makeDef('career_visit', { min_count: 1 });
  const result = await evaluateSingleBadge(store, def, BASE_INPUT);
  assert.equal(result.awarded, false);
  assert.equal(result.reason, 'Badge already earned.');
});

test('evaluateSingleBadge - mastery_first awards with quizData', async () => {
  const store = createMockStore({ isBadgeEarned: async () => false });
  const def = makeDef('mastery_first', { min_mastery: 70 });
  const input: BadgeEvaluateInput = {
    ...BASE_INPUT,
    quizData: [{ conceptName: 'Fractions', masteryLevel: 85, fluency: 0.8, sessionCount: 1 }],
  };
  const result = await evaluateSingleBadge(store, def, input);
  assert.equal(result.awarded, true);
  assert.equal((result.evidence.conceptName as string), 'Fractions');
});

test('evaluateSingleBadge - fluency_perfect awards at 100%', async () => {
  const store = createMockStore({ isBadgeEarned: async () => false });
  const def = makeDef('fluency_perfect', { min_fluency: 1.0 });
  const input: BadgeEvaluateInput = {
    ...BASE_INPUT,
    quizData: [{ conceptName: 'Addition', masteryLevel: 100, fluency: 1.0, sessionCount: 1 }],
  };
  const result = await evaluateSingleBadge(store, def, input);
  assert.equal(result.awarded, true);
  assert.equal((result.evidence.conceptName as string), 'Addition');
});

test('evaluateSingleBadge - fluency_high requires >= 90%', async () => {
  const store = createMockStore({ isBadgeEarned: async () => false });
  const def = makeDef('fluency_high', { min_fluency: 0.9 });
  const input: BadgeEvaluateInput = {
    ...BASE_INPUT,
    quizData: [{ conceptName: 'Subtraction', masteryLevel: 95, fluency: 0.92, sessionCount: 2 }],
  };
  const result = await evaluateSingleBadge(store, def, input);
  assert.equal(result.awarded, true);
});

test('evaluateSingleBadge - mastery_quick respects session count', async () => {
  const store = createMockStore({ isBadgeEarned: async () => false });
  const def = makeDef('mastery_quick', { min_mastery: 70, max_sessions: 3 });
  const inputOk: BadgeEvaluateInput = {
    ...BASE_INPUT,
    quizData: [{ conceptName: 'Algebra', masteryLevel: 80, fluency: 0.7, sessionCount: 2 }],
  };
  const resultOk = await evaluateSingleBadge(store, def, inputOk);
  assert.equal(resultOk.awarded, true);

  const inputFail: BadgeEvaluateInput = {
    ...BASE_INPUT,
    quizData: [{ conceptName: 'Algebra', masteryLevel: 80, fluency: 0.7, sessionCount: 5 }],
  };
  const resultFail = await evaluateSingleBadge(store, def, inputFail);
  assert.equal(resultFail.awarded, false);
});