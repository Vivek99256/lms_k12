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
 * Academic Intelligence.
 *
 * Reads the live timetable master against `timetable`, `subject`, `standard`
 * and `tbluser` — not a snapshot, a read of the schedule as it stands right
 * now. A teacher's week is their DISTINCT (weekday, period) slots in one
 * marking period, not their timetable row count: a teacher who repeats the
 * same slot across several marking periods appears in one row per period,
 * and counting rows overstates the week the teacher actually works.
 *
 * ── WHAT THIS SCREEN WILL NOT SHOW ──────────────────────────────────────────
 *
 * No named-teacher list of who is double-booked — only counts of slots and
 * of the teachers or class-divisions they affect. And the recommendation →
 * decision → outcome loop is not yet wired for this module, so Recommendations
 * and Decisions can legitimately stay empty even when Findings has raised
 * something; that is the loop's current state, not a data gap.
 */
export const academicIntelligenceContract = defineContract({
  key: 'academic',
  label: 'Academic Intelligence',
  accent: '#0891B2',
  grain: 'one teacher’s distinct weekday-period slot in one marking period',
  nouns: { singular: 'teacher', plural: 'teachers' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/academic/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('academic'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Academic scheduling position',
        description:
          'What the live timetable master shows right now: rows, standards, subjects and teaching faculty, plus each teacher’s week measured as distinct weekday-period slots in one marking period — not the row count, which repeats a slot once per marking period and overstates the week.',
      },
      breakdowns: {
        title: 'Where the timetable sits',
        description:
          'The same timetable read by subject, and by teacher week — distinct periods a week, not rows — which is the finest grain `timetable` supports.',
      },
      findings: {
        description:
          'What the timetable shows at the class and teacher level: slots that place one teacher in two classrooms at the same time, slots that double-book a class-division, and rows left with no teacher assigned — each finding names the slots and teachers or divisions it rests on, not a derived rate.',
      },
      priorities: {
        description:
          'The scheduling conflicts worth acting on first — teachers booked into two classrooms in the same slot, and class-divisions double-booked in the same slot — with the next step each one implies.',
      },
      dataQuality: {
        title: 'Timetable checks',
        description:
          'Exact counts against this year’s timetable rows: rows carrying no teacher at all, and the standards, divisions and subjects the schedule actually covers.',
      },
      recommendations: {
        description:
          'Each recommendation names the finding it answers and the cause the engine was authorised to state. A recommendation whose rule has no approved cause carries no explanation rather than a composed one. Approving one records a decision against your name; it does not execute anything on its own.',
      },
    },
  ),

  // Capped at six — the summary strip takes the first six and drops the
  // rest, so standards/subjects stay in Position instead. Matched against the
  // Metric keys BrainAcademicIntelligenceController::position() actually
  // serves: totalPeriods, standards, subjects, teachers,
  // medianPeriodsPerTeacher, clashingSlots, classDoubleBookings and
  // unassignedPeriods are all genuinely forwarded — these six are the ones
  // that carry the module's two load-bearing facts (distinct slots vs. row
  // count, and the two double-booking rules).
  summaryMetrics: [
    'totalPeriods',
    'teachers',
    'medianPeriodsPerTeacher',
    'clashingSlots',
    'classDoubleBookings',
    'unassignedPeriods',
  ],

  emptyState: {
    title: 'No timetable data yet',
    fallbackReason: 'No timetable rows have been recorded for this institute-year.',
  },
});
