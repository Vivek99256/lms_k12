'use client';

import { Check, Flag, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Question navigator + progress ring for a one-question-at-a-time diagnostic
 * run (Chapter Diagnostic, Concept Diagnostic). Shared because both screens
 * carry the identical shape of state -- an ordered question list, which ones
 * are answered, and a current index -- and diverging their navigators would
 * mean two colour maps that quietly drift apart, the exact failure
 * `BandMeter.tsx` was written to prevent for difficulty chips.
 *
 * Styled with the H5P player's own tokens/motion (`.h5p-tappable`,
 * `--h5p-*` custom properties) rather than a new colour language, since
 * `app/h5p/h5p.css` is already loaded on every page that renders
 * `QuestionPlayer` -- which both diagnostic screens do.
 */

export interface NavigatorItem {
  id: string;
  answered: boolean;
  /**
   * Only ever set post-submission, where the answer key is visible (see
   * `AnswerReviewBody`). The live exam's own navigator never marks a
   * question -- `DiagnosticExamPage`'s doc comment: nothing shows a tick or
   * a cross while the paper is being sat -- so it never sets this field at
   * all, rather than setting it to `null`. That absence, not a flag, is what
   * keeps its pips in their existing indigo "answered" colour below instead
   * of switching to the correct/incorrect/unanswered palette a review uses.
   */
  isCorrect?: boolean | null;
}

/** One pip's colour, in the post-submission review only -- current keeps the
 * SAME hue as its status rather than switching to brand indigo, so a
 * selected wrong answer still reads as wrong and a selected right answer
 * still reads as right; only the ring width and fill depth change. */
function reviewToneClass(status: 'correct' | 'incorrect' | 'unanswered', isCurrent: boolean): string {
  if (status === 'correct') {
    return isCurrent
      ? 'border-emerald-600 bg-emerald-100 text-emerald-800 shadow-[0_0_0_3px_rgba(16,185,129,0.28)]'
      : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-400';
  }
  if (status === 'incorrect') {
    return isCurrent
      ? 'border-rose-600 bg-rose-100 text-rose-800 shadow-[0_0_0_3px_rgba(225,29,72,0.24)]'
      : 'border-rose-300 bg-rose-50 text-rose-700 hover:border-rose-400';
  }
  return isCurrent
    ? 'border-slate-500 bg-slate-100 text-slate-800 shadow-[0_0_0_3px_rgba(100,116,139,0.22)]'
    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50';
}

export function QuestionNavigator({
  items,
  currentIndex,
  onJump,
  disabled = false,
}: {
  items: NavigatorItem[];
  currentIndex: number;
  onJump: (index: number) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
      role="tablist"
      aria-label="Jump to a question"
    >
      {items.map((item, index) => {
        const isCurrent = index === currentIndex;
        const isAnswered = item.answered;
        // Whether this navigator is being asked to mark correctness at all
        // -- see `NavigatorItem.isCorrect`'s own doc comment.
        const marked = item.isCorrect !== undefined;
        const status: 'correct' | 'incorrect' | 'unanswered' | null = !marked
          ? null
          : item.isCorrect === true
            ? 'correct'
            : item.isCorrect === false
              ? 'incorrect'
              : 'unanswered';

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isCurrent}
            aria-label={
              marked
                ? `Question ${index + 1}, ${status === 'unanswered' ? 'not answered' : status}`
                : `Question ${index + 1}${isAnswered ? ', answered' : ', not answered yet'}`
            }
            disabled={disabled}
            onClick={() => onJump(index)}
            className={cn(
              'h5p-tappable h5p-focusable relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors',
              status
                ? reviewToneClass(status, isCurrent)
                : isCurrent
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-[0_0_0_3px_rgba(79,70,229,0.18)]'
                  : isAnswered
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
            )}
          >
            {/* The live exam swaps the number for a tick once answered -- a
                review keeps the number always visible, since the whole point
                here is reading which numbers are which colour, and the
                corner badge below is what carries the tick/cross instead. */}
            {!marked && isAnswered && !isCurrent ? <Check aria-hidden className="h-3.5 w-3.5" /> : index + 1}

            {/* Colour is never the only signal (CLAUDE.md: "meaning never
                carried by colour alone") -- this is the same tick/cross the
                option list and the verdict chip use for the same two
                states, just small enough to sit on a 36px pip. */}
            {status === 'correct' && (
              <span
                aria-hidden="true"
                className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-white"
              >
                <Check className="h-2 w-2" strokeWidth={3} />
              </span>
            )}
            {status === 'incorrect' && (
              <span
                aria-hidden="true"
                className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-600 text-white ring-2 ring-white"
              >
                <X className="h-2 w-2" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** A compact "N of total" ring, filled by how many questions are answered. */
export function ProgressRing({
  value,
  max,
  size = 52,
  strokeWidth = 4,
  className,
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const complete = max > 0 && value >= max;

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label="Questions answered"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-slate-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className={cn(
            'transition-[stroke-dashoffset] duration-500 ease-out',
            complete ? 'stroke-emerald-500' : 'stroke-indigo-600'
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[13px] font-bold tabular-nums text-slate-900">{value}</span>
        <span className="text-[9px] font-medium tabular-nums text-slate-400">/{max}</span>
      </div>
    </div>
  );
}

/** A large percentage ring for a result headline -- same primitive as `ProgressRing`, a percentage label instead of "N/total". */
export function ScoreRing({
  percentage,
  size = 96,
  strokeWidth = 8,
  className,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.min(1, Math.max(0, percentage / 100));
  const tone =
    percentage >= 80 ? 'stroke-emerald-500' : percentage >= 50 ? 'stroke-indigo-600' : 'stroke-amber-500';

  return (
    <div
      className={cn('h5p-enter-scale relative shrink-0', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Overall score"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-slate-100" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className={cn('transition-[stroke-dashoffset] duration-700 ease-out', tone)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold tabular-nums text-slate-900">{Math.round(percentage)}%</span>
      </div>
    </div>
  );
}

/** A single flagged/unflagged toggle, for "come back to this one later". */
export function FlagToggle({
  flagged,
  onToggle,
  disabled = false,
}: {
  flagged: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={flagged}
      className={cn(
        'h5p-tappable h5p-focusable inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        flagged
          ? 'border-amber-300 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
      )}
    >
      <Flag aria-hidden className={cn('h-3.5 w-3.5', flagged && 'fill-amber-400')} />
      {flagged ? 'Flagged' : 'Flag for review'}
    </button>
  );
}
