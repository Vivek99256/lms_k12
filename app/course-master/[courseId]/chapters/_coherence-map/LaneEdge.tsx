'use client';

/**
 * The connector between two concept cards.
 *
 * WHY THIS IS NOT THE BUILT-IN `smoothstep`
 * The built-in already emits the right *shape* - out right, one vertical run, in left.
 * What it will not do is let us place that vertical run. `SmoothStepPathOptions`
 * exposes only `{ offset, borderRadius, stepPosition }`; `centerX` exists inside
 * `getSmoothStepPath` but `SmoothStepEdge` never forwards it. With four prerequisites
 * converging on one card, every edge would drop its vertical run at the same x and
 * they would draw as one thick ambiguous line. The lane assignment in focusLayout.ts
 * computes an absolute x per edge, and reaching it means calling the path function
 * directly.
 *
 * WHY HOVER STATE COMES THROUGH CONTEXT
 * Tracing has to be cheap. The obvious implementation - put `hoveredId` in component
 * state and rebuild the edges array - replaces every edge object in the xyflow store
 * on every `mouseenter`, which is a full diff per card the pointer crosses. Reading it
 * from context re-renders only the edges that actually change appearance.
 */

import { createContext, useContext, useMemo } from 'react';
import { BaseEdge, getBezierPath, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

import type { CoherenceEdge } from '@/app/course-master/data/coherenceMap';

export type MapInteraction = {
  /** The card the pointer is over, or null. Drives the trace. */
  hoveredId: string | null;
  /**
   * The hovered card plus everything one edge away from it.
   *
   * Null when nothing is hovered. Cards outside this set fade; cards inside keep full
   * contrast, because the point of the trace is to show what this concept touches -
   * fading its own neighbours alongside the unrelated ones would defeat it.
   */
  related: Set<string> | null;
  /** The centred concept. */
  rootId: string | null;
};

export const MapInteractionContext = createContext<MapInteraction>({
  hoveredId: null,
  related: null,
  rootId: null,
});

export type LaneEdgeData = {
  edge: CoherenceEdge;
  laneX: number;
  backward: boolean;
};

/**
 * Colour AND dash, never colour alone.
 *
 * A dashed line means "nobody has agreed with this yet" and is the one distinction on
 * this screen that changes what a teacher should trust, so it has to survive a
 * greyscale print and a colour-vision deficiency.
 */
function strokeFor(edge: CoherenceEdge, backward: boolean): { stroke: string; dash?: string } {
  if (backward) return { stroke: '#b45309', dash: '6 4' };
  if (edge.kind === 'cross_curricular') return { stroke: '#0d9488', dash: '2 4' };
  if (edge.status !== 'approved') return { stroke: '#d97706', dash: '6 4' };

  return { stroke: '#4f46e5' };
}

function LaneEdgeInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) {
  const { hoveredId } = useContext(MapInteractionContext);
  const payload = data as unknown as LaneEdgeData | undefined;

  const edge = payload?.edge;
  const backward = payload?.backward ?? false;

  const [path] = useMemo(() => {
    if (backward) {
      // A cycle: the dependent sits at or before its own prerequisite. A step path
      // would run straight back through the cards between them, so it loops instead -
      // which also makes the loop obvious rather than something to squint at.
      return getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        curvature: 0.6,
      });
    }

    return getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 4,
      // The stub out of the card before the vertical run. 16 leaves 68px of the 100px
      // corridor for lanes, which is seven at a 10px pitch - more than the data needs.
      offset: 16,
      centerX: payload?.laneX,
    });
  }, [backward, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, payload?.laneX]);

  const traced =
    hoveredId !== null && (edge?.source === hoveredId || edge?.target === hoveredId);
  const dimmed = hoveredId !== null && !traced;

  const { stroke, dash } = edge
    ? strokeFor(edge, backward)
    : { stroke: '#cbd5e1', dash: undefined };

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      // A wider invisible band than the 2px stroke, so the line can actually be hit.
      interactionWidth={18}
      style={{
        stroke: traced ? '#1e293b' : stroke,
        strokeWidth: traced ? 3 : 2,
        strokeDasharray: dash,
        opacity: dimmed ? 0.12 : 1,
      }}
      className="transition-opacity duration-150 motion-reduce:transition-none"
    />
  );
}

export const LaneEdge = LaneEdgeInner;

export const edgeTypes = { lane: LaneEdgeInner } as const;

/** Marker colour has to match the stroke, or the arrowhead reads as a separate object. */
export function markerColour(edge: CoherenceEdge, backward: boolean): string {
  return strokeFor(edge, backward).stroke;
}
