import {
  fetchFeesIntelligence,
  runFeesIntelligence,
  type FeesIntelligencePayload,
} from '@/app/fees/intelligence/_lib/fees-intelligence-api';
import { decideRecommendation, recordExecutionOutcome } from '@/lib/brain/api';

import { defineContract, sectionsWith } from '../contract';
import { money, type MetricFormat } from '../format';
import type {
  Breakdown,
  DataQuality,
  DecisionTrailEntry,
  Finding,
  Impact,
  Learning,
  MetricGroup,
  MetricValue,
  ModuleIntelligencePayload,
  Priority,
  Recommendation,
} from '../payload';

/**
 * Fees Intelligence — the reference implementation.
 *
 * This is the one module whose endpoint predates `ModuleIntelligencePayload`:
 * `BrainFeesIntelligenceController` still serves the bespoke
 * `FeesIntelligencePayload` shape that `app/fees/intelligence` renders with its
 * own ~3,600 lines of React, money-specific field names and all. `load()` below
 * is the one-time adapter the contract doc calls for — it reshapes that response
 * into the generic payload so this same data can also flow through
 * `<ModuleIntelligence>`, without asking the backend or the original screen to
 * change. Nothing here invents a figure; every field is read off the fetched
 * payload or is a straightforward unit conversion (e.g. an amount to an
 * `Impact.display` string).
 */

const FEES_ACCENT = '#5846EA';

function impactFromAmount(amount: number | null, currency: string): Impact | null {
  if (amount === null) return null;
  return { display: `${money(amount, currency)} in play`, label: 'Amount in play' };
}

function buildPosition(payload: FeesIntelligencePayload): MetricGroup {
  if (!payload.coverage.available || !payload.position) {
    return { available: false, reason: payload.coverage.reason, metrics: [] };
  }

  const p = payload.position;
  const currency = p.currency;
  const metric = (
    key: string,
    label: string,
    value: number | null,
    format: MetricFormat = 'money',
  ): MetricValue => ({ key, label, value, format, currency: format === 'money' ? currency : undefined });

  const metrics: MetricValue[] = [
    metric('demandAmount', 'Fees demanded', p.demandAmount),
    metric('collectedAmount', 'Fees collected', p.collectedAmount),
    metric('outstandingAmount', 'Outstanding', p.outstandingAmount),
    metric('collectionRate', 'Collection rate', p.collectionRate, 'percent'),
    metric('concessionAmount', 'Concessions', p.concessionAmount),
    metric('fineAmount', 'Fines', p.fineAmount),
    metric('overdueAmount', 'Overdue', p.overdueAmount),
    metric('overdueCycles', 'Overdue cycles', p.overdueCycles, 'count'),
    metric('feeAccounts', 'Fee accounts', p.feeAccounts, 'count'),
    metric('payingAccounts', 'Paying accounts', p.payingAccounts, 'count'),
    metric('defaulterAccounts', 'Defaulter accounts', p.defaulterAccounts, 'count'),
    metric('fullySettledAccounts', 'Fully settled accounts', p.fullySettledAccounts, 'count'),
    metric('receipts', 'Receipts', p.receipts, 'count'),
    metric('averageOutstandingPerDefaulter', 'Average outstanding per defaulter', p.averageOutstandingPerDefaulter),
  ];

  /*
   * CANCELLATIONS AND REFUNDS — the one block the native Fees screen carried
   * that this contract did not.
   *
   * Appended here rather than dropped, because moving Fees onto the shared
   * renderer must not cost a bursar a figure they had yesterday. Same endpoint,
   * same numbers, same backend calculation — only the presentation moves.
   *
   * Appended CONDITIONALLY: when the ledger records no adjustments the block is
   * genuinely unavailable, and four zeroes would assert that nothing was ever
   * cancelled rather than that nothing is known.
   */
  const adjustments = payload.adjustments;
  if (adjustments?.available) {
    metrics.push(
      metric('cancelledReceipts', 'Receipts cancelled', adjustments.cancelledReceipts, 'count'),
      metric('cancelledAmount', 'Cancelled amount', adjustments.cancelledAmount),
      metric('refunds', 'Refunds issued', adjustments.refunds, 'count'),
      metric('refundedAmount', 'Refunded amount', adjustments.refundedAmount),
      metric(
        'cancelledShareOfCollection',
        'Cancelled share of collection',
        adjustments.cancelledShareOfCollection,
        'percent',
      ),
    );
  }

  return { available: true, metrics };
}

/** The same totals `app/fees/intelligence` calls "trends", sliced the ways fees is actually managed. */
function buildBreakdowns(payload: FeesIntelligencePayload): Breakdown[] {
  const currency = payload.position?.currency ?? 'INR';

  const cycles: Breakdown = {
    key: 'cycles',
    label: 'Fee cycles',
    description: 'Demand, collection and outstanding by fee cycle.',
    available: payload.trends.cycles.length > 0,
    primaryColumn: 'outstanding',
    columns: [
      { key: 'demand', label: 'Demand', format: 'money', currency },
      { key: 'collected', label: 'Collected', format: 'money', currency },
      { key: 'concession', label: 'Concession', format: 'money', currency },
      { key: 'outstanding', label: 'Outstanding', format: 'money', currency },
      { key: 'collectionRate', label: 'Collection rate', format: 'percent' },
      { key: 'receipts', label: 'Receipts', format: 'count' },
    ],
    rows: payload.trends.cycles.map((c) => ({
      key: c.cycleId,
      label: c.label,
      note: c.isPast ? 'Past cycle' : null,
      values: {
        demand: c.demandAmount,
        collected: c.collectedAmount,
        concession: c.concessionAmount,
        outstanding: c.outstandingAmount,
        collectionRate: c.collectionRate,
        receipts: c.receipts,
      },
    })),
  };

  const heads: Breakdown = {
    key: 'heads',
    label: 'Fee heads',
    description:
      'The same totals split by fee head — tuition, transport, and every additional head the institute has defined.',
    available: payload.trends.heads.length > 0,
    primaryColumn: 'outstanding',
    columns: [
      { key: 'demand', label: 'Demand', format: 'money', currency },
      { key: 'collected', label: 'Collected', format: 'money', currency },
      { key: 'outstanding', label: 'Outstanding', format: 'money', currency },
      { key: 'collectionRate', label: 'Collection rate', format: 'percent' },
    ],
    rows: payload.trends.heads.map((h) => ({
      key: h.headId,
      label: h.label,
      note: h.collectionAttributable ? null : 'Receipts do not record this head separately',
      values: {
        demand: h.demandAmount,
        collected: h.collectionAttributable ? h.collectedAmount : null,
        outstanding: h.outstandingAmount,
        collectionRate: h.collectionAttributable ? h.collectionRate : null,
      },
    })),
  };

  const classes: Breakdown = {
    key: 'classes',
    label: 'Classes',
    description: 'Fee position by class and section.',
    available: payload.trends.classes.length > 0,
    primaryColumn: 'outstanding',
    columns: [
      { key: 'accounts', label: 'Accounts', format: 'count' },
      { key: 'demand', label: 'Demand', format: 'money', currency },
      { key: 'collected', label: 'Collected', format: 'money', currency },
      { key: 'outstanding', label: 'Outstanding', format: 'money', currency },
      { key: 'defaulters', label: 'Defaulters', format: 'count' },
      { key: 'collectionRate', label: 'Collection rate', format: 'percent' },
    ],
    rows: payload.trends.classes.map((c) => ({
      key: `${c.gradeId}-${c.standardId}`,
      label: c.section ? `${c.label} ${c.section}` : c.label,
      values: {
        accounts: c.accounts,
        demand: c.demandAmount,
        collected: c.collectedAmount,
        outstanding: c.outstandingAmount,
        defaulters: c.defaulterAccounts,
        collectionRate: c.collectionRate,
      },
    })),
  };

  const paymentModes: Breakdown = {
    key: 'paymentModes',
    label: 'Payment modes',
    description: 'Receipts and amount collected by how it was paid.',
    available: payload.trends.paymentModes.length > 0,
    primaryColumn: 'amount',
    columns: [
      { key: 'receipts', label: 'Receipts', format: 'count' },
      { key: 'amount', label: 'Amount', format: 'money', currency },
    ],
    rows: payload.trends.paymentModes.map((m) => ({
      key: m.mode,
      label: m.mode,
      values: { receipts: m.receipts, amount: m.amount },
    })),
  };

  const agingBands = payload.position?.agingBands ?? [];
  const aging: Breakdown = {
    key: 'aging',
    label: 'Overdue aging',
    description: 'Outstanding overdue amount, grouped by how overdue it is.',
    available: agingBands.length > 0,
    primaryColumn: 'amount',
    columns: [{ key: 'amount', label: 'Amount', format: 'money', currency }],
    rows: agingBands.map((b) => ({ key: b.key, label: b.label, values: { amount: b.amount } })),
  };

  return [cycles, heads, classes, paymentModes, aging];
}

function buildFindings(payload: FeesIntelligencePayload, currency: string): Finding[] {
  return payload.findings.map((f) => ({
    id: f.id,
    severity: f.severity,
    severityLabel: f.severityLabel,
    title: f.title,
    whatHappened: f.whatHappened,
    whyItMatters: f.whyItMatters,
    evidence: f.evidence,
    likelyCause: f.likelyCause,
    causeConfirmed: f.causeConfirmed,
    confidence: f.confidence,
    impact: impactFromAmount(f.impactAmount, currency),
  }));
}

function buildPriorities(payload: FeesIntelligencePayload, currency: string): Priority[] {
  return payload.priorities.map((p) => ({
    id: p.id,
    severity: p.severity,
    severityLabel: p.severityLabel,
    title: p.title,
    whatHappened: p.whatHappened,
    whyItMatters: p.whyItMatters,
    evidence: p.evidence,
    confidence: p.confidence,
    impact: impactFromAmount(p.impactAmount, currency),
    owner: p.owner,
    nextStep: p.nextStep,
  }));
}

function buildRecommendations(payload: FeesIntelligencePayload): Recommendation[] {
  return payload.recommendations.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    priority: r.priority,
    confidence: r.confidence,
    actionable: r.actionable,
    finding: { title: r.finding.title },
    expectedImpact: r.expectedImpact
      ? { wording: r.expectedImpact.wording, basis: r.expectedImpact.basis }
      : null,
    decision: r.decision
      ? {
          status: r.decision.status,
          decidedBy: r.decision.decidedBy,
          decidedAt: r.decision.decidedAt,
          rationale: r.decision.rationale,
        }
      : null,
  }));
}

function buildDecisionTrail(payload: FeesIntelligencePayload): DecisionTrailEntry[] {
  return payload.decisionTrail.map((d) => ({
    decisionId: d.decisionId,
    status: d.status,
    decidedBy: d.decidedBy,
    decidedAt: d.decidedAt,
    outcomeState: d.outcomeState,
    recommendation: { title: d.recommendation.title },
    finding: d.finding,
    rationale: d.rationale,
    expectedImpact: d.expectedImpact,
    execution: d.execution
      ? { action: d.execution.action, owner: d.execution.owner, status: d.execution.status }
      : null,
    outcome: d.outcome
      ? {
          result: d.outcome.result,
          feedback: d.outcome.feedback,
          measured: d.outcome.measured
            ? {
                basis: d.outcome.measured.basis,
                before: d.outcome.measured.before,
                after: d.outcome.measured.after,
                change: d.outcome.measured.change,
                accountsAffected: d.outcome.measured.accountsAffected,
              }
            : null,
        }
      : null,
  }));
}

function buildDataQuality(payload: FeesIntelligencePayload, currency: string): DataQuality {
  return {
    available: payload.dataQuality.available,
    reason: payload.dataQuality.reason,
    checks: payload.dataQuality.checks.map((c) => ({
      key: c.key,
      label: c.label,
      state: c.state,
      value: c.value,
      format: 'count',
      secondary: { value: c.amount, format: 'money', currency },
      sharePercent: c.sharePercent,
      note: c.note,
    })),
  };
}

function buildLearning(payload: FeesIntelligencePayload): Learning {
  return {
    available: payload.learning.available,
    reason: payload.learning.reason,
    entries: payload.learning.entries.map((e) => ({
      recordedAt: e.recordedAt,
      result: e.result,
      syear: e.syear,
      appliesToThisYear: e.appliesToThisYear,
      action: e.action,
      finding: e.finding,
      feedback: e.feedback,
    })),
  };
}

function adaptFeesPayload(payload: FeesIntelligencePayload): ModuleIntelligencePayload {
  const currency = payload.position?.currency ?? 'INR';

  return {
    organization: payload.organization,
    source: payload.source,
    academicYear: payload.academicYear,
    coverage: { available: payload.coverage.available, reason: payload.coverage.reason },
    freshness: payload.freshness,
    execution: payload.execution,
    summary: payload.summary,
    position: buildPosition(payload),
    breakdowns: buildBreakdowns(payload),
    findings: buildFindings(payload, currency),
    ruleStatus: payload.ruleStatus,
    priorities: buildPriorities(payload, currency),
    recommendations: buildRecommendations(payload),
    decisionTrail: buildDecisionTrail(payload),
    dataQuality: buildDataQuality(payload, currency),
    learning: buildLearning(payload),
    // Cancellations and refunds have no generic section to live in — kept here
    // for a future ExtraCard rather than dropped on the floor.
    extras: { adjustments: payload.adjustments },
  };
}

export const feesIntelligenceContract = defineContract({
  key: 'fees',
  label: 'Fees Intelligence',
  accent: FEES_ACCENT,
  grain: "one student's fee account",
  nouns: { singular: 'fee account', plural: 'fee accounts' },

  load: async () => adaptFeesPayload(await fetchFeesIntelligence()),

  actions: {
    // Writes this module's findings to the signal ledger, which is what gives
    // the three sections below anything to show. Idempotent.
    run: () => runFeesIntelligence(),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith({
    position: {
      title: 'Fees position',
      description:
        'What this year’s demand, collection and outstanding actually are, read from the same demand and receipt rows the collection screens use.',
    },
    breakdowns: {
      title: 'Where the fees sit',
      description:
        'The same totals sliced by cycle, head, class and payment mode — plus how overdue the outstanding amount actually is.',
    },
    findings: {
      description:
        'What the demand and receipt rows mean — concentrations of outstanding amount, collection slowdowns, and register gaps — each with the figures it rests on.',
    },
    priorities: {
      description: 'The fee risks worth acting on first, with the next step each one implies.',
    },
    dataQuality: {
      title: 'Demand & receipt checks',
      description:
        'Exact counts against this year’s rows: receipts with no matching demand, accounts with no cycle assigned, and heads the register cannot attribute collection to.',
    },
    recommendations: {
      description:
        'Each recommendation names the finding it answers and the cause the engine was authorised to state. Approving one records a decision against your name; it does not execute anything on its own.',
    },
    decisions: {
      description:
        'What was decided, what was queued, and what it actually collected. A decision with nothing queued and an execution with no outcome reported are real states of the loop, not missing data.',
    },
    learning: {
      description:
        'What earlier fee decisions actually achieved, carried forward so the next one is better informed.',
    },
  }),

  // Capped at six — the summary strip takes the first six and drops the rest.
  summaryMetrics: [
    'demandAmount',
    'collectedAmount',
    'outstandingAmount',
    'collectionRate',
    'defaulterAccounts',
    'overdueAmount',
  ],

  emptyState: {
    title: 'No fee data yet',
    fallbackReason: 'No fee demand or receipt records have been registered for this institute-year.',
  },
});
