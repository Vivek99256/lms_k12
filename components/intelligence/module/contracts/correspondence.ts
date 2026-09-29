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
 * Inward & Outward (Correspondence) Intelligence.
 *
 * Reads the institute's inward and outward letter registers — `inward`,
 * `outward`, `place_master` and `physical_file_location` — year-scoped
 * natively by the register's own syear.
 *
 * The finding at every institute in this database is the ASYMMETRY: letters
 * are logged in, almost nothing is ever logged out. Duplicate inward numbers
 * are counted WITHIN the academic year — numbering restarts each year by
 * design, so counting across years overstates collisions many times over.
 *
 * What a letter said is never read: `title` and `description` are free text,
 * and this register holds matters about named staff and children. Nothing
 * here quotes them.
 */
export const correspondenceIntelligenceContract = defineContract({
  key: 'correspondence',
  label: 'Inward & Outward Intelligence',
  accent: '#1D4ED8',
  grain: 'one inward or outward letter',
  nouns: { singular: 'letter', plural: 'letters' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/correspondence/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('correspondence'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Correspondence position',
        description:
          'Inward and outward counts read live from this year’s register, with the share of inward entries holding a scan and the file locations actually in use. A figure shown as a dash means the register does not cover this — never a zero.',
      },
      breakdowns: {
        title: 'Where correspondence sits',
        description:
          'The same year’s entries sliced by the sender this institute logs most against its own place master, and by month — the finest grain `place_master` and the dated rows support. What a letter said is deliberately left out: title and description are free text, and this register names staff and children.',
      },
      findings: {
        description:
          'What the inward and outward registers show, each with the figures it rests on — including the asymmetry between what is logged in and what is ever logged out, and inward numbers issued twice within the same academic year. Numbering restarts each year by design, so a duplicate is only ever counted within one year, never across them.',
      },
      priorities: {
        description:
          'The correspondence risks worth acting on first — nothing logged outward, file locations named on an entry but not on file, numbers issued twice — with the next step each one implies.',
      },
      dataQuality: {
        title: 'Register checks',
        description:
          'Exact counts against this year’s rows: inward entries with no scan attached, entries naming a file location this institute’s master does not hold, and inward numbers repeated within the year.',
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
  // rest, so placesUsed stays in the by-sender breakdown instead, which
  // already covers senders in more detail than a single summary tile could.
  // Matched against the Metric keys
  // BrainCorrespondenceIntelligenceController::position() actually serves —
  // 'inward', 'outward', 'outwardShare', 'attachmentShare', 'placesUsed',
  // 'fileLocationsUsed' and 'duplicateNumbers' are the full set; every other
  // name is internal to CorrespondenceIntelligence and never forwarded.
  summaryMetrics: [
    'inward',
    'outward',
    'outwardShare',
    'attachmentShare',
    'fileLocationsUsed',
    'duplicateNumbers',
  ],

  emptyState: {
    title: 'No correspondence data yet',
    fallbackReason: 'No inward or outward register entries have been logged for this institute-year.',
  },
});
