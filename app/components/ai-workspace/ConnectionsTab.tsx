'use client';

import { useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';

import {
  fetchOntologyView,
  type OntologyViewResult,
  type OntologyViewSummary,
  type WorkspaceContext,
  type WorkspaceSession,
} from '@/lib/intelligence/workspace';

import { TabEmptyState, TabError, TabSection } from './WorkspaceChrome';

/**
 * The "Connections" tab — Ontology / Knowledge Graph, without the vocabulary.
 *
 * A teacher does not need to know what an ontology is. What they need is to see how
 * the student in front of them connects to their class, subjects, assessments, and to
 * the evidence behind a risk flag. So this tab renders a walk: hop by hop, each hop
 * labelled in plain language, each item a real record.
 *
 * A hop the data model cannot traverse says so rather than being hidden. A gap in the
 * chain is worth knowing about — silently showing a shorter chain would misrepresent
 * what the system actually knows.
 */
export function ConnectionsTab({
  session,
  context,
  views,
  route,
}: {
  session: WorkspaceSession;
  context: WorkspaceContext | null;
  views: OntologyViewSummary[];
  route: string;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [result, setResult] = useState<OntologyViewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open(view: OntologyViewSummary) {
    setActiveKey(view.key);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const outcome = await fetchOntologyView(session, view.key, {
        route,
        entity_type: context?.entity_type ?? null,
        entity_id: context?.entity_id ?? null,
      });

      setResult(outcome);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Relationships could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  if (views.length === 0) {
    return (
      <TabEmptyState message="Open a specific record to see how it connects to the rest of the school data." />
    );
  }

  return (
    <div className="space-y-4">
      <TabSection title="Explore">
        <div className="flex flex-col gap-1.5">
          {views.map((view) => (
            <button
              key={view.key}
              type="button"
              onClick={() => void open(view)}
              disabled={loading}
              className={
                activeKey === view.key
                  ? 'w-full rounded-2xl border border-[#0D6EFD]/30 bg-blue-50/70 px-3.5 py-2.5 text-left transition-all'
                  : 'w-full rounded-2xl border border-gray-200/80 bg-white px-3.5 py-2.5 text-left shadow-[0_1px_0_rgba(15,23,42,0.03)] transition-all hover:-translate-y-0.5 hover:border-[#0D6EFD]/20 hover:bg-blue-50/70 disabled:cursor-not-allowed disabled:opacity-60'
              }
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-700">{view.label}</span>
                {loading && activeKey === view.key ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-[#0D6EFD]" aria-hidden />
                ) : null}
              </span>

              {view.steps.length > 0 ? (
                <span className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
                  {view.steps.map((step, index) => (
                    <span key={index} className="inline-flex items-center gap-1">
                      {index > 0 ? <ChevronRight className="size-2.5" aria-hidden /> : null}
                      {step}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </TabSection>

      {error ? <TabError message={error} /> : null}

      {result?.found ? (
        <TabSection title={result.view?.label ?? 'Relationships'}>
          <div className="space-y-2">
            {result.root ? (
              <div className="rounded-2xl border border-[#0D6EFD]/20 bg-blue-50/50 px-3.5 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0D6EFD]">
                  Starting from
                </p>
                <p className="mt-0.5 text-xs font-semibold text-gray-900">
                  {result.root.label || String(result.root.id)}
                </p>
              </div>
            ) : null}

            {result.hops.map((hop, index) => (
              <div key={index} className="rounded-2xl border border-gray-200/80 bg-white p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-900">{hop.label}</p>
                  {hop.available ? (
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-gray-600">
                      {hop.total}
                    </span>
                  ) : null}
                </div>

                {!hop.available ? (
                  <p className="mt-1 text-[11px] leading-5 text-amber-800">
                    {hop.reason || 'This relationship is not available in the current data model.'}
                  </p>
                ) : hop.items.length === 0 ? (
                  <p className="mt-1 text-[11px] text-gray-500">No records found at this step.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {hop.items.map((item, itemIndex) => (
                      <li
                        key={`${item.entity}-${item.id}-${itemIndex}`}
                        className="truncate rounded-xl bg-gray-50/80 px-2.5 py-1.5 text-[11px] text-gray-700"
                      >
                        {item.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {result.sources.graph > 0 ? (
              <p className="px-1 text-[10px] text-gray-400">
                {result.sources.graph} of these came from the knowledge graph, the rest from
                school records.
              </p>
            ) : null}
          </div>
        </TabSection>
      ) : null}
    </div>
  );
}
