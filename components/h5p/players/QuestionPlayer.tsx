'use client';

import { mappingForQuestion, targetsForQuestion, type H5pTarget, type H5pTargetKind } from '@/lib/h5p/question-bank-h5p-map';
import { mapQuestionToPlayerPayload } from '@/lib/h5p/question-bank-runtime';
import type { BankQuestion } from '@/lib/h5p/question-bank-h5p-map';

import { CoursePresentationPlayer } from './CoursePresentationPlayer';
import { DragTextPlayer } from './DragTextPlayer';
import { EssayPlayer } from './EssayPlayer';
import { FillBlankPlayer } from './FillBlankPlayer';
import { FlashcardsPlayer } from './FlashcardsPlayer';
import { MarkTheWordsPlayer } from './MarkTheWordsPlayer';
import { MatchingPlayer } from './MatchingPlayer';
import { MultipleChoicePlayer } from './MultipleChoicePlayer';
import { TrueFalsePlayer } from './TrueFalsePlayer';
import { NotPlayable, scopeOfQuestion } from './shared';
import type { PlayerProps } from './types';

/**
 * Give it a question; it renders the right player.
 *
 * THIS IS THE ENTRY POINT EVERY MODULE SHOULD USE. The H5P library, PAL,
 * homework, an assignment, practice mode and an exam all have the same job to
 * do -- put this question in front of a learner -- and all of them should do
 * it by handing the row to this component. Which H5P type that becomes is a
 * property of the QUESTION, decided once in `question-bank-h5p-map.ts`, not a
 * choice each module makes and then has to keep in step.
 *
 * WHICH IS WHAT KEEPS THE DATA SINGULAR. No module needs to create an H5P
 * record to show a question, so no module creates a second copy of a question
 * that already exists in `lms_question_master`.
 *
 * THE SPECIFIC PLAYERS REMAIN EXPORTED for the caller who genuinely wants one
 * type -- a drill of nothing but true/false statements, say. A caller that
 * picks a player by hand and passes the wrong question gets told which player
 * the question needed, rather than a blank panel.
 */
export function QuestionPlayer(props: PlayerProps & { as?: H5pTargetKind }) {
  const { question, subParts = [], as } = props;

  const built = mapQuestionToPlayerPayload(
    question as BankQuestion,
    scopeOfQuestion(question),
    undefined,
    subParts as BankQuestion[],
    as
  );

  if (!built.ok || !built.activity) {
    const mapping = mappingForQuestion(question as BankQuestion);

    return (
      <NotPlayable
        reason={
          built.reason ??
          (mapping
            ? `No player is built for ${mapping.label.toLowerCase()} yet.`
            : 'This question records no form, so there is nothing to render it as.')
        }
      />
    );
  }

  switch (built.activity.kind) {
    case 'single_choice_set':
      return <MultipleChoicePlayer {...props} />;
    case 'true_false':
      return <TrueFalsePlayer {...props} />;
    case 'fill_in_the_blanks':
      return <FillBlankPlayer {...props} />;
    case 'drag_text':
      return <DragTextPlayer {...props} />;
    case 'mark_the_words':
      return <MarkTheWordsPlayer {...props} />;
    case 'memory_game':
      return <MatchingPlayer {...props} />;
    case 'flashcards':
      return <FlashcardsPlayer {...props} />;
    case 'course_presentation':
      return <CoursePresentationPlayer {...props} />;
    case 'essay':
      return <EssayPlayer {...props} />;
  }
}

/**
 * Every H5P type this question can be asked as, default first.
 *
 * WHAT A SURFACE DOES WITH IT. A question is not owned by one content type,
 * and this is how a screen offers the others — a picker above the player, or
 * a badge saying "also plays as Drag the words". The teacher does not
 * re-author anything to take it up; the same row renders the other way.
 */
export function playableTypesForQuestion(question: PlayerProps['question']): H5pTarget[] {
  return targetsForQuestion(question as BankQuestion);
}

/** The H5P library a question will play through, for a caller that labels it. */
export function libraryForQuestion(question: PlayerProps['question']): string | null {
  return mappingForQuestion(question as BankQuestion)?.target?.library ?? null;
}
