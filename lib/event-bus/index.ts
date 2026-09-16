'use client';

import { liveAdapter } from './client';
import type { EventBusAdapter } from './types';

/**
 * The single seam between the Event Bus screen and its data.
 *
 * THERE IS ONE ADAPTER AND IT TALKS TO LARAVEL. No mock, no fixture, no seeded
 * generator, no fallback array — an earlier draft had all four and they have been
 * deleted, because a monitoring screen that fills a gap with plausible numbers is
 * strictly worse than one that is empty. An operator believes a dashboard; that
 * is what a dashboard is for, and it is exactly why it may not lie.
 *
 * WHAT HAPPENS WHILE THE BACKEND IS UNBUILT. `liveAdapter` refuses with
 * `EventBusNotWiredError`, naming the route that has to exist. The console
 * catches that specific error and renders "Data source not connected" — a
 * distinct, neutral state, kept apart from a genuine failure (which is an error)
 * and from a successful read of an empty table (which is "No records found").
 * Those three outcomes must never look the same.
 *
 * AND IT NEVER FALLS BACK. Not to a cache, not to a fixture, not to a last-known
 * value. If the endpoint 404s or the tenant is refused, that is what the screen
 * says.
 */
export const eventBusAdapter: EventBusAdapter = liveAdapter;

export { CONSUMERS_ROUTE, EVENT_BUS_LIVE, EVENT_BUS_ROUTES, EventBusApiError, EventBusNotWiredError } from './client';
export { EVENT_BUS_KPIS, EVENT_BUS_SOURCES } from './sources';
export type { EventBusKpiDescriptor, EventBusSource, SourceStatus } from './sources';
export * from './types';
