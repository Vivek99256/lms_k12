'use client';

import { MemoryGamePlayer } from '@/app/h5p/h5p_memory_game/[id]/page';
import type { H5pMemoryGame } from '@/app/h5p/data/h5p-content-types';
import { buildFor, NotPlayable, scopeOfQuestion } from './shared';
import type { PlayerProps } from './types';

/**
 * Match the following, rendered through H5P.MemoryGame.
 *
 * WHY MEMORY GAME AND NOT DRAG QUESTION. H5P.DragQuestion is built here, but
 * it needs drop-zone coordinates -- where on the canvas each target sits --
 * and the question bank stores none. A match question is two columns and a
 * key; memory game pairs exactly that and needs no geometry. See
 * `DragDropPlayer` for what would have to change.
 *
 * THE PAIRS ARE READ TWO WAYS, because the bank stores them two ways: a model
 * answer keyed as `A-3, B-1` resolved against the option labels, or options
 * that carry both halves as `left - right`. A row where neither yields two
 * pairs is refused rather than rendered as a one-card board.
 */
export function MatchingPlayer({ question, onResult, embedded = true }: PlayerProps) {
  const { activity, reason } = buildFor(question, 'memory_game');

  if (!activity || activity.kind !== 'memory_game') {
    return <NotPlayable reason={reason ?? 'This question cannot be played.'} />;
  }

  const scope = scopeOfQuestion(question);

  return (
    <MemoryGamePlayer
      item={activity.item as unknown as H5pMemoryGame}
      ctx={{
        chapter_id: String(scope.chapter_id ?? ''),
        standard_id: String(scope.standard_id ?? ''),
        subject_id: String(scope.subject_id ?? ''),
      }}
      embedded={embedded}
      onResult={onResult}
    />
  );
}
