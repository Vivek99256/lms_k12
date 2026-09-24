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
 * Library Intelligence.
 *
 * Built on `library_book_circulations` (one row per loan) and
 * `library_books` (the catalogue a loan's title is drawn from). A loan
 * belongs to the year when its own `syear` column says so, or — where
 * `syear` is null, as it is for 36,851 of one institute's 36,977 loans —
 * when it was issued inside that year's own start/end dates. Filtering on
 * `syear` alone showed one institute only 126 of its loans; the date
 * fallback is what makes the rest of this screen's figures real.
 *
 * ── WHAT THIS SCREEN WILL NOT SHOW ──────────────────────────────────────────
 *
 * The L5 decision → execution → outcome loop is not wired for this module
 * yet, so Decisions and Learning will read as empty rather than populated.
 */
export const libraryIntelligenceContract = defineContract({
  key: 'library',
  label: 'Library Intelligence',
  accent: '#65A30D',
  grain: 'one book circulation (loan)',
  nouns: { singular: 'loan', plural: 'loans' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/library/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('library'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Circulation position',
        description:
          'Total circulations, distinct titles and active borrowers for the year, with the current return rate and how many issued books are still on loan or overdue — read from `library_book_circulations` at the moment you loaded the page.',
      },
      breakdowns: {
        title: 'Where circulation sits',
        description:
          'The same loans sliced by title — the most requested books and how many copies are currently out — and by status: returned, active within deadline, or overdue.',
      },
      findings: {
        description:
          'What the circulation and catalogue records show, including whether a title in `library_books` has ever been borrowed at all. No finding appears without the circulation counts it rests on.',
      },
      priorities: {
        description:
          'The circulation risks worth acting on first — overdue concentrations and a dormant catalogue among them — with the next step each one implies.',
      },
      dataQuality: {
        title: 'Circulation & catalogue checks',
        description:
          'Exact counts against this year’s rows, including how many loans were dated by the `syear` column versus by falling back to the academic year’s issue-date range.',
      },
      recommendations: {
        description:
          'Each recommendation names the finding it answers and the cause the engine was authorised to state. A recommendation whose rule has no approved cause carries no explanation rather than a composed one. Approving one records a decision against your name; it does not execute anything on its own.',
      },
    },
  ),

  // Capped at six — the summary strip takes the first six and drops the
  // rest. These are exactly the Metric objects
  // BrainLibraryIntelligenceController::position() forwards into the
  // payload: totalCirculations, activeBorrowers, distinctTitles,
  // returnRate, activeLoans, overdueCount — nothing else reaches the JSON.
  summaryMetrics: [
    'totalCirculations',
    'activeBorrowers',
    'distinctTitles',
    'returnRate',
    'activeLoans',
    'overdueCount',
  ],

  emptyState: {
    title: 'No library data yet',
    fallbackReason: 'No circulation records have been logged for this institute-year.',
  },
});
