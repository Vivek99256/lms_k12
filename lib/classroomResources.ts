/**
 * Classroom Resource listing rules that are independent of the page component.
 *
 * lms_flashcard rows (one per key word: glacier, aquifer ...) reach the page typed 'Flash cards'. A chapter's complete
 * vocabulary deck is a single content_master row typed 'Vocabulary cards'. Single-word cards are noise in the Classroom
 * Resource listing, the deck is what a teacher opens, so only the former is hidden. Nothing is removed from the data;
 * other lanes and pages still receive the rows.
 */
export const INDIVIDUAL_FLASHCARD_TYPE = 'Flash cards';

export function isIndividualFlashcard(item: { type: string }): boolean {
  return item.type === INDIVIDUAL_FLASHCARD_TYPE;
}

/** True when the item may appear in the given lane's listing. Only the classroom lane hides individual flashcards. */
export function showsInLane(item: { type: string }, lane: 'classroom' | 'teacher'): boolean {
  return !(lane === 'classroom' && isIndividualFlashcard(item));
}
