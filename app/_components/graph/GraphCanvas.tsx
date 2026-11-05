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
 * Focus-Based Interactive Knowledge Graph features:
 * - Click any node to set primary focus with prominent highlight and border
 * - Directly connected nodes remain bright; connected relationships highlighted
 * - Unrelated nodes and relationships fade smoothly with reduced opacity
 * - Dynamic focus switching when clicking another node without reloading
 * - Automatic center and zoom around the focused node with smooth transitions
 * - Interactive hover tooltips for nodes (name, actual type, ID) and edges
 *   (relationship type, source, target, properties)
 * - Clear focus controls and seamless light/dark theme support
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
import { EyeOff, Maximize2, Minimize2, Plus, RotateCcw } from 'lucide-react';

import { coherenceTheme, sourceDotStyle } from './coherence-theme';
import { categoryColor } from './graph-category-color';
import type { KgEdgeInput, KgNodeInput } from './graph-model';

type NodeData = {
  node: KgNodeInput;
  dimmed: boolean;
  selected: boolean;
  isConnected: boolean;
  expandable: boolean;
  theme?: 'light' | 'dark';
};

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
  variant: 'card' | 'browser',
  theme: 'light' | 'dark' = 'light'
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

  const connectedNeighbors = selectedId ? (adjacency.get(selectedId) ?? new Set<string>()) : null;
  const connectedToSelection = selectedId
    ? new Set([selectedId, ...(connectedNeighbors ? Array.from(connectedNeighbors) : [])])
    : null;
  const ringGap = variant === 'browser' ? BROWSER_RING_GAP : RING_GAP;
  const nodeType = variant === 'browser' ? 'browserNode' : 'coherenceCard';

  const result: Node[] = [];
  for (const [ring, ringNodes] of Array.from(byRing.entries())) {
    const place = (n: KgNodeInput, x: number, y: number) => {
      const isSelected = n.id === selectedId;
      const isConnected = Boolean(selectedId && !isSelected && connectedNeighbors?.has(n.id));
      const dimmed = connectedToSelection
        ? !connectedToSelection.has(n.id)
        : highlightedIds && highlightedIds.size > 0
          ? !highlightedIds.has(n.id)
          : false;

      result.push({
        id: n.id,
        type: nodeType,
        position: { x, y },
        data: {
          node: n,
          dimmed,
          selected: isSelected,
          isConnected,
          expandable: variant === 'browser',
          theme,
        } satisfies NodeData,
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
  variant: 'card' | 'browser',
  theme: 'light' | 'dark' = 'light'
): Edge[] {
  return edges.map((e) => {
    const touchesSelection = selectedId !== null && (e.source === selectedId || e.target === selectedId);
    const isSelectedEdge = e.id === selectedEdgeId;
    const highlighted = touchesSelection || isSelectedEdge;
    const dimmed = (selectedId !== null || selectedEdgeId !== null) && !highlighted;
    const alwaysShowLabel = variant === 'browser';

    const isSqlSourced = e.sourceKind === 'sql';

    const stroke = isSelectedEdge
      ? coherenceTheme.color.accentBright
      : isSqlSourced
        ? (dimmed ? '#64748b' : coherenceTheme.color.edgeDim)
        : highlighted
          ? (theme === 'dark' ? '#60a5fa' : '#2563eb')
          : (theme === 'dark' ? '#334155' : '#cbd5e1');

    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'straight',
      data: { edge: e },
      // A SQL-sourced edge always shows its label — "sql join" needs to read
      // as different from a real Neo4j relationship at a glance, not only
      // on hover/selection.
      label: alwaysShowLabel || highlighted || isSqlSourced ? (isSqlSourced ? `${e.relation} (SQL)` : e.relation) : undefined,
      labelStyle: {
        fill: highlighted
          ? (theme === 'dark' ? '#93c5fd' : '#1d4ed8')
          : isSqlSourced
            ? coherenceTheme.color.edgeDim
            : variant === 'browser'
              ? theme === 'dark'
                ? '#94a3b8'
                : '#475569'
              : coherenceTheme.color.text,
        fontSize: highlighted ? 11 : 10,
        fontWeight: highlighted ? 700 : 500,
        fontStyle: isSqlSourced ? 'italic' : undefined,
      },
      labelBgStyle: {
        fill: highlighted
          ? (theme === 'dark' ? '#1e3a8a' : '#dbeafe')
          : variant === 'browser'
            ? (theme === 'dark' ? '#1e293b' : '#f8fafc')
            : coherenceTheme.color.bgCream,
        stroke: highlighted
          ? (theme === 'dark' ? '#3b82f6' : '#2563eb')
          : (variant === 'browser' && theme === 'light' ? '#e2e8f0' : undefined),
        strokeWidth: highlighted ? 1.5 : (variant === 'browser' && theme === 'light' ? 1 : 0),
        fillOpacity: highlighted ? 0.98 : 0.9,
      },
      style: {
        stroke,
        strokeWidth: isSelectedEdge ? 3.5 : highlighted ? 3 : 1.5,
        // Dashed for a non-directed edge OR a SQL-sourced one — a SQL join is
        // never rendered as if it were a confirmed Neo4j relationship.
        strokeDasharray: e.directed && !isSqlSourced ? undefined : '5 4',
        opacity: dimmed ? 0.12 : isSqlSourced ? 0.6 : 1,
        transition: 'all 0.3s ease',
      },
      markerEnd: e.directed
        ? {
            type: MarkerType.ArrowClosed,
            color: stroke,
            width: highlighted ? 18 : 14,
            height: highlighted ? 18 : 14,
          }
        : undefined,
      zIndex: highlighted ? 20 : 0,
    };
  });
}

/**
 * The "card" — square, layered drop-shadow, green fill, white centred
 * label, grown when selected. Matches `.card`/`.selected .card` in the
 * reference's style.css nearly to the pixel (160×100 default, 250×160
 * selected, the same three-offset box-shadow).
 */
function CoherenceCard({ data }: NodeProps) {
  const { node, dimmed, selected, isConnected } = data as unknown as NodeData;
  const dot = sourceDotStyle[node.source];
  const size = selected
    ? { width: coherenceTheme.node.selectedWidth, height: coherenceTheme.node.selectedHeight }
    : { width: coherenceTheme.node.width, height: coherenceTheme.node.height };

  return (
    <div
      className="flex items-center justify-center rounded-[2px] border transition-all duration-300"
      style={{
        ...size,
        background: selected ? coherenceTheme.color.accentAlt : coherenceTheme.color.accent,
        borderColor: selected ? '#3b82f6' : isConnected ? '#60a5fa' : coherenceTheme.color.shadowAlt,
        boxShadow: selected
          ? `0 0 20px 4px rgba(59, 130, 246, 0.5), -3px 3px ${coherenceTheme.color.shadow}`
          : `-3px 3px ${coherenceTheme.color.shadow}, -2px 2px ${coherenceTheme.color.shadow}, -1px 1px ${coherenceTheme.color.shadow}`,
        opacity: dimmed ? 0.25 : 1,
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
 *
 * Visual focus states:
 * - Selected node: scaled up, prominent highlight, glowing halo, bright ring border
 * - Connected nodes: normal brightness, subtle elevation ring
 * - Unrelated nodes: faded appearance (opacity 0.22) with smooth CSS transitions
 */
function BrowserNode({ data, id }: NodeProps) {
  const { node, dimmed, selected, isConnected, expandable, theme = 'light' } = data as unknown as NodeData & { theme?: 'light' | 'dark' };
  const color = categoryColor(node.entityKey);

  return (
    <div
      className="group relative flex flex-col items-center transition-all duration-300 ease-in-out"
      style={{
        width: 150,
        opacity: dimmed ? 0.22 : 1,
        filter: dimmed ? 'grayscale(35%)' : undefined,
        transform: selected ? 'scale(1.12)' : isConnected ? 'scale(1.02)' : 'scale(1)',
        zIndex: selected ? 30 : isConnected ? 15 : 1,
      }}
    >
      {/* Visual Indicator for Selected Focus Node */}
      {selected && (
        <span className="absolute -top-6 rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-bold tracking-wider text-white shadow-md uppercase ring-2 ring-white/50 animate-bounce">
          Focus
        </span>
      )}

      {/* Visual Indicator for Connected Node */}
      {isConnected && (
        <span
          className={`absolute -top-5 rounded px-1.5 py-0.2 text-[8px] font-semibold shadow-sm ${
            theme === 'dark' ? 'bg-slate-800 text-blue-300 border border-blue-500/30' : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}
        >
          Connected
        </span>
      )}

      <div
        className={`relative flex h-16 w-16 items-center justify-center rounded-full ${color.bg} shadow-lg ring-2 ${color.ring} transition-all duration-300 group-hover:scale-105 ${
          selected
            ? theme === 'dark'
              ? 'ring-4 ring-offset-4 ring-offset-[#0a0e1a] ring-blue-400'
              : 'ring-4 ring-offset-4 ring-offset-white ring-blue-600'
            : isConnected
              ? theme === 'dark'
                ? 'ring-2 ring-offset-2 ring-offset-[#0a0e1a] ring-sky-400'
                : 'ring-2 ring-offset-2 ring-offset-white ring-blue-400'
              : ''
        }`}
        style={
          selected
            ? {
                boxShadow: `0 0 28px 8px ${color.dot}99, 0 0 12px 2px rgba(59, 130, 246, 0.6)`,
              }
            : isConnected
              ? {
                  boxShadow: `0 0 14px 2px ${color.dot}55`,
                }
              : undefined
        }
        title={node.label}
      >
        <Handle type="target" position={Position.Top} style={CENTER_HANDLE_STYLE} />
        <Handle type="source" position={Position.Top} style={CENTER_HANDLE_STYLE} />
        <span className="line-clamp-2 px-1.5 text-center text-[9px] font-semibold leading-tight text-white drop-shadow-sm select-none">
          {node.label}
        </span>

        {expandable && (
          <button
            type="button"
            data-node-expand={id}
            className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95 ${
              theme === 'dark'
                ? 'bg-slate-900 text-white ring-1 ring-white/30 hover:bg-slate-700'
                : 'bg-white text-slate-700 ring-1 ring-slate-300 shadow-sm hover:bg-slate-100'
            }`}
            title="Expand this node's connections"
            aria-label="Expand connections"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>

      <span
        className={`mt-1.5 max-w-[130px] truncate rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide transition-colors ${
          selected
            ? theme === 'dark'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
              : 'bg-blue-100 text-blue-800 border border-blue-300'
            : isConnected
              ? theme === 'dark'
                ? 'text-sky-300'
                : 'text-blue-700'
              : theme === 'dark'
                ? 'text-slate-400'
                : 'text-slate-600'
        }`}
        title={node.entityKey}
      >
        {node.entityKey}
      </span>
    </div>
  );
}

const nodeTypes = { coherenceCard: CoherenceCard, browserNode: BrowserNode };

/** Reset-view, clear-focus, and fullscreen-toggle inside the ReactFlow tree */
function CanvasToolbar({
  onReset,
  onClearFocus,
  hasActiveFocus = false,
  onToggleFullscreen,
  isFullscreen,
  theme = 'light',
}: {
  onReset: () => void;
  onClearFocus?: () => void;
  hasActiveFocus?: boolean;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  theme?: 'light' | 'dark';
}) {
  const { fitView } = useReactFlow();

  const buttonClass =
    theme === 'dark'
      ? 'flex h-8 items-center justify-center gap-1 rounded-md border border-white/10 bg-slate-900/85 px-2 text-slate-200 hover:bg-slate-800 text-xs font-medium'
      : 'flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white/90 px-2 text-slate-700 shadow-sm hover:bg-slate-50 text-xs font-medium';

  const iconOnlyClass =
    theme === 'dark'
      ? 'flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-slate-900/85 text-slate-200 hover:bg-slate-800'
      : 'flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:bg-slate-50';

  return (
    <Panel position="top-right" className="!m-2 flex items-center gap-1.5">
      {hasActiveFocus && onClearFocus && (
        <button
          type="button"
          className={buttonClass}
          title="Clear focus and show complete graph"
          onClick={onClearFocus}
        >
          <EyeOff className="h-3.5 w-3.5 text-blue-500" />
          <span>Clear focus</span>
        </button>
      )}
      <button
        type="button"
        className={iconOnlyClass}
        title="Reset view and fit whole graph"
        onClick={() => {
          onReset();
          window.requestAnimationFrame(() => fitView({ padding: 0.3, duration: 600 }));
        }}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={iconOnlyClass}
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        onClick={onToggleFullscreen}
      >
        {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      </button>
    </Panel>
  );
}

export interface GraphCanvasProps {
  nodes: KgNodeInput[];
  edges: KgEdgeInput[];
  /** Controlled selected node id */
  selectedNodeId?: string | null;
  /** Controlled selected edge id */
  selectedEdgeId?: string | null;
  /** Fired on every click, including re-clicking the already-selected node (null clears it). */
  onNodeSelect?: (node: KgNodeInput | null) => void;
  /** Browser variant only — fired when a relationship (edge) is clicked, null clears it. */
  onEdgeSelect?: (edge: KgEdgeInput | null) => void;
  /** Browser variant only — fired when a node's own "+" expand affordance is clicked. */
  onExpandNode?: (node: KgNodeInput) => void;
  /** Browser variant only — fired on a real double-click (ReactFlow's own `onNodeDoubleClick`, tied to the native `dblclick` event — never inferred from click timing). */
  onNodeDoubleClick?: (node: KgNodeInput) => void;
  /** Fired when focus is cleared via canvas interaction or button */
  onClearFocus?: () => void;
  /** Node ids to keep at full opacity when nothing is selected — e.g. search/filter matches. Ignored while a node is selected (selection takes over dimming). */
  highlightedIds?: ReadonlySet<string>;
  /** 'card' (default, unchanged) or 'browser' (Neo4j-Browser-styled, for the centralized explorer). */
  variant?: 'card' | 'browser';
  /** 'light' (default) or 'dark' theme */
  theme?: 'light' | 'dark';
  heightClassName?: string;
}

interface TooltipState {
  type: 'node' | 'edge';
  x: number;
  y: number;
  node?: KgNodeInput;
  edge?: KgEdgeInput;
  sourceNode?: KgNodeInput;
  targetNode?: KgNodeInput;
}

/** Inner component with direct access to useReactFlow() */
function GraphCanvasInner({
  nodes,
  edges,
  selectedNodeId: controlledSelectedNodeId,
  selectedEdgeId: controlledSelectedEdgeId,
  onNodeSelect,
  onEdgeSelect,
  onExpandNode,
  onNodeDoubleClick,
  onClearFocus,
  highlightedIds,
  variant = 'card',
  theme = 'light',
  heightClassName = 'h-[560px]',
}: GraphCanvasProps) {
  const { setCenter, fitView } = useReactFlow();

  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(controlledSelectedNodeId ?? null);
  const [internalSelectedEdgeId, setInternalSelectedEdgeId] = useState<string | null>(controlledSelectedEdgeId ?? null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevSelectedIdRef = useRef<string | null>(null);

  // Synchronize controlled selected ids
  const selectedId = controlledSelectedNodeId !== undefined ? controlledSelectedNodeId : internalSelectedId;
  const selectedEdgeId = controlledSelectedEdgeId !== undefined ? controlledSelectedEdgeId : internalSelectedEdgeId;

  // Node cache for fast lookup
  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

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
    () => layout(nodes, edges, selectedId, highlightedIds, variant, theme),
    [nodes, edges, selectedId, highlightedIds, variant, theme]
  );
  const flowEdges = useMemo(
    () => toFlowEdges(edges, selectedId, selectedEdgeId, variant, theme),
    [edges, selectedId, selectedEdgeId, variant, theme]
  );

  // Center and zoom around focused node with smooth animation
  useEffect(() => {
    if (selectedId && selectedId !== prevSelectedIdRef.current) {
      const targetNode = flowNodes.find((n) => n.id === selectedId);
      if (targetNode) {
        // Offset for browser node center (150 width, 70 height)
        const cx = targetNode.position.x + 75;
        const cy = targetNode.position.y + 35;
        void setCenter(cx, cy, { zoom: 1.15, duration: 600 });
      }
    } else if (!selectedId && prevSelectedIdRef.current) {
      // Focus cleared: smoothly restore whole graph view
      void fitView({ padding: 0.3, duration: 600 });
    }
    prevSelectedIdRef.current = selectedId;
  }, [selectedId, flowNodes, setCenter, fitView]);

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, flowNode: Node) => {
      const target = event.target as HTMLElement;
      const expandNodeId = target.closest('[data-node-expand]')?.getAttribute('data-node-expand');
      if (expandNodeId) {
        const node = nodes.find((n) => n.id === expandNodeId);
        if (node) onExpandNode?.(node);
        return;
      }

      setInternalSelectedEdgeId(null);
      // Toggle if clicking same node, activate if clicking new node
      const next = flowNode.id === selectedId ? null : flowNode.id;
      setInternalSelectedId(next);
      onNodeSelect?.(next ? (nodes.find((n) => n.id === next) ?? null) : null);
      if (!next) {
        onClearFocus?.();
      }
    },
    [selectedId, nodes, onNodeSelect, onExpandNode, onClearFocus]
  );

  const handleNodeDoubleClick = useCallback(
    (event: React.MouseEvent, flowNode: Node) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-node-expand]')) return;

      const node = nodes.find((n) => n.id === flowNode.id);
      if (node) onNodeDoubleClick?.(node);
    },
    [nodes, onNodeDoubleClick]
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, flowEdge: Edge) => {
      if (variant !== 'browser') return;
      setInternalSelectedId(null);
      onNodeSelect?.(null);
      const next = flowEdge.id === selectedEdgeId ? null : flowEdge.id;
      setInternalSelectedEdgeId(next);
      onEdgeSelect?.(next ? (edges.find((e) => e.id === next) ?? null) : null);
      if (!next) {
        onClearFocus?.();
      }
    },
    [variant, selectedEdgeId, edges, onEdgeSelect, onNodeSelect, onClearFocus]
  );

  const handlePaneClick = useCallback(() => {
    setInternalSelectedId(null);
    setInternalSelectedEdgeId(null);
    onNodeSelect?.(null);
    onEdgeSelect?.(null);
    onClearFocus?.();
    setTooltip(null);
    void fitView({ padding: 0.3, duration: 600 });
  }, [onNodeSelect, onEdgeSelect, onClearFocus, fitView]);

  const handleClearFocus = useCallback(() => {
    setInternalSelectedId(null);
    setInternalSelectedEdgeId(null);
    onNodeSelect?.(null);
    onEdgeSelect?.(null);
    onClearFocus?.();
    setTooltip(null);
    void fitView({ padding: 0.3, duration: 600 });
  }, [onNodeSelect, onEdgeSelect, onClearFocus, fitView]);

  // Hover Tooltip Handlers for Nodes
  const handleNodeMouseEnter = useCallback(
    (event: React.MouseEvent, flowNode: Node) => {
      const node = nodesById.get(flowNode.id);
      if (!node) return;
      setTooltip({
        type: 'node',
        x: event.clientX,
        y: event.clientY,
        node,
      });
    },
    [nodesById]
  );

  const handleNodeMouseMove = useCallback((event: React.MouseEvent) => {
    setTooltip((prev) => (prev && prev.type === 'node' ? { ...prev, x: event.clientX, y: event.clientY } : prev));
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    setTooltip((prev) => (prev?.type === 'node' ? null : prev));
  }, []);

  // Hover Tooltip Handlers for Edges
  const handleEdgeMouseEnter = useCallback(
    (event: React.MouseEvent, flowEdge: Edge) => {
      const edge = edges.find((e) => e.id === flowEdge.id);
      if (!edge) return;
      setTooltip({
        type: 'edge',
        x: event.clientX,
        y: event.clientY,
        edge,
        sourceNode: nodesById.get(edge.source),
        targetNode: nodesById.get(edge.target),
      });
    },
    [edges, nodesById]
  );

  const handleEdgeMouseMove = useCallback((event: React.MouseEvent) => {
    setTooltip((prev) => (prev && prev.type === 'edge' ? { ...prev, x: event.clientX, y: event.clientY } : prev));
  }, []);

  const handleEdgeMouseLeave = useCallback(() => {
    setTooltip((prev) => (prev?.type === 'edge' ? null : prev));
  }, []);

  const bg =
    variant === 'browser'
      ? theme === 'dark'
        ? BROWSER_CANVAS_BG
        : '#ffffff'
      : coherenceTheme.color.bgPage;
  const dotColor =
    variant === 'browser'
      ? theme === 'dark'
        ? BROWSER_DOT_BG
        : '#e2e8f0'
      : coherenceTheme.color.dividerAlt;
  const borderColor =
    variant === 'browser'
      ? theme === 'dark'
        ? '#1e293b'
        : '#e2e8f0'
      : coherenceTheme.color.divider;

  return (
    <div
      ref={containerRef}
      className={`relative ${isFullscreen ? 'fixed inset-0 z-[1500] h-screen w-screen' : `${heightClassName} w-full`} overflow-hidden rounded-xl border`}
      style={{ backgroundColor: bg, borderColor }}
    >
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseMove={handleNodeMouseMove}
        onNodeMouseLeave={handleNodeMouseLeave}
        onEdgeClick={handleEdgeClick}
        onEdgeMouseEnter={handleEdgeMouseEnter}
        onEdgeMouseMove={handleEdgeMouseMove}
        onEdgeMouseLeave={handleEdgeMouseLeave}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.15}
        maxZoom={2.5}
      >
        <Background variant={BackgroundVariant.Dots} color={dotColor} gap={24} size={1} />
        <Controls
          showInteractive={false}
          className={
            variant === 'browser'
              ? theme === 'dark'
                ? '!border !border-white/10 [&>button]:!border-white/10 [&>button]:!bg-slate-900 [&>button:hover]:!bg-slate-800 [&>button]:!fill-slate-300'
                : '!border !border-slate-200 [&>button]:!border-slate-200 [&>button]:!bg-white [&>button:hover]:!bg-slate-50 [&>button]:!fill-slate-600 !shadow-sm'
              : undefined
          }
        />
        {variant === 'browser' && (
          <CanvasToolbar
            onReset={handleClearFocus}
            onClearFocus={handleClearFocus}
            hasActiveFocus={Boolean(selectedId || selectedEdgeId)}
            onToggleFullscreen={toggleFullscreen}
            isFullscreen={isFullscreen}
            theme={theme}
          />
        )}
      </ReactFlow>

      {/* Interactive Hover Tooltip for Nodes and Relationships */}
      {tooltip && (
        <div
          className={`pointer-events-none fixed z-[9999] max-w-sm rounded-xl border p-3.5 shadow-2xl backdrop-blur-md transition-opacity duration-150 ${
            theme === 'dark'
              ? 'border-slate-700 bg-slate-900/95 text-slate-100 shadow-black/60'
              : 'border-slate-200 bg-white/95 text-slate-800 shadow-slate-400/40'
          }`}
          style={{
            left: Math.min(
              typeof window !== 'undefined' ? window.innerWidth - 300 : 800,
              Math.max(16, tooltip.x + 14)
            ),
            top: Math.min(
              typeof window !== 'undefined' ? window.innerHeight - 240 : 600,
              Math.max(16, tooltip.y + 14)
            ),
          }}
        >
          {tooltip.type === 'node' && tooltip.node && (
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between gap-3 border-b pb-1.5 border-inherit">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
                    style={{ backgroundColor: categoryColor(tooltip.node.entityKey).dot }}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Node Details
                  </span>
                </div>
                {tooltip.node.recordId !== null && tooltip.node.recordId !== undefined && (
                  <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    ID: {String(tooltip.node.recordId)}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-bold leading-snug">
                  {tooltip.node.label}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-medium">Actual Type:</span>
                  <span className="rounded bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-xs font-bold text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                    {tooltip.node.entityKey}
                  </span>
                </div>
              </div>
              {tooltip.node.id && (
                <div className="border-t border-inherit pt-1.5 text-[10px] text-slate-400 truncate">
                  <span className="font-medium">Graph Ref: </span>
                  <span className="font-mono">{tooltip.node.id}</span>
                </div>
              )}
            </div>
          )}

          {tooltip.type === 'edge' && tooltip.edge && (
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between gap-3 border-b pb-1.5 border-inherit">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Relationship Details
                </span>
                {tooltip.edge.sourceKind && (
                  <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-300 uppercase border border-slate-200 dark:border-slate-700">
                    {tooltip.edge.sourceKind}
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-medium">Relationship Type:</span>
                  <span className="rounded bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 text-xs font-bold text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                    {tooltip.edge.relation}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-50 dark:bg-slate-800/60 p-2 text-[11px] border border-inherit">
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase">Source Node</span>
                  <p className="font-bold truncate mt-0.5" title={tooltip.sourceNode?.label ?? tooltip.edge.source}>
                    {tooltip.sourceNode?.label ?? tooltip.edge.source}
                  </p>
                  {tooltip.sourceNode?.entityKey && (
                    <span className="inline-block mt-0.5 rounded px-1 text-[9px] font-medium bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {tooltip.sourceNode.entityKey}
                    </span>
                  )}
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase">Target Node</span>
                  <p className="font-bold truncate mt-0.5" title={tooltip.targetNode?.label ?? tooltip.edge.target}>
                    {tooltip.targetNode?.label ?? tooltip.edge.target}
                  </p>
                  {tooltip.targetNode?.entityKey && (
                    <span className="inline-block mt-0.5 rounded px-1 text-[9px] font-medium bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {tooltip.targetNode.entityKey}
                    </span>
                  )}
                </div>
              </div>
              {tooltip.edge.properties && Object.keys(tooltip.edge.properties).length > 0 && (
                <div className="border-t border-inherit pt-1.5">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Properties
                  </span>
                  <div className="mt-1 max-h-24 overflow-y-auto space-y-1">
                    {Object.entries(tooltip.edge.properties).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2 text-[10px]">
                        <span className="text-slate-400 font-medium">{k}:</span>
                        <span className="font-mono font-semibold text-slate-700 dark:text-slate-200 truncate">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Root exported component wrapping ReactFlowProvider so all child hooks
 * (useReactFlow, fitView, setCenter) function reliably.
 */
export default function GraphCanvas(props: GraphCanvasProps) {
  if (props.nodes.length > MAX_RENDERABLE_NODES) {
    return (
      <div
        className={`${props.heightClassName ?? 'h-[560px]'} flex w-full items-center justify-center rounded-xl border px-6 text-center text-sm`}
        style={{
          backgroundColor: coherenceTheme.color.bgPage,
          borderColor: coherenceTheme.color.divider,
          color: coherenceTheme.color.text,
        }}
      >
        This graph has {props.nodes.length.toLocaleString()} nodes — too many to lay out legibly at once. Narrow it with search or a
        filter, or open a more specific submodule, to explore it here.
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
