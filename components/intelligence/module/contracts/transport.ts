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
 * Reads the institute's own transport arrangements — who rides, on which
 * vehicle, from which boarding point — from transport_map_student,
 * transport_vehicle, transport_stop, transport_school_shift and
 * transport_route_bus. Stop names are resolved from the stop master rather
 * than shown as keys, and a vehicle carrying more than three times its
 * stated seats is excluded from the capacity figures as a travel-mode
 * marker rather than counted as genuine overcapacity.
 */
export const transportIntelligenceContract = defineContract({
  key: 'transportation',
  label: 'Transport Intelligence',
  accent: '#4338CA',
  grain: 'one student mapped to a transport route/stop',
  nouns: { singular: 'rider', plural: 'riders' },

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
        title: 'Transport position',
        description:
          'How many students are travelling right now, on which vehicles and from how many boarding points — read from transport_map_student and transport_vehicle at the moment the page loaded.',
      },
      breakdowns: {
        title: 'Where transport sits',
        description:
          'The same riders and vehicles sliced by vehicle, boarding stop, chargeable distance, travel shift and route — the finest structure transport_map_student, transport_stop and transport_route_bus support.',
      },
      findings: {
        description:
          'One finding per pattern the transport records raise — vehicles running over or under capacity, arrangements carrying no transport amount, and route or stop mapping the records don’t reach — each with the figures it rests on.',
      },
      priorities: {
        description:
          'The transport risks worth acting on first — vehicles running materially over capacity, and mapping gaps that leave arrangements unattributed — with the next step each one implies.',
      },
      dataQuality: {
        title: 'Transport record checks',
        description:
          'Exact counts against this year’s transport records: arrangements with no boarding stop, vehicles absent from the route mapping, and records excluded from the capacity figures because they carry more than three times the vehicle’s stated seats — travel-mode markers, not genuine overcapacity.',
      },
      recommendations: {
        description:
          'Each recommendation names the finding it answers and the cause the engine was authorised to state. A recommendation whose rule has no approved cause carries no explanation rather than a composed one. Approving one records a decision against your name; it does not execute anything on its own.',
      },
    },
  ),

  // Capped at six — the summary strip takes the first six and drops the
  // rest, so medianVehicleLoad and medianDistanceKm stay in Position instead.
  // Matched against the Metric keys BrainTransportIntelligenceController::position()
  // actually serves — 'riders', 'seatUtilization', 'vehiclesInService',
  // 'stopsInService', 'medianVehicleLoad', 'materiallyOverVehicles',
  // 'underusedVehicles', 'medianDistanceKm' and 'unbilledArrangements' are the
  // only Metric objects it forwards; nothing else is available to summarise.
  summaryMetrics: [
    'riders',
    'seatUtilization',
    'vehiclesInService',
    'stopsInService',
    'materiallyOverVehicles',
    'unbilledArrangements',
  ],

  emptyState: {
    title: 'No transport data yet',
    fallbackReason: 'No transport mapping records have been registered for this institute-year.',
  },
});
