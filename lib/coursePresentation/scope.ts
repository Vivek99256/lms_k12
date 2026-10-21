/**
 * Where the Course Presentation workflow (Classroom Resource card -> two choices -> source pre-flight) is switched on.
 *
 * For now: Std 9 Science, "Exploration: Entering the World of Secondary Science" (chapter 1, chapter_master.id 8592), and nothing else. Every other
 * chapter, subject, standard and school behaves exactly as it did before.
 *
 * This only keeps the card and screen out of other chapters. The server is what actually refuses them: both
 * `lms/course-presentation/*` endpoints answer 403 for any chapter that is not in `config/course_presentation_pilot.php`,
 * matching chapter id, standard, subject AND school. To widen the pilot, change both places.
 */
export const COURSE_PRESENTATION_CHAPTER_IDS: readonly number[] = [8592];

export function coursePresentationEnabledFor(chapterId: number | string | null | undefined): boolean {
  if (chapterId === null || chapterId === undefined || String(chapterId).trim() === '') return false;
  const id = Number(chapterId);
  return Number.isInteger(id) && COURSE_PRESENTATION_CHAPTER_IDS.includes(id);
}
