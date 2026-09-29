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
 * Visitor Management Intelligence.
 *
 * Reads the gate register — visitor_master and visitor_type — scoped by this
 * institute's own term dates against the visit date.
 *
 * ── WHAT THIS SCREEN WILL NOT SHOW ──────────────────────────────────────────
 *
 * NO VISIT DURATION, ANYWHERE. Entry and exit are bare times on an
 * inconsistent clock, and a meaningful share of closed visits record an exit
 * before the entry, so a dwell time would be wrong rather than approximate.
 * What is reported instead is whether a visit was ever closed at all.
 *
 * NO VISITOR IS NAMED. Name, contact, email, photo and the host field are not
 * read by this module and never appear on this screen — only counts, shares
 * and the visitor-type register.
 */
export const visitorIntelligenceContract = defineContract({
  key: 'visitor',
  label: 'Visitor Management Intelligence',
  accent: '#8B5CF6',
  grain: 'one visitor’s gate entry',
  nouns: { singular: 'visit', plural: 'visits' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/visitor/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('visitor'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Gate position',
        description:
          'What the gate register shows for this academic year’s term dates. There is no visit-length figure here or anywhere on this screen — entry and exit are bare times on an inconsistent clock, so what is reported is only whether a visit was ever signed out again.',
      },
      breakdowns: {
        title: 'Where visits sit',
        description:
          'The same visits sliced by visitor type against this institute’s own visitor_type master, and by month across the academic year — the finest structure the register’s grain supports. No visitor is named in either slice.',
      },
      findings: {
        description:
          'What visitor_master shows for this year: visits never signed out, visitor types filed against ids this institute does not hold, and rows with no usable date. Each finding carries the counts it rests on, never a duration.',
      },
      priorities: {
        description:
          'The gate register risks worth acting on first — concentrations of visits that were never closed, and visitor types that resolve to no record this institute actually holds — with the next step each one implies.',
      },
      dataQuality: {
        title: 'Gate register checks',
        description:
          'Exact counts against this year’s rows: visits with no recorded exit, visits whose date falls outside every window a date can be checked against, and visitor-type ids used on a visit that this institute’s own visitor_type master does not contain.',
      },
      recommendations: {
        description:
          'Each recommendation names the finding it answers and the cause the engine was authorised to state. A recommendation whose rule has no approved cause carries no explanation rather than a composed one. Approving one records a decision against your name; it does not execute anything on its own.',
      },
      decisions: {
        description:
          'What was decided, what was queued, and what it actually achieved. A decision with nothing queued and an execution with no outcome reported are real states of the loop, not missing data.',
      },
      learning: {
        description:
          'What earlier decisions in this module actually achieved, carried forward so the next one is better informed. Deliberately not filtered to the year you are viewing — what worked last year is exactly what should inform this one.',
      },
    },
  ),

  // Capped at six — the summary strip takes the first six and drops the
  // rest. 'averageVisitLength' is left out deliberately: it is a real Metric
  // key BrainVisitorIntelligenceController::position() forwards, but its
  // value is always null (entry/exit are not on a consistent clock), so it
  // would read as a permanently empty tile on the summary strip rather than
  // as data. Matched against that method's actual 'key' => '...' lines —
  // 'visits', 'openVisits', 'openShare', 'priorShare', 'visitorTypes',
  // 'daysWithVisits' and 'averageVisitLength' are the only Metric objects it
  // forwards.
  summaryMetrics: ['visits', 'openVisits', 'openShare', 'visitorTypes', 'daysWithVisits', 'priorShare'],

  emptyState: {
    title: 'No visitor data yet',
    fallbackReason: 'No visitor entries have been recorded for this institute-year.',
  },
});
