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
 * Hostel & Residential Boarding Intelligence.
 *
 * ── WHY THIS SCREEN SHOWS NO OCCUPANCY ──────────────────────────────────────
 *
 * `hostel_room_master` holds an id, a floor and a room name. There is no bed
 * count, no room type and no occupancy limit anywhere in this schema — so how
 * full a boarding house is CANNOT be computed from it, at any institute. An
 * earlier version reported an "average room density" of boarders divided by the
 * rooms named in the allocations, which is to say divided by rooms that do not
 * exist in the room master at all. There is no occupancy column on this screen
 * and the position card says why rather than leaving a blank.
 *
 * What it does report is the structure that is on file, the children who are
 * placed, and the joins that fail — which at every institute in this database is
 * where the real finding is.
 */
export const hostelIntelligenceContract = defineContract({
  key: 'hostel',
  label: 'Hostel & Boarding Intelligence',
  accent: '#6366F1', // Indigo
  grain: 'one child placed in one room for a year, with the bed and locker numbers issued to them',
  nouns: { singular: 'placement', plural: 'placements' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/hostel/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('hostel'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Boarding position',
        description:
          'The structure on file, the children placed in it, and how much of the two actually joins up. Occupancy is deliberately absent: this system records no bed count or capacity against a room, so the figure would have to be invented.',
      },
      breakdowns: {
        title: 'Where children are placed',
        description:
          'What is on file under each registered boarding house. There is no occupancy column here for the same reason it is missing above.',
      },
      findings: {
        description:
          'What the records show and where the chain breaks — hostel, building, floor, room. These are reported whether or not there are enough placements to analyse, because a placement naming a room nobody registered is true of the records at any size.',
      },
      priorities: {
        description:
          'The placements and rooms that cannot be resolved, and the boarding houses with nobody named against them.',
      },
      dataQuality: {
        title: 'Boarding record health',
        description:
          'Whether each link in the chain resolves, whether children in boarding are on the roll, and what this schema simply cannot record.',
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

  summaryMetrics: [
    'boarders',
    'hostels',
    'rooms',
    'roomsOnFile',
    'bedNumbersIssued',
    'wardensNamed',
  ],

  emptyState: {
    title: 'No hostel records found',
    fallbackReason:
      'This institute does not operate residential hostel boarding, or fewer than 5 allocations exist in the ERP for this academic year.',
  },
});

