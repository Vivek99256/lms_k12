'use client';

/**
 * The Document Templates module's AI Stack declaration.
 *
 * See `lib/exam/exam-ai-stack.ts` for what a descriptor is and what it is not. Nothing
 * here is a record.
 *
 * THE TABLES ARE EMPTY ACROSS THIS ENTIRE ESTATE
 *
 * Zero rows in `document_templates` and `document_template_versions`, for every institute.
 * That is a real answer and this module gives it plainly.
 *
 * It is also the module's central risk, because an empty list is the single most tempting
 * thing for a model to fill in: asked "what templates do we have", the helpful-sounding
 * reply is a list of templates a school usually has. Every published prompt forbids it —
 * describing templates the school might want, suggesting a library to create, or listing
 * what schools "usually" hold. An empty register is a complete answer.
 *
 * THE KEY CARRIES A HYPHEN
 *
 * `document-templates`, not `document_templates`, because that is how `ai_modules` has
 * spelled it since the workspace was seeded. Everything downstream builds from the key
 * verbatim — `agents.document-templates` is the right, `k12.document-templates.summary`
 * the template key — so the hyphen travels with it.
 *
 * THE DOCUMENT BODY IS MEASURED, NEVER RETURNED
 *
 * `content` is the largest column on the table, and a list is not where a letter belongs.
 * The reads report whether content exists, how long it is, and the `{{merge_field}}`
 * placeholders PARSED from it — a field not in the content is not in the list, which is
 * what makes "which variables does this template use" answerable at all.
 */

import type { AiStackModule } from '@/app/_components/ai-stack/ai-stack-module';

export const DOCUMENT_TEMPLATES_MODULE_KEY = 'document-templates';

/** The route the Document Templates AI Stack reports itself as when it builds a report. */
export const DOCUMENT_TEMPLATES_AI_STACK_ROUTE = '/modules/document-templates/ai-stack';

export const DOCUMENT_TEMPLATES_AI_STACK: AiStackModule = {
  key: DOCUMENT_TEMPLATES_MODULE_KEY,
  menuSlug: 'document-templates',
  label: 'Document Templates',
  records: 'document templates',
  record: 'document template',
  route: DOCUMENT_TEMPLATES_AI_STACK_ROUTE,
  subjectEntityKey: 'document_template',

  copy: {
    centralRisk:
      'the template tables are empty across this entire estate, and an empty list is the most tempting thing for a model to fill in — asked what templates the school has, the helpful-sounding answer is a list of templates a school usually has. Every published prompt forbids that: describing templates the school might want, proposing a library to create, or saying what schools usually hold. An empty register is a complete answer. The document body is never returned either, only measured and its merge fields parsed, and no reviewer or approval is recorded anywhere.',
    policyNamePlaceholder: 'Document template drafting policy',
    promptSystemDefault:
      'You summarise a document template register for a school office. Use only the templates you are given. The merge fields you were given were parsed from the stored content; a field not in that list is not in the template. You have NOT been given the document body: never quote or describe what a template says. IF NO TEMPLATES WERE PROVIDED, say exactly that — never describe templates the school might want or list what schools usually have. This table records no reviewer and no approval.',
    reportCanPrint: 'the template names, statuses, versions and merge fields come from the register itself rather than from a model.',
    groundedOn: 'the template records above, which is the stronger ground of the two.',
    capabilityAgent:
      'No agent manifest is bound to Document Templates, so nothing here publishes or deletes a template. The tool agents on the Automations tab still read the register and draft content for a person to review.',
    capabilityWorkflow:
      'No workflow is bound to Document Templates. Publishing a template puts a document in front of families and stays a person’s act on the template screen.',
  },

  report: {
    defaultDataSource: 'doc_templates.list',
    // Exactly the arguments `doc_templates.list` accepts, from the tool's own schema.
    filters: [
      { key: 'status', label: 'Status', kind: 'text', placeholder: 'all', hint: 'As stored, e.g. draft or published.' },
      { key: 'category', label: 'Category', kind: 'text', placeholder: 'all' },
      { key: 'search_text', label: 'Search', kind: 'text', placeholder: 'name or description' },
      { key: 'limit', label: 'Rows', kind: 'number', defaultValue: '200' },
    ],
    operation: 'document_template_report',
    emptyNote:
      'No document templates matched those filters, so no report was created. These tables are empty across this estate today, so that is the expected answer and not a gap to fill in.',
  },

  presets: [
    {
      name: 'Template register reader',
      description:
        'Reads which templates exist, their status and the merge fields their content contains. Changes nothing.',
      module: DOCUMENT_TEMPLATES_MODULE_KEY,
      tools_allowed: ['doc_templates.list'],
      instructions:
        'If no templates are returned, say exactly that. Never describe templates the school might want, propose a library, or say what schools usually have. You are not given the document body — never quote or summarise what a template says. Report only the merge fields you were given.',
      status: 'active',
    },
    {
      name: 'Template version reader',
      description:
        'Reads the saved revisions of one template. Changes nothing.',
      module: DOCUMENT_TEMPLATES_MODULE_KEY,
      tools_allowed: ['doc_templates.list', 'doc_templates.versions'],
      instructions:
        'A version is a save, not an approval: this table records no reviewer and no sign-off, so never say a template was approved or when it went live. An id belonging to another institute comes back not-found; say so rather than searching for a near match.',
      status: 'active',
    },
  ],

  boundAgent: null,
  noAgentReason:
    'The register and its versions are readable, but the Document Templates module has no agent manifest of its own. Publishing a template puts a document in front of families, and the tables are empty in any case.',

  operations: {
    document_template_report: {
      key: 'document_template_report',
      label: 'Document template register',
      capability: 'generative',
      uses: 'report_template',
      prefers: ['report', 'register'],
    },
    document_template_summary: {
      key: 'document_template_summary',
      label: 'Template summary',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['summary'],
    },
    document_template_analysis: {
      key: 'document_template_analysis',
      label: 'Templates analysed',
      capability: 'generative',
      uses: 'prompt',
      prefers: ['analysis'],
    },
    document_template_agent_run: {
      key: 'document_template_agent_run',
      label: 'Document Templates agent run',
      capability: 'agent',
      uses: 'agent',
    },
  },
};
