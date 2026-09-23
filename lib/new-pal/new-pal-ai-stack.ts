'use client';

/**
 * The New PAL module's AI Stack declaration.
 *
 * New PAL (`app/pal/new/**`) is a distinct, richer module from the older `pal` module —
 * content model, administration, gamification and coherence mapping, each backed by its
 * own real tables (`pal_cm_node_overrides`, `pal_architecture_settings`,
 * `pal_learning_events`, `pal_concept_relations`, and more). Before this descriptor and
 * its `ai_modules` row, `/pal/new/**` silently resolved to the older `pal` module's tools —
 * a real instance of the cross-module leakage this AI Stack architecture exists to catch.
 * Its three tools (`new_pal.gamification_summary`, `new_pal.content_model_status`,
 * `new_pal.coherence_gaps`) wrap the same services the real `/pal/new/**` screens use —
 * `GamificationService`, `ContentModelCoverageService`, `CoherenceMapRepository` — never
 * the older `pal` module's tables.
 *
 * NOTHING HERE IS A RECORD. Every figure the tabs show is looked up at runtime, scoped to
 * the caller's institute by their own token.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const NEW_PAL_MODULE_KEY = 'new_pal';

export const NEW_PAL_AI_STACK_ROUTE = '/modules/new-pal/ai-stack';

export const NEW_PAL_AI_STACK: AiStackModule = {
  key: NEW_PAL_MODULE_KEY,
  menuSlug: 'new-pal',
  label: 'New PAL',
  records: 'personalised-learning records',
  record: 'PAL record',
  route: NEW_PAL_AI_STACK_ROUTE,
  subjectEntityKey: 'student',

  copy: {
    centralRisk:
      'a gamification streak, a content model gap or a coherence-map reading describes recorded activity and structure, not a verdict on a child’s ability. Every published New PAL prompt carries a safety rule forbidding the model from characterising a learner as gifted, struggling or behind from these figures alone, and from confusing New PAL’s own records with the older PAL module’s.',
    policyNamePlaceholder: 'New PAL communication policy',
    promptSystemDefault:
      'You answer questions about personalised learning — content model coverage, gamification activity and concept coherence — for a teacher or coordinator, using only New PAL’s own records. If a chapter, class or learner is not in them, say so rather than estimating. A gamification or coherence figure describes recorded activity and structure, not a verdict on a child’s ability.',
    reportCanPrint: 'the figures come from New PAL’s own content-model, gamification and coherence records rather than from a model.',
    groundedOn: 'the recorded content-model, gamification and coherence data above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to New PAL, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read New PAL’s own records.',
    capabilityWorkflow: 'No workflow is bound to New PAL, so nothing in this module pauses for an approval.',
  },

  report: {
    defaultDataSource: 'new_pal.content_model_status',
    filters: [
      { key: 'standard_id', label: 'Standard id', kind: 'number', placeholder: 'all' },
      { key: 'subject_id', label: 'Subject id', kind: 'number', placeholder: 'all' },
    ],
    operation: 'new_pal_content_model_report',
    emptyNote:
      'No content model recorded for this institute and those filters, so no report was created.',
  },

  presets: [
    {
      name: 'Gamification reader',
      description: 'Reads a learner’s recorded learning events, streaks, badges and framework progress. Changes nothing.',
      module: NEW_PAL_MODULE_KEY,
      tools_allowed: ['new_pal.gamification_summary'],
      instructions:
        'Report the learner’s recorded activity exactly as returned. Never characterise the learner’s ability beyond the figures given.',
      status: 'active',
    },
    {
      name: 'Content model coverage reader',
      description: 'Reads institute-wide content model coverage across chapters. Changes nothing.',
      module: NEW_PAL_MODULE_KEY,
      tools_allowed: ['new_pal.content_model_status'],
      instructions: 'Report coverage exactly as recorded, by content-model type.',
      status: 'active',
    },
    {
      name: 'Coherence map reader',
      description: 'Reads concept relations and mastery evidence for one class and subject. Changes nothing.',
      module: NEW_PAL_MODULE_KEY,
      tools_allowed: ['new_pal.coherence_gaps'],
      instructions:
        'Report gaps exactly as recorded. If the coherence map is unavailable, say so rather than estimating a figure.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'New PAL has no case-opening agent yet; reports and conversational answers are grounded directly on its own content-model, gamification and coherence records.',

  operations: {
    new_pal_content_model_report: {
      key: 'new_pal_content_model_report',
      label: 'Content model coverage report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'coverage'],
    },
    new_pal_summary: {
      key: 'new_pal_summary',
      label: 'PAL summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    new_pal_recommendation: {
      key: 'new_pal_recommendation',
      label: 'PAL recommendation',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['recommendation'],
    },
    new_pal_progress_summary: {
      key: 'new_pal_progress_summary',
      label: 'Learning progress summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['progress', 'summary'],
    },
    new_pal_agent_run: {
      key: 'new_pal_agent_run',
      label: 'New PAL agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
