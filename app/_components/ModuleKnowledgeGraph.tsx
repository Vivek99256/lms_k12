'use client';

/**
 * The Decentralized Knowledge Graph — one module's own scoped view onto the
 * shared Neo4j knowledge graph, reached from that module's "Knowledge Graph" tool-strip tab.
 *
 * Automatically resolves the module's real submodules from Neo4j (via GraphModuleBrowser /
 * `erp-modules` and `erp-submodules`), loads actual nodes and relationships on mount,
 * and renders via GraphBubbleCanvas matching the master design of
 * `CentralizedKnowledgeGraphExplorer.tsx` and `org-knowledge-graph.tsx`.
 *
 * Features:
 * - Glowing force-simulation orbs with initials, category colors, and relationship labels
 * - Real Neo4j nodes & relationships loaded automatically on mount for every submodule
 * - Honest "Graph data not mapped" state for unmapped submodules (never fake data)
 * - Click-to-expand node clusters radiating from clicked entity
 * - Safe Expand All & Collapse All
 * - In-canvas search ("Find on this canvas…")
 * - Category filter drawer with counts at bottom-left ("Categories N")
 * - Node selection & right docked details panel with attributes & connected relationships
 * - Light Theme by default with full Light / Dark theme toggle
 * - Fullscreen support
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  FolderTree,
  Info,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  Moon,
  Network,
  RotateCcw,
  Search,
  ServerCrash,
  Sun,
  X,
} from 'lucide-react';

import {
  fetchErpSubmoduleGraph,
  fetchGraphNodeDetail,
  listErpModules,
  listErpSubmodules,
  searchKnowledgeGraph,
} from '@/lib/intelligence/client';
import { expandGraphNode, fetchModuleViews, fetchOntologyView, type OntologyViewSummary } from '@/lib/intelligence/workspace';
import type { ErpModule, ErpSubmodule } from '@/lib/intelligence/types';

import GraphBreadcrumbHeader from './graph/GraphBreadcrumbHeader';
import GraphBubbleCanvas from './graph/GraphBubbleCanvas';
import GraphDetailPanel from './graph/GraphDetailPanel';
import GraphSyncStatus from './graph/GraphSyncStatus';
import { readGraphSession } from './graph/graph-session';
import {
  buildHopsFromNodeDetail,
  mapErpSubmoduleGraph,
  mapGraphNodeDetail,
  mapOntologyViewResult,
} from './graph/graph-query-mapper';
import type { KgEdgeInput, KgHop, KgNodeInput } from './graph/graph-model';

type GraphState = 'loading' | 'ready' | 'not-mapped' | 'error';
type ThemeMode = 'light' | 'dark';

const RELATIONSHIP_LIMIT = 25;
const GROUP_EXPAND_LIMIT = 50;

export interface ModuleKnowledgeGraphProps {
  moduleName: string;
  label: string;
  moduleId?: number;
}

interface ScopedSubmodule extends ErpSubmodule {
  parentModuleId: number;
  parentModuleLabel: string;
}

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Merges lists of objects with unique `id` fields into a single list preserving uniqueness. */
function mergeById<T extends { id: string }>(...lists: (T[] | undefined)[]): T[] {
  const merged = new Map<string, T>();
  for (const list of lists) {
    if (!list) continue;
    for (const item of list) merged.set(item.id, item);
  }
  return Array.from(merged.values());
}

/** One relationship-group's identity: which node it hangs off, which relation, which direction. */
function groupKey(nodeId: string, relation: string, direction: string): string {
  return `${nodeId}::${relation}::${direction}`;
}

/**
 * Groups a node-detail fetch's own nodes/edges by relation+direction for progressive expansion.
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

export function ModuleKnowledgeGraph({ moduleName, label, moduleId }: ModuleKnowledgeGraphProps) {
  const session = useMemo(() => readGraphSession(), []);
  const route = `/modules/${moduleName}/knowledge-graph`;

  // UI Theme state - default is LIGHT theme
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Submodules & views state
  const [allSubmodules, setAllSubmodules] = useState<ScopedSubmodule[]>([]);
  const [relevantSubmodules, setRelevantSubmodules] = useState<ScopedSubmodule[]>([]);
  const [selectedSubmodule, setSelectedSubmodule] = useState<ScopedSubmodule | null>(null);
  const [views, setViews] = useState<OntologyViewSummary[]>([]);
  const [selectedView, setSelectedView] = useState<OntologyViewSummary | null>(null);
  const [submoduleFilter, setSubmoduleFilter] = useState('');

  // Graph state
  const [graphState, setGraphState] = useState<GraphState>('loading');
  const [graphError, setGraphError] = useState('');

  // Progressive expansion state
  const [baseRoots, setBaseRoots] = useState<{ nodes: KgNodeInput[]; edges: KgEdgeInput[] }>({ nodes: [], edges: [] });
  const [rootNodes, setRootNodes] = useState<KgNodeInput[]>([]);
  const [rootEdges, setRootEdges] = useState<KgEdgeInput[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Map<string, { nodes: KgNodeInput[]; edges: KgEdgeInput[] }>>(
    new Map()
  );

  // Selection & Details panel state
  const [selectedNode, setSelectedNode] = useState<KgNodeInput | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<KgEdgeInput | null>(null);
  const [nodeDetailNodes, setNodeDetailNodes] = useState<KgNodeInput[]>([]);
  const [nodeDetailEdges, setNodeDetailEdges] = useState<KgEdgeInput[]>([]);
  const [nodeDetailSkip, setNodeDetailSkip] = useState(0);
  const [nodeDetailHasMore, setNodeDetailHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Probing & group cache
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);
  const [isExpandingAll, setIsExpandingAll] = useState(false);
  const [nodeTotals, setNodeTotals] = useState<Map<string, number>>(new Map());
  const nodeGroupsCache = useRef<
    Map<string, Map<string, { relation: string; direction: 'outgoing' | 'incoming'; nodes: KgNodeInput[]; edges: KgEdgeInput[] }>>
  >(new Map());

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  /** Resets everything to a fresh base sample */
  const applyBase = (nodes: KgNodeInput[] = [], edges: KgEdgeInput[] = []) => {
    const safeNodes = Array.isArray(nodes) ? nodes : [];
    const safeEdges = Array.isArray(edges) ? edges : [];
    setBaseRoots({ nodes: safeNodes, edges: safeEdges });
    setRootNodes(safeNodes);
    setRootEdges(safeEdges);
    setExpandedGroups(new Map());
    setNodeTotals(new Map());
    nodeGroupsCache.current = new Map();
    setSelectedNode(null);
    setSelectedEdge(null);
    setNodeDetailNodes([]);
    setNodeDetailEdges([]);
    setNodeDetailSkip(0);
    setNodeDetailHasMore(false);
  };

  // 1. Initial Load: Fetch ERP modules, submodules, and ontology views
  useEffect(() => {
    let cancelled = false;
    setGraphState('loading');
    setGraphError('');

    async function initModule() {
      try {
        // Load ontology views for this module (e.g. Student / Fees)
        let loadedViews: OntologyViewSummary[] = [];
        try {
          const viewsPayload = await fetchModuleViews(session, { route, module: moduleName });
          if (Array.isArray(viewsPayload?.views)) {
            loadedViews = viewsPayload.views;
          }
        } catch {
          // Gracefully continue if ontology views are unseeded
        }

        if (cancelled) return;
        setViews(loadedViews);

        // Fetch ERP modules to find the corresponding module
        const modulesPayload = await listErpModules(session);
        const erpModules: ErpModule[] = Array.isArray(modulesPayload?.modules) ? modulesPayload.modules : [];

        const normSlug = normalizeKey(moduleName);
        const normLabel = normalizeKey(label);

        let matchedModule = moduleId ? erpModules.find((m) => m.id === moduleId) : null;
        if (!matchedModule) {
          matchedModule = erpModules.find((m) => {
            const mNorm = normalizeKey(m.label);
            return mNorm === normSlug || mNorm === normLabel || mNorm.includes(normSlug) || normSlug.includes(mNorm);
          }) || null;
        }

        let moduleScoped: ScopedSubmodule[] = [];

        if (matchedModule) {
          try {
            const res = await listErpSubmodules(session, matchedModule.id);
            const subs: ErpSubmodule[] = Array.isArray(res?.submodules) ? res.submodules : [];
            moduleScoped = subs.map((s) => ({
              ...s,
              parentModuleId: matchedModule!.id,
              parentModuleLabel: matchedModule!.label,
            }));
          } catch {
            moduleScoped = [];
          }
        } else {
          // If no single module matched, collect submodules from all modules
          const submodulesLists = await Promise.all(
            erpModules.map(async (mod) => {
              try {
                const res = await listErpSubmodules(session, mod.id);
                const subs: ErpSubmodule[] = Array.isArray(res?.submodules) ? res.submodules : [];
                return subs.map((s) => ({
                  ...s,
                  parentModuleId: mod.id,
                  parentModuleLabel: mod.label,
                }));
              } catch {
                return [];
              }
            })
          );
          moduleScoped = submodulesLists.flat();
        }

        if (cancelled) return;
        setAllSubmodules(moduleScoped);
        setRelevantSubmodules(moduleScoped);

        // Pick initial target: first submodule with mapped=true, or first submodule
        const target = moduleScoped.find((s) => s.mapped) || moduleScoped[0] || null;

        if (target) {
          setSelectedSubmodule(target);
          await loadSubmoduleGraph(target);
        } else if (loadedViews.length > 0) {
          setSelectedView(loadedViews[0]);
          await loadViewGraph(loadedViews[0]);
        } else {
          setGraphState('not-mapped');
        }
      } catch (cause) {
        if (cancelled) return;
        setGraphError(cause instanceof Error ? cause.message : 'Failed to load module knowledge graph.');
        setGraphState('error');
      }
    }

    void initModule();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleName]);

  // 2. Load Graph for a Submodule
  const loadSubmoduleGraph = async (submodule: ScopedSubmodule) => {
    setSelectedSubmodule(submodule);
    setSelectedView(null);
    setGraphState('loading');
    setGraphError('');
    applyBase([], []);

    if (!submodule.mapped || !submodule.labels || submodule.labels.length === 0) {
      setGraphState('not-mapped');
      return;
    }

    try {
      // 1st attempt: Fetch connected submodule subgraph directly from Neo4j
      if (submodule.id) {
        try {
          const result = await fetchErpSubmoduleGraph(session, submodule.id);
          const mapped = mapErpSubmoduleGraph(result);

          if (mapped.nodes.length > 0) {
            applyBase(mapped.nodes, mapped.edges);
            setGraphState('ready');
            return;
          }
        } catch {
          // fall through to search
        }
      }

      // 2nd attempt fallback: Label search for sample nodes
      const searchRes = await searchKnowledgeGraph(session, submodule.labels[0] || '', 18, submodule.labels);
      const searchNodes = Array.isArray(searchRes?.nodes) ? searchRes.nodes : [];

      if (searchNodes.length > 0) {
        applyBase(searchNodes, []);
        setGraphState('ready');
      } else {
        applyBase([], []);
        setGraphState('not-mapped');
      }
    } catch (cause) {
      setGraphError(cause instanceof Error ? cause.message : 'Failed to query graph for this submodule.');
      setGraphState('error');
    }
  };

  // 3. Load Graph for an Ontology View
  const loadViewGraph = async (view: OntologyViewSummary) => {
    setSelectedView(view);
    setGraphState('loading');
    setGraphError('');
    applyBase([], []);

    if (!view.root_entity_key) {
      setGraphState('not-mapped');
      return;
    }

    try {
      const sample = await searchKnowledgeGraph(session, view.root_entity_key, 1, [view.root_entity_key]);
      const rootNode = sample?.nodes?.[0];

      if (!rootNode) {
        setGraphState('not-mapped');
        return;
      }

      const walkResult = await fetchOntologyView(session, view.key, {
        route,
        entity_type: view.root_entity_key,
        entity_id: rootNode.recordId,
      });
      const mapped = mapOntologyViewResult(walkResult);

      if (mapped.nodes.length > 0) {
        applyBase(mapped.nodes, mapped.edges);
        setGraphState('ready');
      } else {
        setGraphState('not-mapped');
      }
    } catch (cause) {
      setGraphError(cause instanceof Error ? cause.message : 'Failed to resolve ontology view graph.');
      setGraphState('error');
    }
  };

  // 4. Load Node Detail & count
  const loadNodeDetail = async (node: KgNodeInput): Promise<{ nodes: KgNodeInput[]; edges: KgEdgeInput[] } | null> => {
    if (node.recordId === null || node.recordId === undefined) return null;
    try {
      const detail = await fetchGraphNodeDetail(session, node.entityKey, node.recordId as string | number, {
        relationshipLimit: RELATIONSHIP_LIMIT,
        skip: 0,
      });
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
      // Fallback: try workspace expandNode
      try {
        const result = await expandGraphNode(session, node.entityKey, node.recordId);
        if (result.node) {
          const newNodes: KgNodeInput[] = [];
          const newEdges: KgEdgeInput[] = [];

          for (const rel of result.relations) {
            for (const item of rel.items) {
              const itemId = `${item.entity}:${item.id}`;
              newNodes.push({
                id: itemId,
                entityKey: item.entity,
                recordId: item.id,
                label: item.label,
                source: (rel.source as 'sql' | 'graph') || 'graph',
                attributes: item.attributes || {},
              });
              newEdges.push({
                id: `${node.id}->${itemId}:${rel.relation}`,
                source: rel.direction === 'outgoing' ? node.id : itemId,
                target: rel.direction === 'outgoing' ? itemId : node.id,
                relation: rel.relation,
                directed: true,
                sourceKind: rel.source || 'graph',
              });
            }
          }
          setNodeDetailNodes(newNodes);
          setNodeDetailEdges(newEdges);
          setNodeTotals((prev) => new Map(prev).set(node.id, newNodes.length));
          return { nodes: newNodes, edges: newEdges };
        }
      } catch {
        // ignore
      }
      return null;
    }
  };

  /** Selection without toggling branches */
  const selectNode = async (node: KgNodeInput | null) => {
    setSelectedEdge(null);
    setSelectedNode(node);
    setNodeDetailNodes([]);
    setNodeDetailEdges([]);
    setNodeDetailSkip(0);
    setNodeDetailHasMore(false);
    if (!node) return;
    await loadNodeDetail(node);
  };

  // 5. Canvas Node Click: Select and toggle open/closed connected relationships
  const handleCanvasNodeClick = async (node: KgNodeInput) => {
    setSelectedEdge(null);
    setSelectedNode(node);

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
      }
    } finally {
      setExpandingNodeId(null);
    }
  };

  // 6. Expand All: Safely expands connected relationships for visible nodes
  const handleExpandAll = async () => {
    if (isExpandingAll || canvasNodes.length === 0) return;
    setIsExpandingAll(true);

    try {
      // 1. Reopen already known groups
      const reopened = new Map(expandedGroups);
      for (const [nodeId, groups] of nodeGroupsCache.current) {
        for (const group of groups.values()) {
          reopened.set(groupKey(nodeId, group.relation, group.direction), { nodes: group.nodes, edges: group.edges });
        }
      }
      setExpandedGroups(reopened);

      // 2. Identify candidate nodes on canvas not yet probed (up to 10 nodes)
      const candidates = canvasNodes
        .filter((n) => n.recordId !== null && n.recordId !== undefined && !nodeGroupsCache.current.has(n.id))
        .slice(0, 10);

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
    } finally {
      setIsExpandingAll(false);
    }
  };

  // 7. Collapse All: Restores initial base graph state
  const handleCollapseAll = () => {
    setExpandedGroups(new Map());
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  // Expand or collapse a single group from the details panel accordion
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
      // ignore
    }
  };

  const isGroupOpen = (hop: KgHop): boolean => {
    if (!selectedNode || !hop.direction) return false;
    return expandedGroups.has(groupKey(selectedNode.id, hop.relation, hop.direction));
  };

  const onToggleGroup = (hop: KgHop) => {
    if (selectedNode) void expandGroup(selectedNode, hop);
  };

  const loadMoreForSelectedNode = async () => {
    if (!selectedNode || selectedNode.recordId === null || selectedNode.recordId === undefined) return;
    setLoadingMore(true);
    try {
      const detail = await fetchGraphNodeDetail(session, selectedNode.entityKey, selectedNode.recordId as string | number, {
        relationshipLimit: RELATIONSHIP_LIMIT,
        skip: nodeDetailSkip,
      });
      const mapped = mapGraphNodeDetail(detail);
      setNodeDetailNodes((prev) => mergeById(prev, mapped.nodes));
      setNodeDetailEdges((prev) => mergeById(prev, mapped.edges));
      setNodeDetailHasMore(mapped.hasMore);
      setNodeDetailSkip((prev) => prev + RELATIONSHIP_LIMIT);
    } finally {
      setLoadingMore(false);
    }
  };

  // Derived canvas content
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

  const isDark = theme === 'dark';

  return (
    <div
      className={`relative flex flex-col overflow-hidden transition-colors duration-200 ${isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'h-[750px] w-full rounded-xl border'
        } ${isDark ? 'border-slate-800 bg-[#0a0e1a] text-slate-100' : 'border-slate-200 bg-white text-slate-800 shadow-sm'}`}
    >
      {/* Top Bar / Header */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 transition-colors ${isDark ? 'border-slate-800 bg-[#0d1424]' : 'border-slate-200 bg-slate-50/80'
          }`}
      >
        <div className="flex items-center gap-3">
          <GraphBreadcrumbHeader
            crumbs={[
              { label: 'MODULE', value: label },
              { label: 'SUBMODULE', value: selectedSubmodule?.label || selectedView?.label || 'Overview' },
            ]}
            dark={isDark}
          />
          <GraphSyncStatus />
        </div>

        {/* Action Controls: Submodule Selector & Controls */}
        <div className="flex items-center gap-2">
          {relevantSubmodules.length > 0 && (
            <div className="relative inline-block">
              <select
                aria-label="Select submodule"
                value={selectedSubmodule?.id ?? ''}
                onChange={(e) => {
                  const subId = Number(e.target.value);
                  const sub = relevantSubmodules.find((s) => s.id === subId);
                  if (sub) void loadSubmoduleGraph(sub);
                }}
                className={`h-8 rounded-md border px-2.5 pr-8 text-xs font-medium transition-colors ${isDark
                    ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-750'
                    : 'border-slate-300 bg-white text-slate-750 hover:bg-slate-50'
                  }`}
              >
                {relevantSubmodules.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.label} {sub.mapped ? '✓' : '(unmapped)'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className={`flex h-8 w-8 items-center justify-center rounded-md border text-xs font-medium transition-colors ${isDark
                ? 'border-slate-700 bg-slate-800 text-amber-400 hover:bg-slate-700'
                : 'border-slate-300 bg-white text-slate-650 hover:bg-slate-100 hover:text-slate-900'
              }`}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
            className={`flex h-8 w-8 items-center justify-center rounded-md border text-xs font-medium transition-colors ${isDark
                ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'border-slate-300 bg-white text-slate-650 hover:bg-slate-100'
              }`}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Canvas + Left Sidebar + Right Drawer */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Left Submodules / Views Rail */}
        <aside
          className={`hidden w-60 shrink-0 border-r md:flex md:flex-col transition-colors ${isDark ? 'border-slate-800 bg-[#0d1424]' : 'border-slate-200 bg-slate-50'
            }`}
        >
          <div className="p-2 border-b border-inherit">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter submodules…"
                value={submoduleFilter}
                onChange={(e) => setSubmoduleFilter(e.target.value)}
                className={`w-full rounded-md border py-1 pl-8 pr-2 text-xs transition-colors ${isDark
                    ? 'border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500'
                    : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400'
                  }`}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {relevantSubmodules
              .filter((s) => !submoduleFilter || s.label.toLowerCase().includes(submoduleFilter.toLowerCase()))
              .map((sub) => {
                const isSelected = selectedSubmodule?.id === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => void loadSubmoduleGraph(sub)}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${isSelected
                        ? isDark
                          ? 'bg-blue-600/20 font-medium text-blue-400 border border-blue-500/30'
                          : 'bg-blue-50 font-medium text-blue-700 border border-blue-200'
                        : isDark
                          ? 'text-slate-300 hover:bg-slate-800/60'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                  >
                    <span className="truncate">{sub.label}</span>
                    {sub.mapped && (
                      <span
                        className={`ml-1.5 rounded px-1.5 py-0.2 text-[10px] font-semibold ${isDark
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                      >
                        Mapped
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </aside>

        {/* Graph Canvas Container */}
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {graphState === 'loading' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Loading knowledge graph for {selectedSubmodule?.label || label}…
              </p>
            </div>
          )}

          {graphState === 'error' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <ServerCrash className="h-8 w-8 text-rose-500" />
              <p className="text-sm font-semibold text-rose-500">Failed to load graph</p>
              <p className={`max-w-md text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{graphError}</p>
            </div>
          )}

          {graphState === 'not-mapped' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-800 bg-slate-900/60 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-400'
                  }`}
              >
                <Network className="h-7 w-7" />
              </div>
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Graph data not mapped</p>
              <p className={`max-w-md text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {selectedSubmodule
                  ? `Submodule "${selectedSubmodule.label}" does not have Neo4j entity relationships mapped yet.`
                  : `Module "${label}" does not currently have active graph nodes in Neo4j.`}
              </p>
            </div>
          )}

          {graphState === 'ready' && (
            <div className="relative h-full w-full">
              <GraphBubbleCanvas
                nodes={canvasNodes}
                edges={canvasEdges}
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
                onCollapseAll={handleCollapseAll}
                isFullscreen={isFullscreen}
                onToggleFullscreen={toggleFullscreen}
                mode={theme}
                onToggleMode={setTheme}
                heightClassName="h-full"
              />
            </div>
          )}
        </main>

        {/* Right Details Panel */}
        {(selectedNode || selectedEdge) && (
          <aside
            className={`w-80 shrink-0 border-l p-3 transition-colors ${isDark ? 'border-slate-800 bg-[#0a1230]' : 'border-slate-200 bg-white'
              }`}
          >
            <GraphDetailPanel
              variant={isDark ? 'docked' : 'docked-light'}
              node={selectedNode}
              edge={selectedEdge}
              edgeSourceLabel={selectedEdge ? nodesById.get(selectedEdge.source)?.label : undefined}
              edgeTargetLabel={selectedEdge ? nodesById.get(selectedEdge.target)?.label : undefined}
              hops={hops}
              onClose={() => {
                setSelectedNode(null);
                setSelectedEdge(null);
              }}
              onItemClick={(_entity, id) => {
                const match = canvasNodes.find((n) => String(n.recordId) === String(id));
                if (match) void selectNode(match);
              }}
              onLoadMore={loadMoreForSelectedNode}
              loadingMore={loadingMore}
              hasMore={nodeDetailHasMore}
              isGroupOpen={isGroupOpen}
              onToggleGroup={onToggleGroup}
              onExpand={() => {
                if (selectedNode) void handleCanvasNodeClick(selectedNode);
              }}
              expanding={expandingNodeId !== null}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

export default ModuleKnowledgeGraph;
