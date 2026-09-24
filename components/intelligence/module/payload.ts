import type { MetricFormat } from './format';
import type { Tone } from './primitives';

/**
 * The canonical Intelligence payload — the generalised form of
 * `app/fees/intelligence/_lib/fees-intelligence-api.ts`'s `FeesIntelligencePayload`
 * with the fee nouns removed: money becomes a metric with `format: 'money'`,
 * "trends" becomes `breakdowns` (a labelled table instead of four named
 * arrays), everything else keeps its shape. A module's `load()` (see
 * `./contract.ts`) is responsible for shaping its own endpoint's response into
 * this, once, so every section renderer here can stay ignorant of which module
 * it is drawing.
 *
 * NOTHING HERE INVENTS A NUMBER — every field is either a value the backend
 * sent or a string the backend composed. Absence is always distinguished from
 * zero: a rate over no denominator, an amount nobody measured, and a check
 * that never ran are three different facts, not one blank.
 */

/* ------------------------------------------------------------------ metrics */

export interface MetricValue {
  key: string;
  label: string;
  value: number | string | null;
  format?: MetricFormat;
  currency?: string;
  /** Pre-formatted by the backend; used instead of `formatValue(value, format, currency)` when present. */
  display?: string | null;
  hint?: string | null;
  tone?: Tone;
}

/** A group of metric tiles with one shared availability — a module's Position, or its summary strip. */
export interface MetricGroup {
  available: boolean;
  reason?: string | null;
  metrics: MetricValue[];
}

/* --------------------------------------------------------------- breakdowns */

export interface BreakdownColumn {
  key: string;
  label: string;
  format?: MetricFormat;
  currency?: string;
}

export interface BreakdownRow {
  key: string;
  label: string;
  note?: string | null;
  values: Record<string, number | null>;
}

/** One slice of the module, as a table — Fees' cycles/heads/classes/payment-modes, generalised to one shape. */
export interface Breakdown {
  key: string;
  label: string;
  description?: string | null;
  available: boolean;
  reason?: string | null;
  /** The column whose value sizes each row's inline bar. */
  primaryColumn?: string | null;
  columns: BreakdownColumn[];
  rows: BreakdownRow[];
}

/* ----------------------------------------------------------------- shared bits */

export interface EvidencePoint {
  label: string;
  value: string;
  note?: string | null;
}

export interface Confidence {
  band: string;
  value: number;
}

/** Phrased as exposure, never as a claimed recovery — "₹38.3L in play", not "₹38.3L saved". */
export interface Impact {
  display: string;
  label: string;
}

/* ------------------------------------------------------------------ findings */

export interface Finding {
  id: string;
  severity: string;
  severityLabel?: string | null;
  title: string;
  whatHappened: string;
  whyItMatters?: string | null;
  evidence?: EvidencePoint[];
  /** A cause the engine has not confirmed is labelled as a candidate, never presented as a conclusion. */
  likelyCause?: string | null;
  causeConfirmed?: boolean;
  confidence?: Confidence;
  impact?: Impact | null;
}

export interface RuleStatus {
  key: string;
  label: string;
  checked: boolean;
  raised: boolean;
}

export interface Priority extends Omit<Finding, 'severityLabel'> {
  severityLabel?: string | null;
  owner: string;
  nextStep?: string | null;
}

/* ------------------------------------------------------------ recommendations */

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  priority?: string;
  confidence?: Confidence;
  /** False ⇒ nothing executable is attached, so the card is review-only. */
  actionable: boolean;
  finding: { title: string };
  expectedImpact?: { wording: string; basis: string } | null;
  decision?: {
    status: string;
    decidedBy: string;
    decidedAt: string;
    rationale?: string | null;
  } | null;
}

/* ------------------------------------------------------------------ decisions */

export type OutcomeState =
  | 'resolved'
  | 'partially_resolved'
  | 'not_reached'
  | 'undetermined'
  | 'awaiting_outcome'
  | 'no_action_queued';

export interface MeasuredOutcome {
  basis: string;
  before: number;
  after: number;
  change: number;
  /** Generic count of whatever this module's grain is — accounts, students, rows. */
  accountsAffected?: number | null;
}

export interface DecisionTrailEntry {
  decisionId: string;
  status: string;
  decidedBy: string;
  decidedAt: string;
  outcomeState: OutcomeState;
  recommendation: { title: string };
  /** The finding's title, already resolved to a string by the backend. */
  finding: string;
  rationale?: string | null;
  expectedImpact?: number | null;
  execution?: {
    action: string;
    owner: string;
    status: string;
  } | null;
  outcome?: {
    result: string;
    feedback: string;
    measured?: MeasuredOutcome | null;
  } | null;
}

/* --------------------------------------------------------------- data quality */

export interface DataQualityCheck {
  key: string;
  label: string;
  state: 'ok' | 'attention';
  value: number | string | null;
  format?: MetricFormat;
  secondary?: { value: number | string | null; format?: MetricFormat; currency?: string } | null;
  sharePercent?: number | null;
  shareLabel?: string | null;
  note?: string | null;
}

export interface DataQuality {
  available: boolean;
  reason?: string | null;
  checks: DataQualityCheck[];
}

/* -------------------------------------------------------------------- learning */

export interface LearningEntry {
  recordedAt: string;
  result: string;
  syear?: string | number | null;
  /** False for a lesson carried forward from an earlier year, kept for context rather than for this year's decision. */
  appliesToThisYear?: boolean;
  action: string;
  finding: string;
  feedback?: string | null;
}

export interface Learning {
  available: boolean;
  reason?: string | null;
  entries: LearningEntry[];
}

/** "What is happening", composed server-side from the figures below it — never model output. */
export interface SummaryBlock {
  available: boolean;
  reason?: string | null;
  headline?: string | null;
  sentences: string[];
}

/* -------------------------------------------------------------------- payload */

export interface ModuleIntelligencePayload {
  organization: string;
  /** One row of this module's grain, read out for the footer — "one student's fee account". */
  source: string;
  academicYear: { syear: string | null };
  coverage: { available: boolean; reason?: string | null };
  freshness: {
    /** The position is read live on every request; only the findings are as fresh as the last rule run. */
    positionLabel: string;
    findingsRefreshedAt: string | null;
    findingsLabel?: string;
  };
  execution?: { automated?: boolean; note?: string } | null;
  summary: SummaryBlock;
  position: MetricGroup | null;
  breakdowns: Breakdown[];
  findings: Finding[];
  ruleStatus: RuleStatus[];
  priorities: Priority[];
  recommendations: Recommendation[];
  decisionTrail: DecisionTrailEntry[];
  dataQuality: DataQuality;
  learning: Learning;
  /** Raw data an `ExtraCard` needs that no generic section carries — passed through untouched. */
  extras?: Record<string, unknown>;
}
