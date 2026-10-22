'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Info } from 'lucide-react';
import type { BrainCrossModuleInsight, BrainCrossModulePayload } from '@/lib/brain/api';
import { Card, Pill } from './primitives';

/**
 * Cross-module insights: relationships BETWEEN modules, each with its calculation, sources and limits.
 *
 * Every figure comes from the backend (`/cross-module/intelligence`), which reuses the module
 * services' own definitions. This component formats; it computes nothing. An insight the backend
 * declined (too few matched classes, a module with no data) is shown as that, with the reason - never
 * as an empty chart or a made-up figure. Wording stays "association": the backend supplies the
 * explanation and this screen never adds a cause.
 */

export interface CrossModuleResource {
  data: BrainCrossModulePayload | null;
  error: string;
  loading: boolean;
  refreshing: boolean;
  refresh: () => void;
}

const STATUS: Record<BrainCrossModuleInsight['status'], { label: string; tone: 'green' | 'amber' | 'gray' }> = {
  supported: { label: 'Computed from your data', tone: 'green' },
  insufficient_data: { label: 'Not enough data', tone: 'amber' },
  unavailable: { label: 'Data unavailable', tone: 'gray' },
};

function Scatter({ insight }: { insight: BrainCrossModuleInsight }) {
  const rows = insight.rows;
  if (rows.length === 0) return null;
  const xs = rows.map((r) => r.attendanceRate);
  const ys = rows.map((r) => r.resultPercentage);
  const pad = (min: number, max: number) => (max - min < 1 ? [min - 1, max + 1] : [min - (max - min) * 0.1, max + (max - min) * 0.1]);
  const [x0, x1] = pad(Math.min(...xs), Math.max(...xs));
  const [y0, y1] = pad(Math.min(...ys), Math.max(...ys));
  const W = 360;
  const H = 200;
  const px = (v: number) => 36 + ((v - x0) / (x1 - x0)) * (W - 48);
  const py = (v: number) => H - 28 - ((v - y0) / (y1 - y0)) * (H - 44);
  const below = new Set(insight.belowOnBoth ?? []);
  const { institutionAttendanceRate: ia, institutionMeanPercentage: im } = insight.metrics;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      className="w-full max-w-md"
      aria-label={`Each dot is a class: attendance rate across, mean result percentage up. ${rows.length} classes.`}
    >
      {ia != null && ia >= x0 && ia <= x1 ? <line x1={px(ia)} x2={px(ia)} y1={8} y2={H - 28} stroke="#CBD5E1" strokeDasharray="3 3" /> : null}
      {im != null && im >= y0 && im <= y1 ? <line x1={36} x2={W - 12} y1={py(im)} y2={py(im)} stroke="#CBD5E1" strokeDasharray="3 3" /> : null}
      <line x1={36} x2={W - 12} y1={H - 28} y2={H - 28} stroke="#94A3B8" />
      <line x1={36} x2={36} y1={8} y2={H - 28} stroke="#94A3B8" />
      {rows.map((r) => (
        <circle
          key={r.class}
          cx={px(r.attendanceRate)}
          cy={py(r.resultPercentage)}
          r={5}
          fill={below.has(r.class) ? '#D97706' : '#4F46E5'}
          fillOpacity={0.85}
        >
          <title>{`${r.class}: attendance ${r.attendanceRate}%, results ${r.resultPercentage}%`}</title>
        </circle>
      ))}
      <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#64748B">
        Attendance rate (%)
      </text>
      <text x={10} y={H / 2} textAnchor="middle" fontSize="10" fill="#64748B" transform={`rotate(-90 10 ${H / 2})`}>
        Mean result (%)
      </text>
    </svg>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{children}</dd>
    </div>
  );
}

function InsightCard({ insight }: { insight: BrainCrossModuleInsight }) {
  const status = STATUS[insight.status];
  const m = insight.metrics;
  const unmatched = [...insight.coverage.attendanceOnly, ...insight.coverage.resultsOnly];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{insight.title}</h3>
          {insight.period ? <p className="mt-0.5 text-[11px] text-slate-400">{insight.period}</p> : null}
        </div>
        <Pill tone={status.tone}>{status.label}</Pill>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-700">{insight.explanation}</p>

      {insight.status === 'supported' ? (
        <div className="mt-4 grid gap-5 md:grid-cols-[auto_1fr]">
          <Scatter insight={insight} />
          <dl className="grid grid-cols-2 content-start gap-3 text-xs">
            <Stat label="Classes compared">{m.classesCompared}</Stat>
            <Stat label="Rank correlation">{m.spearman == null ? '—' : m.spearman.toFixed(2)}</Stat>
            <Stat label="Below on both">{m.classesBelowOnBoth ?? 0}</Stat>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Institute baseline</dt>
              <dd className="mt-0.5 text-sm tabular-nums text-slate-700">
                {m.institutionAttendanceRate ?? '—'}% attendance · {m.institutionMeanPercentage ?? '—'}% results
              </dd>
            </div>
            <p className="col-span-2 text-[11px] text-slate-400">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-600" />
              Amber dots are classes below the institute on both measures.
            </p>
          </dl>
        </div>
      ) : null}

      {unmatched.length > 0 ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            Data-quality warning: {unmatched.length} class name(s) do not match between Attendance and Results and were left out (
            {unmatched.slice(0, 6).join(', ')}).
          </span>
        </p>
      ) : null}

      <details className="mt-4 text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-700">How this was calculated, and its limits</summary>
        <p className="mt-2">{insight.calculation}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {insight.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="mt-2 text-slate-400">Sources: {insight.sources.map((s) => `${s.label} (${s.tables.join(', ')})`).join(' · ')}</p>
      </details>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
        <p className="flex items-start gap-1.5 text-xs text-slate-600">
          <Info size={13} className="mt-0.5 shrink-0 text-indigo-500" />
          <span>
            <span className="font-semibold">Next step:</span> {insight.nextStep}
          </span>
        </p>
        <span className="flex flex-wrap gap-3">
          {insight.sources.map((s) => (
            <Link key={s.module} href={s.route} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
              Open {s.label}
              <ArrowRight size={12} />
            </Link>
          ))}
        </span>
      </div>
    </Card>
  );
}

export function CrossModuleInsightsSection({ resource }: { resource: CrossModuleResource }) {
  const { data, error, loading, refresh } = resource;

  return (
    <section className="mb-8" id="cross-module-insights" aria-labelledby="cross-module-heading">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="cross-module-heading" className="text-sm font-semibold tracking-tight text-slate-800">
          Cross-module insights
        </h2>
        <p className="text-[11px] text-slate-400">Relationships between modules - associations, not causes</p>
      </div>

      {loading && !data ? <Card className="p-5 text-sm text-slate-500">Reading attendance and results…</Card> : null}

      {error && !data ? (
        <Card className="border-red-100 bg-red-50/50 p-4 text-sm text-red-700">
          Couldn’t load cross-module insights: {error}{' '}
          <button type="button" onClick={refresh} className="font-semibold underline">
            Try again
          </button>
        </Card>
      ) : null}

      {data ? (
        <div className="space-y-4">
          {data.modules
            .filter((mod) => !mod.available)
            .map((mod) => (
              <p key={mod.module} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {mod.label}: no data for this year{mod.reason ? ` - ${mod.reason}` : ''}
              </p>
            ))}
          {data.insights.map((insight) => (
            <InsightCard key={insight.key} insight={insight} />
          ))}
          {data.notImplemented.length > 0 ? (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer font-semibold">Not yet connected ({data.notImplemented.length})</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {data.notImplemented.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
