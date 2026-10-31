'use client';

/**
 * The Engagement module's AI Stack declaration.
 *
 * Synchronized 3-Agent Automation Architecture:
 *   1. Engagement Attention Reader (engagement.students_needing_attention)
 *   2. Engagement Activity Profiler (engagement.student_summary)
 *   3. Re-Engagement Intervention Drafter (engagement.draft_intervention_note)
 *
 * Every figure the tabs show is looked up at runtime from real attendance, homework,
 * assignments, and platform engagement tables, scoped to the caller's institute by their token.
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
      'The Engagement Agent monitors attendance, homework and coursework engagement, diagnoses disengagement causes, and drafts personalized educator intervention proposals. It does not send messages or alter marks directly.',
    capabilityWorkflow:
      'A drafted intervention must be approved by a person through the engagement_intervention_review workflow before anything is executed.',
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
      name: 'Engagement attention reader',
      description:
        'Reads attendance, homework, and coursework records, isolating students below the participation threshold. Changes nothing.',
      module: ENGAGEMENT_MODULE_KEY,
      tools_allowed: ['engagement.students_needing_attention'],
      instructions:
        'Report students whose computed engagement falls below the configured threshold across attendance, homework, and coursework. Never characterise students beyond the figures given.',
      status: 'active',
    },
    {
      name: 'Engagement activity profiler',
      description:
        'Profiles detailed activity logs, content views, practice sessions, and social discussion engagement for flagged learners. Changes nothing.',
      module: ENGAGEMENT_MODULE_KEY,
      tools_allowed: ['engagement.student_summary'],
      instructions:
        'Diagnose participation trends, digital platform touchpoints, and discussion questions for flagged learners without making character judgements.',
      status: 'active',
    },
    {
      name: 'Re-engagement intervention drafter',
      description:
        'Drafts factual, non-judgmental intervention recommendations for educators to review. Sends nothing externally.',
      module: ENGAGEMENT_MODULE_KEY,
      tools_allowed: ['engagement.draft_intervention_note'],
      instructions:
        'Draft objective, evidence-based re-engagement action plans for educator sign-off. Ensure strict draft-only governance.',
      status: 'active',
    },
  ],

  boundAgent: {
    agentKey: 'k12_engagement',
    workflowKey: 'engagement_intervention_review',
    fallbackName: 'Engagement Agent',
    filters: [
      { key: 'limit', label: 'Records limit', placeholder: '50' },
    ],
    sweepDescription:
      'Scans student attendance, homework, and coursework activity, diagnoses disengagement causes, and drafts personalized educator intervention proposals.',
  },
  noAgentReason: undefined,

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
