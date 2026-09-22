'use client';

import { TextActivityPlayer } from '@/app/h5p/text_activity/components/player';
import type { H5pTextActivity } from '@/app/h5p/data/h5p';
import { buildFor, NotPlayable, scopeOfQuestion } from './shared';
import type { PlayerProps } from './types';

/**
 * Fill in the blank, rendered through H5P.Blanks.
 *
 * TWO THINGS THE TRANSFORM DOES THAT ARE EASY TO MISS. The passage carries
 * `*answer*` markup derived from the stem's drawn blanks, and the answer KEY
 * is derived alongside it -- the Blanks player marks from `blanks[]` and never
 * from the passage, so a row without that array renders as "this activity has
 * no answers set yet". Both are built by `question-bank-runtime.ts`.
 *
 * AND ONE IT REFUSES. A stored answer that is a written explanation rather
 * than a word or a value is rejected, not turned into one paragraph-long
 * blank: marking that against an exact string fails every learner who wrote it
 * in their own words.
 *
 * NUMERICAL QUESTIONS ARRIVE HERE TOO, because H5P.ArithmeticQuiz generates
 * its own sums and cannot carry a stored question. A typed value against a
 * stored value is the same interaction.
 */
export function FillBlankPlayer({ question, onResult }: PlayerProps) {
  const { activity, reason } = buildFor(question, 'fill_in_the_blanks');

  if (!activity || activity.kind !== 'fill_in_the_blanks') {
    return <NotPlayable reason={reason ?? 'This question cannot be played.'} />;
  }

  const scope = scopeOfQuestion(question);

  return (
    <TextActivityPlayer
      type="fill_in_the_blanks"
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
