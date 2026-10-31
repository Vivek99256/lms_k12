'use client';

import { Check, Lock, MapPin } from 'lucide-react';
import { milestoneStatusStyle, type JourneyData, type MilestoneKey } from '@/app/pal/journey/data/pal-journey';
import { JOURNEY_STAGE_BY_KEY, JOURNEY_STAGES } from '@/app/pal/_components/journey-stages';
import { MILESTONE_2D_POSITIONS, NODE_RADIUS, VIEW_HEIGHT, VIEW_WIDTH, smoothPathD, type Point } from './path-layout';

const LEARN_INDEX = JOURNEY_STAGES.findIndex((stage) => stage.key === 'learn');
const MASTERY_INDEX = JOURNEY_STAGES.findIndex((stage) => stage.key === 'mastery');
const FULLY_MASTERED_HEX = '#059669';
const REWORK_HEX = '#e11d48';

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
 * A small glowing bead that travels the full length of a road, looping
 * forever — this map's own motion signature, deliberately NOT the crawling-
 * dash "rope bridge" texture `IsometricClassBoard.tsx` (Teacher Learning
 * Insights' class map) uses for its own connecting lines. Both maps draw a
 * dashed track, so a drifting `stroke-dashoffset` on this one too would have
 * read as the same animation reskinned — this is motion ALONG the route
 * instead, via native SVG `<animateMotion>` against the exact path string
 * already computed for the stroke underneath it, not a second approximation
 * of the curve.
 *
 * Two staggered beads (`begin="0s"` and half a lap later) keep a long road
 * from ever looking empty while one bead is on the far side; the short
 * rework overlay gets only one, passed `dur` lower by its one caller.
 */
function PathSpark({ d, hex, dur }: { d: string; hex: string; dur: number }) {
  if (!d) return null;
  return (
    <>
      {[0, dur / 2].map((begin) => (
        <g key={begin}>
          <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" path={d} rotate="auto" />
          <circle r={10} fill={hex} opacity={0.3}>
            <animate attributeName="opacity" values="0.15;0.4;0.15" dur="1.3s" repeatCount="indefinite" />
          </circle>
          <circle r={4} fill="#ffffff" />
        </g>
      ))}
    </>
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

  // Every measurable concept in the chapter mastered (not just this one's 12
  // stages) — the whole road turns a single colour rather than staying split
  // into traveled/remaining, since there is no "ahead" left once the chapter
  // itself is done.
  const fullyMastered = data.chapterFullyMastered;
  const fullPathD = fullyMastered ? smoothPathD(orderedPoints) : '';

  // Check passed → remediation fired → still unresolved: the engine has sent
  // this concept back through Learn. `fullyMastered` wins if both are
  // somehow true at once (shouldn't happen — an active remediation implies
  // the focus concept itself isn't mastered yet — but the chapter-wide
  // "done" colouring should never lose to a stale per-concept flag).
  const needsRework = !fullyMastered && Boolean(data.remediationBranch?.active);
  const reworkPathD = needsRework ? smoothPathD(orderedPoints.slice(LEARN_INDEX, MASTERY_INDEX + 1)) : '';

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-gradient-to-br transition-colors duration-700 ${
        fullyMastered ? 'from-emerald-500 via-teal-500 to-amber-400' : 'from-indigo-600 via-fuchsia-500 to-amber-400'
      }`}
    >
      {/* Soft colour blobs for depth — plain CSS, no image asset */}
      <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="pointer-events-none absolute right-1/3 top-1/4 h-32 w-32 rounded-full bg-rose-300/20 blur-2xl" />

      <div className="pointer-events-none absolute right-3 top-3 z-10 flex gap-2.5 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-semibold text-slate-700 shadow">
        {fullyMastered ? (
          <LegendDot colorClass="bg-emerald-600" label="All concepts mastered" />
        ) : (
          <>
            <LegendDot colorClass="bg-blue-600" label="Completed" />
            <LegendDot colorClass="bg-amber-500" label="Current" />
            <LegendDot colorClass="bg-slate-400" label="Upcoming" />
            {needsRework && <LegendDot colorClass="bg-rose-600" label="Needs rework" />}
          </>
        )}
      </div>

      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {fullyMastered ? (
          <>
            {/* One continuous, solid "done" road — no traveled/remaining split once nothing is left ahead. Dashes are static texture now; PathSpark below carries the motion. */}
            <path d={fullPathD} stroke="#ffffff" strokeWidth={16} fill="none" strokeLinecap="round" />
            <path d={fullPathD} stroke={FULLY_MASTERED_HEX} strokeWidth={6} strokeDasharray="1.5 15" strokeLinecap="round" fill="none" />
            <PathSpark d={fullPathD} hex={FULLY_MASTERED_HEX} dur={5.5} />
          </>
        ) : (
          <>
            {/* Remaining road — pale, ahead of the learner */}
            <path d={remainingPathD} stroke="#ffffff" strokeOpacity={0.4} strokeWidth={16} fill="none" strokeLinecap="round" />
            <path
              d={remainingPathD}
              stroke="#ffffff"
              strokeOpacity={0.55}
              strokeWidth={4}
              strokeDasharray="1.5 15"
              strokeLinecap="round"
              fill="none"
            />
            <PathSpark d={remainingPathD} hex="#ffffff" dur={4.5} />

            {/* Traveled road — bright and solid, behind the learner */}
            <path d={traveledPathD} stroke="#ffffff" strokeWidth={16} fill="none" strokeLinecap="round" />
            <path d={traveledPathD} stroke="#fbbf24" strokeWidth={6} strokeDasharray="1.5 15" strokeLinecap="round" fill="none" />
            <PathSpark d={traveledPathD} hex="#fbbf24" dur={4.5} />

            {/* Learn → Mastery rework overlay — painted last so it reads on
                top of whichever of the two roads above it crosses. Only the
                segment the loop actually revisits gets recoloured; Diagnostic/
                Concept diagnostic/Plan before it and Recall after it are not
                part of the loop, so they keep their normal colouring. */}
            {needsRework && (
              <>
                <path d={reworkPathD} stroke={REWORK_HEX} strokeWidth={7} strokeDasharray="2 12" strokeLinecap="round" fill="none" />
                <PathSpark d={reworkPathD} hex={REWORK_HEX} dur={2.2} />
              </>
            )}
          </>
        )}

        {data.milestones.map((milestone, index) => {
          const point = MILESTONE_2D_POSITIONS[milestone.key];
          const style = milestoneStatusStyle(milestone.status);
          const current = index === currentIndex;
          const onReworkSegment = needsRework && index >= LEARN_INDEX && index <= MASTERY_INDEX;

          return (
            <g
              key={milestone.key}
              className="node-pop-in"
              style={{ animationDelay: `${index * 55}ms`, transformBox: 'fill-box', transformOrigin: 'center' }}
            >
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
              {onReworkSegment && !current && (
                <circle cx={point.x} cy={point.y} r={NODE_RADIUS + 5} fill="none" stroke={REWORK_HEX} strokeWidth={2.5} opacity={0.6}>
                  <animate attributeName="r" values={`${NODE_RADIUS + 5};${NODE_RADIUS + 11};${NODE_RADIUS + 5}`} dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0.15;0.6" dur="1.6s" repeatCount="indefinite" />
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
            // A plain `<div>` wrapper, not `<React.Fragment>` — only so the
            // staggered entrance fade (opacity-only; see the style block
            // below for why nothing here animates `transform`) has somewhere
            // to attach. `position: static` by default, so it is not a new
            // positioning context: every absolutely-positioned child below
            // still resolves against the real ancestor, the `inset-0`
            // container two levels up.
            <div key={milestone.key} className="node-fade-in" style={{ animationDelay: `${index * 55}ms` }}>
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
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .node-pop-in {
          animation: nodePopIn 480ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .node-fade-in {
          animation: nodeFadeIn 420ms ease both;
        }
        @keyframes nodePopIn {
          from {
            opacity: 0;
            transform: scale(0.6);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes nodeFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .node-pop-in,
          .node-fade-in {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
