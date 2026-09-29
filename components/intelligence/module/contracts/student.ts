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
 * Reads the roll from `tblstudent_enrollment`, `tblstudent`, `standard`,
 * `division` and `student_quota`. A class is a STANDARD AND A SECTION
 * together, never either one alone — dividing the roll by sections alone is
 * what produced an average class of 390 at the largest institute in this
 * database. Five rules cover class size, section balance, composition,
 * retention against last year, and students with no standard or section.
 *
 * `tblstudent` carries religion, caste, sub-caste, blood group and Aadhaar.
 * None of it is read or aggregated here, by design — a screen any
 * office-holder can open should not be the place a caste breakdown of the
 * roll becomes available, and no finding in this module needs one to be true.
 */
export const studentIntelligenceContract = defineContract({
  key: 'student',
  label: 'Student Intelligence',
  accent: '#DB2777',
  grain: 'one enrolled student’s place in one standard and section, for one academic year',
  nouns: { singular: 'student', plural: 'students' },

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
        title: 'Student position',
        description:
          'Enrolment, class size and retention read live from this year’s roll. A class is the standard-and-section pair, not either one alone. Religion, caste, sub-caste and Aadhaar are deliberately not read here and never appear on this screen.',
      },
      breakdowns: {
        title: 'Where the roll sits',
        description:
          'The same students sliced by class, by standard, by admission year and by admission quota — the finest structure the enrolment table supports without touching the fields this module does not read.',
      },
      findings: {
        description:
          'One finding per class or standard that is crowded, thinly populated, skewed in composition, or short of the retention the institute saw last year, plus students carrying no standard or section at all — each with the figures it rests on.',
      },
      priorities: {
        description:
          'The class-structure risks worth acting on first — crowded classes, unbalanced sections, and unplaced students — with the next step each one implies.',
      },
      dataQuality: {
        title: 'Roll checks',
        description:
          'Exact counts against this year’s enrolment rows: enrolments with no matching student record, students enrolled more than once, students with no standard or section, and quotas the quota master cannot name. Religion, caste and Aadhaar are excluded from every check by design, not by omission.',
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
  // rest. maleShare is dropped as femaleShare's complement, and newThisYear
  // is dropped because its figure already appears in retentionRate's hint.
  // Matched against the Metric keys BrainStudentIntelligenceController::position()
  // actually serves: 'students', 'classes', 'medianClassSize',
  // 'crowdedClasses', 'retentionRate', 'femaleShare', 'maleShare' and
  // 'newThisYear' — nothing else is forwarded as a Metric object.
  summaryMetrics: [
    'students',
    'classes',
    'medianClassSize',
    'crowdedClasses',
    'retentionRate',
    'femaleShare',
  ],

  emptyState: {
    title: 'No student data yet',
    fallbackReason: 'No enrolled students have been recorded for this institute-year.',
  },
});
