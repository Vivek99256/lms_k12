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
 * Task Management Intelligence.
 *
 * Reads the institute's task register: volume, completion and overdue tracking,
 * and workload distribution across assignees. There is no `completed_at` column
 * on the backend, so `avgCycleTimeDays` is an estimate derived from surrounding
 * timestamps rather than a measured duration — the copy below says so rather
 * than presenting it as exact.
 */
export const taskManagementIntelligenceContract = defineContract({
  key: 'task-management',
  label: 'Task Management Intelligence',
  accent: '#EA580C',
  grain: 'one task — its status, priority, assignee and the dates that bound it',
  nouns: { singular: 'task', plural: 'tasks' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/task-management/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('task-management'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Task position',
        description:
          'What is true right now. Completion, overdue and open-task figures are exact counts against this year’s task rows; the estimated cycle time is not — there is no completion timestamp on the backend, so it is inferred rather than measured.',
      },
      breakdowns: {
        title: 'Where tasks sit',
        description:
          'The same tasks sliced by status, by priority, by delay category and by assignee — the workload distribution that shows who is carrying the open queue.',
      },
      findings: {
        description:
          'One finding per assignee or category carrying a material share of overdue or stalled tasks, plus what the register itself is missing. The estimated cycle time is never used to imply a precision the underlying dates do not support.',
      },
      priorities: {
        description:
          'The task risks worth acting on first — concentrated overdue load, stalled assignees, tasks on hold — with the next step each one implies.',
      },
      dataQuality: {
        title: 'Task register checks',
        description:
          'Exact counts against this year’s rows: tasks missing an assignee, a due date or a priority, and tasks whose recorded dates cannot support even an estimated cycle time.',
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
  // rest, so the estimated open-task-age and cycle-time figures live in the
  // Position section instead rather than crowding the strip.
  summaryMetrics: [
    'total',
    'completionRate',
    'openTasks',
    'overdueTasks',
    'avgOverdueDays',
    'onHold',
  ],

  emptyState: {
    title: 'No task data yet',
    fallbackReason: 'No tasks have been recorded for this institute in the selected year.',
  },
});
