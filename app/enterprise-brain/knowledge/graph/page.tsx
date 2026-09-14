'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ChevronRight, Network, Search } from 'lucide-react';
import { fetchGraph, type BrainGraphExpansion, type BrainGraphNode } from '@/lib/brain/api';
import { useSelectedAcademicYear } from '@/lib/academic-year';
import { Card, ErrorState, LoadingState, HeroHeader } from '../../_components/primitives';
import { IntelligenceCard } from '../../_components/IntelligenceCard';

/**
 * The school as a graph, walked one node at a time.
 *
 * EVERY EDGE IS A REAL FOREIGN KEY. Department→Staff is the staff record's own
 * department; Class→Student is who was marked present in it; Class→Teacher is
 * the class-teacher allocation. Where the school's data has no teacher
 * attribution, a class genuinely shows no teachers — drawing some anyway would
 * misrepresent the one thing this screen exists to reveal.
 *
 * IT EXPANDS RATHER THAN RENDERING EVERYTHING. A force-directed picture of 3,438
 * students is a hairball nobody can read and a payload nobody should download.
 * Walking neighbourhoods is also closer to how a person actually interrogates an
 * organization: start somewhere, ask what it connects to, follow the interesting
 * one.
 *
 * NODES CARRY THEIR FINDINGS. Selecting a department shows the open findings
 * about it, so the graph is a way into the intelligence rather than an ornament
 * beside it.
 */
export default function GraphExplorerPage() {
  const syear = useSelectedAcademicYear();
  const [roots, setRoots] = useState<Array<{ type: string; label: string; count: number }>>([]);
  const [type, setType] = useState('');
  const [nodes, setNodes] = useState<BrainGraphNode[]>([]);
  const [selected, setSelected] = useState<BrainGraphExpansion | null>(null);
  const [trail, setTrail] = useState<Array<{ type: string; id: string; label: string }>>([]);
  const [term, setTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Anything already on screen belongs to the year that was selected when it
    // was fetched, so it is dropped rather than left standing under a new one.
    setNodes([]);
    setSelected(null);
    setTrail([]);
    try {
      const payload = await fetchGraph();
      setRoots(payload.roots ?? []);
      setSelected(payload.organization ?? null);
      setTrail(payload.organization?.node ? [{ type: 'organization', id: payload.organization.node.id, label: payload.organization.node.label }] : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the graph.');
    } finally {
      setLoading(false);
    }
    // This screen drives its own drill-down state instead of going through
    // useBrainResource, so it is the one place the selected year has to be
    // named explicitly. `fetchGraph` reads the year from the session; listing
    // it here is what makes the roots reload when the header switches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syear]);

  // Load the graph roots on mount, and again whenever the LMS year changes —
  // reading an external system, not synchronising React state with React state.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const browse = useCallback(async (nextType: string, search = '') => {
    setBusy(true);
    setError(null);
    try {
      const payload = await fetchGraph({ type: nextType, q: search });
      setType(nextType);
      setNodes(payload.nodes ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not list those nodes.');
    } finally {
      setBusy(false);
    }
  }, []);

  const expand = useCallback(async (node: { type: string; id: string; label: string }, resetTrail = false) => {
    setBusy(true);
    setError(null);
    try {
      const payload = await fetchGraph({ type: node.type, id: node.id });
      setSelected(payload);
      setTrail((current) => {
        if (resetTrail) return [node];
        const existing = current.findIndex((step) => step.type === node.type && step.id === node.id);
        return existing >= 0 ? current.slice(0, existing + 1) : [...current, node];
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not expand that node.');
    } finally {
      setBusy(false);
    }
  }, []);

  if (loading) return <LoadingState label="Building the organization graph" />;
  if (error && !selected) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="p-6">
      <HeroHeader
        breadcrumb="Enterprise Brain · Knowledge"
        title="Graph Explorer"
        description="The school's real relationships — departments to staff, classes to students, staff to the classes they teach — walked one step at a time."
        actions={
          <button
            type="button"
            onClick={load}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-60"
          >
            <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      {/* Entry points: only the kinds of thing this school's data actually has. */}
      <div className="mb-5 flex flex-wrap gap-2">
        {roots.map((root) => (
          <button
            key={root.type}
            type="button"
            onClick={() => browse(root.type)}
            className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
              type === root.type
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            {root.label}
            <span className="ml-1.5 font-normal text-slate-400">{root.count.toLocaleString()}</span>
          </button>
        ))}
      </div>

      {trail.length > 0 && (
        <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-slate-400">
          {trail.map((step, index) => (
            <React.Fragment key={`${step.type}-${step.id}`}>
              {index > 0 && <ChevronRight size={13} className="text-slate-300" />}
              <button
                type="button"
                onClick={() => expand(step)}
                className={index === trail.length - 1 ? 'font-semibold text-slate-700' : 'hover:text-slate-600'}
              >
                {step.label}
              </button>
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        {/* --------------------------------------------------- node browser */}
        <Card className="overflow-hidden">
          <div className="border-b border-gray-100 p-4">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (type) void browse(type, term.trim());
              }}
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5"
            >
              <Search size={14} className="text-gray-400" />
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder={type ? `Search ${type}s` : 'Pick a type above'}
                disabled={!type}
                className="w-full bg-transparent text-xs outline-none placeholder:text-gray-400"
              />
            </form>
          </div>
          <div className="max-h-[34rem] divide-y divide-gray-100 overflow-auto">
            {nodes.map((node) => (
              <button
                key={`${node.type}-${node.id}`}
                type="button"
                onClick={() => expand({ type: node.type, id: node.id, label: node.label }, true)}
                className="flex w-full flex-col gap-1 px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
              >
                <span className="truncate text-sm font-medium text-slate-800">{node.label}</span>
                <span className="flex flex-wrap gap-x-3 text-[11px] text-slate-400">
                  {node.metrics.map((metric) => (
                    <span key={metric.label}>
                      {metric.label}: <span className="font-semibold text-slate-600">{metric.value}</span>
                    </span>
                  ))}
                </span>
              </button>
            ))}
            {!nodes.length && (
              <p className="px-4 py-8 text-xs text-slate-400">
                {type ? 'Nothing matches that search.' : 'Choose a type above to browse, or explore from the organization on the right.'}
              </p>
            )}
          </div>
        </Card>

        {/* ---------------------------------------------------- expansion */}
        <div className="space-y-4">
          {!selected?.available ? (
            <Card className="flex min-h-[16rem] flex-col items-center justify-center p-8 text-center">
              <Network size={26} className="mb-3 text-slate-300" />
              <p className="text-sm text-slate-500">{selected?.reason ?? 'Select something to explore.'}</p>
            </Card>
          ) : (
            <>
              <Card className="p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{selected.node?.type}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">{selected.node?.label}</h2>
                {selected.node?.metrics?.length ? (
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
                    {selected.node.metrics.map((metric) => (
                      <div key={metric.label}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{metric.label}</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Card>

              {selected.edges?.map((edge) => (
                <Card key={edge.label} className="overflow-hidden">
                  <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 px-5 py-3">
                    <p className="text-sm font-semibold text-slate-900">{edge.label}</p>
                    <p className="text-[11px] text-slate-400">
                      {edge.shown < edge.total ? `${edge.shown} of ${edge.total.toLocaleString()}` : edge.total.toLocaleString()}
                    </p>
                  </div>
                  <div className="max-h-72 divide-y divide-gray-100 overflow-auto">
                    {edge.nodes.map((node) => (
                      <button
                        key={`${node.type}-${node.id}`}
                        type="button"
                        onClick={() => expand({ type: node.type, id: node.id, label: node.label })}
                        className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left transition-colors hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-800">{node.label}</p>
                          <p className="flex flex-wrap gap-x-3 text-[11px] text-slate-400">
                            {node.metrics.map((metric) => (
                              <span key={metric.label}>
                                {metric.label}: <span className="font-semibold text-slate-600">{metric.value}</span>
                              </span>
                            ))}
                          </p>
                        </div>
                        <ChevronRight size={14} className="shrink-0 text-slate-300" />
                      </button>
                    ))}
                  </div>
                </Card>
              ))}

              {selected.intelligence?.available && (
                <Card className="p-5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Intelligence</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{selected.intelligence.summary}</p>
                  {selected.intelligence.recommendations?.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {selected.intelligence.recommendations.map((rec) => (
                        <li key={rec} className="text-xs leading-relaxed text-slate-600">• {rec}</li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              {selected.signals?.length ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold tracking-tight text-slate-800">Open findings here</p>
                  {selected.signals.map((signal) => (
                    <IntelligenceCard key={signal.id} model={signal} />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
