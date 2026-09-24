'use client';

/**
 * The Institute module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record.
 *
 * THIS IS THE SHAPE OF THE SCHOOL, NOT ITS PEOPLE
 *
 * The module reads the academic structure — sections, standards, divisions — and the
 * departments beside it. It reads no enrolment, no fee, no result and no attendance, and
 * none of those modules' tools is bound here.
 *
 * So every published prompt forbids stating how many students or staff are in anything
 * unless that figure was given, forbids naming anybody, and forbids judging the structure
 * as good, efficient or appropriate — nothing records why a school is arranged the way it
 * is.
 *
 * WHY THE MODULE IS WORTH A STACK AT ALL
 *
 * Because "what is the shape of this school" is a real question with a real answer, and it
 * is the one the other modules' answers hang off: a class named here is the class a fee, a
 * mark and a register all refer to. Having it answerable from its own module means the
 * others do not have to widen their bindings to explain themselves.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const INSTITUTE_MODULE_KEY = 'institute';

/** The route the Institute AI Stack reports itself as when it builds a report. */
export const INSTITUTE_AI_STACK_ROUTE = '/modules/institute/ai-stack';

export const INSTITUTE_AI_STACK: AiStackModule = {
  key: INSTITUTE_MODULE_KEY,
  menuSlug: 'institute',
  label: 'Institute',
  records: 'academic structure records',
  record: 'academic structure record',
  route: INSTITUTE_AI_STACK_ROUTE,
  subjectEntityKey: 'academic_structure',

  copy: {
    centralRisk:
      'the module reads the shape of the school and not the people in it. No enrolment, fee, result or attendance tool is bound here, so every published prompt forbids stating how many students or staff are in anything without being given the figure, forbids naming anybody, and forbids judging the structure as good or efficient — nothing records why a school is arranged as it is.',
    policyNamePlaceholder: 'Institute structure policy',
    promptSystemDefault:
      'You summarise the academic structure of a school for an administrator. Use only the records you are given. This is the SHAPE of the institute, not its people: never state how many students or staff are in anything unless you were given that figure, and never name anybody. Do not judge the structure as good, efficient or appropriate. Enrolment, fees, results and attendance belong to other modules and you have not been given them.',
    reportCanPrint: 'the sections, standards and divisions come from the academic structure itself rather than from a model.',
    groundedOn: 'the structure records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Institute, so nothing here opens a case or changes a class. The tool agents on the Automations tab still read the structure.',
    capabilityWorkflow:
      'No workflow is bound to Institute. Adding or merging a division moves children between classes and stays an administrator’s act.',
  },

  report: {
    defaultDataSource: 'academics.structure',
    // Exactly the arguments `academics.structure` accepts, from the tool's own schema.
    filters: [
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'institute_structure_report',
    emptyNote:
      'No academic structure matched, so no report was created. An institute with nothing configured returns nothing rather than another school’s shape.',
  },

  presets: [
    {
      name: 'Structure reader',
      description:
        'Reads the sections, standards and divisions of this institute. Changes nothing.',
      module: INSTITUTE_MODULE_KEY,
      tools_allowed: ['academics.structure'],
      instructions:
        'This is the shape of the school and not a count of its people. Never say how many students or staff are in anything unless you were given that figure, never name anybody, and never judge the structure as good or efficient.',
      status: 'active',
    },
    {
      name: 'Department reader',
      description:
        'Reads the departments recorded for this institute. Changes nothing.',
      module: INSTITUTE_MODULE_KEY,
      tools_allowed: ['hr.departments', 'academics.structure'],
      instructions:
        'Report the departments as recorded. Do not state who works in one, how large it is, or how it compares to another — none of that is in front of you.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The academic structure and the departments are readable, but the Institute module has no agent manifest of its own. Nothing here is a decision an agent could reach: the shape of a school is set deliberately by the people who run it.',

  operations: {
    institute_structure_report: {
      key: 'institute_structure_report',
      label: 'Institute structure report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'structure'],
    },
    institute_summary: {
      key: 'institute_summary',
      label: 'Institute summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    institute_analysis: {
      key: 'institute_analysis',
      label: 'Institute structure analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    institute_agent_run: {
      key: 'institute_agent_run',
      label: 'Institute agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
