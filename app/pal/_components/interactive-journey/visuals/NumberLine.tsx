'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, Play, RotateCcw, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { NumberLineParams, VisualComponentProps } from '../types';

/**
 * A marker moving on a number line from `start` by `change`, landing on the
 * result — the universal fallback visual (see classify.ts): any concept
 * that isn't a fraction/percentage/area relationship still gets a real,
 * generic number-sense visual instead of a mismatched one.
 *
 * GENERIC ON PURPOSE. `start`/`change`/`unit` are just numbers; nothing here
 * names a concept. Works for signed integer movement, decimal positioning,
 * or a plain step change.
 */
export function NumberLine({ params, mode, target, onComplete }: VisualComponentProps<'NumberLine'>) {
  const { unit = '' } = params;
  const fmt = (value: number) => `${value}${unit}`;

  if (mode === 'explore') return <ExploreNumberLine start={params.start} unit={unit} fmt={fmt} initial={params.change} />;
  if (mode === 'summary') return <SummaryNumberLine start={params.start} change={params.change} unit={unit} fmt={fmt} />;
  if (mode === 'guided') return <GuidedNumberLine start={params.start} unit={unit} fmt={fmt} target={target ?? {}} onComplete={onComplete} />;
  return <PacedNumberLine start={params.start} change={params.change} unit={unit} fmt={fmt} auto={mode === 'animate'} onComplete={onComplete} />;
}

function Track({ start, end, current, domainPad = 2 }: { start: number; end: number; current: number; domainPad?: number }) {
  const domainMin = Math.min(start, end, current) - domainPad;
  const domainMax = Math.max(start, end, current) + domainPad;
  const span = domainMax - domainMin || 1;
  const percentOf = (value: number) => ((value - domainMin) / span) * 100;
  const negative = end < start;

  return (
    <div className="relative mt-6 h-14">
      <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200" />

      {/* start marker */}
      <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${percentOf(start)}%` }}>
        <span className="block h-2.5 w-2.5 rounded-full border-2 border-slate-400 bg-white" />
        <span className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-slate-400">start</span>
      </div>

      {/* end marker (only drawn once distinct from start) */}
      {end !== start && (
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${percentOf(end)}%` }}>
          <span className={cn('block h-2.5 w-2.5 rounded-full border-2', negative ? 'border-rose-400 bg-white' : 'border-indigo-400 bg-white')} />
        </div>
      )}

      {/* the moving marker, riding the current value */}
      <div
        aria-hidden
        className="absolute top-1/2 -translate-x-1/2 -translate-y-[calc(100%+0.6rem)] transition-all duration-500 ease-out"
        style={{ left: `${percentOf(current)}%` }}
      >
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm', negative ? 'bg-rose-600' : 'bg-indigo-600')}>
          {current}
        </span>
      </div>
    </div>
  );
}

function RelationshipLegend({ start, change, unit, fmt }: { start: number; change: number; unit: string; fmt: (v: number) => string }) {
  const result = start + change;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
      <LegendChip tone="slate">start at {fmt(start)}</LegendChip>
      <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-300" />
      <LegendChip tone="indigo">
        {change >= 0 ? '+' : ''}
        {change}
        {unit}
      </LegendChip>
      <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-300" />
      <LegendChip tone="emerald">{fmt(result)}</LegendChip>
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
// reveal / animate
// ---------------------------------------------------------------------------

function PacedNumberLine({
  start,
  change,
  unit,
  fmt,
  auto,
  onComplete,
}: {
  start: number;
  change: number;
  unit: string;
  fmt: (value: number) => string;
  auto: boolean;
  onComplete?: () => void;
}) {
  const steps = 8;
  const [progress, setProgress] = useState(0);
  const done = progress >= steps;
  const current = Math.round((start + (change * progress) / steps) * 100) / 100;

  useEffect(() => {
    if (!auto || done) return;
    const timer = window.setInterval(() => setProgress((n) => Math.min(steps, n + 1)), 150);
    return () => window.clearInterval(timer);
  }, [auto, done]);

  useEffect(() => {
    if (done && progress > 0) onComplete?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
        {fmt(start)} {change >= 0 ? '+' : '-'} {Math.abs(change)}
        {unit} = <span className={done ? 'text-indigo-600' : 'text-slate-400'}>{done ? fmt(start + change) : '?'}</span>
      </p>

      <Track start={start} end={start + change} current={current} />

      {done && <RelationshipLegend start={start} change={change} unit={unit} fmt={fmt} />}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{done ? 'Reached the result.' : 'Move toward the result.'}</p>
        <div className="flex gap-2">
          {progress > 0 && !auto && (
            <Button variant="outline" size="sm" onClick={() => setProgress(0)}>
              <RotateCcw aria-hidden className="h-3.5 w-3.5" />
              Start over
            </Button>
          )}
          {!auto && (
            <Button size="sm" disabled={done} onClick={() => setProgress((n) => Math.min(steps, n + 2))}>
              {done ? 'Done' : 'Move forward'}
            </Button>
          )}
          {auto && done && (
            <Button variant="outline" size="sm" onClick={() => setProgress(0)}>
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
// summary
// ---------------------------------------------------------------------------

function SummaryNumberLine({ start, change, unit, fmt }: { start: number; change: number; unit: string; fmt: (v: number) => string }) {
  const result = start + change;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
        {fmt(start)} {change >= 0 ? '+' : '-'} {Math.abs(change)}
        {unit} = <span className="text-indigo-600">{fmt(result)}</span>
      </p>
      <Track start={start} end={result} current={result} />
      <RelationshipLegend start={start} change={change} unit={unit} fmt={fmt} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// explore
// ---------------------------------------------------------------------------

function ExploreNumberLine({ start, unit, fmt, initial }: { start: number; unit: string; fmt: (v: number) => string; initial: number }) {
  const [change, setChange] = useState(initial);
  const result = start + change;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
        {fmt(start)} {change >= 0 ? '+' : '-'} {Math.abs(change)}
        {unit} = <span className="text-indigo-600">{fmt(result)}</span>
      </p>
      <Track start={start} end={result} current={result} />
      <RelationshipLegend start={start} change={change} unit={unit} fmt={fmt} />
      <label className="mt-4 block">
        <span className="text-xs font-medium text-slate-500">Drag to change the amount moved</span>
        <input
          type="range"
          min={-10}
          max={10}
          value={change}
          onChange={(e) => setChange(Number(e.target.value))}
          className="mt-1.5 w-full accent-indigo-600"
          aria-label="Change"
        />
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// guided
// ---------------------------------------------------------------------------

function GuidedNumberLine({
  start,
  unit,
  fmt,
  target,
  onComplete,
}: {
  start: number;
  unit: string;
  fmt: (value: number) => string;
  target: Partial<NumberLineParams>;
  onComplete?: () => void;
}) {
  const [change, setChange] = useState(0);
  const [checked, setChecked] = useState(false);
  const targetChange = target.change ?? 0;
  const correct = change === targetChange;
  const result = start + change;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
        {fmt(start)} {change >= 0 ? '+' : '-'} {Math.abs(change)}
        {unit} = <span className="text-indigo-600">{fmt(result)}</span>
      </p>
      <Track start={start} end={result} current={result} />
      <label className="mt-4 block">
        <span className="text-xs font-medium text-slate-500">Set the slider to match what's asked above</span>
        <input
          type="range"
          min={-10}
          max={10}
          value={change}
          onChange={(e) => {
            setChange(Number(e.target.value));
            setChecked(false);
          }}
          className="mt-1.5 w-full accent-indigo-600"
          aria-label="Your change"
        />
      </label>
      <div className="mt-4 flex items-center justify-between gap-3">
        {checked && (
          <p className={cn('flex items-center gap-1.5 text-sm font-medium', correct ? 'text-emerald-700' : 'text-amber-700')}>
            {correct ? <CheckCircle2 aria-hidden className="h-4 w-4" /> : <XCircle aria-hidden className="h-4 w-4" />}
            {correct ? 'That matches.' : `Not quite — aim for ${targetChange >= 0 ? '+' : ''}${targetChange}${unit}.`}
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
