'use client';

import { buildSessionContext, createAuthHeaders } from '@/lib/erp-client';

import type {
  AuditRow,
  DeliveryRow,
  EventBusAdapter,
  EventBusFilters,
  EventBusOverview,
  EventRow,
  FailureRow,
  PagedOrRestricted,
  IntegrationRow,
  Paged,
} from './types';

/**
 * Browser client for the Event Bus read API.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SIX OF THE SEVEN TABS ARE LIVE. THE SEVENTH SAYS SO.
 * ────────────────────────────────────────────────────────────────────────────
 * `routes/platform.php` now serves the Event Bus reads, answered by
 * `App\Http\Controllers\api\Platform\EventBusController` over
 * `App\Services\Platform\EventBusReader`. Every one is a SELECT over a table the
 * application already writes; none creates a queue, a broker or an event store.
 *
 * Consumers is the exception and it refuses rather than requesting — see
 * CONSUMERS_ROUTE below for why an empty answer there would be a lie rather than
 * a fact.
 *
 * THERE IS NO FALLBACK BEHIND THIS FILE. No mock adapter, no fixture, no cached
 * last-known value. Every method either returns rows the database actually holds
 * or throws; nothing in this module can put a number on the screen that a table
 * did not produce.
 *
 * SHAPE COPIED FROM lib/platform/client.ts, DELIBERATELY. Same bearer token, same
 * direct-to-Laravel hop with no Next proxy, same `status_code: 0`-means-refusal
 * handling, same "identity and tenancy ride in the token, never in a body" rule.
 * Event Bus is a Platform Services screen; it should not invent a fourth way of
 * talking to the same API.
 *
 * READ-ONLY. There is no replay, redrive or publish call in this file and there
 * must not be one until real queue workers exist. Replaying into
 * QUEUE_CONNECTION=sync re-runs the work on the operator's own request thread.
 */

/**
 * Live since the Event Bus reads landed in `routes/platform.php`.
 *
 * Six of the seven tabs now read real tables. No RBAC key was needed: reads
 * under `api/platform` are session-gated and not permission-gated, which is the
 * rule stated at the top of that route file and which the three sibling services
 * already follow.
 */
export const EVENT_BUS_LIVE = true;

/**
 * The routes, prefixed `api/platform` like their three siblings.
 *
 * Each is a SELECT over tables that already exist; none writes anything. See
 * `App\Services\Platform\EventBusReader` for the query behind each one and for
 * the columns that genuinely have no source.
 */
export const EVENT_BUS_ROUTES = {
  overview: '/events/overview',
  events: '/events/stream',
  failures: '/events/failures',
  deliveries: '/events/deliveries',
  integrations: '/events/integrations',
  audit: '/events/audit',
} as const;

/**
 * Consumers has no endpoint, and that is not an oversight.
 *
 * The table that would answer it — `hpbrain_consumer_state` — is migrated but
 * has no producer: nothing in the backend writes a consumer offset. Serving a
 * route that reads an empty table would render "No records found", which says
 * the estate has no consumers. It has one, `neo4j:drain`, and it runs every
 * minute. "Not connected" is the true answer until something records it.
 */
export const CONSUMERS_ROUTE = '/events/consumers';

export class EventBusApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'EventBusApiError';
    this.status = status;
  }
}

/**
 * Thrown when the live adapter is used before the backend exists.
 *
 * Carries the path it would have called, so the message names the thing that has
 * to be built rather than saying "not implemented".
 */
export class EventBusNotWiredError extends EventBusApiError {
  constructor(path: string) {
    super(
      `The Event Bus read API is not available yet. GET /api/platform${path} has not been implemented in routes/platform.php.`,
      501,
    );
    this.name = 'EventBusNotWiredError';
  }
}

function query(filters: EventBusFilters): string {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.eventType) params.set('event_type', filters.eventType);
  if (filters.status) params.set('status', filters.status);
  if (filters.channel) params.set('channel', filters.channel);
  if (filters.search.trim()) params.set('q', filters.search.trim());
  params.set('page', String(filters.page));
  params.set('per_page', String(filters.pageSize));
  const serialised = params.toString();
  return serialised ? `?${serialised}` : '';
}

async function call<T>(path: string, filters: EventBusFilters): Promise<T> {
  if (!EVENT_BUS_LIVE) throw new EventBusNotWiredError(path);

  const session = buildSessionContext();

  if (!session.baseUrl) {
    throw new EventBusApiError('The ERP host is not configured for this session. Sign in again.', 0);
  }

  const response = await fetch(`${session.baseUrl}/api/platform${path}${query(filters)}`, {
    headers: createAuthHeaders(session),
    // Monitoring data must never come from a cache: a stale outbox depth is
    // indistinguishable from a healthy one.
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  // Both halves matter: a 200 carrying `status_code: 0` is still a refusal, and
  // this API family uses that shape for anything the caller can fix.
  // A missing route is an unwired read API, not an operational Event Bus error.
  // Keep this distinct from an endpoint that exists but rejects the request.
  if (response.status === 404 || response.status === 501) {
    throw new EventBusNotWiredError(path);
  }

  if (!response.ok || (payload && payload.status_code === 0)) {
    const message =
      typeof payload?.message === 'string' && payload.message.trim()
        ? payload.message
        : `The request failed (${response.status}).`;
    throw new EventBusApiError(message, response.status);
  }

  return (payload?.data ?? payload) as T;
}

/** The only adapter. */
export const liveAdapter: EventBusAdapter = {
  label: 'GET /api/platform/events',

  fetchOverview: (filters) => call<EventBusOverview>(EVENT_BUS_ROUTES.overview, filters),
  fetchEvents: (filters) => call<Paged<EventRow>>(EVENT_BUS_ROUTES.events, filters),
  fetchFailures: (filters) => call<PagedOrRestricted<FailureRow>>(EVENT_BUS_ROUTES.failures, filters),
  fetchDeliveries: (filters) => call<Paged<DeliveryRow>>(EVENT_BUS_ROUTES.deliveries, filters),
  fetchIntegrations: (filters) => call<Paged<IntegrationRow>>(EVENT_BUS_ROUTES.integrations, filters),
  fetchAudit: (filters) => call<Paged<AuditRow>>(EVENT_BUS_ROUTES.audit, filters),

  // Refuses rather than requesting: there is no such route, and no table behind
  // it with a producer. See CONSUMERS_ROUTE above.
  fetchConsumers: () => Promise.reject(new EventBusNotWiredError(CONSUMERS_ROUTE)),
};
