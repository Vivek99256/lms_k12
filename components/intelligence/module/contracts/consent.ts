import { brainFetch, tenantPath } from '@/lib/brain/api';

import { defineContract, sectionsWith } from '../contract';
import type { ModuleIntelligencePayload } from '../payload';

/**
 * Consent Intelligence.
 *
 * Student consent for the selected academic year.
 *
 * These rows carry an amount and an imprest head, so this is consent with money
 * attached rather than a permission flag - and the totals below are money
 * consented to, not money collected.
 *
 * NO ADAPTER. `BrainConsentIntelligenceController` emits the canonical
 * `ModuleIntelligencePayload` directly, so `load` is a bare `brainFetch` and
 * everything here is presentation.
 *
 * NO `run` ACTION. This module's findings are computed per request rather than
 * written to the signal ledger, so the renderer hides "Analyse this year"
 * instead of offering a button that would recompute nothing. The L5 sections
 * are still declared: `ModuleLoop` reads them back from the ledger and they
 * report honestly that nothing has been recorded against this module yet.
 */
export const consentIntelligenceContract = defineContract({
  key: 'consent',
  label: 'Consent Intelligence',
  accent: '#4338CA',
  grain: 'one student consent record',
  nouns: { singular: 'consent record', plural: 'consent records' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/consent/intelligence')),

  actions: {},

  sections: sectionsWith({
    position: {
      title: 'Consent position',
      description:
        'Consent raised for the selected year, with the amount attached and how much of it is marked accountable against an imprest head.',
    },
    breakdowns: {
      title: 'What consent was raised for',
      description:
        'Grouped by request, by class, and by the institute’s own status codes — which are reported rather than translated.',
    },
    findings: {
      description:
        'Reach and accountability — which classes were actually asked, and whether money consented to is tied to an imprest head.',
    },
    dataQuality: {
      title: 'Consent register checks',
      description:
        'Exact counts against this year’s rows: records with no student, no date or no title.',
    },
  }),

  // Matched against the metric keys the controller actually forwards. A key the
  // controller never sends renders nothing at all, silently.
  summaryMetrics: ['records', 'students', 'classes', 'titles', 'totalAmount', 'accountable'],

  emptyState: {
    title: 'No consent raised yet',
    fallbackReason:
      'No consent records were raised for the academic year selected in the header.',
  },
});
