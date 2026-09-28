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
 * LMS Intelligence — course/content catalogue coverage blended with real
 * homework engagement.
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT ─────────────────────────────────────────
 *
 * {@link teachLearnIntelligenceContract} answers "what is published" — the
 * curriculum content catalogue alone, and it deliberately never touches what a
 * learner did with any of it. {@link homeworkIntelligenceContract} answers
 * "what came back" — the homework register alone, keyed to one child at a
 * time. This module is the composed third question: whether the material a
 * teacher published is the material children were actually set to work from,
 * read by joining the two on the same (class, subject) pair, tenant- and
 * year-scoped on both sides. It is not a third copy of either module's own
 * figures — every catalogue figure and every submission figure here is read
 * straight from those two modules, and this screen adds only the blend.
 *
 * ── WHAT THIS SCREEN WILL NOT CLAIM ─────────────────────────────────────────
 *
 * There is no evaluation or grading signal anywhere in this data: 0 of 1,543
 * homework rows at the institute this was profiled against carry a teacher
 * review. Every figure here is about volume and timing — how much was
 * published, how much was set, how much came back, how long it took — never
 * about whether the work was any good. There is also no due date on homework,
 * only when it was set and when it was submitted, so turnaround is reported as
 * a median number of days rather than a fabricated on-time rate.
 *
 * ── A MEASURED ZERO IS NOT THE SAME AS NO DATA ──────────────────────────────
 *
 * Content/activity alignment can genuinely be 0% at an institute that runs a
 * large content library and a large homework register with no overlap between
 * them — that is a real finding. It reads very differently from an institute
 * with no catalogue or no homework at all, where the figure is null rather
 * than zero. The copy below, and the data-quality checks, are written to keep
 * that distinction visible rather than collapsing both into a blank chart.
 */
export const lmsActivityIntelligenceContract = defineContract({
  key: 'lms-activity',
  label: 'LMS Intelligence',
  accent: '#CA8A04', // Amber-600 — distinct from Teach/Learn's green and Homework's orange
  grain:
    'One snapshot blending course/content catalogue coverage with real homework submission activity — the catalogue side is one course, the activity side is one piece of work set for one child, read together on the class/subject pair both tables share.',
  nouns: { singular: 'course', plural: 'courses' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/lms-activity/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('lms-activity'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Learning activity position',
        description:
          'What has been published against the catalogue this year, and what children were actually set to do from it. The course count follows the standing catalogue — sub_std_map carries no academic year — while every content and homework figure is scoped to the year selected in the header. Nothing here measures whether the work was any good: no submission in this deployment carries a teacher review.',
      },
      breakdowns: {
        title: 'Where content and activity sit',
        description:
          'The same classes read from both sides of the blend: catalogue courses, the content published against them, and the homework actually set. A class with courses but no material, material but no homework, or homework with no catalogue course behind it at all is shown as its own row rather than folded into one number.',
      },
      findings: {
        description:
          'What the catalogue and the homework register show together — the one thing neither screen can say alone, because a published course looks identical whether or not any homework was ever set against it. Each finding states what happened, why it matters, and the figures it rests on. None of them scores or grades the work; they speak only to whether material was published and whether it was actually used.',
      },
      priorities: {
        description:
          'The courses carrying published material with nothing set against it, the homework set outside what the catalogue currently offers, and the classes furthest from being reached at all.',
      },
      dataQuality: {
        title: 'Catalogue/activity alignment checks',
        description:
          'Checks on the join between the two halves: courses carrying published content with no homework set against them this year, and homework set for a class/subject pair the catalogue does not currently offer. A 0% content/activity alignment is reported only once enough content-bearing courses exist for a share to describe the institute rather than a handful of courses — below that floor, or where one whole half of the blend is missing, the figure is left blank rather than shown as a false zero.',
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

  // Trimmed to the keys BrainLmsActivityIntelligenceController::position()
  // actually emits as Metric entries (courses/coursesWithContent/reviewRate/
  // coursesWithActivity are computed internally but never forwarded as
  // Metric objects, so they would silently render nothing) — and capped at
  // six, the summary strip's practical maximum.
  summaryMetrics: [
    'contentCoverage',
    'contentActivityAlignment',
    'submissionRate',
    'medianSubmissionLagDays',
    'contentWithoutActivity',
    'classReach',
  ],

  emptyState: {
    title: 'No learning activity data yet',
    fallbackReason:
      'Neither the content catalogue nor homework activity is available for this institute in the year selected in the header. Either published course content or recorded homework activity is enough to populate this screen — it does not require both.',
  },
});
