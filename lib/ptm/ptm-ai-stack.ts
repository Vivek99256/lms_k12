'use client';

/**
 * The PTM module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record: no meeting, no family, no date, no count.
 *
 * THE MODULE KEY IS `ptm` AND THE MENU SLUG IS ALSO `ptm`
 *
 * The level-2 menu is named "PTM " — with a trailing space, in this estate's data — and
 * the category seeder slugged it `ptm`. The `ai_modules` row created by
 * 2026_09_22_100000 uses the same key, so for this module the two happen to agree. They do
 * not have to, and nothing here depends on their agreeing.
 *
 * THE DISTINCTION THIS MODULE TURNS ON
 *
 * `PTM_ATTENDED_STATUS` is empty until a teacher saves the register, so a booking can be
 * in three states, not two: attended, did not attend, and nobody has written it down. The
 * read tools report the third separately and every prompt published for this module
 * forbids collapsing it into the second. A parent recorded as having failed to turn up
 * when the school simply never saved the register is the wrong answer this module exists
 * to prevent.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const PTM_MODULE_KEY = 'ptm';

/** The route the PTM AI Stack reports itself as when it builds a report. */
export const PTM_AI_STACK_ROUTE = '/modules/ptm/ai-stack';

export const PTM_AI_STACK: AiStackModule = {
  key: PTM_MODULE_KEY,
  menuSlug: 'ptm',
  label: 'PTM',
  records: 'parent-teacher meeting records',
  record: 'meeting',
  route: PTM_AI_STACK_ROUTE,
  subjectEntityKey: 'ptm_booking',

  copy: {
    centralRisk:
      'a booking whose attendance nobody has saved is not a family that stayed away. `PTM_ATTENDED_STATUS` is empty until a teacher fills the register, so every published PTM prompt carries a safety rule keeping "not recorded" in its own bucket. Telling a school that forty parents skipped a meeting when the register was simply never saved is the wrong answer most likely to be believed.',
    policyNamePlaceholder: 'PTM communication policy',
    promptSystemDefault:
      'You answer questions about parent-teacher meeting records for a school office. Use only the meeting and booking records you are given. If a meeting, a date, a class or a count is not in them, say so rather than estimating. A booking with no attendance recorded means nobody has saved the register; never report it as a parent who did not attend. Never judge a family, a teacher or a class from attendance figures.',
    reportCanPrint:
      'the booking counts come from the meeting records themselves rather than from a model.',
    groundedOn: 'the meeting and booking records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to PTM, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read the meeting records.',
    capabilityWorkflow:
      'No workflow is bound to PTM, so nothing in this module pauses for an approval.',
  },

  report: {
    defaultDataSource: 'ptm.meetings',
    // Exactly the arguments `ptm.meetings` accepts, from the tool's own schema.
    filters: [
      { key: 'standard_id', label: 'Standard id', kind: 'number', placeholder: 'all' },
      { key: 'division_id', label: 'Division id', kind: 'number', placeholder: 'all' },
      { key: 'from_date', label: 'From date', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'to_date', label: 'To date', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'ptm_meeting_report',
    emptyNote:
      'No parent-teacher meetings matched those filters, so no report was created. A class or a date range with no meetings scheduled returns nothing rather than the whole term.',
  },

  presets: [
    {
      name: 'Meeting schedule reader',
      description:
        'Reads the PTM slots scheduled this year, with the class each was opened for and how many families booked. Changes nothing.',
      module: PTM_MODULE_KEY,
      tools_allowed: ['ptm.meetings'],
      instructions:
        'Report only what the meeting records return. Always state the whole count of matching meetings beside the number of rows listed, so a page is never read as the term. Report bookings whose attendance has not been recorded as exactly that; never fold them into the count of families who did not attend.',
      status: 'active',
    },
    {
      name: 'Booking reader',
      description:
        'Reads individual PTM bookings and what the register says about each. Changes nothing.',
      module: PTM_MODULE_KEY,
      tools_allowed: ['ptm.bookings'],
      instructions:
        'Report the bookings exactly as recorded. An empty attendance status means the register has not been saved — say so in those words rather than calling it an absence. Never judge a family from whether they attended.',
      status: 'active',
    },
    {
      name: 'Invitation drafter',
      description:
        'Drafts a short invitation to one family for a meeting slot. Sends nothing and books nothing.',
      module: PTM_MODULE_KEY,
      tools_allowed: ['ptm.draft_invitation'],
      instructions:
        'Write a short, warm invitation a parent can read in under a minute. State only the slot details you are given. Never say what the meeting will be about — the booking record holds no agenda, and a family told the school wants to discuss a problem has been told something nobody said.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Meetings, bookings and the attendance a teacher recorded can all be read and reported, but the PTM module has no agent manifest of its own. Nothing here opens a case or reaches an approval.',

  operations: {
    ptm_meeting_report: {
      key: 'ptm_meeting_report',
      label: 'Parent-teacher meeting report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'meeting'],
    },
    ptm_summary: {
      key: 'ptm_summary',
      label: 'PTM summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    ptm_analysis: {
      key: 'ptm_analysis',
      label: 'PTM take-up analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    ptm_invitation_drafted: {
      key: 'ptm_invitation_drafted',
      label: 'PTM invitation drafted',
      capability: 'generative',
      uses: 'prompt',
      // 'invitation' first — see the note in the Exam descriptor about why the order of
      // these hints decides whether a one-family draft is refused for want of grounding.
      prefers: ['invitation', 'message', 'meeting'],
    },
    ptm_agent_run: {
      key: 'ptm_agent_run',
      label: 'PTM agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
