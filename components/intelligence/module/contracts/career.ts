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
 * Career Intelligence — evidence readiness for the Grade 9-10 cohort.
 *
 * Built on `evidence_events` (the append-only career evidence ledger) and
 * `student_aspirations`. Neither table has an institute column, so an
 * institute's career data is the rows whose student is enrolled there this year
 * in Grade 9 or 10; every figure is counted over that cohort and the screen
 * says so under Data quality.
 *
 * ── WHAT THIS SCREEN WILL NOT SHOW ──────────────────────────────────────────
 *
 * Nothing about an individual student: findings carry counts, never ids. It is
 * not the counselling workspace (that is `/career-intelligence`), it does not
 * collect evidence, and it executes nothing — recommendations wait for a human
 * decision like every other module's.
 */
export const careerIntelligenceContract = defineContract({
  key: 'career',
  label: 'Career Intelligence',
  accent: '#0D9488',
  grain: 'one Grade 9-10 student on the roll',
  nouns: { singular: 'student', plural: 'students' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/career/intelligence')),

  actions: {
    run: () => runModuleIntelligence('career'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith({
    position: {
      title: 'Career evidence position',
      description:
        'How many Grade 9-10 students on the roll have any row in the career evidence ledger, how many ledger rows stand, and how many stated aspirations have nothing behind them — read from `evidence_events` and `student_aspirations` when you loaded the page.',
    },
    breakdowns: {
      title: 'Where the evidence sits',
      description:
        'The same ledger sliced by the adapter that wrote each row, and the cohort sliced by grade with the share of each grade that has any evidence.',
    },
    findings: {
      description:
        'What the ledger shows about evidence coverage, aspirations without support, stale observations and revised rows. Each finding carries the counts it rests on and names how many students, never which.',
    },
    priorities: {
      description: 'The career evidence gaps worth acting on first, with the next step each one implies.',
    },
    dataQuality: {
      title: 'Ledger & scope checks',
      description:
        'How the career tables are attributed to this institute (through student enrolment, since they carry no institute column), and how many ledger rows have been superseded or contested.',
    },
    recommendations: {
      description:
        'Each recommendation names the finding it answers and the cause the engine was authorised to state. Only the coverage rule has an approved cause; the others carry none rather than a composed one. Approving one records a decision against your name; it does not execute anything.',
    },
  }),

  summaryMetrics: [
    'cohort',
    'evidenced',
    'coverageRate',
    'events',
    'aspirants',
    'aspirantsWithoutEvidence',
  ],

  emptyState: {
    title: 'No career cohort yet',
    fallbackReason: 'No Grade 9 or 10 students are enrolled for this institute-year, so there is nothing for career evidence to cover.',
  },
});
