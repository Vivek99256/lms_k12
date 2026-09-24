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
 * Capability Intelligence.
 *
 * Reads the job-role skill map, the competency framework, staff certifications
 * and development plans, and says how much of the workforce is actually mapped
 * to a role's required skills rather than assumed to be.
 */
export const capabilityIntelligenceContract = defineContract({
  key: 'capability',
  label: 'Capability Intelligence',
  accent: '#0D9488',
  grain: 'one snapshot of job-role skill mapping coverage, certifications and development plans',
  nouns: { singular: 'job role', plural: 'job roles' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/capability/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('capability'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Capability position',
        description:
          'What is true right now. Read the skill-coverage figure first: it is the share of job roles that actually have a skill map recorded, not the share assumed to need one.',
      },
      breakdowns: {
        title: 'Where capability sits',
        description:
          'Job roles sliced by department, and skill coverage against the competency frameworks currently active, which is the finest grain the mapping data supports.',
      },
      findings: {
        description:
          'What the skill map, certification register and development plans show, each with the figures it rests on — including certifications recorded as valid past their own expiry date and development plans left open past their target date.',
      },
      priorities: {
        description:
          'The capability gaps worth acting on first — unmapped roles, lapsed certifications, overdue plans — with the next step each one implies.',
      },
      dataQuality: {
        title: 'Capability record checks',
        description:
          'Exact counts against this institute’s own records: job roles with no skill mapping, certifications past expiry still marked valid, and development plans overdue against their target date.',
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
  // rest, so departments/activeFrameworks stay in the breakdowns instead.
  // Matched against the Metric keys BrainCapabilityIntelligenceController::position()
  // actually serves — 'jobRolesWithSkillMapping' is never forwarded as a
  // Metric object (only its complement, 'jobRolesWithoutSkillMapping', is).
  summaryMetrics: [
    'jobRoles',
    'jobRoleSkillCoverage',
    'jobRolesWithoutSkillMapping',
    'competencies',
    'certifications',
    'developmentPlans',
  ],

  emptyState: {
    title: 'No capability data yet',
    fallbackReason:
      'No job-role skill mapping has been recorded for this institute, so capability coverage cannot be computed.',
  },
});
