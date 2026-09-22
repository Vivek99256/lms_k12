'use client';

import { TrueFalsePlayer as H5pTrueFalsePlayer } from '@/app/h5p/h5p_true_false/[id]/page';
import type { H5pTrueFalse } from '@/app/h5p/data/h5p-content-types';
import { buildFor, NotPlayable, scopeOfQuestion } from './shared';
import type { PlayerProps } from './types';

/**
 * True or false, rendered through H5P.TrueFalse.
 *
 * The verdict is read from whichever field the bank actually used: the flagged
 * option on a two-option MCQ, or the model answer on a narrative row. A row
 * that says neither is refused rather than defaulted to false, because
 * defaulting marks every learner wrong on a question that never had an answer.
 */
export function TrueFalsePlayer({ question, onResult, embedded = true }: PlayerProps) {
  const { activity, reason } = buildFor(question, 'true_false');

  if (!activity || activity.kind !== 'true_false') {
    return <NotPlayable reason={reason ?? 'This question cannot be played.'} />;
  }

  const scope = scopeOfQuestion(question);

  return (
    <H5pTrueFalsePlayer
      item={activity.item as unknown as H5pTrueFalse}
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
