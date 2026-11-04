import {
  brainFetch,
  decideRecommendation,
  recordExecutionOutcome,
  runModuleIntelligence,
  tenantPath,
} from '@/lib/brain/api';

import { defineContract, sectionsWith } from '../contract';
import type { ModuleIntelligencePayload } from '../payload';

/**
 * Alumni Intelligence.
 *
 * The alumni register as a community, not a list: how many records are verified,
 * how many can actually be written to, who has gone quiet, and whether students
 * who asked for a mentor, and donors who gave, were answered.
 *
 * Alumni are recorded by the batch they left with rather than by academic year,
 * so every figure is an all-time institute total and the screen says so.
 *
 * NO ADAPTER. `BrainAlumniIntelligenceController` emits the canonical
 * `ModuleIntelligencePayload` directly, so `load` is a bare `brainFetch` and
 * everything here is presentation.
 *
 * THE LEDGER IS WRITTEN ON REQUEST. The screen computes its findings live on every
 * load, but Recommendations, Decisions and the learning loop read the signal ledger.
 * "Analyse" writes this module's findings there (idempotent), which is what gives
 * those sections something to show.
 */
export const alumniIntelligenceContract = defineContract({
  key: 'alumni',
  label: 'Alumni Intelligence',
  accent: '#7C3AED',
  grain: 'one alumni record',
  nouns: { singular: 'alumnus', plural: 'alumni' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/alumni/intelligence')),

  actions: {
    run: () => runModuleIntelligence('alumni'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith({
    position: {
      title: 'Alumni position',
      description:
        'Verification, reachability, employment and recent activity across the whole register, with mentoring, events and giving alongside.',
    },
    breakdowns: {
      title: 'Where the alumni sit',
      description: 'Alumni per batch, and what they are doing now.',
    },
    findings: {
      description:
        'Records nobody verified, alumni who cannot be contacted, students waiting on a mentor and donations nobody confirmed — each with the rows behind it.',
    },
    dataQuality: {
      title: 'Alumni register checks',
      description:
        'Exact counts: records with no address, no consent on any channel, no passing year or no employment status.',
    },
  }),

  // Matched against the metric keys the controller actually forwards. A key the
  // controller never sends renders nothing at all, silently.
  summaryMetrics: ['alumni', 'verifiedRate', 'reachableRate', 'employmentRate', 'activeRate', 'mentors'],

  emptyState: {
    title: 'No alumni yet',
    fallbackReason: 'No alumni have been added or imported for this institute yet.',
  },
});
