'use client';

/**
 * The Alumni Management module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record: no alumnus, no employer, no donor, no count.
 *
 * WHAT THE READ TOOLS WITHHOLD, AND WHY
 *
 * `alumni.directory`, `alumni.events` and `alumni.overview` return names, batches, status,
 * employment and counts. They never return an email, a mobile number, an address, a date
 * of birth or a photograph, because alumni consent per channel and none of it is theirs to
 * hand to a model. Donations are totals only, since a donor may have given anonymously.
 *
 * A BLANK EMPLOYMENT IS NOT UNEMPLOYMENT
 *
 * `employment_status` and `current_company` are optional fields an alumnus may never have
 * filled in. Every published Alumni prompt forbids reading an empty value as "unemployed",
 * and forbids ranking alumni by success. `status` is the register's verification state
 * (registered, pending verification, verified, active), not a judgement of the person.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const ALUMNI_MODULE_KEY = 'alumni';

/** The route the Alumni AI Stack reports itself as when it builds a report. */
export const ALUMNI_AI_STACK_ROUTE = '/modules/alumni-management/ai-stack';

export const ALUMNI_AI_STACK: AiStackModule = {
  key: ALUMNI_MODULE_KEY,
  menuSlug: 'alumni-management',
  label: 'Alumni Management',
  records: 'alumni records',
  record: 'alumnus',
  route: ALUMNI_AI_STACK_ROUTE,
  subjectEntityKey: 'alumni',

  copy: {
    centralRisk:
      'an alumnus with no employer or employment status recorded has not been shown to be unemployed — they may simply never have filled the field in. Contact details, dates of birth, addresses and photographs are withheld from every Alumni tool because alumni consent per channel, so a model must never state or guess one. Every published Alumni prompt forbids reading a blank as unemployment, forbids ranking alumni by success, and forbids attributing a donation to a named person.',
    policyNamePlaceholder: 'Alumni data handling policy',
    promptSystemDefault:
      'You summarise an alumni register for a school’s alumni coordinator. Use only the alumni records you are given. If an alumnus, a batch, an employer or a count is not in them, say so rather than estimating. Never state or guess a contact detail, a date of birth, an address or a photograph — none is provided. A blank employment status or employer means it is not recorded, never that the person is unemployed. The status column is the register’s verification state, not a judgement of the person. Never rank alumni by success and never attribute a donation to a named alumnus.',
    reportCanPrint:
      'the names, batches, statuses and employers come from the alumni register itself rather than from a model.',
    groundedOn: 'the alumni records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Alumni Management, so nothing here opens a case, messages an alumnus or matches a mentor. The tool agents on the Automations tab still read the register and events.',
    capabilityWorkflow:
      'No AI workflow is bound to Alumni Management. Verifying an alumnus, approving an opportunity and confirming a donation stay with the approval flows on the Workflow tab, and a person has to decide them.',
  },

  report: {
    defaultDataSource: 'alumni.directory',
    // Exactly the arguments `alumni.directory` accepts, from the tool's own schema.
    filters: [
      {
        key: 'status',
        label: 'Status',
        kind: 'text',
        placeholder: 'any',
        hint: 'registered, pending_verification, verified or active.',
      },
      { key: 'employment_status', label: 'Employment status', kind: 'text', placeholder: 'any' },
      { key: 'batch', label: 'Batch', kind: 'text', placeholder: 'all' },
      { key: 'passing_year', label: 'Passing year', kind: 'number', placeholder: 'all' },
      {
        key: 'search_text',
        label: 'Search',
        kind: 'text',
        placeholder: 'name, employer or job title',
      },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'alumni_register_report',
    emptyNote:
      'No alumni matched those filters, so no report was created. A batch with nobody recorded returns nothing rather than the whole register.',
  },

  presets: [
    {
      name: 'Alumni overview reader',
      description:
        'Reads alumni counts by status, batch and employment, with how many events, mentorship requests, opportunities and surveys there are. Changes nothing.',
      module: ALUMNI_MODULE_KEY,
      tools_allowed: ['alumni.overview'],
      instructions:
        'Report counts exactly as the tool returns them. A group named "(not recorded)" is a count of records with the field blank — repeat it as not recorded, never as unemployed or unknown people. Donations are totals only; never attribute one to a person.',
      status: 'active',
    },
    {
      name: 'Alumni directory reader',
      description:
        'Reads alumni with their batch, status, employment and employer. Contact details are never returned. Changes nothing.',
      module: ALUMNI_MODULE_KEY,
      tools_allowed: ['alumni.directory'],
      instructions:
        'List alumni as recorded. Never state or guess an email, mobile number, address or date of birth — none is provided. A blank employer or employment status is not recorded, not unemployed. Do not rank or compare people by their employer or job title.',
      status: 'active',
    },
    {
      name: 'Alumni events reader',
      description:
        'Reads alumni events with their date, venue, status and how many registrations each has. Changes nothing.',
      module: ALUMNI_MODULE_KEY,
      tools_allowed: ['alumni.events'],
      instructions:
        'Report events and their registration counts as recorded. This tool does not say who attended, so never state an attendance figure or say an event was well or poorly attended.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The register, events and totals are readable, but the Alumni module has no agent manifest of its own. Alumni are people who chose to stay in touch, and nothing here should message, match or judge them on their behalf.',

  operations: {
    alumni_register_report: {
      key: 'alumni_register_report',
      label: 'Alumni register report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'register'],
    },
    alumni_summary: {
      key: 'alumni_summary',
      label: 'Alumni summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    alumni_analysis: {
      key: 'alumni_analysis',
      label: 'Alumni analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    alumni_agent_run: {
      key: 'alumni_agent_run',
      label: 'Alumni agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
