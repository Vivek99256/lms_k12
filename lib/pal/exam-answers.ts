/**
 * PAL Test answers: turning a bank question into a playable one, and a
 * player's verdict back into something `palController@store` can record.
 *
 * WHY THIS IS IN `lib/` AND NOT IN THE EXAM PAGE. Two decisions live here and
 * both are the kind that goes wrong silently. The first is which shape a PAL
 * question has to take before the shared H5P players will render it -- get a
 * field name wrong and every question falls back to "no form is recorded on
 * this row". The second is how a finished activity becomes a submitted answer,
 * and that one decides whether a learner's attempt is marked at all. Neither
 * needs React, a fetch or a browser, so neither is tested through one.
 *
 * ---------------------------------------------------------------------------
 * THE TWO WAYS AN ANSWER COMES BACK
 * ---------------------------------------------------------------------------
 * PAL has always recorded an answer as an `answer_master` row id: `store()`
 * writes it to `lms_online_exam_answer.answer_id`, `get_calculate_marks()`
 * marks the paper from it, and misconception detection reads WHICH distractor
 * was chosen. That works for every form whose answer IS one of the stored
 * options -- multiple choice, assertion & reason, and true/false, where the
 * two options are the words themselves.
 *
 * It cannot work for the rest. A learner who types a word into a blank, drags
 * a label onto its pair or marks a word in a sentence has not chosen an
 * `answer_master` row; there is no id to store. Those come back as a VERDICT
 * -- right or wrong, plus what they actually did -- on a separate channel
 * (`answer_interactive`), which the controller records with a null answer_id
 * the same way it already records an unanswered question.
 *
 * So `submissionFor` returns a tagged union rather than a string, and the
 * caller has to handle both arms. That is deliberate: a function that returned
 * an empty string for the second case would compile, submit, and mark every
 * typed answer wrong.
 */

import {
  mappingForQuestion,
  trueFalseAnswer,
  type BankQuestion,
} from '@/lib/h5p/question-bank-h5p-map';
import type { Question, QuestionResult } from '@/components/h5p/players/types';

// ---------------------------------------------------------------------------
// The PAL row
// ---------------------------------------------------------------------------

/** One option of a PAL question, as `palController@create` returns it. */
export interface PalExamOption {
  /** `answer_master.id`, as a string -- it crosses JSON from Laravel. */
  id: string;
  /** HTML, as the bank stores it. */
  answer: string;
  /** "1" for a correct option, "0" otherwise (mirrors `answer_master`). */
  correctFlag: string;
}

/**
 * A PAL question with everything the H5P projection needs to choose a player.
 *
 * The type fields are the point of it. Before they were carried, every PAL
 * question arrived as a stem and a list of options and could only be drawn as
 * radio buttons, whatever form it actually was.
 */
export interface PalExamQuestion {
  questionId: string;
  questionText: string;
  options: PalExamOption[];
  /** `question_type_catalog.code`, e.g. `fill_blank`. Null when unresolved. */
  questionTypeCode: string | null;
  /** The grading engine's collapsed spelling: 'MCQ' | 'Narrative'. */
  questionType: string | null;
  /** The stored written answer, which is the answer key for the typed forms. */
  modelAnswer: string | null;
  marks: number | null;
  difficulty: string | null;
  assertion: string | null;
  reason: string | null;
  standardId: number | null;
  subjectId: number | null;
  chapterId: number | null;
}

/**
 * The PAL row as the H5P projection reads it.
 *
 * A straight rename, with one addition: each option carries its
 * `answer_master` id through as `source_option_id`, which is what lets the
 * chosen option come back out of the player at the end. Without it a multiple
 * choice question would still RENDER, and then submit nothing recordable.
 */
export function toBankQuestion(question: PalExamQuestion): BankQuestion {
  return {
    id: Number(question.questionId),
    question: question.questionText,
    question_type_code: question.questionTypeCode,
    question_type: question.questionType,
    model_answer: question.modelAnswer,
    marks: question.marks,
    difficulty: question.difficulty,
    assertion: question.assertion,
    reason: question.reason,
    options: question.options.map((option, index) => ({
      // A..Z by stored order, matching how the bank endpoint labels the same
      // rows, so a question reads identically in PAL and in the bank.
      label: String.fromCharCode(65 + index),
      text: option.answer,
      is_correct: option.correctFlag === '1',
      source_option_id: Number(option.id) || null,
    })),
  };
}

/**
 * The same row, with the curriculum keys a player reports against.
 *
 * `QuestionPlayer` takes this and nothing else -- no activity id, no fetch --
 * so this function is the whole of what PAL does to make a question playable.
 * The scope comes off the QUESTION rather than off the quiz, because a paper
 * drawn across chapters would otherwise report every question against the
 * first chapter in it.
 */
export function toPlayerQuestion(question: PalExamQuestion): Question {
  return {
    ...toBankQuestion(question),
    standard_id: question.standardId,
    subject_id: question.subjectId,
    chapter_id: question.chapterId,
  };
}

// ---------------------------------------------------------------------------
// The answer coming back
// ---------------------------------------------------------------------------

/**
 * An answer that names an `answer_master` row -- the path PAL already had.
 *
 * `value` is the `id##correctFlag` pair `store()` and `get_calculate_marks()`
 * both split on. Keeping that exact spelling is what lets these questions go
 * on being marked by the code that already marks them.
 */
export interface OptionSubmission {
  kind: 'option';
  questionId: string;
  value: string;
}

/**
 * An answer with no `answer_master` row behind it: a typed blank, a matched
 * pair, a marked word.
 *
 * `correct` is the player's verdict. That is the same trust model the
 * `id##correctFlag` pair above already has -- the correct flag is sent to the
 * browser and sent back -- so this is not a new exposure, and the server
 * re-derives what it can either way (`PalInteractiveAnswers` on the Laravel
 * side, `isAnswerCorrectServerSide` for the option path).
 */
export interface InteractiveSubmission {
  kind: 'interactive';
  questionId: string;
  correct: boolean;
  /** What the learner did, for the result screen and the audit trail. */
  response: string;
  score: number | null;
  maxScore: number | null;
}

export type PalSubmission = OptionSubmission | InteractiveSubmission;

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
 * WHY THIS IS RECONSTRUCTED RATHER THAN REPORTED. The true/false player
 * answers a BOOLEAN; it has never seen an `answer_master` row and cannot name
 * one. But the stored answer is known here, and `result.correct` says whether
 * the learner matched it, so the learner's own boolean is recoverable:
 * matching means they said what the row says, and not matching means they said
 * the opposite. The option whose text is that word is the row to record.
 *
 * Returns null when the row's two options are not the words true and false --
 * a true/false question stored as a narrative row with a model answer, which
 * has no option to record and falls through to a verdict.
 */
function trueFalseOption(question: PalExamQuestion, correct: boolean): PalExamOption | null {
  const stored = trueFalseAnswer(toBankQuestion(question));
  if (stored === null) return null;

  const learnerSaid = correct ? stored : !stored;
  const wanted = learnerSaid ? TRUE_WORDS : FALSE_WORDS;

  return question.options.find((option) => wanted.has(word(option.answer))) ?? null;
}

/**
 * Whether this question's answer is one of its stored options.
 *
 * Asked of the H5P TARGET rather than of the type code, because the target is
 * what decides how the learner answered: every form that plays as a single
 * choice set is answered by picking an option, whatever it is called.
 */
function answeredByOption(question: BankQuestion): boolean {
  const kind = mappingForQuestion(question)?.target?.kind;
  return kind === 'single_choice_set' || kind === 'true_false';
}

/** The option the player named, when it named one this question carries. */
function chosenOption(question: PalExamQuestion, result: QuestionResult): PalExamOption | null {
  const ids = (result.choiceIds ?? []).map((id) => String(id));
  if (ids.length === 0) return null;

  // The FIRST reported choice, because a PAL question is one question and the
  // set it plays through holds exactly that one.
  return question.options.find((option) => ids.includes(option.id)) ?? null;
}

/**
 * What to submit for a finished question, or null when there is nothing
 * markable to submit.
 *
 * Prefers the option path whenever an option can be named, because that path
 * is marked server-side, feeds misconception detection and is what every PAL
 * report already reads. Falls back to a verdict only when there is genuinely
 * no row to record -- which is the honest outcome for a typed blank, not a
 * degradation to work around.
 *
 * NULL IS NOT "UNANSWERED", IT IS "UNMARKABLE". A player reports `correct:
 * null` when the activity it rendered has nothing to be right or wrong about.
 * PAL's draw is supposed to make that impossible -- it only serves questions
 * with options or a stored answer -- so this is a guard rather than a path.
 * It returns null instead of `correct: false` because the alternative is
 * marking a learner wrong for an activity that could not be marked at all,
 * which is a false negative on their real work. The caller records nothing,
 * and PAL's unanswered sweep accounts for the question.
 */
export function submissionFor(
  question: PalExamQuestion,
  result: QuestionResult
): PalSubmission | null {
  if (result.correct === null || result.correct === undefined) return null;

  const bank = toBankQuestion(question);

  if (answeredByOption(bank)) {
    const option =
      chosenOption(question, result) ?? trueFalseOption(question, result.correct === true);

    if (option) {
      return {
        kind: 'option',
        questionId: question.questionId,
        value: `${option.id}##${option.correctFlag}`,
      };
    }
  }

  return {
    kind: 'interactive',
    questionId: question.questionId,
    correct: result.correct === true,
    response: result.response ?? '',
    score: result.score,
    maxScore: result.maxScore,
  };
}

/** Split a set of submissions into the two channels the controller reads. */
export function splitSubmissions(submissions: PalSubmission[]): {
  /** questionId -> `id##flag`, for `answer_multiple`. */
  options: Record<string, string>;
  /** questionId -> verdict, for `answer_interactive`. */
  interactive: Record<string, InteractiveSubmission>;
} {
  const options: Record<string, string> = {};
  const interactive: Record<string, InteractiveSubmission> = {};

  for (const submission of submissions) {
    if (submission.kind === 'option') options[submission.questionId] = submission.value;
    else interactive[submission.questionId] = submission;
  }

  return { options, interactive };
}
