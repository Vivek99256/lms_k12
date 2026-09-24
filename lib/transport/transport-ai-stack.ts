'use client';

/**
 * The Transport module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record: no route, no vehicle, no child.
 *
 * THE KEY IS `transportation`, AND THAT IS DELIBERATE
 *
 * That `ai_modules` row has existed since the workspace was seeded and already claims
 * `/Transportation/**`, which is where every one of the module's screens lives. A second
 * `transport` key would have split one module across two policy scopes, two template
 * lists and two ledgers — the same call Inward and Communication got, for the same reason.
 * The menu slug stays `transport`, which is what `fees_menu_categories` already carries.
 *
 * SEATS AGAINST ASSIGNMENTS IS THE ONE JUDGEMENT THE DATA SUPPORTS
 *
 * `sitting_capacity` is a real number and the assignments against it are real rows, so
 * "more students assigned than seats" is genuinely derivable — which makes it the one
 * thing this module can conclude rather than merely report.
 *
 * It is counted PER LEG and never once. `transport_map_student` holds `from_bus_id` and
 * `to_bus_id` separately because the morning and afternoon runs are different trips that
 * often use different vehicles. Adding them together would double-count every child who
 * rides the same bus both ways — which is most of them — and report a full bus as
 * catastrophically over capacity. Every published prompt forbids the addition by name.
 *
 * WHAT IS NOT RECORDED
 *
 * No boarding or bus attendance: nobody is recorded as having got on, so this module can
 * say who is assigned and never who travelled. No live position, trip log, delay or
 * breakdown — route times are the SCHEDULE. No vehicle fitness, insurance, permit or
 * licence expiry anywhere. So nothing here may call a route late, a bus on the road, a
 * driver on duty or a vehicle roadworthy.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const TRANSPORT_MODULE_KEY = 'transportation';

/** The route the Transport AI Stack reports itself as when it builds a report. */
export const TRANSPORT_AI_STACK_ROUTE = '/modules/transport/ai-stack';

export const TRANSPORT_AI_STACK: AiStackModule = {
  key: TRANSPORT_MODULE_KEY,
  menuSlug: 'transport',
  label: 'Transport',
  records: 'transport routes',
  record: 'transport route',
  route: TRANSPORT_AI_STACK_ROUTE,
  subjectEntityKey: 'transport_route',

  copy: {
    centralRisk:
      'the morning and afternoon legs are separate trips and must never be added together — most children ride the same bus both ways, so summing them doubles every one of them and turns a full bus into a crisis. Beyond capacity, this system records nothing about what actually happens: no boarding or bus attendance, no live position, no trip log, no delay, and no vehicle fitness, insurance or permit. Every published Transport prompt forbids saying a route is running or late, that a child travelled, or that a vehicle is roadworthy. Route times are the published schedule and nothing more.',
    policyNamePlaceholder: 'Transport information policy',
    promptSystemDefault:
      'You summarise school transport for a transport office. Use only the routes, vehicles and assignments you are given. The times on a route are the PUBLISHED SCHEDULE: this system records no departure or arrival that happened, no delay and no live position, so never say a route is running, has left, is on time or is late. Nothing records that a child boarded — an assignment is a plan, not a journey. The morning and afternoon legs are separate trips and must never be added together. No vehicle fitness, insurance or permit is recorded anywhere: never call a vehicle roadworthy or overdue.',
    reportCanPrint:
      'the routes, stops, times and vehicle assignments come from the transport records themselves rather than from a model.',
    groundedOn: 'the route and vehicle records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Transport, so nothing here opens a case or moves a child to another bus. The tool agents on the Automations tab still read the routes, check seats against assignments and draft a notice for a person to send.',
    capabilityWorkflow:
      'No workflow is bound to Transport. Changing a stop or a bus moves a child’s journey home and stays a person’s act on the transport screens.',
  },

  report: {
    defaultDataSource: 'transport.routes',
    // Exactly the arguments `transport.routes` accepts, from the tool's own schema.
    filters: [
      { key: 'route_id', label: 'Route id', kind: 'number', placeholder: 'all' },
      { key: 'search_text', label: 'Search', kind: 'text', placeholder: 'route name' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'transport_route_report',
    emptyNote:
      'No transport routes matched those filters, so no report was created. An academic year with no routes published returns nothing rather than every year’s routes.',
  },

  presets: [
    {
      name: 'Route and vehicle reader',
      description:
        'Reads routes with their stops and times, and the vehicles assigned to run them. Changes nothing.',
      module: TRANSPORT_MODULE_KEY,
      tools_allowed: ['transport.routes', 'transport.vehicles'],
      instructions:
        'Report the routes, stops and vehicles as published. The times are the schedule — never say a route is running, has left, is on time or is late, because nothing here records what happened. Never comment on a vehicle’s fitness, insurance or permit; none is recorded.',
      status: 'active',
    },
    {
      name: 'Capacity checker',
      description:
        'Reads seating capacity against students assigned, morning and afternoon separately. Changes nothing.',
      module: TRANSPORT_MODULE_KEY,
      tools_allowed: ['transport.vehicles', 'transport.assignments'],
      instructions:
        'The morning and afternoon counts are separate trips: report them separately and NEVER add them together. A vehicle with no seat count recorded is unknown, not empty — do not call it over capacity. An assignment is a plan, not a journey: never say how many children actually travelled. Do not propose moving a child to another bus; that changes how they get home.',
      status: 'active',
    },
    {
      name: 'Transport notice drafter',
      description:
        'Reads a route and drafts a notice about it for a person to review before sending. Sends nothing.',
      module: TRANSPORT_MODULE_KEY,
      tools_allowed: ['transport.routes', 'transportation.draft_notice'],
      instructions:
        'Draft from the route record in front of you and nothing else. State the scheduled time as scheduled — never as when the bus will arrive. Do not name a driver or a child. If you were not given a stop, a time or a date, leave it out rather than filling it in; the draft is for a person to complete and send.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Routes, vehicles and assignments are readable, and seats against assignments is a real finding, but the Transport module has no agent manifest of its own. Acting on one would mean moving a child to a different bus, which is not a thing to automate.',

  operations: {
    transport_route_report: {
      key: 'transport_route_report',
      label: 'Transport route report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'route'],
    },
    transport_summary: {
      key: 'transport_summary',
      label: 'Transport summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    transport_analysis: {
      key: 'transport_analysis',
      label: 'Transport analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    transport_agent_run: {
      key: 'transport_agent_run',
      label: 'Transport agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
