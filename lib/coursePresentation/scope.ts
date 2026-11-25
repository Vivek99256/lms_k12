/**
 * Where the Course Presentation workflow (Classroom Resource card -> two choices -> source pre-flight -> review and approve) is
 * switched on.
 *
 * It is open to every chapter (decided 2026-11-25, so a branching-scenario draft that AI Stack starts can be reviewed and approved
 * for any chapter). The server decides the same way: next_lms_erp `config/course_presentation_pilot.php` `scope.all_chapters`
 * (env COURSE_PRESENTATION_ALL_CHAPTERS). To go back to the list below, set BOTH flags to `false`:
 * NEXT_PUBLIC_COURSE_PRESENTATION_ALL_CHAPTERS here and COURSE_PRESENTATION_ALL_CHAPTERS there.
 *
 * With the switch off, only these chapters: chapter 1 of Std 8 Science, Mathematics, Hindi-A, English, Social Science, English-2 and
 * Social Sciences-2/-3 (chapter_master.id 25837, 25850, 25900, 25863, 25879, 25871, 25884 and 25892); chapter 1 of Std 9 Science
 * ("Exploration: Entering the World of Secondary Science", chapter_master.id 8592), Mathematics ("Orienting Yourself: The Use of
 * Coordinates", 8594), English ("How I Taught My Grandmother to Read", 8622) and Social Science ("Understanding Social Science", 8608),
 * and the four Std 4 EVS ("Water") chapters of school 341 (chapter_master.id 41675-41678). The server then answers 403 for any other
 * chapter, matching chapter id, standard, subject AND school.
 *
 * This only keeps the card and screen out of chapters the server would refuse; the server is what actually enforces it.
 */
export const COURSE_PRESENTATION_CHAPTER_IDS: readonly number[] = [
  25837, 25850, 25900, 25863, 25879, 25871, 25884, 25892,
  8592, 8594, 8622, 8608,
  41675, 41676, 41677, 41678,
];

/** On unless explicitly set to 'false'. Read at call time so a test can flip it; the build inlines the literal below. */
export function coursePresentationOpenToAllChapters(): boolean {
  return process.env.NEXT_PUBLIC_COURSE_PRESENTATION_ALL_CHAPTERS !== 'false';
}

export function coursePresentationEnabledFor(chapterId: number | string | null | undefined): boolean {
  if (chapterId === null || chapterId === undefined || String(chapterId).trim() === '') return false;
  const id = Number(chapterId);
  if (!Number.isInteger(id) || id <= 0) return false;
  return coursePresentationOpenToAllChapters() || COURSE_PRESENTATION_CHAPTER_IDS.includes(id);
}
