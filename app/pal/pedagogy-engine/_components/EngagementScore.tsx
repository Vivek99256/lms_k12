'use client';

import { Activity, Gauge, Sigma } from 'lucide-react';
import type {
  PedagogyBand,
  PedagogyEngagementObservation,
  PedagogySignal,
} from '@/app/pal/data/pedagogy-engine';

const BAND_TONES: Record<string, { bar: string; chip: string; border: string }> = {
  critical: { bar: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700 ring-rose-200', border: 'border-rose-200' },
  warning: { bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 ring-amber-200', border: 'border-amber-200' },
  neutral: { bar: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600 ring-slate-200', border: 'border-slate-200' },
  good: { bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', border: 'border-emerald-200' },
  flow: { bar: 'bg-violet-600', chip: 'bg-violet-50 text-violet-700 ring-violet-200', border: 'border-violet-200' },
};

function bandTone(tone: string) {
  return BAND_TONES[tone] ?? BAND_TONES.neutral;
}

const SIGNAL_BAR_TONES = ['bg-violet-600', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500'];

function ObservedStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

/**
 * The weights are engine configuration; the observed numbers are aggregated
 * from real PAL session telemetry. When no sessions exist the panel says so
 * rather than showing a zero that would read as a measurement.
 */
function ObservedPanel({ observed }: { observed: PedagogyEngagementObservation }) {
  return (
    <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white">
          <Activity className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">Observed telemetry</h3>
          {observed.source ? <p className="mt-0.5 font-mono text-[11px] text-slate-400">{observed.source}</p> : null}
        </div>
      </header>

      <div className="p-5">
        {observed.has_data ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <ObservedStat label="Sessions" value={String(observed.sessions)} />
            <ObservedStat
              label="Avg score"
              value={observed.average_engagement_score !== null && observed.average_engagement_score !== undefined ? String(observed.average_engagement_score) : '—'}
            />
            <ObservedStat
              label="Avg minutes"
              value={observed.average_session_minutes !== null && observed.average_session_minutes !== undefined ? String(observed.average_session_minutes) : '—'}
            />
            <ObservedStat
              label="Avg interactions"
              value={observed.average_interactions !== null && observed.average_interactions !== undefined ? String(observed.average_interactions) : '—'}
            />
            <ObservedStat label="Events" value={String(observed.events_recorded ?? 0)} />
          </div>
        ) : null}

        {observed.note ? (
          <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3 text-xs leading-5 text-slate-600">
            {observed.note}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default function EngagementScore({
  signals,
  interpretation,
  formula,
  observed,
}: {
  signals: PedagogySignal[];
  interpretation: PedagogyBand[];
  formula: string | null;
  observed?: PedagogyEngagementObservation;
}) {
  const totalWeight = signals.reduce((sum, signal) => sum + (signal.weight_percent ?? 0), 0);

  return (
    <div className="space-y-4">
      {observed ? <ObservedPanel observed={observed} /> : null}
      {formula ? (
        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start gap-3 border-b border-slate-100 bg-[linear-gradient(180deg,#faf9ff_0%,#ffffff_100%)] px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
              <Sigma className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">Formula</p>
              <p className="mt-1 font-mono text-sm leading-6 text-slate-800">{formula}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Weighted signals</h3>
              <p className="mt-1 text-xs text-slate-500">Each contribution to the 0-100 engagement score.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {totalWeight}%
            </span>
          </header>

          <ul className="divide-y divide-slate-100">
            {signals.map((signal, index) => {
              const percent = signal.weight_percent ?? 0;
              return (
                <li key={signal.id} className="px-5 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{signal.name}</p>
                    <p className="font-mono text-sm font-bold text-slate-900">{percent}%</p>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${SIGNAL_BAR_TONES[index % SIGNAL_BAR_TONES.length]}`}
                      style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
                    />
                  </div>
                  {signal.description ? (
                    <p className="mt-2 text-xs leading-5 text-slate-500">{signal.description}</p>
                  ) : null}
                  <p className="mt-1 font-mono text-[11px] text-slate-400">{signal.key}</p>
                </li>
              );
            })}
            {signals.length === 0 ? (
              <li className="px-5 py-6 text-sm text-slate-500">No engagement signals are configured in the backend yet.</li>
            ) : null}
          </ul>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Gauge className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Score interpretation</h3>
              <p className="mt-1 text-xs text-slate-500">What the engine does inside each band.</p>
            </div>
          </header>

          <ul className="space-y-3 p-5">
            {interpretation.map((band) => {
              const tone = bandTone(band.tone);
              return (
                <li key={band.id} className={`rounded-2xl border px-4 py-3 ${tone.border}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone.chip}`}>
                      {band.label}
                    </span>
                    <span className="font-mono text-xs font-semibold text-slate-600">{band.range}</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${tone.bar}`}
                      style={{
                        marginLeft: `${Math.min(Math.max(band.min ?? 0, 0), 100)}%`,
                        width: `${Math.max(
                          Math.min(Math.max(band.max ?? 100, 0), 100) - Math.min(Math.max(band.min ?? 0, 0), 100),
                          2
                        )}%`,
                      }}
                    />
                  </div>
                  {band.action ? <p className="mt-2 text-sm leading-6 text-slate-700">{band.action}</p> : null}
                </li>
              );
            })}
            {interpretation.length === 0 ? (
              <li className="text-sm text-slate-500">No interpretation bands are configured in the backend yet.</li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
