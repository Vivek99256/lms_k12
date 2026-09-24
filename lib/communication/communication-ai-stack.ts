'use client';

/**
 * The Communication module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record: no message, no recipient, no count.
 *
 * WHY THE KEY IS `easy_com` AND THE SLUG IS `communication`
 *
 * `ai_modules` has carried `easy_com` since the workspace was seeded, with the route
 * patterns `/easy_com` and `/easy_com/**` — exactly where the Communication menu's five
 * send screens live. Registering a second `communication` module would split one module
 * across two keys: two policy scopes, two template lists, two ledgers, and a question
 * answered from whichever the page happened to resolve to.
 *
 * So the module key is the one the estate already has, and `communication` is the level-2
 * menu slug the AI Stack route carries. A route is how a URL is recognised; a key is what
 * a module is called. Neither has to match the other, and the same split is already true
 * of Admission/`admissions` and Student Request/`student_request`.
 *
 * WHAT THIS MODULE MUST NEVER CLAIM
 *
 * Of the four channels, only WhatsApp records a delivery outcome. The other three log that
 * a row was written, which is not the same as a message arriving — so nothing here may
 * report reach, receipt or an open rate for SMS or app notifications.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const COMMUNICATION_MODULE_KEY = 'easy_com';

/** The route the Communication AI Stack reports itself as when it builds a report. */
export const COMMUNICATION_AI_STACK_ROUTE = '/modules/communication/ai-stack';

export const COMMUNICATION_AI_STACK: AiStackModule = {
  key: COMMUNICATION_MODULE_KEY,
  menuSlug: 'communication',
  label: 'Communication',
  records: 'communication records',
  record: 'message',
  route: COMMUNICATION_AI_STACK_ROUTE,
  subjectEntityKey: 'communication_message',

  copy: {
    centralRisk:
      'of the four channels, only WhatsApp records what happened after a send. SMS and app notifications log that a message was submitted, which is not the same as one arriving — so every published Communication prompt carries a rule forbidding any claim that a message was received, read or opened, and forbidding a reach or open rate outright. None is recorded anywhere in this system.',
    policyNamePlaceholder: 'Parent communication policy',
    promptSystemDefault:
      'You answer questions about a school’s communication register for the front office. Use only the message records you are given. If a message, a recipient, a channel or a count is not in them, say so rather than estimating. Only WhatsApp records a delivery outcome: for SMS and app notifications never state or estimate that a message was received, read or opened, and never report a reach or open rate.',
    reportCanPrint: 'the messages and their dates come from the send logs themselves rather than from a model.',
    groundedOn: 'the send logs above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Communication, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read the register and draft text.',
    capabilityWorkflow:
      'No workflow is bound to Communication. Sending reaches every family in a class and stays a person pressing the button.',
  },

  report: {
    defaultDataSource: 'communication.messages',
    // Exactly the arguments `communication.messages` accepts, from the tool's own schema.
    filters: [
      {
        key: 'channel',
        label: 'Channel',
        kind: 'text',
        placeholder: 'all',
        hint: 'sms_parent, sms_staff, whatsapp or app_notification.',
      },
      { key: 'student_id', label: 'Student id', kind: 'number', placeholder: 'all' },
      { key: 'from_date', label: 'From date', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'to_date', label: 'To date', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'communication_register_report',
    emptyNote:
      'No messages matched those filters, so no report was created. A channel this school does not use returns nothing rather than the other channels’ messages.',
  },

  presets: [
    {
      name: 'Send register reader',
      description:
        'Reads what the school has sent across SMS, WhatsApp and app notifications, per channel. Changes nothing.',
      module: COMMUNICATION_MODULE_KEY,
      tools_allowed: ['easy_com.messages'],
      instructions:
        'Report the per-channel breakdown alongside any total, because the four logs do not record the same things. For every channel except WhatsApp the delivery status is null — say the send was logged, never that the message arrived.',
      status: 'active',
    },
    {
      name: 'Channel reader',
      description:
        'Reads which channels this school actually uses, and which record a delivery outcome. Changes nothing.',
      module: COMMUNICATION_MODULE_KEY,
      tools_allowed: ['easy_com.channels'],
      instructions:
        'Report each channel as returned, including whether it records a delivery outcome at all. A channel with no messages is unused here; a channel whose table is absent is not configured on this estate. Keep those two apart.',
      status: 'active',
    },
    {
      name: 'Message drafter',
      description:
        'Drafts a short message to families from the points you give it. Sends nothing and schedules nothing.',
      module: COMMUNICATION_MODULE_KEY,
      tools_allowed: ['easy_com.draft_message'],
      instructions:
        'Write plainly, in the school’s voice, at the lowest reasonable reading level. Say only what you are given: no date, venue, deadline or instruction that was not supplied. For SMS keep it tight and report the character count, because length costs money. Sending reaches every family in a class — leave it to a person.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Everything the school has sent is readable, per channel, but the Communication module has no agent manifest of its own. Only WhatsApp records whether a message arrived, so nothing here could detect a failed send on the other channels either.',

  operations: {
    communication_register_report: {
      key: 'communication_register_report',
      label: 'Communication register report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'register'],
    },
    communication_summary: {
      key: 'communication_summary',
      label: 'Communication summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    communication_analysis: {
      key: 'communication_analysis',
      label: 'Communication register analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    communication_message_drafted: {
      key: 'communication_message_drafted',
      label: 'Message to families drafted',
      capability: 'generative',
      uses: 'prompt',
      // 'draft' first — see the note in the Exam descriptor about why the order of these
      // hints decides whether a one-off draft is refused for want of grounding.
      prefers: ['draft', 'message', 'communication'],
    },
    communication_agent_run: {
      key: 'communication_agent_run',
      label: 'Communication agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
