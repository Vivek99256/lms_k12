import { brainFetch, tenantPath } from '@/lib/brain/api';

import { defineContract, sectionsWith } from '../contract';
import type { ModuleIntelligencePayload } from '../payload';

/**
 * PTM Intelligence.
 *
 * Parent-teacher meetings: slots offered against bookings taken, and whether
 * anyone turned up.
 *
 * Bookings carry no academic year of their own and are dated through the slot
 * they belong to, so every booking figure is year-scoped by that join.
 *
 * NO ADAPTER. `BrainPtmIntelligenceController` emits the canonical
 * `ModuleIntelligencePayload` directly, so `load` is a bare `brainFetch` and
 * everything here is presentation.
 *
 * NO `run` ACTION. This module's findings are computed per request rather than
 * written to the signal ledger, so the renderer hides "Analyse this year"
 * instead of offering a button that would recompute nothing. The L5 sections
 * are still declared: `ModuleLoop` reads them back from the ledger and they
 * report honestly that nothing has been recorded against this module yet.
 */
export const ptmIntelligenceContract = defineContract({
  key: 'ptm',
  label: 'PTM Intelligence',
  accent: '#1D4ED8',
  grain: 'one parent-teacher meeting booking',
  nouns: { singular: 'booking', plural: 'meeting bookings' },

  load: () => brainFetch<ModuleIntelligencePayload>(tenantPath('/ptm/intelligence')),

  actions: {},

  sections: sectionsWith({
    position: {
      title: 'Meeting position',
      description:
        'Slots offered against bookings taken for the selected year, with attendance computed only over the bookings a teacher actually marked.',
    },
    breakdowns: {
      title: 'Where the meetings sit',
      description:
        'Take-up per class, and how bookings fell across the meeting dates offered.',
    },
    findings: {
      description:
        'Slots nobody booked, bookings nobody kept, and rounds where attendance was never marked — each separating “not offered” from “not taken” from “not recorded”.',
    },
    dataQuality: {
      title: 'Booking register checks',
      description:
        'Exact counts against this year’s bookings: unmarked attendance, unbooked slots and bookings naming no teacher.',
    },
  }),

  // Matched against the metric keys the controller actually forwards. A key the
  // controller never sends renders nothing at all, silently.
  summaryMetrics: ['slotUptake', 'bookings', 'students', 'teachers', 'attendanceRate', 'slots'],

  emptyState: {
    title: 'No meetings scheduled yet',
    fallbackReason:
      'No parent-teacher meeting slots were scheduled for the academic year selected in the header.',
  },
});
