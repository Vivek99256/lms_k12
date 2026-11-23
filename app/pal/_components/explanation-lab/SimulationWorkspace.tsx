'use client';

import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { computeOutputs, initialValues, type SimModel } from '@/lib/explanation-lab/simulation';
import type { Workspace } from '@/app/pal/data/pal-explanation-workspace';

import type { WorkspacePatch } from './BoardWorkspace';

/**
 * A cause-and-effect simulation. The student moves the controls, watches the
 * readouts respond, and records the trials they think matter, with a note on
 * what they saw. The rule behind the readouts is never written on screen.
 */
export function SimulationWorkspace({
  model,
  ws,
  locked,
  onChange,
}: {
  model: SimModel;
  ws: Workspace;
  locked: boolean;
  onChange: (patch: WorkspacePatch, logLine?: string) => void;
}) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const last = ws.trials[ws.trials.length - 1]?.values;
    return { ...initialValues(model), ...(last ?? {}) };
  });
  const outputs = useMemo(() => computeOutputs(model, values), [model, values]);
  const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2).replace(/\.?0+$/, ''));

  const describe = (v: Record<string, number>) =>
    model.variables.map((x) => `${x.label} ${fmt(v[x.id] ?? x.default)}${x.unit ? ` ${x.unit}` : ''}`).join(', ');

  const record = () => {
    if (locked || ws.trials.length >= 30) return;
    onChange({ trials: [...ws.trials, { values: { ...values }, note: '' }] }, `recorded a trial: ${describe(values)}`);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Controls</h3>
          {model.variables.map((v) => (
            <label key={v.id} className="block space-y-1">
              <span className="flex items-center justify-between text-xs font-semibold text-slate-800">
                {v.label}
                <span className="font-mono text-slate-600">
                  {fmt(values[v.id] ?? v.default)} {v.unit}
                </span>
              </span>
              <input
                type="range"
                min={v.min}
                max={v.max}
                step={v.step}
                value={values[v.id] ?? v.default}
                disabled={locked}
                aria-label={v.label}
                onChange={(e) => setValues((cur) => ({ ...cur, [v.id]: Number(e.target.value) }))}
                className="h-6 w-full touch-none"
              />
            </label>
          ))}
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-live="polite">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">What happens</h3>
          {model.outputs.map((o) => {
            const pct = ((outputs[o.id] - o.min) / (o.max - o.min)) * 100;
            return (
              <div key={o.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span>{o.label}</span>
                  <span className="font-mono">
                    {fmt(outputs[o.id])} {o.unit}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-slate-200">
                  <div className="h-3 rounded-full bg-sky-600 transition-all" style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
                </div>
              </div>
            );
          })}
          {!locked ? (
            <Button type="button" size="sm" onClick={record} className="mt-1 gap-1 bg-sky-700 text-xs font-semibold text-white hover:bg-sky-800">
              <Plus className="h-3.5 w-3.5" /> Record this trial
            </Button>
          ) : null}
        </section>
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Your trials ({ws.trials.length})</h3>
        {ws.trials.length === 0 ? (
          <p className="text-xs text-slate-500">Try different settings and record the ones that help you understand what is going on.</p>
        ) : (
          <ol className="space-y-2">
            {ws.trials.map((t, i) => {
              const out = computeOutputs(model, t.values);
              return (
                <li key={i} className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-slate-700">
                      <strong>Trial {i + 1}:</strong> {describe(t.values)} →{' '}
                      {model.outputs.map((o) => `${o.label} ${fmt(out[o.id])}${o.unit ? ` ${o.unit}` : ''}`).join(', ')}
                    </p>
                    {!locked ? (
                      <button type="button" aria-label={`Remove trial ${i + 1}`} onClick={() => onChange({ trials: ws.trials.filter((_, j) => j !== i) }, `removed trial ${i + 1}`)} className="text-slate-500 hover:text-rose-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                  <input
                    value={t.note}
                    disabled={locked}
                    maxLength={400}
                    onChange={(e) => onChange({ trials: ws.trials.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })}
                    placeholder="What did you notice in this trial?"
                    aria-label={`What you noticed in trial ${i + 1}`}
                    className="mt-1.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
