'use client';

import { useState } from 'react';

import type {
  FeesBankMandates,
  FeesClass,
  FeesCycle,
  FeesFeeRevisions,
  FeesHead,
  FeesLateRules,
  FeesOtherCollections,
  FeesPaymentFailures,
  FeesPaymentMethods,
  FeesPaymentMode,
  FeesReconciliation,
  FeesReminders,
  FeesVelocity,
} from '@/app/fees/intelligence/_lib/fees-intelligence-api';
import { count, money, moneyExact, percent, Surface } from '@/app/fees/intelligence/_components/fees-intelligence-primitives';

/**
 * The Fees Intelligence charts.
 *
 * FOUR RULES THIS FILE FOLLOWS, all from the visualization guidance:
 *
 *  1. EVERY CHART ANSWERS A QUESTION, and its caption states the answer the
 *     data actually gives — computed here from the series, never written by
 *     hand. A chart with nothing to say is not rendered.
 *  2. ONE AXIS. Demand and collection share a rupee scale and are drawn against
 *     one baseline; nothing on this screen is a dual-axis chart.
 *  3. COLOUR IS NEVER THE ONLY ENCODING. Every series is directly labelled, a
 *     legend is present wherever two series share a plot, and each chart has a
 *     table twin behind "Show figures" — required, because three slots of this
 *     palette sit under 3:1 against white.
 *  4. THE PALETTE IS THE FEES MODULE'S OWN, reused verbatim from
 *     app/fees/_components/fees-charts.tsx and re-validated (lightness band,
 *     chroma floor, CVD separation and normal-vision floor all pass) rather than
 *     invented for this screen.
 *
 * Marks are hand-built HTML, matching the existing Fees charts, so the two
 * screens look like one product.
 */

/* ------------------------------------------------------------------ palette */

const SERIES = {
  /** Billed — the reference quantity, recessive. */
  demand: '#cde2fb',
  /** Collected — money actually received. */
  collected: '#2a78d6',
  /** Outstanding — attention, not alarm. */
  outstanding: '#eda100',
  /** Genuine risk only. */
  overdue: '#e34948',
  settled: '#1baf7a',
};

const MODE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

/* ------------------------------------------------------------------- shell */

function ChartCard({
  title,
  question,
  caption,
  figures,
  children,
}: {
  title: string;
  question: string;
  caption?: string | null;
  figures: React.ReactNode;
  children: React.ReactNode;
}) {
  const [showFigures, setShowFigures] = useState(false);

  return (
    <Surface className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-[14px] font-bold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-[12px] text-slate-500">{question}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowFigures((open) => !open)}
          aria-expanded={showFigures}
          className="shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold text-[#5846EA] transition hover:bg-indigo-50"
        >
          {showFigures ? 'Hide figures' : 'Show figures'}
        </button>
      </div>

      <div className="px-4 py-4">{children}</div>

      {caption ? (
        <p className="border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[12.5px] leading-5 text-slate-700">
          {caption}
        </p>
      ) : null}

      {showFigures ? <div className="border-t border-slate-100 px-4 py-3">{figures}</div> : null}
    </Surface>
  );
}

function FigureTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Array<string>>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={`py-1.5 pr-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 ${
                  index === 0 ? '' : 'text-right'
                }`}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-b border-slate-100 last:border-0">
              {row.map((cell, index) => (
                <td
                  key={index}
                  className={`py-1.5 pr-3 ${index === 0 ? 'font-medium text-slate-700' : 'text-right tabular-nums text-slate-900'}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Legend({ items }: { items: Array<{ color: string; label: string }> }) {
  return (
    <ul className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5 text-[12px] text-slate-600">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------- collection against what is billed */

/**
 * Cycle trend — the one chart that answers "is collection keeping up?".
 *
 * Only cycles that were ACTUALLY BILLED are plotted. A fee calendar contains
 * twelve cycles whether or not the school billed into them, and plotting the
 * empty ones draws a cliff that describes the calendar rather than the
 * collection.
 */
export function CycleTrend({ cycles }: { cycles: FeesCycle[] }) {
  const billed = cycles.filter((cycle) => cycle.demandAmount > 0 || cycle.collectedAmount > 0);
  if (billed.length < 2) return null;

  const peak = Math.max(...billed.map((cycle) => Math.max(cycle.demandAmount, cycle.collectedAmount)));
  if (peak <= 0) return null;

  const past = billed.filter((cycle) => cycle.isPast && cycle.demandAmount > 0);
  const caption = describeCycleTrend(past);

  return (
    <ChartCard
      title="Collection against what was billed"
      question="Is collection keeping pace with the fee calendar?"
      caption={caption}
      figures={
        <FigureTable
          columns={['Cycle', 'Demand', 'Collected', 'Outstanding', 'Rate']}
          rows={billed.map((cycle) => [
            cycle.label,
            moneyExact(cycle.demandAmount),
            moneyExact(cycle.collectedAmount),
            moneyExact(cycle.outstandingAmount),
            percent(cycle.collectionRate),
          ])}
        />
      }
    >
      <Legend
        items={[
          { color: SERIES.demand, label: 'Billed' },
          { color: SERIES.collected, label: 'Collected' },
        ]}
      />
      <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ minHeight: 160 }}>
        {billed.map((cycle) => {
          const demandHeight = Math.max((cycle.demandAmount / peak) * 130, cycle.demandAmount > 0 ? 3 : 0);
          const collectedHeight = Math.max((cycle.collectedAmount / peak) * 130, cycle.collectedAmount > 0 ? 3 : 0);

          return (
            <div key={cycle.cycleId} className="flex min-w-[52px] flex-1 flex-col items-center gap-1.5">
              <span className="text-[11px] font-semibold tabular-nums text-slate-700">
                {percent(cycle.collectionRate)}
              </span>
              {/* Two marks on ONE rupee baseline, 2px apart. */}
              <div className="flex h-[130px] w-full items-end justify-center gap-[2px]">
                <div
                  title={`Billed ${moneyExact(cycle.demandAmount)}`}
                  className="w-1/2 rounded-t-[4px]"
                  style={{ height: demandHeight, background: SERIES.demand }}
                />
                <div
                  title={`Collected ${moneyExact(cycle.collectedAmount)}`}
                  className="w-1/2 rounded-t-[4px]"
                  style={{ height: collectedHeight, background: SERIES.collected }}
                />
              </div>
              <span className="whitespace-nowrap text-[11px] text-slate-500">{cycle.label}</span>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}

/**
 * The chart's own interpretation, computed from the series it just drew.
 *
 * Deliberately conservative: with fewer than two comparable cycles it says the
 * trend is undetermined rather than describing a single point as a direction.
 */
function describeCycleTrend(past: FeesCycle[]): string | null {
  if (past.length < 2) {
    return 'Not enough completed fee cycles have been billed to read a trend yet.';
  }

  const current = past[past.length - 1];
  const previous = past[past.length - 2];

  if (previous.collectedAmount <= 0 && current.collectedAmount <= 0) {
    return `Nothing has been collected against ${previous.label} or ${current.label}, though both were billed.`;
  }
  if (previous.collectedAmount <= 0) {
    return `Collection resumed in ${current.label} at ${money(current.collectedAmount)} after nothing was recorded for ${previous.label}.`;
  }

  const change = ((current.collectedAmount - previous.collectedAmount) / previous.collectedAmount) * 100;
  const direction = change < -1 ? 'fell' : change > 1 ? 'rose' : 'held steady';

  if (direction === 'held steady') {
    return `Collection held steady between ${previous.label} and ${current.label} at about ${money(current.collectedAmount)}.`;
  }

  return `Collection ${direction} ${percent(Math.abs(change))} between ${previous.label} (${money(previous.collectedAmount)}) and ${current.label} (${money(current.collectedAmount)}).`;
}

/* --------------------------------------------------------------- by class */

/** Where the outstanding balance sits, by class. */
export function ClassBreakdown({
  classes,
  baseline,
  onSelect,
}: {
  classes: FeesClass[];
  baseline: number | null;
  onSelect?: (row: FeesClass) => void;
}) {
  const rows = classes.filter((row) => row.demandAmount > 0).slice(0, 12);
  if (rows.length === 0) return null;

  const peak = Math.max(...rows.map((row) => row.demandAmount));
  const worst = rows.reduce((a, b) => (a.outstandingAmount >= b.outstandingAmount ? a : b));
  const totalOutstanding = rows.reduce((sum, row) => sum + row.outstandingAmount, 0);
  const share = totalOutstanding > 0 ? (worst.outstandingAmount / totalOutstanding) * 100 : 0;

  return (
    <ChartCard
      title="Outstanding by class"
      question="Which classes carry the unpaid balance?"
      caption={
        rows.length === 1
          ? `All outstanding fees sit in ${worst.label}.`
          : `${worst.label} carries the largest balance — ${money(worst.outstandingAmount)}, ${percent(share)} of the outstanding across these classes.`
      }
      figures={
        <FigureTable
          columns={['Class', 'Accounts', 'Billed', 'Collected', 'Outstanding', 'Rate', 'Bounces']}
          rows={rows.map((row) => [
            row.label,
            String(row.accounts),
            moneyExact(row.demandAmount),
            moneyExact(row.collectedAmount),
            moneyExact(row.outstandingAmount),
            percent(row.collectionRate),
            String(row.failureCount ?? 0),
          ])}
        />
      }
    >
      <Legend
        items={[
          { color: SERIES.collected, label: 'Collected' },
          { color: SERIES.outstanding, label: 'Outstanding' },
        ]}
      />
      <ul className="space-y-2.5">
        {rows.map((row) => {
          const width = (row.demandAmount / peak) * 100;
          const collectedShare = row.demandAmount > 0 ? (row.collectedAmount / row.demandAmount) * 100 : 0;
          const behind = baseline !== null && row.collectionRate !== null && baseline - row.collectionRate >= 15;

          const content = (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-semibold text-slate-800">
                  {row.label}
                  <span className="ml-2 text-[11px] font-normal text-slate-500">
                    {row.accounts} {row.accounts === 1 ? 'account' : 'accounts'}
                  </span>
                  {behind ? (
                    <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-inset ring-amber-200">
                      Behind
                    </span>
                  ) : null}
                  {row.failureCount && row.failureCount > 0 ? (
                    <span className="ml-2 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700 ring-1 ring-inset ring-rose-200">
                      {row.failureCount} {row.failureCount === 1 ? 'bounce' : 'bounces'}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-slate-600">
                  {money(row.outstandingAmount)} outstanding · {percent(row.collectionRate)}
                </span>
              </div>
              {/* One bar = that class's billed amount, split collected / outstanding. */}
              <div className="mt-1.5 h-[14px] w-full overflow-hidden rounded-[4px] bg-slate-100">
                <div className="flex h-full gap-[2px]" style={{ width: `${Math.max(width, 2)}%` }}>
                  <div style={{ width: `${collectedShare}%`, background: SERIES.collected }} />
                  <div style={{ width: `${Math.max(100 - collectedShare, 0)}%`, background: SERIES.outstanding }} />
                </div>
              </div>
            </>
          );

          return (
            <li key={`${row.gradeId}-${row.standardId}`}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(row)}
                  className="block w-full rounded-lg px-1.5 py-1 text-left transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5846EA]"
                >
                  {content}
                </button>
              ) : (
                <div className="px-1.5 py-1">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}

/* ----------------------------------------------------------- by fee head */

/** Which fee heads are collecting and which are not. */
export function HeadBreakdown({ heads }: { heads: FeesHead[] }) {
  const rows = heads.filter((row) => row.demandAmount > 0).slice(0, 12);
  if (rows.length === 0) return null;

  const peak = Math.max(...rows.map((row) => row.demandAmount));
  const unattributable = rows.filter((row) => !row.collectionAttributable);
  const worst = rows
    .filter((row) => row.collectionAttributable && row.collectionRate !== null)
    .sort((a, b) => (a.collectionRate ?? 0) - (b.collectionRate ?? 0))[0];

  const caption = worst
    ? `${worst.label} is the weakest head — ${percent(worst.collectionRate)} of ${money(worst.demandAmount)} billed.`
    : 'Collection cannot be attributed to individual heads for this year.';

  return (
    <ChartCard
      title="Collection by fee head"
      question="Which fee heads are families actually paying?"
      caption={
        unattributable.length > 0
          ? `${caption} ${unattributable.length} ${unattributable.length === 1 ? 'head is' : 'heads are'} not recorded separately on receipts, so collection against ${unattributable.length === 1 ? 'it' : 'them'} is unknown rather than zero.`
          : caption
      }
      figures={
        <FigureTable
          columns={['Fee head', 'Billed', 'Collected', 'Outstanding', 'Rate']}
          rows={rows.map((row) => [
            row.label,
            moneyExact(row.demandAmount),
            row.collectionAttributable ? moneyExact(row.collectedAmount) : 'Not recorded separately',
            moneyExact(row.outstandingAmount),
            row.collectionAttributable ? percent(row.collectionRate) : '—',
          ])}
        />
      }
    >
      <Legend
        items={[
          { color: SERIES.collected, label: 'Collected' },
          { color: SERIES.outstanding, label: 'Outstanding' },
        ]}
      />
      <ul className="space-y-2.5">
        {rows.map((row) => {
          const width = (row.demandAmount / peak) * 100;
          const collectedShare =
            row.collectionAttributable && row.demandAmount > 0 ? (row.collectedAmount / row.demandAmount) * 100 : 0;

          return (
            <li key={`${row.kind}-${row.headId}`} className="px-1.5 py-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-semibold text-slate-800">
                  {row.label}
                  {row.kind === 'additional' ? (
                    <span className="ml-2 text-[11px] font-normal text-slate-500">additional</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-slate-600">
                  {row.collectionAttributable ? (
                    <>
                      {money(row.collectedAmount)} of {money(row.demandAmount)} · {percent(row.collectionRate)}
                    </>
                  ) : (
                    <>{money(row.demandAmount)} billed · collection not recorded separately</>
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-[14px] w-full overflow-hidden rounded-[4px] bg-slate-100">
                {row.collectionAttributable ? (
                  <div className="flex h-full gap-[2px]" style={{ width: `${Math.max(width, 2)}%` }}>
                    <div style={{ width: `${collectedShare}%`, background: SERIES.collected }} />
                    <div style={{ width: `${Math.max(100 - collectedShare, 0)}%`, background: SERIES.outstanding }} />
                  </div>
                ) : (
                  /* Hatched, not coloured: unknown must not read as a quantity. */
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.max(width, 2)}%`,
                      backgroundImage:
                        'repeating-linear-gradient(45deg, #e2e8f0 0 6px, #f1f5f9 6px 12px)',
                    }}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}

/* ------------------------------------------------------- payment behaviour */

/** How fee money arrives. */
export function PaymentModeMix({ modes }: { modes: FeesPaymentMode[] }) {
  const rows = modes.filter((row) => row.amount > 0);
  if (rows.length === 0) return null;

  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  if (total <= 0) return null;

  const leader = rows[0];
  const leaderShare = (leader.amount / total) * 100;

  return (
    <ChartCard
      title="How fee money arrives"
      question="Which channels are families paying through?"
      caption={
        rows.length === 1
          ? `Every recorded receipt this year came through ${leader.mode.toLowerCase()}.`
          : `${leader.mode} accounts for ${percent(leaderShare)} of collection across ${rows.length} channels.`
      }
      figures={
        <FigureTable
          columns={['Channel', 'Receipts', 'Amount', 'Share']}
          rows={rows.map((row) => [
            row.mode,
            String(row.receipts),
            moneyExact(row.amount),
            percent((row.amount / total) * 100),
          ])}
        />
      }
    >
      {/* One stacked bar: the mix is a composition of a single whole. */}
      <div className="flex h-[18px] w-full gap-[2px] overflow-hidden rounded-[4px]">
        {rows.map((row, index) => (
          <div
            key={row.mode}
            title={`${row.mode}: ${moneyExact(row.amount)}`}
            style={{
              width: `${Math.max((row.amount / total) * 100, 1)}%`,
              background: MODE_COLORS[index % MODE_COLORS.length],
            }}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {rows.map((row, index) => (
          <li key={row.mode} className="flex items-center justify-between gap-3 text-[12.5px]">
            <span className="inline-flex items-center gap-1.5 text-slate-700">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ background: MODE_COLORS[index % MODE_COLORS.length] }}
              />
              {row.mode}
            </span>
            <span className="tabular-nums text-slate-600">
              {money(row.amount)} · {percent((row.amount / total) * 100)}
            </span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

/* ------------------------------------------------------------------- aging */

/** How long the overdue money has been overdue. */
export function AgingProfile({ bands }: { bands: Array<{ key: string; label: string; amount: number }> }) {
  const rows = bands.filter((band) => band.amount > 0);
  if (rows.length === 0) return null;

  const total = rows.reduce((sum, band) => sum + band.amount, 0);
  const oldest = rows[rows.length - 1];

  return (
    <ChartCard
      title="How long fees have been overdue"
      question="Is the arrears backlog recent or long-standing?"
      caption={`${money(oldest.amount)} of the ${money(total)} overdue falls in the ${oldest.label.toLowerCase()} band.`}
      figures={
        <FigureTable
          columns={['Age', 'Amount', 'Share']}
          rows={rows.map((band) => [band.label, moneyExact(band.amount), percent((band.amount / total) * 100)])}
        />
      }
    >
      <ul className="space-y-2.5">
        {rows.map((band) => (
          <li key={band.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-semibold text-slate-800">{band.label}</span>
              <span className="text-[12px] tabular-nums text-slate-600">
                {money(band.amount)} · {percent((band.amount / total) * 100)}
              </span>
            </div>
            <div className="mt-1.5 h-[14px] w-full overflow-hidden rounded-[4px] bg-slate-100">
              <div
                className="h-full rounded-[4px]"
                style={{
                  width: `${Math.max((band.amount / total) * 100, 2)}%`,
                  // Older money is genuinely worse, so the deepest band is the
                  // only one that earns red.
                  background: band.key === 'beyond' ? SERIES.overdue : SERIES.outstanding,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

/* ---------------------------------------------------- payment failures */

export function PaymentFailuresCard({ data }: { data?: FeesPaymentFailures }) {
  if (!data || !data.available || data.failureCount === 0) return null;

  const total = data.reasons.reduce((sum, r) => sum + r.count, 0) || 1;

  return (
    <ChartCard
      title="Payment Failures & Auto-Debit Bounces"
      question="Where is transaction friction occurring?"
      caption={`${count(data.failureCount)} failed payment attempts totaling ${money(data.failedAmount)} across ${count(data.affectedAccounts)} accounts (${count(data.repeatFailureAccounts)} repeat bounces).`}
      figures={
        <FigureTable
          columns={['Reason', 'Count', 'Amount', 'Share']}
          rows={data.reasons.map((r) => [r.reason, count(r.count), moneyExact(r.amount), percent((r.count / total) * 100)])}
        />
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-[12px] font-semibold text-slate-700">Failure Reasons Breakdown</p>
          <div className="mt-2 flex h-3 w-full overflow-hidden rounded-md bg-slate-100">
            {data.reasons.map((r, i) => (
              <div
                key={r.reason}
                title={`${r.reason}: ${count(r.count)}`}
                style={{
                  width: `${Math.max((r.count / total) * 100, 2)}%`,
                  background: MODE_COLORS[i % MODE_COLORS.length],
                }}
              />
            ))}
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {data.reasons.slice(0, 6).map((r, i) => (
              <li key={r.reason} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="inline-flex items-center gap-1.5 truncate text-slate-700">
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: MODE_COLORS[i % MODE_COLORS.length] }}
                  />
                  <span className="truncate">{r.reason}</span>
                </span>
                <span className="tabular-nums font-medium text-slate-900">
                  {count(r.count)} · {money(r.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {data.monthlyTrend.length > 0 ? (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-[12px] font-semibold text-slate-700">Monthly Failure Trend</p>
            <div className="mt-2 flex items-end gap-2 overflow-x-auto pb-1">
              {data.monthlyTrend.map((m) => (
                <div key={m.monthId} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold tabular-nums text-red-600">{m.count}</span>
                  <div
                    className="w-7 rounded-t bg-red-400"
                    style={{ height: `${Math.min(Math.max(m.count * 6, 8), 50)}px` }}
                  />
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">{m.label.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </ChartCard>
  );
}

/* ---------------------------------------------------- payment methods */

export function PaymentMethodsCard({ data }: { data?: FeesPaymentMethods }) {
  if (!data || !data.available || data.totalMappings === 0) return null;

  return (
    <ChartCard
      title="Payment Method Channel Distribution"
      question="What payment modes do student accounts prefer?"
      caption={`Primary payment channel is ${data.topMethod ?? 'Online'} across ${count(data.totalMappings)} recorded account mappings.`}
      figures={
        <FigureTable
          columns={['Payment Method', 'Accounts Mapped', 'Share']}
          rows={data.methods.map((m) => [m.method, count(m.count), percent(m.sharePercent)])}
        />
      }
    >
      <div className="space-y-3">
        <div className="flex h-3 w-full overflow-hidden rounded-md bg-slate-100">
          {data.methods.map((m, i) => (
            <div
              key={m.method}
              title={`${m.method}: ${percent(m.sharePercent)}`}
              style={{
                width: `${Math.max(m.sharePercent, 2)}%`,
                background: MODE_COLORS[i % MODE_COLORS.length],
              }}
            />
          ))}
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {data.methods.map((m, i) => (
            <li key={m.method} className="rounded-lg bg-slate-50 p-2.5">
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ background: MODE_COLORS[i % MODE_COLORS.length] }}
                />
                <span className="text-[12px] font-semibold text-slate-700">{m.method}</span>
              </div>
              <p className="mt-1 text-[15px] font-bold tabular-nums text-slate-900">{count(m.count)}</p>
              <p className="text-[11px] text-slate-500">{percent(m.sharePercent)} of accounts</p>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}

/* ---------------------------------------------------- gateway reconciliation */

export function GatewayReconciliationCard({ data }: { data?: FeesReconciliation }) {
  if (!data || !data.available || data.gatewayTransactions === 0) return null;

  const hasGap = data.reconciliationGapAmount > 0;

  return (
    <ChartCard
      title="Payment Gateway Settlement Reconciliation"
      question="Do online gateway settlements match ERP fee receipts?"
      caption={
        hasGap
          ? `Settlement variance of ${money(data.reconciliationGapAmount)} detected across ${count(data.unmatchedCount)} transactions.`
          : `All ${count(data.gatewayTransactions)} online gateway transactions match ERP recorded receipts.`
      }
      figures={
        <FigureTable
          columns={['Metric', 'Value']}
          rows={[
            ['Total Gateway Transactions', count(data.gatewayTransactions)],
            ['Gateway Processed Amount', moneyExact(data.gatewayTotalAmount)],
            ['ERP Recorded Amount', moneyExact(data.erpRecordedAmount)],
            ['Reconciliation Gap', moneyExact(data.reconciliationGapAmount)],
            ['Unmatched Transactions', count(data.unmatchedCount)],
          ]}
        />
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase text-slate-500">Gateway Txns</p>
          <p className="mt-1 text-[17px] font-bold tabular-nums text-slate-900">{count(data.gatewayTransactions)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase text-slate-500">Gateway Total</p>
          <p className="mt-1 text-[17px] font-bold tabular-nums text-slate-900">{money(data.gatewayTotalAmount)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-[11px] font-semibold uppercase text-slate-500">ERP Receipts</p>
          <p className="mt-1 text-[17px] font-bold tabular-nums text-slate-900">{money(data.erpRecordedAmount)}</p>
        </div>
        <div className={`rounded-lg p-3 ${hasGap ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <p className={`text-[11px] font-semibold uppercase ${hasGap ? 'text-amber-800' : 'text-emerald-800'}`}>
            Recon Gap
          </p>
          <p className={`mt-1 text-[17px] font-bold tabular-nums ${hasGap ? 'text-amber-900' : 'text-emerald-900'}`}>
            {money(data.reconciliationGapAmount)}
          </p>
        </div>
      </div>
    </ChartCard>
  );
}

/* ---------------------------------------------------- bank / NACH mandates */

export function BankMandatesCard({ data }: { data?: FeesBankMandates }) {
  if (!data || !data.available) return null;

  const cov = data.coveragePercent ?? 0;

  return (
    <ChartCard
      title="NACH Bank Mandate & Auto-Debit Readiness"
      question="What proportion of accounts are registered for automated debit?"
      caption={`${count(data.registeredMandates)} of ${count(data.totalEligible)} eligible accounts (${percent(cov)}) have an active e-mandate registered.`}
      figures={
        <FigureTable
          columns={['Status', 'Count', 'Coverage']}
          rows={[
            ['Registered Mandates', count(data.registeredMandates), percent(cov)],
            ['Pending Verification', count(data.pendingMandates), '—'],
            ['Rejected Mandates', count(data.rejectedMandates), '—'],
            ['Total Eligible Enrolments', count(data.totalEligible), '100%'],
          ]}
        />
      }
    >
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-[12.5px] font-semibold">
            <span className="text-slate-700">Mandate Registration Coverage</span>
            <span className="text-[#5846EA]">{percent(cov)}</span>
          </div>
          <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#5846EA]"
              style={{ width: `${Math.min(Math.max(cov, 1), 100)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="rounded-lg bg-emerald-50 p-2.5">
            <p className="text-[11px] font-semibold text-emerald-800 uppercase">Active</p>
            <p className="text-[16px] font-bold text-emerald-900">{count(data.registeredMandates)}</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-2.5">
            <p className="text-[11px] font-semibold text-amber-800 uppercase">Pending</p>
            <p className="text-[16px] font-bold text-amber-900">{count(data.pendingMandates)}</p>
          </div>
          <div className="rounded-lg bg-red-50 p-2.5">
            <p className="text-[11px] font-semibold text-red-800 uppercase">Rejected</p>
            <p className="text-[16px] font-bold text-red-900">{count(data.rejectedMandates)}</p>
          </div>
        </div>

        {data.rejectionReasons.length > 0 ? (
          <div className="border-t border-slate-100 pt-2 text-[12px] text-slate-600">
            <span className="font-semibold">Rejection reasons: </span>
            {data.rejectionReasons.map((r) => `${r.reason} (${r.count})`).join(', ')}
          </div>
        ) : null}
      </div>
    </ChartCard>
  );
}

/* ---------------------------------------------------- collection velocity */

export function CollectionVelocityCard({ data }: { data?: FeesVelocity }) {
  if (!data || !data.available || data.dailyTrend.length === 0) return null;

  return (
    <ChartCard
      title="Daily Collection Velocity"
      question="What is the daily cashflow pacing?"
      caption={
        data.peakDay
          ? `Peak collection was ${money(data.peakDay.amount)} on ${data.peakDay.date} across ${count(data.peakDay.receipts)} receipts.`
          : `Collections recorded across ${count(data.receiptDays)} active receipt dates.`
      }
      figures={
        <FigureTable
          columns={['Date', 'Receipts', 'Amount']}
          rows={data.dailyTrend.map((d) => [d.date, count(d.receipts), moneyExact(d.amount)])}
        />
      }
    >
      <div className="space-y-3">
        <div className="flex items-end gap-1.5 overflow-x-auto pb-2">
          {data.dailyTrend.map((d) => {
            const peakAmt = data.peakDay?.amount || 1;
            const height = Math.min(Math.max((d.amount / peakAmt) * 70, 8), 70);
            return (
              <div key={d.date} className="flex flex-col items-center gap-1 shrink-0">
                <div
                  title={`${d.date}: ${money(d.amount)} (${count(d.receipts)} receipts)`}
                  className="w-5 rounded-t bg-blue-500 hover:bg-indigo-600 transition"
                  style={{ height: `${height}px` }}
                />
                <span className="text-[9px] text-slate-500 tabular-nums">{d.date.slice(5)}</span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-2 text-[12px] text-slate-600">
          <span>Active Receipt Days: <strong className="text-slate-900">{count(data.receiptDays)}</strong></span>
          <span>Daily Average: <strong className="text-slate-900">{money(data.averageDailyCollection)}</strong></span>
        </div>
      </div>
    </ChartCard>
  );
}

/* ---------------------------------------------------- cancellation root causes */

export function CancellationReasonsCard({ reasons }: { reasons?: Array<{ reason: string; type: string; count: number; amount: number }> }) {
  if (!reasons || reasons.length === 0) return null;

  const total = reasons.reduce((sum, r) => sum + r.amount, 0) || 1;

  return (
    <ChartCard
      title="Cancellation Root Causes"
      question="Why are recorded fee receipts being reversed?"
      caption={`${count(reasons.length)} distinct cancellation categories recorded in the ledger.`}
      figures={
        <FigureTable
          columns={['Reason', 'Type', 'Receipts', 'Voided Amount']}
          rows={reasons.map((r) => [r.reason, r.type, count(r.count), moneyExact(r.amount)])}
        />
      }
    >
      <ul className="divide-y divide-slate-100">
        {reasons.slice(0, 6).map((r) => (
          <li key={r.reason} className="py-2 flex items-center justify-between text-[12.5px]">
            <div>
              <p className="font-semibold text-slate-800">{r.reason}</p>
              <p className="text-[11px] text-slate-500">{r.type} · {count(r.count)} receipts</p>
            </div>
            <div className="text-right">
              <p className="font-bold tabular-nums text-slate-900">{money(r.amount)}</p>
              <p className="text-[11px] text-slate-500">{percent((r.amount / total) * 100)}</p>
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

/* ---------------------------------------------------- fee revisions */

export function FeeRevisionsCard({ data }: { data?: FeesFeeRevisions }) {
  if (!data || !data.available || data.revisionCount === 0) return null;

  return (
    <ChartCard
      title="Fee Structure Modifications"
      question="Were fee rates altered mid-session?"
      caption={`${count(data.revisionCount)} fee structure alterations recorded across ${count(data.affectedStandardsCount)} classes during the session.`}
      figures={
        <FigureTable
          columns={['Class', 'Fee Head ID', 'Amount', 'Date']}
          rows={data.recentRevisions.map((r) => [r.standardLabel, r.feeTypeId, moneyExact(r.amount), r.modifiedAt])}
        />
      }
    >
      <ul className="divide-y divide-slate-100">
        {data.recentRevisions.map((r, i) => (
          <li key={`${r.standardId}-${r.feeTypeId}-${i}`} className="py-2 flex items-center justify-between text-[12.5px]">
            <div>
              <p className="font-semibold text-slate-800">{r.standardLabel}</p>
              <p className="text-[11px] text-slate-500">Modified: {r.modifiedAt.slice(0, 10)}</p>
            </div>
            <span className="font-bold tabular-nums text-slate-900">{money(r.amount)}</span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

/* ---------------------------------------------------- reminders conversion */

export function RemindersCard({ data }: { data?: FeesReminders }) {
  if (!data || !data.available || data.remindersSent === 0) return null;

  return (
    <ChartCard
      title="Fee Circular Notices & Conversion"
      question="What is the subsequent collection correlation for reminded accounts?"
      caption={`${count(data.remindersSent)} notices sent across ${count(data.accountsReminded)} accounts (${money(data.totalRemindedAmount)} reminded).`}
      figures={
        <FigureTable
          columns={['Metric', 'Value']}
          rows={[
            ['Reminders Dispatched', count(data.remindersSent)],
            ['Accounts Reminded', count(data.accountsReminded)],
            ['Total Amount Reminded', moneyExact(data.totalRemindedAmount)],
            ['Subsequent Paying Accounts', count(data.subsequentPayingAccounts)],
            ['Subsequent Conversion Rate', percent(data.subsequentCollectionConversionRate)],
          ]}
        />
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-slate-50 p-2.5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Notices Sent</p>
          <p className="text-[16px] font-bold text-slate-900">{count(data.remindersSent)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Accounts</p>
          <p className="text-[16px] font-bold text-slate-900">{count(data.accountsReminded)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Amount Reminded</p>
          <p className="text-[16px] font-bold text-slate-900">{money(data.totalRemindedAmount)}</p>
        </div>
        <div className="rounded-lg bg-indigo-50 p-2.5">
          <p className="text-[11px] font-semibold text-indigo-800 uppercase">Subsequent Payers</p>
          <p className="text-[16px] font-bold text-indigo-900">{percent(data.subsequentCollectionConversionRate)}</p>
        </div>
      </div>
    </ChartCard>
  );
}

/* ---------------------------------------------------- late rules configuration */

export function LateRulesCard({ data }: { data?: FeesLateRules }) {
  if (!data || !data.available || data.rulesCount === 0) return null;

  return (
    <ChartCard
      title="Configured Late Fee Rules"
      question="What penalty schedules are currently governing delayed payments?"
      caption={`${count(data.rulesCount)} late fee schedules configured. Overdue past cutoff: ${money(data.overdueAmountPastConfiguredDate)} across ${count(data.overdueAccountsPastConfiguredDate)} accounts.`}
      figures={
        <FigureTable
          columns={['Class', 'Cutoff Date', 'Fine Type']}
          rows={data.rules.map((r) => [
            r.standardLabel,
            r.lateDate,
            r.fineType ?? 'Standard',
          ])}
        />
      }
    >
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-[13px] border-b border-slate-100 pb-2">
          <span className="text-slate-600 font-medium">Overdue Past Configured Cutoff</span>
          <span className="font-bold text-slate-950 tabular-nums">{money(data.overdueAmountPastConfiguredDate)}</span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {data.rules.slice(0, 4).map((r, i) => (
            <div
              key={`${r.standardId}-${r.monthId}-${i}`}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-[12.5px]"
            >
              <div className="min-w-0 pr-2">
                <p className="font-semibold text-slate-900 truncate">{r.standardLabel}</p>
                <p className="text-[11px] text-slate-500">
                  Late cutoff: {r.lateDate} · Month {r.monthId}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                  {r.fineType ?? 'Standard rule'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

/* ---------------------------------------------------- other collections */

export function OtherCollectionsCard({ data }: { data?: FeesOtherCollections }) {
  if (!data || !data.available || data.receiptsCount === 0) return null;

  return (
    <ChartCard
      title="Auxiliary & Other Fee Collections"
      question="What revenue flows through non-tuition fee channels?"
      caption={`${money(data.totalAmount)} collected across ${count(data.receiptsCount)} auxiliary receipts.`}
      figures={
        <FigureTable
          columns={['Fee Head', 'Amount', 'Receipts']}
          rows={data.heads.map((h) => [`Head #${h.headId}`, moneyExact(h.amount), count(h.count)])}
        />
      }
    >
      <ul className="divide-y divide-slate-100">
        {data.heads.slice(0, 5).map((h, i) => (
          <li key={`${h.headId}-${i}`} className="py-2 flex items-center justify-between text-[12.5px]">
            <span className="font-medium text-slate-800">Head #{h.headId}</span>
            <div className="text-right">
              <span className="font-bold tabular-nums text-slate-950">{money(h.amount)}</span>
              <span className="ml-2 text-[11px] text-slate-500">({count(h.count)} txns)</span>
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}


