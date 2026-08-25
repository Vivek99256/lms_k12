'use client';

import { ArrowDown, ArrowRight, ArrowUp, CircleHelp, Clock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OutcomeRecord, OutcomeStatus } from '@/lib/intelligence/types';

const STATUS_META: Record<
  OutcomeStatus,
  { label: string; icon: typeof ArrowUp; tone: string }
> = {
  pending: { label: 'Not yet measured', icon: Clock, tone: 'text-muted-foreground' },
  measuring: { label: 'Measuring', icon: Clock, tone: 'text-muted-foreground' },
  improved: { label: 'Improved', icon: ArrowUp, tone: 'text-emerald-700' },
  unchanged: { label: 'No change', icon: ArrowRight, tone: 'text-muted-foreground' },
  worsened: { label: 'Worsened', icon: ArrowDown, tone: 'text-destructive' },
  inconclusive: { label: 'Inconclusive', icon: CircleHelp, tone: 'text-muted-foreground' },
};

function formatValue(value: number | null) {
  return value === null ? '—' : Number(value).toFixed(1);
}

function formatDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Did it work?
 *
 * The last layer of the architecture, and the one that makes the rest worth
 * building: a baseline captured when the intervention started, an observation taken
 * after the agreed horizon, and an honest verdict.
 *
 * "Inconclusive" is shown as a first-class result rather than hidden. An outcome with
 * no baseline genuinely cannot be scored, and presenting it as anything else would
 * teach the wrong lesson to whoever reads the effectiveness numbers later.
 */
export function OutcomeTimeline({
  outcomes,
  className,
}: {
  outcomes: OutcomeRecord[];
  className?: string;
}) {
  if (!outcomes.length) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Nothing is being measured for this yet. An outcome is created when a
        recommendation is approved.
      </p>
    );
  }

  return (
    <ol className={cn('space-y-3', className)}>
      {outcomes.map((outcome) => {
        const meta = STATUS_META[outcome.status] ?? STATUS_META.pending;
        const Icon = meta.icon;
        const pending = outcome.status === 'pending' || outcome.status === 'measuring';

        return (
          <li key={outcome.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="text-sm font-medium text-foreground">
                {outcome.metric_label || outcome.metric_key}
              </span>
              <Badge variant="outline" className={cn('gap-1', meta.tone)}>
                <Icon aria-hidden className="size-3" />
                {meta.label}
              </Badge>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm tabular-nums">
              <span className="text-muted-foreground">
                Baseline <span className="text-foreground">{formatValue(outcome.baseline_value)}</span>
              </span>
              <ArrowRight aria-hidden className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                Now <span className="text-foreground">{formatValue(outcome.observed_value)}</span>
              </span>
              {outcome.delta !== null && (
                <span className={meta.tone}>
                  {outcome.delta > 0 ? '+' : ''}
                  {Number(outcome.delta).toFixed(1)}
                </span>
              )}
              {outcome.target_value !== null && (
                <span className="text-xs text-muted-foreground">
                  target {formatValue(outcome.target_value)}
                </span>
              )}
            </div>

            <p className="mt-1.5 text-xs text-muted-foreground">
              {pending && outcome.measure_after
                ? `Will be measured from ${formatDate(outcome.measure_after)}.`
                : outcome.observed_at
                  ? `Measured ${formatDate(outcome.observed_at)}.`
                  : outcome.status === 'inconclusive'
                    ? 'There was not enough data to score this fairly.'
                    : null}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
