'use client';

/**
 * The rebuilt Centralized Knowledge Graph: a Gapstogrowth-explorer +
 * Neo4j-Browser-style 3-panel page — left module/submodule tree, centre
 * interactive canvas, right docked detail panel, top toolbar (global
 * search, module jump, node-type/relationship filters) plus a path-finder.
 *
 * Mounted at two existing routes with zero new menu entries:
 *   - `/ai/knowledge-graph` (via `app/ai/_components/KnowledgeGraphExplorer.tsx`,
 *     no `initialFocusModuleKey` — opens on the full module tree).
 *   - `/modules/organization-management/knowledge-graph` (via
 *     `module-category-page.tsx`'s special case, `initialFocusModuleKey=
 *     "organization-management"` — pre-expands/highlights that module on
 *     first load only; every other module stays fully explorable from
 *     here too. Organization Management is the entry point, not a
 *     boundary.
 *
 * Every node, edge, property and relationship on the canvas comes from a
 * real Neo4j query via `GraphModuleBrowser` (search/path/node-detail/
 * organization-staff-graph, plus the existing erp-modules/submodules/graph
 * endpoints) — `tblmenumaster` is used only for the left tree's navigation
 * labels, never to fabricate a graph node. A submodule with no real
 * GraphSchema mapping says so plainly (see the `not-mapped` state below)
 * rather than inventing data.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Maximize, Minimize, Network, ServerCrash, X } from 'lucide-react';

import {
  fetchErpSubmoduleGraph,
  fetchGraphNodeDetail,
  fetchOrganizationStaffGraph,
  listErpModules,
  listErpSubmodules,
  searchKnowledgeGraph,
} from '@/lib/intelligence/client';
import type { ErpModule, GraphPathResult } from '@/lib/intelligence/types';

import GraphBreadcrumbHeader from '@/app/_components/graph/GraphBreadcrumbHeader';
import GraphBubbleCanvas from '@/app/_components/graph/GraphBubbleCanvas';
import GraphDetailPanel from '@/app/_components/graph/GraphDetailPanel';
import GraphModuleTree, {
  ORG_MANAGEMENT_STAFF_SUBMODULE,
  isOrganizationManagement,
  type TreeSubmodule,
} from '@/app/_components/graph/GraphModuleTree';
import GraphPathFinder from '@/app/_components/graph/GraphPathFinder';
import GraphSearchBar from '@/app/_components/graph/GraphSearchBar';
import GraphSyncStatus from '@/app/_components/graph/GraphSyncStatus';
import { readGraphSession } from '@/app/_components/graph/graph-session';
import {
  buildHopsFromNodeDetail,
  mapErpSubmoduleGraph,
  mapGraphNodeDetail,
  mapGraphPathResult,
  mapOrganizationStaffGraph,
} from '@/app/_components/graph/graph-query-mapper';
import type { KgEdgeInput, KgHop, KgNodeInput } from '@/app/_components/graph/graph-model';

type GraphState = 'idle' | 'loading' | 'ready' | 'not-mapped' | 'error';
/** How many real sample entities a freshly-selected submodule starts with — shown directly as canvas nodes, nothing pre-expanded. */
const ROOT_SAMPLE_LIMIT = 18;
/** The initial, mixed-relationship fetch a plain node click uses to discover what relationship-groups exist at all. */
const RELATIONSHIP_LIMIT = 20;
/** One relationship-group's own fetch, once the user explicitly expands it. */
const GROUP_EXPAND_LIMIT = 25;

function moduleKeyToLabel(key: string): string {
  return key
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function mergeById<T extends { id: string }>(...lists: T[][]): T[] {
  const merged = new Map<string, T>();
  for (const list of lists) {
    for (const item of list) merged.set(item.id, item);
  }
  return Array.from(merged.values());
}

/** One relationship-group's identity: which node it hangs off, which relation, which direction. */
function groupKey(nodeId: string, relation: string, direction: string): string {
  return `${nodeId}::${relation}::${direction}`;
}

/**
 * Groups a node-detail fetch's own nodes/edges by relation+direction — the
 * same grouping `buildHopsFromNodeDetail` does for the panel's accordion,
 * but keeping the real node/edge objects (not just display items) so each
 * group can be dropped straight into `expandedGroups`, exactly like
 * `expandGroup()` already does for one group at a time.
 */
function groupNodeDetailForExpansion(
  centerId: string,
  nodes: KgNodeInput[],
  edges: KgEdgeInput[]
): Map<string, { relation: string; direction: 'outgoing' | 'incoming'; nodes: KgNodeInput[]; edges: KgEdgeInput[] }> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const groups = new Map<
    string,
    { relation: string; direction: 'outgoing' | 'incoming'; nodes: KgNodeInput[]; edges: KgEdgeInput[] }
  >();

  for (const edge of edges) {
    const outgoing = edge.source === centerId;
    const otherId = outgoing ? edge.target : edge.source;
    const other = byId.get(otherId);
    if (!other) continue;

    const direction = outgoing ? 'outgoing' : 'incoming';
    const key = `${edge.relation}::${direction}`;
    const group = groups.get(key) ?? { relation: edge.relation, direction, nodes: [], edges: [] };
    group.nodes.push(other);
    group.edges.push(edge);
    groups.set(key, group);
  }

  return groups;
}

export default function CentralizedKnowledgeGraphExplorer({
  initialFocusModuleKey,
}: {
  initialFocusModuleKey?: string;
}) {
  const session = useMemo(() => readGraphSession(), []);
  const initialFocusLabel = useMemo(
    () => (initialFocusModuleKey ? moduleKeyToLabel(initialFocusModuleKey) : undefined),
    [initialFocusModuleKey]
  );

  const [modules, setModules] = useState<ErpModule[]>([]);
  const [modulesState, setModulesState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [modulesError, setModulesError] = useState('');

  const [selectedModule, setSelectedModule] = useState<ErpModule | null>(null);
  const [selectedSubmodule, setSelectedSubmodule] = useState<TreeSubmodule | null>(null);

  const [graphState, setGraphState] = useState<GraphState>('idle');
  const [graphError, setGraphError] = useState('');

  // The base layer (a submodule's real sample, or Organization Management's
  // pre-built staff subgraph) and every relationship-group the user has
  // explicitly expanded since. The canvas is *derived* from these two below
  // (canvasNodes/canvasEdges) rather than imperatively mutated — that's what
  // makes collapse and multi-branch expansion correct without special-case
  // bookkeeping: removing one group's entry just removes its contribution,
  // and a node two open groups both reference simply stays.
  const [baseRoots, setBaseRoots] = useState<{ nodes: KgNodeInput[]; edges: KgEdgeInput[] }>({ nodes: [], edges: [] });
  const [rootNodes, setRootNodes] = useState<KgNodeInput[]>([]);
  const [rootEdges, setRootEdges] = useState<KgEdgeInput[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Map<string, { nodes: KgNodeInput[]; edges: KgEdgeInput[] }>>(
    new Map()
  );

  const [selectedNode, setSelectedNode] = useState<KgNodeInput | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<KgEdgeInput | null>(null);
  const [nodeDetailNodes, setNodeDetailNodes] = useState<KgNodeInput[]>([]);
  const [nodeDetailEdges, setNodeDetailEdges] = useState<KgEdgeInput[]>([]);
  const [nodeDetailSkip, setNodeDetailSkip] = useState(0);
  const [nodeDetailHasMore, setNodeDetailHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchResults, setSearchResults] = useState<KgNodeInput[] | null>(null);
  const [pathResult, setPathResult] = useState<GraphPathResult | null>(null);
  const [pathFinderOpen, setPathFinderOpen] = useState(false);
  const [expandNotice, setExpandNotice] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const dark = mode === 'dark';

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      try {
        if (!document.fullscreenElement) {
          void document.documentElement.requestFullscreen?.().catch(() => {});
        }
      } catch {}
    } else {
      setIsFullscreen(false);
      try {
        if (document.fullscreenElement) {
          void document.exitFullscreen?.().catch(() => {});
        }
      } catch {}
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  const [selectedNodeTypes, setSelectedNodeTypes] = useState<Set<string>>(new Set());
  const [selectedRelationshipTypes, setSelectedRelationshipTypes] = useState<Set<string>>(new Set());

  // Which node is currently being probed (drives GraphBubbleCanvas's small
  // loading badge), and the true relationship-count the backend already
  // returns with the *first* nodeDetail fetch — used both for the "+N"/"−"
  // badge and to tell a confirmed leaf (0) from a node never yet clicked
  // (no entry at all), without ever firing a separate count-only query.
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);
  const [nodeTotals, setNodeTotals] = useState<Map<string, number>>(new Map());
  // Every node's own grouped relationships, kept even after the user
  // collapses them (expandedGroups below only tracks what's *currently*
  // open) — "Expand all" reopens from here instead of re-fetching.
  const nodeGroupsCache = useRef<
    Map<string, Map<string, { relation: string; direction: 'outgoing' | 'incoming'; nodes: KgNodeInput[]; edges: KgEdgeInput[] }>>>(
    new Map()
  );

  useEffect(() => {
    let cancelled = false;
    listErpModules(session)
      .then((payload) => {
        if (cancelled) return;
        setModules(payload.modules);
        setModulesState('ready');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setModulesError(cause instanceof Error ? cause.message : 'The request failed.');
        setModulesState('error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetSelection = () => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setNodeDetailNodes([]);
    setNodeDetailEdges([]);
    setNodeDetailSkip(0);
    setNodeDetailHasMore(false);
    setSearchResults(null);
    setPathResult(null);
    setSelectedNodeTypes(new Set());
    setSelectedRelationshipTypes(new Set());
    setExpandNotice('');
  };

  /** A fresh starting point — clears every expanded group and everything learned about nodes so far, since none of it applies to the new sample. */
  const applyBase = (nodes: KgNodeInput[] = [], edges: KgEdgeInput[] = []) => {
    const safeNodes = Array.isArray(nodes) ? nodes : [];
    const safeEdges = Array.isArray(edges) ? edges : [];
    setBaseRoots({ nodes: safeNodes, edges: safeEdges });
    setRootNodes(safeNodes);
    setRootEdges(safeEdges);
    setExpandedGroups(new Map());
    setNodeTotals(new Map());
    nodeGroupsCache.current = new Map();
  };

  /** "Reset" — back to the last base view, collapsing every expansion made since, with no new fetch. */
  const resetView = () => {
    setRootNodes(baseRoots.nodes || []);
    setRootEdges(baseRoots.edges || []);
    setExpandedGroups(new Map());
    setSelectedNode(null);
    setSelectedEdge(null);
    setExpandNotice('');
  };

  const openModule = async (module: ErpModule) => {
    setSelectedModule(module);
    setSelectedSubmodule(null);
    setGraphState('loading');
    setGraphError('');
    resetSelection();
    applyBase([], []);

    try {
      const payload = await listErpSubmodules(session, module.id);
      const isOrg = isOrganizationManagement(module.label);
      const extra = isOrg ? [ORG_MANAGEMENT_STAFF_SUBMODULE] : [];
      const submodules = Array.isArray(payload?.submodules) ? payload.submodules : [];
      const allSubmodules = [...extra, ...submodules];
      const first = allSubmodules.find((s) => s.mapped);
      if (first) {
        await openSubmodule(module, first);
      } else {
        setGraphState('not-mapped');
      }
    } catch (cause) {
      setGraphError(cause instanceof Error ? cause.message : 'The request failed.');
      setGraphState('error');
    }
  };

  const openSubmodule = async (module: ErpModule, submodule: TreeSubmodule) => {
    setSelectedModule(module);
    setSelectedSubmodule(submodule);
    setGraphState('loading');
    setGraphError('');
    resetSelection();
    applyBase([], []);

    try {
      if (submodule.kind === 'organization-staff') {
        const result = await fetchOrganizationStaffGraph(session, { perRole: 25 });
        const mapped = mapOrganizationStaffGraph(result);
        applyBase(mapped.nodes || [], mapped.edges || []);
        setGraphState('ready');
        return;
      }

      const labels = Array.isArray(submodule?.labels) ? submodule.labels : [];

      // 1st attempt: Fetch connected submodule graph directly from Neo4j
      if (submodule.id) {
        try {
          const subGraph = await fetchErpSubmoduleGraph(session, submodule.id);
          const mapped = mapErpSubmoduleGraph(subGraph);
          if (mapped.nodes.length > 0) {
            applyBase(mapped.nodes, mapped.edges);
            setGraphState('ready');
            return;
          }
        } catch {
          // Fall through to search attempt
        }
      }

      if (labels.length === 0) {
        setGraphState('not-mapped');
        return;
      }

      const result = await searchKnowledgeGraph(session, labels[0] || '', ROOT_SAMPLE_LIMIT, labels);
      const safeNodes = Array.isArray(result?.nodes) ? result.nodes : [];
      if (safeNodes.length === 0) {
        setGraphState('not-mapped');
        return;
      }
      applyBase(safeNodes, []);
      setGraphState('ready');
    } catch (cause) {
      setGraphError(cause instanceof Error ? cause.message : 'The request failed.');
      setGraphState('error');
    }
  };

  const jumpToModule = async (moduleId: number) => {
    const module = modules.find((m) => m.id === moduleId);
    if (!module) return;
    await openModule(module);
  };

  const fetchNodeDetailPage = (node: KgNodeInput, skip: number) =>
    fetchGraphNodeDetail(session, node.entityKey, node.recordId as string | number, {
      relationshipLimit: RELATIONSHIP_LIMIT,
      skip,
    });

  /**
   * The one place that fetches a node's first page of relationships and
   * loads it into the detail-panel state, plus records its true total
   * relationship count (`nodeTotals`) — used by every caller below so they
   * all read the exact same real Neo4j data rather than parallel code
   * paths. Returns the mapped nodes/edges on success, or null if the fetch
   * failed (the panel still shows the node's own sampled properties either way).
   */
  const loadNodeDetail = async (node: KgNodeInput): Promise<{ nodes: KgNodeInput[]; edges: KgEdgeInput[] } | null> => {
    if (node.recordId === null || node.recordId === undefined) return null;
    try {
      const detail = await fetchNodeDetailPage(node, 0);
      const mapped = mapGraphNodeDetail(detail);
      setNodeDetailNodes(mapped.nodes);
      setNodeDetailEdges(mapped.edges);
      setNodeDetailHasMore(mapped.hasMore);
      setNodeDetailSkip(RELATIONSHIP_LIMIT);
      setNodeTotals((prev) => new Map(prev).set(node.id, mapped.totalIncoming + mapped.totalOutgoing));
      if (mapped.node) {
        setSelectedNode((prev) =>
          prev && prev.id === node.id ? { ...prev, attributes: mapped.node!.attributes ?? prev.attributes } : prev
        );
      }
      return { nodes: mapped.nodes, edges: mapped.edges };
    } catch {
      return null;
    }
  };

  /**
   * Plain "select, show the panel, don't touch the canvas" — used by global
   * search, the path-finder's picks, and a panel item click (an item inside
   * an already-open hop section is already on the canvas; inspecting it
   * shouldn't also toggle *its own* children open).
   */
  const selectNode = async (node: KgNodeInput | null) => {
    setSelectedEdge(null);
    setSelectedNode(node);
    setNodeDetailNodes([]);
    setNodeDetailEdges([]);
    setNodeDetailSkip(0);
    setNodeDetailHasMore(false);
    setExpandNotice('');

    if (!node) return;
    await loadNodeDetail(node);
  };

  /**
   * The canvas's own click handler — matches `org-knowledge-graph.tsx`'s
   * actual model (the real "Organization Management Knowledge Graph" UI
   * this explorer now shares the look of): a click always selects the node
   * AND toggles open/closed whatever it's connected to. The first click on
   * a node fetches its relationships (the same `nodeDetail` call `selectNode`
   * uses) and, if any exist, opens every group onto the canvas at once
   * (fanned into the same `expandedGroups` map `expandGroup()` writes to
   * one group at a time, so the panel's chevrons show them correctly and
   * each stays independently collapsible). A second click on the same node
   * collapses those groups again without re-fetching. A confirmed leaf
   * (zero relationships, known from `nodeTotals`) just selects — nothing to
   * toggle. Every group this discovers is also cached in `nodeGroupsCache`
   * so "Expand all" can reopen it later without another fetch.
   */
  const handleCanvasNodeClick = async (node: KgNodeInput) => {
    setSelectedEdge(null);
    setSelectedNode(node);
    setExpandNotice('');

    const alreadyOpen = Array.from(expandedGroups.keys()).some((key) => key.startsWith(`${node.id}::`));
    if (alreadyOpen) {
      setExpandedGroups((prev) => {
        const next = new Map(prev);
        for (const key of Array.from(next.keys())) {
          if (key.startsWith(`${node.id}::`)) next.delete(key);
        }
        return next;
      });
      return;
    }

    if (nodeTotals.get(node.id) === 0) {
      setExpandNotice(`No additional relationships found for ${node.label}.`);
      return;
    }

    setNodeDetailNodes([]);
    setNodeDetailEdges([]);
    setNodeDetailSkip(0);
    setNodeDetailHasMore(false);
    setExpandingNodeId(node.id);
    try {
      const result = await loadNodeDetail(node);
      const groups = result ? groupNodeDetailForExpansion(node.id, result.nodes, result.edges) : new Map();
      nodeGroupsCache.current.set(node.id, groups);

      if (groups.size > 0) {
        setExpandedGroups((prev) => {
          const next = new Map(prev);
          for (const group of groups.values()) {
            next.set(groupKey(node.id, group.relation, group.direction), { nodes: group.nodes, edges: group.edges });
          }
          return next;
        });
      } else {
        setExpandNotice(`No additional relationships found for ${node.label}.`);
      }
    } finally {
      setExpandingNodeId(null);
    }
  };

  /**
   * Expand All:
   * 1. Re-opens every node whose children are already cached.
   * 2. Probes unexpanded canvas nodes in a controlled batch (up to 10 nodes, total canvas nodes <= 120).
   * 3. Fetches real connected relationships progressively and renders them on canvas.
   */
  const handleExpandAll = async () => {
    // 1. Reopen already known groups
    const reopened = new Map(expandedGroups);
    for (const [nodeId, groups] of nodeGroupsCache.current) {
      for (const group of groups.values()) {
        reopened.set(groupKey(nodeId, group.relation, group.direction), { nodes: group.nodes, edges: group.edges });
      }
    }
    setExpandedGroups(reopened);

    // 2. Identify candidate nodes on canvas not yet probed
    const candidates = canvasNodes
      .filter((n) => n.recordId !== null && n.recordId !== undefined && !nodeGroupsCache.current.has(n.id))
      .slice(0, 10);

    if (candidates.length === 0) return;

    setExpandNotice(`Expanding connected relationships for ${candidates.length} nodes…`);
    try {
      for (const node of candidates) {
        if (canvasNodes.length > 120) break;
        const result = await loadNodeDetail(node);
        if (result) {
          const groups = groupNodeDetailForExpansion(node.id, result.nodes, result.edges);
          nodeGroupsCache.current.set(node.id, groups);
          setExpandedGroups((prev) => {
            const next = new Map(prev);
            for (const group of groups.values()) {
              next.set(groupKey(node.id, group.relation, group.direction), { nodes: group.nodes, edges: group.edges });
            }
            return next;
          });
        }
      }
      setExpandNotice('Expanded connected relationships.');
      setTimeout(() => setExpandNotice(''), 3000);
    } catch {
      setExpandNotice('Some node expansions failed.');
      setTimeout(() => setExpandNotice(''), 3000);
    }
  };

  /** Collapses every currently-expanded node's children, returning to the starting view. */
  const collapseAllGroups = () => {
    setExpandedGroups(new Map());
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  const loadMoreForSelectedNode = async () => {
    if (!selectedNode || selectedNode.recordId === null || selectedNode.recordId === undefined) return;
    setLoadingMore(true);
    try {
      const detail = await fetchNodeDetailPage(selectedNode, nodeDetailSkip);
      const mapped = mapGraphNodeDetail(detail);
      setNodeDetailNodes((prev) => mergeById(prev, mapped.nodes));
      setNodeDetailEdges((prev) => mergeById(prev, mapped.edges));
      setNodeDetailHasMore(mapped.hasMore);
      setNodeDetailSkip((prev) => prev + RELATIONSHIP_LIMIT);
    } finally {
      setLoadingMore(false);
    }
  };

  /**
   * Expand or collapse exactly one relationship-group of `node` — the
   * progressive explorer's core action. Expanding fetches just that
   * relation+direction (new backend filter on nodeDetail()) and records it;
   * collapsing simply removes the entry, and the derived canvas
   * (canvasNodes/canvasEdges below) recomputes — a node another still-open
   * group also references correctly stays on screen.
   */
  const expandGroup = async (node: KgNodeInput, hop: KgHop) => {
    if (!hop.direction) return;
    const key = groupKey(node.id, hop.relation, hop.direction);

    if (expandedGroups.has(key)) {
      setExpandedGroups((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      return;
    }

    if (node.recordId === null || node.recordId === undefined) return;

    try {
      const detail = await fetchGraphNodeDetail(session, node.entityKey, node.recordId, {
        relationshipLimit: GROUP_EXPAND_LIMIT,
        skip: 0,
        relation: hop.relation,
        direction: hop.direction,
      });
      const mapped = mapGraphNodeDetail(detail);
      setExpandedGroups((prev) => new Map(prev).set(key, { nodes: mapped.nodes, edges: mapped.edges }));
    } catch {
      // Leave the group collapsed — the panel still shows it as available to retry.
    }
  };

  const isGroupOpen = (hop: KgHop): boolean => {
    if (!selectedNode || !hop.direction) return false;
    return expandedGroups.has(groupKey(selectedNode.id, hop.relation, hop.direction));
  };

  const onToggleGroup = (hop: KgHop) => {
    if (selectedNode) void expandGroup(selectedNode, hop);
  };

  /**
   * The one "start somewhere new" action — global search and the
   * path-finder's own picks, which are genuinely unrelated jumps with no
   * path to preserve. Resets the base to just this node (collapsing every
   * expansion) and selects it, but does not pre-expand anything — the user
   * still chooses which of its relationships to reveal, same as any other node.
   */
  const focusOnNode = async (node: KgNodeInput) => {
    setSearchResults(null);
    setSelectedSubmodule(null);
    const current = { ...node, current: true };
    applyBase([current]);
    setGraphState('ready');
    await selectNode(current);
  };

  // The canvas's actual content: the current base layer plus every
  // relationship-group still open, deduped by node/edge id — this is what
  // makes a node two open groups both reference stay put when only one of
  // them is collapsed, with no extra bookkeeping.
  const canvasNodes = useMemo(
    () => mergeById(rootNodes, ...Array.from(expandedGroups.values(), (g) => g.nodes)),
    [rootNodes, expandedGroups]
  );
  const canvasEdges = useMemo(
    () => mergeById(rootEdges, ...Array.from(expandedGroups.values(), (g) => g.edges)),
    [rootEdges, expandedGroups]
  );

  const nodesById = useMemo(() => {
    const map = new Map<string, KgNodeInput>();
    for (const n of canvasNodes) map.set(n.id, n);
    for (const n of nodeDetailNodes) map.set(n.id, n);
    return map;
  }, [canvasNodes, nodeDetailNodes]);

  /** What `GraphBubbleCanvas` needs to draw each node's expand badge: its known total (absent = unprobed) and whether it's currently open. */
  const nodeMeta = useMemo(() => {
    const map = new Map<string, { totalCount: number; open: boolean }>();
    for (const [nodeId, total] of nodeTotals) {
      const open = Array.from(expandedGroups.keys()).some((key) => key.startsWith(`${nodeId}::`));
      map.set(nodeId, { totalCount: total, open });
    }
    return map;
  }, [nodeTotals, expandedGroups]);

  const hops = useMemo(
    () => (selectedNode ? buildHopsFromNodeDetail(selectedNode.id, nodeDetailNodes, nodeDetailEdges) : []),
    [selectedNode, nodeDetailNodes, nodeDetailEdges]
  );

  const nodeTypeOptions = useMemo(() => Array.from(new Set(canvasNodes.map((n) => n.entityKey))).sort(), [canvasNodes]);
  const relationshipTypeOptions = useMemo(
    () => Array.from(new Set(canvasEdges.map((e) => e.relation))).sort(),
    [canvasEdges]
  );

  const filteredNodes = useMemo(
    () => (selectedNodeTypes.size === 0 ? canvasNodes : canvasNodes.filter((n) => selectedNodeTypes.has(n.entityKey))),
    [canvasNodes, selectedNodeTypes]
  );
  const filteredEdges = useMemo(() => {
    const ids = new Set(filteredNodes.map((n) => n.id));
    return canvasEdges.filter(
      (e) => ids.has(e.source) && ids.has(e.target) && (selectedRelationshipTypes.size === 0 || selectedRelationshipTypes.has(e.relation))
    );
  }, [canvasEdges, filteredNodes, selectedRelationshipTypes]);

  const mappedPath = pathResult?.found ? mapGraphPathResult(pathResult) : null;
  const displayedNodes = mappedPath ? mappedPath.nodes : filteredNodes;
  const displayedEdges = mappedPath ? mappedPath.edges : filteredEdges;

  const crumbs = [
    { label: 'Knowledge Graph', value: 'All modules' },
    ...(selectedModule ? [{ label: 'Module', value: selectedModule.label }] : []),
    ...(selectedSubmodule ? [{ label: 'Submodule', value: selectedSubmodule.label }] : []),
  ];

  return (
    <div
      className={
        isFullscreen
          ? `fixed inset-0 z-[9999] flex h-screen w-screen flex-col overflow-hidden shadow-2xl ${
              dark ? 'bg-[#0a1230] text-slate-100' : 'bg-slate-50 text-slate-900'
            }`
          : `flex h-full min-h-[580px] w-full flex-col overflow-hidden rounded-xl border shadow-sm ${
              dark
                ? 'border-white/15 bg-[#0a1230] text-slate-100'
                : 'border-slate-200 bg-slate-50 text-slate-900'
            }`
      }
    >
      <GraphSearchBar
        session={session}
        modules={modules}
        onJumpToModule={jumpToModule}
        onSearchResult={setSearchResults}
        nodeTypeOptions={nodeTypeOptions}
        relationshipTypeOptions={relationshipTypeOptions}
        selectedNodeTypes={selectedNodeTypes}
        onNodeTypesChange={setSelectedNodeTypes}
        selectedRelationshipTypes={selectedRelationshipTypes}
        onRelationshipTypesChange={setSelectedRelationshipTypes}
        dark={dark}
      />

      <div
        className={`flex items-center justify-between gap-3 border-b px-3 py-1.5 transition-colors ${
          dark ? 'border-white/10 bg-[#0a1230]' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <GraphBreadcrumbHeader crumbs={crumbs} dark={dark} />
        <div className="flex shrink-0 items-center gap-2">
          {!isFullscreen && (
            <Link
              href="/ai"
              className={`hidden sm:inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                dark
                  ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
              title="Back to AI & Intelligence"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>AI Console</span>
            </Link>
          )}
          {expandingNodeId && (
            <span className={`flex items-center gap-1.5 text-xs ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
              <Loader2 className="h-3 w-3 animate-spin" /> Expanding {nodesById.get(expandingNodeId)?.label ?? 'node'}…
            </span>
          )}
          <GraphSyncStatus />
          {(expandedGroups.size > 0 || selectedNode || selectedEdge) && graphState === 'ready' && (
            <button
              type="button"
              onClick={resetView}
              title="Collapse every expanded relationship and return to this submodule's starting view"
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                dark
                  ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              Reset graph
            </button>
          )}
          <button
            type="button"
            onClick={() => setPathFinderOpen((v) => !v)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              dark
                ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            {pathFinderOpen ? 'Hide path finder' : 'Path finder'}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              dark
                ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
            title={isFullscreen ? 'Exit full screen' : 'Full screen'}
          >
            {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
            <span>{isFullscreen ? 'Exit full screen' : 'Full screen'}</span>
          </button>
        </div>
      </div>

      {pathFinderOpen && <GraphPathFinder session={session} onResult={setPathResult} />}

      {searchResults && (
        <div
          className={`border-b px-3 py-2 transition-colors ${
            dark ? 'border-white/10 bg-[#0f1b40] text-slate-300' : 'border-slate-200 bg-blue-50/60 text-slate-800'
          }`}
        >
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
            <span className={dark ? 'text-slate-400' : 'text-slate-600'}>
              {searchResults.length} result{searchResults.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => setSearchResults(null)}
              aria-label="Close search results"
              className={dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {searchResults.length === 0 ? (
            <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>No matching nodes.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {searchResults.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => focusOnNode(node)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    dark
                      ? 'border-white/15 bg-white/10 text-slate-200 hover:bg-white/15'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 shadow-sm'
                  }`}
                >
                  {node.label} <span className={dark ? 'text-slate-400' : 'text-slate-500'}>· {node.entityKey}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {pathResult && !pathResult.found && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          No path exists between these two nodes.
        </div>
      )}

      {expandNotice && (
        <div className="flex items-center justify-between border-b border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm text-blue-500 font-medium">
          <span>{expandNotice}</span>
          <button type="button" onClick={() => setExpandNotice('')} aria-label="Dismiss" className="text-blue-500 hover:opacity-75">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className={`w-64 shrink-0 border-r transition-colors ${dark ? 'border-white/10 bg-[#0a1230]' : 'border-slate-200 bg-slate-50'}`}>
          {modulesState === 'loading' && (
            <p className={`flex items-center gap-2 px-3 py-6 text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Loader2 className="h-4 w-4 animate-spin" /> Loading modules…
            </p>
          )}
          {modulesState === 'error' && <p className="px-3 py-6 text-sm text-rose-500">{modulesError}</p>}
          {modulesState === 'ready' && (
            <GraphModuleTree
              session={session}
              modules={modules}
              selectedModuleId={selectedModule?.id ?? null}
              selectedSubmoduleId={selectedSubmodule?.id ?? null}
              initialFocusModuleLabel={initialFocusLabel}
              onSelectModule={openModule}
              onSelectSubmodule={openSubmodule}
              dark={dark}
            />
          )}
        </aside>

        <main className={`flex min-w-0 flex-1 flex-col p-3 transition-colors ${dark ? 'bg-[#0a1230]' : 'bg-slate-100'}`}>
          {graphState === 'idle' && (
            <p className={`flex flex-1 items-center justify-center text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              Pick a submodule on the left to explore its real graph.
            </p>
          )}
          {graphState === 'loading' && (
            <p className={`flex flex-1 items-center justify-center gap-2 text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          )}
          {graphState === 'error' && (
            <div className="flex flex-1 items-center justify-center gap-3 px-6 text-center text-sm text-rose-500">
              <ServerCrash className="h-4 w-4 shrink-0" /> {graphError}
            </div>
          )}
          {graphState === 'not-mapped' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <Network className={`h-8 w-8 ${dark ? 'text-slate-400' : 'text-slate-400'}`} />
              <p className={`text-sm font-medium ${dark ? 'text-slate-200' : 'text-slate-800'}`}>Not mapped to the graph yet</p>
              <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                This submodule has no real GraphSchema label mapping — a data-coverage gap, reported honestly rather than shown with
                invented data.
              </p>
            </div>
          )}
          {graphState === 'ready' && (
            <GraphBubbleCanvas
              nodes={displayedNodes}
              edges={displayedEdges}
              selectedNodeId={selectedNode?.id ?? null}
              selectedEdgeId={selectedEdge?.id ?? null}
              nodeMeta={nodeMeta}
              loadingNodeId={expandingNodeId}
              onNodeClick={handleCanvasNodeClick}
              onEdgeClick={setSelectedEdge}
              onBackgroundClick={() => {
                setSelectedNode(null);
                setSelectedEdge(null);
              }}
              onExpandAll={handleExpandAll}
              onCollapseAll={collapseAllGroups}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              mode={mode}
              onToggleMode={setMode}
              heightClassName="h-full"
            />
          )}
        </main>

        {(selectedNode || selectedEdge) && (
          <div className={`w-80 shrink-0 border-l p-3 transition-colors ${dark ? 'border-white/10 bg-[#0a1230]' : 'border-slate-200 bg-white'}`}>
            <GraphDetailPanel
              variant={dark ? 'docked' : 'docked-light'}
              node={selectedNode}
              edge={selectedEdge}
              edgeSourceLabel={selectedEdge ? nodesById.get(selectedEdge.source)?.label : undefined}
              edgeTargetLabel={selectedEdge ? nodesById.get(selectedEdge.target)?.label : undefined}
              hops={hops}
              onClose={() => {
                setSelectedNode(null);
                setSelectedEdge(null);
              }}
              onItemClick={(entity, id) => {
                const match = Array.from(nodesById.values()).find((n) => n.entityKey === entity && String(n.recordId) === String(id));
                if (match) void selectNode(match);
              }}
              onLoadMore={selectedNode ? loadMoreForSelectedNode : undefined}
              loadingMore={loadingMore}
              hasMore={nodeDetailHasMore}
              isGroupOpen={isGroupOpen}
              onToggleGroup={onToggleGroup}
            />
          </div>
        )}
      </div>
    </div>
  );
}
