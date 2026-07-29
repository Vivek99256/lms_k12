'use client';

import { useId, useState, type ReactNode } from 'react';

import type {
  CollectionVsTargetRow,
  HeadwiseRow,
  PaymentModeRow,
} from '@/app/fees/_lib/fees-dashboard-api';

/**
 * The three real Fees charts, driven by the aggregate endpoint's own payloads:
 *   collection_vs_target[]  → Collection vs target
 *   headwise[]              → Head-wise collected vs pending
 *   payment_mode_mix[]      → Payment mode mix
 *
 * Contract: next_lms_erp/docs/fees-api/fees-dashboard-contract.md §3
 *
 * Built as plain HTML marks rather than a chart library: these are track bars
 * and stacked bars, and hand-rolling them is the only way to hit the mark specs
 * exactly (24px cap, 4px rounded data-end, 2px surface gaps, hairline grid).
 *
 * Palette: categorical slots 1-8 validated against the white card surface —
 * lightness band, chroma floor, adjacent-pair CVD separation and normal-vision
 * floor all pass. Three light slots sit under 3:1 contrast, so the relief rule
 * applies: every chart ships visible labels, a legend, and a table twin.
 */

/* ---------------------------------------------------------------- formatting */

const inrFull = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const lakhNumber = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

/** Compact Indian display used on marks and axis ticks: ₹2,023.9L */
function lakh(amount: number): string {
  return `₹${lakhNumber.format(amount / 100000)}L`;
}

function inr(amount: number): string {
  return inrFull.format(amount);
}

function percent(part: number, whole: number): string {
  if (whole <= 0) return '0%';
  const value = (part / whole) * 100;
  return `${value >= 10 ? Math.round(value) : Number(value.toFixed(1))}%`;
}

/* ------------------------------------------------------------------ tooltip */

type TipState = { x: number; y: number; rows: ReactNode } | null;

function Tooltip({ tip }: { tip: TipState }) {
  if (!tip) return null;

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 max-w-[16rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
      style={{ left: tip.x + 14, top: tip.y + 14 }}
    >
      {tip.rows}
    </div>
  );
}

/** Value leads, label follows — the reader already has the series. */
function TipRow({ swatch, label, value }: { swatch?: string; label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      {swatch ? (
        <span
          aria-hidden="true"
          className="mt-[3px] h-[2px] w-3 shrink-0 rounded-full"
          style={{ backgroundColor: swatch }}
        />
      ) : null}
      <span className="font-semibold text-slate-900 tabular-nums">{value}</span>
      <span className="text-slate-500">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------- shells */

function ChartCard({
  title,
  caption,
  legend,
  children,
}: {
  title: string;
  caption: string;
  legend?: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure className="fees-viz rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <figcaption className="mb-1">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{caption}</p>
      </figcaption>
      {legend}
      <div className="mt-3">{children}</div>
    </figure>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-slate-600">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function EmptyPlot({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">
      {label}
    </p>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            {head.map((cell, index) => (
              <th
                key={cell}
                scope="col"
                className={`py-1.5 pr-3 font-medium ${index === 0 ? '' : 'text-right'}`}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[0])} className="border-b border-slate-100 last:border-0">
              {row.map((cell, index) => (
                <td
                  key={index}
                  className={`py-1.5 pr-3 ${
                    index === 0 ? 'text-slate-700' : 'text-right text-slate-900 tabular-nums'
                  }`}
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

/* ------------------------------------------- 1. Collection vs target (meter) */

/**
 * A ratio against a limit, per fee-month bucket — so this is a meter, not a
 * two-series comparison: the track is the target, the fill is what came in.
 * Track and fill share one scale (max target across buckets), so bucket size
 * and collection rate are both readable on a single axis.
 *
 * Bucket count is tenant-dependent (contract §3): a `yearly_fees` tenant
 * returns one row, monthly tenants up to twelve. Never assume 12.
 */
export function CollectionVsTargetChart({ rows }: { rows: CollectionVsTargetRow[] }) {
  const [tip, setTip] = useState<TipState>(null);
  const maxTarget = Math.max(...rows.map((row) => row.target_amount), 0);

  return (
    <ChartCard
      title="Collection vs target"
      caption="Received against demand for each fee-month bucket. Bar length is the target; the filled part is collected."
    >
      {rows.length === 0 ? (
        <EmptyPlot label="No fee-month buckets for this selection." />
      ) : (
        <>
          <ul className="space-y-3">
            {rows.map((row) => {
              const trackWidth = maxTarget > 0 ? (row.target_amount / maxTarget) * 100 : 0;
              const fillWidth = maxTarget > 0 ? (row.collected_amount / maxTarget) * 100 : 0;

              return (
                <li key={row.month_id}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                    <span className="font-medium text-slate-700">{row.month_label}</span>
                    <span className="text-slate-500">
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {lakh(row.collected_amount)}
                      </span>
                      {' of '}
                      <span className="tabular-nums">{lakh(row.target_amount)}</span>
                      {' · '}
                      <span className="tabular-nums">
                        {percent(row.collected_amount, row.target_amount)}
                      </span>
                    </span>
                  </div>

                  <div
                    tabIndex={0}
                    aria-label={`${row.month_label}: collected ${inr(row.collected_amount)} of target ${inr(row.target_amount)}, ${percent(row.collected_amount, row.target_amount)}`}
                    className="flex h-6 items-center rounded outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    onPointerMove={(event) =>
                      setTip({
                        x: event.clientX,
                        y: event.clientY,
                        rows: (
                          <>
                            <div className="mb-1 font-medium text-slate-700">{row.month_label}</div>
                            <TipRow
                              swatch="var(--viz-s1)"
                              label="collected"
                              value={inr(row.collected_amount)}
                            />
                            <TipRow
                              swatch="var(--viz-track)"
                              label="target"
                              value={inr(row.target_amount)}
                            />
                            <TipRow
                              label="collection rate"
                              value={percent(row.collected_amount, row.target_amount)}
                            />
                          </>
                        ),
                      })
                    }
                    onPointerLeave={() => setTip(null)}
                    onFocus={() => setTip(null)}
                    onBlur={() => setTip(null)}
                  >
                    {/* Track = target. Same ramp, lighter step — meter contract. */}
                    <div
                      className="relative h-6 rounded-r-[4px]"
                      style={{
                        width: `${trackWidth}%`,
                        minWidth: 2,
                        backgroundColor: 'var(--viz-track)',
                      }}
                    >
                      {/* Fill = collected. Square at the baseline, 4px at the data end. */}
                      <div
                        className="absolute inset-y-0 left-0 rounded-r-[4px]"
                        style={{
                          width: maxTarget > 0 ? `${(fillWidth / trackWidth) * 100}%` : '0%',
                          backgroundColor: 'var(--viz-s1)',
                        }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Tooltip tip={tip} />
        </>
      )}
    </ChartCard>
  );
}

function collectionVsTargetTable(rows: CollectionVsTargetRow[]) {
  return {
    head: ['Fee month', 'Target', 'Collected', 'Rate'],
    rows: rows.map((row) => [
      row.month_label,
      inr(row.target_amount),
      inr(row.collected_amount),
      percent(row.collected_amount, row.target_amount),
    ]),
  };
}

/* ------------------------------------ 2. Head-wise collected vs pending */

/**
 * Part-to-whole per fee head: collected + pending = that head's target, so a
 * stacked bar. Bars share one scale (max target), which keeps head sizes
 * comparable as well as their split.
 *
 * Head display names are per tenant per year (contract §1) — they come from the
 * response, never hardcoded. Collected is often a sliver next to pending; that
 * is the real story, so it is not exaggerated. The legend, tooltip and table
 * carry the exact values.
 */
export function HeadwiseChart({ rows }: { rows: HeadwiseRow[] }) {
  const [tip, setTip] = useState<TipState>(null);
  const maxTarget = Math.max(...rows.map((row) => row.target_amount), 0);

  return (
    <ChartCard
      title="Head-wise collected vs pending"
      caption="Each fee head's demand, split into what has been collected and what is still pending."
      legend={
        <Legend
          items={[
            { label: 'Collected', color: 'var(--viz-s1)' },
            { label: 'Pending', color: 'var(--viz-s2)' },
          ]}
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyPlot label="No fee heads for this selection." />
      ) : (
        <>
          <ul className="space-y-3">
            {rows.map((row) => {
              const width = maxTarget > 0 ? (row.target_amount / maxTarget) * 100 : 0;

              const showTip = (event: { clientX: number; clientY: number }) =>
                setTip({
                  x: event.clientX,
                  y: event.clientY,
                  rows: (
                    <>
                      <div className="mb-1 font-medium text-slate-700">{row.display_name}</div>
                      <TipRow
                        swatch="var(--viz-s1)"
                        label="collected"
                        value={inr(row.collected_amount)}
                      />
                      <TipRow
                        swatch="var(--viz-s2)"
                        label="pending"
                        value={inr(row.pending_amount)}
                      />
                      <TipRow label="target" value={inr(row.target_amount)} />
                    </>
                  ),
                });

              return (
                <li key={row.fee_title}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                    <span className="font-medium text-slate-700">{row.display_name}</span>
                    <span className="tabular-nums text-slate-500">{lakh(row.target_amount)}</span>
                  </div>

                  <div
                    tabIndex={0}
                    aria-label={`${row.display_name}: collected ${inr(row.collected_amount)}, pending ${inr(row.pending_amount)}, target ${inr(row.target_amount)}`}
                    className="flex h-6 items-center rounded outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    onPointerMove={showTip}
                    onPointerLeave={() => setTip(null)}
                    onBlur={() => setTip(null)}
                  >
                    {/* 2px surface gap does the separating — never a border. */}
                    <div
                      className="flex h-6 gap-[2px] overflow-hidden rounded-r-[4px]"
                      style={{ width: `${width}%`, minWidth: 2 }}
                    >
                      {row.collected_amount > 0 ? (
                        <div
                          style={{
                            flexGrow: row.collected_amount,
                            flexBasis: 0,
                            backgroundColor: 'var(--viz-s1)',
                          }}
                        />
                      ) : null}
                      {row.pending_amount > 0 ? (
                        <div
                          style={{
                            flexGrow: row.pending_amount,
                            flexBasis: 0,
                            backgroundColor: 'var(--viz-s2)',
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Tooltip tip={tip} />
        </>
      )}
    </ChartCard>
  );
}

function headwiseTable(rows: HeadwiseRow[]) {
  return {
    head: ['Fee head', 'Target', 'Collected', 'Pending'],
    rows: rows.map((row) => [
      row.display_name,
      inr(row.target_amount),
      inr(row.collected_amount),
      inr(row.pending_amount),
    ]),
  };
}

/* ------------------------------------------------- 3. Payment mode mix */

/** Categorical slots, fixed order — a mode keeps its hue when the set changes. */
const MODE_COLORS = [
  'var(--viz-s1)',
  'var(--viz-s2)',
  'var(--viz-s3)',
  'var(--viz-s4)',
  'var(--viz-s5)',
  'var(--viz-s6)',
  'var(--viz-s7)',
  'var(--viz-s8)',
];

/**
 * Payment modes are free-text and tenant-dependent (contract §3), so the legend
 * is driven off the response, never an enum. Past the 8-slot ceiling the tail
 * folds into "Other" — hues are never generated or cycled.
 */
function foldModes(rows: PaymentModeRow[]): PaymentModeRow[] {
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  if (sorted.length <= MODE_COLORS.length) return sorted;

  const head = sorted.slice(0, MODE_COLORS.length - 1);
  const tail = sorted.slice(MODE_COLORS.length - 1);

  return [
    ...head,
    {
      payment_mode: 'Other',
      receipts: tail.reduce((sum, row) => sum + row.receipts, 0),
      amount: tail.reduce((sum, row) => sum + row.amount, 0),
    },
  ];
}

export function PaymentModeMixChart({ rows }: { rows: PaymentModeRow[] }) {
  const [tip, setTip] = useState<TipState>(null);
  const modes = foldModes(rows);
  const total = modes.reduce((sum, row) => sum + row.amount, 0);

  return (
    <ChartCard
      title="Payment mode mix"
      caption="Share of collected value by payment mode."
      legend={
        modes.length > 1 ? (
          <Legend
            items={modes.map((row, index) => ({
              label: row.payment_mode,
              color: MODE_COLORS[index],
            }))}
          />
        ) : undefined
      }
    >
      {modes.length === 0 || total <= 0 ? (
        <EmptyPlot label="No receipts for this selection." />
      ) : (
        <>
          <div
            className="flex h-6 gap-[2px] overflow-hidden rounded-r-[4px]"
            onPointerLeave={() => setTip(null)}
          >
            {modes.map((row, index) => (
              <div
                key={row.payment_mode}
                tabIndex={0}
                aria-label={`${row.payment_mode}: ${inr(row.amount)} across ${row.receipts} receipts, ${percent(row.amount, total)} of collection`}
                className="outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                style={{
                  flexGrow: row.amount,
                  flexBasis: 0,
                  backgroundColor: MODE_COLORS[index],
                }}
                onPointerMove={(event) =>
                  setTip({
                    x: event.clientX,
                    y: event.clientY,
                    rows: (
                      <>
                        <div className="mb-1 font-medium text-slate-700">{row.payment_mode}</div>
                        <TipRow
                          swatch={MODE_COLORS[index]}
                          label="collected"
                          value={inr(row.amount)}
                        />
                        <TipRow label="of collection" value={percent(row.amount, total)} />
                        <TipRow
                          label={row.receipts === 1 ? 'receipt' : 'receipts'}
                          value={String(row.receipts)}
                        />
                      </>
                    ),
                  })
                }
                onBlur={() => setTip(null)}
              />
            ))}
          </div>

          {/* Contrast relief: every slot's value stays visible without hovering. */}
          <ul className="mt-3 space-y-1">
            {modes.map((row, index) => (
              <li
                key={row.payment_mode}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: MODE_COLORS[index] }}
                  />
                  {row.payment_mode}
                </span>
                <span className="text-slate-500">
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {inr(row.amount)}
                  </span>
                  {' · '}
                  <span className="tabular-nums">{percent(row.amount, total)}</span>
                </span>
              </li>
            ))}
          </ul>
          <Tooltip tip={tip} />
        </>
      )}
    </ChartCard>
  );
}

function paymentModeTable(rows: PaymentModeRow[]) {
  const modes = foldModes(rows);
  const total = modes.reduce((sum, row) => sum + row.amount, 0);

  return {
    head: ['Payment mode', 'Receipts', 'Amount', 'Share'],
    rows: modes.map((row) => [
      row.payment_mode,
      row.receipts,
      inr(row.amount),
      percent(row.amount, total),
    ]),
  };
}

/* ------------------------------------------------------------ the section */

export function FeesCharts({
  collectionVsTarget,
  headwise,
  paymentModeMix,
  stale = false,
}: {
  collectionVsTarget: CollectionVsTargetRow[];
  headwise: HeadwiseRow[];
  paymentModeMix: PaymentModeRow[];
  /** Refetching — hold the previous render at reduced opacity, never a skeleton. */
  stale?: boolean;
}) {
  const [showTable, setShowTable] = useState(false);
  const panelId = useId();

  const collectionTable = collectionVsTargetTable(collectionVsTarget);
  const headTable = headwiseTable(headwise);
  const modeTable = paymentModeTable(paymentModeMix);

  return (
    <section className="fees-viz space-y-3">
      {/* Series tokens live in one place so a theme swap is a single edit. */}
      <style>{`
        .fees-viz {
          --viz-s1: #2a78d6;
          --viz-s2: #eb6834;
          --viz-s3: #1baf7a;
          --viz-s4: #eda100;
          --viz-s5: #e87ba4;
          --viz-s6: #008300;
          --viz-s7: #4a3aa7;
          --viz-s8: #e34948;
          --viz-track: #cde2fb;
        }
        .dark .fees-viz {
          --viz-s1: #3987e5;
          --viz-s2: #d95926;
          --viz-s3: #199e70;
          --viz-s4: #c98500;
          --viz-s5: #d55181;
          --viz-s6: #008300;
          --viz-s7: #9085e9;
          --viz-s8: #e66767;
          --viz-track: #184f95;
        }
      `}</style>

      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold text-slate-900">Collection breakdown</h2>
        <button
          type="button"
          aria-pressed={showTable}
          aria-controls={panelId}
          onClick={() => setShowTable((value) => !value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
        >
          {showTable ? 'Show charts' : 'Show table'}
        </button>
      </div>

      <div
        id={panelId}
        className={`grid grid-cols-1 gap-4 transition-opacity xl:grid-cols-3 ${
          stale ? 'opacity-60' : 'opacity-100'
        }`}
      >
        {showTable ? (
          <>
            <ChartCard
              title="Collection vs target"
              caption="Received against demand for each fee-month bucket."
            >
              <DataTable head={collectionTable.head} rows={collectionTable.rows} />
            </ChartCard>
            <ChartCard
              title="Head-wise collected vs pending"
              caption="Each fee head's demand, collected and pending."
            >
              <DataTable head={headTable.head} rows={headTable.rows} />
            </ChartCard>
            <ChartCard title="Payment mode mix" caption="Share of collected value by payment mode.">
              <DataTable head={modeTable.head} rows={modeTable.rows} />
            </ChartCard>
          </>
        ) : (
          <>
            <CollectionVsTargetChart rows={collectionVsTarget} />
            <HeadwiseChart rows={headwise} />
            <PaymentModeMixChart rows={paymentModeMix} />
          </>
        )}
      </div>
    </section>
  );
}
