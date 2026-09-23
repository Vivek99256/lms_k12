'use client';

/**
 * The Engagement module's AI Stack declaration.
 *
 * NO `engagement` TABLE EXISTS IN THIS ESTATE. Rather than inventing one, Engagement's two
 * tools (`engagement.student_summary`, `engagement.students_needing_attention`) compute a
 * live signal from the attendance, homework and LMS assignment records that already exist
 * — see `EngagementReportService` on the backend. Nothing here is stored, and a student
 * with no rows in a window is reported as having no data, never as a zero.
 *
 * NOTHING HERE IS A RECORD. Every figure the tabs show is looked up at runtime, scoped to
 * the caller's institute by their own token.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const ENGAGEMENT_MODULE_KEY = 'engagement';

export const ENGAGEMENT_AI_STACK_ROUTE = '/modules/engagement/ai-stack';

export const ENGAGEMENT_AI_STACK: AiStackModule = {
  key: ENGAGEMENT_MODULE_KEY,
  menuSlug: 'engagement',
  label: 'Engagement',
  records: 'computed engagement signals',
  record: 'engagement signal',
  route: ENGAGEMENT_AI_STACK_ROUTE,
  subjectEntityKey: 'student',

  copy: {
    centralRisk:
      'a computed engagement figure describes attendance, homework and assignment activity over a window — it is not a judgement about a student’s character, effort or ability. Every published Engagement prompt carries a safety rule forbidding the model from characterising a student as lazy, disengaged or gifted from a percentage, and from treating a student with no records in a window as at zero rather than as having no data.',
    policyNamePlaceholder: 'Engagement communication policy',
    promptSystemDefault:
      'You answer questions about student engagement, computed live from attendance, homework and assignment records, for a teacher or coordinator. Use only the figures you are given. A student with no data in the window has no data, not a zero. Never characterise a student’s ability, effort or character from a computed percentage.',
    reportCanPrint: 'the figures are computed live from attendance, homework and assignment records rather than from a model.',
    groundedOn: 'the computed attendance, homework and assignment figures above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Engagement, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read the computed figures.',
    capabilityWorkflow: 'No workflow is bound to Engagement, so nothing in this module pauses for an approval.',
  },

  report: {
    defaultDataSource: 'engagement.students_needing_attention',
    filters: [
      { key: 'standard_id', label: 'Standard id', kind: 'number', placeholder: 'all' },
      { key: 'threshold_percent', label: 'Threshold %', kind: 'number', defaultValue: '60' },
      { key: 'days_back', label: 'Days back', kind: 'number', defaultValue: '30' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '50' },
    ],
    operation: 'engagement_attention_report',
    emptyNote:
      'No students fell below the threshold for those filters, so no report was created — a clean result, not a missing one.',
  },

  presets: [
    {
      name: 'Student engagement reader',
      description: 'Reads one student’s computed attendance, homework and assignment completion. Changes nothing.',
      module: ENGAGEMENT_MODULE_KEY,
      tools_allowed: ['engagement.student_summary'],
      instructions:
        'Report the three figures exactly as computed, and say plainly when one has no data rather than treating it as zero. Never characterise the student beyond the figures.',
      status: 'active',
    },
    {
      name: 'Attention list reader',
      description: 'Reads students whose computed engagement falls below a threshold. Changes nothing.',
      module: ENGAGEMENT_MODULE_KEY,
      tools_allowed: ['engagement.students_needing_attention'],
      instructions:
        'Report the list exactly as returned, with which signal each student fell below. Never rank or characterise students beyond the figures given.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Engagement has no case-opening agent yet; reports and conversational answers are grounded directly on computed attendance, homework and assignment figures.',

  operations: {
    engagement_attention_report: {
      key: 'engagement_attention_report',
      label: 'Engagement attention report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'attention'],
    },
    engagement_summary: {
      key: 'engagement_summary',
      label: 'Engagement summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    engagement_student_report: {
      key: 'engagement_student_report',
      label: 'Student engagement report',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['student engagement', 'report'],
    },
    engagement_followup_drafted: {
      key: 'engagement_followup_drafted',
      label: 'Engagement follow-up drafted',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['follow-up', 'followup'],
    },
    engagement_agent_run: {
      key: 'engagement_agent_run',
      label: 'Engagement agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
