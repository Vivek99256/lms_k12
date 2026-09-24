'use client';

/**
 * The Parent Communication module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record.
 *
 * THIS IS THE INBOUND DIRECTION
 *
 * The Communication module (`easy_com`) is what the school SENDS — SMS, WhatsApp, app
 * notifications going out. This is what parents send IN: 22,729 messages across this
 * estate, each about one named child, often at length.
 *
 * Two tables, two directions, two modules. Neither binds the other's tools, and a count of
 * "messages" means something different in each — so no tab here ever gives one total for
 * both.
 *
 * AN EMPTY REPLY MEANS NOBODY HAS ANSWERED
 *
 * The same three-state rule Consent and PTM carry, and it matters more here because the
 * person waiting is a parent. A message with no reply has not been refused, declined or
 * dismissed. Every published prompt forbids reporting it as anything else and forbids
 * inferring why.
 *
 * A COHORT READ GETS NO MESSAGE BODIES
 *
 * The body is a letter from a named family about their child. `ParentCommunicationService`
 * does not SELECT it at all unless the read already names one student or one message — it
 * is withheld in the query rather than hidden afterwards — and the summary tool returns
 * none ever. Every published prompt forbids quoting, paraphrasing or characterising what a
 * parent wrote into anything a wider audience will read.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const PARENT_COMMUNICATION_MODULE_KEY = 'parent_communication';

/** The route the Parent Communication AI Stack reports itself as when it builds a report. */
export const PARENT_COMMUNICATION_AI_STACK_ROUTE = '/modules/parent-communication/ai-stack';

export const PARENT_COMMUNICATION_AI_STACK: AiStackModule = {
  key: PARENT_COMMUNICATION_MODULE_KEY,
  menuSlug: 'parent-communication',
  label: 'Parent Communication',
  records: 'messages from parents',
  record: 'parent message',
  route: PARENT_COMMUNICATION_AI_STACK_ROUTE,
  subjectEntityKey: 'parent_message',

  copy: {
    centralRisk:
      'a message with no reply means nobody has answered it yet — never that the school refused, declined or dismissed a parent. The second risk is the message body: it is a letter from a named family about their child, so the service does not even select it unless the read names one student or one message, and every published prompt forbids quoting or paraphrasing it into anything others will read. This is also the INBOUND direction and is not the Communication module, which records what the school sends; no tab here gives one total for both.',
    policyNamePlaceholder: 'Parent message handling policy',
    promptSystemDefault:
      'You summarise messages parents wrote to a school, for the school office. Use only the messages you are given. This is the INBOUND direction and is not the Communication module, which records what the school SENDS — never combine the two. A message with no reply means NOBODY HAS ANSWERED IT YET: never report it as refused, declined, dismissed or ignored, and never infer why. If you were given no message bodies, that is deliberate: never quote, paraphrase or guess what a parent wrote.',
    reportCanPrint: 'the titles, dates, students and reply states come from the register itself rather than from a model.',
    groundedOn: 'the message records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Parent Communication, so nothing here opens a case or answers a parent. The tool agents on the Automations tab still read the register and draft a reply for a person to review.',
    capabilityWorkflow:
      'No workflow is bound to Parent Communication. Answering a parent is a reply from the school to a family and stays a person’s act.',
  },

  report: {
    defaultDataSource: 'parent_communication.messages',
    // Exactly the arguments `parent_communication.messages` accepts, from the tool's own schema.
    filters: [
      { key: 'student_id', label: 'Student id', kind: 'number', placeholder: 'all', hint: 'Naming one student is also what makes the message body readable.' },
      { key: 'state', label: 'State', kind: 'text', placeholder: 'any', hint: 'any, answered or unanswered. Unanswered means nobody has replied — not a refusal.' },
      { key: 'from_date', label: 'Received from', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'to_date', label: 'Received to', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'search_text', label: 'Search', kind: 'text', placeholder: 'title', hint: 'Matches the title only, never the message body.' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'parent_message_report',
    emptyNote:
      'No messages from parents matched those filters, so no report was created. A period with nothing received returns nothing rather than the whole register.',
  },

  presets: [
    {
      name: 'Parent message reader',
      description:
        'Reads messages from parents and which are still waiting for a reply. Changes nothing.',
      module: PARENT_COMMUNICATION_MODULE_KEY,
      tools_allowed: ['parent_communication.messages', 'parent_communication.summary'],
      instructions:
        'A message with no reply means nobody has answered it yet — never say the school refused or ignored anybody. If you were not given message bodies, do not guess at them from the titles. Never combine these with what the school has sent; that is a different module.',
      status: 'active',
    },
    {
      name: 'Reply drafter',
      description:
        'Reads one family’s messages and drafts a reply for a person to review before sending. Sends nothing.',
      module: PARENT_COMMUNICATION_MODULE_KEY,
      tools_allowed: ['parent_communication.messages', 'parent_communication.draft_reply'],
      instructions:
        'Draft only from the message in front of you. Do not promise anything the school has not decided, do not apologise on the school’s behalf for something you were not told happened, and do not state a date or a decision you were not given. The draft is for a person to read, change and send.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Messages from parents and their reply states are readable, but the module has no agent manifest of its own. That is the right shape: answering a parent is the school speaking to a family, and there is nothing here for an agent to conclude on its behalf.',

  operations: {
    parent_message_report: {
      key: 'parent_message_report',
      label: 'Parent message register',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'register'],
    },
    parent_message_summary: {
      key: 'parent_message_summary',
      label: 'Parent message summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    parent_message_analysis: {
      key: 'parent_message_analysis',
      label: 'Parent messages analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    parent_message_agent_run: {
      key: 'parent_message_agent_run',
      label: 'Parent Communication agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
