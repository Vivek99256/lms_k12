'use client';

/**
 * The Knowledge Graph Explorer's canvas.
 *
 * Deliberately generic: it draws whatever `nodes`/`edges` it is given (see
 * graph-model.ts), and does not know or care whether they came from the
 * MariaDB curriculum hierarchy, the ESO concept map, or the Neo4j
 * AI-suggested overlay — that decision, and all the fetching it implies,
 * belongs to the page. This is also why it is shared verbatim by the
 * Context Graph Inspector's "Concept Relationships" stage rather than
 * forked: one canvas, one legend, one solid/dashed convention.
 *
 * Two layouts, chosen automatically by what the nodes carry:
 *   - Containment (nodes have parentId — the curriculum hierarchy): a top-
 *     down tree, a child positioned under its real parent. See
 *     treeLayout().
 *   - Relationship (no parentId — a concept's prerequisite/related
 *     neighbourhood): a radial hub-and-spoke, matched to how Neo4j Browser
 *     itself renders one node's expanded relationships — the centre node
 *     in the middle, direct connections in a ring around it, two hops out
 *     in a wider ring. See radialLayout().
 * Neither is a physics simulation; both are deterministic placements from
 * real graph structure (parentId, or a BFS over the actual edges).
 */

import React, { useCallback, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ChevronDown, ChevronRight, Star } from 'lucide-react';
import { NODE_KIND_LABEL, type GraphEdgeInput, type GraphNodeInput } from './graph-model';
import { KIND_CIRCLE, EDGE_COLOR, CANVAS_DARK } from './design-system';

type NodeData = { node: GraphNodeInput; expandable: boolean; expanded: boolean };

const ROW_HEIGHT = 130;
const COLUMN_WIDTH = 150;
const EMPTY_SET: ReadonlySet<string> = new Set();

/**
 * Tree layout for a containment graph (nodes carry parentId): a child is
 * positioned under its real parent — computed bottom-up, a leaf claims the
 * next horizontal slot and an internal node centres itself over its
 * children's span — rather than an arbitrary row index. This is what makes
 * Unit→Chapter→Topic→Concept edges read as a tree instead of a tangle of
 * long diagonals between unrelated positions.
 */
function nodeData(n: GraphNodeInput, expandedIds: ReadonlySet<string>): NodeData {
  return { node: n, expandable: n.kind !== 'concept', expanded: expandedIds.has(n.id) };
}

function treeLayout(nodes: GraphNodeInput[], expandedIds: ReadonlySet<string>): Node[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string, GraphNodeInput[]>();
  const roots: GraphNodeInput[] = [];

  for (const n of nodes) {
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    if (parent) {
      const list = childrenOf.get(parent.id) ?? [];
      list.push(n);
      childrenOf.set(parent.id, list);
    } else {
      roots.push(n);
    }
  }

  const xOf = new Map<string, number>();
  let nextLeafSlot = 0;

  function assign(node: GraphNodeInput): number {
    const kids = (childrenOf.get(node.id) ?? []).sort((a, b) => a.label.localeCompare(b.label));
    let x: number;
    if (kids.length === 0) {
      x = nextLeafSlot * COLUMN_WIDTH;
      nextLeafSlot += 1;
    } else {
      const childXs = kids.map(assign);
      x = (Math.min(...childXs) + Math.max(...childXs)) / 2;
    }
    xOf.set(node.id, x);
    return x;
  }

  roots
    .sort((a, b) => a.label.localeCompare(b.label))
    .forEach(assign);

  const totalWidth = nextLeafSlot * COLUMN_WIDTH;

  return nodes.map((n) => ({
    id: n.id,
    type: 'kgNode',
    position: { x: (xOf.get(n.id) ?? 0) - totalWidth / 2, y: n.depth * ROW_HEIGHT },
    data: nodeData(n, expandedIds),
  }));
}

const RING_GAP = 170;

/**
 * Radial "hub and spoke" layout for a non-containment graph (a concept's
 * prerequisite/related neighbourhood) — matched directly to how Neo4j
 * Browser itself renders a node's expanded relationships: the centre node
 * at the middle, everything connected to it arranged in a ring, two hops
 * out in a wider ring, and so on.
 *
 * The centre is the node the screen was opened for (`current: true`); ring
 * membership comes from a real BFS over the edges actually returned, not
 * from the backend's own `depth` field (that measures the longest
 * prerequisite chain within the whole chapter, which is a different axis
 * from "how many hops is this from the concept I'm looking at"). A node
 * the BFS never reaches (no path to the centre through the returned edges)
 * still gets drawn, in one further-out ring, rather than silently dropped.
 */
function radialLayout(nodes: GraphNodeInput[], edges: GraphEdgeInput[]): Node[] {
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
  const byRing = new Map<number, GraphNodeInput[]>();
  for (const n of nodes) {
    const ring = ringOf.get(n.id) ?? maxKnownRing + 1;
    const list = byRing.get(ring) ?? [];
    list.push(n);
    byRing.set(ring, list);
  }

  const result: Node[] = [];
  for (const [ring, ringNodes] of byRing) {
    if (ring === 0) {
      result.push({ id: ringNodes[0].id, type: 'kgNode', position: { x: 0, y: 0 }, data: nodeData(ringNodes[0], EMPTY_SET) });
      continue;
    }
    const radius = ring * RING_GAP;
    ringNodes.forEach((n, i) => {
      // Starts at the top (-90°) so the first neighbour lands straight above the centre, matching Neo4j Browser's own orientation.
      const angle = (2 * Math.PI * i) / ringNodes.length - Math.PI / 2;
      result.push({
        id: n.id,
        type: 'kgNode',
        position: { x: radius * Math.cos(angle), y: radius * Math.sin(angle) },
        data: nodeData(n, EMPTY_SET),
      });
    });
  }
  return result;
}

function layout(nodes: GraphNodeInput[], edges: GraphEdgeInput[], expandedIds: ReadonlySet<string>): Node[] {
  const isContainment = nodes.some((n) => n.parentId != null);
  return isContainment ? treeLayout(nodes, expandedIds) : radialLayout(nodes, edges);
}

function toFlowEdges(edges: GraphEdgeInput[]): Edge[] {
  return edges.map((e) => {
    const dashed = !e.approved;
    const stroke = e.aiSuggested ? EDGE_COLOR.aiSuggested : e.kind === 'cross_curricular' ? EDGE_COLOR.crossCurricular : e.kind === 'hierarchy' ? EDGE_COLOR.hierarchy : EDGE_COLOR.prerequisite;
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      // 'straight' rather than 'smoothstep': with nodes arranged in a ring
      // around a centre (radialLayout) or a tree (treeLayout), a direct
      // line between actual node centres reads correctly either way — a
      // stepped/orthogonal path does not, for a radial arrangement. This
      // also matches the reference Neo4j Browser recording: plain straight
      // spokes from the centre node outward.
      type: 'straight',
      style: { stroke, strokeWidth: 2, strokeDasharray: dashed ? '6 4' : undefined },
      markerEnd: e.kind === 'hierarchy' ? undefined : { type: MarkerType.ArrowClosed, color: stroke, width: 14, height: 14 },
    };
  });
}

/**
 * A flat-coloured circle, one colour per node kind — matched deliberately
 * to how Neo4j Browser itself renders labelled nodes, rather than a card.
 * The label sits inside, truncated to two lines (Neo4j Browser's own
 * caption truncates the same way); the full name is always available via
 * title-on-hover and the inspector drawer after a click.
 */
/**
 * Both handles sit dead-centre on the node, invisible — not at the usual
 * Top/Bottom edge of the box. @xyflow/react requires a custom node type to
 * render at least one source and one target Handle before it will draw any
 * edge to/from it at all (missing entirely before this fix, which is why
 * no edges were rendering); centring them, together with the 'straight'
 * edge type above, is what makes a line look like a true radial spoke
 * between two node centres instead of bending toward a fixed side that
 * made sense only for a strict top-down tree.
 */
const CENTER_HANDLE_STYLE: React.CSSProperties = {
  opacity: 0,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
};

function KgNode({ data }: NodeProps) {
  const { node, expandable, expanded } = data as unknown as NodeData;
  const circle = KIND_CIRCLE[node.kind];

  return (
    <div className="group flex flex-col items-center" style={{ width: COLUMN_WIDTH }}>
      <div
        className={`relative flex h-16 w-16 items-center justify-center rounded-full ${circle.bg} shadow-lg ring-2 ring-black/20 transition-transform group-hover:scale-110 ${
          node.current ? `ring-4 ring-offset-2 ring-offset-[#0a0e1a] ${circle.ring} shadow-[0_0_18px_4px_rgba(34,211,238,0.45)]` : ''
        }`}
        title={node.label}
      >
        <Handle type="target" position={Position.Top} style={CENTER_HANDLE_STYLE} />
        <Handle type="source" position={Position.Top} style={CENTER_HANDLE_STYLE} />
        <span className="line-clamp-2 px-1.5 text-center text-[9px] font-semibold leading-tight text-white">
          {node.label}
        </span>
        {node.current ? (
          <Star className="absolute -top-1.5 -right-1.5 h-4 w-4 fill-cyan-300 text-cyan-200 drop-shadow" aria-label="Current node" />
        ) : null}
        {expandable ? (
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 ring-1 ring-white/20">
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-white/90" aria-label="Expanded — click to collapse" />
            ) : (
              <ChevronRight className="h-3 w-3 text-white/70" aria-label="Click to expand" />
            )}
          </span>
        ) : null}
      </div>
      <span className="mt-1.5 max-w-[120px] truncate text-[10px] font-medium text-slate-300" title={node.label}>
        {NODE_KIND_LABEL[node.kind]}
      </span>
    </div>
  );
}

const nodeTypes = { kgNode: KgNode };

export default function ConceptRelationshipGraph({
  nodes,
  edges,
  onNodeClick,
  expandedIds,
  heightClassName = 'h-[560px]',
}: {
  nodes: GraphNodeInput[];
  edges: GraphEdgeInput[];
  onNodeClick?: (nodeId: string) => void;
  /** Chapter ids currently expanded — drives the chevron shown on chapter cards. Omit when the canvas has no expand/collapse concept (e.g. a concept-relationship view). */
  expandedIds?: ReadonlySet<string>;
  heightClassName?: string;
}) {
  const resolvedExpandedIds = expandedIds ?? EMPTY_SET;
  const flowNodes = useMemo(() => layout(nodes, edges, resolvedExpandedIds), [nodes, edges, resolvedExpandedIds]);
  const flowEdges = useMemo(() => toFlowEdges(edges), [edges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => onNodeClick?.(node.id),
    [onNodeClick]
  );

  return (
    <div className={`${heightClassName} w-full overflow-hidden rounded-xl shadow-inner`} style={{ backgroundColor: CANVAS_DARK.bg }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.2}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} color={CANVAS_DARK.dot} gap={24} size={1} />
          <Controls
            showInteractive={false}
            className="!border !border-white/10 !text-slate-300 [&>button]:!border-white/10 [&>button]:!bg-slate-900 [&>button:hover]:!bg-slate-800 [&>button]:!fill-slate-300"
            style={{ backgroundColor: CANVAS_DARK.controlsBg }}
          />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
