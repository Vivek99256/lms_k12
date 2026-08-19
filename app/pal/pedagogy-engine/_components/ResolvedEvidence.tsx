'use client';

import { CheckCircle2, CircleSlash, Database, GitCompareArrows } from 'lucide-react';
import type { PedagogyResolution } from '@/app/pal/data/pedagogy-engine';

/**
 * Shows what a rule actually resolves to for the selected concept: the records
 * pulled from semantic_intelligence, the JSON path each came from, and whether
 * the pedagogy the rule routes to agrees with the concept's own extracted
 * recommendations.
 */
export default function ResolvedEvidence({ resolved }: { resolved: PedagogyResolution | null }) {
  if (!resolved) {
    return null;
  }

  const { pedagogy } = resolved;

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#fbfaff_0%,#ffffff_100%)]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-violet-600" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600">
            Resolved from semantic_intelligence
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
            resolved.matched
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : 'bg-slate-100 text-slate-500 ring-slate-200'
          }`}
        >
          {resolved.matched ? <CheckCircle2 className="h-3 w-3" /> : <CircleSlash className="h-3 w-3" />}
          {resolved.count} record{resolved.count === 1 ? '' : 's'}
        </span>
      </header>

      <div className="px-4 py-4">
        {resolved.note ? <p className="text-xs leading-5 text-slate-500">{resolved.note}</p> : null}

        {pedagogy.selected ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <GitCompareArrows className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Pedagogy selected
              </span>
              <span className="rounded-full bg-violet-600 px-2.5 py-1 font-mono text-xs font-medium text-white">
                {pedagogy.selected}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${
                  pedagogy.agrees_with_concept
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : 'bg-amber-50 text-amber-700 ring-amber-200'
                }`}
              >
                {pedagogy.agrees_with_concept
                  ? 'Matches the concept’s extracted recommendation'
                  : 'Not among the concept’s extracted recommendations'}
              </span>
            </div>

            <dl className="mt-3 grid gap-3 md:grid-cols-3">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Rule routes to</dt>
                <dd className="mt-1 font-mono text-xs text-slate-700">{pedagogy.rule_routes_to.join(', ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Concept offers</dt>
                <dd className="mt-1 text-xs text-slate-700">{pedagogy.concept_strategies.join(', ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Allowed H5P</dt>
                <dd className="mt-1 font-mono text-xs text-slate-700">{pedagogy.selected_h5p.join(', ') || '—'}</dd>
              </div>
            </dl>
          </div>
        ) : null}

        {resolved.items.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {resolved.items.map((item, index) => (
              <li key={`${item.from}-${index}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-medium leading-6 text-slate-900">{item.label}</p>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-500">
                    {item.from}
                  </span>
                </div>
                {item.detail ? <p className="mt-1.5 text-xs leading-5 text-slate-600">{item.detail}</p> : null}
                {item.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.tags.map((tag, tagIndex) => (
                      <span
                        key={`${tag}-${tagIndex}`}
                        className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500">
            This concept carries no extracted records for this rule, so the engine has nothing to serve here. Nothing is
            substituted in its place.
          </p>
        )}

        {resolved.sources.length > 0 ? (
          <p className="mt-3 font-mono text-[10px] text-slate-400">
            source: full_intelegance_json → {resolved.sources.join(' · ')}
          </p>
        ) : null}
      </div>
    </section>
  );
}
