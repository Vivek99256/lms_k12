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
 * ── NO ADAPTER ──────────────────────────────────────────────────────────────
 *
 * Compare this file with `contracts/fees.ts`, which is 377 lines and most of
 * them are `adapt()`. Fees needed one because its endpoint predates the
 * canonical payload. `BrainResultIntelligenceController` emits
 * `ModuleIntelligencePayload` directly, so `load` is a bare `brainFetch` and
 * this whole contract is presentation.
 *
 * THAT IS THE POINT OF THE LAYER, and it is what every module after Fees looks
 * like: the backend owns the facts and their units, the contract owns the
 * words, and there is nothing in between to go wrong.
 *
 * ── WHAT THIS SCREEN SHOWS, AND WHAT IT HONESTLY DOES NOT ───────────────────
 *
 * L0 coverage, L1 position, L2 distribution and L3 findings-with-evidence are
 * live and read from this institute's own mark rows.
 *
 * L5 — recommendations, decisions, outcomes and learning — is NOT wired, because
 * Result rules are not yet registered in Laravel's `IntelligencePipeline`. Those
 * sections are therefore OMITTED from this contract rather than rendered empty:
 * an empty "What to consider doing" implies the engine considered and found
 * nothing, which is a different and untrue claim. When the rules are registered,
 * the three section keys go back into `sectionsWith` and nothing else changes.
 *
 * ── THE THRESHOLD IS NAMED EVERYWHERE ───────────────────────────────────────
 *
 * "Below 35%" is the backend's `ResultIntelligence::THRESHOLD`, and the metric
 * carries it in its own label. It is deliberately never called a pass rate: the
 * mark data does not record a pass mark, 35% is the common CBSE figure rather
 * than a universal one, and a school on a different scale must read a correctly
 * labelled number instead of a confidently wrong one.
 */
export const resultIntelligenceContract = defineContract({
  key: 'result',
  label: 'Result Intelligence',
  // Teal rather than the Fees indigo, so a reader who has both open can tell at
  // a glance which module they are in.
  accent: '#0F766E',
  grain: 'one student’s mark in one subject for one exam',
  nouns: { singular: 'mark entry', plural: 'mark records' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/result/intelligence')),

  // No `run`: result findings are computed per request rather than written to
  // the signal ledger, so the renderer hides the "Analyse this year" button
  // instead of offering an action that would recompute nothing.
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
          'What is happening — every figure is read from this year’s mark records at the moment you loaded the page. Averages are mark-weighted, so a class sitting more papers is not advantaged by it.',
      },
      breakdowns: {
        title: 'Where performance sits',
        description:
          'The same marks, sliced the ways a school is actually run: by class, by subject, and by exam component.',
      },
      findings: {
        description:
          'What the figures mean. Each finding names the threshold it fired on and carries the marks behind it — nothing appears here without figures to check it against.',
      },
      priorities: {
        description:
          'The findings worth acting on first, with the next step each one implies and who owns it.',
      },
      dataQuality: {
        title: 'Mark ledger quality',
        description:
          'Checks on the mark records themselves. These are data-entry problems, not academic results, and are kept apart from the findings above for that reason.',
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

  summaryMetrics: ['meanPercentage', 'students', 'subjects', 'classes', 'belowThreshold', 'median'],

  emptyState: {
    title: 'No results for this academic year',
    fallbackReason:
      'No marks have been entered for the year selected in the header. Marks are recorded per academic year, so a different year may hold data.',
  },
});
