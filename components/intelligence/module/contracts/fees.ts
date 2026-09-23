import {
  fetchFeesIntelligence,
  runFeesIntelligence,
  type FeesIntelligencePayload,
} from '@/app/fees/intelligence/_lib/fees-intelligence-api';
import { decideRecommendation } from '@/lib/brain/api';

import { defineContract, sectionsWith } from '../contract';
import { money } from '../format';
import type { Breakdown, ModuleIntelligencePayload } from '../payload';

/**
 * Fees, as the reference contract.
 *
 * ── WHY FEES AND WHY AN ADAPTER ─────────────────────────────────────────────
 *
 * Fees Intelligence is the only module whose numbers are known to be right, so
 * it is the only honest thing to validate the generic shape against. Its
 * endpoint predates `ModuleIntelligencePayload` and returns fee-specific types,
 * so `adapt()` below maps one to the other IN THE CLIENT.
 *
 * THAT ADAPTER IS A MIGRATION STEP, NOT THE DESIGN. It exists so this layer
 * could be proved without touching the Fees backend, the Fees screen or the
 * Fees route — none of which move. A new module skips it entirely: its
 * controller emits `ModuleIntelligencePayload` directly and its contract's
 * `load` is a bare `brainFetch`.
 *
 * ── WHAT THE MAPPING PROVES ─────────────────────────────────────────────────
 *
 * Six of the eight sections map with no transformation at all — findings,
 * priorities, recommendations, decisions, learning and rule status are already
 * generic, because they come from the shared Brain loop rather than from the
 * fee layer. Only `position` and `breakdowns` need restating, and both are
 * mechanical. That is the evidence that one renderer can serve every module:
 * the module-specific part of an intelligence screen is smaller than it looks.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ───────────────────────────────────────────
 *
 * Gateway reconciliation, NACH mandates and payment failures. They are real
 * fee intelligence and they are exactly what `extraCards` is for — but
 * duplicating them here while the Fees screen still renders its own copies
 * would put the same cards on two surfaces with two sets of bugs. They move
 * across when Fees adopts this renderer, which is a separate change.
 */

/* ------------------------------------------------------------------ adapter */

function feesBreakdowns(payload: FeesIntelligencePayload): Breakdown[] {
  const { trends, position, coverage } = payload;

  const breakdowns: Breakdown[] = [
    {
      key: 'cycles',
      label: 'By fee cycle',
      description: 'Each billing month of this academic year, in the order they fall due.',
      available: trends.cycles.length > 0,
      reason: coverage.hasCycleMap ? null : 'This year has no fee cycle map, so demand cannot be split by month.',
      primaryColumn: 'demand',
      columns: [
        { key: 'demand', label: 'Demand', format: 'currency' },
        { key: 'collected', label: 'Collected', format: 'currency' },
        { key: 'outstanding', label: 'Outstanding', format: 'currency' },
        { key: 'rate', label: 'Rate', format: 'percent' },
      ],
      rows: trends.cycles.map((cycle) => ({
        key: cycle.cycleId,
        label: cycle.label,
        note: cycle.isPast ? 'Past due' : null,
        tone: cycle.isPast && (cycle.collectionRate ?? 100) < 60 ? 'medium' : undefined,
        values: {
          demand: cycle.demandAmount,
          collected: cycle.collectedAmount,
          outstanding: cycle.outstandingAmount,
          rate: cycle.collectionRate,
        },
      })),
    },
    {
      key: 'heads',
      label: 'By fee head',
      description: 'What each head was billed for and what has been collected against it.',
      available: trends.heads.length > 0,
      reason: coverage.hasHeads ? null : 'No fee heads are configured for this year.',
      primaryColumn: 'demand',
      columns: [
        { key: 'demand', label: 'Demand', format: 'currency' },
        { key: 'collected', label: 'Collected', format: 'currency' },
        { key: 'outstanding', label: 'Outstanding', format: 'currency' },
      ],
      rows: trends.heads.map((head) => ({
        key: head.headId,
        label: head.label,
        // Carries the layer's own caveat rather than dropping it: a head whose
        // receipts do not record it separately shows 0 collected, and that 0
        // means "unknown", not "nothing".
        note: head.collectionAttributable ? null : 'Receipts do not record this head separately',
        values: {
          demand: head.demandAmount,
          collected: head.collectionAttributable ? head.collectedAmount : null,
          outstanding: head.outstandingAmount,
        },
      })),
    },
    {
      key: 'classes',
      label: 'By class',
      description: 'Where the outstanding amount sits on the roll.',
      available: trends.classes.length > 0,
      reason: null,
      primaryColumn: 'outstanding',
      columns: [
        { key: 'outstanding', label: 'Outstanding', format: 'currency' },
        { key: 'accounts', label: 'Accounts', format: 'count' },
        { key: 'defaulters', label: 'Defaulters', format: 'count' },
        { key: 'rate', label: 'Rate', format: 'percent' },
      ],
      rows: trends.classes.map((klass) => ({
        key: `${klass.gradeId}-${klass.standardId}-${klass.section}`,
        label: klass.label,
        values: {
          outstanding: klass.outstandingAmount,
          accounts: klass.accounts,
          defaulters: klass.defaulterAccounts,
          rate: klass.collectionRate,
        },
      })),
    },
    {
      key: 'paymentModes',
      label: 'How people pay',
      description: 'The mix of payment modes across this year’s receipts.',
      available: trends.paymentModes.length > 0,
      reason: coverage.hasReceipts ? null : 'No collection has been recorded for this year.',
      primaryColumn: 'amount',
      columns: [
        { key: 'amount', label: 'Amount', format: 'currency' },
        { key: 'receipts', label: 'Receipts', format: 'count' },
      ],
      rows: trends.paymentModes.map((mode) => ({
        key: mode.mode,
        label: mode.mode,
        values: { amount: mode.amount, receipts: mode.receipts },
      })),
    },
  ];

  if (position && position.agingBands.length > 0) {
    breakdowns.push({
      key: 'aging',
      label: 'How old the outstanding is',
      description: 'Outstanding amount by how long the cycle has been overdue.',
      available: true,
      reason: null,
      primaryColumn: 'amount',
      columns: [{ key: 'amount', label: 'Outstanding', format: 'currency' }],
      rows: position.agingBands.map((band) => ({
        key: band.key,
        label: band.label,
        values: { amount: band.amount },
      })),
    });
  }

  return breakdowns;
}

/**
 * Map the Fees payload onto the canonical shape.
 *
 * NOTHING IS INVENTED IN HERE AND NOTHING IS ROUNDED. Every field is either
 * copied across or renamed; where Fees has a figure the generic shape does not,
 * the figure is dropped rather than approximated into a neighbouring field.
 */
export function adapt(payload: FeesIntelligencePayload): ModuleIntelligencePayload {
  const p = payload.position;

  return {
    tenantId: payload.tenantId,
    organization: payload.organization,
    source: payload.source,
    academicYear: payload.academicYear,
    coverage: {
      available: payload.coverage.available,
      reason: payload.coverage.reason,
      syear: payload.coverage.syear,
      sources: {
        demand: payload.coverage.hasDemand,
        receipts: payload.coverage.hasReceipts,
        otherFees: payload.coverage.hasOtherFees,
        cycleMap: payload.coverage.hasCycleMap,
        heads: payload.coverage.hasHeads,
      },
      counts: {
        demandRows: payload.coverage.demandRows,
        receiptRows: payload.coverage.receiptRows,
        enrolledStudents: payload.coverage.enrolledStudents,
        feeAccounts: payload.coverage.feeAccounts,
      },
    },
    freshness: payload.freshness,
    execution: payload.execution,
    summary: payload.summary,
    position: p
      ? {
          available: true,
          reason: null,
          metrics: [
            { key: 'demand', label: 'Total fee demand', value: p.demandAmount, format: 'currency', currency: p.currency },
            {
              key: 'collected',
              label: 'Collected',
              value: p.collectedAmount,
              format: 'currency',
              currency: p.currency,
              tone: 'positive',
            },
            {
              key: 'outstanding',
              label: 'Outstanding',
              value: p.outstandingAmount,
              format: 'currency',
              currency: p.currency,
              tone: p.outstandingAmount > 0 ? 'medium' : 'neutral',
            },
            { key: 'collectionRate', label: 'Collection rate', value: p.collectionRate, format: 'percent' },
            {
              key: 'accounts',
              label: 'Fee accounts',
              value: p.feeAccounts,
              format: 'count',
              hint: `of ${payload.coverage.enrolledStudents} enrolled`,
            },
            { key: 'concession', label: 'Concession', value: p.concessionAmount, format: 'currency', currency: p.currency },
            {
              key: 'defaulters',
              label: 'Defaulter accounts',
              value: p.defaulterAccounts,
              format: 'count',
              tone: p.defaulterAccounts > 0 ? 'medium' : 'neutral',
              hint:
                p.averageOutstandingPerDefaulter !== null
                  ? `${money(p.averageOutstandingPerDefaulter, p.currency)} each on average`
                  : null,
            },
            { key: 'settled', label: 'Fully settled', value: p.fullySettledAccounts, format: 'count', tone: 'positive' },
            { key: 'overdue', label: 'Overdue', value: p.overdueAmount, format: 'currency', currency: p.currency },
            { key: 'fine', label: 'Fine charged', value: p.fineAmount, format: 'currency', currency: p.currency },
            { key: 'receipts', label: 'Receipts', value: p.receipts, format: 'count' },
          ],
        }
      : { available: false, reason: payload.coverage.reason, metrics: [] },
    breakdowns: feesBreakdowns(payload),
    findings: payload.findings.map((finding) => ({
      ...finding,
      impact:
        finding.impactAmount !== null
          ? { value: finding.impactAmount, display: money(finding.impactAmount), label: 'in play' }
          : null,
    })),
    priorities: payload.priorities.map((priority) => ({
      ...priority,
      impact:
        priority.impactAmount !== null
          ? { value: priority.impactAmount, display: money(priority.impactAmount), label: 'in play' }
          : null,
    })),
    recommendations: payload.recommendations.map((recommendation) => ({
      ...recommendation,
      expectedImpact: recommendation.expectedImpact
        ? {
            display: money(recommendation.expectedImpact.amount),
            basis: recommendation.expectedImpact.basis,
            wording: recommendation.expectedImpact.wording,
          }
        : null,
    })),
    decisionTrail: payload.decisionTrail.map((entry) => ({
      ...entry,
      expectedImpact:
        entry.expectedImpact !== null
          ? { value: entry.expectedImpact, display: money(entry.expectedImpact), label: 'expected' }
          : null,
      outcome: entry.outcome
        ? {
            ...entry.outcome,
            measured: entry.outcome.measured
              ? {
                  before: entry.outcome.measured.before,
                  after: entry.outcome.measured.after,
                  change: entry.outcome.measured.change,
                  unitsAffected: entry.outcome.measured.accountsAffected,
                  basis: entry.outcome.measured.basis,
                }
              : null,
          }
        : null,
    })),
    learning: {
      available: payload.learning.available,
      reason: payload.learning.reason,
      entries: payload.learning.entries.map((entry) => ({
        ...entry,
        measured: entry.measured
          ? {
              before: entry.measured.before,
              after: entry.measured.after,
              change: entry.measured.change,
              unitsAffected: entry.measured.accountsAffected,
              basis: entry.measured.basis,
            }
          : null,
      })),
    },
    dataQuality: {
      available: payload.dataQuality.available,
      reason: payload.dataQuality.reason,
      checks: payload.dataQuality.checks.map((check) => ({
        key: check.key,
        label: check.label,
        value: check.value,
        format: 'count',
        secondary: check.amount > 0 ? { value: check.amount, format: 'currency', currency: 'INR' } : null,
        sharePercent: check.sharePercent,
        shareLabel: 'of collection',
        state: check.state,
        note: check.note,
      })),
    },
    ruleStatus: payload.ruleStatus,
  };
}

/* ----------------------------------------------------------------- contract */

export const feesIntelligenceContract = defineContract({
  key: 'fees',
  label: 'Fees Intelligence',
  // The indigo the Fees category tabs already use, so the shared renderer is
  // visually indistinguishable from the screen it generalises.
  accent: '#5846EA',
  grain: 'one student’s fee account for this academic year',
  nouns: { singular: 'fee account', plural: 'fee records' },

  load: async () => adapt(await fetchFeesIntelligence()),

  actions: {
    run: runFeesIntelligence,
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
  },

  sections: sectionsWith({
    position: {
      title: 'Financial position',
      description:
        'What is happening — every figure below is read from this year’s fee records at the moment you loaded the page.',
    },
    breakdowns: {
      title: 'Where the money sits',
      description: 'The same totals, sliced the ways a fee office actually works: by cycle, head, class and mode.',
    },
    dataQuality: {
      title: 'Data quality',
      description: 'Checks on the fee ledger itself. Each one is an exact count against this year’s records.',
    },
    learning: {
      description:
        'What earlier fee decisions actually achieved, carried forward so the next decision is better informed.',
    },
  }),

  summaryMetrics: ['demand', 'collected', 'outstanding', 'collectionRate', 'accounts', 'concession'],

  emptyState: {
    title: 'No fee position for this academic year',
    fallbackReason: 'This institute has no fee records for the year selected in the header.',
  },
});
