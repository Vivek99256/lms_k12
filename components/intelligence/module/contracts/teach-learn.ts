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
 * ── WHAT TEACH/LEARN TURNED OUT TO BE ───────────────────────────────────────
 *
 * Not PAL, not homework, not exams — all three were checked and all three are
 * owned elsewhere in this registry. `tblmenumaster` row 269, level 2 under
 * "LMS + PAL" (230), carries exactly two live level-3 screens:
 *
 *     275  LMS Global Mapping   lmsmapping.index  → /lms/global-mapping
 *     270  Course Catalog       course-master/    → /course-master
 *
 * (488 H5P content and 462 Content Library are both `status = 0`.)
 *
 * So the module is the catalogue of what is taught and the material published
 * against it. That question belongs to no existing contract — Academic reads
 * the timetable and answers about teacher load, Homework reads `homework` and
 * answers about assignments — which is why this is a new contract rather than a
 * reuse. Mapping it onto either would have handed a content screen another
 * module's data, which is the failure mode the registry's own matcher notes
 * warn about.
 *
 * ── WHY `partial` AND NOT `live` ────────────────────────────────────────────
 *
 * The findings are real and reconciled, but ONE institute in this database
 * publishes content at any scale: 14,948 of the 15,005 tenant-owned rows in
 * `content_master` are at institute 195, and the next largest holds 40. The
 * module is honest everywhere — it names what each institute actually has — but
 * it has only been exercised against real volume at one school, and `live`
 * would overstate that.
 *
 * ── THE TWO HALVES SCOPE DIFFERENTLY, AND THE SCREEN SAYS SO ────────────────
 *
 * `sub_std_map` — the courses — has NO `syear` column, so the catalogue is not
 * year-scoped and the header's year does not apply to it. `content_master` has
 * `syear` populated on all 31,197 rows, so the material is year-scoped
 * natively. Every course figure is therefore the standing catalogue and every
 * content figure is this year's, and the copy never blurs the two.
 *
 * ── WHAT THIS SCREEN REFUSES TO SHOW ────────────────────────────────────────
 *
 * NO CHAPTER FIGURES, ANYWHERE. `chapter_master` holds 446 rows across the
 * entire database against 31,192 content rows carrying a chapter id; at
 * institute 195 in 2025 it is 1,918 of 1,918 unresolved. Grouping by that id
 * would draw a chart of structure that does not exist, so the only place
 * chapters appear is the finding and the record check reporting that they do
 * not resolve.
 *
 * NO COVERAGE RATE AT A SCHOOL THAT DOES NOT PUBLISH. 782 courses and no
 * content is not "0% covered" — it is an institute not using the content
 * library, and the backend says exactly that instead. This is the same
 * correction HR Intelligence had to make when it reported "0 leave days" at
 * schools with no leave register.
 *
 * NO FILE IS EVER NAMED. Titles, descriptions, filenames, URLs and meta tags
 * name real teaching material prepared by identifiable staff. `file_type` — a
 * format token such as `pdf` or `mp4` — is the only content column whose value
 * reaches this screen.
 */
export const teachLearnIntelligenceContract = defineContract({
  key: 'teach-learn',
  label: 'Teach/Learn Intelligence',
  accent: '#15803D', // Green-700 — a curriculum accent, distinct from the records and finance modules
  grain: 'one course — one subject taught to one class — and the teaching material published against it',
  nouns: { singular: 'course', plural: 'courses' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/teach-learn/intelligence')),

  actions: {
    run: () => runModuleIntelligence('teach-learn'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith({
    position: {
      title: 'Curriculum position',
      description:
        'What this institute offers and what has been published against it. The course count is the standing catalogue and is NOT year-scoped — sub_std_map carries no academic year — while every content figure is this year’s. A coverage rate over no published content is left blank rather than shown as zero.',
    },
    breakdowns: {
      title: 'Where the material sits',
      description:
        'Coverage by class, the formats the library is made of, and what this institute has published in every year it has used it. No chapter breakdown appears here: the chapter ids this content carries do not resolve against the institute’s own chapter master, and the record checks say by how much.',
    },
    findings: {
      description:
        'What the catalogue and the content library show together — which is the thing neither screen can show alone, because the Course Catalog lists an empty course exactly as it lists a full one. Each finding states what happened, why it matters, and the figures it rests on.',
    },
    priorities: {
      description:
        'The courses a class can open and find nothing in, and the content that cannot be placed in the syllabus.',
    },
    dataQuality: {
      title: 'Catalogue health',
      description:
        'Checks on the records themselves: whether each offered course carries material, whether each item can be placed in the curriculum, and whether prepared material is reachable. Each one is an exact count against this year’s rows.',
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
  }),

  summaryMetrics: ['courses', 'coursesWithContent', 'contentCoverage', 'items', 'formats', 'hidden'],

  emptyState: {
    title: 'No teaching content published for this academic year',
    fallbackReason:
      'This institute has not published teaching content against its course catalogue for the year selected in the header, or fewer than 20 items exist for it. The catalogue itself is reported above where it exists — a school that does not use the content library is not a school with an empty curriculum.',
  },
});
