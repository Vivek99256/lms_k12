'use client';

/**
 * The Task Management module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record.
 *
 * THE STATUS COLUMN HOLDS TWO SPELLINGS OF THE SAME STATE
 *
 * Across the estate: `COMPLETE` on 570 rows, `PENDING` on 329, and `COMPLETED` on 2. The
 * screens write the first; the two `COMPLETED` rows came from somewhere else.
 *
 * A count matching one spelling is wrong today by two rows and by more later — and worse,
 * those two finished tasks would sit in an "overdue" list forever. So every read
 * normalises, every judgement is made on `status_normalised`, and the raw spellings are
 * reported beside the figures so the office can see what needs tidying rather than the
 * tool hiding it.
 *
 * OVERDUE IS DERIVED, AND NOTHING ELSE IS
 *
 * A task past its date and not complete is overdue: two recorded columns, one honest
 * derivation. What is not recorded is why anything is late, whether the date was ever
 * agreed, or who is at fault — so every published prompt forbids attributing a delay to a
 * person, calling anybody behind or underperforming, and ranking people by task count. A
 * task with no date is undated rather than overdue, and is excluded.
 *
 * THE PROJECT TABLES ARE A DIFFERENT, NEARLY EMPTY SYSTEM
 *
 * `task_management_projects` and its siblings hold single-digit row counts estate-wide and
 * map only a handful of tasks. `tasks.projects` reads them and says so.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const TASK_MANAGEMENT_MODULE_KEY = 'task_management';

/** The route the Task Management AI Stack reports itself as when it builds a report. */
export const TASK_MANAGEMENT_AI_STACK_ROUTE = '/modules/task-management/ai-stack';

export const TASK_MANAGEMENT_AI_STACK: AiStackModule = {
  key: TASK_MANAGEMENT_MODULE_KEY,
  menuSlug: 'task-management',
  label: 'Task Management',
  records: 'tasks',
  record: 'task',
  route: TASK_MANAGEMENT_AI_STACK_ROUTE,
  subjectEntityKey: 'task',

  copy: {
    centralRisk:
      'the status column holds two spellings of the same state — COMPLETE on 570 rows and COMPLETED on two — so a count that matches one of them is wrong, and the two finished tasks spelled the other way would sit in an overdue list forever. Every read normalises before it judges. The second risk is about people: nothing records why a task is late or whether its date was ever agreed, so every published prompt forbids attributing a delay to a person, describing anybody as behind, and ranking people by task count.',
    policyNamePlaceholder: 'Task reporting policy',
    promptSystemDefault:
      'You summarise a task list for a school administrator. Use only the tasks you are given. THE STATUS COLUMN HOLDS TWO SPELLINGS OF THE SAME STATE — COMPLETE and COMPLETED both mean finished — so judge only on the normalised value and never report a count that matches one spelling. A task with no date is undated, not overdue. Nothing records why a task is late or whether its date was agreed: never attribute a delay to a person and never rank people by task count.',
    reportCanPrint: 'the tasks, dates and assignees come from the task list itself rather than from a model.',
    groundedOn: 'the task records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Task Management, so nothing here opens a case, reassigns a task or changes a deadline. The tool agents on the Automations tab still read the list and find the overdue ones.',
    capabilityWorkflow:
      'No workflow is bound to Task Management. Reassigning a task or moving a deadline changes what somebody is accountable for and stays a person’s act on the task screens.',
  },

  report: {
    defaultDataSource: 'tasks.list',
    // Exactly the arguments `tasks.list` accepts, from the tool's own schema.
    filters: [
      { key: 'state', label: 'State', kind: 'text', placeholder: 'any', hint: 'any, open, complete or overdue. Judged on the normalised status, not the raw word.' },
      { key: 'assigned_to', label: 'Assigned to (user id)', kind: 'number', placeholder: 'all' },
      { key: 'allocated_by', label: 'Allocated by (user id)', kind: 'number', placeholder: 'all' },
      { key: 'from_date', label: 'Due from', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'to_date', label: 'Due to', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'task_report',
    emptyNote:
      'No tasks matched those filters, so no report was created. A person with nothing allocated to them returns nothing rather than the whole school’s task list.',
  },

  presets: [
    {
      name: 'Task list reader',
      description:
        'Reads tasks with their dates, assignees and status, normalised across both spellings of complete. Changes nothing.',
      module: TASK_MANAGEMENT_MODULE_KEY,
      tools_allowed: ['tasks.list'],
      instructions:
        'Judge only on the normalised status: COMPLETE and COMPLETED both mean finished, and a count matching one spelling is wrong. Report the raw spellings when they differ so the office can tidy them. Never comment on a named person’s performance.',
      status: 'active',
    },
    {
      name: 'Overdue task finder',
      description:
        'Reads tasks past their date that are not complete, oldest first. Changes nothing.',
      module: TASK_MANAGEMENT_MODULE_KEY,
      tools_allowed: ['tasks.overdue'],
      instructions:
        'A task with no date is undated and is not in this list; do not add one. Nothing records why a task is late or whether its date was agreed — report the dates and say how many have no assignee, and attribute the delay to nobody. Do not propose reassigning anything.',
      status: 'active',
    },
    {
      name: 'Project structure reader',
      description:
        'Reads the projects and workstreams layered beside the task list. Changes nothing.',
      module: TASK_MANAGEMENT_MODULE_KEY,
      tools_allowed: ['tasks.projects'],
      instructions:
        'This structure holds single-digit row counts across the whole estate and maps only a handful of tasks. Report what is there and never describe it as a programme, a portfolio or a plan, and never present a project as accounting for the school’s work.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Tasks, the overdue ones and the project structure are readable, but the Task Management module has no agent manifest of its own. That suits the data: with no record of why anything is late, an agent could only restate the dates.',

  operations: {
    task_report: {
      key: 'task_report',
      label: 'Task report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'task'],
    },
    task_summary: {
      key: 'task_summary',
      label: 'Task summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    task_analysis: {
      key: 'task_analysis',
      label: 'Tasks analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    task_agent_run: {
      key: 'task_agent_run',
      label: 'Task Management agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
