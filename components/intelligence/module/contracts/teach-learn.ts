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
 * Teach/Learn Intelligence — the curriculum content catalogue.
 *
 * Reads `sub_std_map` (the courses) and `content_master` (the material
 * published against them) — not PAL, not homework, not exams, each of which
 * is checked and owned elsewhere. The two tables scope differently and this
 * screen says so: `sub_std_map` carries no academic year, so the catalogue
 * itself is not year-scoped, while `content_master` carries one on every row,
 * so what was published this year is.
 *
 * ── WHAT THIS SCREEN WILL NOT SHOW ──────────────────────────────────────────
 *
 * No chapter figure appears anywhere. `chapter_master` holds 446 rows
 * database-wide against 31,192 content rows citing a chapter, and 28,392 of
 * those citations resolve to nothing — so the only mention of chapters here
 * is the finding that the references mostly do not resolve, never a chapter
 * count. Institute 1's shared library is also never counted as a tenant's own
 * coverage: standard ids are tenant-scoped, so it joins to one course at
 * institute 195 and none at 254.
 *
 * ── WHY THIS SCREEN IS `partial` ─────────────────────────────────────────────
 *
 * The findings are real and reconciled, but one institute in this database
 * publishes content at any scale: 14,948 of the 15,005 tenant-owned
 * `content_master` rows are at institute 195, and the next largest holds 40.
 * Every other institute gets an honest unavailable state naming what it
 * actually has, rather than a chart with nothing in it.
 */
export const teachLearnIntelligenceContract = defineContract({
  key: 'teach-learn',
  label: 'Teach/Learn Intelligence',
  accent: '#16A34A', // Green-600 — reserved for Teach/Learn, distinct from every other contract's accent
  grain: 'one piece of published course content',
  nouns: { singular: 'content item', plural: 'content items' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/teach-learn/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('teach-learn'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Curriculum position',
        description:
          'The course catalogue as it stands, and what has been published against it this year. The course count follows the standing catalogue — sub_std_map carries no academic year — while content, coverage, format and hidden-item figures are all scoped to the year selected in the header.',
      },
      breakdowns: {
        title: 'Where the catalogue sits',
        description:
          'The same catalogue sliced by class, by content format, and across every year this institute has published in. No chapter-level figure appears in any of these — chapter references on content rows mostly do not resolve against this institute’s own chapter master, so only that fact is shown, never a count by chapter.',
      },
      findings: {
        description:
          'What the catalogue and content library show together — courses with no material behind them, material published but hidden from learners, and chapter references that do not resolve. Each finding states what happened, why it matters, and the figures it rests on.',
      },
      priorities: {
        description:
          'The catalogue gaps worth acting on first — courses carrying no published content this year, and content prepared but left hidden from the learners it was meant for.',
      },
      dataQuality: {
        title: 'Catalogue & content checks',
        description:
          'Exact counts against this year’s rows: courses with nothing published, content citing a chapter that does not resolve in this institute’s chapter master, and the other record gaps that limit what the figures above can say.',
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

  // Matched against the Metric keys BrainTeachLearnIntelligenceController::position()
  // actually serves — courses, coursesWithContent, contentCoverage, items,
  // formats and hidden — which is exactly six, the summary strip's cap.
  summaryMetrics: ['courses', 'coursesWithContent', 'contentCoverage', 'items', 'formats', 'hidden'],

  emptyState: {
    title: 'No published course content yet',
    fallbackReason:
      'No published course content is available for this institute in the year selected in the header. This module is genuinely concentrated at one institute in the whole database — most institutes will honestly see this state rather than a small or zero figure.',
  },
});
