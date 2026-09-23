'use client';

/**
 * The Learning module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record.
 *
 * THESE RECORDS ARE CONFIGURATION, NOT ACHIEVEMENT
 *
 * `lms.courses` and `lms.activities` describe what has been SET UP: which courses exist,
 * for which classes, with what activities against them. They record nothing about what any
 * child learned or how well.
 *
 * That is the module's central risk, because a course register looks like a measure of
 * teaching. Every published prompt forbids stating what a child learned, how well anybody
 * did, or that a course was effective — and forbids comparing teachers, classes or
 * subjects by course count, which measures configuration rather than work.
 *
 * A course with no activity recorded is a course with no activity RECORDED. It is not a
 * neglected course and its teacher is not inactive.
 *
 * ACHIEVEMENT BELONGS TO OTHER MODULES
 *
 * Exam results are the Exam module's and attendance is Attendance's. Neither is bound
 * here, and nothing may infer either from a course record.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const LMS_MODULE_KEY = 'lms';

/** The route the Learning AI Stack reports itself as when it builds a report. */
export const LMS_AI_STACK_ROUTE = '/modules/lms/ai-stack';

export const LMS_AI_STACK: AiStackModule = {
  key: LMS_MODULE_KEY,
  menuSlug: 'lms',
  label: 'Learning',
  records: 'courses',
  record: 'course',
  route: LMS_AI_STACK_ROUTE,
  subjectEntityKey: 'course',

  copy: {
    centralRisk:
      'these records are configuration — what has been set up — and a course register looks like a measure of teaching. Every published Learning prompt forbids stating what a child learned, how well anybody did, or that a course was effective, and forbids comparing teachers, classes or subjects by course count. A course with no activity recorded is a course with no activity recorded, not a neglected one. Results and attendance belong to the Exam and Attendance modules and are not readable here.',
    policyNamePlaceholder: 'Course configuration policy',
    promptSystemDefault:
      'You summarise course configuration for a school coordinator. Use only the records you are given. These are CONFIGURATION — what has been set up — and not achievement: never state what a child learned, how well anybody did, or that a course was effective. Never compare teachers, classes or subjects by course count. A course with no activity recorded is not a neglected course. Exam results and attendance belong to other modules and you have not been given them.',
    reportCanPrint: 'the courses, subjects and classes come from the course records themselves rather than from a model.',
    groundedOn: 'the course records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Learning, so nothing here opens a case or changes a course. The tool agents on the Automations tab still read the configuration.',
    capabilityWorkflow:
      'No workflow is bound to Learning. Publishing or withdrawing a course changes what a class is taught and stays a coordinator’s act.',
  },

  report: {
    defaultDataSource: 'lms.courses',
    // Exactly the arguments `lms.courses` accepts, from the tool's own schema.
    filters: [
      { key: 'search_text', label: 'Search', kind: 'text', placeholder: 'course or subject' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'lms_course_report',
    emptyNote:
      'No courses matched those filters, so no report was created. A class with nothing configured returns nothing rather than the whole catalogue.',
  },

  presets: [
    {
      name: 'Course reader',
      description:
        'Reads the courses configured for this institute. Changes nothing.',
      module: LMS_MODULE_KEY,
      tools_allowed: ['lms.courses'],
      instructions:
        'These records are configuration, not achievement. Never say what a child learned, how well anybody did, or that a course was effective, and never rank teachers or classes by how many courses they have.',
      status: 'active',
    },
    {
      name: 'Activity reader',
      description:
        'Reads the learning activities recorded against courses. Changes nothing.',
      module: LMS_MODULE_KEY,
      tools_allowed: ['lms.activities', 'lms.courses'],
      instructions:
        'An activity being recorded says it was set up, not that anybody completed it or learned from it. A course with no activity has none RECORDED. Do not infer results or attendance — both belong to other modules you have not been given.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Courses and their activities are readable, but the Learning module has no agent manifest of its own. Nor could one judge much from configuration alone: what a child actually learned is recorded by the Exam and Attendance modules.',

  operations: {
    lms_course_report: {
      key: 'lms_course_report',
      label: 'Course register',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'course'],
    },
    lms_summary: {
      key: 'lms_summary',
      label: 'Course summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    lms_analysis: {
      key: 'lms_analysis',
      label: 'Course configuration analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    lms_agent_run: {
      key: 'lms_agent_run',
      label: 'Learning agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
