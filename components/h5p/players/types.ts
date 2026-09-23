/**
 * The contract every shared H5P player takes.
 *
 * ONE QUESTION, ONE PROP. A player takes a row of `lms_question_master` and
 * renders it. It does not take an activity id, it does not fetch, and it does
 * not save -- the question IS the content, and everything a player needs is
 * derived from it at render time by `lib/h5p/question-bank-runtime.ts`.
 *
 * WHY THAT MATTERS BEYOND H5P. The same question has to appear in PAL, in
 * homework, in an assignment, in practice mode and in an exam. If a player
 * took an H5P activity id, every one of those modules would first have to
 * create an H5P record -- which is the duplication this architecture exists to
 * remove. Taking the question means all of them render the same row from the
 * same table, and none of them writes anything.
 */

import type { BankQuestion } from '@/lib/h5p/question-bank-h5p-map';

/**
 * A question as `/api/lms-question-bank` returns it.
 *
 * Structurally the same shape the mapping layer reads, re-exported here so a
 * consumer imports one thing. Callers holding a richer row (the question bank
 * screens do) pass it whole; nothing is stripped.
 */
export type Question = BankQuestion & {
  chapter_id?: number | null;
  standard_id?: number | null;
  subject_id?: number | null;
  /** Extraction-pipeline figures. Dimensions only -- never a coordinate. */
  figures?: Array<{
    url: string | null;
    width: number | null;
    height: number | null;
    caption: string | null;
    ocr_text: string | null;
  }>;
};

/** The curriculum keys a player reports against. Read off the question. */
export interface QuestionScope {
  standard_id: number | null;
  subject_id: number | null;
  chapter_id: number | null;
}

/** What a player reports when a learner finishes. Never written by the player. */
export interface QuestionResult {
  questionId: number;
  /** Null for a written answer: nothing in this platform marks prose. */
  score: number | null;
  maxScore: number | null;
  /** Null when there is nothing to be right or wrong about. */
  correct: boolean | null;
  /** Seconds between the activity appearing and the learner finishing. */
  durationSeconds: number;
  /** What the learner actually did, for a module that wants to store it. */
  response?: string;
  /**
   * The `answer_master` rows the learner chose, when the activity was built
   * from a question that carried option ids.
   *
   * WHY `response` IS NOT ENOUGH. `response` is a human-readable summary
   * ("3/4"), which is all a report or an xAPI statement needs. A module that
   * WRITES an attempt needs the option itself: PAL stores it in
   * `lms_online_exam_answer.answer_id` and its misconception detection keys
   * off which distractor was chosen, not merely that one was.
   *
   * Empty for an authored activity and for every type whose answer is not an
   * option -- a typed blank, a matched pair, a marked word. Those are recorded
   * by verdict, and a caller must be ready for that rather than assuming an id
   * is always available.
   */
  choiceIds?: number[];
}

export interface PlayerProps {
  question: Question;
  /**
   * Sub-parts belonging to this question, when it is a case study stem.
   *
   * Named `subParts` and not `children` because React reserves that name for
   * nested elements, and a prop that means something else under the same name
   * is a trap for the next reader.
   */
  subParts?: Question[];
  /**
   * Called once the learner finishes. The CALLER decides whether to persist
   * anything -- PAL writes an attempt, the H5P library writes nothing.
   */
  onResult?: (result: QuestionResult) => void;
  /** False on a page that draws its own title. Defaults to true. */
  embedded?: boolean;
}
