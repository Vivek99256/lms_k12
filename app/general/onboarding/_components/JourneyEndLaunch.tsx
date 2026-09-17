"use client";

import { Lock, Rocket } from "lucide-react";
import "./journey-launch.css";

/**
 * The terminal node of the onboarding ribbon — "Launch Day", the destination the
 * roadmap ends at rather than another step card.
 *
 * It is deliberately built to the ribbon's own proportions: JourneyRibbon passes
 * its band thickness as `height`, so the node always matches the chevrons beside
 * it even if that constant moves. The shape is the one difference — a pill
 * rather than a chevron — because nothing follows it to point at.
 *
 * It carries no owner marker, no timeline connector and no step number. Those
 * belong to steps, and this is not one: there is nobody to assign and nothing to
 * complete.
 *
 * Two states, and only two:
 *  - locked, while any required step is outstanding. Still rendered, because the
 *    point of a destination is that you can see it from the start of the road.
 *  - unlocked, once the API reports the journey complete. Only then does it
 *    carry the gradient, the confetti and the click.
 *
 * All the motion is CSS (journey-launch.css) and collapses under
 * `prefers-reduced-motion`.
 */
export function JourneyEndLaunch({
  unlocked,
  /** Journey direction at this point in the ribbon — the lane runs right-to-left. */
  pointsLeft,
  /** The ribbon's band thickness, so the node matches the chevrons exactly. */
  height,
  /** Where the node says it is going, e.g. "Fees dashboard". */
  destinationLabel,
  /** Steps still outstanding, shown on the locked node so the lock explains itself. */
  remaining,
  onLaunch,
}: {
  unlocked: boolean;
  pointsLeft: boolean;
  height: number;
  destinationLabel: string;
  remaining: number;
  onLaunch: () => void;
}) {
  const stepWord = remaining === 1 ? "step" : "steps";

  return (
    <button
      type="button"
      disabled={!unlocked}
      onClick={onLaunch}
      aria-label={
        unlocked
          ? `Launch day — open the ${destinationLabel}`
          : `Launch day is locked — ${remaining} required ${stepWord} remaining`
      }
      style={{ height }}
      className={`journey-launch${unlocked ? " is-unlocked" : ""}${pointsLeft ? " is-reversed" : ""}`}
    >
      {/* Celebratory accents scattered around the pill — dots and short strokes,
          outside its edge so the node itself stays clean. Unlocked only: a
          locked destination should be quiet. */}
      {unlocked ? (
        <span className="journey-launch-accents" aria-hidden>
          <i className="jl-dot jl-dot-1" />
          <i className="jl-dot jl-dot-2" />
          <i className="jl-dot jl-dot-3" />
          <i className="jl-dot jl-dot-4" />
          <i className="jl-tick jl-tick-1" />
          <i className="jl-tick jl-tick-2" />
          <i className="jl-ring" />
        </span>
      ) : null}

      <span className="journey-launch-badge" aria-hidden>
        {unlocked ? <Rocket className="journey-launch-rocket size-4" /> : <Lock className="size-4" />}
      </span>

      <span className="journey-launch-label">Go Live</span>

      {/* Dropped below lg: the lanes get tight at two columns, and the node's
          accessible name already says where it goes. */}
   
   
    </button>
  );
}
