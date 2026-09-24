'use client';

/**
 * The Time Table module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record: no class, no teacher, no period.
 *
 * ONE ROW IS ONE PERIOD OF ONE CLASS ON ONE WEEKDAY
 *
 * A week for one class is period-count × weekday-count rows, and the whole school is a
 * hundred thousand of them. Every read is filtered and counted before it is limited, and
 * the layout prints both figures — a page read as a total would be wrong by orders of
 * magnitude.
 *
 * THE ONLY JUDGEMENT AVAILABLE IS A CLASH
 *
 * `timetable` records no room and no teacher availability. So the one thing the data can
 * prove is a teacher booked into two different classes in the same period on the same day,
 * which `timetable.conflicts` finds. Everything else somebody might want — balance,
 * fairness, workload, gaps — is not in the table, and every published prompt forbids
 * claiming it.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const TIMETABLE_MODULE_KEY = 'timetable';

/** The route the Time Table AI Stack reports itself as when it builds a report. */
export const TIMETABLE_AI_STACK_ROUTE = '/modules/timetable/ai-stack';

export const TIMETABLE_AI_STACK: AiStackModule = {
  key: TIMETABLE_MODULE_KEY,
  menuSlug: 'timetable',
  label: 'Time Table',
  records: 'timetable records',
  record: 'timetable entry',
  route: TIMETABLE_AI_STACK_ROUTE,
  subjectEntityKey: 'timetable_entry',

  copy: {
    centralRisk:
      'the timetable records no room and no teacher availability, so the only conflict it can prove is a teacher booked into two different classes in the same period on the same day. Every published Time Table prompt carries a rule forbidding the model from calling a timetable balanced, fair, efficient or overloaded, and from saying a teacher is free at a given time. Two rows for the same class are a merged session, not a clash.',
    policyNamePlaceholder: 'Timetable publication policy',
    promptSystemDefault:
      'You answer questions about a published class timetable for a school office. Use only the timetable rows you are given. If a period, a subject, a teacher or a class is not in them, say so rather than estimating. This table records no room and no teacher availability: never say a timetable is balanced, fair, efficient or overloaded, and never say a teacher is free at a given time. The only clash you may report is one already reported to you.',
    reportCanPrint: 'the periods, subjects and teachers come from the published timetable itself rather than from a model.',
    groundedOn: 'the published timetable above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Time Table, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read the schedule and find clashes.',
    capabilityWorkflow:
      'No workflow is bound to Time Table. Changing a period moves a class and stays a person’s act on the timetable screen.',
  },

  report: {
    defaultDataSource: 'timetable.schedule',
    // Exactly the arguments `timetable.schedule` accepts, from the tool's own schema.
    filters: [
      { key: 'standard_id', label: 'Standard id', kind: 'number', placeholder: 'all' },
      { key: 'division_id', label: 'Division id', kind: 'number', placeholder: 'all' },
      { key: 'teacher_id', label: 'Teacher id', kind: 'number', placeholder: 'all' },
      { key: 'week_day', label: 'Weekday', kind: 'text', placeholder: 'all', hint: '1-7 or a day name.' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'timetable_class_report',
    emptyNote:
      'No timetable entries matched those filters, so no report was created. A class with no published timetable returns nothing rather than the whole school’s schedule.',
  },

  presets: [
    {
      name: 'Schedule reader',
      description:
        'Reads the published timetable for a class, teacher or weekday. Changes nothing.',
      module: TIMETABLE_MODULE_KEY,
      tools_allowed: ['timetable.schedule'],
      instructions:
        'Report the entries exactly as published, and always state the whole matching count beside the rows listed — one class week is forty-odd rows and the school is a hundred thousand. Drafts are excluded by the tool; do not describe a schedule as provisional. Never say a teacher is free at a time you have no row for.',
      status: 'active',
    },
    {
      name: 'Clash finder',
      description:
        'Finds teachers booked into two different classes in the same period on the same weekday. Changes nothing.',
      module: TIMETABLE_MODULE_KEY,
      tools_allowed: ['timetable.conflicts'],
      instructions:
        'Report only the clashes the tool returns. Two rows for the same class are a merged or split session and are not a clash. Do not propose a fix unless you were given every entry it would affect — moving a period moves a class.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The published schedule and teacher clashes are readable, but the Time Table module has no agent manifest of its own. The table records no room and no availability either, so nothing here could judge a timetable beyond a clash.',

  operations: {
    timetable_class_report: {
      key: 'timetable_class_report',
      label: 'Class timetable report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'timetable'],
    },
    timetable_summary: {
      key: 'timetable_summary',
      label: 'Timetable summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    timetable_analysis: {
      key: 'timetable_analysis',
      label: 'Timetable analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    timetable_agent_run: {
      key: 'timetable_agent_run',
      label: 'Time Table agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
