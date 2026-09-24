'use client';

/**
 * The Quality assurance module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record.
 *
 * NOTHING HERE SCORES A SCHOOL
 *
 * SQAA is an accreditation framework: criteria, the documents each asks for, and the
 * evidence uploaded against them. The obvious question is "how are we doing", and this
 * module must not answer it. No rubric, weighting or grade boundary is recorded anywhere,
 * and the marks table holds six rows across the whole estate.
 *
 * So every published prompt forbids stating a score, a rating, a band, a percentage of
 * readiness, or that the school is ready for assessment — and forbids judging whether a
 * piece of evidence is good enough, which is an assessor's judgement made after reading a
 * document the model has not seen.
 *
 * THE TWO FIGURES BELONG TOGETHER
 *
 * 1,534 document slots are defined across this estate and 86 evidence rows exist against
 * them. Quoted alone, "86 documents uploaded" reads as progress; quoted together, the two
 * numbers say what is actually true. Every tab reports both.
 *
 * `marked_available` AND `file_attached` ARE DIFFERENT FACTS
 *
 * A row can be ticked available with no file, and carry a file while ticked otherwise.
 * Both are reported and neither stands for the other.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const SQAA_MODULE_KEY = 'sqaa';

/** The route the Quality assurance AI Stack reports itself as when it builds a report. */
export const SQAA_AI_STACK_ROUTE = '/modules/sqaa/ai-stack';

export const SQAA_AI_STACK: AiStackModule = {
  key: SQAA_MODULE_KEY,
  menuSlug: 'sqaa',
  label: 'Quality assurance',
  records: 'quality assurance evidence records',
  record: 'evidence record',
  route: SQAA_AI_STACK_ROUTE,
  subjectEntityKey: 'sqaa_evidence',

  copy: {
    centralRisk:
      'this is an accreditation framework, and the question everybody wants answered — how ready are we — is the one it must refuse. No rubric, weighting or grade boundary exists anywhere and the marks table holds six rows estate-wide, so every published prompt forbids stating a score, a rating, a band or a readiness, and forbids judging whether any piece of evidence is good enough. The 1,534 document slots must also always be reported beside the handful of uploads: a count of evidence quoted alone reads as progress when it is mostly absence.',
    policyNamePlaceholder: 'Quality assurance evidence policy',
    promptSystemDefault:
      'You summarise quality assurance evidence for a school quality team. Use only the records you are given. NOTHING HERE SCORES A SCHOOL: no rubric, weighting or grade boundary is recorded anywhere, so never state a score, rating, band, percentage of readiness, or that the school is ready for assessment, and never judge whether a piece of evidence is good enough. Always report the number of document slots beside the number of uploads.',
    reportCanPrint: 'the criteria, slots and uploads come from the framework itself rather than from a model.',
    groundedOn: 'the evidence records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Quality assurance, so nothing here opens a case or judges readiness. The tool agents on the Automations tab still read the criteria and the evidence.',
    capabilityWorkflow:
      'No workflow is bound to Quality assurance. Submitting evidence for accreditation is a decision the school makes about itself.',
  },

  report: {
    defaultDataSource: 'sqaa.evidence',
    // Exactly the arguments `sqaa.evidence` accepts, from the tool's own schema.
    filters: [
      { key: 'menu_id', label: 'Criterion menu id', kind: 'number', placeholder: 'all' },
      { key: 'search_text', label: 'Search', kind: 'text', placeholder: 'evidence or slot title' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'sqaa_evidence_report',
    emptyNote:
      'No evidence matched those filters, so no report was created. Most document slots in this estate have no evidence against them, so an empty result is expected rather than wrong.',
  },

  presets: [
    {
      name: 'Evidence reader',
      description:
        'Reads the evidence uploaded against the quality assurance document slots. Changes nothing.',
      module: SQAA_MODULE_KEY,
      tools_allowed: ['sqaa.evidence'],
      instructions:
        'Always report the number of document slots beside the number of uploads — a count of evidence alone reads as progress when most slots are empty. `marked_available` is what somebody ticked and `file_attached` is whether a file is there; never treat one as the other. Never score the school.',
      status: 'active',
    },
    {
      name: 'Criteria reader',
      description:
        'Reads the quality assurance criteria tree by level. Changes nothing.',
      module: SQAA_MODULE_KEY,
      tools_allowed: ['sqaa.criteria'],
      instructions:
        'Report the criteria as recorded. There is no rubric, weighting or grade boundary anywhere in this system, so never rank criteria by importance, state how many marks anything is worth, or say how the school would perform against any of them.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The criteria and the uploaded evidence are readable, but the module has no agent manifest of its own — and should not: judging a school against an accreditation framework is an assessor’s work, and nothing here records the rubric it would need.',

  operations: {
    sqaa_evidence_report: {
      key: 'sqaa_evidence_report',
      label: 'Quality assurance evidence register',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'register'],
    },
    sqaa_summary: {
      key: 'sqaa_summary',
      label: 'Quality assurance summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    sqaa_analysis: {
      key: 'sqaa_analysis',
      label: 'Quality assurance evidence analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    sqaa_agent_run: {
      key: 'sqaa_agent_run',
      label: 'Quality assurance agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
