/**
 * Question bank row -> a playable H5P activity, in memory.
 *
 * WHAT CHANGED AND WHY. The first build of this feature converted a question
 * into a saved draft and then played the draft. That put a database write, a
 * controller round trip and a piece of durable state between a teacher and
 * "show me what this looks like". This module removes all three: it builds the
 * same row shape the players already consume, in the browser, and hands it
 * straight to the player. Nothing is posted, nothing is stored, and there is
 * no id to clean up afterwards.
 *
 * THE ROWS ARE REAL ROW SHAPES, NOT A NEW FORMAT. Every player in this module
 * takes the row its controller returns -- `H5pTrueFalse`, `H5pSingleChoiceSet`,
 * `H5pMemoryGame`, `H5pCoursePresentation`, `H5pTextActivity`. This module
 * produces exactly those, so the player cannot tell a previewed question from a
 * saved activity, and no player needed a preview branch to accept one.
 *
 * IDS ARE SYNTHETIC AND NEGATIVE. A previewed activity has no row, so it has no
 * id. Using `0` would collide with "not yet saved" and using the question's own
 * id would collide with a real activity of that number. Negative ids cannot be
 * either, they are stable for a given question, and they read unmistakably as
 * "this is not a stored activity" in an xAPI object key or a React key.
 *
 * SAVE PAYLOADS ARE STILL THE SOURCE OF TRUTH FOR CONTENT. The field-level
 * decisions -- how an assertion-and-reason stem is composed, where a blank goes
 * in a passage, which half of a match pair is the front of a card -- live in
 * `question-bank-h5p-map.ts` and are unit-tested there. This module calls those
 * builders and wraps their output in row scaffolding, so the two can never
 * disagree about what a question means.
 */

import {
  H5P_TARGETS,
  blanksPassage,
  convertibilityAs,
  flashcardSides,
  mappingForQuestion,
  matchPairs,
  toBlanksPayload,
  toCoursePresentationPayload,
  toMemoryGamePayload,
  toSingleChoiceSetPayload,
  toTrueFalsePayload,
  trueFalseAnswer,
  activityTitle,
  composedStem,
  type BankQuestion,
  type FeedbackBandInput,
  type H5pTargetKind,
  type TypeMapping,
} from './question-bank-h5p-map';
import { parsePassage } from './text-activity-markup';
import { plainText } from './true-false';

// ---------------------------------------------------------------------------
// The row shapes, structurally
//
// Declared here rather than imported from `app/h5p/data/*` so this module keeps
// no dependency on the app tree and stays unit-testable. The data layer assigns
// the result to the real row types, which is where any drift fails to compile.
// ---------------------------------------------------------------------------

interface RowBase {
  id: number;
  standard_id: number | null;
  subject_id: number | null;
  chapter_id: number | null;
  title: string;
  description: string | null;
  status: string;
  published_at: string | null;
  library: string | null;
  sub_institute_id: number | null;
  max_score?: number;
}

export interface RuntimeSingleChoiceOption {
  id: number;
  question_id: number;
  set_id: number;
  option_text: string;
  is_correct: boolean;
  feedback: string | null;
  sort_order: number;
}

export interface RuntimeSingleChoiceQuestion {
  id: number;
  set_id: number;
  question_text: string;
  feedback_correct: string | null;
  feedback_incorrect: string | null;
  explanation: string | null;
  sort_order: number;
  options: RuntimeSingleChoiceOption[];
}

export interface RuntimeSingleChoiceSet extends RowBase {
  task_description: string | null;
  auto_continue: boolean;
  timeout_correct_ms: number;
  timeout_wrong_ms: number;
  sound_effects: boolean;
  enable_retry: boolean;
  enable_show_solution: boolean;
  randomize_questions: boolean;
  randomize_answers: boolean;
  points_per_question: number;
  pass_percentage: number;
  show_progress: boolean;
  feedback_bands: FeedbackBandInput[] | null;
  questions: RuntimeSingleChoiceQuestion[];
}

export interface RuntimeTrueFalseQuestion {
  id: number;
  true_false_id: number;
  question_text: string;
  correct_answer: boolean;
  feedback_correct: string | null;
  feedback_incorrect: string | null;
  explanation: string | null;
  media_image: string | null;
  media_alt: string | null;
  sort_order: number;
}

export interface RuntimeTrueFalse extends RowBase {
  task_description: string | null;
  enable_retry: boolean;
  enable_show_solution: boolean;
  enable_check_button: boolean;
  auto_check: boolean;
  confirm_check_dialog: boolean;
  confirm_retry_dialog: boolean;
  randomize_questions: boolean;
  questions_to_ask: number;
  points_per_question: number;
  pass_percentage: number;
  show_progress: boolean;
  feedback_bands: FeedbackBandInput[] | null;
  questions: RuntimeTrueFalseQuestion[];
}

export interface RuntimeTextActivityBlank {
  id: number;
  text_activity_id: number;
  blank_index: number;
  solution: string | null;
  alternatives: string[] | null;
  tip: string | null;
  is_distractor: boolean;
}

/**
 * The three text-passage types, which are one row shape and one player apart
 * from this discriminator — exactly as `h5p_text_activities` stores them.
 */
export type RuntimeTextActivityType = 'fill_in_the_blanks' | 'drag_text' | 'mark_the_words';

export interface RuntimeTextActivity {
  id: number;
  content_type: RuntimeTextActivityType;
  standard_id: number | null;
  subject_id: number | null;
  chapter_id: number | null;
  title: string | null;
  description: string | null;
  task_description: string | null;
  passage: string | null;
  distractors: string | null;
  media_image: string | null;
  media_alt: string | null;
  enable_retry: boolean;
  enable_show_solution: boolean;
  enable_check: boolean;
  case_sensitive: boolean;
  accept_spelling_errors: boolean;
  instant_feedback: boolean;
  show_score_points: boolean;
  separate_lines: boolean;
  solution_requires_input: boolean;
  points_per_blank: number;
  pass_percentage: number;
  feedback_bands: Array<{ from: number; to: number; feedback?: string }> | null;
  status: 'draft' | 'published';
  published_at: string | null;
  library: string | null;
  /**
   * The answer key. NOT optional, and not decoration.
   *
   * The Blanks player scores from these rows, never from the passage --
   * `scoreBlanks` returns "not scoreable" the moment the array is empty, and
   * the learner is told the activity has no answers set. On a saved activity
   * the server derives them from the passage on write; a preview has no write,
   * so the same derivation happens here.
   */
  blanks: RuntimeTextActivityBlank[];
}

export interface RuntimeMemoryCard {
  id: number;
  memory_game_id: number;
  pair_set: number;
  front_type: string;
  front_text: string | null;
  front_image: string | null;
  front_alt: string | null;
  back_type: string;
  back_text: string | null;
  back_image: string | null;
  back_alt: string | null;
  match_description: string | null;
  sort_order: number;
}

export interface RuntimeMemoryGame extends RowBase {
  task_description: string | null;
  pairs_to_use: number;
  active_pair_sets: number[] | null;
  allow_retry: boolean;
  use_grid: boolean;
  shuffle_cards: boolean;
  show_completion_screen: boolean;
  completion_message: string | null;
  scoring_mode: string;
  points_per_pair: number;
  pass_percentage: number;
  track_time: boolean;
  time_limit_seconds: number;
  theme_color: string;
  card_back_image: string | null;
  feedback_bands: FeedbackBandInput[] | null;
  cards: RuntimeMemoryCard[];
}

export interface RuntimeSlideElement {
  id: number;
  presentation_id: number;
  slide_id: number;
  element_type: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  content_text: string | null;
  media_path: string | null;
  media_alt: string | null;
  options: Record<string, unknown> | null;
  ref_content_id: number | null;
  points: number;
  sort_order: number;
}

export interface RuntimeSlide {
  id: number;
  presentation_id: number;
  slide_index: number;
  title: string | null;
  background_image: string | null;
  background_token: string | null;
  notes: string | null;
  next_slide_id: number | null;
  elements: RuntimeSlideElement[];
}

export interface RuntimeCoursePresentation extends RowBase {
  theme: string;
  slide_transition: string;
  show_progress_bar: boolean;
  show_keywords: boolean;
  show_summary_slide: boolean;
  enable_print: boolean;
  active_surface: boolean;
  enable_retry: boolean;
  enable_show_solution: boolean;
  pass_percentage: number;
  feedback_bands: FeedbackBandInput[] | null;
  slides: RuntimeSlide[];
}

/** What a preview hands to a player: which player, and the row it takes. */
/**
 * A written answer.
 *
 * Not a row shape from any table, because there is no essay table: H5P.Essay
 * is not built in this platform. This is the minimum the written-answer player
 * needs, and it is built from the question like everything else here.
 */
export interface RuntimeEssay {
  id: number;
  standard_id: number | null;
  subject_id: number | null;
  chapter_id: number | null;
  title: string;
  description: string | null;
  /** The prompt, as HTML, exactly as the bank stores it. */
  prompt: string;
  /** Shown only when the learner asks for it. Null when the bank has none. */
  model_answer: string | null;
  marks: number;
  /** Words the model answer contains, offered as a self-check after a response. */
  keywords: string[];
  library: string;
}

/**
 * A deck of cards, built from one question.
 *
 * Matches `H5pFlashcard` in `app/h5p/data/h5p.ts` field for field, and is an
 * ARRAY because a match-the-following row is a deck of pairs while every other
 * form is a deck of one. The flashcard screen takes a list either way.
 */
export interface RuntimeFlashcard {
  id: number;
  standard_id: number | null;
  subject_id: number | null;
  chapter_id: number | null;
  content: string | null;
  question: string | null;
  correct_answer: string | null;
  hint: string | null;
  sub_institute_id: number | null;
}

export interface RuntimeFlashcards {
  title: string;
  description: string | null;
  library: string;
  cards: RuntimeFlashcard[];
}

export type RuntimeActivity =
  | { kind: 'single_choice_set'; item: RuntimeSingleChoiceSet }
  | { kind: 'true_false'; item: RuntimeTrueFalse }
  | { kind: 'fill_in_the_blanks'; item: RuntimeTextActivity }
  | { kind: 'drag_text'; item: RuntimeTextActivity }
  | { kind: 'mark_the_words'; item: RuntimeTextActivity }
  | { kind: 'memory_game'; item: RuntimeMemoryGame }
  | { kind: 'flashcards'; item: RuntimeFlashcards }
  | { kind: 'course_presentation'; item: RuntimeCoursePresentation }
  | { kind: 'essay'; item: RuntimeEssay };

export interface RuntimeResult {
  ok: boolean;
  activity?: RuntimeActivity;
  mapping?: TypeMapping;
  /** Present when `ok` is false: what the question is missing, in plain words. */
  reason?: string;
}

/** The curriculum keys a player needs in its context, read off the question. */
export interface RuntimeScope {
  standard_id: number | null;
  subject_id: number | null;
  chapter_id: number | null;
}

/**
 * A stable negative id for a previewed activity and its children.
 *
 * Derived from the question id so re-opening the same preview produces the same
 * keys, which keeps React from remounting a player that has not changed.
 */
/**
 * Is this something a learner could type into a blank?
 *
 * Eight words is generous for a one-word or short-phrase answer and well
 * short of a sentence of explanation. Length is checked too, because one long
 * hyphenated or comma-free run counts as few words but is still prose.
 */
/**
 * What each text-passage type asks the learner to do.
 *
 * The passage and the answer key are identical across the three; this sentence
 * is the only thing that tells a learner which of them they are sitting.
 */
const TEXT_ACTIVITY_TASK: Record<RuntimeTextActivityType, string> = {
  fill_in_the_blanks: 'Fill in the missing words.',
  drag_text: 'Drag each word into the gap it belongs in.',
  mark_the_words: 'Click the words that answer the question.',
};

/** The question's mark, defended against a null or a nonsense value. */
function marksOf(question: BankQuestion): number {
  const value = Number(question.marks ?? 1);
  return Number.isFinite(value) && value > 0 ? Math.min(Math.round(value), 100) : 1;
}

const ESSAY_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'are', 'was', 'were', 'be', 'been',
  'it', 'its', 'this', 'that', 'these', 'those', 'for', 'on', 'at', 'by', 'with', 'as', 'from',
  'into', 'than', 'then', 'so', 'because', 'which', 'when', 'while', 'if', 'not', 'no', 'can',
  'will', 'would', 'should', 'may', 'might', 'has', 'have', 'had', 'does', 'did', 'also',
  'more', 'most', 'such', 'their', 'there', 'they', 'them', 'each', 'both', 'been',
]);

/**
 * Content words from the model answer, offered to the learner as a self-check.
 *
 * EXPLICITLY NOT A MARK. Nothing in this platform grades prose, and matching a
 * learner's wording against a keyword list would be marking by coincidence --
 * an answer that says "changes state" instead of "evaporates" is not wrong.
 * These are terms to compare against AFTER writing, which is the honest thing
 * a player can offer when no marking engine exists.
 */
function essayKeywords(modelAnswer: string): string[] {
  const words = modelAnswer
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !ESSAY_STOP_WORDS.has(word));

  return Array.from(new Set(words)).slice(0, 8);
}

function isShortAnswer(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > 60) return false;
  return trimmed.split(/\s+/).length <= 8;
}

function syntheticId(questionId: number, offset = 0): number {
  return -(questionId * 1000 + offset) || -1;
}

/**
 * What a previewed activity says about itself.
 *
 * NOT the save payload's description. That one carries a machine-readable
 * `[qbank:v1:…]` marker, which existed so a SAVED activity could be traced back
 * to the questions it was generated from. Nothing is saved any more, so the
 * marker has nothing to link and would just be noise on a teacher's screen.
 */
function previewDescription(question: BankQuestion): string {
  return `Live preview of question bank QB-${question.id}. Nothing is saved.`;
}

function rowBase(
  question: BankQuestion,
  scope: RuntimeScope,
  title: string,
  description: string,
  library: string
): RowBase {
  return {
    id: syntheticId(Number(question.id)),
    standard_id: scope.standard_id,
    subject_id: scope.subject_id,
    chapter_id: scope.chapter_id,
    title,
    description: previewDescription(question),
    // Previews are never drafts awaiting a publish decision: there is nothing
    // to publish. `published` is what the players read as "playable".
    status: 'published',
    published_at: null,
    library,
    sub_institute_id: null,
  };
}

/**
 * Turn one question bank row into something a player can render right now.
 *
 * Returns `ok: false` with a reason rather than throwing, because "this
 * question cannot be played" is an ordinary outcome the table shows on a row,
 * not an error the screen has to recover from.
 */
export function mapQuestionToPlayerPayload(
  question: BankQuestion,
  scope: RuntimeScope,
  context?: string,
  /** Case study sub-parts, when the stem has any. */
  children: BankQuestion[] = [],
  /**
   * Build it as THIS H5P type rather than the question's default one.
   *
   * WHY THIS ARGUMENT EXISTS. A question is not owned by an H5P type. The
   * same fill-in-the-blank row is a blank to type, a word to drag and a word
   * to mark; the same multiple-choice row is a set of options and a card to
   * turn over. A content type page knows which of those it is, and passes it
   * here, and the row in `lms_question_master` is not copied to say so.
   *
   * Omit it and the question's default target is used, which is what every
   * caller written before this did and still gets.
   */
  as?: H5pTargetKind
): RuntimeResult {
  const mapping = mappingForQuestion(question);

  if (!mapping) {
    return { ok: false, reason: 'No question form is recorded on this row, so there is nothing to play.' };
  }
  if (!mapping.target) {
    return { ok: false, mapping, reason: `No built H5P player can carry ${mapping.label.toLowerCase()} yet.` };
  }

  // A caller that names a type it cannot have is told which part is missing,
  // not handed the default type quietly. Silently playing a different activity
  // than the page said it would is worse than an explained refusal.
  if (as && as !== mapping.target.kind) {
    const offered = mapping.alsoPlaysAs.some((target) => target.kind === as);
    if (!offered) {
      return {
        ok: false,
        mapping,
        reason: `A ${mapping.label.toLowerCase()} question cannot be asked as ${H5P_TARGETS[as].label.toLowerCase()}.`,
      };
    }

    const verdict = convertibilityAs(question, as);
    if (!verdict.ok) {
      return { ok: false, mapping, reason: verdict.reason };
    }
  }

  const id = Number(question.id);

  switch ((as ?? mapping.target.kind) as H5pTargetKind) {
    case 'single_choice_set': {
      const payload = toSingleChoiceSetPayload([question], context);
      const options = payload.questions[0]?.options ?? [];

      if (options.length < 2) {
        return { ok: false, mapping, reason: 'Fewer than two options are stored, so there is nothing to choose between.' };
      }
      if (!options.some((option) => option.is_correct)) {
        return { ok: false, mapping, reason: 'No option is flagged correct, so the activity could not be marked.' };
      }

      const setId = syntheticId(id);
      const questionId = syntheticId(id, 1);

      return {
        ok: true,
        mapping,
        activity: {
          kind: 'single_choice_set',
          item: {
            ...rowBase(question, scope, payload.title, payload.description, mapping.target.library),
            task_description: payload.task_description,
            auto_continue: payload.auto_continue,
            timeout_correct_ms: payload.timeout_correct_ms,
            timeout_wrong_ms: payload.timeout_wrong_ms,
            sound_effects: payload.sound_effects,
            enable_retry: payload.enable_retry,
            enable_show_solution: payload.enable_show_solution,
            randomize_questions: payload.randomize_questions,
            randomize_answers: payload.randomize_answers,
            points_per_question: payload.points_per_question,
            pass_percentage: payload.pass_percentage,
            show_progress: payload.show_progress,
            feedback_bands: payload.feedback_bands,
            max_score: payload.points_per_question * payload.questions.length,
            questions: payload.questions.map((entry, index) => ({
              id: syntheticId(id, 1 + index),
              set_id: setId,
              question_text: entry.question_text,
              feedback_correct: entry.feedback_correct,
              feedback_incorrect: entry.feedback_incorrect,
              explanation: entry.explanation,
              sort_order: index,
              options: entry.options.map((option, optionIndex) => ({
                id: syntheticId(id, 100 + index * 10 + optionIndex),
                question_id: questionId,
                set_id: setId,
                option_text: option.option_text,
                is_correct: option.is_correct,
                feedback: option.feedback,
                sort_order: optionIndex,
              })),
            })),
          },
        },
      };
    }

    case 'true_false': {
      // Checked BEFORE building. The builder defaults an unreadable verdict to
      // `false`, which would mark a learner wrong on a question that never said
      // either way; `trueFalseAnswer` is the reader that can answer "it does
      // not say".
      if (trueFalseAnswer(question) === null) {
        return { ok: false, mapping, reason: 'The stored answer does not read as true or false.' };
      }

      const payload = toTrueFalsePayload([question], context);

      return {
        ok: true,
        mapping,
        activity: {
          kind: 'true_false',
          item: {
            ...rowBase(question, scope, payload.title, payload.description, mapping.target.library),
            task_description: payload.task_description,
            enable_retry: payload.enable_retry,
            enable_show_solution: payload.enable_show_solution,
            enable_check_button: payload.enable_check_button,
            auto_check: payload.auto_check,
            confirm_check_dialog: payload.confirm_check_dialog,
            confirm_retry_dialog: payload.confirm_retry_dialog,
            randomize_questions: payload.randomize_questions,
            questions_to_ask: payload.questions_to_ask,
            points_per_question: payload.points_per_question,
            pass_percentage: payload.pass_percentage,
            show_progress: payload.show_progress,
            feedback_bands: payload.feedback_bands,
            max_score: payload.points_per_question * payload.questions.length,
            questions: payload.questions.map((entry, index) => ({
              id: syntheticId(id, 1 + index),
              true_false_id: syntheticId(id),
              question_text: entry.question_text,
              correct_answer: entry.correct_answer,
              feedback_correct: entry.feedback_correct,
              feedback_incorrect: entry.feedback_incorrect,
              explanation: entry.explanation,
              media_image: entry.media_image || null,
              media_alt: entry.media_alt || null,
              sort_order: index,
            })),
          },
        },
      };
    }

    /**
     * One arm for three H5P types.
     *
     * Blanks, Drag the words and Mark the words are the same row in
     * `h5p_text_activities` with a different `content_type`, and the same
     * player reads all three. So the SAME question, the SAME passage and the
     * SAME answer key produce all three activities, and the only thing that
     * varies is what the learner is asked to do with the marked words: type
     * them, drag them in, or find them.
     *
     * That is this module's whole claim, made cheaply: one row in
     * `lms_question_master`, three H5P content types, nothing duplicated.
     */
    case 'drag_text':
    case 'mark_the_words':
    case 'fill_in_the_blanks': {
      const asType = (as ?? 'fill_in_the_blanks') as RuntimeTextActivityType;
      const { slots } = blanksPassage(question);

      if (slots === 0) {
        return { ok: false, mapping, reason: 'No answer is stored, so there is nothing to fill in.' };
      }

      const payload = toBlanksPayload(question, context);
      const key = parsePassage(payload.passage);

      if (key.length === 0) {
        return { ok: false, mapping, reason: 'No answer is stored, so there is nothing to fill in.' };
      }

      // A blank a learner types into has to be a short answer. The bank stores
      // paragraph-length model answers against some of these rows -- a
      // sixty-word explanation as one blank is unanswerable, and marking it
      // against an exact string would fail every learner who wrote it in their
      // own words. Those questions are refused rather than turned into an
      // activity that cannot be got right.
      const tooLong = key.find((slot) => !isShortAnswer(slot.solution));
      if (tooLong) {
        return {
          ok: false,
          mapping,
          reason: 'The stored answer is a written explanation rather than a word or value, so it cannot be a blank to type into.',
        };
      }

      return {
        ok: true,
        mapping,
        activity: {
          kind: asType,
          item: {
            id: syntheticId(id),
            content_type: asType,
            standard_id: scope.standard_id,
            subject_id: scope.subject_id,
            chapter_id: scope.chapter_id,
            title: payload.title,
            description: previewDescription(question),
            task_description: TEXT_ACTIVITY_TASK[asType],
            passage: payload.passage,
            distractors: payload.distractors,
            media_image: payload.media_image,
            media_alt: payload.media_alt,
            enable_retry: payload.enable_retry,
            enable_show_solution: payload.enable_show_solution,
            enable_check: payload.enable_check,
            case_sensitive: payload.case_sensitive,
            accept_spelling_errors: payload.accept_spelling_errors,
            instant_feedback: payload.instant_feedback,
            show_score_points: payload.show_score_points,
            separate_lines: payload.separate_lines,
            solution_requires_input: payload.solution_requires_input,
            points_per_blank: payload.points_per_blank,
            pass_percentage: payload.pass_percentage,
            feedback_bands: payload.feedback_bands,
            status: 'published',
            published_at: null,
            // The library the ACTIVITY is, not the one the question's default
            // target would have been: asked as Drag the words, this is
            // H5P.DragText, and the xAPI statement the player emits has to say
            // so or the analytics attribute the attempt to the wrong type.
            library: H5P_TARGETS[asType].library,
            blanks: key.map((slot, index) => ({
              id: syntheticId(id, 500 + index),
              text_activity_id: syntheticId(id),
              blank_index: slot.index,
              solution: slot.solution,
              alternatives: slot.alternatives,
              tip: slot.tip,
              is_distractor: false,
            })),
          },
        },
      };
    }

    /**
     * A deck built from one question.
     *
     * A match-the-following row becomes one card per pair, because that is
     * what the question already is: a list of things and the things they go
     * with. Everything else becomes a single card — stem on the front, stored
     * answer on the back, the reason as the hint when the row carries one.
     *
     * Nothing here is marked, which is why almost every form can play as it:
     * a deck asks a learner to recall, and recall has no answer key to get
     * wrong. `onResult` reports `score: null` for the same reason the written
     * answer does.
     */
    case 'flashcards': {
      const sides = flashcardSides(question);

      if (sides.front === '') {
        return { ok: false, mapping, reason: 'The question text is empty, so the card would have a blank front.' };
      }
      if (sides.back === '') {
        return { ok: false, mapping, reason: 'No answer is stored, so the card would have a blank back.' };
      }

      const pairs = matchPairs(question);
      const cards: RuntimeFlashcard[] =
        pairs.length >= 2
          ? pairs.map((pair, index) => ({
              id: syntheticId(id, 700 + index),
              standard_id: scope.standard_id,
              subject_id: scope.subject_id,
              chapter_id: scope.chapter_id,
              content: sides.front,
              question: pair.left,
              correct_answer: pair.right,
              hint: null,
              sub_institute_id: null,
            }))
          : [
              {
                id: syntheticId(id, 700),
                standard_id: scope.standard_id,
                subject_id: scope.subject_id,
                chapter_id: scope.chapter_id,
                content: null,
                question: sides.front,
                correct_answer: sides.back,
                hint: sides.hint || null,
                sub_institute_id: null,
              },
            ];

      return {
        ok: true,
        mapping,
        activity: {
          kind: 'flashcards',
          item: {
            title: activityTitle(question, `Card ${id}`),
            description: previewDescription(question),
            library: H5P_TARGETS.flashcards.library,
            cards,
          },
        },
      };
    }

    case 'memory_game': {
      const payload = toMemoryGamePayload(question, context);

      if (payload.cards.length < 2) {
        return { ok: false, mapping, reason: 'Fewer than two pairs could be read from the question, so there is nothing to match.' };
      }

      return {
        ok: true,
        mapping,
        activity: {
          kind: 'memory_game',
          item: {
            ...rowBase(question, scope, payload.title, payload.description, mapping.target.library),
            task_description: payload.task_description,
            pairs_to_use: payload.pairs_to_use,
            active_pair_sets: payload.active_pair_sets,
            allow_retry: payload.allow_retry,
            use_grid: payload.use_grid,
            shuffle_cards: payload.shuffle_cards,
            show_completion_screen: payload.show_completion_screen,
            completion_message: payload.completion_message,
            scoring_mode: payload.scoring_mode,
            points_per_pair: payload.points_per_pair,
            pass_percentage: payload.pass_percentage,
            track_time: payload.track_time,
            time_limit_seconds: payload.time_limit_seconds,
            theme_color: payload.theme_color,
            card_back_image: payload.card_back_image,
            feedback_bands: payload.feedback_bands,
            max_score: payload.points_per_pair * payload.cards.length,
            cards: payload.cards.map((card, index) => ({
              id: syntheticId(id, 1 + index),
              memory_game_id: syntheticId(id),
              pair_set: card.pair_set,
              front_type: card.front_type,
              front_text: card.front_text,
              front_image: card.front_image || null,
              front_alt: card.front_alt || null,
              back_type: card.back_type,
              back_text: card.back_text,
              back_image: card.back_image || null,
              back_alt: card.back_alt || null,
              match_description: card.match_description,
              sort_order: index,
            })),
          },
        },
      };
    }

    case 'essay': {
      const prompt = composedStem(question);

      if (plainText(prompt) === '') {
        return { ok: false, mapping, reason: 'The question text is empty, so there is nothing to answer.' };
      }

      const modelAnswer = plainText(question.model_answer);

      return {
        ok: true,
        mapping,
        activity: {
          kind: 'essay',
          item: {
            id: syntheticId(id),
            standard_id: scope.standard_id,
            subject_id: scope.subject_id,
            chapter_id: scope.chapter_id,
            title: activityTitle(question, `Question ${id}`),
            description: previewDescription(question),
            prompt,
            model_answer: modelAnswer || null,
            marks: marksOf(question),
            keywords: essayKeywords(modelAnswer),
            library: mapping.target.library,
          },
        },
      };
    }

    case 'course_presentation': {
      const payload = toCoursePresentationPayload(question, children, context);

      if (payload.slides.length === 0) {
        return { ok: false, mapping, reason: 'The question text is empty, so there is nothing to show.' };
      }

      const presentationId = syntheticId(id);
      let elementSeed = 200;

      return {
        ok: true,
        mapping,
        activity: {
          kind: 'course_presentation',
          item: {
            ...rowBase(question, scope, payload.title, payload.description, mapping.target.library),
            theme: payload.theme,
            slide_transition: payload.slide_transition,
            show_progress_bar: payload.show_progress_bar,
            show_keywords: payload.show_keywords,
            show_summary_slide: payload.show_summary_slide,
            enable_print: payload.enable_print,
            active_surface: payload.active_surface,
            enable_retry: payload.enable_retry,
            enable_show_solution: payload.enable_show_solution,
            pass_percentage: payload.pass_percentage,
            feedback_bands: payload.feedback_bands,
            max_score: payload.slides.reduce(
              (total, slide) => total + slide.elements.reduce((sum, element) => sum + element.points, 0),
              0
            ),
            slides: payload.slides.map((slide, slideIndex) => {
              const slideId = syntheticId(id, 1 + slideIndex);

              return {
                id: slideId,
                presentation_id: presentationId,
                slide_index: slideIndex,
                title: slide.title,
                background_image: slide.background_image || null,
                background_token: slide.background_token || null,
                notes: slide.notes || null,
                // Previews never branch: a `goto_slide` target is a saved slide
                // id, and there are no saved slides here.
                next_slide_id: null,
                elements: slide.elements.map((element, elementIndex) => {
                  elementSeed += 1;

                  return {
                    id: syntheticId(id, elementSeed),
                    presentation_id: presentationId,
                    slide_id: slideId,
                    element_type: element.element_type,
                    position_x: element.position_x,
                    position_y: element.position_y,
                    width: element.width,
                    height: element.height,
                    content_text: element.content_text,
                    media_path: element.media_path || null,
                    media_alt: element.media_alt || null,
                    options: element.options,
                    ref_content_id: element.ref_content_id,
                    points: element.points,
                    sort_order: elementIndex,
                  };
                }),
              };
            }),
          },
        },
      };
    }

    default:
      return { ok: false, mapping, reason: 'No built H5P player can carry this question form yet.' };
  }
}

/** Can this question be previewed at all? The same decision, without building. */
export function isPlayable(question: BankQuestion, scope: RuntimeScope): boolean {
  return mapQuestionToPlayerPayload(question, scope).ok;
}
