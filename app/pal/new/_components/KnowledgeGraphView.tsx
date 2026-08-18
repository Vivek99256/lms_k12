'use client';

import { useMemo, useState } from 'react';
import { GitBranch, RotateCcw, TriangleAlert, ZoomIn, ZoomOut } from 'lucide-react';

import type { LiveGraph, LiveGraphNode } from '@/app/pal/new/data/administration';

/**
 * New PAL → Administration — the prerequisite DAG, drawn.
 *
 * A prerequisite chain is a shape: what an administrator needs to see is which
 * concepts gate which, and how deep the chain runs. A row list cannot show
 * that, so this renders the graph the server projected out of the extracted
 * chapter intelligence.
 *
 * Layout is LAYERED, left to right. The server assigns each node a layer by
 * longest path from a root (Kahn's algorithm), so every edge points strictly
 * rightwards and the picture reads as a flow: layer 0 holds concepts with no
 * prerequisite, and each subsequent column can only be reached once the
 * previous one is mastered. Vertical position is just even spacing within the
 * column — it carries no meaning, so nothing is implied by it.
 *
 * Hand-authored SVG, no graph library: the layout is already computed and the
 * drawing is a few hundred elements, so a dependency would buy nothing.
 */

const NODE_W = 168;
const NODE_H = 46;
const COL_GAP = 104;
const ROW_GAP = 20;
const PAD = 28;

export default function KnowledgeGraphView({ graph }: { graph: LiveGraph }) {
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState<string | null>(null);

  const layout = useMemo(() => {
    // Group by layer, preserving the server's ordering within each.
    const columns = new Map<number, LiveGraphNode[]>();
    graph.nodes.forEach((node) => {
      const bucket = columns.get(node.layer);
      if (bucket) bucket.push(node);
      else columns.set(node.layer, [node]);
    });

    const layers = [...columns.keys()].sort((a, b) => a - b);
    const tallest = Math.max(1, ...layers.map((l) => columns.get(l)?.length ?? 0));

    const height = PAD * 2 + tallest * NODE_H + (tallest - 1) * ROW_GAP;
    const width = PAD * 2 + layers.length * NODE_W + Math.max(0, layers.length - 1) * COL_GAP;

    const positions = new Map<string, { x: number; y: number; node: LiveGraphNode }>();
    layers.forEach((layer, columnIndex) => {
      const nodes = columns.get(layer) ?? [];
      // Centre each column vertically so short columns don't hug the top.
      const columnHeight = nodes.length * NODE_H + (nodes.length - 1) * ROW_GAP;
      const top = (height - columnHeight) / 2;
      nodes.forEach((node, rowIndex) => {
        positions.set(node.id, {
          x: PAD + columnIndex * (NODE_W + COL_GAP),
          y: top + rowIndex * (NODE_H + ROW_GAP),
          node,
        });
      });
    });

    return { positions, width, height, layerCount: layers.length };
  }, [graph.nodes]);

  // Edges touching the hovered node, so a dense area can be read.
  const highlighted = useMemo(() => {
    if (!hovered) return new Set<string>();
    const set = new Set<string>();
    graph.edges.forEach((edge) => {
      if (edge.from === hovered || edge.to === hovered) {
        set.add(edge.from);
        set.add(edge.to);
      }
    });
    return set;
  }, [hovered, graph.edges]);

  if (graph.nodes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
        No prerequisite edge resolves to two known concepts, so there is no graph to draw.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" />
          Entry point
          <span className="ml-3 inline-block h-2.5 w-2.5 rounded-full bg-slate-300" />
          Requires a prerequisite
          {graph.hasCycle ? (
            <>
              <span className="ml-3 inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
              In a cycle
            </>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.15) * 100) / 100))}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-violet-300 hover:text-violet-600"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="flex h-7 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[11px] font-medium text-slate-500 transition-colors hover:border-violet-300 hover:text-violet-600"
          >
            <RotateCcw className="h-3 w-3" />
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.15) * 100) / 100))}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-violet-300 hover:text-violet-600"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-100 bg-[linear-gradient(0deg,#fbfaff_1px,transparent_1px),linear-gradient(90deg,#fbfaff_1px,transparent_1px)] [background-size:24px_24px]">
        <svg
          role="img"
          aria-label={`Prerequisite graph: ${graph.nodes.length} concepts across ${layout.layerCount} layers, connected by ${graph.edges.length} prerequisite edges.`}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          style={{ width: layout.width * zoom, height: layout.height * zoom, maxWidth: 'none' }}
          className="block"
        >
          <defs>
            <marker id="pal-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#a5b4fc" />
            </marker>
            <marker id="pal-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#7c3aed" />
            </marker>
          </defs>

          {/* Edges first, so nodes sit above them. */}
          {graph.edges.map((edge) => {
            const from = layout.positions.get(edge.from);
            const to = layout.positions.get(edge.to);
            if (!from || !to) return null;

            const x1 = from.x + NODE_W;
            const y1 = from.y + NODE_H / 2;
            const x2 = to.x;
            const y2 = to.y + NODE_H / 2;
            const midX = (x1 + x2) / 2;
            const hot = hovered !== null && (edge.from === hovered || edge.to === hovered);

            return (
              <path
                key={`${edge.from}->${edge.to}`}
                d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={hot ? '#7c3aed' : '#c7d2fe'}
                strokeWidth={hot ? 2 : 1.25}
                opacity={hovered !== null && !hot ? 0.25 : 1}
                markerEnd={hot ? 'url(#pal-arrow-hot)' : 'url(#pal-arrow)'}
              />
            );
          })}

          {graph.nodes.map((node) => {
            const position = layout.positions.get(node.id);
            if (!position) return null;

            const isRoot = node.in === 0;
            const dimmed = hovered !== null && !highlighted.has(node.id);
            const fill = node.cyclic ? '#fff1f2' : isRoot ? '#f5f3ff' : '#ffffff';
            const stroke = node.cyclic ? '#fb7185' : isRoot ? '#8b5cf6' : '#cbd5e1';

            return (
              <g
                key={node.id}
                opacity={dimmed ? 0.3 : 1}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}
              >
                <title>
                  {`${node.label} — layer ${node.layer + 1}, ${node.in} prerequisite(s), unlocks ${node.out}`}
                </title>
                <rect
                  x={position.x}
                  y={position.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={hovered === node.id ? 2 : 1.25}
                />
                <text
                  x={position.x + 12}
                  y={position.y + 19}
                  fontSize="11.5"
                  fontWeight="600"
                  fill="#1e293b"
                >
                  {truncate(node.label, 22)}
                </text>
                <text x={position.x + 12} y={position.y + 34} fontSize="10" fill="#94a3b8">
                  {node.in} in · {node.out} out
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-violet-500" />
          {graph.nodes.length} concepts · {graph.edges.length} edges · {layout.layerCount} layer
          {layout.layerCount === 1 ? '' : 's'}
        </span>
        {graph.hasCycle ? (
          <span className="flex items-center gap-1.5 text-rose-600">
            <TriangleAlert className="h-3.5 w-3.5" />
            A prerequisite cycle exists — those concepts can never all be unlocked.
          </span>
        ) : null}
        <span>Hover a concept to trace what it requires and what it unlocks.</span>
      </div>
    </div>
  );
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
