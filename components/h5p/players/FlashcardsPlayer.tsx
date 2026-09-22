'use client';

import { useMemo } from 'react';

import { FlashcardsPlayer as FlashcardDeck } from '@/app/h5p/h5p_flashacard/[id]/page';
import type { H5pFlashcard } from '@/app/h5p/data/h5p';
import { buildFor, NotPlayable, scopeOfQuestion } from './shared';
import type { PlayerProps } from './types';

/**
 * A bank question asked as Flash cards, through H5P.Flashcards.
 *
 * THE TARGET NEARLY EVERY QUESTION CAN ALSO PLAY AS. A deck needs a front, a
 * back and optionally a hint, and almost every form in the bank already has
 * those three — a stem, a stored answer, and sometimes a reason. So a
 * multiple-choice question, a true/false statement, a fill-in-the-blank, a
 * long written answer and a match-the-following row all produce a valid deck,
 * which is why this type's page lists far more of a chapter than the stricter
 * types do.
 *
 * A MATCH-THE-FOLLOWING ROW BECOMES A DECK OF PAIRS, not a single card, because
 * that is what the question already is: a list of things and the things they go
 * with. Every other form becomes one card.
 *
 * THIS ONE MARKS, unlike the written-answer player. A card is checked by
 * comparing what the learner typed against the stored answer, so `onResult`
 * carries a real score rather than null.
 */
export function FlashcardsPlayer({ question, onResult, embedded = true }: PlayerProps) {
  const { activity, reason } = buildFor(question, 'flashcards');
  const scope = scopeOfQuestion(question);

  // Memoised because the underlying player re-seeds its deck whenever this
  // changes, and re-seeding sends the learner back to the first card.
  const cards = useMemo(
    () => (activity?.kind === 'flashcards' ? (activity.item.cards as unknown as H5pFlashcard[]) : []),
    [activity]
  );
  const ctx = useMemo(
    () => ({
      chapter_id: String(scope.chapter_id ?? ''),
      standard_id: String(scope.standard_id ?? ''),
      subject_id: String(scope.subject_id ?? ''),
    }),
    [scope.chapter_id, scope.standard_id, scope.subject_id]
  );

  if (!activity || activity.kind !== 'flashcards') {
    return <NotPlayable reason={reason ?? 'This question cannot be played as flash cards.'} />;
  }

  return (
    <FlashcardDeck
      cards={cards}
      ctx={ctx}
      questionId={Number(question.id)}
      embedded={embedded}
      onResult={onResult}
    />
  );
}
