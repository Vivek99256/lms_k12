'use client';

/**
 * The centralized explorer's top toolbar: global cross-label search (hits
 * the new `search` endpoint directly — Neo4j, not the module tree), a
 * module quick-jump, and node-type / relationship-type filters over
 * whatever's currently on the canvas (client-side — the canvas is already a
 * bounded sample, there's nothing further to ask the server for here).
 */

import { useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';

import { searchKnowledgeGraph } from '@/lib/intelligence/client';
import type { IntelligenceContext } from '@/lib/intelligence/client';
import type { ErpModule } from '@/lib/intelligence/types';
import type { KgNodeInput } from './graph-model';

function toggle(set: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export default function GraphSearchBar({
  session,
  modules,
  onJumpToModule,
  onSearchResult,
  nodeTypeOptions,
  relationshipTypeOptions,
  selectedNodeTypes,
  onNodeTypesChange,
  selectedRelationshipTypes,
  onRelationshipTypesChange,
}: {
  session: IntelligenceContext;
  modules: ErpModule[];
  onJumpToModule: (moduleId: number) => void;
  /** Fired with the search results (or null to clear) — the parent decides how to show them. */
  onSearchResult: (nodes: KgNodeInput[] | null) => void;
  nodeTypeOptions: string[];
  relationshipTypeOptions: string[];
  selectedNodeTypes: ReadonlySet<string>;
  onNodeTypesChange: (next: Set<string>) => void;
  selectedRelationshipTypes: ReadonlySet<string>;
  onRelationshipTypesChange: (next: Set<string>) => void;
}) {
  const [term, setTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const runSearch = async () => {
    const trimmed = term.trim();
    if (!trimmed) {
      onSearchResult(null);
      return;
    }
    setSearching(true);
    setError('');
    try {
      const result = await searchKnowledgeGraph(session, trimmed, 30);
      onSearchResult(result.nodes);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Search failed.');
      onSearchResult(null);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setTerm('');
    setError('');
    onSearchResult(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-white px-3 py-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && runSearch()}
          placeholder="Search the whole graph…"
          className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-8 text-sm"
        />
        {term && (
          <button type="button" onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear search">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {searching && <Loader2 className="absolute right-8 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>

      <select
        defaultValue=""
        onChange={(event) => {
          const id = Number(event.target.value);
          if (id) onJumpToModule(id);
          event.target.value = '';
        }}
        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-600"
      >
        <option value="">Jump to module…</option>
        {modules.map((module) => (
          <option key={module.id} value={module.id}>
            {module.label}
          </option>
        ))}
      </select>

      {nodeTypeOptions.length > 1 && (
        <FilterGroup
          label="Node type"
          options={nodeTypeOptions}
          selected={selectedNodeTypes}
          onToggle={(value) => onNodeTypesChange(toggle(selectedNodeTypes, value))}
        />
      )}

      {relationshipTypeOptions.length > 1 && (
        <FilterGroup
          label="Relationship"
          options={relationshipTypeOptions}
          selected={selectedRelationshipTypes}
          onToggle={(value) => onRelationshipTypesChange(toggle(selectedRelationshipTypes, value))}
        />
      )}

      {error && <span className="text-xs text-rose-500">{error}</span>}
    </div>
  );
}

function FilterGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: ReadonlySet<string>;
  onToggle: (value: string) => void;
}) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
        {label}
        {selected.size > 0 && <span className="ml-1 text-blue-600">({selected.size})</span>}
      </summary>
      <div className="absolute right-0 top-full z-20 mt-1 flex max-h-56 w-56 flex-col gap-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 shadow-lg">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-slate-50">
            <input type="checkbox" checked={selected.has(option)} onChange={() => onToggle(option)} />
            <span className="truncate">{option}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
