'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, ChevronDown, ListOrdered, Lock, Minus } from 'lucide-react';

import { cn } from '@/lib/utils';

import { SelectedJourneyStepRail } from './SelectedJourneyStepRail';
import { DEFAULT_STAGE_IMAGES, type JourneyImageInfo } from './H5PJourneyCollage';
import { fetchJourneyImages, type JourneyStageImage } from '@/app/pal/data/pal-journey-images';
import {
  JOURNEY_STAGES,
  stageHref,
  stagesBefore,
  type JourneyStage,
  type JourneyStageKey,
} from './journey-stages';

/**
 * The journey rail: the ten stages of the PAL journey as a stepper.
 *
 * ---------------------------------------------------------------------------
 * THE STAGE MODEL LIVES IN ./journey-stages NOW, NOT IN HERE
 * ---------------------------------------------------------------------------
 * It used to be declared in this file. The image-based journey map needs the
 * same stage list — labels, order, and an icon to fall back to when a stage has
 * no picture — and importing it back out of the component that renders it would
 * have made a module cycle whose safety depended on nobody reading a value at
 * import time. The model moved to `journey-stages.ts`; every name this file used
 * to export is re-exported below, so all 21 call sites are untouched.
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
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOW A TOGGLE INSTEAD OF THE ALWAYS-VISIBLE FIRST THING
 * ---------------------------------------------------------------------------
 * The image-based map (JourneyImageMap) is the richer view of exactly this
 * information, and a 320px rail cannot show ten pictures. So the rail renders a
 * "Your journey" button: closed it is the entry point to the map, open it is
 * the stepper exactly as it always was, and the two are never on screen at the
 * same time. Nothing was removed — the stepper is the same component, rendering
 * the same thing, one click away.
 */

export {
  JOURNEY_STAGES,
  JOURNEY_STAGE_BY_KEY,
  CONDITIONAL_STAGES,
  stagesBefore,
  COMPLETED_THROUGH_CHECK,
  COMPLETED_THROUGH_MASTERY,
  stageHref,
  resolveChapterStage,
} from './journey-stages';
export type { JourneyStage, JourneyStageKey };

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
  /** Optional context overrides */
  chapterId?: string | number | null;
  conceptId?: string | number | null;
  subjectName?: string | null;
  chapterName?: string | null;
}

export function JourneyStepList({
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
 * What a PAL screen's rail renders: the image journey, plus the step list
 * behind a toggle.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A TOGGLE AND NOT A REPLACEMENT
 * ---------------------------------------------------------------------------
 * The brief is to ADD an image-based journey, not to take the stepper away — so
 * the stepper is all still here, unchanged, one click away. Two entries, never
 * both on screen at once: the image map (large, ten pictures, the primary
 * view) and the compact step list, which is what a 320px column can actually
 * hold.
 *
 * The step list starts CLOSED, and the collapsed trigger still names the stage
 * the learner is on. That is deliberate: the journey rail's whole job is
 * answering "where am I?" on every screen, and a rail that rendered nothing but
 * a button would have stopped doing that. The one line of text on the button
 * keeps the answer on screen while the ten-row list waits to be asked for.
 *
 * ---------------------------------------------------------------------------
 * WHY THE IDS COME FROM THE ROUTE AND NOT FROM PROPS
 * ---------------------------------------------------------------------------
 * All 21 call sites render `<JourneyRail current=… completed=… />` with no
 * chapter or concept, and none of them has to change for the image map to
 * work. The route already says what the screen is about: `/pal/plan/chapter/
 * [chapterId]` is a chapter screen and `/pal/learn/concept/[conceptId]` is a
 * concept screen. Reading that here is what lets the same component sit behind
 * every screen, including ones nobody has visited yet.
 *
 * `?chapterId=` in the query string is deliberately NOT read for this. Reading
 * it needs `useSearchParams()`, which forces a Suspense boundary around every
 * one of those 21 screens, for the sake of an id the backend resolves from the
 * concept anyway — `JourneyImageService` needs a chapter OR a concept, never
 * both. Where a chapter genuinely would help — a concept screen's map — the
 * map still works, just anchored on the concept, which is the more specific of
 * the two and the better thing to search with.
 */
export function JourneyRail(props: JourneyRailProps) {
  const params = useParams<{ chapterId?: string; conceptId?: string }>();
  const router = useRouter();
  const [showSteps, setShowSteps] = useState(false);
  const [images, setImages] = useState<Record<string, JourneyImageInfo>>(DEFAULT_STAGE_IMAGES);

  // Resolve chapter and concept IDs from props, route params, window or session storage
  const chapterId =
    props.chapterId ??
    params?.chapterId ??
    (typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('chapterId') ||
        sessionStorage.getItem('pal_active_chapter_id')
      : null);

  const conceptId =
    props.conceptId ??
    params?.conceptId ??
    (typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('conceptId') ||
        sessionStorage.getItem('pal_active_concept_id')
      : null);

  // Save active chapter in session storage whenever known
  useEffect(() => {
    if (chapterId && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('pal_active_chapter_id', String(chapterId));
      } catch {}
    }
  }, [chapterId]);

  // Save active concept in session storage whenever known
  useEffect(() => {
    if (conceptId && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('pal_active_concept_id', String(conceptId));
      } catch {}
    }
  }, [conceptId]);

  // Load and cache web-searched journey images in the background
  useEffect(() => {
    if (!chapterId && !conceptId) return;

    let active = true;
    const controller = new AbortController();

    fetchJourneyImages({ chapterId, conceptId }, controller.signal)
      .then((payload) => {
        if (!active || !payload) return;
        const mapped: Record<string, JourneyImageInfo> = {};
        for (const [key, val] of Object.entries(payload.stages) as [string, JourneyStageImage][]) {
          if (val?.image?.url) {
            mapped[key] = {
              url: val.image.url,
              thumbnailUrl: val.image.thumbnailUrl || undefined,
              title: val.image.title || undefined,
              creator: val.image.creator || undefined,
              license: val.image.license || undefined,
            };
          }
        }
        if (Object.keys(mapped).length > 0) {
          setImages((prev) => ({ ...prev, ...mapped }));
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
      controller.abort();
    };
  }, [chapterId, conceptId]);

  // Derive completed stages set
  const completedSet = useMemo(() => {
    const set = new Set<JourneyStageKey>(props.completed || stagesBefore(props.current));
    if (typeof window !== 'undefined' && chapterId) {
      try {
        const stored = sessionStorage.getItem(`pal_completed_steps_${chapterId}`);
        if (stored) {
          const arr: JourneyStageKey[] = JSON.parse(stored);
          arr.forEach((k) => set.add(k));
        }
      } catch {}
    }
    return set;
  }, [props.completed, props.current, chapterId]);

  const handleSelectStep = (stepId: JourneyStageKey) => {
    if (props.onSelect) {
      props.onSelect(stepId);
      return;
    }
    const targetHref = stageHref(stepId, { chapterId, conceptId });
    if (targetHref) {
      router.push(targetHref);
    }
  };

  return (
    <div className={cn('w-full space-y-3', props.className)}>
      {/* 1. Interactive Image-Based Journey Card and Sequential Step Switcher */}
      <SelectedJourneyStepRail
        selectedStep={props.current}
        images={images}
        subjectName={props.subjectName ?? undefined}
        chapterName={props.chapterName ?? undefined}
        chapterId={chapterId}
        conceptId={conceptId}
        completedSteps={completedSet}
        lockedSteps={props.locked}
        bypassedSteps={props.bypassed}
        onSelectStep={handleSelectStep}
        onBackToCollage={chapterId ? () => router.push(`/pal/diagnostic/chapter/${chapterId}`) : undefined}
      />

      {/* 2. Step list toggle button */}
      <button
        type="button"
        onClick={() => setShowSteps((value) => !value)}
        aria-expanded={showSteps}
        aria-controls="pal-journey-step-list"
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <div className="flex items-center gap-2">
          <ListOrdered aria-hidden className="h-4 w-4 shrink-0 text-indigo-600" />
          <span>{showSteps ? 'Hide journey list' : 'Show journey list'}</span>
        </div>
        <ChevronDown
          aria-hidden
          className={cn('h-3.5 w-3.5 transition-transform duration-200', showSteps && 'rotate-180')}
        />
      </button>

      {/* 3. The Step List (revealed only on explicit demand) */}
      {showSteps ? (
        <div id="pal-journey-step-list" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <JourneyStepList {...props} />
        </div>
      ) : null}
    </div>
  );
}
