import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBadgeCondition } from './pal-badge';
import type { BadgeDefinition, BadgeEvaluateInput } from './pal-badge-types';

test('checkBadgeCondition - mastery_first awards when concept reaches threshold', () => {
  const def: BadgeDefinition = {
    id: 1,
    badgeCode: 'BADGE_FIRST_MASTERY',
    badgeName: 'First Steps to Mastery',
    category: 'Mastery',
    description: 'Achieve mastery >= 70% in any concept.',
    triggerType: 'mastery_first',
    triggerRule: { min_mastery: 70 },
    icon: 'Target',
    color: 'emerald',
    sortOrder: 1,
  };

  const input: BadgeEvaluateInput = {
    userId: 'test_user_1',
    subInstituteId: 'test_inst',
    syear: '2025',
    quizData: [{ conceptName: 'Fractions', masteryLevel: 85, fluency: 0.8, sessionCount: 1 }],
  };

  const result = checkBadgeCondition(def, input);
  assert.ok(result.passes);
  assert.equal(result.reason.includes('Fractions'), true);
  assert.equal(result.evidence.conceptName, 'Fractions');
});

test('checkBadgeCondition - mastery_first does not award below threshold', () => {
  const def: BadgeDefinition = {
    id: 1,
    badgeCode: 'BADGE_FIRST_MASTERY',
    badgeName: 'First Steps to Mastery',
    category: 'Mastery',
    description: 'Achieve mastery >= 70% in any concept.',
    triggerType: 'mastery_first',
    triggerRule: { min_mastery: 70 },
    icon: 'Target',
    color: 'emerald',
    sortOrder: 1,
  };

  const input: BadgeEvaluateInput = {
    userId: 'test_user_2',
    subInstituteId: 'test_inst',
    syear: '2025',
    quizData: [{ conceptName: 'Fractions', masteryLevel: 50, fluency: 0.5, sessionCount: 1 }],
  };

  const result = checkBadgeCondition(def, input);
  assert.equal(result.passes, false);
});

test('checkBadgeCondition - mastery_first returns false when no quiz data', () => {
  const def: BadgeDefinition = {
    id: 1,
    badgeCode: 'BADGE_FIRST_MASTERY',
    badgeName: 'First Steps to Mastery',
    category: 'Mastery',
    description: 'Achieve mastery >= 70% in any concept.',
    triggerType: 'mastery_first',
    triggerRule: { min_mastery: 70 },
    icon: 'Target',
    color: 'emerald',
    sortOrder: 1,
  };

  const input: BadgeEvaluateInput = {
    userId: 'test_user_3',
    subInstituteId: 'test_inst',
    syear: '2025',
  };

  const result = checkBadgeCondition(def, input);
  assert.equal(result.passes, false);
});

test('checkBadgeCondition - fluency_perfect awards at 100%', () => {
  const def: BadgeDefinition = {
    id: 5,
    badgeCode: 'BADGE_PERFECT_FLUENCY',
    badgeName: 'Perfect Fluency',
    category: 'Fluency',
    description: 'Achieve 100% fluency in any concept.',
    triggerType: 'fluency_perfect',
    triggerRule: { min_fluency: 1.0 },
    icon: 'CheckCircle2',
    color: 'green',
    sortOrder: 5,
  };

  const input: BadgeEvaluateInput = {
    userId: 'test_user_4',
    subInstituteId: 'test_inst',
    syear: '2025',
    quizData: [{ conceptName: 'Addition', masteryLevel: 100, fluency: 1.0, sessionCount: 1 }],
  };

  const result = checkBadgeCondition(def, input);
  assert.ok(result.passes);
  assert.equal(result.reason.includes('Addition'), true);
});

test('checkBadgeCondition - fluency_high requires at least 90%', () => {
  const def: BadgeDefinition = {
    id: 6,
    badgeCode: 'BADGE_FLUENCY_MASTER',
    badgeName: 'Fluency Master',
    category: 'Fluency',
    description: 'Achieve 90%+ fluency in any concept.',
    triggerType: 'fluency_high',
    triggerRule: { min_fluency: 0.9 },
    icon: 'TrendingUp',
    color: 'teal',
    sortOrder: 6,
  };

  const inputOk: BadgeEvaluateInput = {
    userId: 'test_user_5',
    subInstituteId: 'test_inst',
    syear: '2025',
    quizData: [{ conceptName: 'Subtraction', masteryLevel: 95, fluency: 0.92, sessionCount: 2 }],
  };

  const resultOk = checkBadgeCondition(def, inputOk);
  assert.ok(resultOk.passes);

  const inputFail: BadgeEvaluateInput = {
    userId: 'test_user_5',
    subInstituteId: 'test_inst',
    syear: '2025',
    quizData: [{ conceptName: 'Subtraction', masteryLevel: 95, fluency: 0.85, sessionCount: 2 }],
  };

  const resultFail = checkBadgeCondition(def, inputFail);
  assert.equal(resultFail.passes, false);
});

test('checkBadgeCondition - mastery_quick respects session count', () => {
  const def: BadgeDefinition = {
    id: 3,
    badgeCode: 'BADGE_QUICK_MASTERY',
    badgeName: 'Quick Learner',
    category: 'Mastery',
    description: 'Reach mastery >= 70% in 3 or fewer sessions.',
    triggerType: 'mastery_quick',
    triggerRule: { min_mastery: 70, max_sessions: 3 },
    icon: 'Zap',
    color: 'violet',
    sortOrder: 3,
  };

  const inputOk: BadgeEvaluateInput = {
    userId: 'test_user_6',
    subInstituteId: 'test_inst',
    syear: '2025',
    quizData: [{ conceptName: 'Algebra', masteryLevel: 80, fluency: 0.7, sessionCount: 2 }],
  };

  const resultOk = checkBadgeCondition(def, inputOk);
  assert.ok(resultOk.passes);

  const inputFail: BadgeEvaluateInput = {
    userId: 'test_user_6',
    subInstituteId: 'test_inst',
    syear: '2025',
    quizData: [{ conceptName: 'Algebra', masteryLevel: 80, fluency: 0.7, sessionCount: 5 }],
  };

  const resultFail = checkBadgeCondition(def, inputFail);
  assert.equal(resultFail.passes, false);
});
