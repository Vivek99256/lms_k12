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
 * HR & Staff Intelligence.
 *
 * Reads the staff roster and its own leave register — `tbluser`,
 * `tbluserprofilemaster`, `hrms_emp_leaves` and `hrms_leave_types` — not the
 * punch/biometric register that Attendance Management (`staff-attendance`)
 * covers. Headcount distinguishes active from total, because a raw row count
 * over `tbluser` overstates who is actually on staff. Leave is scoped through
 * the institute's own term dates, and where an institute keeps no leave
 * register the leave figures come back NULL, not zero — an earlier version of
 * this screen reported "0 leave days" at schools that simply do not use the
 * module, which read as a claim about the staff rather than an absence of
 * records. `leave_applications` is deliberately excluded: it is STUDENT leave.
 */
export const hrIntelligenceContract = defineContract({
  key: 'hr',
  label: 'HR & Staff Intelligence',
  accent: '#E11D48',
  grain: "one staff member's employment and leave record",
  nouns: { singular: 'staff member', plural: 'staff' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/hr/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('hr'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Staff position',
        description:
          'Active headcount against total staff records, by role, with this year’s leave read from the institute’s '
          + 'own term dates. A leave figure shown as a dash means this institute keeps no staff leave register — '
          + 'never a zero, which would read as a claim that no leave was taken.',
      },
      breakdowns: {
        title: 'Where staff sit',
        description:
          'Active staff by role, and the same leave register sliced by leave type and by role, which is the finest '
          + 'structure the roster and the register together support.',
      },
      findings: {
        description:
          'What the staff roster and leave register show — roles carrying unreachable staff, concentrations of '
          + 'leave or leave-without-pay, and register gaps — each with the headcount and leave figures it rests on.',
      },
      priorities: {
        description:
          'The staff risks worth acting on first — roles the institute cannot currently contact, and leave patterns '
          + 'worth a closer look — with the next step each one implies.',
      },
      dataQuality: {
        title: 'Roster & leave register checks',
        description:
          'Exact counts against this year’s rows: active staff missing an email or mobile, and leave-without-pay '
          + 'days on record. Where this institute keeps no leave register at all, the leave checks report that '
          + 'absence directly rather than showing a clean zero.',
      },
      recommendations: {
        description:
          'Each recommendation names the finding it answers and the cause the engine was authorised to state. A '
          + 'recommendation whose rule has no approved cause carries no explanation rather than a composed one. '
          + 'Approving one records a decision against your name; it does not execute anything on its own.',
      },
    },
  ),

  // Capped at six — the summary strip takes the first six and drops the
  // rest. Verified against BrainHrIntelligenceController::position(), which
  // forwards twelve Metric objects in total (activeStaff, roles,
  // teachingShare, femaleShare, leaveDays, avgLeaveDaysPerStaff,
  // leaveWithoutPayDays, missingContact, medianAttendance, workingDays,
  // openShifts, activeMissingFromRegister). The last four are punch-register
  // figures this controller also happens to compute; they are left out of
  // the summary strip in favour of Attendance Management's own screen, and
  // leaveDays is kept here specifically because it is the metric that can
  // legitimately come back null rather than zero.
  summaryMetrics: [
    'activeStaff',
    'teachingShare',
    'leaveDays',
    'avgLeaveDaysPerStaff',
    'leaveWithoutPayDays',
    'missingContact',
  ],

  emptyState: {
    title: 'No staff data yet',
    fallbackReason: 'No staff or leave records have been registered for this institute.',
  },
});
