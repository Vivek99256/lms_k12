import type { BadgeDefinition, BadgeEventInput, BadgeEvaluateInput } from './pal-badge-types';
import { createPalBadgeStore, type PalBadgeStore } from './pal-badge-store';

export type BadgeAwardResult = {
  badgeCode: string;
  badgeName: string;
  category: string;
  awarded: boolean;
  reason: string;
  evidence: Record<string, unknown>;
};

export type BadgeEvaluateResult = {
  processed: boolean;
  awarded: BadgeAwardResult[];
};

export function checkBadgeCondition(
  def: BadgeDefinition,
  input: BadgeEvaluateInput
): { passes: boolean; reason: string; evidence: Record<string, unknown> } {
  const rule = def.triggerRule;
  const evidence: Record<string, unknown> = {};

  switch (def.triggerType) {
    case 'mastery_first': {
      const minMastery = Number(rule.min_mastery || 70);
      if (!input.quizData || input.quizData.length === 0) {
        return { passes: false, reason: 'No quiz data provided.', evidence };
      }
      const concept = input.quizData.find((q) => q.masteryLevel >= minMastery);
      if (!concept) return { passes: false, reason: 'No concept reached required mastery.', evidence };
      evidence.conceptName = concept.conceptName;
      evidence.masteryLevel = concept.masteryLevel;
      return { passes: true, reason: `Achieved mastery in ${concept.conceptName}.`, evidence };
    }

    case 'mastery_perfect': {
      const minMastery = Number(rule.min_mastery || 100);
      if (!input.quizData || input.quizData.length === 0) {
        return { passes: false, reason: 'No quiz data provided.', evidence };
      }
      const concept = input.quizData.find((q) => q.masteryLevel >= minMastery);
      if (!concept) return { passes: false, reason: 'No concept reached perfect mastery.', evidence };
      evidence.conceptName = concept.conceptName;
      evidence.masteryLevel = concept.masteryLevel;
      return { passes: true, reason: `Achieved perfect mastery in ${concept.conceptName}.`, evidence };
    }

    case 'mastery_quick': {
      const minMastery = Number(rule.min_mastery || 70);
      const maxSessions = Number(rule.max_sessions || 3);
      if (!input.quizData || input.quizData.length === 0) {
        return { passes: false, reason: 'No quiz data provided.', evidence };
      }
      const concept = input.quizData.find((q) => q.masteryLevel >= minMastery && q.sessionCount <= maxSessions);
      if (!concept) return { passes: false, reason: 'No concept reached quick mastery threshold.', evidence };
      evidence.conceptName = concept.conceptName;
      evidence.masteryLevel = concept.masteryLevel;
      evidence.sessionCount = concept.sessionCount;
      return { passes: true, reason: `Mastered ${concept.conceptName} in ${concept.sessionCount} sessions.`, evidence };
    }

    case 'fluency_first': {
      const minFluency = Number(rule.min_fluency || 0.01);
      if (!input.quizData || input.quizData.length === 0) {
        return { passes: false, reason: 'No quiz data provided.', evidence };
      }
      const concept = input.quizData.find((q) => q.fluency > minFluency);
      if (!concept) return { passes: false, reason: 'No concept has fluency yet.', evidence };
      evidence.conceptName = concept.conceptName;
      evidence.fluency = concept.fluency;
      return { passes: true, reason: `First fluency achieved in ${concept.conceptName}.`, evidence };
    }

    case 'fluency_perfect': {
      const minFluency = Number(rule.min_fluency || 1.0);
      if (!input.quizData || input.quizData.length === 0) {
        return { passes: false, reason: 'No quiz data provided.', evidence };
      }
      const concept = input.quizData.find((q) => q.fluency >= minFluency);
      if (!concept) return { passes: false, reason: 'No concept has perfect fluency.', evidence };
      evidence.conceptName = concept.conceptName;
      evidence.fluency = concept.fluency;
      return { passes: true, reason: `Perfect fluency in ${concept.conceptName}.`, evidence };
    }

    case 'fluency_high': {
      const minFluency = Number(rule.min_fluency || 0.9);
      if (!input.quizData || input.quizData.length === 0) {
        return { passes: false, reason: 'No quiz data provided.', evidence };
      }
      const concept = input.quizData.find((q) => q.fluency >= minFluency);
      if (!concept) return { passes: false, reason: 'No concept reached high fluency.', evidence };
      evidence.conceptName = concept.conceptName;
      evidence.fluency = concept.fluency;
      return { passes: true, reason: `High fluency (${Math.round(concept.fluency * 100)}%) in ${concept.conceptName}.`, evidence };
    }

    default:
      return { passes: false, reason: `Unsupported trigger type for offline check: ${def.triggerType}.`, evidence };
  }
}

export async function evaluateBadges(input: BadgeEvaluateInput, storeOverride?: PalBadgeStore): Promise<BadgeEvaluateResult> {
  const store = storeOverride ?? createPalBadgeStore();
  const definitions = await store.getAllBadgeDefinitions();
  const existingBadges = await store.getStudentBadges(input.userId, input.subInstituteId, input.syear);
  const earnedSet = new Set(existingBadges.map((b) => b.badgeCode));

  const awarded: BadgeAwardResult[] = [];

  for (const def of definitions) {
    if (earnedSet.has(def.badgeCode)) continue;

    const result = await evaluateSingleBadge(store, def, input);
    if (result.awarded) {
      await store.awardBadge(input.userId, input.subInstituteId, input.syear, def.id, def.badgeCode, result.evidence);
      awarded.push({
        badgeCode: def.badgeCode,
        badgeName: def.badgeName,
        category: def.category,
        awarded: true,
        reason: result.reason,
        evidence: result.evidence,
      });
      earnedSet.add(def.badgeCode);
    }
  }

  return {
    processed: true,
    awarded,
  };
}

export async function evaluateSingleBadge(
  store: PalBadgeStore,
  def: BadgeDefinition,
  input: BadgeEvaluateInput
): Promise<{ awarded: boolean; reason: string; evidence: Record<string, unknown> }> {
  const { userId, subInstituteId, syear } = input;
  const rule = def.triggerRule;
  const evidence: Record<string, unknown> = {};

  switch (def.triggerType) {
    case 'mastery_first': {
      const minMastery = Number(rule.min_mastery || 70);
      if (!input.quizData || input.quizData.length === 0) {
        return { awarded: false, reason: 'No quiz data provided.', evidence };
      }
      const concept = input.quizData.find((q) => q.masteryLevel >= minMastery);
      if (!concept) return { awarded: false, reason: 'No concept reached required mastery.', evidence };
      const alreadyAwarded = await store.isBadgeEarned(userId, subInstituteId, syear, def.badgeCode);
      if (alreadyAwarded) return { awarded: false, reason: 'Badge already earned.', evidence };
      evidence.conceptName = concept.conceptName;
      evidence.masteryLevel = concept.masteryLevel;
      return { awarded: true, reason: `Achieved mastery in ${concept.conceptName}.`, evidence };
    }

    case 'mastery_perfect': {
      const minMastery = Number(rule.min_mastery || 100);
      if (!input.quizData || input.quizData.length === 0) {
        return { awarded: false, reason: 'No quiz data provided.', evidence };
      }
      const concept = input.quizData.find((q) => q.masteryLevel >= minMastery);
      if (!concept) return { awarded: false, reason: 'No concept reached perfect mastery.', evidence };
      const alreadyAwarded = await store.isBadgeEarned(userId, subInstituteId, syear, def.badgeCode);
      if (alreadyAwarded) return { awarded: false, reason: 'Badge already earned.', evidence };
      evidence.conceptName = concept.conceptName;
      evidence.masteryLevel = concept.masteryLevel;
      return { awarded: true, reason: `Achieved perfect mastery in ${concept.conceptName}.`, evidence };
    }

    case 'mastery_quick': {
      const minMastery = Number(rule.min_mastery || 70);
      const maxSessions = Number(rule.max_sessions || 3);
      if (!input.quizData || input.quizData.length === 0) {
        return { awarded: false, reason: 'No quiz data provided.', evidence };
      }
      const concept = input.quizData.find((q) => q.masteryLevel >= minMastery && q.sessionCount <= maxSessions);
      if (!concept) return { awarded: false, reason: 'No concept reached quick mastery threshold.', evidence };
      const alreadyAwarded = await store.isBadgeEarned(userId, subInstituteId, syear, def.badgeCode);
      if (alreadyAwarded) return { awarded: false, reason: 'Badge already earned.', evidence };
      evidence.conceptName = concept.conceptName;
      evidence.masteryLevel = concept.masteryLevel;
      evidence.sessionCount = concept.sessionCount;
      return { awarded: true, reason: `Mastered ${concept.conceptName} in ${concept.sessionCount} sessions.`, evidence };
    }

    case 'fluency_first': {
      const minFluency = Number(rule.min_fluency || 0.01);
      if (!input.quizData || input.quizData.length === 0) {
        return { awarded: false, reason: 'No quiz data provided.', evidence };
      }
      const concept = input.quizData.find((q) => q.fluency > minFluency);
      if (!concept) return { awarded: false, reason: 'No concept has fluency yet.', evidence };
      const alreadyAwarded = await store.isBadgeEarned(userId, subInstituteId, syear, def.badgeCode);
      if (alreadyAwarded) return { awarded: false, reason: 'Badge already earned.', evidence };
      evidence.conceptName = concept.conceptName;
      evidence.fluency = concept.fluency;
      return { awarded: true, reason: `First fluency achieved in ${concept.conceptName}.`, evidence };
    }

    case 'fluency_perfect': {
      const minFluency = Number(rule.min_fluency || 1.0);
      if (!input.quizData || input.quizData.length === 0) {
        return { awarded: false, reason: 'No quiz data provided.', evidence };
      }
      const concept = input.quizData.find((q) => q.fluency >= minFluency);
      if (!concept) return { awarded: false, reason: 'No concept has perfect fluency.', evidence };
      const alreadyAwarded = await store.isBadgeEarned(userId, subInstituteId, syear, def.badgeCode);
      if (alreadyAwarded) return { awarded: false, reason: 'Badge already earned.', evidence };
      evidence.conceptName = concept.conceptName;
      evidence.fluency = concept.fluency;
      return { awarded: true, reason: `Perfect fluency in ${concept.conceptName}.`, evidence };
    }

    case 'fluency_high': {
      const minFluency = Number(rule.min_fluency || 0.9);
      if (!input.quizData || input.quizData.length === 0) {
        return { awarded: false, reason: 'No quiz data provided.', evidence };
      }
      const concept = input.quizData.find((q) => q.fluency >= minFluency);
      if (!concept) return { awarded: false, reason: 'No concept reached high fluency.', evidence };
      const alreadyAwarded = await store.isBadgeEarned(userId, subInstituteId, syear, def.badgeCode);
      if (alreadyAwarded) return { awarded: false, reason: 'Badge already earned.', evidence };
      evidence.conceptName = concept.conceptName;
      evidence.fluency = concept.fluency;
      return { awarded: true, reason: `High fluency (${Math.round(concept.fluency * 100)}%) in ${concept.conceptName}.`, evidence };
    }

    case 'first_quiz': {
      const alreadyAwarded = await store.isBadgeEarned(userId, subInstituteId, syear, def.badgeCode);
      if (alreadyAwarded) return { awarded: false, reason: 'Badge already earned.', evidence };
      const sessionRecords = await store.countSessionRecords(userId, subInstituteId, syear);
      if (sessionRecords <= 1) {
        evidence.quizCount = sessionRecords;
        return { awarded: true, reason: 'First PAL quiz completed.', evidence };
      }
      return { awarded: false, reason: 'Not the first quiz.', evidence };
    }

    case 'streak': {
      const minDays = Number(rule.min_days || 7);
      const streak = await store.getCurrentStreak(userId, subInstituteId, syear);
      if (streak >= minDays) {
        const alreadyAwarded = await store.isBadgeEarned(userId, subInstituteId, syear, def.badgeCode);
        if (alreadyAwarded) return { awarded: false, reason: 'Badge already earned.', evidence };
        evidence.streakDays = streak;
        return { awarded: true, reason: `${streak}-day learning streak achieved.`, evidence };
      }
      return { awarded: false, reason: `Current streak is ${streak} days.`, evidence };
    }

    case 'content_visit': {
      const minCount = Number(rule.min_count || 5);
      const count = await store.countBadgeEvents(userId, subInstituteId, syear, 'content_visit');
      if (count >= minCount) {
        const alreadyAwarded = await store.isBadgeEarned(userId, subInstituteId, syear, def.badgeCode);
        if (alreadyAwarded) return { awarded: false, reason: 'Badge already earned.', evidence };
        evidence.visitCount = count;
        return { awarded: true, reason: `Visited ${count} content items.`, evidence };
      }
      return { awarded: false, reason: `Only ${count} content visits.`, evidence };
    }

    case 'quiz_count': {
      const minCount = Number(rule.min_count || 5);
      const count = await store.countSessionRecords(userId, subInstituteId, syear);
      if (count >= minCount) {
        const alreadyAwarded = await store.isBadgeEarned(userId, subInstituteId, syear, def.badgeCode);
        if (alreadyAwarded) return { awarded: false, reason: 'Badge already earned.', evidence };
        evidence.quizCount = count;
        return { awarded: true, reason: `Completed ${count} PAL quizzes.`, evidence };
      }
      return { awarded: false, reason: `Only ${count} quizzes completed.`, evidence };
    }

    case 'misconception_view': {
      const minCount = Number(rule.min_count || 3);
      const count = await store.countBadgeEvents(userId, subInstituteId, syear, 'misconception_view');
      if (count >= minCount) {
        const alreadyAwarded = await store.isBadgeEarned(userId, subInstituteId, syear, def.badgeCode);
        if (alreadyAwarded) return { awarded: false, reason: 'Badge already earned.', evidence };
        evidence.viewCount = count;
        return { awarded: true, reason: `Reviewed misconception content ${count} times.`, evidence };
      }
      return { awarded: false, reason: `Only ${count} misconception views.`, evidence };
    }

    case 'remediation_view': {
      const minCount = Number(rule.min_count || 1);
      const count = await store.countBadgeEvents(userId, subInstituteId, syear, 'remediation_view');
      if (count >= minCount) {
        const alreadyAwarded = await store.isBadgeEarned(userId, subInstituteId, syear, def.badgeCode);
        if (alreadyAwarded) return { awarded: false, reason: 'Badge already earned.', evidence };
        evidence.viewCount = count;
        return { awarded: true, reason: `Accessed remediation ${count} times.`, evidence };
      }
      return { awarded: false, reason: 'No remediation access yet.', evidence };
    }

    case 'pedagogy_view': {
      const minCount = Number(rule.min_count || 5);
      const count = await store.countBadgeEvents(userId, subInstituteId, syear, 'pedagogy_view');
      if (count >= minCount) {
        const alreadyAwarded = await store.isBadgeEarned(userId, subInstituteId, syear, def.badgeCode);
        if (alreadyAwarded) return { awarded: false, reason: 'Badge already earned.', evidence };
        evidence.viewCount = count;
        return { awarded: true, reason: `Viewed pedagogy suggestions ${count} times.`, evidence };
      }
      return { awarded: false, reason: `Only ${count} pedagogy views.`, evidence };
    }

    case 'career_visit': {
      const minCount = Number(rule.min_count || 1);
      const count = await store.countBadgeEvents(userId, subInstituteId, syear, 'career_visit');
      if (count >= minCount) {
        const alreadyAwarded = await store.isBadgeEarned(userId, subInstituteId, syear, def.badgeCode);
        if (alreadyAwarded) return { awarded: false, reason: 'Badge already earned.', evidence };
        evidence.visitCount = count;
        return { awarded: true, reason: 'Visited career counselling.', evidence };
      }
      return { awarded: false, reason: 'No career page visits yet.', evidence };
    }

    case 'riasec_complete': {
      const alreadyAwarded = await store.isBadgeEarned(userId, subInstituteId, syear, def.badgeCode);
      if (alreadyAwarded) return { awarded: false, reason: 'Badge already earned.', evidence };
      const count = await store.countBadgeEvents(userId, subInstituteId, syear, 'riasec_complete');
      if (count >= 1) {
        evidence.assessmentCount = count;
        return { awarded: true, reason: 'Completed RIASEC interest profile.', evidence };
      }
      return { awarded: false, reason: 'Interest profile not completed.', evidence };
    }

    case 'mastery_count': {
      const minConcepts = Number(rule.min_mastered_concepts || 3);
      const count = await store.getMasteredConceptCount(userId, subInstituteId, syear);
      if (count >= minConcepts) {
        const alreadyAwarded = await store.isBadgeEarned(userId, subInstituteId, syear, def.badgeCode);
        if (alreadyAwarded) return { awarded: false, reason: 'Badge already earned.', evidence };
        evidence.masteredConcepts = count;
        return { awarded: true, reason: `Mastered ${count} concepts.`, evidence };
      }
      return { awarded: false, reason: `Only ${count} concepts mastered.`, evidence };
    }

    default:
      return { awarded: false, reason: `Unknown trigger type: ${def.triggerType}.`, evidence };
  }
}

export async function recordBadgeEvent(event: BadgeEventInput, storeOverride?: PalBadgeStore): Promise<void> {
  const store = storeOverride ?? createPalBadgeStore();
  await store.insertBadgeEvent(event);
}
