'use client';

/**
 * The decentralized Knowledge Graph — one module's own scoped view onto the
 * shared graph, reached from that module's "Knowledge Graph" tool-strip tab.
 *
 * Mirrors ModuleAuditTrail/ModuleIntelligence: takes the module's slug and
 * display label as plain props (the category page already resolved both),
 * and is the one component every module's bar renders — there is no
 * per-module copy of this file.
 *
 * Lists the module's own named relationship views (seeded in
 * `ai_ontology_views` with that `module_key` — today only Student and Fees
 * have any), lets the user search for a real record of the view's root
 * entity, then walks it through `OntologyViewResolver`
 * (`POST /api/ai/workspace/ontology-views/{view}`) — the same hop-by-hop
 * engine the AI Workspace panel's own Relationships tab uses. A module with
 * no views yet says so plainly rather than showing an empty canvas.
 *
 * VISUAL DESIGN: matches `CentralizedKnowledgeGraphExplorer` and
 * `org-knowledge-graph.tsx`'s bubble/physics force-simulation design
 * panel for panel: a left sidebar (the module's own views), a top search
 * bar (searching this module's root entity once a view is picked),
 * `GraphBubbleCanvas` (glowing gradient orb nodes, animated curved edges,
 * drag/pin, double-click release, category legend, dark/light toggle),
 * and `GraphDetailPanel` (`variant="docked"` dark glass drawer).
 */

import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Info, Loader2, Maximize, Minimize, Network, Search, ServerCrash, X } from 'lucide-react';

import { resolveEntity } from '@/lib/intelligence/client';
import { expandGraphNode, fetchModuleViews, fetchOntologyView, type OntologyViewSummary } from '@/lib/intelligence/workspace';

import GraphBreadcrumbHeader from './graph/GraphBreadcrumbHeader';
import GraphBubbleCanvas from './graph/GraphBubbleCanvas';
import GraphDetailPanel from './graph/GraphDetailPanel';
import GraphSyncStatus from './graph/GraphSyncStatus';
import { readGraphSession } from './graph/graph-session';
import { mapExpandNodeResult, mapOntologyViewResult } from './graph/graph-query-mapper';
import type { KgEdgeInput, KgHop, KgNodeInput } from './graph/graph-model';

type LoadState = 'loading' | 'ready' | 'error';

export function ModuleKnowledgeGraph({ moduleName, label }: { moduleName: string; label: string }) {
  const session = useMemo(() => readGraphSession(), []);
  const route = `/modules/${moduleName}/knowledge-graph`;

  const [views, setViews] = useState<OntologyViewSummary[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [viewFilter, setViewFilter] = useState('');

  const [selectedView, setSelectedView] = useState<OntologyViewSummary | null>(null);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: unknown; label?: string; name?: string }>>([]);
  const [searching, setSearching] = useState(false);

  const [graph, setGraph] = useState<{ nodes: KgNodeInput[]; edges: KgEdgeInput[]; hops: KgHop[]; recordLabel: string } | null>(
    null
  );
  /** The view's original walk result, untouched by any later expansion — what "Reset graph" restores. */
  const [baseGraph, setBaseGraph] = useState<typeof graph>(null);
  const [selectedNode, setSelectedNode] = useState<KgNodeInput | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<KgEdgeInput | null>(null);
  const [expandingId, setExpandingId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  useEffect(() => {
    let cancelled = false;

    fetchModuleViews(session, { route, module: moduleName })
      .then((payload) => {
        if (cancelled) return;
        setViews(payload.views);
        setState('ready');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'The request failed.');
        setState('error');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleName]);

  const selectView = (view: OntologyViewSummary) => {
    setSelectedView(view);
    setSearchText('');
    setSearchResults([]);
    setGraph(null);
    setBaseGraph(null);
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  const runSearch = async () => {
    if (!selectedView?.root_entity_key) return;
    setSearching(true);
    try {
      const result = await resolveEntity(session, selectedView.root_entity_key, searchText || undefined, 10);
      setSearchResults(result.results as Array<{ id: unknown; label?: string; name?: string }>);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The search failed.');
    } finally {
      setSearching(false);
    }
  };

  const openRecord = async (id: unknown) => {
    if (!selectedView || id === null || id === undefined) return;
    try {
      const result = await fetchOntologyView(session, selectedView.key, {
        route,
        entity_type: selectedView.root_entity_key,
        entity_id: id as number | string,
      });
      const mapped = mapOntologyViewResult(result);
      const next = { ...mapped, recordLabel: result.root?.label ?? String(id) };
      setGraph(next);
      setBaseGraph(next);
      setSelectedNode(null);
      setSelectedEdge(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The traversal failed.');
    }
  };

  /**
   * Node-by-node progressive exploration: fetch a node's own real
   * connections (every direction, not a fixed hop path) and add them to the
   * canvas in place — existing nodes/edges stay exactly where they are.
   * Dedupes against whatever's already on screen by id, same fingerprint
   * scheme the initial view walk uses, so expanding two branches that both
   * reach the same record doesn't draw it twice.
   */
  const handleExpand = async (target?: KgNodeInput) => {
    const node = target ?? selectedNode;
    if (!node || !graph) return;
    setExpandingId(node.id);
    try {
      const result = await expandGraphNode(session, node.entityKey, node.recordId ?? '');
      const mapped = mapExpandNodeResult(node.id, result);

      setGraph((current) => {
        if (!current) return current;
        const existingNodeIds = new Set(current.nodes.map((n) => n.id));
        const existingEdgeIds = new Set(current.edges.map((e) => e.id));
        const newNodes = mapped.nodes.filter((n) => !existingNodeIds.has(n.id));
        const newEdges = mapped.edges.filter((e) => !existingEdgeIds.has(e.id));
        return { ...current, nodes: [...current.nodes, ...newNodes], edges: [...current.edges, ...newEdges], hops: mapped.hops };
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The expand request failed.');
    } finally {
      setExpandingId(null);
    }
  };

  const selectNode = (node: KgNodeInput | null) => {
    setSelectedEdge(null);
    setSelectedNode(node);
  };

  /** Restores the view's original walk result, discarding every expansion added since. */
  const resetGraph = () => {
    setGraph(baseGraph);
    setSelectedNode(null);
    setSelectedEdge(null);
  };

  const nodesById = useMemo(() => new Map((graph?.nodes ?? []).map((n) => [n.id, n])), [graph]);

  const filterTerm = viewFilter.trim().toLowerCase();
  const visibleViews = filterTerm ? views.filter((v) => v.label.toLowerCase().includes(filterTerm)) : views;

  if (state === 'loading') {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading the knowledge graph for {label}…
      </p>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-white/15 bg-white/5 px-4 py-6 text-rose-400">
        <ServerCrash className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-sm leading-6">{error}</p>
      </div>
    );
  }

  if (views.length === 0) {
    return (
      <div className="rounded-lg border border-white/15 bg-[#0a1230] px-4 py-8 text-center text-slate-100 shadow-sm">
        <Network className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-3 text-sm font-medium text-slate-200">Knowledge Graph isn&apos;t set up for {label} yet</p>
        <p className="mt-1 text-sm text-slate-400">
          No relationship views are configured for this module in the shared graph yet. This is a data-coverage
          gap, not a broken screen — the tab will fill in once {label.toLowerCase()} entities and views are added.
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[9999] flex h-screen w-screen flex-col overflow-hidden bg-[#0a1230] text-slate-100 shadow-2xl'
          : 'flex h-[calc(100vh-140px)] min-h-[560px] flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0a1230] text-slate-100 shadow-sm'
      }
    >
      {/* Top global search bar — this module's root-entity search, the per-record equivalent of the centralized explorer's whole-graph search. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#0a1230] px-3 py-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && runSearch()}
            disabled={!selectedView}
            placeholder={selectedView ? `Search ${selectedView.label.toLowerCase()}…` : 'Pick a view on the left first…'}
            className="w-full rounded-md border border-white/15 bg-white/5 py-1.5 pl-8 pr-8 text-sm text-slate-100 placeholder:text-slate-500 disabled:bg-white/5 disabled:text-slate-600"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => {
                setSearchText('');
                setSearchResults([]);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {searching && <Loader2 className="absolute right-8 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />}
        </div>
        <button
          type="button"
          onClick={runSearch}
          disabled={!selectedView || searching}
          className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-white/10 disabled:opacity-50"
        >
          Search
        </button>

        {searchResults.length > 0 && (
          <div className="flex w-full flex-wrap gap-2 pt-1">
            {searchResults.map((result) => (
              <button
                key={String(result.id)}
                type="button"
                onClick={() => openRecord(result.id)}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-slate-200 hover:bg-white/15"
              >
                {(result.label ?? result.name ?? String(result.id)) as string}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#0a1230] px-3 py-1.5">
        <GraphBreadcrumbHeader
          dark={true}
          crumbs={
            graph
              ? [{ label: 'Module', value: label }, { label: 'View', value: `${selectedView?.label} · ${graph.recordLabel}` }]
              : [{ label: 'Module', value: label }]
          }
        />
        <div className="flex shrink-0 items-center gap-2">
          {expandingId && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Expanding {nodesById.get(expandingId)?.label ?? 'node'}…
            </span>
          )}
          <GraphSyncStatus />
          {baseGraph && graph && graph.nodes.length > baseGraph.nodes.length && (
            <button
              type="button"
              onClick={resetGraph}
              title="Collapse every expanded node and return to this view's starting result"
              className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-white/10"
            >
              Reset graph
            </button>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-white/10"
            title={isFullscreen ? 'Exit full screen' : 'Full screen'}
          >
            {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
            <span>{isFullscreen ? 'Exit full screen' : 'Full screen'}</span>
          </button>
        </div>
      </div>

      {selectedView?.description && (
        <div className="flex items-start gap-2 border-b border-white/10 bg-[#0f1b40] px-3 py-2 text-xs leading-5 text-slate-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>{selectedView.description}</span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Left sidebar — this module's own views, standing in for the centralized explorer's module/submodule tree. */}
        <aside className="w-64 shrink-0 border-r border-white/10 bg-[#0a1230]">
          <div className="relative px-2 pb-2 pt-1">
            <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={viewFilter}
              onChange={(event) => setViewFilter(event.target.value)}
              placeholder="Filter views…"
              className="w-full rounded-md border border-white/15 bg-white/5 py-1.5 pl-8 pr-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto px-1">
            {visibleViews.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-400">No views match &ldquo;{viewFilter}&rdquo;.</p>
            )}
            {visibleViews.map((view) => (
              <button
                key={view.key}
                type="button"
                onClick={() => selectView(view)}
                className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/10 ${
                  selectedView?.key === view.key ? 'bg-blue-500/20 font-medium text-blue-300' : 'text-slate-300'
                }`}
              >
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{view.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col p-3 bg-[#0a1230]">
          {graph ? (
            <GraphBubbleCanvas
              nodes={graph.nodes}
              edges={graph.edges}
              selectedNodeId={selectedNode?.id ?? null}
              selectedEdgeId={selectedEdge?.id ?? null}
              loadingNodeId={expandingId}
              onNodeClick={(node) => {
                selectNode(node);
                void handleExpand(node);
              }}
              onEdgeClick={setSelectedEdge}
              onBackgroundClick={() => {
                setSelectedNode(null);
                setSelectedEdge(null);
              }}
              onCollapseAll={resetGraph}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              heightClassName="h-full"
            />
          ) : (
            <p className="flex flex-1 items-center justify-center text-sm text-slate-400">
              {selectedView ? 'Search above for a record to walk this view from.' : 'Pick a view on the left to get started.'}
            </p>
          )}
        </main>

        {(selectedNode || selectedEdge) && (
          <div className="w-80 shrink-0 border-l border-white/10 bg-[#0a1230] p-3">
            <GraphDetailPanel
              variant="docked"
              node={selectedNode}
              edge={selectedEdge}
              edgeSourceLabel={selectedEdge ? nodesById.get(selectedEdge.source)?.label : undefined}
              edgeTargetLabel={selectedEdge ? nodesById.get(selectedEdge.target)?.label : undefined}
              hops={graph?.hops ?? []}
              onClose={() => {
                setSelectedNode(null);
                setSelectedEdge(null);
              }}
              onItemClick={(_entity, id) => openRecord(id)}
              onExpand={() => handleExpand()}
              expanding={expandingId !== null}
            />
          </div>
        )}
      </div>
    </div>
  );
}
