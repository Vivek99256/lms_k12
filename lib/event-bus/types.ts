/**
 * The Event Bus monitoring contract.
 *
 * WHY A CONTRACT FILE AND NOT SHAPES INLINE IN THE SCREEN.
 * Phase 1 of the Event Bus audit is an observability plane over mechanisms that
 * ALREADY RUN — the `sync_log` outbox, `ai_audit_logs`, `workflow_runs`,
 * `failed_jobs`, the four notification send-logs. `GET /api/platform/events/*`
 * now serves six of the seven, answered by `App\Services\Platform\EventBusReader`.
 *
 * NOTHING IS SUBSTITUTED FOR WHAT IS NOT THERE. There is no sample adapter, no
 * seeded fixture and no fallback array behind this contract —
 * `lib/event-bus/client.ts` is the only implementation, and where no endpoint or
 * no column exists it refuses or returns null rather than filling the gap. A
 * monitoring dashboard is believed and acted on; one that fills a gap with
 * plausible numbers is worse than one that is empty.
 *
 * EVERY FIELD BELOW EXISTS IN A REAL TABLE TODAY — and several are nullable
 * precisely because the column behind them does not. `retryCount` is
 * `sync_log.retry_count`; `FailureRow.error` is null for outbox rows because
 * GraphDrain writes the message to the log file rather than to a column;
 * `DeliveryRow.status` is null for SMS and email because those tables have no
 * status column at all. See `lib/event-bus/sources.ts` for the table-by-table
 * mapping. A field with no source is a field the dashboard would have to invent,
 * and an ops dashboard that invents a number is worse than one that admits it
 * has none.
 *
 * READ-ONLY, DELIBERATELY. There is no replay, redrive or publish type in this
 * file. Per the audit, replay cannot ship before real queue workers exist
 * (`QUEUE_CONNECTION=sync` today), and publishing is Phase 2.
 */

/** Lifecycle of one captured event, as `sync_log.status` already records it. */
export type EventStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead';

/** Outbound channels that have a send-log table today. */
export type DeliveryChannel = 'whatsapp' | 'sms' | 'email' | 'push' | 'in_app';

/** `hpbrain_consumer_state.status`, plus the derived "stalled" reading. */
export type ConsumerStatus = 'active' | 'stalled' | 'paused' | 'failed';

/** `ai_audit_logs.outcome`. */
export type AuditOutcome = 'success' | 'failure' | 'rejected';

/** `ai_audit_logs.actor_type`. */
export type ActorType = 'user' | 'agent' | 'system';

// ── KPI row ─────────────────────────────────────────────────────────────────

/**
 * One headline number.
 *
 * `tone` is advisory only and never carries meaning alone — every tile shows its
 * label and value as text, so a tile reads the same to someone who cannot
 * separate amber from red.
 *
 * `available: false` is the important one. Five of the six KPIs can be computed
 * from tables that exist; "Last drain pass" cannot, because there is no job-run
 * ledger (audit gap G3). A KPI that cannot be computed says so rather than
 * showing a zero an operator would read as "nothing failed".
 */
export interface KpiTile {
  key: string;
  label: string;
  value: string;
  hint: string;
  tone: 'gray' | 'green' | 'amber' | 'red';
  available: boolean;
  /** The table(s) this number comes from, shown in the UI as provenance. */
  source: string;
}

// ── Charts ──────────────────────────────────────────────────────────────────

/** One bucket of the event-volume series, split by outcome. */
export interface VolumePoint {
  /** Bucket label as an operator reads it — "14:00", "Mon 15". */
  label: string;
  completed: number;
  pending: number;
  failed: number;
}

// ── Tab rows ────────────────────────────────────────────────────────────────

/** Event Stream. Columns mirror the audit's specified set exactly. */
export interface EventRow {
  id: string;
  /** ISO-8601. `sync_log.created_at`. */
  occurredAt: string;
  /** `sync_log.table_name` / `ai_audit_logs.event_type`. */
  eventType: string;
  /**
   * Always null from `sync_log` today.
   *
   * The outbox has no module column, and a table name is not a module — mapping
   * one to the other would be the API inventing an attribution the database does
   * not hold. Nullable rather than absent so the column can fill in the day a
   * source carries one.
   */
  module: string | null;
  entityType: string;
  entityId: string;
  status: EventStatus;
  retryCount: number;
  /** Where this row was read from, so a mixed stream stays attributable. */
  source: string;
}

/** Consumers. One row per registered consumer of the outbox. */
export interface ConsumerRow {
  id: string;
  name: string;
  status: ConsumerStatus;
  /** ISO-8601, or null when the consumer has never run. */
  lastProcessedAt: string | null;
  /** Seconds behind the newest captured event. Null when unknown. */
  lagSeconds: number | null;
  /** Rows still owed to this consumer. */
  pending: number;
  source: string;
}

/** Failures — `failed_jobs`, `sync_log` FAILED, and failed `workflow_steps`. */
export interface FailureRow {
  id: string;
  /** The event or job that failed, named the way its table names it. */
  event: string;
  /**
   * Null for every `sync_log` row, and that is the database's answer rather than
   * a gap in this contract: on failure `GraphDrain` updates `status` and
   * `retry_count` and writes the message to the log file. Only `failed_jobs`
   * (`exception`) and `workflow_steps` (`error_message`) store the text.
   */
  error: string | null;
  retryCount: number;
  maxRetries: number | null;
  failedAt: string;
  source: string;
}

/** Deliveries — the four outbound send-logs. */
export interface DeliveryRow {
  id: string;
  channel: DeliveryChannel;
  recipient: string;
  /**
   * Null for SMS, email and push. Those tables have no status column at all —
   * they record that a message was composed and handed on, and nothing after
   * that. Only `whatsapp_sent_messages` carries a receipt, refreshed by the
   * SyncWPDeliveryStatus command polling Twilio. The UI renders null as "Not
   * tracked" rather than "Sent", because a school cannot today tell a delivered
   * SMS from one the gateway dropped, and the screen must not imply it can.
   */
  status: string | null;
  /** Null wherever the channel records no error — i.e. everywhere but WhatsApp. */
  error: string | null;
  sentAt: string | null;
  source: string;
}

/**
 * Integrations — what each one has actually done, from its own log.
 *
 * NOT A CONFIGURATION VIEW, and the shape says so. None of the tables this
 * screen may read holds a credential or an enabled flag, so there is no
 * `configured` field: it would have to be guessed from activity, and "has sent
 * nothing" is not "is not set up". Credential state belongs to Integration
 * Management, which owns it.
 */
export interface IntegrationRow {
  id: string;
  name: string;
  category: string;
  /** Rows this integration wrote inside the selected window. */
  events: number;
  /** Null when the log holds nothing in range. */
  lastActivityAt: string | null;
  status: 'active' | 'idle' | 'no_activity' | 'unavailable';
  /** The table the activity was read from. */
  source: string;
}

/** Audit Logs — the federated read across the audit tables. */
export interface AuditRow {
  id: string;
  eventType: string;
  actor: string;
  actorType: ActorType;
  /**
   * `ai_audit_logs.subject_entity_key` — the subject this entry is about
   * ("students", "fees"). It is the nearest real grouping the table holds; there
   * is no declared module column to read, so this is labelled honestly in the UI
   * and is null where the row carries no subject.
   */
  module: string | null;
  outcome: AuditOutcome;
  occurredAt: string;
  source: string;
}

// ── Filters ─────────────────────────────────────────────────────────────────

/**
 * Server-side filter state.
 *
 * Server-side is not a preference: `sync_log` alone carried ~31,000 rows at the
 * time of the audit, and `pal_telemetry_events` is larger. Filtering in the
 * browser would mean shipping the table to it.
 */
export interface EventBusFilters {
  /** ISO date, inclusive. */
  from: string | null;
  to: string | null;
  /**
   * No Module filter exists.
   *
   * None of the six endpoints can honour one: sync_log has no module column and
   * ai_audit_logs records a subject rather than a declared module. A parameter
   * the API ignores is worse than a missing one — it reads as a working filter.
   */
  eventType: string | null;
  status: EventStatus | null;
  channel: DeliveryChannel | null;
  /** Free text over entity id / recipient / error. */
  search: string;
  page: number;
  pageSize: number;
}

/**
 * What the API returns in place of a section the caller may not see.
 *
 * Distinct from an empty page, and the distinction is the whole point: "no
 * records found" says the table is clean, "restricted" says someone else can see
 * it. An institute administrator shown the first when the second is true would
 * conclude nothing had failed.
 */
export interface RestrictedSection {
  restricted: true;
  reason: string;
}

export function isRestricted(value: unknown): value is RestrictedSection {
  return typeof value === 'object' && value !== null && (value as RestrictedSection).restricted === true;
}

export interface Paged<T> {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
  /**
   * Set only on the event stream, and only for a non-Super-Admin.
   *
   * `sync_log` has no tenant column, so rows are attributed by reading
   * `$.data.sub_institute_id` out of the payload — which works for the rows that
   * carry it and cannot place the rest. `excluded_events` is how many could not
   * be placed, so a partial list is never mistaken for a complete one.
   */
  visible_events?: number;
  excluded_events?: number;
  partial?: boolean;
}

/** A page of rows, or a refusal to serve them. */
export type PagedOrRestricted<T> = Paged<T> | RestrictedSection;

// ── The payload the console loads ───────────────────────────────────────────

export interface EventBusOverview {
  /**
   * Only the tiles the caller may see.
   *
   * Two for an institute administrator (delivery rate, audit activity — both
   * filtered by their own institute); six for a Super Admin. The four outbox
   * tiles are not computed at all for the former, so there is no estate figure
   * in the payload to leak. The screen renders the missing ones from its own
   * descriptor list as "Super Admin only" — see `restricted.sections`.
   */
  kpis: KpiTile[];
  /** Null when withheld. */
  volume: VolumePoint[] | null;
  recentFailures: FailureRow[] | null;
  /** When the underlying sources were read. */
  generatedAt: string;
  /** `tenant` when every number came from the caller's institute; `estate` otherwise. */
  scope?: 'tenant' | 'estate';
  /** Present when sections were withheld, naming which. */
  restricted?: (RestrictedSection & { sections: string[] }) | null;
}

/**
 * What the adapter must provide.
 *
 * There is exactly one implementation — `lib/event-bus/client.ts` — and this
 * interface exists so the screen depends on a shape rather than on a fetch call,
 * not so a second implementation can be swapped in. It deliberately carries no
 * `isMock` flag any more: there is no mock to flag.
 */
export interface EventBusAdapter {
  /** Shown as provenance beneath the header. */
  readonly label: string;

  fetchOverview(filters: EventBusFilters): Promise<EventBusOverview>;
  fetchEvents(filters: EventBusFilters): Promise<Paged<EventRow>>;
  fetchConsumers(filters: EventBusFilters): Promise<Paged<ConsumerRow>>;
  /** Tier 2 — a Super Admin gets a page; anyone else gets the refusal. */
  fetchFailures(filters: EventBusFilters): Promise<PagedOrRestricted<FailureRow>>;
  fetchDeliveries(filters: EventBusFilters): Promise<Paged<DeliveryRow>>;
  fetchIntegrations(filters: EventBusFilters): Promise<Paged<IntegrationRow>>;
  fetchAudit(filters: EventBusFilters): Promise<Paged<AuditRow>>;
}

export const DEFAULT_FILTERS: EventBusFilters = {
  from: null,
  to: null,
  eventType: null,
  status: null,
  channel: null,
  search: '',
  page: 1,
  pageSize: 25,
};
