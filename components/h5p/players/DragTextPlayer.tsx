'use client';

import { TextActivityPlayer } from '@/app/h5p/text_activity/components/player';
import type { H5pTextActivity } from '@/app/h5p/data/h5p';
import { buildFor, NotPlayable, scopeOfQuestion } from './shared';
import type { PlayerProps } from './types';

/**
 * A bank question asked as Drag the words, through H5P.DragText.
 *
 * THE SAME QUESTION THE BLANKS PLAYER RENDERS. Not a copy of it, and not a
 * second row in `lms_question_master` tagged differently — the identical
 * passage and the identical answer key, asked a different way. The transform
 * derives `*answer*` markup from the stem's drawn blanks either way; what
 * changes is `content_type`, which is what tells the shared text-activity
 * player to offer the words as draggables instead of as empty inputs.
 *
 * WHICH ROWS REACH HERE. Anything whose answer is short enough to be a word or
 * a short phrase: fill-in-the-blank and numerical questions by default, and
 * very-short-answer and match-the-following rows through their secondary
 * mapping. A row whose stored answer is a paragraph is refused for the same
 * reason Blanks refuses it — there is no way to mark prose against a string.
 *
 * NO DISTRACTORS ARE INVENTED. Drag the words supports spare words that belong
 * in no gap, and the bank stores none. Making them up would mean generating
 * plausible wrong answers, which is authoring, not projection.
 */
export function DragTextPlayer({ question, onResult }: PlayerProps) {
  const { activity, reason } = buildFor(question, 'drag_text');

  if (!activity || activity.kind !== 'drag_text') {
    return <NotPlayable reason={reason ?? 'This question cannot be played as drag the words.'} />;
  }

  const scope = scopeOfQuestion(question);

  return (
    <TextActivityPlayer
      type="drag_text"
      activity={activity.item as unknown as H5pTextActivity}
      ctx={{
        chapter_id: String(scope.chapter_id ?? ''),
        standard_id: String(scope.standard_id ?? ''),
        subject_id: String(scope.subject_id ?? ''),
      }}
      onResult={onResult}
    />
  );
}
