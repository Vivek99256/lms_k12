import { fetchAdaptiveConcepts } from '@/app/pal/data/pal-diagnostic';

/**
 * The Learn page needs a concept's real chapter NAME to classify its visual
 * (see classify.ts) — `ConceptLearn` itself doesn't carry one, only
 * `fetchAdaptiveConcepts(chapterId)` does, and that endpoint returns every
 * concept in the chapter (a materially heavier query than the single-concept
 * fetch the rest of the Learn page already makes). Calling it once per
 * concept page view, unconditionally, measurably added backend load across
 * the whole PAL Learn surface — this cache means a student browsing several
 * concepts in the same chapter (the common case) only pays for it once per
 * chapter, not once per concept.
 *
 * Module-level and in-memory on purpose: it only needs to survive one SPA
 * session, never needs to be invalidated (a chapter's name doesn't change),
 * and adds no new backend behavior — same endpoint, called less often.
 */
const cache = new Map<string, Promise<string | null>>();

export function loadChapterName(chapterId: string): Promise<string | null> {
  let cached = cache.get(chapterId);
  if (!cached) {
    cached = fetchAdaptiveConcepts(chapterId)
      .then((list) => list.chapterName || null)
      .catch(() => null);
    cache.set(chapterId, cached);
  }
  return cached;
}
