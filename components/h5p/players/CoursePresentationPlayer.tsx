'use client';

import { CoursePresentationPlayer as H5pCoursePresentationPlayer } from '@/app/h5p/h5p_course_presentation/[id]/page';
import type { H5pCoursePresentation } from '@/app/h5p/data/h5p-content-types';
import { buildFor, NotPlayable, scopeOfQuestion } from './shared';
import type { PlayerProps } from './types';

/**
 * Case studies and the long-form prompts, rendered through
 * H5P.CoursePresentation.
 *
 * NOT ONE OF THE SIX NAMED IN THE BRIEF, and here because the bank contains
 * forms the brief did not list: a case study stem with sub-parts, a
 * competency-focused question, a source-based integrated question, a "prove
 * that" and a "plot / draw / construct". All of them are one piece of source
 * material followed by several questions about it, which is a deck of slides.
 *
 * A STEM CARRIES ITS SUB-PARTS. The source goes on the first slide and each
 * sub-part gets its own; a sub-part that stores options becomes a scored
 * multiple-choice element, and one that does not keeps its model answer in the
 * slide notes, which are author-facing and never shown to a learner.
 *
 * H5P.BranchingScenario, which the earlier brief asked for, is a planned type
 * in this platform with no table and no player.
 */
export function CoursePresentationPlayer({ question, subParts = [], onResult, embedded = true }: PlayerProps) {
  const { activity, reason } = buildFor(question, 'course_presentation', subParts);

  if (!activity || activity.kind !== 'course_presentation') {
    return <NotPlayable reason={reason ?? 'This question cannot be played.'} />;
  }

  const scope = scopeOfQuestion(question);

  return (
    <H5pCoursePresentationPlayer
      item={activity.item as unknown as H5pCoursePresentation}
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
