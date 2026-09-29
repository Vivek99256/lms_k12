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
 * Attendance Intelligence.
 *
 * Reads the pupil attendance register — `result_student_attendance_master`,
 * `result_working_day_master` and `tblstudent_enrollment` — not the staff
 * punch register Staff Attendance Intelligence reads. Rates are computed from
 * days present over working days, summed across terms, and never from the
 * register's own stored percentage column, which disagrees with the days on
 * thousands of rows. A year where fewer than half the rows carry a days-present
 * figure reports unavailable with the counts behind that, rather than a rate
 * computed over whoever happened to be filled in.
 */
export const attendanceIntelligenceContract = defineContract({
  key: 'attendance',
  label: 'Attendance Intelligence',
  accent: '#059669',
  grain: 'one student’s attendance for one working day',
  nouns: { singular: 'student', plural: 'students' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/attendance/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('attendance'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Attendance position',
        description:
          'Days present over working days, summed across terms — never the register’s own stored percentage, which disagrees with the days on thousands of rows. Roll coverage shows as a dash rather than a rate wherever there is no roll to divide by.',
      },
      breakdowns: {
        title: 'Where attendance sits',
        description:
          'The same rate sliced by class, by attendance band, and by term — the finest trend the register supports, since it carries a term rather than a date.',
      },
      findings: {
        description:
          'What the register shows at the institute and class level — chronic and severe absence against the board’s own 75% and 65% lines, and classes and terms the figures cannot yet cover, each with the days and student counts it rests on.',
      },
      priorities: {
        description:
          'The attendance risks worth acting on first — concentrations of chronic or severe absence, and roll or register gaps that leave a class’s figure short of the roll it should cover — with the next step each one implies.',
      },
      dataQuality: {
        title: 'Attendance register checks',
        description:
          'Exact counts against this year’s rows: enrolled students with no attendance row, classes and terms with too little recorded to trust, and the share of rows a days-present figure actually covers.',
      },
      recommendations: {
        description:
          'Each recommendation names the finding it answers and the cause the engine was authorised to state. A recommendation whose rule has no approved cause carries no explanation rather than a composed one. Approving one records a decision against your name; it does not execute anything on its own.',
      },
    },
  ),

  // Capped at six — the summary strip takes the first six and drops the
  // rest, so standards/terms stay in Position instead.
  // Matched against the Metric keys BrainAttendanceIntelligenceController::position()
  // actually serves: attendanceRate, students, rollCoverage, medianRate,
  // chronicAbsence and severeAbsence are all forwarded as Metric objects;
  // standards and terms are the two left out of the strip.
  summaryMetrics: [
    'attendanceRate',
    'students',
    'rollCoverage',
    'medianRate',
    'chronicAbsence',
    'severeAbsence',
  ],

  emptyState: {
    title: 'No attendance data yet',
    fallbackReason: 'No attendance records have been recorded for this institute-year.',
  },
});
