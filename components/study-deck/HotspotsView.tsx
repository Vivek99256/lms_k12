'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { CheckCircle2, Circle, MousePointerClick, X } from 'lucide-react';

import { HotspotMarker } from '@/app/h5p/h5p_image_hotspots/components/marker';
import type { ImageHotspotPointInput } from '@/app/h5p/data/h5p-content-types';
import { cameraFor } from '@/lib/study-deck/camera';
import { closeHotspot, hotspotProgress, initialHotspots, openHotspot, type HotspotState } from '@/lib/study-deck/interactions';
import type { DeckImage, HotspotsInteraction, HotspotSpot } from '@/lib/study-deck/types';
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
}

type Action = { type: 'open'; id: string } | { type: 'close' };

/** The H5P marker's input shape; a pin on the corner of a labelled box, so it never covers the label. */
function pinFor(spot: HotspotSpot, color: string): ImageHotspotPointInput {
  return {
    position_x: Math.max(0, spot.x - spot.w / 2),
    position_y: Math.max(0, spot.y - spot.h / 2),
    header: spot.label,
    popup_type: 'text',
    body_text: spot.text,
    popup_image: '',
    popup_image_alt: '',
    icon_name: 'info',
    icon_color: color,
    icon_image: '',
    tooltip: '',
    aria_label: spot.label,
    popup_width: 0,
  };
}

/**
 * Image Hotspots as a presentation slide: the drawn diagram takes most of the screen with its numbered parts on
 * it; selecting a part highlights it and opens a compact card over the picture (placed away from the part, so the
 * diagram stays visible) and marks the part explored. The learner never leaves the slide.
 *
 * Reuse: the pin is the H5P image-hotspots marker and "explored" is the same coverage rule the H5P module scores
 * with (`scoreHotspotVisit`). Nothing is marked: this is exploration.
 */
export function HotspotsView({ interaction, image, assetBase, done, onDone, lead, memoryKey }: HotspotsViewProps) {
  const { portrait } = useStage();
  const { accent } = useTheme();
  const [state, dispatch] = useRememberedReducer(
    memoryKey,
    (s: HotspotState, a: Action) => (a.type === 'open' ? openHotspot(s, interaction, a.id) : closeHotspot(s)),
    initialHotspots
  );
  const progress = hotspotProgress(interaction, state);
  const active = interaction.spots.find((spot) => spot.id === state.active) ?? null;
  const reported = useRef(done);
  const finished = progress.done || done;

  useEffect(() => {
    if (progress.done && !reported.current) {
      reported.current = true;
      onDone();
    }
  }, [progress.done, onDone]);

  const pins = useMemo(() => interaction.spots.map((spot) => pinFor(spot, accent)), [interaction.spots, accent]);
  // Ease toward the open part, but only as far as keeps every part (and its pin) in view and clickable.
  const camera = useMemo(
    () =>
      active
        ? cameraFor(
            { x: active.x, y: active.y },
            interaction.spots.flatMap((spot) => [
              { x: spot.x, y: spot.y },
              { x: Math.max(0, spot.x - spot.w / 2), y: Math.max(0, spot.y - spot.h / 2) },
            ])
          )
        : null,
    [active, interaction.spots]
  );

  const figure = (
    <VisualFigure
      image={image}
      assetBase={assetBase}
      camera={camera}
      // On a phone the picture is small, so the pins shrink to the 24px minimum rather than covering the labels.
      className={portrait ? '[&_.h5p-tappable]:!h-6 [&_.h5p-tappable]:!w-6 [&_.h5p-tappable_svg]:!h-3 [&_.h5p-tappable_svg]:!w-3' : ''}
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
                isActive ? 'border-sd-accent bg-sd-accent/10' : opened ? 'border-emerald-500/60' : 'border-transparent hover:border-sd-accent hover:bg-sd-accent/5'
              }`}
              style={{ left: `${spot.x - spot.w / 2}%`, top: `${spot.y - spot.h / 2}%`, width: `${spot.w}%`, height: `${spot.h}%` }}
            />
            <HotspotMarker
              index={index}
              point={pins[index]}
              defaults={{ icon: 'info', color: accent }}
              showNumber
              selected={isActive}
              opened={opened}
              pulse={!opened && !finished}
              onClick={() => dispatch({ type: 'open', id: spot.id })}
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
      <p className="mt-[0.25em] text-[0.95em] leading-snug text-slate-800">{active.text}</p>
    </>
  ) : null;

  // A narrow screen: the picture is the lesson, so it comes right after the title and takes the room it can; the parts
  // are a row of numbered names under it and the explanation opens under those, never over the picture.
  if (portrait) {
    return (
      <section aria-label="Explore the diagram" className="flex h-full min-h-0 flex-col gap-[0.6em] p-[1.1em]">
        {lead}
        <div className="min-h-0 flex-1">{figure}</div>
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
                  {spot.label}
                  {opened || done ? <CheckCircle2 className="h-[1.1em] w-[1.1em] shrink-0 text-emerald-600" aria-label="Explored" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
        <div role="region" aria-label="Explanation" aria-live="polite" className={`min-h-[4.6em] rounded-[0.9em] border-2 p-[0.7em] ${active ? 'border-sd-accent bg-white shadow-md' : 'border-dashed border-sd-line bg-white/60'}`}>
          {explanation ?? <p className="text-[0.8em] text-slate-600">{finished ? interaction.wrapup : 'Select a numbered marker or a name to read about that part.'}</p>}
        </div>
        {status}
      </section>
    );
  }

  // A wide screen: the title across the top, then the picture at the left and, at the right, one translucent panel with the
  // parts and the explanation of the open one. The explanation never covers the picture, so every marker on it can be
  // pressed at any time (an explanation laid over the picture hid the markers beneath it).
  return (
    <section aria-label="Explore the diagram" className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-[0.8em] p-[1.4em]">
      <div className="min-w-0">{lead}</div>
      <div className="grid min-h-0 grid-cols-[minmax(0,7.6fr)_minmax(0,4.4fr)] gap-[1.2em]">
        <div className="relative min-h-0 min-w-0">{figure}</div>

        <div className={`${PANEL} flex min-h-0 min-w-0 flex-col gap-[0.55em] p-[1em]`}>
          {status}
          <p className="text-[0.72em] text-slate-600">{interaction.intro}</p>

          <ul className="space-y-[0.25em]" aria-label="Parts of the diagram">
            {interaction.spots.map((spot, index) => {
              const opened = state.opened.includes(spot.id);

              return (
                <li key={spot.id}>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'open', id: spot.id })}
                    aria-current={state.active === spot.id ? 'true' : undefined}
                    className={`flex w-full items-center gap-[0.55em] rounded-[0.7em] border px-[0.55em] py-[0.25em] text-left text-[0.78em] shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sd-accent ${
                      state.active === spot.id ? 'border-sd-accent bg-sd-soft font-semibold text-sd-strong' : 'border-sd-line bg-white text-slate-800 hover:border-sd-accent'
                    }`}
                  >
                    <span className="flex h-[1.5em] w-[1.5em] shrink-0 items-center justify-center rounded-full bg-sd-accent text-[0.85em] font-bold tabular-nums text-white">{index + 1}</span>
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

          <div
            role="region"
            aria-label="Explanation"
            aria-live="polite"
            className={`min-h-[5em] flex-1 overflow-hidden rounded-[0.9em] border-2 p-[0.8em] ${active ? 'border-sd-accent bg-white shadow-md' : 'border-dashed border-sd-line bg-white/60'}`}
          >
            {explanation ?? <p className="text-[0.82em] text-slate-600">{finished ? interaction.wrapup : 'Select a numbered marker on the picture, or a name in the list, to read about that part.'}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
