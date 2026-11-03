/**
 * PAL Concept Stage Progression Tracker
 * Tracks sequential student progress per concept so the journey visualization
 * automatically moves the active indicator forward and turns previous stages green.
 *
 * Supports the complete 7-stage learning journey:
 * Chapter Diagnostic -> Concept Diagnostic -> Plan -> Learn -> Practice -> Check -> Mastery
 * as well as all retry loops (Support, Learn #2, Practice #2, Check #2, etc.).
 */

export type ConceptStageKey =
  | 'diagnostic'
  | 'adaptive'
  | 'plan'
  | 'learn'
  | 'practice'
  | 'feedback'
  | 'check'
  | 'support_1'
  | 'learn_2'
  | 'practice_2'
  | 'check_2'
  | 'support_2'
  | 'learn_3'
  | 'practice_3'
  | 'check_3'
  | 'mastery'
  | 'completed';

const STAGE_ORDER: Record<string, number> = {
  diagnostic: 10,
  adaptive: 20,
  plan: 30,
  learn: 40,
  learn_1: 40,
  practice: 50,
  practice_1: 50,
  feedback: 55,
  feedback_1: 55,
  check: 60,
  check_1: 60,
  // Retry / learning loop 1 (Attempt 2)
  support_1: 70,
  learn_2: 80,
  practice_2: 90,
  check_2: 100,
  // Retry / learning loop 2 (Attempt 3)
  support_2: 110,
  learn_3: 120,
  practice_3: 130,
  check_3: 140,
  // Final stages
  mastery: 180,
  completed: 200,
};

export function stageKeyToConceptStage(stageKey: string, attemptNumber: number = 1): ConceptStageKey {
  if (attemptNumber > 1) {
    switch (stageKey) {
      case 'intervention':
        return `support_${attemptNumber - 1}` as ConceptStageKey;
      case 'learn':
        return `learn_${attemptNumber}` as ConceptStageKey;
      case 'practice':
        return `practice_${attemptNumber}` as ConceptStageKey;
      case 'check':
        return `check_${attemptNumber}` as ConceptStageKey;
      default:
        break;
    }
  }

  switch (stageKey) {
    case 'diagnostic':
      return 'diagnostic';
    case 'adaptive':
      return 'adaptive';
    case 'plan':
      return 'plan';
    case 'learn':
      return 'learn';
    case 'practice':
    case 'explanation_lab':
      return 'practice';
    case 'feedback':
      return 'feedback';
    case 'check':
      return 'check';
    case 'intervention':
      return 'support_1';
    case 'mastery':
      return 'mastery';
    case 'experiment':
    case 'recall':
      return 'completed';
    default:
      return 'learn';
  }
}

export function recordStageProgression(
  conceptId: string | number | null | undefined,
  stage: ConceptStageKey | string
): void {
  if (!conceptId || typeof window === 'undefined') return;
  try {
    const key = `pal_stage_progress_${conceptId}`;
    const current = window.localStorage.getItem(key);
    const currentRank = current ? STAGE_ORDER[current] ?? 0 : 0;
    const newRank = STAGE_ORDER[stage] ?? 0;
    // Always advance forward, never regress
    if (newRank > currentRank) {
      window.localStorage.setItem(key, stage);
    }
  } catch {
    // Ignore in SSR / restricted storage modes
  }
}

export function getStageProgression(
  conceptId: string | number | null | undefined
): string | null {
  if (!conceptId || typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(`pal_stage_progress_${conceptId}`);
  } catch {
    return null;
  }
}

export function isStageReachedOrPassed(
  conceptId: string | number | null | undefined,
  targetStage: ConceptStageKey | string
): boolean {
  const current = getStageProgression(conceptId);
  if (!current) return false;
  const currentRank = STAGE_ORDER[current] ?? 0;
  const targetRank = STAGE_ORDER[targetStage] ?? 0;
  return currentRank >= targetRank;
}

export function markConceptMastered(conceptId: string | number | null | undefined): void {
  recordStageProgression(conceptId, 'completed');
}
