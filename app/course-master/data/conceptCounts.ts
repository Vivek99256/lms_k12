'use client';

/**
 * Key-concept totals, shared by the teacher's course header and the student's.
 *
 * Both sections count the same concepts over the same chapters, so the rule lives
 * here. Every step is "first positive wins", never `??`: the catalog routinely
 * returns a literal 0 for a subject whose chapters do carry concepts, and `??`
 * only falls through on null/undefined, so a stored 0 used to short-circuit the
 * whole chain and print "0 key concepts" next to 16 populated chapters.
 */

export type ChapterConceptSource = {
  concepts?: unknown[] | null;
  semantic?: { total_concepts?: number | string | null } | null;
};

export type SubjectConceptTotals = {
  key_concepts_count?: number | string | null;
  key_concept_count?: number | string | null;
  concepts_count?: number | string | null;
  total_concepts?: number | string | null;
} | null;

/** A count that is a real, positive number, or 0 when the value is unusable. */
function positiveCount(value: unknown): number {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

/**
 * Concepts actually stored for a chapter. Prefers the concept rows the API
 * returned, and falls back to the semantic record's own total when the rows
 * weren't expanded in the response.
 */
export function getChapterConceptCount(chapter: ChapterConceptSource): number {
  const conceptRows = Array.isArray(chapter.concepts) ? chapter.concepts.length : 0;
  if (conceptRows > 0) return conceptRows;

  return positiveCount(chapter.semantic?.total_concepts);
}

/**
 * A subject's key-concept total.
 *
 * The chapters are the live source and win whenever they carry concepts. The
 * catalog's subject-level totals only stand in when the chapter rows came back
 * without them, and `demoFallback` covers sample courses that have no API
 * concepts at all.
 */
export function getTotalKeyConceptCount(
  chapters: ReadonlyArray<ChapterConceptSource> | null | undefined,
  subject?: SubjectConceptTotals,
  demoFallback?: () => number
): number {
  const liveCount = (chapters ?? []).reduce(
    (total, chapter) => total + getChapterConceptCount(chapter),
    0
  );
  if (liveCount > 0) return liveCount;

  const subjectTotal =
    positiveCount(subject?.key_concepts_count) ||
    positiveCount(subject?.key_concept_count) ||
    positiveCount(subject?.concepts_count) ||
    positiveCount(subject?.total_concepts);
  if (subjectTotal > 0) return subjectTotal;

  return demoFallback ? positiveCount(demoFallback()) : 0;
}
