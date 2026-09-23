'use client';

/**
 * The Certificate module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record: no certificate, no number, no child.
 *
 * TWO TABLES, TWO QUESTIONS
 *
 * `certificate_history` is what was issued; `template_master` is what a certificate looks
 * like. A school with a Bonafide layout and no Bonafide issued has an empty history and a
 * configured module, and the two reads are kept apart so the second is never read as the
 * first.
 *
 * THE PRINTED DOCUMENT NEVER REACHES A MODEL
 *
 * `certificate_history.certificate_html` holds the whole printed certificate — a child's
 * name, parents, conduct, dates, fee status. `certificate.issued` reports that the
 * document exists and never returns it, so no prompt and no report layout can quote or
 * paraphrase what a certificate says about a child.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const CERTIFICATE_MODULE_KEY = 'certificate';

/** The route the Certificate AI Stack reports itself as when it builds a report. */
export const CERTIFICATE_AI_STACK_ROUTE = '/modules/certificate/ai-stack';

export const CERTIFICATE_AI_STACK: AiStackModule = {
  key: CERTIFICATE_MODULE_KEY,
  menuSlug: 'certificate',
  label: 'Certificate',
  records: 'certificate records',
  record: 'certificate',
  route: CERTIFICATE_AI_STACK_ROUTE,
  subjectEntityKey: 'certificate',

  copy: {
    centralRisk:
      'the printed certificate text is stored but is never given to a model. Every published Certificate prompt carries a rule forbidding the model from quoting or paraphrasing what a certificate says about a child, and a second forbidding it from calling a certificate valid, pending or approved — the register records issue and nothing else. Issuing one stays a person’s act on the Certificate screen.',
    policyNamePlaceholder: 'Certificate issue policy',
    promptSystemDefault:
      'You answer questions about a certificate issue register for a school office. Use only the register rows you are given. If a type, a number, a student or a date is not in them, say so rather than estimating. You have not been given the printed certificate text: never quote, paraphrase or summarise what a certificate says about a child, and never state that a certificate is valid, invalid, approved or pending.',
    reportCanPrint: 'the certificate numbers and dates come from the register itself rather than from a model.',
    groundedOn: 'the issue register above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Certificate, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read the register.',
    capabilityWorkflow:
      'No workflow is bound to Certificate. Issuing one is a person’s act on the Certificate screen.',
  },

  report: {
    defaultDataSource: 'certificate.issued',
    // Exactly the arguments `certificate.issued` accepts, from the tool's own schema.
    filters: [
      { key: 'certificate_type', label: 'Type', kind: 'text', placeholder: 'all', hint: 'e.g. Transfer, Bonafide.' },
      { key: 'student_id', label: 'Student id', kind: 'number', placeholder: 'all' },
      { key: 'from_date', label: 'From date', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'to_date', label: 'To date', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'certificate_issue_register',
    emptyNote:
      'No certificates matched those filters, so no report was created. A type never issued this year returns nothing rather than the whole register.',
  },

  presets: [
    {
      name: 'Issue register reader',
      description:
        'Reads which certificates were issued this year, of which types and to whom. Changes nothing.',
      module: CERTIFICATE_MODULE_KEY,
      tools_allowed: ['certificate.issued'],
      instructions:
        'Report the register exactly as returned, with the whole year’s breakdown by type beside the rows listed. You are not given the printed certificate text — never describe what a certificate says. Never infer why a certificate was requested.',
      status: 'active',
    },
    {
      name: 'Certificate layout reader',
      description:
        'Reads which certificate layouts this school can issue from, and which are active. Changes nothing.',
      module: CERTIFICATE_MODULE_KEY,
      tools_allowed: ['certificate.templates'],
      instructions:
        'Report the layouts as returned, saying which are shared across the estate and which belong to this institute. A layout that exists is not a certificate that has been issued — keep the two apart.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Issued certificates and the available layouts are readable, but the Certificate module has no agent manifest of its own. Issuing a certificate produces a numbered, printed document and stays a person’s act.',

  operations: {
    certificate_issue_register: {
      key: 'certificate_issue_register',
      label: 'Certificate issue register',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'register'],
    },
    certificate_summary: {
      key: 'certificate_summary',
      label: 'Certificate summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    certificate_analysis: {
      key: 'certificate_analysis',
      label: 'Certificate register analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    certificate_agent_run: {
      key: 'certificate_agent_run',
      label: 'Certificate agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
