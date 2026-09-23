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
 * What a stock-take actually found, and — where the outcome column was never
 * filled in — the fact that it found nothing recordable. An earlier version read
 * a blank outcome as a missing asset and reported "0% verified, 1,105 items
 * missing" about a stock-take that simply has no result on file.
 *
 * Item codes group by prefix and the grouping is real, but nothing in this
 * schema says what a prefix stands for, so the screen shows the prefix rather
 * than inventing a category name for it.
 */
export const inventoryIntelligenceContract = defineContract({
  key: 'inventory',
  label: 'Inventory & Asset Intelligence',
  accent: '#10B981', // Emerald
  grain: 'one barcode scan during a stock-take — the code, and whether the item was found',
  nouns: { singular: 'scan', plural: 'scans' },

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
        title: 'Stock-take position',
        description:
          'Read “scans with an outcome” first: every verification figure is computed over the scans that record whether the item was found, and a blank outcome is unknown rather than missing.',
      },
      breakdowns: {
        title: 'Where the stock sits',
        description:
          'Scans by the outcome recorded against them, by item-code prefix, and requisition lines by the status they are sitting in.',
      },
      findings: {
        description:
          'One finding per pattern. Nothing fires on an absent column: where no scan carries an outcome, the finding is about the records rather than about the assets.',
      },
      priorities: {
        description:
          'The stock-take and requisition issues worth acting on first, with the next step each one implies.',
      },
      dataQuality: {
        title: 'Stock-take record checks',
        description:
          'Exact counts against this year’s scans: scans with no outcome or no code, codes scanned more than once, and whether the item master can resolve a code at all.',
      },
      recommendations: {
        description:
          'Each recommendation names the finding it answers and the cause the engine was authorised to state. A recommendation whose rule has no approved cause carries no explanation rather than a composed one. Approving one records a decision against your name; it does not execute anything on its own.',
      },
      decisions: {
        description:
          'What was decided, what was queued, and what it actually achieved. A decision with nothing queued and an execution with no outcome reported are real states of the loop, not missing data.',
      },
      learning: {
        description:
          'What earlier decisions in this module actually achieved, carried forward so the next one is better informed. Deliberately not filtered to the year you are viewing — what worked last year is exactly what should inform this one.',
      },
    },
  ),

  summaryMetrics: [
    'itemCodes',
    'verificationRate',
    'itemsNotFound',
    'outcomeCoverage',
    'repeatScans',
    'requisitions',
  ],

  emptyState: {
    title: 'No stock-take or requisitions for this academic year',
    fallbackReason:
      'No barcode scans and no requisition lines were recorded for the academic year selected in the header.',
  },
});
