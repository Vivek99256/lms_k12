'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Circle, MousePointerClick, X } from 'lucide-react';

import { cameraFor, focusCamera } from '@/lib/study-deck/camera';
import { assetUrl } from '@/lib/study-deck/deck';
import { closeHotspot, hotspotProgress, initialHotspots, openHotspot, type HotspotState } from '@/lib/study-deck/interactions';
import type { DeckImage, HotspotsInteraction, HotspotSpot } from '@/lib/study-deck/types';
import { DeckPin } from './DeckPin';
import { OsmosisLab } from './OsmosisLab';
import { PartThumb } from './PartThumb';
import { PartCallout } from './PartCallout';
import { PANEL, Tag, useRememberedReducer, useStage, useTheme, VisualFigure } from './stage-ui';

export interface HotspotsViewProps {
  interaction: HotspotsInteraction;
  image: DeckImage;
  assetBase: string | null;
  /** The learner has already explored this one (they came back to the slide). */
  done: boolean;
  /** Called once, when the last part has been opened. */
  onDone: () => void;
  /** The slide's title and explanation, drawn above the parts list. */
  lead: ReactNode;
  /** Where this screen's state is kept for the session. */
  memoryKey: string;
  /** The professional look names the slide in a slim header instead of the large lead. */
  heading?: { kicker: string; title: string };
}

type Action = { type: 'open'; id: string } | { type: 'close' };

/** The band of a process drawing that holds its parts, when a live model takes the rest of the room (shares of the picture height). */
const LAB_CROP = { top: 33, bottom: 70 } as const;

/** The side of the picture an explanation opens on: away from the part, so the camera can keep the part clear of it. */
function cardSide(x: number): 'left' | 'right' {
  return x >= 50 ? 'left' : 'right';
}

/**
 * Where a part's numbered pin sits. A part may name its own spot (`pin`), chosen beside the structure so the pin never covers
 * it. Otherwise: on a picture a person marked by hand it sits on the part's centre; on a labelled box it sits on the corner,
 * so it never covers the label.
 */
function pinAt(spot: HotspotSpot, onPicture: boolean): { x: number; y: number } {
  if (spot.pin) return spot.pin;

  return onPicture ? { x: spot.x, y: spot.y } : { x: Math.max(0, spot.x - spot.w / 2), y: Math.max(0, spot.y - spot.h / 2) };
}

/**
 * Image Hotspots as a presentation slide: the drawn diagram takes most of the screen with its numbered parts on
 * it; selecting a part highlights it and opens a compact card over the picture (placed away from the part, so the
 * diagram stays visible) and marks the part explored. The learner never leaves the slide.
 *
 * Reuse: the pin is the H5P image-hotspots marker and "explored" is the same coverage rule the H5P module scores
 * with (`scoreHotspotVisit`). Nothing is marked: this is exploration.
 */
export function HotspotsView({ interaction, image, assetBase, done, onDone, lead, memoryKey, heading }: HotspotsViewProps) {
  const { portrait } = useStage();
  // The professional theme: the picture is the slide, with plain "+" buttons and the explanation opening over it (as in an H5P hotspot picture).
  const pro = useTheme().key === 'navy';
  const [state, dispatch] = useRememberedReducer(
    memoryKey,
    (s: HotspotState, a: Action) => (a.type === 'open' ? openHotspot(s, interaction, a.id) : closeHotspot(s)),
    initialHotspots
  );
  const progress = hotspotProgress(interaction, state);
  // A live model beside the picture, driven by the same selected part: one selection for the list, the diagram and the model.
  const labStep = interaction.lab === 'osmosis' ? interaction.spots.findIndex((spot) => spot.id === state.active) : -1;
  const lab =
    interaction.lab === 'osmosis' ? (
      <OsmosisLab step={labStep >= 0 ? labStep : null} onSelect={(index) => dispatch({ type: 'open', id: interaction.spots[index].id })} />
    ) : null;
  const active = interaction.spots.find((spot) => spot.id === state.active) ?? null;
  const reported = useRef(done);
  const finished = progress.done || done;
  // The explanation opens against the edge of the picture away from the part. Once the camera has settled it is measured against the
  // selected pin, and moved to the other edge if the two touch, so the explanation never sits on the part it explains.
  const stage = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState<string | null>(null);
  const [place, setPlace] = useState<{ id: string; side: 'left' | 'right'; at: 'top' | 'bottom' } | null>(null);
  const activeId = state.active;
  // The professional look picks the corner of the picture for the explanation that covers neither the part it explains nor another marker.
  useEffect(() => {
    if (!pro || !activeId) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const picture = stage.current;
      const card = picture?.querySelector<HTMLElement>('[data-testid="part-callout"]');
      const parent = card?.offsetParent;
      const spot = interaction.spots.find((s) => s.id === activeId);
      if (!picture || !card || !(parent instanceof HTMLElement) || !spot) return;
      const pic = picture.getBoundingClientRect();
      const box = parent.getBoundingClientRect();
      const size = card.getBoundingClientRect();
      const part = {
        left: pic.left + ((spot.x - spot.w / 2) / 100) * pic.width,
        right: pic.left + ((spot.x + spot.w / 2) / 100) * pic.width,
        top: pic.top + ((spot.y - spot.h / 2) / 100) * pic.height,
        bottom: pic.top + ((spot.y + spot.h / 2) / 100) * pic.height,
      };
      const pins = Array.from(picture.querySelectorAll('[data-testid="deck-pin"]')).map((el) => el.getBoundingClientRect());
      const near = cardSide(spot.x);
      const sides = near === 'left' ? (['left', 'right'] as const) : (['right', 'left'] as const);
      let best = { cost: Infinity, side: sides[0] as 'left' | 'right', at: 'top' as 'top' | 'bottom' };
      for (const side of sides) {
        for (const at of ['top', 'bottom'] as const) {
          const left = side === 'left' ? box.left + box.width * 0.025 : box.right - box.width * 0.025 - size.width;
          const top = at === 'top' ? box.top + box.height * 0.05 : box.bottom - box.height * 0.05 - size.height;
          const rect = { left, top, right: left + size.width, bottom: top + size.height };
          const hit = (a: { left: number; right: number; top: number; bottom: number }, b: { left: number; right: number; top: number; bottom: number }, pad = 0) =>
            Math.max(0, Math.min(a.right, b.right + pad) - Math.max(a.left, b.left - pad)) * Math.max(0, Math.min(a.bottom, b.bottom + pad) - Math.max(a.top, b.top - pad));
          const share = hit(rect, part) / Math.max(1, (part.right - part.left) * (part.bottom - part.top));
          const covered = pins.filter((p) => hit(rect, p, 6) > 0).length;
          const cost = share * 8 + covered * 3;
          if (cost < best.cost - 1e-6) best = { cost, side, at };
        }
      }
      setPlace({ id: activeId, side: best.side, at: best.at });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeId, pro, interaction.spots]);
  useEffect(() => {
    if (pro || !activeId) return undefined;
    const timer = window.setTimeout(() => {
      const pin = stage.current?.querySelector('[data-testid="deck-pin"][data-selected="true"]')?.getBoundingClientRect();
      const card = stage.current?.querySelector('[data-testid="part-callout"]')?.getBoundingClientRect();
      setFlipped(pin && card && !(pin.right < card.left || pin.left > card.right || pin.bottom < card.top || pin.top > card.bottom) ? activeId : null);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [activeId, pro]);

  useEffect(() => {
    if (progress.done && !reported.current) {
      reported.current = true;
      onDone();
    }
  }, [progress.done, onDone]);

  const onPicture = pro || image.annotated === true;
  const pins = useMemo(() => interaction.spots.map((spot) => pinAt(spot, onPicture)), [interaction.spots, onPicture]);
  // Ease toward the open part, but only as far as keeps every part (and its pin) in view and clickable.
  const camera = useMemo(
    () =>
      active && onPicture
        ? focusCamera({ x: active.x, y: active.y }, Math.max(active.w, active.h), cardSide(active.x))
        : active
        ? cameraFor(
            { x: active.x, y: active.y },
            interaction.spots.flatMap((spot, index) => [{ x: spot.x, y: spot.y }, pins[index]])
          )
        : null,
    [active, interaction.spots, pins, onPicture]
  );

  const figure = (
    <VisualFigure
      image={image}
      assetBase={assetBase}
      camera={camera}
      crop={interaction.lab ? LAB_CROP : null}
    >
      {interaction.spots.map((spot, index) => {
        const opened = state.opened.includes(spot.id);
        const isActive = state.active === spot.id;

        return (
          <div key={spot.id}>
            {/* The whole labelled box is a target and shows the selection; the pin is the keyboard and screen-reader control. */}
            <div
              aria-hidden="true"
              onClick={() => dispatch({ type: 'open', id: spot.id })}
              className={`absolute cursor-pointer rounded-lg border-2 transition-colors ${
                isActive
                  ? onPicture
                    ? // The rest of the picture is dimmed around the open part (the frame clips the shadow), so the part stands out and what is outside it recedes.
                      'border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.26)] ring-2 ring-sd-accent'
                    : 'border-sd-accent bg-sd-accent/10'
                  : opened && !onPicture
                    ? 'border-emerald-500/60'
                    : 'border-transparent hover:border-sd-accent hover:bg-sd-accent/5'
              }`}
              style={{ left: `${spot.x - spot.w / 2}%`, top: `${spot.y - spot.h / 2}%`, width: `${spot.w}%`, height: `${spot.h}%` }}
            />
            <DeckPin
              index={index}
              x={pins[index].x}
              y={pins[index].y}
              name={spot.label}
              selected={isActive}
              callout={onPicture && isActive ? spot.label : undefined}
              calloutLeft={pins[index].x > 55}
              compact={portrait}
              plus={pro}
              scale={1 / (camera?.zoom ?? 1)}
              explored={opened || done}
              onSelect={() => dispatch({ type: 'open', id: spot.id })}
            />
          </div>
        );
      })}
    </VisualFigure>
  );

  const status = (
    <div className="flex items-center gap-[0.6em]">
      <Tag>
        <MousePointerClick className="h-[1em] w-[1em]" aria-hidden="true" />
        Explore the diagram
      </Tag>
      <span role="status" className="text-[0.7em] font-medium text-slate-600">
        {finished ? 'All parts explored' : `${progress.opened} of ${progress.total} explored`}
      </span>
    </div>
  );

  const explanation = active ? (
    <>
      <div className="flex items-start justify-between gap-[0.5em]">
        <h3 className="text-[1.05em] font-semibold text-slate-900">{active.label}</h3>
        <button
          type="button"
          onClick={() => dispatch({ type: 'close' })}
          className="rounded-[0.4em] p-[0.2em] text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent"
          aria-label="Close explanation"
        >
          <X className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-[0.15em] text-[0.9em] leading-snug text-slate-800">{active.text}</p>
    </>
  ) : null;

  // A narrow screen: the picture is the lesson, so it comes right after the title and takes the room it can; the parts
  // are a row of numbered names under it and the explanation opens under those, never over the picture.
  if (portrait) {
    return (
      <section aria-label="Explore the diagram" className="flex h-full min-h-0 flex-col gap-[0.6em] p-[1.1em]">
        {lead}
        <div className={lab ? 'min-h-[5em] flex-[2]' : 'min-h-[6em] flex-1'}>{figure}</div>
        {lab ? <div className="min-h-[14em] flex-[3]">{lab}</div> : null}
        <ul className="flex flex-wrap gap-[0.35em]" aria-label="Parts of the diagram">
          {interaction.spots.map((spot, index) => {
            const opened = state.opened.includes(spot.id);

            return (
              <li key={spot.id}>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'open', id: spot.id })}
                  aria-current={state.active === spot.id ? 'true' : undefined}
                  className={`inline-flex items-center gap-[0.4em] rounded-full border px-[0.55em] py-[0.15em] text-[0.7em] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent ${
                    state.active === spot.id ? 'border-sd-accent bg-sd-soft text-sd-strong' : 'border-sd-line bg-white/90 text-slate-800'
                  }`}
                >
                  <span className="flex h-[1.5em] w-[1.5em] shrink-0 items-center justify-center rounded-full bg-sd-accent text-[0.85em] font-bold tabular-nums text-white">{index + 1}</span>
                  {spot.image ? <PartThumb image={spot.image} assetBase={assetBase} /> : null}
                  {spot.label}
                  {opened || done ? <CheckCircle2 className="h-[1.1em] w-[1.1em] shrink-0 text-emerald-600" aria-label="Explored" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
        <div role="region" aria-label="Explanation" aria-live="polite" className={`min-h-[4.6em] shrink-0 rounded-[0.9em] border-2 p-[0.7em] ${active ? 'border-sd-accent bg-white shadow-md' : 'border-dashed border-sd-line bg-white/60'}`}>
          {explanation ?? <p className="text-[0.8em] text-slate-600">{finished ? interaction.wrapup : 'Select a numbered marker or a name to read about that part.'}</p>}
        </div>
        {status}
      </section>
    );
  }

  // Professional: the picture IS the slide, edge to edge. The title and the line below sit on translucent bars, the "+" buttons are on the
  // picture itself, and the chosen part is lit while the rest is dimmed, with its explanation opening beside it. No frame, no credit line.
  if (pro && !portrait) {
    // An illustration that has a paper colour of its own (`bg`) is shown whole on that colour under a light header, never cropped to fill the slide.
    const contain = Boolean(image.bg);
    const layer = interaction.spots.map((spot, index) => {
      const isActive = state.active === spot.id;
      const opened = state.opened.includes(spot.id);

      return (
        <div key={spot.id}>
          <div
            aria-hidden="true"
            onClick={() => dispatch({ type: 'open', id: spot.id })}
            className={`absolute cursor-pointer transition-colors ${
              isActive ? `border-2 ${contain ? 'border-sd-accent shadow-[0_0_0_9999px_rgba(15,42,95,0.34)]' : 'border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]'}` : contain ? 'hover:bg-sd-accent/10' : 'hover:bg-white/10'
            }`}
            style={{ left: `${spot.x - spot.w / 2}%`, top: `${spot.y - spot.h / 2}%`, width: `${spot.w}%`, height: `${spot.h}%` }}
          />
          <DeckPin index={index} x={spot.pin?.x ?? spot.x} y={spot.pin?.y ?? spot.y} name={spot.label} selected={isActive} explored={opened || done} plus onSelect={() => dispatch({ type: 'open', id: spot.id })} />
        </div>
      );
    });
    const callout = active ? (
      <PartCallout
        key={active.id}
        number={interaction.spots.findIndex((s) => s.id === active.id) + 1}
        title={active.label}
        text={active.text}
        image={active.image ?? null}
        assetBase={assetBase}
        placement={place?.id === active.id ? place.side : cardSide(active.x)}
        anchor={place?.id === active.id ? place.at : 'top'}
        narrow={contain}
        onClose={() => dispatch({ type: 'close' })}
      />
    ) : null;

    if (contain) {
      return (
        <section aria-label="Explore the picture" className="relative h-full min-h-0 overflow-hidden" style={{ background: image.bg }}>
          <div className="absolute inset-x-0 bottom-0 top-[15%] flex items-center justify-center">
            <div ref={stage} className="relative h-full max-w-full" style={{ aspectRatio: `${image.width} / ${image.height}` }}>
              {/* The edges fade into the paper, so the picture has no visible frame. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- deck images are our own stored files or local review copies */}
              <img
                src={assetUrl(image.url, assetBase)}
                alt={image.alt}
                className="absolute inset-0 h-full w-full select-none"
                style={{ maskImage: 'linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)' }}
                draggable={false}
              />
              {layer}
              {callout}
            </div>
          </div>
          <header className="absolute inset-x-0 top-0 z-30 flex items-end justify-between gap-[1em] px-[1.6em] pb-[0.5em] pt-[0.9em]" style={{ background: image.bg }}>
            <div className="min-w-0">
              {heading ? <p className="text-[0.7em] font-semibold uppercase tracking-[0.14em] text-sd-accent">{heading.kicker}</p> : null}
              <h2 tabIndex={-1} className="text-[1.6em] font-bold leading-tight text-slate-900 outline-none">
                {heading?.title}
              </h2>
              <p className="mt-[0.25em] text-[0.82em] leading-snug text-slate-600">{finished ? interaction.wrapup : interaction.intro}</p>
            </div>
            <p role="status" className="shrink-0 pb-[0.2em] text-[0.75em] font-medium tabular-nums text-slate-600">
              {finished ? 'All explored' : `${progress.opened} of ${progress.total} explored`}
            </p>
          </header>
        </section>
      );
    }

    return (
      <section aria-label="Explore the picture" className="relative h-full min-h-0 overflow-hidden bg-slate-900">
        {/* eslint-disable-next-line @next/next/no-img-element -- deck images are our own stored files or local review copies */}
        <img src={assetUrl(image.url, assetBase)} alt={image.alt} className="absolute inset-0 h-full w-full object-cover" />
        <div ref={stage} className="absolute inset-0">
          {layer}
          {callout ? <div className="pointer-events-none absolute inset-x-0 bottom-[4%] top-[24%]">{callout}</div> : null}
        </div>
        <header className="absolute inset-x-0 top-0 z-30 flex items-end justify-between gap-[1em] bg-slate-950/75 px-[1.6em] py-[0.7em] text-white">
          <div className="min-w-0">
            {heading ? <p className="text-[0.7em] font-semibold uppercase tracking-[0.14em] text-sky-200">{heading.kicker}</p> : null}
            <h2 tabIndex={-1} className="text-[1.5em] font-bold leading-tight outline-none">
              {heading?.title}
            </h2>
            <p className="mt-[0.25em] text-[0.78em] leading-snug text-slate-200">{finished ? interaction.wrapup : interaction.intro}</p>
          </div>
          <p role="status" className="shrink-0 pb-[0.2em] text-[0.75em] font-medium tabular-nums text-slate-200">
            {finished ? 'All explored' : `${progress.opened} of ${progress.total} explored`}
          </p>
        </header>
      </section>
    );
  }

  // A wide screen: the title across the top, then the picture at the left and, at the right, one translucent panel with the
  // parts and the explanation of the open one. The explanation never covers the picture, so every marker on it can be
  // pressed at any time (an explanation laid over the picture hid the markers beneath it).
  return (
    <section aria-label="Explore the diagram" className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-[0.8em] p-[1.4em]">
      <div className="min-w-0">{lead}</div>
      <div className="grid min-h-0 grid-cols-[minmax(0,6.6fr)_minmax(0,5.4fr)] gap-[1.2em]">
        <div ref={stage} className={`relative min-h-0 min-w-0 ${lab ? 'flex flex-col gap-[0.6em]' : ''}`}>
          {lab ? <div className="relative min-h-0 basis-[24%]">{figure}</div> : figure}
          {lab ? <div className="min-h-0 flex-1">{lab}</div> : null}
          {/* The explanation opens on the picture, against the edge away from the selected part (where the camera put it), so the part stays in view. */}
          {active && onPicture ? (
            <PartCallout
              key={active.id}
              number={interaction.spots.findIndex((s) => s.id === active.id) + 1}
              title={active.label}
              text={active.text}
              image={active.image ?? null}
              assetBase={assetBase}
              placement={flipped === active.id ? (cardSide(active.x) === 'left' ? 'right' : 'left') : cardSide(active.x)}
              onClose={() => dispatch({ type: 'close' })}
            />
          ) : null}
        </div>

        <div className={`${PANEL} flex min-h-0 min-w-0 flex-col gap-[0.4em] p-[0.8em]`}>
          {status}
          {lab ? null : <p className="text-[0.72em] text-slate-600">{interaction.intro}</p>}

          {/* The list gives up room before the explanation does: it shrinks and scrolls, so the explanation can always show all its text. */}
          <ul className="min-h-[7em] space-y-[0.25em] overflow-y-auto" aria-label="Parts of the diagram">
            {interaction.spots.map((spot, index) => {
              const opened = state.opened.includes(spot.id);

              return (
                <li key={spot.id}>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'open', id: spot.id })}
                    aria-current={state.active === spot.id ? 'true' : undefined}
                    className={`flex w-full items-center gap-[0.55em] rounded-[0.7em] border px-[0.6em] py-[0.35em] text-left text-[0.88em] shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent ${
                      state.active === spot.id ? 'border-sd-accent bg-sd-soft font-semibold text-sd-strong' : 'border-sd-line bg-white text-slate-800 hover:border-sd-accent'
                    }`}
                  >
                    <span className="flex h-[1.5em] w-[1.5em] shrink-0 items-center justify-center rounded-full bg-sd-accent text-[0.85em] font-bold tabular-nums text-white">{index + 1}</span>
                    {spot.image ? <PartThumb image={spot.image} assetBase={assetBase} /> : null}
                    <span className="flex-1">{spot.label}</span>
                    {opened || done ? (
                      <CheckCircle2 className="h-[1.1em] w-[1.1em] shrink-0 text-emerald-600" aria-label="Explored" />
                    ) : (
                      <Circle className="h-[1.1em] w-[1.1em] shrink-0 text-slate-400" aria-label="Not yet explored" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {onPicture ? (
            <p className="mt-auto text-[0.82em] leading-snug text-slate-600">
              {finished ? interaction.wrapup : 'Select a part: its explanation opens on the picture, beside the part it describes.'}
            </p>
          ) : (
            <div
              role="region"
              aria-label="Explanation"
              aria-live="polite"
              className={`min-h-[5em] shrink-0 rounded-[0.9em] border-2 p-[0.6em] ${active ? 'border-sd-accent bg-white shadow-md' : 'border-dashed border-sd-line bg-white/60'}`}
            >
              {explanation ?? <p className="text-[0.82em] text-slate-600">{finished ? interaction.wrapup : 'Select a numbered marker on the picture, or a name in the list, to read about that part.'}</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
