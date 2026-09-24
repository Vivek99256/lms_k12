/**
 * Module catalogue: Fees.
 *
 * The second module the converter standardises against, and the reason
 * `sop-catalog.ts` was written to hold a shape rather than a single module.
 * Everything here follows the LMS + PAL catalogue exactly - a header block,
 * lifecycle stages, business rules, a records register and a procedure index -
 * so the parser, the task derivation, the storage envelope and all four
 * conversion screens work on Fees with no branch anywhere.
 *
 * The procedure index is not invented. It is the Fees module as this repo
 * actually ships it, group by group: the masters under `app/fees/master`
 * (fee titles, config, break-off, additional-fees mapping, receipt books), the
 * counter at `app/fees/collect`, the online route at
 * `app/fees/online_fees_collect` and `app/fees/online-payment`, the four-step
 * NACH exchange (`app/fees/NACH_s1..s4`), cancellation and refund
 * (`app/fees/cancel-refund`, `app/fees/other_fees_cancel`), reconciliation and
 * the report set under `app/fees/reports`, teacher dues, circulars, and the AI
 * stack. A procedure that has no screen behind it is not listed.
 *
 * Actors are the same five acting modes as everywhere else - they encode who
 * decides, not who is employed - but a fees counter does not have teachers and
 * learners, so the module restates them in `vocabulary`: the staff actor is a
 * fees officer, the self-service actor is the parent.
 */

import { procedureIndex, type SopModule } from './sop-catalog'
import type { BusinessRule } from './types'

/**
 * Fees SOP section 8.
 *
 * Numbered BR-nn like every module's rules, and scoped to this module - the
 * parser resolves a citation against the module being converted, so Fees BR-04
 * and LMS + PAL BR-04 never meet. Two positions are reserved by the code
 * itself: BR-07 and BR-08 are the AI-governance pair that every procedure with
 * an AI actor inherits whether or not its step table cites them.
 */
const FEES_RULES: BusinessRule[] = [
  {
    id: 'BR-01',
    rule: 'A fee head cannot be demanded or collected unless it is mapped to the active academic year and to the student’s standard.',
    appliesAt: 'Demand generation and counter collection',
    enforcement: 'System',
    failureBehaviour: 'The head is not offered; the missing mapping is named to the officer.',
  },
  {
    id: 'BR-02',
    rule: 'A receipt number is issued from the configured receipt book series and is never reused, even after a cancellation.',
    appliesAt: 'Receipt issue',
    enforcement: 'System',
    failureBehaviour: 'Issue is blocked; the counter’s receipt book and its exhausted series are named.',
  },
  {
    id: 'BR-03',
    rule: 'A payment may not exceed the outstanding balance of the selected fee heads.',
    appliesAt: 'Payment capture',
    enforcement: 'System',
    failureBehaviour: 'The amount is refused and the outstanding balance is restated.',
  },
  {
    id: 'BR-04',
    rule: 'A part payment is allocated to the oldest outstanding instalment first.',
    appliesAt: 'Payment allocation',
    enforcement: 'System',
    failureBehaviour: 'Allocation is refused; the ledger is left unchanged.',
  },
  {
    id: 'BR-05',
    rule: 'A concession, waiver or discount above the configured limit takes effect only after approval.',
    appliesAt: 'Concession apply',
    enforcement: 'System',
    failureBehaviour: 'The concession is held pending approval and the demand is unchanged.',
  },
  {
    id: 'BR-06',
    rule: 'An issued receipt may not be edited; a correction is a cancellation with a recorded reason plus a new, logged receipt.',
    appliesAt: 'Receipt correction',
    enforcement: 'System',
    failureBehaviour: 'The edit is refused; the cancellation workflow is required.',
  },
  {
    id: 'BR-07',
    rule: 'AI output may never be written to a fee record, a receipt or a parent-facing message without an explicit human Apply.',
    appliesAt: 'Every AI interaction',
    enforcement: 'System',
    failureBehaviour: 'The proposal is held in preview; no record is changed.',
  },
  {
    id: 'BR-08',
    rule: 'AI output below the configured confidence threshold is presented as a proposal only, never pre-applied.',
    appliesAt: 'Every AI interaction',
    enforcement: 'System',
    failureBehaviour: 'The proposal is shown with a low-confidence warning.',
  },
  {
    id: 'BR-09',
    rule: 'A refund is paid only against a cancelled receipt, and only to the payer of record.',
    appliesAt: 'Refund issue',
    enforcement: 'System',
    failureBehaviour: 'The refund is blocked; the receipt and its payer are named.',
  },
  {
    id: 'BR-10',
    rule: 'A user may read and collect fees only for the standards and divisions allocated to them.',
    appliesAt: 'Every fee-record read',
    enforcement: 'System',
    failureBehaviour: 'Access is refused with an authorisation error and an audit entry.',
  },
  {
    id: 'BR-11',
    rule: 'A cheque, NACH debit or gateway payment is credited to the ledger only once the bank or gateway confirms clearance.',
    appliesAt: 'Clearance posting',
    enforcement: 'System',
    failureBehaviour: 'The payment is held as uncleared and the receipt is marked pending clearance.',
  },
  {
    id: 'BR-12',
    rule: 'Fee data is scoped to the active academic year; records from other years are read-only.',
    appliesAt: 'Fees workspace and reports',
    enforcement: 'System',
    failureBehaviour: 'Out-of-year records are shown read-only.',
  },
  {
    id: 'BR-13',
    rule: 'A day’s collection may not be closed while a reconciliation exception is open.',
    appliesAt: 'Day-end closing',
    enforcement: 'System',
    failureBehaviour: 'Closing is blocked; the open exceptions are listed.',
  },
  {
    id: 'BR-14',
    rule: 'A late fee is applied by the system on the configured grace date, and may be waived only with a recorded reason.',
    appliesAt: 'Late-fee application',
    enforcement: 'System',
    failureBehaviour: 'The waiver is refused until a reason is recorded.',
  },
]

export const FEES_MODULE: SopModule = {
  key: 'fees',
  name: 'Fees',
  sop: {
    document: 'Fees SOP',
    version: '1.0',
    organization: 'Anand Niketan',
    effectiveDate: '25 Aug 2026',
  },
  lifecycleStages: [
    'Plan',
    'Assign',
    'Notify',
    'Collect',
    'Correct',
    'Reconcile',
    'Recover',
    'Report & govern',
  ],
  businessRules: FEES_RULES,
  records: [
    'Fee head, fee title and fee configuration masters',
    'Fee structure break-off per standard and per student',
    'Concession, waiver and discount records with their approvals',
    'Term fee demand and instalment schedule',
    'Fee receipts and their numbering series',
    'Part-payment allocation and ledger entries',
    'Other-fees receipts',
    'Online payment transactions and gateway callbacks',
    'NACH mandates, presentation files and bank responses',
    'Cancellation, refund and correction records with reasons',
    'Day-end collection and bank reconciliation statements',
    'Defaulter lists, follow-up notes and instalment agreements',
    'Fee circulars, reminders and the parent communication log',
    'AI proposal, preview and acceptance log',
  ],
  vocabulary: {
    actorLabels: {
      teacher: 'Fees officer',
      teacher_ai: 'Fees officer + AI',
      student: 'Parent',
      student_ai: 'Parent + AI',
    },
    // What a Fees SOP actually calls its people, mapped onto the acting mode
    // each of them is. The canonical five still parse; these are additions.
    actorAliases: {
      accountant: 'teacher',
      cashier: 'teacher',
      'fees officer': 'teacher',
      'fee officer': 'teacher',
      'fees clerk': 'teacher',
      'accounts officer': 'teacher',
      'fees administrator': 'teacher',
      'fees officer + ai': 'teacher_ai',
      'accountant + ai': 'teacher_ai',
      'cashier + ai': 'teacher_ai',
      parent: 'student',
      guardian: 'student',
      'parent + ai': 'student_ai',
      'guardian + ai': 'student_ai',
    },
    executionLabels: { learner: 'Performed by the parent' },
    owners: { staff: 'Fees officer', admin: 'Fees administrator' },
    // The masters an officer cannot change from the counter: the year, the
    // class structure, the numbering series and the payment rails.
    adminOwned: [
      /academic year|session year|term\b/i,
      /grade|standard|division|section master/i,
      /receipt book|numbering series|receipt prefix/i,
      /gateway|nach|bank account|mandate/i,
      /role|menu|permission/i,
      /model|prompt|persona|confidence threshold/i,
    ],
    selfService: {
      noun: 'the parent',
      owner: 'Parent',
      surface: 'the parent fee portal',
      originLabel: 'Parent activity',
    },
    gatedResult:
      /receipt|refund|ledger|allocat|balance|outstanding|credit|demand|remind|waiver|concession|late fee/i,
    gatedRecordNoun: 'fee record, receipt or parent-facing message',
    gateInstruction:
      'Log the acceptance per 6.11.5; flag and do not apply anything that looks wrong.',
  },
  groups: [
    {
      ref: '6.1',
      title: 'Fees masters and academic-year setup',
      lifecycleStage: 'Plan',
      procedures: procedureIndex([
        ['6.1.1', 'Map the fee year to the active academic year', 'teacher'],
        ['6.1.2', 'Create and maintain the fee title master', 'teacher'],
        ['6.1.3', 'Configure the fees config master, instalments and due dates', 'teacher'],
        ['6.1.4', 'Define the fee structure break-off per standard', 'teacher'],
        ['6.1.5', 'Map additional and optional fees to a standard', 'teacher'],
        ['6.1.6', 'Maintain the other-fees title master', 'teacher'],
        ['6.1.7', 'Configure the receipt book, prefix and numbering series', 'teacher'],
        ['6.1.8', 'Provision fee roles, menus and collection rights', 'teacher'],
      ]),
    },
    {
      ref: '6.2',
      title: 'Student fee assignment and concessions',
      lifecycleStage: 'Assign',
      procedures: procedureIndex([
        ['6.2.1', 'Assign the fee break-off to a student', 'teacher'],
        ['6.2.2', 'Apply a concession, waiver or scholarship', 'teacher'],
        ['6.2.3', 'Record a sibling or staff-ward discount', 'teacher'],
        ['6.2.4', 'Approve a concession above the configured limit', 'teacher'],
        ['6.2.5', 'Revise a student break-off mid-term and obtain re-approval', 'teacher'],
        ['6.2.6', 'Publish the fee schedule to the parent', 'teacher'],
      ]),
    },
    {
      ref: '6.3',
      title: 'Fee demand and parent notification',
      lifecycleStage: 'Notify',
      procedures: procedureIndex([
        ['6.3.1', 'Generate the term fee demand', 'teacher'],
        ['6.3.2', 'Issue the fee circular to a class or the school', 'teacher'],
        ['6.3.3', 'Send the due-date reminder to parents', 'teacher'],
        ['6.3.4', 'Draft a reminder message with AI assistance', 'teacher_ai'],
        ['6.3.5', 'Apply the late fee on the configured grace date', 'ai'],
        ['6.3.6', 'Share the class dues list with the class teacher', 'teacher'],
      ]),
    },
    {
      ref: '6.4',
      title: 'Counter collection',
      lifecycleStage: 'Collect',
      procedures: procedureIndex(
        [
          ['6.4.1', 'Search the student and open the fee ledger', 'teacher'],
          ['6.4.2', 'Collect a regular fee payment and issue the receipt', 'teacher'],
          ['6.4.3', 'Collect a part payment and record the balance', 'teacher'],
          ['6.4.4', 'Collect other fees and issue the other-fees receipt', 'teacher'],
          ['6.4.5', 'Record a cheque or demand draft and track its clearance', 'teacher'],
          ['6.4.6', 'Reprint or re-issue a receipt copy', 'teacher'],
          ['6.4.7', 'Close the counter and hand over the day’s collection', 'teacher'],
        ],
        // Authored in full below, and the template every other Fees procedure
        // is written against - the same role 6.9.4 plays for LMS + PAL.
        ['6.4.2']
      ),
    },
    {
      ref: '6.5',
      title: 'Online collection and payment gateway',
      lifecycleStage: 'Collect',
      procedures: procedureIndex([
        ['6.5.1', 'Configure the payment gateway and its charges', 'teacher'],
        ['6.5.2', 'Pay fees online from the parent portal', 'student'],
        ['6.5.3', 'Capture the gateway callback and post the online receipt', 'ai'],
        ['6.5.4', 'Resolve a failed or pending online transaction', 'teacher'],
        ['6.5.5', 'Review the online payments report', 'teacher'],
      ]),
    },
    {
      ref: '6.6',
      title: 'NACH mandates and bank debits',
      lifecycleStage: 'Collect',
      procedures: procedureIndex([
        ['6.6.1', 'Export the NACH mandate registration file', 'teacher'],
        ['6.6.2', 'Import the bank’s mandate registration response', 'teacher'],
        ['6.6.3', 'Export the NACH debit presentation file', 'teacher'],
        ['6.6.4', 'Import the debit response and post the receipts', 'teacher'],
        ['6.6.5', 'Handle a rejected mandate or a bounced debit', 'teacher'],
      ]),
    },
    {
      ref: '6.7',
      title: 'Cancellation, refund and correction',
      lifecycleStage: 'Correct',
      procedures: procedureIndex([
        ['6.7.1', 'Cancel a fee receipt with a recorded reason', 'teacher'],
        ['6.7.2', 'Cancel an other-fees receipt', 'teacher'],
        ['6.7.3', 'Approve and issue a refund to the payer of record', 'teacher'],
        ['6.7.4', 'Issue a corrected receipt after a cancellation', 'teacher'],
        ['6.7.5', 'Review the cancellation and refund report', 'teacher'],
      ]),
    },
    {
      ref: '6.8',
      title: 'Reconciliation and day-end closing',
      lifecycleStage: 'Reconcile',
      procedures: procedureIndex([
        ['6.8.1', 'Reconcile the day’s collection against the bank statement', 'teacher'],
        ['6.8.2', 'Review the datewise collection summary', 'teacher'],
        ['6.8.3', 'Match gateway settlements to posted receipts', 'teacher_ai'],
        ['6.8.4', 'Resolve a reconciliation exception', 'teacher'],
        ['6.8.5', 'Close the accounting period and lock the receipts', 'teacher'],
      ]),
    },
    {
      ref: '6.9',
      title: 'Defaulter follow-up and recovery',
      lifecycleStage: 'Recover',
      procedures: procedureIndex([
        ['6.9.1', 'Generate the fee defaulter list', 'teacher'],
        ['6.9.2', 'Prioritise defaulters for follow-up', 'teacher_ai'],
        ['6.9.3', 'Contact the parent and record the payment commitment', 'teacher'],
        ['6.9.4', 'Agree an instalment plan for an outstanding balance', 'teacher'],
        ['6.9.5', 'Escalate a persistent defaulter to the principal', 'teacher'],
        ['6.9.6', 'Close a recovery once the balance is cleared', 'teacher'],
      ]),
    },
    {
      ref: '6.10',
      title: 'Fee reporting and audit',
      lifecycleStage: 'Report & govern',
      procedures: procedureIndex([
        ['6.10.1', 'Generate the fee collection report', 'teacher'],
        ['6.10.2', 'Generate the fee-type-wise and fee-structure reports', 'teacher'],
        ['6.10.3', 'Generate the student break-off report', 'teacher'],
        ['6.10.4', 'Review the fees audit log', 'teacher'],
        ['6.10.5', 'Produce an AI narrative summary for the management review', 'teacher_ai'],
        ['6.10.6', 'Distribute and archive scheduled fee reports', 'teacher'],
      ]),
    },
    {
      ref: '6.11',
      title: 'AI operations and human-in-the-loop governance',
      lifecycleStage: 'Report & govern',
      procedures: procedureIndex([
        ['6.11.1', 'Use the fees AI field assistant (suggest, preview, apply)', 'teacher_ai'],
        ['6.11.2', 'Run an ad-hoc query through the fees assistant', 'teacher_ai'],
        ['6.11.3', 'Configure a fee automation and its approval gate', 'teacher'],
        ['6.11.4', 'Set confidence thresholds and propose-versus-apply policy', 'teacher'],
        ['6.11.5', 'Verify AI output and log the acceptance', 'teacher'],
        ['6.11.6', 'Operate the counter in degraded mode when AI is unavailable', 'teacher'],
      ]),
    },
  ],
}
