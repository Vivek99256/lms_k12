'use client';

import { useMemo } from 'react';

import {
  chapterLabel,
  type CoherenceEdge,
  type CoherenceMap,
  type CoherenceNode,
  type ReadinessMap,
} from '@/app/pal/new/data/coherence-map';

/**
 * New PAL → Coherence Map — the concept graph, drawn.
 *
 * LAYOUT IS CHOSEN, NOT PRESET. The live data has ZERO cross-chapter
 * prerequisite edges — 84 REQUIRES spread over 8 chapters, 16 disconnected
 * components, 46 concepts with no link at all. A force-directed layout on that
 * produces sixteen blobs in positions that move on every render and mean
 * nothing. So chapters become COLUMNS in teaching order (chapter_master
 * .sort_order) and prerequisite depth becomes ROWS inside each column. That is
 * the only ordering the data supports, it is stable across renders, and it
 * reads the way a syllabus reads: left to right through the year, top to bottom
 * through the dependencies.
 *
 * Hand-authored SVG, no graph library — matching KnowledgeGraphView next door.
 * The layout is computed here and the drawing is a few hundred elements, so a
 * dependency would buy nothing.
 *
 * Edges point source → target, i.e. prerequisite → dependent. The API has
 * already flipped Neo4j's `(later)-[:REQUIRES]->(earlier)` for us.
 */

const NODE_W = 176;
const NODE_H = 44;
const COL_GAP = 76;
const ROW_GAP = 18;
const PAD = 34;
const BAND_TOP = 30;

/** Eight distinct hues at one lightness, so no chapter reads as more important. */
const CHAPTER_HUES = [
  '#0B6B60', '#3D5A94', '#8A5C07', '#6D3F7A',
  '#1F6F8B', '#8A4230', '#4A6B23', '#7A4B6B',
];
const NO_CHAPTER_HUE = '#55605C';

const STATE_FILL: Record<string, string> = {
  mastered: '#2E7D4F',
  ready: '#B0790C',
  blocked: '#98A29C',
};

interface Props {
  map: CoherenceMap;
  readiness: ReadinessMap | null;
  selectedId: number | null;
  query: string;
  showRequires: boolean;
  showCross: boolean;
  onSelect: (id: number | null) => void;
}

interface Placed {
  node: CoherenceNode;
  x: number;
  y: number;
}

export default function CoherenceMapView({
  map,
  readiness,
  selectedId,
  query,
  showRequires,
  showCross,
  onSelect,
}: Props) {
  const nodeById = useMemo(() => {
    const index = new Map<number, CoherenceNode>();
    map.nodes.forEach((n) => index.set(n.id, n));
    return index;
  }, [map.nodes]);

  const hueByChapter = useMemo(() => {
    const hues = new Map<number, string>();
    map.chapters.forEach((c, i) => hues.set(c.id, CHAPTER_HUES[i % CHAPTER_HUES.length]));
    return hues;
  }, [map.chapters]);

  /** Chapter columns; inside each, one row per concept ordered by depth. */
  const layout = useMemo(() => {
    // Columns follow chapter_master.sort_order, which the API already applied.
    // A trailing column catches concepts whose chapter_id is null — they are
    // real concepts and dropping them would hide a gap in the data.
    const columnIds: (number | null)[] = map.chapters.map((c) => c.id);
    if (map.nodes.some((n) => n.chapterId === null)) columnIds.push(null);

    const placed: Placed[] = [];
    const bands: { x: number; width: number; height: number; label: string; count: number; hue: string }[] = [];
    let tallest = 1;

    columnIds.forEach((chapterId, columnIndex) => {
      const group = map.nodes.filter((n) => n.chapterId === chapterId);
      if (group.length === 0) return;

      // Depth ascending, then id — a stable order, so nothing jumps between renders.
      const ordered = [...group].sort((a, b) => a.depth - b.depth || a.id - b.id);
      const x = PAD + columnIndex * (NODE_W + COL_GAP);

      ordered.forEach((node, rowIndex) => {
        placed.push({ node, x, y: BAND_TOP + PAD + rowIndex * (NODE_H + ROW_GAP) });
      });

      tallest = Math.max(tallest, ordered.length);

      const meta = map.chapters.find((c) => c.id === chapterId);
      bands.push({
        x: x - 14,
        width: NODE_W + 28,
        height: ordered.length * (NODE_H + ROW_GAP) + PAD,
        label: meta ? chapterLabel(meta) : 'No chapter id',
        count: ordered.length,
        hue: chapterId === null ? NO_CHAPTER_HUE : hueByChapter.get(chapterId) ?? NO_CHAPTER_HUE,
      });
    });

    const positions = new Map<number, Placed>();
    placed.forEach((p) => positions.set(p.node.id, p));

    return {
      placed,
      bands,
      positions,
      width: PAD * 2 + columnIds.length * (NODE_W + COL_GAP),
      height: BAND_TOP + PAD * 2 + tallest * (NODE_H + ROW_GAP),
    };
  }, [map.nodes, map.chapters, hueByChapter]);

  /** The selected concept plus everything above and below it. */
  const focus = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    if (trimmed) {
      const hits = new Set<number>();
      map.nodes.forEach((n) => {
        const haystack = `${n.name} ${n.code ?? ''} ${n.description ?? ''} ${n.chapter ?? ''}`.toLowerCase();
        if (haystack.includes(trimmed)) hits.add(n.id);
      });
      return hits;
    }

    if (selectedId === null) return null;

    const lineage = new Set<number>([selectedId]);

    // Both closures, guarded — the prerequisite graph is NOT acyclic on this
    // data (stats.acyclic is false), so an unguarded walk would not terminate.
    const walk = (start: number, pick: (n: CoherenceNode) => number[]) => {
      const stack = [start];
      let guard = 0;
      while (stack.length > 0 && guard < 5000) {
        guard += 1;
        const current = nodeById.get(stack.pop() as number);
        if (!current) continue;
        pick(current).forEach((next) => {
          if (!lineage.has(next)) {
            lineage.add(next);
            stack.push(next);
          }
        });
      }
    };

    walk(selectedId, (n) => n.prereqIds);
    walk(selectedId, (n) => n.unlocksIds);
    return lineage;
  }, [query, selectedId, map.nodes, nodeById]);

  const fillFor = (node: CoherenceNode) => {
    if (readiness) return STATE_FILL[readiness[node.id]?.state ?? 'blocked'];
    return node.chapterId === null ? NO_CHAPTER_HUE : hueByChapter.get(node.chapterId) ?? NO_CHAPTER_HUE;
  };

  const visibleEdges = map.edges.filter((e) => {
    if (e.kind === 'REQUIRES' && !showRequires) return false;
    if (e.kind === 'CROSS_LINKS' && !showCross) return false;
    return layout.positions.has(e.source) && layout.positions.has(e.target);
  });

  const edgePath = (edge: CoherenceEdge) => {
    const from = layout.positions.get(edge.source);
    const to = layout.positions.get(edge.target);
    if (!from || !to) return null;

    const x1 = from.x + NODE_W / 2;
    const y1 = from.y + NODE_H;
    const x2 = to.x + NODE_W / 2;
    const y2 = to.y;

    // Same column: bow out to the right so the line does not disappear behind
    // the stack of nodes between the two endpoints.
    if (Math.abs(from.x - to.x) < 4) {
      const bow = NODE_W / 2 + 34;
      return `M${x1} ${y1} C${x1 + bow} ${y1 + 8} ${x2 + bow} ${y2 - 8} ${x2} ${y2}`;
    }
    return `M${x1} ${y1} C${x1} ${y1 + 40} ${x2} ${y2 - 40} ${x2} ${y2}`;
  };

  if (map.nodes.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
        No concepts are projected for this class and subject.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-2xl border border-[#DFE6F2] bg-white">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width={layout.width}
        height={layout.height}
        role="img"
        aria-label={`Prerequisite graph: ${map.stats.concepts} concepts, ${map.stats.requires} prerequisite links across ${map.stats.chapters} chapters`}
        className="min-w-full"
      >
        <defs>
          <marker id="cm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 1 L10 5 L0 9 z" fill="#0B6B60" />
          </marker>
        </defs>

        {/* chapter bands */}
        {layout.bands.map((band) => (
          <g key={`${band.label}-${band.x}`}>
            <rect x={band.x} y={BAND_TOP} width={band.width} height={band.height} rx={8} fill="#0F172A" opacity={0.035} />
            <rect x={band.x} y={BAND_TOP} width={3} height={band.height} rx={1.5} fill={band.hue} opacity={0.8} />
            <text x={band.x + 8} y={BAND_TOP - 9} fontSize={10} fill="#64748B" style={{ letterSpacing: '0.06em' }}>
              {band.label.length > 30 ? `${band.label.slice(0, 29)}…` : band.label} ({band.count})
            </text>
          </g>
        ))}

        {/* edges under nodes, so a line never crosses a label */}
        {visibleEdges.map((edge, index) => {
          const path = edgePath(edge);
          if (!path) return null;

          const dimmed = focus !== null && !(focus.has(edge.source) && focus.has(edge.target));
          const isRequires = edge.kind === 'REQUIRES';

          return (
            <path
              key={`e${index}`}
              d={path}
              fill="none"
              stroke={isRequires ? '#0B6B60' : '#94A3B8'}
              strokeWidth={isRequires ? 1.7 : 1.3}
              strokeDasharray={isRequires ? undefined : '4 3'}
              markerEnd={isRequires ? 'url(#cm-arrow)' : undefined}
              opacity={dimmed ? 0.05 : isRequires ? 0.8 : 0.4}
            />
          );
        })}

        {/* nodes */}
        {layout.placed.map(({ node, x, y }) => {
          const dimmed = focus !== null && !focus.has(node.id);
          const selected = node.id === selectedId;

          return (
            <g
              key={node.id}
              transform={`translate(${x} ${y})`}
              opacity={dimmed ? 0.16 : 1}
              className="cursor-pointer"
              tabIndex={0}
              role="button"
              aria-label={`${node.name}${node.chapter ? `, ${node.chapter}` : ''}`}
              onClick={() => onSelect(selected ? null : node.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(selected ? null : node.id);
                }
              }}
            >
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill={fillFor(node)}
                stroke={selected ? '#0F172A' : node.onCycle ? '#AE3527' : 'none'}
                strokeWidth={selected ? 2.5 : node.onCycle ? 1.6 : 0}
                strokeDasharray={!selected && node.onCycle ? '4 3' : undefined}
              />
              <text x={10} y={node.code ? 18 : 26} fontSize={11} fontWeight={600} fill="#FFFFFF">
                {node.name.length > 25 ? `${node.name.slice(0, 24)}…` : node.name}
              </text>
              {node.code ? (
                <text x={10} y={32} fontSize={9} fill="#FFFFFF" opacity={0.75}>
                  {node.code}
                </text>
              ) : null}
              {node.contentCount > 0 || node.questionCount > 0 ? (
                <text x={NODE_W - 10} y={16} fontSize={9} fill="#FFFFFF" opacity={0.85} textAnchor="end">
                  {[node.contentCount > 0 ? '▣' : null, node.questionCount > 0 ? '?' : null].filter(Boolean).join(' ')}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
