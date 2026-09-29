/**
 * Chapter-diagnostic / concept-diagnostic answers: the same plumbing as
 * `practice-answers.ts` and `exam-answers.ts`, now that
 * `ServableQuestions::hydrate()` sends real correctness and the full
 * three-tier type ladder instead of stripping it down to a coarse label.
 *
 * `toBankQuestion` carries `questionTypeCode` / `questionTypeRaw` /
 * `modelAnswer` / `assertion` / `reason` straight through, the same shape
 * `exam-answers.ts` builds for `/lms/pal/create`, so `mappingForQuestion()`
 * resolves whatever form a diagnostic pool actually served -- MCQ,
 * true/false, fill-blank, match-the-following, assertion & reason, numerical
 * or case-study -- instead of only ever matching the MCQ fallback. A pool
 * that only draws MCQ still works unchanged: the extra fields read null and
 * the existing fallback fires.
 */

import { mapQuestionToPlayerPayload } from '@/lib/h5p/question-bank-runtime';
import type { BankQuestion } from '@/lib/h5p/question-bank-h5p-map';
import type { Question, QuestionResult } from '@/components/h5p/players/types';

export interface DiagnosticLikeOption {
  id: string;
  answer: string;
  isCorrect: boolean;
}

/** `DiagnosticQuestionItem` (`app/pal/data/pal-diagnostic.ts`) satisfies this. */
export interface DiagnosticLikeQuestion {
  questionId: string;
  title: string;
  options: DiagnosticLikeOption[];
  questionTypeCode: string | null;
  questionTypeRaw: string | null;
  questionType: string | null;
  modelAnswer: string | null;
  assertion: string | null;
  reason: string | null;
  standardId: number | null;
  subjectId: number | null;
  chapterId: number | null;
}

export function toBankQuestion(question: DiagnosticLikeQuestion): BankQuestion {
  return {
    id: Number(question.questionId) || 0,
    question: question.title,
    question_type_code: question.questionTypeCode,
    question_type_raw: question.questionTypeRaw,
    question_type: question.questionType,
    model_answer: question.modelAnswer,
    assertion: question.assertion,
    reason: question.reason,
    options: question.options.map((option, index) => ({
      label: String.fromCharCode(65 + index),
      text: option.answer,
      is_correct: option.isCorrect,
      source_option_id: Number(option.id) || null,
    })),
  };
}

/**
 * The same row, with the curriculum keys a player reports against.
 *
 * Not cosmetic: the shared H5P players refuse to render at all without a
 * non-empty chapter/standard/subject context (`hasH5pContext()`), so a
 * question missing these (a row with no chapter tagged) falls back to radios
 * via `canPlay` below, same as any other unplayable question.
 */
export function toPlayerQuestion(question: DiagnosticLikeQuestion): Question {
  return {
    ...toBankQuestion(question),
    standard_id: question.standardId,
    subject_id: question.subjectId,
    chapter_id: question.chapterId,
  };
}

function scopeOf(question: DiagnosticLikeQuestion) {
  return {
    standard_id: question.standardId,
    subject_id: question.subjectId,
    chapter_id: question.chapterId,
  };
}

export function canPlay(question: DiagnosticLikeQuestion): boolean {
  if (!question.standardId || !question.subjectId || !question.chapterId) return false;
  return mapQuestionToPlayerPayload(toBankQuestion(question), scopeOf(question)).ok;
}

/** The option id a finished activity means, in the same spelling `onSelect` already writes. */
export function selectedOptionId(
  question: DiagnosticLikeQuestion,
  result: QuestionResult
): string | null {
  const ids = (result.choiceIds ?? []).map((id) => String(id));
  if (ids.length === 0) return null;
  return question.options.find((option) => ids.includes(option.id))?.id ?? null;
}
