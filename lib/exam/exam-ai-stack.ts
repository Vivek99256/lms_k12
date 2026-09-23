'use client';

/**
 * The Exam module's AI Stack declaration.
 *
 * WHAT THIS FILE IS AND IS NOT
 *
 * It is a descriptor, not a screen and not a store. The nine AI Stack tabs live once in
 * `app/_components/ai-stack/` and render from one of these; this says which module they
 * are rendering, how it is named in prose, which filters its report offers, which tool
 * agents are worth a button, and the handful of sentences that are genuinely different
 * because exams are genuinely different from hostels.
 *
 * NOTHING HERE IS A RECORD. No exam, no mark, no student, no count. Every figure the tabs
 * show is looked up at runtime from `ai_templates`, `ai_policies`, `ai_conversations`,
 * `ai_audit_logs` and the module's own read tools, scoped to the caller's institute by
 * their own token.
 *
 * THE MODULE KEY IS `exam`
 *
 * That is the `ai_modules` key this estate has carried since the AI workspace was seeded,
 * and it is what `agents.exam`, `module.exam.*` audit rows and `module_key = 'exam'`
 * templates all spell. The tool prefix is `exams.` and the menu slug is `exam`; the three
 * spellings are each correct for what they name and none of them has to agree with the
 * others.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const EXAM_MODULE_KEY = 'exam';

/**
 * The route the Exam AI Stack reports itself as when it builds a report.
 *
 * `/api/ai/workspace/*` resolves which module a call belongs to from the route it is
 * given. `/modules/exam/**` is matched by the Exam row in `ai_modules`, which
 * 2026_09_22_100000 adds; `/exam/**` was already there and covers the direct page.
 */
export const EXAM_AI_STACK_ROUTE = '/modules/exam/ai-stack';

export const EXAM_AI_STACK: AiStackModule = {
  key: EXAM_MODULE_KEY,
  menuSlug: 'exam',
  label: 'Exam',
  records: 'exam records',
  record: 'exam result',
  route: EXAM_AI_STACK_ROUTE,
  subjectEntityKey: 'exam_result',

  copy: {
    centralRisk:
      'a mark is a record of one performance on one day, and the record holds nothing about why. Every published Exam prompt carries a safety rule forbidding the model from judging a student as able, weak, lazy or gifted from a mark, and from treating an absence as a zero. A child who missed an exam has no score; reporting one as a failure is the wrong answer most likely to reach a family.',
    policyNamePlaceholder: 'Exam result communication policy',
    promptSystemDefault:
      'You answer questions about recorded exam marks for an examinations officer. Use only the result records you are given. If an exam, a subject, a class or a figure is not in them, say so rather than estimating. An absence carries no score and must never be treated as a zero or averaged in as one. A mark records one performance; never characterise a student as able, weak, lazy or gifted from it.',
    reportCanPrint:
      'the marks come from the result records themselves rather than from a model.',
    groundedOn: 'the recorded marks above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Exam, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read the marks.',
    capabilityWorkflow:
      'No workflow is bound to Exam, so nothing in this module pauses for an approval.',
  },

  report: {
    // The tool `k12.exam.report` binds to. Shown when no layout is published yet, so the
    // person knows which records a plain-table build would read.
    defaultDataSource: 'exams.results',
    // Exactly the arguments `exams.results` accepts. Taken from the tool's own schema —
    // a filter this tool ignores would be a control that silently does nothing.
    filters: [
      { key: 'exam_id', label: 'Exam id', kind: 'number', placeholder: 'all', hint: 'From the Exams list.' },
      { key: 'student_id', label: 'Student id', kind: 'number', placeholder: 'all' },
      { key: 'subject_name', label: 'Subject', kind: 'text', placeholder: 'all' },
      { key: 'standard_name', label: 'Standard', kind: 'text', placeholder: 'all' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'exam_results_report',
    emptyNote:
      'No exam marks matched those filters, so no report was created. A subject or standard this institute has not recorded marks against returns nothing rather than the whole school.',
  },

  presets: [
    {
      name: 'Exam list reader',
      description:
        'Reads the exams set up for this institute, with their terms and weightings. Changes nothing.',
      module: EXAM_MODULE_KEY,
      tools_allowed: ['exam.list'],
      instructions:
        'Report only what the exam masters return. If a named exam does not exist, say so rather than offering the nearest one — an exam id is what a results question needs, and the wrong one answers a different question.',
      status: 'active',
    },
    {
      name: 'Results reader',
      description:
        'Reads recorded marks by exam, subject, class or student, and reports absences separately. Changes nothing.',
      module: EXAM_MODULE_KEY,
      tools_allowed: ['exam.results'],
      instructions:
        'Report the marks exactly as recorded. Always state how many entries were scored and how many were absences, and never include an absence in an average or describe it as a zero. Never say anything about a student beyond the figures — a mark records one performance and nothing about the child.',
      status: 'active',
    },
    {
      name: 'Result note drafter',
      description: 'Drafts a short note telling one family what an exam record says. Sends nothing.',
      module: EXAM_MODULE_KEY,
      tools_allowed: ['exam.draft_result_note'],
      instructions:
        'Write a short, plain note a parent can read in under a minute. State only the figures you are given. Do not praise, warn, rank, compare or advise, and do not suggest what the result means for the child. If the record says absent, say absent and state that no marks were recorded.',
      status: 'active',
    },
  ],

  // Assessment data feeds the academic-risk agent through its detectors, but that agent
  // belongs to the Student module and sweeps children, not exams. Binding it here would
  // put one agent under two modules with two run logs, which is the duplication the whole
  // AI Stack design refuses.
  boundAgent: null,
  noAgentReason:
    'Assessment data feeds the academic-risk agent through its detectors, but the Exam module itself has no agent of its own. Nothing here opens a case against an exam or a result.',

  operations: {
    exam_results_report: {
      key: 'exam_results_report',
      label: 'Exam results report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'result'],
    },
    exam_summary: {
      key: 'exam_summary',
      label: 'Exam results summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    exam_analysis: {
      key: 'exam_analysis',
      label: 'Exam results analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    exam_result_note_drafted: {
      key: 'exam_result_note_drafted',
      label: 'Result note to a family drafted',
      capability: 'generative',
      uses: 'prompt',
      // 'note' first, and it matters. These hints are matched against published prompt
      // keys in order, and the nearest wrong match is the cohort summary prompt, whose
      // grounding variables are `records` and `metrics`. A one-family note sends neither,
      // so falling through to the summary would refuse every draft for want of grounding.
      prefers: ['note', 'message', 'result'],
    },
    exam_agent_run: {
      key: 'exam_agent_run',
      label: 'Exam agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
