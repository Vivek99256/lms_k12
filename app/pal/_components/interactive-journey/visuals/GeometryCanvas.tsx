'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, Play, RotateCcw, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { GeometryCanvasParams, VisualComponentProps } from '../types';

/**
 * A rectangle drawn as a grid of unit squares, `height` rows of `width`
 * squares — area shown as squares counted, not stated as a formula first.
 * The full `height x width` outline is always visible (even before any row
 * is filled), the same way BarModel always shows its full 100-cell outline —
 * without it, an unstarted reveal has nothing on screen to suggest the
 * target shape's size. The legend beneath spells out shape -> dimensions ->
 * area relationship in one glance.
 *
 * GENERIC ON PURPOSE. Any area/perimeter concept can reuse this with
 * different width/height pairs; nothing here names a concept or a unit.
 */
export function GeometryCanvas({ params, mode, target, onComplete }: VisualComponentProps<'GeometryCanvas'>) {
  const { unit = '' } = params;

  if (mode === 'explore') return <ExploreCanvas initial={params} unit={unit} />;
  if (mode === 'summary') return <SummaryCanvas params={params} unit={unit} />;
  if (mode === 'guided') return <GuidedCanvas width={params.width} unit={unit} target={target ?? {}} onComplete={onComplete} />;
  return <PacedCanvas params={params} unit={unit} auto={mode === 'animate'} onComplete={onComplete} />;
}

/** Always renders `totalRows` row outlines, the first `filledRows` shaded — the shape's full size is visible from the very first frame. */
function Rows({ width, totalRows, filledRows, unit }: { width: number; totalRows: number; filledRows: number; unit: string }) {
  return (
    <div className="space-y-[3px]" aria-label={`${filledRows} of ${totalRows} rows of ${width} unit squares filled`}>
      {Array.from({ length: totalRows }, (_, r) => (
        <div key={r} className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}>
          {Array.from({ length: width }, (_, c) => (
            <span
              key={c}
              aria-hidden
              className={cn(
                'aspect-square rounded-[2px] transition-colors duration-300',
                r < filledRows ? 'bg-indigo-500' : 'bg-white ring-1 ring-inset ring-slate-200'
              )}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">{unit}</span>
    </div>
  );
}

function Frame({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2" style={{ maxWidth: `${Math.max(160, width * 32)}px` }}>
      {children}
    </div>
  );
}

/** shape -> dimensions -> area relationship, in one line. */
function RelationshipLegend({ width, height, unit }: { width: number; height: number; unit: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
      <LegendChip tone="slate">
        {width}
        {unit} wide
      </LegendChip>
      <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-300" />
      <LegendChip tone="indigo">
        {height}
        {unit} tall
      </LegendChip>
      <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-300" />
      <LegendChip tone="emerald">
        = {width * height}
        {unit}² covered
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

function PacedCanvas({
  params,
  unit,
  auto,
  onComplete,
}: {
  params: GeometryCanvasParams;
  unit: string;
  auto: boolean;
  onComplete?: () => void;
}) {
  const { width, height } = params;
  const [rows, setRows] = useState(0);
  const done = rows >= height;
  const area = width * rows;

  useEffect(() => {
    if (!auto || done) return;
    const timer = window.setInterval(() => setRows((n) => Math.min(height, n + 1)), 400);
    return () => window.clearInterval(timer);
  }, [auto, done, height]);

  useEffect(() => {
    if (done && rows > 0) onComplete?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
        {width}
        {unit} × {rows}
        {unit} = <span className={done ? 'text-indigo-600' : 'text-slate-400'}>{done ? `${area}${unit}²` : '?'}</span>
      </p>

      <div className="mt-3">
        <Frame width={width}>
          <Rows width={width} totalRows={height} filledRows={rows} unit={unit} />
        </Frame>
      </div>

      {done && <RelationshipLegend width={width} height={height} unit={unit} />}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{done ? 'All rows filled.' : `${rows} of ${height} rows filled so far.`}</p>
        <div className="flex gap-2">
          {rows > 0 && !auto && (
            <Button variant="outline" size="sm" onClick={() => setRows(0)}>
              <RotateCcw aria-hidden className="h-3.5 w-3.5" />
              Start over
            </Button>
          )}
          {!auto && (
            <Button size="sm" disabled={done} onClick={() => setRows((n) => Math.min(height, n + 1))}>
              {done ? 'Done' : 'Fill the next row'}
            </Button>
          )}
          {auto && done && (
            <Button variant="outline" size="sm" onClick={() => setRows(0)}>
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

function SummaryCanvas({ params, unit }: { params: GeometryCanvasParams; unit: string }) {
  const { width, height } = params;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
        {width}
        {unit} × {height}
        {unit} = <span className="text-indigo-600">{width * height}{unit}²</span>
      </p>
      <div className="mt-3">
        <Frame width={width}>
          <Rows width={width} totalRows={height} filledRows={height} unit={unit} />
        </Frame>
      </div>
      <RelationshipLegend width={width} height={height} unit={unit} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// explore
// ---------------------------------------------------------------------------

function ExploreCanvas({ initial, unit }: { initial: GeometryCanvasParams; unit: string }) {
  const [width, setWidth] = useState(initial.width);
  const [height, setHeight] = useState(initial.height);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
        {width}
        {unit} × {height}
        {unit} = <span className="text-indigo-600">{width * height}{unit}²</span>
      </p>

      <div className="mt-3">
        <Frame width={width}>
          <Rows width={width} totalRows={height} filledRows={height} unit={unit} />
        </Frame>
      </div>

      <RelationshipLegend width={width} height={height} unit={unit} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Width</span>
          <input
            type="range"
            min={1}
            max={12}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="mt-1.5 w-full accent-indigo-600"
            aria-label="Width"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Height</span>
          <input
            type="range"
            min={1}
            max={12}
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            className="mt-1.5 w-full accent-indigo-600"
            aria-label="Height"
          />
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// guided
// ---------------------------------------------------------------------------

function GuidedCanvas({
  width,
  unit,
  target,
  onComplete,
}: {
  width: number;
  unit: string;
  target: Partial<GeometryCanvasParams>;
  onComplete?: () => void;
}) {
  const [height, setHeight] = useState(1);
  const [checked, setChecked] = useState(false);
  const targetHeight = target.height ?? 1;
  const correct = height === targetHeight;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
        {width}
        {unit} × {height}
        {unit} = <span className="text-indigo-600">{width * height}{unit}²</span>
      </p>

      <div className="mt-3">
        <Frame width={width}>
          <Rows width={width} totalRows={height} filledRows={height} unit={unit} />
        </Frame>
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-medium text-slate-500">Set the height to match what's asked above</span>
        <input
          type="range"
          min={1}
          max={12}
          value={height}
          onChange={(e) => {
            setHeight(Number(e.target.value));
            setChecked(false);
          }}
          className="mt-1.5 w-full accent-indigo-600"
          aria-label="Your height"
        />
      </label>

      <div className="mt-4 flex items-center justify-between gap-3">
        {checked && (
          <p className={cn('flex items-center gap-1.5 text-sm font-medium', correct ? 'text-emerald-700' : 'text-amber-700')}>
            {correct ? <CheckCircle2 aria-hidden className="h-4 w-4" /> : <XCircle aria-hidden className="h-4 w-4" />}
            {correct ? 'That matches.' : `Not quite — aim for ${targetHeight}${unit}.`}
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
