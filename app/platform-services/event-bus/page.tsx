'use client';

import { EventBusConsole } from './_components/EventBusConsole';

/**
 * Platform services → Event Bus.
 *
 * The fourth console in this folder, and the only read-only one. Where
 * Communication, Scheduler and Workflow configure what a component should do,
 * this one reports what actually happened: outbox depth and age, consumer lag,
 * failures, outbound deliveries, integration status and the typed audit trail.
 *
 * It sits beside its three siblings rather than under /general/coming-soon
 * because that is where an administrator already goes for platform-wide
 * concerns — the same move Document and Audit made. The old stub URL still
 * resolves: app/general/coming-soon/page.tsx redirects it here.
 */
export default function EventBusPage() {
  return <EventBusConsole />;
}
