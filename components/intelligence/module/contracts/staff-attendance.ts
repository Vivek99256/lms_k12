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
 * Staff Attendance Intelligence.
 *
 * Reads the punch/biometric register kept against `tbluser`, not the pupil
 * attendance register — this is a different data source from Attendance
 * Intelligence and a different module entirely from HR & Staff Intelligence's
 * headcount view. Rates come from punch-in/punch-out rows against working
 * days; there is no stored percentage column here to disagree with.
 *
 * ── WHAT THIS SCREEN WILL NOT SHOW ──────────────────────────────────────────
 *
 * It never names an individual staff member's attendance figure — only
 * counts, shares, and medians at the institute or department level. And
 * `tbluser.department_id` is unpopulated at many institutes, so department
 * breakdowns can legitimately come back empty; that is a fact about the
 * directory, not a failure of the query.
 */
export const staffAttendanceIntelligenceContract = defineContract({
  key: 'staff-attendance',
  label: 'Attendance Management',
  accent: '#DC2626',
  grain: 'One snapshot of staff punch-register attendance rates by department.',
  nouns: { singular: 'staff member', plural: 'staff' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/staff-attendance/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('staff-attendance'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Attendance position',
        description:
          'What the punch register shows right now, across all active staff with a punch row for the period. A figure shown as a dash means the register does not cover this — never a zero, which would read as a claim about attendance.',
      },
      breakdowns: {
        title: 'Where staff attendance sits',
        description:
          'The same punch-register rates sliced by department, where the directory records one. Where `department_id` is not populated for this institute, the department slice is legitimately empty rather than wrong.',
      },
      findings: {
        description:
          'What the punch register shows at the institute and department level — irregular and chronic attendance shares, and what the register itself is missing. No finding names an individual; every figure is a count, a share, or a median.',
      },
      priorities: {
        description:
          'The staff attendance risks worth acting on first — concentrations of irregular or chronic attendance, and register gaps that make the figures harder to trust — with the next step each one implies.',
      },
      dataQuality: {
        title: 'Punch register checks',
        description:
          'Exact counts against this period’s punch rows: open shifts with no recorded punch-out, staff missing from the register entirely, and the department coverage the directory actually supports.',
      },
      recommendations: {
        description:
          'Each recommendation names the finding it answers and the cause the engine was authorised to state. A recommendation whose rule has no approved cause carries no explanation rather than a composed one. Approving one records a decision against your name; it does not execute anything on its own.',
      },
    },
  ),

  // Capped at six — the summary strip takes the first six and drops the
  // rest, so shares are kept over the equivalent raw counts.
  // Matched against the Metric keys BrainStaffAttendanceIntelligenceController::position()
  // actually serves — 'activeStaff'/'irregularStaffShare'/'chronicStaffShare'
  // are never forwarded as Metric objects (only 'staffOnRegister' and the
  // count-form 'irregularStaffCount'/'chronicStaffCount' are).
  summaryMetrics: [
    'averageAttendanceRate',
    'medianAttendanceRate',
    'irregularStaffCount',
    'chronicStaffCount',
    'departmentsWithData',
    'openShiftShare',
  ],

  emptyState: {
    title: 'No staff attendance data yet',
    fallbackReason:
      'No punch or biometric attendance records have been recorded for staff at this institute.',
  },
});
