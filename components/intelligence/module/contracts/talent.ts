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
 * Talent Management Intelligence.
 *
 * One screen over the whole employee lifecycle — postings and applications,
 * onboarding journeys, internal mobility requests, offboarding cases and
 * performance reviews. The grain changes section to section (a posting, a
 * journey, a review), which is why the copy below speaks in cases and stages
 * rather than promising one uniform row.
 */
export const talentIntelligenceContract = defineContract({
  key: 'talent',
  label: 'Talent Management Intelligence',
  accent: '#2563EB',
  grain:
    'One snapshot of the hiring pipeline, onboarding, mobility, offboarding and performance-review activity.',
  nouns: { singular: 'talent record', plural: 'talent records' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/talent/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('talent'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Talent position',
        description:
          'What is true right now across the pipeline: postings open, applications received, offers sent, and how much onboarding, mobility and offboarding work is currently active.',
      },
      breakdowns: {
        title: 'Where talent activity sits',
        description:
          'The hiring funnel from posting to offer, and case volume across onboarding, mobility and offboarding — the slices this module is actually run against.',
      },
      findings: {
        description:
          'What the pipeline and case registers show, each with the figures it rests on — a funnel stage that is leaking candidates, a case type that has stalled, or a review cycle that has not moved.',
      },
      priorities: {
        description:
          'The hiring, onboarding, mobility, offboarding or review risks worth acting on first, with the next step each one implies.',
      },
      dataQuality: {
        title: 'Talent record checks',
        description:
          'Exact counts against this year’s rows: postings with no applications, cases with no owner, and — the one worth reading plainly — how much of the performance-review workload is still sitting untouched. A tenant with 238 reviews logged and 98.7% of them still pending is not a rounding error; it is a stalled cycle, and the checks say so rather than averaging it away.',
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

  // Capped at six — the summary strip takes the first six and drops the
  // rest, so one headline metric per lifecycle stage (hiring, onboarding,
  // mobility, offboarding, review) plus the review backlog share.
  // Matched against the Metric keys BrainTalentIntelligenceController::position()
  // actually serves — 'postings' and 'pendingReviewShare' are computed
  // internally but never forwarded as Metric objects, so they were swapped
  // for 'openPostings' and 'applications'.
  summaryMetrics: [
    'openPostings',
    'applications',
    'activeOnboardingJourneys',
    'activeMobilityRequests',
    'activeOffboardingCases',
    'pendingPerformanceReviews',
  ],

  emptyState: {
    title: 'No talent data yet',
    fallbackReason:
      'No recruitment, onboarding, mobility, offboarding or performance-review activity has been recorded for this institute.',
  },
});
