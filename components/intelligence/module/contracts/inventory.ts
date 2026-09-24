import {
  brainFetch,
  decideRecommendation,
  recordExecutionOutcome,
  runModuleIntelligence,
  tenantPath,
} from '@/lib/brain/api';

import { defineContract, sectionsWith } from '../contract';
import type { ModuleIntelligencePayload } from '../payload';

/**
 * Inventory & Asset Intelligence.
 *
 * Reads `item_scan_details` (barcode scans from a stock-take) and
 * `inventory_requisition_details` (requisition lines raised against stock).
 * `inventory_item_master` is not read: it holds one row across every institute
 * that has ever run a stock-take, so a scanned code cannot be resolved to an
 * item name, a category or a reorder level from it.
 *
 * A blank scan outcome means the register does not say whether the item was
 * found — it is UNKNOWN, not a missing asset. An earlier version of this
 * module read 1,105 blank outcomes as 0% verified; this contract's Position
 * and Data quality copy exist to stop that mistake recurring.
 *
 * Item-code prefixes are shown as prefixes, verbatim — no table this module
 * can read says what a prefix stands for, so none is invented.
 */
export const inventoryIntelligenceContract = defineContract({
  key: 'inventory',
  label: 'Inventory & Asset Intelligence',
  accent: '#0F766E',
  grain: 'one scanned inventory item, read from stock-take scans and requisition lines',
  nouns: { singular: 'item', plural: 'items' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/inventory/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('inventory'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Inventory position',
        description:
          'What this year’s stock-take scans show right now, read live from item_scan_details. Where the outcome column is blank the figure shows as a dash, not a zero — a blank means the register does not say whether the item was found.',
      },
      breakdowns: {
        title: 'Where the stock-take sits',
        description:
          'Scans sliced by the institute’s own recorded outcome, by item-code prefix, and requisition lines by status. Prefixes are shown verbatim, as the code itself groups — no category name is invented for what a prefix stands for.',
      },
      findings: {
        description:
          'What the stock-take and requisition records show, each with the scan and code counts it rests on. A register with no outcome recorded at all is reported as having no result, never as a 0% verification rate.',
      },
      priorities: {
        description:
          'The stock-take and requisition risks worth acting on first — outcome coverage gaps that leave the count untrustworthy, and requisition backlogs — with the next step each one implies.',
      },
      dataQuality: {
        title: 'Stock-take & requisition checks',
        description:
          'Exact counts against this year’s rows: scans with no recorded outcome (unknown, not missing), repeat scans against a code already counted, and item codes that cannot be resolved against the item master.',
      },
      recommendations: {
        description:
          'Each recommendation names the finding it answers and the cause the engine was authorised to state. A recommendation whose rule has no approved cause carries no explanation rather than a composed one. Approving one records a decision against your name; it does not execute anything on its own.',
      },
    },
  ),

  // Capped at six — the summary strip takes the first six and drops the
  // rest, so itemsNotFound stays in Position only (it is read only against
  // scans that carry an outcome, and outcomeCoverage already flags how much
  // of the register that excludes).
  // Matched against the Metric keys
  // BrainInventoryIntelligenceController::position() actually serves:
  // itemCodes, verificationRate, itemsNotFound, outcomeCoverage,
  // repeatScans, requisitions, itemsOnMaster.
  summaryMetrics: [
    'itemCodes',
    'verificationRate',
    'outcomeCoverage',
    'repeatScans',
    'requisitions',
    'itemsOnMaster',
  ],

  emptyState: {
    title: 'No inventory data yet',
    fallbackReason:
      'No inventory scan or requisition records have been recorded for this institute-year.',
  },
});
