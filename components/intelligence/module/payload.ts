/**
 * The canonical payload every module's Intelligence endpoint speaks.
 *
 * WHY THIS EXISTS. Fees Intelligence proved the shape of a useful intelligence
 * screen, but it proved it in fee-specific types — `demandAmount`,
 * `collectionRate`, `cycles`, `heads`. Reproducing that per module would give
 * forty payloads, forty screens and forty places for the same bug. This file is
 * the same eight ideas with the fee nouns removed, so one renderer can serve
 * every module.
 *
 * ── The split between this file and contract.ts ──────────────────────────────
 *
 * THE PAYLOAD CARRIES FACTS AND THEIR UNITS. Whether a column is money or a
 * head-count is a property of the data, not a design choice, so the backend
 * says it here and no screen can render marks with a rupee sign.
 *
 * THE CONTRACT CARRIES PRESENTATION — which sections appear, in what order,
 * with what wording. That is a product decision and lives in the frontend.
 *
 * ── The honesty rules this shape enforces ────────────────────────────────────
 *
 *  1. `available` + `reason` on every block. A block with nothing to show says
 *     WHY in the backend's own words. "No students are enrolled this year" and
 *     "marks have not been entered" are different problems with different
 *     answers, and a generic "No data" erases that difference.
 *
 *  2. NULL IS NOT ZERO, everywhere. A pass rate over no candidates is
 *     undefined, not 0%. Every numeric field is nullable for exactly this
 *     reason, and the formatter renders null as an em dash.
 *
 *  3. Nothing reaches `findings` without `evidence`. That is the line between
 *     intelligence and a chart caption.
 */

/* --------------------------------------------------------------- vocabulary */

/**
 * Presentation tone. Colour is never the only carrier — every tone is rendered
 * beside a word at the call site, and red is reserved for genuine risk.
 */
export type Tone =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'positive'
  | 'neutral'
  | 'info'
  | 'warning'
  | 'attention'
  | 'good';

/**
 * How a number should be read. Set by the backend, because it is a fact about
 * the column rather than a styling preference.
 */
export type ValueFormat =
  | 'currency'
  | 'currencyExact'
  | 'count'
  | 'percent'
  | 'decimal'
  | 'duration'
  | 'text';

/** Confidence always travels with its word — "High", never a bare 0.85. */
export interface Confidence {
  band: string;
  value: number;
}

/** One figure a finding rests on. */
export interface EvidencePoint {
  label: string;
  value: string;
  note?: string | null;
}

/**
 * An impact figure, pre-formatted by the backend.
 *
 * Generic on purpose: Fees measures impact in rupees, Result in students,
 * Attendance in sessions. The screen only needs the string and its noun.
 */
export interface Impact {
  value: number | null;
  display: string;
  /** "in play", "students affected", "sessions missed". */
  label: string;
}

/* ------------------------------------------------------------- L0: coverage */

/**
 * What this institute-year actually holds. READ THIS BEFORE ANY FIGURE.
 *
 * Every empty state on the screen keys off `sources`, so a module can say
 * "co-scholastic marks were never entered" rather than drawing a flat line
 * through nothing.
 */
export interface Coverage {
  available: boolean;
  reason: string | null;
  syear: string | null;
  /** Source key → does this institute-year genuinely have those rows. */
  sources: Record<string, boolean>;
  /** Source key → row count, for copy that cites a number. */
  counts: Record<string, number>;
}

/* ------------------------------------------------------------- L1: position */

export interface Metric {
  key: string;
  label: string;
  /** Null means unknown, and renders as an em dash. Never coerce it to 0. */
  value: number | null;
  format: ValueFormat;
  /** Backend-rendered string, used verbatim when present. */
  display?: string | null;
  hint?: string | null;
  tone?: Tone;
  currency?: string | null;
}

export interface MetricGroup {
  available: boolean;
  reason: string | null;
  metrics: Metric[];
}

/* --------------------------------------------------------- L2: distribution */

export interface BreakdownColumn {
  key: string;
  label: string;
  format: ValueFormat;
  currency?: string | null;
}

export interface BreakdownRow {
  key: string;
  label: string;
  /** Keyed by column key. A missing key renders as an em dash, not a zero. */
  values: Record<string, number | null>;
  tone?: Tone;
  note?: string | null;
}

/**
 * One way of slicing the module — by class, by subject, by cycle, by head.
 *
 * `primaryColumn` is what a bar would plot and what the table sorts by; the
 * rest are context. A breakdown with no `primaryColumn` renders as a plain
 * table, which is the right answer for a mix with no natural magnitude.
 */
export interface Breakdown {
  key: string;
  label: string;
  description?: string | null;
  available: boolean;
  reason: string | null;
  columns: BreakdownColumn[];
  primaryColumn?: string | null;
  rows: BreakdownRow[];
}

/* -------------------------------------------------------------- L3: signals */

export interface Finding {
  id: string;
  severity: string;
  severityLabel: string;
  title: string;
  whatHappened: string;
  whyItMatters: string | null;
  /** Never empty for a raised finding. An assertion without figures is a caption. */
  evidence: EvidencePoint[];
  likelyCause: string | null;
  causeConfirmed: boolean;
  recommendation: string | null;
  owner: string;
  priority: string;
  confidence: Confidence;
  affected: { count: number | null; total: number | null; unit: string | null };
  raisedAt: string;
  impact: Impact | null;
  syear: number | string | null;
  status: string;
}

/** The subset of findings a person should look at first. */
export interface Priority {
  id: string;
  severity: string;
  severityLabel: string;
  title: string;
  whatHappened: string;
  whyItMatters: string | null;
  evidence: EvidencePoint[];
  impact: Impact | null;
  nextStep: string | null;
  owner: string;
  confidence: Confidence;
}

/**
 * Which checks ran, and which fired.
 *
 * MAKES SILENCE READABLE. Without it, "two findings" looks identical whether
 * the other twenty-four checks passed or never ran at all.
 */
export interface RuleStatus {
  key: string;
  label: string;
  checked: boolean;
  raised: boolean;
}

/* ------------------------------------------------------- L5: the action loop */

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  urgency: string;
  confidence: Confidence;
  status: string;
  syear: number | string | null;
  expectedImpact: { display: string; basis: string; wording: string } | null;
  finding: { signalId: string; title: string; severity: string };
  why: string | null;
  /** False ⇒ nothing executable is attached, so the card is review-only. */
  actionable: boolean;
  decision: {
    id: string;
    status: string;
    rationale: string;
    decidedBy: string;
    decidedAt: string;
  } | null;
}

export type OutcomeState =
  | 'resolved'
  | 'partially_resolved'
  | 'not_reached'
  | 'undetermined'
  | 'awaiting_outcome'
  | 'no_action_queued';

/** Recorded by the person reporting back; absent when nobody measured it. */
export interface MeasuredOutcome {
  before: number;
  after: number;
  change: number;
  unitsAffected: number | null;
  basis: string;
}

export interface DecisionTrailEntry {
  decisionId: string;
  status: string;
  rationale: string;
  decidedBy: string;
  decidedAt: string;
  syear: number | string | null;
  recommendation: { id: string; title: string; category: string };
  finding: string;
  expectedImpact: Impact | null;
  execution: {
    id: string;
    status: string;
    /** The procedure a person is carrying out — never an internal id. */
    action: string;
    owner: string;
    executorType: string;
    queuedAt: string;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
  outcome: {
    id: string;
    result: string;
    feedback: string;
    recordedAt: string;
    measured: MeasuredOutcome | null;
  } | null;
  outcomeState: OutcomeState;
}

export interface Learning {
  available: boolean;
  reason: string | null;
  entries: Array<{
    finding: string;
    action: string;
    rationale: string;
    result: string;
    feedback: string;
    syear: number | string | null;
    recordedAt: string;
    measured: MeasuredOutcome | null;
    appliesToThisYear: boolean;
  }>;
}

/* --------------------------------------------------------- L0 again: ledger */

export interface DataQualityCheck {
  key: string;
  label: string;
  value: number | null;
  format: ValueFormat;
  secondary?: { value: number | null; format: ValueFormat; currency?: string | null } | null;
  sharePercent: number | null;
  shareLabel?: string | null;
  state: 'ok' | 'attention';
  note: string;
}

export interface DataQuality {
  available: boolean;
  reason: string | null;
  checks: DataQualityCheck[];
}

/* ------------------------------------------------------------- the envelope */

/**
 * "What is happening", composed server-side from the same figures the cards
 * below show. DETERMINISTIC, NEVER MODEL OUTPUT — styling it like an assistant
 * would imply a model wrote it and invite the reader to discount it.
 */
export interface SummaryBlock {
  available: boolean;
  reason: string | null;
  headline: string | null;
  sentences: string[];
}

export interface ModuleIntelligencePayload {
  tenantId: string;
  organization: string;
  source: string;
  academicYear: { syear: string | null };
  coverage: Coverage;
  freshness: {
    positionLabel: string;
    findingsRefreshedAt: string | null;
    findingsLabel: string;
  };
  execution: { automated: boolean; note: string };
  summary: SummaryBlock;
  position: MetricGroup | null;
  breakdowns: Breakdown[];
  findings: Finding[];
  priorities: Priority[];
  recommendations: Recommendation[];
  decisionTrail: DecisionTrailEntry[];
  learning: Learning;
  dataQuality: DataQuality;
  ruleStatus: RuleStatus[];
  /**
   * The escape hatch, and it is deliberately narrow.
   *
   * A module may attach data for its own bespoke cards here — Fees' gateway
   * reconciliation and NACH mandates are the motivating case. The contract caps
   * this at three cards (see contract.ts): without a cap, "escape hatch"
   * quietly becomes "bespoke screen" again and the shared renderer stops being
   * shared.
   */
  extras?: Record<string, unknown>;
}
