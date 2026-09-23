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
 * Evaluates book circulations, reading participation, title demand, and overdue loan recovery.
 */
export const libraryIntelligenceContract = defineContract({
  key: 'library',
  label: 'Library Intelligence',
  accent: '#10B981', // Emerald
  grain: 'one book loan — the title, the borrower, the date it went out and the date it came back',
  nouns: { singular: 'book loan', plural: 'book loans' },

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
        title: 'Circulation & reading position',
        description:
          'What is happening — total circulation volume, active student readers, catalogue turnover, and loan return rates.',
      },
      breakdowns: {
        title: 'Where circulation sits',
        description:
          'High-demand book titles and loan transaction lifecycle states.',
      },
      findings: {
        description:
          'Empirical signals: high-demand book bottlenecks and overdue book retention volume.',
      },
      priorities: {
        description:
          'Overdue retrieval actions and stack replenishment recommendations.',
      },
      dataQuality: {
        title: 'Circulation ledger quality',
        description:
          'Audit checks on catalogue master mappings and dormant unreturned books.',
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
    'totalCirculations',
    'activeBorrowers',
    'distinctTitles',
    'returnRate',
    'activeLoans',
    'overdueCount',
  ],

  emptyState: {
    title: 'No library transactions for this academic year',
    fallbackReason:
      'No book circulation records have been recorded for the academic year selected in the header.',
  },
});

