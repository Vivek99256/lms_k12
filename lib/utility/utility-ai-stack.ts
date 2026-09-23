'use client';

/**
 * The Utility module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record.
 *
 * THE NAME IS MISLEADING, AND THIS IS THE FIRST THING TO KNOW
 *
 * "Utility" here does not mean electricity, water, gas, meter readings, consumption or
 * bills. This estate holds NO table for any of those — searched as `utility%`, `meter%`,
 * `electric%`, `water%` and `consumption%`, and the only match is `transport_kilometer_rate`,
 * which belongs to Transport.
 *
 * What `/Utility` actually is: student transfer between institutes of the same client,
 * academic-year rollover, breakoff rollover, bulk data update, and a custom-module builder.
 * Bulk data operations, performed by an administrator.
 *
 * THE KEY IS `migration-modules`, AND THAT IS DELIBERATE
 *
 * That `ai_modules` row has claimed `/Utility` and `/Utility/**` since the workspace was
 * seeded — the same situation Inward and Transport were in. A second `utility` key would
 * split one module across two policy scopes and two ledgers. The menu slug stays `utility`.
 *
 * THESE ARE OPERATIONS, NOT RECORDS
 *
 * Which is the module's real difficulty: there is very little to read, and what there is
 * describes what the tools operate ON rather than what they have DONE. No rollover log, no
 * transfer log, no bulk-update audit exists anywhere. So every published prompt forbids
 * saying that a rollover has or has not been run, when anything last happened, how many
 * students were moved, or whether the next year is ready — and forbids estimating a
 * utility bill, because there are none.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const UTILITY_MODULE_KEY = 'migration-modules';

/** The route the Utility AI Stack reports itself as when it builds a report. */
export const UTILITY_AI_STACK_ROUTE = '/modules/utility/ai-stack';

export const UTILITY_AI_STACK: AiStackModule = {
  key: UTILITY_MODULE_KEY,
  menuSlug: 'utility',
  label: 'Utility',
  records: 'custom modules',
  record: 'custom module',
  route: UTILITY_AI_STACK_ROUTE,
  subjectEntityKey: 'custom_module',

  copy: {
    centralRisk:
      'two separate absences, and a person will hit both. First, this module is bulk data operations and not utilities: no electricity, water, gas, meter or bill table exists anywhere in this estate, so a question about a utility bill must be answered "that is not recorded here" and never estimated. Second, the module records no history of anything it does — no rollover log, no transfer log, no bulk-update audit — so nothing may say an operation has been run, when, or how many records it moved. What is readable describes what an operation would act on.',
    policyNamePlaceholder: 'Utility data operations policy',
    promptSystemDefault:
      'You summarise custom module definitions and data-operation scope for a school administrator. THE UTILITY MODULE IN THIS SYSTEM IS BULK DATA OPERATIONS — rollover, student transfer, bulk update, custom modules — and NOT electricity, water, gas or utility bills, none of which this system records anywhere; if asked about them, say plainly that no such data is held. NO OPERATION HISTORY IS RECORDED: never say a rollover or transfer has been run, when, or how many students moved.',
    reportCanPrint: 'the module names, table names and column counts come from the definitions themselves rather than from a model.',
    groundedOn: 'the custom module definitions above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Utility, so nothing here runs a rollover or moves a student. The tool agents on the Automations tab still read the definitions and the scope.',
    capabilityWorkflow:
      'No workflow is bound to Utility. A rollover or a transfer rewrites a year of records for a whole school and stays a person’s deliberate act on the Utility screens.',
  },

  report: {
    defaultDataSource: 'utility.custom_modules',
    // Exactly the arguments `utility.custom_modules` accepts, from the tool's own schema.
    filters: [
      { key: 'module_type', label: 'Module type', kind: 'text', placeholder: 'all', hint: 'As stored, e.g. MASTER.' },
      { key: 'search_text', label: 'Search', kind: 'text', placeholder: 'module or table name' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'utility_custom_module_report',
    emptyNote:
      'No custom modules matched those filters, so no report was created. This school may simply not have defined any — that is a complete answer, not a gap to fill in.',
  },

  presets: [
    {
      name: 'Custom module reader',
      description:
        'Reads the custom modules defined here and the columns each defines. Changes nothing.',
      module: UTILITY_MODULE_KEY,
      tools_allowed: ['utility.custom_modules'],
      instructions:
        'These are table DEFINITIONS, not data: never say how many records a defined table holds or whether anybody uses it. If asked about electricity, water, gas or a utility bill, say plainly that this system records none of them — this module is bulk data operations.',
      status: 'active',
    },
    {
      name: 'Rollover scope reader',
      description:
        'Reads the academic years with enrolments and the institutes a transfer could target. Changes nothing.',
      module: UTILITY_MODULE_KEY,
      tools_allowed: ['utility.rollover_scope'],
      instructions:
        'This is what an operation WOULD act on. No operation history is recorded anywhere — never say a rollover or transfer has been run, when, or how many students moved. A year appearing here means enrolments exist against it, not that it has been rolled over.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The custom module definitions and the scope a rollover would act on are readable, but the Utility module has no agent manifest — and should not have one. Its operations rewrite a year of records for a whole school, and there is no history recorded for an agent to reason over in any case.',

  operations: {
    utility_custom_module_report: {
      key: 'utility_custom_module_report',
      label: 'Custom module register',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'register'],
    },
    utility_summary: {
      key: 'utility_summary',
      label: 'Utility summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    utility_analysis: {
      key: 'utility_analysis',
      label: 'Custom modules analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    utility_agent_run: {
      key: 'utility_agent_run',
      label: 'Utility agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
