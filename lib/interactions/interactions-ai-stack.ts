'use client';

/**
 * The Interactions module's AI Stack declaration.
 *
 * NO UNIFIED TOUCHPOINT LOG EXISTED IN THIS ESTATE before `interaction_logs` was added
 * alongside this descriptor — a genuinely new table for calls, meetings, notes and
 * follow-ups with a student, parent or staff member. It starts empty; nothing is seeded.
 *
 * NOTHING HERE IS A RECORD. Every figure the tabs show is looked up at runtime from
 * `interaction_logs` and the shared AI Stack tables, scoped to the caller's institute.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const INTERACTIONS_MODULE_KEY = 'interactions';

export const INTERACTIONS_AI_STACK_ROUTE = '/modules/interactions/ai-stack';

export const INTERACTIONS_AI_STACK: AiStackModule = {
  key: INTERACTIONS_MODULE_KEY,
  menuSlug: 'interactions',
  label: 'Interactions',
  records: 'logged interactions',
  record: 'interaction',
  route: INTERACTIONS_AI_STACK_ROUTE,
  subjectEntityKey: 'interaction',

  copy: {
    centralRisk:
      'a logged interaction is one person’s note about one conversation, not a verified record of what was agreed or promised. Every published Interactions prompt carries a safety rule forbidding the model from treating a note as a commitment the school or family made, and from inferring anything about a student or parent beyond what the note itself says.',
    policyNamePlaceholder: 'Interactions communication policy',
    promptSystemDefault:
      'You answer questions about logged interactions — calls, meetings, notes and follow-ups — with students, parents and staff. Use only the interaction records you are given. If nothing is logged for the person or period asked about, say so rather than estimating. A note is one person’s record of one conversation, not a verified agreement.',
    reportCanPrint: 'the interactions come from the touchpoint log itself rather than from a model.',
    groundedOn: 'the logged interaction records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Interactions, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read the logged records.',
    capabilityWorkflow: 'No workflow is bound to Interactions, so nothing in this module pauses for an approval.',
  },

  report: {
    defaultDataSource: 'interactions.list',
    filters: [
      { key: 'related_type', label: 'About', kind: 'text', placeholder: 'all', hint: 'student, parent, staff or visitor' },
      { key: 'status', label: 'Status', kind: 'text', placeholder: 'all', hint: 'open or closed' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '50' },
    ],
    operation: 'interactions_list_report',
    emptyNote:
      'No interactions matched those filters, so no report was created. A school that has not started logging interactions yet sees this rather than a populated demo.',
  },

  presets: [
    {
      name: 'Interaction log reader',
      description: 'Reads logged interactions, filtered by who they are about or their status. Changes nothing.',
      module: INTERACTIONS_MODULE_KEY,
      tools_allowed: ['interactions.list'],
      instructions:
        'Report interactions exactly as logged, with the staff member, type and date. Never characterise the student, parent or staff member beyond what the note says.',
      status: 'active',
    },
    {
      name: 'Interaction summary reader',
      description: 'Reads interaction counts by type and which follow-ups are still open. Changes nothing.',
      module: INTERACTIONS_MODULE_KEY,
      tools_allowed: ['interactions.summary'],
      instructions: 'Report counts and open follow-ups exactly as returned.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Interactions has no case-opening agent yet; reports and conversational answers are grounded directly on the logged interaction records.',

  operations: {
    interactions_list_report: {
      key: 'interactions_list_report',
      label: 'Interaction log report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'interaction'],
    },
    interactions_summary: {
      key: 'interactions_summary',
      label: 'Interaction summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    interactions_communication_summary: {
      key: 'interactions_communication_summary',
      label: 'Communication summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['communication'],
    },
    interactions_followup_drafted: {
      key: 'interactions_followup_drafted',
      label: 'Interaction follow-up drafted',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['follow-up', 'followup'],
    },
    interactions_agent_run: {
      key: 'interactions_agent_run',
      label: 'Interactions agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
