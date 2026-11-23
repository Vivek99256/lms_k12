'use client';

import { effectiveSettings } from '@/lib/experiment-builder/engine';
import type { BenchItem, ExperimentModel, Settings, Vis } from '@/lib/experiment-builder/types';

/**
 * Shows one trial as it happens, for ANY lab. It draws only what the student's own settings say, using the drawing
 * hints (`vis`) each option of the specification carries: the look of the container, how warm the surroundings are,
 * the size and grain of the material, stirring, a cover. The readouts are those of the instruments that are on THEIR
 * bench (no stopwatch on the bench means no time on the screen).
 *
 * `f` is how far through the change the trial is (0 to 1); `value` is the lab's measured value for these settings.
 */

const TONES: Record<NonNullable<Vis['tone']>, string> = {
  clear: 'border-sky-300 bg-sky-50/70',
  cream: 'border-amber-200 bg-amber-50',
  grey: 'border-slate-500 bg-slate-200',
  brown: 'border-amber-800 bg-amber-100',
  green: 'border-emerald-400 bg-emerald-50',
  blue: 'border-blue-400 bg-blue-50',
  red: 'border-rose-400 bg-rose-50',
};

function warmth(heat: number): string {
  if (heat <= 12) return 'linear-gradient(#dbeafe, #eff6ff)';
  if (heat <= 25) return 'linear-gradient(#f1f5f9, #ffffff)';
  if (heat <= 40) return 'linear-gradient(#ffedd5, #fffbeb)';
  return 'linear-gradient(#fed7aa, #fef3c7)';
}

/** The drawing hints of the options the student chose, combined. */
export function visualOf(model: ExperimentModel, bench: BenchItem[], settings: Settings): Required<Pick<Vis, 'scale'>> & Vis {
  const out: Required<Pick<Vis, 'scale'>> & Vis = { scale: 1 };
  const on = new Set(bench.map((b) => b.item));
  for (const item of model.items) {
    if (!on.has(item.id)) continue;
    for (const p of item.props) {
      const v = p.options.find((o) => o.value === settings[p.key])?.vis;
      if (!v) continue;
      if (v.scale !== undefined) out.scale *= v.scale;
      if (v.tone) out.tone = v.tone;
      if (v.heat !== undefined) out.heat = v.heat;
      if (v.grains) out.grains = v.grains;
      if (v.spin !== undefined) out.spin = Math.max(out.spin ?? 0, v.spin);
      if (v.cover) out.cover = true;
    }
  }
  return out;
}

export function TrialStage({
  model,
  bench,
  chosen,
  f,
  running,
  done,
  value,
}: {
  model: ExperimentModel;
  bench: BenchItem[];
  chosen: Settings;
  f: number;
  running: boolean;
  done: boolean;
  value: number;
}) {
  const s = effectiveSettings(model, bench, chosen);
  const vis = visualOf(model, bench, s);
  const measure = model.measures[0];
  const left = model.remaining(f);
  const kind = model.visual.kind;
  const tone = TONES[vis.tone ?? 'clear'];
  const readouts = bench
    .map((b) => model.items.find((i) => i.id === b.item))
    .filter((i): i is NonNullable<typeof i> => !!i && !!i.reads);

  const grainSize = vis.grains === 'lump' ? 'h-3 w-3' : vis.grains === 'fine' ? 'h-1 w-1' : 'h-1.5 w-1.5';
  const visibleGrains = Math.ceil(36 * left);
  const decimals = measure.decimals ?? 1;
  const hasInstrument = bench.some((b) => b.item === measure.instrument);

  const readout = (i: (typeof readouts)[number]) => {
    const r = i.reads!;
    if (r.kind === 'clock') return `⏱ ${(f * value).toFixed(decimals)} ${measure.unit}`;
    const p = model.items.flatMap((x) => x.props).find((x) => x.key === r.setting);
    const o = p?.options.find((x) => x.value === s[r.setting]);
    return `${i.name}: ${o ? (r.unit && o.num !== undefined ? `${o.num} ${r.unit}` : o.label) : '—'}`;
  };

  return (
    <div className="space-y-2" data-testid="trial-stage">
      <div className="relative flex h-56 items-end justify-center overflow-hidden rounded-xl border-2 border-slate-200" style={{ background: vis.heat !== undefined ? warmth(vis.heat) : '#f8fafc' }}>
        {vis.heat !== undefined && vis.heat >= 32 ? <span className="absolute right-3 top-2 text-2xl" aria-hidden>{vis.heat >= 40 ? '🔥' : '☀️'}</span> : null}
        {vis.heat !== undefined && vis.heat <= 12 ? <span className="absolute right-3 top-2 text-2xl" aria-hidden>❄️</span> : null}

        {kind === 'dial' ? (
          <div className="mb-6 flex flex-col items-center" aria-label="Gauge">
            <svg viewBox="0 0 120 70" width="200" height="117" aria-hidden>
              <path d="M10 62a50 50 0 0 1 100 0" fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
              <path d="M10 62a50 50 0 0 1 100 0" fill="none" stroke="#38bdf8" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${f * 157} 157`} />
              <line x1="60" y1="62" x2={60 - 40 * Math.cos(f * Math.PI)} y2={62 - 40 * Math.sin(f * Math.PI)} stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
              <circle cx="60" cy="62" r="4" fill="#0f172a" />
            </svg>
          </div>
        ) : (
          <div className={`relative mb-4 h-36 w-32 overflow-hidden rounded-b-3xl border-4 border-t-0 ${tone}`} aria-label="Container">
            {kind === 'shrink' ? (
              <>
                <div className="absolute inset-x-0 bottom-0 bg-sky-300/60" style={{ height: `${(1 - left) * 45}%` }} />
                <div className="absolute inset-x-0 bottom-2 flex justify-center">
                  <span className="block leading-none drop-shadow" style={{ fontSize: `${Math.max(0.1, Math.cbrt(left) * 3.4 * vis.scale)}rem`, opacity: left < 0.01 ? 0 : 1 }} aria-hidden>
                    {model.visual.emoji}
                  </span>
                </div>
              </>
            ) : null}
            {kind === 'dissolve' ? (
              <>
                <div className="absolute inset-x-0 bottom-0 h-3/4" style={{ background: vis.heat !== undefined && vis.heat >= 55 ? 'rgba(254,215,170,0.55)' : 'rgba(186,230,253,0.55)' }} />
                <div className="absolute inset-x-2 bottom-1 flex flex-wrap-reverse gap-0.5">
                  {Array.from({ length: 36 }, (_, i) => (
                    <span key={i} className={`block rounded-sm bg-white shadow ${grainSize}`} style={{ opacity: i < visibleGrains ? 1 : 0, transition: 'opacity 0.3s' }} />
                  ))}
                </div>
              </>
            ) : null}
            {kind === 'grow' ? (
              <div className="absolute inset-x-0 bottom-2 flex justify-center">
                <span className="block leading-none drop-shadow" style={{ fontSize: `${Math.max(0.8, (1 - left) * 4.5 * vis.scale + 0.8)}rem` }} aria-hidden>
                  {model.visual.emoji}
                </span>
              </div>
            ) : null}
            {vis.spin ? (
              <span className="absolute left-1/2 top-1 -ml-3 inline-block text-xl" aria-hidden>
                <span className={`inline-block ${running ? 'animate-spin' : ''}`} style={{ animationDuration: `${(1.4 - vis.spin).toFixed(2)}s` }}>🥄</span>
              </span>
            ) : null}
            {vis.cover ? <div className="absolute inset-x-0 top-0 h-2 bg-slate-500" aria-label="Cover on" /> : null}
          </div>
        )}

        <div className="absolute bottom-2 left-3 flex flex-col gap-1 text-xs font-semibold">
          {readouts.map((i) => (
            <span key={i.id} className={i.reads!.kind === 'clock' ? 'rounded-lg bg-slate-900 px-2 py-1 font-mono text-emerald-300' : 'rounded-lg bg-white px-2 py-1 text-slate-800 shadow'} data-testid={`readout-${i.id}`}>
              {readout(i)}
            </span>
          ))}
        </div>
      </div>
      <p className="text-center text-xs text-slate-600" aria-live="polite">
        {done ? 'The change is finished.' : running ? 'Watching it happen…' : 'Ready. Press “Run this trial”.'}
        {!hasInstrument ? ' (The instrument that measures this is not on your bench, so nothing is measured.)' : ''}
      </p>
    </div>
  );
}
