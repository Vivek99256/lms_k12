'use client';

/**
 * The coherence map screen.
 *
 * Renders whatever the backend returns. There is no curriculum in this file: no unit,
 * chapter, topic or concept is named, no prerequisite is decided, and no relationship
 * is inferred. Adding a concept to the database puts it on the map; approving an edge
 * changes the map. Nothing here needs editing for either.
 *
 * WHAT THE SCREEN IS FOR
 * Four questions: what must be learned before this, what depends on it, where does it
 * sit in the curriculum, and which of those claims has a person actually confirmed.
 *
 * The first two are the canvas. One concept is centred, its prerequisites fan left and
 * the things it unlocks fan right, two hops each way - so the answer IS the picture,
 * rather than something to be traced out of a picture of everything.
 *
 * The third moved off the canvas into the breadcrumb and the card header. Drawing
 * containment and dependency in the same channel is what made the previous version
 * unreadable: 233 concepts each claiming a row made the canvas some 15,000px tall and
 * fitView shrank it to an illegible smear.
 *
 * The fourth is the dashed/solid distinction, which is never decorative: a dashed edge
 * is a machine's guess nobody has agreed with yet. Solid indigo is either a curator's
 * approval or a row from the authored map.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
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
import { AlertTriangle, Check, Loader2, Network, X } from 'lucide-react';

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
import {
  FOCUS_EXPANDED,
  isDependencyEdge,
  layoutFocusMap,
  type FocusFilters,
  type FocusNode,
} from './focusLayout';

type Props = {
  subjectId: string;
  standardId?: string;
  /** Header text, so the map matches the page it opened from. */
  title: string;
  onClose: () => void;
};

export default function CoherenceMapView(props: Props) {
  return (
    <ReactFlowProvider>
      <CoherenceMapCanvas {...props} />
    </ReactFlowProvider>
  );
}

function CoherenceMapCanvas({ subjectId, standardId, title, onClose }: Props) {
  const { map, session, loading, error, reload, viewYear, applyEdge, removeEdge } = useCoherenceMap(
    subjectId,
    standardId
  );

  /**
   * A map fetched for a DIFFERENT scope, after walking into another grade.
   *
   * The hook is keyed on the subject and grade this screen opened with, so following a
   * prerequisite into class 9 cannot go through it. When one is loaded it takes over as
   * the active map; picking again from the deck drops back to the hook's.
   */
  const [walked, setWalked] = useState<CoherenceMap | null>(null);
  const [walking, setWalking] = useState(false);

  const active = walked ?? map;

  const [rootId, setRootId] = useState<string | null>(null);
  const [rootStack, setRootStack] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FocusFilters>({
    includeSuggested: true,
    includeRelated: true,
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  const { setCenter, getViewport, setViewport } = useReactFlow();
  const savedViewport = useRef<{ x: number; y: number; zoom: number } | null>(null);

  /**
   * A new scope from the hook - a different subject, or a different academic year -
   * invalidates everything about where we had walked to.
   *
   * Adjusted during render rather than in an effect. React restarts the render before
   * committing, so the canvas never paints one frame of the old concept against the new
   * map; an effect would do exactly that, and would also cascade a second render.
   */
  const [seenMap, setSeenMap] = useState(map);

  if (seenMap !== map) {
    setSeenMap(map);
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

  /**
   * Safe to key on expandedId: opening a card moves the columns apart, and that is a
   * user action, not something the ResizeObserver can cause. The dimension changes
   * xyflow feeds back through onNodesChange touch none of these deps, so measuring a
   * resized card cannot re-enter this memo and start a resize loop.
   */
  const layout = useMemo(() => {
    if (!active || !rootId) return null;

    return layoutFocusMap(active, rootId, filters, expandedId);
  }, [active, rootId, filters, expandedId]);

  const labelOf = useCallback(
    (id: string) => active?.nodes.find((n) => n.id === id)?.label ?? id,
    [active]
  );

  // -- Mutations ------------------------------------------------------
  /**
   * Write the result wherever the map actually lives.
   *
   * On the hook's own map that is applyEdge; on a walked map the hook knows nothing
   * about it, so the same pure helper is applied locally. Both go through one function,
   * so a rejected edge disappears the same way on either.
   */
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
        // Dragging right-edge -> left-edge means "this comes first", so the drag source
        // IS the prerequisite. Same direction the arrows point. Reverse it and a wrong
        // curriculum rule is written with no error.
        const result = await createRelation(session, connection.source, connection.target);
        commitEdge(result.relation);

        setNotice(
          result.warnings?.includes('creates_cycle')
            ? {
                tone: 'warn',
                text: 'Prerequisite added - but it forms a loop: these two now require each other.',
              }
            : { tone: 'ok', text: 'Prerequisite added and approved.' }
        );
      } catch (e) {
        setNotice({
          tone: 'error',
          text: e instanceof Error ? e.message : 'The prerequisite could not be saved.',
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
          text: e instanceof Error ? e.message : 'That change could not be saved.',
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
          text: e instanceof Error ? e.message : 'That change could not be saved.',
        });
      } finally {
        setBusy(false);
      }
    },
    [session, dropEdge]
  );

  // -- Navigation -----------------------------------------------------
  const collapse = useCallback(() => {
    setExpandedId(null);

    const saved = savedViewport.current;
    if (saved) {
      setViewport(saved, { duration: reduceMotion ? 0 : 240 });
      savedViewport.current = null;
    }
  }, [setViewport, reduceMotion]);

  /**
   * Centre the map on a concept, fetching another grade's map if it lives there.
   *
   * An off-map node is a prerequisite the server pulled in from outside this scope; it
   * arrives as a label and a pair of ids and nothing else, so centring on it means
   * asking the server for ITS map. Everything already in scope is a pure recompute with
   * no network call, which is what makes walking the chain feel immediate.
   */
  const mapConcept = useCallback(
    async (id: string) => {
      const node = active?.nodes.find((n) => n.id === id);
      if (!node || !session) return;

      savedViewport.current = null;

      if (!node.off_map) {
        setRootStack((stack) => (rootId && rootId !== id ? [...stack, rootId] : stack));
        setRootId(id);
        setExpandedId(id);

        return;
      }

      setWalking(true);

      try {
        const next = await fetchCoherenceMapForConcept(session, node.entity_id);
        setRootStack((stack) => (rootId ? [...stack, rootId] : stack));
        setWalked(next);
        setRootId(next.focus?.ref ?? id);
        setExpandedId(next.focus?.ref ?? id);
      } catch (e) {
        setNotice({
          tone: 'error',
          text: e instanceof Error ? e.message : 'That concept could not be opened.',
        });
      } finally {
        setWalking(false);
      }
    },
    [active, session, rootId]
  );

  const goBack = useCallback(() => {
    setRootStack((stack) => {
      const previous = stack[stack.length - 1];
      if (previous === undefined) return stack;

      setRootId(previous);
      setExpandedId(previous);

      return stack.slice(0, -1);
    });
  }, []);

  const expand = useCallback(
    (id: string, node: FocusNode) => {
      savedViewport.current = getViewport();
      setExpandedId(id);

      // Normalise the zoom on open. Without this, someone who had zoomed out reads the
      // detail at whatever scale they left the canvas on - and this is the one moment
      // the text actually has to be legible.
      setCenter(node.x + FOCUS_EXPANDED.width / 2, node.y + FOCUS_EXPANDED.height / 2, {
        zoom: 1,
        duration: reduceMotion ? 0 : 240,
      });
    },
    [getViewport, setCenter, reduceMotion]
  );

  // -- Flow elements --------------------------------------------------
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
        // Manual z, so the open card sits above the lines and its neighbours.
        zIndex: expanded ? 10 : 1,
        selected: expanded,
        data: data as unknown as Record<string, unknown>,
        ariaRole: 'button',
        ariaLabel: `${node.label}. ${node.prereq_count} prerequisites, ${node.dependent_count} dependents.`,
        className:
          'rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2',
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
        // Related links are not directional - an arrowhead would claim an order the
        // data does not assert.
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

  /**
   * Re-frame on the centred concept - at zoom 1, deliberately NOT fit-to-view.
   *
   * Fitting looks tidier and is wrong here. A concept with eleven dependents makes the
   * neighbourhood about 1,850px tall (measured on Science Grade 6), which fit-to-view
   * resolves by dropping to roughly 0.3 zoom - cards 61px wide with 4px labels. That is
   * the exact failure this redesign exists to remove, reintroduced by a convenience.
   *
   * Centring at 1:1 keeps every card readable and puts the concept you asked about
   * under the cursor; a tall column is reached by scrolling, and the card's own
   * "11 after" chip says there is more than the viewport shows. The fit-to-view button
   * in the controls is still there for anyone who does want the overview.
   */
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
    // `layout` is intentionally out of the deps: it changes on every filter toggle and
    // on every expand, and re-centring the canvas because someone hid suggestions would
    // yank the view out from under them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId, setCenter, reduceMotion]);

  /**
   * The hovered card and everything one edge from it.
   *
   * Keyed on the layout rather than rebuilt per frame, and deliberately NOT written
   * into node data: putting it there would replace every node object in the xyflow
   * store on each mouseenter. Through context, only the handful of cards and edges
   * whose appearance actually changes re-render.
   */
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

  // -- States ---------------------------------------------------------
  if (loading) {
    return (
      <Shell title={title} onClose={onClose}>
        <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 size={26} className="animate-spin motion-reduce:animate-none" aria-hidden />
          <p className="text-sm">Building the coherence map...</p>
        </div>
      </Shell>
    );
  }

  if (error || !map) {
    return (
      <Shell title={title} onClose={onClose}>
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <AlertTriangle size={26} className="text-amber-500" aria-hidden />
          <p className="max-w-md text-sm text-slate-700">
            {error ?? 'The coherence map could not be loaded.'}
          </p>
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
    // Two situations land here and look identical on screen: the subject has no
    // curriculum at all, or it has one under a different academic year than the app is
    // pointed at. Only the server knows which, so it says - and when a year does have
    // curriculum, the teacher can open it from here rather than going to find the
    // academic-year selector, which lives on another screen entirely.
    const years = map.meta.available_syears ?? [];

    return (
      <Shell title={title} onClose={onClose}>
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
          <Network size={26} className="text-slate-400" aria-hidden />

          {years.length === 0 ? (
            <>
              <p className="text-sm font-medium text-slate-800">No curriculum to map yet</p>
              <p className="max-w-md text-sm text-slate-600">
                Add chapters and concepts to this subject and they will appear here automatically.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-800">
                Nothing to map for {map.meta.syear ?? 'the selected year'}
              </p>
              <p className="max-w-md text-sm text-slate-600">
                This subject has curriculum for {years.join(', ')}. The academic year in use is{' '}
                {map.meta.syear ?? 'not set'}, which has no chapters for it.
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => viewYear(year)}
                    className="rounded-lg bg-[#4f46e5] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#4338ca] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2"
                  >
                    Show {year}
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
  const crumbs = active ? crumbsFor(active, rootNode, () => setRootId(null)) : [];

  return (
    <Shell
      title={title}
      onClose={onClose}
      crumbs={
        rootId ? (
          <FocusBreadcrumb crumbs={crumbs} onBack={goBack} canGoBack={rootStack.length > 0} />
        ) : null
      }
    >
      <MapInteractionContext.Provider value={interaction}>
        <div className="flex h-full min-h-0 flex-col">
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
              {notice.tone === 'ok' ? (
                <Check size={14} aria-hidden />
              ) : (
                <AlertTriangle size={14} aria-hidden />
              )}
              {notice.text}
            </div>
          )}

          {!rootId ? (
            <ConceptDeck
              map={map}
              onPick={(id) => {
                setRootId(id);
                setExpandedId(id);
              }}
            />
          ) : (
            <div className="relative min-h-0 flex-1">
              {walking && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70">
                  <span className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-600 shadow-sm">
                    <Loader2
                      size={14}
                      className="animate-spin motion-reduce:animate-none"
                      aria-hidden
                    />
                    Opening that grade&apos;s map...
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
                // 0.05 is what allowed the old canvas to render as a smear. The focus
                // map is 1360px wide and fits the shell at zoom 1, so nothing below a
                // quarter scale is ever a useful view of it.
                minZoom={0.25}
                maxZoom={1.4}
                nodesDraggable={false}
                nodesConnectable
                zIndexMode="manual"
                nodeClickDistance={4}
                className="bg-slate-50"
              >
                {/* Flat dots, no gradient or blur - the DS forbids both. */}
                <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#cbd5e1" />
                <Controls showInteractive={false} className="!shadow-sm" />
              </ReactFlow>
            </div>
          )}

          <Legend
            stats={active?.stats ?? map.stats}
            filters={filters}
            onToggle={(key) => setFilters((current) => ({ ...current, [key]: !current[key] }))}
            showFilters={rootId !== null}
          />
        </div>
      </MapInteractionContext.Provider>
    </Shell>
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
    <div className="flex h-[calc(100vh-180px)] min-h-[560px] flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef2ff] text-[#4f46e5]">
            <Network size={16} strokeWidth={1.9} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-slate-900">Coherence map</h2>
            <p className="truncate text-[12.5px] text-slate-500">{title}</p>
          </div>
        </div>

        {/* The trail takes the centre of the header, where the stats used to sit. They
            moved to the legend strip: a count of concepts is a footnote, and it was
            competing with the one control that says where you are. */}
        <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">{crumbs}</div>

        <button
          type="button"
          onClick={onClose}
          className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-2"
          aria-label="Close the coherence map"
        >
          <X size={15} strokeWidth={2} />
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
  showFilters,
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
  showFilters: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-200 bg-white px-4 py-2 text-[11.5px] text-slate-600">
      <LegendKey colour="#4f46e5" label="Prerequisite - approved" />
      <LegendKey colour="#d97706" dashed label="Prerequisite - suggested, not yet approved" />
      <LegendKey colour="#0d9488" dashed label="Related across subjects" />
      <LegendKey colour="#b45309" dashed label="Loop - points backwards" />

      {showFilters && (
        <span className="flex items-center gap-1.5">
          <FilterToggle
            pressed={filters.includeSuggested}
            onClick={() => onToggle('includeSuggested')}
            label="Suggestions"
          />
          <FilterToggle
            pressed={filters.includeRelated}
            onClick={() => onToggle('includeRelated')}
            label="Related"
          />
        </span>
      )}

      <span className="ml-auto flex items-center gap-3 tabular-nums text-slate-500">
        <span>{stats.concepts} concepts</span>
        <span>{stats.approved} approved</span>
        <span>{stats.draft} suggested</span>
        {!stats.acyclic && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">
            {stats.cycle_nodes.length} in a loop
          </span>
        )}
      </span>
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
        'rounded border px-1.5 py-0.5 text-[11px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:ring-offset-1',
        pressed
          ? 'border-[#c7d2fe] bg-[#eef2ff] text-[#4338ca]'
          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function LegendKey({ colour, dashed, label }: { colour: string; dashed?: boolean; label: string }) {
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
