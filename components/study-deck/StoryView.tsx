'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Flag, Lightbulb, Maximize2, Route, RotateCcw, Undo2 } from 'lucide-react';

import {
  advance,
  choiceOf,
  choose,
  continueStory,
  decisionsTaken,
  initialScenario,
  nodeOf,
  picturesFor,
  restart,
  storyProgress,
  variantFor,
  type ScenarioState,
} from '@/lib/study-deck/interactions';
import { assetUrl } from '@/lib/study-deck/deck';
import { failedPictureLabel, imageAttemptKey, imageFailed, imageLoaded, INITIAL_IMAGE_LOAD, type ImageLoadState } from '@/lib/study-deck/imageLoad';
import { containedRect, captionText, regionInBox, usableRegion } from '@/lib/study-deck/picture';
import {
  calloutSide,
  closeStoryHotspot,
  discoveredSummary,
  initialStoryHotspots,
  openStoryHotspot,
  storyHotspotProgress,
  storySpots,
  type StoryHotspotState,
} from '@/lib/study-deck/storyHotspots';
import type { DeckImage, ScenarioInteraction } from '@/lib/study-deck/types';
import { DeckPin } from './DeckPin';
import { PartCallout } from './PartCallout';
import { webSource } from '@/lib/study-deck/imageCredit';
import { creditOf, PictureDialog, Tag, TONES, useRememberedReducer, useStage } from './stage-ui';
import { SceneImageButton } from './ImageEditing';

export interface StoryViewProps {
  interaction: ScenarioInteraction;
  done: boolean;
  /** Called once, the first time a path reaches an ending. */
  onDone: () => void;
  /** The slide's title and explanation, kept for screen readers (the story draws its own headings). */
  lead: ReactNode;
  memoryKey: string;
  /** The slide's own picture, used for a scene that has none of its own. */
  image?: DeckImage | null;
  assetBase?: string | null;
}

type Action = { type: 'continue' } | { type: 'choose'; id: string } | { type: 'next' } | { type: 'again' } | { type: 'restart' };

/**
 * A story act as the Study Deck V3 player draws it (selected by `interaction.template === STORY_TEMPLATE`, see SlideView).
 *
 * Each scene reads the way a good explainer does: a large picture of what is happening, the situation and what a character notices,
 * then (when the scene teaches something) a plain-language explanation of the idea, then the way on. A decision offers its choices as
 * cards; the learner sees what happens because of the one they picked, and what the science says about it, then continues to the scene
 * that choice leads to. Where branches meet, the scene opens with a short lead-in for the path the learner came by. A path finishes at an
 * ending. The navigation is the existing scenario state machine (lib/study-deck/interactions.ts): this component adds no state of its own
 * beyond it (apart from which supporting picture is showing). Nothing is scored.
 */
export function StoryView({ interaction, done, onDone, lead, memoryKey, image, assetBase }: StoryViewProps) {
  const { portrait } = useStage();
  const [state, dispatch] = useRememberedReducer(memoryKey, (s: ScenarioState, a: Action) => {
    switch (a.type) {
      case 'continue':
        return continueStory(interaction, s);
      case 'choose':
        return choose(interaction, s, a.id);
      case 'next':
        return advance(interaction, s);
      case 'again':
        return { ...s, chosen: null, path: s.path.filter((step) => step.nodeId !== s.nodeId) };
      case 'restart':
        return restart(interaction, s);
    }
  }, () => initialScenario(interaction));

  const node = nodeOf(interaction, state.nodeId);
  const picked = choiceOf(node, state.chosen);
  const progress = storyProgress(interaction, state);
  const reported = useRef(done);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const atOpening = state.nodeId === interaction.start && !state.ended;

  useEffect(() => {
    if (state.ended && !reported.current) {
      reported.current = true;
      onDone();
    }
  }, [state.ended, onDone]);

  // Land on the new scene so a keyboard or screen-reader user starts reading it.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus({ preventScroll: true });
  }, [state.nodeId, state.chosen, state.ended]);

  if (!node) return null;
  const own = picturesFor(interaction, state, node);
  const pictures = own.length > 0 ? own : atOpening && image ? [image] : [];
  const lead_in = node.kind === 'decision' ? null : variantFor(interaction, state, node);
  const button = 'inline-flex items-center gap-[0.4em] rounded-[0.7em] px-[1em] py-[0.5em] text-[0.85em] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sd-accent';
  const primary = `${button} bg-sd-accent text-white hover:bg-sd-strong`;
  const quiet = `${button} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`;

  const explain = node.explain ? (
    <div className="rounded-[1em] border border-sky-200 bg-sky-50/90 p-[0.9em]" data-testid="story-explain">
      <p className="mb-[0.25em] flex items-center gap-[0.4em] text-[0.62em] font-bold uppercase tracking-wider text-sky-800">
        <Lightbulb className="h-[1.2em] w-[1.2em]" aria-hidden="true" />
        What is going on{node.explain.title ? `: ${node.explain.title}` : ''}
      </p>
      <p className={`${portrait ? 'text-[0.92em]' : 'text-[1em]'} leading-snug text-slate-900`}>{node.explain.body}</p>
    </div>
  ) : null;

  const leadIn = lead_in ? (
    <p className="rounded-[0.9em] border border-amber-200 bg-amber-50/90 px-[0.9em] py-[0.55em] text-[0.92em] leading-snug text-amber-950" data-testid="story-variant">
      <span className="mr-[0.4em] inline-flex items-center gap-[0.3em] text-[0.7em] font-bold uppercase tracking-wider text-amber-800">
        <Route className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
        On your path
      </span>{' '}
      {lead_in}
    </p>
  ) : null;

  let content: ReactNode;
  let actions: ReactNode = null;

  if (node.kind === 'ending') {
    const taken = decisionsTaken(interaction, state);
    const list = (
      <ol className="space-y-[0.25em] text-[0.8em] text-slate-700" aria-label="The decisions you made">
        {taken.map(({ node: n, choice }) => (
          <li key={n.id}>
            <span className="font-medium">{n.prompt}</span> <span aria-hidden="true">→</span> {choice.text}
          </li>
        ))}
      </ol>
    );
    content = (
      <div className="space-y-[0.7em]">
        <Tag tone="emerald">
          <Flag className="h-[1em] w-[1em]" aria-hidden="true" />
          Ending
        </Tag>
        {leadIn}
        <h3 ref={heading} tabIndex={-1} className={`${portrait ? 'text-[1.3em]' : 'text-[1.5em]'} font-semibold leading-tight text-slate-900 outline-none`}>
          {node.title}
        </h3>
        <p className={`rounded-[0.9em] border border-emerald-200 bg-emerald-50 leading-snug text-emerald-950 ${portrait ? 'p-[0.75em] text-[0.95em]' : 'p-[1em] text-[1.05em]'}`}>{node.body}</p>
        {explain}
        {interaction.conclusion ? <p className="text-[0.9em] leading-snug text-slate-800">{interaction.conclusion}</p> : null}
        {/* On a narrow screen the list of decisions folds away, so the ending and its "different path" button stay in view. */}
        {portrait && taken.length > 0 ? (
          <details className="text-[0.8em] text-slate-700" data-testid="story-decisions">
            <summary className="cursor-pointer font-medium">The decisions you made ({taken.length})</summary>
            <div className="mt-[0.4em]">{list}</div>
          </details>
        ) : (
          list
        )}
      </div>
    );
    actions = (
      <div className="flex items-center gap-[0.8em]">
        <button type="button" onClick={() => dispatch({ type: 'restart' })} className={quiet} data-testid="story-restart">
          <RotateCcw className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
          Take a different path
        </button>
        <span className="text-[0.7em] text-slate-600">
          You have tried {progress.decisionsTried} of {progress.decisionsTotal} choices.
        </span>
      </div>
    );
  } else if (node.kind === 'decision' && picked) {
    content = (
      <div className="space-y-[0.7em]" aria-live="polite">
        <h3 ref={heading} tabIndex={-1} className="text-[1.1em] font-semibold text-slate-900 outline-none">
          {node.prompt}
        </h3>
        <p className="rounded-[0.7em] border border-slate-200 bg-slate-50 px-[0.9em] py-[0.5em] text-[0.95em] text-slate-800">
          <span className="text-[0.7em] font-semibold uppercase tracking-wider text-slate-500">You chose </span>
          <br />
          {picked.text}
        </p>
        <div className="space-y-[0.5em] rounded-[1em] border-2 border-l-[0.4em] border-sd-line border-l-sd-accent bg-white/90 p-[1em] shadow-[0_0.2em_0.9em_rgba(15,23,42,0.1)]">
          <p className="text-[1.02em] leading-snug text-slate-900" data-testid="story-event">
            <span className="font-semibold">What happens: </span>
            {picked.outcome}
          </p>
          <p className="text-[1.02em] leading-snug text-slate-900" data-testid="story-why">
            <span className="font-semibold">What the science says: </span>
            {picked.why}
          </p>
        </div>
      </div>
    );
    actions = (
      <div className="flex flex-wrap gap-[0.6em]">
        <button type="button" onClick={() => dispatch({ type: 'again' })} className={quiet}>
          <Undo2 className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
          Choose differently
        </button>
        <button type="button" onClick={() => dispatch({ type: 'next' })} className={primary} data-testid="story-next">
          Continue the story
          <ArrowRight className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
        </button>
      </div>
    );
  } else if (node.kind === 'decision') {
    content = (
      <div className="space-y-[0.7em]">
        {node.body ? <p className="text-[1em] leading-snug text-slate-800">{node.body}</p> : null}
        <h3 ref={heading} tabIndex={-1} className={`${portrait ? 'text-[1.2em]' : 'text-[1.4em]'} font-semibold leading-tight text-slate-900 outline-none`}>
          {node.prompt}
        </h3>
        <ul className="space-y-[0.55em]" aria-label="Your choices">
          {node.choices.map((choice, index) => (
            <li key={choice.id}>
              <button
                type="button"
                onClick={() => dispatch({ type: 'choose', id: choice.id })}
                data-testid="story-choice"
                data-choice={choice.id}
                className="group flex min-h-[3.2em] w-full items-center gap-[0.8em] rounded-[1em] border-2 border-sd-line bg-white px-[1em] py-[0.65em] text-left text-[1em] leading-snug text-slate-900 shadow-sm transition hover:border-sd-accent hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent"
              >
                <span aria-hidden="true" className={`flex h-[1.6em] w-[1.6em] shrink-0 items-center justify-center rounded-full text-[0.8em] font-bold text-white ${TONES[index % TONES.length].dot}`}>
                  {index + 1}
                </span>
                {choice.text}
              </button>
            </li>
          ))}
        </ul>
        <p className="text-[0.75em] text-slate-600">Choose what you would do. The story goes on from your choice.</p>
      </div>
    );
  } else {
    content = (
      <div className="space-y-[0.7em]">
        {atOpening && interaction.mission ? (
          <div className="rounded-[1em] border-l-[0.35em] border-sd-accent bg-white/90 p-[0.9em] shadow-[0_0.2em_0.9em_rgba(15,23,42,0.12)]" data-testid="story-mission">
            <p className="mb-[0.2em] text-[0.62em] font-bold uppercase tracking-wider text-sd-strong">Your mission</p>
            <p className="text-[0.95em] leading-snug text-slate-900">{interaction.mission.body}</p>
          </div>
        ) : null}
        {leadIn}
        <h3 ref={heading} tabIndex={-1} className={`${portrait ? 'text-[1.3em]' : 'text-[1.5em]'} font-semibold leading-tight text-slate-900 outline-none`}>
          {node.title}
        </h3>
        <p className={`${portrait ? 'text-[1em]' : 'text-[1.08em]'} leading-snug text-slate-900`} data-testid="story-body">
          {node.body}
        </p>
        {explain}
      </div>
    );
    actions = (
      <div>
        <button type="button" onClick={() => dispatch({ type: 'continue' })} className={primary} data-testid="story-continue">
          Continue
          <ArrowRight className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
        </button>
      </div>
    );
  }

  const text = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[0.6em]">
      {/* The slide's title stays for screen readers and the focus target; the story's own headings are what is drawn. */}
      <div className="sr-only">{lead}</div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-[0.3em]" data-testid="story-text">
        {content}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );

  return (
    <section aria-label="The story" data-testid="story-view" data-node={node.id} data-kind={node.kind} className="flex h-full min-h-0 flex-col gap-[0.7em] p-[1.2em]">
      <div className="flex flex-wrap items-center gap-[0.8em]" data-testid="story-progress">
        <Tag>
          <BookOpen className="h-[1em] w-[1em]" aria-hidden="true" />
          {interaction.mission?.title ?? 'The story'}
        </Tag>
        <span className="text-[0.7em] text-slate-700" data-testid="story-position">
          {state.ended ? 'The story has reached an ending' : `Scene ${progress.position} of ${progress.total}`}
        </span>
        <span className="h-[0.45em] min-w-[6em] flex-1 overflow-hidden rounded-full bg-sd-soft" role="progressbar" aria-label="Story progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
          <span className="block h-full rounded-full bg-sd-accent transition-[width]" style={{ width: `${progress.percent}%` }} />
        </span>
        <SceneImageButton node={node.id} />
        {done || state.ended ? (
          <span className="inline-flex items-center gap-[0.3em] text-[0.7em] font-medium text-emerald-700">
            <CheckCircle2 className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
            Explored
          </span>
        ) : null}
      </div>

      {pictures.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col">{text}</div>
      ) : portrait ? (
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,34%)_minmax(0,1fr)] gap-[0.7em]">
          <StoryPictures key={node.id} images={pictures} assetBase={assetBase} portrait />
          {text}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,6fr)_minmax(0,6fr)] gap-[1.2em]">
          <StoryPictures key={node.id} images={pictures} assetBase={assetBase} portrait={false} />
          {text}
        </div>
      )}
    </section>
  );
}

/**
 * The scene's pictures: the main one drawn large (it is what the learner is looking at), the part to notice highlighted on it when the
 * picture check found one, a caption that says what to notice, the credit, and the supporting pictures as small tiles that swap into the
 * main place. The main picture opens at full size. The highlight can be switched off, and it is also described in words by the caption.
 */
function StoryPictures({ images, assetBase, portrait }: { images: DeckImage[]; assetBase: string | null | undefined; portrait: boolean }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(true);
  const box = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0, x: 0, y: 0 });
  const wrap = useRef<HTMLDivElement>(null);
  // Which parts of each picture have been opened (a picture with parts is explored like a hotspots slide).
  const [explored, setExplored] = useState<Record<string, StoryHotspotState>>({});
  // How each picture of this scene has loaded: one retry of the same address after a failure, then a labelled frame (see lib/study-deck/imageLoad.ts).
  const [loads, setLoads] = useState<Record<string, ImageLoadState>>({});
  const main = images[Math.min(index, images.length - 1)];
  const src = assetUrl(main.url, assetBase ?? null);
  const load = loads[main.url] ?? INITIAL_IMAGE_LOAD;
  const region = usableRegion(main.focus);
  const caption = captionText(main.caption, { photo: main.type === 'photo', highlighted: region !== null });

  // Where the picture really sits inside its box (it is scaled to fit, so there are usually empty bands), to place the highlight on it.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => {
      const b = el.getBoundingClientRect();
      const w = wrap.current?.getBoundingClientRect();
      setSize({ w: el.clientWidth, h: el.clientHeight, x: w ? b.left - w.left : 0, y: w ? b.top - w.top : 0 });
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);

    return () => observer.disconnect();
  }, [main.url]);
  const picture = containedRect(size.w, size.h, main.width, main.height);
  const mark = region !== null && shown && picture.width > 0 ? regionInBox(picture, region) : null;
  const spots = load.status === 'failed' ? [] : storySpots(main);
  const hstate = explored[main.url] ?? initialStoryHotspots();
  const hprogress = storyHotspotProgress(spots, hstate);
  const activeIndex = spots.findIndex((spot) => spot.id === hstate.active);

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-[0.4em]" data-testid="story-pictures">
      <div ref={wrap} className="relative flex min-h-0 flex-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`View the picture larger: ${main.alt}`}
          className="group relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[1em] border-[0.15em] border-white bg-slate-100 shadow-[0_0.3em_1.1em_rgba(15,23,42,0.18),0_0_0_0.06em_var(--sd-line)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent"
        >
          <span ref={box} className="relative block h-full w-full">
            {load.status === 'failed' ? (
              <span
                role="img"
                aria-label={failedPictureLabel(main.alt)}
                data-testid="story-picture-failed"
                className="flex h-full w-full items-center justify-center p-[1em] text-center text-[0.8em] font-semibold text-slate-700"
              >
                {failedPictureLabel(main.alt)}
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- deck images are our own stored files or local review copies
              <img
                key={imageAttemptKey(main.url, load)}
                src={src}
                alt={main.alt}
                data-testid="story-picture"
                data-load-state={load.status}
                onLoad={() => setLoads((prev) => ({ ...prev, [main.url]: imageLoaded(prev[main.url]) }))}
                onError={() => setLoads((prev) => ({ ...prev, [main.url]: imageFailed(prev[main.url]) }))}
                className="block h-full w-full object-contain"
              />
            )}
            {mark && main.focus_label ? (
              <span
                aria-hidden="true"
                data-testid="story-highlight-label"
                className="pointer-events-none absolute max-w-[60%] truncate rounded-[0.35em] bg-amber-400 px-[0.5em] py-[0.1em] text-[0.62em] font-bold text-slate-900 shadow"
                style={{ left: mark.left, top: Math.max(0, mark.top - 18) }}
              >
                {main.focus_label}
              </span>
            ) : null}
            {mark ? (
              <span
                aria-hidden="true"
                data-testid="story-highlight"
                className="pointer-events-none absolute rounded-[0.35em] border-[0.2em] border-amber-400"
                style={{ left: mark.left, top: mark.top, width: mark.width, height: mark.height, boxShadow: '0 0 0 100vmax rgba(15, 23, 42, 0.32)' }}
              />
            ) : null}
          </span>
          <span className="absolute bottom-[0.4em] right-[0.4em] inline-flex items-center gap-[0.3em] rounded-full bg-slate-900/70 px-[0.6em] py-[0.2em] text-[0.6em] font-semibold text-white opacity-90">
            <Maximize2 className="h-[1em] w-[1em]" aria-hidden="true" />
            View larger
          </span>
        </button>
        {spots.length > 0 && picture.width > 0 ? (
          <div
            data-testid="story-hotspots"
            className="pointer-events-none absolute z-10 [&_button]:pointer-events-auto"
            style={{ left: size.x + picture.left, top: size.y + picture.top, width: picture.width, height: picture.height }}
          >
            {spots.map((spot, i) => (
              <DeckPin
                key={spot.id}
                index={i}
                x={(spot.pin ?? spot).x}
                y={(spot.pin ?? spot).y}
                name={`${spot.label}: open the explanation`}
                selected={hstate.active === spot.id}
                explored={hstate.opened.includes(spot.id)}
                compact={picture.width < 360}
                onSelect={() => setExplored((prev) => ({ ...prev, [main.url]: openStoryHotspot(prev[main.url] ?? initialStoryHotspots(), spots, spot.id) }))}
              />
            ))}
            {activeIndex >= 0 ? (
              <PartCallout
                number={activeIndex + 1}
                title={spots[activeIndex].label}
                text={spots[activeIndex].text}
                assetBase={assetBase}
                placement={calloutSide(spots[activeIndex])}
                onClose={() => setExplored((prev) => ({ ...prev, [main.url]: closeStoryHotspot(prev[main.url] ?? initialStoryHotspots()) }))}
              />
            ) : null}
          </div>
        ) : null}
        {region !== null ? (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-pressed={shown}
            data-testid="story-highlight-toggle"
            className="absolute right-[0.5em] top-[0.5em] rounded-full bg-white/90 px-[0.6em] py-[0.2em] text-[0.6em] font-semibold text-slate-800 shadow hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent"
          >
            {shown ? 'Hide highlight' : 'Show highlight'}
          </button>
        ) : null}
      </div>
      {caption ? (
        <p className="shrink-0 text-[0.72em] font-medium leading-snug text-slate-800" data-testid="story-caption">
          {caption}
        </p>
      ) : null}
      {spots.length > 0 ? (
        <p className="shrink-0 text-[0.68em] font-semibold text-sd-strong" data-testid="story-hotspot-progress" aria-live="polite">
          {hprogress.done ? `${discoveredSummary(spots)} All ${hprogress.total} parts explored.` : `Explore the picture: ${hprogress.opened} of ${hprogress.total} parts opened. Select a numbered pin.`}
        </p>
      ) : null}
      <div className="flex shrink-0 items-center gap-[0.5em]">
        <p className="min-w-0 flex-1 truncate text-[0.58em] text-slate-600" data-testid="story-credit">
          {creditOf(main)}
          {webSource(main) !== null ? (
            <>
              {' · '}
              <a href={webSource(main) ?? undefined} target="_blank" rel="noreferrer noopener" className="text-indigo-700 underline" data-testid="story-source">
                Source
              </a>
            </>
          ) : null}
        </p>
        {images.length > 1
          ? images.map((tile, i) => (
              <button
                key={`${tile.url}-${i}`}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show picture ${i + 1} of ${images.length}: ${tile.alt}`}
                aria-pressed={i === index}
                data-testid="story-picture-tile"
                className={`shrink-0 overflow-hidden rounded-[0.5em] border-2 bg-white ${i === index ? 'border-sd-accent' : 'border-slate-200 opacity-80 hover:opacity-100'} ${portrait ? 'h-[2.2em] w-[3.4em]' : 'h-[2.8em] w-[4.4em]'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- deck images are our own stored files or local review copies */}
                <img src={assetUrl(tile.url, assetBase ?? null)} alt="" className="block h-full w-full object-cover" />
              </button>
            ))
          : null}
      </div>
      {open ? <PictureDialog image={main} src={src} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
