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

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Network, ServerCrash, X } from 'lucide-react';

import {
  fetchErpSubmoduleGraph,
  fetchGraphNodeDetail,
  fetchOrganizationStaffGraph,
  listErpModules,
  listErpSubmodules,
} from '@/lib/intelligence/client';
import type { ErpModule, GraphPathResult } from '@/lib/intelligence/types';

import GraphBreadcrumbHeader from '@/app/_components/graph/GraphBreadcrumbHeader';
import GraphCanvas from '@/app/_components/graph/GraphCanvas';
import GraphDetailPanel from '@/app/_components/graph/GraphDetailPanel';
import GraphModuleTree, { type TreeSubmodule } from '@/app/_components/graph/GraphModuleTree';
import GraphPathFinder from '@/app/_components/graph/GraphPathFinder';
import GraphSearchBar from '@/app/_components/graph/GraphSearchBar';
import GraphSyncStatus from '@/app/_components/graph/GraphSyncStatus';
import TypeLegend from '@/app/_components/graph/TypeLegend';
import { readGraphSession } from '@/app/_components/graph/graph-session';
import {
  buildHopsFromNodeDetail,
  mapErpSubmoduleGraph,
  mapGraphNodeDetail,
  mapGraphPathResult,
  mapOrganizationStaffGraph,
} from '@/app/_components/graph/graph-query-mapper';
import type { KgEdgeInput, KgNodeInput } from '@/app/_components/graph/graph-model';

type GraphState = 'idle' | 'loading' | 'ready' | 'not-mapped' | 'error';
const RELATIONSHIP_LIMIT = 20;

function moduleKeyToLabel(key: string): string {
  return key
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

function mergeById<T extends { id: string }>(prev: T[], next: T[]): T[] {
  const merged = new Map(prev.map((item) => [item.id, item]));
  for (const item of next) merged.set(item.id, item);
  return Array.from(merged.values());
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
  const [nodes, setNodes] = useState<KgNodeInput[]>([]);
  const [edges, setEdges] = useState<KgEdgeInput[]>([]);

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

  const [selectedNodeTypes, setSelectedNodeTypes] = useState<Set<string>>(new Set());
  const [selectedRelationshipTypes, setSelectedRelationshipTypes] = useState<Set<string>>(new Set());

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
  };

  const openModule = (module: ErpModule) => {
    setSelectedModule(module);
  };

  const openSubmodule = async (module: ErpModule, submodule: TreeSubmodule) => {
    setSelectedModule(module);
    setSelectedSubmodule(submodule);
    setGraphState('loading');
    setGraphError('');
    resetSelection();

    try {
      if (submodule.kind === 'organization-staff') {
        const result = await fetchOrganizationStaffGraph(session, { perRole: 25 });
        const mapped = mapOrganizationStaffGraph(result);
        setNodes(mapped.nodes);
        setEdges(mapped.edges);
        setGraphState('ready');
        return;
      }

      const result = await fetchErpSubmoduleGraph(session, submodule.id, { sampleSize: 10, limit: 300 });
      if (result.labels.length === 0) {
        setNodes([]);
        setEdges([]);
        setGraphState('not-mapped');
        return;
      }
      const mapped = mapErpSubmoduleGraph(result);
      setNodes(mapped.nodes);
      setEdges(mapped.edges);
      setGraphState('ready');
    } catch (cause) {
      setGraphError(cause instanceof Error ? cause.message : 'The request failed.');
      setGraphState('error');
    }
  };

  const jumpToModule = async (moduleId: number) => {
    const module = modules.find((m) => m.id === moduleId);
    if (!module) return;
    setSelectedModule(module);
    setSelectedSubmodule(null);
    setGraphState('idle');
    try {
      const payload = await listErpSubmodules(session, moduleId);
      const first = payload.submodules.find((s) => s.mapped);
      if (first) await openSubmodule(module, first);
    } catch {
      // The tree itself will still let the user expand this module manually.
    }
  };

  const fetchNodeDetailPage = (node: KgNodeInput, skip: number) =>
    fetchGraphNodeDetail(session, node.entityKey, node.recordId as string | number, {
      relationshipLimit: RELATIONSHIP_LIMIT,
      skip,
    });

  const selectNode = async (node: KgNodeInput | null) => {
    setSelectedEdge(null);
    setSelectedNode(node);
    setNodeDetailNodes([]);
    setNodeDetailEdges([]);
    setNodeDetailSkip(0);
    setNodeDetailHasMore(false);

    if (!node || node.recordId === null || node.recordId === undefined) return;

    try {
      const detail = await fetchNodeDetailPage(node, 0);
      const mapped = mapGraphNodeDetail(detail);
      setNodeDetailNodes(mapped.nodes);
      setNodeDetailEdges(mapped.edges);
      setNodeDetailHasMore(mapped.hasMore);
      setNodeDetailSkip(RELATIONSHIP_LIMIT);
      if (mapped.node) {
        setSelectedNode((prev) =>
          prev && prev.id === node.id ? { ...prev, attributes: mapped.node!.attributes ?? prev.attributes } : prev
        );
      }
    } catch {
      // The panel still shows the node's own sampled properties even if the detail fetch fails.
    }
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

  const expandNode = async (node: KgNodeInput) => {
    if (node.recordId === null || node.recordId === undefined) return;
    await selectNode(node);
    try {
      const detail = await fetchNodeDetailPage(node, 0);
      const mapped = mapGraphNodeDetail(detail);
      setNodes((prev) => mergeById(prev, mapped.nodes));
      setEdges((prev) => mergeById(prev, mapped.edges));
    } catch {
      // Selection still succeeded even if the canvas-level expansion failed.
    }
  };

  const jumpToSearchResult = async (node: KgNodeInput) => {
    setSearchResults(null);
    setSelectedSubmodule(null);
    const current = { ...node, current: true };
    setNodes([current]);
    setEdges([]);
    setGraphState('ready');
    await expandNode(current);
  };

  const nodesById = useMemo(() => {
    const map = new Map<string, KgNodeInput>();
    for (const n of nodes) map.set(n.id, n);
    for (const n of nodeDetailNodes) map.set(n.id, n);
    return map;
  }, [nodes, nodeDetailNodes]);

  const hops = useMemo(
    () => (selectedNode ? buildHopsFromNodeDetail(selectedNode.id, nodeDetailNodes, nodeDetailEdges) : []),
    [selectedNode, nodeDetailNodes, nodeDetailEdges]
  );

  const nodeTypeOptions = useMemo(() => Array.from(new Set(nodes.map((n) => n.entityKey))).sort(), [nodes]);
  const relationshipTypeOptions = useMemo(() => Array.from(new Set(edges.map((e) => e.relation))).sort(), [edges]);

  const filteredNodes = useMemo(
    () => (selectedNodeTypes.size === 0 ? nodes : nodes.filter((n) => selectedNodeTypes.has(n.entityKey))),
    [nodes, selectedNodeTypes]
  );
  const filteredEdges = useMemo(() => {
    const ids = new Set(filteredNodes.map((n) => n.id));
    return edges.filter(
      (e) => ids.has(e.source) && ids.has(e.target) && (selectedRelationshipTypes.size === 0 || selectedRelationshipTypes.has(e.relation))
    );
  }, [edges, filteredNodes, selectedRelationshipTypes]);

  const mappedPath = pathResult?.found ? mapGraphPathResult(pathResult) : null;
  const displayedNodes = mappedPath ? mappedPath.nodes : filteredNodes;
  const displayedEdges = mappedPath ? mappedPath.edges : filteredEdges;

  const crumbs = [
    { label: 'Knowledge Graph', value: 'All modules' },
    ...(selectedModule ? [{ label: 'Module', value: selectedModule.label }] : []),
    ...(selectedSubmodule ? [{ label: 'Submodule', value: selectedSubmodule.label }] : []),
  ];

  return (
    <div className="flex h-[78vh] min-h-[640px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
      />

      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-1.5">
        <GraphBreadcrumbHeader crumbs={crumbs} />
        <div className="flex shrink-0 items-center gap-2">
          <GraphSyncStatus />
          <button
            type="button"
            onClick={() => setPathFinderOpen((v) => !v)}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {pathFinderOpen ? 'Hide path finder' : 'Path finder'}
          </button>
        </div>
      </div>

      {pathFinderOpen && <GraphPathFinder session={session} onResult={setPathResult} />}

      {searchResults && (
        <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{searchResults.length} result{searchResults.length === 1 ? '' : 's'}</span>
            <button type="button" onClick={() => setSearchResults(null)} aria-label="Close search results">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {searchResults.length === 0 ? (
            <p className="text-sm text-slate-400">No matching nodes.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {searchResults.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => jumpToSearchResult(node)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs hover:bg-slate-50"
                >
                  {node.label} <span className="text-slate-400">· {node.entityKey}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {pathResult && !pathResult.found && (
        <div className="border-b border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-700">No path exists between these two nodes.</div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 border-r border-slate-100">
          {modulesState === 'loading' && (
            <p className="flex items-center gap-2 px-3 py-6 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading modules…
            </p>
          )}
          {modulesState === 'error' && <p className="px-3 py-6 text-sm text-slate-400">{modulesError}</p>}
          {modulesState === 'ready' && (
            <GraphModuleTree
              session={session}
              modules={modules}
              selectedModuleId={selectedModule?.id ?? null}
              selectedSubmoduleId={selectedSubmodule?.id ?? null}
              initialFocusModuleLabel={initialFocusLabel}
              onSelectModule={openModule}
              onSelectSubmodule={openSubmodule}
            />
          )}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col p-3">
          {graphState === 'idle' && (
            <p className="flex flex-1 items-center justify-center text-sm text-slate-400">Pick a submodule on the left to explore its real graph.</p>
          )}
          {graphState === 'loading' && (
            <p className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          )}
          {graphState === 'error' && (
            <div className="flex flex-1 items-center justify-center gap-3 px-6 text-center text-sm text-slate-400">
              <ServerCrash className="h-4 w-4 shrink-0" /> {graphError}
            </div>
          )}
          {graphState === 'not-mapped' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <Network className="h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Not mapped to the graph yet</p>
              <p className="text-sm text-slate-400">
                This submodule has no real GraphSchema label mapping — a data-coverage gap, reported honestly rather than shown with
                invented data.
              </p>
            </div>
          )}
          {graphState === 'ready' && (
            <>
              <div className="mb-2">
                <TypeLegend variant="category" entityKeys={displayedNodes.map((n) => n.entityKey)} />
              </div>
              <GraphCanvas
                nodes={displayedNodes}
                edges={displayedEdges}
                variant="browser"
                onNodeSelect={selectNode}
                onEdgeSelect={setSelectedEdge}
                onExpandNode={expandNode}
                heightClassName="h-full"
              />
            </>
          )}
        </main>

        {(selectedNode || selectedEdge) && (
          <div className="w-80 shrink-0 border-l border-slate-100 p-3">
            <GraphDetailPanel
              variant="docked"
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
            />
          </div>
        )}
      </div>
    </div>
  );
}
