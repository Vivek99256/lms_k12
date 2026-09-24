import { brainFetch, tenantPath } from '@/lib/brain/api';

import { defineContract, sectionsWith } from '../contract';
import type { ModuleIntelligencePayload } from '../payload';

/**
 * Document Templates Intelligence.
 *
 * The institute's own template library.
 *
 * THIS IS NOT RESULT INTELLIGENCE. The module used to resolve to the Result
 * contract through a shared route family, so opening Document Templates showed
 * marks. It now reads the template tables and nothing else.
 *
 * NO ADAPTER. `BrainDocumentTemplateIntelligenceController` emits the canonical
 * `ModuleIntelligencePayload` directly, so `load` is a bare `brainFetch` and
 * everything here is presentation.
 *
 * NO `run` ACTION. This module's findings are computed per request rather than
 * written to the signal ledger, so the renderer hides "Analyse this year"
 * instead of offering a button that would recompute nothing. The L5 sections
 * are still declared: `ModuleLoop` reads them back from the ledger and they
 * report honestly that nothing has been recorded against this module yet.
 */
export const documentTemplatesIntelligenceContract = defineContract({
  key: 'document-templates',
  label: 'Document Templates Intelligence',
  accent: '#6D28D9',
  grain: 'one document template',
  nouns: { singular: 'template', plural: 'document templates' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/document-templates/intelligence')),

  actions: {},

  sections: sectionsWith({
    position: {
      title: 'Library position',
      description:
        'Templates are standing assets with no academic year, so these are all-time institute figures. Product-shipped ai_templates rows are excluded: they carry no institute.',
    },
    breakdowns: {
      title: 'Coverage by module',
      description:
        'Which modules have documents to offer. A module absent from this table has none, and staff there compose by hand.',
    },
    findings: {
      description:
        'Gaps in the library — templates authored but left empty, narrow module coverage, and whether a report-card layout exists at all.',
    },
    dataQuality: {
      title: 'Template checks',
      description:
        'Exact counts against this institute’s template rows: empty bodies, unassigned modules and missing titles.',
    },
  }),

  // Matched against the metric keys the controller actually forwards. A key the
  // controller never sends renders nothing at all, silently.
  summaryMetrics: ['templates', 'modulesCovered', 'active', 'emptyBody', 'reportCardTemplates', 'authors'],

  emptyState: {
    title: 'No templates authored yet',
    fallbackReason:
      'No document templates have been authored for this institute.',
  },
});
