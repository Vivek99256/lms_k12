'use client';

import { brainFetch, tenantPath, withQuery } from '@/lib/brain/api';

/**
 * Client for the Fees Intelligence endpoints.
 *
 * Backend:  next_lms_erp/app/Http/Controllers/Brain/BrainFeesIntelligenceController.php
 * Routes:   next_lms_erp/routes/brain.php
 *             GET  /api/brain/{tenant}/fees/intelligence
 *             POST /api/brain/{tenant}/fees/intelligence/run
 *             GET  /api/brain/{tenant}/fees/accounts
 *
 * WHY THIS GOES THROUGH brainFetch RATHER THAN THE FEES PROXY. Two things come
 * for free and both are load-bearing here:
 *
 *   - `syear` is appended to EVERY request from the LMS header's own selection
 *     (lib/brain/api.ts), so no call site can forget it and no screen can show
 *     one year's figures under another year's heading.
 *   - the tenant comes from the signed LMS token and is re-checked server-side
 *     by brain.tenant, so a fees request cannot reach another institute.
 *
 * The decision and outcome writes deliberately reuse the Brain's existing
 * endpoints (`decideRecommendation`, `completeExecution` in lib/brain/api.ts)
 * rather than gaining fee-specific copies: a fee decision must be the same kind
 * of record, with the same audit trail, as every other decision in the system.
 */

/* ------------------------------------------------------------------ shapes */

/** What this institute-year actually has. The screen's empty states key off this. */
export interface FeesCoverage {
  available: boolean;
  reason: string | null;
  syear: string | null;
  hasDemand: boolean;
  hasReceipts: boolean;
  hasOtherFees: boolean;
  hasCycleMap: boolean;
  hasHeads: boolean;
  demandRows: number;
  receiptRows: number;
  enrolledStudents: number;
  feeAccounts: number;
}

export interface FeesAgingBand {
  key: string;
  label: string;
  amount: number;
}

export interface FeesPosition {
  currency: string;
  demandAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  /** Null when nothing was billed — a rate over no demand is undefined, not 0%. */
  collectionRate: number | null;
  concessionAmount: number;
  fineAmount: number;
  overdueAmount: number;
  overdueCycles: number;
  agingBands: FeesAgingBand[];
  feeAccounts: number;
  payingAccounts: number;
  defaulterAccounts: number;
  fullySettledAccounts: number;
  receipts: number;
  averageOutstandingPerDefaulter: number | null;
}

export interface FeesCycle {
  cycleId: string;
  label: string;
  demandAmount: number;
  collectedAmount: number;
  concessionAmount: number;
  outstandingAmount: number;
  collectionRate: number | null;
  receipts: number;
  isPast: boolean;
}

export interface FeesHead {
  headId: string;
  key: string;
  label: string;
  kind: 'regular' | 'additional';
  sortOrder: number;
  demandAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  collectionRate: number | null;
  /** False ⇒ receipts do not record this head separately, so 0 collected is unknown, not zero. */
  collectionAttributable: boolean;
}

export interface FeesClass {
  gradeId: string;
  standardId: string;
  label: string;
  section: string;
  accounts: number;
  demandAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  defaulterAccounts: number;
  collectionRate: number | null;
}

export interface FeesPaymentMode {
  mode: string;
  receipts: number;
  amount: number;
}

export interface FeesEvidencePoint {
  label: string;
  value: string;
  note?: string | null;
}

export interface FeesFinding {
  id: string;
  severity: string;
  severityLabel: string;
  title: string;
  whatHappened: string;
  whyItMatters: string | null;
  evidence: FeesEvidencePoint[];
  likelyCause: string | null;
  causeConfirmed: boolean;
  recommendation: string | null;
  owner: string;
  priority: string;
  confidence: { band: string; value: number };
  affected: { count: number | null; total: number | null; unit: string | null };
  raisedAt: string;
  impactAmount: number | null;
  syear: number | string | null;
  status: string;
}

export interface FeesPriority {
  id: string;
  severity: string;
  severityLabel: string;
  title: string;
  whatHappened: string;
  whyItMatters: string | null;
  evidence: FeesEvidencePoint[];
  impactAmount: number | null;
  nextStep: string | null;
  owner: string;
  confidence: { band: string; value: number };
}

export interface FeesRecommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  urgency: string;
  confidence: { band: string; value: number };
  status: string;
  syear: number | string | null;
  expectedImpact: { amount: number; basis: string; wording: string } | null;
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

export type FeesOutcomeState =
  | 'resolved'
  | 'partially_resolved'
  | 'not_reached'
  | 'undetermined'
  | 'awaiting_outcome'
  | 'no_action_queued';

export interface FeesDecisionTrailEntry {
  decisionId: string;
  status: string;
  rationale: string;
  decidedBy: string;
  decidedAt: string;
  syear: number | string | null;
  recommendation: { id: string; title: string; category: string };
  finding: string;
  expectedImpact: number | null;
  execution: {
    id: string;
    status: string;
    /** The procedure a person is carrying out — never an ESO id. */
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
    measured: FeesMeasuredOutcome | null;
  } | null;
  outcomeState: FeesOutcomeState;
}

export interface FeesLearning {
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
    measured: FeesMeasuredOutcome | null;
    appliesToThisYear: boolean;
  }>;
}

/** "What is happening", composed server-side from the figures — never model output. */
export interface FeesSummaryBlock {
  available: boolean;
  reason: string | null;
  headline: string | null;
  sentences: string[];
}

/** Cancellations and refunds recorded against this year. */
export interface FeesAdjustments {
  available: boolean;
  reason: string | null;
  cancelledReceipts: number;
  cancelledAmount: number;
  refunds: number;
  refundedAmount: number;
  /** Null when nothing was collected to compare against — not zero. */
  cancelledShareOfCollection: number | null;
}

export interface FeesDataQualityCheck {
  key: string;
  label: string;
  value: number;
  amount: number;
  sharePercent: number | null;
  state: 'ok' | 'attention';
  note: string;
}

export interface FeesDataQuality {
  available: boolean;
  reason: string | null;
  checks: FeesDataQualityCheck[];
}

/** Recorded by the person reporting back; absent when nobody measured it. */
export interface FeesMeasuredOutcome {
  before: number;
  after: number;
  change: number;
  accountsAffected: number | null;
  basis: string;
}

export interface FeesRuleStatus {
  key: string;
  label: string;
  checked: boolean;
  raised: boolean;
}

export interface FeesIntelligencePayload {
  tenantId: string;
  organization: string;
  source: string;
  academicYear: { syear: string | null };
  coverage: FeesCoverage;
  freshness: {
    positionLabel: string;
    findingsRefreshedAt: string | null;
    findingsLabel: string;
  };
  execution: { automated: boolean; note: string };
  summary: FeesSummaryBlock;
  position: FeesPosition | null;
  adjustments: FeesAdjustments;
  dataQuality: FeesDataQuality;
  trends: {
    cycles: FeesCycle[];
    heads: FeesHead[];
    classes: FeesClass[];
    paymentModes: FeesPaymentMode[];
  };
  findings: FeesFinding[];
  priorities: FeesPriority[];
  recommendations: FeesRecommendation[];
  decisionTrail: FeesDecisionTrailEntry[];
  learning: FeesLearning;
  ruleStatus: FeesRuleStatus[];
}

export interface FeesAccountsPage {
  tenantId: string;
  syear: string | null;
  total: number;
  offset: number;
  limit: number;
  /** Present when the list was narrowed to one class. */
  scope: {
    standardId: string;
    label: string;
    accounts: number;
    outstandingAmount: number;
  } | null;
  rows: Array<{
    studentId: string;
    name: string;
    enrollmentNo: string;
    className: string;
    demandAmount: number;
    collectedAmount: number;
    concessionAmount: number;
    outstandingAmount: number;
  }>;
}

/* ------------------------------------------------------------------- calls */

export const fetchFeesIntelligence = () =>
  brainFetch<FeesIntelligencePayload>(tenantPath('/fees/intelligence'));

export const runFeesIntelligence = () =>
  brainFetch<Record<string, unknown>>(tenantPath('/fees/intelligence/run'), { method: 'POST' });

export const fetchFeesAccounts = (offset = 0, limit = 25, standardId?: string) =>
  brainFetch<FeesAccountsPage>(
    withQuery(tenantPath('/fees/accounts'), { offset, limit, standard_id: standardId }),
  );

/**
 * Record what actually happened after an approved action.
 *
 * Goes through the Brain's own execution endpoint rather than a fee-specific
 * copy, so a fee outcome is the same kind of record, with the same audit trail,
 * as every other outcome in the system. The measured figures are OPTIONAL: the
 * loop closes without them, and sending a zero for "not measured" would make the
 * ledger claim the action moved nothing.
 */
export const recordFeesOutcome = (
  executionId: string,
  result: 'success' | 'partial' | 'failed',
  feedback: string,
  measured?: { before?: number; after?: number; accountsAffected?: number },
) =>
  brainFetch<{ executionId: string; outcomeId: string | null; result: string }>(
    tenantPath(`/executions/${executionId}/complete`),
    {
      method: 'POST',
      body: JSON.stringify({
        result,
        feedback,
        measured_before: measured?.before,
        measured_after: measured?.after,
        accounts_affected: measured?.accountsAffected,
      }),
    },
  );
