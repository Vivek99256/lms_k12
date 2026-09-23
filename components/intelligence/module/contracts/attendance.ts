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
 * Every rate is days present over working days, summed across the terms a
 * student has a row for. The stored percentage column is not read: it disagrees
 * with the days on thousands of rows, and the record checks say so rather than
 * the screen quietly preferring one of them.
 */
export const attendanceIntelligenceContract = defineContract({
  key: 'attendance',
  label: 'Attendance Intelligence',
  accent: '#0284C7',
  grain: 'one student’s attendance in one term — days present against the term’s working days',
  nouns: { singular: 'attendance record', plural: 'attendance records' },

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
          'What is true right now. Read the roll-covered figure first: every rate here is computed over the students who have an attendance row, and that is not always the whole school.',
      },
      breakdowns: {
        title: 'Where attendance sits',
        description:
          'The same students sliced by class, by the attendance bands the boards use, and by term — which is the finest trend the register’s grain supports.',
      },
      findings: {
        description:
          'One finding per class that attends materially less than the institute, plus what the register itself is missing. Classes below the cohort floor appear in the table but are never compared.',
      },
      priorities: {
        description:
          'The attendance risks worth acting on first, with the next step each one implies.',
      },
      dataQuality: {
        title: 'Attendance register checks',
        description:
          'Exact counts against this year’s rows: students missing from the register entirely, rows with no days present or no working days, and rows whose stored percentage disagrees with their own days.',
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

  summaryMetrics: ['attendanceRate', 'students', 'rollCoverage', 'medianRate', 'chronicAbsence', 'severeAbsence'],

  emptyState: {
    title: 'No attendance has been entered for this academic year',
    fallbackReason:
      'No student attendance has been recorded for the year selected in the header.',
  },
});

