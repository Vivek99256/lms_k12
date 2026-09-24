'use client';

/**
 * The User I-Card module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record: no member of staff, no employee number.
 *
 * THIS IS THE STAFF CARD. `student_icard` IS A DIFFERENT MODULE.
 *
 * Both print an identity card and neither can reach the other's records: Student I-Card
 * reads `tblstudent`, this reads `tbluser`, and the two are bound to different tools in
 * `config/ai.php`. A question asked on one module's screen cannot be answered from the
 * other's table.
 *
 * THE RISK HERE IS THE TABLE THIS MODULE SITS ON
 *
 * `tbluser` is the staff master record. Beside the six fields a card prints it carries
 * bank account and IFSC, PAN and Aadhaar, provident fund and ESIC numbers, salary, every
 * statutory deduction, termination and notice reasons, and a stored password.
 *
 * None of it is readable through this module. `UserIcardService` selects an explicit
 * column list and the two bound tools return nothing else — so the restriction lives in
 * the query rather than in a prompt rule that a cleverly worded question could talk its
 * way past.
 *
 * NO CARD EXPIRY EXISTS ANYWHERE IN THIS ESTATE
 *
 * The natural question is "whose card has expired", and there is no column for it: no card
 * issue date, no card expiry, no print history. `tbluser.expire_date` is the ERP ACCOUNT
 * expiry, which is a different fact about a different thing, and every prompt says so.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const USER_ICARD_MODULE_KEY = 'user_icard';

/** The route the User I-Card AI Stack reports itself as when it builds a report. */
export const USER_ICARD_AI_STACK_ROUTE = '/modules/user-i-card/ai-stack';

export const USER_ICARD_AI_STACK: AiStackModule = {
  key: USER_ICARD_MODULE_KEY,
  menuSlug: 'user-i-card',
  label: 'User I-Card',
  records: 'staff identity cards',
  record: 'staff identity card',
  route: USER_ICARD_AI_STACK_ROUTE,
  subjectEntityKey: 'user_icard',

  copy: {
    centralRisk:
      'this module reads the staff master record, which holds bank, PAN, Aadhaar, provident fund, salary and contract details alongside the six fields a card actually prints. Only the card fields are readable — the restriction is an explicit column list in the service, not a prompt rule — and every published User I-Card prompt forbids referring to, estimating or asking about anything else. The second risk is quieter: no card issue date, card expiry or print history exists anywhere in this estate, so nothing may say a card has expired or is due for renewal. The account expiry on a staff record is a different fact about a different thing.',
    policyNamePlaceholder: 'Staff I-Card data policy',
    promptSystemDefault:
      'You summarise a staff identity-card print list for a school office. Use only the card fields you are given. The staff record also holds salary, bank, PAN, Aadhaar and contract details — you have not been given any of them and must never refer to, estimate or ask about them. A missing photograph or employee number is a detail the office has not collected, not a person who may not have a card. This estate records no card issue date, expiry or print history: never say a card has expired or is due for renewal.',
    reportCanPrint:
      'the names, employee numbers, profiles and departments come from the staff records themselves rather than from a model.',
    groundedOn: 'the card fields above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to User I-Card, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read the print list.',
    capabilityWorkflow:
      'No workflow is bound to User I-Card. Printing a card stays a person’s act on the I-Card screen.',
  },

  report: {
    defaultDataSource: 'user_icard.roster',
    // Exactly the arguments `user_icard.roster` accepts, from the tool's own schema.
    filters: [
      { key: 'user_profile_id', label: 'Profile id', kind: 'number', placeholder: 'all' },
      { key: 'department_id', label: 'Department id', kind: 'number', placeholder: 'all' },
      {
        key: 'missing_photo_only',
        label: 'Only staff with no photograph',
        kind: 'boolean',
        defaultValue: false,
      },
      {
        key: 'account_expired_only',
        label: 'Only staff whose ERP account expiry has passed',
        kind: 'boolean',
        defaultValue: false,
        hint: 'The account expiry on the staff record. This estate records no card expiry at all.',
      },
      { key: 'search_text', label: 'Search', kind: 'text', placeholder: 'name or employee number' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'user_icard_print_list',
    emptyNote:
      'No staff matched those filters, so no report was created. A profile with nobody in it returns nothing rather than the whole staff list.',
  },

  presets: [
    {
      name: 'Print list reader',
      description:
        'Reads which staff are ready for a card and which are missing a photograph, an employee number or a profile. Changes nothing.',
      module: USER_ICARD_MODULE_KEY,
      tools_allowed: ['user_icard.roster'],
      instructions:
        'Report only the card fields. You will not be given salary, bank, PAN, Aadhaar or contract details and must never ask for them or guess at them. A missing photograph is a detail the office has not collected — never describe it as somebody who may not have a card. Do not say when any card was printed; nothing records it.',
      status: 'active',
    },
    {
      name: 'Card detail reader',
      description:
        'Reads one member of staff’s card fields, and the print list they came from. Changes nothing.',
      module: USER_ICARD_MODULE_KEY,
      tools_allowed: ['user_icard.roster', 'user_icard.card_details'],
      instructions:
        'Read one person at a time and report only what a card prints. An id belonging to another institute comes back not-found; say so rather than searching for a near match. Never comment on the person beyond the fields in front of you.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The print list and one member of staff’s card fields are readable, but the User I-Card module has no agent manifest of its own. With no card issue or expiry recorded anywhere, there is also no renewal for an agent to chase.',

  operations: {
    user_icard_print_list: {
      key: 'user_icard_print_list',
      label: 'Staff I-Card print list',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'print'],
    },
    user_icard_summary: {
      key: 'user_icard_summary',
      label: 'Staff card summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    user_icard_analysis: {
      key: 'user_icard_analysis',
      label: 'Staff card readiness analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    user_icard_agent_run: {
      key: 'user_icard_agent_run',
      label: 'User I-Card agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
