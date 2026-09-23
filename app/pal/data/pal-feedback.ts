import {
  BAND_ORDER,
  type ConceptDiagnosticResult,
  type DetectedMisconception,
  type PracticeNext,
} from '@/app/pal/data/pal-diagnostic';

/**
 * What the practice set just told this learner, assembled into one object.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A MODULE AND NOT A SCREEN
 * ---------------------------------------------------------------------------
 * The same synthesis is needed in three places - the standalone Feedback page,
 * the in-flow feedback step on app/pal/eso, and the concept result card - and
 * if any one of them read `understanding` differently from
 * `readyForProgression`, a learner would be told they were ready on one screen
 * and not on the next. So the reading lives here once, exactly as the
 * completion rule lives once in pal-completion.ts.
 *
 * ---------------------------------------------------------------------------
 * NOTHING HERE FETCHES, AND NOTHING HERE IS INVENTED
 * ---------------------------------------------------------------------------
 * There is no new endpoint. The whole screen is derived from one
 * ConceptDiagnosticResult that PracticeOutcomeService already returns from
 * GET /lms/pal/adaptive/concept-result/{id}. Every claim below carries the
 * payload field that produced it, and a claim whose source cannot be named is
 * a claim this module is not entitled to make.
 *
 * Where the server has reached no verdict, this reaches none either. The empty
 * case is a real state - "not enough answers yet to say" - and not a gap to be
 * filled with encouragement. A learner who is told they did well when they did
 * not will stop believing the screen, and the screen is the only thing
 * standing between them and a gate.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS SITS BEFORE THE CHECK
 * ---------------------------------------------------------------------------
 * Check is consequential. Feedback after it would be a post-mortem of a
 * decision already taken. Before it, the learner walks in with their errors
 * named, which is the difference between a fair test and a trap.
 */

// --- vocabulary -------------------------------------------------------------

/** The verdicts PracticeOutcomeService reports in `understanding`. */
export type FeedbackVerdict = 'mastered' | 'strong' | 'developing' | 'weak' | 'untested';

export type FeedbackTone = 'positive' | 'neutral' | 'warning';

/**
 * Which field on the payload backs a claim.
 *
 * Deliberately a closed union rather than a free string: it is what makes the
 * "every claim names its source" rule checkable by the compiler instead of by
 * whoever reviews the next change.
 */
export type FeedbackField =
  | 'accuracy'
  | 'byDifficulty'
  | 'currentDifficulty'
  | 'nextDifficulty'
  | 'ruleFired'
  | 'rationale'
  | 'understanding'
  | 'needsRemediation'
  | 'readyForProgression'
  | 'ladder'
  | 'next'
  | 'misconception'
  | 'evidencePublished'
  | 'diagnostic';

export interface FeedbackEvidence {
  /** Plain words, e.g. "Hard: 4 of 5 correct". Never a raw field dump. */
  label: string;
  field: FeedbackField;
}

export interface FeedbackPoint {
  /** One claim, second person, sentence case. */
  claim: string;
  /** Never empty - see the note on FeedbackField. */
  evidence: FeedbackEvidence[];
}

// --- per-band ---------------------------------------------------------------

export type BandStatus = 'cleared' | 'thin' | 'unavailable' | 'attempted' | 'untouched';

export interface FeedbackBand {
  band: string;
  attempted: number;
  correct: number;
  accuracy: number;
  status: BandStatus;
}

// --- the single next step ---------------------------------------------------

/**
 * The engine's decision, carried forward verbatim.
 *
 * This module does NOT choose a destination. The routing table lives with the
 * card that renders it (app/pal/_components/NextStepCard.tsx), so the Feedback
 * page and the practice result can never offer different buttons for the same
 * decision.
 */
export interface FeedbackNextStep {
  action: PracticeNext['action'];
  /** PracticeOutcomeService's own sentence. Never rewritten. */
  reason: string;
  band: string | null;
  /** Whether the Adaptive Learning Engine can take this concept from here. */
  esoReady: boolean;
}

// --- the Check gate ---------------------------------------------------------

export interface CheckReadiness {
  ready: boolean;
  /** One sentence, in the server's words. */
  reason: string;
  /** What is holding the gate shut. Empty when `ready`. */
  blockers: FeedbackPoint[];
}

/**
 * Next-actions that mean the engine considers the Check reachable.
 *
 * Checked as well as `readyForProgression` so this screen cannot tell a
 * learner they are ready while the engine is sending them back to reteach.
 */
export const CHECK_READY_ACTIONS: readonly string[] = [
  'mastery_check',
  'advance_band',
  'mastered',
];

/**
 * BR-04, as numbers: "below 40% = needs practice, 40% to below 70% =
 * developing, 70% and above = mastered" (lib/process/sop-catalog.ts).
 *
 * Used only as a FALLBACK, when the server sent no `understanding`. The
 * institution already fixed these thresholds, so this module names them rather
 * than choosing its own - and it stops at 'strong', never deriving 'mastered'
 * from accuracy alone. pal-completion.ts documents why that line matters: an
 * estimate above the line is not a check that has been passed.
 */
export const DEVELOPING_FLOOR_PCT = 40;
export const STRONG_FLOOR_PCT = 70;

// --- the whole screen -------------------------------------------------------

export interface ConceptFeedback {
  conceptId: string;
  conceptName: string;
  chapterId: string;

  /** No answers in this set. Everything below is empty; say so, don't pad. */
  isEmpty: boolean;

  verdict: FeedbackVerdict;
  tone: FeedbackTone;
  /** One line, built only from counts and the verdict. */
  headline: string;

  attempted: number;
  correct: number;
  accuracy: number;
  bands: FeedbackBand[];

  /** Where the engine had them, and where it is taking them next. */
  movingFrom: string | null;
  movingTo: string | null;

  wentWell: FeedbackPoint[];
  toFix: FeedbackPoint[];

  /** The one thing to do next, or null when the server decided nothing. */
  next: FeedbackNextStep | null;
  misconception: DetectedMisconception | null;

  checkReadiness: CheckReadiness;

  ladder: {
    progressPct: number;
    reason: string;
    nextBand: string | null;
    cleared: string[];
    required: string[];
    thin: string[];
    unavailable: string[];
    mastered: boolean;
  };

  /** Where the chapter diagnostic had put this concept, for contrast. */
  priorDiagnostic: { level: string; conceptPct: number } | null;

  /**
   * The engine's own provenance for this set, for a "why did I get these
   * questions" disclosure. Shown on request, never as the headline.
   */
  provenance: { ruleFired: string; rationale: string };

  /**
   * Answers written to the mastery ledger by the call that produced this
   * result.
   *
   * CAUTION: `next`, `misconception` and `evidence_published` sit on the
   * ENVELOPE, not inside `result`, and are the server's post-close decision
   * (see pal-diagnostic.ts). A screen that REFETCHES the result may therefore
   * legitimately get 0 here - nothing new was published by a read. Zero means
   * "not reported on this read", never "nothing was recorded". The Feedback
   * page carries the practice screen's count forward in the URL and prefers
   * the larger of the two.
   */
  evidencePublished: number;
}

// --- helpers ----------------------------------------------------------------

function lower(value: string | null | undefined): string {
  return (value ?? '').toLowerCase();
}

function bands(list: string[] | null | undefined): string[] {
  return (list ?? []).map((band) => band.toLowerCase());
}

/** "Hard", from "hard". The bands are the only labels this module casts. */
function bandLabel(band: string): string {
  return band.charAt(0).toUpperCase() + band.slice(1);
}

function pct(value: number): number {
  return Math.round(value);
}

// --- the parts, exported so each can be tested on its own -------------------

/**
 * The server's verdict wins. It is the only party that has seen the whole
 * ledger; accuracy on one set of five is a much thinner fact.
 */
export function feedbackVerdict(result: ConceptDiagnosticResult): FeedbackVerdict {
  const reported = lower(result.understanding);
  if (reported === 'mastered' || reported === 'strong') return reported;
  if (reported === 'developing' || reported === 'weak') return reported;
  if (reported === 'untested') return 'untested';

  if (result.attempted === 0) return 'untested';
  if (result.accuracy >= STRONG_FLOOR_PCT) return 'strong';
  if (result.accuracy >= DEVELOPING_FLOOR_PCT) return 'developing';
  return 'weak';
}

export function feedbackTone(verdict: FeedbackVerdict): FeedbackTone {
  if (verdict === 'mastered' || verdict === 'strong') return 'positive';
  if (verdict === 'weak') return 'warning';
  return 'neutral';
}

/**
 * One row per difficulty band, in the order they are climbed.
 *
 * A band with no questions written reports `unavailable` and zero attempts,
 * copying the rule CompletedConceptPanel already uses: a gap in the question
 * bank must never be rendered as something the learner failed to do.
 */
export function bandBreakdown(result: ConceptDiagnosticResult): FeedbackBand[] {
  const cleared = bands(result.ladder?.bandsCleared);
  const thin = bands(result.ladder?.bandsThin);
  const unavailable = bands(result.ladder?.bandsUnavailable);

  return BAND_ORDER.map((band) => {
    const stats = result.byDifficulty[band] ?? { attempted: 0, correct: 0, accuracy: 0 };

    let status: BandStatus = 'untouched';
    if (unavailable.includes(band)) status = 'unavailable';
    else if (cleared.includes(band)) status = 'cleared';
    else if (thin.includes(band)) status = 'thin';
    else if (stats.attempted > 0) status = 'attempted';

    return {
      band,
      attempted: status === 'unavailable' ? 0 : stats.attempted,
      correct: status === 'unavailable' ? 0 : stats.correct,
      accuracy: pct(stats.accuracy),
      status,
    };
  });
}

/**
 * What actually went well.
 *
 * Returns an empty array when nothing qualifies, on purpose. A consolation
 * claim here would be the one sentence on the screen with no evidence behind
 * it, and the page says so in plain words instead.
 */
export function whatWentWell(result: ConceptDiagnosticResult): FeedbackPoint[] {
  const points: FeedbackPoint[] = [];
  const cleared = bands(result.ladder?.bandsCleared);

  cleared.forEach((band) => {
    points.push({
      claim: `You cleared ${band}.`,
      evidence: [{ label: `${bandLabel(band)} is signed off on your ladder`, field: 'ladder' }],
    });
  });

  bandBreakdown(result).forEach((band) => {
    if (band.status === 'unavailable' || band.attempted === 0) return;
    if (cleared.includes(band.band)) return;
    if (band.accuracy < STRONG_FLOOR_PCT) return;

    points.push({
      claim: `${bandLabel(band.band)} is holding up.`,
      evidence: [
        {
          label: `${bandLabel(band.band)}: ${band.correct} of ${band.attempted} correct`,
          field: 'byDifficulty',
        },
      ],
    });
  });

  // Compared as positions in the climb, not as strings. An unknown band
  // reports -1 from both sides, so it can never look like a promotion.
  const order: string[] = [...BAND_ORDER];
  const from = lower(result.currentDifficulty);
  const to = lower(result.nextDifficulty);
  if (to && from && order.indexOf(to) > order.indexOf(from)) {
    points.push({
      claim: `You are being moved up to ${to}.`,
      evidence: [{ label: `Next level: ${bandLabel(to)}`, field: 'nextDifficulty' }],
    });
  }

  if (result.evidencePublished > 0) {
    points.push({
      claim: `${result.evidencePublished} of your answers went onto your record.`,
      evidence: [
        { label: `${result.evidencePublished} answers published`, field: 'evidencePublished' },
      ],
    });
  }

  return points;
}

/**
 * What to fix, most important first.
 *
 * A detected misconception leads, because it is the one item here that names a
 * specific wrong idea rather than a weak score - it is the difference between
 * "practise more" and "here is what went wrong".
 */
export function whatToFix(result: ConceptDiagnosticResult): FeedbackPoint[] {
  const points: FeedbackPoint[] = [];

  if (result.misconception) {
    const { description, correctiveAction, tag } = result.misconception;
    const claim = description || correctiveAction;
    if (claim) {
      points.push({
        claim,
        evidence: [
          { label: tag ? `Matched: ${tag}` : 'Matched a known mix-up', field: 'misconception' },
        ],
      });
    }
  }

  bandBreakdown(result).forEach((band) => {
    if (band.status === 'unavailable' || band.attempted === 0) return;
    if (band.accuracy >= DEVELOPING_FLOOR_PCT) return;

    points.push({
      claim: `${bandLabel(band.band)} is where it is coming apart.`,
      evidence: [
        {
          label: `${bandLabel(band.band)}: ${band.correct} of ${band.attempted} correct`,
          field: 'byDifficulty',
        },
      ],
    });
  });

  bands(result.ladder?.bandsThin).forEach((band) => {
    points.push({
      claim: `There are not enough answers at ${band} yet to call it either way.`,
      evidence: [{ label: `${bandLabel(band)} is still thin`, field: 'ladder' }],
    });
  });

  if (result.needsRemediation && result.rationale) {
    points.push({
      claim: result.rationale,
      evidence: [{ label: 'The engine has flagged this for repair', field: 'needsRemediation' }],
    });
  }

  return points;
}

/**
 * Is the Check reachable from here?
 *
 * Three conditions, all from the server: it says they may progress, it has not
 * flagged repair, and - when it has decided a next action at all - that action
 * is one that leads to the gate rather than back into the lesson.
 */
export function readinessForCheck(result: ConceptDiagnosticResult): CheckReadiness {
  const actionAllows = result.next ? CHECK_READY_ACTIONS.includes(result.next.action) : true;
  const ready = result.readyForProgression && !result.needsRemediation && actionAllows;

  const reason =
    result.next?.reason ||
    result.ladder?.reason ||
    (ready
      ? 'You have done enough here to take the check.'
      : 'There is a bit more to do before the check.');

  if (ready) return { ready, reason, blockers: [] };

  const blockers = whatToFix(result).filter((point) =>
    point.evidence.some(
      (item) =>
        item.field === 'needsRemediation' ||
        item.field === 'ladder' ||
        item.field === 'misconception'
    )
  );

  return { ready, reason, blockers };
}

/**
 * One plain sentence a learner reads before anything else.
 *
 * Deliberately carries no number: the count sits next to it on screen, and a
 * sentence that repeats it ("3 of 5. You got 3 of 5...") reads as a machine
 * talking. Short words, second person, no engine vocabulary - a learner should
 * not have to know what a band or a ladder is to understand how they did.
 */
export function headlineFor(
  result: ConceptDiagnosticResult,
  verdict: FeedbackVerdict
): string {
  if (result.attempted === 0) {
    return 'You have not answered anything here yet.';
  }

  switch (verdict) {
    case 'mastered':
      return 'You have finished this one.';
    case 'strong':
      return 'You have got this.';
    case 'developing':
      return 'You have got part of this.';
    case 'weak':
      return 'This one needs another go.';
    default:
      return 'Here is how that went.';
  }
}

// --- the builder ------------------------------------------------------------

export function buildConceptFeedback(
  result: ConceptDiagnosticResult | null | undefined
): ConceptFeedback | null {
  if (!result) return null;

  const verdict = feedbackVerdict(result);
  const ladder = result.ladder;

  return {
    conceptId: result.conceptId,
    conceptName: result.conceptName,
    chapterId: result.chapterId,

    isEmpty: result.attempted === 0,

    verdict,
    tone: feedbackTone(verdict),
    headline: headlineFor(result, verdict),

    attempted: result.attempted,
    correct: result.correct,
    accuracy: pct(result.accuracy),
    bands: bandBreakdown(result),

    movingFrom: result.currentDifficulty,
    movingTo: result.nextDifficulty,

    wentWell: whatWentWell(result),
    toFix: whatToFix(result),

    next: result.next
      ? {
          action: result.next.action,
          reason: result.next.reason,
          band: result.next.band,
          esoReady: result.next.eso,
        }
      : null,
    misconception: result.misconception,

    checkReadiness: readinessForCheck(result),

    ladder: {
      progressPct: pct(ladder?.progressPct ?? 0),
      reason: ladder?.reason ?? '',
      nextBand: ladder?.nextBand ?? null,
      cleared: ladder?.bandsCleared ?? [],
      required: ladder?.bandsRequired ?? [],
      thin: ladder?.bandsThin ?? [],
      unavailable: ladder?.bandsUnavailable ?? [],
      mastered: ladder?.mastered === true,
    },

    priorDiagnostic:
      result.diagnosticLevel && result.diagnosticConceptPct != null
        ? { level: result.diagnosticLevel, conceptPct: pct(result.diagnosticConceptPct) }
        : null,

    provenance: { ruleFired: result.ruleFired, rationale: result.rationale },

    evidencePublished: result.evidencePublished,
  };
}
