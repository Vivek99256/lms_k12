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
 * ── WHY THIS SCREEN SHOWS NO VISIT DURATION ─────────────────────────────────
 *
 * `visitor_master` stores entry and exit as bare TIME columns with no date and
 * no record of whether they are on a 12- or a 24-hour clock. Measured at the
 * richest institute, 12 of 112 closed visits in one year record an exit EARLIER
 * than the entry — `13:00:00` in, `01:53:10` out. An average visit length drawn
 * from that would be negative on one row in nine and silently twelve hours out
 * on others, so there is no dwell time, average length or longest-visit figure
 * anywhere on this screen. The contradicting rows are counted in the record
 * checks instead.
 *
 * What CAN be said is whether a visit was ever closed at all, and at one
 * institute 27.7% of a year's visitors were never signed out — which is the
 * whole point of keeping a gate register.
 *
 * ── WHY THE TYPE BREAKDOWN IS SOMETIMES EMPTY ───────────────────────────────
 *
 * One institute in this database files every one of its visitors under
 * visitor-type id 10, a row belonging to a DIFFERENT institute, while its own
 * six types sit unused. Types are resolved against the institute's own master
 * and against no other, so that breakdown reports unavailable with the reason
 * rather than reading another school's reference data onto this screen. The
 * mismatch is raised as a finding in its own right.
 *
 * ── WHAT THIS SCREEN NEVER SHOWS ────────────────────────────────────────────
 *
 * No visitor is named. `name`, `contact`, `email`, `photo` and `visitor_idcard`
 * are not read at all — a gate register is the most re-identifying table in
 * this database. `to_meet` is not read either: it holds a staff id on most rows
 * and a typed human name on the rest, so it can be neither joined nor displayed.
 * Every figure here is a count or a share.
 */
export const visitorIntelligenceContract = defineContract({
  key: 'visitor',
  label: 'Visitor Management Intelligence',
  accent: '#0E7490', // Cyan-700 — distinct from Hostel's indigo and Result's teal
  grain: 'one person arriving at the gate on one day, signed in and — sometimes — signed out again',
  nouns: { singular: 'visit', plural: 'visits' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/visitor/intelligence')),

  actions: {
    run: () => runModuleIntelligence('visitor'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith({
    position: {
      title: 'Gate position',
      description:
        'Who came through the gate this year, how much of it the register closed again, and how much of it was expected. Visit length is deliberately absent: the entry and exit columns are bare times on an inconsistent clock, so any duration would be invented.',
    },
    breakdowns: {
      title: 'Who comes through the gate',
      description:
        'By kind of visitor and across the year. Visitor types are resolved against this institute’s own master only, so this is empty rather than wrong where the register names another institute’s type ids.',
    },
    findings: {
      description:
        'What the register shows, and where it stops being able to answer the question it exists for. The structural checks run whether or not the year holds enough visits to describe the gate — a visit filed under a type this institute does not hold is true of the records at any size.',
    },
    priorities: {
      description:
        'The visits the register never closed, and the reference gaps that stop it saying what kind of visitor anybody was.',
    },
    dataQuality: {
      title: 'Gate record health',
      description:
        'Whether visits are closed, whether the times contradict themselves, whether the visitor type resolves, and what this schema simply cannot record.',
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

  summaryMetrics: ['visits', 'openVisits', 'openShare', 'priorShare', 'visitorTypes', 'daysWithVisits'],

  emptyState: {
    title: 'No visitor records for this academic year',
    fallbackReason:
      'This institute has not recorded visitors through the gate register for the year selected in the header, or fewer than 20 visits fall inside its own term dates.',
  },
});
