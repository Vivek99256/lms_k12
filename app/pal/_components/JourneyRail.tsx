'use client';

import { Check, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The seven stages of the PAL journey, as a stepper.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS AS A SHARED COMPONENT
 * ---------------------------------------------------------------------------
 * The journey spans four different screens - the chapter list, the diagnostic,
 * its result, and the concept flow - and a learner has to be able to tell where
 * they are on all of them. Before this, the only stage indicator lived inside
 * app/pal/eso/page.tsx as seven text pills joined by a chevron character, so
 * every other screen showed nothing at all.
 *
 * ---------------------------------------------------------------------------
 * WHY IT SHOWS PROGRESS RATHER THAN DECORATION
 * ---------------------------------------------------------------------------
 * The design system this repo documents is explicit: consistency and
 * readability over decoration, no gradients, no ornament, meaning never carried
 * by colour alone. So a completed stage is a tick AND a colour AND an
 * accessible label; a locked stage is a padlock AND muted AND `aria-disabled`.
 * Nothing here is legible only to someone who can see hue.
 */

export type JourneyStageKey =
  | 'diagnostic'
  | 'adaptive'
  | 'plan'
  | 'learn'
  | 'practice'
  | 'check'
  | 'mastery'
  | 'recall';

export interface JourneyStage {
  key: JourneyStageKey;
  label: string;
}

/**
 * Ordered exactly as the product brief specifies the journey. `adaptive` is
 * labelled "Adaptive" rather than "Adaptive learning" purely so the stages fit
 * a phone without wrapping to three rows.
 *
 * `practice` sits between Learn and Check because that is the order the engine
 * actually runs (EsoPolicyService::phaseFor(): Learn -> Practice -> Check). It
 * was missing entirely, so the one stage a learner spends the most questions
 * on had no pill of its own and the rail jumped from Learn straight to Check
 * while they were still practising.
 */
export const JOURNEY_STAGES: JourneyStage[] = [
  { key: 'diagnostic', label: 'Diagnostic' },
  { key: 'adaptive', label: 'Adaptive' },
  { key: 'plan', label: 'Plan' },
  { key: 'learn', label: 'Learn' },
  { key: 'practice', label: 'Practice' },
  { key: 'check', label: 'Check' },
  { key: 'mastery', label: 'Mastery' },
  { key: 'recall', label: 'Recall' },
];

export interface JourneyRailProps {
  /** The stage the learner is on now. */
  current: JourneyStageKey;
  /**
   * Stages proven complete. Anything before `current` is implied, so this is
   * only needed when a later stage is already done - a re-taken diagnostic, for
   * instance, where mastery was reached on a previous pass.
   */
  completed?: JourneyStageKey[];
  /**
   * Stages the learner cannot reach yet, shown with a padlock instead of being
   * hidden. An absent stage reads as a missing feature; a locked one reads as
   * "not yet", which is the truth.
   */
  locked?: JourneyStageKey[];
  /** Optional per-stage navigation. Stages without a handler are not buttons. */
  onSelect?: (stage: JourneyStageKey) => void;
  className?: string;
  /** Compact drops the connectors and tightens spacing, for dense rows. */
  compact?: boolean;
  /**
   * 'vertical' stacks the stages as a left-aligned list, for the workspace side
   * rail. Same stages, same states, same accessible labels - only the axis
   * changes, so the rail and the in-page stepper can never disagree about where
   * a learner is.
   */
  orientation?: 'horizontal' | 'vertical';
}

export function JourneyRail({
  current,
  completed = [],
  locked = [],
  onSelect,
  className,
  compact = false,
  orientation = 'horizontal',
}: JourneyRailProps) {
  const vertical = orientation === 'vertical';
  const currentIndex = JOURNEY_STAGES.findIndex((stage) => stage.key === current);
  const doneSet = new Set(completed);
  const lockedSet = new Set(locked);

  const total = JOURNEY_STAGES.length;
  const reached = Math.max(currentIndex + 1, 0);

  return (
    <nav
      aria-label="Learning journey"
      data-pal-journey-stage={current}
      className={cn('w-full', className)}
    >
      {/* A stepper is a picture; this sentence is the same fact for a screen
          reader, and for anyone scanning rather than reading the pills. */}
      <p className="sr-only">
        Stage {reached} of {total}: {JOURNEY_STAGES[currentIndex]?.label ?? current}
      </p>

      <ol
        className={cn(
          'flex',
          vertical
            ? 'flex-col items-stretch gap-0'
            : cn('flex-wrap items-center', compact ? 'gap-1' : 'gap-x-1 gap-y-2')
        )}
      >
        {JOURNEY_STAGES.map((stage, index) => {
          const isCurrent = stage.key === current;
          const isLocked = lockedSet.has(stage.key);
          const isDone = !isCurrent && (doneSet.has(stage.key) || (index < currentIndex && !isLocked));
          const selectable = Boolean(onSelect) && !isLocked && (isDone || isCurrent);

          const content = vertical ? (
            // A row, not a pill: in a 320px rail the same rounded chrome
            // repeated eight times is noise, and a left-aligned list scans as
            // the ordered sequence it actually is.
            <span
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                isCurrent && 'bg-indigo-50 font-semibold text-indigo-900',
                isDone && 'text-emerald-700',
                !isCurrent && !isDone && !isLocked && 'text-slate-600',
                isLocked && 'text-slate-400',
                selectable && !isCurrent && 'hover:bg-slate-50'
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                  isCurrent && 'border-indigo-600 bg-indigo-600 text-white',
                  isDone && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                  !isCurrent && !isDone && !isLocked && 'border-slate-200 bg-white text-slate-400',
                  isLocked && 'border-slate-200 bg-slate-50 text-slate-300'
                )}
              >
                {isDone ? (
                  <Check className="h-3 w-3" />
                ) : isLocked ? (
                  <Lock className="h-2.5 w-2.5" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="truncate">{stage.label}</span>
              {isCurrent && (
                <span className="ml-auto text-[11px] font-medium text-indigo-600">Now</span>
              )}
            </span>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors',
                compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
                isCurrent && 'border-indigo-300 bg-indigo-50 text-indigo-800',
                isDone && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                !isCurrent && !isDone && !isLocked && 'border-slate-200 bg-white text-slate-500',
                isLocked && 'border-slate-200 bg-slate-50 text-slate-400',
                selectable && 'hover:border-indigo-300 hover:bg-indigo-50'
              )}
            >
              {isDone && <Check aria-hidden className="h-3 w-3" />}
              {isLocked && <Lock aria-hidden className="h-3 w-3" />}
              {stage.label}
            </span>
          );

          return (
            <li key={stage.key} className={cn(vertical ? 'flex flex-col' : 'flex items-center')}>
              {selectable ? (
                <button
                  type="button"
                  onClick={() => onSelect?.(stage.key)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={cn(
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600',
                    vertical ? 'w-full rounded-lg text-left' : 'rounded-full'
                  )}
                >
                  {content}
                </button>
              ) : (
                <span
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-disabled={isLocked || undefined}
                  className={cn(vertical && 'block w-full')}
                >
                  {content}
                </span>
              )}

              {index < total - 1 &&
                (vertical ? (
                  // Sits under the numbered marker so the sequence reads as one
                  // connected column rather than eight loose rows.
                  <span
                    aria-hidden
                    className={cn(
                      'ml-[1.4rem] h-2 w-px shrink-0',
                      index < currentIndex ? 'bg-emerald-300' : 'bg-slate-200'
                    )}
                  />
                ) : (
                  !compact && (
                    <span
                      aria-hidden
                      className={cn(
                        'mx-1 h-px w-3 shrink-0',
                        index < currentIndex ? 'bg-emerald-300' : 'bg-slate-200'
                      )}
                    />
                  )
                ))}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Which stage a chapter is on, from what the backend already reports.
 *
 * Deliberately derived rather than stored: every input is persisted evidence,
 * so a stage computed here can never disagree with the data it came from, and
 * there is no extra field to keep in sync.
 */
export function resolveChapterStage(input: {
  hasDiagnostic: boolean;
  practiceAttempts: number;
  mastered: number;
  conceptsServable: number;
}): JourneyStageKey {
  if (!input.hasDiagnostic) return 'diagnostic';
  if (input.practiceAttempts === 0) return 'adaptive';
  if (input.conceptsServable > 0 && input.mastered >= input.conceptsServable) return 'recall';
  if (input.mastered > 0) return 'mastery';
  return 'plan';
}
