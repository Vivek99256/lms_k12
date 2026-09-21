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
 * Reads the staff master, the staff leave register and the punch register, and
 * says which of the three an institute actually keeps. Most keep only the first.
 *
 * ── WHAT THIS SCREEN WILL NOT SHOW ──────────────────────────────────────────
 *
 * It never names an individual member of staff in an attendance figure. The
 * punch register cannot distinguish approved leave, a school trip and a split
 * week from absence, so the backend returns counts, medians and bands, and a
 * role of fewer than five people loses its median rather than describing the
 * people in it.
 */
export const hrIntelligenceContract = defineContract({
  key: 'hr',
  label: 'HR & Staff Intelligence',
  accent: '#EC4899', // Pink / Rose
  grain: 'one member of staff — their role, department, contact details and whether the account is active',
  nouns: { singular: 'staff profile', plural: 'staff profiles' },

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
        title: 'Workforce position',
        description:
          'Headcount, roles and gender across the active staff body, with leave and attendance where the institute keeps a register for them. A figure shown as a dash is a register this institute does not keep — never a zero, which would read as a claim about its staff.',
      },
      breakdowns: {
        title: 'Where personnel sit',
        description:
          'Staff across roles, leave across types and roles, and attendance against the institute’s own working days — days it actually ran, read from its own register rather than from a weekday convention.',
      },
      findings: {
        description:
          'What the registers show, each with the figures it rests on. Attendance findings describe roles and never individuals, and say what the register cannot tell you as plainly as what it can.',
      },
      priorities: {
        description:
          'Staff record completeness, contact reachability, and the punch-register gaps that make a payroll or an inspection return harder to answer.',
      },
      dataQuality: {
        title: 'Staff directory & register quality',
        description:
          'What is missing, contradictory or unusable in the staff master and the punch register. The punch checks disappear entirely where no register is kept, rather than reporting a row of zeros.',
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
    'activeStaff',
    'roles',
    'teachingShare',
    'medianAttendance',
    'leaveDays',
    'openShifts',
    'missingContact',
  ],

  emptyState: {
    title: 'No staff profiles recorded',
    fallbackReason:
      'No active employee records have been registered for this institute.',
  },
});

