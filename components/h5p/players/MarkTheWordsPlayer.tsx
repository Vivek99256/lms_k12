'use client';

import { TextActivityPlayer } from '@/app/h5p/text_activity/components/player';
import type { H5pTextActivity } from '@/app/h5p/data/h5p';
import { buildFor, NotPlayable, scopeOfQuestion } from './shared';
import type { PlayerProps } from './types';

/**
 * A bank question asked as Mark the words, through H5P.MarkTheWords.
 *
 * THE THIRD READING OF THE SAME ROW. Blanks asks the learner to type the
 * answer, Drag the words asks them to drag it into place, and this asks them
 * to find it in the sentence. One row in `lms_question_master`, one passage,
 * one answer key, three content types.
 *
 * THIS ONE IS THE FUSSIEST ABOUT WHICH ROWS IT TAKES, and deliberately. A
 * question only works as a finding task when the answer sits INSIDE the
 * sentence, so `convertibilityAs` refuses two shapes the other two accept:
 *
 *   - a question that states its answer separately rather than in a drawn
 *     blank, because the answer would always be the last word; and
 *   - a sentence that is almost entirely answer, because a learner who marks
 *     every word scores full marks without reading it.
 *
 * Those rows are not listed on this type's page at all, rather than listed and
 * then failing when a learner presses play.
 */
export function MarkTheWordsPlayer({ question, onResult }: PlayerProps) {
  const { activity, reason } = buildFor(question, 'mark_the_words');

  if (!activity || activity.kind !== 'mark_the_words') {
    return <NotPlayable reason={reason ?? 'This question cannot be played as mark the words.'} />;
  }

  const scope = scopeOfQuestion(question);

  return (
    <TextActivityPlayer
      type="mark_the_words"
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
