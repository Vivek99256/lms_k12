'use client';

import { Copy, Play, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { settingsOnBench } from '@/lib/experiment-builder/engine';
import type { BuilderDesign, ExperimentModel, Trial } from '@/lib/experiment-builder/types';

import { TrialStage } from './TrialStage';

/**
 * The run stage: every trial is a station on the bench, side by side, so the student can see what differs between
 * them. Each station has its own settings (fixed once it has run), its own time-lapse, and, once it has run, a box for
 * the reading the student writes down from the instrument. Reading an instrument and recording the number is the
 * student's own observation, and it is checked and marked.
 */

const FIELD = 'w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50';

export function StationGrid({
  model,
  d,
  runs,
  canRun,
  canAdd,
  onProp,
  onRun,
  onCopy,
  onRemove,
  onRecord,
  valueFor,
}: {
  model: ExperimentModel;
  d: BuilderDesign;
  /** The progress (0 to 1) of every station that is running now, by index. */
  runs: Record<number, number>;
  canRun: boolean;
  canAdd: boolean;
  onProp: (i: number, key: string, value: string) => void;
  onRun: (i: number) => void;
  onCopy: (i: number) => void;
  onRemove: (i: number) => void;
  onRecord: (i: number, raw: string) => void;
  /** The measured value a station will show for its settings. */
  valueFor: (t: Trial) => number;
}) {
  const settings = settingsOnBench(model, d.bench);
  const measure = model.measures[0];
  const busy = Object.keys(runs).length > 0;
  const hasInstrument = d.bench.some((b) => b.item === measure.instrument);

  return (
    <div className="grid gap-3 md:grid-cols-2" data-testid="stations">
      {d.trials.map((t, i) => {
        const f = i in runs ? runs[i] : t.ran ? 1 : 0;
        const running = i in runs;
        return (
          <section key={t.id} aria-label={`Station ${String.fromCharCode(65 + i)}`} className={`space-y-2 rounded-xl border-2 p-3 ${t.ran ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900">{t.label}{t.ran ? ' ✓' : ''}</h4>
              <div className="flex gap-1">
                {canAdd ? (
                  <button type="button" onClick={() => onCopy(i)} disabled={busy} title="Start a new station with the same settings" aria-label={`Copy ${t.label}`} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><Copy className="h-4 w-4" /></button>
                ) : null}
                {d.trials.length > 1 ? (
                  <button type="button" onClick={() => onRemove(i)} disabled={busy} aria-label={`Delete ${t.label}`} className="rounded p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {settings.map((s) => {
                const def = model.items.flatMap((x) => x.props).find((p) => p.key === s.key)!;
                return (
                  <label key={s.key} className="block space-y-0.5">
                    <span className="text-[10px] font-semibold text-slate-600">{s.label}</span>
                    <select value={t.props[s.key] ?? def.default} disabled={t.ran || busy} onChange={(e) => onProp(i, s.key, e.target.value)} className={FIELD} aria-label={`${s.label} for ${t.label}`}>
                      {def.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>

            <TrialStage model={model} bench={d.bench} chosen={t.props} f={f} running={running} done={t.ran && !running} value={t.ran && t.seconds !== null ? t.seconds : valueFor(t)} />

            <Button type="button" size="sm" onClick={() => onRun(i)} disabled={t.ran || busy || !canRun} className="w-full gap-1.5 bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800" data-testid={`run-${i}`}>
              <Play className="h-3.5 w-3.5" aria-hidden /> {running ? 'Running…' : t.ran ? 'Done' : 'Run this trial'}
            </Button>

            {t.ran && t.seconds !== null ? (
              <label className="block space-y-0.5 rounded-lg bg-white p-2 ring-1 ring-slate-200">
                <span className="text-[11px] font-semibold text-slate-700">Write down what the {model.items.find((x) => x.id === measure.instrument)?.name.toLowerCase() ?? 'instrument'} showed ({measure.unit})</span>
                <input
                  inputMode="decimal"
                  value={t.recorded ?? ''}
                  onChange={(e) => onRecord(i, e.target.value)}
                  className={FIELD}
                  placeholder="Type the reading"
                  aria-label={`Reading for ${t.label}`}
                  data-testid={`record-${i}`}
                />
              </label>
            ) : null}
            {t.ran && !hasInstrument ? <p className="text-[11px] text-amber-800">Nothing was measured: the instrument is not on your bench.</p> : null}
          </section>
        );
      })}
    </div>
  );
}
