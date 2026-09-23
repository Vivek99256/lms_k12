/**
 * Question generation and scoring for H5P Arithmetic Quiz (H5P.ArithmeticQuiz).
 *
 * Lives in `lib/` rather than beside the player so it can be tested without a
 * browser, a fetch stub or a React tree. It has no imports for the same reason:
 * the inputs are structural, so `app/h5p/data/h5p.ts` can satisfy them with its
 * own richer row types without either side depending on the other.
 *
 * WHY THE QUESTIONS ARE GENERATED HERE AND NOT ON THE SERVER
 *
 * A fluency drill is measured in seconds per question. A round trip per
 * question would put the network between a learner and the thing being
 * measured, and would make the quiz unusable on the intermittent connections
 * a lot of these classrooms have. So the paper is drawn in the browser.
 *
 * The consequence is that the answers are in the client. That is the correct
 * trade for THIS type and not for others: the answer to 7 × 8 is not a secret,
 * and what is being measured is recall speed. A summative assessment would not
 * be built this way.
 *
 * GENERATION IS SEEDED AND DETERMINISTIC. The same seed always produces the
 * same paper, which gives three things worth having: these tests can assert on
 * real papers rather than on statistics; a learner who reloads mid-attempt gets
 * the paper back rather than a new one; and a teacher looking at a result can
 * regenerate exactly what the learner saw.
 */

export type ArithmeticOperation = 'addition' | 'subtraction' | 'multiplication' | 'division';

export const ARITHMETIC_OPERATIONS: ArithmeticOperation[] = [
  'addition',
  'subtraction',
  'multiplication',
  'division',
];

/** The symbol shown to a learner. Not `*` and not `/` — those are code. */
export const OPERATION_SYMBOL: Record<ArithmeticOperation, string> = {
  addition: '+',
  subtraction: '−',
  multiplication: '×',
  division: '÷',
};

export const OPERATION_LABEL: Record<ArithmeticOperation, string> = {
  addition: 'Addition',
  subtraction: 'Subtraction',
  multiplication: 'Multiplication',
  division: 'Division',
};

/**
 * Operand ranges per difficulty level.
 *
 * Mirrors `H5pArithmeticQuiz::DIFFICULTY_RANGES` on the server, which is what
 * an exported package declares. The two are asserted equal by
 * H5PArithmeticQuizBuilderTest, so a change made to one and not the other
 * fails a test rather than shipping two different quizzes.
 */
export const DIFFICULTY_RANGES: Record<number, { min: number; max: number; label: string }> = {
  1: { min: 1, max: 10, label: 'Easy' },
  2: { min: 2, max: 25, label: 'Medium' },
  3: { min: 5, max: 100, label: 'Hard' },
};

export interface ArithmeticQuizRules {
  operations: ArithmeticOperation[];
  /** 1 easy, 2 medium, 3 hard. Anything else falls back to 1. */
  difficulty_level: number;
  max_questions: number;
}

export interface ArithmeticQuestion {
  /** Position in the paper, 0-based. */
  index: number;
  operation: ArithmeticOperation;
  left: number;
  right: number;
  /** The answer. Always a whole number — see `division` in `draw()`. */
  answer: number;
  /** "7 × 8", ready to render. */
  prompt: string;
}

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

/**
 * mulberry32 — a small, fast, well-distributed 32-bit PRNG.
 *
 * `Math.random()` cannot be used here because generation has to be
 * reproducible from a seed; and a hand-rolled LCG would correlate consecutive
 * draws, which on a two-operand draw shows up as a paper full of
 * near-identical questions.
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
export function newQuizSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function rangeFor(level: number): { min: number; max: number } {
  return DIFFICULTY_RANGES[level] ?? DIFFICULTY_RANGES[1];
}

function cleanOperations(operations: ArithmeticOperation[] | undefined | null): ArithmeticOperation[] {
  const seen = new Set<ArithmeticOperation>();
  for (const operation of operations ?? []) {
    if (ARITHMETIC_OPERATIONS.includes(operation)) seen.add(operation);
  }
  // A quiz that draws from nothing would generate nothing and score 0 out of 0.
  // Addition is the floor rather than an error: this is a render path, and a
  // row that old is a row someone still has to open.
  return seen.size > 0 ? [...seen] : ['addition'];
}

/** An integer in [min, max]. */
function between(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/**
 * One question.
 *
 * Two rules that are not arbitrary:
 *
 *  - SUBTRACTION NEVER GOES NEGATIVE. The operands are ordered so the larger
 *    comes first. A drill for a class that has not met negative numbers must
 *    not produce "3 − 8", and reordering is what H5P.ArithmeticQuiz does too.
 *
 *  - DIVISION IS BUILT BACKWARDS. The divisor and the quotient are drawn, and
 *    the dividend is their product. Drawing a dividend and a divisor directly
 *    would produce a remainder most of the time, and a drill that asks
 *    "17 ÷ 5" of a primary class is asking the wrong question.
 */
function draw(random: () => number, operation: ArithmeticOperation, min: number, max: number): Omit<ArithmeticQuestion, 'index'> {
  let left = between(random, min, max);
  let right = between(random, min, max);
  let answer: number;

  switch (operation) {
    case 'addition':
      answer = left + right;
      break;

    case 'subtraction':
      if (right > left) [left, right] = [right, left];
      answer = left - right;
      break;

    case 'multiplication':
      answer = left * right;
      break;

    case 'division': {
      // `right` is the divisor and must never be zero, whatever the range.
      const divisor = Math.max(1, right);
      const quotient = Math.max(1, left);
      left = divisor * quotient;
      right = divisor;
      answer = quotient;
      break;
    }
  }

  return {
    operation,
    left,
    right,
    answer,
    prompt: `${left} ${OPERATION_SYMBOL[operation]} ${right}`,
  };
}

/**
 * Draw a paper.
 *
 * DUPLICATES ARE AVOIDED, NOT FORBIDDEN. Asking "6 × 7" three times in twenty
 * questions makes a drill feel broken, so a repeat is redrawn. But the easy
 * level's range genuinely cannot produce 100 distinct addition questions, so
 * the attempt is bounded and the paper falls back to allowing repeats rather
 * than looping forever or returning fewer questions than the author asked for.
 */
export function generateArithmeticPaper(rules: ArithmeticQuizRules, seed: number): ArithmeticQuestion[] {
  const random = mulberry32(seed);
  const operations = cleanOperations(rules.operations);
  const { min, max } = rangeFor(Number(rules.difficulty_level));
  const count = Math.max(1, Math.floor(Number(rules.max_questions) || 1));

  const questions: ArithmeticQuestion[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < count; index++) {
    let candidate: Omit<ArithmeticQuestion, 'index'> | null = null;

    // Eight tries is enough to clear a collision in any range that has room,
    // and short enough that an exhausted range costs nothing noticeable.
    for (let attempt = 0; attempt < 8; attempt++) {
      const operation = operations[Math.floor(random() * operations.length)];
      const drawn = draw(random, operation, min, max);
      const key = `${drawn.operation}:${drawn.left}:${drawn.right}`;

      if (!seen.has(key)) {
        seen.add(key);
        candidate = drawn;
        break;
      }
      candidate = drawn;
    }

    questions.push({ index, ...(candidate as Omit<ArithmeticQuestion, 'index'>) });
  }

  return questions;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface ArithmeticScoringRules {
  points_per_question: number;
  pass_percentage: number;
}

export interface ArithmeticAttemptResult {
  correctCount: number;
  answeredCount: number;
  questionCount: number;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
}

/**
 * Score an attempt.
 *
 * MAX SCORE IS THE WHOLE PAPER, not the part that was answered. A learner who
 * runs out of time having answered eight of twenty has scored 8/20, not 8/8 —
 * the questions they did not reach are questions they did not get right, and
 * the alternative would report a timed-out attempt as full marks.
 *
 * `answers` is indexed by question index; a missing or null entry is
 * unanswered, which is distinct from a wrong answer only in `answeredCount`.
 */
export function scoreArithmeticAttempt(
  questions: ArithmeticQuestion[],
  answers: Array<number | null | undefined>,
  rules: ArithmeticScoringRules
): ArithmeticAttemptResult {
  const pointsPerQuestion = Math.max(1, Math.floor(Number(rules.points_per_question) || 1));

  let correctCount = 0;
  let answeredCount = 0;

  for (const question of questions) {
    const given = answers[question.index];
    if (given === null || given === undefined || Number.isNaN(given)) continue;

    answeredCount++;
    if (given === question.answer) correctCount++;
  }

  const score = correctCount * pointsPerQuestion;
  const maxScore = questions.length * pointsPerQuestion;
  // 0/0 is 0%, not NaN. A quiz with no questions cannot be passed, and NaN
  // would propagate into the xAPI statement and the report.
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return {
    correctCount,
    answeredCount,
    questionCount: questions.length,
    score,
    maxScore,
    percentage,
    passed: percentage >= Math.max(0, Math.min(100, Number(rules.pass_percentage) || 0)),
  };
}

/**
 * The feedback message for a percentage, from the authored bands.
 *
 * Bands are inclusive at both ends and are allowed to overlap, because an
 * author editing them will overlap them. The LAST matching band wins, which
 * makes the list read top to bottom as "unless" rules.
 */
export function arithmeticFeedback(
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
