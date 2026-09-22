/**
 * The shared H5P players.
 *
 * ONE IMPORT FOR EVERY MODULE. The H5P library, PAL, homework, assignments,
 * assessments, exams, practice mode and career intelligence all render the
 * same questions, so they all render them through here. There is no
 * PAL-specific player and no module-specific copy: a change to how a
 * multiple-choice question behaves happens once.
 *
 *     import { QuestionPlayer } from '@/components/h5p/players';
 *     <QuestionPlayer question={row} onResult={record} />
 *
 * `QuestionPlayer` picks the player from the question's own form. The specific
 * players below are for a surface that genuinely wants one type.
 *
 * NOTHING HERE WRITES. Every player derives its content from the question at
 * render time; none of them creates an H5P record, and none of them persists a
 * result. `onResult` hands the outcome to the caller, which decides whether it
 * is worth storing -- PAL stores an attempt, the H5P library stores nothing.
 */

export { QuestionPlayer, libraryForQuestion } from './QuestionPlayer';

export { MultipleChoicePlayer } from './MultipleChoicePlayer';
export { TrueFalsePlayer } from './TrueFalsePlayer';
export { FillBlankPlayer } from './FillBlankPlayer';
// The same question the Blanks player renders, asked two other ways. One row
// in `lms_question_master`, one passage, one answer key, three content types.
export { DragTextPlayer } from './DragTextPlayer';
export { MarkTheWordsPlayer } from './MarkTheWordsPlayer';
export { FlashcardsPlayer } from './FlashcardsPlayer';
export { MatchingPlayer } from './MatchingPlayer';
export { DragDropPlayer } from './DragDropPlayer';
export { EssayPlayer } from './EssayPlayer';
export { CoursePresentationPlayer } from './CoursePresentationPlayer';

export { NotPlayable, scopeOfQuestion } from './shared';
export { playableTypesForQuestion } from './QuestionPlayer';
export type { PlayerProps, Question, QuestionResult, QuestionScope } from './types';
