/**
 * ESO Practice / Check answers: the same H5P-projection plumbing as
 * `exam-answers.ts`, adapted to a backend that only ever accepts an
 * `answer_master_id` back.
 *
 * WHY THIS IS NARROWER THAN exam-answers.ts. `palController@store` has two
 * submission channels -- an option id, or an interactive verdict for a typed
 * blank, a matched pair, a marked word. ESO's `recordAttempt`/
 * `submitCheckUnderstanding` have only the first one (`answer_master_id`);
 * there is no interactive channel on this backend to fall back to. So `canPlay`
 * here refuses anything whose H5P form is not answered by picking one of its
 * own options -- a fill-in-the-blank or matching activity would render,
 * finish, and then have nothing this backend can record, which is worse than
 * not offering it. Every form ESO's `McqPool`/`ServableQuestions` actually
 * serves today (MCQ, assertion & reason, CBE, ncert-solution, true/false) maps
 * to `single_choice_set` or `true_false`, both option-answered, so this is not
 * a narrowing of what gets played in practice -- it is a guard against a form
 * ESO cannot yet serve.
 */

import { mapQuestionToPlayerPayload } from '@/lib/h5p/question-bank-runtime';
import { mappingForQuestion, trueFalseAnswer, type BankQuestion } from '@/lib/h5p/question-bank-h5p-map';
import type { Question, QuestionResult } from '@/components/h5p/players/types';
import type { EsoQuestion, PracticeItem } from '@/app/pal/data/pal-eso';

/** `EsoQuestion` (Check) or `PracticeItem` (Practice, which carries the finer `questionTypeCode`). */
export type EsoLikeQuestion = EsoQuestion | PracticeItem;

function typeCodeOf(question: EsoLikeQuestion): string | null {
  return 'questionTypeCode' in question ? question.questionTypeCode : null;
}

export function toBankQuestion(question: EsoLikeQuestion): BankQuestion {
  return {
    id: question.questionId,
    question: question.title,
    question_type_code: typeCodeOf(question),
    question_type: question.questionType,
    model_answer: null,
    options: question.options.map((option, index) => ({
      label: String.fromCharCode(65 + index),
      text: option.answer,
      is_correct: option.isCorrect,
      source_option_id: option.id,
    })),
  };
}

/**
 * The same row, with the curriculum keys a player reports against.
 *
 * Not cosmetic: the shared H5P players refuse to render at all without a
 * non-empty chapter/standard/subject context (`hasH5pContext()`) -- a
 * question with none tagged falls back to radios via `canPlay` below.
 */
export function toPlayerQuestion(question: EsoLikeQuestion): Question {
  return {
    ...toBankQuestion(question),
    standard_id: question.standardId,
    subject_id: question.subjectId,
    chapter_id: question.chapterId,
  };
}

function scopeOf(question: EsoLikeQuestion) {
  return {
    standard_id: question.standardId,
    subject_id: question.subjectId,
    chapter_id: question.chapterId,
  };
}

/** Whether this question's H5P form is answered by picking one of its own options -- the only kind ESO's submit endpoints accept. */
function answeredByOption(question: BankQuestion): boolean {
  const kind = mappingForQuestion(question)?.target?.kind;
  return kind === 'single_choice_set' || kind === 'true_false';
}

export function canPlay(question: EsoLikeQuestion): boolean {
  if (!question.standardId || !question.subjectId || !question.chapterId) return false;
  const bank = toBankQuestion(question);
  if (!answeredByOption(bank)) return false;
  return mapQuestionToPlayerPayload(bank, scopeOf(question)).ok;
}

const TRUE_WORDS = new Set(['true', 't', 'yes', 'y', 'correct', 'right', '1']);
const FALSE_WORDS = new Set(['false', 'f', 'no', 'n', 'incorrect', 'wrong', '0']);

function word(html: string): string {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * The option a true/false verdict means.
 *
 * The true/false player answers a BOOLEAN and never names an option -- same
 * reasoning as `exam-answers.ts`'s `trueFalseOption`. Matching the stored
 * answer means the learner said what the row says; not matching means they
 * said the opposite. Returns null when the row's two options are not the
 * words true/false, which `canPlay`'s gate should already have excluded.
 */
function trueFalseOptionId(question: EsoLikeQuestion, correct: boolean): number | null {
  const stored = trueFalseAnswer(toBankQuestion(question));
  if (stored === null) return null;

  const learnerSaid = correct ? stored : !stored;
  const wanted = learnerSaid ? TRUE_WORDS : FALSE_WORDS;

  return question.options.find((option) => wanted.has(word(option.answer)))?.id ?? null;
}

/**
 * The `answer_master` id a finished activity means, or null when nothing
 * markable came back. `canPlay` is what keeps that from being the normal
 * case -- this is a guard, not a path a working question should take.
 */
export function selectedOptionId(question: EsoLikeQuestion, result: QuestionResult): number | null {
  const ids = result.choiceIds ?? [];
  if (ids.length > 0) {
    const chosen = question.options.find((option) => ids.includes(option.id));
    if (chosen) return chosen.id;
  }

  if (result.correct === null || result.correct === undefined) return null;
  return trueFalseOptionId(question, result.correct === true);
}
