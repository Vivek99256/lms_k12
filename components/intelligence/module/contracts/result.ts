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
 * Result Intelligence.
 *
 * Reads exam marks off `result_personalize_marks` (1.3M rows), not
 * `result_marks` (12 rows) — the figures below reconcile against that table
 * exactly: 244 students, 17 subjects, 10,123 mark entries, a 74.6%
 * mark-weighted mean, all re-derived from the same table with the same
 * scope. "Exam components" counts exam NAMES (12), not the 594
 * per-class-per-subject instances behind them — that is what a principal
 * means by "exams", and it includes non-academic components such as
 * attendance and notebook marks recorded the same way papers are.
 */
export const resultIntelligenceContract = defineContract({
  key: 'result',
  label: 'Result Intelligence',
  accent: '#0284C7',
  grain: "one student's result in one exam",
  nouns: { singular: 'result', plural: 'results' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/result/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('result'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Academic position',
        description:
          'The school average and cohort spread, mark-weighted across every subject and read live from result_personalize_marks at page load — not a stored summary column.',
      },
      breakdowns: {
        title: 'Where the results sit',
        description:
          'The same mark-weighted averages sliced by class, by subject, and by exam component, which is the finest structure this table supports.',
      },
      findings: {
        description:
          'What the marks show at the school, class and subject level — cohorts below threshold, movement against last year, and gaps in the exam-name ledger — each with the figures it rests on.',
      },
      priorities: {
        description:
          'The academic risks worth acting on first — classes or subjects pulling the average down and cohorts sitting below the pass threshold — with the next step each one implies.',
      },
      dataQuality: {
        title: 'Mark register checks',
        description:
          'Exact counts against this year’s rows in result_personalize_marks, including exam-name spelling variants that the record ledger guards against.',
      },
      recommendations: {
        description:
          'Each recommendation names the finding it answers and the cause the engine was authorised to state. A recommendation whose rule has no approved cause carries no explanation rather than a composed one. Approving one records a decision against your name; it does not execute anything on its own.',
      },
    },
  ),

  // Capped at six — the summary strip takes the first six and drops the
  // rest. Matched against the Metric keys
  // BrainResultIntelligenceController::position() actually serves:
  // meanPercentage, students, subjects, classes, belowThreshold, median,
  // markEntries, exams. classes and exams are dropped from the strip (kept
  // in the Position section's full metrics list) in favour of the
  // threshold and spread figures.
  summaryMetrics: [
    'meanPercentage',
    'students',
    'belowThreshold',
    'median',
    'subjects',
    'markEntries',
  ],

  emptyState: {
    title: 'No result data yet',
    fallbackReason: 'No exam marks have been recorded for this institute-year.',
  },
});
