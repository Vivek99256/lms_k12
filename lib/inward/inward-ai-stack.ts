'use client';

/**
 * The Inward module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record: no inward number, no title, no place.
 *
 * THE KEY IS `inward_outward`, AND THAT IS DELIBERATE
 *
 * That `ai_modules` row has existed since the workspace was seeded and already claims
 * `/inward_outward/**`, which is where every one of the module's screens lives. A second
 * `inward` key would have split one module across two policy scopes, two template lists
 * and two ledgers — the same call Communication got, for the same reason. The menu slug
 * stays `inward-outward`, which is what `fees_menu_categories` already carries.
 *
 * THE REGISTER HAS NO STATUS COLUMN, AND THAT SHAPES EVERY TAB
 *
 * `inward` records the number, title, description, the place it came from, the physical
 * file it went into, the date and a scan. It records no status, no owner, no assignee, no
 * due date and no link to a reply — and `outward` is a separate register with no key back
 * to this one.
 *
 * So "what is pending?" is not a question this module can answer, and the honest substitute
 * is `inward.unfiled`: where the REGISTER has a gap. Every published prompt carries a rule
 * forbidding the words pending, overdue, actioned, closed and answered, and forbidding the
 * age of a record from being presented as lateness.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const INWARD_MODULE_KEY = 'inward_outward';

/** The route the Inward AI Stack reports itself as when it builds a report. */
export const INWARD_AI_STACK_ROUTE = '/modules/inward-outward/ai-stack';

export const INWARD_AI_STACK: AiStackModule = {
  key: INWARD_MODULE_KEY,
  menuSlug: 'inward-outward',
  label: 'Inward',
  records: 'inward records',
  record: 'inward record',
  route: INWARD_AI_STACK_ROUTE,
  subjectEntityKey: 'inward_record',

  copy: {
    centralRisk:
      'the inward register records no status, owner, due date or action taken, and nothing links an inward record to an outward reply. So the one thing everybody wants to ask it — what is still pending — is the one thing it cannot answer. Every published Inward prompt carries a rule forbidding the model from calling a record pending, overdue, actioned, closed or answered, and from presenting the age of a record as lateness. A missing file location or a missing scan is a gap in the register, not a document somebody ignored.',
    policyNamePlaceholder: 'Inward register policy',
    promptSystemDefault:
      'You summarise an inward document register for a school office. Use only the inward records you are given. This register records NO status, owner, due date or action taken, and no link to any reply: never describe a record as pending, overdue, actioned, closed or answered. Days since received is arithmetic on a date and is never evidence of lateness. The outward register is a separate record you have not been given.',
    reportCanPrint:
      'the inward numbers, titles, dates, places and file locations come from the register itself rather than from a model.',
    groundedOn: 'the inward records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Inward, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read the register and find its gaps.',
    capabilityWorkflow:
      'No workflow is bound to Inward. Filing a document and answering it stay a person’s acts on the inward screens.',
  },

  report: {
    defaultDataSource: 'inward.register',
    // Exactly the arguments `inward.register` accepts, from the tool's own schema.
    filters: [
      { key: 'place_id', label: 'Place id', kind: 'number', placeholder: 'all' },
      { key: 'file_location_id', label: 'File location id', kind: 'number', placeholder: 'all' },
      { key: 'from_date', label: 'Received from', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'to_date', label: 'Received to', kind: 'text', placeholder: 'YYYY-MM-DD' },
      { key: 'search_text', label: 'Search', kind: 'text', placeholder: 'title, description or number' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'inward_register_report',
    emptyNote:
      'No inward records matched those filters, so no report was created. A date range with nothing in it returns nothing rather than the whole year’s register.',
  },

  presets: [
    {
      name: 'Register reader',
      description: 'Reads the inward register for a date range, a place or a search. Changes nothing.',
      module: INWARD_MODULE_KEY,
      tools_allowed: ['inward.register'],
      instructions:
        'Report the records exactly as entered, and always state the whole matching count beside the rows listed. This register has no status column at all: never say a record is pending, overdue, actioned, closed or answered, and never say how long something has been waiting — nothing here records what was due.',
      status: 'active',
    },
    {
      name: 'Register gap finder',
      description:
        'Finds inward records with no physical file location recorded, or no scan attached. Changes nothing.',
      module: INWARD_MODULE_KEY,
      tools_allowed: ['inward.unfiled'],
      instructions:
        'A gap here is a gap in the register — a detail the office has not entered — and not a document that has been ignored. Report which gap each record has and how many of each there are. Do not attribute a gap to a named person, and do not describe the oldest record as the most urgent.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The register and its gaps are readable, but the Inward module has no agent manifest of its own. Nor could one judge much: with no status, owner or due date recorded, there is nothing for an agent to open a case about.',

  operations: {
    inward_register_report: {
      key: 'inward_register_report',
      label: 'Inward register report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'register'],
    },
    inward_summary: {
      key: 'inward_summary',
      label: 'Inward summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    inward_analysis: {
      key: 'inward_analysis',
      label: 'Inward register analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    inward_agent_run: {
      key: 'inward_agent_run',
      label: 'Inward agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
