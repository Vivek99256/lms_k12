'use client';

/**
 * The Hostel module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record: no hostel, no room, no occupant, no count.
 *
 * THE CONSTRAINT THIS MODULE TURNS ON
 *
 * `hostel_room_master` holds an id, a floor and a name. There is no capacity column
 * anywhere in the hostel schema, and `hostel_room_allocation.bed_no` is a label a warden
 * typed rather than a seat in a known total. So nothing in this module may say a hostel is
 * full, has space, or is any percentage of anything — the read tools report rooms occupied
 * and people allocated, and every published prompt carries a rule forbidding the rest. A
 * fabricated capacity on an occupancy report is a number somebody plans a term around.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const HOSTEL_MODULE_KEY = 'hostel';

/** The route the Hostel AI Stack reports itself as when it builds a report. */
export const HOSTEL_AI_STACK_ROUTE = '/modules/hostel/ai-stack';

export const HOSTEL_AI_STACK: AiStackModule = {
  key: HOSTEL_MODULE_KEY,
  menuSlug: 'hostel',
  label: 'Hostel',
  records: 'hostel records',
  record: 'hostel allocation',
  route: HOSTEL_AI_STACK_ROUTE,
  subjectEntityKey: 'hostel_allocation',

  copy: {
    centralRisk:
      'rooms carry no recorded bed capacity anywhere in this schema. `bed_no` is a label a warden typed, not a seat in a known total, so every published Hostel prompt carries a safety rule forbidding the model from saying a hostel is full, has space, or is any percentage occupied. An invented capacity on an occupancy report is the one figure a school would plan a term around.',
    policyNamePlaceholder: 'Hostel occupancy reporting policy',
    promptSystemDefault:
      'You answer questions about hostel records for a warden. Use only the hostel, room and allocation records you are given. If a hostel, a room, an occupant or a count is not in them, say so rather than estimating. Rooms carry no recorded bed capacity in this system, so never say a hostel or a room is full, has space, or is any percentage occupied. Never judge an occupant, and never infer anything about a family from an allocation.',
    reportCanPrint:
      'the room and bed numbers come from the allocation records themselves rather than from a model.',
    groundedOn: 'the hostel and allocation records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Hostel, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read the hostel records.',
    capabilityWorkflow:
      'No workflow is bound to Hostel, so nothing in this module pauses for an approval.',
  },

  report: {
    defaultDataSource: 'hostel.allocations',
    // Exactly the arguments `hostel.allocations` accepts, from the tool's own schema.
    filters: [
      { key: 'hostel_id', label: 'Hostel id', kind: 'number', placeholder: 'all' },
      { key: 'room_id', label: 'Room id', kind: 'number', placeholder: 'all' },
      {
        key: 'admission_category_id',
        label: 'Category id',
        kind: 'number',
        placeholder: 'all',
        hint: 'Admission category master.',
      },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'hostel_allocation_report',
    emptyNote:
      'No hostel allocations matched those filters, so no report was created. A hostel or room with nobody allocated to it this academic year returns nothing rather than every occupant.',
  },

  presets: [
    {
      name: 'Occupancy reader',
      description:
        'Reads the hostels this institute runs, with the warden on each and how many rooms are occupied. Changes nothing.',
      module: HOSTEL_MODULE_KEY,
      tools_allowed: ['hostel.occupancy'],
      instructions:
        'Report rooms and occupants exactly as the records return them. Never state a capacity, a percentage full, or how many more people a hostel could take — no bed count exists in this system. If the tool reports allocations pointing at rooms that are not this institute’s, repeat that as a record to be corrected rather than treating it as occupancy.',
      status: 'active',
    },
    {
      name: 'Allocation reader',
      description:
        'Reads who is allocated to which room this year, students and staff alike. Changes nothing.',
      module: HOSTEL_MODULE_KEY,
      tools_allowed: ['hostel.allocations'],
      instructions:
        'Report the allocations as recorded. Each row says whether the occupant is a student or a member of staff — repeat that rather than assuming. A blank room, floor or building means the allocation names a room that is not on this institute’s floors; say so rather than leaving the reader to wonder.',
      status: 'active',
    },
    {
      name: 'Free room reader',
      description:
        'Reads the rooms with no allocation this academic year, with their floor and building. Changes nothing.',
      module: HOSTEL_MODULE_KEY,
      tools_allowed: ['hostel.available_rooms'],
      instructions:
        'A room is listed as available only when it has no allocation at all for this year, which is the estate’s own definition. Never describe a partly filled room as having space, and never suggest how many people a free room would hold.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Occupancy, allocation and free rooms are all readable, but the Hostel module has no agent manifest of its own. Rooms carry no bed capacity in this schema either, so nothing here could judge whether a hostel needs attention.',

  operations: {
    hostel_allocation_report: {
      key: 'hostel_allocation_report',
      label: 'Hostel allocation report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'allocation'],
    },
    hostel_summary: {
      key: 'hostel_summary',
      label: 'Hostel occupancy summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    hostel_analysis: {
      key: 'hostel_analysis',
      label: 'Hostel allocations analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    hostel_agent_run: {
      key: 'hostel_agent_run',
      label: 'Hostel agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
