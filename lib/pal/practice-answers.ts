/**
 * PracticePanel / DiagnosticPanel answers: the same question, rendered
 * through `QuestionPlayer` when the payload allows it.
 *
 * WHY THIS IS SEPARATE FROM `exam-answers.ts`. That module's `PalSubmission`
 * is shaped for `palController@store` -- an `id##correctFlag` pair split
 * across two channels. Practice and the chapter-diagnostic-assessment modal
 * post to different Laravel actions (`submit-practice`,
 * `submit-diagnostic-assessment`) that already expect a plain answer_master
 * id, or an array of them for a multi-answer question, in `answers`. There is
 * nothing to translate on the way out -- `selectedOptionId` returns exactly
 * what `onSelect`/`toggleAnswer` already write into that state today, so the
 * submit functions, the result screens and the modal state are untouched.
 */

import { mapQuestionToPlayerPayload } from '@/lib/h5p/question-bank-runtime';
import type { BankQuestion } from '@/lib/h5p/question-bank-h5p-map';
import type { Question, QuestionResult } from '@/components/h5p/players/types';

export interface PracticeLikeOption {
  id: string;
  answer: string;
  correct: boolean;
}

/** `PracticeQuestion` and `DiagnosticQuestion` (`app/pal/data/pal.ts`) both satisfy this. */
export interface PracticeLikeQuestion {
  id: string;
  title: string;
  /** `lms_question_type_id`, e.g. "1" for MCQ -- the only type signal this payload carries. */
  questionTypeId: string;
  multipleAnswer: boolean;
  options: PracticeLikeOption[];
}

/** Scope to report against, when the caller has one (both panels carry a `PalChapterContext`). */
export interface PracticeScope {
  standardId?: string | null;
  subjectId?: string | null;
  chapterId?: string | null;
}

const EMPTY_SCOPE = { standard_id: null, subject_id: null, chapter_id: null };

export function toBankQuestion(question: PracticeLikeQuestion): BankQuestion {
  return {
    id: Number(question.id) || 0,
    question: question.title,
    question_type_code: null,
    // '1' is MCQ in `lms_question_type`; nothing else is resolvable from this
    // payload, so anything else is left unresolved rather than guessed.
    question_type: question.questionTypeId === '1' ? 'MCQ' : null,
    model_answer: null,
    options: question.options.map((option, index) => ({
      label: String.fromCharCode(65 + index),
      text: option.answer,
      is_correct: option.correct,
      source_option_id: Number(option.id) || null,
    })),
  };
}

export function toPlayerQuestion(question: PracticeLikeQuestion, scope: PracticeScope = {}): Question {
  return {
    ...toBankQuestion(question),
    standard_id: numberOrNull(scope.standardId),
    subject_id: numberOrNull(scope.subjectId),
    chapter_id: numberOrNull(scope.chapterId),
  };
}

/**
 * Whether this question can actually be built as an H5P activity right now.
 *
 * A multi-answer question is refused even when the mapping would otherwise
 * succeed: every built target here is a single-choice activity, so a
 * multiple-answer MCQ (several options can be right at once) would be
 * misrepresented as one-answer-only. That refusal, like any other, keeps the
 * caller on its existing checkbox rendering -- the path that already worked,
 * not a dead end.
 */
export function canPlay(question: PracticeLikeQuestion): boolean {
  if (question.multipleAnswer) return false;
  return mapQuestionToPlayerPayload(toBankQuestion(question), EMPTY_SCOPE).ok;
}

/** The option id a finished activity means, in the same spelling `onSelect` already writes. */
export function selectedOptionId(
  question: PracticeLikeQuestion,
  result: QuestionResult
): string | null {
  const ids = (result.choiceIds ?? []).map((id) => String(id));
  if (ids.length === 0) return null;
  return question.options.find((option) => ids.includes(option.id))?.id ?? null;
}

function numberOrNull(value: string | null | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
