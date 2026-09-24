/**
 * Paper building and scoring for H5P Single Choice Set (H5P.SingleChoiceSet).
 *
 * Lives in `lib/` rather than beside the player so it can be tested without a
 * browser, a fetch stub or a React tree. It has no imports for the same
 * reason: the inputs are structural, so `app/h5p/data/h5p-content-types.ts`
 * can satisfy them with its own richer row types without either side depending
 * on the other.
 *
 * WHY SHUFFLING IS HERE AND SEEDED
 *
 * An author can ask for the questions, the answers, or both to be shuffled.
 * Done with `Math.random()` inside the player, that has three problems, and
 * the third is the one that matters:
 *
 *   1. a learner who reloads mid-attempt gets a different paper;
 *   2. the tests can only assert on statistics, never on a paper;
 *   3. a teacher looking at a result cannot see what the learner saw, which
 *      makes "she picked B" unanswerable.
 *
 * So the shuffle is a seeded permutation, the seed is drawn once per attempt,
 * and the seed is recorded with the attempt. The same three properties the
 * arithmetic quiz's generator has, for the same reasons.
 *
 * THE CORRECT ANSWER IS A FLAG HERE, NEVER A POSITION. The H5P format says
 * `answers[0]` is correct; this schema says `is_correct` is. The conversion
 * happens once, on the server, in H5PSingleChoiceSetBuilder. Nothing in this
 * file may assume position, because the whole point of the shuffle is that
 * position is not stable.
 */

export interface SingleChoiceOption {
  id: number;
  option_text: string;
  is_correct: boolean;
  feedback?: string | null;
  /**
   * The row this option was derived from, for an activity built out of a
   * question bank row rather than authored into `h5p_single_choice_set`.
   *
   * `id` above is the activity's own option id and is synthetic for a derived
   * activity, so it cannot be recorded against an attempt. This is the id that
   * can: a module that stores what the learner chose reads it off the chosen
   * option. Absent (and irrelevant) for an authored set, where the option IS
   * the stored row.
   */
  source_option_id?: number | null;
}

export interface SingleChoiceQuestion {
  id: number;
  question_text: string;
  feedback_correct?: string | null;
  feedback_incorrect?: string | null;
  explanation?: string | null;
  options: SingleChoiceOption[];
}

export interface SingleChoiceSetRules {
  randomize_questions: boolean;
  randomize_answers: boolean;
}

export interface SingleChoiceScoringRules {
  points_per_question: number;
  pass_percentage: number;
}

/** One question as a learner will actually see it: shuffled, and positioned. */
export interface PreparedQuestion {
  /** Position in this attempt's paper, 0-based. */
  index: number;
  question: SingleChoiceQuestion;
  /** The options in the order this attempt shows them. */
  options: SingleChoiceOption[];
}

/** A learner's choice. `optionId` is null for a question they did not reach. */
export type SingleChoiceAnswer = number | null;

export interface SingleChoiceAttemptResult {
  correctCount: number;
  answeredCount: number;
  questionCount: number;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
}

// ---------------------------------------------------------------------------
// Seeded shuffling
// ---------------------------------------------------------------------------

/**
 * mulberry32 — a small, fast, well-distributed 32-bit PRNG.
 *
 * The same generator the arithmetic quiz uses, for the same reason: a
 * hand-rolled LCG correlates consecutive draws, which in a Fisher-Yates
 * shuffle shows up as the first element staying put far too often.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed for a fresh attempt. Recorded with the attempt so it can be replayed. */
export function newAttemptSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/**
 * Fisher-Yates, on a copy.
 *
 * Copied rather than shuffled in place because the caller's array is the row
 * data from the API, which the editor and the results screen both read
 * afterwards — shuffling it in place would reorder the author's questions
 * under them.
 */
function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Preparing a paper
// ---------------------------------------------------------------------------

/**
 * Build the paper for one attempt.
 *
 * ONE RANDOM STREAM DRIVES EVERYTHING, in a fixed order: the question shuffle
 * first, then each question's answers in paper order. That is what makes a
 * seed reproduce a paper exactly. Drawing the answer shuffles from a second
 * generator, or in author order rather than paper order, would still look
 * random and would quietly stop the seed meaning anything.
 *
 * A question with no options is KEPT, not dropped. It cannot be answered and
 * will score zero, which is exactly what should happen — silently removing it
 * would change the max score and make a broken activity look like a shorter
 * one. Publish refuses to let it get this far; this is the read path.
 */
export function prepareSingleChoicePaper(
  questions: SingleChoiceQuestion[],
  rules: SingleChoiceSetRules,
  seed: number
): PreparedQuestion[] {
  const random = mulberry32(seed);

  const ordered = rules.randomize_questions ? shuffle(questions, random) : [...questions];

  return ordered.map((question, index) => ({
    index,
    question,
    options: rules.randomize_answers ? shuffle(question.options, random) : [...question.options],
  }));
}

/** The right option for a question, or null when the author has not set one. */
export function correctOption(question: SingleChoiceQuestion): SingleChoiceOption | null {
  return question.options.find((option) => option.is_correct) ?? null;
}

/**
 * Whether a chosen option id is the right one.
 *
 * A null choice is unanswered, which is not the same as wrong — see
 * `scoreSingleChoiceAttempt`.
 */
export function isCorrectChoice(question: SingleChoiceQuestion, optionId: SingleChoiceAnswer): boolean {
  if (optionId === null || optionId === undefined) return false;

  return question.options.some((option) => option.id === optionId && option.is_correct);
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

/**
 * What to say about one answered question.
 *
 * The order is specific and is the whole reason this is a function rather than
 * an expression in the player: the feedback on the OPTION a learner actually
 * chose is the most useful thing that can be said to them, so it wins over the
 * question's generic "not quite". An author who wrote "you may be thinking of
 * the Venus flytrap" on a particular distractor wrote it for the learner who
 * picked it.
 */
export function answerFeedback(
  question: SingleChoiceQuestion,
  optionId: SingleChoiceAnswer
): { correct: boolean; message: string } {
  const chosen = question.options.find((option) => option.id === optionId) ?? null;
  const correct = chosen?.is_correct === true;

  const specific = (chosen?.feedback ?? '').trim();
  if (specific !== '') {
    return { correct, message: specific };
  }

  const general = ((correct ? question.feedback_correct : question.feedback_incorrect) ?? '').trim();

  return { correct, message: general };
}

/**
 * The end-of-attempt message for a percentage, from the authored bands.
 *
 * Bands are inclusive at both ends and are allowed to overlap, because an
 * author editing them will overlap them. The LAST matching band wins, which
 * makes the list read top to bottom as "unless" rules — the same rule every
 * other scorer in `lib/h5p` follows and the same one the band editor
 * documents.
 */
export function singleChoiceFeedback(
  percentage: number,
  bands: Array<{ from: number; to: number; feedback?: string }> | null | undefined
): string {
  let message = '';
  for (const band of bands ?? []) {
    if (percentage >= band.from && percentage <= band.to && band.feedback) {
      message = band.feedback;
    }
  }
  return message;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Score an attempt.
 *
 * MAX SCORE IS THE WHOLE PAPER, not the part that was answered. A learner who
 * stopped after three of eight has scored 3/8, not 3/3 — the questions they
 * did not reach are questions they did not get right, and the alternative
 * would report an abandoned attempt as full marks.
 *
 * `answers` is indexed by the PAPER position, not by question id, because that
 * is the order the learner met them in and the order the results screen walks.
 * A missing or null entry is unanswered, which differs from a wrong answer
 * only in `answeredCount` — and that distinction is what lets a report tell
 * "did not finish" from "found it hard".
 */
export function scoreSingleChoiceAttempt(
  paper: PreparedQuestion[],
  answers: Array<SingleChoiceAnswer | undefined>,
  rules: SingleChoiceScoringRules
): SingleChoiceAttemptResult {
  const pointsPerQuestion = Math.max(1, Math.floor(Number(rules.points_per_question) || 1));

  let correctCount = 0;
  let answeredCount = 0;

  for (const entry of paper) {
    const given = answers[entry.index];
    if (given === null || given === undefined) continue;

    answeredCount++;
    if (isCorrectChoice(entry.question, given)) correctCount++;
  }

  const score = correctCount * pointsPerQuestion;
  const maxScore = paper.length * pointsPerQuestion;
  // 0/0 is 0%, not NaN. A set with no questions cannot be passed, and NaN
  // would propagate into the xAPI statement and the report.
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return {
    correctCount,
    answeredCount,
    questionCount: paper.length,
    score,
    maxScore,
    percentage,
    passed: percentage >= Math.max(0, Math.min(100, Number(rules.pass_percentage) || 0)),
  };
}

/**
 * Strip HTML to plain text.
 *
 * Question and option text are stored as HTML because H5P stores them that
 * way. The player renders that HTML; this is for the places that cannot — an
 * `aria-label`, an xAPI `response` string, a list column. Written as a regex
 * rather than through the DOM so the module stays testable outside a browser
 * and usable during server rendering.
 */
export function plainText(html: string | null | undefined): string {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
