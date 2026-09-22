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
 * Homework & Assignment Intelligence.
 *
 * ── THE GRAIN MATTERS HERE ──────────────────────────────────────────────────
 *
 * One row of `homework` is ONE PIECE OF WORK SET FOR ONE CHILD, not one piece
 * set for a class. A teacher who sets one assignment for forty children writes
 * forty rows, so every count on this screen is a count of child-assignments and
 * the cards say so.
 *
 * ── WHAT THIS SCREEN WILL NOT CLAIM ─────────────────────────────────────────
 *
 * It reports a SUBMISSION rate and never a completion rate. `completion_status`
 * holds 'Y' exactly when a submission date is set, and no row in this database
 * carries a teacher review — so nothing here says whether the work was any good,
 * only whether it came back. Where the status and the date contradict each other
 * the rate is marked unreliable and the findings built on it stand down.
 */
export const homeworkIntelligenceContract = defineContract({
  key: 'homework',
  label: 'Homework & Assignment Intelligence',
  accent: '#F59E0B', // Amber / Orange
  grain: 'one piece of work set for one child — a teacher setting one assignment for forty children writes forty rows',
  nouns: { singular: 'piece of homework', plural: 'pieces of homework' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/homework/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('homework'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Homework position',
        description:
          'How much work was set, for how many children, and how much of it came back. A figure shown as a dash is one this institute’s records cannot support — never a zero, which would read as a claim that the work was not done.',
      },
      breakdowns: {
        title: 'Where the work sits',
        description:
          'Homework across subjects, across classes, and across the months it was set. A class here is a standard and its section, as it is everywhere else in this system.',
      },
      findings: {
        description:
          'What the register shows, each with the figures it rests on. Where the submission status contradicts the submission dates, the findings built on it stand down and the contradiction is reported instead.',
      },
      priorities: {
        description:
          'Adoption, the records that contradict each other, and the work children handed in that nobody has looked at.',
      },
      dataQuality: {
        title: 'Homework ledger health',
        description:
          'What is missing, contradictory or unusable in the homework records — including whether the submission status and the submission dates agree, which decides whether any rate on this screen can be believed.',
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
    'childAssignments',
    'submissionRate',
    'outstanding',
    'reviewRate',
    'classReach',
    'subjects',
  ],

  emptyState: {
    title: 'No homework records found',
    fallbackReason:
      'No homework assignments or submission records were found for this institute in the selected academic year.',
  },
});

