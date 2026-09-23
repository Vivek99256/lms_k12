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
 * Student Intelligence.
 *
 * The roll, the classes it is divided into, and how much of it came back from
 * last year. A CLASS HERE IS A STANDARD AND A SECTION TOGETHER — the room a
 * child actually sits in — which is why the median class holds 44 students and
 * not the 390 an earlier version reported by dividing the roll by sections.
 *
 * Religion, caste and Aadhaar are deliberately not read. A screen any
 * office-holder can open should not be where a caste breakdown of the roll
 * becomes available, and no finding here needs one to be true.
 */
export const studentIntelligenceContract = defineContract({
  key: 'student',
  label: 'Student Intelligence',
  accent: '#6366F1', // Indigo
  grain: 'one student’s place in one year — their standard, section, quota and house',
  nouns: { singular: 'enrolled student', plural: 'enrolled students' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/student/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('student'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Enrolment position',
        description:
          'The roll, how it divides into classes, and how much of last year’s roll returned. Class figures use the median rather than the mean: one standard held open for a handful of students drags a mean below every room a child sits in.',
      },
      breakdowns: {
        title: 'Where students sit',
        description:
          'The same students by class, by standard, by the year they were admitted, and by admission quota.',
      },
      findings: {
        description:
          'One finding per pattern. Class size is compared against the institute’s own median, and composition against the institute’s own split — never against an assumed norm.',
      },
      priorities: {
        description:
          'The placement and retention issues worth acting on first, with the next step each one implies.',
      },
      dataQuality: {
        title: 'Enrolment record checks',
        description:
          'Exact counts against this year’s roll: students with no class, no student record, no gender or no date of birth, and quotas missing from the quota master.',
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

  summaryMetrics: ['students', 'classes', 'medianClassSize', 'crowdedClasses', 'retentionRate', 'newThisYear'],

  emptyState: {
    title: 'No students are enrolled for this academic year',
    fallbackReason:
      'No student enrolment records were found for the academic year selected in the header.',
  },
});
