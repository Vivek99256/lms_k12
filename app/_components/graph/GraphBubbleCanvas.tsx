'use client';

/**
 * The Knowledge Graph canvas, redesigned to match
 * `app/organization-management/knowledge-graph/_components/org-knowledge-graph.tsx`
 * — the actual "Organization Management Knowledge Graph" UI the user pointed
 * at (glowing physics-driven orbs, not `GraphCanvas.tsx`'s React-Flow
 * `'browser'` variant, which this component replaces for the centralized
 * explorer). Same hand-rolled SVG + force simulation, generalized over the
 * shared `KgNodeInput`/`KgEdgeInput` contract instead of that component's
 * fixed Institute/Role/Department/Staff/Fact node-type tables — colour comes
 * from `categoryColor()` (the same lookup the previous React-Flow canvas
 * already used for its legend), and node "kind" (for sizing/charge) is
 * derived from whether a node is the current/root node, a known or
 * not-yet-probed hub (something with real relationships to expand), or a
 * confirmed leaf — not from a per-entity-type table, since this surface
 * spans ~100+ real Neo4j labels across many modules.
 *
 * Interaction, ported as-is from the reference: drag a node to pin it;
 * double-click a pinned node releases it. A single click selects the node
 * (showing its detail in the caller's docked panel) and — the caller decides
 * what "expand" means and drives it via `nodeMeta`/`loadingNodeId`, this
 * component only reports the click. Background drag pans, wheel zooms, and
 * the view glides to fit after the node count changes.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  Moon,
  RefreshCw,
  Scan,
  Search,
  Shuffle,
  Sun,
  X,
} from 'lucide-react';

import { categoriesPresent, categoryColor, type CategoryColor } from './graph-category-color';
import { initials, shade, tick, type SimLink, type SimNode } from './force-simulation';
import type { KgEdgeInput, KgNodeInput } from './graph-model';

type Mode = 'dark' | 'light';
type Kind = 'center' | 'hub' | 'leaf';

const SIZE: Record<Kind, number> = { center: 108, hub: 62, leaf: 40 };
const CHARGE: Record<Kind, number> = { center: 1500, hub: 700, leaf: 220 };

const SURFACE: Record<Mode, { canvas: string; bg: string; panel: string; panelBorder: string; text: string; sub: string; grid: string; edge: number }> = {
  dark: {
    canvas: 'radial-gradient(ellipse at 50% 45%, #14245a 0%, #0a1230 45%, #050914 100%)',
    bg: '#0a1230',
    panel: 'rgba(10,18,48,0.78)',
    panelBorder: 'rgba(255,255,255,0.16)',
    text: '#f1f5f9',
    sub: '#94a3b8',
    grid: 'rgba(148,163,184,0.16)',
    edge: 0.6,
  },
  light: {
    canvas: 'radial-gradient(ellipse at 50% 45%, #ffffff 0%, #eef4ff 55%, #dfe9fb 100%)',
    bg: '#eef4ff',
    panel: 'rgba(255,255,255,0.86)',
    panelBorder: 'rgba(15,23,42,0.10)',
    text: '#0f172a',
    sub: '#64748b',
    grid: 'rgba(100,116,139,0.22)',
    edge: 0.75,
  },
};

const gradientId = (hex: string) => `kgb-${hex.slice(1)}`;

interface View {
  x: number;
  y: number;
  k: number;
}

export interface GraphBubbleCanvasProps {
  nodes: KgNodeInput[];
  edges: KgEdgeInput[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  /**
   * What the caller already knows about each node's own relationships, from
   * its own `nodeDetail` fetches — absent entries mean "not yet probed"
   * (shown as a plain, unlabeled expand affordance rather than a guessed
   * count, so this component never fires its own count-only queries).
   */
  nodeMeta?: Map<string, { totalCount: number; open: boolean }>;
  /** The node currently being fetched — shows a small spinner badge in its place. */
  loadingNodeId?: string | null;
  /** Fired on a real, unmoved click (not a drag-release) — selection AND any expand/collapse decision is the caller's. */
  onNodeClick?: (node: KgNodeInput) => void;
  onEdgeClick?: (edge: KgEdgeInput | null) => void;
  onBackgroundClick?: () => void;
  /** Re-open every node whose children are already known but currently collapsed — never probes unknown nodes (would fan out into many parallel fetches). */
  onExpandAll?: () => void;
  /** Collapse every currently-expanded node's children, keeping the current root sample. */
  onCollapseAll?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  heightClassName?: string;
}

export default function GraphBubbleCanvas({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  nodeMeta,
  loadingNodeId,
  onNodeClick,
  onEdgeClick,
  onBackgroundClick,
  onExpandAll,
  onCollapseAll,
  isFullscreen,
  onToggleFullscreen,
  heightClassName = 'h-full',
}: GraphBubbleCanvasProps) {
  const [mode, setMode] = useState<Mode>('dark');
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [showCategories, setShowCategories] = useState(false);
  const [term, setTerm] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 0.8 });
  const [gliding, setGliding] = useState(false);
  const [pinned, setPinned] = useState<Set<string>>(new Set());

  const stage = useRef<HTMLDivElement | null>(null);
  const sim = useRef<Map<string, SimNode>>(new Map());
  const links = useRef<SimLink[]>([]);
  const alpha = useRef(0);
  const dragging = useRef(false);
  const raf = useRef<number | null>(null);
  const viewRef = useRef<View>(view);
  const glideTimer = useRef<number | null>(null);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const s = SURFACE[mode];
  const dark = mode === 'dark';

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const categories = useMemo(() => categoriesPresent(nodes.map((n) => n.entityKey)), [nodes]);

  const visibleNodes = useMemo(
    () => nodes.filter((n) => !hiddenCategories.includes(categoryColor(n.entityKey).key)),
    [nodes, hiddenCategories]
  );
  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)),
    [edges, visibleIds]
  );

  const kindOf = useCallback(
    (node: KgNodeInput): Kind => {
      if (node.current) return 'center';
      const meta = nodeMeta?.get(node.id);
      if (!meta) return 'hub'; // unprobed — optimistic: treat like it might expand
      return meta.totalCount > 0 ? 'hub' : 'leaf';
    },
    [nodeMeta]
  );

  const config = useMemo(
    () => ({
      size: (kind: string) => SIZE[kind as Kind] ?? SIZE.leaf,
      charge: (kind: string) => CHARGE[kind as Kind] ?? CHARGE.leaf,
    }),
    []
  );

  /* Keep the simulation in step with what's visible: new nodes appear next to the node they came
     from, gone nodes leave, links are rebuilt, and energy is pumped up so it rearranges. */
  useEffect(() => {
    const map = sim.current;
    const keep = new Set(visibleNodes.map((n) => n.id));
    for (const id of [...map.keys()]) if (!keep.has(id)) map.delete(id);

    const parentPos = (node: KgNodeInput): { x: number; y: number } => {
      const edge = visibleEdges.find((e) => e.target === node.id || e.source === node.id);
      if (!edge) return { x: 0, y: 0 };
      const otherId = edge.target === node.id ? edge.source : edge.target;
      const parent = map.get(otherId);
      return parent ? { x: parent.x, y: parent.y } : { x: 0, y: 0 };
    };

    for (const node of visibleNodes) {
      if (map.has(node.id)) continue;
      let { x, y } = node.current ? { x: 0, y: 0 } : parentPos(node);
      const angle = Math.random() * Math.PI * 2;
      x += Math.cos(angle) * 90;
      y += Math.sin(angle) * 90;
      map.set(node.id, { id: node.id, kind: kindOf(node), x, y, vx: 0, vy: 0, fx: node.current ? 0 : null, fy: node.current ? 0 : null });
    }
    // Keep each node's kind current (a hub can turn into "open" visually, or a probe can resolve it).
    for (const node of visibleNodes) {
      const existing = map.get(node.id);
      if (existing) existing.kind = kindOf(node);
    }

    const degree = new Map<string, number>();
    visibleEdges.forEach((e) => {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    });
    links.current = visibleEdges.map((e) => {
      const sourceKind = map.get(e.source)?.kind ?? 'leaf';
      const length = sourceKind === 'center' ? 230 : sourceKind === 'hub' ? 130 : 95;
      const weight = Math.min(0.3, 1 / Math.min(degree.get(e.source) ?? 1, degree.get(e.target) ?? 1));
      return { a: e.source, b: e.target, length, strength: weight };
    });

    for (const node of map.values()) {
      if (pinned.has(node.id) && node.fx === null) {
        node.fx = node.x;
        node.fy = node.y;
      }
    }
    alpha.current = Math.max(alpha.current, 0.9);
    setPositions(new Map([...map].map(([id, node]) => [id, { x: node.x, y: node.y }])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNodes, visibleEdges, pinned]);

  // The animation loop runs only while there is energy to burn.
  useEffect(() => {
    const step = () => {
      if (dragging.current) alpha.current = Math.max(alpha.current, 0.3);
      if (alpha.current > 0.012) {
        tick(sim.current, links.current, alpha.current, config);
        alpha.current *= 0.986;
        setPositions(new Map([...sim.current].map(([id, node]) => [id, { x: node.x, y: node.y }])));
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [config]);

  const fit = useCallback((padding = 90) => {
    const box = stage.current?.getBoundingClientRect();
    const simNodes = [...sim.current.values()];
    if (!box || simNodes.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of simNodes) {
      const r = config.size(n.kind) / 2 + 24;
      minX = Math.min(minX, n.x - r);
      maxX = Math.max(maxX, n.x + r);
      minY = Math.min(minY, n.y - r);
      maxY = Math.max(maxY, n.y + r);
    }
    const k = Math.max(0.15, Math.min(1.3, Math.min((box.width - padding) / (maxX - minX), (box.height - padding) / (maxY - minY))));
    setGliding(true);
    setView({ k, x: box.width / 2 - ((minX + maxX) / 2) * k, y: box.height / 2 - ((minY + maxY) / 2) * k });
    if (glideTimer.current !== null) window.clearTimeout(glideTimer.current);
    glideTimer.current = window.setTimeout(() => setGliding(false), 750);
  }, [config]);

  useEffect(() => {
    const timer = window.setTimeout(() => fit(), 900);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNodes.length]);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      const mx = event.clientX - box.left;
      const my = event.clientY - box.top;
      setGliding(false);
      setView((current) => {
        const k = Math.max(0.12, Math.min(2.6, current.k * Math.exp(-event.deltaY * 0.0015)));
        return { k, x: mx - ((mx - current.x) * k) / current.k, y: my - ((my - current.y) * k) / current.k };
      });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  const needle = term.trim().toLowerCase();
  const focus = selectedNodeId ?? hovered;
  const neighbours = useMemo(() => {
    const set = new Set<string>();
    if (!focus) return set;
    set.add(focus);
    visibleEdges.forEach((e) => {
      if (e.source === focus) set.add(e.target);
      if (e.target === focus) set.add(e.source);
    });
    return set;
  }, [focus, visibleEdges]);

  const worldPoint = (clientX: number, clientY: number) => {
    const box = stage.current?.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - (box?.left ?? 0) - v.x) / v.k, y: (clientY - (box?.top ?? 0) - v.y) / v.k };
  };

  const release = (id: string) => {
    const node = sim.current.get(id);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
    setPinned((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    alpha.current = Math.max(alpha.current, 0.7);
  };

  const onNodePointerDown = (event: ReactPointerEvent, node: KgNodeInput) => {
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = sim.current.get(node.id);
    const grab = start ? { dx: start.x - worldPoint(startX, startY).x, dy: start.y - worldPoint(startX, startY).y } : { dx: 0, dy: 0 };
    let moved = false;
    setGliding(false);

    const move = (e: PointerEvent) => {
      if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return;
      moved = true;
      dragging.current = true;
      const target = sim.current.get(node.id);
      if (!target) return;
      const point = worldPoint(e.clientX, e.clientY);
      target.fx = point.x + grab.dx;
      target.fy = point.y + grab.dy;
      target.x = target.fx;
      target.y = target.fy;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dragging.current = false;
      if (moved) {
        // A dropped node stays where it was put until it is double-clicked.
        setPinned((current) => (current.has(node.id) ? current : new Set(current).add(node.id)));
        return;
      }
      onNodeClick?.(node);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onBackgroundPointerDown = (event: ReactPointerEvent) => {
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = viewRef.current;
    let moved = false;
    setGliding(false);
    const move = (e: PointerEvent) => {
      if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return;
      moved = true;
      setView({ ...origin, x: origin.x + e.clientX - startX, y: origin.y + e.clientY - startY });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!moved) onBackgroundClick?.();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const reshuffle = () => {
    for (const node of sim.current.values()) {
      if (node.kind === 'center') continue;
      node.fx = null;
      node.fy = null;
      node.x += (Math.random() - 0.5) * 140;
      node.y += (Math.random() - 0.5) * 140;
    }
    setPinned(new Set());
    alpha.current = 1;
    window.setTimeout(() => fit(), 1300);
  };

  const toggleCategory = (key: string) =>
    setHiddenCategories((current) => (current.includes(key) ? current.filter((value) => value !== key) : [...current, key]));

  const matches = (n: KgNodeInput) => needle !== '' && n.label.toLowerCase().includes(needle);
  const palette = useMemo(
    () => [...new Set(categories.map((c) => c.color.dot))],
    [categories]
  );
  const showNames = view.k > 0.75;
  return (
    <div className={`relative ${heightClassName} w-full touch-none select-none overflow-hidden rounded-xl border shadow-lg`} style={{ background: s.canvas, borderColor: s.panelBorder }} ref={stage}>
      <style>{`@keyframes kgb-flow { to { stroke-dashoffset: calc(var(--period) * -1); } } @keyframes kgb-pulse { 0%,100% { opacity .22; transform: scale(1); } 50% { opacity: .08; transform: scale(1.12); } }`}</style>

      <svg className="absolute inset-0 h-full w-full" onPointerDown={onBackgroundPointerDown} style={{ cursor: 'grab' }}>
        <defs>
          {palette.map((hex) => (
            <radialGradient key={hex} id={gradientId(hex)} cx="32%" cy="26%" r="80%">
              <stop offset="0%" stopColor={shade(hex, 0.55)} />
              <stop offset="45%" stopColor={hex} />
              <stop offset="100%" stopColor={shade(hex, -0.38)} />
            </radialGradient>
          ))}
          <filter id="kgb-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>

        <pattern id="kgb-grid" width={32 * view.k} height={32 * view.k} patternUnits="userSpaceOnUse" x={view.x} y={view.y}>
          <circle cx={1.2} cy={1.2} r={1.2} fill={s.grid} />
        </pattern>
        <rect width="100%" height="100%" fill="url(#kgb-grid)" />

        <g style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: '0 0', transition: gliding ? 'transform .7s cubic-bezier(.22,.8,.3,1)' : 'none' }}>
          {visibleEdges.map((e) => {
            const a = positions.get(e.source);
            const b = positions.get(e.target);
            const target = byId.get(e.target);
            const source = byId.get(e.source);
            if (!a || !b || !target || !source) return null;
            const color = categoryColor(target.entityKey).dot;
            const lit = focus === null || (neighbours.has(e.source) && neighbours.has(e.target));
            const core = source.current === true;
            const isSelectedEdge = e.id === selectedEdgeId;
            const hot = (focus !== null && lit) || isSelectedEdge;
            const width = (core ? 3.4 : 2.6) + (hot ? 1.2 : 0);
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const bend = Math.min(36, Math.hypot(b.x - a.x, b.y - a.y) * 0.12);
            const nx = -(b.y - a.y);
            const ny = b.x - a.x;
            const nl = Math.hypot(nx, ny) || 1;
            const d = `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${(mx + (nx / nl) * bend).toFixed(1)},${(my + (ny / nl) * bend).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
            return (
              <path
                key={e.id}
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={width}
                strokeLinecap="round"
                strokeDasharray={e.sourceKind === 'sql' ? `${(width * 0.6).toFixed(1)} ${(width * 1.6).toFixed(1)}` : `${(width * 1.3).toFixed(1)} ${(width * 2.4).toFixed(1)}`}
                opacity={Math.max(s.edge, core || hot ? 0.95 : 0.8)}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onEdgeClick?.(e);
                }}
                style={{
                  cursor: 'pointer',
                  ...({ '--period': `${(width * 3.7).toFixed(1)}px` } as React.CSSProperties),
                  animation: `kgb-flow ${hot ? 0.6 : core ? 0.9 : 1.2}s linear infinite`,
                  filter: hot || core ? `drop-shadow(0 0 4px ${color})` : undefined,
                }}
              />
            );
          })}

          {visibleNodes.map((n) => {
            const at = positions.get(n.id);
            if (!at) return null;
            const kind = kindOf(n);
            const r = SIZE[kind] / 2;
            const color = categoryColor(n.entityKey).dot;
            const dim = needle !== '' && !matches(n) && kind === 'leaf';
            const lit = focus === n.id || matches(n) || n.id === selectedNodeId;
            const meta = nodeMeta?.get(n.id);
            const open = meta?.open ?? false;
            const loading = loadingNodeId === n.id;
            const showBadge = kind !== 'leaf';
            const labelText = n.label.length > 24 ? `${n.label.slice(0, 23)}…` : n.label;
            const showLabel = kind !== 'center' ? showNames || lit || kind === 'hub' : false;

            return (
              <g
                key={n.id}
                transform={`translate(${at.x.toFixed(1)},${at.y.toFixed(1)})`}
                opacity={dim ? 0.3 : 1}
                style={{ cursor: 'grab' }}
                onPointerDown={(event) => onNodePointerDown(event, n)}
                onDoubleClick={() => release(n.id)}
                onPointerEnter={() => setHovered(n.id)}
                onPointerLeave={() => setHovered(null)}
              >
                {kind === 'center' || kind === 'hub' ? (
                  <circle
                    r={r + 12}
                    fill={color}
                    opacity={lit ? 0.55 : 0.3}
                    filter="url(#kgb-glow)"
                    style={kind === 'center' ? { animation: 'kgb-pulse 3.4s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' } : undefined}
                  />
                ) : (
                  <circle r={r + (lit ? 9 : 5)} fill={color} opacity={lit ? 0.5 : 0.2} />
                )}
                <circle r={r} fill={`url(#${gradientId(color)})`} stroke={n.id === selectedNodeId ? '#ffffff' : lit ? '#ffffff' : 'rgba(255,255,255,0.55)'} strokeWidth={n.id === selectedNodeId ? 2.8 : lit ? 2.6 : 1.6} />
                <ellipse cx={-r * 0.28} cy={-r * 0.42} rx={r * 0.5} ry={r * 0.26} fill="#fff" opacity={0.22} />

                {kind === 'center' ? (
                  <>
                    <text y={-4} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={700} style={{ pointerEvents: 'none' }}>
                      {n.label.length > 16 ? `${n.label.slice(0, 15)}…` : n.label}
                    </text>
                    <text y={14} textAnchor="middle" fill="#dbeafe" fontSize={10} style={{ pointerEvents: 'none' }}>
                      {n.entityKey}
                    </text>
                  </>
                ) : (
                  <text y={4} textAnchor="middle" fill="#fff" fontSize={kind === 'hub' ? 11 : 10} fontWeight={700} style={{ pointerEvents: 'none' }}>
                    {initials(n.label)}
                  </text>
                )}

                {loading ? (
                  <g transform={`translate(${r * 0.74},${-r * 0.74})`} style={{ pointerEvents: 'none' }}>
                    <circle r={12} fill={s.bg} stroke={color} strokeWidth={2} />
                    <foreignObject x={-7} y={-7} width={14} height={14}>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: s.text }} />
                    </foreignObject>
                  </g>
                ) : showBadge ? (
                  <g transform={`translate(${r * 0.74},${-r * 0.74})`} style={{ pointerEvents: 'none' }}>
                    <circle r={12} fill={open ? s.bg : '#ffffff'} stroke={color} strokeWidth={2} />
                    <text y={4} textAnchor="middle" fontSize={open ? 15 : meta ? 10 : 13} fontWeight={800} fill={open ? s.text : color}>
                      {open ? '−' : meta ? `+${meta.totalCount}` : '+'}
                    </text>
                  </g>
                ) : null}

                {pinned.has(n.id) ? <circle cx={-r * 0.74} cy={-r * 0.74} r={4.5} fill="#fff" stroke={color} strokeWidth={2} style={{ pointerEvents: 'none' }} /> : null}

                {showLabel ? (
                  <text
                    y={r + 16}
                    textAnchor="middle"
                    fontSize={kind === 'hub' ? 13 : 11}
                    fontWeight={kind === 'hub' ? 700 : 600}
                    fill={s.text}
                    stroke={s.bg}
                    strokeWidth={4}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none' }}
                  >
                    {labelText}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Toolbar */}
      <div className="absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4" style={{ color: s.sub }} />
          <input
            type="text"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Find on this canvas…"
            aria-label="Find a node on this canvas"
            className="h-9 w-56 rounded-xl border pl-9 pr-3 text-sm backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ background: s.panel, borderColor: s.panelBorder, color: s.text }}
          />
        </div>
        {onExpandAll && (
          <button type="button" onClick={onExpandAll} className={pill} style={{ background: s.panel, borderColor: s.panelBorder, color: s.text }}>
            <ChevronsUpDown className="h-4 w-4" /> Expand all
          </button>
        )}
        {onCollapseAll && (
          <button type="button" onClick={onCollapseAll} className={pill} style={{ background: s.panel, borderColor: s.panelBorder, color: s.text }}>
            <ChevronsDownUp className="h-4 w-4" /> Collapse
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={reshuffle} aria-label="Shake the layout and release pinned nodes" title="Shake the layout and release pinned nodes" className={iconButton} style={{ background: s.panel, borderColor: s.panelBorder, color: s.text }}>
            <Shuffle className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => fit()} aria-label="Fit everything on screen" title="Fit everything on screen" className={iconButton} style={{ background: s.panel, borderColor: s.panelBorder, color: s.text }}>
            <Scan className="h-4 w-4" />
          </button>
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
              title={isFullscreen ? 'Exit full screen' : 'Full screen'}
              className={iconButton}
              style={{ background: s.panel, borderColor: s.panelBorder, color: s.text }}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode(dark ? 'light' : 'dark')}
            aria-label={dark ? 'Switch to the light canvas' : 'Switch to the dark canvas'}
            className={iconButton}
            style={{ background: s.panel, borderColor: s.panelBorder, color: s.text }}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Legend / Category Drawer (single toggle button at bottom-left: click opens, click closes) */}
      {categories.length > 0 && (
        <div className="absolute bottom-3 left-3 z-10 flex flex-col items-start gap-2">
          {showCategories && (
            <div
              className="w-64 rounded-2xl border p-3 shadow-2xl backdrop-blur-md transition-all duration-200"
              style={{ background: s.panel, borderColor: s.panelBorder }}
            >
              <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: s.sub }}>
                <span>Categories · tap to filter</span>
                <button
                  type="button"
                  onClick={() => setShowCategories(false)}
                  aria-label="Close categories"
                  className="rounded p-1 transition-colors hover:bg-white/10"
                  style={{ color: s.sub }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <ul className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
                {categories.map(({ key, color }: { key: string; color: CategoryColor }) => {
                  const off = hiddenCategories.includes(key);
                  const count = nodes.filter((n) => categoryColor(n.entityKey).key === key).length;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        aria-pressed={!off}
                        onClick={() => toggleCategory(key)}
                        className="w-full cursor-pointer text-left transition-opacity hover:opacity-80"
                        style={{ opacity: off ? 0.35 : 1 }}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 font-medium truncate" style={{ color: s.text }}>
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color.dot, boxShadow: `0 0 8px ${color.dot}` }} />
                            <span className="truncate">{color.label}</span>
                          </span>
                          <span className="shrink-0 text-[11px]" style={{ color: s.sub }}>{count}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {hiddenCategories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHiddenCategories([])}
                  className="mt-2.5 block text-[11px] font-medium text-blue-400 hover:underline"
                >
                  Reset category filters
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowCategories((v) => !v)}
            className="flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-medium shadow-md backdrop-blur-md transition-all duration-150 hover:scale-105 active:scale-95"
            style={{
              background: showCategories ? (dark ? 'rgba(30, 58, 138, 0.75)' : 'rgba(219, 234, 254, 0.9)') : s.panel,
              borderColor: showCategories ? '#60a5fa' : s.panelBorder,
              color: showCategories ? '#93c5fd' : s.text,
            }}
            title={showCategories ? 'Close categories' : 'Open categories'}
          >
            <Layers className="h-3.5 w-3.5 text-blue-400" />
            <span>Categories</span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ background: dark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.08)', color: s.sub }}
            >
              {categories.length}
            </span>
            {showCategories ? (
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5 opacity-70" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
