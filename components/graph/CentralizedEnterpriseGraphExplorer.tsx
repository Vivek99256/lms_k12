'use client';

/**
 * CentralizedEnterpriseGraphExplorer
 *
 * Implements the exact design, theme, colors, and animation system from Achieve the Core
 * Coherence Map (tools.achievethecore.org/coherence-map/):
 * - Canvas: Slate radial gradient with dot-grid pattern and spring-like node transitions
 * - Focal Layout: Exact 5-column balance (Prereq 2 -> Prereq 1 -> Current Focus -> Unlocks 1 -> Unlocks 2)
 * - Node Cards: 192px x 132px cards with glowing rings, domain badges, status chips, and "Map this entity" footer
 * - Connectors: Rounded smooth step paths, animated dash-flows, lane separation, and hover tracing
 * - Navigation: Floating frosted-glass HUD panels with breadcrumbs, flow banner, and legend
 * - Left Sidebar: Purple hierarchy explorer with modules, submodules, and 3-node entity indicators
 * - Right Panel: Slide-in inspector with SQL provenance, properties, and relationship navigation
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './coherence-graph-theme.css';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Circle,
  Clock,
  Database,
  ExternalLink,
  Filter,
  Layers,
  LayoutGrid,
  Lightbulb,
  ListTree,
  Loader2,
  Maximize2,
  Minimize2,
  Network,
  Pin,
  RefreshCw,
  Route,
  Search,
  Sparkles,
  Table,
  X,
} from 'lucide-react';

import {
  fetchModuleKnowledgeGraph,
  fetchSubmoduleHierarchy,
  expandGraphNode,
  searchGraphNodes,
  findGraphShortestPath,
  fetchModuleGraphStats,
  type GraphNode,
  type GraphEdge,
  type ModuleStatsItem,
  type HierarchyItem,
  type HierarchyResponse,
} from '@/lib/graph/module-graph-client';
import {
  CENTRALIZED_MODULE_REGISTRY,
  getAllModules,
  getSqlTableAndPkForLabel,
  resolveModuleAndSubmodule,
  type ModuleMetadata,
  type SubmoduleMetadata,
} from '@/lib/graph/centralized-module-registry';
import { CoherenceNodeCard, CoherenceBadge, type CoherenceNodeData } from './CoherenceNodeCard';
import { CoherenceEdgeView, type CoherenceEdgePayload } from './CoherenceEdgeView';
import { calculateCoherenceFocalLayout, FOCUS_CARD } from './coherence-layout';

const nodeTypes = { coherenceCard: CoherenceNodeCard };
const edgeTypes = { coherenceEdge: CoherenceEdgeView };

const GRID_DOT = '#CBD5E1';
const FLOATING_CHROME =
  'rounded-2xl border border-slate-200/90 bg-white/95 shadow-[0_4px_20px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.05)] backdrop-blur-md';

function ConceptNodeIcon({ className = 'text-emerald-600' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={`shrink-0 ${className}`}>
      <circle cx="8" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="4" cy="12.5" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12.5" r="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8 5.5V8M8 8L4.5 10.5M8 8L11.5 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface DynamicDrilldownStep {
  stageId: string;
  stageLabel: string;
  item: HierarchyItem;
}

interface CentralizedGraphExplorerProps {
  initialModule?: string;
  initialSubmodule?: string;
  onClose?: () => void;
  fullScreen?: boolean;
}

export function CentralizedEnterpriseGraphExplorer(props: CentralizedGraphExplorerProps) {
  return (
    <ReactFlowProvider>
      <GraphExplorerCanvas {...props} />
    </ReactFlowProvider>
  );
}

function GraphExplorerCanvas({
  initialModule = 'institute-erp',
  initialSubmodule = 'fees',
  onClose,
  fullScreen = false,
}: CentralizedGraphExplorerProps) {
  const reactFlow = useReactFlow();

  // Active module & submodule
  const [selectedModuleKey, setSelectedModuleKey] = useState<string>(initialModule);
  const [selectedSubmoduleKey, setSelectedSubmoduleKey] = useState<string>(initialSubmodule);
  const [expandedSidebarModule, setExpandedSidebarModule] = useState<string | null>(initialModule);

  // Dual View Mode: 'deck' (Hierarchical Drill-Down Explorer) or 'canvas' (5-Column Coherence Map)
  const [viewMode, setViewMode] = useState<'deck' | 'canvas'>('deck');

  // Dynamic hierarchy drill-down state across any ERP module/submodule
  const [hierarchyLoading, setHierarchyLoading] = useState<boolean>(false);
  const [hierarchyResponse, setHierarchyResponse] = useState<HierarchyResponse | null>(null);
  const [drilldownSteps, setDrilldownSteps] = useState<DynamicDrilldownStep[]>([]);
  const [deckSearchQuery, setDeckSearchQuery] = useState<string>('');
  const [deckSearchResults, setDeckSearchResults] = useState<HierarchyItem[] | null>(null);
  const [deckSearchLoading, setDeckSearchLoading] = useState<boolean>(false);

  // Sync if parent updates initialModule / initialSubmodule
  useEffect(() => {
    if (initialModule && initialModule !== selectedModuleKey) {
      setSelectedModuleKey(initialModule);
      setExpandedSidebarModule(initialModule);
      setDrilldownSteps([]);
      setViewMode('deck');
    }
    if (initialSubmodule && initialSubmodule !== selectedSubmoduleKey) {
      setSelectedSubmoduleKey(initialSubmodule);
      setDrilldownSteps([]);
      setViewMode('deck');
    }
  }, [initialModule, initialSubmodule]);

  // Load Submodule Hierarchy from Neo4j dynamically based on active module & drilldown steps
  const loadHierarchy = useCallback(
    async (
      modKey: string,
      subKey: string,
      steps: DynamicDrilldownStep[]
    ) => {
      setHierarchyLoading(true);
      try {
        const params: Record<string, string> = {};
        for (const step of steps) {
          const sId = step.stageId;
          const val = step.item.id;
          params[`${sId}_id`] = val;
          if (sId === 'fee_master') params.master_id = val;
          if (sId === 'fee_title') params.title_id = val;
          if (sId === 'department') params.dept_id = val;
          if (sId === 'category') params.cat_id = val;
          if (sId === 'sub_category') params.subcat_id = val;
          if (sId === 'occupation') params.occ_id = val;
          if (sId === 'pillar') params.pillar_id = val;
          if (sId === 'hub') params.hub_id = val;
          if (sId === 'visitor_type') params.type_id = val;
        }

        const res = await fetchSubmoduleHierarchy(modKey, subKey, params);
        setHierarchyResponse(res);
      } catch (err: any) {
        console.warn('Hierarchy fetch error:', err);
      } finally {
        setHierarchyLoading(false);
      }
    },
    []
  );

  // Reload hierarchy when submodule or drilldown steps change
  useEffect(() => {
    loadHierarchy(selectedModuleKey, selectedSubmoduleKey, drilldownSteps);
  }, [selectedModuleKey, selectedSubmoduleKey, drilldownSteps, loadHierarchy]);

  // Deck Search across concepts in real-time
  useEffect(() => {
    if (deckSearchQuery.trim().length < 2) {
      setDeckSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setDeckSearchLoading(true);
      try {
        const res = await fetchSubmoduleHierarchy(selectedModuleKey, selectedSubmoduleKey, {
          search: deckSearchQuery.trim(),
        });
        setDeckSearchResults(res.items || []);
      } catch (e) {
        console.warn('Deck search error:', e);
      } finally {
        setDeckSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [deckSearchQuery, selectedModuleKey, selectedSubmoduleKey]);

  // Raw Graph data from live Neo4j
  const [rawNodes, setRawNodes] = useState<GraphNode[]>([]);
  const [rawEdges, setRawEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [statsMatrix, setStatsMatrix] = useState<ModuleStatsItem[]>([]);
  const [globalNodeCount, setGlobalNodeCount] = useState<number>(990318);
  const [globalEdgeCount, setGlobalEdgeCount] = useState<number>(2957896);
  const [lastSyncTime, setLastSyncTime] = useState<string>('2026-10-30 10:21:14');

  // Topological Focus & Stack
  const [rootFocusId, setRootFocusId] = useState<string | null>(null);
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // UI Panels state
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState<boolean>(false);
  const [detailsTab, setDetailsTab] = useState<'props' | 'prereqs' | 'unlocks'>('props');
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [sidebarSearch, setSidebarSearch] = useState<string>('');

  // Shortest Path Modal
  const [pathModalOpen, setPathModalOpen] = useState<boolean>(false);
  const [pathSourceId, setPathSourceId] = useState<string>('');
  const [pathTargetId, setPathTargetId] = useState<string>('');
  const [pathFinding, setPathFinding] = useState<boolean>(false);
  const [pathResult, setPathResult] = useState<string | null>(null);

  // Notice banner
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Metadata resolution
  const { module: currentModule, submodule: currentSubmodule } = useMemo(
    () => resolveModuleAndSubmodule(selectedModuleKey, selectedSubmoduleKey),
    [selectedModuleKey, selectedSubmoduleKey]
  );

  const showToast = useCallback((text: string, tone: 'ok' | 'warn' | 'error' = 'ok') => {
    setNotice({ tone, text });
    setTimeout(() => setNotice(null), 5000);
  }, []);

  // 1. Fetch Global Stats
  useEffect(() => {
    fetchModuleGraphStats()
      .then((res) => {
        if (res.matrix) {
          setStatsMatrix(res.matrix);
          setLastSyncTime(res.last_sync_utc || '2026-10-30 10:21:14');
        }
      })
      .catch((err) => {
        console.warn('Failed to load graph stats:', err);
      });
  }, []);

  // 2. Fetch Module Knowledge Graph
  const loadModuleGraph = useCallback(
    async (modKey: string, subKey: string) => {
      setLoading(true);
      setError(null);
      setSelectedNode(null);

      try {
        const res = await fetchModuleKnowledgeGraph(modKey, subKey, { limit: 50 });
        if (res.nodes && res.nodes.length > 0) {
          setRawNodes(res.nodes);
          setRawEdges(res.edges || []);

          // Pick primary focal entity: choose node with highest degree/edges, or first node
          const degreeMap = new Map<string, number>();
          for (const e of (res.edges || [])) {
            degreeMap.set(e.source, (degreeMap.get(e.source) || 0) + 1);
            degreeMap.set(e.target, (degreeMap.get(e.target) || 0) + 1);
          }
          let bestNodeId = res.nodes[0].id;
          let maxDeg = -1;
          for (const n of res.nodes) {
            const deg = degreeMap.get(n.id) || 0;
            if (deg > maxDeg) {
              maxDeg = deg;
              bestNodeId = n.id;
            }
          }

          setRootFocusId(bestNodeId);
          setHistoryStack([bestNodeId]);
        } else {
          setRawNodes([]);
          setRawEdges([]);
          setRootFocusId(null);
          setHistoryStack([]);
        }
      } catch (err: any) {
        console.error('loadModuleGraph error:', err);
        setError(err.message || 'Failed to load module graph from Neo4j.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadModuleGraph(selectedModuleKey, selectedSubmoduleKey);
  }, [selectedModuleKey, selectedSubmoduleKey, loadModuleGraph]);

  // Map entity as new focus root & dynamically expand its live Neo4j connections
  const mapEntity = useCallback(
    async (targetId: string) => {
      setRootFocusId(targetId);
      setHistoryStack((stack) => (stack[stack.length - 1] === targetId ? stack : [...stack, targetId]));

      const target = rawNodes.find((n) => n.id === targetId);
      if (target) {
        setSelectedNode(target);
        showToast(`Centered focus on ${target.label}`);

        // Dynamically fetch and merge its actual Neo4j connections
        try {
          const expanded = await expandGraphNode(target.primaryLabel, target.id, 50);
          if (expanded.nodes && expanded.nodes.length > 0) {
            setRawNodes((prev) => {
              const existingIds = new Set(prev.map((n) => n.id));
              const newNodes = expanded.nodes.filter((n) => !existingIds.has(n.id));
              return [...prev, ...newNodes];
            });
            setRawEdges((prev) => {
              const existingEdgeIds = new Set(prev.map((e) => e.id));
              const newEdges = (expanded.edges || []).filter((e) => !existingEdgeIds.has(e.id));
              return [...prev, ...newEdges];
            });
          }
        } catch (e) {
          console.warn('Live node expansion error:', e);
        }
      }

      // Smooth recenter
      setTimeout(() => {
        reactFlow.fitView({ padding: 0.25, duration: 350 });
      }, 50);
    },
    [rawNodes, reactFlow, showToast]
  );

  // Map an entity directly from the Hierarchy Deck into the 5-Column Coherence Map Canvas
  const handleMapConceptOrEntity = useCallback(
    async (item: HierarchyItem) => {
      showToast(`Mapping "${item.name}" into Coherence Map...`);
      setLoading(true);
      setViewMode('canvas');

      const primaryLabel =
        item.primaryLabel ||
        (item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : 'Concept');

      const cleanTargetId = item.id.includes(':') ? item.id : `${primaryLabel}:${item.id}`;
      setRootFocusId(cleanTargetId);
      setHistoryStack([cleanTargetId]);

      try {
        const expanded = await expandGraphNode(primaryLabel, item.id, 60);
        if (expanded.nodes && expanded.nodes.length > 0) {
          setRawNodes(expanded.nodes);
          setRawEdges(expanded.edges || []);
          const matched =
            expanded.nodes.find(
              (n) => n.id === cleanTargetId || n.id === item.id || n.id.endsWith(':' + item.id)
            ) || expanded.nodes[0];
          setSelectedNode(matched);
          if (matched) setRootFocusId(matched.id);
        } else {
          const fallbackNode: GraphNode = {
            id: cleanTargetId,
            label: item.name,
            primaryLabel: primaryLabel,
            kind: item.type || 'concept',
            properties: item.properties || {},
          };
          setRawNodes([fallbackNode]);
          setRawEdges([]);
          setSelectedNode(fallbackNode);
        }
      } catch (err: any) {
        console.warn('Map entity error:', err);
        showToast('Loaded entity: ' + item.name, 'ok');
      } finally {
        setLoading(false);
        setTimeout(() => {
          reactFlow.fitView({ padding: 0.25, duration: 350 });
        }, 100);
      }
    },
    [reactFlow, showToast]
  );

  // Breadcrumb back navigation
  const goBackHistory = useCallback(() => {
    if (historyStack.length <= 1) return;
    const newStack = historyStack.slice(0, -1);
    const prevId = newStack[newStack.length - 1];
    setHistoryStack(newStack);
    setRootFocusId(prevId);
    const target = rawNodes.find((n) => n.id === prevId);
    if (target) setSelectedNode(target);

    setTimeout(() => {
      reactFlow.fitView({ padding: 0.25, duration: 350 });
    }, 50);
  }, [historyStack, rawNodes, reactFlow]);

  // Expand 1 level of live Neo4j connections on demand
  const handleExpandSelectedNode = useCallback(async () => {
    if (!selectedNode) return;
    try {
      showToast(`Expanding live connections for ${selectedNode.label}...`);
      const expanded = await expandGraphNode(selectedNode.primaryLabel, selectedNode.id, 50);
      if (expanded.nodes && expanded.nodes.length > 0) {
        setRawNodes((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const newNodes = expanded.nodes.filter((n) => !existingIds.has(n.id));
          return [...prev, ...newNodes];
        });
        setRawEdges((prev) => {
          const existingEdgeIds = new Set(prev.map((e) => e.id));
          const newEdges = (expanded.edges || []).filter((e) => !existingEdgeIds.has(e.id));
          return [...prev, ...newEdges];
        });
        showToast(`Loaded ${expanded.nodes.length} connected entities from Neo4j`);
      } else {
        showToast('No additional connections found in Neo4j', 'warn');
      }
    } catch (err: any) {
      showToast('Expansion failed: ' + (err.message || 'Error'), 'error');
    }
  }, [selectedNode, showToast]);

  // Recalculate 5-column layout
  useEffect(() => {
    if (rawNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const { nodes: layoutNodes, edges: layoutEdges } = calculateCoherenceFocalLayout(
      rawNodes,
      rawEdges,
      {
        rootId: rootFocusId,
        hoveredId,
        selectedId: selectedNode?.id,
        onMapEntity: mapEntity,
        onHover: setHoveredId,
      }
    );

    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [rawNodes, rawEdges, rootFocusId, hoveredId, selectedNode, mapEntity, setNodes, setEdges]);

  // Auto-fit on initial graph load
  useEffect(() => {
    if (nodes.length > 0) {
      const timer = setTimeout(() => {
        reactFlow.fitView({ padding: 0.2, duration: 300 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, reactFlow]);

  // Node selection handler
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const raw = rawNodes.find((n) => n.id === node.id);
      if (raw) {
        setSelectedNode(raw);
        setDetailsPanelOpen(true);
      }
    },
    [rawNodes]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setDetailsPanelOpen(false);
  }, []);

  // Relationship counts for selected node
  const { incomingEdges, outgoingEdges } = useMemo(() => {
    if (!selectedNode) return { incomingEdges: [], outgoingEdges: [] };
    const incoming = rawEdges.filter((e) => e.target === selectedNode.id);
    const outgoing = rawEdges.filter((e) => e.source === selectedNode.id);
    return { incomingEdges: incoming, outgoingEdges: outgoing };
  }, [selectedNode, rawEdges]);

  // Shortest Path execution
  const handleFindShortestPath = async () => {
    if (!pathSourceId || !pathTargetId) return;
    setPathFinding(true);
    setPathResult(null);

    try {
      const res = await findGraphShortestPath(pathSourceId, pathTargetId, 1);
      if (res.pathFound) {
        setPathResult(
          `Path length: ${res.length} hops. Traversed: ${res.nodes.map((n: any) => n.label).join(' → ')}`
        );
        showToast('Shortest path found and verified in Neo4j', 'ok');
      } else {
        setPathResult(res.message || 'No connecting path found between these nodes.');
        showToast('No connecting path found', 'warn');
      }
    } catch (e: any) {
      setPathResult(e.message || 'Failed to calculate shortest path.');
      showToast('Path calculation failed', 'error');
    } finally {
      setPathFinding(false);
    }
  };

  // Filtered sidebar modules
  const allModules = useMemo(() => getAllModules(), []);
  const filteredModules = useMemo(() => {
    if (!sidebarSearch.trim()) return allModules;
    const q = sidebarSearch.toLowerCase();
    return allModules.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        Object.values(m.submodules).some(
          (s) => s.name.toLowerCase().includes(q) || s.labels.some((l) => l.toLowerCase().includes(q))
        )
    );
  }, [allModules, sidebarSearch]);

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-slate-50 font-sans text-slate-800">
      {/* ─────────────────────────────────────────────────────────────
          1. LEFT HIERARCHY EXPLORER SIDEBAR (Matching CurriculumExplorerSidebar)
      ───────────────────────────────────────────────────────────── */}
      <aside
        className={`relative flex flex-col border-r border-slate-200/90 bg-white transition-all duration-300 ease-in-out z-20 ${sidebarCollapsed ? 'w-14' : 'w-72 lg:w-80'
          }`}
      >
        {/* Purple Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-purple-900/10 bg-[#7C3AED] px-3.5 text-white shadow-xs">
          {!sidebarCollapsed ? (
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white shadow-2xs backdrop-blur-xs">
                <Network size={16} strokeWidth={2.4} aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-[13.5px] font-bold leading-tight tracking-tight">
                  Enterprise Explorer
                </h2>
                <p className="truncate text-[11px] font-medium text-purple-200/90">
                  Modules · Submodules · Entities
                </p>
              </div>
            </div>
          ) : (
            <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-white">
              <Network size={16} strokeWidth={2.4} />
            </span>
          )}

          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-purple-100 transition-colors hover:bg-white/20 hover:text-white"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        {!sidebarCollapsed && (
          <>
            {/* Search Input */}
            <div className="border-b border-slate-100 bg-slate-50/50 p-2.5">
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-2.5 text-slate-400" />
                <input
                  type="text"
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  placeholder="Search modules or entities..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-[12px] text-slate-800 placeholder-slate-400 transition-colors focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
                {sidebarSearch && (
                  <button
                    type="button"
                    onClick={() => setSidebarSearch('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Tree Navigation */}
            <div className="cm-sidebar-tree min-h-0 flex-1 overflow-y-auto p-2 space-y-1">
              {filteredModules.map((mod, modIdx) => {
                const isModExpanded = expandedSidebarModule === mod.id;
                const isCurrentMod = selectedModuleKey === mod.id;

                return (
                  <div key={mod.id} className="rounded-xl border border-slate-100 bg-white overflow-hidden shadow-2xs">
                    {/* Module Row */}
                    <button
                      type="button"
                      onClick={() => setExpandedSidebarModule(isModExpanded ? null : mod.id)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors ${isCurrentMod ? 'bg-purple-50/70 text-purple-900 font-bold' : 'hover:bg-slate-50 text-slate-800'
                        }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">
                          {modIdx + 1}
                        </span>
                        <span className="truncate text-[12.5px] font-semibold">{mod.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-medium text-slate-500">
                          {Object.values(mod.submodules).length}
                        </span>
                        {isModExpanded ? (
                          <ChevronDown size={14} className="text-slate-400" />
                        ) : (
                          <ChevronRight size={14} className="text-slate-400" />
                        )}
                      </div>
                    </button>

                    {/* Submodules List */}
                    {isModExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/40 p-1 pl-4 space-y-0.5">
                        {Object.values(mod.submodules).map((sub) => {
                          const isSubSelected =
                            selectedModuleKey === mod.id && selectedSubmoduleKey === sub.id;

                          return (
                            <div key={sub.id} className="space-y-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedModuleKey(mod.id);
                                  setSelectedSubmoduleKey(sub.id);
                                  setDrilldownSteps([]);
                                  setViewMode('deck');
                                }}
                                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11.5px] transition-colors ${isSubSelected
                                  ? 'bg-[#059669] text-white font-bold shadow-2xs'
                                  : 'text-slate-700 hover:bg-slate-100'
                                  }`}
                              >
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <BookOpen
                                    size={12}
                                    className={isSubSelected ? 'text-white' : 'text-slate-400'}
                                  />
                                  <span className="truncate">{sub.name}</span>
                                </div>
                                <span
                                  className={`rounded-full px-1.5 py-0.2 text-[9px] font-medium ${isSubSelected ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                                    }`}
                                >
                                  {sub.labels.length} types
                                </span>
                              </button>

                              {/* If currently selected submodule: list loaded live entities */}
                              {isSubSelected && rawNodes.length > 0 && (
                                <div className="my-1 ml-3 border-l-2 border-emerald-300 pl-2 space-y-0.5">
                                  {rawNodes.slice(0, 15).map((node) => {
                                    const isEntityFocused = node.id === rootFocusId;

                                    return (
                                      <button
                                        key={node.id}
                                        type="button"
                                        onClick={() => mapEntity(node.id)}
                                        className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[10.5px] transition-colors ${isEntityFocused
                                          ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-300'
                                          : 'text-slate-600 hover:bg-slate-100'
                                          }`}
                                      >
                                        <ConceptNodeIcon
                                          className={isEntityFocused ? 'text-emerald-700' : 'text-slate-400'}
                                        />
                                        <span className="truncate">{node.label}</span>
                                      </button>
                                    );
                                  })}
                                  {rawNodes.length > 15 && (
                                    <p className="px-1 text-[9.5px] font-medium text-slate-400">
                                      +{rawNodes.length - 15} more entities in canvas
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          2. CENTER GRAPH CANVAS / HIERARCHY DECK (Achieve the Core Theme)
      ───────────────────────────────────────────────────────────── */}
      <main className="relative flex-1 h-full min-h-0 overflow-hidden flex flex-col bg-slate-50/60">
        {viewMode === 'deck' ? (
          /* ══════════════════════════════════════════════════════════
             MODE 1: DYNAMIC HIERARCHY DRILL-DOWN DECK
             Each ERP module's authentic workflow stages from Neo4j
             ══════════════════════════════════════════════════════════ */
          (() => {
            const workflow = hierarchyResponse?.workflow;
            const workflowStages = workflow?.stages || [
              { id: 'entity', label: 'Entity', badge: 'Entity', icon: 'Layers' },
            ];
            const currentStageIndex = hierarchyResponse?.current_stage_index ?? drilldownSteps.length;
            const currentStage =
              workflowStages[currentStageIndex] ||
              workflowStages[workflowStages.length - 1] || {
                id: hierarchyResponse?.level || 'entity',
                label: hierarchyResponse?.level
                  ? hierarchyResponse.level.charAt(0).toUpperCase() + hierarchyResponse.level.slice(1)
                  : 'Entity',
                badge: 'Entity',
                icon: 'Layers',
              };
            const isLastStage = currentStageIndex >= workflowStages.length - 1;
            const nextStage = !isLastStage ? workflowStages[currentStageIndex + 1] : null;

            const handleDrilldown = (item: HierarchyItem) => {
              const nextSteps: DynamicDrilldownStep[] = [
                ...drilldownSteps,
                {
                  stageId: currentStage.id,
                  stageLabel: currentStage.label,
                  item,
                },
              ];
              setDrilldownSteps(nextSteps);
            };

            return (
              <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-50/70">
                {/* ── Top Header Toolbar ── */}
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/90 bg-white/95 px-5 py-3 shadow-xs backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-white shadow-sm">
                      <Network size={18} strokeWidth={2.2} aria-hidden />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-[14px] font-bold text-slate-900">
                          {workflow?.name || `${currentSubmodule?.name || 'Enterprise'} Hierarchy`}
                        </h2>
                        {/* Level indicator badge */}
                        <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white shadow-2xs">
                          {deckSearchResults
                            ? `Search Results (${deckSearchResults.length})`
                            : isLastStage
                              ? `${currentStageIndex + 1}. Select ${currentStage.label} to Map`
                              : `${currentStageIndex + 1}. Select ${currentStage.label}`}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-500">
                        {currentModule?.name} · {currentSubmodule?.name} · Direct Neo4j Knowledge Graph
                      </p>
                    </div>
                  </div>

                  {/* Global Real-Time Search Bar */}
                  <div className="relative min-w-[16rem] max-w-sm flex-1">
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      aria-hidden
                    />
                    <input
                      value={deckSearchQuery}
                      onChange={(e) => setDeckSearchQuery(e.target.value)}
                      placeholder="Search any concept or entity in Neo4j..."
                      aria-label="Search all concepts"
                      className="h-9 w-full rounded-full border border-slate-200 bg-slate-50/80 pl-9 pr-9 text-[12px] font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-[#059669] focus:bg-white focus:ring-2 focus:ring-[#059669]/20"
                    />
                    {deckSearchQuery.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={() => setDeckSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                        aria-label="Clear search"
                      >
                        <X size={13} strokeWidth={2.2} />
                      </button>
                    )}
                  </div>

                  {/* Quick Actions & Canvas Switcher */}
                  <div className="flex items-center gap-2">
                    {rootFocusId && (
                      <button
                        type="button"
                        onClick={() => setViewMode('canvas')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[11.5px] font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 transition-colors active:scale-95"
                        title="Switch to Coherence Map Graph Canvas"
                      >
                        <Network size={14} className="text-[#059669]" />
                        <span>View Graph Canvas</span>
                      </button>
                    )}

                    {onClose && (
                      <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-2xs transition-colors hover:bg-slate-100 hover:text-slate-900"
                        title="Close Explorer"
                      >
                        <X size={16} strokeWidth={2.2} />
                      </button>
                    )}
                  </div>
                </header>

                {/* ── Dynamic Breadcrumb Bar ── */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white/80 px-5 py-2.5 backdrop-blur-xs">
                  <div className="flex items-center gap-2 overflow-x-auto text-[12px]">
                    {/* Back button */}
                    {drilldownSteps.length > 0 && !deckSearchResults && (
                      <button
                        type="button"
                        onClick={() => setDrilldownSteps((prev) => prev.slice(0, -1))}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11.5px] font-bold text-slate-700 shadow-2xs transition-colors hover:bg-slate-100 hover:text-slate-900 active:scale-95 shrink-0"
                      >
                        <ArrowLeft size={13} strokeWidth={2.4} />
                        <span>Back</span>
                      </button>
                    )}

                    {/* Breadcrumb Steps */}
                    <nav className="flex items-center gap-1.5 font-medium flex-wrap" aria-label="Hierarchy drill-down">
                      {/* Step 0: All Root Items */}
                      <button
                        type="button"
                        onClick={() => setDrilldownSteps([])}
                        className={[
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors text-[11.5px] shrink-0',
                          drilldownSteps.length === 0
                            ? 'bg-[#059669] font-bold text-white shadow-xs'
                            : 'bg-emerald-50 font-semibold text-emerald-800 hover:bg-emerald-100',
                        ].join(' ')}
                      >
                        <Layers size={11} strokeWidth={2.2} />
                        <span>All {workflowStages[0]?.label || 'Items'}s</span>
                      </button>

                      {/* Dynamic Drilldown Steps */}
                      {drilldownSteps.map((step, idx) => {
                        const isCurrent = idx === drilldownSteps.length - 1;
                        return (
                          <React.Fragment key={`${step.stageId}-${step.item.id}-${idx}`}>
                            <ChevronRight size={13} className="text-slate-400 shrink-0" />
                            <button
                              type="button"
                              onClick={() => setDrilldownSteps(drilldownSteps.slice(0, idx + 1))}
                              className={[
                                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors text-[11.5px] max-w-[200px]',
                                isCurrent
                                  ? 'bg-[#059669] font-bold text-white shadow-xs'
                                  : 'bg-emerald-50 font-semibold text-emerald-800 hover:bg-emerald-100',
                              ].join(' ')}
                            >
                              <span className="truncate">{step.item.name}</span>
                            </button>
                          </React.Fragment>
                        );
                      })}
                    </nav>
                  </div>

                  {/* Workflow Pipeline Guide */}
                  <div className="hidden lg:flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                    {workflowStages.map((st, i) => (
                      <React.Fragment key={st.id}>
                        {i > 0 && <ChevronRight size={10} className="text-slate-300" />}
                        <span
                          className={
                            i === currentStageIndex
                              ? 'font-bold text-[#059669] underline underline-offset-4 decoration-2'
                              : i < currentStageIndex
                                ? 'font-semibold text-slate-600'
                                : 'text-slate-400'
                          }
                        >
                          {st.label}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* ── Main Stage Content Area ── */}
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                  {hierarchyLoading || deckSearchLoading ? (
                    <div className="flex h-64 items-center justify-center">
                      <span className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-[13px] font-semibold text-slate-700 shadow-md">
                        <Loader2 size={18} className="animate-spin text-[#059669]" />
                        <span>Loading real Neo4j hierarchy...</span>
                      </span>
                    </div>
                  ) : deckSearchResults ? (
                    /* ── Search Results ── */
                    <div>
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">
                            Search Results for &ldquo;{deckSearchQuery}&rdquo;
                          </h3>
                          <p className="text-xs text-slate-500">
                            Found {deckSearchResults.length} matching entity in Neo4j. Click any card to map.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDeckSearchQuery('')}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-2xs hover:bg-slate-50"
                        >
                          Clear Search
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {deckSearchResults.map((entity) => (
                          <div
                            key={entity.id}
                            className="group relative flex h-44 flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-md"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 border border-emerald-200/60">
                                <Lightbulb size={10} strokeWidth={2.2} />
                                <span>{entity.primaryLabel || 'Entity'}</span>
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                {entity.est_minutes ? `${entity.est_minutes} min` : 'Neo4j'}
                              </span>
                            </div>

                            <div className="my-1">
                              <h4 className="line-clamp-2 text-[13.5px] font-bold text-slate-900 group-hover:text-emerald-950 transition-colors">
                                {entity.name}
                              </h4>
                              {entity.prereq_count !== undefined && (
                                <p className="mt-1 text-[11px] text-slate-500 font-medium">
                                  {entity.prereq_count} prerequisite connection{entity.prereq_count === 1 ? '' : 's'}
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleMapConceptOrEntity(entity)}
                              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#059669] px-3 py-2 text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#047857] active:scale-95"
                            >
                              <Network size={13} strokeWidth={2.4} />
                              <span>Map this entity</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* ── Active Workflow Stage Cards ── */
                    <div>
                      <div className="mb-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#059669] to-teal-700 text-white shadow-xs">
                            {isLastStage ? <Lightbulb size={16} strokeWidth={2.2} /> : <Layers size={16} strokeWidth={2.2} />}
                          </span>
                          <div>
                            <h3 className="text-base font-bold text-slate-900">
                              {drilldownSteps.length > 0
                                ? `${currentStage.label}s in "${drilldownSteps[drilldownSteps.length - 1].item.name}"`
                                : `All ${currentStage.label}s (${hierarchyResponse?.total_count || (hierarchyResponse?.items || []).length} in Neo4j)`}
                            </h3>
                            <p className="text-xs text-slate-500">
                              {isLastStage
                                ? `Final hierarchy level: click "Map" to explore 5-column Coherence Knowledge Graph in Neo4j`
                                : `Step ${currentStageIndex + 1} of ${workflowStages.length}: Click a card to drill down into ${nextStage?.label || 'next level'}, or map directly`}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {(hierarchyResponse?.items || []).map((item, idx) => (
                          <div
                            key={item.id}
                            className="group relative flex h-46 flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-md"
                          >
                            {/* Card Top: Badges and Counts */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 border border-emerald-200/60">
                                <span>
                                  {item.type === 'unit' && item.unit_number
                                    ? `Unit ${item.unit_number}`
                                    : currentStage.badge || item.primaryLabel}
                                </span>
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-600">
                                {item.child_count !== undefined
                                  ? `${item.child_count} ${nextStage?.badge || 'items'}`
                                  : item.concept_count !== undefined
                                    ? `${item.concept_count} concepts`
                                    : item.vehicle_count !== undefined
                                      ? `${item.vehicle_count} vehicles`
                                      : item.amount !== undefined
                                        ? `₹${item.amount}`
                                        : item.prereq_count !== undefined
                                          ? `${item.prereq_count} connections`
                                          : `${item.est_minutes || 5} min`}
                              </span>
                            </div>

                            {/* Card Center: Title & Subtitle */}
                            <div
                              className={`my-auto ${!isLastStage ? 'cursor-pointer' : ''}`}
                              onClick={() => !isLastStage && handleDrilldown(item)}
                            >
                              <h4 className="line-clamp-2 text-[14px] font-bold text-slate-900 group-hover:text-emerald-950 transition-colors">
                                {item.name}
                              </h4>
                              <p className="mt-1 text-[11px] font-medium text-slate-400 truncate">
                                {item.chapter_count !== undefined
                                  ? `${item.chapter_count} chapters · ${item.concept_count || 0} concepts`
                                  : item.topic_count !== undefined
                                    ? `${item.topic_count} topics · ${item.concept_count || 0} concepts`
                                    : item.designation
                                      ? item.designation
                                      : item.difficulty
                                        ? `Difficulty: ${item.difficulty}`
                                        : `${item.primaryLabel} ID: ${item.id}`}
                              </p>
                            </div>

                            {/* Card Bottom: Actions */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11.5px] gap-2">
                              {!isLastStage ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleDrilldown(item)}
                                    className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-900"
                                  >
                                    <span>Explore {nextStage?.label || 'Next'}</span>
                                    <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleMapConceptOrEntity(item)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10.5px] font-bold text-emerald-800 hover:bg-emerald-100 active:scale-95"
                                    title="Map this entity directly in Coherence Graph"
                                  >
                                    <Network size={11} strokeWidth={2.4} />
                                    <span>Map</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleMapConceptOrEntity(item)}
                                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#059669] px-3 py-2 text-[12px] font-bold text-white shadow-sm transition-all hover:bg-[#047857] active:scale-95"
                                >
                                  <Network size={13} strokeWidth={2.4} />
                                  <span>Map this {currentStage.label}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Direct Chapter Concepts if present */}
                      {hierarchyResponse?.direct_concepts && hierarchyResponse.direct_concepts.length > 0 && (
                        <div className="mt-8">
                          <h4 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-slate-500">
                            Direct Chapter Concepts ({hierarchyResponse.direct_concepts.length})
                          </h4>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {hierarchyResponse.direct_concepts.map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-2xs"
                              >
                                <span className="truncate text-[12.5px] font-semibold text-slate-800">{c.name}</span>
                                <button
                                  type="button"
                                  onClick={() => handleMapConceptOrEntity(c)}
                                  className="ml-2 shrink-0 rounded-lg bg-[#059669] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#047857]"
                                >
                                  Map
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          /* ══════════════════════════════════════════════════════════
             MODE 2: 5-COLUMN COHERENCE MAP CANVAS (Achieve the Core)
             ══════════════════════════════════════════════════════════ */
          <>
            {loading && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/75 backdrop-blur-xs">
                <span className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-[13px] font-semibold text-slate-700 shadow-xl">
                  <Loader2 size={16} className="animate-spin text-[#059669]" />
                  <span>Loading enterprise coherence map from Neo4j...</span>
                </span>
              </div>
            )}

            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes as never}
              edgeTypes={edgeTypes as never}
              fitView
              fitViewOptions={{ padding: 0.25, minZoom: 0.8, maxZoom: 1.2 }}
              minZoom={0.25}
              maxZoom={1.5}
              nodesDraggable={false}
              nodesConnectable={false}
              zIndexMode="manual"
              className="coherence-map-canvas bg-slate-50/70 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/30 via-slate-50/60 to-slate-100/50"
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color={GRID_DOT} />
              <Controls
                showInteractive={false}
                className="!border-slate-200/90 !bg-white/95 !shadow-[0_4px_20px_rgba(15,23,42,0.08)] !rounded-2xl overflow-hidden [&>button]:!border-slate-100 [&>button]:!bg-white [&>button]:!fill-slate-600 [&>button:hover]:!bg-slate-50"
              />

              {/* Top-Left Panel: Return to Hierarchy Deck + Title Chrome */}
              <Panel position="top-left">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMode('deck')}
                    className={`${FLOATING_CHROME} inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold text-emerald-800 transition-all hover:bg-emerald-50 hover:text-emerald-950 shadow-md active:scale-95`}
                    title="Return to Hierarchy Explorer Deck"
                  >
                    <Layers size={14} strokeWidth={2.4} className="text-[#059669]" />
                    <span>Hierarchy Deck</span>
                  </button>

                  <div className={`${FLOATING_CHROME} flex items-center gap-2.5 px-3 py-2`}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#2563EB] text-white shadow-sm">
                      <Network size={14} strokeWidth={2.2} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-[12.5px] font-bold leading-tight text-slate-900">
                        Enterprise Coherence Map
                      </h2>
                      <p className="truncate text-[10.5px] font-medium leading-tight text-slate-500">
                        {currentModule?.name} · {currentSubmodule?.name}
                      </p>
                    </div>
                  </div>
                </div>
              </Panel>

              {/* Top-Center Panel: Breadcrumbs, Flow Indicator, Notice */}
              <Panel position="top-center">
                <div className="flex flex-col items-center gap-2">
                  {/* Breadcrumb Trail */}
                  {historyStack.length > 1 && (
                    <div className={`${FLOATING_CHROME} flex items-center gap-1.5 px-3 py-1.5 text-[11px]`}>
                      <button
                        type="button"
                        onClick={goBackHistory}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-bold text-[#059669] hover:bg-emerald-50 transition-colors"
                      >
                        <ArrowLeft size={11} />
                        <span>Back</span>
                      </button>
                      <span className="text-slate-300">|</span>
                      <span className="text-slate-500 font-medium">History:</span>
                      {historyStack.slice(-3).map((id, idx) => {
                        const match = rawNodes.find((n) => n.id === id);
                        return (
                          <span key={id} className="flex items-center gap-1 text-slate-700 font-semibold">
                            {idx > 0 && <span className="text-slate-300">›</span>}
                            <span className="max-w-[120px] truncate">{match?.label || id}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Exact Achieve the Core Flow Direction Indicator Banner */}
                  <div className="hidden md:flex items-center gap-4 rounded-full border border-slate-200/80 bg-white/90 px-4 py-1.5 text-[11px] font-bold text-slate-500 shadow-2xs backdrop-blur-md">
                    <span className="flex items-center gap-1 text-sky-700">
                      <span>← Prerequisites</span>
                      <span className="text-[9.5px] font-normal text-slate-400">(Must Precede)</span>
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

                  {/* Toast Notice */}
                  {notice && (
                    <div
                      className={`animate-in fade-in flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold shadow-lg backdrop-blur-md duration-200 ${notice.tone === 'ok'
                        ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                        : notice.tone === 'warn'
                          ? 'bg-amber-500 text-white shadow-amber-500/20'
                          : 'bg-red-600 text-white shadow-red-600/20'
                        }`}
                    >
                      {notice.tone === 'ok' ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        <AlertTriangle size={14} />
                      )}
                      <span>{notice.text}</span>
                    </div>
                  )}
                </div>
              </Panel>

              {/* Top-Right Panel: Navigation & Actions */}
              <Panel position="top-right">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPathModalOpen(true)}
                    className={`${FLOATING_CHROME} inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900`}
                    title="Trace shortest path between entities"
                  >
                    <Route size={13} strokeWidth={2.2} />
                    <span>Shortest Path</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowLegend((v) => !v)}
                    className={`${FLOATING_CHROME} inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900`}
                    title="Toggle legend"
                  >
                    <span>Legend</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => reactFlow.fitView({ padding: 0.25, duration: 300 })}
                    className={`${FLOATING_CHROME} flex h-9 w-9 items-center justify-center text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900`}
                    title="Reset View"
                  >
                    <RefreshCw size={14} />
                  </button>

                  {onClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      className={`${FLOATING_CHROME} flex h-9 w-9 items-center justify-center text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900`}
                      title="Close Knowledge Graph"
                    >
                      <X size={16} strokeWidth={2.2} />
                    </button>
                  )}
                </div>
              </Panel>

              {/* Bottom-Right Panel: Achieve the Core Floating Legend */}
              {showLegend && (
                <Panel position="bottom-right">
                  <div className={`${FLOATING_CHROME} p-3 text-[11px] space-y-2 min-w-[210px]`}>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                        Graph Legend
                      </span>
                      <span className="text-[10px] text-slate-400">Tenant: #1</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="h-0.5 w-6 bg-[#059669] rounded-full" />
                        <span className="text-slate-700 font-medium">Direct Prerequisite</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-0.5 w-6 bg-[#B45309] border-t border-dashed border-[#B45309]" />
                        <span className="text-slate-700 font-medium">Loop / Backward</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-0.5 w-6 bg-[#0D9488] border-t border-dotted border-[#0D9488]" />
                        <span className="text-slate-700 font-medium">Cross-Module Connection</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-emerald-600 ring-2 ring-emerald-300" />
                        <span className="text-slate-700 font-medium">Current Focal Entity</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-1.5 flex justify-between text-[10px] text-slate-500">
                      <span>Nodes: <strong>{rawNodes.length}</strong></span>
                      <span>Relationships: <strong>{rawEdges.length}</strong></span>
                    </div>
                  </div>
                </Panel>
              )}
            </ReactFlow>
          </>
        )}
      </main>

      {/* ─────────────────────────────────────────────────────────────
          3. RIGHT SLIDE-IN DETAILS PANEL (Matching cm-details-panel)
      ───────────────────────────────────────────────────────────── */}
      <aside
        data-open={detailsPanelOpen}
        className="cm-details-panel relative flex flex-col border-l border-slate-200/90 bg-white z-20 shadow-[-4px_0_24px_rgba(15,23,42,0.06)]"
      >
        {selectedNode ? (
          <div className="flex h-full min-h-0 flex-1 flex-col">
            {/* Header */}
            <div className="border-b border-slate-100 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <CoherenceBadge tone="emerald">{selectedNode.primaryLabel}</CoherenceBadge>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExpandSelectedNode}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2 py-1 text-[10.5px] font-bold text-emerald-700 shadow-2xs hover:bg-emerald-50 transition-colors"
                    title="Expand 1 level of live Neo4j relationships"
                  >
                    <span>+1 Level</span>
                  </button>
                  {selectedNode.id !== rootFocusId && (
                    <button
                      type="button"
                      onClick={() => mapEntity(selectedNode.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#059669] px-2 py-1 text-[10.5px] font-bold text-white shadow-2xs hover:bg-emerald-700 transition-colors"
                      title="Make this entity the focal center"
                    >
                      <Network size={11} />
                      <span>Focus</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetailsPanelOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              <h3 className="mt-2 text-[15px] font-bold leading-snug text-slate-900">
                {selectedNode.label}
              </h3>
              <p className="mt-0.5 text-[11px] font-mono text-slate-400 truncate">
                ID: {selectedNode.id}
              </p>
            </div>

            {/* SQL Provenance */}
            <div className="border-b border-slate-100 bg-slate-50/30 px-4 py-2 text-[11px]">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                <Database size={12} className="text-purple-600" />
                <span>SQL Provenance</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2 font-mono text-[10.5px]">
                <div className="rounded bg-slate-100/80 px-2 py-1 text-slate-600">
                  Table: <strong className="text-slate-800">{selectedNode.sqlTable || 'dynamic'}</strong>
                </div>
                <div className="rounded bg-slate-100/80 px-2 py-1 text-slate-600">
                  PK: <strong className="text-slate-800">{selectedNode.sqlPk || 'id'}</strong>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 px-4 text-[12px] font-semibold text-slate-500">
              <button
                type="button"
                onClick={() => setDetailsTab('props')}
                className={`py-2 px-1 border-b-2 mr-3 ${detailsTab === 'props'
                  ? 'border-[#059669] text-emerald-800 font-bold'
                  : 'border-transparent hover:text-slate-800'
                  }`}
              >
                Properties
              </button>
              <button
                type="button"
                onClick={() => setDetailsTab('prereqs')}
                className={`py-2 px-1 border-b-2 mr-3 ${detailsTab === 'prereqs'
                  ? 'border-[#059669] text-emerald-800 font-bold'
                  : 'border-transparent hover:text-slate-800'
                  }`}
              >
                Prereqs ({incomingEdges.length})
              </button>
              <button
                type="button"
                onClick={() => setDetailsTab('unlocks')}
                className={`py-2 px-1 border-b-2 ${detailsTab === 'unlocks'
                  ? 'border-[#059669] text-emerald-800 font-bold'
                  : 'border-transparent hover:text-slate-800'
                  }`}
              >
                Unlocks ({outgoingEdges.length})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 text-[11.5px]">
              {detailsTab === 'props' && (
                <div className="space-y-2">
                  {selectedNode.properties &&
                    Object.entries(selectedNode.properties).map(([k, v]) => (
                      <div key={k} className="flex flex-col border-b border-slate-50 pb-1">
                        <span className="font-mono text-[10px] text-slate-400">{k}</span>
                        <span className="font-medium text-slate-800 break-words">
                          {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {detailsTab === 'prereqs' && (
                <div className="space-y-1.5">
                  {incomingEdges.length === 0 ? (
                    <p className="text-slate-400 italic">No incoming prerequisites recorded.</p>
                  ) : (
                    incomingEdges.map((e) => {
                      const srcNode = rawNodes.find((n) => n.id === e.source);
                      return (
                        <div
                          key={e.id}
                          className="flex items-center justify-between rounded-lg border border-slate-100 p-2 hover:bg-slate-50"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-slate-800 truncate">
                              {srcNode?.label || e.source}
                            </p>
                            <span className="text-[10px] text-slate-400 font-mono">
                              via {e.label}
                            </span>
                          </div>
                          {srcNode && (
                            <button
                              type="button"
                              onClick={() => mapEntity(srcNode.id)}
                              className="shrink-0 text-[10px] font-bold text-[#059669] hover:underline"
                            >
                              Map
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {detailsTab === 'unlocks' && (
                <div className="space-y-1.5">
                  {outgoingEdges.length === 0 ? (
                    <p className="text-slate-400 italic">No outgoing unlocked dependents recorded.</p>
                  ) : (
                    outgoingEdges.map((e) => {
                      const tgtNode = rawNodes.find((n) => n.id === e.target);
                      return (
                        <div
                          key={e.id}
                          className="flex items-center justify-between rounded-lg border border-slate-100 p-2 hover:bg-slate-50"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-slate-800 truncate">
                              {tgtNode?.label || e.target}
                            </p>
                            <span className="text-[10px] text-slate-400 font-mono">
                              via {e.label}
                            </span>
                          </div>
                          {tgtNode && (
                            <button
                              type="button"
                              onClick={() => mapEntity(tgtNode.id)}
                              className="shrink-0 text-[10px] font-bold text-[#059669] hover:underline"
                            >
                              Map
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-400">
            <Layers size={24} className="mb-2 text-slate-300" />
            <p className="text-[12px] font-medium">Click any node in the graph to inspect properties</p>
          </div>
        )}
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          4. SHORTEST PATH MODAL
      ───────────────────────────────────────────────────────────── */}
      {pathModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Route size={18} className="text-[#059669]" />
                <h3 className="font-bold text-slate-900 text-[15px]">Shortest Path Finder</h3>
              </div>
              <button
                type="button"
                onClick={() => setPathModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-[12px]">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Source Entity</label>
                <select
                  value={pathSourceId}
                  onChange={(e) => setPathSourceId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 text-slate-800 text-[12px]"
                >
                  <option value="">Select source node...</option>
                  {rawNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label} ({n.primaryLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Entity</label>
                <select
                  value={pathTargetId}
                  onChange={(e) => setPathTargetId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 text-slate-800 text-[12px]"
                >
                  <option value="">Select target node...</option>
                  {rawNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label} ({n.primaryLabel})
                    </option>
                  ))}
                </select>
              </div>

              {pathResult && (
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-[11px] font-medium text-slate-700">
                  {pathResult}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPathModalOpen(false)}
                className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFindShortestPath}
                disabled={pathFinding || !pathSourceId || !pathTargetId}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#059669] px-4 py-1.5 text-[12px] font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {pathFinding && <Loader2 size={13} className="animate-spin" />}

                <span>Find Path</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
