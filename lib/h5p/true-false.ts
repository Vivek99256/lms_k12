/**
 * Paper drawing and scoring for H5P True/False (H5P.TrueFalse).
 *
 * Lives in `lib/` rather than beside the player so it can be tested without a
 * browser, a fetch stub or a React tree, and has no imports so the row types
 * in `app/h5p/data/h5p-content-types.ts` can satisfy it structurally.
 *
 * THE DRAW IS THE INTERESTING PART OF THIS TYPE.
 *
 * An item is a POOL of statements, not one question — see the migration in the
 * backend for why. An attempt asks `questions_to_ask` of them, 0 meaning all,
 * and that draw is what makes a pool worth authoring: twenty statements, ten
 * asked, a different ten each time.
 *
 * The draw is a seeded permutation and the seed is recorded with the attempt,
 * which buys the same three things the arithmetic quiz's seeded generator
 * buys: a reload mid-attempt returns the same paper rather than a new one;
 * these tests assert on real papers rather than on statistics; and a teacher
 * looking at a result can reconstruct exactly what the learner was asked.
 * Without that last one, "she got 4/10" is not a fact anyone can act on.
 *
 * DRAW ORDER AND ASK ORDER ARE THE SAME DECISION. A pool that is shuffled and
 * then truncated asks a random subset in random order; one that is truncated
 * and then shuffled asks the first n in random order, which is not a pool at
 * all. `drawTrueFalsePaper` shuffles first, always, and only then takes.
 */

export interface TrueFalseQuestion {
  id: number;
  question_text: string;
  correct_answer: boolean;
  feedback_correct?: string | null;
  feedback_incorrect?: string | null;
  explanation?: string | null;
  media_image?: string | null;
  media_alt?: string | null;
}

export interface TrueFalseDrawRules {
  randomize_questions: boolean;
  /** 0 means the whole pool, in author order. */
  questions_to_ask: number;
}

export interface TrueFalseScoringRules {
  points_per_question: number;
  pass_percentage: number;
}

/** One statement as this attempt asks it. */
export interface DrawnQuestion {
  /** Position in this attempt's paper, 0-based. */
  index: number;
  question: TrueFalseQuestion;
}

/** A learner's answer. `null` is a statement they did not reach. */
export type TrueFalseAnswer = boolean | null;

export interface TrueFalseAttemptResult {
  correctCount: number;
  answeredCount: number;
  questionCount: number;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
}

// ---------------------------------------------------------------------------
// Seeded drawing
// ---------------------------------------------------------------------------

/** mulberry32, as used by every seeded module in `lib/h5p`. */
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

/** Fisher-Yates, on a copy — the caller's array is row data the editor reads. */
function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Draw the paper for one attempt.
 *
 * `questions_to_ask` is CLAMPED to the pool rather than honoured literally: an
 * author who deletes four statements from a pool of twenty has not thereby
 * broken a published activity. The same clamp the server applies on save, so
 * the two cannot disagree about what an attempt is out of.
 *
 * Shuffle first, then take — see the module header for why that order is the
 * whole behaviour.
 */
export function drawTrueFalsePaper(
  pool: TrueFalseQuestion[],
  rules: TrueFalseDrawRules,
  seed: number
): DrawnQuestion[] {
  const random = mulberry32(seed);

  const ordered = rules.randomize_questions ? shuffle(pool, random) : [...pool];

  const asked = Math.max(0, Math.floor(Number(rules.questions_to_ask) || 0));
  const taken = asked > 0 ? ordered.slice(0, Math.min(asked, ordered.length)) : ordered;

  return taken.map((question, index) => ({ index, question }));
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

/** Whether an answer is right. A null answer is unanswered, not wrong. */
export function isCorrectAnswer(question: TrueFalseQuestion, given: TrueFalseAnswer): boolean {
  if (given === null || given === undefined) return false;

  return given === question.correct_answer;
}

/**
 * What to say about one answered statement.
 *
 * The author's own words win; otherwise nothing is invented. A generic "Well
 * done!" bolted on here would read as the system talking over the teacher, and
 * the player already shows right-or-wrong as a mark and a colour — the message
 * is for when there is something to add.
 */
export function statementFeedback(
  question: TrueFalseQuestion,
  given: TrueFalseAnswer
): { correct: boolean; message: string } {
  const correct = isCorrectAnswer(question, given);
  const message = ((correct ? question.feedback_correct : question.feedback_incorrect) ?? '').trim();

  return { correct, message };
}

/**
 * The end-of-attempt message for a percentage, from the authored bands.
 *
 * Bands are inclusive at both ends and may overlap; the LAST matching band
 * wins, so the list reads top to bottom as "unless" rules. The same rule every
 * other scorer in `lib/h5p` follows.
 */
export function trueFalseFeedback(
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
 * MAX SCORE IS THE PAPER THAT WAS DRAWN, not the pool. A learner asked ten of
 * twenty is scored out of ten; scoring against the pool would report every
 * attempt as a half-mark failure and would make the pool feature unusable.
 *
 * Unanswered is not wrong. It counts against the score exactly as a wrong
 * answer does, but it is reported separately, which is what lets a report tell
 * "did not finish" from "found it hard".
 */
export function scoreTrueFalseAttempt(
  paper: DrawnQuestion[],
  answers: Array<TrueFalseAnswer | undefined>,
  rules: TrueFalseScoringRules
): TrueFalseAttemptResult {
  const pointsPerQuestion = Math.max(1, Math.floor(Number(rules.points_per_question) || 1));

  let correctCount = 0;
  let answeredCount = 0;

  for (const entry of paper) {
    const given = answers[entry.index];
    if (given === null || given === undefined) continue;

    answeredCount++;
    if (isCorrectAnswer(entry.question, given)) correctCount++;
  }

  const score = correctCount * pointsPerQuestion;
  const maxScore = paper.length * pointsPerQuestion;
  // 0/0 is 0%, not NaN. NaN would propagate into the xAPI statement and the
  // report, where it is far harder to trace back to an empty pool.
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
 * How lopsided a pool's answers are, as the count of each.
 *
 * The editor shows this, because a pool that is all one answer can be scored
 * full marks by pressing the same button repeatedly — and it is a mistake an
 * author makes by writing statements they know to be true and forgetting to
 * write any they know to be false. The server refuses to publish one; showing
 * the balance while authoring is how it stops being a surprise at the end.
 */
export function answerBalance(pool: TrueFalseQuestion[]): { trueCount: number; falseCount: number; lopsided: boolean } {
  let trueCount = 0;
  for (const question of pool) {
    if (question.correct_answer) trueCount++;
  }

  const falseCount = pool.length - trueCount;

  return {
    trueCount,
    falseCount,
    // A single statement is not lopsided — it is a statement. The warning is
    // about a pool that can be gamed, and one question cannot be.
    lopsided: pool.length > 1 && (trueCount === 0 || falseCount === 0),
  };
}

/**
 * Strip HTML to plain text.
 *
 * Statements are stored as HTML because H5P stores them that way. The player
 * renders that HTML; this is for the places that cannot — an `aria-label`, an
 * xAPI `response` string, a list column. A regex rather than the DOM so the
 * module stays testable outside a browser and usable during server rendering.
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
