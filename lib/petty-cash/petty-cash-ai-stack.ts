'use client';

/**
 * The Petty Cash module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record: no transaction, no amount, no head.
 *
 * TWO COLUMNS ARE MISSING AND BOTH OF THEM MATTER
 *
 * `petty_cash` carries a head, a description, an amount, a date, the user who entered it
 * and an optional scan of the bill. It does not carry:
 *
 *   · any approval — no approver, no approved-at, no rejection, and no approval table
 *     exists in this estate. Entering a spend IS the whole lifecycle.
 *   · any money coming in — no opening float, no top-up, no reimbursement. Summing the
 *     spends gives total spending, which is not a balance and must never be shown as one.
 *
 * Both are questions people will ask, and on a financial record an invented answer is the
 * most damaging kind. So every published Petty Cash prompt forbids the words pending,
 * awaiting approval, approved and rejected, forbids stating a balance or a remaining
 * amount, and forbids comparing the spending to a budget — none is recorded.
 *
 * WHY THE EXAMPLE POLICY LEAVES GENERATED ANSWERS OFF
 *
 * Because a generated answer about money, on a book with no approval trail behind it, is
 * the one output here worth refusing. Summarising and explaining are on; composing an
 * answer is not. Consent and Transport, whose deliverable really is a message somebody
 * sends, have it on — which is why those two have a drafter in this folder's sense and
 * this module does not.
 *
 * A MISSING BILL IS A MISSING DOCUMENT
 *
 * It is the only "needs attention" signal the table carries, and it is a fact about the
 * record rather than about the person who entered it. The prompts say so explicitly,
 * because a summary that called a transaction irregular would be an accusation the data
 * cannot support.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const PETTY_CASH_MODULE_KEY = 'petty_cash';

/** The route the Petty Cash AI Stack reports itself as when it builds a report. */
export const PETTY_CASH_AI_STACK_ROUTE = '/modules/petty-cash/ai-stack';

export const PETTY_CASH_AI_STACK: AiStackModule = {
  key: PETTY_CASH_MODULE_KEY,
  menuSlug: 'petty-cash',
  label: 'Petty Cash',
  records: 'petty cash transactions',
  record: 'petty cash transaction',
  route: PETTY_CASH_AI_STACK_ROUTE,
  subjectEntityKey: 'petty_cash_transaction',

  copy: {
    centralRisk:
      'the petty cash book records no approval of any kind and nothing that came in. There is no approver, no approved-at and no rejection, so nothing is ever awaiting approval; and there is no opening float, top-up or reimbursement, so a balance cannot be computed and must never be stated. Every published Petty Cash prompt forbids both, forbids the model adding figures up for itself when the totals are given to it, and forbids calling a transaction with no bill attached irregular — a missing bill is a missing document, not an accusation.',
    policyNamePlaceholder: 'Petty cash reporting policy',
    promptSystemDefault:
      'You summarise a petty cash book for a school office. Use only the transactions you are given and the totals already calculated for you — do not add figures up yourself. This book records NO approval of any kind: never describe a transaction as pending, awaiting approval, approved or rejected. It records NO float, top-up or reimbursement: never state a balance or how much is left. A missing bill is a missing document and never grounds for calling a transaction or a person irregular.',
    reportCanPrint:
      'the heads, amounts, dates and totals come from the book itself rather than from a model adding anything up.',
    groundedOn: 'the transactions and totals above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Petty Cash, so nothing here opens a case or drafts a recommendation — and with no approval recorded anywhere, there would be nothing for it to route. The tool agents on the Automations tab still read the book.',
    capabilityWorkflow:
      'No workflow is bound to Petty Cash. There is no approval step in this module to put anything to: a spend is recorded and that is the whole of it.',
  },

  report: {
    defaultDataSource: 'petty_cash.transactions',
    // Exactly the arguments `petty_cash.transactions` accepts, from the tool's own schema.
    filters: [
      { key: 'title_id', label: 'Head id', kind: 'number', placeholder: 'all' },
      { key: 'from_date', label: 'Spent from', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'to_date', label: 'Spent to', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'min_amount', label: 'Minimum amount', kind: 'number', placeholder: 'any' },
      {
        key: 'without_bill_only',
        label: 'Only spends with no bill on file',
        kind: 'boolean',
        defaultValue: false,
      },
      { key: 'search_text', label: 'Search', kind: 'text', placeholder: 'description or head' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'petty_cash_report',
    emptyNote:
      'No petty cash transactions matched those filters, so no report was created. A month with no spending returns nothing rather than the whole year’s book.',
  },

  presets: [
    {
      name: 'Spend reader',
      description:
        'Reads petty cash spends for a period or a head, with whether a bill is on file. Changes nothing.',
      module: PETTY_CASH_MODULE_KEY,
      tools_allowed: ['petty_cash.transactions'],
      instructions:
        'Report the spends as entered and use the total the tool gives you — it covers every matching transaction, not just the rows listed, so do not add the rows up yourself. There is no approval recorded anywhere in this book: never call anything pending or approved. Never state a balance. A missing bill is a missing document.',
      status: 'active',
    },
    {
      name: 'Spending summariser',
      description: 'Reads petty cash totalled by head and by month. Changes nothing.',
      module: PETTY_CASH_MODULE_KEY,
      tools_allowed: ['petty_cash.summary'],
      instructions:
        'Report the totals exactly as returned. `total_amount` is money recorded as going OUT — it is not a balance and there is no figure here for what is left, because nothing that came in is recorded. Do not compare the spending to a budget; none exists in this system.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Spends and their totals are readable, but the Petty Cash module has no agent manifest of its own — and nothing for one to do: with no approval recorded anywhere in this estate, there is no case to open and no decision to put to anybody.',

  operations: {
    petty_cash_report: {
      key: 'petty_cash_report',
      label: 'Petty cash report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report'],
    },
    petty_cash_summary: {
      key: 'petty_cash_summary',
      label: 'Petty cash summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    petty_cash_analysis: {
      key: 'petty_cash_analysis',
      label: 'Petty cash analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    petty_cash_agent_run: {
      key: 'petty_cash_agent_run',
      label: 'Petty Cash agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
