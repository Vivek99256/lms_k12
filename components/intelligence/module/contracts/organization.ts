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
 * Organization Management Intelligence.
 *
 * Reads the institute's staff roster as an organization rather than a register:
 * active headcount, how it is distributed across departments, how it moved this
 * year through hiring and attrition, and how well the skills the institute
 * actually needs are covered by the people it actually has.
 */
export const organizationIntelligenceContract = defineContract({
  key: 'organization',
  label: 'Organization Management Intelligence',
  accent: '#7C3AED',
  grain: 'one organization-wide snapshot of active staff, departments, hiring and attrition',
  nouns: { singular: 'employee', plural: 'employees' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/organization/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('organization'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Organization position',
        description:
          'Active headcount right now, with this year’s hiring, attrition and net growth read from the same staff roster — not a snapshot from the day the year opened.',
      },
      breakdowns: {
        title: 'Where the organization sits',
        description:
          'Active staff sliced by department, and skill coverage against the roles the institute has defined, which is the finest structure the roster’s grain supports.',
      },
      findings: {
        description:
          'One finding per department that is understaffed, growing, shrinking, or carrying a skill gap against the roles it is meant to cover, each with the headcount and coverage figures it rests on.',
      },
      priorities: {
        description:
          'The structural risks worth acting on first — departments losing people faster than they are replaced, and skill gaps that leave a department short of what its roles require.',
      },
      dataQuality: {
        title: 'Roster & department checks',
        description:
          'Exact counts against this year’s rows: staff with no department assigned, departments with no active staff, and skill or proficiency records missing for active employees.',
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
  // rest, so the redundant count-form pairs (attritionCount vs. rate,
  // growthRate vs. netGrowth) and avgProficiency stay in Position instead.
  summaryMetrics: [
    'activeStaff',
    'newHires',
    'attritionRate',
    'netGrowth',
    'departments',
    'avgSkillCoverage',
  ],

  emptyState: {
    title: 'No organization data yet',
    fallbackReason:
      'No active staff or department records have been registered for this institute-year.',
  },
});
