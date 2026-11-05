'use client';

/**
 * The Decentralized Knowledge Graph — one module's own scoped view onto the
 * shared Neo4j knowledge graph, reached from that module's "Knowledge Graph" tool-strip tab.
 *
 * Automatically resolves the module's real submodules from Neo4j (via GraphModuleBrowser /
 * `erp-modules` and `erp-submodules`), loads actual nodes and relationships on mount,
 * and renders via React Flow (`GraphCanvas` browser variant) matching the master design of
 * `CentralizedKnowledgeGraphExplorer.tsx`.
 *
 * Features:
 * - Real Neo4j nodes & relationships loaded automatically on mount for the active module
 * - No manual searching required to see the initial graph
 * - Honest "Graph data not mapped" state for unmapped submodules (never fake data)
 * - Node selection & right docked details panel with attributes & connected relationships
 * - Progressive node expansion
 * - Expand All (safely expands connected relationships for visible nodes)
 * - Collapse All (restores initial graph state)
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
import GraphCanvas from './graph/GraphCanvas';
import GraphDetailPanel from './graph/GraphDetailPanel';
import GraphSyncStatus from './graph/GraphSyncStatus';
import TypeLegend from './graph/TypeLegend';
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

export interface ModuleKnowledgeGraphProps {
  moduleName: string;
  label: string;
}

interface ScopedSubmodule extends ErpSubmodule {
  parentModuleId: number;
  parentModuleLabel: string;
}

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Maps a moduleName slug or label to known matching keywords/labels in ERP submodules
 */
function isSubmoduleMatch(submoduleLabel: string, moduleName: string, moduleLabel: string): boolean {
  const normSub = normalizeKey(submoduleLabel);
  const normSlug = normalizeKey(moduleName);
  const normLabel = normalizeKey(moduleLabel);

  if (normSub === normSlug || normSub === normLabel) return true;
  if (normSub.includes(normSlug) || normSlug.includes(normSub)) return true;
  if (normSub.includes(normLabel) || normLabel.includes(normSub)) return true;

  const ALIAS_MAP: Record<string, string[]> = {
    student: ['student', 'studetail', 'studentmanagement', 'admission'],
    admission: ['admission', 'student', 'admissions'],
    admissions: ['admission', 'student', 'admissions'],
    fees: ['fee', 'fees', 'feescollection', 'receipt'],
    fee: ['fee', 'fees', 'feescollection'],
    attendance: ['attendance', 'studentattendance', 'staffattendance'],
    hostel: ['hostel', 'hostelbuilding', 'hostelroom'],
    transport: ['transport', 'transportation', 'route', 'vehicle'],
    transportation: ['transport', 'transportation', 'route', 'vehicle'],
    library: ['library', 'book', 'bookcopy'],
    exam: ['exam', 'examination', 'assesment', 'assessment', 'result', 'grade'],
    examination: ['exam', 'examination', 'assesment', 'assessment'],
    'exam-assessment': ['exam', 'assesment', 'assessment'],
    lms: ['pal', 'teachlearn', 'lms', 'curriculum', 'engagement', 'standard', 'subject'],
    'teach-learn': ['teachlearn', 'pal', 'lms', 'curriculum'],
    'new-pal': ['pal', 'teachlearn', 'lms'],
    pal: ['pal', 'teachlearn', 'lms'],
    user: ['user', 'users', 'staff', 'role', 'hrms'],
    users: ['user', 'users', 'staff', 'role', 'hrms'],
    hrms: ['staff', 'department', 'role', 'users', 'user', 'hrit'],
    inventory: ['inventory', 'inventoryitem', 'itemcategory'],
    ptm: ['ptm', 'ptmbooking'],
    circular: ['circular', 'announcement'],
    sqaa: ['sqaa', 'sqaastandard'],
    'petty-cash': ['pettycash', 'pettycashhead'],
    'visitor-management': ['visitor', 'visitormanagement'],
    consent: ['consent'],
    complaint: ['complaint'],
    'front-desk': ['frontdesk', 'frontdeskentry'],
    'document-templates': ['documenttemplates', 'templates', 'certificate'],
    'inward-outward': ['inward', 'outward', 'inwardoutward', 'inwarddocument'],
    inward_outward: ['inward', 'outward', 'inwardoutward', 'inwarddocument'],
    'mobile-apps': ['mobileapps', 'mobile'],
    alumni: ['alumni', 'alumnimanagement'],
    timetable: ['timetable', 'timeslot'],
    'platform-services': ['platformservices'],
    'organization-management': ['organization', 'institute', 'department', 'role', 'staff'],
    organization: ['organization', 'institute', 'department', 'role', 'staff'],
  };

  const aliases = ALIAS_MAP[moduleName.toLowerCase()] || [];
  return aliases.some((alias) => normSub.includes(alias) || alias.includes(normSub));
}

export function ModuleKnowledgeGraph({ moduleName, label }: ModuleKnowledgeGraphProps) {
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
  const [baseGraph, setBaseGraph] = useState<{ nodes: KgNodeInput[]; edges: KgEdgeInput[] }>({ nodes: [], edges: [] });
  const [canvasNodes, setCanvasNodes] = useState<KgNodeInput[]>([]);
  const [canvasEdges, setCanvasEdges] = useState<KgEdgeInput[]>([]);

  // Selection & Details panel
  const [selectedNode, setSelectedNode] = useState<KgNodeInput | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<KgEdgeInput | null>(null);
  const [hops, setHops] = useState<KgHop[]>([]);
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);
  const [isExpandingAll, setIsExpandingAll] = useState(false);
  const [loadingNodeDetail, setLoadingNodeDetail] = useState(false);

  // Node cache for quick lookups
  const nodesById = useMemo(() => new Map(canvasNodes.map((n) => [n.id, n])), [canvasNodes]);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
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

        // Fetch ERP modules to find all submodules
        const modulesPayload = await listErpModules(session);
        const erpModules: ErpModule[] = Array.isArray(modulesPayload?.modules) ? modulesPayload.modules : [];

        // Fetch submodules for every module in parallel
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

        if (cancelled) return;
        const flatSubmodules = submodulesLists.flat();
        setAllSubmodules(flatSubmodules);

        // Find submodules matching the current moduleName / label
        const directMatches = flatSubmodules.filter((s) => isSubmoduleMatch(s.label, moduleName, label));

        let moduleScoped: ScopedSubmodule[] = [];
        if (directMatches.length > 0) {
          // Collect matches and their sibling submodules in the same parent module
          const parentModuleIds = new Set(directMatches.map((m) => m.parentModuleId));
          moduleScoped = flatSubmodules.filter((s) => parentModuleIds.has(s.parentModuleId));
          // Put direct matches at the top
          moduleScoped.sort((a, b) => {
            const aMatch = isSubmoduleMatch(a.label, moduleName, label) ? 1 : 0;
            const bMatch = isSubmoduleMatch(b.label, moduleName, label) ? 1 : 0;
            return bMatch - aMatch;
          });
        } else {
          // Fallback: show all submodules
          moduleScoped = flatSubmodules;
        }

        setRelevantSubmodules(moduleScoped);

        // Pick initial target: first direct match with mapped=true, or first mapped in scoped
        const target =
          directMatches.find((s) => s.mapped) ||
          directMatches[0] ||
          moduleScoped.find((s) => s.mapped) ||
          moduleScoped[0] ||
          null;

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
    setSelectedNode(null);
    setSelectedEdge(null);
    setHops([]);
    setGraphState('loading');
    setGraphError('');

    if (!submodule.mapped || !submodule.labels || submodule.labels.length === 0) {
      setBaseGraph({ nodes: [], edges: [] });
      setCanvasNodes([]);
      setCanvasEdges([]);
      setGraphState('not-mapped');
      return;
    }

    try {
      // 1st attempt: Fetch connected submodule subgraph directly from Neo4j
      const result = await fetchErpSubmoduleGraph(session, submodule.id);
      const mapped = mapErpSubmoduleGraph(result);

      if (mapped.nodes.length > 0) {
        setBaseGraph(mapped);
        setCanvasNodes(mapped.nodes);
        setCanvasEdges(mapped.edges);
        setGraphState('ready');
        return;
      }

      // 2nd attempt fallback: Label search for sample nodes
      const searchRes = await searchKnowledgeGraph(session, submodule.labels[0] || '', 18, submodule.labels);
      const searchNodes = Array.isArray(searchRes?.nodes) ? searchRes.nodes : [];

      if (searchNodes.length > 0) {
        const fallbackGraph = { nodes: searchNodes, edges: [] };
        setBaseGraph(fallbackGraph);
        setCanvasNodes(fallbackGraph.nodes);
        setCanvasEdges([]);
        setGraphState('ready');
      } else {
        setBaseGraph({ nodes: [], edges: [] });
        setCanvasNodes([]);
        setCanvasEdges([]);
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
    setSelectedNode(null);
    setSelectedEdge(null);
    setHops([]);
    setGraphState('loading');
    setGraphError('');

    if (!view.root_entity_key) {
      setBaseGraph({ nodes: [], edges: [] });
      setCanvasNodes([]);
      setCanvasEdges([]);
      setGraphState('not-mapped');
      return;
    }

    try {
      const sample = await searchKnowledgeGraph(session, view.root_entity_key, 1, [view.root_entity_key]);
      const rootNode = sample?.nodes?.[0];

      if (!rootNode) {
        setBaseGraph({ nodes: [], edges: [] });
        setCanvasNodes([]);
        setCanvasEdges([]);
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
        setBaseGraph(mapped);
        setCanvasNodes(mapped.nodes);
        setCanvasEdges(mapped.edges);
        setHops(mapped.hops);
        setGraphState('ready');
      } else {
        setBaseGraph({ nodes: [], edges: [] });
        setCanvasNodes([]);
        setCanvasEdges([]);
        setGraphState('not-mapped');
      }
    } catch (cause) {
      setGraphError(cause instanceof Error ? cause.message : 'Failed to resolve ontology view graph.');
      setGraphState('error');
    }
  };

  // 4. Node Selection & Detail Loading
  const handleNodeSelect = async (node: KgNodeInput | null) => {
    setSelectedNode(node);
    setSelectedEdge(null);

    if (!node || node.recordId === null || node.recordId === undefined) {
      setHops([]);
      return;
    }

    setLoadingNodeDetail(true);
    try {
      const detail = await fetchGraphNodeDetail(session, node.entityKey, node.recordId, {
        relationshipLimit: 25,
      });
      const mapped = mapGraphNodeDetail(detail);
      setHops(buildHopsFromNodeDetail(node.id, mapped.nodes, mapped.edges));
    } catch {
      setHops([]);
    } finally {
      setLoadingNodeDetail(false);
    }
  };

  // 5. Expand individual node
  const handleExpandNode = async (node: KgNodeInput) => {
    if (expandingNodeId || node.recordId === null || node.recordId === undefined) return;
    setExpandingNodeId(node.id);

    try {
      const detail = await fetchGraphNodeDetail(session, node.entityKey, node.recordId, {
        relationshipLimit: 25,
      });
      const mapped = mapGraphNodeDetail(detail);

      // Merge new nodes & edges into canvas
      setCanvasNodes((prev) => {
        const existing = new Set(prev.map((n) => n.id));
        const added = mapped.nodes.filter((n) => !existing.has(n.id));
        return [...prev, ...added];
      });

      setCanvasEdges((prev) => {
        const existing = new Set(prev.map((e) => e.id));
        const added = mapped.edges.filter((e) => !existing.has(e.id));
        return [...prev, ...added];
      });

      setHops(buildHopsFromNodeDetail(node.id, mapped.nodes, mapped.edges));
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

          setCanvasNodes((prev) => {
            const existing = new Set(prev.map((n) => n.id));
            return [...prev, ...newNodes.filter((n) => !existing.has(n.id))];
          });
          setCanvasEdges((prev) => {
            const existing = new Set(prev.map((e) => e.id));
            return [...prev, ...newEdges.filter((e) => !existing.has(e.id))];
          });
        }
      } catch {
        // Silently preserve current canvas if expansion fails
      }
    } finally {
      setExpandingNodeId(null);
    }
  };

  // 6. Expand All: Expand all currently visible nodes (safe batch)
  const handleExpandAll = async () => {
    if (isExpandingAll || canvasNodes.length === 0) return;
    setIsExpandingAll(true);

    try {
      const batch = canvasNodes.slice(0, 10);
      const allNewNodes: KgNodeInput[] = [];
      const allNewEdges: KgEdgeInput[] = [];

      for (const node of batch) {
        if (node.recordId === null || node.recordId === undefined) continue;
        try {
          const detail = await fetchGraphNodeDetail(session, node.entityKey, node.recordId, {
            relationshipLimit: 12,
          });
          const mapped = mapGraphNodeDetail(detail);
          allNewNodes.push(...mapped.nodes);
          allNewEdges.push(...mapped.edges);
        } catch {
          // continue with other nodes
        }
      }

      setCanvasNodes((prevNodes) => {
        const existing = new Set(prevNodes.map((n) => n.id));
        const unique = allNewNodes.filter((n) => !existing.has(n.id));
        return [...prevNodes, ...unique].slice(0, 150);
      });

      setCanvasEdges((prevEdges) => {
        const existing = new Set(prevEdges.map((e) => e.id));
        const unique = allNewEdges.filter((e) => !existing.has(e.id));
        return [...prevEdges, ...unique].slice(0, 300);
      });
    } finally {
      setIsExpandingAll(false);
    }
  };

  // 7. Collapse All: Restores initial base graph state
  const handleCollapseAll = () => {
    setCanvasNodes(baseGraph.nodes);
    setCanvasEdges(baseGraph.edges);
    setSelectedNode(null);
    setSelectedEdge(null);
    setHops([]);
  };

  // Edge Selection
  const handleEdgeSelect = (edge: KgEdgeInput | null) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    setHops([]);
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`relative flex flex-col overflow-hidden transition-colors duration-200 ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'h-[750px] w-full rounded-xl border'
      } ${isDark ? 'border-slate-800 bg-[#0a0e1a] text-slate-100' : 'border-slate-200 bg-white text-slate-800 shadow-sm'}`}
    >
      {/* Top Bar / Header */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 transition-colors ${
          isDark ? 'border-slate-800 bg-[#0d1424]' : 'border-slate-200 bg-slate-50/80'
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

        {/* Action Controls: Submodule Selector, Theme Toggle, Expand All, Collapse All, Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Submodule dropdown / view selector */}
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
                className={`h-8 rounded-md border px-2.5 pr-8 text-xs font-medium transition-colors ${
                  isDark
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

          {/* Clear Focus Button */}
          {(selectedNode || selectedEdge) && (
            <button
              type="button"
              onClick={() => {
                setSelectedNode(null);
                setSelectedEdge(null);
                setHops([]);
              }}
              title="Clear focus and restore normal graph appearance"
              className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors ${
                isDark
                  ? 'border-blue-500/40 bg-blue-900/30 text-blue-300 hover:bg-blue-800/40'
                  : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 shadow-sm'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Clear focus</span>
            </button>
          )}

          {/* Theme Toggle Button (Light by default) */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className={`flex h-8 w-8 items-center justify-center rounded-md border text-xs font-medium transition-colors ${
              isDark
                ? 'border-slate-700 bg-slate-800 text-amber-400 hover:bg-slate-700'
                : 'border-slate-300 bg-white text-slate-650 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Expand All Button */}
          <button
            type="button"
            onClick={() => void handleExpandAll()}
            disabled={isExpandingAll || graphState !== 'ready' || canvasNodes.length === 0}
            className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:opacity-40 ${
              isDark
                ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 shadow-sm'
            }`}
          >
            {isExpandingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
            <span>Expand all</span>
          </button>

          {/* Collapse All Button */}
          <button
            type="button"
            onClick={handleCollapseAll}
            disabled={graphState !== 'ready' || (canvasNodes.length === baseGraph.nodes.length && canvasEdges.length === baseGraph.edges.length)}
            className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:opacity-40 ${
              isDark
                ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 shadow-sm'
            }`}
          >
            <ChevronsDownUp className="h-3.5 w-3.5" />
            <span>Collapse all</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
            className={`flex h-8 w-8 items-center justify-center rounded-md border text-xs font-medium transition-colors ${
              isDark
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
          className={`hidden w-60 shrink-0 border-r md:flex md:flex-col transition-colors ${
            isDark ? 'border-slate-800 bg-[#0d1424]' : 'border-slate-200 bg-slate-50'
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
                className={`w-full rounded-md border py-1 pl-8 pr-2 text-xs transition-colors ${
                  isDark
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
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                      isSelected
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
                        className={`ml-1.5 rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                          isDark ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
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
                className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${
                  isDark ? 'border-slate-800 bg-slate-900/60 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-400'
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
              <GraphCanvas
                variant="browser"
                theme={theme}
                nodes={canvasNodes}
                edges={canvasEdges}
                highlightedIds={selectedNode ? new Set([selectedNode.id]) : undefined}
                selectedNodeId={selectedNode?.id ?? null}
                selectedEdgeId={selectedEdge?.id ?? null}
                onNodeSelect={handleNodeSelect}
                onEdgeSelect={handleEdgeSelect}
                onExpandNode={handleExpandNode}
                onClearFocus={() => {
                  setSelectedNode(null);
                  setSelectedEdge(null);
                  setHops([]);
                }}
                heightClassName="h-full"
              />

              {/* Legend overlay at bottom left */}
              <div className="pointer-events-none absolute bottom-4 left-4 z-10">
                <div className="pointer-events-auto">
                  <TypeLegend
                    variant="category"
                    entityKeys={canvasNodes.map((n) => n.entityKey)}
                    theme={theme}
                  />
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Right Details Panel */}
        {(selectedNode || selectedEdge) && (
          <aside
            className={`w-80 shrink-0 border-l p-3 transition-colors ${
              isDark ? 'border-slate-800 bg-[#0d1424]' : 'border-slate-200 bg-white'
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
                setHops([]);
              }}
              onItemClick={(_entity, id) => {
                const match = canvasNodes.find((n) => String(n.recordId) === String(id));
                if (match) void handleNodeSelect(match);
              }}
              onExpand={() => {
                if (selectedNode) void handleExpandNode(selectedNode);
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
