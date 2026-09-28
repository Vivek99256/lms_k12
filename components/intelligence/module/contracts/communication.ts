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
 * Communication & Engagement Intelligence.
 *
 * Reads `parent_communication` (parent-raised inquiries and replies) and
 * `sms_sent_parents` (outbound SMS/WhatsApp notification logs) — two message
 * ledgers, not one. `parent_communication.title` is not a topic: it is a
 * free-text subject line a parent types (2,495 distinct values across 4,873
 * rows, including at least one naming a child's illness), and nothing here
 * reads it. Inquiries are sliced by class and by month instead; evidence is
 * aggregate counts only, and no message text leaves the database. Five rules
 * are registered for this module; the L5 outcome-recording loop is not wired
 * for it yet.
 */
export const communicationIntelligenceContract = defineContract({
  key: 'communication',
  label: 'Communication & Engagement Intelligence',
  accent: '#9333EA',
  grain: 'one parent communication or inquiry',
  nouns: { singular: 'inquiry', plural: 'inquiries' },

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
        title: 'Communication position',
        description:
          'Total multi-channel volume — parent inquiries, outbound SMS and WhatsApp — read live from `parent_communication` and `sms_sent_parents`, with how many inquiries were answered and how many are still waiting. No message or subject text is read to produce these figures; every number is a count.',
      },
      breakdowns: {
        title: 'Where communication sits',
        description:
          'Parent inquiries sliced by class and by month, and outbound SMS sliced by the module that triggered it — the finest structure these two logs support. Never sliced by subject line: that field is free text a parent wrote, not a category.',
      },
      findings: {
        description:
          'What the inquiry and notification logs show — unanswered inquiries, slow reply turnaround, and notification dispatch gaps — each with the class, month or channel counts it rests on. No finding quotes or paraphrases message content.',
      },
      priorities: {
        description:
          'The engagement risks worth acting on first — inquiries sitting unanswered and classes or months without an established reply SLA — with the next step each one implies.',
      },
      dataQuality: {
        title: 'Communication log checks',
        description:
          'Exact counts against this year’s rows: inquiries with no linked student, replies logged with no timestamp, and SMS rows missing a recipient number. A data-quality check, like every other figure on this screen, reads counts only — free-text subject and message content is never read or surfaced here.',
      },
      recommendations: {
        description:
          'Each recommendation names the finding it answers and the cause the engine was authorised to state. A recommendation whose rule has no approved cause carries no explanation rather than a composed one. Approving one records a decision against your name; it does not execute anything on its own.',
      },
    },
  ),

  // Capped at six — the summary strip takes the first six and drops the
  // rest. repliedInquiries is left out: it is the complement of
  // unrepliedInquiries against totalInquiries, and responseRate already
  // carries that as a rate. Matched against the Metric objects
  // BrainCommunicationIntelligenceController::position() actually forwards.
  summaryMetrics: [
    'totalCommunications',
    'totalInquiries',
    'responseRate',
    'unrepliedInquiries',
    'totalSmsSent',
    'totalWhatsAppSent',
  ],

  emptyState: {
    title: 'No communication data yet',
    fallbackReason: 'No parent communication records have been logged for this institute-year.',
  },
});
