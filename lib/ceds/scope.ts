/**
 * Where the CEDS teaching-method picker, lesson planner and the "choose a method before opening" step are switched on.
 *
 * For now: Std 9 Science, Chapter 1 (chapter_master.id 8592), and nothing else. Every other standard, subject and
 * chapter behaves exactly as it did before: Open opens straight away and the picker pages say they are not available.
 *
 * This only keeps the interface out of other chapters. The server is what actually refuses them: both
 * `lms/ceds/*` endpoints answer 403 for any chapter that is not enabled in `config/ceds_fit_matrix.php` (scope),
 * matching on chapter id, standard AND subject. To widen it, change both places.
 */
export const CEDS_SCOPE_LABEL = 'Std 9 Science, Chapter 1';

export const CEDS_ENABLED_CHAPTER_IDS: readonly number[] = [8592];

export function cedsEnabledFor(chapterId: number | string | null | undefined): boolean {
  const id = Number(chapterId);
  return Number.isInteger(id) && CEDS_ENABLED_CHAPTER_IDS.includes(id);
}

export function cedsNotAvailableMessage(): string {
  return `The teaching-method planner is available only for ${CEDS_SCOPE_LABEL}.`;
}
