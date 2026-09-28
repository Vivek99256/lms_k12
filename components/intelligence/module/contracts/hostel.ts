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
 * Hostel & Boarding Intelligence.
 *
 * Built on `hostel_room_allocation` and `hostel_room_master` (plus the
 * building/floor/hostel masters they hang off). Most institutes in this
 * system are day schools, not boarding schools, so this module truthfully
 * reports insufficient data far more often than it renders a populated
 * screen — that is a fact about the estate, not a gap in the query.
 *
 * NO OCCUPANCY, ANYWHERE. There is no bed-count or capacity column against a
 * room in this schema, so an occupancy percentage would have to be invented;
 * the position instead shows how many rooms and beds are on file and leaves
 * that figure null.
 */
export const hostelIntelligenceContract = defineContract({
  key: 'hostel',
  label: 'Hostel & Boarding Intelligence',
  accent: '#A16207',
  grain: 'one hostel room allocation',
  nouns: { singular: 'boarder', plural: 'boarders' },

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
          'Children placed, hostels and rooms registered, and how many placement rooms actually exist on file — read live from hostel_room_allocation and hostel_room_master. A figure shown as a dash means the schema cannot support it, never a zero.',
      },
      breakdowns: {
        title: 'Where boarders sit',
        description:
          'Children placed under each registered hostel, with its buildings and floors — the finest structure the allocation records support. No occupancy column: this system records no capacity against a room.',
      },
      findings: {
        description:
          'What the hostel and room-allocation records show — placements naming a room that does not exist, rooms with no hostel or floor behind them, and hostels with no warden named — each with the counts it rests on.',
      },
      priorities: {
        description:
          'The structural risks worth acting on first in the boarding estate — orphaned rooms, placements pointing at records that do not exist, and hostels missing a named warden.',
      },
      dataQuality: {
        title: 'Hostel & room checks',
        description:
          'Exact counts against this year’s rows: placements naming a room hostel_room_master has no record of, rooms with no floor or building behind them, and hostels with no warden on file.',
      },
      recommendations: {
        description:
          'Each recommendation names the finding it answers and the cause the engine was authorised to state. A recommendation whose rule has no approved cause carries no explanation rather than a composed one. Approving one records a decision against your name; it does not execute anything on its own.',
      },
    },
  ),

  // Capped at six — the summary strip takes the first six and drops the
  // rest. 'occupancy' is deliberately left out: the schema has no bed-count
  // or capacity column against a room, so it is always null and would only
  // ever render as a dash in the strip. Matched against the Metric objects
  // BrainHostelIntelligenceController::position() actually forwards —
  // boarders, hostels, rooms, roomsOnFile, occupancy, bedNumbersIssued and
  // wardensNamed are the only keys it serves.
  summaryMetrics: ['boarders', 'hostels', 'rooms', 'roomsOnFile', 'bedNumbersIssued', 'wardensNamed'],

  emptyState: {
    title: 'No hostel or boarding data yet',
    fallbackReason:
      'No hostel, room or placement records have been registered for this institute-year. Many institutes on this system are day schools rather than boarding schools, so this is the common case, not a failure.',
  },
});
