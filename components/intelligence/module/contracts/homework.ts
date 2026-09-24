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
 * Reads the child-homework register — one row per child against one piece of
 * homework set, not one row per assignment — alongside subject and standard,
 * plus a second, separate `lms_assignment` table with its own two-sided
 * submit/return workflow. The two are counted side by side and never summed:
 * mixing them would double-count a child who appears in both.
 *
 * ── WHY THIS IS `partial`, NOT `live` ────────────────────────────────────────
 *
 * `submissionRate` reads a status flag the student or teacher sets, never a
 * teacher's judgement of the work, and that flag can openly disagree with
 * whether a submission date was actually recorded — when it does, the rate is
 * marked unreliable rather than shown as if it were trustworthy. And no row in
 * this database carries a reviewer, feedback or a remark, so `reviewRate`
 * measures whether work was looked at, never whether it was any good.
 */
export const homeworkIntelligenceContract = defineContract({
  key: 'homework',
  label: 'Homework & Assignment Intelligence',
  accent: '#F97316',
  grain: 'one child’s row against one piece of homework set — the table writes one row per child, not one per assignment',
  nouns: { singular: 'assignment', plural: 'assignments' },

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
          'What is set and returned right now, read live from this year’s child-homework rows. Submission is a status flag, not a teacher’s judgement of the work — where that flag disagrees with whether a submission date was recorded, the rate is marked unreliable rather than shown as if it were clean.',
      },
      breakdowns: {
        title: 'Where homework sits',
        description:
          'The same set-and-returned figures sliced by subject, by class, and by the month it was set, so a term’s habit is distinguishable from a single week’s burst. Rows below the reporting floor keep their counts but drop the rate, which would otherwise describe too few children to mean anything.',
      },
      findings: {
        description:
          'What the child-homework rows show at the subject, class and month level — concentrations of low completion, growing pending burdens, and review lag — each with the figures it rests on. No finding claims a quality judgement this data cannot support.',
      },
      priorities: {
        description:
          'The homework risks worth acting on first — pending burdens concentrated in specific classes or subjects, and submitted work still waiting on a teacher — with the next step each one implies.',
      },
      dataQuality: {
        title: 'Homework record checks',
        description:
          'Exact counts against this year’s rows: submission-status contradictions, homework with no subject or class link, and the coverage this module can and cannot see.',
      },
      recommendations: {
        description:
          'Each recommendation names the finding it answers and the cause the engine was authorised to state. A recommendation whose rule has no approved cause carries no explanation rather than a composed one. Approving one records a decision against your name; it does not execute anything on its own.',
      },
    },
  ),

  // Capped at six — the summary strip takes the first six and drops the
  // rest. Matched against the Metric keys BrainHomeworkIntelligenceController::
  // position() actually serves: 'childAssignments', 'submissionRate',
  // 'outstanding', 'reviewRate', 'classReach', 'subjects', 'assignments'.
  // 'assignments' is dropped here — it counts the separate lms_assignment
  // table and belongs next to its own explanatory hint in Position, not
  // promoted into a strip where it would read as part of the same count.
  summaryMetrics: [
    'childAssignments',
    'submissionRate',
    'outstanding',
    'reviewRate',
    'classReach',
    'subjects',
  ],

  emptyState: {
    title: 'No homework data yet',
    fallbackReason: 'No homework assignments have been recorded for this institute-year.',
  },
});
