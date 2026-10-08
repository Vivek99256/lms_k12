'use client';

import { DragDropActivity } from '@/app/h5p/h5p_drag_drop/components/drag-drop-activity';
import { MatchingPlayer } from './MatchingPlayer';
import { buildFor, NotPlayable } from './shared';
import type { PlayerProps } from './types';

/**
 * Drag and drop.
 *
 * Two kinds of question reach this player, and they are told apart by what the row
 * carries rather than by a flag:
 *
 *   - An image-based question (question_format_code "drag_drop") carries its picture, its
 *     drop zones and the answer key in the row, so it is played as the real thing: labels
 *     dragged onto parts of a picture, marked against the key. See DragDropActivity.
 *   - A match-the-following question is a drag interaction whose targets are labels rather
 *     than places on a picture. That is derivable from the two columns, so it renders
 *     through MatchingPlayer as it always has.
 *
 * Any other row has no zones to drop on and the bank stores none for it, so it says so
 * plainly rather than drawing a canvas a learner cannot answer.
 */
export function DragDropPlayer(props: PlayerProps) {
  const { question, onResult } = props;

  const code = String(question.question_type_code ?? '').toLowerCase();
  if (code === 'match_following') {
    return <MatchingPlayer {...props} />;
  }

  const { activity, reason } = buildFor(question, 'drag_drop');

  if (!activity || activity.kind !== 'drag_drop') {
    return (
      <NotPlayable
        reason={
          reason ??
          'Only image-based drag and drop questions, and match-the-following questions, can be played as a drag interaction. Other questions have no drop zones stored.'
        }
      />
    );
  }

  return (
    <DragDropActivity
      item={activity.item}
      onResult={(result) =>
        onResult?.({
          questionId: Number(question.id),
          score: result.score,
          maxScore: result.maxScore,
          correct: result.passed,
          durationSeconds: result.durationSeconds,
          response: result.response,
        })
      }
    />
  );
}
