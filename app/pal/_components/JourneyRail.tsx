'use client';

import { Check, Lock, Minus } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * The ten stages of the PAL journey, two of them conditional, as a stepper.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS AS A SHARED COMPONENT
 * ---------------------------------------------------------------------------
 * The journey spans four different screens - the chapter list, the diagnostic,
 * its result, and the concept flow - and a learner has to be able to tell where
 * they are on all of them. Before this, the only stage indicator lived inside
 * app/pal/eso/page.tsx as text pills joined by a chevron character, so every
 * other screen showed nothing at all.
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
  | 'feedback'
  | 'check'
  | 'intervention'
  | 'mastery'
  | 'recall';

export interface JourneyStage {
  key: JourneyStageKey;
  label: string;
}

/**
 * Ordered exactly as the product brief specifies the journey. The two entry
 * stages carry their full product names - "Chapter diagnostic" for the
 * fifteen-question chapter paper, "Concept diagnostic" for the per-concept
 * drill that follows - because "Diagnostic" and "Adaptive" on their own gave a
 * learner no way to tell which of the two they were looking at.
 *
 * `practice` sits between Learn and Check because that is the order the engine
 * actually runs (EsoPolicyService::phaseFor(): Learn -> Practice -> Check). It
 * was missing entirely, so the one stage a learner spends the most questions
 * on had no pill of its own and the rail jumped from Learn straight to Check
 * while they were still practising.
 */
export const JOURNEY_STAGES: JourneyStage[] = [
  { key: 'diagnostic', label: 'Chapter diagnostic' },
  { key: 'adaptive', label: 'Concept diagnostic' },
  { key: 'plan', label: 'Plan' },
  { key: 'learn', label: 'Learn' },
  { key: 'practice', label: 'Practice' },
  // Between Practice and Check because that is the order a learner needs it
  // in: a formative read of the set they just did, BEFORE the consequential
  // gate. After the Check it would be a post-mortem of a decision already
  // taken - a receipt, not feedback - and too late to change the outcome it
  // is commenting on.
  { key: 'feedback', label: 'Feedback' },
  { key: 'check', label: 'Check' },
  // CONDITIONAL, and most learners never reach it - that is the success case.
  //
  // It is the failure branch of the Check gate, and it is TIER-2 HUMAN
  // escalation: a teacher opens it, a teacher closes it. It is deliberately
  // NOT the engine's Tier-1 automatic repair (remediate_prerequisite,
  // serve_contrast_pair, reteach), which stays off-path exactly as it is
  // today - see the note on FLOW_STAGES in app/pal/eso/page.tsx.
  //
  // Called "Extra support" and not "Intervention" on purpose. Staff screens
  // and the route say intervention, matching SOP 6.13; a learner reading
  // their own rail gets the plain word. Same record, two registers.
  { key: 'intervention', label: 'Extra support' },
  { key: 'mastery', label: 'Mastery' },
  { key: 'recall', label: 'Recall' },
];

/**
 * Stages nobody is guaranteed to pass through.
 *
 * Load-bearing: the rail's "anything before `current` is done" shortcut is a
 * lie for these. A learner standing on Mastery is past Extra support in the
 * array, and without this list it would render with a tick - claiming evidence
 * for something they were never asked to do.
 */
export const CONDITIONAL_STAGES: readonly JourneyStageKey[] = ['intervention'];

/**
 * Every stage a learner necessarily passed to be standing on `stage`.
 *
 * Derived rather than written out, so adding a stage to JOURNEY_STAGES can
 * never leave a preset behind - which is exactly what happened with the
 * six-key array that ended up pasted into seven call sites. Conditional stages
 * are excluded because `completed` asserts evidence, and most learners have
 * none for Extra support.
 */
export function stagesBefore(stage: JourneyStageKey): JourneyStageKey[] {
  const index = JOURNEY_STAGES.findIndex((entry) => entry.key === stage);
  if (index <= 0) return [];

  return JOURNEY_STAGES.slice(0, index)
    .map((entry) => entry.key)
    .filter((key) => !CONDITIONAL_STAGES.includes(key));
}

/** Diagnostic through Check, minus Extra support. The old six-key literal. */
export const COMPLETED_THROUGH_CHECK: readonly JourneyStageKey[] = stagesBefore('mastery');

/** ...and Mastery too. The recall screen's seven-key literal. */
export const COMPLETED_THROUGH_MASTERY: readonly JourneyStageKey[] = stagesBefore('recall');

export interface JourneyRailProps {
  /** The stage the learner is on now. */
  current: JourneyStageKey;
  /**
   * Stages proven complete. Anything before `current` is implied, so this is
   * only needed when a later stage is already done - a re-taken diagnostic, for
   * instance, where mastery was reached on a previous pass.
   */
  completed?: readonly JourneyStageKey[];
  /**
   * Stages the learner cannot reach yet, shown with a padlock instead of being
   * hidden. An absent stage reads as a missing feature; a locked one reads as
   * "not yet", which is the truth.
   */
  locked?: readonly JourneyStageKey[];
  /**
   * Stages this learner did not need, shown as "Not needed" rather than
   * hidden. The rail stays the same ten rows for everyone, and a learner who
   * never needed Extra support can see that they did not.
   *
   * Takes precedence over the implied-done rule below: a bypassed stage
   * sitting before `current` must NOT tick, because a tick asserts evidence.
   */
  bypassed?: readonly JourneyStageKey[];
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
  bypassed = [],
  onSelect,
  className,
  compact = false,
  orientation = 'horizontal',
}: JourneyRailProps) {
  const vertical = orientation === 'vertical';
  const currentIndex = JOURNEY_STAGES.findIndex((stage) => stage.key === current);
  const doneSet = new Set(completed);
  const lockedSet = new Set(locked);
  const bypassedSet = new Set(bypassed);

  const stageCount = JOURNEY_STAGES.length;

  // Counts the stages this learner is actually being asked to walk, so a
  // learner who bypassed Extra support hears "Stage 3 of 9" rather than being
  // told about a stage the screen has just said they do not need.
  //
  // `current` is never filtered out, even if a caller passes it in `bypassed`
  // too. It cannot be both, the row itself already resolves that in favour of
  // current, and without this the learner would be told they were on "stage 0".
  const walked = JOURNEY_STAGES.filter(
    (stage) => stage.key === current || !bypassedSet.has(stage.key)
  );
  const reached = Math.max(walked.findIndex((stage) => stage.key === current) + 1, 0);

  return (
    <nav
      aria-label="Learning journey"
      data-pal-journey-stage={current}
      className={cn('w-full', className)}
    >
      {/* A stepper is a picture; this sentence is the same fact for a screen
          reader, and for anyone scanning rather than reading the pills. */}
      <p className="sr-only">
        Stage {reached} of {walked.length}: {JOURNEY_STAGES[currentIndex]?.label ?? current}
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
          // Order matters. `bypassed` beats the implied-done rule below,
          // because a tick asserts the learner did something and a bypassed
          // stage is precisely one they were never asked to do.
          const isCurrent = stage.key === current;
          const isBypassed = !isCurrent && bypassedSet.has(stage.key);
          const isLocked = !isCurrent && !isBypassed && lockedSet.has(stage.key);
          const isDone =
            !isCurrent &&
            !isBypassed &&
            !isLocked &&
            (doneSet.has(stage.key) || index < currentIndex);
          const isAhead = !isCurrent && !isBypassed && !isLocked && !isDone;
          const selectable = Boolean(onSelect) && !isLocked && !isBypassed && (isDone || isCurrent);

          // A connector may only read as walked if the stage it leaves was
          // actually walked - an emerald line out of a "Not needed" row would
          // undo the row's own wording.
          const connectorDone = index < currentIndex && !bypassedSet.has(stage.key);

          const content = vertical ? (
            // A row, not a pill: in a 320px rail the same rounded chrome
            // repeated ten times is noise, and a left-aligned list scans as
            // the ordered sequence it actually is.
            <span
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                isCurrent && 'bg-indigo-50 font-semibold text-indigo-900',
                isDone && 'text-emerald-700',
                isAhead && 'text-slate-600',
                isLocked && 'text-slate-400',
                isBypassed && 'text-slate-400',
                selectable && !isCurrent && 'hover:bg-slate-50'
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                  isCurrent && 'border-indigo-600 bg-indigo-600 text-white',
                  isDone && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                  isAhead && 'border-slate-200 bg-white text-slate-400',
                  isLocked && 'border-slate-200 bg-slate-50 text-slate-300',
                  // Dashed is the second non-colour cue, after the dash glyph.
                  isBypassed && 'border-dashed border-slate-300 bg-white text-slate-400'
                )}
              >
                {isDone ? (
                  <Check className="h-3 w-3" />
                ) : isLocked ? (
                  <Lock className="h-2.5 w-2.5" />
                ) : isBypassed ? (
                  <Minus className="h-2.5 w-2.5" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="truncate">{stage.label}</span>
              {/* The third cue, and the only one that survives a screen
                  reader: the state is a word, not a shape or a hue. */}
              {isBypassed && <span className="sr-only">, not needed</span>}
              {isCurrent && (
                <span className="ml-auto text-[11px] font-medium text-indigo-600">Now</span>
              )}
              {isBypassed && (
                <span aria-hidden className="ml-auto text-[11px] font-medium text-slate-400">
                  Not needed
                </span>
              )}
            </span>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors',
                compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
                isCurrent && 'border-indigo-300 bg-indigo-50 text-indigo-800',
                isDone && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                isAhead && 'border-slate-200 bg-white text-slate-500',
                isLocked && 'border-slate-200 bg-slate-50 text-slate-400',
                isBypassed && 'border-dashed border-slate-300 bg-white text-slate-400',
                selectable && 'hover:border-indigo-300 hover:bg-indigo-50'
              )}
            >
              {isDone && <Check aria-hidden className="h-3 w-3" />}
              {isLocked && <Lock aria-hidden className="h-3 w-3" />}
              {isBypassed && <Minus aria-hidden className="h-3 w-3" />}
              {stage.label}
              {isBypassed && <span className="sr-only">, not needed</span>}
            </span>
          );

          return (
            <li
              key={stage.key}
              data-pal-journey-bypassed={isBypassed || undefined}
              className={cn(vertical ? 'flex flex-col' : 'flex items-center')}
            >
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
                  // Only for locked. A bypassed stage is not something the
                  // learner is being stopped from doing, so aria-disabled
                  // would say the wrong thing; its sr-only word says the
                  // right one.
                  aria-disabled={isLocked || undefined}
                  className={cn(vertical && 'block w-full')}
                >
                  {content}
                </span>
              )}

              {index < stageCount - 1 &&
                (vertical ? (
                  // Sits under the numbered marker so the sequence reads as one
                  // connected column rather than ten loose rows.
                  <span
                    aria-hidden
                    className={cn(
                      'ml-[1.4rem] h-1.5 w-px shrink-0',
                      connectorDone ? 'bg-emerald-300' : 'bg-slate-200'
                    )}
                  />
                ) : (
                  !compact && (
                    <span
                      aria-hidden
                      className={cn(
                        'mx-1 h-px w-3 shrink-0',
                        connectorDone ? 'bg-emerald-300' : 'bg-slate-200'
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
 *
 * There is no `feedback` branch on purpose. Feedback lives for one screen,
 * between one practice set and one check; a chapter-level rollup that reported
 * it would be wrong the moment the learner navigated away.
 */
export function resolveChapterStage(input: {
  hasDiagnostic: boolean;
  practiceAttempts: number;
  mastered: number;
  conceptsServable: number;
  /**
   * Support cases open against this chapter. Optional: a caller with no
   * intervention data omits it and gets exactly the old answer, rather than
   * having to pass a zero it cannot vouch for.
   */
  openInterventions?: number;
}): JourneyStageKey {
  if (!input.hasDiagnostic) return 'diagnostic';
  if (input.practiceAttempts === 0) return 'adaptive';
  if (input.conceptsServable > 0 && input.mastered >= input.conceptsServable) return 'recall';
  // After the completion check on purpose: a learner who has finished the
  // chapter is not "being supported", whatever is still open on a record.
  if ((input.openInterventions ?? 0) > 0) return 'intervention';
  if (input.mastered > 0) return 'mastery';
  return 'plan';
}
