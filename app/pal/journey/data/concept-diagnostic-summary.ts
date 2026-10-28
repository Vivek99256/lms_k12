import { fetchAdaptiveConcepts, fetchChapterMastery, type ConceptMasteryRow } from '@/app/pal/data/pal-diagnostic';
import { isConceptCompleted, signalsFromMasteryRow } from '@/app/pal/data/pal-completion';

/**
 * The Concept Diagnostic step's ALL-CONCEPTS summary — additive to, and
 * entirely separate from, `pal-journey.ts`'s single-focus-concept model.
 *
 * `pal-journey.ts`'s own header explains why the 'adaptive' milestone there
 * tracks exactly one concept ("A learner only ever has ONE such concept
 * with real data today"). This file does not change that — `fetchJourneyData`,
 * `JourneyData`, `JourneyMilestone` and `conceptDiagnosticMilestone()` are
 * untouched. This is a second, independent read of data two OTHER existing
 * endpoints already return in bulk for a whole chapter:
 *
 *   - `fetchAdaptiveConcepts` (`pal-diagnostic.ts`) — every concept in the
 *     chapter, each with its own diagnostic attempt count and score.
 *   - `fetchChapterMastery` (`pal-diagnostic.ts`) — every concept's mastery
 *     stage, reduced through the SAME `isConceptCompleted()`/
 *     `signalsFromMasteryRow()` adapters `app/pal/adaptive/chapter/
 *     [chapterId]/page.tsx` already uses for its own roadmap, so "mastered"
 *     never disagrees between the two screens.
 *
 * No new backend endpoint, no new table, no new query — both fetchers are
 * already used elsewhere in PAL. This file only merges their two already-
 * fetched shapes into one summary a UI panel can render directly.
 *
 * ---------------------------------------------------------------------------
 * DIAGNOSTIC COMPLETION vs CONCEPT MASTERY — kept as two separate fields
 * ---------------------------------------------------------------------------
 * `status` answers "did the learner take this concept's diagnostic, and how
 * did it go" (pending / needs_improvement / completed) — built purely from
 * `AdaptiveConcept.practiceAttempts`/`practicePercentage`, the same signal
 * `pal-journey.ts`'s own `conceptDiagnosticMilestone()` uses for its single
 * focus concept (there, via `fetchConceptResult`'s correct/attempted; here,
 * via the bulk equivalent).
 *
 * `mastered` answers a different question entirely — the mastery engine's
 * own signed-off verdict, read from `fetchChapterMastery`. A concept can be
 * diagnostic-`completed` without being mastered yet (the diagnostic only
 * checks a snapshot), or already `mastered` from earlier work independent
 * of this specific diagnostic. Folding the two into one status would lose
 * that distinction, which is why this type keeps them apart.
 */

export type ConceptDiagnosticStatus = 'completed' | 'needs_improvement' | 'pending';

export interface ConceptDiagnosticEntry {
  conceptId: string;
  name: string;
  status: ConceptDiagnosticStatus;
  /** The diagnostic's own score (0-100), once attempted; null before the first attempt. See this file's header for why this is distinct from `mastered`. */
  score: number | null;
  attempts: number;
  /** The mastery engine's own verdict, independent of `status` — see this file's header. */
  mastered: boolean;
  /** The first not-yet-`completed` concept, in the same order `fetchAdaptiveConcepts` returns them — the "current concept" pointer. */
  isCurrent: boolean;
}

export interface ConceptDiagnosticSummary {
  chapterId: string;
  chapterName: string;
  total: number;
  completed: number;
  pending: number;
  needsImprovement: number;
  currentConceptId: string | null;
  currentConceptName: string | null;
  concepts: ConceptDiagnosticEntry[];
}

/**
 * Below this score, an attempted concept counts as "needs improvement"
 * rather than "completed". A UI-layer judgement call, not a reused constant
 * — no existing status anywhere in the data model (`AdaptiveConcept`,
 * `ConceptMasteryRow.stage`, `MilestoneStatus`) already draws this line.
 */
const NEEDS_IMPROVEMENT_BELOW = 70;

export async function fetchConceptDiagnosticSummary(
  chapterId: string | number,
  signal?: AbortSignal,
  asStudentId?: string
): Promise<ConceptDiagnosticSummary> {
  const [adaptiveResult, masteryResult] = await Promise.allSettled([
    fetchAdaptiveConcepts(chapterId, signal),
    fetchChapterMastery(chapterId, signal, asStudentId),
  ]);

  const adaptive = adaptiveResult.status === 'fulfilled' ? adaptiveResult.value : null;
  const masteryRows: ConceptMasteryRow[] = masteryResult.status === 'fulfilled' ? masteryResult.value.concepts : [];
  const masteryByConcept = new Map(masteryRows.map((row) => [String(row.conceptId), row]));

  const concepts = adaptive?.concepts ?? [];
  let currentAssigned = false;

  const entries: ConceptDiagnosticEntry[] = concepts.map((concept) => {
    const masteryRow = masteryByConcept.get(concept.conceptId) ?? null;
    const mastered = masteryRow ? isConceptCompleted(signalsFromMasteryRow(masteryRow)) : false;
    const attempted = concept.practiceAttempts > 0;

    const status: ConceptDiagnosticStatus = !attempted
      ? 'pending'
      : concept.practicePercentage >= NEEDS_IMPROVEMENT_BELOW
        ? 'completed'
        : 'needs_improvement';

    const isCurrent = !currentAssigned && status !== 'completed';
    if (isCurrent) currentAssigned = true;

    return {
      conceptId: concept.conceptId,
      name: concept.name,
      status,
      score: attempted ? concept.practicePercentage : null,
      attempts: concept.practiceAttempts,
      mastered,
      isCurrent,
    };
  });

  const current = entries.find((entry) => entry.isCurrent) ?? null;

  return {
    chapterId: String(chapterId),
    chapterName: adaptive?.chapterName ?? '',
    total: entries.length,
    completed: entries.filter((entry) => entry.status === 'completed').length,
    pending: entries.filter((entry) => entry.status === 'pending').length,
    needsImprovement: entries.filter((entry) => entry.status === 'needs_improvement').length,
    currentConceptId: current?.conceptId ?? null,
    currentConceptName: current?.name ?? null,
    concepts: entries,
  };
}
