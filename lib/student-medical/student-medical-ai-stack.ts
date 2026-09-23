'use client';

/**
 * The Student Medical module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record: no child, no complaint, no diagnosis.
 *
 * THIS IS THE MOST RESTRICTED MODULE IN THE PRODUCT, AND THE RESTRICTIONS ARE STRUCTURAL
 *
 * Four things are different here, and none of them is a wording choice:
 *
 *   1. NO DRAFTER. Every other module offers a tool that writes text. This one does not,
 *      because a drafter here would compose prose around a child's clinical record. There
 *      is no tool to allow, so no agent can be configured to do it.
 *   2. CLINICAL DETAIL IS WITHHELD FROM COHORT READS. `student_medical.visits` returns
 *      complaint, symptoms, disease and treatment only when the read names one student.
 *      That rule is in the service, not in a prompt, so a model never receives the text
 *      it is told not to repeat.
 *   3. EVERY PROMPT REQUIRES HUMAN REVIEW. The published prompts carry
 *      `requires_review = 1`, which no other module's cohort prompts do.
 *   4. NOTHING IS BOUND BOTH WAYS. The four medical tools appear in no other module's
 *      binding, and this module binds no student directory, no attendance and no
 *      academics — a clinical record is not a place to start browsing the school from.
 *
 * WHAT THE AI MAY ACTUALLY DO
 *
 * Report administrative facts: how many visits, when, which cases are still open, which
 * doctor attended, what is recorded. It may not diagnose, infer a condition, describe a
 * pattern across a child's visits, or call a child unwell. A clinical judgement is a
 * clinician's, and an absent record is an absent record — never evidence of health.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const STUDENT_MEDICAL_MODULE_KEY = 'student_medical';

/** The route the Student Medical AI Stack reports itself as when it builds a report. */
export const STUDENT_MEDICAL_AI_STACK_ROUTE = '/modules/student-medical/ai-stack';

export const STUDENT_MEDICAL_AI_STACK: AiStackModule = {
  key: STUDENT_MEDICAL_MODULE_KEY,
  menuSlug: 'student-medical',
  label: 'Student Medical',
  records: 'student medical records',
  record: 'infirmary visit',
  route: STUDENT_MEDICAL_AI_STACK_ROUTE,
  subjectEntityKey: 'student_medical_record',

  copy: {
    centralRisk:
      'this is clinical information about a child, and the AI may report administrative facts about it and nothing else. Every published Student Medical prompt forbids diagnosing, naming a condition not written in a record, describing a pattern across a child’s visits, or calling a student unwell or at risk — several visits is a count, not a finding. A student with no record has no record, which is never reported as healthy. Clinical detail is withheld by the read tool itself from any summary covering more than one student, and every prompt here requires a person to read the output before it is used.',
    policyNamePlaceholder: 'Student medical confidentiality policy',
    promptSystemDefault:
      'You summarise an infirmary visit register for a school office. You are not a clinician and this is not a clinical document. Use only the records you are given. NEVER diagnose, suggest a diagnosis, or name a condition that is not written in a record you were given. NEVER describe a pattern, trend or recurrence across a student’s visits, and never say a child is unwell, frail, at risk or frequently ill. A student with no record has no record — never report that as healthy. Do not name a student’s complaint, symptoms, disease or treatment in a summary covering more than one student. Do not recommend treatment, medication or exclusion from school.',
    reportCanPrint: 'the dates, case numbers and attending doctors come from the register itself rather than from a model.',
    groundedOn: 'the visit register above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Student Medical, and none should be: an agent that opened a case from a child’s clinical record would be making a judgement a clinician makes. The read-only tool agents on the Automations tab report what is recorded.',
    capabilityWorkflow:
      'No workflow is bound to Student Medical. A decision about a child’s health is taken by a clinician and the school office, not by a workflow.',
  },

  report: {
    defaultDataSource: 'student_medical.visits',
    // Exactly the arguments `student_medical.visits` accepts, from the tool's own schema.
    // Naming one student is what unlocks the clinical columns, and the hint says so.
    filters: [
      {
        key: 'student_id',
        label: 'Student id',
        kind: 'number',
        placeholder: 'all',
        hint: 'Naming one student includes the clinical detail.',
      },
      { key: 'from_date', label: 'From date', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'to_date', label: 'To date', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'open_only', label: 'Open cases only', kind: 'boolean', hint: 'No close date recorded.' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'student_medical_visit_register',
    emptyNote:
      'No infirmary visits matched those filters, so no report was created. That means none are recorded for this scope — it does not mean nobody was unwell.',
  },

  presets: [
    {
      name: 'Visit register reader',
      description:
        'Reads infirmary visits with the date, case number, doctor and whether the case is open. Changes nothing.',
      module: STUDENT_MEDICAL_MODULE_KEY,
      tools_allowed: ['student_medical.visits'],
      instructions:
        'Report only administrative facts: how many visits, when, which cases are open, which doctor attended. Never diagnose, never name a condition that is not written in a record you were given, and never describe a pattern across a child’s visits. Clinical detail is withheld by the tool unless the read names one student — do not ask for it and do not infer it.',
      status: 'active',
    },
    {
      name: 'Vaccination record reader',
      description:
        'Reads vaccinations recorded for students of this institute this year. Changes nothing.',
      module: STUDENT_MEDICAL_MODULE_KEY,
      tools_allowed: ['student_medical.vaccinations'],
      instructions:
        'Report what is recorded. A student with no row has no vaccination RECORDED — say exactly that, and never that the student is unvaccinated or non-compliant. Do not advise on a vaccination schedule.',
      status: 'active',
    },
    {
      name: 'Growth record reader',
      description:
        'Reads height and weight exactly as recorded, with no index derived from them. Changes nothing.',
      module: STUDENT_MEDICAL_MODULE_KEY,
      tools_allowed: ['student_medical.growth'],
      instructions:
        'Report the measurements as recorded. The columns carry no unit, so never calculate an index and never describe a child as under or over any weight. Do not comment on a child’s growth.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Visits, vaccinations, measurements and notes are readable by those the existing rights allow, but the Student Medical module has no agent manifest and should not have one: an agent that opened a case from a child’s clinical record would be making a judgement that belongs to a clinician.',

  operations: {
    student_medical_visit_register: {
      key: 'student_medical_visit_register',
      label: 'Infirmary visit register',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'visit'],
    },
    student_medical_summary: {
      key: 'student_medical_summary',
      label: 'Infirmary summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    student_medical_analysis: {
      key: 'student_medical_analysis',
      label: 'Infirmary register analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    student_medical_agent_run: {
      key: 'student_medical_agent_run',
      label: 'Student Medical agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
