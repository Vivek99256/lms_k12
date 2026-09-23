'use client';

/**
 * The Complaint module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record.
 *
 * THE COLUMN CALLED `COMPLAINT_SOLUTION` IS THE STATUS FIELD
 *
 * This is the whole module in one sentence, and it is not guessable from the name. Across
 * the estate the column holds exactly two values — PENDING on 30 rows and COMPLETE on 5 —
 * and those are the two `complaint_status` rows for complaints. There is NO free-text
 * resolution anywhere on the table.
 *
 * So "how was this complaint resolved" cannot be answered, and a summary that read the
 * column as a solution would report every open complaint as having been solved with the
 * word "PENDING". Every published prompt forbids stating how a complaint was resolved,
 * what was done about it, or what was said to the person who raised it.
 *
 * WHAT ELSE IS NOT THERE
 *
 * No priority. No category. No severity. No due date, no SLA, and no escalation of any
 * kind. The obvious questions — which complaints are high priority, which need escalating,
 * which are breaching — have no column behind them, and the prompts forbid inventing one
 * or ranking complaints against each other. Age in days is arithmetic on the date and is
 * not a breach of anything, because nothing records what was promised.
 *
 * A complaint also names the person who made it, and that name does not belong in a
 * summary other people will read.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const COMPLAINT_MODULE_KEY = 'complaint';

/** The route the Complaint AI Stack reports itself as when it builds a report. */
export const COMPLAINT_AI_STACK_ROUTE = '/modules/complaint/ai-stack';

export const COMPLAINT_AI_STACK: AiStackModule = {
  key: COMPLAINT_MODULE_KEY,
  menuSlug: 'complaint',
  label: 'Complaint',
  records: 'complaints',
  record: 'complaint',
  route: COMPLAINT_AI_STACK_ROUTE,
  subjectEntityKey: 'complaint',

  copy: {
    centralRisk:
      'the column named COMPLAINT_SOLUTION is the status field, not a resolution — it holds only the words PENDING and COMPLETE across this whole estate — so a summary that read it as a solution would report every open complaint as solved. There is no resolution text anywhere, and no priority, severity, due date, SLA or escalation either, so nothing here may rank a complaint, call one urgent or say how any was resolved. A complaint names the person who raised it, and that name does not belong in a summary others will read.',
    policyNamePlaceholder: 'Complaint handling policy',
    promptSystemDefault:
      'You summarise a complaint register for a school office. Use only the complaints you are given. THE COLUMN NAMED COMPLAINT_SOLUTION IS THE STATUS FIELD: there is no resolution text anywhere, so never state how a complaint was resolved, what was done, or what was said to the person. This table records no priority, category, due date, SLA or escalation — never call a complaint urgent or in need of escalation, and never rank them. Do not repeat the name of the person who raised a complaint.',
    reportCanPrint: 'the complaints, dates and statuses come from the register itself rather than from a model.',
    groundedOn: 'the complaint records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Complaint, so nothing here opens a case, escalates or closes anything. The tool agents on the Automations tab still read the register.',
    capabilityWorkflow:
      'No workflow is bound to Complaint. Closing a complaint is a judgement about somebody’s grievance and stays a person’s act on the complaint screen.',
  },

  report: {
    defaultDataSource: 'complaints.list',
    // Exactly the arguments `complaints.list` accepts, from the tool's own schema.
    filters: [
      { key: 'state', label: 'State', kind: 'text', placeholder: 'any', hint: 'any, open or closed. Read from the status column, which is what COMPLAINT_SOLUTION holds.' },
      { key: 'user_group_id', label: 'Assigned group id', kind: 'number', placeholder: 'all' },
      { key: 'raised_by', label: 'Raised by (user id)', kind: 'number', placeholder: 'all' },
      { key: 'from_date', label: 'Raised from', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'to_date', label: 'Raised to', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'complaint_register_report',
    emptyNote:
      'No complaints matched those filters, so no report was created. A period with none raised returns nothing rather than the whole register.',
  },

  presets: [
    {
      name: 'Complaint register reader',
      description:
        'Reads complaints with their status and the group they sit with. Changes nothing.',
      module: COMPLAINT_MODULE_KEY,
      tools_allowed: ['complaints.list', 'complaints.summary'],
      instructions:
        'The status column is the only outcome recorded — there is no resolution text, so never say how anything was resolved. Never call a complaint urgent, high priority or in need of escalation; none of those is recorded. Do not repeat the name of the person who raised one.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The register and its counts are readable, but the Complaint module has no agent manifest of its own. That is the right shape: deciding a complaint is answered is a judgement about somebody’s grievance, and there is no resolution text here for an agent to reason over anyway.',

  operations: {
    complaint_register_report: {
      key: 'complaint_register_report',
      label: 'Complaint register report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'register'],
    },
    complaint_summary: {
      key: 'complaint_summary',
      label: 'Complaint summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    complaint_analysis: {
      key: 'complaint_analysis',
      label: 'Complaints analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    complaint_agent_run: {
      key: 'complaint_agent_run',
      label: 'Complaint agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
