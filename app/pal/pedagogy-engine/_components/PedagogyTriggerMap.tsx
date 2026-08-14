'use client';

import { ArrowRight, CheckCircle2, CircleSlash, Clock } from 'lucide-react';
import type { PedagogyTrigger } from '@/app/pal/data/pedagogy-engine';

function durationTone(duration: string | null) {
  const value = (duration ?? '').toLowerCase();
  if (value === 'short') return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (value === 'long') return 'bg-violet-50 text-violet-700 ring-violet-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

export default function PedagogyTriggerMap({ triggers }: { triggers: PedagogyTrigger[] }) {
  if (triggers.length === 0) {
    return (
      <div className="rounded-[26px] border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
        <p className="text-sm text-slate-600">No trigger mappings are configured in the backend yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
      <div className="hidden border-b border-slate-100 bg-[linear-gradient(180deg,#faf9ff_0%,#ffffff_100%)] px-5 py-3 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_120px]">
        {['Trigger', 'Pedagogy', 'H5P type', 'Length'].map((heading) => (
          <span key={heading} className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {heading}
          </span>
        ))}
      </div>

      <ul className="divide-y divide-slate-100">
        {triggers.map((trigger) => (
          <li
            key={trigger.id}
            className="gap-3 px-5 py-4 transition hover:bg-slate-50/70 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_120px] lg:items-center"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{trigger.trigger}</p>
              {trigger.outcome ? <p className="mt-1 text-xs leading-5 text-slate-500">{trigger.outcome}</p> : null}
              {trigger.source_tier ? (
                <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  {trigger.source_tier}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex items-center gap-2 lg:mt-0">
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
              {trigger.pedagogy ? (
                <span className="rounded-full bg-violet-50 px-2.5 py-1 font-mono text-xs font-medium text-violet-700 ring-1 ring-violet-200">
                  {trigger.pedagogy}
                </span>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2 lg:mt-0">
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
              <span className={`text-sm ${trigger.h5p_type ? 'text-slate-800' : 'text-slate-400'}`}>
                {trigger.h5p_type || '—'}
              </span>
            </div>

            <div className="mt-2 lg:mt-0">
              {trigger.duration ? (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${durationTone(
                    trigger.duration
                  )}`}
                >
                  <Clock className="h-3 w-3" />
                  {trigger.duration}
                </span>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              )}
            </div>

            {/* Whether this concept's extracted record actually fires the trigger. */}
            <div className="mt-3 lg:col-span-4">
              <div
                className={`rounded-2xl border px-4 py-3 ${
                  trigger.fires_for_concept ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {trigger.fires_for_concept ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <CircleSlash className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                      trigger.fires_for_concept ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  >
                    {trigger.fires_for_concept
                      ? `Fires for this concept · ${trigger.evidence_count} record${trigger.evidence_count === 1 ? '' : 's'}`
                      : 'Does not fire for this concept'}
                  </span>
                  {trigger.evidence_source ? (
                    <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] text-slate-500 ring-1 ring-slate-200">
                      {trigger.evidence_source}
                    </span>
                  ) : null}
                </div>

                {trigger.evidence.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {trigger.evidence.map((item, index) => (
                      <li key={`${trigger.id}-evidence-${index}`} className="text-xs leading-5 text-slate-700">
                        · {item.label}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
