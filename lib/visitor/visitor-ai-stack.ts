'use client';

/**
 * The Visitor Management module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record: no visitor, no host, no time.
 *
 * A MISSING EXIT TIME IS A MISSING RECORD
 *
 * The visitor screen colours a row green when `out_time` is null, and it is tempting to
 * read that as "on the premises". On real data it is not safe: on one live institute 205
 * of 463 visits have no exit time, including visits months old, because signing out is
 * something people forget rather than something the system enforces.
 *
 * So there are three states and never two: an exit was recorded; an entry was recorded and
 * no exit was; or no entry was recorded at all. The middle one is reported under the name
 * `no exit recorded`, and every published prompt forbids stating that a named person is
 * currently in the building, and forbids producing anything described as a list of who is
 * on the premises. Of everything in this batch, that is the assertion most likely to be
 * acted on by somebody at a gate, which is why it is the one most tightly refused.
 *
 * THERE IS NO APPROVAL
 *
 * `appointment_type` records whether a visit was direct or by appointment. It is not an
 * approval, and no approval, approver, decision or rejection exists on this table.
 *
 * THE HOSTEL KEEPS ITS OWN REGISTER
 *
 * `hostel_visitor_master` belongs to the Hostel module and is not bound here, nor are the
 * Hostel screens claimed by this module's routes. They are different registers kept by
 * different people, and a total that summed them would be wrong for both.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const VISITOR_MODULE_KEY = 'visitor_management';

/** The route the Visitor Management AI Stack reports itself as when it builds a report. */
export const VISITOR_AI_STACK_ROUTE = '/modules/visitor-management/ai-stack';

export const VISITOR_AI_STACK: AiStackModule = {
  key: VISITOR_MODULE_KEY,
  menuSlug: 'visitor-management',
  label: 'Visitor Management',
  records: 'visits',
  record: 'visit',
  route: VISITOR_AI_STACK_ROUTE,
  subjectEntityKey: 'visit',

  copy: {
    centralRisk:
      'a visit with no exit time means no exit was RECORDED — the visitor may still be on site, or may have left without signing out, and the register cannot tell the difference. On one live institute 205 of 463 visits have no exit time, most of them from days long past. Every published Visitor prompt forbids stating that a named person is currently in the building and forbids producing anything described as a list of who is on the premises, because that is the sentence somebody at a gate would act on. The register also records no approval of any kind, and a visitor’s phone number and email are there for the front desk rather than for a summary.',
    policyNamePlaceholder: 'Visitor register policy',
    promptSystemDefault:
      'You summarise a school visitor register for the front desk. Use only the visits you are given. A missing exit time means NO EXIT WAS RECORDED: the visitor may still be on site or may have left without signing out. Never state or imply that a named person is currently in the building, and never produce a list described as who is on the premises. This register records no approval, approver or decision of any kind. Do not repeat a visitor’s phone number or email address.',
    reportCanPrint:
      'the visitors, hosts, purposes and times come from the gate register itself rather than from a model.',
    groundedOn: 'the visit records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Visitor Management, so nothing here opens a case or approves a visit. The tool agents on the Automations tab still read the register and find the visits with no exit recorded.',
    capabilityWorkflow:
      'No workflow is bound to Visitor Management. Letting somebody in, and signing them out, stay acts a person performs at the desk.',
  },

  report: {
    defaultDataSource: 'visitor.visits',
    // Exactly the arguments `visitor.visits` accepts, from the tool's own schema.
    filters: [
      { key: 'visitor_type_id', label: 'Visitor type id', kind: 'number', placeholder: 'all' },
      {
        key: 'appointment_type',
        label: 'Appointment type',
        kind: 'text',
        placeholder: 'all',
        hint: 'As stored, e.g. Direct. This is not an approval — none is recorded.',
      },
      { key: 'from_date', label: 'Visited from', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'to_date', label: 'Visited to', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'search_text', label: 'Search', kind: 'text', placeholder: 'visitor, host or purpose' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'visitor_register_report',
    emptyNote:
      'No visits matched those filters, so no report was created. A day with nobody in the book returns nothing rather than the whole year’s register.',
  },

  presets: [
    {
      name: 'Visitor register reader',
      description: 'Reads the visitor register for a date range, type or search. Changes nothing.',
      module: VISITOR_MODULE_KEY,
      tools_allowed: ['visitor.visits'],
      instructions:
        'Report the visits as recorded and keep the three presence states apart. A missing exit time means no exit was recorded — never say somebody is in the building. There is no approval on this table: never call a visit pending, approved or rejected. Do not repeat a visitor’s phone number or email.',
      status: 'active',
    },
    {
      name: 'Unclosed visit finder',
      description:
        'Finds visits with an entry time and no exit time recorded, oldest first. Changes nothing.',
      module: VISITOR_MODULE_KEY,
      tools_allowed: ['visitor.without_exit'],
      instructions:
        'This is a list of records with no exit time, NOT a list of people in the building, and it must never be presented as one. Say how many are from a day already past — those are almost certainly sign-outs nobody recorded. Do not name a person as present, and do not suggest anybody be looked for.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The register and the visits with no exit recorded are readable, but the Visitor Management module has no agent manifest of its own. Nor should one act here: the only decision at a gate is whether to let somebody in, and that is a person’s.',

  operations: {
    visitor_register_report: {
      key: 'visitor_register_report',
      label: 'Visitor register report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'register'],
    },
    visitor_summary: {
      key: 'visitor_summary',
      label: 'Visitor summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    visitor_analysis: {
      key: 'visitor_analysis',
      label: 'Visitor register analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    visitor_agent_run: {
      key: 'visitor_agent_run',
      label: 'Visitor Management agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
