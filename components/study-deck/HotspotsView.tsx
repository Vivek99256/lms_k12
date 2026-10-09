'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { CheckCircle2, Circle, MousePointerClick, X } from 'lucide-react';

import { HotspotMarker } from '@/app/h5p/h5p_image_hotspots/components/marker';
import type { ImageHotspotPointInput } from '@/app/h5p/data/h5p-content-types';
import { cameraFor } from '@/lib/study-deck/camera';
import { closeHotspot, hotspotProgress, initialHotspots, openHotspot, type HotspotState } from '@/lib/study-deck/interactions';
import type { DeckImage, HotspotsInteraction, HotspotSpot } from '@/lib/study-deck/types';
import { CompletedSlot, Tag, useRememberedReducer, useStage, VisualFigure } from './stage-ui';

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
function pinFor(spot: HotspotSpot): ImageHotspotPointInput {
  return {
    position_x: Math.max(0, spot.x - spot.w / 2),
    position_y: Math.max(0, spot.y - spot.h / 2),
    header: spot.label,
    popup_type: 'text',
    body_text: spot.text,
    popup_image: '',
    popup_image_alt: '',
    icon_name: 'info',
    icon_color: '#4f46e5',
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

  const pins = useMemo(() => interaction.spots.map(pinFor), [interaction.spots]);
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

  return (
    <section
      aria-label="Explore the diagram"
      className={`grid h-full min-h-0 gap-[1.2em] p-[1.4em] ${portrait ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-cols-[minmax(0,4fr)_minmax(0,8fr)]'}`}
    >
      <div className="flex min-h-0 min-w-0 flex-col justify-center gap-[0.9em]">
        {lead}

        <div className="space-y-[0.5em]">
          <div className="flex items-center gap-[0.6em]">
            <Tag>
              <MousePointerClick className="h-[1em] w-[1em]" aria-hidden="true" />
              Explore the diagram
            </Tag>
            <span role="status" className="text-[0.7em] font-medium text-slate-600">
              {finished ? 'All parts explored' : `${progress.opened} of ${progress.total} explored`}
            </span>
          </div>
          <p className="text-[0.75em] text-slate-600">{interaction.intro}</p>

          <ul className="space-y-[0.25em]" aria-label="Parts of the diagram">
            {interaction.spots.map((spot, index) => {
              const opened = state.opened.includes(spot.id);

              return (
                <li key={spot.id}>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'open', id: spot.id })}
                    aria-current={state.active === spot.id ? 'true' : undefined}
                    className={`flex w-full items-center gap-[0.5em] rounded-[0.5em] px-[0.5em] py-[0.25em] text-left text-[0.78em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                      state.active === spot.id ? 'bg-indigo-50 font-medium text-indigo-900' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {opened || done ? (
                      <CheckCircle2 className="h-[1.1em] w-[1.1em] shrink-0 text-emerald-600" aria-label="Explored" />
                    ) : (
                      <Circle className="h-[1.1em] w-[1.1em] shrink-0 text-slate-400" aria-label="Not yet explored" />
                    )}
                    <span className="tabular-nums text-slate-500">{index + 1}.</span>
                    <span>{spot.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <CompletedSlot show={finished}>{interaction.wrapup}</CompletedSlot>
        </div>
      </div>

      <div className="relative min-h-0 min-w-0">
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
                    isActive ? 'border-indigo-600 bg-indigo-600/10' : opened ? 'border-emerald-500/60' : 'border-transparent hover:border-indigo-400 hover:bg-indigo-500/5'
                  }`}
                  style={{ left: `${spot.x - spot.w / 2}%`, top: `${spot.y - spot.h / 2}%`, width: `${spot.w}%`, height: `${spot.h}%` }}
                />
                <HotspotMarker
                  index={index}
                  point={pins[index]}
                  defaults={{ icon: 'info', color: '#4f46e5' }}
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

        {active ? (
          <div
            role="dialog"
            aria-label={active.label}
            aria-live="polite"
            className={`absolute left-[8%] right-[8%] z-20 rounded-[0.9em] border border-indigo-200 bg-white p-[0.9em] shadow-xl ${active.y > 52 ? 'top-[3%]' : 'bottom-[3%]'}`}
          >
            <div className="flex items-start justify-between gap-[0.5em]">
              <h3 className="text-[1.05em] font-semibold text-slate-900">{active.label}</h3>
              <button
                type="button"
                onClick={() => dispatch({ type: 'close' })}
                className="rounded-[0.4em] p-[0.2em] text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                aria-label="Close explanation"
              >
                <X className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-[0.25em] text-[0.95em] leading-snug text-slate-800">{active.text}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
