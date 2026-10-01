'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, Play, RotateCcw, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { FractionBarParams, VisualComponentProps } from '../types';

/**
 * A single bar split into `denominator` equal segments, `numerator` of them
 * shaded — one continuous whole cut into parts, not a row of separate tiles,
 * so "equal parts of the same whole" reads at a glance. The legend beneath
 * spells out whole -> equal parts -> selected parts -> numerator/denominator.
 *
 * GENERIC ON PURPOSE. Any fraction concept (comparing, equivalent forms,
 * combining parts) can reuse this by supplying different numerator/
 * denominator pairs; nothing here names a concept.
 */
export function FractionBar({ params, mode, target, onComplete }: VisualComponentProps<'FractionBar'>) {
  if (mode === 'explore') return <ExploreFractionBar initial={params} />;
  if (mode === 'summary') return <SummaryFractionBar params={params} />;
  if (mode === 'guided') return <GuidedFractionBar denominator={params.denominator} target={target ?? {}} onComplete={onComplete} />;
  return <PacedFractionBar params={params} auto={mode === 'animate'} onComplete={onComplete} />;
}

/** One continuous whole, divided into `denominator` equal parts by hairline dividers — never separate floating tiles. */
function Bar({ denominator, filled, tone = 'indigo' }: { denominator: number; filled: number; tone?: 'indigo' | 'slate' }) {
  const segments = Array.from({ length: denominator }, (_, i) => i);
  return (
    <div className="flex h-10 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {segments.map((i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            'flex-1 border-r border-slate-200 transition-colors duration-300 last:border-r-0',
            i < filled ? (tone === 'indigo' ? 'bg-indigo-500' : 'bg-slate-500') : 'bg-white'
          )}
        />
      ))}
    </div>
  );
}

/** whole -> equal parts -> selected parts -> numerator/denominator, in one line. */
function RelationshipLegend({ numerator, denominator }: { numerator: number; denominator: number }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
      <LegendChip tone="slate">1 whole cut into {denominator} equal parts</LegendChip>
      <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-300" />
      <LegendChip tone="indigo">{numerator} parts shaded</LegendChip>
      <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-300" />
      <LegendChip tone="emerald">
        {numerator}/{denominator}
      </LegendChip>
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

function PacedFractionBar({
  params,
  auto,
  onComplete,
}: {
  params: FractionBarParams;
  auto: boolean;
  onComplete?: () => void;
}) {
  const { numerator, denominator, compareNumerator, compareDenominator } = params;
  const [filled, setFilled] = useState(0);
  const done = filled >= numerator;

  useEffect(() => {
    if (!auto || done) return;
    const timer = window.setInterval(() => setFilled((n) => Math.min(numerator, n + 1)), 350);
    return () => window.clearInterval(timer);
  }, [auto, done, numerator]);

  useEffect(() => {
    if (done && filled > 0) onComplete?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const hasCompare = compareNumerator != null && compareDenominator != null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
      <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
        {filled}/{denominator}
        {!done && ' …'}
      </p>
      <Bar denominator={denominator} filled={filled} />

      {/* The comparison only appears once the primary bar is fully shaded —
          showing its label ahead of its own fill would read as a mismatch
          (a fraction named but not yet drawn). */}
      {hasCompare && done && (
        <>
          <p className="pt-1 font-mono text-sm text-slate-500">
            {compareNumerator}/{compareDenominator}
          </p>
          <Bar denominator={compareDenominator as number} filled={compareNumerator as number} tone="slate" />
        </>
      )}

      {done && <RelationshipLegend numerator={numerator} denominator={denominator} />}

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-slate-500">{done ? 'All parts shaded.' : `${filled} of ${numerator} parts shaded so far.`}</p>
        <div className="flex gap-2">
          {filled > 0 && !auto && (
            <Button variant="outline" size="sm" onClick={() => setFilled(0)}>
              <RotateCcw aria-hidden className="h-3.5 w-3.5" />
              Start over
            </Button>
          )}
          {!auto && (
            <Button size="sm" disabled={done} onClick={() => setFilled((n) => Math.min(numerator, n + 1))}>
              {done ? 'Done' : 'Shade one more part'}
            </Button>
          )}
          {auto && done && (
            <Button variant="outline" size="sm" onClick={() => setFilled(0)}>
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

function SummaryFractionBar({ params }: { params: FractionBarParams }) {
  const { numerator, denominator, compareNumerator, compareDenominator } = params;
  const hasCompare = compareNumerator != null && compareDenominator != null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
      <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
        {numerator}/{denominator}
      </p>
      <Bar denominator={denominator} filled={numerator} />

      {hasCompare && (
        <>
          <p className="pt-1 font-mono text-sm text-slate-500">
            {compareNumerator}/{compareDenominator}
          </p>
          <Bar denominator={compareDenominator as number} filled={compareNumerator as number} tone="slate" />
        </>
      )}

      <RelationshipLegend numerator={numerator} denominator={denominator} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// explore
// ---------------------------------------------------------------------------

function ExploreFractionBar({ initial }: { initial: FractionBarParams }) {
  const [numerator, setNumerator] = useState(initial.numerator);
  const denominator = initial.denominator;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
        {numerator}/{denominator}
      </p>
      <div className="mt-3">
        <Bar denominator={denominator} filled={numerator} />
      </div>
      <RelationshipLegend numerator={numerator} denominator={denominator} />
      <label className="mt-4 block">
        <span className="text-xs font-medium text-slate-500">Drag to change how many parts are shaded</span>
        <input
          type="range"
          min={0}
          max={denominator}
          value={numerator}
          onChange={(e) => setNumerator(Number(e.target.value))}
          className="mt-1.5 w-full accent-indigo-600"
          aria-label="Parts shaded"
        />
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// guided
// ---------------------------------------------------------------------------

function GuidedFractionBar({
  denominator,
  target,
  onComplete,
}: {
  denominator: number;
  target: Partial<FractionBarParams>;
  onComplete?: () => void;
}) {
  const [numerator, setNumerator] = useState(0);
  const [checked, setChecked] = useState(false);
  const targetNumerator = target.numerator ?? 0;
  const correct = numerator === targetNumerator;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
        {numerator}/{denominator}
      </p>
      <div className="mt-3">
        <Bar denominator={denominator} filled={numerator} />
      </div>
      <label className="mt-4 block">
        <span className="text-xs font-medium text-slate-500">Set the slider to match what's asked above</span>
        <input
          type="range"
          min={0}
          max={denominator}
          value={numerator}
          onChange={(e) => {
            setNumerator(Number(e.target.value));
            setChecked(false);
          }}
          className="mt-1.5 w-full accent-indigo-600"
          aria-label="Your numerator"
        />
      </label>
      <div className="mt-4 flex items-center justify-between gap-3">
        {checked && (
          <p className={cn('flex items-center gap-1.5 text-sm font-medium', correct ? 'text-emerald-700' : 'text-amber-700')}>
            {correct ? <CheckCircle2 aria-hidden className="h-4 w-4" /> : <XCircle aria-hidden className="h-4 w-4" />}
            {correct ? 'That matches.' : `Not quite — aim for ${targetNumerator}/${denominator}.`}
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
