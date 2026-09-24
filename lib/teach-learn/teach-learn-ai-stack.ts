'use client';

/**
 * The Teach/Learn module's AI Stack declaration.
 *
 * WHAT THIS FILE IS AND IS NOT
 *
 * It is a descriptor, not a screen and not a store. The nine AI Stack tabs live once in
 * `app/_components/ai-stack/` and render from one of these; this says which module they
 * are rendering, how it is named in prose, which filters its report offers, which tool
 * agents are worth a button, and the handful of sentences that are genuinely different
 * because Teach/Learn is genuinely different from Exam.
 *
 * NOTHING HERE IS A RECORD. No course, no chapter, no student, no count. Every figure the
 * tabs show is looked up at runtime from `ai_templates`, `ai_policies`, `ai_conversations`,
 * `ai_audit_logs` and the module's own read tools, scoped to the caller's institute by
 * their own token.
 *
 * THE MODULE KEY IS `teach_learn`, AND IT READS THE SAME RECORDS `lms` DOES
 *
 * Teach/Learn is a teacher-facing presentation layer over the existing LMS course/chapter
 * catalogue (`app/teach-learn/_lib` sits on the same `fees_menu_categories`-driven category
 * routing `lms` uses, and `course-master` is the same screen either module can reach). Its
 * tool keys (`teach_learn.courses`, `teach_learn.activities`) wrap the identical backend
 * MCP tools (`lms.courses`, `lms.activities`) rather than re-deriving the query — see
 * `lib/agents/executors.ts`. That is reuse, not a second copy: the pages differ, the
 * records behind them do not.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const TEACH_LEARN_MODULE_KEY = 'teach_learn';

/**
 * The route the Teach/Learn AI Stack reports itself as when it builds a report.
 *
 * `/api/ai/workspace/*` resolves which module a call belongs to from the route it is
 * given. `/teach-learn/**` is matched by the Teach/Learn row in `ai_modules`, added by the
 * migration that registers this module — Teach/Learn keeps its own pages outside the
 * shared `/modules/<slug>/ai-stack` convention, so the row's route patterns must cover its
 * real pages directly.
 */
export const TEACH_LEARN_AI_STACK_ROUTE = '/teach-learn/ai-stack';

export const TEACH_LEARN_AI_STACK: AiStackModule = {
  key: TEACH_LEARN_MODULE_KEY,
  menuSlug: 'teach_learn',
  label: 'Teach/Learn',
  records: 'courses and learning activities',
  record: 'course record',
  route: TEACH_LEARN_AI_STACK_ROUTE,
  subjectEntityKey: 'course',

  copy: {
    centralRisk:
      'a chapter being configured is not the same as a child having learned it. Every published Teach/Learn prompt carries a safety rule forbidding the model from reporting course or activity configuration as a measure of what a student achieved — coverage and completion are administrative facts, not outcomes.',
    policyNamePlaceholder: 'Teach/Learn content communication policy',
    promptSystemDefault:
      'You answer questions about configured courses, chapters and learning activities for a teacher or coordinator. Use only the course and activity records you are given. If a course, chapter or class is not in them, say so rather than estimating. A course or chapter being set up means it was configured, not that anybody has completed it — never report configuration as achievement.',
    reportCanPrint: 'the courses and activities come from the LMS catalogue itself rather than from a model.',
    groundedOn: 'the recorded course, chapter and activity data above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Teach/Learn, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read the course and activity records.',
    capabilityWorkflow: 'No workflow is bound to Teach/Learn, so nothing in this module pauses for an approval.',
  },

  report: {
    defaultDataSource: 'lms.courses',
    filters: [
      { key: 'standard_name', label: 'Standard', kind: 'text', placeholder: 'all' },
      { key: 'subject_id', label: 'Subject id', kind: 'number', placeholder: 'all' },
      { key: 'category', label: 'Content category', kind: 'text', placeholder: 'all' },
      { key: 'query', label: 'Course name contains', kind: 'text', placeholder: 'all' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '50' },
    ],
    operation: 'teach_learn_courses_report',
    emptyNote:
      'No courses matched those filters, so no report was created. A subject or standard this institute has not published content for returns nothing rather than the whole catalogue.',
  },

  presets: [
    {
      name: 'Course catalogue reader',
      description: 'Reads the courses and chapters configured for this institute. Changes nothing.',
      module: TEACH_LEARN_MODULE_KEY,
      tools_allowed: ['teach_learn.courses'],
      instructions:
        'Report only what the course catalogue returns. State whether a chapter is centrally published or institute-specific when the record says so, and never describe configured content as something a student has completed.',
      status: 'active',
    },
    {
      name: 'Activity timeline reader',
      description: 'Reads sessions and homework set for a class over a window around today. Changes nothing.',
      module: TEACH_LEARN_MODULE_KEY,
      tools_allowed: ['teach_learn.activities'],
      instructions:
        'Report the activities exactly as recorded, with their dates. An activity being on the timeline means it was scheduled or set, not that it happened or was completed — never imply otherwise.',
      status: 'active',
    },
  ],

  // Course/activity data could feed a learning-support agent, but Teach/Learn has no
  // manifest of its own yet — binding one here on Teach/Learn's behalf would put one
  // agent under two modules with two run logs, which the AI Stack design refuses.
  boundAgent: null,
  noAgentReason:
    'Teach/Learn has no case-opening agent yet; reports and conversational answers are grounded directly on course and activity records.',

  operations: {
    teach_learn_courses_report: {
      key: 'teach_learn_courses_report',
      label: 'Course catalogue report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'course'],
    },
    teach_learn_summary: {
      key: 'teach_learn_summary',
      label: 'Lesson summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['lesson summary', 'summary'],
    },
    teach_learn_lesson_plan: {
      key: 'teach_learn_lesson_plan',
      label: 'Lesson plan',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['lesson plan', 'plan'],
    },
    teach_learn_activity_report: {
      key: 'teach_learn_activity_report',
      label: 'Learning activity report',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['activity', 'report'],
    },
    teach_learn_outcome_report: {
      key: 'teach_learn_outcome_report',
      label: 'Learning outcome report',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['outcome', 'report'],
    },
    teach_learn_agent_run: {
      key: 'teach_learn_agent_run',
      label: 'Teach/Learn agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
