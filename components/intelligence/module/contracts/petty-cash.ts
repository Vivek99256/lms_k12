import { brainFetch, tenantPath } from '@/lib/brain/api';

import { defineContract, sectionsWith } from '../contract';
import type { ModuleIntelligencePayload } from '../payload';

/**
 * Petty Cash Intelligence.
 *
 * Spending out of the institute's float, read from `petty_cash` and its head
 * master. There is no approval column on that table, so nothing here reports
 * approval status - only what was spent, on what, and by whom.
 *
 * NO ADAPTER. `BrainPettyCashIntelligenceController` emits the canonical
 * `ModuleIntelligencePayload` directly, so `load` is a bare `brainFetch` and
 * everything here is presentation.
 *
 * NO `run` ACTION. This module's findings are computed per request rather than
 * written to the signal ledger, so the renderer hides "Analyse this year"
 * instead of offering a button that would recompute nothing. The L5 sections
 * are still declared: `ModuleLoop` reads them back from the ledger and they
 * report honestly that nothing has been recorded against this module yet.
 */
export const pettyCashIntelligenceContract = defineContract({
  key: 'petty-cash',
  label: 'Petty Cash Intelligence',
  accent: '#0E7490',
  grain: 'one petty-cash claim',
  nouns: { singular: 'claim', plural: 'petty-cash claims' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/petty-cash/intelligence')),

  actions: {},

  sections: sectionsWith({
    position: {
      title: 'Spending position',
      description:
        'Every figure is an all-time institute total: petty cash carries no academic year in this schema, so the year selected in the header does not filter it.',
    },
    breakdowns: {
      title: 'Where the float goes',
      description:
        'The same spend grouped by the institute’s own headings and by the person who claimed it.',
    },
    findings: {
      description:
        'What the spend pattern shows — outsized claims, concentration on one claimant, and unevidenced spend — each measured against this institute’s own average rather than an external benchmark.',
    },
    dataQuality: {
      title: 'Claim ledger checks',
      description:
        'Exact counts against this institute’s petty-cash rows: missing amounts, missing headings and missing bill images.',
    },
  }),

  // Matched against the metric keys the controller actually forwards. A key the
  // controller never sends renders nothing at all, silently.
  summaryMetrics: ['totalAmount', 'claims', 'meanAmount', 'largestAmount', 'spenders', 'withBill'],

  emptyState: {
    title: 'No petty-cash activity yet',
    fallbackReason:
      'No petty-cash claims have been recorded for this institute.',
  },
});
