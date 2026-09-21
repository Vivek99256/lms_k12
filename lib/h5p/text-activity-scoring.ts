/**
 * Scoring for the three H5P text-passage types.
 *
 * Lives in `lib/` for the same reason drag-drop-scoring.ts does: the code that
 * decides a student's mark must be checkable in isolation, without a browser,
 * a fetch stub or a React tree. Inputs are structural, so `app/h5p/data/h5p.ts`
 * can satisfy them with its own richer row types without either side depending
 * on the other.
 *
 * WHAT THE THREE AGREE ON
 *
 * Each awards `points_per_blank` for every slot answered correctly, out of a
 * maximum of that times the number of non-distractor slots. All three round a
 * percentage the same way and compare it to the same `pass_percentage`.
 *
 * WHERE THEY DIFFER, AND WHY IT MATTERS
 *
 *   drag_text / fill_in_the_blanks   Each blank is independent. A wrong answer
 *                                    scores nothing and costs nothing, because
 *                                    the learner had to put something in every
 *                                    blank anyway -- penalising a wrong guess
 *                                    twice is not what the libraries do.
 *
 *   mark_the_words                   A wrong mark SUBTRACTS. This is the one
 *                                    place the arithmetic is not obvious, and
 *                                    it is not a house rule: H5P.MarkTheWords
 *                                    scores `correct - incorrect`, floored at
 *                                    zero. Without it, clicking every word in
 *                                    the passage scores full marks, which is
 *                                    the first thing a class discovers.
 */

/** One answer slot as the server stored it. */
export interface ScorableBlank {
  blank_index: number;
  solution: string | null;
  alternatives: string[] | null;
  is_distractor: boolean;
}

export interface ScorableTextActivity {
  content_type: 'drag_text' | 'fill_in_the_blanks' | 'mark_the_words';
  blanks?: ScorableBlank[];
  points_per_blank: number;
  pass_percentage: number;
  case_sensitive: boolean;
  accept_spelling_errors: boolean;
}

export interface TextAttemptResult {
  /**
   * Whether the activity has any answer defined at all.
   *
   * An author can save a passage that marks nothing. That activity is not
   * "worth zero" -- it is unmarkable, and reporting 0/0 tells the learner they
   * got it wrong when nothing was ever right. The player branches on this
   * instead of showing a score, and publish is refused server-side for the
   * same reason.
   */
  scoreable: boolean;
  /** Slots answered correctly. */
  correct: number;
  /** Slots answered wrongly, or words wrongly marked. */
  incorrect: number;
  /** Correct answers the learner did not give. */
  missed: number;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  /** Slot index -> whether that slot's answer is correct. Drives the ticks. */
  perBlank: Record<number, boolean>;
}

/**
 * Levenshtein distance, capped: we only ever ask "is this within 1 edit?", so
 * the full matrix is never needed and a length difference above the cap is an
 * immediate no.
 */
function withinEditDistance(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  if (a === b) return true;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }

    // Every path through this row already exceeds the cap.
    if (rowMin > max) return false;
    previous = current;
  }

  return previous[b.length] <= max;
}

/**
 * Whether a learner's response satisfies one slot.
 *
 * Exported because the player needs it per keystroke for instant feedback, and
 * because "why was this marked wrong" is the single most common question about
 * a cloze activity -- having one answer to it, in one function, is the point.
 */
export function matchesAnswer(
  response: string,
  blank: ScorableBlank,
  options: { caseSensitive: boolean; acceptSpellingErrors: boolean }
): boolean {
  const given = response.trim();
  if (given === '') return false;

  const accepted = [blank.solution ?? '', ...(blank.alternatives ?? [])]
    .map((answer) => answer.trim())
    .filter((answer) => answer !== '');

  if (accepted.length === 0) return false;

  const normalise = (value: string) => (options.caseSensitive ? value : value.toLowerCase());
  const givenNormalised = normalise(given);

  for (const answer of accepted) {
    const answerNormalised = normalise(answer);
    if (givenNormalised === answerNormalised) return true;

    // H5P.Blanks' `acceptSpellingErrors`: one edit is forgiven, and only on
    // words long enough for one edit not to be a different word. Three letters
    // is the library's own floor -- below it, "cat" would accept "bat".
    if (
      options.acceptSpellingErrors &&
      answerNormalised.length > 3 &&
      withinEditDistance(givenNormalised, answerNormalised, 1)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Score a Drag the Words or Fill in the Blanks attempt.
 *
 * `responses` is keyed by `blank_index`: the typed string for Blanks, the
 * dropped word for Drag the Words. A missing key is an unanswered blank, which
 * counts as missed rather than incorrect -- the distinction matters to the
 * feedback line, which tells a learner who ran out of time something different
 * from one who guessed.
 */
export function scoreBlanks(
  activity: ScorableTextActivity,
  responses: Record<number, string>
): TextAttemptResult {
  const blanks = (activity.blanks ?? []).filter((blank) => !blank.is_distractor);
  const points = Math.max(1, activity.points_per_blank || 1);

  if (blanks.length === 0) {
    return emptyResult();
  }

  const perBlank: Record<number, boolean> = {};
  let correct = 0;
  let incorrect = 0;
  let missed = 0;

  for (const blank of blanks) {
    const response = responses[blank.blank_index] ?? '';

    if (response.trim() === '') {
      missed++;
      perBlank[blank.blank_index] = false;
      continue;
    }

    const ok = matchesAnswer(response, blank, {
      caseSensitive: activity.case_sensitive,
      acceptSpellingErrors: activity.accept_spelling_errors,
    });

    perBlank[blank.blank_index] = ok;
    if (ok) correct++;
    else incorrect++;
  }

  return finalise(activity, { correct, incorrect, missed, perBlank }, blanks.length * points, correct * points);
}

/**
 * Score a Mark the Words attempt.
 *
 * `selected` is the set of token indices the learner clicked, which is why
 * `tokens` has to come from the same `markableTokens()` call the renderer
 * used: a token index means nothing on its own.
 *
 * Wrong marks subtract, floored at zero -- see this file's header for why that
 * is the library's rule and not a choice made here.
 */
export function scoreMarkedWords(
  activity: ScorableTextActivity,
  tokens: Array<{ tokenIndex: number; correct: boolean; blankIndex: number | null }>,
  selected: ReadonlySet<number>
): TextAttemptResult {
  const correctTokens = tokens.filter((token) => token.correct);
  const points = Math.max(1, activity.points_per_blank || 1);

  if (correctTokens.length === 0) {
    return emptyResult();
  }

  const perBlank: Record<number, boolean> = {};
  let correct = 0;
  let incorrect = 0;
  let missed = 0;

  for (const token of tokens) {
    const marked = selected.has(token.tokenIndex);

    if (token.correct) {
      if (token.blankIndex !== null) perBlank[token.blankIndex] = marked;
      if (marked) correct++;
      else missed++;
    } else if (marked) {
      incorrect++;
    }
  }

  const maxScore = correctTokens.length * points;
  const raw = (correct - incorrect) * points;

  return finalise(activity, { correct, incorrect, missed, perBlank }, maxScore, Math.max(0, raw));
}

/** Dispatch on the activity's own type, so a caller does not have to. */
export function scoreAttempt(
  activity: ScorableTextActivity,
  input:
    | { kind: 'blanks'; responses: Record<number, string> }
    | {
        kind: 'marks';
        tokens: Array<{ tokenIndex: number; correct: boolean; blankIndex: number | null }>;
        selected: ReadonlySet<number>;
      }
): TextAttemptResult {
  return input.kind === 'marks'
    ? scoreMarkedWords(activity, input.tokens, input.selected)
    : scoreBlanks(activity, input.responses);
}

function finalise(
  activity: ScorableTextActivity,
  counts: { correct: number; incorrect: number; missed: number; perBlank: Record<number, boolean> },
  maxScore: number,
  score: number
): TextAttemptResult {
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return {
    scoreable: true,
    ...counts,
    score,
    maxScore,
    percentage,
    passed: percentage >= (activity.pass_percentage ?? 100),
  };
}

function emptyResult(): TextAttemptResult {
  return {
    scoreable: false,
    correct: 0,
    incorrect: 0,
    missed: 0,
    score: 0,
    maxScore: 0,
    percentage: 0,
    passed: false,
    perBlank: {},
  };
}

/**
 * The authored feedback message for a percentage, or null.
 *
 * Bands are inclusive at both ends and the first match wins, which is how H5P
 * reads them; a gap in the bands means no message rather than a fallback,
 * because inventing one would put words in the teacher's mouth.
 */
export function feedbackFor(
  bands: Array<{ from: number; to: number; feedback?: string }> | null | undefined,
  percentage: number
): string | null {
  for (const band of bands ?? []) {
    if (percentage >= band.from && percentage <= band.to) {
      const message = (band.feedback ?? '').trim();
      return message === '' ? null : message;
    }
  }

  return null;
}
