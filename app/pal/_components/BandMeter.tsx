'use client';

import { cn } from '@/lib/utils';

/**
 * Easy / medium / hard presentation, shared by the diagnostic exam, the
 * diagnostic result, the concept result and the plan.
 *
 * One module so the three bands mean the same thing - and read the same way -
 * everywhere. Before this, three different screens each defined their own
 * colour map and two of them disagreed about which colour "advanced" was.
 *
 * Colour is never the only signal: every band carries its name as text, so the
 * meaning survives greyscale, colour blindness and a screen reader.
 */

export type Band = 'easy' | 'medium' | 'hard';

export const BAND_ORDER: Band[] = ['easy', 'medium', 'hard'];

/** Emerald -> amber -> rose reads as increasing effort, not as good -> bad. */
const BAND_STYLE: Record<string, { chip: string; bar: string; label: string }> = {
  easy: { chip: 'border-emerald-200 bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500', label: 'Easy' },
  medium: { chip: 'border-amber-200 bg-amber-50 text-amber-700', bar: 'bg-amber-500', label: 'Medium' },
  hard: { chip: 'border-rose-200 bg-rose-50 text-rose-700', bar: 'bg-rose-500', label: 'Hard' },
};

const FALLBACK = { chip: 'border-slate-200 bg-slate-50 text-slate-600', bar: 'bg-slate-400', label: 'Untagged' };

export function bandStyle(band: string) {
  return BAND_STYLE[band?.toLowerCase()] ?? FALLBACK;
}

export function bandLabel(band: string): string {
  return bandStyle(band).label;
}

export function BandChip({ band, className }: { band: string; className?: string }) {
  const style = bandStyle(band);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        style.chip,
        className
      )}
    >
      {style.label}
    </span>
  );
}

export interface BandRowProps {
  band: string;
  correct: number;
  served: number;
  percentage: number;
  unanswered?: number;
}

/**
 * One band's line in a breakdown: name, score, bar, and what it is out of.
 *
 * A band with `served = 0` was not a failure - it means the chapter had no
 * questions at that level - so it says so instead of rendering an empty bar at
 * 0%, which would read as "you got none right".
 */
export function BandRow({ band, correct, served, percentage, unanswered = 0 }: BandRowProps) {
  const style = bandStyle(band);
  const unfillable = served === 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2">
          <BandChip band={band} />
          {unanswered > 0 && (
            <span className="text-[11px] text-slate-500">{unanswered} skipped</span>
          )}
        </span>
        <span className="text-sm tabular-nums text-slate-700">
          {unfillable ? 'No questions' : `${correct}/${served}`}
        </span>
      </div>

      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        {!unfillable && (
          <div
            className={cn('h-full rounded-full transition-all', style.bar)}
            style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
            role="progressbar"
            aria-valuenow={Math.round(percentage)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${style.label} score`}
          />
        )}
      </div>
    </div>
  );
}

/** Level badge for the overall diagnostic verdict (beginner -> advanced). */
const LEVEL_STYLE: Record<string, string> = {
  beginner: 'border-slate-300 bg-slate-100 text-slate-700',
  developing: 'border-amber-200 bg-amber-50 text-amber-800',
  proficient: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  advanced: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

export function LevelBadge({ level, className }: { level: string; className?: string }) {
  const key = (level || '').toLowerCase();
  const style = LEVEL_STYLE[key] ?? 'border-slate-200 bg-white text-slate-600';
  const label = key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Not attempted';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        style,
        className
      )}
    >
      {label}
    </span>
  );
}

/** Concept strength band from the scorer: weak / moderate / strong. */
const STRENGTH_STYLE: Record<string, string> = {
  weak: 'border-rose-200 bg-rose-50 text-rose-700',
  moderate: 'border-amber-200 bg-amber-50 text-amber-800',
  strong: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

export function StrengthBadge({ band, className }: { band: string | null; className?: string }) {
  if (!band) return null;

  const key = band.toLowerCase();
  const style = STRENGTH_STYLE[key] ?? 'border-slate-200 bg-white text-slate-600';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize',
        style,
        className
      )}
    >
      {key}
    </span>
  );
}
