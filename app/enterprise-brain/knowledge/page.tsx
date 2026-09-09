'use client';

import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchKnowledge } from '@/lib/brain/api';
import { useBrainResource } from '../_components/useBrainResource';
import { Card, ErrorState, LoadingState, MetricTiles, HeroHeader } from '../_components/primitives';
import { BarSeries, ChartCard, ConfidenceMeter } from '../_components/charts';

/**
 * Organizational memory: what this institute has learnt about itself.
 *
 * A KNOWLEDGE ASSET HERE IS KEYED BY ROOT-CAUSE FAMILY, NOT BY INCIDENT, and
 * that is the whole reason this screen is worth reading. Six separate
 * ownership-gap findings — headless departments, staff with no manager, staff
 * with no department — are not six things to know. They are one thing:
 * "ownership is assigned late in this organization". So the pipeline sharpens a
 * single asset per family and counts how often the pattern has recurred, which
 * is what `reuse` measures.
 *
 * NOTHING ON THIS SCREEN WAS WRITTEN BY HAND OR BY A MODEL. Each asset is
 * composed from the cases that produced it and the human-approved remedy for
 * that family, so every claim traces back to counted LMS rows.
 */
export default function KnowledgePage() {
  const [term, setTerm] = useState('');
  const [applied, setApplied] = useState('');
  const { data, error, loading, refreshing, refresh } = useBrainResource(() => fetchKnowledge(applied), [applied]);

  if (loading && !data) return <LoadingState label="Reading organizational memory" />;
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return null;

  return (
    <div className="p-6">
      <HeroHeader
        breadcrumb="Enterprise Brain · Knowledge"
        title="Knowledge"
        description="What this organization has learnt about itself, accumulated from every reasoned case rather than authored by hand."
        actions={
          <div className="flex items-center gap-2">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setApplied(term.trim());
              }}
              className="flex items-center gap-2"
            >
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search knowledge…"
                className="w-52 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-400 placeholder:text-slate-500"
              />
              <button type="submit" className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white">
                Search
              </button>
            </form>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-60"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        }
      />

      <MetricTiles metrics={data.metrics} />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Knowledge by root-cause family" className="lg:col-span-1">
          <BarSeries data={data.byCategory} max={14} />
        </ChartCard>

        <Card className="overflow-hidden lg:col-span-2">
          <div className="border-b border-gray-100 px-5 py-3">
            <p className="text-sm font-semibold text-slate-900">Mental models</p>
            <p className="text-xs text-slate-400">
              A model is reinforced each time its family recurs; the count is how often this organization has seen the pattern hold.
            </p>
          </div>
          <div className="max-h-80 divide-y divide-gray-100 overflow-auto">
            {data.mentalModels.map((model) => (
              <div key={String(model.id)} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-slate-800">{String(model.name)}</p>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      ×{String(model.reinforcement_count)}
                    </span>
                    <ConfidenceMeter value={model.confidence as number} />
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">{String(model.description ?? '')}</p>
                {Array.isArray(model.rules) && model.rules.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(model.rules as string[]).map((rule) => (
                      <span key={rule} className="rounded bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                        {rule}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!data.mentalModels.length && (
              <p className="px-5 py-8 text-sm text-slate-400">
                No mental models yet. They are formed once the loop has reasoned over signals — run the Intelligence Loop.
              </p>
            )}
          </div>
        </Card>
      </div>

      <h2 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">
        Knowledge assets <span className="font-normal text-slate-400">({data.assets.length})</span>
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.assets.map((asset) => (
          <Card key={String(asset.id)} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">{String(asset.title)}</p>
              <ConfidenceMeter value={asset.confidence as number} />
            </div>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-indigo-500">
              {String(asset.category).replace(/_/g, ' ')} · seen {String(asset.reuse_count)}×
            </p>
            <pre className="mt-3 flex-1 whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-slate-600">
              {String(asset.content)}
            </pre>
          </Card>
        ))}
        {!data.assets.length && (
          <Card className="p-8 md:col-span-2 xl:col-span-3">
            <p className="text-sm text-slate-400">
              No knowledge assets{applied ? ` matching “${applied}”` : ''}. Assets are harvested from reasoned cases — run the
              Intelligence Loop to produce them.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
