'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, Play, RotateCcw, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { BarModelParams, VisualComponentProps } from '../types';

/**
 * A 100-grid: the whole split into 100 equal cells, `percent` of them
 * highlighted — "percent means out of 100", shown rather than stated. The
 * legend beneath spells out 100% -> whole -> selected percentage ->
 * relationship in one glance, so the number line above it is never the only
 * way to read the relationship.
 *
 * GENERIC ON PURPOSE. Nothing here names a concept or a currency; `whole` and
 * `percent` are just numbers, and `unit` is whatever prefix the recipe hands
 * it (e.g. '₹'). Any "X% of Y" concept can reuse this unchanged.
 */
export function BarModel({ params, mode, target, onComplete }: VisualComponentProps<'BarModel'>) {
  const { whole, unit = '' } = params;
  const fmt = (value: number) => `${unit}${Math.round(value * 100) / 100}`;

  if (mode === 'explore') return <ExploreBarModel whole={whole} unit={unit} fmt={fmt} initial={params.percent} />;
  if (mode === 'summary') return <SummaryBarModel whole={whole} percent={params.percent} unit={unit} fmt={fmt} />;
  if (mode === 'guided') return <GuidedBarModel whole={whole} unit={unit} fmt={fmt} target={target ?? {}} onComplete={onComplete} />;
  return <PacedBarModel whole={whole} percent={params.percent} unit={unit} fmt={fmt} auto={mode === 'animate'} onComplete={onComplete} />;
}

function Grid({ filledCells, unit }: { filledCells: number; unit: string }) {
  const cells = Array.from({ length: 100 }, (_, i) => i);
  return (
    <div
      role="img"
      aria-label={`${filledCells} of 100 parts highlighted`}
      className="grid grid-cols-10 gap-[3px] rounded-lg border border-slate-200 bg-slate-50 p-2"
    >
      {cells.map((i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            'aspect-square rounded-[2px] transition-colors duration-300',
            i < filledCells ? 'bg-indigo-500' : 'bg-white ring-1 ring-inset ring-slate-200'
          )}
        />
      ))}
      <span className="sr-only">{unit}</span>
    </div>
  );
}

/** 100% -> the whole -> the selected percentage -> the relationship, in one line. */
function RelationshipLegend({ whole, percent, unit, fmt }: { whole: number; percent: number; unit: string; fmt: (v: number) => string }) {
  const amount = whole * (percent / 100);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
      <LegendChip tone="slate">100 parts = the whole ({fmt(whole)})</LegendChip>
      <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-300" />
      <LegendChip tone="indigo">{percent} parts shaded = {percent}%</LegendChip>
      <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-300" />
      <LegendChip tone="emerald">{fmt(amount)}</LegendChip>
    </div>
  );
}

function LegendChip({ tone, children }: { tone: 'slate' | 'indigo' | 'emerald'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 font-medium',
        tone === 'slate' && 'bg-slate-100 text-slate-600',
        tone === 'indigo' && 'bg-indigo-50 text-indigo-700',
        tone === 'emerald' && 'bg-emerald-50 text-emerald-700'
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// reveal / animate — paced toward a fixed target percent
// ---------------------------------------------------------------------------

function PacedBarModel({
  whole,
  percent,
  unit,
  fmt,
  auto,
  onComplete,
}: {
  whole: number;
  percent: number;
  unit: string;
  fmt: (value: number) => string;
  auto: boolean;
  onComplete?: () => void;
}) {
  const [revealed, setRevealed] = useState(0);
  const done = revealed >= percent;

  useEffect(() => {
    if (!auto || done) return;
    const timer = window.setInterval(() => setRevealed((n) => Math.min(percent, n + 2)), 60);
    return () => window.clearInterval(timer);
  }, [auto, done, percent]);

  useEffect(() => {
    if (done && revealed > 0) onComplete?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const amount = whole * (revealed / 100);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
        {revealed}% of {fmt(whole)} ={' '}
        <span className={done ? 'text-indigo-600' : 'text-slate-400'}>{done ? fmt(amount) : '?'}</span>
      </p>

      <div className="mt-3">
        <Grid filledCells={revealed} unit={unit} />
      </div>

      {done && <RelationshipLegend whole={whole} percent={percent} unit={unit} fmt={fmt} />}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {done ? 'All parts highlighted.' : `${revealed} of ${percent}% shown so far.`}
        </p>
        <div className="flex gap-2">
          {revealed > 0 && !auto && (
            <Button variant="outline" size="sm" onClick={() => setRevealed(0)}>
              <RotateCcw aria-hidden className="h-3.5 w-3.5" />
              Start over
            </Button>
          )}
          {!auto && (
            <Button size="sm" disabled={done} onClick={() => setRevealed((n) => Math.min(percent, n + 10))}>
              {done ? 'Done' : 'Reveal 10% more'}
            </Button>
          )}
          {auto && done && (
            <Button variant="outline" size="sm" onClick={() => setRevealed(0)}>
              <Play aria-hidden className="h-3.5 w-3.5" />
              Play again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// summary — already resolved, for pairing with the Explain step's rule text
// ---------------------------------------------------------------------------

function SummaryBarModel({ whole, percent, unit, fmt }: { whole: number; percent: number; unit: string; fmt: (v: number) => string }) {
  const amount = whole * (percent / 100);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
        {percent}% of {fmt(whole)} = <span className="text-indigo-600">{fmt(amount)}</span>
      </p>
      <div className="mt-3">
        <Grid filledCells={percent} unit={unit} />
      </div>
      <RelationshipLegend whole={whole} percent={percent} unit={unit} fmt={fmt} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// explore — free manipulation, no fixed target
// ---------------------------------------------------------------------------

function ExploreBarModel({
  whole,
  unit,
  fmt,
  initial,
}: {
  whole: number;
  unit: string;
  fmt: (value: number) => string;
  initial: number;
}) {
  const [percent, setPercent] = useState(initial);
  const amount = useMemo(() => whole * (percent / 100), [whole, percent]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
        {percent}% of {fmt(whole)} = <span className="text-indigo-600">{fmt(amount)}</span>
      </p>

      <div className="mt-3">
        <Grid filledCells={percent} unit={unit} />
      </div>

      <RelationshipLegend whole={whole} percent={percent} unit={unit} fmt={fmt} />

      <label className="mt-4 block">
        <span className="text-xs font-medium text-slate-500">Drag to change the percentage</span>
        <input
          type="range"
          min={0}
          max={100}
          value={percent}
          onChange={(e) => setPercent(Number(e.target.value))}
          className="mt-1.5 w-full accent-indigo-600"
          aria-label="Percentage"
        />
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// guided — student sets the value, self-checked against a target
// ---------------------------------------------------------------------------

function GuidedBarModel({
  whole,
  unit,
  fmt,
  target,
  onComplete,
}: {
  whole: number;
  unit: string;
  fmt: (value: number) => string;
  target: Partial<BarModelParams>;
  onComplete?: () => void;
}) {
  const [percent, setPercent] = useState(0);
  const [checked, setChecked] = useState(false);
  const targetPercent = target.percent ?? 0;
  const correct = percent === targetPercent;
  const amount = whole * (percent / 100);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
        {percent}% of {fmt(whole)} = <span className="text-indigo-600">{fmt(amount)}</span>
      </p>

      <div className="mt-3">
        <Grid filledCells={percent} unit={unit} />
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-medium text-slate-500">Set the slider to match what's asked above</span>
        <input
          type="range"
          min={0}
          max={100}
          value={percent}
          onChange={(e) => {
            setPercent(Number(e.target.value));
            setChecked(false);
          }}
          className="mt-1.5 w-full accent-indigo-600"
          aria-label="Your percentage"
        />
      </label>

      <div className="mt-4 flex items-center justify-between gap-3">
        {checked && (
          <p className={cn('flex items-center gap-1.5 text-sm font-medium', correct ? 'text-emerald-700' : 'text-amber-700')}>
            {correct ? <CheckCircle2 aria-hidden className="h-4 w-4" /> : <XCircle aria-hidden className="h-4 w-4" />}
            {correct ? 'That matches.' : `Not quite — aim for ${targetPercent}%.`}
          </p>
        )}
        <Button
          size="sm"
          onClick={() => {
            setChecked(true);
            onComplete?.();
          }}
          className="ml-auto"
        >
          Check my answer
        </Button>
      </div>
    </div>
  );
}
