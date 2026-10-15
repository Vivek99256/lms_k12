import type { PrayogshalaActivity } from '@/app/course-master/data/prayogshala';
import type { AdaptiveConcept } from '@/app/pal/data/pal-diagnostic';

/**
 * The Explanation Lab's recommendations, as pure data.
 *
 * ---------------------------------------------------------------------------
 * WHAT DRIVES A RECOMMENDATION
 * ---------------------------------------------------------------------------
 * Only the learner's own results: for each concept, the concept diagnostic
 * score when they have taken it, otherwise the chapter diagnostic score for
 * that concept. Both already come from the adaptive endpoint, so this file does
 * not re-score anything, it only ranks what the engine reported.
 *
 *   - below WEAK_BELOW_PERCENT        -> weak: recommended, lowest score first
 *   - at or above it                  -> understood: left out on purpose
 *   - no score from either diagnostic -> not assessed: left out, counted, so the
 *                                        screen can say so rather than guess
 *
 * ---------------------------------------------------------------------------
 * WHERE THE EXPERIMENTS COME FROM
 * ---------------------------------------------------------------------------
 * Nothing is invented here. Experiments are the chapter's published Prayogshala
 * activities (see `pal-experiments.ts`). An activity is matched to a concept by
 * the concept ids it was authored against. A concept with no matching activity
 * falls back to chapter-wide activities (not tied to any topic or concept), and
 * if there are none either, the concept is reported with no experiment so the
 * screen can say that plainly.
 */

export const WEAK_BELOW_PERCENT = 70;

export type ConceptStrength = 'weak' | 'understood' | 'not-assessed';

export interface ConceptRecommendation {
  concept: AdaptiveConcept;
  /** The percentage the ranking used, and which diagnostic it came from. */
  score: number;
  scoreSource: 'concept-diagnostic' | 'chapter-diagnostic';
  /** Experiments authored against this concept (or its topic's concepts). */
  experiments: PrayogshalaActivity[];
  /** True when `experiments` are chapter-wide stand-ins, not concept-specific. */
  chapterWide: boolean;
}

export interface ExplanationLabPlan {
  /** Whether the learner has any diagnostic result at all for this chapter. */
  hasResults: boolean;
  /** Weak concepts, lowest score first. */
  recommendations: ConceptRecommendation[];
  understoodCount: number;
  notAssessedCount: number;
}

export function conceptScore(
  concept: AdaptiveConcept
): { score: number; source: ConceptRecommendation['scoreSource'] } | null {
  if (concept.practiceAttempts > 0) {
    return { score: concept.practicePercentage, source: 'concept-diagnostic' };
  }
  if (concept.diagnosticPercentage !== null) {
    return { score: concept.diagnosticPercentage, source: 'chapter-diagnostic' };
  }
  return null;
}

export function classifyConcept(concept: AdaptiveConcept): ConceptStrength {
  const scored = conceptScore(concept);
  if (!scored) return 'not-assessed';
  return scored.score < WEAK_BELOW_PERCENT ? 'weak' : 'understood';
}

function coversConcept(activity: PrayogshalaActivity, conceptId: string): boolean {
  const id = Number(conceptId);
  if (!Number.isFinite(id)) return false;
  return activity.concept_id === id || (activity.concept_ids ?? []).includes(id);
}

function isChapterWide(activity: PrayogshalaActivity): boolean {
  return (
    activity.topic_id === null &&
    activity.concept_id === null &&
    (activity.concept_ids ?? []).length === 0
  );
}

export function buildExplanationLabPlan(
  concepts: readonly AdaptiveConcept[],
  experiments: readonly PrayogshalaActivity[],
  hasDiagnostic: boolean
): ExplanationLabPlan {
  const chapterWide = experiments.filter(isChapterWide);
  const recommendations: ConceptRecommendation[] = [];
  let understoodCount = 0;
  let notAssessedCount = 0;
  let anyResult = hasDiagnostic;

  for (const concept of concepts) {
    const scored = conceptScore(concept);
    if (!scored) {
      notAssessedCount += 1;
      continue;
    }
    anyResult = true;
    if (scored.score >= WEAK_BELOW_PERCENT) {
      understoodCount += 1;
      continue;
    }

    const matched = experiments.filter((activity) => coversConcept(activity, concept.conceptId));
    recommendations.push({
      concept,
      score: scored.score,
      scoreSource: scored.source,
      experiments: matched.length > 0 ? matched : chapterWide,
      chapterWide: matched.length === 0 && chapterWide.length > 0,
    });
  }

  recommendations.sort((a, b) => a.score - b.score);

  return { hasResults: anyResult, recommendations, understoodCount, notAssessedCount };
}
