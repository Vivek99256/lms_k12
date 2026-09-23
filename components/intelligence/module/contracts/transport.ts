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
 * Transport Intelligence.
 *
 * Fleet loading against registered seating, where students actually board, how
 * far they travel and what that is billed at — read from this year's transport
 * arrangements.
 */
export const transportIntelligenceContract = defineContract({
  key: 'transportation',
  label: 'Transport Intelligence',
  accent: '#D97706', // Amber / Gold
  grain: 'one student’s transport arrangement for the year — their vehicle, boarding point, distance and amount',
  nouns: { singular: 'transport arrangement', plural: 'transport arrangements' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/transport/intelligence')),

  actions: {
    // Writes this module's findings to the signal ledger, which is what
    // gives the three sections below anything to show. Idempotent.
    run: () => runModuleIntelligence('transport'),
    decide: (id, verdict, rationale) => decideRecommendation(id, verdict, rationale),
    recordOutcome: (executionId, result, feedback, measured) =>
      recordExecutionOutcome(executionId, result, feedback, measured),
  },

  sections: sectionsWith(
    {
      position: {
        title: 'Fleet and ridership position',
        description:
          'Who travels, on what, and how full it is. Seat figures cover only the vehicles whose registered capacity their own load makes possible; the rest are named in the record checks.',
      },
      breakdowns: {
        title: 'Where transport sits',
        description:
          'The same arrangements sliced by vehicle, boarding point, chargeable distance, travel shift and route.',
      },
      findings: {
        description:
          'One finding per pattern, not per vehicle. Each states how many vehicles or students stand behind it, and names the heaviest in its evidence.',
      },
      priorities: {
        description:
          'The fleet and roll problems worth acting on first, with the next step each one implies.',
      },
      dataQuality: {
        title: 'Transport record checks',
        description:
          'Exact counts against this year’s arrangements: riders missing from the roll, capacities that cannot be true, and arrangements with no vehicle, stop or amount.',
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
    'riders',
    'seatUtilization',
    'vehiclesInService',
    'stopsInService',
    'materiallyOverVehicles',
    'unbilledArrangements',
  ],

  emptyState: {
    title: 'No transport arrangements for this academic year',
    fallbackReason:
      'No student transport arrangements have been recorded for the academic year selected in the header.',
  },
});

