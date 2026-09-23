import type {
  ConceptDiagnosticResult,
  ConceptMasteryRow,
  MasteryLadderState,
} from '@/app/pal/data/pal-diagnostic';
import type { ChapterSection } from '@/app/pal/data/pal-eso';

/**
 * When a concept - and then a chapter - counts as COMPLETED.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS ONE MODULE AND NOT A CHECK PER SCREEN
 * ---------------------------------------------------------------------------
 * "Completed" turns a concept read-only: the practice set, the lesson, the
 * chapter diagnostic and every action button disappear behind mastery
 * information. Eight screens make that decision, and if any one of them
 * computed it differently a learner would find a concept locked on one screen
 * and still practisable on the next.
 *
 * So the rule lives here once, is pure, and takes only what the server already
 * sends. Nothing below fetches, and nothing below invents a verdict the
 * backend has not reached.
 *
 * ---------------------------------------------------------------------------
 * THE RULE, AND WHY IT READS MORE THAN ONE STORE
 * ---------------------------------------------------------------------------
 * The product rule is: the concept has been taken to the TOP of what it can be
 * tested on, and mastery has been ATTESTED. Three separate stores answer that,
 * and they express "the top" in their own terms:
 *
 *   - MasteryLadder counts difficulty rungs, so its top is a cleared `hard`.
 *   - Adaptive practice tracks the band being served, so its top is having
 *     actually answered hard questions.
 *   - The Adaptive Learning Engine has no difficulty bands at all; it judges
 *     Knowledge and Application separately against an evidence floor, so its
 *     top IS its `mastered` verdict - there is no higher rung to reach.
 *
 * An earlier version of this file required a cleared `hard` rung on the ladder
 * AND `ladder.mastered`, and nothing else counted. On this estate that pair is
 * almost never both true - the chapter mastery screen documents a concept
 * sitting at p_mastery 0.99 with no band cleared and the engine still holding
 * it in `learning` - so completion never fired and every screen kept offering
 * Learn, Practise and the diagnostic on concepts the learner had plainly
 * finished. Requiring one store to agree with itself in a shape it does not
 * produce is not strictness, it is a rule that never runs.
 *
 * So: the engine's own sign-off is sufficient on its own, and every other
 * attestation is paired with evidence that the hard rung was actually reached.
 * A high BKT estimate alone is deliberately NOT enough - the mastery screen
 * warns about exactly that case, where the estimate is above the line but the
 * check has not been passed.
 */

/** The rung a concept has to reach before a banded store can call it done. */
export const COMPLETION_BAND = 'hard';

/** Verdicts that mean "this is finished", wherever they are reported from. */
const SIGNED_OFF = ['mastered', 'retained'];

function lower(value: string | null | undefined): string {
  return (value ?? '').toLowerCase();
}

function bands(list: string[] | null | undefined): string[] {
  return (list ?? []).map((band) => band.toLowerCase());
}

/**
 * Everything any PAL surface can tell us about one concept. Every field is
 * optional: a screen passes whatever its own payload carries, and the rule
 * below decides on what it actually got.
 */
export interface ConceptCompletionSignals {
  /** MasteryLadder, as sent on the concept result, the plan and the overview. */
  ladder?: MasteryLadderState | null;
  /** The difficulty band currently being served for this concept. */
  currentBand?: string | null;
  /** Hard questions actually answered. Zero means the rung was never reached. */
  hardAnswered?: number;
  /** BKT estimate has passed its gate. Attests mastery, never the rung. */
  bktMastered?: boolean;
  /** MasteryOverviewService's reconciled stage. */
  stage?: string | null;
  /** The Adaptive Learning Engine's own verdict for this concept. */
  engineStatus?: string | null;
  /** The concept result's plain-language verdict. */
  understanding?: string | null;
}

/**
 * Has the concept been taken as far as it can be tested?
 *
 * A concept with no hard questions written reports `hard` in the ladder's
 * `bandsUnavailable`; demanding the rung there would leave it permanently
 * incomplete through no fault of the learner, so the rung counts as reached.
 */
function reachedTop(signals: ConceptCompletionSignals): boolean {
  const cleared = bands(signals.ladder?.bandsCleared);
  const unavailable = bands(signals.ladder?.bandsUnavailable);

  return (
    cleared.includes(COMPLETION_BAND) ||
    unavailable.includes(COMPLETION_BAND) ||
    lower(signals.currentBand) === COMPLETION_BAND ||
    (signals.hardAnswered ?? 0) > 0
  );
}

/** Does any store attest mastery, short of the engine's own sign-off? */
function attestsMastery(signals: ConceptCompletionSignals): boolean {
  return (
    signals.ladder?.mastered === true ||
    signals.bktMastered === true ||
    lower(signals.understanding) === 'mastered'
  );
}

/**
 * The engine, or the overview reconciling it, has signed this concept off.
 *
 * Sufficient on its own: both are two-axis verdicts with an evidence floor
 * behind them, so there is no further rung for them to be paired with.
 *
 * `recall_due` is deliberately NOT here. It means a concept that WAS mastered
 * has come up for its spaced review, and treating it as completed would make
 * the review unreachable - the one thing that stage exists to ask for.
 */
function signedOff(signals: ConceptCompletionSignals): boolean {
  return SIGNED_OFF.includes(lower(signals.stage)) || SIGNED_OFF.includes(lower(signals.engineStatus));
}

/** Has this concept been completed? */
export function isConceptCompleted(signals: ConceptCompletionSignals | null | undefined): boolean {
  if (!signals) return false;

  return signedOff(signals) || (reachedTop(signals) && attestsMastery(signals));
}

// --- adapters --------------------------------------------------------------
//
// One per payload shape, so no screen has to remember which of its own fields
// map onto which signal - and so two screens reading different endpoints
// cannot disagree about the same concept.

/** `fetchChapterMastery` -> one row of the mastery overview. */
export function signalsFromMasteryRow(row: ConceptMasteryRow): ConceptCompletionSignals {
  return {
    ladder: row.ladder,
    currentBand: row.band,
    bktMastered: row.bktMastered,
    stage: typeof row.stage === 'string' ? row.stage : null,
    engineStatus: row.engineStatus,
  };
}

/** `fetchConceptResult` -> the concept's own practice record. */
export function signalsFromConceptResult(
  result: ConceptDiagnosticResult | null | undefined
): ConceptCompletionSignals | null {
  if (!result) return null;

  return {
    ladder: result.ladder,
    currentBand: result.currentDifficulty,
    hardAnswered: result.byDifficulty[COMPLETION_BAND]?.attempted ?? 0,
    understanding: result.understanding,
  };
}

/**
 * `fetchChapterDashboard` -> one section of the engine's chapter view.
 *
 * The engine reports no bands, so its `mastered` status is both the rung and
 * the attestation. See the note on signedOff().
 */
export function signalsFromChapterSection(section: ChapterSection): ConceptCompletionSignals {
  return { engineStatus: section.status };
}

// --- chapters --------------------------------------------------------------

/**
 * Can this concept be measured at all?
 *
 * A concept with no questions in the bank can never clear a band, so it can
 * never complete. Counting it against the chapter would mean a chapter with
 * one unauthored concept could never be completed either, however well the
 * learner did on the rest - a content gap presented as a personal failure.
 */
export function isConceptMeasurable(row: ConceptMasteryRow): boolean {
  return row.stage !== 'no_questions';
}

export interface ChapterCompletion {
  /** Concepts that have questions, so could in principle be completed. */
  measurable: number;
  /** Of those, how many are completed. */
  completed: number;
  /** Concepts with no questions at all, reported rather than hidden. */
  unmeasurable: number;
  /** Every measurable concept is completed, and there is at least one. */
  isComplete: boolean;
}

export const NO_COMPLETION: ChapterCompletion = {
  measurable: 0,
  completed: 0,
  unmeasurable: 0,
  isComplete: false,
};

function tally(measurable: number, completed: number, unmeasurable: number): ChapterCompletion {
  return {
    measurable,
    completed,
    unmeasurable,
    // `measurable > 0` is load-bearing: a chapter whose concepts are all
    // unauthored would otherwise satisfy "all of them are completed"
    // vacuously and present itself as finished without a single answer.
    isComplete: measurable > 0 && completed === measurable,
  };
}

/** Chapter completion from the mastery overview (`fetchChapterMastery`). */
export function chapterCompletionFromRows(rows: ConceptMasteryRow[]): ChapterCompletion {
  const measurable = rows.filter(isConceptMeasurable);

  return tally(
    measurable.length,
    measurable.filter((row) => isConceptCompleted(signalsFromMasteryRow(row))).length,
    rows.length - measurable.length
  );
}

/**
 * Chapter completion from the engine's chapter dashboard.
 *
 * `locked` sections are excluded from the denominator for the same reason an
 * unauthored concept is: the learner cannot act on them, so they must not be
 * able to hold a chapter open on their own. A chapter with nothing BUT locked
 * sections therefore reports zero measurable and stays incomplete.
 */
export function chapterCompletionFromSections(sections: ChapterSection[]): ChapterCompletion {
  const measurable = sections.filter((section) => section.status !== 'locked');

  return tally(
    measurable.length,
    measurable.filter((section) => isConceptCompleted(signalsFromChapterSection(section))).length,
    sections.length - measurable.length
  );
}
