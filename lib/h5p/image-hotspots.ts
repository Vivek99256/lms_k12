/**
 * Coverage scoring for H5P Image Hotspots (H5P.ImageHotspots).
 *
 * Lives in `lib/` rather than beside the player so it can be tested without a
 * browser, a fetch stub or a React tree. It has no imports for the same reason:
 * the inputs are structural, so `app/h5p/data/h5p.ts` can satisfy them with its
 * own richer row types without either side depending on the other.
 *
 * WHY THERE IS A SCORE AT ALL.
 *
 * H5P.ImageHotspots is not a scored type. It reports `progressed` and
 * `completed` and has no answer key, because there is no question. But this
 * platform's analytics contract -- attempt count, score, max score, percentage,
 * completion -- applies to every H5P item, and reporting this one as 0/0
 * forever would make it invisible in every report a teacher opens.
 *
 * So an item is scored on COVERAGE: one point per hotspot opened, out of the
 * hotspots there are. That is an honest measurement of whether a learner read
 * the diagram, which is the thing the activity is for. It is stated here, in
 * the migration, and on the player, rather than being inferred anywhere
 * downstream.
 *
 * WHAT IT DELIBERATELY IS NOT. It is not a measure of understanding, and the
 * player says so rather than showing a mark out of ten next to a science
 * diagram as though it were a test.
 */

export interface ScorableHotspot {
  id: number;
  sort_order: number;
}

export interface HotspotScoringRules {
  points_per_hotspot: number;
  pass_percentage: number;
}

export interface HotspotAttemptResult {
  openedCount: number;
  hotspotCount: number;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  completed: boolean;
  /** Hotspots still unopened, in author order, for the "what's left" hint. */
  remaining: ScorableHotspot[];
}

/**
 * Score a visit.
 *
 * `opened` is the set of hotspot ids the learner has opened. A Set rather than
 * a count because the player has to be idempotent: opening the same hotspot
 * three times is one hotspot read, and counting turns would let a learner
 * "complete" a diagram by clicking one marker repeatedly.
 */
export function scoreHotspotVisit(
  hotspots: ScorableHotspot[],
  opened: Set<number> | ReadonlySet<number>,
  rules: HotspotScoringRules
): HotspotAttemptResult {
  const all = hotspots ?? [];
  const pointsPer = Math.max(1, Math.floor(Number(rules.points_per_hotspot) || 1));

  // Only ids that are actually on this item count. An id left in the set by a
  // hotspot the author has since deleted would otherwise push a learner over
  // 100% on a diagram they have not finished.
  const remaining = all.filter((hotspot) => !opened.has(hotspot.id));
  const openedCount = all.length - remaining.length;

  const score = openedCount * pointsPer;
  const maxScore = all.length * pointsPer;
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return {
    openedCount,
    hotspotCount: all.length,
    score,
    maxScore,
    percentage,
    passed: percentage >= Math.max(0, Math.min(100, Number(rules.pass_percentage) || 0)),
    completed: all.length > 0 && remaining.length === 0,
    remaining,
  };
}

/** The feedback message for a percentage. Last matching band wins. */
export function hotspotFeedback(
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
