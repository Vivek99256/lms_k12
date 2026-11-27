'use client';

/**
 * Descriptor that lets the Fees Automations tab use the same generic AI Stack layout as the other
 * modules (pipeline card, "<module> tool agents", "<module> agent management").
 *
 * Nothing here is data. The presets name tools that exist in `lib/agents/registry.ts`; the agents
 * shown, their statuses and their runs are fetched live from the Agent Management engine
 * (module = "fees"). The presets are exactly the read/draft tools the Fees pipeline itself calls.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

import { FEES_MODULE, FEES_OPERATIONS } from './fees-ai-stack';

export const FEES_AI_STACK: AiStackModule = {
  key: FEES_MODULE,
  menuSlug: 'fees',
  label: 'Fees',
  records: 'fee ledger entries',
  record: 'fee ledger entry',
  route: '/fees/ai-stack',
  subjectEntityKey: 'fee_student',

  copy: {
    centralRisk:
      'a fee balance is money a family owes or has paid. The assistant must never state an amount that is not in the fee ledger, never send a reminder without an administrator approving the exact draft, and never characterise a family from a balance.',
    policyNamePlaceholder: 'Fee reminder policy',
    promptSystemDefault:
      'You answer questions about fee demand, collections, pending fees and reminders for a school administrator. Use only the records you are given. If a student, a head or an amount is not in them, say so rather than estimating.',
    reportCanPrint: 'the amounts come from the fee ledger itself rather than from a model.',
    groundedOn: 'the fee ledger and receipts above, which are the stronger ground of the two.',
    capabilityAgent:
      'The Fees agents read the ledger, receipts and reminder history, and draft reminders. They cannot collect, cancel or send anything themselves.',
    capabilityWorkflow: 'A drafted reminder batch must be approved by a person before anything is sent.',
  },

  report: {
    defaultDataSource: 'fees.collection_report',
    filters: [
      { key: 'standard_id', label: 'Standard id', kind: 'number', placeholder: 'all' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '25' },
    ],
    operation: 'fee_report',
    emptyNote: 'No fee records matched those filters, so no report was created.',
  },

  // The three agents the Fees pipeline actually runs, in execution order. Names match the agents
  // registered for module "fees" (agt_fees_position_reader, agt_fees_evidence_analyst,
  // agt_fees_reminder_drafter); `agentNames` hides every other agent in that module.
  presets: [
    {
      name: 'Fee position & arrears reader',
      description: 'Step 1 of the Fees pipeline. Reads the school-wide fee ledger and scans for students who owe, always stating how many it checked. Changes nothing.',
      module: FEES_MODULE,
      tools_allowed: ['fees.position'],
      instructions: 'Report ledger totals and students with arrears exactly as returned, with how many were checked.',
      status: 'active',
    },
    {
      name: 'Collection evidence & reminder history analyst',
      description: 'Step 2 of the Fees pipeline. Corroborates each student who owes with line items and recent collections, and holds back anyone already reminded. Changes nothing.',
      module: FEES_MODULE,
      tools_allowed: ['fees.getPending'],
      instructions: 'Report pending fee heads, recent receipts and prior reminders exactly as recorded.',
      status: 'active',
    },
    {
      name: 'Fee reminder drafter (pipeline)',
      description: 'Step 3 of the Fees pipeline. Prepares the reminder list for the students cleared by Step 2 and stops for an administrator to approve. Sends nothing.',
      module: FEES_MODULE,
      tools_allowed: ['fees.send_reminders'],
      instructions: 'Draft factual, courteous reminders from recorded balances only. Preview only; never send.',
      status: 'active',
    },
  ],

  agentNames: ['Fee position & arrears reader', 'Collection evidence & reminder history analyst', 'Fee reminder drafter (pipeline)'],

  boundAgent: null,
  noAgentReason:
    'Fees runs its own sequential three-agent pipeline (arrears reader, evidence analyst, reminder drafter), shown above.',

  operations: FEES_OPERATIONS,
};
