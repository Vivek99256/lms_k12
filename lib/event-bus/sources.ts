/**
 * The data-source registry: which table in `next_lms_erp` feeds which part of
 * this screen, and what is still missing before it can.
 *
 * WHY THIS FILE EXISTS AT ALL. The Event Bus audit's central finding was that
 * this product has no event bus but does have a working outbox, seven audit
 * tables, four send-logs and a dormant event-store schema — and that nobody can
 * see any of it. Phase 1 is a window onto those, not a new mechanism. The risk
 * in building the window first is that the shapes drift from the tables they are
 * supposed to show, so the mapping is written down here, in code, next to the
 * types it constrains, rather than in a document that will not be opened again.
 *
 * IT IS ALSO THE TODO LIST. Each entry carries `status`, and the screen renders
 * these in the Overview "Data sources" panel. An operator looking at a KPI that
 * reads zero can see whether that means "nothing failed" or "not wired yet",
 * which is the difference between a dashboard and a decoration.
 *
 * NOTHING HERE INVENTS AN ENDPOINT. Every `table` below was verified to exist in
 * the backend repository; every `endpoint` is marked `planned` because no
 * Event Bus route exists in `routes/platform.php` today. See
 * `lib/event-bus/client.ts` for why that matters and what happens when it is
 * called anyway.
 */

export type SourceStatus =
  /** Table exists, has rows, and the mapping is understood. */
  | 'ready'
  /** Table exists but is empty or has no producer, so it will read zero. */
  | 'empty'
  /** The number cannot be computed from anything that exists today. */
  | 'missing';

export interface EventBusSource {
  /** The table, exactly as it is named in MySQL. */
  table: string;
  /** Which tab or KPI consumes it. */
  feeds: string;
  status: SourceStatus;
  /** One sentence an engineer can act on. */
  note: string;
}

/**
 * The twelve sources the brief named, plus the three the audit found were
 * needed to make them legible.
 *
 * Ordered by how load-bearing they are, not alphabetically: `sync_log` is first
 * because it is the only mechanism in the estate that reliably captures "this
 * changed" — including for the imports, bulk edits and raw SQL that never pass
 * through a controller.
 */
export const EVENT_BUS_SOURCES: readonly EventBusSource[] = [
  {
    table: 'sync_log',
    feeds: 'Event stream, Outbox depth, Oldest pending, Failures',
    status: 'ready',
    note:
      'The real outbox. Trigger-fed, drained every minute by neo4j:drain, with a graph_synced_at watermark and retry counts. Carries both projected node events and thin "row X changed" events.',
  },
  {
    table: 'neo4j_sync_queue',
    feeds: 'Event stream, Outbox depth',
    status: 'ready',
    note: 'The relationship half of the same outbox. Drained after sync_log, because an edge cannot attach to endpoints that do not exist yet.',
  },
  {
    table: 'ai_audit_logs',
    feeds: 'Audit logs, Event stream',
    status: 'ready',
    note:
      'Already event-shaped: 14 typed event_type values, actor, subject, outcome, JSON payload, tenant, indexed on (event_type, created_at). The closest thing to an event log this product has.',
  },
  {
    table: 'workflow_runs',
    feeds: 'Event stream, Audit logs',
    status: 'ready',
    note: 'Run reference, status, trigger_type, timings. trigger_type is only ever manual or recommendation_approved today — there is no event trigger.',
  },
  {
    table: 'workflow_steps',
    feeds: 'Failures',
    status: 'ready',
    note: 'Per-step status, attempt, error_message and duration_ms. A failed step is a failure worth surfacing even when its run continued.',
  },
  {
    table: 'failed_jobs',
    feeds: 'Failures, Failed events KPI',
    status: 'empty',
    note:
      'Table exists but has no producer: QUEUE_CONNECTION=sync, so the three ShouldQueue jobs run inline and a failure throws rather than landing here. Will populate the day real workers are started.',
  },
  {
    table: 'whatsapp_sent_messages',
    feeds: 'Deliveries, Delivery rate KPI',
    status: 'ready',
    note:
      'The only channel with genuine delivery feedback — message_status and message_error are refreshed by the SyncWPDeliveryStatus command polling Twilio.',
  },
  {
    table: 'sms_sent_parents',
    feeds: 'Deliveries',
    status: 'ready',
    note: 'A send log, not a delivery log. Records that a message was handed to the gateway; no bounce or delivery receipt is stored.',
  },
  {
    table: 'sms_sent_staff',
    feeds: 'Deliveries',
    status: 'ready',
    note: 'Same shape and same limitation as sms_sent_parents, addressed to staff.',
  },
  {
    table: 'email_sent_parents',
    feeds: 'Deliveries',
    status: 'ready',
    note: 'Send log only. No bounce, complaint or open tracking exists for email anywhere in the estate.',
  },
  {
    table: 'fees_reconciliation',
    feeds: 'Failures, Integrations',
    status: 'ready',
    note:
      'Gateway settlement mismatches across the six payment gateways. It exists precisely because server-to-server callbacks go missing, which makes it the highest-value failure feed on this screen.',
  },
  {
    table: 'hpbrain_consumer_state',
    feeds: 'Consumers tab — the one panel with no endpoint',
    status: 'empty',
    note:
      'Migrated with consumer_name, last_processed_event_id, last_processed_at and status — but no code writes it. No endpoint was built over it: serving an empty table would render "No records found", which claims the estate has no consumers. It has one, neo4j:drain, running every minute. The tab reports "not connected" until something records an offset.',
  },
  {
    table: 'hpbrain_event_store',
    feeds: 'Event stream (Phase 2)',
    status: 'empty',
    note:
      'A complete event-store schema — payload, correlation_id, causation_id, idempotency_key, retry_count, status — already migrated with zero producers and zero consumers. Phase 2 must decide between adopting this and extending sync_log; the standing decision points at sync_log.',
  },
  {
    table: 'hpbrain_dead_letter_queue',
    feeds: 'Failures (Phase 2)',
    status: 'empty',
    note: 'DLQ schema with consumer_name, error_message, error_stack and max_retries. Nothing writes it, so it reads empty rather than "no failures".',
  },
  {
    table: 'job_runs',
    feeds: 'Last drain pass KPI',
    status: 'missing',
    note:
      'Does not exist. withoutOverlapping() is a mutex, not a record, so "did the last drain pass complete?" is unanswerable today. Audit gap G3 — a job-run ledger is the prerequisite for this KPI.',
  },
] as const;


/**
 * The six headline measures this screen is built to show, and the table each
 * one will be computed from.
 *
 * THESE ARE DESCRIPTORS, NOT DATA. There is no `value` field here and there must
 * never be one: a number on this screen may only come from the backend reading a
 * real table. The descriptors exist so that, while the read API is unbuilt, the
 * KPI row can name what is missing — "Outbox depth — data source not connected"
 * — instead of either disappearing or, far worse, showing a plausible figure
 * nobody computed.
 *
 * `source` is the table an engineer has to query to implement it, verified
 * against the backend repository. `blocked` marks the one measure that cannot be
 * computed from anything that exists: there is no job-run ledger, so "did the
 * last drain pass complete?" has no answer today (audit gap G3).
 */
export interface EventBusKpiDescriptor {
  key: string;
  label: string;
  /** What the number will mean, once there is one. */
  hint: string;
  /** The table(s) it will be read from. */
  source: string;
  /** True when no table in this database can produce it yet. */
  blocked?: boolean;
}

export const EVENT_BUS_KPIS: readonly EventBusKpiDescriptor[] = [
  {
    key: 'captured',
    label: 'Events captured (24h)',
    hint: 'Outbox rows written in the last day',
    source: 'sync_log, neo4j_sync_queue',
  },
  {
    key: 'depth',
    label: 'Outbox depth',
    // 1000 is the threshold the existing scheduled alert already uses, so the
    // dashboard and the alert cannot end up disagreeing about what "deep" means.
    hint: 'Pending rows — the existing alert fires above 1,000',
    source: 'sync_log',
  },
  {
    key: 'oldest',
    label: 'Oldest pending event',
    // Age, not depth, is what catches a stopped consumer: the August 2026 stall
    // had roughly twenty queued rows, far under any sane depth threshold, while
    // the drain had been dead for forty-five minutes.
    hint: 'Age of the oldest unprocessed row — the existing alert fires above 15 minutes',
    source: 'sync_log',
  },
  {
    key: 'failed',
    label: 'Failed events',
    hint: 'Undelivered after retry, across the outbox and workflow steps',
    source: 'sync_log, workflow_steps, failed_jobs',
  },
  {
    key: 'delivery',
    label: 'Notification delivery rate',
    hint: 'Only WhatsApp reports true delivery; the other channels can only report sent',
    source: 'whatsapp_sent_messages, sms_sent_parents, sms_sent_staff, email_sent_parents',
  },
  {
    // Replaces an earlier "Active consumers" tile. That one had no source:
    // `hpbrain_consumer_state` is migrated but nothing writes a consumer offset,
    // so the measure could only ever have been guessed. This one counts rows
    // three tables actually hold.
    key: 'audit',
    label: 'Audit activity (24h)',
    hint: 'Audit entries, workflow runs and workflow steps recorded in the last day',
    source: 'ai_audit_logs, workflow_runs, workflow_steps',
  },
] as const;
