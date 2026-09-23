/**
 * Question bank -> H5P projection: which bank form becomes which H5P type, and
 * what the row for it looks like.
 *
 * WHY THIS IS IN `lib/` AND NOT BESIDE THE PAGE. The same three decisions are
 * made in three places -- the library page (what does this row offer?), the
 * batch runner (what does it write?) and the chapter summary (how many are
 * convertible?). Deciding them once, in a module with no imports from `app/`,
 * is what keeps a row that reads "Ready" from failing when the runner reaches
 * it. It also means the whole projection is testable without a browser, a
 * fetch stub or a React tree, exactly like the scorers next to it.
 *
 * WHAT THIS PLATFORM ACTUALLY HAS. This is NOT embedded H5P -- there is no
 * `h5p_contents` table, no `h5p_libraries` table and no H5P JS player. Every
 * type is a native re-implementation over its own tables, rendered by this
 * product's own React players, and `.h5p` packages exist only at the file
 * boundary (`docs/H5P_CONTENT_CONVERSION_INVESTIGATION.md` SS1.2). So
 * "convert to H5P" here means: write rows the existing controller accepts, and
 * the existing builder, package service, player and xAPI emitter take over
 * unchanged. Nothing below authors H5P JSON; the server already does that.
 *
 * WHICH IS WHY SEVERAL REQUESTED LIBRARIES ARE UNAVAILABLE. `H5P.MultiChoice`
 * exists only as a Course Presentation sub-library, and `H5P.QuestionSet`,
 * `H5P.Essay` and `H5P.InteractiveBook` do not exist in this platform at all.
 * Rather than silently dropping those forms, each carries the closest type
 * that IS built, plus the sentence explaining the substitution -- see
 * `MAPPINGS` and `TypeMapping.note`.
 */

import { plainText } from './true-false';
import { parsePassage } from './text-activity-markup';

// ---------------------------------------------------------------------------
// The source row
// ---------------------------------------------------------------------------

/** One option as `/api/lms-question-bank` returns it. */
export interface BankOption {
  label: string;
  text: string;
  is_correct?: boolean;
  /**
   * The `answer_master` row this option came from, when the caller has one.
   *
   * WHY A PROJECTION THAT OTHERWISE IGNORES IDS CARRIES THIS ONE. A module
   * that RECORDS an attempt -- PAL is the one that does -- stores the option
   * the learner chose, not merely whether they were right: misconception
   * detection keys off the distractor, and `lms_online_exam_answer.answer_id`
   * is where it lands. The bank endpoint does not return the id (its
   * `optionsFor` shapes rows as label/text/is_correct), so this is absent for
   * every caller reading that endpoint and everything downstream treats it as
   * optional. PAL's own quiz payload does carry it, which is why the field
   * exists at all.
   */
  source_option_id?: number | null;
}

/**
 * The parts of a question bank row this projection reads.
 *
 * Structural on purpose: the library page passes `QuestionBankApiQuestion`
 * whole, and a future caller with a lighter shape needs no cast.
 */
export interface BankQuestion {
  id: number;
  question: string;
  /** `question_type_catalog.code`, e.g. `assertion_reason`. Null on AI rows. */
  question_type_code?: string | null;
  /** The catalogue's label, used when the code is missing. */
  question_type_raw?: string | null;
  /** The grading engine's collapsed spelling: 'MCQ' | 'Narrative'. */
  question_type?: string | null;
  options?: BankOption[];
  model_answer?: string | null;
  marks?: number | null;
  difficulty?: string | null;
  assertion?: string | null;
  reason?: string | null;
  sub_part_labels?: string[];
}

// ---------------------------------------------------------------------------
// The targets that exist
// ---------------------------------------------------------------------------

/** An H5P type this platform has actually built, keyed by its route segment. */
export type H5pTargetKind =
  | 'single_choice_set'
  | 'true_false'
  | 'fill_in_the_blanks'
  | 'drag_text'
  | 'mark_the_words'
  | 'memory_game'
  | 'flashcards'
  | 'course_presentation'
  | 'essay';

export interface H5pTarget {
  kind: H5pTargetKind;
  /** Route segment under /h5p -- the list, player and editor all live here. */
  route: string;
  /** The official library the server's builder and package manifest name. */
  library: string;
  label: string;
}

export const H5P_TARGETS: Record<H5pTargetKind, H5pTarget> = {
  single_choice_set: {
    kind: 'single_choice_set',
    route: 'h5p_single_choice_set',
    library: 'H5P.SingleChoiceSet',
    label: 'Single choice set',
  },
  true_false: {
    kind: 'true_false',
    route: 'h5p_true_false',
    library: 'H5P.TrueFalse',
    label: 'True or false',
  },
  fill_in_the_blanks: {
    kind: 'fill_in_the_blanks',
    route: 'h5p_blanks',
    library: 'H5P.Blanks',
    label: 'Fill in the blanks',
  },

  /**
   * Drag the words and Mark the words share `h5p_text_activities` with Fill
   * in the blanks -- one table, one `content_type` discriminator, one player. So
   * a row that can be a blank can be all three, and offering the other two
   * costs nothing.
   *
   * This is the cheapest instance of the point of this module: the QUESTION is
   * the content, and an H5P type is a way of asking it.
   */
  drag_text: {
    kind: 'drag_text',
    route: 'h5p_drag_text',
    library: 'H5P.DragText',
    label: 'Drag the words',
  },
  mark_the_words: {
    kind: 'mark_the_words',
    route: 'h5p_mark_the_words',
    library: 'H5P.MarkTheWords',
    label: 'Mark the words',
  },

  memory_game: {
    kind: 'memory_game',
    route: 'h5p_memory_game',
    library: 'H5P.MemoryGame',
    label: 'Memory game',
  },

  /**
   * Flash cards over `h5p_flashcards`: a front, a back and an optional hint.
   *
   * Nearly every form in the bank has those three -- stem, answer, and either
   * a hint or nothing -- which makes this the one target almost any question
   * can also play as. It marks nothing, like the card deck it is.
   */
  flashcards: {
    kind: 'flashcards',
    route: 'h5p_flashacard',
    library: 'H5P.Flashcards',
    label: 'Flash cards',
  },
  course_presentation: {
    kind: 'course_presentation',
    route: 'h5p_course_presentation',
    library: 'H5P.CoursePresentation',
    label: 'Course presentation',
  },

  /**
   * The one target with no route of its own.
   *
   * `H5P.Essay` is not built in this platform -- no table, no controller, no
   * authoring screen, and so no `/h5p/...` page to open. What exists is the
   * written-answer player in `components/h5p/players/EssayPlayer.tsx`, which
   * renders the prompt, takes a written response and reveals the stored model
   * answer. It marks nothing, because nothing here can mark prose, and an
   * empty `route` is how a caller knows there is no authored counterpart to
   * link to.
   */
  essay: {
    kind: 'essay',
    route: '',
    library: 'H5P.Essay',
    label: 'Written answer',
  },
};

// ---------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------

export interface TypeMapping {
  /** `question_type_catalog.code`. */
  code: string;
  label: string;
  /** The library the brief asked for, whether or not it exists here. */
  requested: string[];
  /**
   * False when the requested library is absent from this platform. The row is
   * still convertible when `target` is set -- `supported: false` means "not the
   * library you asked for", and the UI says so rather than hiding the form.
   */
  supported: boolean;
  /** Where it goes by default -- the closest fit. Null when nothing built can carry this form. */
  target: H5pTarget | null;
  /**
   * The OTHER built types this form can also be asked as, best first.
   *
   * WHY A LIST AND NOT ONE TARGET. A question is not owned by an H5P type. A
   * fill-in-the-blank row is the same question whether a learner types the
   * word, drags it into place or marks it in the sentence -- three H5P types,
   * one row in `lms_question_master`, no second copy. Teachers asked for the
   * same question to appear in more than one activity, and the alternative is
   * the thing this whole module exists to prevent: re-authoring it per type.
   *
   * `target` is still the DEFAULT, so every existing caller keeps the single
   * answer it already reads. This list is what the per-type pages filter on.
   */
  alsoPlaysAs: H5pTarget[];
  /** One sentence naming the substitution, shown wherever `supported` is false. */
  note: string;
}

function mapping(
  code: string,
  label: string,
  requested: string[],
  target: H5pTargetKind | null,
  supported: boolean,
  note: string,
  alsoPlaysAs: H5pTargetKind[] = []
): TypeMapping {
  return {
    code,
    label,
    requested,
    supported,
    target: target ? H5P_TARGETS[target] : null,
    note,
    alsoPlaysAs: alsoPlaysAs.map((kind) => H5P_TARGETS[kind]),
  };
}

const ESSAY_NOTE =
  'H5P.Essay is not built in this platform -- no table, no authoring screen, no route. The written-answer player renders the prompt, takes a response and reveals the stored model answer. It marks nothing, because nothing here can mark prose.';
const CASE_NOTE =
  'H5P.BranchingScenario is a planned type with no table and no player. Course presentation carries the source on the first slide and each sub-part on its own.';

/**
 * Every question form the catalogue defines, in the order the brief lists them.
 *
 * The `note` on an unsupported row is the whole point of that row existing: a
 * teacher who cannot find "Essay" needs to be told it is not built here and
 * what will be made instead, not shown an empty table.
 */
export const MAPPINGS: TypeMapping[] = [
  mapping('mcq', 'Multiple choice', ['H5P.MultiChoice'], 'single_choice_set', false,
    'H5P.MultiChoice is not built as a standalone type here -- it exists only inside Course Presentation. Single choice set is the closest built type and scores one-correct-answer questions identically.',
    ['course_presentation', 'flashcards']),

  mapping('true_false', 'True / false', ['H5P.TrueFalse'], 'true_false', true, '',
    ['single_choice_set', 'course_presentation', 'flashcards']),

  // The three text-passage types are one table and one player apart from the
  // `content_type` discriminator, so a row that fills a blank also drags the
  // word into it and marks it in the sentence -- same question, same answer
  // key, three activities.
  mapping('fill_blank', 'Fill in the blank', ['H5P.Blanks'], 'fill_in_the_blanks', true, '',
    ['drag_text', 'mark_the_words', 'flashcards', 'course_presentation']),

  mapping('match_following', 'Match the following', ['H5P.DragQuestion', 'H5P.MemoryGame'], 'memory_game', true,
    'Drag question needs drop-zone coordinates, which the bank does not store. Memory game pairs the same two columns and needs no geometry.',
    ['flashcards', 'drag_text', 'course_presentation']),

  mapping('assertion_reason', 'Assertion & reason', ['H5P.QuestionSet'], 'single_choice_set', false,
    'H5P.QuestionSet is not built here. Single choice set carries the assertion and the reason in one stem, with the stored verdicts as its options.',
    ['course_presentation', 'flashcards']),

  // A very short answer is a word or a value, so it is also a blank to type,
  // a word to drag and a word to mark. A long one is prose: it can be a card
  // to turn over and a slide to read, and nothing that marks a string.
  mapping('very_short', 'Very short answer', ['H5P.Essay'], 'essay', false, ESSAY_NOTE,
    ['fill_in_the_blanks', 'drag_text', 'mark_the_words', 'flashcards', 'course_presentation']),
  mapping('short', 'Short answer', ['H5P.Essay'], 'essay', false, ESSAY_NOTE,
    ['fill_in_the_blanks', 'flashcards', 'course_presentation']),
  mapping('long', 'Long answer', ['H5P.Essay'], 'essay', false, ESSAY_NOTE,
    ['flashcards', 'course_presentation']),

  mapping('case_study_parent', 'Case study (stem)', ['H5P.CoursePresentation', 'H5P.BranchingScenario'], 'course_presentation', true, CASE_NOTE),
  mapping('case_study_child', 'Case study (sub-part)', ['H5P.CoursePresentation', 'H5P.BranchingScenario'], 'course_presentation', true,
    'A sub-part converts on its own; converting its stem carries every sub-part with it, so convert the stem when you want the whole case.'),
  mapping('case_study', 'Case study', ['H5P.CoursePresentation', 'H5P.BranchingScenario'], 'course_presentation', true, CASE_NOTE),
  mapping('source_based_integrated', 'Source based integrated', ['H5P.CoursePresentation', 'H5P.BranchingScenario'], 'course_presentation', true, CASE_NOTE),

  mapping('competency_focused', 'Competency focused', ['H5P.CoursePresentation'], 'course_presentation', true, '',
    ['flashcards']),

  mapping('numerical', 'Numerical response', ['H5P.ArithmeticQuiz'], 'fill_in_the_blanks', false,
    'Arithmetic quiz generates its own sums and cannot carry a bank question. Fill in the blanks asks for the same typed value and marks it against the stored answer.',
    ['drag_text', 'flashcards', 'course_presentation']),

  mapping('proof', 'Prove / show that', ['H5P.InteractiveBook'], 'course_presentation', false,
    'H5P.InteractiveBook does not exist in this platform. Course presentation carries the statement to prove, with the worked answer in the slide notes.'),
  mapping('construction', 'Plot / draw / construct', ['H5P.InteractiveBook'], 'course_presentation', false,
    'H5P.InteractiveBook does not exist in this platform. Course presentation carries the construction brief, with the reference answer in the slide notes.'),
];

const BY_CODE = new Map(MAPPINGS.map((entry) => [entry.code, entry]));

/** Case, punctuation and separators removed, so only the words compare. */
function fold(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Folded label -> mapping, so a row carrying only "Match the Following" still
 * lands on `match_following`. A catalogue label and its code are different
 * strings, and a row with no code is exactly the row that needs this.
 */
const BY_LABEL = new Map(MAPPINGS.map((entry) => [fold(entry.label), entry]));

function byAnyName(value: unknown): TypeMapping | null {
  const token = fold(value);
  if (token === '') return null;
  return BY_CODE.get(token) ?? BY_LABEL.get(token) ?? null;
}

/**
 * The mapping a question falls under.
 *
 * Tries the catalogue code first, then the catalogue label, then the grading
 * engine's spelling -- the same three names `lib/question-paper/question-types.ts`
 * matches on, and for the same reason: an AI-generated row carries no code.
 */
export function mappingForQuestion(question: BankQuestion): TypeMapping | null {
  const direct = byAnyName(question.question_type_code);
  if (direct) return direct;

  const byLabel = byAnyName(question.question_type_raw);
  if (byLabel) return byLabel;

  // 'MCQ' is what the API collapses every option-bearing form down to, so it is
  // the last resort rather than the first: an assertion-and-reason row is also
  // 'MCQ', and reading that first would lose its stem.
  if (fold(question.question_type) === 'mcq') return BY_CODE.get('mcq') ?? null;

  return null;
}

export function mappingForCode(code: string | null | undefined): TypeMapping | null {
  return byAnyName(code);
}

// ---------------------------------------------------------------------------
// Can THIS row be converted?
// ---------------------------------------------------------------------------

export interface Convertibility {
  ok: boolean;
  /** Present when `ok` is false: what is missing, in a teacher's words. */
  reason?: string;
}

const READY: Convertibility = { ok: true };

/**
 * Short enough to be a blank a learner types or drags into.
 *
 * Six words is the line, and it is about MARKING rather than length: a blank
 * is graded by string comparison, and beyond a short phrase two people who
 * both understood the question will write it differently and one of them will
 * be marked wrong.
 */
function isShortSolution(value: string): boolean {
  const words = plainText(value).trim().split(/\s+/).filter((word) => word !== '');
  return words.length > 0 && words.length <= 6 && plainText(value).length <= 60;
}

export interface FlashcardSides {
  front: string;
  back: string;
  hint: string;
}

/**
 * The question as a card: what is asked, what it says when turned over.
 *
 * Reads the model answer first, then the flagged options, then the match
 * pairs -- in that order because that is the order of specificity, not
 * preference. A deck marks nothing, so anything that states an answer at all
 * makes a valid card; this is why flash cards is the target nearly every
 * question can also play as.
 */
export function flashcardSides(question: BankQuestion): FlashcardSides {
  const front = plainText(composedStem(question));

  const stated = plainText(question.model_answer);
  const flagged = correctOptions(question)
    .map((option) => plainText(option.text))
    .filter((text) => text !== '')
    .join('; ');
  const paired = matchPairs(question)
    .map((pair) => `${pair.left} — ${pair.right}`)
    .join('; ');

  return {
    front,
    back: stated || flagged || paired || '',
    // The reason, where a row carries one, is what a card back is for: the
    // answer alone teaches nothing on the second pass.
    hint: plainText(question.reason),
  };
}

function correctOptions(question: BankQuestion): BankOption[] {
  return (question.options ?? []).filter((option) => option.is_correct === true);
}

/**
 * Whether the projection can produce a playable activity from this row.
 *
 * A mapping says what a FORM becomes; this says whether a ROW has the parts.
 * The bank holds 219 questions with no options and 948 with no correct answer
 * flagged (investigation SS5.1) -- those list perfectly and would mark every
 * learner wrong, so they are refused here rather than converted.
 */
export function convertibility(question: BankQuestion): Convertibility {
  const map = mappingForQuestion(question);
  if (!map) return { ok: false, reason: 'No question form is recorded on this row, so there is nothing to map it to.' };
  if (!map.target) return { ok: false, reason: `No built H5P type can carry ${map.label.toLowerCase()} yet.` };

  return convertibilityAs(question, map.target.kind);
}

/**
 * The same question, judged against ONE named H5P type.
 *
 * WHY THIS IS SEPARATE FROM `convertibility`. A row has different parts
 * missing depending on what you ask it to be. A short-answer question with a
 * one-word answer is a perfectly good blank to type into and a perfectly good
 * card to turn over, but it is not a Mark-the-words activity unless that word
 * sits inside a sentence. Asking "is this row convertible?" cannot answer
 * that; asking "is this row playable AS mark the words?" can.
 *
 * This is what each per-type page filters on, so that a type only ever lists
 * the questions it can actually ask -- rather than listing everything and
 * failing at the moment a learner presses play.
 */
export function convertibilityAs(question: BankQuestion, kind: H5pTargetKind): Convertibility {
  switch (kind) {
    case 'single_choice_set': {
      const options = question.options ?? [];
      if (options.length < 2) return { ok: false, reason: 'Fewer than two options are stored, so there is nothing to choose between.' };
      if (correctOptions(question).length === 0) return { ok: false, reason: 'No option is flagged correct, so the activity could not be marked.' };
      return READY;
    }
    case 'true_false':
      return trueFalseAnswer(question) === null
        ? { ok: false, reason: 'The stored answer does not read as true or false.' }
        : READY;
    case 'fill_in_the_blanks':
    case 'drag_text': {
      const passage = blanksPassage(question);
      if (passage.slots === 0) {
        return { ok: false, reason: 'No answer is stored, so there is nothing to fill in.' };
      }
      // Same refusal as the runtime makes: a paragraph-long model answer is
      // not a word to type or drag, and marking it against an exact string
      // would fail every learner who worded it differently.
      const prose = parsePassage(passage.passage).find((slot) => !isShortSolution(slot.solution));
      if (prose) {
        return {
          ok: false,
          reason: 'The stored answer is a written explanation rather than a word or value, so it cannot be a blank.',
        };
      }
      return READY;
    }

    case 'mark_the_words': {
      const passage = blanksPassage(question);
      if (passage.slots === 0) {
        return { ok: false, reason: 'No answer is stored, so there is nothing to mark.' };
      }
      // The same prose refusal the other two text types make, and it is needed
      // here for its own reason rather than by symmetry: a learner marks
      // WORDS, and a twenty-word span is not a word. It renders as most of the
      // sentence already highlighted.
      const prose = parsePassage(passage.passage).find((slot) => !isShortSolution(slot.solution));
      if (prose) {
        return {
          ok: false,
          reason: 'The stored answer is a written explanation rather than a word or value, so there is no word to mark.',
        };
      }
      if (!passage.inline) {
        return {
          ok: false,
          reason: 'The answer is not part of the sentence — this question states it separately, so there would be nothing to find.',
        };
      }
      // A sentence with nothing in it but the answers is not a finding task:
      // every word is correct, and a learner who marks all of them scores full
      // marks without reading.
      const unmarked = plainText(passage.passage.replace(/\*[^*]*\*/g, ' '))
        .split(/\s+/)
        .filter((word) => word !== '').length;
      if (unmarked < 4) {
        return {
          ok: false,
          reason: 'The sentence is almost entirely answer, so there would be nothing to choose between.',
        };
      }
      return READY;
    }

    case 'flashcards':
      return flashcardSides(question).back === ''
        ? { ok: false, reason: 'No answer is stored, so the card would have a blank back.' }
        : flashcardSides(question).front === ''
          ? { ok: false, reason: 'The question text is empty, so the card would have a blank front.' }
          : READY;
    case 'memory_game':
      return matchPairs(question).length < 2
        ? { ok: false, reason: 'Fewer than two pairs could be read from the question, so there is nothing to match.' }
        : READY;
    case 'course_presentation':
      return plainText(composedStem(question)) === ''
        ? { ok: false, reason: 'The question text is empty.' }
        : READY;
    default:
      return READY;
  }
}

// ---------------------------------------------------------------------------
// The reverse index: which questions belong to THIS H5P type
//
// Everything above answers "what does this question become?". A content type
// page asks the opposite question -- "which questions can I ask?" -- and these
// three functions are that direction. They are the whole of the auto-sourcing
// contract: a page names its kind, and gets the rows it can actually play.
// ---------------------------------------------------------------------------

/**
 * Every built H5P type this question can be asked as, default first.
 *
 * Includes the secondary targets, and only the ones this particular ROW has
 * the parts for -- a short-answer question whose answer is a paragraph offers
 * flash cards but not fill in the blanks, and the row next to it offers both.
 */
export function targetsForQuestion(question: BankQuestion): H5pTarget[] {
  const map = mappingForQuestion(question);
  if (!map || !map.target) return [];

  return [map.target, ...map.alsoPlaysAs].filter(
    (target) => convertibilityAs(question, target.kind).ok
  );
}

/**
 * Can this row be played as this H5P type?
 *
 * Both halves matter and they fail differently. The FORM has to be one this
 * type can carry (a case study is not a true/false), and then the ROW has to
 * carry the parts (a true/false whose stored answer is "depends" is not
 * playable either). The reason a page shows is always the second one, because
 * the first is why the row was never offered.
 */
export function playsAs(question: BankQuestion, kind: H5pTargetKind): boolean {
  const map = mappingForQuestion(question);
  if (!map || !map.target) return false;

  const offered = map.target.kind === kind || map.alsoPlaysAs.some((target) => target.kind === kind);
  return offered && convertibilityAs(question, kind).ok;
}

/**
 * The subset of a chapter a given H5P type can ask.
 *
 * This is what makes "display only compatible questions inside each H5P
 * content type" true by construction rather than by each page remembering to
 * filter. One list in, one list out, decided by the same map that decides
 * everything else.
 */
export function questionsPlayableAs<T extends BankQuestion>(questions: T[], kind: H5pTargetKind): T[] {
  return questions.filter((question) => playsAs(question, kind));
}

/** Every form in the catalogue that can reach this type, for a page that names them. */
export function formsReaching(kind: H5pTargetKind): TypeMapping[] {
  return MAPPINGS.filter(
    (entry) => entry.target?.kind === kind || entry.alsoPlaysAs.some((target) => target.kind === kind)
  );
}

// ---------------------------------------------------------------------------
// Reading the answer out of a bank row
// ---------------------------------------------------------------------------

const TRUE_WORDS = new Set(['true', 't', 'yes', 'y', 'correct', 'right', '1']);
const FALSE_WORDS = new Set(['false', 'f', 'no', 'n', 'incorrect', 'wrong', '0']);

/**
 * True, false, or null when the row does not say.
 *
 * Reads the flagged option first and the model answer second, because a
 * true/false row in this bank is stored either way: as a two-option MCQ, or as
 * a narrative question whose model answer is the single word.
 */
export function trueFalseAnswer(question: BankQuestion): boolean | null {
  for (const option of correctOptions(question)) {
    const word = plainText(option.text).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (TRUE_WORDS.has(word)) return true;
    if (FALSE_WORDS.has(word)) return false;
  }

  const answer = plainText(question.model_answer).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (TRUE_WORDS.has(answer)) return true;
  if (FALSE_WORDS.has(answer)) return false;

  return null;
}

/** `*` delimits a blank in the passage grammar, so prose asterisks are escaped. */
function escapeAsterisks(text: string): string {
  return text.replace(/\*/g, '\\*');
}

export interface BlanksPassage {
  passage: string;
  /** How many answers the passage marks. Zero means nothing to convert. */
  slots: number;
  /**
   * True when the answers were substituted into blanks the stem already drew,
   * false when they were appended to the end of it.
   *
   * Mark the words is the only target that needs to know. Typing or dragging a
   * word into a trailing slot reads fine; asking a learner to find the answer
   * in a sentence where it was stapled to the end does not -- it is always the
   * last word. That target refuses the appended shape for that reason.
   */
  inline: boolean;
}

/**
 * The question rewritten as a Fill-in-the-blanks passage.
 *
 * The grammar is `*solution/alternative:tip*` (`lib/h5p/text-activity-markup.ts`),
 * and the SERVER re-parses whatever is sent -- the answer key is always derived
 * there, never trusted from this client. So this only has to produce markup the
 * server will read the same way.
 *
 * Three shapes are handled, in order: a stem that already draws its blanks
 * ("The capital of France is ______"), which takes one answer per blank; a stem
 * with no blank at all, which gets the answer appended as a trailing slot; and
 * several answers separated by `;` or `|`, which fill successive blanks.
 */
export function blanksPassage(question: BankQuestion): BlanksPassage {
  const stem = plainText(question.question);

  const stored =
    plainText(question.model_answer) ||
    correctOptions(question)
      .map((option) => plainText(option.text))
      .join('; ');

  const answers = stored
    .split(/\s*[;|]\s*/)
    .map((part) => part.trim())
    .filter((part) => part !== '');

  if (answers.length === 0) return { passage: escapeAsterisks(stem), slots: 0, inline: false };

  // A run of three or more underscores, dots or dashes is how this bank draws a
  // blank. Two would match ordinary punctuation and an em dash in prose.
  const blankPattern = /(_{3,}|\.{3,}|-{3,})/g;
  const drawn = stem.match(blankPattern)?.length ?? 0;

  if (drawn === 0) {
    const tail = answers.map((answer) => `*${escapeAsterisks(answer)}*`).join(' ');
    return { passage: `${escapeAsterisks(stem)} ${tail}`.trim(), slots: answers.length, inline: false };
  }

  let index = 0;
  const passage = escapeAsterisks(stem).replace(blankPattern, () => {
    // More blanks than answers: the extra ones stay drawn as prose rather than
    // becoming a slot with nothing to mark against.
    const answer = answers[index];
    index += 1;
    return answer ? `*${escapeAsterisks(answer)}*` : '______';
  });

  return { passage, slots: Math.min(drawn, answers.length), inline: true };
}

export interface MatchPair {
  left: string;
  right: string;
}

/**
 * The pairs behind a "match the following" question.
 *
 * The bank stores these two ways and neither is a pair column, so both are
 * read: a model answer keyed as `A-3, B-1` resolved against the option labels,
 * or options that carry both halves as `left - right`.
 */
export function matchPairs(question: BankQuestion): MatchPair[] {
  const options = question.options ?? [];
  const byLabel = new Map(
    options.map((option) => [plainText(option.label).toUpperCase(), plainText(option.text)])
  );

  const separator = /\s*(?:->|→|—|–|-|:|=)\s*/;

  // 1. The model answer as a key: "A-3, B-1" or "A -> 3".
  const answerText = plainText(question.model_answer);
  if (answerText) {
    const keyed = answerText
      .split(/\s*[,;\n]\s*/)
      .map((entry) => entry.split(separator).map((part) => part.trim()).filter(Boolean))
      .filter((parts) => parts.length === 2)
      .map(([left, right]) => ({
        left: byLabel.get(left.toUpperCase()) ?? left,
        right: byLabel.get(right.toUpperCase()) ?? right,
      }))
      .filter((pair) => pair.left !== '' && pair.right !== '' && pair.left !== pair.right);

    if (keyed.length >= 2) return keyed;
  }

  // 2. Each option carrying both halves: "Mitochondrion - powerhouse".
  const split = options
    .map((option) => plainText(option.text).split(separator).map((part) => part.trim()).filter(Boolean))
    .filter((parts) => parts.length === 2)
    .map(([left, right]) => ({ left, right }));

  return split.length >= 2 ? split : [];
}

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

/**
 * What a built activity says about where it came from.
 *
 * An earlier build of this feature put a machine-readable `[qbank:v1:…]`
 * marker here, so that an activity SAVED as an H5P draft could be traced back
 * to the questions it was generated from. Nothing is saved any more -- the
 * library builds an activity in memory and plays it -- so the marker had
 * nothing left to link and has gone with the conversion step. What remains is
 * a sentence for a person to read.
 */
export function sourceDescription(questionIds: Array<number | string>, context?: string): string {
  const count = new Set(questionIds.map(Number)).size;
  const noun = count === 1 ? 'question' : 'questions';
  const where = context ? ` (${context})` : '';
  return `Built from ${count} question bank ${noun}${where}.`;
}

// ---------------------------------------------------------------------------
// Titles
// ---------------------------------------------------------------------------

/** A title a teacher can pick out of a list: the stem, cut at a word. */
export function activityTitle(question: BankQuestion, fallback: string): string {
  const stem = plainText(question.question) || plainText(question.assertion);
  if (stem === '') return fallback;
  if (stem.length <= 70) return stem;

  const cut = stem.slice(0, 70);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

// ---------------------------------------------------------------------------
// The payloads
//
// Each builder returns exactly what the matching `*SavePayload` in
// `app/h5p/data/h5p-content-types.ts` declares. The shapes are written out
// structurally rather than imported so this module keeps no dependency on
// `app/`; the data layer assigns the result to the real type, which is where
// any drift between the two fails to compile.
// ---------------------------------------------------------------------------

export interface FeedbackBandInput {
  from: number;
  to: number;
  feedback: string;
}

/** The same three bands on every converted activity, so scoring reads alike. */
const BANDS: FeedbackBandInput[] = [
  { from: 0, to: 39, feedback: 'Worth another look — revisit this part of the chapter and try again.' },
  { from: 40, to: 79, feedback: 'A solid attempt. Check what you missed, then go again.' },
  { from: 80, to: 100, feedback: 'Well done — you have this.' },
];

function marks(question: BankQuestion): number {
  const value = Number(question.marks ?? 1);
  return Number.isFinite(value) && value > 0 ? Math.min(Math.round(value), 100) : 1;
}

export interface SingleChoiceOptionPayload {
  option_text: string;
  is_correct: boolean;
  feedback: string;
  /** The `answer_master` row behind this option, or null. See `BankOption`. */
  source_option_id: number | null;
}
export interface SingleChoiceQuestionPayload {
  question_text: string;
  feedback_correct: string;
  feedback_incorrect: string;
  explanation: string;
  options: SingleChoiceOptionPayload[];
}
export interface SingleChoiceSetPayload {
  title: string;
  description: string;
  task_description: string;
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
  feedback_bands: FeedbackBandInput[];
  questions: SingleChoiceQuestionPayload[];
}

/**
 * The stem a learner is asked about.
 *
 * Assertion-and-reason rows keep both halves in their own columns, and both
 * have to reach the learner or the verdicts are unanswerable.
 */
export function composedStem(question: BankQuestion): string {
  const assertion = plainText(question.assertion);
  const reason = plainText(question.reason);
  const stem = String(question.question ?? '').trim();

  if (assertion === '' && reason === '') return stem;

  return [
    stem,
    assertion ? `<p><strong>Assertion:</strong> ${assertion}</p>` : '',
    reason ? `<p><strong>Reason:</strong> ${reason}</p>` : '',
  ]
    .filter((part) => part !== '')
    .join('');
}

/**
 * A stored option id, or null when the caller did not supply one.
 *
 * Folded through `Number` rather than trusted, because the value crosses a
 * JSON boundary where Laravel returns ids as strings as readily as numbers,
 * and a string id would compare unequal to the number the player holds.
 */
function sourceOptionId(option: BankOption): number | null {
  const id = Number(option.source_option_id ?? NaN);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function toSingleChoiceSetPayload(questions: BankQuestion[], context?: string): SingleChoiceSetPayload {
  const first = questions[0];

  return {
    title:
      questions.length === 1
        ? activityTitle(first, `Question ${first.id}`)
        : `${context ?? 'Question bank'} — ${questions.length} questions`,
    description: sourceDescription(questions.map((question) => question.id), context),
    task_description: 'Choose the correct answer.',
    auto_continue: true,
    timeout_correct_ms: 2000,
    timeout_wrong_ms: 3000,
    sound_effects: false,
    enable_retry: true,
    enable_show_solution: true,
    randomize_questions: questions.length > 1,
    randomize_answers: true,
    points_per_question: marks(first),
    pass_percentage: 60,
    show_progress: true,
    feedback_bands: BANDS,
    questions: questions.map((question) => ({
      question_text: composedStem(question),
      feedback_correct: 'Correct.',
      feedback_incorrect: 'Not quite — review the solution.',
      explanation: plainText(question.model_answer),
      options: (question.options ?? []).map((option) => ({
        option_text: String(option.text ?? '').trim(),
        is_correct: option.is_correct === true,
        feedback: '',
        // Null for every caller reading the bank endpoint; a real
        // `answer_master` id for PAL, which has to record what was chosen.
        source_option_id: sourceOptionId(option),
      })),
    })),
  };
}

export interface TrueFalseQuestionPayload {
  question_text: string;
  correct_answer: boolean;
  feedback_correct: string;
  feedback_incorrect: string;
  explanation: string;
  media_image: string;
  media_alt: string;
}
export interface TrueFalsePayload {
  title: string;
  description: string;
  task_description: string;
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
  feedback_bands: FeedbackBandInput[];
  questions: TrueFalseQuestionPayload[];
}

export function toTrueFalsePayload(questions: BankQuestion[], context?: string): TrueFalsePayload {
  const first = questions[0];

  return {
    title:
      questions.length === 1
        ? activityTitle(first, `Statement ${first.id}`)
        : `${context ?? 'Question bank'} — ${questions.length} statements`,
    description: sourceDescription(questions.map((question) => question.id), context),
    task_description: 'Decide whether each statement is true or false.',
    enable_retry: true,
    enable_show_solution: true,
    enable_check_button: true,
    auto_check: false,
    confirm_check_dialog: false,
    confirm_retry_dialog: false,
    randomize_questions: questions.length > 1,
    // 0 asks the whole pool. A converted item asks everything it carries: the
    // draw is an authoring choice, and nothing here is placed to make it.
    questions_to_ask: 0,
    points_per_question: marks(first),
    pass_percentage: 60,
    show_progress: true,
    feedback_bands: BANDS,
    questions: questions.map((question) => ({
      question_text: composedStem(question),
      correct_answer: trueFalseAnswer(question) === true,
      feedback_correct: 'Correct.',
      feedback_incorrect: 'Not quite — review the solution.',
      explanation: plainText(question.model_answer),
      media_image: '',
      media_alt: '',
    })),
  };
}

export interface BlanksPayload {
  title: string;
  description: string;
  task_description: string;
  passage: string;
  distractors: string;
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
  feedback_bands: FeedbackBandInput[];
}

export function toBlanksPayload(question: BankQuestion, context?: string): BlanksPayload {
  return {
    title: activityTitle(question, `Blank ${question.id}`),
    description: sourceDescription([question.id], context),
    task_description: 'Fill in the missing words.',
    passage: blanksPassage(question).passage,
    distractors: '',
    media_image: null,
    media_alt: null,
    enable_retry: true,
    enable_show_solution: true,
    enable_check: true,
    case_sensitive: false,
    // Forgiven on words of four letters or more, so a spelling slip does not
    // read as a wrong answer on a question that was never about spelling.
    accept_spelling_errors: true,
    instant_feedback: false,
    show_score_points: true,
    separate_lines: false,
    solution_requires_input: true,
    points_per_blank: marks(question),
    pass_percentage: 60,
    feedback_bands: BANDS,
  };
}

export interface MemoryCardPayload {
  pair_set: number;
  front_type: 'text' | 'image';
  front_text: string;
  front_image: string;
  front_alt: string;
  back_type: 'text' | 'image';
  back_text: string;
  back_image: string;
  back_alt: string;
  match_description: string;
}
export interface MemoryGamePayload {
  title: string;
  description: string;
  task_description: string;
  pairs_to_use: number;
  active_pair_sets: number[];
  allow_retry: boolean;
  use_grid: boolean;
  shuffle_cards: boolean;
  show_completion_screen: boolean;
  completion_message: string;
  scoring_mode: 'pairs' | 'moves';
  points_per_pair: number;
  pass_percentage: number;
  track_time: boolean;
  time_limit_seconds: number;
  theme_color: string;
  card_back_image: string;
  feedback_bands: FeedbackBandInput[];
  cards: MemoryCardPayload[];
}

export function toMemoryGamePayload(question: BankQuestion, context?: string): MemoryGamePayload {
  return {
    title: activityTitle(question, `Match ${question.id}`),
    description: sourceDescription([question.id], context),
    task_description: plainText(question.question) || 'Match each item to its pair.',
    pairs_to_use: 0,
    active_pair_sets: [1],
    allow_retry: true,
    use_grid: true,
    shuffle_cards: true,
    show_completion_screen: true,
    completion_message: 'Every pair matched.',
    scoring_mode: 'pairs',
    points_per_pair: 1,
    pass_percentage: 60,
    track_time: true,
    time_limit_seconds: 0,
    theme_color: '#4f46e5',
    card_back_image: '',
    feedback_bands: BANDS,
    cards: matchPairs(question).map((pair) => ({
      pair_set: 1,
      front_type: 'text' as const,
      front_text: pair.left,
      front_image: '',
      front_alt: '',
      back_type: 'text' as const,
      back_text: pair.right,
      back_image: '',
      back_alt: '',
      match_description: `${pair.left} — ${pair.right}`,
    })),
  };
}

export interface SlideElementPayload {
  element_type:
    | 'text'
    | 'image'
    | 'video'
    | 'audio'
    | 'multiple_choice'
    | 'true_false'
    | 'blanks'
    | 'drag_drop'
    | 'goto_slide';
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  content_text: string;
  media_path: string;
  media_alt: string;
  options: Record<string, unknown>;
  ref_content_id: number | null;
  points: number;
}
export interface SlidePayload {
  ref: string;
  title: string;
  background_image: string;
  background_token: string;
  notes: string;
  next_slide_ref: string;
  elements: SlideElementPayload[];
}
export interface CoursePresentationPayload {
  title: string;
  description: string;
  theme: 'default' | 'slate' | 'indigo' | 'warm' | 'high-contrast';
  slide_transition: 'none' | 'fade' | 'slide';
  show_progress_bar: boolean;
  show_keywords: boolean;
  show_summary_slide: boolean;
  enable_print: boolean;
  active_surface: boolean;
  enable_retry: boolean;
  enable_show_solution: boolean;
  pass_percentage: number;
  feedback_bands: FeedbackBandInput[];
  slides: SlidePayload[];
}

function textElement(html: string, y: number, height: number): SlideElementPayload {
  return {
    element_type: 'text',
    position_x: 6,
    position_y: y,
    width: 88,
    height,
    content_text: html,
    media_path: '',
    media_alt: '',
    options: {},
    ref_content_id: null,
    points: 0,
  };
}

/**
 * One slide per question, plus a stem slide when there is source material.
 *
 * A question that carries options becomes a scored `multiple_choice` element;
 * one that does not becomes prose, with its model answer in the slide NOTES --
 * notes are author- and teacher-facing and never shown to a learner, which is
 * the only place a model answer can sit without giving itself away.
 */
export function toCoursePresentationPayload(
  stem: BankQuestion,
  children: BankQuestion[],
  context?: string
): CoursePresentationPayload {
  const parts = children;
  const slides: SlidePayload[] = [];

  if (parts.length > 0) {
    slides.push({
      ref: 'slide-stem',
      title: 'Read this first',
      background_image: '',
      background_token: '',
      notes: '',
      next_slide_ref: '',
      elements: [textElement(composedStem(stem), 8, 76)],
    });
  }

  const asked = parts.length > 0 ? parts : [stem];

  asked.forEach((question, index) => {
    const options = question.options ?? [];
    const scored = options.length >= 2 && options.some((option) => option.is_correct === true);

    const elements: SlideElementPayload[] = scored
      ? [
          {
            element_type: 'multiple_choice',
            position_x: 6,
            position_y: 8,
            width: 88,
            height: 76,
            content_text: composedStem(question),
            media_path: '',
            media_alt: '',
            options: {
              answers: options.map((option) => ({
                text: plainText(option.text),
                correct: option.is_correct === true,
                feedback: '',
              })),
              randomise_answers: true,
              enable_retry: true,
              enable_solution: true,
            },
            ref_content_id: null,
            points: marks(question),
          },
        ]
      : [textElement(composedStem(question), 8, 76)];

    slides.push({
      ref: `slide-${index + 1}`,
      title: parts.length > 0 ? `Part ${index + 1}` : activityTitle(question, `Question ${question.id}`),
      background_image: '',
      background_token: '',
      notes: scored ? '' : plainText(question.model_answer),
      next_slide_ref: '',
      elements,
    });
  });

  return {
    title: activityTitle(stem, `Case study ${stem.id}`),
    description: sourceDescription([stem.id, ...parts.map((question) => question.id)], context),
    theme: 'default',
    slide_transition: 'fade',
    show_progress_bar: true,
    show_keywords: false,
    show_summary_slide: true,
    enable_print: true,
    active_surface: false,
    enable_retry: true,
    enable_show_solution: true,
    pass_percentage: 60,
    feedback_bands: BANDS,
    slides,
  };
}
