'use client';

import type { ReactNode } from 'react';

import { DataTable, type Column } from '@/components/ui/data-table';
import { Pill, formatWhen } from '@/app/platform-services/_components/shell';
import type {
  AuditRow,
  ConsumerRow,
  DeliveryRow,
  EventRow,
  EventStatus,
  FailureRow,
  IntegrationRow,
  Paged,
} from '@/lib/event-bus';

/**
 * The six read-only tables.
 *
 * ONE TABLE COMPONENT, SIX COLUMN SETS. `DataTable` in components/ui is this
 * repo's enterprise table — typed columns with a `render` escape hatch, a
 * loading row, an empty row and server-side pagination — so the work here is
 * describing columns, not drawing another grid. There is no `EnterpriseDataTable`
 * in this codebase; `DataTable` is the thing that name refers to.
 *
 * STATUS IS A `Pill`, NOT A `StatusBadge`. components/ui/status-badge.tsx maps
 * several of these states onto its `success` and `warning` variants, whose colour
 * tokens are not registered in app/globals.css — its own comment says so. `Pill`
 * from the platform-services shell is what the three sibling consoles use and its
 * tones actually render.
 *
 * NO ROW ACTIONS ANYWHERE IN THIS FILE, DELIBERATELY. Not replay, not retry, not
 * discard. Phase 1 is a window; replaying an event into `QUEUE_CONNECTION=sync`
 * would run the work on the operator's own request thread, and there are no queue
 * workers to run it anywhere else yet.
 *
 * EVERY ROW NAMES ITS SOURCE TABLE. These streams are federated from seven
 * unrelated logs, so a row that does not say where it came from cannot be chased
 * back to anything.
 */

// ── Shared cell treatments ──────────────────────────────────────────────────

/** Identifiers and table names read as code, so they are set as code. */
function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs text-slate-700">{children}</span>;
}

function SourceCell({ source }: { source: string }) {
  return (
    <span className="font-mono text-[11px] text-slate-400" title={`Read from ${source}`}>
      {source}
    </span>
  );
}

function When({ iso }: { iso: string | null }) {
  return <span className="whitespace-nowrap tabular-nums text-xs text-slate-600">{formatWhen(iso)}</span>;
}

/**
 * A cell whose value the database genuinely does not hold.
 *
 * Distinct from an empty string and from a zero: it says *no column exists for
 * this*, which is a fact about the schema rather than about the row. The title
 * carries the reason, so an operator wondering why a whole column is grey gets
 * the answer without opening the code.
 */
function NotRecorded({ reason }: { reason: string }) {
  return (
    <span className="text-xs italic text-slate-400" title={reason}>
      Not recorded
    </span>
  );
}

/** Long free text — an error message — truncated with the whole of it on hover. */
function Truncated({ text, width = 'max-w-[26rem]' }: { text: string; width?: string }) {
  return (
    <span className={`block truncate ${width} text-xs text-slate-700`} title={text}>
      {text}
    </span>
  );
}

const EVENT_STATUS_TONE: Record<EventStatus, 'gray' | 'blue' | 'green' | 'amber' | 'red'> = {
  completed: 'green',
  processing: 'blue',
  pending: 'amber',
  failed: 'red',
  dead: 'red',
};

/**
 * A retry count that stays quiet at zero.
 *
 * A column of "0"s trains the eye to skip it, which is the opposite of what a
 * retry column is for. Zero is a dash; anything above it is coloured by how close
 * it is to giving up.
 */
function Retries({ count, max }: { count: number; max?: number | null }) {
  if (count === 0) return <span className="text-xs text-slate-400">—</span>;
  const exhausted = max != null && count >= max;
  return (
    <span className={`tabular-nums text-xs font-medium ${exhausted ? 'text-red-600' : 'text-amber-700'}`}>
      {count}
      {max != null && <span className="font-normal text-slate-400">/{max}</span>}
    </span>
  );
}

// ── The shared wrapper ──────────────────────────────────────────────────────

/**
 * `T` is unconstrained on purpose.
 *
 * `DataTable` declares `T extends Record<string, any>`, which a plain interface
 * does not satisfy — TypeScript only gives implicit index signatures to type
 * aliases. Widening the row types to satisfy it would trade away the field
 * checking that is the whole reason they are written down in
 * lib/event-bus/types.ts, so the constraint is dropped here and the columns are
 * widened at the single call below instead.
 */
export function EventBusTable<T>({
  columns,
  page,
  loading,
  emptyLabel,
  onPageChange,
}: {
  columns: Column<T>[];
  page: Paged<T> | null;
  loading: boolean;
  emptyLabel: string;
  onPageChange: (next: number) => void;
}) {
  return (
    <DataTable
      density="compact"
      striped={false}
      columns={columns as Column<Record<string, unknown>>[]}
      data={(page?.rows ?? []) as Record<string, unknown>[]}
      isLoading={loading}
      emptyState={<p className="text-sm text-slate-500">{emptyLabel}</p>}
      pagination={
        page && page.total > page.pageSize
          ? { page: page.page, pageSize: page.pageSize, total: page.total, onPageChange }
          : undefined
      }
    />
  );
}

// ── Column sets ─────────────────────────────────────────────────────────────

/** Event Stream — Time, Event Type, Module, Entity, Status, Retry Count. */
export const eventColumns: Column<EventRow>[] = [
  { id: 'occurredAt', header: 'Time', render: (_v, row) => <When iso={row.occurredAt} /> },
  { id: 'eventType', header: 'Event type', render: (_v, row) => <Mono>{row.eventType}</Mono> },
  {
    id: 'module',
    header: 'Module',
    render: (_v, row) =>
      row.module ? (
        <span className="text-xs text-slate-700">{row.module}</span>
      ) : (
        <NotRecorded reason="sync_log has no module column, and a table name is not a module. The API returns null rather than inventing an attribution." />
      ),
  },
  {
    id: 'entityId',
    header: 'Entity',
    render: (_v, row) => (
      <span className="text-xs text-slate-700">
        {row.entityType} <Mono>#{row.entityId}</Mono>
      </span>
    ),
  },
  { id: 'status', header: 'Status', render: (_v, row) => <Pill tone={EVENT_STATUS_TONE[row.status]}>{row.status}</Pill> },
  { id: 'retryCount', header: 'Retries', render: (_v, row) => <Retries count={row.retryCount} /> },
  { id: 'source', header: 'Source', render: (_v, row) => <SourceCell source={row.source} /> },
];

/**
 * Consumers — Consumer Name, Status, Last Processed, Lag.
 *
 * Lag is rendered in the units an operator thinks in, and a consumer that has
 * never run shows "Never run" rather than a lag of zero, which would read as
 * perfectly caught up.
 */
export const consumerColumns: Column<ConsumerRow>[] = [
  { id: 'name', header: 'Consumer', render: (_v, row) => <Mono>{row.name}</Mono> },
  {
    id: 'status',
    header: 'Status',
    render: (_v, row) => (
      <Pill tone={row.status === 'active' ? 'green' : row.status === 'stalled' ? 'red' : row.status === 'failed' ? 'red' : 'gray'}>
        {row.status}
      </Pill>
    ),
  },
  { id: 'lastProcessedAt', header: 'Last processed', render: (_v, row) => (row.lastProcessedAt ? <When iso={row.lastProcessedAt} /> : <span className="text-xs text-slate-400">Never run</span>) },
  {
    id: 'lagSeconds',
    header: 'Lag',
    render: (_v, row) => {
      if (row.lagSeconds === null) return <span className="text-xs text-slate-400">Unknown</span>;
      const minutes = Math.round(row.lagSeconds / 60);
      const label = minutes < 1 ? `${row.lagSeconds}s` : minutes < 90 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;
      return <span className={`tabular-nums text-xs font-medium ${minutes > 15 ? 'text-red-600' : 'text-slate-700'}`}>{label}</span>;
    },
  },
  { id: 'pending', header: 'Owed', render: (_v, row) => <span className="tabular-nums text-xs text-slate-700">{row.pending.toLocaleString('en-IN')}</span> },
  { id: 'source', header: 'Source', render: (_v, row) => <SourceCell source={row.source} /> },
];

/** Failures — Failed Event, Error, Retry Count, Timestamp. */
export const failureColumns: Column<FailureRow>[] = [
  { id: 'event', header: 'Failed event', render: (_v, row) => <Mono>{row.event}</Mono> },
  {
    id: 'error',
    header: 'Error',
    render: (_v, row) =>
      row.error ? (
        <Truncated text={row.error} />
      ) : (
        <NotRecorded reason="sync_log stores status and retry_count on failure; GraphDrain writes the message to the log file, not to a column. Only failed_jobs and workflow_steps keep the text." />
      ),
  },
  { id: 'retryCount', header: 'Retries', render: (_v, row) => <Retries count={row.retryCount} max={row.maxRetries} /> },
  { id: 'failedAt', header: 'Timestamp', render: (_v, row) => <When iso={row.failedAt} /> },
  { id: 'source', header: 'Source', render: (_v, row) => <SourceCell source={row.source} /> },
];

const CHANNEL_LABEL: Record<DeliveryRow['channel'], string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Email',
  push: 'Push',
  in_app: 'In-app',
};

/**
 * Deliveries — Channel, Recipient, Status, Error, Sent Time.
 *
 * "Sent" and "Delivered" are different claims and this table refuses to blur
 * them. Only `whatsapp_sent_messages` carries a receipt; the SMS and email
 * tables have no status column at all, so their rows arrive with status null and
 * render as "Not recorded" — not as "Sent", which would imply someone checked.
 * A school genuinely cannot tell a delivered SMS from one the gateway dropped,
 * and the screen has to show that rather than paper over it.
 *
 * The status vocabulary is Twilio's and Meta's, not ours, so failures are named
 * and everything else is treated as got-through. An unrecognised new status
 * should not silently turn red.
 */
const FAILED_DELIVERY = ['failed', 'undelivered', 'rejected'];

export const deliveryColumns: Column<DeliveryRow>[] = [
  { id: 'channel', header: 'Channel', render: (_v, row) => <span className="text-xs font-medium text-slate-700">{CHANNEL_LABEL[row.channel]}</span> },
  { id: 'recipient', header: 'Recipient', render: (_v, row) => <Mono>{row.recipient || '—'}</Mono> },
  {
    id: 'status',
    header: 'Status',
    render: (_v, row) =>
      row.status ? (
        <Pill tone={FAILED_DELIVERY.includes(row.status.toLowerCase()) ? 'red' : 'green'}>{row.status}</Pill>
      ) : (
        <NotRecorded reason="This channel's send-log has no status column. The row proves a message was composed and handed on; nothing records what happened next." />
      ),
  },
  {
    id: 'error',
    header: 'Error',
    render: (_v, row) =>
      row.error ? (
        <Truncated text={row.error} width="max-w-[20rem]" />
      ) : row.status ? (
        <span className="text-xs text-slate-400">—</span>
      ) : (
        <NotRecorded reason="No error column exists on this channel's send-log." />
      ),
  },
  { id: 'sentAt', header: 'Sent', render: (_v, row) => <When iso={row.sentAt} /> },
  { id: 'source', header: 'Source', render: (_v, row) => <SourceCell source={row.source} /> },
];

const INTEGRATION_STATUS: Record<IntegrationRow['status'], { tone: 'gray' | 'green' | 'amber' | 'red'; label: string }> = {
  active: { tone: 'green', label: 'Active' },
  idle: { tone: 'gray', label: 'Idle' },
  // "Nothing recorded" is not "not configured" — the tables this screen reads
  // hold no credential, so it cannot tell whether an integration is set up.
  no_activity: { tone: 'gray', label: 'No activity' },
  unavailable: { tone: 'amber', label: 'Table missing' },
};

/**
 * Integrations — Integration, Category, Events, Last Activity, Status.
 *
 * AN ACTIVITY VIEW, NOT A CONFIGURATION VIEW. There is no "Configured" column
 * because no table here can answer it; guessing it from activity would tell an
 * administrator an unconfigured integration is merely quiet. Setting one up
 * stays in Integration Management.
 */
export const integrationColumns: Column<IntegrationRow>[] = [
  { id: 'name', header: 'Integration', render: (_v, row) => <span className="text-xs font-medium text-slate-800">{row.name}</span> },
  { id: 'category', header: 'Category', render: (_v, row) => <span className="text-xs text-slate-600">{row.category}</span> },
  {
    id: 'events',
    header: 'Events',
    render: (_v, row) => <span className="tabular-nums text-xs text-slate-700">{row.events.toLocaleString('en-IN')}</span>,
  },
  {
    id: 'lastActivityAt',
    header: 'Last activity',
    render: (_v, row) => (row.lastActivityAt ? <When iso={row.lastActivityAt} /> : <span className="text-xs text-slate-400">—</span>),
  },
  {
    id: 'status',
    header: 'Status',
    render: (_v, row) => <Pill tone={INTEGRATION_STATUS[row.status].tone}>{INTEGRATION_STATUS[row.status].label}</Pill>,
  },
  { id: 'source', header: 'Source', render: (_v, row) => <SourceCell source={row.source} /> },
];

/** Audit Logs — Event Type, Actor, Module, Outcome, Timestamp. */
export const auditColumns: Column<AuditRow>[] = [
  { id: 'eventType', header: 'Event type', render: (_v, row) => <Mono>{row.eventType}</Mono> },
  {
    id: 'actor',
    header: 'Actor',
    render: (_v, row) => (
      <span className="text-xs text-slate-700">
        {row.actor}
        <span className="ml-1.5 text-[10px] uppercase tracking-wider text-slate-400">{row.actorType}</span>
      </span>
    ),
  },
  {
    // `subject_entity_key`, labelled for what it is. ai_audit_logs has no
    // declared-module column, and calling the subject a module would overstate
    // what the row records.
    id: 'module',
    header: 'Subject',
    render: (_v, row) =>
      row.module ? <span className="text-xs text-slate-700">{row.module}</span> : <span className="text-xs text-slate-400">—</span>,
  },
  {
    id: 'outcome',
    header: 'Outcome',
    render: (_v, row) => <Pill tone={row.outcome === 'success' ? 'green' : row.outcome === 'rejected' ? 'amber' : 'red'}>{row.outcome}</Pill>,
  },
  { id: 'occurredAt', header: 'Timestamp', render: (_v, row) => <When iso={row.occurredAt} /> },
  { id: 'source', header: 'Source', render: (_v, row) => <SourceCell source={row.source} /> },
];
