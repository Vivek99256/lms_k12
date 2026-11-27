'use client';

import type { BenchItem, ExperimentModel } from '@/lib/experiment-builder/types';

import { ItemArt } from './ItemArt';

/**
 * The equipment this lab provides, as a row of drawings. The student does not choose it: they investigate with it.
 * It is here so they can see what the lab has (and so which settings and instruments exist) while they plan.
 */
export function LabStrip({ model, bench }: { model: ExperimentModel; bench: BenchItem[] }) {
  const items = bench.map((b) => model.items.find((i) => i.id === b.item)).filter((i): i is NonNullable<typeof i> => !!i);
  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-sky-50 to-amber-50 p-3" data-testid="lab-strip" aria-label="Equipment in this lab">
      <p className="mb-2 text-xs font-bold text-slate-700">Your lab has</p>
      <ul className="flex flex-wrap gap-2">
        {items.map((i) => (
          <li key={i.id} title={i.about} className="flex w-[84px] flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 text-center">
            <ItemArt id={i.icon} size={44} />
            <span className="text-[11px] font-semibold leading-tight text-slate-800">{i.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
