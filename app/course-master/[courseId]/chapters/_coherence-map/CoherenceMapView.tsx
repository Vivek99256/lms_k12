'use client';

/**
 * The coherence map screen.
 *
 * Renders whatever the backend returns. There is no curriculum in this file: no
 * unit, chapter, topic or concept is named, no prerequisite is decided, and no
 * relationship is inferred. Adding a concept to the database puts it on the map;
 * approving an edge changes the map. Nothing here needs editing for either.
 *
 * WHAT THE SCREEN IS FOR
 * Four questions, taken straight from the brief: what must be learned before this,
 * what depends on it, where does it sit in the curriculum, and which of those
 * claims has a person actually confirmed. The first two are answered by selecting
 * a node — its prerequisite closure lights amber upstream and teal downstream, and
 * everything unrelated fades. The third is the left-to-right hierarchy. The fourth
 * is the dashed/solid distinction, which is never decorative: a dashed edge is a
 * machine's guess that nobody has agreed with yet.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  AlertTriangle,
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
  Loader2,
  Network,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import {
  createRelation,
  deleteRelation,
  isReviewableEdge,
  reviewRelation,
  useCoherenceMap,
  type CoherenceEdge,
  type CoherenceMap,
  type CoherenceNode,
  type CoherenceNodeType,
} from '@/app/course-master/data/coherenceMap';
import { nodeTypes, type CoherenceNodeData } from './CoherenceNodes';
import { layoutMap, neighbourhood, type PositionedNode } from './graphLayout';

const ALL_LEVELS: CoherenceNodeType[] = ['unit', 'chapter', 'topic', 'concept'];

type Props = {
  subjectId: string;
  standardId?: string;
  /** Header text, so the map matches the page it opened from. */
  title: string;
  onClose: () => void;
};

export default function CoherenceMapView(props: Props) {
  // ReactFlowProvider is required for useReactFlow-based children and for the
  // minimap to share the viewport store.
  return (
    <ReactFlowProvider>
      <CoherenceMapCanvas {...props} />
    </ReactFlowProvider>
  );
}

function CoherenceMapCanvas({ subjectId, standardId, title, onClose }: Props) {
  const { map, session, loading, error, reload, applyEdge, removeEdge } = useCoherenceMap(subjectId, standardId);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [levels, setLevels] = useState<Set<CoherenceNodeType>>(new Set(ALL_LEVELS));
  const [showSuggested, setShowSuggested] = useState(true);
  const [showCrossCurricular, setShowCrossCurricular] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }, []);

  /**
   * A course with no topic linkage must not offer a Topic filter — the level is
   * genuinely absent, and a control that changes nothing reads as a bug.
   */
  const topicLevelAvailable = map?.meta.topic_level_available !== false;
  const availableLevels = topicLevelAvailable ? ALL_LEVELS : ALL_LEVELS.filter((l) => l !== 'topic');

  const layout = useMemo(() => {
    if (!map) return null;

    return layoutMap(map, collapsed, levels);
  }, [map, collapsed, levels]);

  const relations = useMemo(() => {
    if (!map || !selectedId) return null;

    return neighbourhood(map.edges, selectedId);
  }, [map, selectedId]);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term || !map) return null;

    return new Set(map.nodes.filter((n) => n.label.toLowerCase().includes(term)).map((n) => n.id));
  }, [query, map]);

  // ── Nodes ──────────────────────────────────────────────────────────
  const computedNodes = useMemo<Node[]>(() => {
    if (!layout) return [];

    return layout.nodes.map((n: PositionedNode) => {
      const relation: CoherenceNodeData['relation'] =
        selectedId === n.id
          ? 'selected'
          : relations?.upstream.has(n.id)
            ? 'upstream'
            : relations?.downstream.has(n.id)
              ? 'downstream'
              : null;

      // Two independent reasons to fade, and either is enough: a search that did
      // not match, or a selection this node has no relationship to.
      const dimmedBySearch = matches !== null && !matches.has(n.id);
      const dimmedBySelection = selectedId !== null && relation === null;

      const data: CoherenceNodeData = {
        label: n.label,
        nodeType: n.type,
        depth: n.depth,
        prereqCount: n.prereq_count,
        dependentCount: n.dependent_count,
        onCycle: n.on_cycle,
        offMap: n.off_map,
        collapsed: n.collapsed,
        hiddenDescendants: n.hiddenDescendants,
        emphasis: dimmedBySearch || dimmedBySelection ? 'dim' : matches?.has(n.id) ? 'match' : 'none',
        relation,
        meta: n.meta,
        onToggleCollapse: toggleCollapse,
      };

      return {
        id: n.id,
        type: n.type,
        position: { x: n.x, y: n.y },
        width: n.width,
        height: n.height,
        data: data as unknown as Record<string, unknown>,
        selected: selectedId === n.id,
      };
    });
  }, [layout, selectedId, relations, matches, toggleCollapse]);

  // ── Edges ──────────────────────────────────────────────────────────
  const computedEdges = useMemo<Edge[]>(() => {
    if (!map || !layout) return [];

    return map.edges
      .filter((e) => {
        if (!layout.visible.has(e.source) || !layout.visible.has(e.target)) return false;
        if (e.kind === 'cross_curricular' && !showCrossCurricular) return false;
        if (e.kind !== 'hierarchy' && e.status !== 'approved' && !showSuggested) return false;

        return true;
      })
      .map((e) => toFlowEdge(e, selectedId, relations?.touching ?? null));
  }, [map, layout, showSuggested, showCrossCurricular, selectedId, relations]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // The layout is deterministic, so recomputing replaces positions wholesale. Any
  // manual nudge is intentionally discarded when the filters change — the map
  // reflowed, so the old positions describe a different picture.
  useEffect(() => setNodes(computedNodes), [computedNodes, setNodes]);
  useEffect(() => setEdges(computedEdges), [computedEdges, setEdges]);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(null), 6000);

    return () => window.clearTimeout(timer);
  }, [notice]);

  // ── Mutations ──────────────────────────────────────────────────────
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!session || !connection.source || !connection.target) return;

      if (connection.source === connection.target) {
        setNotice({ tone: 'warn', text: 'A concept cannot be its own prerequisite.' });

        return;
      }

      setBusy(true);

      try {
        // Dragging right-edge -> left-edge means "this comes first", so the drag
        // source IS the prerequisite. Same direction the arrows point.
        const result = await createRelation(session, connection.source, connection.target);
        applyEdge(result.relation);

        setNotice(
          result.warnings?.includes('creates_cycle')
            ? {
                tone: 'warn',
                text: 'Prerequisite added — but it forms a loop: these two now require each other.',
              }
            : { tone: 'ok', text: 'Prerequisite added and approved.' }
        );
      } catch (e) {
        setNotice({ tone: 'error', text: e instanceof Error ? e.message : 'The prerequisite could not be saved.' });
      } finally {
        setBusy(false);
      }
    },
    [session, applyEdge]
  );

  const review = useCallback(
    async (edge: CoherenceEdge, status: 'approved' | 'rejected') => {
      if (!session || !isReviewableEdge(edge)) return;

      setBusy(true);

      try {
        const result = await reviewRelation(session, edge.source_table, edge.relation_id, status);
        applyEdge(result.relation);
        setNotice({
          tone: 'ok',
          text: status === 'approved' ? 'Prerequisite approved.' : 'Suggestion dismissed.',
        });
      } catch (e) {
        setNotice({ tone: 'error', text: e instanceof Error ? e.message : 'That change could not be saved.' });
      } finally {
        setBusy(false);
      }
    },
    [session, applyEdge]
  );

  const remove = useCallback(
    async (edge: CoherenceEdge) => {
      if (!session || !isReviewableEdge(edge)) return;

      setBusy(true);

      try {
        await deleteRelation(session, edge.source_table, edge.relation_id);
        removeEdge(edge.id);
        setNotice({ tone: 'ok', text: 'Prerequisite removed.' });
      } catch (e) {
        setNotice({ tone: 'error', text: e instanceof Error ? e.message : 'That change could not be saved.' });
      } finally {
        setBusy(false);
      }
    },
    [session, removeEdge]
  );

  // ── States ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Shell title={title} onClose={onClose}>
        <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 size={26} className="animate-spin motion-reduce:animate-none" aria-hidden />
          <p className="text-sm">Building the coherence map…</p>
        </div>
      </Shell>
    );
  }

  if (error || !map) {
    return (
      <Shell title={title} onClose={onClose}>
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <AlertTriangle size={26} className="text-amber-500" aria-hidden />
          <p className="max-w-md text-sm text-slate-700">{error ?? 'The coherence map could not be loaded.'}</p>
          <button
            type="button"
            onClick={reload}
            className="rounded-xl bg-[#4f46e5] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4338ca] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  if (map.stats.chapters === 0) {
    return (
      <Shell title={title} onClose={onClose}>
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
          <Network size={26} className="text-slate-400" aria-hidden />
          <p className="text-sm font-medium text-slate-800">No curriculum to map yet</p>
          <p className="max-w-md text-sm text-slate-600">
            Add chapters and concepts to this subject and they will appear here automatically.
          </p>
        </div>
      </Shell>
    );
  }

  const selectedNode = selectedId ? map.nodes.find((n) => n.id === selectedId) ?? null : null;

  return (
    <Shell title={title} onClose={onClose} stats={map.stats} meta={map.meta}>
      <div className="flex h-full min-h-0 flex-col">
        <Toolbar
          query={query}
          onQuery={setQuery}
          levels={levels}
          availableLevels={availableLevels}
          onToggleLevel={(level) =>
            setLevels((current) => {
              const next = new Set(current);
              if (next.has(level)) next.delete(level);
              else next.add(level);

              return next;
            })
          }
          showSuggested={showSuggested}
          onShowSuggested={setShowSuggested}
          showCrossCurricular={showCrossCurricular}
          onShowCrossCurricular={setShowCrossCurricular}
          draftCount={map.stats.draft}
          onCollapseAll={() =>
            setCollapsed(new Set(map.nodes.filter((n) => n.type === 'chapter').map((n) => n.id)))
          }
          onExpandAll={() => setCollapsed(new Set())}
          busy={busy}
        />

        {notice && (
          <div
            role="status"
            className={[
              'flex items-center gap-2 border-b px-4 py-2 text-[13px]',
              notice.tone === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : notice.tone === 'warn'
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-red-200 bg-red-50 text-red-800',
            ].join(' ')}
          >
            {notice.tone === 'ok' ? <Check size={14} aria-hidden /> : <AlertTriangle size={14} aria-hidden />}
            {notice.text}
          </div>
        )}

        <div className="relative flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes as never}
              onNodeClick={(_, node) => setSelectedId((current) => (current === node.id ? null : node.id))}
              onPaneClick={() => setSelectedId(null)}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              minZoom={0.05}
              maxZoom={1.8}
              proOptions={{ hideAttribution: false }}
              className="bg-slate-50"
              nodesConnectable
              elevateEdgesOnSelect
            >
              {/* Flat dots, no gradient or blur — the DS forbids both. */}
              <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#cbd5e1" />
              <Controls showInteractive={false} className="!shadow-sm" />
              <MiniMap
                pannable
                zoomable
                nodeColor={miniMapColour}
                maskColor="rgba(148,163,184,0.18)"
                className="!bottom-3 !right-3 !border !border-slate-200 !bg-white"
              />
            </ReactFlow>
          </div>

          <Inspector
            node={selectedNode}
            map={map}
            onSelect={setSelectedId}
            onApprove={(edge) => review(edge, 'approved')}
            onReject={(edge) => review(edge, 'rejected')}
            onDelete={remove}
            busy={busy}
          />
        </div>

        <Legend acyclic={map.stats.acyclic} cycleCount={map.stats.cycle_nodes.length} />
      </div>
    </Shell>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

function toFlowEdge(edge: CoherenceEdge, selectedId: string | null, touching: Set<string> | null): Edge {
  const isHierarchy = edge.kind === 'hierarchy';
  const isCross = edge.kind === 'cross_curricular';
  const isSuggested = edge.status !== 'approved';
  const related = touching?.has(edge.id) ?? false;
  const faded = selectedId !== null && !related;

  // Hierarchy is containment and must never compete with dependency for attention:
  // thin, pale, no arrowhead. A prerequisite is the claim worth reading.
  const stroke = isHierarchy ? '#cbd5e1' : isCross ? '#0d9488' : isSuggested ? '#d97706' : '#4f46e5';

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    animated: false,
    selectable: !isHierarchy,
    style: {
      stroke,
      strokeWidth: isHierarchy ? 1 : related ? 2.4 : 1.6,
      // Dashed = nobody has confirmed this. Dotted = related, not a gate.
      strokeDasharray: isHierarchy ? undefined : isCross ? '2 4' : isSuggested ? '6 4' : undefined,
      opacity: faded ? 0.12 : 1,
      transition: 'opacity 150ms',
    },
    markerEnd: isHierarchy
      ? undefined
      : { type: MarkerType.ArrowClosed, width: 14, height: 14, color: stroke },
    data: { edge } as unknown as Record<string, unknown>,
  };
}

function miniMapColour(node: Node): string {
  return (
    { unit: '#4f46e5', chapter: '#0284c7', topic: '#7c3aed', concept: '#059669' }[node.type ?? 'concept'] ??
    '#94a3b8'
  );
}

/* ──────────────────────────────────────────────────────────────────── */

function Shell({
  title,
  onClose,
  children,
  stats,
  meta,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  stats?: { units: number; chapters: number; topics: number; concepts: number; approved: number; draft: number };
  meta?: { topic_level_available: boolean };
}) {
  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[560px] flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef2ff] text-[#4f46e5]">
            <Network size={16} strokeWidth={1.9} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-slate-900">Coherence map</h2>
            <p className="truncate text-[12.5px] text-slate-500">{title}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {stats && (
            <dl className="hidden items-center gap-3 text-[12px] text-slate-600 sm:flex">
              <Stat label="Units" value={stats.units} />
              <Stat label="Chapters" value={stats.chapters} />
              {meta?.topic_level_available !== false && <Stat label="Topics" value={stats.topics} />}
              <Stat label="Concepts" value={stats.concepts} />
              <Stat label="Approved" value={stats.approved} />
              <Stat label="Suggested" value={stats.draft} />
            </dl>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2"
            aria-label="Close the coherence map"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

function Toolbar(props: {
  query: string;
  onQuery: (v: string) => void;
  levels: Set<CoherenceNodeType>;
  availableLevels: CoherenceNodeType[];
  onToggleLevel: (l: CoherenceNodeType) => void;
  showSuggested: boolean;
  onShowSuggested: (v: boolean) => void;
  showCrossCurricular: boolean;
  onShowCrossCurricular: (v: boolean) => void;
  draftCount: number;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  busy: boolean;
}) {
  const levelLabel: Record<CoherenceNodeType, string> = {
    unit: 'Units',
    chapter: 'Chapters',
    topic: 'Topics',
    concept: 'Concepts',
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
      <label className="relative flex-1 sm:max-w-xs">
        <span className="sr-only">Search the map</span>
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          value={props.query}
          onChange={(e) => props.onQuery(e.target.value)}
          placeholder="Search units, chapters, concepts"
          className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus-visible:border-[#4f46e5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5]/30"
        />
      </label>

      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Levels shown">
        {props.availableLevels.map((level) => (
          <Toggle
            key={level}
            pressed={props.levels.has(level)}
            onClick={() => props.onToggleLevel(level)}
            label={levelLabel[level]}
          />
        ))}
      </div>

      <span aria-hidden className="hidden h-5 w-px bg-slate-200 sm:block" />

      <Toggle
        pressed={props.showSuggested}
        onClick={() => props.onShowSuggested(!props.showSuggested)}
        label={`Suggested (${props.draftCount})`}
      />
      <Toggle
        pressed={props.showCrossCurricular}
        onClick={() => props.onShowCrossCurricular(!props.showCrossCurricular)}
        label="Related links"
      />

      <span aria-hidden className="hidden h-5 w-px bg-slate-200 sm:block" />

      <button
        type="button"
        onClick={props.onCollapseAll}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1.5 text-[12.5px] font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2"
      >
        <ChevronsDownUp size={13} strokeWidth={1.9} aria-hidden />
        Collapse all
      </button>
      <button
        type="button"
        onClick={props.onExpandAll}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1.5 text-[12.5px] font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2"
      >
        <ChevronsUpDown size={13} strokeWidth={1.9} aria-hidden />
        Expand all
      </button>

      {props.busy && (
        <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-slate-500">
          <Loader2 size={13} className="animate-spin motion-reduce:animate-none" aria-hidden />
          Saving…
        </span>
      )}
    </div>
  );
}

/** aria-pressed rather than a checkbox: these change the view, they do not submit. */
function Toggle({ pressed, onClick, label }: { pressed: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={[
        'rounded-md border px-2 py-1.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2',
        pressed
          ? 'border-[#c7d2fe] bg-[#eef2ff] text-[#4338ca]'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function Legend({ acyclic, cycleCount }: { acyclic: boolean; cycleCount: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-200 bg-white px-4 py-2 text-[11.5px] text-slate-600">
      <LegendKey colour="#cbd5e1" dashed={false} label="Part of (hierarchy)" />
      <LegendKey colour="#4f46e5" dashed={false} label="Prerequisite — approved" />
      <LegendKey colour="#d97706" dashed label="Prerequisite — suggested, not yet approved" />
      <LegendKey colour="#0d9488" dashed label="Related across subjects" />

      <span className="ml-auto flex items-center gap-3">
        <span className="text-slate-500">Drag a node&apos;s right edge onto another to add a prerequisite.</span>
        {!acyclic && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">
            <RotateCcw size={11} strokeWidth={2} aria-hidden />
            {cycleCount} concepts are in a loop
          </span>
        )}
      </span>
    </div>
  );
}

function LegendKey({ colour, dashed, label }: { colour: string; dashed: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="22" height="8" aria-hidden className="shrink-0">
        <line
          x1="0"
          y1="4"
          x2="22"
          y2="4"
          stroke={colour}
          strokeWidth="2"
          strokeDasharray={dashed ? '5 3' : undefined}
        />
      </svg>
      {label}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

function Inspector({
  node,
  map,
  onSelect,
  onApprove,
  onReject,
  onDelete,
  busy,
}: {
  node: CoherenceNode | null;
  map: CoherenceMap;
  onSelect: (id: string) => void;
  onApprove: (e: CoherenceEdge) => void;
  onReject: (e: CoherenceEdge) => void;
  onDelete: (e: CoherenceEdge) => void;
  busy: boolean;
}) {
  if (!node) {
    return (
      <aside className="hidden w-72 shrink-0 border-l border-slate-200 bg-white p-4 lg:block">
        <p className="text-[13px] font-medium text-slate-800">Nothing selected</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
          Select any unit, chapter, topic or concept to see what must be learned before it and what depends
          on it.
        </p>
      </aside>
    );
  }

  const labelOf = (id: string) => map.nodes.find((n) => n.id === id)?.label ?? id;

  const before = map.edges.filter((e) => e.kind !== 'hierarchy' && e.target === node.id);
  const after = map.edges.filter((e) => e.kind !== 'hierarchy' && e.source === node.id);

  return (
    <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white lg:block">
      <div className="border-b border-slate-200 p-4">
        <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">{node.type}</p>
        <h3 className="mt-0.5 text-[14px] font-semibold leading-snug text-slate-900">{node.label}</h3>
        {typeof node.meta?.description === 'string' && (
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">{node.meta.description}</p>
        )}
      </div>

      <EdgeGroup
        heading="Must be learned first"
        empty="Nothing needs to come before this."
        edges={before}
        otherEnd={(e) => e.source}
        labelOf={labelOf}
        onSelect={onSelect}
        onApprove={onApprove}
        onReject={onReject}
        onDelete={onDelete}
        busy={busy}
      />

      <EdgeGroup
        heading="Unlocked by this"
        empty="Nothing depends on this yet."
        edges={after}
        otherEnd={(e) => e.target}
        labelOf={labelOf}
        onSelect={onSelect}
        onApprove={onApprove}
        onReject={onReject}
        onDelete={onDelete}
        busy={busy}
      />
    </aside>
  );
}

function EdgeGroup({
  heading,
  empty,
  edges,
  otherEnd,
  labelOf,
  onSelect,
  onApprove,
  onReject,
  onDelete,
  busy,
}: {
  heading: string;
  empty: string;
  edges: CoherenceEdge[];
  otherEnd: (e: CoherenceEdge) => string;
  labelOf: (id: string) => string;
  onSelect: (id: string) => void;
  onApprove: (e: CoherenceEdge) => void;
  onReject: (e: CoherenceEdge) => void;
  onDelete: (e: CoherenceEdge) => void;
  busy: boolean;
}) {
  return (
    <section className="border-b border-slate-200 p-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {heading} <span className="tabular-nums text-slate-400">({edges.length})</span>
      </h4>

      {edges.length === 0 ? (
        <p className="mt-2 text-[12px] text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {edges.map((edge) => {
            const suggested = edge.status !== 'approved';

            return (
              <li key={edge.id} className="rounded-md border border-slate-200 p-2">
                <button
                  type="button"
                  onClick={() => onSelect(otherEnd(edge))}
                  className="block w-full text-left text-[12.5px] font-medium leading-snug text-slate-800 hover:text-[#4f46e5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-1"
                >
                  {labelOf(otherEnd(edge))}
                </button>

                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span
                    className={[
                      'rounded px-1 py-px text-[9.5px] font-medium',
                      suggested ? 'bg-amber-50 text-amber-800' : 'bg-indigo-50 text-indigo-700',
                    ].join(' ')}
                  >
                    {suggested ? `Suggested by ${edge.tagged_by}` : 'Approved'}
                  </span>
                  {edge.kind === 'cross_curricular' && (
                    <span className="rounded bg-teal-50 px-1 py-px text-[9.5px] font-medium text-teal-700">
                      Related
                    </span>
                  )}
                </div>

                {edge.relation_id !== null && (
                  <div className="mt-1.5 flex items-center gap-1">
                    {suggested && (
                      <ActionButton onClick={() => onApprove(edge)} disabled={busy} tone="approve">
                        <Check size={11} strokeWidth={2.2} aria-hidden />
                        Approve
                      </ActionButton>
                    )}
                    {suggested && (
                      <ActionButton onClick={() => onReject(edge)} disabled={busy} tone="plain">
                        <X size={11} strokeWidth={2.2} aria-hidden />
                        Dismiss
                      </ActionButton>
                    )}
                    <ActionButton onClick={() => onDelete(edge)} disabled={busy} tone="danger">
                      <Trash2 size={11} strokeWidth={2} aria-hidden />
                      Remove
                    </ActionButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  tone: 'approve' | 'plain' | 'danger';
}) {
  const styles = {
    approve: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    plain: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
    danger: 'border-red-200 bg-white text-red-600 hover:bg-red-50',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-1 text-[10.5px] font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-1 ${styles}`}
    >
      {children}
    </button>
  );
}
