'use client';

import { useState } from 'react';

import type {
  FeesClass,
  FeesCycle,
  FeesHead,
  FeesPaymentMode,
} from '@/app/fees/intelligence/_lib/fees-intelligence-api';
import { money, moneyExact, percent, Surface } from '@/app/fees/intelligence/_components/fees-intelligence-primitives';

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
          columns={['Cycle', 'Billed', 'Collected', 'Rate']}
          rows={billed.map((cycle) => [
            cycle.label,
            moneyExact(cycle.demandAmount),
            moneyExact(cycle.collectedAmount),
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
          columns={['Class', 'Accounts', 'Billed', 'Collected', 'Outstanding', 'Rate']}
          rows={rows.map((row) => [
            row.label,
            String(row.accounts),
            moneyExact(row.demandAmount),
            moneyExact(row.collectedAmount),
            moneyExact(row.outstandingAmount),
            percent(row.collectionRate),
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
