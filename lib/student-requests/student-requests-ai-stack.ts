'use client';

/**
 * The Student Request module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record: no request, no child, no family, no count.
 *
 * WHY THE KEY IS `student_request` AND NOT `students`
 *
 * They are different modules. `students` is the directory — lists, registers and reports
 * over a cohort — and it has its own AI Stack under `lib/students/`. `student_request` is
 * the queue of change requests raised against a student's record, and this is that. The
 * two are kept apart deliberately: a person who may read the request queue has not thereby
 * been given the student directory, and the module's tool binding in `config/ai.php`
 * omits `students.directory` for exactly that reason.
 *
 * The menu slug is `student-request` (hyphenated, from the level-2 menu's name) while the
 * `ai_modules` key is `student_request` (underscored). Both are correct for what they name
 * — a route is how a URL is recognised, a key is what a module is called.
 *
 * WHAT THIS MODULE MUST NEVER DO
 *
 * Decide. A request sits at Pending until a person approves or rejects it on the Student
 * Request screen, and there is no write tool in this module's catalogue at all. Every
 * published prompt carries a rule forbidding the model from stating a decision or
 * predicting one, because a family told "your request will be approved" has been promised
 * something the school has not decided.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const STUDENT_REQUEST_MODULE_KEY = 'student_request';

/** The route the Student Request AI Stack reports itself as when it builds a report. */
export const STUDENT_REQUEST_AI_STACK_ROUTE = '/modules/student-request/ai-stack';

export const STUDENT_REQUEST_AI_STACK: AiStackModule = {
  key: STUDENT_REQUEST_MODULE_KEY,
  menuSlug: 'student-request',
  label: 'Student request',
  records: 'student request records',
  record: 'request',
  route: STUDENT_REQUEST_AI_STACK_ROUTE,
  subjectEntityKey: 'student_request',

  copy: {
    centralRisk:
      'a pending request has not been refused, and nothing in this module may decide one. Approving or rejecting a request is a person’s act on the Student Request screen, there is no write tool in this module’s catalogue, and every published prompt carries a rule forbidding the model from stating a decision or predicting one. A family told what the outcome will be has been promised something the school has not decided.',
    policyNamePlaceholder: 'Student request acknowledgement policy',
    promptSystemDefault:
      'You answer questions about student change requests for a school office. Use only the request records you are given. If a request, a student, a class, a reason or a count is not in them, say so rather than estimating. A pending request has not been refused: never describe an undecided request as rejected, never state what a decision will be, and never recommend approving or refusing one. Do not judge a family from the reason they gave.',
    reportCanPrint:
      'the request details come from the request records themselves rather than from a model.',
    groundedOn: 'the request records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Student requests, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read the queue.',
    capabilityWorkflow:
      'No workflow is bound to Student requests. A decision is recorded on the Student Request screen by the person who makes it.',
  },

  report: {
    defaultDataSource: 'student_requests.list',
    // Exactly the arguments `student_requests.list` accepts, from the tool's own schema.
    filters: [
      {
        key: 'status',
        label: 'Status',
        kind: 'text',
        placeholder: 'all',
        hint: 'Pending, Approved or Rejected.',
      },
      { key: 'standard_id', label: 'Standard id', kind: 'number', placeholder: 'all' },
      { key: 'division_id', label: 'Division id', kind: 'number', placeholder: 'all' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'student_request_report',
    emptyNote:
      'No student requests matched those filters, so no report was created. A class or status with nothing in it this academic year returns nothing rather than the whole queue.',
  },

  presets: [
    {
      name: 'Request queue reader',
      description:
        'Reads the change requests raised this year, with their type, reason and status. Changes nothing.',
      module: STUDENT_REQUEST_MODULE_KEY,
      tools_allowed: ['student_request.list'],
      instructions:
        'Report only what the request records return. Always state the whole queue size and the breakdown by status beside the rows listed, so a page of fifty is never read as fifty pending. Never say what a decision should be or will be.',
      status: 'active',
    },
    {
      name: 'Request detail reader',
      description:
        'Reads one request in full, including whether a required proof document was supplied. Changes nothing.',
      module: STUDENT_REQUEST_MODULE_KEY,
      tools_allowed: ['student_request.details'],
      instructions:
        'Report the request exactly as recorded. Whether proof was required comes from the request type and whether it was supplied comes from the request row — report both and never infer one from the other. Do not recommend a decision.',
      status: 'active',
    },
    {
      name: 'Acknowledgement drafter',
      description:
        'Drafts a note confirming a request was received and naming anything still outstanding. Sends nothing.',
      module: STUDENT_REQUEST_MODULE_KEY,
      tools_allowed: ['student_request.draft_acknowledgement'],
      instructions:
        'Write a short, respectful note a parent can read in under a minute. Confirm what was received and name only the documents you are told are outstanding. State no decision and predict none — say the school will review the request and write with the outcome.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The queue, each request in full and the request types are readable, but the Student Request module has no agent manifest of its own. Approving a request stays a human act on the Student Request screen; no agent here may decide one.',

  operations: {
    student_request_report: {
      key: 'student_request_report',
      label: 'Student request report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'request'],
    },
    student_request_summary: {
      key: 'student_request_summary',
      label: 'Student request summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    student_request_analysis: {
      key: 'student_request_analysis',
      label: 'Student request queue analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    student_request_acknowledgement_drafted: {
      key: 'student_request_acknowledgement_drafted',
      label: 'Request acknowledgement drafted',
      capability: 'generative',
      uses: 'prompt',
      // 'acknowledgement' first — see the note in the Exam descriptor about why the order
      // of these hints decides whether a one-family draft is refused for want of grounding.
      prefers: ['acknowledgement', 'message', 'request'],
    },
    student_request_agent_run: {
      key: 'student_request_agent_run',
      label: 'Student request agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
