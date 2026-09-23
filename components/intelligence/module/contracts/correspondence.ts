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
 * Inward & Outward Correspondence Intelligence.
 *
 * ── THE ASYMMETRY IS THE POINT ──────────────────────────────────────────────
 *
 * Measured across this database, the two registers are not used the same way at
 * all: one institute holds 1,830 inward entries for a single year and NONE
 * outward, and the other holds 242 inward against 12. A correspondence register
 * exists to answer whether what arrived was ever answered, and half a register
 * cannot answer it. That is the first finding on this screen at every institute
 * in this database.
 *
 * ── WHAT THE PROFILER CORRECTED ─────────────────────────────────────────────
 *
 * An earlier reading of this data counted distinct `inward_number` values across
 * the whole table and called the difference 409 duplicate numbers. IT WAS WRONG:
 * inward numbering restarts each academic year, which is how a register is meant
 * to work, and counted within a year the real figure at that institute is five.
 * Duplicates are counted per (year, number), which is the grain the office
 * actually issues them at, and the record check says so on its face.
 *
 * ── TWO DIFFERENT WAYS TO LOSE THE PAPER ────────────────────────────────────
 *
 * An entry naming a file location the master no longer holds, and an entry
 * naming no location at all, are reported as SEPARATE findings because they
 * have separate fixes — one is repaired in the master, the other at the desk.
 * Counting them together would have hidden the larger: at one institute 923 of
 * 1,361 entries in a single year carry no location, against zero broken
 * references.
 *
 * ── WHAT THIS SCREEN NEVER SHOWS ────────────────────────────────────────────
 *
 * What any letter actually said. `title` and `description` are free text —
 * 4,476 distinct descriptions across one institute's rows — and a
 * correspondence register holds legal notices, staff disciplinary matters and
 * letters about individual children. Nothing here reads, groups by or quotes
 * either column, and `attachment` is read only as present-or-absent, never by
 * filename.
 */
export const correspondenceIntelligenceContract = defineContract({
  key: 'correspondence',
  label: 'Inward & Outward Intelligence',
  accent: '#B45309', // Amber-700 — a records-office accent, distinct from the academic modules
  grain: 'one piece of post or one document arriving at, or leaving, the institute on one day',
  nouns: { singular: 'entry', plural: 'entries' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/correspondence/intelligence')),

  actions: {
    run: () => runModuleIntelligence('correspondence'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith({
    position: {
      title: 'Correspondence position',
      description:
        'What was logged in, what was logged out, how much of it is scanned, and how much of it records where the paper actually went. Numbers are counted within this academic year, because inward numbering restarts each year by design.',
    },
    breakdowns: {
      title: 'Where correspondence comes from',
      description:
        'The senders this institute logs most, and the shape of the year. What each letter said is deliberately not read — the title and description columns are free text, and this register holds matters about named staff and children.',
    },
    findings: {
      description:
        'What the registers show and where they stop being able to answer for a document. The structural checks run whether or not the year holds enough letters to describe the office.',
    },
    priorities: {
      description:
        'The entries whose paper cannot be located, and the half of the register that is not being kept.',
    },
    dataQuality: {
      title: 'Register health',
      description:
        'Whether both directions are logged, whether each entry says where its paper went, whether its number is unique within the year, and whether a copy was kept.',
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
  }),

  summaryMetrics: ['inward', 'outward', 'outwardShare', 'attachmentShare', 'fileLocationsUsed', 'duplicateNumbers'],

  emptyState: {
    title: 'No correspondence logged for this academic year',
    fallbackReason:
      'This institute has not logged inward or outward correspondence for the year selected in the header, or fewer than 20 entries exist for it.',
  },
});
