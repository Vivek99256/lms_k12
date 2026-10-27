'use client';

import React from 'react';
import { Check, Lock, MapPin } from 'lucide-react';
import { milestoneStatusStyle, type JourneyData, type MilestoneKey } from '@/app/pal/journey/data/pal-journey';
import { JOURNEY_STAGE_BY_KEY, JOURNEY_STAGES } from '@/app/pal/_components/journey-stages';
import { MILESTONE_2D_POSITIONS, NODE_RADIUS, VIEW_HEIGHT, VIEW_WIDTH, smoothPathD, type Point } from './path-layout';

/**
 * The journey map, as a flat 2D "level map" — a single winding dashed path
 * connecting round, colour-coded checkpoint bubbles over a vivid gradient.
 *
 * REPLACES the earlier isometric 3D Three.js board (`three/BoardGameScene.tsx`
 * and the rest of that folder, deleted). See this repo's own journey.ts
 * history for why: the 3D board's dark palette read as gloomy, a brighter
 * 3D recolour still couldn't match a mobile game's level-map energy because
 * that reference isn't a lit 3D scene at all — it's a flat path. That
 * structural pattern (dashed track, round nodes, bright backdrop) is
 * generic across the genre (Duolingo's own learning path uses the same
 * shape); tracing a specific game's branded art is not, and isn't done
 * here. Every colour is this file's own, pulled from this app's own
 * `ACCENT` palette (`app/pal/learning-intelligence/_components/design-system.ts`).
 *
 * ONE pathway only, by direct instruction — no remediation branch drawn.
 * `data.remediationBranch` still exists on the fetched payload and
 * `MilestoneDetailPanel` still lists a milestone's own remediation attempts
 * as text, but this view draws nothing for it until asked to bring the
 * branch back.
 *
 * Flat means no camera projection: every label and click target is
 * positioned with plain `x/VIEW_WIDTH*100` percentages over a container
 * whose aspect ratio is fixed to match (`MountainJourneyView.tsx`'s
 * `aspect-[4/3]` wrapper against this file's 880x660 viewBox — both exactly
 * 4:3, so a percentage-sized circle here never distorts into an ellipse).
 */
interface PathJourneyViewProps {
  data: JourneyData;
  currentIndex: number;
  selected: MilestoneKey | null;
  onSelect: (key: MilestoneKey) => void;
}

const NODE_DIAM_PCT_W = ((NODE_RADIUS * 2) / VIEW_WIDTH) * 100;
const NODE_DIAM_PCT_H = ((NODE_RADIUS * 2) / VIEW_HEIGHT) * 100;
const BADGE_OFFSET_PCT_W = ((NODE_RADIUS - 6) / VIEW_WIDTH) * 100;
const BADGE_OFFSET_PCT_H = ((NODE_RADIUS - 6) / VIEW_HEIGHT) * 100;
const LABEL_OFFSET_PCT_H = ((NODE_RADIUS + 10) / VIEW_HEIGHT) * 100;
/** Clears the current node's pulsing ring (peaks at NODE_RADIUS+18, see the SVG `<animate>` above) with a couple of units of headroom — kept tight on purpose, since the serpentine layout stacks rows close enough that a more generous gap starts crowding the row above. */
const MARKER_ANCHOR_PCT_H = ((NODE_RADIUS + 20) / VIEW_HEIGHT) * 100;

function leftPct(point: Point) {
  return (point.x / VIEW_WIDTH) * 100;
}
function topPct(point: Point) {
  return (point.y / VIEW_HEIGHT) * 100;
}

function LegendDot({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2.5 w-2.5 rounded-full ${colorClass}`} />
      {label}
    </span>
  );
}

/**
 * A glowing map-pin badge marking the learner's current step — replaces the
 * old plain-text "You are here" pill with something that reads at a glance
 * and matches the path's own warm "current" colouring (the current node and
 * the legend's "Current" dot are both amber; this continues that gradient
 * into orange/rose for a warmer, more eye-catching marker).
 *
 * Split into two nested elements on purpose: the OUTER wrapper (in the
 * caller) owns the static `-translate-x-1/2 -translate-y-full` anchor
 * transform, and only the INNER one gets `animate-bounce` — Tailwind's
 * bounce keyframes set `transform` directly, so putting both transforms on
 * the same element would have the animation silently overwrite the anchor
 * offset on every frame instead of bouncing around it.
 */
function CurrentPositionMarker() {
  return (
    <div role="img" aria-label="You are here — your current step" className="flex flex-col items-center">
      <div className="relative flex h-9 w-9 items-center justify-center">
        <span className="absolute inline-flex h-9 w-9 animate-ping rounded-full bg-amber-300 opacity-60" />
        <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 shadow-[0_0_12px_rgba(251,146,60,0.9)] ring-2 ring-white">
          <MapPin className="h-4 w-4 text-white drop-shadow" strokeWidth={2.5} fill="white" fillOpacity={0.25} />
        </span>
      </div>
      <span className="-mt-0.5 h-2 w-2 rotate-45 rounded-sm bg-orange-400 shadow" />
    </div>
  );
}

export function PathJourneyView({ data, currentIndex, selected, onSelect }: PathJourneyViewProps) {
  const orderedPoints = JOURNEY_STAGES.map((stage) => MILESTONE_2D_POSITIONS[stage.key]);

  // Split the track at the learner's real current step, so the road itself
  // shows progress — a bright solid line behind them, a pale one ahead —
  // not just a badge on one node. The shared point at `currentIndex` keeps
  // the two halves visually joined with no gap or overlap.
  const traveledPathD = smoothPathD(orderedPoints.slice(0, currentIndex + 1));
  const remainingPathD = smoothPathD(orderedPoints.slice(currentIndex));

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-indigo-600 via-fuchsia-500 to-amber-400">
      {/* Soft colour blobs for depth — plain CSS, no image asset */}
      <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="pointer-events-none absolute right-1/3 top-1/4 h-32 w-32 rounded-full bg-rose-300/20 blur-2xl" />

      <div className="pointer-events-none absolute right-3 top-3 z-10 flex gap-2.5 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-semibold text-slate-700 shadow">
        <LegendDot colorClass="bg-blue-600" label="Completed" />
        <LegendDot colorClass="bg-amber-500" label="Current" />
        <LegendDot colorClass="bg-slate-400" label="Upcoming" />
      </div>

      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {/* Remaining road — pale, ahead of the learner */}
        <path d={remainingPathD} stroke="#ffffff" strokeOpacity={0.4} strokeWidth={16} fill="none" strokeLinecap="round" />
        <path d={remainingPathD} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={4} strokeDasharray="1.5 15" strokeLinecap="round" fill="none" />

        {/* Traveled road — bright and solid, behind the learner */}
        <path d={traveledPathD} stroke="#ffffff" strokeWidth={16} fill="none" strokeLinecap="round" />
        <path d={traveledPathD} stroke="#fbbf24" strokeWidth={6} strokeDasharray="1.5 15" strokeLinecap="round" fill="none" />

        {data.milestones.map((milestone, index) => {
          const point = MILESTONE_2D_POSITIONS[milestone.key];
          const style = milestoneStatusStyle(milestone.status);
          const current = index === currentIndex;

          return (
            <g key={milestone.key}>
              {current && (
                <circle cx={point.x} cy={point.y} r={NODE_RADIUS + 6} fill="none" stroke="#ffffff" strokeWidth={3} opacity={0.7}>
                  <animate
                    attributeName="r"
                    values={`${NODE_RADIUS + 6};${NODE_RADIUS + 18};${NODE_RADIUS + 6}`}
                    dur="1.8s"
                    repeatCount="indefinite"
                  />
                  <animate attributeName="opacity" values="0.7;0.1;0.7" dur="1.8s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                cx={point.x}
                cy={point.y}
                r={current ? NODE_RADIUS + 4 : NODE_RADIUS}
                fill={style.hex}
                stroke="#ffffff"
                strokeWidth={current ? 6 : 5}
                opacity={milestone.available ? 1 : 0.55}
                style={{ transition: 'r 0.4s ease, stroke-width 0.4s ease' }}
              />
            </g>
          );
        })}
      </svg>

      {/* Interactive + label layer — icons, click targets, badges, "you are here". Plain percentage positioning: a flat map needs no camera projection. */}
      <div className="pointer-events-none absolute inset-0">
        {data.milestones.map((milestone, index) => {
          const point = MILESTONE_2D_POSITIONS[milestone.key];
          const style = milestoneStatusStyle(milestone.status);
          const Icon = JOURNEY_STAGE_BY_KEY[milestone.key].icon;
          const current = index === currentIndex;
          const isDone = milestone.status === 'completed' || milestone.status === 'mastered';
          const isLocked = milestone.status === 'locked';
          const isSelected = milestone.key === selected;
          const left = leftPct(point);
          const top = topPct(point);

          return (
            <React.Fragment key={milestone.key}>
              <button
                type="button"
                onClick={() => onSelect(milestone.key)}
                aria-label={milestone.label}
                className={`pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white transition-transform hover:scale-110 ${
                  isSelected ? 'scale-110 ring-4 ring-white/85' : ''
                }`}
                style={{ left: `${left}%`, top: `${top}%`, width: `${NODE_DIAM_PCT_W}%`, height: `${NODE_DIAM_PCT_H}%` }}
              >
                <Icon className="h-6 w-6 drop-shadow" />
              </button>

              {(isDone || isLocked) && (
                <div
                  className={`pointer-events-none absolute flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white ${
                    isDone ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                  style={{ left: `calc(${left}% + ${BADGE_OFFSET_PCT_W}%)`, top: `calc(${top}% - ${BADGE_OFFSET_PCT_H}%)` }}
                >
                  {isDone ? <Check className="h-3 w-3 text-white" /> : <Lock className="h-3 w-3 text-white" />}
                </div>
              )}

              {current && (
                <div
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-full"
                  style={{ left: `${left}%`, top: `calc(${top}% - ${MARKER_ANCHOR_PCT_H}%)` }}
                >
                  <div className="animate-bounce">
                    <CurrentPositionMarker />
                  </div>
                </div>
              )}

              <div
                className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center gap-0.5"
                style={{ left: `${left}%`, top: `calc(${top}% + ${LABEL_OFFSET_PCT_H}%)` }}
              >
                <span className="whitespace-nowrap rounded-md bg-white/95 px-1.5 py-0.5 text-[9px] font-bold shadow" style={{ color: style.hex }}>
                  {milestone.index}. {milestone.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
