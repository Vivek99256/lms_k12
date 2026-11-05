/**
 * Where the Course Presentation workflow (Classroom Resource card -> two choices -> source pre-flight) is switched on.
 *
 * For now: chapter 1 of Std 8 Science, Mathematics, Hindi-A, English, Social Science, English-2 and Social Sciences-2/-3
 * (chapter_master.id 25837, 25850, 25900, 25863, 25879, 25871, 25884 and 25892); chapter 1 of Std 9 Science
 * ("Exploration: Entering the World of Secondary Science", chapter_master.id 8592), Mathematics ("Orienting
 * Yourself: The Use of Coordinates", 8594), English ("How I Taught My Grandmother to Read", 8622) and Social Science ("Understanding Social
 * Science", 8608), and the four Std 4 EVS ("Water") chapters of school 341 (chapter_master.id 41675-41678). Every other chapter, subject,
 * standard and school behaves exactly as it did before.
 *
 * This only keeps the card and screen out of other chapters. The server is what actually refuses them: both
 * `lms/course-presentation/*` endpoints answer 403 for any chapter that is not in `config/course_presentation_pilot.php`,
 * matching chapter id, standard, subject AND school. To widen the pilot, change both places.
 */
export const COURSE_PRESENTATION_CHAPTER_IDS: readonly number[] = [
  25837, 25850, 25900, 25863, 25879, 25871, 25884, 25892,
  8592, 8594, 8622, 8608,
  41675, 41676, 41677, 41678,
];

export function coursePresentationEnabledFor(chapterId: number | string | null | undefined): boolean {
  if (chapterId === null || chapterId === undefined || String(chapterId).trim() === '') return false;
  const id = Number(chapterId);
  return Number.isInteger(id) && COURSE_PRESENTATION_CHAPTER_IDS.includes(id);
}
