'use client';

import { SingleChoiceSetPlayer } from '@/app/h5p/h5p_single_choice_set/[id]/page';
import type { H5pSingleChoiceSet } from '@/app/h5p/data/h5p-content-types';
import { buildFor, NotPlayable, scopeOfQuestion } from './shared';
import type { PlayerProps } from './types';

/**
 * Multiple choice, rendered through H5P.SingleChoiceSet.
 *
 * WHY NOT H5P.MultiChoice. It is not built in this platform as a standalone
 * type -- it exists only as a sub-library inside Course Presentation, with no
 * table, no controller and no player. Single choice set is the built type that
 * scores a one-correct-answer question identically, and it is what an authored
 * MCQ in this ERP already plays through. The substitution is named on the
 * question bank's type cards so nobody has to rediscover it here.
 *
 * ASSERTION AND REASON ARRIVES HERE TOO. Its four verdicts are options like
 * any others; what makes it different is the stem, which the transform
 * composes from the assertion and reason columns before this renders.
 */
export function MultipleChoicePlayer({ question, onResult, embedded = true }: PlayerProps) {
  const { activity, reason } = buildFor(question, 'single_choice_set');

  if (!activity || activity.kind !== 'single_choice_set') {
    return <NotPlayable reason={reason ?? 'This question cannot be played.'} />;
  }

  const scope = scopeOfQuestion(question);

  return (
    <SingleChoiceSetPlayer
      item={activity.item as unknown as H5pSingleChoiceSet}
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
