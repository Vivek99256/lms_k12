'use client';

/**
 * The connector between two concept cards.
 * Uses assigned vertical lanes to avoid overlaps, handles cyclic loop edges,
 * and highlights connections when nodes are hovered.
 */

import { createContext, useContext, useMemo } from 'react';
import { BaseEdge, getBezierPath, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

import type { CoherenceEdge } from '@/app/course-master/data/coherenceMap';

export type MapInteraction = {
  hoveredId: string | null;
  related: Set<string> | null;
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
 * Color and dash styling for edges.
 */
function strokeFor(edge: CoherenceEdge, backward: boolean, traced: boolean): { stroke: string; dash?: string; width: number } {
  if (traced) {
    if (backward) return { stroke: '#9A3412', dash: '5 3', width: 3.2 };
    if (edge.kind === 'cross_curricular') return { stroke: '#0F766E', dash: '3 3', width: 3.2 };
    if (edge.status !== 'approved') return { stroke: '#B45309', dash: '6 4', width: 3.2 };
    return { stroke: '#047857', width: 3.5 };
  }

  if (backward) return { stroke: '#B45309', dash: '6 4', width: 2.2 };
  if (edge.kind === 'cross_curricular') return { stroke: '#0D9488', dash: '3 4', width: 2 };
  if (edge.status !== 'approved') return { stroke: '#D97706', dash: '6 4', width: 2.2 };

  return { stroke: '#059669', width: 2.2 };
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
      return getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        curvature: 0.65,
      });
    }

    return getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 6,
      offset: 18,
      centerX: payload?.laneX,
    });
  }, [backward, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, payload?.laneX]);

  const traced =
    hoveredId !== null && (edge?.source === hoveredId || edge?.target === hoveredId);
  const dimmed = hoveredId !== null && !traced;

  const { stroke, dash, width } = edge
    ? strokeFor(edge, backward, traced)
    : { stroke: '#cbd5e1', dash: undefined, width: 2 };

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      interactionWidth={20}
      style={{
        stroke,
        strokeWidth: width,
        strokeDasharray: dash,
        opacity: dimmed ? 0.14 : 1,
        filter: traced ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' : undefined,
      }}
      className="transition-all duration-200 motion-reduce:transition-none"
    />
  );
}

export const LaneEdge = LaneEdgeInner;

export const edgeTypes = { lane: LaneEdgeInner } as const;

export function markerColour(edge: CoherenceEdge, backward: boolean): string {
  if (backward) return '#B45309';
  if (edge.kind === 'cross_curricular') return '#0D9488';
  if (edge.status !== 'approved') return '#D97706';
  return '#059669';
}
