'use client';

import { Ban, ChevronRight, Lightbulb, ListOrdered, Zap } from 'lucide-react';
import type { PedagogyRule } from '@/app/pal/data/pedagogy-engine';
import ResolvedEvidence from './ResolvedEvidence';

/**
 * Renders one tier's rules as a condition -> action -> pedagogy -> H5P -> trigger
 * flow. Purely presentational: every value comes from the backend payload.
 */

/**
 * `label` is a column heading, not data. `value` is printed exactly as the
 * backend sent it; a null column renders an em-dash rather than substitute
 * wording, so nothing on screen is invented by the frontend.
 */
function FlowCell({ label, value, accent }: { label: string; value: string | null; accent?: boolean }) {
  return (
    <div
      className={`min-w-0 rounded-2xl border px-4 py-3 ${
        accent ? 'border-violet-200 bg-violet-50/60' : 'border-slate-200 bg-slate-50/70'
      }`}
    >
      <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${accent ? 'text-violet-600' : 'text-slate-400'}`}>
        {label}
      </p>
      {value ? (
        <p className="mt-1.5 text-sm leading-6 text-slate-800">{value}</p>
      ) : (
        <p className="mt-1.5 text-sm leading-6 text-slate-400">—</p>
      )}
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center text-slate-300 max-xl:rotate-90 max-xl:py-1">
      <ChevronRight className="h-4 w-4" />
    </div>
  );
}

function NoteList({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: 'rose' | 'amber';
}) {
  if (items.length === 0) return null;

  const toneClasses =
    tone === 'rose'
      ? 'border-rose-200 bg-rose-50/60 text-rose-900'
      : 'border-amber-200 bg-amber-50/60 text-amber-900';

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClasses}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
        {icon}
        {title}
      </div>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item} className="text-sm leading-6">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PedagogyRuleTable({ rules }: { rules: PedagogyRule[] }) {
  if (rules.length === 0) {
    return (
      <div className="rounded-[26px] border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
        <p className="text-sm text-slate-600">This rule group has no rows in the backend yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rules.map((rule, index) => (
        <article key={rule.id} className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-[linear-gradient(180deg,#faf9ff_0%,#ffffff_100%)] px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white">
                {index + 1}
              </span>
              <div className="min-w-0">
                {rule.group ? (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">{rule.group}</p>
                ) : null}
                <p className="truncate font-mono text-sm font-semibold text-slate-900">IF {rule.condition}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {rule.pedagogy_tags.map((tag) => (
                <span key={tag} className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-violet-200">
                  {tag}
                </span>
              ))}
              {rule.implementation_status ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                  {rule.implementation_status}
                </span>
              ) : null}
            </div>
          </header>

          <div className="px-5 py-5">
            <div className="grid items-stretch gap-2 xl:grid-cols-[minmax(0,1.4fr)_16px_minmax(0,1fr)_16px_minmax(0,1fr)]">
              <FlowCell label="Condition" value={rule.condition} accent />
              <Arrow />
              <FlowCell label="Action / content served" value={rule.action} />
              <Arrow />
              <div className="grid min-w-0 gap-2">
                <FlowCell label="Pedagogy" value={rule.pedagogy} />
                <FlowCell label="H5P type" value={rule.h5p_type} />
              </div>
            </div>

            {rule.scaffolding || rule.trigger ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {rule.scaffolding ? (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      <ListOrdered className="h-3.5 w-3.5" />
                      Scaffolding
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-slate-700">{rule.scaffolding}</p>
                  </div>
                ) : null}
                {rule.trigger ? (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50/60 px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                      <Zap className="h-3.5 w-3.5" />
                      Trigger / outcome
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-sky-900">{rule.trigger}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {rule.h5p_priority.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">H5P priority</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {rule.h5p_priority.map((item, itemIndex) => (
                    <span key={item} className="flex items-center gap-2">
                      {itemIndex > 0 ? <ChevronRight className="h-3.5 w-3.5 text-slate-300" /> : null}
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                        {item}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {rule.do_not.length > 0 || rule.avoid.length > 0 ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <NoteList icon={<Ban className="h-3.5 w-3.5" />} title="Do not" items={rule.do_not} tone="rose" />
                <NoteList icon={<Ban className="h-3.5 w-3.5" />} title="Avoid" items={rule.avoid} tone="amber" />
              </div>
            ) : null}

            {rule.reason ? (
              <div className="mt-4 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Reason</p>
                  <p className="mt-1 text-sm leading-6 text-emerald-900">{rule.reason}</p>
                </div>
              </div>
            ) : null}

            <ResolvedEvidence resolved={rule.resolved} />
          </div>
        </article>
      ))}
    </div>
  );
}
