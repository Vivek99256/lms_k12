'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronRight, Database, PlugZap, Search, ShieldAlert } from 'lucide-react';

import { Tabs } from '@/app/hrit/_components/tabs';
import { SectionPanel } from '@/app/fees/_components/fees-shared';
import {
  Card,
  ErrorState,
  Pill,
  RefreshButton,
  formatWhen,
} from '@/app/platform-services/_components/shell';
import {
  DEFAULT_FILTERS,
  CONSUMERS_ROUTE,
  EVENT_BUS_ROUTES,
  EVENT_BUS_SOURCES,
  EventBusNotWiredError,
  isRestricted,
  type RestrictedSection,
  eventBusAdapter,
  type AuditRow,
  type ConsumerRow,
  type DeliveryChannel,
  type DeliveryRow,
  type EventBusFilters,
  type EventBusOverview,
  type EventRow,
  type EventStatus,
  type FailureRow,
  type IntegrationRow,
  type Paged,
} from '@/lib/event-bus';

import { KpiRow } from './kpi-row';
import { VolumeChart } from './volume-chart';
import {
  EventBusTable,
  auditColumns,
  consumerColumns,
  deliveryColumns,
  eventColumns,
  failureColumns,
  integrationColumns,
} from './tables';

/**
 * Event Bus — the monitoring plane.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT THIS SCREEN IS, AND WHAT IT DELIBERATELY IS NOT
 * ────────────────────────────────────────────────────────────────────────────
 * It is a window onto mechanisms that already run: the trigger-fed `sync_log`
 * outbox drained every minute by `neo4j:drain`, the fourteen typed event kinds in
 * `ai_audit_logs`, `workflow_runs` and its steps, the four outbound send-logs, and
 * `fees_reconciliation`. None of that was visible anywhere before this page — the
 * only way to answer "is the outbox draining?" was to read laravel.log.
 *
 * It is NOT an event bus. This product does not have one, and the standing
 * architectural decision (#14, next_lms_erp/docs/decisions/) is explicit that a
 * second bus must not be built beside the working outbox. So there is no
 * publisher here, no broker, no queue of our own, no workflow builder and no
 * automation rules.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * EVERY NUMBER ON THIS SCREEN CAME FROM A TABLE, OR THERE IS NO NUMBER
 * ────────────────────────────────────────────────────────────────────────────
 * There is no mock adapter, no fixture, no seeded generator and no fallback
 * array anywhere behind this component. `lib/event-bus/client.ts` is the only
 * source, and it reads `GET /api/platform/events/*` — six endpoints over tables
 * this application already writes. Where a column does not exist the API returns
 * null and the cell says "Not recorded"; where an endpoint does not exist the
 * client refuses with `EventBusNotWiredError` and the panel says so.
 *
 * FOUR STATES, KEPT VISIBLY APART. They are routinely conflated and they mean
 * entirely different things:
 *   Loading              — the request is in flight.
 *   Not connected        — no endpoint answered; nothing is being measured.
 *   No records found     — the endpoint answered and the table is empty.
 *   Error                — the endpoint answered with a refusal or a failure.
 * "Not connected" showing as an empty table would tell an operator the outbox is
 * clean when in truth nobody is looking at it. That is the exact failure this
 * page exists to prevent, so it must not commit it itself.
 *
 * The only list rendered from the frontend is the wiring checklist at the bottom
 * of Overview, and that is metadata about which table feeds which panel — table
 * names verified against the backend repository — never rows, counts or
 * telemetry.
 */

type TabId = 'overview' | 'events' | 'consumers' | 'failures' | 'deliveries' | 'integrations' | 'audit';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'events', label: 'Event stream' },
  { id: 'consumers', label: 'Consumers' },
  { id: 'failures', label: 'Failures' },
  { id: 'deliveries', label: 'Deliveries' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'audit', label: 'Audit logs' },
];

/** The route each tab depends on, so a disconnected tab can name it. */
const TAB_ROUTE: Record<TabId, string> = {
  overview: EVENT_BUS_ROUTES.overview,
  events: EVENT_BUS_ROUTES.events,
  // The one route that does not exist. `hpbrain_consumer_state` has no producer,
  // so an endpoint over it would answer "no records found" — which would claim
  // the estate has no consumers when neo4j:drain runs every minute.
  consumers: CONSUMERS_ROUTE,
  failures: EVENT_BUS_ROUTES.failures,
  deliveries: EVENT_BUS_ROUTES.deliveries,
  integrations: EVENT_BUS_ROUTES.integrations,
  audit: EVENT_BUS_ROUTES.audit,
};

/**
 * Which filters each tab actually honours.
 *
 * Offering a Channel filter on the Consumers tab would be offering a control
 * that does nothing — the commonest way a dashboard teaches people to distrust
 * its filters.
 */
const TAB_FILTERS: Record<TabId, Array<'date' | 'eventType' | 'status' | 'channel' | 'search'>> = {
  overview: ['date'],
  events: ['date', 'eventType', 'status', 'search'],
  consumers: [],
  failures: ['date', 'search'],
  deliveries: ['date', 'channel', 'search'],
  integrations: ['date', 'search'],
  audit: ['date', 'eventType', 'search'],
};

/**
 * Status and channel options are a schema, not data.
 *
 * `sync_log.status` and the set of channels the estate can send on are fixed
 * domains declared in `lib/event-bus/types.ts` — enumerating them in a dropdown
 * asserts nothing about what any table currently holds. Event types are the
 * opposite: the real set is whatever `DISTINCT event_type` returns, so that
 * filter is free text rather than a list this file would have to invent.
 */
const STATUS_OPTIONS: EventStatus[] = ['pending', 'processing', 'completed', 'failed', 'dead'];
const CHANNEL_OPTIONS: DeliveryChannel[] = ['whatsapp', 'sms', 'email', 'push', 'in_app'];

// ── Small local controls ────────────────────────────────────────────────────

function Select({
  label,
  value,
  options,
  onChange,
  anyLabel,
  disabled,
  title,
}: {
  label: string;
  value: string | null;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (next: string | null) => void;
  anyLabel: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <select
        value={value ?? ''}
        disabled={disabled}
        title={title}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      >
        <option value="">{anyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextFilter({
  label,
  value,
  placeholder,
  onChange,
  icon,
  className = '',
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (next: string) => void;
  icon?: boolean;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <span className="relative block">
        {icon && <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`h-8 w-full rounded-lg border border-slate-300 py-1.5 pr-2 text-xs placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 ${icon ? 'pl-8' : 'pl-2'}`}
        />
      </span>
    </label>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string | null; onChange: (next: string | null) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <input
        type="date"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
      />
    </label>
  );
}

/**
 * The state every panel falls into while the read API is unbuilt.
 *
 * It names the route that has to exist and the tables behind it, because the
 * person who sees this is the person who can make it go away. What it never does
 * is resemble data: no zero, no dash in a value slot, no empty table that could
 * be mistaken for a quiet system.
 */
function NotConnected({ route, tables }: { route: string; tables: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 px-6 py-12 text-center">
      <PlugZap size={22} className="mb-3 text-slate-400" aria-hidden="true" />
      <p className="text-sm font-semibold text-slate-700">Data source not connected</p>
      <p className="mt-1.5 max-w-md text-xs leading-5 text-slate-500">
        Nothing is being read, so nothing is shown. This panel needs{' '}
        <code className="rounded bg-slate-100 px-1 font-mono text-[11px] text-slate-700">GET /api/platform{route}</code>, which has not
        been implemented in <code className="rounded bg-slate-100 px-1 font-mono text-[11px] text-slate-700">routes/platform.php</code>.
      </p>
      <p className="mt-2 font-mono text-[11px] text-slate-400">{tables}</p>
    </div>
  );
}

/**
 * What a section the caller may not see looks like.
 *
 * MUST NOT RESEMBLE AN EMPTY RESULT, and that is the entire reason it exists.
 * "No records found" says the table is clean; this says someone else can see it.
 * An institute administrator shown the first where the second is true would
 * conclude nothing had failed — the precise mistake this screen was built to stop
 * people making, so it would be indefensible for the screen to cause it.
 *
 * It names the reason rather than just greying out, because the next question is
 * always "why not me", and the answer is short.
 */
function Restricted({ reason, what }: { reason: string; what: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 px-6 py-12 text-center">
      <ShieldAlert size={22} className="mb-3 text-slate-400" aria-hidden="true" />
      <p className="text-sm font-semibold text-slate-700">{reason}</p>
      <p className="mt-1.5 max-w-md text-xs leading-5 text-slate-500">
        {what} is read from tables that carry no institute column, so it cannot be limited to your school. It is available to Super
        Admin accounts only.
      </p>
    </div>
  );
}

/**
 * The banner that sits above every tab while nothing is wired.
 *
 * It replaces an earlier sample-data warning, and the difference matters: there
 * is no longer any sample data to warn about. This says the opposite — that the
 * screen is empty because it will not invent anything to fill itself with.
 */
function NotConnectedBanner() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <PlugZap size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-medium">The Event Bus read API is not connected yet, so this screen is empty.</p>
        <p className="mt-0.5 text-xs leading-5">
          The tables these panels read — <code className="rounded bg-amber-100 px-1">sync_log</code>,{' '}
          <code className="rounded bg-amber-100 px-1">ai_audit_logs</code>, <code className="rounded bg-amber-100 px-1">workflow_runs</code>,{' '}
          <code className="rounded bg-amber-100 px-1">whatsapp_sent_messages</code> and the rest — exist and hold real rows, but no endpoint
          serves them to the browser. Nothing is substituted in the meantime: there is no sample data, no placeholder count and no cached
          figure anywhere on this page. The wiring checklist at the bottom of Overview lists what each panel needs.
        </p>
      </div>
    </div>
  );
}

/**
 * Which table feeds which panel, and what has to exist first.
 *
 * Metadata, not telemetry — it carries no counts and no rows. It sits on the
 * screen rather than in a README because the person who needs it is the one
 * looking at a blank panel wondering whether that means "nothing failed" or
 * "nothing is being counted".
 */
function DataSourcesPanel() {
  const tone = { ready: 'green', empty: 'amber', missing: 'red' } as const;
  const wording = { ready: 'Table ready', empty: 'No producer', missing: 'Does not exist' } as const;

  return (
    <SectionPanel
      title="Backend wiring checklist"
      description="Which table each panel will read, and what has to exist before it can. No counts are shown here — this is the mapping, not the data."
    >
      <ul className="divide-y divide-slate-100">
        {EVENT_BUS_SOURCES.map((source) => (
          <li key={source.table} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex w-full shrink-0 items-center gap-2 sm:w-[19rem]">
              <Database size={13} className="shrink-0 text-slate-400" aria-hidden="true" />
              <code className="truncate font-mono text-xs text-slate-800">{source.table}</code>
              <Pill tone={tone[source.status]}>{wording[source.status]}</Pill>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-700">{source.feeds}</p>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">{source.note}</p>
            </div>
          </li>
        ))}
      </ul>
    </SectionPanel>
  );
}

// ── The console ─────────────────────────────────────────────────────────────

export function EventBusConsole() {
  const [tab, setTab] = useState<TabId>('overview');
  const [filters, setFilters] = useState<EventBusFilters>(DEFAULT_FILTERS);
  const [nonce, setNonce] = useState(0);

  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<Error | null>(null);

  const [overview, setOverview] = useState<EventBusOverview | null>(null);
  const [events, setEvents] = useState<Paged<EventRow> | null>(null);
  const [consumers, setConsumers] = useState<Paged<ConsumerRow> | null>(null);
  // May hold a refusal instead of a page — the Failures tab is Tier 2.
  const [failures, setFailures] = useState<Paged<FailureRow> | RestrictedSection | null>(null);
  const [deliveries, setDeliveries] = useState<Paged<DeliveryRow> | null>(null);
  const [integrations, setIntegrations] = useState<Paged<IntegrationRow> | null>(null);
  const [audit, setAudit] = useState<Paged<AuditRow> | null>(null);

  /**
   * One tab's data at a time.
   *
   * Loading all seven on mount would issue seven queries over tables of tens of
   * thousands of rows to render one. The cost of the tab switch is a fetch, which
   * is the correct trade for a screen an operator opens to look at one thing.
   */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailure(null);

    const request = (() => {
      switch (tab) {
        case 'overview': return eventBusAdapter.fetchOverview(filters).then((data) => !cancelled && setOverview(data));
        case 'events': return eventBusAdapter.fetchEvents(filters).then((data) => !cancelled && setEvents(data));
        case 'consumers': return eventBusAdapter.fetchConsumers(filters).then((data) => !cancelled && setConsumers(data));
        case 'failures': return eventBusAdapter.fetchFailures(filters).then((data) => !cancelled && setFailures(data));
        case 'deliveries': return eventBusAdapter.fetchDeliveries(filters).then((data) => !cancelled && setDeliveries(data));
        case 'integrations': return eventBusAdapter.fetchIntegrations(filters).then((data) => !cancelled && setIntegrations(data));
        case 'audit': return eventBusAdapter.fetchAudit(filters).then((data) => !cancelled && setAudit(data));
      }
    })();

    request
      // The server's own sentence, never a generic one. That matters most for a
      // 403: a refusal turned into an empty table would tell an operator there
      // is nothing to see when the truth is they may not see it.
      ?.catch((cause: unknown) => {
        if (cancelled) return;
        setFailure(cause instanceof Error ? cause : new Error('This view could not be loaded.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, filters, nonce]);

  /** Any filter change resets to page 1 — page 4 of a narrower result is nowhere. */
  const patch = useCallback((change: Partial<EventBusFilters>) => {
    setFilters((current) => ({ ...current, ...change, page: change.page ?? 1 }));
  }, []);

  /**
   * "No endpoint" is not "an error". One is a thing to build, the other a thing
   * that broke, and an operator has to be able to tell them apart at a glance.
   */
  const notConnected = failure instanceof EventBusNotWiredError;
  const errored = failure !== null && !notConnected;

  const visibleFilters = TAB_FILTERS[tab];

  /**
   * There is no Module filter, deliberately.
   *
   * None of the six endpoints can honour one. `sync_log` has no module column,
   * and `ai_audit_logs` has a subject rather than a declared module — so a
   * module picker here would be a control that silently does nothing, which is
   * the fastest way to teach an operator to distrust every other filter on the
   * screen. It returns the day a source records a module.
   */
  const filtered = useMemo(
    () => Boolean(filters.from || filters.to || filters.eventType || filters.status || filters.channel || filters.search.trim()),
    [filters],
  );

  /** One place decides what a panel shows, so the four states cannot diverge per tab. */
  const panel = useCallback(
    (page: Paged<unknown> | null, tables: string, table: ReactNode) => {
      if (notConnected) return <NotConnected route={TAB_ROUTE[tab]} tables={tables} />;
      if (!loading && page && page.total === 0) {
        return (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 px-6 py-12 text-center">
            <p className="text-sm font-semibold text-slate-700">No records found</p>
            <p className="mt-1.5 max-w-sm text-xs leading-5 text-slate-500">
              {filtered ? 'Nothing matched these filters. Clearing them will widen the search.' : 'The source table returned no rows for this tenant.'}
            </p>
            <p className="mt-2 font-mono text-[11px] text-slate-400">{tables}</p>
          </div>
        );
      }
      return table;
    },
    [notConnected, loading, tab, filtered],
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="mb-4">
        <p className="flex items-center gap-1 text-xs font-medium text-slate-500">
          Platform services <ChevronRight size={12} /> Event Bus
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Event Bus</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              What the platform captured, who consumed it, what failed and what was delivered. This screen reads the mechanisms that
              already run — it publishes nothing, retries nothing and configures nothing.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {overview?.generatedAt && <span className="text-xs text-slate-500">Read {formatWhen(overview.generatedAt)}</span>}
            <RefreshButton onClick={() => setNonce((value) => value + 1)} busy={loading} />
          </div>
        </div>
      </header>

      {notConnected && (
        <div className="mb-4">
          <NotConnectedBanner />
        </div>
      )}

      <Card className="mb-4 px-4 py-3">
        <Tabs tabs={TABS} active={tab} onChange={(next) => { setTab(next as TabId); patch({ page: 1 }); }} />

        <div className="mt-3 flex flex-wrap items-end gap-3">
          {visibleFilters.includes('date') && (
            <>
              <DateInput label="From" value={filters.from} onChange={(from) => patch({ from })} />
              <DateInput label="To" value={filters.to} onChange={(to) => patch({ to })} />
            </>
          )}
          {visibleFilters.includes('eventType') && (
            <TextFilter
              label="Event type"
              value={filters.eventType ?? ''}
              placeholder="Exact event type"
              onChange={(eventType) => patch({ eventType: eventType || null })}
            />
          )}
          {visibleFilters.includes('status') && (
            <Select
              label="Status"
              value={filters.status}
              options={STATUS_OPTIONS.map((value) => ({ value, label: value }))}
              anyLabel="Any status"
              onChange={(status) => patch({ status: status as EventStatus | null })}
            />
          )}
          {visibleFilters.includes('channel') && (
            <Select
              label="Channel"
              value={filters.channel}
              options={CHANNEL_OPTIONS.map((value) => ({ value, label: value }))}
              anyLabel="All channels"
              onChange={(channel) => patch({ channel: channel as DeliveryChannel | null })}
            />
          )}
          {visibleFilters.includes('search') && (
            <TextFilter
              label="Find"
              value={filters.search}
              placeholder="Entity, recipient or error"
              icon
              className="flex-1 sm:max-w-xs"
              onChange={(search) => patch({ search })}
            />
          )}
          {filtered && (
            <button
              type="button"
              onClick={() => setFilters({ ...DEFAULT_FILTERS })}
              className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {errored ? (
        <ErrorState message={failure!.message} onRetry={() => setNonce((value) => value + 1)} />
      ) : (
        <div className="space-y-4">
          {tab === 'overview' && (
            <>
              <KpiRow
                tiles={notConnected ? null : overview?.kpis ?? null}
                loading={loading}
                restrictedSections={overview?.restricted?.sections ?? []}
              />

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <SectionPanel
                  title="Event volume"
                  description="Outbox rows captured per hour over the last 24 hours, split by outcome."
                >
                  {notConnected ? (
                    <NotConnected route={EVENT_BUS_ROUTES.overview} tables="sync_log, neo4j_sync_queue" />
                  ) : loading && !overview ? (
                    <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
                  ) : overview?.volume ? (
                    <VolumeChart points={overview.volume} />
                  ) : overview ? (
                    // `volume: null` means withheld, never "no events". Passing
                    // `?? []` here would draw an empty chart that reads as a
                    // quiet estate.
                    <Restricted reason={overview.restricted?.reason ?? 'Super Admin only'} what="The outbox volume series" />
                  ) : null}
                </SectionPanel>

                <SectionPanel
                  title="Recent failures"
                  description="The most recent events that did not get through. The Failures tab has the rest."
                >
                  {notConnected ? (
                    <NotConnected route={EVENT_BUS_ROUTES.overview} tables="sync_log, workflow_steps, failed_jobs" />
                  ) : loading && !overview ? (
                    <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
                  ) : !overview ? null : overview.recentFailures === null ? (
                    // Withheld, not empty — see the volume panel above.
                    <Restricted reason={overview.restricted?.reason ?? 'Super Admin only'} what="The failure list" />
                  ) : overview.recentFailures.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">No records found — nothing has failed in this window.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {overview.recentFailures.map((failureRow) => (
                        <li key={failureRow.id} className="py-2.5">
                          <div className="flex items-start gap-2">
                            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red-500" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-mono text-xs text-slate-800" title={failureRow.event}>{failureRow.event}</p>
                              {/* An outbox failure has no stored message — GraphDrain
                                  writes it to the log file, not to a column. Saying so
                                  beats an empty line that reads as "no detail yet". */}
                              <p
                                className={`mt-0.5 line-clamp-2 text-xs leading-5 ${failureRow.error ? 'text-slate-500' : 'italic text-slate-400'}`}
                                title={failureRow.error ?? 'No error text is stored for this source.'}
                              >
                                {failureRow.error ?? 'No error text recorded'}
                              </p>
                              <p className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                                <span>{formatWhen(failureRow.failedAt)}</span>
                                <span className="font-mono">{failureRow.source}</span>
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </SectionPanel>
              </div>

              <DataSourcesPanel />
            </>
          )}

          {tab === 'events' && (
            <SectionPanel
              title="Event stream"
              description="Every change the outbox captured, newest first. Both kinds of sync_log row appear here: projected node events and thin “row changed” events written by database triggers."
            >
              {events?.partial && (
                <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
                  <p className="font-medium">Showing only tenant-attributed events.</p>
                  <p>Some events do not contain institute information and are excluded from this view.</p>
                  <p className="mt-1 tabular-nums text-blue-800">
                    Visible events: {events.visible_events?.toLocaleString('en-IN') ?? '0'} · Excluded events: {events.excluded_events?.toLocaleString('en-IN') ?? '0'}
                  </p>
                </div>
              )}
              {panel(
                events,
                'sync_log, neo4j_sync_queue',
                <EventBusTable
                  columns={eventColumns}
                  page={events}
                  loading={loading}
                  emptyLabel="No records found."
                  onPageChange={(page) => patch({ page })}
                />,
              )}
            </SectionPanel>
          )}

          {tab === 'consumers' && (
            <SectionPanel
              title="Consumers"
              description="Who is draining the outbox, how far behind they are, and how much they still owe. Lag above 15 minutes is the signal that catches a stopped consumer — depth alone does not."
            >
              {panel(
                consumers,
                'hpbrain_consumer_state',
                <EventBusTable
                  columns={consumerColumns}
                  page={consumers}
                  loading={loading}
                  emptyLabel="No records found."
                  onPageChange={(page) => patch({ page })}
                />,
              )}
            </SectionPanel>
          )}

          {tab === 'failures' && (
            <SectionPanel
              title="Failures"
              description="Events, workflow steps and gateway reconciliations that did not get through. Read-only: retry and replay cannot ship until real queue workers exist."
            >
              {isRestricted(failures) ? (
                <Restricted reason={failures.reason} what="The failure list" />
              ) : (
                panel(
                  failures,
                  'sync_log, workflow_steps, failed_jobs, fees_reconciliation',
                  <EventBusTable
                    columns={failureColumns}
                    page={failures}
                    loading={loading}
                    emptyLabel="No records found."
                    onPageChange={(page) => patch({ page })}
                  />,
                )
              )}
            </SectionPanel>
          )}

          {tab === 'deliveries' && (
            <SectionPanel
              title="Deliveries"
              description="Outbound messages across the four send-logs. Only WhatsApp carries a real delivery receipt; SMS, email and push record that a message was handed to a gateway and nothing after that."
            >
              {panel(
                deliveries,
                'whatsapp_sent_messages, sms_sent_parents, sms_sent_staff, email_sent_parents',
                <EventBusTable
                  columns={deliveryColumns}
                  page={deliveries}
                  loading={loading}
                  emptyLabel="No records found."
                  onPageChange={(page) => patch({ page })}
                />,
              )}
            </SectionPanel>
          )}

          {tab === 'integrations' && (
            <SectionPanel
              title="Integrations"
              description="Which external services are configured and whether anything records what they do. Credentials are changed in Integration Management, not here — this view only reports."
            >
              {panel(
                integrations,
                'fees_online_maping, sms_api_details, whatapp_user_details',
                <EventBusTable
                  columns={integrationColumns}
                  page={integrations}
                  loading={loading}
                  emptyLabel="No records found."
                  onPageChange={(page) => patch({ page })}
                />,
              )}
            </SectionPanel>
          )}

          {tab === 'audit' && (
            <SectionPanel
              title="Audit logs"
              description="The typed event trail from ai_audit_logs, federated with the other audit tables. Federated, never copied — each row still belongs to the table that wrote it."
            >
              {panel(
                audit,
                'ai_audit_logs, system_audit_logs, mcp_audit_logs',
                <EventBusTable
                  columns={auditColumns}
                  page={audit}
                  loading={loading}
                  emptyLabel="No records found."
                  onPageChange={(page) => patch({ page })}
                />,
              )}
            </SectionPanel>
          )}
        </div>
      )}
    </div>
  );
}
