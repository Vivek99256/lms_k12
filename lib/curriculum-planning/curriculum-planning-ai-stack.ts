'use client';

/**
 * The Curriculum Planning module's AI Stack declaration.
 *
 * Curriculum Planning is promoted to its own `ai_modules` key (`curriculum_planning`) from
 * what was a tab inside `lms` (`/lms/curriculum-planning`) — its pages stay at that same
 * URL; only the module scoping is new. Its real data is the curriculum -> unit -> chapter
 * hierarchy plus learning outcomes/competencies, read by `CurriculumPlanningApiController`
 * on the direct REST side and by `curriculum_planning.status` / `curriculum_planning.outcomes`
 * (new MCP tools wrapping the same real tables: `lms_curriculum`, `lms_units`,
 * `chapter_master`, `lms_learning_outcomes`) on the AI side.
 *
 * NOTHING HERE IS A RECORD. Every figure the tabs show is looked up at runtime, scoped to
 * the caller's institute by their own token.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const CURRICULUM_PLANNING_MODULE_KEY = 'curriculum_planning';

export const CURRICULUM_PLANNING_AI_STACK_ROUTE = '/modules/curriculum-planning/ai-stack';

export const CURRICULUM_PLANNING_AI_STACK: AiStackModule = {
  key: CURRICULUM_PLANNING_MODULE_KEY,
  menuSlug: 'curriculum-planning',
  label: 'Curriculum Planning',
  records: 'curriculum and unit coverage records',
  record: 'curriculum coverage record',
  route: CURRICULUM_PLANNING_AI_STACK_ROUTE,
  subjectEntityKey: 'curriculum',

  copy: {
    centralRisk:
      'a chapter marked planned is not the same as a chapter taught, and a chapter taught is not the same as a chapter learned. Every published Curriculum Planning prompt carries a safety rule forbidding the model from reporting planned or scheduled coverage as delivered instruction, or delivered instruction as student learning.',
    policyNamePlaceholder: 'Curriculum Planning communication policy',
    promptSystemDefault:
      'You answer questions about curriculum, units, chapters and learning outcomes for a coordinator or teacher. Use only the coverage records you are given. If a subject, standard or curriculum is not in them, say so rather than estimating. A chapter’s coverage percentage describes planning and completion status, not what students learned from it.',
    reportCanPrint: 'the coverage figures come from the curriculum and chapter records themselves rather than from a model.',
    groundedOn: 'the recorded curriculum, unit and chapter data above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Curriculum Planning, so nothing here opens a case or drafts a recommendation. The tool agents on the Automations tab still read the coverage records.',
    capabilityWorkflow: 'No workflow is bound to Curriculum Planning, so nothing in this module pauses for an approval.',
  },

  report: {
    defaultDataSource: 'curriculum_planning.status',
    filters: [
      { key: 'standard_id', label: 'Standard id', kind: 'number', placeholder: 'all' },
      { key: 'subject_id', label: 'Subject id', kind: 'number', placeholder: 'all' },
      { key: 'syear', label: 'School year', kind: 'number', placeholder: 'current' },
    ],
    operation: 'curriculum_planning_status_report',
    emptyNote:
      'No curriculum recorded for this institute, year and filters, so no report was created. Nothing is shown in place of a genuinely unset curriculum.',
  },

  presets: [
    {
      name: 'Curriculum coverage reader',
      description: 'Reads curriculum, unit and chapter coverage for a subject and standard. Changes nothing.',
      module: CURRICULUM_PLANNING_MODULE_KEY,
      tools_allowed: ['curriculum_planning.status'],
      instructions:
        'Report coverage exactly as recorded. State chapter and completion counts, not a judgement about teaching quality — coverage is an administrative fact, not an outcome.',
      status: 'active',
    },
    {
      name: 'Learning outcomes reader',
      description: 'Reads the learning outcomes and competencies declared against a curriculum. Changes nothing.',
      module: CURRICULUM_PLANNING_MODULE_KEY,
      tools_allowed: ['curriculum_planning.outcomes'],
      instructions: 'Report outcomes and competencies exactly as recorded, with their codes.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'Curriculum Planning has no case-opening agent yet; reports and conversational answers are grounded directly on curriculum and chapter records.',

  operations: {
    curriculum_planning_status_report: {
      key: 'curriculum_planning_status_report',
      label: 'Curriculum coverage report',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'coverage'],
    },
    curriculum_plan_summary: {
      key: 'curriculum_plan_summary',
      label: 'Curriculum plan',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['curriculum plan', 'plan'],
    },
    curriculum_summary: {
      key: 'curriculum_summary',
      label: 'Curriculum summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    curriculum_outcome_report: {
      key: 'curriculum_outcome_report',
      label: 'Learning objective report',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['outcome', 'objective'],
    },
    curriculum_planning_agent_run: {
      key: 'curriculum_planning_agent_run',
      label: 'Curriculum Planning agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
