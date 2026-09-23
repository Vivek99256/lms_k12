'use client';

/**
 * The Users Mobile Apps module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record: no tile, no profile, no count.
 *
 * WHAT THIS MODULE'S RECORDS ACTUALLY ARE
 *
 * `mobile_homescreen` and `teacher_mobile_homescreen` configure the apps' navigation, per
 * user profile: a row is one tile, with the section it sits under, the screen it opens and
 * whether it is switched on. That is what the module holds.
 *
 * It holds no session, no device and no login — nothing anywhere in this estate records
 * that somebody opened the app. So the one thing this module's AI must never do is report
 * usage, and the published prompts and the example policy both say so. A school told "68%
 * of parents use the app" would be reading a number nobody measured.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const MOBILE_APPS_MODULE_KEY = 'mobile_apps';

/** The route the Users Mobile Apps AI Stack reports itself as when it builds a report. */
export const MOBILE_APPS_AI_STACK_ROUTE = '/modules/mobile-apps/ai-stack';

export const MOBILE_APPS_AI_STACK: AiStackModule = {
  key: MOBILE_APPS_MODULE_KEY,
  menuSlug: 'mobile-apps',
  label: 'Users Mobile Apps',
  records: 'mobile app configuration records',
  record: 'app tile',
  route: MOBILE_APPS_AI_STACK_ROUTE,
  subjectEntityKey: 'mobile_app_tile',

  copy: {
    centralRisk:
      'these tables hold the app’s configured navigation and nothing else. No session, device or login is recorded anywhere in this estate, so every published prompt carries a rule forbidding any claim about downloads, installs, active users or adoption — and forbidding a switched-on tile from being read as a tile anybody has used. Reporting app usage from configuration is the one wrong answer this module invites.',
    policyNamePlaceholder: 'Mobile app rollout policy',
    promptSystemDefault:
      'You answer questions about mobile app home-screen configuration for an administrator. Use only the configuration records you are given. If a section, a tile, a profile or a count is not in them, say so rather than estimating. These rows are configuration, not usage: never report downloads, installs, active users, sessions or adoption, and never treat a tile being switched on as evidence that anybody has used it.',
    reportCanPrint: 'the tiles and their sections come from the configuration records themselves rather than from a model.',
    groundedOn: 'the home-screen configuration above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Users Mobile Apps, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read the configuration.',
    capabilityWorkflow:
      'No workflow is bound to Users Mobile Apps, so nothing in this module pauses for an approval.',
  },

  report: {
    defaultDataSource: 'mobile_apps.homescreen',
    // Exactly the arguments `mobile_apps.homescreen` accepts, from the tool's own schema.
    filters: [
      { key: 'app', label: 'App', kind: 'text', placeholder: 'parent', hint: 'parent or teacher.' },
      { key: 'user_profile_name', label: 'User profile', kind: 'text', placeholder: 'all' },
      { key: 'section', label: 'Section', kind: 'text', placeholder: 'all' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'mobile_apps_homescreen_report',
    emptyNote:
      'No tiles matched those filters, so no report was created. An app or profile with nothing configured returns nothing rather than the other app’s screen.',
  },

  presets: [
    {
      name: 'Home screen reader',
      description:
        'Reads the tiles configured on a mobile app home screen, per profile, and which are switched off. Changes nothing.',
      module: MOBILE_APPS_MODULE_KEY,
      tools_allowed: ['mobile_apps.homescreen'],
      instructions:
        'Report only what the configuration returns. Always say which app the rows came from, because the parent and teacher apps are configured separately. Never report how many people use the app, opened a tile or installed anything — none of that is recorded.',
      status: 'active',
    },
    {
      name: 'App section reader',
      description:
        'Reads the sections each app is built from and how many tiles sit under each. Changes nothing.',
      module: MOBILE_APPS_MODULE_KEY,
      tools_allowed: ['mobile_apps.sections'],
      instructions:
        'Report the sections per app as returned. A section present in one app and absent from the other is a real difference in what those users see — say so rather than merging the two lists.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The apps’ configured navigation can be read and reported, but the Users Mobile Apps module has no agent manifest of its own. This estate records no session, device or login either, so nothing here could detect that an app was going unused.',

  operations: {
    mobile_apps_homescreen_report: {
      key: 'mobile_apps_homescreen_report',
      label: 'Mobile app home screen report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'home'],
    },
    mobile_apps_summary: {
      key: 'mobile_apps_summary',
      label: 'Mobile app configuration summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    mobile_apps_analysis: {
      key: 'mobile_apps_analysis',
      label: 'Mobile app configuration analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    mobile_apps_agent_run: {
      key: 'mobile_apps_agent_run',
      label: 'Mobile apps agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
