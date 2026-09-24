'use client';

/**
 * The Users module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record.
 *
 * A DIFFERENT VIEW OF `tbluser` FROM THE ONE User I-Card READS
 *
 * Both modules sit on the same table. `user_icard` returns what an identity CARD prints;
 * this returns what an ACCOUNT has — profile, status, administrator and portal flags, the
 * join and expiry dates, and the last login. They overlap on name and profile because both
 * a card and an account have those, and neither reaches wider: each service selects an
 * explicit column list.
 *
 * WHAT NEITHER MAY REACH
 *
 * `tbluser` carries bank account and IFSC, PAN and Aadhaar, provident fund and ESIC
 * numbers, salary, every statutory deduction, a stored password, and termination and
 * notice reasons. None of it appears in either column list. A question about who has an
 * account must never become a way to read a colleague's salary.
 *
 * `last_login` IS THE ONLY ACTIVITY RECORDED, AND THAT IS THE MODULE'S REAL RISK
 *
 * There is no session log, no page view and no action history — one timestamp. So the
 * temptation is to read it as productivity, and every published prompt forbids that: never
 * how much anybody uses the system, never who is most or least active, never that somebody
 * is not doing their work.
 *
 * A null last login means no login has been RECORDED. On one live institute that is all
 * 397 accounts, which almost certainly means the column was never populated rather than
 * that nobody has ever signed in — and the prompts say so.
 *
 * Both published prompts carry `requires_review`, the only module in its batch that does,
 * because this output is about named colleagues.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const USERS_MODULE_KEY = 'user';

/** The route the Users AI Stack reports itself as when it builds a report. */
export const USERS_AI_STACK_ROUTE = '/modules/user/ai-stack';

export const USERS_AI_STACK: AiStackModule = {
  key: USERS_MODULE_KEY,
  menuSlug: 'user',
  label: 'Users',
  records: 'user accounts',
  record: 'user account',
  route: USERS_AI_STACK_ROUTE,
  subjectEntityKey: 'user_account',

  copy: {
    centralRisk:
      'the last login is the only activity this system records — no session log, no page view, no action history — and reading one timestamp as productivity is the mistake this module exists to prevent. Every published prompt forbids saying how much anybody uses the system, who is most or least active, or that anybody is not doing their work, and forbids ranking colleagues at all. A null last login means no login was RECORDED, which on one live institute is all 397 accounts. The staff record also holds salary, bank, PAN and Aadhaar columns that no tool here can return.',
    policyNamePlaceholder: 'User account reporting policy',
    promptSystemDefault:
      'You summarise ERP user accounts for a school administrator. Use only the accounts you are given. You have ACCOUNT fields only — the staff record also holds salary, bank, PAN, Aadhaar and contract details that you have not been given and must never refer to. `last_login` is the ONLY activity recorded: never say how much anybody uses the system, who is most or least active, or that anybody is not doing their work, and never rank colleagues. A null last login means no login was RECORDED and is not proof anybody has never signed in.',
    reportCanPrint: 'the names, usernames, profiles and statuses come from the account records themselves rather than from a model.',
    groundedOn: 'the account records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Users, so nothing here opens a case, disables an account or changes a right. The tool agents on the Automations tab still read the register.',
    capabilityWorkflow:
      'No workflow is bound to Users. Creating, disabling or re-profiling an account changes what a colleague can do and stays an administrator’s act.',
  },

  report: {
    defaultDataSource: 'user_accounts.directory',
    // Exactly the arguments `user_accounts.directory` accepts, from the tool's own schema.
    filters: [
      { key: 'user_profile_id', label: 'Profile id', kind: 'number', placeholder: 'all' },
      { key: 'department_id', label: 'Department id', kind: 'number', placeholder: 'all' },
      { key: 'include_inactive', label: 'Include inactive accounts', kind: 'boolean', defaultValue: false, hint: 'Inactive accounts are excluded by default.' },
      { key: 'never_logged_in_only', label: 'Only accounts with no login recorded', kind: 'boolean', defaultValue: false, hint: 'A missing last login is a missing record, not proof nobody signed in.' },
      { key: 'administrators_only', label: 'Only administrators', kind: 'boolean', defaultValue: false },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'user_account_report',
    emptyNote:
      'No accounts matched those filters, so no report was created. A profile nobody is assigned to returns nothing rather than the whole staff list.',
  },

  presets: [
    {
      name: 'Account register reader',
      description:
        'Reads which accounts exist, their profiles and their status. Changes nothing.',
      module: USERS_MODULE_KEY,
      tools_allowed: ['user_accounts.directory'],
      instructions:
        'Report account fields only — you will not be given salary, bank, PAN or Aadhaar and must never ask for them. The last login is the only activity recorded: never say how much anybody uses the system and never rank colleagues. A null last login means no login was recorded.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The account register is readable, but the Users module has no agent manifest of its own. Nor should it act: disabling or re-profiling an account changes what a colleague can do, and the one activity column here could not justify it.',

  operations: {
    user_account_report: {
      key: 'user_account_report',
      label: 'User account register',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'register'],
    },
    user_account_summary: {
      key: 'user_account_summary',
      label: 'User account summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    user_account_analysis: {
      key: 'user_account_analysis',
      label: 'User accounts analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    user_account_agent_run: {
      key: 'user_account_agent_run',
      label: 'Users agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
