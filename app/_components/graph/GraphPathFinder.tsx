'use client';

/**
 * From Node / To Node / Find Path / Reset — the spec's path-finder.
 *
 * Each endpoint is picked via the same global search the top toolbar uses
 * (type a name, pick the real node), since there is no other way to name a
 * specific Neo4j record from the UI. `findKnowledgeGraphPath` always derives
 * tenant scope server-side; this component only ever sends the two nodes'
 * label+id and the optional depth/relationship-type filters.
 */

import { useState } from 'react';
import { Loader2, Route, Search, X } from 'lucide-react';

import { findKnowledgeGraphPath, searchKnowledgeGraph } from '@/lib/intelligence/client';
import type { IntelligenceContext } from '@/lib/intelligence/client';
import type { GraphPathResult } from '@/lib/intelligence/types';
import type { KgNodeInput } from './graph-model';

type PickedNode = Pick<KgNodeInput, 'id' | 'entityKey' | 'recordId' | 'label'>;

export default function GraphPathFinder({
  session,
  onResult,
}: {
  session: IntelligenceContext;
  onResult: (result: GraphPathResult | null) => void;
}) {
  const [from, setFrom] = useState<PickedNode | null>(null);
  const [to, setTo] = useState<PickedNode | null>(null);
  const [finding, setFinding] = useState(false);
  const [message, setMessage] = useState('');

  const reset = () => {
    setFrom(null);
    setTo(null);
    setMessage('');
    onResult(null);
  };

  const findPath = async () => {
    if (!from || !to || from.recordId === null || to.recordId === null) return;
    setFinding(true);
    setMessage('');
    try {
      const result = await findKnowledgeGraphPath(session, {
        fromLabel: from.entityKey,
        fromId: from.recordId,
        toLabel: to.entityKey,
        toId: to.recordId,
      });
      onResult(result);
      setMessage(result.found ? `Path found — ${result.nodes.length} nodes.` : 'No path exists between these two nodes.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The path-finder request failed.');
      onResult(null);
    } finally {
      setFinding(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2 border-b border-white/10 bg-[#0a1230] px-3 py-2">
      <NodePicker session={session} label="From node" value={from} onChange={setFrom} />
      <NodePicker session={session} label="To node" value={to} onChange={setTo} />

      <button
        type="button"
        onClick={findPath}
        disabled={!from || !to || finding}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-white/10 disabled:opacity-50"
      >
        {finding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Route className="h-3.5 w-3.5" />}
        Find path
      </button>

      <button type="button" onClick={reset} className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-400 hover:bg-white/10">
        Reset
      </button>

      {message && <span className="text-sm text-slate-400">{message}</span>}
    </div>
  );
}

function NodePicker({
  session,
  label,
  value,
  onChange,
}: {
  session: IntelligenceContext;
  label: string;
  value: PickedNode | null;
  onChange: (node: PickedNode | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickedNode[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  const search = async (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const result = await searchKnowledgeGraph(session, text.trim(), 10);
      setResults(result.nodes);
      setOpen(true);
    } finally {
      setSearching(false);
    }
  };

  if (value) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <span className="flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm text-slate-200">
          <span className="truncate">{value.label}</span>
          <button type="button" onClick={() => onChange(null)} className="text-slate-500 hover:text-slate-300" aria-label={`Clear ${label}`}>
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(event) => search(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search a node…"
          className="w-48 rounded-md border border-white/15 bg-white/5 py-1.5 pl-7 pr-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        {searching && <Loader2 className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-slate-500" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full z-20 mt-1 max-h-56 w-56 overflow-y-auto rounded-md border border-white/15 bg-[#0f1b40] shadow-lg">
          {results.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => {
                onChange(node);
                setOpen(false);
                setQuery('');
              }}
              className="flex w-full flex-col items-start px-2.5 py-1.5 text-left text-sm text-slate-200 hover:bg-white/10"
            >
              <span className="truncate font-medium">{node.label}</span>
              <span className="text-xs text-slate-500">{node.entityKey}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
