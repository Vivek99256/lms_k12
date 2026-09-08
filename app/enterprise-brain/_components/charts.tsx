'use client';

import React from 'react';
import { Card } from './primitives';
import type { BrainPoint } from '@/lib/brain/api';

/**
 * The three chart forms the Brain actually needs, drawn as inline SVG/CSS.
 *
 * NO CHART LIBRARY, DELIBERATELY. Every series here is a labelled magnitude of
 * at most a couple of dozen points — a GROUP BY result. A charting dependency
 * would add a few hundred kilobytes to the LMS bundle to draw bars this file
 * draws in a div, and it would bring its own colour system that then has to be
 * fought back into the LMS palette.
 *
 * ONE COLOUR RAMP, ORDERED BY MAGNITUDE, so the same value reads the same way on
 * every screen. Severity is the exception: there the colour carries meaning, so
 * it is keyed to the level rather than to the rank.
 *
 * AN EMPTY SERIES SAYS SO. A chart with no data renders the reason rather than
 * an axis with nothing on it, because a blank plot is indistinguishable from a
 * broken one.
 */

const RAMP = ['bg-indigo-500', 'bg-indigo-400', 'bg-sky-400', 'bg-teal-400', 'bg-emerald-400', 'bg-amber-400'];

const SEVERITY_TONE: Record<string, string> = {
  critical: 'bg-rose-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-400',
  low: 'bg-slate-300',
};

function toneFor(label: string, index: number, bySeverity: boolean) {
  if (bySeverity) return SEVERITY_TONE[label.toLowerCase()] ?? 'bg-slate-300';
  return RAMP[index % RAMP.length];
}

export function ChartCard({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-5 ${className}`}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{title}</p>
      {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export function EmptySeries({ reason = 'No rows in this organization yet.' }: { reason?: string }) {
  return <p className="py-6 text-sm text-slate-400">{reason}</p>;
}

/** Horizontal bars — the default for a categorical GROUP BY. */
export function BarSeries({
  data,
  bySeverity = false,
  unit,
  max = 12,
}: {
  data: BrainPoint[];
  bySeverity?: boolean;
  unit?: string;
  max?: number;
}) {
  if (!data?.length) return <EmptySeries />;

  const rows = data.slice(0, max);
  const peak = Math.max(...rows.map((row) => Number(row.value) || 0), 1);

  return (
    <div className="space-y-2.5">
      {rows.map((row, index) => {
        const value = Number(row.value) || 0;
        return (
          <div key={`${row.label}-${index}`}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-xs font-medium text-slate-600" title={row.label}>
                {row.label}
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-900">
                {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                {unit ? <span className="ml-0.5 font-normal text-slate-400">{unit}</span> : null}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${toneFor(row.label, index, bySeverity)}`}
                // Width is the share of the largest bar, so a two-row series
                // still fills the card rather than rendering two slivers.
                style={{ width: `${Math.max((value / peak) * 100, value > 0 ? 3 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * A completeness readout: each row against a stated total.
 *
 * The last entry of the series is treated as the denominator, which is how
 * LmsAnalytics builds these — "Has an accountable head: 2 … Total departments:
 * 609". Showing those four numbers as four independent bars would hide the only
 * thing that matters, which is 2 out of 609.
 */
export function CompletenessSeries({ data }: { data: BrainPoint[] }) {
  if (!data?.length) return <EmptySeries />;

  const total = Number(data[data.length - 1]?.value) || 0;
  const rows = data.slice(0, -1);

  if (!total || !rows.length) return <BarSeries data={data} />;

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const value = Number(row.value) || 0;
        const pct = total > 0 ? (value / total) * 100 : 0;
        const tone = pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-rose-400';

        return (
          <div key={row.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-xs font-medium text-slate-600">{row.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-slate-500">
                <span className="font-semibold text-slate-900">{value.toLocaleString()}</span>
                <span className="text-slate-400"> / {total.toLocaleString()}</span>
                <span className="ml-1.5 font-semibold text-slate-700">{pct.toFixed(1)}%</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(pct, value > 0 ? 2 : 0)}%` }} />
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-[11px] text-slate-400">{data[data.length - 1].label}: {total.toLocaleString()}</p>
    </div>
  );
}

/** A time series — columns in chronological order, with the axis labelled at both ends. */
export function TrendSeries({ data, valueLabel = '' }: { data: BrainPoint[]; valueLabel?: string }) {
  if (!data?.length) return <EmptySeries />;

  const peak = Math.max(...data.map((row) => Number(row.value) || 0), 1);

  return (
    <div>
      <div className="flex h-32 items-end gap-1">
        {data.map((row) => {
          const value = Number(row.value) || 0;
          const rate = row.attendanceRate as number | undefined;
          return (
            <div key={row.label} className="group relative flex flex-1 flex-col justify-end" title={`${row.label}: ${value.toLocaleString()}${valueLabel}`}>
              <div
                className="w-full rounded-t bg-indigo-400 transition-colors group-hover:bg-indigo-600"
                style={{ height: `${Math.max((value / peak) * 100, value > 0 ? 2 : 0)}%` }}
              />
              {rate !== undefined && (
                <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold tabular-nums text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
                  {rate}%
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-400">
        <span>{data[0]?.label}</span>
        <span className="tabular-nums">peak {peak.toLocaleString()}{valueLabel}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/**
 * The loop, drawn as the pipeline it is.
 *
 * A stage showing 0 is not hidden: the whole value of this strip is seeing where
 * the loop stops. An institute with 21 signals and 0 decisions has a queue
 * waiting on a person, and that is the most actionable thing on the screen.
 */
export function LoopStrip({ stages }: { stages: Array<{ key: string; label: string; count: number; available: boolean }> }) {
  const peak = Math.max(...stages.map((stage) => stage.count), 1);

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
      {stages.map((stage, index) => {
        const stalled = stage.count === 0 && index > 0 && stages[index - 1].count > 0;
        return (
          <div
            key={stage.key}
            className={`rounded-xl border p-3 ${
              stalled ? 'border-amber-300 bg-amber-50/60' : 'border-gray-200 bg-white'
            }`}
          >
            <p className="truncate text-[10px] font-bold uppercase tracking-widest text-gray-400" title={stage.label}>
              {stage.label}
            </p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${stage.available ? 'text-slate-900' : 'text-slate-300'}`}>
              {stage.available ? stage.count.toLocaleString() : '—'}
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${stalled ? 'bg-amber-400' : 'bg-indigo-400'}`}
                style={{ width: `${Math.max((stage.count / peak) * 100, stage.count > 0 ? 4 : 0)}%` }}
              />
            </div>
            {stalled && <p className="mt-1.5 text-[10px] font-semibold text-amber-700">waiting</p>}
          </div>
        );
      })}
    </div>
  );
}

export function SeverityPill({ severity }: { severity: string }) {
  const tone =
    {
      critical: 'bg-rose-50 text-rose-700 ring-rose-200',
      high: 'bg-orange-50 text-orange-700 ring-orange-200',
      medium: 'bg-amber-50 text-amber-700 ring-amber-200',
      low: 'bg-slate-50 text-slate-600 ring-slate-200',
    }[severity?.toLowerCase()] ?? 'bg-slate-50 text-slate-600 ring-slate-200';

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${tone}`}>
      {severity || 'unknown'}
    </span>
  );
}

/** Confidence, shown as a number AND a bar so a 0.45 is not read as a 45% chance. */
export function ConfidenceMeter({ value }: { value: number | string }) {
  const pct = Math.round((Number(value) || 0) * 100);
  const tone = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-sky-500' : pct >= 45 ? 'bg-amber-400' : 'bg-slate-300';

  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-xs font-semibold tabular-nums text-slate-600">{(Number(value) || 0).toFixed(2)}</span>
    </span>
  );
}
