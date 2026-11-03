'use client';

/**
 * The Knowledge Graph pan/zoom canvas — built on `@xyflow/react` (already a
 * dependency, used elsewhere by the PAL `ConceptRelationshipGraph`) for the
 * pan/zoom/viewport engine.
 *
 * Two node renderers, selected by `variant`:
 *   - `'card'` (the default, unchanged): the original square drop-shadow
 *     "cards" matched to `achievethecore.org/coherence-map/`'s own served
 *     CSS. Every existing caller (`ModuleKnowledgeGraph.tsx`, the
 *     decentralized per-module tabs) keeps this exact look with zero prop
 *     changes.
 *   - `'browser'`: circular nodes coloured by real Neo4j label category (see
 *     graph-category-color.ts), always-visible relationship labels and
 *     arrowheads, a dark Neo4j-Browser-style canvas, a per-node "expand"
 *     affordance, and a small top-right toolbar (reset, fullscreen). Built
 *     for the rebuilt centralized explorer. Algorithmically the same radial
 *     hub-and-spoke BFS layout as the card variant and as
 *     ConceptRelationshipGraph's own radialLayout() — reused, not forked.
 *
 * Both variants are deterministic placements from real graph structure, not
 * a physics simulation.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Maximize2, Minimize2, Plus, RotateCcw } from 'lucide-react';

import { coherenceTheme, sourceDotStyle } from './coherence-theme';
import { categoryColor } from './graph-category-color';
import type { KgEdgeInput, KgNodeInput } from './graph-model';

type NodeData = { node: KgNodeInput; dimmed: boolean; selected: boolean; expandable: boolean };

const RING_GAP = 190;
const BROWSER_RING_GAP = 150;
/** Past this many nodes, laying out and rendering the whole graph stops being legible — guide the user to narrow it instead of silently freezing the canvas. */
const MAX_RENDERABLE_NODES = 400;
const BROWSER_CANVAS_BG = '#0a0e1a';
const BROWSER_DOT_BG = '#1e2a42';

const CENTER_HANDLE_STYLE: React.CSSProperties = {
  opacity: 0,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
};

/**
 * Radial hub-and-spoke layout: the current node (or the first node, absent
 * one) at the centre, its directly connected nodes in a ring around it,
 * two hops out in a wider ring — a real BFS over the edges actually
 * returned, not a physics simulation. Same approach for both variants;
 * only the ring spacing and node `type` differ.
 */
function layout(
  nodes: KgNodeInput[],
  edges: KgEdgeInput[],
  selectedId: string | null,
  highlightedIds: ReadonlySet<string> | undefined,
  variant: 'card' | 'browser'
): Node[] {
  if (nodes.length === 0) return [];

  const center = nodes.find((n) => n.current) ?? nodes[0];
  const adjacency = new Map<string, Set<string>>();
  for (const n of nodes) adjacency.set(n.id, new Set());
  for (const e of edges) {
    adjacency.get(e.source)?.add(e.target);
    adjacency.get(e.target)?.add(e.source);
  }

  const ringOf = new Map<string, number>([[center.id, 0]]);
  const queue: string[] = [center.id];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentRing = ringOf.get(currentId)!;
    for (const neighborId of adjacency.get(currentId) ?? []) {
      if (!ringOf.has(neighborId)) {
        ringOf.set(neighborId, currentRing + 1);
        queue.push(neighborId);
      }
    }
  }

  const maxKnownRing = Math.max(0, ...Array.from(ringOf.values()));
  const byRing = new Map<number, KgNodeInput[]>();
  for (const n of nodes) {
    const ring = ringOf.get(n.id) ?? maxKnownRing + 1;
    const list = byRing.get(ring) ?? [];
    list.push(n);
    byRing.set(ring, list);
  }

  const connectedToSelection = selectedId
    ? new Set([selectedId, ...(adjacency.get(selectedId) ?? [])])
    : null;
  const ringGap = variant === 'browser' ? BROWSER_RING_GAP : RING_GAP;
  const nodeType = variant === 'browser' ? 'browserNode' : 'coherenceCard';

  const result: Node[] = [];
  for (const [ring, ringNodes] of byRing) {
    const place = (n: KgNodeInput, x: number, y: number) => {
      const dimmed = connectedToSelection
        ? !connectedToSelection.has(n.id)
        : highlightedIds && highlightedIds.size > 0
          ? !highlightedIds.has(n.id)
          : false;
      result.push({
        id: n.id,
        type: nodeType,
        position: { x, y },
        data: { node: n, dimmed, selected: n.id === selectedId, expandable: variant === 'browser' } satisfies NodeData,
      });
    };

    if (ring === 0) {
      place(ringNodes[0], 0, 0);
      continue;
    }

    const radius = ring * ringGap;
    ringNodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / ringNodes.length - Math.PI / 2;
      place(n, radius * Math.cos(angle), radius * Math.sin(angle));
    });
  }

  return result;
}

function toFlowEdges(
  edges: KgEdgeInput[],
  selectedId: string | null,
  selectedEdgeId: string | null,
  variant: 'card' | 'browser'
): Edge[] {
  return edges.map((e) => {
    const touchesSelection = selectedId !== null && (e.source === selectedId || e.target === selectedId);
    const isSelectedEdge = e.id === selectedEdgeId;
    const highlighted = touchesSelection || isSelectedEdge;
    const dimmed = (selectedId !== null || selectedEdgeId !== null) && !highlighted;
    const alwaysShowLabel = variant === 'browser';

    const stroke = isSelectedEdge
      ? coherenceTheme.color.accentBright
      : highlighted
        ? coherenceTheme.color.edgeHighlight
        : coherenceTheme.color.edgeDim;

    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'straight',
      label: alwaysShowLabel || highlighted ? e.relation : undefined,
      labelStyle: {
        fill: variant === 'browser' ? '#cbd5e1' : coherenceTheme.color.text,
        fontSize: 10.5,
      },
      labelBgStyle: { fill: variant === 'browser' ? '#1e293b' : coherenceTheme.color.bgCream },
      style: {
        stroke,
        strokeWidth: isSelectedEdge ? 3 : highlighted ? 2.5 : 1.5,
        strokeDasharray: e.directed ? undefined : '5 4',
        opacity: dimmed ? 0.25 : 1,
      },
      markerEnd: e.directed
        ? { type: MarkerType.ArrowClosed, color: stroke, width: 14, height: 14 }
        : undefined,
      zIndex: highlighted ? 10 : 0,
    };
  });
}

/**
 * The "card" — square, layered drop-shadow, green fill, white centred
 * label, grown when selected. Matches `.card`/`.selected .card` in the
 * reference's style.css nearly to the pixel (160×100 default, 250×160
 * selected, the same three-offset box-shadow). Unchanged from before the
 * browser variant was added.
 */
function CoherenceCard({ data }: NodeProps) {
  const { node, dimmed, selected } = data as unknown as NodeData;
  const dot = sourceDotStyle[node.source];
  const size = selected
    ? { width: coherenceTheme.node.selectedWidth, height: coherenceTheme.node.selectedHeight }
    : { width: coherenceTheme.node.width, height: coherenceTheme.node.height };

  return (
    <div
      className="flex items-center justify-center rounded-[2px] border transition-all duration-500"
      style={{
        ...size,
        background: selected ? coherenceTheme.color.accentAlt : coherenceTheme.color.accent,
        borderColor: coherenceTheme.color.shadowAlt,
        boxShadow: `-3px 3px ${coherenceTheme.color.shadow}, -2px 2px ${coherenceTheme.color.shadow}, -1px 1px ${coherenceTheme.color.shadow}`,
        opacity: dimmed ? 0.35 : 1,
        cursor: 'pointer',
      }}
      title={node.label}
    >
      <Handle type="target" position={Position.Top} style={CENTER_HANDLE_STYLE} />
      <Handle type="source" position={Position.Top} style={CENTER_HANDLE_STYLE} />

      <span
        className="absolute flex h-2 w-2 items-center justify-center rounded-full"
        style={{
          top: 8,
          left: 8,
          backgroundColor: dot.filled ? dot.fill : 'transparent',
          border: `2px solid ${dot.fill}`,
        }}
        aria-hidden="true"
      />

      <span
        className="line-clamp-3 px-3 text-center text-[13px] font-semibold leading-snug text-white"
        style={{ fontFamily: coherenceTheme.font.heading }}
      >
        {node.label}
      </span>
    </div>
  );
}

/**
 * The Neo4j-Browser-style node: a flat-coloured circle, one colour per real
 * label category (categoryColor()), with a small "+" affordance to expand
 * this node's own connections (`onExpandNode`) rather than dumping every
 * relationship a node has into the initial sample.
 */
function BrowserNode({ data, id }: NodeProps) {
  const { node, dimmed, selected, expandable } = data as unknown as NodeData;
  const color = categoryColor(node.entityKey);

  return (
    <div className="group flex flex-col items-center" style={{ width: 150, opacity: dimmed ? 0.3 : 1 }}>
      <div
        className={`relative flex h-16 w-16 items-center justify-center rounded-full ${color.bg} shadow-lg ring-2 ${color.ring} transition-transform group-hover:scale-105 ${
          selected ? 'ring-4 ring-offset-2 ring-offset-[#0a0e1a]' : ''
        }`}
        style={selected ? { boxShadow: `0 0 18px 4px ${color.dot}73` } : undefined}
        title={node.label}
      >
        <Handle type="target" position={Position.Top} style={CENTER_HANDLE_STYLE} />
        <Handle type="source" position={Position.Top} style={CENTER_HANDLE_STYLE} />
        <span className="line-clamp-2 px-1.5 text-center text-[9px] font-semibold leading-tight text-white">
          {node.label}
        </span>

        {expandable && (
          <button
            type="button"
            data-node-expand={id}
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white ring-1 ring-white/30 hover:bg-slate-700"
            title="Expand this node's connections"
            aria-label="Expand connections"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
      <span className="mt-1.5 max-w-[130px] truncate text-[10px] font-medium text-slate-300" title={node.entityKey}>
        {node.entityKey}
      </span>
    </div>
  );
}

const nodeTypes = { coherenceCard: CoherenceCard, browserNode: BrowserNode };

/** Reset-view + fullscreen-toggle, rendered inside the ReactFlow tree so it can call useReactFlow(). Browser variant only — existing pages never see this. */
function CanvasToolbar({
  onReset,
  onToggleFullscreen,
  isFullscreen,
}: {
  onReset: () => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
}) {
  const { fitView } = useReactFlow();

  const buttonClass =
    'flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-slate-900/85 text-slate-200 hover:bg-slate-800';

  return (
    <Panel position="top-right" className="!m-2 flex gap-1.5">
      <button
        type="button"
        className={buttonClass}
        title="Reset view"
        onClick={() => {
          onReset();
          window.requestAnimationFrame(() => fitView({ padding: 0.3 }));
        }}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
      <button type="button" className={buttonClass} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={onToggleFullscreen}>
        {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      </button>
    </Panel>
  );
}

export default function GraphCanvas({
  nodes,
  edges,
  onNodeSelect,
  onEdgeSelect,
  onExpandNode,
  highlightedIds,
  variant = 'card',
  heightClassName = 'h-[560px]',
}: {
  nodes: KgNodeInput[];
  edges: KgEdgeInput[];
  /** Fired on every click, including re-clicking the already-selected node (null clears it). */
  onNodeSelect?: (node: KgNodeInput | null) => void;
  /** Browser variant only — fired when a relationship (edge) is clicked, null clears it. */
  onEdgeSelect?: (edge: KgEdgeInput | null) => void;
  /** Browser variant only — fired when a node's own "+" expand affordance is clicked. */
  onExpandNode?: (node: KgNodeInput) => void;
  /** Node ids to keep at full opacity when nothing is selected — e.g. search/filter matches. Ignored while a node is selected (selection takes over dimming). */
  highlightedIds?: ReadonlySet<string>;
  /** 'card' (default, unchanged) or 'browser' (Neo4j-Browser-styled, for the centralized explorer). */
  variant?: 'card' | 'browser';
  heightClassName?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (variant !== 'browser') return;
    const handler = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [variant]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      containerRef.current.requestFullscreen?.().catch(() => undefined);
    }
  }, []);

  const flowNodes = useMemo(
    () => layout(nodes, edges, selectedId, highlightedIds, variant),
    [nodes, edges, selectedId, highlightedIds, variant]
  );
  const flowEdges = useMemo(
    () => toFlowEdges(edges, selectedId, selectedEdgeId, variant),
    [edges, selectedId, selectedEdgeId, variant]
  );

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, flowNode: Node) => {
      const target = event.target as HTMLElement;
      const expandNodeId = target.closest('[data-node-expand]')?.getAttribute('data-node-expand');
      if (expandNodeId) {
        const node = nodes.find((n) => n.id === expandNodeId);
        if (node) onExpandNode?.(node);
        return;
      }

      setSelectedEdgeId(null);
      const next = flowNode.id === selectedId ? null : flowNode.id;
      setSelectedId(next);
      onNodeSelect?.(next ? (nodes.find((n) => n.id === next) ?? null) : null);
    },
    [selectedId, nodes, onNodeSelect, onExpandNode]
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, flowEdge: Edge) => {
      if (variant !== 'browser') return;
      setSelectedId(null);
      onNodeSelect?.(null);
      const next = flowEdge.id === selectedEdgeId ? null : flowEdge.id;
      setSelectedEdgeId(next);
      onEdgeSelect?.(next ? (edges.find((e) => e.id === next) ?? null) : null);
    },
    [variant, selectedEdgeId, edges, onEdgeSelect, onNodeSelect]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedId(null);
    setSelectedEdgeId(null);
    onNodeSelect?.(null);
    onEdgeSelect?.(null);
  }, [onNodeSelect, onEdgeSelect]);

  if (nodes.length > MAX_RENDERABLE_NODES) {
    return (
      <div
        className={`${heightClassName} flex w-full items-center justify-center rounded-xl border px-6 text-center text-sm`}
        style={{ backgroundColor: coherenceTheme.color.bgPage, borderColor: coherenceTheme.color.divider, color: coherenceTheme.color.text }}
      >
        This graph has {nodes.length.toLocaleString()} nodes — too many to lay out legibly at once. Narrow it with search or a
        filter, or open a more specific submodule, to explore it here.
      </div>
    );
  }

  const bg = variant === 'browser' ? BROWSER_CANVAS_BG : coherenceTheme.color.bgPage;
  const dotColor = variant === 'browser' ? BROWSER_DOT_BG : coherenceTheme.color.dividerAlt;

  return (
    <div
      ref={containerRef}
      className={`${isFullscreen ? 'fixed inset-0 z-[1500] h-screen w-screen' : `${heightClassName} w-full`} overflow-hidden rounded-xl border`}
      style={{ backgroundColor: bg, borderColor: variant === 'browser' ? '#1e293b' : coherenceTheme.color.divider }}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onPaneClick={handlePaneClick}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.15}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} color={dotColor} gap={24} size={1} />
          <Controls
            showInteractive={false}
            className={variant === 'browser' ? '!border !border-white/10 [&>button]:!border-white/10 [&>button]:!bg-slate-900 [&>button:hover]:!bg-slate-800 [&>button]:!fill-slate-300' : undefined}
          />
          {variant === 'browser' && (
            <CanvasToolbar
              onReset={() => {
                setSelectedId(null);
                setSelectedEdgeId(null);
                onNodeSelect?.(null);
                onEdgeSelect?.(null);
              }}
              onToggleFullscreen={toggleFullscreen}
              isFullscreen={isFullscreen}
            />
          )}
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
