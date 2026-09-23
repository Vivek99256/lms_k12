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
 * Academic & Timetable Intelligence.
 * Evaluates master timetable distribution, curriculum allocation, and faculty workload balance.
 */
export const academicIntelligenceContract = defineContract({
  key: 'academic',
  label: 'Academic Intelligence',
  accent: '#8B5CF6', // Purple / Violet
  grain: 'one timetable row — one class-division’s period on one weekday in one marking period',
  nouns: { singular: 'timetable period', plural: 'timetable periods' },

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
        title: 'Instructional schedule position',
        description:
          'What is happening — total weekly teaching periods, standards scheduled, active faculty, and unassigned periods.',
      },
      breakdowns: {
        title: 'Where curriculum sits',
        description:
          'Weekly instructional periods sliced across curriculum subjects and faculty workload distribution.',
      },
      findings: {
        description:
          'Empirical signals: unassigned instructional slots (substitute/vacancy risk) and high teacher workloads (>35 periods).',
      },
      priorities: {
        description:
          'Curriculum scheduling and faculty workload adjustments requiring administrative action.',
      },
      dataQuality: {
        title: 'Timetable master quality',
        description:
          'Audit checks on unlinked faculty accounts and unassigned subject slots.',
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
    'teachers',
    'medianPeriodsPerTeacher',
    'clashingSlots',
    'classDoubleBookings',
    'unassignedPeriods',
    'totalPeriods',
  ],

  emptyState: {
    title: 'No academic schedule for this session',
    fallbackReason:
      'No timetable scheduling records have been published for the academic year selected in the header.',
  },
});

