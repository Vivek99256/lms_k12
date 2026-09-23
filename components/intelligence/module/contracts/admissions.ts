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
 * Admissions & Enrollment Intelligence.
 * Evaluates candidate intake volume, funnel progression, conversion yield, and stage drop-offs.
 */
export const admissionsIntelligenceContract = defineContract({
  key: 'admissions',
  label: 'Admissions & Enrollment Intelligence',
  accent: '#8B5CF6', // Purple / Violet
  grain: 'one candidate’s progress through admission — interview, confirmation and fee',
  nouns: { singular: 'admission candidate', plural: 'admission candidates' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/admissions/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('admissions'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Intake pipeline & conversion position',
        description:
          'What is happening — total candidate applications, confirmed admissions, conversion yield, and pending review backlog.',
      },
      breakdowns: {
        title: 'Where applicants sit in the funnel',
        description:
          'Applicant progression across registration, interview assessment, confirmation, and grade-level demand.',
      },
      findings: {
        description:
          'Empirical signals: funnel conversion yield benchmarks, evaluation backlogs, and intake velocity.',
      },
      priorities: {
        description:
          'Applicant interview scheduling actions and parent conversion outreach campaigns.',
      },
      dataQuality: {
        title: 'Application ledger health',
        description:
          'Audit checks on parent phone contact completeness and sequential enquiry identifier tracking.',
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
    'registrations',
    'conversionRate',
    'undecided',
    'paymentRate',
    'confirmedUnpaid',
    'medianDaysToConfirm',
  ],

  emptyState: {
    title: 'No admission applications found',
    fallbackReason:
      'No candidate inquiries or admission registration records were found for this institute in the selected academic year.',
  },
});

