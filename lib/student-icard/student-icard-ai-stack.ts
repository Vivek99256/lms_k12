'use client';

/**
 * The Student I-Card module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record: no child, no roll number, no photo.
 *
 * THE MODULE BOUNDARY, AND WHY IT IS DRAWN WHERE IT IS
 *
 * There is no `student_icard` table in this estate. A card is built from the enrolment
 * record plus, where the school uses it, the child's transport mapping. So the module's
 * records are "the students a card can be printed for, and the fields that card carries".
 *
 * `students.directory` is deliberately NOT bound to this module. `student_icard.roster`
 * returns a name, a class, a roll number, a photo, a blood group and a bus; the directory
 * returns admission dates, addresses and quota codes. Binding it here would make the
 * I-card module a second, ungoverned route into the student file for anybody who can print
 * a card. A card needs a face, a name and a class. It does not need a file.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const STUDENT_ICARD_MODULE_KEY = 'student_icard';

/** The route the Student I-Card AI Stack reports itself as when it builds a report. */
export const STUDENT_ICARD_AI_STACK_ROUTE = '/modules/student-i-card/ai-stack';

export const STUDENT_ICARD_AI_STACK: AiStackModule = {
  key: STUDENT_ICARD_MODULE_KEY,
  menuSlug: 'student-i-card',
  label: 'Student I-Card',
  records: 'identity card records',
  record: 'identity card',
  route: STUDENT_ICARD_AI_STACK_ROUTE,
  subjectEntityKey: 'student_icard',

  copy: {
    centralRisk:
      'a card missing a photo is a detail the office has not collected — not a child who may not have a card. Every published I-Card prompt carries a rule saying so, and a second forbidding the model from saying anything about a student beyond the fields the card itself prints. This module reads a name, a class, a roll number and a face; it is not a route into the student file, and the tool binding omits the student directory for exactly that reason.',
    policyNamePlaceholder: 'Identity card data policy',
    promptSystemDefault:
      'You answer questions about an identity-card print list for a school office. Use only the card records you are given. If a name, a roll number, a class or a count is not in them, say so rather than estimating. A missing photo or roll number is a detail the office has not collected, never a student who is not entitled to a card. A card carries a name, a class and a face — never say anything about the student beyond the fields you were given.',
    reportCanPrint: 'the roll numbers and classes come from the enrolment records themselves rather than from a model.',
    groundedOn: 'the card roster above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Student I-Card, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read the roster.',
    capabilityWorkflow:
      'No workflow is bound to Student I-Card. Printing a card is a person’s act on the I-card screen.',
  },

  report: {
    defaultDataSource: 'student_icard.roster',
    // Exactly the arguments `student_icard.roster` accepts, from the tool's own schema.
    filters: [
      { key: 'grade_id', label: 'Grade id', kind: 'number', placeholder: 'all' },
      { key: 'standard_id', label: 'Standard id', kind: 'number', placeholder: 'all' },
      { key: 'division_id', label: 'Division id', kind: 'number', placeholder: 'all' },
      {
        key: 'with_transport',
        label: 'Only students with a bus',
        kind: 'boolean',
        hint: 'Leave clear for every student.',
      },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'student_icard_print_list',
    emptyNote:
      'No students matched those filters, so no report was created. A class this institute does not have returns nothing rather than the whole school.',
  },

  presets: [
    {
      name: 'Print list reader',
      description:
        'Reads which students are ready for a card and which are missing a photo, roll number or class. Changes nothing.',
      module: STUDENT_ICARD_MODULE_KEY,
      tools_allowed: ['student_icard.roster'],
      instructions:
        'Report only the card fields the roster returns. Always state the whole cohort count beside the rows listed. A student in `missing_something` needs a detail collected — name which one. Never say anything about a child beyond those fields.',
      status: 'active',
    },
    {
      name: 'Card detail reader',
      description: "Reads one student's card fields and which of them are missing. Changes nothing.",
      module: STUDENT_ICARD_MODULE_KEY,
      tools_allowed: ['student_icard.card_details'],
      instructions:
        'Report the card fields exactly as recorded and name any that are missing. Do not state when a card was printed or issued — this system records no card history — and do not comment on the student.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The card roster and one student’s card fields are readable, but the Student I-Card module has no agent manifest of its own. This estate records no card issue history either, so nothing here could detect that a card was overdue.',

  operations: {
    student_icard_print_list: {
      key: 'student_icard_print_list',
      label: 'I-card print list',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'print'],
    },
    student_icard_summary: {
      key: 'student_icard_summary',
      label: 'I-card readiness summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    student_icard_analysis: {
      key: 'student_icard_analysis',
      label: 'I-card readiness analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    student_icard_agent_run: {
      key: 'student_icard_agent_run',
      label: 'Student I-Card agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
