'use client';

/**
 * Concept Intelligence for a concept shown on the coherence map.
 *
 * The map already knows a concept's name and (via `CurriculumGraphBuilder`) its
 * chapter_id. Concept Intelligence lives in `semantic_intelligence`, keyed by that
 * same chapter_id - there is no concept_id column on that table, so a concept's own
 * entry is found by matching `concept_name` inside the chapter's blob. This mirrors
 * exactly how `chapters/page.tsx` resolves a `ConceptIntelEntry` for the
 * Chapter -> Topic -> Concept hierarchy screen.
 *
 * One fetch per chapter_id, cached module-wide: several cards on the same focus view
 * (a concept and its prerequisites) routinely share a chapter, and re-fetching the
 * whole semantic_intelligence blob per card would be wasteful.
 */

import { useEffect, useState } from 'react';
import { fetchSemanticIntelligenceResult, type ConceptIntelEntry } from '@/app/course-master/data/chapters';

type ChapterConcepts = ConceptIntelEntry[];

const cache = new Map<number, { promise: Promise<ChapterConcepts>; concepts: ChapterConcepts | null }>();

function loadChapterConcepts(chapterId: number): Promise<ChapterConcepts> {
  const cached = cache.get(chapterId);
  if (cached) return cached.promise;

  const slot: { promise: Promise<ChapterConcepts>; concepts: ChapterConcepts | null } = {
    promise: null as unknown as Promise<ChapterConcepts>,
    concepts: null,
  };

  slot.promise = fetchSemanticIntelligenceResult(chapterId)
    .then((result) => {
      const concepts = (result?.full_intelegance_json?.concepts ??
        result?.full_intelligence_json?.concepts ??
        []) as ChapterConcepts;
      slot.concepts = concepts;
      return concepts;
    })
    .catch(() => {
      // No intelligence for this chapter (not yet extracted, or the request failed) is
      // the common case, not an error state the map needs to surface - render as "no
      // entry found", the same as a chapter that legitimately has nothing.
      slot.concepts = [];
      return slot.concepts;
    });

  cache.set(chapterId, slot);
  return slot.promise;
}

/**
 * One concept's intelligence, resolved from its chapter's blob.
 *
 * `loading` only reflects the in-flight fetch; a chapter with no intelligence yet
 * settles to `entry: null, loading: false` just like a concept name that didn't
 * match - both are "nothing to show", not errors.
 */
export function useConceptIntelligenceEntry(
  chapterId: number | null | undefined,
  conceptName: string
): { entry: ConceptIntelEntry | null; loading: boolean } {
  const [concepts, setConcepts] = useState<ChapterConcepts | null>(
    () => (chapterId ? cache.get(chapterId)?.concepts ?? null : null)
  );

  useEffect(() => {
    if (!chapterId) {
      setConcepts(null);
      return;
    }

    const cached = cache.get(chapterId);
    if (cached?.concepts) {
      setConcepts(cached.concepts);
      return;
    }

    let cancelled = false;
    loadChapterConcepts(chapterId).then((result) => {
      if (!cancelled) setConcepts(result);
    });

    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  const loading = Boolean(chapterId) && concepts === null;
  const entry =
    concepts?.find((item) => (item?.concept?.concept_name ?? '') === conceptName) ?? null;

  return { entry, loading };
}

export type ConceptGlance = {
  /** Raw value, e.g. "medium" - callers decide capitalisation and colour. */
  difficulty: string | null;
  misconceptionCount: number;
};

/** The one or two facts worth showing before a card is expanded. */
export function conceptGlance(entry: ConceptIntelEntry | null): ConceptGlance | null {
  if (!entry) return null;

  const concept = (entry.concept ?? {}) as Record<string, unknown>;
  const rawDifficulty = concept.difficulty;
  const difficulty =
    typeof rawDifficulty === 'string' && rawDifficulty.trim() !== '' ? rawDifficulty.trim() : null;
  const misconceptionCount = Array.isArray(entry.misconceptions) ? entry.misconceptions.length : 0;

  if (!difficulty && misconceptionCount === 0) return null;

  return { difficulty, misconceptionCount };
}

/** Tailwind classes for a difficulty chip, matching this card's existing chip tones. */
export function difficultyChipClass(difficulty: string): string {
  switch (difficulty.toLowerCase()) {
    case 'easy':
      return 'bg-emerald-50 text-emerald-700';
    case 'hard':
      return 'bg-rose-50 text-rose-700';
    default:
      return 'bg-amber-50 text-amber-800';
  }
}

export function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}
