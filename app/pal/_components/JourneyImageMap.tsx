'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Check, Images, ListOrdered, Loader2, Lock, Minus } from 'lucide-react';

import {
  fetchJourneyImages,
  JOURNEY_MAP_STAGE_ORDER,
  type JourneyImage,
  type JourneyImageMapPayload,
  type JourneyImageMatch,
  type JourneyStageImage,
} from '@/app/pal/data/pal-journey-images';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { JourneyStagePanel } from './JourneyStagePanel';
import {
  CONDITIONAL_STAGES,
  JOURNEY_STAGE_BY_KEY,
  type JourneyStageKey,
} from './journey-stages';
import { JourneyStepList, type JourneyRailProps } from './JourneyRail';

/**
 * "Your Journey", as an image map.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS
 * ---------------------------------------------------------------------------
 * The same ten stages `JourneyRail` has always shown, drawn as pictures
 * instead of numbers, and behaving like an H5P branching scenario: one large
 * image with the stages as choices on it, and on choosing one, that picture
 * shrinking to the right while the step's actual content opens on the left.
 *
 * The UX reference is the reference. Nothing here is H5P — there is no
 * `H5P.BranchingScenario` player, no branching content type, no attempt
 * tracking, and the ten stages are a fixed sequence rather than a graph
 * (`lib/h5p/question-bank-h5p-map.ts` records BranchingScenario as not
 * implemented on this estate, and that has not changed).
 *
 * ---------------------------------------------------------------------------
 * EVERY PICTURE IS SEARCHED, NONE IS CHOSEN BY HAND
 * ---------------------------------------------------------------------------
 * `fetchJourneyImages()` asks the backend for a picture per stage; the backend
 * builds each query from the learner's own subject, chapter and concept plus
 * that step's meaning, and searches Openverse for openly-licensed results
 * (see JourneyImageService). No URL, filename or fallback picture is written
 * anywhere in this file or in the app — which is why the map works unchanged
 * for a chapter this estate has never seen.
 *
 * "No picture found" is an ORDINARY outcome, not an error: the search is
 * deliberately strict, because a confidently wrong picture is worse than none.
 * A node without one draws its stage's icon instead, so the map is never
 * broken and never lies about what a step is.
 *
 * ---------------------------------------------------------------------------
 * WHAT SELECTING A STAGE DOES
 * ---------------------------------------------------------------------------
 * It does NOT navigate. The stage's own read-only data is fetched and shown in
 * `JourneyStagePanel` on the left, while the picture moves to a fixed
 * right-hand column and stays there — the visual anchor for "this is where I
 * am" while the content changes underneath. Switching stages is one more click
 * and the previous stage is never lost.
 *
 * ---------------------------------------------------------------------------
 * AND THE STEP LIST IS STILL HERE
 * ---------------------------------------------------------------------------
 * The requirement is to ADD this, not to replace the stepper. So the header
 * carries a two-way toggle: "Image map" (this) and "Step list", and the latter
 * renders the unchanged `JourneyRail` in the same dialog. They are never on
 * screen together — which is also what keeps the 320px rail from having to
 * hold ten pictures.
 */

type StageStatus = 'current' | 'done' | 'bypassed' | 'locked' | 'ahead';

type View = 'map' | 'list';

/**
 * The map's own load state.
 *
 * `idle` is the closed state — no request has been made and none should have
 * been. It is distinct from `loading` so that a closed dialog never renders a
 * spinner, and from `error` so that "no pictures today" (which the payload
 * expresses with null images, not a failed request) can never be mistaken for
 * "the request itself broke".
 */
type MapState =
  | { status: 'idle' | 'loading'; payload: null }
  | { status: 'ready'; payload: JourneyImageMapPayload }
  | { status: 'error'; payload: null };

export interface JourneyImageMapProps extends Pick<
  JourneyRailProps,
  'current' | 'completed' | 'locked' | 'bypassed'
> {
  /**
   * What the screen hosting the map is about. Both optional: a chapter screen
   * knows its chapter, a concept screen knows its concept, and the backend
   * resolves the rest from whichever one it gets.
   */
  chapterId?: string | number | null;
  conceptId?: string | number | null;
  /** Shown as context on the map. Falls back to whatever the payload returns. */
  chapterName?: string | null;
}

export function JourneyImageMap(props: JourneyImageMapProps) {
  const { chapterId, conceptId, chapterName, current, completed = [], locked = [], bypassed = [] } = props;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('map');
  const [selected, setSelected] = useState<JourneyStageKey | null>(null);
  const [map, setMap] = useState<MapState>({ status: 'idle', payload: null });
  const inFlight = useRef<AbortController | null>(null);

  const statuses = useMemo(
    () => buildStatuses({ current, completed, locked, bypassed }),
    [current, completed, locked, bypassed]
  );

  useEffect(() => () => inFlight.current?.abort(), []);

  /**
   * Fetched HERE, on the click that opens the map, rather than in an effect
   * keyed on `open`.
   *
   * That is not just lint-appeasement: the map is the result of a deliberate
   * action, and doing the work when the learner asks for it is what keeps ten
   * image searches off every PAL screen load. An effect would also have set
   * state synchronously on open, which is the cascading-render pattern React
   * 19 warns about for no gain.
   */
  const openMap = () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setSelected(null);
    setView('map');
    setMap({ status: 'loading', payload: null });
    setOpen(true);

    fetchJourneyImages({ chapterId, conceptId }, controller.signal).then((payload) => {
      if (controller.signal.aborted) return;
      setMap(payload ? { status: 'ready', payload } : { status: 'error', payload: null });
    });
  };

  const closeMap = (nextOpen: boolean) => {
    if (!nextOpen) inFlight.current?.abort();
    setOpen(nextOpen);
  };

  const payload = map.payload;
  const title = payload?.chapter ?? chapterName ?? 'your journey';
  const contextLine = [payload?.subject, payload?.concept ?? null].filter(Boolean).join(' · ');

  return (
    <>
      <button
        type="button"
        onClick={openMap}
        className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
      >
        <Images aria-hidden className="size-4 shrink-0 text-indigo-600" />
        <span className="flex-1">Your journey</span>
        <span className="text-xs font-medium text-slate-500">
          {JOURNEY_STAGE_BY_KEY[current].label}
        </span>
      </button>

      <Dialog open={open} onOpenChange={closeMap}>
        <DialogContent className="flex h-[min(46rem,calc(100vh-3rem))] w-[min(76rem,calc(100vw-3rem))] max-w-none flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b px-5 py-3 pr-14">
            <div className="min-w-0">
              <DialogTitle className="truncate text-base">Your journey</DialogTitle>
              <DialogDescription className="truncate text-xs font-normal text-slate-600">
                {contextLine ? `${contextLine} · ${title}` : title}
              </DialogDescription>
            </div>

            <div
              role="tablist"
              aria-label="How to view your journey"
              className="flex shrink-0 rounded-md border p-0.5"
            >
              <ViewToggle
                active={view === 'map'}
                onSelect={() => setView('map')}
                icon={Images}
                label="Image map"
              />
              <ViewToggle
                active={view === 'list'}
                onSelect={() => setView('list')}
                icon={ListOrdered}
                label="Step list"
              />
            </div>
          </DialogHeader>

          {view === 'list' ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <p className="mb-4 text-sm text-slate-600">
                The same journey as it has always been shown — every stage, what is done and
                what comes next.
              </p>
              <JourneyStepList
                current={current}
                completed={completed}
                locked={locked}
                bypassed={bypassed}
              />
            </div>
          ) : (
            <MapScene
              chapterId={chapterId}
              conceptId={conceptId}
              payload={payload}
              loading={map.status === 'loading'}
              failed={map.status === 'error'}
              statuses={statuses}
              selected={selected}
              onSelect={setSelected}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ViewToggle({
  active,
  onSelect,
  icon: Icon,
  label,
}: {
  active: boolean;
  onSelect: () => void;
  icon: typeof Images;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition',
        active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </button>
  );
}

// --- the map itself --------------------------------------------------------

function MapScene({
  chapterId,
  conceptId,
  payload,
  loading,
  failed,
  statuses,
  selected,
  onSelect,
}: {
  chapterId?: string | number | null;
  conceptId?: string | number | null;
  payload: JourneyImageMapPayload | null;
  loading: boolean;
  failed: boolean;
  statuses: Record<JourneyStageKey, StageStatus>;
  selected: JourneyStageKey | null;
  onSelect: (stage: JourneyStageKey | null) => void;
}) {
  const reduceMotion = useReducedMotion();

  const focusStage: JourneyStageKey | null = selected;
  const focusImage = focusStage
    ? (payload?.stages[focusStage]?.image ?? null)
    : (payload?.poster ?? null);
  const focusMeta = focusStage ? JOURNEY_STAGE_BY_KEY[focusStage] : null;

  return (
    <LayoutGroup id="journey-map">
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="relative min-h-0 overflow-hidden border-b lg:border-b-0 lg:border-r">
          {selected ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="min-h-0 flex-1">
                <JourneyStagePanel stage={selected} chapterId={chapterId} conceptId={conceptId} />
              </div>
              <div className="border-t bg-white px-4 py-3">
                <StageStrip
                  variant="overlay"
                  statuses={statuses}
                  payload={payload}
                  selected={selected}
                  onSelect={onSelect}
                />
              </div>
            </div>
          ) : (
            <EntryScene
              payload={payload}
              loading={loading}
              failed={failed}
              statuses={statuses}
              onSelect={onSelect}
              reduceMotion={Boolean(reduceMotion)}
            />
          )}
        </div>

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
          <StageVisual
            image={focusImage}
            title={focusMeta?.label ?? (payload?.chapter ?? null)}
            query={
              focusStage ? (payload?.stages[focusStage]?.query ?? null) : (payload?.posterQuery ?? null)
            }
            match={focusStage ? (payload?.stages[focusStage]?.match ?? 'chapter') : 'stage_and_topic'}
          />

          {focusStage && focusMeta ? (
            <>
              <p className="text-sm text-slate-600">{focusMeta.blurb}</p>
              <BackToMap onClick={() => onSelect(null)} />
            </>
          ) : (
            <StageStrip
              variant="stack"
              statuses={statuses}
              payload={payload}
              selected={null}
              onSelect={onSelect}
            />
          )}
        </aside>
      </div>
    </LayoutGroup>
  );
}

/**
 * The opening view: one large image of this chapter's subject, with the ten
 * stages as choices across the bottom — the shape a branching scenario opens
 * in, before anything has been chosen.
 */
function EntryScene({
  payload,
  loading,
  failed,
  statuses,
  onSelect,
  reduceMotion,
}: {
  payload: JourneyImageMapPayload | null;
  loading: boolean;
  failed: boolean;
  statuses: Record<JourneyStageKey, StageStatus>;
  onSelect: (stage: JourneyStageKey | null) => void;
  reduceMotion: boolean;
}) {
  const poster = payload?.poster ?? null;

  return (
    <div className="relative h-full min-h-[24rem] w-full overflow-hidden bg-slate-900">
      {poster?.url ? (
        <motion.img
          layoutId="journey-focus"
          src={poster.url}
          alt={poster.title ?? `Pictures for ${payload?.chapter ?? 'your chapter'}`}
          transition={
            reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 30 }
          }
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        // No poster found is ordinary, not broken: the search is deliberately
        // strict. The chapter's name carries the opening screen on its own and
        // the stage nodes below still work.
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-800"
        />
      )}

      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-slate-950/45"
      />

      <div className="relative flex h-full flex-col justify-between gap-4 p-5 sm:p-6">
        <div className="max-w-xl text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
            {payload?.subject ?? 'Your journey'}
          </p>
          <h3 className="mt-1 text-2xl font-semibold sm:text-3xl">
            {payload?.chapter ?? 'Choose where to go'}
          </h3>
          <p className="mt-2 text-sm text-white/85">
            Pick a step to see what happens there. Nothing is decided by looking —
            opening a step only reads what is already yours.
          </p>
        </div>

        <div className="min-h-0">
          <StageStrip
            variant="overlay"
            statuses={statuses}
            payload={payload}
            selected={null}
            onSelect={onSelect}
          />
          <StatusLine loading={loading} failed={failed} payload={payload} />
          <ImageCredit image={poster} query={payload?.posterQuery ?? null} tone="dark" />
        </div>
      </div>
    </div>
  );
}

/**
 * The persistent picture: large and centred before a choice, small and fixed
 * on the right after one. One `layoutId`, so it is visibly the SAME picture
 * moving rather than two pictures swapping — which is what makes the step feel
 * chosen rather than merely navigated to.
 */
function StageVisual({
  image,
  title,
  query,
  match,
}: {
  image: JourneyImage | null;
  title: string | null;
  query: string | null;
  match: JourneyImageMatch;
}) {
  return (
    <figure className="space-y-2">
      {image?.url ? (
        <motion.img
          layoutId="journey-focus"
          src={image.url}
          alt={image.title ?? title ?? ''}
          transition={{ type: 'spring', stiffness: 220, damping: 30 }}
          className="aspect-4/3 w-full rounded-lg object-cover ring-1 ring-slate-200"
        />
      ) : (
        <div className="flex aspect-4/3 w-full items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500">
          No picture found for this step
        </div>
      )}
      <figcaption className="text-xs text-slate-600">
        {title}
        {image ? <MatchNote match={match} /> : null}
      </figcaption>
      <ImageCredit image={image} query={query} />
    </figure>
  );
}

/**
 * What this picture actually is, in words, under the node.
 *
 * The map is only as trustworthy as this sentence. Without it, a chapter's own
 * photo sitting under "Recall" reads as a picture of recalling, which it is
 * not — and a learner cannot tell a searched match from a stand-in by looking.
 * The tiers are stated plainly, including the unflattering one.
 */
function MatchNote({ match }: { match: JourneyImageMatch }) {
  if (match === 'stage_and_topic') {
    return (
      <span className="mt-1 block text-emerald-700">
        Found for this step and for this chapter.
      </span>
    );
  }
  if (match === 'stage') {
    return (
      <span className="mt-1 block">
        Found for this step. Related to your chapter, but not specific to it.
      </span>
    );
  }
  return (
    <span className="mt-1 block">
      No picture was found for this step — this is your chapter&rsquo;s picture.
    </span>
  );
}

function BackToMap({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-md border px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      Back to the whole journey
    </button>
  );
}

/**
 * The ten stage nodes, in two arrangements.
 *
 *   `overlay` — a row of picture cards across the bottom of the opening image,
 *     like the choices on a branching scenario's first screen. Also reused as a
 *     plain strip under an open stage, so a learner who learned where
 *     "Practice" is on the opening screen finds it in the same place afterwards.
 *   `stack`   — a narrow vertical list beside the opening image, for a screen
 *     too short for the row.
 *
 * Same buttons, same order, same state either way.
 */
function StageStrip({
  variant,
  statuses,
  payload,
  selected,
  onSelect,
}: {
  variant: 'overlay' | 'stack';
  statuses: Record<JourneyStageKey, StageStatus>;
  payload: JourneyImageMapPayload | null;
  selected: JourneyStageKey | null;
  onSelect: (stage: JourneyStageKey | null) => void;
}) {
  const onDark = variant === 'overlay' && !selected;

  return (
    <div
      role="list"
      className={cn(
        'flex gap-2 pb-1',
        variant === 'stack' ? 'flex-col overflow-visible' : 'flex-row overflow-x-auto'
      )}
    >
      {JOURNEY_MAP_STAGE_ORDER.map((stage) => {
        const meta = JOURNEY_STAGE_BY_KEY[stage];
        const status = statuses[stage];
        const stageImage: JourneyStageImage | undefined = payload?.stages[stage];
        const disabled = status === 'locked' || status === 'bypassed';
        const isSelected = selected === stage;
        const Icon = meta.icon;

        return (
          <button
            key={stage}
            role="listitem"
            type="button"
            disabled={disabled}
            aria-current={isSelected ? 'step' : undefined}
            onClick={() => onSelect(isSelected ? null : stage)}
            className={cn(
              'group relative flex shrink-0 items-center gap-2 rounded-lg border p-1.5 text-left transition',
              variant === 'stack' ? 'w-full' : 'w-44 flex-col items-stretch',
              disabled
                ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                : isSelected
                  ? 'border-indigo-600 bg-indigo-50'
                  : onDark
                    ? 'border-white/25 bg-slate-900/60 text-white hover:bg-slate-900/80'
                    : 'border-slate-200 bg-white hover:border-indigo-300'
            )}
          >
            <span
              className={cn(
                'relative block overflow-hidden rounded-md',
                variant === 'stack' ? 'h-10 w-10 shrink-0' : 'aspect-3/2 w-full'
              )}
            >
              {stageImage?.image?.thumbnailUrl ? (
                // Thumbnails come from Openverse's own hosts at runtime and are
                // not knowable at build time, so next/image's remotePatterns
                // cannot be enumerated for them. Raw <img>, as everywhere else
                // in this app that shows a runtime-discovered picture.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={stageImage.image.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center bg-slate-100 text-slate-500">
                  <Icon aria-hidden className={variant === 'stack' ? 'size-4' : 'size-6'} />
                </span>
              )}
            </span>

            <span className={cn('min-w-0', variant === 'stack' ? 'flex-1' : '')}>
              <span
                className={cn(
                  'flex items-center gap-1 text-xs font-semibold',
                  onDark ? 'text-white' : 'text-slate-900'
                )}
              >
                {meta.label}
                <StatusBadge status={status} onDark={onDark} />
              </span>
              {variant !== 'stack' ? (
                <span
                  className={cn(
                    'mt-0.5 block text-[0.7rem]',
                    onDark ? 'text-white/75' : 'text-slate-600'
                  )}
                >
                  {meta.blurb}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StatusBadge({ status, onDark }: { status: StageStatus; onDark: boolean }) {
  if (status === 'current') {
    return (
      <span className="rounded bg-indigo-600 px-1 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-white">
        Now
      </span>
    );
  }
  if (status === 'done') {
    return <Check aria-hidden className={cn('size-3', onDark ? 'text-emerald-300' : 'text-emerald-600')} />;
  }
  if (status === 'locked') {
    return <Lock aria-hidden className={cn('size-3', onDark ? 'text-white/70' : 'text-slate-400')} />;
  }
  if (status === 'bypassed') {
    return <Minus aria-hidden className={cn('size-3', onDark ? 'text-white/70' : 'text-slate-400')} />;
  }
  return null;
}

/**
 * License and attribution under every picture.
 *
 * Not decoration, and not optional in spirit: Openverse exists so a third-party
 * image can carry real, showable credit. The `query` is shown too — the point
 * of a searched image is that the learner can see what it was actually found
 * from, and it is the same honest signal as "this node is showing the
 * chapter's picture because its own step found nothing".
 */
function ImageCredit({
  image,
  query,
  tone = 'light',
}: {
  image: JourneyImage | null;
  query: string | null;
  tone?: 'light' | 'dark';
}) {
  if (!image) return null;
  const muted = tone === 'dark' ? 'text-white/70' : 'text-slate-500';

  return (
    <p className={cn('text-[0.7rem] leading-snug', muted)}>
      {image.creator ? `${image.creator} · ` : ''}
      {image.license ? `${image.license} · ` : ''}
      {image.sourceUrl ? (
        <a
          href={image.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2"
        >
          source
        </a>
      ) : (
        'source'
      )}
      {query ? <span className="block">searched for “{query}”</span> : null}
    </p>
  );
}

function StatusLine({
  loading,
  failed,
  payload,
}: {
  loading: boolean;
  failed: boolean;
  payload: JourneyImageMapPayload | null;
}) {
  if (loading) {
    return (
      <p className="mt-2 flex items-center gap-2 text-xs text-white/80" role="status">
        <Loader2 aria-hidden className="size-3 animate-spin" />
        Finding pictures for your journey…
      </p>
    );
  }

  if (failed) {
    return (
      <p className="mt-2 text-xs text-white/85">
        Your journey is here, but its pictures could not be loaded. The step list still works.
      </p>
    );
  }

  if (!payload) return null;

  const found = Object.values(payload.stages).filter((entry) => entry?.image).length;
  if (found === 0) return null;

  return (
    <p className="mt-2 text-xs text-white/75">
      {found} of {JOURNEY_MAP_STAGE_ORDER.length} steps found a picture.
    </p>
  );
}

// --- stage status ----------------------------------------------------------

/**
 * The same resolution order `JourneyRail` uses, so a node and a rail row never
 * disagree about what is done: current, then bypassed, then locked, then done
 * (explicitly completed OR behind the current stage), then ahead.
 *
 * The one deliberate difference is that an AHEAD stage is clickable here. In
 * the rail, `selectable` required `isDone || isCurrent`, because jumping the
 * queue in the journey itself is not a thing a learner may do. In the map,
 * clicking a stage only READS what is already stored about it — nothing is
 * skipped, marked or decided — so looking ahead is safe, and a journey map you
 * cannot look ahead in is not much of a map. Locked and bypassed stages stay
 * disabled: those are "not available" and "not needed", which are different
 * answers and neither is the learner's to override.
 */
function buildStatuses(input: {
  current: JourneyStageKey;
  completed: readonly JourneyStageKey[];
  locked: readonly JourneyStageKey[];
  bypassed: readonly JourneyStageKey[];
}): Record<JourneyStageKey, StageStatus> {
  const currentIndex = JOURNEY_MAP_STAGE_ORDER.indexOf(input.current);
  const doneSet = new Set<JourneyStageKey>(input.completed);
  const lockedSet = new Set<JourneyStageKey>(input.locked);
  const bypassedSet = new Set<JourneyStageKey>(input.bypassed);

  return Object.fromEntries(
    JOURNEY_MAP_STAGE_ORDER.map((stage, index) => {
      let status: StageStatus;
      if (stage === input.current) status = 'current';
      else if (bypassedSet.has(stage) || CONDITIONAL_STAGES.includes(stage)) status = 'bypassed';
      else if (lockedSet.has(stage)) status = 'locked';
      else if (doneSet.has(stage) || index < currentIndex) status = 'done';
      else status = 'ahead';

      return [stage, status];
    })
  ) as Record<JourneyStageKey, StageStatus>;
}