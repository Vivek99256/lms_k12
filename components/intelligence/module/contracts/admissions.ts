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
 * Admissions Intelligence.
 *
 * Reads `admission_registration_v1` and `new_admission_inquiry_registration`,
 * scoped by the institute's own term dates rather than the calendar year — the
 * calendar filter this module used to apply put 114 of 678 candidates in the
 * wrong year. Funnel stages nest (each is a subset of the one above it), and
 * confirmation codes are shown verbatim with the grouping the LMS admission
 * module itself applies, not a grouping invented here. The inquiry table's
 * health, caste and identity columns are deliberately not read — the only
 * field this module takes from it besides the row count is the standard
 * applied for.
 *
 * Five rules feed this module's findings. It is registered at ladder L5, but
 * the L5 loop itself is not wired for admissions yet, so the decisions and
 * learning sections below should be expected to show nothing rather than a
 * fault.
 */
export const admissionsIntelligenceContract = defineContract({
  key: 'admissions',
  label: 'Admissions Intelligence',
  accent: '#C026D3',
  grain: 'one admission candidate',
  nouns: { singular: 'candidate', plural: 'candidates' },

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
        title: 'Admissions position',
        description:
          'Registrations counted inside this academic year’s own term dates, not the calendar year, with how many were confirmed, how many are recorded as not proceeding, and how many still carry no outcome either way.',
      },
      breakdowns: {
        title: 'Where admissions sit',
        description:
          'The funnel, where each stage is a subset of the one above it; the institute’s own confirmation codes, verbatim, with the grouping the LMS admission module itself applies; and inquiry demand by standard — the only field this module reads from the inquiry table besides its row count.',
      },
      findings: {
        description:
          'What the registration and inquiry records show against this year’s five admissions rules, each with the figures it rests on — confirmed candidates with no fee recorded, stalled outcomes, and gaps in the funnel itself.',
      },
      priorities: {
        description:
          'The admissions risks worth acting on first — seats held without payment, candidates stuck with no outcome, and funnel stages losing more candidates than expected — with the next step each one implies.',
      },
      dataQuality: {
        title: 'Admission record checks',
        description:
          'Exact counts against this year’s own registration and inquiry rows: confirmed candidates with no fee recorded, registrations with no outcome recorded, and other gaps in the funnel data itself.',
      },
      recommendations: {
        description:
          'Each recommendation names the finding it answers and the cause the engine was authorised to state. A recommendation whose rule has no approved cause carries no explanation rather than a composed one. Approving one records a decision against your name; it does not execute anything on its own.',
      },
      decisions: {
        description:
          'What was decided, what was queued, and what it actually achieved. Admissions is registered at ladder L5, but the loop itself is not wired for this module yet, so an empty ledger here is the expected state, not a missing feature.',
      },
      learning: {
        description:
          'What earlier decisions in this module actually achieved, carried forward so the next one is better informed. With the L5 loop not yet wired for admissions, this will typically have nothing to show.',
      },
    },
  ),

  // Capped at six — the summary strip takes the first six and drops the
  // rest. Matched against the Metric keys
  // BrainAdmissionsIntelligenceController::position() actually serves:
  // registrations, conversionRate, undecided, paymentRate, confirmedUnpaid,
  // notProceeding, medianDaysToConfirm, inquiries are the eight forwarded as
  // Metric objects. paymentRate and notProceeding are dropped here —
  // paymentRate is the percent-form complement of confirmedUnpaid, and
  // notProceeding is a settled outcome rather than something to act on.
  summaryMetrics: [
    'registrations',
    'conversionRate',
    'undecided',
    'confirmedUnpaid',
    'medianDaysToConfirm',
    'inquiries',
  ],

  emptyState: {
    title: 'No admissions data yet',
    fallbackReason:
      'No admission registrations or inquiries have been recorded for this institute-year.',
  },
});
