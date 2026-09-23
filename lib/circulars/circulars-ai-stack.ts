'use client';

/**
 * The Circular module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record: no circular, no title, no date, no class, no count.
 *
 * TWO THINGS THIS MODULE TURNS ON
 *
 * 1. One row is one circular addressed to one class. A notice sent to six classes is six
 *    rows sharing a title and a date, which is how `circularController` writes it. So
 *    `circulars.list` reports the row count and the count of distinct circulars separately
 *    and every published prompt is forbidden from reporting the first as the second.
 *
 * 2. The record holds no read receipt. `circular` stores what was published and to which
 *    class, and nothing anywhere in the schema records who opened it. Nothing here may
 *    report reach, readership or delivery — a school told "94% of families read the fee
 *    notice" would be reading a number nobody measured.
 *
 * THE MENU AND THE MODULE
 *
 * Circular is a level-2 menu that is itself a screen: it has no level-3 children, so
 * 2026_09_17_100001 skipped it and it had no category bar at all.
 * 2026_09_22_100200 adds the one AI Stack category row this module needs, which is why
 * `/modules/circular/ai-stack` resolves to a labelled page rather than an unconfigured one.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const CIRCULAR_MODULE_KEY = 'circular';

/** The route the Circular AI Stack reports itself as when it builds a report. */
export const CIRCULAR_AI_STACK_ROUTE = '/modules/circular/ai-stack';

export const CIRCULAR_AI_STACK: AiStackModule = {
  key: CIRCULAR_MODULE_KEY,
  menuSlug: 'circular',
  label: 'Circular',
  records: 'circular records',
  record: 'circular',
  route: CIRCULAR_AI_STACK_ROUTE,
  subjectEntityKey: 'circular',

  copy: {
    centralRisk:
      'the register records publication, not receipt. Nothing anywhere in this schema stores who opened a circular, so every published Circular prompt carries a rule forbidding the model from stating reach, readership or delivery. The second rule is arithmetic: one row is one circular addressed to one class, so reporting the row count as a count of notices turns one letter to six classes into six letters.',
    policyNamePlaceholder: 'Circular drafting policy',
    promptSystemDefault:
      'You answer questions about a school’s circular register for the front office. Use only the circular records you are given. If a title, a date, a type, a class or a count is not in them, say so rather than estimating. The record holds no read receipt: never state or estimate how many families received, opened or read a circular. One row is one circular addressed to one class, so never report the row count as a count of separate notices.',
    reportCanPrint:
      'the titles, dates and classes come from the circular records themselves rather than from a model.',
    groundedOn: 'the circular records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Circular, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read the register.',
    capabilityWorkflow:
      'No workflow is bound to Circular. Publishing a circular is a person pressing the button on the Circular screen.',
  },

  report: {
    defaultDataSource: 'circulars.list',
    // Exactly the arguments `circulars.list` accepts, from the tool's own schema.
    filters: [
      { key: 'standard_id', label: 'Standard id', kind: 'number', placeholder: 'all' },
      { key: 'type_id', label: 'Type id', kind: 'number', placeholder: 'all', hint: 'From circulars.types.' },
      { key: 'from_date', label: 'From date', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'to_date', label: 'To date', kind: 'text', placeholder: 'YYYY-MM-DD' },
      {
        key: 'with_attachment',
        label: 'Only with an attachment',
        kind: 'boolean',
        hint: 'Leave clear for every circular.',
      },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'circular_register_report',
    emptyNote:
      'No circulars matched those filters, so no report was created. A class, type or date range with nothing published returns nothing rather than the whole register.',
  },

  presets: [
    {
      name: 'Register reader',
      description:
        'Reads the circulars published this year, with their type, date and the class each went to. Changes nothing.',
      module: CIRCULAR_MODULE_KEY,
      tools_allowed: ['circular.list'],
      instructions:
        'Report both counts the tool returns and label them: rows are publications, one per class, while distinct circulars is how many separate notices that represents. Never state how many families received, opened or read anything — the register holds no read receipt.',
      status: 'active',
    },
    {
      name: 'Circular drafter',
      description:
        'Turns a subject and a few points into the body of a circular for a person to review. Publishes nothing.',
      module: CIRCULAR_MODULE_KEY,
      tools_allowed: ['circular.draft'],
      instructions:
        'Write plainly, in the school’s voice, at the lowest reasonable reading level. Say only what you are given: no date, venue, deadline or instruction that was not supplied. Publishing sends this to every family in a class, so end with what the reader should do and who to contact, and leave the publishing to a person.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Published circulars and their types are readable, but the Circular module has no agent manifest of its own. The record holds no read receipt either, so nothing here could detect that a notice went unseen.',

  operations: {
    circular_register_report: {
      key: 'circular_register_report',
      label: 'Circular register report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'register'],
    },
    circular_summary: {
      key: 'circular_summary',
      label: 'Circular summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    circular_analysis: {
      key: 'circular_analysis',
      label: 'Circular register analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    circular_drafted: {
      key: 'circular_drafted',
      label: 'Circular drafted',
      capability: 'generative',
      uses: 'prompt',
      // 'draft' first — see the note in the Exam descriptor about why the order of these
      // hints decides whether a draft is refused for want of grounding.
      prefers: ['draft', 'notice', 'circular'],
    },
    circular_agent_run: {
      key: 'circular_agent_run',
      label: 'Circular agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
