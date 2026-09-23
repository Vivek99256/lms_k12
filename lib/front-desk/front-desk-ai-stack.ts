'use client';

/**
 * The Front Desk module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record.
 *
 * THIS IS NOT THE SCHOOL'S VISITOR LOG
 *
 * The `front_desk` table holds ONE row across the entire estate. The register the schools
 * actually use is `visitor_master`, which holds 869 and belongs to the Visitor Management
 * module. Neither module binds the other's tools, and this one's route patterns do not
 * reach the other's screens.
 *
 * That shapes what every tab here may say. "How many visitors did we have today" asked on
 * this module can only be answered about this register, and an empty answer means THIS
 * register is empty — not that nobody came. Every published prompt carries that rule,
 * because "no visitors today" is exactly the kind of answer that gets repeated to somebody
 * who then acts on it.
 *
 * THE NON-ADMIN RESTRICTION IS CARRIED INTO THE AI LAYER
 *
 * `frontdeskController::index()` shows a non-admin only the rows where they are the person
 * being met. `FrontDeskService` applies the same rule from the caller's own token, and the
 * payload says which scope it used. An assistant that quietly returned the whole register
 * would be a way around a restriction the application already makes.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const FRONT_DESK_MODULE_KEY = 'front_desk';

/** The route the Front Desk AI Stack reports itself as when it builds a report. */
export const FRONT_DESK_AI_STACK_ROUTE = '/modules/front-desk/ai-stack';

export const FRONT_DESK_AI_STACK: AiStackModule = {
  key: FRONT_DESK_MODULE_KEY,
  menuSlug: 'front-desk',
  label: 'Front Desk',
  records: 'front desk visits',
  record: 'front desk visit',
  route: FRONT_DESK_AI_STACK_ROUTE,
  subjectEntityKey: 'front_desk_visit',

  copy: {
    centralRisk:
      'the front desk register holds one row across this entire estate, and the register the schools actually use belongs to the separate Visitor Management module. So an empty answer here means this register is empty and never that nobody visited the school — which is the kind of answer that gets repeated and acted on. Every published Front Desk prompt carries that rule. A missing exit time is likewise a missing record and never evidence that somebody is still in the building, and a non-admin reader is shown only the visits they were the subject of.',
    policyNamePlaceholder: 'Front desk register policy',
    promptSystemDefault:
      'You summarise a school front desk register for the reception team. Use only the visits you are given. A missing exit time means no exit was RECORDED: never state that a named person is currently in the building. THIS REGISTER IS NOT THE SCHOOL’S WHOLE VISITOR LOG — a separate and much larger one belongs to the Visitor Management module — so never state a total for visitors to the school and never say nobody visited; say this register holds no matching row.',
    reportCanPrint: 'the visitors, students, staff and times come from the front desk register itself rather than from a model.',
    groundedOn: 'the visit records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Front Desk, so nothing here opens a case or admits anybody. The tool agents on the Automations tab still read the register.',
    capabilityWorkflow:
      'No workflow is bound to Front Desk. Letting somebody in, and signing them out, stay acts a person performs at the desk.',
  },

  report: {
    defaultDataSource: 'front_desk.visits',
    // Exactly the arguments `front_desk.visits` accepts, from the tool's own schema.
    filters: [
      { key: 'student_id', label: 'Student id', kind: 'number', placeholder: 'all' },
      { key: 'staff_id', label: 'Staff id (the person being met)', kind: 'number', placeholder: 'all' },
      { key: 'visitor_type', label: 'Visitor type', kind: 'text', placeholder: 'all' },
      { key: 'from_date', label: 'Visited from', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'to_date', label: 'Visited to', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'front_desk_register_report',
    emptyNote:
      'No front desk visits matched those filters, so no report was created. That means this register holds no matching row — it does not mean nobody visited the school, because the main visitor register belongs to the Visitor Management module.',
  },

  presets: [
    {
      name: 'Front desk register reader',
      description:
        'Reads the front desk register for a date range or a member of staff. Changes nothing.',
      module: FRONT_DESK_MODULE_KEY,
      tools_allowed: ['front_desk.visits'],
      instructions:
        'Report the visits as recorded and keep the three presence states apart. A missing exit time means no exit was recorded — never say somebody is in the building. Say plainly that this is not the school’s whole visitor log, and never report an empty result as nobody having visited.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The register is readable, but the Front Desk module has no agent manifest of its own. With one row across the estate there is also very little for one to work on — the school’s real visitor traffic is recorded by the Visitor Management module.',

  operations: {
    front_desk_register_report: {
      key: 'front_desk_register_report',
      label: 'Front desk register report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'register'],
    },
    front_desk_summary: {
      key: 'front_desk_summary',
      label: 'Front desk summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    front_desk_analysis: {
      key: 'front_desk_analysis',
      label: 'Front desk activity analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    front_desk_agent_run: {
      key: 'front_desk_agent_run',
      label: 'Front Desk agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
