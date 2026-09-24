'use client';

/**
 * The Consent module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record: no child, no consent, no decision.
 *
 * AN EMPTY DECISION MEANS NOBODY HAS ANSWERED
 *
 * This is the PTM three-state rule again, and it matters more here, because the thing
 * being recorded is a parent's permission for their child. `consent_master.status` is
 * empty on every row in this estate, and the report screen renders that as "Pending" —
 * so the office's own meaning is "not answered yet", and it is never "refused".
 *
 * There are three states and never two: a decision is recorded, no decision is recorded,
 * or the consent does not exist for that student at all. Every published Consent prompt
 * forbids reporting the second as a decline, a denial or a parent saying no, and forbids
 * translating a recorded decision into words other than the ones the office entered.
 *
 * WHY CONSENT IS THE ONE MODULE HERE THAT REQUIRES REVIEW
 *
 * Both its published prompts carry `requires_review = 1`, which none of the other five in
 * this batch does. The others produce internal administrative summaries, where a mistake
 * is a mistake. This one can state that a family did or did not agree to something on
 * their child's behalf — and the underlying column is empty everywhere, so the error the
 * module is most likely to make is exactly the one nobody should publish unread.
 *
 * NOTHING EXPIRES
 *
 * `consent_master` records a date the consent was raised and nothing that lapses. It
 * records no reminder sent and no response time either. "Which consents are expiring
 * soon?" has no column behind it and the module says so rather than estimating.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const CONSENT_MODULE_KEY = 'consent';

/** The route the Consent AI Stack reports itself as when it builds a report. */
export const CONSENT_AI_STACK_ROUTE = '/modules/consent/ai-stack';

export const CONSENT_AI_STACK: AiStackModule = {
  key: CONSENT_MODULE_KEY,
  menuSlug: 'consent',
  label: 'Consent',
  records: 'consents',
  record: 'consent',
  route: CONSENT_AI_STACK_ROUTE,
  subjectEntityKey: 'consent',

  copy: {
    centralRisk:
      'a consent with no decision recorded has not been refused — nobody has answered it. The status column is empty on every row in this estate and the office reads that as "not answered yet", so a summary that reported it as a decline would put a refusal in a parent’s mouth about their own child. Every published Consent prompt carries the three-state rule, forbids translating a recorded decision into words the office did not use, and forbids describing anything as expiring or chased: this register records no expiry date and no reminder history at all.',
    policyNamePlaceholder: 'Consent handling policy',
    promptSystemDefault:
      'You summarise a consent register for a school office. Use only the consents you are given. A consent has THREE states, never two: a decision is recorded, no decision is recorded yet, or the consent does not exist for that student. An empty decision means NOBODY HAS ANSWERED — never report it as a refusal, a decline, a denial or a parent saying no. Where a decision is recorded, repeat the word the office entered rather than translating it. This register records no expiry and no reminder, so nothing is expiring, lapsed or overdue.',
    reportCanPrint:
      'the students, classes, titles and dates come from the consent register itself rather than from a model.',
    groundedOn: 'the consent records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Consent, so nothing here opens a case or chases anybody. The tool agents on the Automations tab still read the register and draft a reminder for a person to send.',
    capabilityWorkflow:
      'No workflow is bound to Consent. Recording a family’s answer stays a person’s act on the consent screen — and it has to, because nothing here may decide on a parent’s behalf.',
  },

  report: {
    defaultDataSource: 'consent.records',
    // Exactly the arguments `consent.records` accepts, from the tool's own schema.
    filters: [
      { key: 'student_id', label: 'Student id', kind: 'number', placeholder: 'all' },
      { key: 'standard_id', label: 'Standard id', kind: 'number', placeholder: 'all' },
      { key: 'division_id', label: 'Division id', kind: 'number', placeholder: 'all' },
      {
        key: 'decision',
        label: 'Decision state',
        kind: 'text',
        placeholder: 'any',
        hint: 'any, awaiting or recorded. "awaiting" means nobody has answered — not that anybody refused.',
      },
      { key: 'accountable_status', label: 'Accountability', kind: 'text', placeholder: 'all' },
      { key: 'from_date', label: 'Raised from', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'to_date', label: 'Raised to', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'consent_register_report',
    emptyNote:
      'No consents matched those filters, so no report was created. A class with no consents raised returns nothing rather than the whole school’s register.',
  },

  presets: [
    {
      name: 'Consent reader',
      description:
        'Reads consents and how many are still waiting for an answer. Changes nothing.',
      module: CONSENT_MODULE_KEY,
      tools_allowed: ['consent.records', 'consent.summary'],
      instructions:
        'Keep the three states apart in every sentence and every count. A consent with no decision recorded means nobody has answered: never call it refused, declined or denied. Where a decision exists, use the office’s own word for it. Never say a consent is expiring — nothing here records an expiry.',
      status: 'active',
    },
    {
      name: 'Consent reminder drafter',
      description:
        'Reads consents still waiting for an answer and drafts a reminder for a person to review before sending. Sends nothing.',
      module: CONSENT_MODULE_KEY,
      tools_allowed: ['consent.records', 'consent.draft_reminder'],
      instructions:
        'Draft a reminder that asks for an answer. It must not say or imply that the family has refused, ignored the school or done anything wrong — they have not answered, which is all anybody knows. Do not state a deadline unless you were given one; this register records none. The draft is for a person to read and send.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The register and its decision states are readable, but the Consent module has no agent manifest of its own. That is the right shape here: a consent is a decision a family makes, and there is nothing for an agent to conclude on their behalf.',

  operations: {
    consent_register_report: {
      key: 'consent_register_report',
      label: 'Consent register report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'register'],
    },
    consent_summary: {
      key: 'consent_summary',
      label: 'Consent summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    consent_analysis: {
      key: 'consent_analysis',
      label: 'Consents analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    consent_agent_run: {
      key: 'consent_agent_run',
      label: 'Consent agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
