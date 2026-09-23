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
 * Communication & Parent Engagement Intelligence.
 * Evaluates parent inquiries, response SLAs, outbound SMS broadcasts, and multi-channel reach.
 */
export const communicationIntelligenceContract = defineContract({
  key: 'communication',
  label: 'Communication & Engagement Intelligence',
  accent: '#06B6D4', // Cyan
  grain: 'one message — a parent inquiry with its reply, or one outbound SMS',
  nouns: { singular: 'communication log', plural: 'communication logs' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/communication/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('communication'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Communication & engagement position',
        description:
          'What is happening — total message volume, inquiry resolution rate, pending parent inquiries, and SMS broadcast volume.',
      },
      breakdowns: {
        title: 'Where communications flow',
        description:
          'Volume sliced by delivery channel (Parent Portal, SMS, WhatsApp), topic classification, and sending module.',
      },
      findings: {
        description:
          'Empirical signals: pending unanswered parent threads, inquiry topic spikes, and response lag.',
      },
      priorities: {
        description:
          'Urgent parent inquiry resolution queue and response turnaround SLA targets.',
      },
      dataQuality: {
        title: 'Communication log health',
        description:
          'Audit checks on parent query student linkage and SMS recipient phone number validity.',
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
    'totalInquiries',
    'responseRate',
    'unrepliedInquiries',
    'medianReplyHours',
    'totalSmsSent',
    'totalCommunications',
  ],

  emptyState: {
    title: 'No communication records logged',
    fallbackReason:
      'No parent portal inquiries, SMS dispatches, or WhatsApp logs were found for this institute in the selected academic year.',
  },
});

