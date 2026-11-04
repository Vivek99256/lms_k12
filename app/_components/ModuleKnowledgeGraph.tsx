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
 */

import { useEffect, useMemo, useState } from 'react';
import { Info, Loader2, Network, Search, ServerCrash } from 'lucide-react';

import { resolveEntity } from '@/lib/intelligence/client';
import { fetchModuleViews, fetchOntologyView, type OntologyViewSummary } from '@/lib/intelligence/workspace';

import GraphBreadcrumbHeader from './graph/GraphBreadcrumbHeader';
import GraphCanvas from './graph/GraphCanvas';
import GraphDetailPanel from './graph/GraphDetailPanel';
import GraphSyncStatus from './graph/GraphSyncStatus';
import TypeLegend from './graph/TypeLegend';
import { readGraphSession } from './graph/graph-session';
import { mapOntologyViewResult } from './graph/graph-query-mapper';
import type { KgEdgeInput, KgHop, KgNodeInput } from './graph/graph-model';

type LoadState = 'loading' | 'ready' | 'error';

export function ModuleKnowledgeGraph({ moduleName, label }: { moduleName: string; label: string }) {
  const session = useMemo(() => readGraphSession(), []);
  const route = `/modules/${moduleName}/knowledge-graph`;

  const [views, setViews] = useState<OntologyViewSummary[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');

  const [selectedView, setSelectedView] = useState<OntologyViewSummary | null>(null);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: unknown; label?: string; name?: string }>>([]);
  const [searching, setSearching] = useState(false);

  const [graph, setGraph] = useState<{ nodes: KgNodeInput[]; edges: KgEdgeInput[]; hops: KgHop[]; recordLabel: string } | null>(
    null
  );
  const [selectedNode, setSelectedNode] = useState<KgNodeInput | null>(null);

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
      setGraph({ ...mapped, recordLabel: result.root?.label ?? String(id) });
      setSelectedNode(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The traversal failed.');
    }
  };

  if (state === 'loading') {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading the knowledge graph for {label}…
      </p>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6">
        <ServerCrash className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-sm leading-6 text-slate-600">{error}</p>
      </div>
    );
  }

  if (views.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center shadow-sm">
        <Network className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-700">Knowledge Graph isn&apos;t set up for {label} yet</p>
        <p className="mt-1 text-sm text-slate-500">
          No relationship views are configured for this module in the shared graph yet. This is a data-coverage
          gap, not a broken screen — the tab will fill in once {label.toLowerCase()} entities and views are added.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <GraphBreadcrumbHeader crumbs={[{ label: 'Module', value: label }]} />
        <GraphSyncStatus />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
        <select
          value={selectedView?.key ?? ''}
          onChange={(event) => {
            setSelectedView(views.find((v) => v.key === event.target.value) ?? null);
            setSearchResults([]);
            setGraph(null);
          }}
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
        >
          <option value="" disabled>
            Choose a view…
          </option>
          {views.map((view) => (
            <option key={view.key} value={view.key}>
              {view.label}
            </option>
          ))}
        </select>

        {selectedView && (
          <>
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && runSearch()}
              placeholder="Search by name…"
              className="min-w-[200px] flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={runSearch}
              disabled={searching}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
            >
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Search
            </button>
          </>
        )}

        {selectedView?.description && (
          <div className="flex w-full items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>{selectedView.description}</span>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="flex w-full flex-wrap gap-2 pt-1">
            {searchResults.map((result) => (
              <button
                key={String(result.id)}
                type="button"
                onClick={() => openRecord(result.id)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs hover:bg-slate-50"
              >
                {(result.label ?? result.name ?? String(result.id)) as string}
              </button>
            ))}
          </div>
        )}
      </div>

      {graph ? (
        <div className="pt-3">
          <GraphBreadcrumbHeader crumbs={[{ label: 'View', value: `${selectedView?.label} · ${graph.recordLabel}` }]} />
          <div className="mb-2">
            <TypeLegend />
          </div>
          <GraphCanvas nodes={graph.nodes} edges={graph.edges} onNodeSelect={setSelectedNode} heightClassName="h-[480px]" />
        </div>
      ) : (
        <p className="pt-4 text-sm text-slate-500">
          {selectedView ? 'Search above for a record to walk this view from.' : 'Pick a view above to get started.'}
        </p>
      )}

      {selectedNode && (
        <GraphDetailPanel
          node={selectedNode}
          hops={graph?.hops ?? []}
          onClose={() => setSelectedNode(null)}
          onItemClick={(_entity, id) => openRecord(id)}
        />
      )}
    </div>
  );
}
