'use client';

/**
 * The coherence map screen.
 * Redesigned with modern glassmorphism panels, responsive HUD controls,
 * polished network statistics, and smooth view transitions.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './coherence-map-theme.css';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Filter,
  Layers,
  Loader2,
  Network,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';

import {
  applyEdgeTo,
  createRelation,
  deleteRelation,
  fetchCoherenceMapForConcept,
  isReviewableEdge,
  removeEdgeFrom,
  reviewRelation,
  useCoherenceMap,
  type CoherenceEdge,
  type CoherenceMap,
} from '@/app/course-master/data/coherenceMap';

import { ConceptDeck } from './ConceptDeck';
import { nodeTypes, type ConceptCardData } from './ConceptCard';
import { FocusBreadcrumb, crumbsFor } from './FocusBreadcrumb';
import { MapInteractionContext, edgeTypes, markerColour, type LaneEdgeData } from './LaneEdge';
import { CurriculumExplorerSidebar } from './CurriculumExplorerSidebar';
import {
  isDependencyEdge,
  layoutFocusMap,
  type FocusFilters,
  type FocusNode,
} from './focusLayout';

const GRID_DOT = '#CBD5E1';
const PANEL_FRAME =
  'relative flex h-[calc(100vh-180px)] min-h-[580px] flex-col overflow-hidden rounded-[24px] border border-slate-200/90 bg-slate-50/50 shadow-[0_4px_32px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)]';

const FLOATING_CHROME =
  'rounded-2xl border border-slate-200/90 bg-white/95 shadow-[0_4px_20px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.05)] backdrop-blur-md';

type Props = {
  subjectId: string;
  standardId?: string;
  title: string;
  onClose: () => void;
  initialChapterId?: string | null;
};

export default function CoherenceMapView(props: Props) {
  return (
    <ReactFlowProvider>
      <CoherenceMapCanvas {...props} />
    </ReactFlowProvider>
  );
}

function CoherenceMapCanvas({ subjectId, standardId, title, onClose, initialChapterId }: Props) {
  const { map, session, loading, error, reload, viewYear, applyEdge, removeEdge } = useCoherenceMap(
    subjectId,
    standardId
  );

  const [walked, setWalked] = useState<CoherenceMap | null>(null);
  const [walking, setWalking] = useState(false);

  const active = walked ?? map;

  const [rootId, setRootId] = useState<string | null>(null);
  const [rootStack, setRootStack] = useState<{ id: string; walked: CoherenceMap | null }[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FocusFilters>({
    includeSuggested: true,
    includeRelated: true,
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { setCenter, getViewport, setViewport } = useReactFlow();
  const savedViewport = useRef<{ x: number; y: number; zoom: number } | null>(null);

  const [seenMap, setSeenMap] = useState(map);
  const [seenChapterId, setSeenChapterId] = useState(initialChapterId);

  if (seenMap !== map || seenChapterId !== initialChapterId) {
    setSeenMap(map);
    setSeenChapterId(initialChapterId);
    setWalked(null);
    setRootId(null);
    setRootStack([]);
    setExpandedId(null);
  }

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(null), 6000);

    return () => window.clearTimeout(timer);
  }, [notice]);

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  const layout = useMemo(() => {
    if (!active || !rootId) return null;

    return layoutFocusMap(active, rootId, filters, expandedId);
  }, [active, rootId, filters, expandedId]);

  const labelOf = useCallback(
    (id: string) => active?.nodes.find((n) => n.id === id)?.label ?? id,
    [active]
  );

  const commitEdge = useCallback(
    (edge: CoherenceEdge) => {
      if (walked) setWalked((current) => (current ? applyEdgeTo(current, edge) : current));
      else applyEdge(edge);
    },
    [walked, applyEdge]
  );

  const dropEdge = useCallback(
    (edgeId: string) => {
      if (walked) setWalked((current) => (current ? removeEdgeFrom(current, edgeId) : current));
      else removeEdge(edgeId);
    },
    [walked, removeEdge]
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!session || !connection.source || !connection.target) return;

      if (connection.source === connection.target) {
        setNotice({ tone: 'warn', text: 'A concept cannot be its own prerequisite.' });

        return;
      }

      setBusy(true);

      try {
        const result = await createRelation(session, connection.source, connection.target);
        commitEdge(result.relation);

        setNotice(
          result.warnings?.includes('creates_cycle')
            ? {
                tone: 'warn',
                text: 'Prerequisite added - but forms a cycle with an existing prerequisite.',
              }
            : { tone: 'ok', text: 'Prerequisite successfully added and approved.' }
        );
      } catch (e) {
        setNotice({
          tone: 'error',
          text: e instanceof Error ? e.message : 'The prerequisite couldn’t be saved.',
        });
      } finally {
        setBusy(false);
      }
    },
    [session, commitEdge]
  );

  const review = useCallback(
    async (edge: CoherenceEdge, status: 'approved' | 'rejected') => {
      if (!session || !isReviewableEdge(edge)) return;

      setBusy(true);

      try {
        const result = await reviewRelation(session, edge.source_table, edge.relation_id, status);
        commitEdge(result.relation);
        setNotice({
          tone: 'ok',
          text: status === 'approved' ? 'Prerequisite approved.' : 'Suggestion dismissed.',
        });
      } catch (e) {
        setNotice({
          tone: 'error',
          text: e instanceof Error ? e.message : 'That change couldn’t be saved.',
        });
      } finally {
        setBusy(false);
      }
    },
    [session, commitEdge]
  );

  const remove = useCallback(
    async (edge: CoherenceEdge) => {
      if (!session || !isReviewableEdge(edge)) return;

      setBusy(true);

      try {
        await deleteRelation(session, edge.source_table, edge.relation_id);
        dropEdge(edge.id);
        setNotice({ tone: 'ok', text: 'Prerequisite removed.' });
      } catch (e) {
        setNotice({
          tone: 'error',
          text: e instanceof Error ? e.message : 'That change couldn’t be saved.',
        });
      } finally {
        setBusy(false);
      }
    },
    [session, dropEdge]
  );

  const collapse = useCallback(() => {
    setExpandedId(null);

    const saved = savedViewport.current;
    if (saved) {
      setViewport(saved, { duration: reduceMotion ? 0 : 240 });
      savedViewport.current = null;
    }
  }, [setViewport, reduceMotion]);

  const mapConcept = useCallback(
    async (id: string) => {
      const node = active?.nodes.find((n) => n.id === id);
      if (!node || !session) return;

      savedViewport.current = null;

      if (!node.off_map) {
        setRootStack((stack) =>
          rootId && rootId !== id ? [...stack, { id: rootId, walked }] : stack
        );
        setRootId(id);
        setExpandedId(id);

        return;
      }

      setWalking(true);

      try {
        const next = await fetchCoherenceMapForConcept(session, node.entity_id);
        setRootStack((stack) => (rootId ? [...stack, { id: rootId, walked }] : stack));
        setWalked(next);
        setRootId(next.focus?.ref ?? id);
        setExpandedId(next.focus?.ref ?? id);
      } catch (e) {
        setNotice({
          tone: 'error',
          text: e instanceof Error ? e.message : 'That concept couldn’t be opened.',
        });
      } finally {
        setWalking(false);
      }
    },
    [active, session, rootId, walked]
  );

  const goBack = useCallback(() => {
    const previous = rootStack[rootStack.length - 1];
    if (previous === undefined) return;

    setWalked(previous.walked);
    setRootId(previous.id);
    setExpandedId(previous.id);
    setRootStack((stack) => stack.slice(0, -1));
  }, [rootStack]);

  const backToDeck = useCallback(() => {
    setWalked(null);
    setRootId(null);
    setExpandedId(null);
    setRootStack([]);
  }, []);

  const expand = useCallback(
    (id: string, node: FocusNode) => {
      savedViewport.current = getViewport();
      setExpandedId(id);

      setCenter(node.x + node.width / 2, node.y + node.height / 2, {
        zoom: 1,
        duration: reduceMotion ? 0 : 240,
      });
    },
    [getViewport, setCenter, reduceMotion]
  );

  const computedNodes = useMemo<Node[]>(() => {
    if (!layout || !active) return [];

    return layout.nodes.map((node) => {
      const expanded = node.id === expandedId;

      const data: ConceptCardData = {
        node,
        expanded,
        prerequisites: active.edges.filter(
          (e) => e.target === node.id && isDependencyEdge(e, filters)
        ),
        dependents: active.edges.filter(
          (e) => e.source === node.id && isDependencyEdge(e, filters)
        ),
        labelOf,
        busy,
        onMapConcept: mapConcept,
        onCollapse: collapse,
        onApprove: (edge) => review(edge, 'approved'),
        onReject: (edge) => review(edge, 'rejected'),
        onDelete: remove,
        onHover: setHoveredId,
      };

      return {
        id: node.id,
        type: 'concept',
        position: { x: node.x, y: node.y },
        width: node.width,
        height: node.height,
        zIndex: expanded ? 10 : 1,
        selected: expanded,
        data: data as unknown as Record<string, unknown>,
        ariaRole: 'button',
        ariaLabel: `${node.label}. ${node.prereq_count} prerequisites, ${node.dependent_count} dependents.`,
        className: 'rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]',
      } satisfies Node;
    });
  }, [layout, active, expandedId, filters, labelOf, busy, mapConcept, collapse, review, remove]);

  const computedEdges = useMemo<Edge[]>(() => {
    if (!layout) return [];

    return layout.edges.map((edge) => {
      const geometry = layout.geometry.get(edge.id);
      const backward = geometry?.backward ?? false;
      const colour = markerColour(edge, backward);

      const data: LaneEdgeData = { edge, laneX: geometry?.laneX ?? 0, backward };

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'lane',
        markerEnd:
          edge.kind === 'cross_curricular'
            ? undefined
            : { type: MarkerType.ArrowClosed, width: 14, height: 14, color: colour },
        data: data as unknown as Record<string, unknown>,
      } satisfies Edge;
    });
  }, [layout]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => setNodes(computedNodes), [computedNodes, setNodes]);
  useEffect(() => setEdges(computedEdges), [computedEdges, setEdges]);

  useEffect(() => {
    if (!rootId || !layout) return;

    const root = layout.nodes.find((n) => n.isRoot);
    if (!root) return;

    const timer = window.setTimeout(
      () =>
        setCenter(root.x + root.width / 2, root.y + root.height / 2, {
          zoom: 1,
          duration: reduceMotion ? 0 : 200,
        }),
      0
    );

    return () => window.clearTimeout(timer);
  }, [rootId, setCenter, reduceMotion]);

  const related = useMemo(() => {
    if (!hoveredId || !layout) return null;

    const set = new Set<string>([hoveredId]);

    for (const edge of layout.edges) {
      if (edge.source === hoveredId) set.add(edge.target);
      else if (edge.target === hoveredId) set.add(edge.source);
    }

    return set;
  }, [hoveredId, layout]);

  const interaction = useMemo(
    () => ({ hoveredId, related, rootId }),
    [hoveredId, related, rootId]
  );

  if (loading) {
    return (
      <Shell title={title} onClose={onClose}>
        <div className="flex h-full flex-col items-center justify-center gap-3.5 text-slate-500">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-100">
            <Loader2
              size={28}
              className="animate-spin text-[#059669] motion-reduce:animate-none"
              aria-hidden
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-800">Building Coherence Knowledge Map</p>
            <p className="text-xs text-slate-400 mt-0.5">Assembling prerequisite hierarchy and relationships...</p>
          </div>
        </div>
      </Shell>
    );
  }

  if (error || !map) {
    return (
      <Shell title={title} onClose={onClose}>
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
            <AlertTriangle size={24} aria-hidden />
          </div>
          <p className="max-w-md text-sm font-medium text-slate-700">
            {error ?? 'The coherence map couldn’t be loaded.'}
          </p>
          <button
            type="button"
            onClick={reload}
            className="mt-2 rounded-full bg-[#059669] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  if (map.stats.chapters === 0) {
    const years = map.meta.available_syears ?? [];

    return (
      <Shell title={title} onClose={onClose}>
        <div className="flex h-full flex-col items-center justify-center gap-2.5 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Network size={26} aria-hidden />
          </div>

          {years.length === 0 ? (
            <>
              <p className="text-base font-bold text-slate-800">No curriculum mapped yet</p>
              <p className="max-w-md text-xs text-slate-500">
                Add chapters and concepts to this subject and they will automatically populate here.
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-bold text-slate-800">
                Nothing mapped for academic year {map.meta.syear ?? 'selected'}
              </p>
              <p className="max-w-md text-xs text-slate-500">
                This subject has curriculum authored for {years.join(', ')}. Select a year to view:
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => viewYear(year)}
                    className="rounded-full bg-[#059669] px-4 py-1.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"
                  >
                    View {year}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Shell>
    );
  }

  const rootNode = layout?.nodes.find((n) => n.isRoot) ?? null;
  const crumbs = active ? crumbsFor(active, rootNode, backToDeck) : [];

  const notice_ = notice && (
    <div
      role="status"
      className={[
        'animate-in fade-in flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-semibold shadow-lg backdrop-blur-md duration-200',
        notice.tone === 'ok'
          ? 'bg-emerald-600 text-white shadow-emerald-600/20'
          : notice.tone === 'warn'
            ? 'bg-amber-500 text-white shadow-amber-500/20'
            : 'bg-red-600 text-white shadow-red-600/20',
      ].join(' ')}
    >
      {notice.tone === 'ok' ? (
        <CheckCircle2 size={15} aria-hidden />
      ) : (
        <AlertTriangle size={15} aria-hidden />
      )}
      <span>{notice.text}</span>
    </div>
  );

  return (
    <div className={PANEL_FRAME}>
      <MapInteractionContext.Provider value={interaction}>
        {!rootId ? (
          <div className="animate-in fade-in min-h-0 flex-1 duration-300 motion-reduce:animate-none">
            <ConceptDeck
              map={map}
              initialChapterId={initialChapterId}
              onClose={onClose}
              onPick={(id) => {
                setWalked(null);
                setRootId(id);
                setExpandedId(id);
              }}
            />
          </div>
        ) : (
          <div className="animate-in fade-in flex min-h-0 flex-1 duration-300 motion-reduce:animate-none overflow-hidden">
            {/* Left: Curriculum Explorer Sidebar (matching user's design) */}
            <CurriculumExplorerSidebar
              map={active ?? map}
              selectedConceptId={rootId}
              onSelectConcept={(id) => mapConcept(id)}
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
            />

            {/* Right: ReactFlow Canvas Area */}
            <div className="relative min-h-0 flex-1">
              {walking && (
                <div className="animate-in fade-in absolute inset-0 z-30 flex items-center justify-center bg-white/70 backdrop-blur-xs duration-150">
                  <span className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 shadow-xl">
                    <Loader2
                      size={16}
                      className="animate-spin text-[#059669] motion-reduce:animate-none"
                      aria-hidden
                    />
                    <span>Loading cross-grade curriculum map...</span>
                  </span>
                </div>
              )}

              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes as never}
                edgeTypes={edgeTypes as never}
                onNodeClick={(_, node) => {
                  if (node.id === expandedId) {
                    collapse();

                    return;
                  }

                  const target = layout?.nodes.find((n) => n.id === node.id);
                  if (target) expand(node.id, target);
                }}
                onPaneClick={collapse}
                fitView
                fitViewOptions={{ padding: 0.18, minZoom: 1, maxZoom: 1 }}
                minZoom={0.25}
                maxZoom={1.5}
                nodesDraggable={false}
                nodesConnectable
                zIndexMode="manual"
                nodeClickDistance={4}
                className="coherence-map-canvas bg-slate-50/70 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/30 via-slate-50/60 to-slate-100/50"
              >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color={GRID_DOT} />
                <Controls
                  showInteractive={false}
                  className="!border-slate-200/90 !bg-white/95 !shadow-[0_4px_20px_rgba(15,23,42,0.08)] !rounded-2xl overflow-hidden [&>button]:!border-slate-100 [&>button]:!bg-white [&>button]:!fill-slate-600 [&>button:hover]:!bg-slate-50"
                />

                {/* Top-Left: Header Pill + Return to Units */}
                <Panel position="top-left">
                  <div className={`${FLOATING_CHROME} flex items-center gap-3 px-3.5 py-2`}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-white shadow-sm">
                      <Network size={16} strokeWidth={2.2} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-[13px] font-bold leading-tight text-slate-900">
                        Coherence Map
                      </h2>
                      <p className="truncate text-[11px] font-medium leading-tight text-slate-500">{title}</p>
                    </div>
                    <button
                      type="button"
                      onClick={backToDeck}
                      className="ml-2 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-100 hover:text-slate-900"
                      title="Return to Curriculum Units & Explorer"
                    >
                      <Layers size={11} strokeWidth={2.2} />
                      <span>All Units</span>
                    </button>
                  </div>
                </Panel>

                {/* Top-Center: Breadcrumbs & Status Alerts */}
                <Panel position="top-center">
                  <div className="flex flex-col items-center gap-2">
                    {crumbs.length > 0 && (
                      <div className={`${FLOATING_CHROME} px-3 py-1.5`}>
                        <FocusBreadcrumb
                          crumbs={crumbs}
                          onBack={goBack}
                          canGoBack={rootStack.length > 0}
                        />
                      </div>
                    )}

                    {/* Flow Direction Indicator Banner */}
                    <div className="hidden md:flex items-center gap-4 rounded-full border border-slate-200/80 bg-white/90 px-3.5 py-1 text-[11px] font-bold text-slate-500 shadow-2xs backdrop-blur-md">
                      <span className="flex items-center gap-1 text-sky-700">
                        <span>← Prerequisites</span>
                        <span className="text-[9.5px] font-normal text-slate-400">(Must Learn First)</span>
                      </span>
                      <span className="h-3 w-px bg-slate-200" />
                      <span className="flex items-center gap-1 text-emerald-800">
                        <Sparkles size={11} className="text-emerald-600" />
                        <span>Current Focus</span>
                      </span>
                      <span className="h-3 w-px bg-slate-200" />
                      <span className="flex items-center gap-1 text-teal-700">
                        <span>Unlocks Next →</span>
                        <span className="text-[9.5px] font-normal text-slate-400">(Dependents)</span>
                      </span>
                    </div>

                    {notice_}
                  </div>
                </Panel>

                {/* Top-Right: Explorer & Close Button */}
                <Panel position="top-right">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={backToDeck}
                      className={`${FLOATING_CHROME} inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]`}
                      title="Browse full curriculum"
                    >
                      <Layers size={13} strokeWidth={2.2} />
                      <span>Explorer</span>
                    </button>

                    <button
                      type="button"
                      onClick={onClose}
                      className={`${FLOATING_CHROME} flex h-9 w-9 items-center justify-center text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2`}
                      aria-label="Close the coherence map"
                    >
                      <X size={16} strokeWidth={2.2} />
                    </button>
                  </div>
                </Panel>

                {/* Bottom-Right: Interactive Legend & Filter Controls */}
                <Panel position="bottom-right">
                  <Legend
                    stats={active?.stats ?? map.stats}
                    filters={filters}
                    onToggle={(key) => setFilters((current) => ({ ...current, [key]: !current[key] }))}
                  />
                </Panel>
              </ReactFlow>
            </div>
          </div>
        )}
      </MapInteractionContext.Provider>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Shell({
  title,
  onClose,
  children,
  crumbs,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  crumbs?: React.ReactNode;
}) {
  return (
    <div className={PANEL_FRAME}>
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200/90 bg-white/95 px-5 py-3.5 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-white shadow-sm">
            <Network size={16} strokeWidth={2.2} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-bold text-slate-900">Coherence Map</h2>
            <p className="truncate text-[12px] font-medium text-slate-500">{title}</p>
          </div>
        </div>

        <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">{crumbs}</div>

        <button
          type="button"
          onClick={onClose}
          className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]"
          aria-label="Close the coherence map"
        >
          <X size={15} strokeWidth={2.2} />
        </button>
      </header>

      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function Legend({
  stats,
  filters,
  onToggle,
}: {
  stats: {
    concepts: number;
    approved: number;
    draft: number;
    acyclic: boolean;
    cycle_nodes: string[];
  };
  filters: FocusFilters;
  onToggle: (key: keyof FocusFilters) => void;
}) {
  return (
    <div className={`${FLOATING_CHROME} flex w-60 flex-col gap-2.5 p-3.5 text-[11px] text-slate-600`}>
      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
        <span className="font-bold text-[11.5px] uppercase tracking-wider text-slate-700">Map Legend</span>
        <Filter size={12} className="text-slate-400" />
      </div>

      <div className="flex flex-col gap-1.5">
        <LegendKey colour="#059669" label="Approved Prerequisite" />
        <LegendKey colour="#D97706" dashed label="Suggested Prerequisite" />
        <LegendKey colour="#0D9488" dashed label="Cross-Curricular Link" />
        <LegendKey colour="#B45309" dashed label="Loop (Prerequisite Cycle)" />
      </div>

      <div className="flex items-center gap-1.5 border-t border-slate-100 pt-2">
        <FilterToggle
          pressed={filters.includeSuggested}
          onClick={() => onToggle('includeSuggested')}
          label="Suggested"
        />
        <FilterToggle
          pressed={filters.includeRelated}
          onClick={() => onToggle('includeRelated')}
          label="Related"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 pt-2 tabular-nums text-[10.5px] text-slate-500 font-medium">
        <span><strong className="font-bold text-slate-800">{stats.concepts}</strong> concepts</span>
        <span>•</span>
        <span><strong className="font-bold text-emerald-700">{stats.approved}</strong> approved</span>
        <span>•</span>
        <span><strong className="font-bold text-amber-700">{stats.draft}</strong> suggested</span>
        {!stats.acyclic && (
          <div className="mt-1 w-full flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 font-semibold text-amber-800 border border-amber-200/70">
            <RotateCcw size={10} strokeWidth={2.4} />
            <span>{stats.cycle_nodes.length} concepts in a loop</span>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterToggle({
  pressed,
  onClick,
  label,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={[
        'flex-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-1',
        pressed
          ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
      ].join(' ')}
    >
      {pressed ? `✓ ${label}` : label}
    </button>
  );
}

function LegendKey({ colour, dashed, label }: { colour: string; dashed?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="22" height="8" aria-hidden className="shrink-0">
        <line
          x1="0"
          y1="4"
          x2="22"
          y2="4"
          stroke={colour}
          strokeWidth="2.4"
          strokeDasharray={dashed ? '5 3' : undefined}
        />
      </svg>
      <span className="text-[11px]">{label}</span>
    </span>
  );
}
